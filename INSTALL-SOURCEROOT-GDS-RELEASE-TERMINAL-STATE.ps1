<#
.SYNOPSIS
Installer and proof harness for SourceRoot GDS Release Terminal State v1.

.DESCRIPTION
Builds and installs the governed trust core, then proves the one thing this
stage exists to establish: after a release commit the repository is in a
TERMINAL RELEASE STATE, which is a historical fact reconstructed from the signed
chain, and which grants nothing.

The distinction is the whole point. Current authority requires HEAD to equal the
signed baseline, so the moment a release is committed it becomes permanently
unavailable — correctly. Five separate defects in this system have been the same
mistake wearing different clothes: a fact that was true of one commit written
down as an invariant, then failing the next legitimate commit. The cure is not
to relax the baseline check. It is a SECOND reader, over the same signed bytes,
that answers "what was released" and cannot answer "what may change".

Actions:

  install       build the trust core deterministically and install it
  verify        prove terminal release state from the historical chain alone
  authority     prove terminal state confers no mutation authority
  classify      classify HEAD into exactly one of three terminal states
  controls      run the reusable negative-control harness
  tests         run the Go suite, including the terminal-state adversarial tests
  all           every action above

Execution context is read from SRGDS_* variables set OUTSIDE the repository. The
released predecessor is supplied separately from current authority because they
describe different commits; conflating them is the defect being removed.

.EXAMPLE
  ./INSTALL-SOURCEROOT-GDS-RELEASE-TERMINAL-STATE.ps1 -Action all
#>
[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet("install", "verify", "authority", "classify", "controls", "tests", "all")]
    [string]$Action = "all",

    [Parameter()][string]$GoExecutable,
    [Parameter()][string]$CorePath,
    [Parameter()][string]$ControlStoreRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepositoryRoot = $PSScriptRoot
$CoreSource = Join-Path $RepositoryRoot "tools\srgds-core"
$InstalledCore = if ([string]::IsNullOrWhiteSpace($CorePath)) {
    "C:\ProgramData\SourceRoot\GDS\bin\srgds-core.exe"
} else { $CorePath }

$Pass = 0
$Fail = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) { $script:Pass++; Write-Host "[PASS] $Message" -ForegroundColor Green }
    else { $script:Fail++; Write-Host "[FAIL] $Message" -ForegroundColor Red }
}

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# THE DETERMINISTIC BUILD RECIPE
#
# Identical to the recipe the released stage established and an audit confirmed:
# -trimpath removes baked-in absolute paths, -buildvcs=false removes Git
# revision stamping, and the builder OWNS every variable that can select a
# compiler, alter code generation, or inject flags. Inheriting the parent
# environment and overwriting a few variables was measured to be insufficient.
# ---------------------------------------------------------------------------
$script:DeterministicBuildFlags = @("-trimpath", "-buildvcs=false")

$script:GovernedBuildEnv = [ordered]@{
    GOOS              = "windows"
    GOARCH            = "amd64"
    GOAMD64           = "v1"
    CGO_ENABLED       = "0"
    GOENV             = "off"
    GOTOOLCHAIN       = "local"
    GOWORK            = "off"
    GOFLAGS           = ""
    GOEXPERIMENT      = ""
    GODEBUG           = ""
    CC                = ""
    CXX               = ""
    SOURCE_DATE_EPOCH = ""
}

$script:GovernedGoExecutable = "C:\Program Files\Go\bin\go.exe"
$script:GovernedGoVersion = "go version go1.26.5 windows/amd64"
$script:GovernedGoRoot = "C:\Program Files\Go"

function Resolve-GovernedGo {
    $Path = if (-not [string]::IsNullOrWhiteSpace($GoExecutable)) { $GoExecutable } else { $script:GovernedGoExecutable }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "The governed Go toolchain was not found at '$Path'. A governed build does not fall back to PATH."
    }
    return $Path
}

function Invoke-DeterministicBuild {
    param(
        [Parameter(Mandatory = $true)][string]$SourceDir,
        [Parameter(Mandatory = $true)][string]$OutputPath,
        [Parameter(Mandatory = $true)][string]$Go
    )
    $Saved = @{}
    Push-Location $SourceDir
    try {
        foreach ($Key in $script:GovernedBuildEnv.Keys) {
            $Saved[$Key] = [Environment]::GetEnvironmentVariable($Key, "Process")
            [Environment]::SetEnvironmentVariable($Key, $script:GovernedBuildEnv[$Key], "Process")
        }
        # Checked INSIDE the governed environment, so GOTOOLCHAIN cannot have
        # redirected the toolchain being measured.
        $Version = ((& $Go version) -join " ").Trim()
        if ($Version -ne $script:GovernedGoVersion) {
            throw "Governed build requires '$script:GovernedGoVersion' but '$Go' reports '$Version'."
        }
        $Root = ((& $Go env GOROOT) -join "").Trim()
        if ($Root -ne $script:GovernedGoRoot) {
            throw "Governed build requires GOROOT '$script:GovernedGoRoot' but the toolchain reports '$Root'."
        }
        & $Go build @script:DeterministicBuildFlags -o $OutputPath .
        return ($LASTEXITCODE -eq 0)
    } finally {
        foreach ($Key in $Saved.Keys) { [Environment]::SetEnvironmentVariable($Key, $Saved[$Key], "Process") }
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# EXECUTION CONTEXT
#
# Never defaulted. A defaulted trust decision is a decision nobody made, and an
# absent context produces an explicit SKIP rather than a quiet PASS.
# ---------------------------------------------------------------------------
$Current = @{
    StageSlug                   = $env:SRGDS_STAGE
    ExpectedAuthorizationId     = $env:SRGDS_AUTHORIZATION_ID
    ExpectedAuthorizationDigest = $env:SRGDS_AUTHORIZATION_DIGEST
    ExpectedSignerFingerprint   = $env:SRGDS_SIGNER_FINGERPRINT
    SignerPrincipal             = $env:SRGDS_SIGNER_PRINCIPAL
}
$Released = @{
    StageSlug                   = $env:SRGDS_RELEASED_STAGE
    ExpectedAuthorizationId     = $env:SRGDS_RELEASED_AUTHORIZATION_ID
    ExpectedAuthorizationDigest = $env:SRGDS_RELEASED_AUTHORIZATION_DIGEST
    ExpectedSignerFingerprint   = $env:SRGDS_SIGNER_FINGERPRINT
    SignerPrincipal             = $env:SRGDS_SIGNER_PRINCIPAL
    AuditDigest                 = $env:SRGDS_AUDIT_DIGEST
    ReleaseDigest               = $env:SRGDS_RELEASE_DIGEST
    AuditorPrincipal            = $env:SRGDS_AUDITOR_PRINCIPAL
    AuditorFingerprint          = $env:SRGDS_AUDITOR_FINGERPRINT
    CommitBindingDigest         = $env:SRGDS_COMMIT_BINDING_DIGEST
}

# The recovery context is a THIRD, separate context. It describes neither the
# commit being classified nor the authority to change it: it names the signed
# Product Authority statement that one bounded recovery of that commit is
# permitted, and the recovery stage's own authorization that statement is bound
# to. It is kept apart from $Current and $Released for the same reason those two
# are kept apart from each other - three different questions about three
# different objects, and every past defect in this system began by merging two
# of them.
$Recovery = @{
    RecoveryStageSlug           = $Current.StageSlug
    ExpectedAuthorizationId     = $Current.ExpectedAuthorizationId
    ExpectedAuthorizationDigest = $Current.ExpectedAuthorizationDigest
    ExpectedSignerFingerprint   = $Current.ExpectedSignerFingerprint
    SignerPrincipal             = $Current.SignerPrincipal
    SupersededCommit            = $env:SRGDS_SUPERSEDED_COMMIT
    EligibilityDigest           = $env:SRGDS_ELIGIBILITY_DIGEST
}

$CurrentComplete = (@(@($Current.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)
$ReleasedComplete = (@(@($Released.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)
$RecoveryComplete = (@(@($Recovery.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)

Import-Module (Join-Path $RepositoryRoot "tools\SourceRoot.Governance.psm1") -Force

$CoreArgs = @{}
if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $CoreArgs.CorePath = $CorePath }
$StoreArgs = @{}
if (-not [string]::IsNullOrWhiteSpace($ControlStoreRoot)) { $StoreArgs.ControlStoreRoot = $ControlStoreRoot }

Write-Host "SourceRoot GDS Release Terminal State v1" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"
Write-Host "Action    : $Action"

# ---------------------------------------------------------------------------
function Invoke-Install {
    Write-Section "INSTALL"
    $Go = Resolve-GovernedGo
    Assert-True (Test-Path -LiteralPath $Go -PathType Leaf) "Governed Go toolchain is present at $Go"

    $Parent = Split-Path -Parent $InstalledCore
    if (-not (Test-Path -LiteralPath $Parent -PathType Container)) {
        New-Item -ItemType Directory -Path $Parent -Force | Out-Null
    }
    $Built = Invoke-DeterministicBuild -SourceDir $CoreSource -OutputPath $InstalledCore -Go $Go
    Assert-True $Built "Trust core builds deterministically and installs to $InstalledCore"

    # A go.sum would mean a dependency, and a dependency would mean the trust
    # core's behaviour is partly decided somewhere nobody signed for.
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $CoreSource "go.sum"))) `
        "The trust core has no go.sum, because it has no dependency to pin"

    $Version = Get-SrgdsCoreVersion @CoreArgs
    Assert-True ($Version -like "srgds-core/*") "Installed trust core answers ($Version)"

    # The binary is a build artifact of signed source, not a candidate byte.
    $Tracked = @(& git -C $RepositoryRoot ls-files -- "tools/srgds-core/*.exe" "bin/*.exe" | Where-Object { $_ })
    Assert-True ($Tracked.Count -eq 0) "No trust-core binary is tracked in the repository"
}

# ---------------------------------------------------------------------------
function Invoke-Verify {
    Write-Section "TERMINAL RELEASE STATE"
    if (-not $ReleasedComplete) {
        Write-Host "[SKIP] The released-stage context is incomplete, so terminal release state" -ForegroundColor Yellow
        Write-Host "       was NOT established. This is a SKIP, not a PASS. Missing:"
        foreach ($Key in @($Released.Keys | Sort-Object)) {
            if ([string]::IsNullOrWhiteSpace($Released[$Key])) { Write-Host "         $Key" -ForegroundColor Yellow }
        }

        # The one thing that CAN still be proven without a signature: that the
        # commit binding is genuinely wired into the decision. A bogus digest
        # must produce a refusal that names the binding - not a throw, and
        # certainly not an acceptance.
        $WiringReady = @(@($Released.Keys | Where-Object {
            $_ -ne "CommitBindingDigest" -and [string]::IsNullOrWhiteSpace($Released[$_])
        }).Count -eq 0)
        if ($WiringReady) {
            $Probe = @{}
            foreach ($Key in $Released.Keys) { $Probe[$Key] = $Released[$Key] }
            $Probe.CommitBindingDigest = ("0" * 64)
            $Refused = Test-GdsReleaseState -RepositoryRoot $RepositoryRoot @Probe @CoreArgs @StoreArgs
            Assert-True (-not $Refused.Released) `
                "A release commit binding digest that was never signed is REFUSED at the released commit"
            Assert-True ($Refused.Reason -like "*commit binding*") `
                "The refusal names the release commit binding, so the gate is wired into the decision"
        }
        return
    }

    # CLASSIFY BEFORE ASSERTING.
    #
    # This action used to assert, unconditionally, that terminal release state
    # holds. That was true of the commit it was written against and is not true
    # of every commit it will ever run against - the same "a fact about one
    # commit written down as an invariant" defect this stage exists to remove,
    # committed by the verification code itself. Under the corrected auditor
    # model the predecessor's chain is refused, and an installer that reports
    # that as a FAILURE is claiming the repository is broken when what actually
    # happened is that a real defect was correctly detected.
    #
    # So the classification decides which facts are the honest ones to assert,
    # and every state still asserts something. Nothing is skipped, and no state
    # passes by having no checks.
    $Class = Get-HeadClassification
    Write-Host "       classification: $($Class.Classification)"
    $Release = $Class.Release

    if ($Class.Classification -ceq $script:ClassLegacy) {
        Assert-True (-not $Release.Released) `
            "HEAD is NOT released truth, and terminal release state is not claimed for it"
        Assert-True ($Release.Reason -like "*audit binding*") `
            "The refusal is the audit binding itself, not an incidental error ($($Release.Reason))"
        Assert-True ($Class.Eligibility.Eligible) `
            "A signed Product Authority eligibility permits exactly one bounded recovery of this commit"
        Assert-True ($Class.Eligibility.Classification -ceq "TERMINAL-UNCLOSED") `
            "The predecessor is classified TERMINAL-UNCLOSED: it reached terminal state but never closed"
        Assert-True ($Class.Eligibility.PredecessorConforming -ceq "NO") `
            "Eligibility does not make the predecessor conforming"
        return
    }
    if ($Class.Classification -ceq $script:ClassInvalid) {
        Assert-True $false `
            "HEAD is INVALID-UNTRUSTED: neither a conforming release chain nor a signed recovery eligibility ($($Class.Reason))"
        return
    }

    Assert-True $Release.Released "Terminal release state is established from the historical chain ($($Release.Reason))"
    if (-not $Release.Released) { return }

    Assert-True ($Release.Tree -ceq $Release.CandidateTree) `
        "The released tree IS the audited candidate tree ($($Release.CandidateTree))"
    Assert-True ($Release.AuditVerdict -ceq "PASS") `
        "The released candidate carries a PASS audit from $($Release.AuditorIdentity)"
    Assert-True (-not [string]::IsNullOrWhiteSpace($Release.CandidateDigest)) `
        "The candidate digest recomputes from two committed trees ($($Release.CandidateDigest))"

    # The released and running binaries are REPORTED and never compared. The
    # released binary is what produced the audited verdict; the running binary
    # is whatever is asking now. Requiring a match would make released history
    # unreadable by every later build - which is how the granting chain was
    # first misapplied to a reading question. There is deliberately no assertion
    # here: an assertion whose condition is true either way is not a check.
    Assert-True ($Release.BoundReleaseCommit -ceq $Release.Commit) `
        "A signed release commit binding names this EXACT commit ($($Release.BoundReleaseCommit))"
    Write-Host "       released binary: $($Release.ReleasedBinarySha256)"
    Write-Host "       running binary : $($Release.RunningBinarySha256)"
}

# ---------------------------------------------------------------------------
function Invoke-Authority {
    Write-Section "TERMINAL STATE GRANTS NOTHING"
    if (-not $ReleasedComplete) {
        Write-Host "[SKIP] No released-stage context supplied. This is a SKIP, not a PASS." -ForegroundColor Yellow
        return
    }

    # The classification decides which authority facts are true here. What does
    # NOT vary with it is the thing this action exists to prove: nothing in the
    # historical chain, conforming or not, confers authority over HEAD.
    $Class = Get-HeadClassification
    $Release = $Class.Release
    if ($Class.Classification -ceq $script:ClassConforming) {
        Assert-True ($Release.CurrentAuthorityAtHead -ceq "REJECTED") `
            "The core proves, while establishing the release, that the historical authorization is REJECTED at HEAD"
    } else {
        # No release was established, so the core never reached the question.
        # Saying so is the honest report; asserting REJECTED on a field the core
        # never populated would be reading absence as a proof.
        Assert-True ([string]::IsNullOrWhiteSpace($Release.CurrentAuthorityAtHead)) `
            "No release was established, so the core asserts nothing about current authority at HEAD"
    }

    # Asked independently rather than taken on the core's word.
    $AsCurrent = Get-GdsStageAuthorization -RepositoryRoot $RepositoryRoot `
        -StageSlug $Released.StageSlug `
        -ExpectedAuthorizationId $Released.ExpectedAuthorizationId `
        -ExpectedAuthorizationDigest $Released.ExpectedAuthorizationDigest `
        -ExpectedSignerFingerprint $Released.ExpectedSignerFingerprint `
        -SignerPrincipal $Released.SignerPrincipal @CoreArgs @StoreArgs
    Assert-True (-not $AsCurrent.Valid) `
        "The consumed authorization still fails as CURRENT authority ($($AsCurrent.Reason))"

    # There is no generic descendant allowance. The refusal must be about the
    # baseline specifically, not an incidental failure that happens to refuse.
    Assert-True ($AsCurrent.Reason -like "*not the authorized baseline*") `
        "The refusal is the baseline invariant itself, not an incidental error"

    if ($CurrentComplete) {
        $CurrentContext = @{}
        foreach ($Key in $Current.Keys) { $CurrentContext[$Key] = $Current[$Key] }
        foreach ($Key in $StoreArgs.Keys) { $CurrentContext[$Key] = $StoreArgs[$Key] }
        $ReleasedContext = @{}
        foreach ($Key in $Released.Keys) { $ReleasedContext[$Key] = $Released[$Key] }
        foreach ($Key in $StoreArgs.Keys) { $ReleasedContext[$Key] = $StoreArgs[$Key] }

        $Mode = Get-GdsGovernanceState -RepositoryRoot $RepositoryRoot `
            -Context $CurrentContext -ReleaseContext $ReleasedContext @CoreArgs
        Assert-True ($Mode.Mode -eq "in-flight" -or $Mode.Mode -eq "terminal") `
            "Governance state resolves to a governed mode: $($Mode.Mode) ($($Mode.Detail))"

        # TERMINAL MODE IS REACHABLE.
        #
        # While a stage is in flight, current authority verifies and the
        # selector never takes its terminal path. Shipping a branch that has
        # never once been entered is how untested code reaches a release, so
        # the selector is driven into terminal mode here by naming a current
        # authorization that was never issued.
        #
        # Nothing is fabricated to do it. HEAD genuinely IS the terminal release
        # state of the previous stage, and every object the terminal answer
        # rests on is really signed. Only the CURRENT-authority question is
        # made unanswerable, which is precisely what a release commit does to
        # it permanently.
        $Unissued = @{}
        foreach ($Key in $CurrentContext.Keys) { $Unissued[$Key] = $CurrentContext[$Key] }
        $Unissued.ExpectedAuthorizationId = "00000000-0000-4000-8000-000000000000"
        $Forced = Get-GdsGovernanceState -RepositoryRoot $RepositoryRoot `
            -Context $Unissued -ReleaseContext $ReleasedContext @CoreArgs
        if ($Class.Classification -ceq $script:ClassConforming) {
            Assert-True ($Forced.Mode -eq "terminal") `
                "With no answerable current authority, the selector resolves to terminal rather than ungoverned"
            Assert-True ($null -ne $Forced.Release -and $Forced.Release.CurrentAuthorityAtHead -ceq "REJECTED") `
                "Terminal mode still reports that HEAD holds no current authority"
        } else {
            # THE STRONGER CONTROL, and the one that matters for this stage.
            #
            # A non-conforming chain must NOT be able to reach terminal mode by
            # any route. Removing current authority is the most favourable
            # possible condition for the selector to reach terminal - if it
            # still refuses, terminal mode is genuinely gated on the release
            # chain and not on the mere presence of released-stage context.
            Assert-True ($Forced.Mode -eq "ungoverned") `
                "A non-conforming chain cannot reach terminal mode even with current authority removed ($($Forced.Mode))"
            Assert-True ($null -eq $Forced.Release -or -not $Forced.Release.Released) `
                "The selector reports no established release for a non-conforming chain"
        }

        # And it is a real decision, not a default: with NO released context the
        # same unanswerable authority must fall through to ungoverned.
        $Unknown = Get-GdsGovernanceState -RepositoryRoot $RepositoryRoot -Context $Unissued @CoreArgs
        Assert-True ($Unknown.Mode -eq "ungoverned") `
            "Without released-stage context the selector reports ungoverned, never terminal by default"
    } else {
        Write-Host "[SKIP] No current-authority context; governance mode was not resolved." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# THREE-STATE TERMINAL CLASSIFICATION
#
# Terminal state used to be a boolean, and a boolean could not describe the
# repository this stage found. HEAD reached terminal release state, yet its
# AuditBinding was authenticated by the Product Authority key rather than an
# independent auditor, so under the corrected auditor model it does not conform.
# A boolean forces that commit into one of two lies: call it released, and the
# non-conforming audit is laundered into a conforming one; call it invalid, and
# a real signed chain with one real defect is thrown in with unsigned garbage,
# leaving no governed way to move forward from it at all.
#
# So the answer has three states, and each is reached only by positive evidence:
#
#   CONFORMING-TERMINAL       the full corrected release chain verifies. This is
#                             the ONLY state that means "released truth".
#   LEGACY-RECOVERY-ELIGIBLE  the chain does NOT verify, AND a signed Product
#                             Authority RecoveryEligibility covers this exact
#                             commit and is bound to the recovery stage's own
#                             authorization. Non-conforming, and recoverable.
#   INVALID-UNTRUSTED         neither. Nothing may be built on it.
#
# The order is deliberate and not interchangeable. Conformance is tested FIRST,
# from the release chain alone, with eligibility not yet loaded - so eligibility
# is structurally incapable of promoting anything to CONFORMING-TERMINAL. It can
# only distinguish two flavours of "not conforming".
#
# Absence of context is NOT a fourth quiet state. An unclassifiable subject is
# reported as UNCLASSIFIED and counted as a skip, because "we did not look" and
# "we looked and found nothing trustworthy" are different findings, and only one
# of them is INVALID-UNTRUSTED.
# ---------------------------------------------------------------------------
$script:ClassConforming  = "CONFORMING-TERMINAL"
$script:ClassLegacy      = "LEGACY-RECOVERY-ELIGIBLE"
$script:ClassInvalid     = "INVALID-UNTRUSTED"
$script:ClassUnknown     = "UNCLASSIFIED"

function Get-TerminalClassification {
    <#
    .SYNOPSIS
    Classifies the commit at HEAD into exactly one of three terminal states.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][hashtable]$ReleasedContext,
        [Parameter()][hashtable]$RecoveryContext
    )

    $Verdict = {
        param($Class, $Reason, $Release, $Eligibility)
        [pscustomobject]@{
            Classification = $Class
            Reason         = $Reason
            Commit         = $(if ($null -ne $Release) { $Release.Commit } else { "" })
            Release        = $Release
            Eligibility    = $Eligibility
        }
    }

    # STATE 1. Conformance, from the release chain alone.
    $Release = Test-GdsReleaseState -RepositoryRoot $RepositoryRoot @ReleasedContext @CoreArgs @StoreArgs
    if ($Release.Released) {
        return (& $Verdict $script:ClassConforming `
            "the corrected release chain verifies at HEAD: $($Release.Reason)" $Release $null)
    }

    # Not conforming. Everything below can only choose between the two
    # non-conforming states; none of it can reach CONFORMING-TERMINAL.
    if ($null -eq $RecoveryContext -or $RecoveryContext.Count -eq 0) {
        return (& $Verdict $script:ClassInvalid `
            "the release chain does not verify ($($Release.Reason)) and no recovery eligibility was offered" $Release $null)
    }

    # The commit being classified must be identifiable. If the chain failed so
    # early that the core never named a commit, there is nothing for an
    # eligibility statement to be about, and pairing them would let eligibility
    # for one commit excuse the failure of another.
    if ([string]::IsNullOrWhiteSpace($Release.Commit)) {
        return (& $Verdict $script:ClassInvalid `
            "the release chain failed before identifying a commit ($($Release.Reason)), so no eligibility can be tied to it" $Release $null)
    }

    $Eligibility = Test-GdsRecoveryEligibility -RepositoryRoot $RepositoryRoot @RecoveryContext @CoreArgs @StoreArgs
    if (-not $Eligibility.Eligible) {
        return (& $Verdict $script:ClassInvalid `
            "the release chain does not verify ($($Release.Reason)) and recovery eligibility was REFUSED: $($Eligibility.Reason)" $Release $Eligibility)
    }

    # STATE 2 requires the eligibility to be about the commit that actually
    # failed. The trust core already binds the object to the superseded commit
    # NAMED in the request; this binds that name to the commit under
    # classification. Without both halves, an eligibility issued for some other
    # predecessor would silently cover this one.
    if ($Eligibility.SupersededCommit -cne $Release.Commit) {
        return (& $Verdict $script:ClassInvalid `
            "recovery eligibility covers $($Eligibility.SupersededCommit), which is not the commit under classification ($($Release.Commit))" $Release $Eligibility)
    }
    # Eligibility that claimed either of these would be release state or
    # mutation authority under a weaker name, and must not classify anything.
    if ($Eligibility.PredecessorConforming -cne "NO" -or $Eligibility.GrantsMutationAuthority -cne "NO") {
        return (& $Verdict $script:ClassInvalid `
            "the eligibility statement overreached: predecessorConforming=$($Eligibility.PredecessorConforming), grantsMutationAuthority=$($Eligibility.GrantsMutationAuthority)" $Release $Eligibility)
    }

    return (& $Verdict $script:ClassLegacy `
        "the release chain does not verify ($($Release.Reason)), and a signed Product Authority eligibility permits exactly one bounded recovery of this commit" $Release $Eligibility)
}

# Get-HeadClassification is the ONE place the three actions below agree about
# what HEAD is. Computed once and cached, so verify, authority and classify can
# never disagree with each other about the same commit.
$script:CachedClassification = $null
function Get-HeadClassification {
    if ($null -ne $script:CachedClassification) { return $script:CachedClassification }
    $ReleasedContext = @{}
    foreach ($Key in $Released.Keys) { $ReleasedContext[$Key] = $Released[$Key] }
    $RecoveryContext = $null
    if ($RecoveryComplete) {
        $RecoveryContext = @{}
        foreach ($Key in $Recovery.Keys) { $RecoveryContext[$Key] = $Recovery[$Key] }
    }
    $script:CachedClassification = Get-TerminalClassification `
        -ReleasedContext $ReleasedContext -RecoveryContext $RecoveryContext
    return $script:CachedClassification
}

function Invoke-Classify {
    Write-Section "TERMINAL CLASSIFICATION"
    if (-not $ReleasedComplete) {
        Write-Host "[SKIP] No released-stage context supplied, so HEAD is $script:ClassUnknown." -ForegroundColor Yellow
        Write-Host "       This is a SKIP, not INVALID-UNTRUSTED: not looking is not a finding."
        return
    }
    if (-not $RecoveryComplete) {
        Write-Host "       No recovery context supplied; only CONFORMING-TERMINAL and" -ForegroundColor Yellow
        Write-Host "       INVALID-UNTRUSTED are reachable in this run." -ForegroundColor Yellow
    }

    $ReleasedContext = @{}
    foreach ($Key in $Released.Keys) { $ReleasedContext[$Key] = $Released[$Key] }
    $RecoveryContext = $null
    if ($RecoveryComplete) {
        $RecoveryContext = @{}
        foreach ($Key in $Recovery.Keys) { $RecoveryContext[$Key] = $Recovery[$Key] }
    }

    $Class = Get-HeadClassification
    Write-Host "       commit        : $($Class.Commit)"
    Write-Host "       classification: $($Class.Classification)"
    Write-Host "       reason        : $($Class.Reason)"

    Assert-True ($Class.Classification -cin @($script:ClassConforming, $script:ClassLegacy, $script:ClassInvalid)) `
        "HEAD classifies into exactly one of the three terminal states: $($Class.Classification)"

    # THE CLASSIFICATION IS A REAL DECISION, NOT A CONSTANT.
    #
    # A classifier that returned the same answer for every input would pass the
    # assertion above forever. Each state is therefore exercised against this
    # repository's own signed objects, with nothing fabricated: the same real
    # chain is asked with one input replaced by something that was never signed.
    if ($RecoveryComplete) {
        # INVALID-UNTRUSTED is reachable: an eligibility digest nobody signed.
        $Unsigned = @{}
        foreach ($Key in $RecoveryContext.Keys) { $Unsigned[$Key] = $RecoveryContext[$Key] }
        $Unsigned.EligibilityDigest = ("0" * 64)
        $Refused = Get-TerminalClassification -ReleasedContext $ReleasedContext -RecoveryContext $Unsigned
        Assert-True ($Refused.Classification -ceq $script:ClassInvalid) `
            "With an eligibility digest that was never signed, HEAD classifies $($Refused.Classification)"

        # And eligibility cannot promote: dropping it entirely must not change a
        # conforming answer into a non-conforming one, nor the reverse.
        $Bare = Get-TerminalClassification -ReleasedContext $ReleasedContext
        Assert-True ($Bare.Classification -cne $script:ClassLegacy) `
            "Without any eligibility offered, LEGACY-RECOVERY-ELIGIBLE is unreachable ($($Bare.Classification))"
        Assert-True (($Bare.Classification -ceq $script:ClassConforming) -eq ($Class.Classification -ceq $script:ClassConforming)) `
            "Conformance is decided by the release chain alone; eligibility never changes it"
    }

    if ($Class.Classification -ceq $script:ClassLegacy) {
        Assert-True (-not $Class.Release.Released) `
            "A LEGACY-RECOVERY-ELIGIBLE commit is NOT released truth; the release chain still refuses it"
        Assert-True ($Class.Eligibility.PredecessorConforming -ceq "NO") `
            "The eligibility statement itself records the predecessor as non-conforming"
        Assert-True ($Class.Eligibility.GrantsMutationAuthority -ceq "NO") `
            "The eligibility statement grants no mutation authority"
        Assert-True ($Class.Eligibility.RecoveryBaseline -ceq $Class.Commit) `
            "The recovery stage is baselined on the exact classified commit ($($Class.Commit))"
        Write-Host "       superseded stage: $($Class.Eligibility.SupersededStageSlug)"
        Write-Host "       recovery stage  : $($Class.Eligibility.RecoveryStageSlug)"
    }
}

# ---------------------------------------------------------------------------
function Invoke-Controls {
    Write-Section "NEGATIVE CONTROLS"
    & (Join-Path $RepositoryRoot "tools\INVOKE-ROOT-NEGATIVE-CONTROL.ps1")
    # The harness reports for itself which families ran. Claiming the terminal
    # family held when it was skipped would be this installer inventing evidence
    # the harness never produced.
    Assert-True ($LASTEXITCODE -eq 0) "Every negative control the harness ran held (it reports its own skips above)"
}

# ---------------------------------------------------------------------------
function Invoke-Tests {
    Write-Section "TRUST CORE TEST SUITE"
    $Go = Resolve-GovernedGo
    Push-Location $CoreSource
    try {
        & $Go test ./...
        Assert-True ($LASTEXITCODE -eq 0) "The Go suite passes, including the terminal-state adversarial tests"
    } finally { Pop-Location }
}

# ---------------------------------------------------------------------------
switch ($Action) {
    "install"   { Invoke-Install }
    "verify"    { Invoke-Verify }
    "authority" { Invoke-Authority }
    "classify"  { Invoke-Classify }
    "controls"  { Invoke-Controls }
    "tests"     { Invoke-Tests }
    "all" {
        Invoke-Install
        Invoke-Tests
        Invoke-Verify
        Invoke-Authority
        Invoke-Classify
        Invoke-Controls
    }
}

Write-Host ""
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "Checks passed: $Pass"
Write-Host "Checks failed: $Fail"
if ($Fail -gt 0) { Write-Host "Overall result: FAIL" -ForegroundColor Red; exit 1 }
Write-Host "Overall result: PASS" -ForegroundColor Green
Write-Host ""
Write-Host "A green run is evidence, never approval. Release remains a Product" -ForegroundColor Yellow
Write-Host "Authority decision, and terminal state confers no authority to make it."
exit 0
