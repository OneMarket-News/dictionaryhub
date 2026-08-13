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
    [ValidateSet("install", "verify", "authority", "controls", "tests", "all")]
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
$CurrentComplete = (@(@($Current.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)
$ReleasedComplete = (@(@($Released.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)

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

    $Release = Test-GdsReleaseState -RepositoryRoot $RepositoryRoot @Released @CoreArgs @StoreArgs
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

    $Release = Test-GdsReleaseState -RepositoryRoot $RepositoryRoot @Released @CoreArgs @StoreArgs
    Assert-True ($Release.CurrentAuthorityAtHead -ceq "REJECTED") `
        "The core proves, while establishing the release, that the historical authorization is REJECTED at HEAD"

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
        Assert-True ($Forced.Mode -eq "terminal") `
            "With no answerable current authority, the selector resolves to terminal rather than ungoverned"
        Assert-True ($null -ne $Forced.Release -and $Forced.Release.CurrentAuthorityAtHead -ceq "REJECTED") `
            "Terminal mode still reports that HEAD holds no current authority"

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
    "controls"  { Invoke-Controls }
    "tests"     { Invoke-Tests }
    "all" {
        Invoke-Install
        Invoke-Tests
        Invoke-Verify
        Invoke-Authority
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
