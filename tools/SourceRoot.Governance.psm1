<#
.SYNOPSIS
SourceRoot Governed Development System v1.1 orchestration.

.DESCRIPTION
This module ORCHESTRATES. It does not decide.

Every security-critical decision - canonical serialization, strict JSON
semantics, repository path grammar, candidate tree identity, candidate digest,
and signed authorization validity - belongs to the Go trust core, srgds-core.
This module locates that binary, hands it explicit execution context, reads its
machine-readable verdict, and fails closed.

WHY THE IMPLEMENTATION MOVED OUT OF POWERSHELL

Four independent Tier-3 audits of the previous PowerShell trust core found the
same class of defect underneath the same class of language behaviour:

  - a pipeline yielding one element collapses to a scalar, so .Count throws or,
    worse, silently describes a string instead of a collection
  - -eq is case-insensitive by default, so two distinct identities compare equal
  - ConvertFrom-Json merges duplicate property names before any check can see
    them, so a document with two conflicting values reads as one
  - UTF8Encoding without throwOnInvalidBytes substitutes U+FFFD, so distinct
    malformed inputs share one digest
  - native output is decoded through a console code page, and Out-String
    hard-wraps at the console width, corrupting NUL-delimited records
  - `>` writes UTF-16, doubling the byte count of any redirected blob

None of these is a bug in PowerShell. They are properties of a language built
for interactive administration, and they are the wrong properties for the
component that decides whether a change is authorized.

WHAT THIS MODULE MAY AND MAY NOT DO

  MAY   locate srgds-core, invoke it, supply explicit context, parse its
        verdict, and fail closed on REJECT or ERROR
  MAY   read the exit-code contract: 0 ACCEPT, 3 REJECT, 2 ERROR

  MAY NOT re-derive canonical serialization, strict JSON semantics, path
        grammar, candidate digest, candidate tree identity, or signed
        authorization validity

ConvertFrom-Json appears below and is confined to ONE use: reading a verdict
this core just produced. A verdict is a report, not an authority object. No
authority object is ever parsed here - authority objects are read only by
srgds-core, which rejects the duplicate names ConvertFrom-Json would merge.

AUTHORITY LIVES OUTSIDE THE CANDIDATE. Authoritative objects live in an
ACL-protected external control store and are signed by the Product Authority.
Repository files - including this module - are TOOLING, not authority. A
repository file may be edited by the very stage it governs, so a repository file
can never be the trust root.
#>

Set-StrictMode -Version Latest

# The binary is a BUILD ARTIFACT and is never committed. It is located outside
# the repository so that a candidate cannot supply the executable that judges it.
$script:SrgdsDefaultCorePath = "C:\ProgramData\SourceRoot\GDS\bin\srgds-core.exe"

$script:SrgdsExitAccept = 0
$script:SrgdsExitError = 2
$script:SrgdsExitReject = 3

function Get-SrgdsCorePath {
    <#
    .SYNOPSIS
    Resolves the trust core executable, or throws.
    #>
    [CmdletBinding()]
    param([Parameter()][string]$Path)

    $Candidate = $Path
    if ([string]::IsNullOrWhiteSpace($Candidate)) { $Candidate = $env:SRGDS_CORE_PATH }
    if ([string]::IsNullOrWhiteSpace($Candidate)) { $Candidate = $script:SrgdsDefaultCorePath }

    if (-not (Test-Path -LiteralPath $Candidate -PathType Leaf)) {
        throw "srgds-core was not found at '$Candidate'. Build it with " +
              "'go build -o `"$script:SrgdsDefaultCorePath`" .' from tools/srgds-core, " +
              "or set SRGDS_CORE_PATH. Governance cannot proceed without the trust core: " +
              "there is no PowerShell fallback, by design."
    }
    return (Resolve-Path -LiteralPath $Candidate).Path
}

function Invoke-SrgdsCore {
    <#
    .SYNOPSIS
    Runs one trust-core command and returns its verdict.

    .DESCRIPTION
    Fails closed. An exit code outside the published contract, output that is
    not a readable verdict, or a missing verdict field is an error - never a
    quietly successful result.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter()][string]$CorePath
    )

    $Exe = Get-SrgdsCorePath -Path $CorePath
    $PreviousEncoding = [Console]::OutputEncoding
    $Previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
        # Canonical JSON contains no raw newline, so joining the elements
        # PowerShell split on real newlines is lossless. Out-String is NOT used:
        # it hard-wraps at the console width and would corrupt the document.
        $Text = ((& $Exe @Arguments 2>$null) -join "")
        $Code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $Previous
        [Console]::OutputEncoding = $PreviousEncoding
    }
    if ($null -eq $Code) {
        throw "srgds-core did not run; refusing to treat a failure to start as a result."
    }
    if ($Code -ne $script:SrgdsExitAccept -and $Code -ne $script:SrgdsExitReject -and $Code -ne $script:SrgdsExitError) {
        throw "srgds-core exited with $Code, which is outside the published contract (0 ACCEPT, 3 REJECT, 2 ERROR)."
    }
    if ([string]::IsNullOrWhiteSpace($Text)) {
        throw "srgds-core exited $Code without a verdict; refusing to infer one."
    }

    try { $Verdict = $Text | ConvertFrom-Json }
    catch { throw "srgds-core produced output that is not a readable verdict: $($_.Exception.Message)" }

    foreach ($Field in @("verdict", "reason", "command", "core")) {
        if (-not ($Verdict.PSObject.Properties.Name -contains $Field)) {
            throw "srgds-core verdict is missing the '$Field' field."
        }
    }
    # The verdict and the exit code must agree. If they disagree, the binary is
    # not the one this contract describes.
    # ELIGIBLE shares ACCEPT's exit code but is a DISTINCT verdict, and is listed
    # explicitly so it can never be produced or read by accident. Callers that
    # only understand ACCEPT keep working because .Accepted below stays false for
    # ELIGIBLE: recovery eligibility must never be mistaken for release state.
    $Expected = switch ([string]$Verdict.verdict) {
        "ACCEPT"   { $script:SrgdsExitAccept }
        "ELIGIBLE" { $script:SrgdsExitAccept }
        "REJECT"   { $script:SrgdsExitReject }
        "ERROR"    { $script:SrgdsExitError }
        default    { throw "srgds-core returned an unknown verdict '$($Verdict.verdict)'." }
    }
    if ($Code -ne $Expected) {
        throw "srgds-core returned verdict $($Verdict.verdict) with exit $Code; the two disagree."
    }

    return [pscustomobject]@{
        Accepted = ([string]$Verdict.verdict -ceq "ACCEPT")
        Verdict  = [string]$Verdict.verdict
        Reason   = [string]$Verdict.reason
        Command  = [string]$Verdict.command
        Core     = [string]$Verdict.core
        ExitCode = $Code
        Payload  = $Verdict
    }
}

function Get-SrgdsCoreVersion {
    [CmdletBinding()]
    param([Parameter()][string]$CorePath)
    return (Invoke-SrgdsCore -Arguments @("version") -CorePath $CorePath).Core
}

# ===========================================================================
# AUTHORITY
#
# Selection is stated by the CALLER as a pair that must BOTH hold: which
# issuance, and which exact signed bytes. One stage slug can have more than one
# signed issuance, so resolving a stage to "the file named after it" is not a
# decision at all. Both parameters are mandatory here because they are mandatory
# in the core; this module adds no defaults, since a defaulted trust decision is
# a decision nobody made.
# ===========================================================================

function Get-GdsStageAuthorization {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$StageSlug,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedAuthorizationId,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedAuthorizationDigest,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedSignerFingerprint,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$SignerPrincipal,
        [Parameter()][string]$RepositoryId,
        [Parameter()][string]$ControlStoreRoot,
        [Parameter()][string]$CorePath
    )

    $Arguments = @(
        "authority-verify",
        "-repo", $RepositoryRoot,
        "-stage", $StageSlug,
        "-authorization-id", $ExpectedAuthorizationId,
        "-expected-digest", $ExpectedAuthorizationDigest,
        "-signer-fingerprint", $ExpectedSignerFingerprint,
        "-signer-principal", $SignerPrincipal
    )
    if (-not [string]::IsNullOrWhiteSpace($RepositoryId)) { $Arguments += @("-repository-id", $RepositoryId) }
    if (-not [string]::IsNullOrWhiteSpace($ControlStoreRoot)) { $Arguments += @("-control-store", $ControlStoreRoot) }

    $Result = Invoke-SrgdsCore -Arguments $Arguments -CorePath $CorePath
    $Payload = $Result.Payload
    $Get = {
        param($Name, $Default)
        if ($Payload.PSObject.Properties.Name -contains $Name) { return $Payload.$Name }
        return $Default
    }

    return [pscustomobject]@{
        Valid              = $Result.Accepted
        Reason             = $Result.Reason
        AuthorizationId    = [string](& $Get "authorizationId" "")
        Digest             = [string](& $Get "digest" "")
        Selection          = [string](& $Get "selection" "")
        Path               = [string](& $Get "path" "")
        RepositoryId       = [string](& $Get "repositoryId" "")
        StageSlug          = [string](& $Get "stageSlug" $StageSlug)
        RiskTier           = [int](& $Get "riskTier" 0)
        BaselineCommit     = [string](& $Get "baselineCommit" "")
        LifecycleState     = [string](& $Get "lifecycleState" "")
        AllowedPaths       = @(& $Get "allowedPaths" @())
        ProtectedPaths     = @(& $Get "protectedPaths" @())
        SignerFingerprint  = [string](& $Get "signerFingerprint" "")
        SignerPrincipal    = [string](& $Get "signerPrincipal" "")
        SignatureNamespace = [string](& $Get "signatureNamespace" "")
    }
}

function Test-GdsPathAuthorized {
    <#
    .SYNOPSIS
    Asks the core whether each path is authorized.

    .DESCRIPTION
    The decision is NOT recomputed here from AllowedPaths and ProtectedPaths.
    Re-deriving it in PowerShell would create a second implementation of the
    path grammar, and two implementations of one rule eventually disagree - at
    which point the more permissive one is the one that matters.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$StageSlug,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedAuthorizationId,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedAuthorizationDigest,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedSignerFingerprint,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$SignerPrincipal,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Path,
        [Parameter()][string]$RepositoryId,
        [Parameter()][string]$ControlStoreRoot,
        [Parameter()][string]$CorePath
    )

    if (@($Path).Count -eq 0) {
        return [pscustomobject]@{ Authorized = $true; Reason = "no paths were submitted"; Paths = @() }
    }

    $Arguments = @(
        "path-check",
        "-repo", $RepositoryRoot,
        "-stage", $StageSlug,
        "-authorization-id", $ExpectedAuthorizationId,
        "-expected-digest", $ExpectedAuthorizationDigest,
        "-signer-fingerprint", $ExpectedSignerFingerprint,
        "-signer-principal", $SignerPrincipal
    )
    foreach ($Entry in $Path) { $Arguments += @("-path", $Entry) }
    if (-not [string]::IsNullOrWhiteSpace($RepositoryId)) { $Arguments += @("-repository-id", $RepositoryId) }
    if (-not [string]::IsNullOrWhiteSpace($ControlStoreRoot)) { $Arguments += @("-control-store", $ControlStoreRoot) }

    $Result = Invoke-SrgdsCore -Arguments $Arguments -CorePath $CorePath
    $Paths = @()
    if ($Result.Payload.PSObject.Properties.Name -contains "paths") { $Paths = @($Result.Payload.paths) }
    return [pscustomobject]@{
        Authorized = $Result.Accepted
        Reason     = $Result.Reason
        Paths      = $Paths
    }
}

# ===========================================================================
# CANDIDATE
# ===========================================================================

function Get-GdsCandidateManifest {
    <#
    .SYNOPSIS
    Asks the core to derive the candidate manifest.

    .DESCRIPTION
    Deriving a candidate is READ-ONLY: the core writes new objects to a
    disposable object store with the repository's own database attached as a
    read-only alternate, so the canonical index, the object database, HEAD and
    refs are all left exactly as they were.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$StageSlug,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedAuthorizationId,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedAuthorizationDigest,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedSignerFingerprint,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$SignerPrincipal,
        [Parameter()][string]$OutFile,
        [Parameter()][string]$RepositoryId,
        [Parameter()][string]$ControlStoreRoot,
        [Parameter()][string]$CorePath
    )

    $Arguments = @(
        "candidate-manifest",
        "-repo", $RepositoryRoot,
        "-stage", $StageSlug,
        "-authorization-id", $ExpectedAuthorizationId,
        "-expected-digest", $ExpectedAuthorizationDigest,
        "-signer-fingerprint", $ExpectedSignerFingerprint,
        "-signer-principal", $SignerPrincipal
    )
    if (-not [string]::IsNullOrWhiteSpace($OutFile)) { $Arguments += @("-out", $OutFile) }
    if (-not [string]::IsNullOrWhiteSpace($RepositoryId)) { $Arguments += @("-repository-id", $RepositoryId) }
    if (-not [string]::IsNullOrWhiteSpace($ControlStoreRoot)) { $Arguments += @("-control-store", $ControlStoreRoot) }

    $Result = Invoke-SrgdsCore -Arguments $Arguments -CorePath $CorePath
    $Payload = $Result.Payload
    $Has = { param($Name) return ($Payload.PSObject.Properties.Name -contains $Name) }

    return [pscustomobject]@{
        Authorized        = $Result.Accepted
        Reason            = $Result.Reason
        CandidateDigest   = $(if (& $Has "candidateDigest") { [string]$Payload.candidateDigest } else { "" })
        BaselineTree      = $(if (& $Has "baselineTree") { [string]$Payload.baselineTree } else { "" })
        CandidateTree     = $(if (& $Has "candidateTree") { [string]$Payload.candidateTree } else { "" })
        EntryCount        = $(if (& $Has "entryCount") { [int]$Payload.entryCount } else { 0 })
        UnauthorizedPaths = @(if (& $Has "unauthorizedPaths") { $Payload.unauthorizedPaths } else { @() })
        Manifest          = $(if (& $Has "manifest") { $Payload.manifest } else { $null })
    }
}

# ===========================================================================
# TERMINAL RELEASE STATE
#
# "Authorized" and "released" are different facts, and for a long time this
# system had a name for only the first.
#
# BEFORE a release commit, the question is whether current authority permits a
# change, and that requires HEAD to equal the signed baseline. AFTER the release
# commit, HEAD is a DESCENDANT of that baseline, so current authority is
# correctly and permanently unavailable - and every governed verifier was left
# asserting something that could no longer be true, failing against the very
# release it existed to verify.
#
# Terminal state is the missing name. It is established ONLY from the complete
# historical chain, and it grants nothing: the core's own last act when
# answering is to prove the historical authorization STILL fails as current
# authority at HEAD.
# ===========================================================================

function Test-GdsReleaseState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$StageSlug,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedAuthorizationId,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedAuthorizationDigest,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedSignerFingerprint,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$SignerPrincipal,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$AuditDigest,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ReleaseDigest,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$AuditorPrincipal,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$AuditorFingerprint,
        # The signed statement naming the EXACT release commit. Mandatory: an
        # audit proved that without it, any commit sharing a parent and a tree
        # with the real release was accepted as the release.
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$CommitBindingDigest,
        [Parameter()][string]$ControlStoreRoot,
        [Parameter()][string]$CorePath
    )
    $Arguments = @(
        "release-state",
        "-repo", $RepositoryRoot,
        "-stage", $StageSlug,
        "-authorization-id", $ExpectedAuthorizationId,
        "-expected-digest", $ExpectedAuthorizationDigest,
        "-signer-fingerprint", $ExpectedSignerFingerprint,
        "-signer-principal", $SignerPrincipal,
        "-audit-digest", $AuditDigest,
        "-release-digest", $ReleaseDigest,
        "-auditor-principal", $AuditorPrincipal,
        "-auditor-fingerprint", $AuditorFingerprint,
        "-commit-binding-digest", $CommitBindingDigest
    )
    if (-not [string]::IsNullOrWhiteSpace($ControlStoreRoot)) { $Arguments += @("-control-store", $ControlStoreRoot) }

    $Result = Invoke-SrgdsCore -Arguments $Arguments -CorePath $CorePath
    $Payload = $Result.Payload
    $Get = {
        param($Name)
        if ($Payload.PSObject.Properties.Name -contains $Name) { return [string]$Payload.$Name }
        return ""
    }
    return [pscustomobject]@{
        Released                   = $Result.Accepted
        Reason                     = $Result.Reason
        Commit                     = (& $Get "commit")
        Parent                     = (& $Get "parent")
        Tree                       = (& $Get "tree")
        CandidateDigest            = (& $Get "candidateDigest")
        CandidateTree              = (& $Get "candidateTree")
        EntryCount                 = (& $Get "entryCount")
        AuditVerdict               = (& $Get "auditVerdict")
        AuditorIdentity            = (& $Get "auditorIdentity")
        ReleasedBinarySha256       = (& $Get "releasedBinarySha256")
        RunningBinarySha256        = (& $Get "runningBinarySha256")
        ReleaseCommitBindingDigest = (& $Get "releaseCommitBindingDigest")
        BoundReleaseCommit         = (& $Get "boundReleaseCommit")
        CurrentAuthorityAtHead     = (& $Get "currentAuthorityAtHead")
    }
}

function Test-GdsRecoveryEligibility {
    <#
    .SYNOPSIS
    Asks whether a TERMINAL-UNCLOSED predecessor may be recovered from, once.

    .DESCRIPTION
    This is NOT release state and must never be presented as it. The predecessor
    remains non-conforming; eligibility only records that Product Authority
    permitted exactly one bounded recovery stage, bound to that stage's own
    signed authorization. It grants no repository path and no mutation authority.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$RecoveryStageSlug,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedAuthorizationId,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedAuthorizationDigest,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedSignerFingerprint,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$SignerPrincipal,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$SupersededCommit,
        [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$EligibilityDigest,
        [Parameter()][string]$ControlStoreRoot,
        [Parameter()][string]$CorePath
    )
    $Arguments = @(
        "recovery-eligibility",
        "-repo", $RepositoryRoot,
        "-stage", $RecoveryStageSlug,
        "-authorization-id", $ExpectedAuthorizationId,
        "-expected-digest", $ExpectedAuthorizationDigest,
        "-signer-fingerprint", $ExpectedSignerFingerprint,
        "-signer-principal", $SignerPrincipal,
        "-superseded-commit", $SupersededCommit,
        "-eligibility-digest", $EligibilityDigest
    )
    if (-not [string]::IsNullOrWhiteSpace($ControlStoreRoot)) { $Arguments += @("-control-store", $ControlStoreRoot) }

    $Result = Invoke-SrgdsCore -Arguments $Arguments -CorePath $CorePath
    $Payload = $Result.Payload
    $Get = {
        param($Name)
        if ($Payload.PSObject.Properties.Name -contains $Name) { return [string]$Payload.$Name }
        return ""
    }
    return [pscustomobject]@{
        # Deliberately NOT named "Released" or "Accepted": eligibility is a
        # different question and a different answer.
        Eligible                = ($Result.Verdict -ceq "ELIGIBLE")
        Verdict                 = $Result.Verdict
        Reason                  = $Result.Reason
        Classification          = (& $Get "classification")
        SupersededCommit        = (& $Get "supersededCommit")
        SupersededStageSlug     = (& $Get "supersededStageSlug")
        RecoveryStageSlug       = (& $Get "recoveryStageSlug")
        EligibilityDigest       = (& $Get "eligibilityDigest")
        RecoveryBaseline        = (& $Get "recoveryBaseline")
        PredecessorConforming   = (& $Get "predecessorConforming")
        GrantsMutationAuthority = (& $Get "grantsMutationAuthority")
    }
}

# Get-GdsGovernanceState is the ONE place that decides which of the three
# governance modes a repository is in, so the verifiers cannot disagree with
# each other about it.
#
#   in-flight   current authority is valid: HEAD is the signed baseline and a
#               stage is being built
#   terminal    HEAD is the governed release of an audited candidate
#   ungoverned  neither; nothing may be asserted on the strength of authority
#
# Recovery eligibility is deliberately NOT a fourth mode. A mode answers "what
# may be done now"; eligibility answers "may this past commit be recovered
# from", which is a question about a different commit and grants nothing. They
# are kept in separate functions so no caller can read one as the other.
function Get-GdsGovernanceState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][hashtable]$Context,
        [Parameter()][hashtable]$ReleaseContext,
        [Parameter()][string]$CorePath
    )
    # Both contexts describe the same repository and are answered by the same
    # core, so those two values are supplied here rather than being repeated by
    # every caller. A parameter that is accepted and ignored is worse than one
    # that does not exist: it reads as though it were doing something.
    $Fill = {
        param([hashtable]$Source)
        $Copy = @{}
        foreach ($Key in $Source.Keys) { $Copy[$Key] = $Source[$Key] }
        $Copy.RepositoryRoot = $RepositoryRoot
        if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $Copy.CorePath = $CorePath }
        return $Copy
    }
    $Context = & $Fill $Context
    if ($null -ne $ReleaseContext -and $ReleaseContext.Count -gt 0) { $ReleaseContext = & $Fill $ReleaseContext }

    $Authority = Get-GdsStageAuthorization @Context
    if ($Authority.Valid) {
        return [pscustomobject]@{
            Mode = "in-flight"; Authority = $Authority; Release = $null
            Detail = $Authority.Reason
        }
    }
    if ($null -ne $ReleaseContext -and $ReleaseContext.Count -gt 0) {
        $Release = Test-GdsReleaseState @ReleaseContext
        if ($Release.Released) {
            return [pscustomobject]@{
                Mode = "terminal"; Authority = $Authority; Release = $Release
                Detail = $Release.Reason
            }
        }
        return [pscustomobject]@{
            Mode = "ungoverned"; Authority = $Authority; Release = $Release
            Detail = "current authority: $($Authority.Reason); release state: $($Release.Reason)"
        }
    }
    return [pscustomobject]@{
        Mode = "ungoverned"; Authority = $Authority; Release = $null
        Detail = $Authority.Reason
    }
}

# ===========================================================================
# LIFECYCLE
# ===========================================================================

function Test-GdsLifecycleTransition {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$From,
        [Parameter(Mandatory = $true)][string]$To,
        [Parameter()][string]$CorePath
    )
    $Result = Invoke-SrgdsCore -Arguments @("lifecycle-check", "-from", $From, "-to", $To) -CorePath $CorePath
    return [pscustomobject]@{ Allowed = $Result.Accepted; Reason = $Result.Reason }
}

# ===========================================================================
# CANONICAL FORM
# ===========================================================================

function Test-GdsFileCanonical {
    <#
    .SYNOPSIS
    Asks the core whether a file is strict, canonical JSON, and for its digest.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter()][string]$CorePath
    )
    $Result = Invoke-SrgdsCore -Arguments @("canonical-digest", "-file", $Path) -CorePath $CorePath
    $Digest = ""
    if ($Result.Payload.PSObject.Properties.Name -contains "digest") { $Digest = [string]$Result.Payload.digest }
    return [pscustomobject]@{ Canonical = $Result.Accepted; Reason = $Result.Reason; Digest = $Digest }
}

Export-ModuleMember -Function `
    Get-SrgdsCorePath, Invoke-SrgdsCore, Get-SrgdsCoreVersion, `
    Get-GdsStageAuthorization, Test-GdsPathAuthorized, `
    Get-GdsCandidateManifest, `
    Test-GdsLifecycleTransition, Test-GdsReleaseState, Test-GdsRecoveryEligibility, Get-GdsGovernanceState, `
    Test-GdsFileCanonical
