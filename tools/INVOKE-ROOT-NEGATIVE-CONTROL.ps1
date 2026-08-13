<#
.SYNOPSIS
Reusable negative-control harness for the SourceRoot governed development system.

.DESCRIPTION
A verifier that only ever passes proves nothing. Every control below asserts
that the system REFUSES something, and the harness fails if any refusal does not
happen. A control that cannot fail is not a control.

Four families:

  SELECTION   authority is selected by explicit id AND digest, never by
              existence, recency, or sort order, and one issuance can never be
              answered by another
  INTEGRITY   tampered bytes, wrong keys, wrong namespaces and non-canonical
              form are refused
  GRAMMAR     unsafe paths and unauthorized paths are refused
  STRUCTURE   the PowerShell module contains no trust-core implementation, and
              the trust core is present and answers

The harness mutates NOTHING in the repository and NOTHING in the control store.
Every negative case is expressed by asking the core a question whose only honest
answer is a refusal.

.EXAMPLE
  ./tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1
#>
[CmdletBinding()]
param(
    [Parameter()][string]$RepositoryRoot,
    [Parameter()][string]$StageSlug = $env:SRGDS_STAGE,
    [Parameter()][string]$AuthorizationId = $env:SRGDS_AUTHORIZATION_ID,
    [Parameter()][string]$AuthorizationDigest = $env:SRGDS_AUTHORIZATION_DIGEST,
    [Parameter()][string]$SignerFingerprint = $env:SRGDS_SIGNER_FINGERPRINT,
    [Parameter()][string]$SignerPrincipal = $env:SRGDS_SIGNER_PRINCIPAL,
    [Parameter()][string]$ReleasedStageSlug = $env:SRGDS_RELEASED_STAGE,
    [Parameter()][string]$ReleasedAuthorizationId = $env:SRGDS_RELEASED_AUTHORIZATION_ID,
    [Parameter()][string]$ReleasedAuthorizationDigest = $env:SRGDS_RELEASED_AUTHORIZATION_DIGEST,
    [Parameter()][string]$AuditDigest = $env:SRGDS_AUDIT_DIGEST,
    [Parameter()][string]$ReleaseDigest = $env:SRGDS_RELEASE_DIGEST,
    [Parameter()][string]$AuditorPrincipal = $env:SRGDS_AUDITOR_PRINCIPAL,
    [Parameter()][string]$AuditorFingerprint = $env:SRGDS_AUDITOR_FINGERPRINT,
    [Parameter()][string]$CommitBindingDigest = $env:SRGDS_COMMIT_BINDING_DIGEST,
    [Parameter()][string]$CorePath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}
Import-Module (Join-Path $PSScriptRoot "SourceRoot.Governance.psm1") -Force

$script:Passed = 0
$script:Failed = 0

function Test-Control {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Expectation,
        [Parameter(Mandatory = $true)][bool]$Held,
        [Parameter()][string]$Detail
    )
    if ($Held) { $script:Passed++; $Mark = "HELD" } else { $script:Failed++; $Mark = "*** FAILED ***" }
    Write-Output ("{0,-8} {1,-62} {2}" -f $Id, $Expectation, $Mark)
    if ($Detail) { Write-Output "         $Detail" }
}

function Test-Refusal {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Expectation,
        [Parameter(Mandatory = $true)][scriptblock]$Attempt
    )
    # A refusal may arrive as a REJECT verdict or as a thrown error. Both are
    # refusals; neither is success. Anything else is an acceptance.
    try {
        $Result = & $Attempt
        $Refused = -not [bool]$Result
        $Detail = $(if ($Refused) { "rejected" } else { "ACCEPTED" })
    } catch {
        $Refused = $true
        $Detail = "threw: $($_.Exception.Message.Split([Environment]::NewLine)[0])"
    }
    Test-Control -Id $Id -Expectation $Expectation -Held $Refused -Detail $Detail
}

$Context = @{
    RepositoryRoot              = $RepositoryRoot
    StageSlug                   = $StageSlug
    ExpectedAuthorizationId     = $AuthorizationId
    ExpectedAuthorizationDigest = $AuthorizationDigest
    ExpectedSignerFingerprint   = $SignerFingerprint
    SignerPrincipal             = $SignerPrincipal
}
if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $Context.CorePath = $CorePath }

# The RELEASED predecessor is a separate execution context because it describes a
# DIFFERENT commit. Conflating it with current authority is the mistake the
# terminal-state stage exists to remove.
$ReleaseContext = @{
    RepositoryRoot              = $RepositoryRoot
    StageSlug                   = $ReleasedStageSlug
    ExpectedAuthorizationId     = $ReleasedAuthorizationId
    ExpectedAuthorizationDigest = $ReleasedAuthorizationDigest
    ExpectedSignerFingerprint   = $SignerFingerprint
    SignerPrincipal             = $SignerPrincipal
    AuditDigest                 = $AuditDigest
    ReleaseDigest               = $ReleaseDigest
    AuditorPrincipal            = $AuditorPrincipal
    AuditorFingerprint          = $AuditorFingerprint
    CommitBindingDigest         = $CommitBindingDigest
}
if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $ReleaseContext.CorePath = $CorePath }
$ReleaseContextComplete = (@(@($ReleaseContext.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)

function Get-VariantRelease {
    param([hashtable]$Override)
    $Copy = @{}
    foreach ($Key in $ReleaseContext.Keys) { $Copy[$Key] = $ReleaseContext[$Key] }
    foreach ($Key in $Override.Keys) { $Copy[$Key] = $Override[$Key] }
    return $Copy
}

function Get-VariantContext {
    # Returns a COPY of the execution context with one or more values replaced.
    # The result must be bound to a variable before splatting: @(Get-VariantContext ...)
    # would wrap the hashtable in an array and splat it positionally.
    param([hashtable]$Override)
    $Copy = @{}
    foreach ($Key in $Context.Keys) { $Copy[$Key] = $Context[$Key] }
    foreach ($Key in $Override.Keys) { $Copy[$Key] = $Override[$Key] }
    return $Copy
}

Write-Output "SOURCEROOT GDS NEGATIVE CONTROL HARNESS"
Write-Output "repository : $RepositoryRoot"
Write-Output "core       : $(Get-SrgdsCorePath -Path $CorePath)"
Write-Output ""

# ---------------------------------------------------------------------------
Write-Output "=== POSITIVE BASELINE (the harness must be able to observe success) ==="
# A repository is governed in exactly one of two ways, and which one it is
# depends on where HEAD stands:
#
#   IN-FLIGHT  HEAD is a signed baseline. Current authority verifies, and the
#              SELECTION / INTEGRITY / GRAMMAR families below are live.
#   TERMINAL   HEAD is a release commit. Current authority is correctly and
#              permanently unavailable, and the governed fact is instead that
#              HEAD is the released truth, provable only from the historical
#              chain and conferring nothing.
#
# Refusing to run in the second state was the harness reproducing, in its own
# positive baseline, the defect the rest of the system just removed.
$Baseline = Get-GdsStageAuthorization @Context
$Terminal = $null
$TerminalHolds = $false
if ($ReleaseContextComplete) {
    $Terminal = Test-GdsReleaseState @ReleaseContext
    $TerminalHolds = $Terminal.Released
}
$Mode = $(if ($Baseline.Valid) { "in-flight" } elseif ($TerminalHolds) { "terminal" } else { "ungoverned" })

Test-Control -Id "P0" -Expectation "a governed state is observable ($Mode)" -Held ($Mode -ne "ungoverned") `
    -Detail $(if ($Baseline.Valid) { $Baseline.Reason } elseif ($null -ne $Terminal) { $Terminal.Reason } else { "no released-stage context was supplied" })
if ($Mode -eq "ungoverned") {
    Write-Output ""
    Write-Output "The positive baseline failed. Every negative control below would pass"
    Write-Output "vacuously, so the harness stops rather than reporting a green run."
    exit 2
}
if (-not $ReleaseContextComplete) {
    # Said out loud. A family that quietly does not run looks identical to a
    # family that ran and held, and this harness exists precisely to make that
    # confusion impossible.
    Write-Output ""
    Write-Output "=== TERMINAL: NOT EXERCISED IN THIS RUN ==="
    Write-Output "The released-stage context is incomplete, so no terminal release state"
    Write-Output "could be established and the terminal controls did NOT run. This is a SKIP."
    foreach ($Pair in @(
        @{ Name = "SRGDS_RELEASED_STAGE"; Value = $ReleasedStageSlug },
        @{ Name = "SRGDS_RELEASED_AUTHORIZATION_ID"; Value = $ReleasedAuthorizationId },
        @{ Name = "SRGDS_RELEASED_AUTHORIZATION_DIGEST"; Value = $ReleasedAuthorizationDigest },
        @{ Name = "SRGDS_AUDIT_DIGEST"; Value = $AuditDigest },
        @{ Name = "SRGDS_RELEASE_DIGEST"; Value = $ReleaseDigest },
        @{ Name = "SRGDS_AUDITOR_PRINCIPAL"; Value = $AuditorPrincipal },
        @{ Name = "SRGDS_AUDITOR_FINGERPRINT"; Value = $AuditorFingerprint },
        @{ Name = "SRGDS_COMMIT_BINDING_DIGEST"; Value = $CommitBindingDigest }
    )) {
        if ([string]::IsNullOrWhiteSpace($Pair.Value)) { Write-Output "  missing: $($Pair.Name)" }
    }
}
if ($TerminalHolds) {
    Test-Control -Id "P1" -Expectation "the terminal release tree is the audited candidate tree" `
        -Held ($Terminal.Tree -ceq $Terminal.CandidateTree) -Detail "$($Terminal.Tree) / $($Terminal.CandidateTree)"
}

# ---------------------------------------------------------------------------
if ($TerminalHolds) {
    Write-Output ""
    Write-Output "=== TERMINAL (a released state proves history and grants nothing) ==="

    # The controls that matter most: terminal state must not become a way to
    # obtain authority, and it must not accept a chain it cannot reconstruct.
    Test-Control -Id "T1" -Expectation "terminal state confers NO current authority over HEAD" `
        -Held ($Terminal.CurrentAuthorityAtHead -ceq "REJECTED") -Detail $Terminal.CurrentAuthorityAtHead

    $HistoricalAsCurrent = Get-GdsStageAuthorization -RepositoryRoot $RepositoryRoot -StageSlug $ReleasedStageSlug `
        -ExpectedAuthorizationId $ReleasedAuthorizationId -ExpectedAuthorizationDigest $ReleasedAuthorizationDigest `
        -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal
    Test-Control -Id "T2" -Expectation "the consumed authorization still fails as CURRENT authority" `
        -Held (-not $HistoricalAsCurrent.Valid) -Detail $HistoricalAsCurrent.Reason

    # Every binding in the chain must be load-bearing. If any of these is
    # accepted, terminal state is a hole rather than a proof.
    $TerminalVariants = @(
        @{ Id = "T3"; What = "a released authorization id that was never issued"; Over = @{ ExpectedAuthorizationId = "00000000-0000-4000-8000-000000000000" } },
        @{ Id = "T4"; What = "a released authorization digest that is one byte wrong"; Over = @{ ExpectedAuthorizationDigest = ("0" * 64) } },
        @{ Id = "T5"; What = "an audit binding digest that is not the audited one"; Over = @{ AuditDigest = ("0" * 64) } },
        @{ Id = "T6"; What = "a release authorization digest that is not the signed one"; Over = @{ ReleaseDigest = ("0" * 64) } },
        @{ Id = "T7"; What = "an auditor principal the audit was not issued to"; Over = @{ AuditorPrincipal = "not-the-auditor@example.invalid" } },
        @{ Id = "T8"; What = "an auditor key fingerprint that did not sign the audit"; Over = @{ AuditorFingerprint = "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } },
        @{ Id = "T9"; What = "a signer fingerprint that did not sign the authorization"; Over = @{ ExpectedSignerFingerprint = "SHA256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" } },
        @{ Id = "T10"; What = "a released stage slug that does not name this release"; Over = @{ StageSlug = "SOURCEROOT-NO-SUCH-STAGE-V1" } },
        # The audit finding: parent and tree do not identify a commit.
        @{ Id = "T11"; What = "a release commit binding digest that was never signed"; Over = @{ CommitBindingDigest = ("0" * 64) } }
    )
    foreach ($Variant in $TerminalVariants) {
        # The override is carried in a variable that is NOT a Test-Refusal
        # parameter name. Naming it $Attempt splatted the scriptblock itself,
        # so every control "held" by throwing a parameter-binding error - eight
        # controls that could not fail, which is exactly what this harness
        # exists to make impossible.
        $TerminalOverride = $Variant.Over
        Test-Refusal -Id $Variant.Id -Expectation "release state is refused for $($Variant.What)" -Attempt {
            $ReleaseVariant = Get-VariantRelease $TerminalOverride; (Test-GdsReleaseState @ReleaseVariant).Released
        }
    }
}

if (-not $Baseline.Valid) {
    Write-Output ""
    Write-Output "=== SELECTION / INTEGRITY / GRAMMAR: SKIPPED ==="
    Write-Output "HEAD is a terminal release state, so no current authorization governs it."
    Write-Output "Those families perturb CURRENT authority, which already refuses everything"
    Write-Output "here; running them would report refusals that prove nothing. This is a SKIP."
    Write-Output ""
    Write-Output ("controls held : {0}" -f $script:Passed)
    Write-Output ("controls failed: {0}" -f $script:Failed)
    if ($script:Failed -gt 0) { Write-Output "NEGATIVE CONTROL RESULT: FAIL"; exit 1 }
    Write-Output "NEGATIVE CONTROL RESULT: PASS (terminal family only)"
    exit 0
}

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "=== SELECTION ==="

Test-Refusal -Id "S1" -Expectation "the current id with a foreign digest" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationDigest = ("0" * 64) }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S2" -Expectation "a nonexistent authorizationId" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationId = "00000000-0000-4000-8000-000000000000" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S3" -Expectation "an uppercase spelling of the current id" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationId = $AuthorizationId.ToUpperInvariant() }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S4" -Expectation "an id shaped like a path traversal" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationId = "../../../etc/passwd" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S5" -Expectation "an empty expected digest" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationDigest = "" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S6" -Expectation "an empty expected id" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationId = "" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S7" -Expectation "a stage slug nothing is signed for" -Attempt {
    $Variant = Get-VariantContext @{ StageSlug = "SOURCEROOT-NO-SUCH-STAGE-V1" }; (Get-GdsStageAuthorization @Variant).Valid
}

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "=== INTEGRITY ==="

Test-Refusal -Id "I1" -Expectation "a foreign signer fingerprint" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedSignerFingerprint = "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "I2" -Expectation "a malformed signer fingerprint" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedSignerFingerprint = "not-a-fingerprint" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "I3" -Expectation "a principal that is not in allowed_signers" -Attempt {
    $Variant = Get-VariantContext @{ SignerPrincipal = "someone-else" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "I4" -Expectation "a digest that is not a SHA-256" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationDigest = "not-a-digest" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "I5" -Expectation "a repository that is not a repository" -Attempt {
    $Variant = Get-VariantContext @{ RepositoryRoot = $env:TEMP }; (Get-GdsStageAuthorization @Variant).Valid
}

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "=== GRAMMAR ==="

$Unsafe = @(
    "a.txt:stream",
    "../outside.txt",
    "/absolute.txt",
    "backend/db/migrations/020_create_earthroot_place_polity_foundation.sql",
    "engine/anything.ts",
    ".gitignore",
    "tools/srgds-core/go.sum",
    "tools/srgds-core/internal/authority/authority.go.bak"
)
foreach ($Entry in $Unsafe) {
    $Index = [Array]::IndexOf($Unsafe, $Entry) + 1
    Test-Refusal -Id "G$Index" -Expectation "path is not authorized: $Entry" -Attempt {
        (Test-GdsPathAuthorized @Context -Path @($Entry)).Authorized
    }
}

# A path that IS authorized must still be reported as authorized, or the
# grammar controls above would pass because everything is refused.
$Sample = "tools/srgds-core/main.go"
Test-Control -Id "G0" -Expectation "an authorized path is still authorized: $Sample" `
    -Held ((Test-GdsPathAuthorized @Context -Path @($Sample)).Authorized) `
    -Detail "control that proves the grammar family is not refusing everything"

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "=== LIFECYCLE ==="

$Forbidden = @(
    @{ From = "AUDIT_PASSED"; To = "RELEASED" },
    @{ From = "DEFINED"; To = "RELEASED" },
    @{ From = "RELEASED"; To = "ACTIVE" },
    @{ From = "AUDIT_FAILED"; To = "AUDIT_PASSED" },
    @{ From = "ACTIVE"; To = "ACTIVE" },
    @{ From = "SHIPPED"; To = "RELEASED" }
)
$Index = 0
foreach ($Transition in $Forbidden) {
    $Index++
    Test-Refusal -Id "L$Index" -Expectation "$($Transition.From) -> $($Transition.To)" -Attempt {
        (Test-GdsLifecycleTransition -From $Transition.From -To $Transition.To -CorePath $CorePath).Allowed
    }
}
Test-Control -Id "L0" -Expectation "AUDIT_PASSED -> RELEASE_AUTHORIZED is permitted" `
    -Held ((Test-GdsLifecycleTransition -From "AUDIT_PASSED" -To "RELEASE_AUTHORIZED" -CorePath $CorePath).Allowed) `
    -Detail "control that proves the lifecycle family is not refusing everything"

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "=== STRUCTURE: DURABLE NO-POWERSHELL-TRUST-CORE GUARD ==="
#
# This is the guard that keeps the architecture decision from decaying. A future
# edit that reintroduces canonical serialization, digesting, path grammar or
# signature handling into PowerShell fails here, whatever it is called.

$ModulePath = Join-Path $PSScriptRoot "SourceRoot.Governance.psm1"
$ModuleText = [IO.File]::ReadAllText($ModulePath)
# Comments are stripped first - BLOCK comments too - so the module may DESCRIBE
# what it must not do without tripping the guard that checks it does not do it.
$ModuleCode = [regex]::Replace($ModuleText, '(?s)<#.*?#>', '')
$ModuleCode = ($ModuleCode -split "`n" | Where-Object { $_.TrimStart() -notmatch '^\s*#' }) -join "`n"

$Forbidden = @{
    "Get-FileHash"        = "digesting"
    "SHA256Managed"       = "digesting"
    "System.Security.Cryptography" = "cryptography"
    "ssh-keygen"          = "signature verification"
    "StringComparer"      = "ordinal comparison for canonical ordering"
    "ConvertTo-Json"      = "serialization of governance objects"
    "[Text.UTF8Encoding]" = "canonical encoding"
    "git diff-tree"       = "candidate identity"
    "git write-tree"      = "candidate identity"
    "GIT_INDEX_FILE"      = "candidate index construction"
    "hash-object"         = "object identity"
}
$Index = 0
foreach ($Needle in ($Forbidden.Keys | Sort-Object)) {
    $Index++
    $Present = $ModuleCode.Contains($Needle)
    Test-Control -Id "N$Index" -Expectation "module implements no $($Forbidden[$Needle]): '$Needle'" `
        -Held (-not $Present) -Detail $(if ($Present) { "FOUND in executable code" } else { "" })
}

# ConvertFrom-Json is permitted for EXACTLY one purpose: reading a verdict the
# core just produced. More than one use means something else is being parsed.
$JsonUses = ([regex]::Matches($ModuleCode, "ConvertFrom-Json")).Count
Test-Control -Id "N90" -Expectation "module parses JSON in exactly one place (verdicts only)" `
    -Held ($JsonUses -eq 1) -Detail "$JsonUses use(s) in executable code"

# And the core must actually be the thing answering.
$Version = Get-SrgdsCoreVersion -CorePath $CorePath
Test-Control -Id "N91" -Expectation "the trust core is present and answers" `
    -Held ($Version -like "srgds-core/*") -Detail $Version

Test-Refusal -Id "N92" -Expectation "a missing trust core fails closed rather than falling back" -Attempt {
    $null = Get-SrgdsCorePath -Path (Join-Path $env:TEMP "srgds-core-that-does-not-exist.exe")
    $true
}

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output ("CONTROLS HELD {0} / FAILED {1}" -f $script:Passed, $script:Failed)
if ($script:Failed -gt 0) {
    Write-Output ""
    Write-Output "A failed control means the system ACCEPTED something it must refuse."
    exit 3
}
Write-Output ""
Write-Output "Every control held. This is evidence that the refusals are real; it is not"
Write-Output "approval of any candidate, and it never has been."
exit 0
