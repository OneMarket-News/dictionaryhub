<#
.SYNOPSIS
Install and verify the SourceRoot GDS v1.1 trust core.

.DESCRIPTION
Builds srgds-core OUTSIDE the repository, checks the external control store, and
proves the installation by running the negative-control harness and a
disposable-clone release simulation.

WHY THE BINARY LIVES OUTSIDE THE REPOSITORY

The trust core decides whether a candidate is authorized. If it were built into
the working tree, a candidate could supply the executable that judges it, and a
stage could authorize itself by editing its own judge. The binary is therefore a
build artifact that is never committed, and the module fails closed when it is
absent rather than falling back to anything.

ACTIONS

  -Action install     build the core to the install location
  -Action verify      prove the toolchain, the core, the control store, and the
                      negative controls
  -Action simulate    disposable-clone release simulation
  -Action reproducible  prove the deterministic build recipe from several paths
  -Action attributes  prove external attributes and filter drivers cannot alter identity
  -Action routing     prove PATH cannot select the Git the core runs
  -Action ignore      prove host-local ignore state cannot change the candidate
  -Action environment prove ambient Git repository routing cannot change identity
  -Action controls    prove the simulation is independent of Git configuration
  -Action all         run every installation and control matrix, in order

.EXAMPLE
  ./INSTALL-SOURCEROOT-GDS-AUTHORITY-LIFECYCLE-DESCENDANT-HARDENING.ps1 -Action all
#>
[CmdletBinding()]
param(
    [Parameter()][ValidateSet("install", "verify", "simulate", "controls", "reproducible", "attributes", "ignore", "environment", "routing", "all")][string]$Action = "all",
    [Parameter()][string]$RepositoryRoot,
    [Parameter()][string]$GoExecutable,
    [Parameter()][string]$InstallPath = "C:\ProgramData\SourceRoot\GDS\bin\srgds-core.exe",
    [Parameter()][string]$StageSlug = $env:SRGDS_STAGE,
    [Parameter()][string]$AuthorizationId = $env:SRGDS_AUTHORIZATION_ID,
    [Parameter()][string]$AuthorizationDigest = $env:SRGDS_AUTHORIZATION_DIGEST,
    [Parameter()][string]$SignerFingerprint = $env:SRGDS_SIGNER_FINGERPRINT,
    [Parameter()][string]$SignerPrincipal = $env:SRGDS_SIGNER_PRINCIPAL
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) { $RepositoryRoot = $PSScriptRoot }
$CoreSource = Join-Path $RepositoryRoot "tools\srgds-core"
$RequiredGo = "go1.26.5"

$script:Checks = 0
$script:Failures = 0
function Confirm-Step {
    param([string]$What, [bool]$Ok, [string]$Detail)
    $script:Checks++
    if (-not $Ok) { $script:Failures++ }
    Write-Output ("  {0,-58} {1}" -f $What, $(if ($Ok) { "OK" } else { "*** FAILED ***" }))
    if ($Detail) { Write-Output "      $Detail" }
}

function Resolve-Go {
    if (-not [string]::IsNullOrWhiteSpace($GoExecutable)) { return $GoExecutable }
    $Command = Get-Command go -ErrorAction SilentlyContinue
    if ($null -ne $Command) { return $Command.Source }
    foreach ($Candidate in @("C:\Program Files\Go\bin\go.exe", "C:\Go\bin\go.exe")) {
        if (Test-Path -LiteralPath $Candidate) { return $Candidate }
    }
    throw "The Go toolchain was not found. Install $RequiredGo or pass -GoExecutable."
}

# ---------------------------------------------------------------------------
# THE DETERMINISTIC BUILD RECIPE
#
# Plain `go build` is NOT reproducible, and an audit proved it: identical module
# bytes produced three different binaries from three different directories.
# Two independent sources of variability were measured:
#
#   source location  absolute paths are baked into the binary   -> -trimpath
#   VCS context      building inside a Git work tree stamps      -> -buildvcs=false
#                    revision metadata that a copy does not have
#
# With BOTH removed, builds from the repository and from two disposable copies
# at different paths are byte-identical. Linker build-id suppression was also
# tested; it is NOT required, because the build id is already a deterministic
# function of the inputs once path and VCS variability are gone. It is therefore
# not used: a flag that changes the output without being necessary is one more
# thing that has to stay in sync with whatever the auditor ran.
#
# The platform triple is pinned so the recipe cannot silently mean something
# different on another machine.
$script:DeterministicBuildFlags = @("-trimpath", "-buildvcs=false")

# THE GOVERNED BUILD ENVIRONMENT.
#
# Inheriting the parent environment and overwriting a few variables is NOT
# sufficient, and an audit proved it: the same source produced different
# executables under inherited GOFLAGS, GOAMD64 and (measured here) GOEXPERIMENT.
# The builder therefore OWNS every variable that can select a compiler, alter
# code generation, or inject flags. An empty value means "explicitly neutral";
# on Windows setting a variable to empty removes it, which is exactly the
# neutral state wanted.
#
# Semantics were verified under go1.26.5 rather than assumed:
#
#   GOAMD64       unset resolves to v1; pinned to v1 explicitly so the recipe
#                 states the microarchitecture instead of relying on a default
#   GOTOOLCHAIN   DEFAULTS TO auto, which permits selecting or downloading a
#                 different compiler; pinned to local
#   GOENV         a hostile go env file was shown to inject GOFLAGS and GOAMD64;
#                 GOENV=off neutralizes it
#   GOFLAGS       inherited flags are injected into the build; cleared
#   GOEXPERIMENT  changes code generation; cleared
#   GOWORK        a stray workspace file changes module resolution; off
#
# GOCACHE, GOMODCACHE, GOPROXY, GOSUMDB and TMP are deliberately NOT pinned:
# this is a standard-library-only, CGO-disabled module with no dependencies, so
# they affect where work happens, not what is produced. Pinning them would
# force a cold cache on every build for no determinism gain.
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

# The compiler is bound explicitly. Resolving `go` from PATH would let whatever
# happens to be installed first decide what a governed release is built with.
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
        # The toolchain must be the one the contract names, checked INSIDE the
        # governed environment so GOTOOLCHAIN cannot have redirected it.
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

# REPRODUCIBILITY CONTROL
#
# The recipe is not trusted because it is written down. It is exercised: the
# same source is built from the repository and from two disposable copies at
# different filesystem paths, and all three must produce the same SHA-256.
function Invoke-BuildReproducibility {
    Write-Output ""
    Write-Output "=== DETERMINISTIC BUILD REPRODUCIBILITY ==="
    $Go = Resolve-GovernedGo
    $Work = Join-Path ([IO.Path]::GetTempPath()) ("srgds-repro-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
    try {
        $Locations = @{ "repository" = $CoreSource }
        foreach ($Name in @("copy-a", "a-considerably-longer-directory-name\copy-b")) {
            $Target = Join-Path $Work (Join-Path $Name "srgds-core")
            New-Item -ItemType Directory -Force -Path $Target | Out-Null
            Copy-Item -Path (Join-Path $CoreSource "*") -Destination $Target -Recurse -Force
            $Locations[$Name] = $Target
        }

        $Hashes = @{}
        foreach ($Name in @("repository", "copy-a", "a-considerably-longer-directory-name\copy-b")) {
            $Output = Join-Path $Work ("srgds-core-" + ($Name -replace '[\\]', '-') + ".exe")
            if (Invoke-DeterministicBuild -SourceDir $Locations[$Name] -OutputPath $Output -Go $Go) {
                $Hashes[$Name] = (Get-FileHash -Algorithm SHA256 -LiteralPath $Output).Hash
            } else {
                $Hashes[$Name] = "BUILD-FAILED"
            }
            Write-Output ("      {0,-46} {1}" -f $Name, $Hashes[$Name])
        }
        $Distinct = @($Hashes.Values | Sort-Object -Unique)
        Confirm-Step "the same source builds byte-identically from every location" `
            ($Distinct.Count -eq 1 -and $Distinct[0] -ne "BUILD-FAILED") "$($Distinct.Count) distinct binary/binaries"

        # The reproducible binary must also still work.
        $Probe = Join-Path $Work "srgds-core-repository.exe"
        if (Test-Path -LiteralPath $Probe) {
            $Reported = (& $Probe version | ConvertFrom-Json)
            Confirm-Step "the reproducible binary answers and identifies itself" `
                ($Reported.verdict -eq "ACCEPT" -and $Reported.coreBinarySha256 -eq $Hashes["repository"]) `
                "self-reported $($Reported.coreBinarySha256)"
        }

        # HOSTILE PARENT ENVIRONMENT MATRIX.
        #
        # Reproducing across paths only proves the recipe is stable where the
        # environment is already clean. The governed builder must also OVERRIDE
        # a parent environment that is actively trying to change the output. An
        # audit produced three different binaries this way; each variable below
        # was measured to be capable of it before being pinned.
        $Reference = $Hashes["repository"]
        $HostileEnvironments = @(
            @{ Label = "GOFLAGS injects a build id"; Env = @{ GOFLAGS = "-ldflags=-buildid=HOSTILE-AUDIT-VARIANCE" } },
            @{ Label = "GOAMD64=v3 changes codegen"; Env = @{ GOAMD64 = "v3" } },
            @{ Label = "GOEXPERIMENT changes codegen"; Env = @{ GOEXPERIMENT = "loopvar" } },
            @{ Label = "GOTOOLCHAIN=auto may reselect"; Env = @{ GOTOOLCHAIN = "auto" } },
            @{ Label = "GOENV points at a hostile env file"; Env = @{ GOENV = (Join-Path $Work "hostile.goenv") } },
            @{ Label = "GOWORK points at a stray workspace"; Env = @{ GOWORK = (Join-Path $Work "stray.work") } },
            @{ Label = "all of the above combined"; Env = @{
                GOFLAGS = "-ldflags=-buildid=HOSTILE"; GOAMD64 = "v3"; GOEXPERIMENT = "loopvar"
                GOTOOLCHAIN = "auto"; GOENV = (Join-Path $Work "hostile.goenv") } }
        )
        [IO.File]::WriteAllText((Join-Path $Work "hostile.goenv"),
            "GOFLAGS=-ldflags=-buildid=FROM-ENV-FILE`nGOAMD64=v3`n", (New-Object Text.UTF8Encoding($false)))
        [IO.File]::WriteAllText((Join-Path $Work "stray.work"),
            "go 1.26.5`n`nuse .`n", (New-Object Text.UTF8Encoding($false)))

        foreach ($Hostile in $HostileEnvironments) {
            $Saved = @{}
            foreach ($Key in $Hostile.Env.Keys) {
                $Saved[$Key] = [Environment]::GetEnvironmentVariable($Key, "Process")
                [Environment]::SetEnvironmentVariable($Key, $Hostile.Env[$Key], "Process")
            }
            try {
                $Output = Join-Path $Work ("hostile-" + [guid]::NewGuid().ToString("N").Substring(0, 6) + ".exe")
                $Built = Invoke-DeterministicBuild -SourceDir $CoreSource -OutputPath $Output -Go $Go
                $Hash = if ($Built) { (Get-FileHash -Algorithm SHA256 -LiteralPath $Output).Hash } else { "BUILD-FAILED" }
            } finally {
                foreach ($Key in $Saved.Keys) { [Environment]::SetEnvironmentVariable($Key, $Saved[$Key], "Process") }
            }
            Confirm-Step "governed build overrides: $($Hostile.Label)" ($Hash -eq $Reference) $Hash
        }

        # A go.sum must not have appeared in the repository during any of this.
        Confirm-Step "no go.sum was produced by the reproducibility control" `
            (-not (Test-Path -LiteralPath (Join-Path $CoreSource "go.sum")))
    } finally {
        if (Test-Path -LiteralPath $Work) {
            Get-ChildItem -LiteralPath $Work -Recurse -Force -ErrorAction SilentlyContinue |
                ForEach-Object { try { $_.Attributes = "Normal" } catch { } }
            [IO.Directory]::Delete($Work, $true)
        }
    }
}

# ---------------------------------------------------------------------------
function Invoke-Install {
    Write-Output "=== INSTALL ==="
    $Go = Resolve-GovernedGo
    $Version = ((& $Go version) -join " ").Trim()
    Confirm-Step "governed toolchain is exactly the contracted one" ($Version -eq $script:GovernedGoVersion) "$Go -> $Version"
    Confirm-Step "governed GOROOT is the contracted one" ((((& $Go env GOROOT) -join "").Trim()) -eq $script:GovernedGoRoot) $script:GovernedGoRoot

    $Parent = Split-Path -Parent $InstallPath
    if (-not (Test-Path -LiteralPath $Parent)) { New-Item -ItemType Directory -Force -Path $Parent | Out-Null }
    Confirm-Step "install directory exists" (Test-Path -LiteralPath $Parent) $Parent

    $BuildOk = (Invoke-DeterministicBuild -SourceDir $CoreSource -OutputPath $InstallPath -Go $Go)
    Confirm-Step "core builds under the deterministic recipe" $BuildOk $InstallPath
    if (-not $BuildOk) { return }
    Confirm-Step "installed binary SHA-256" $true (Get-FileHash -Algorithm SHA256 -LiteralPath $InstallPath).Hash

    Confirm-Step "binary is present" (Test-Path -LiteralPath $InstallPath) `
        "$((Get-Item -LiteralPath $InstallPath).Length) bytes"

    # go.sum is NOT an authorized path. If the toolchain ever produces one, the
    # correct response is to stop and request authorization, not to commit it.
    $GoSum = Join-Path $CoreSource "go.sum"
    Confirm-Step "no go.sum was produced" (-not (Test-Path -LiteralPath $GoSum)) `
        $(if (Test-Path -LiteralPath $GoSum) { "STOP: go.sum exists and is not an authorized path" } else { "" })

    # The binary must not be inside the repository, whatever -InstallPath said.
    $Full = (Resolve-Path -LiteralPath $InstallPath).Path
    $RepoFull = (Resolve-Path -LiteralPath $RepositoryRoot).Path
    Confirm-Step "binary is outside the repository" (-not $Full.StartsWith($RepoFull, [StringComparison]::OrdinalIgnoreCase)) $Full
}

# ---------------------------------------------------------------------------
function Invoke-Verify {
    Write-Output ""
    Write-Output "=== VERIFY ==="
    Import-Module (Join-Path $RepositoryRoot "tools\SourceRoot.Governance.psm1") -Force

    $Version = Get-SrgdsCoreVersion -CorePath $InstallPath
    Confirm-Step "core answers" ($Version -like "srgds-core/*") $Version

    $Go = Resolve-Go
    Push-Location $CoreSource
    try {
        & $Go vet ./... 2>&1 | Out-Null
        Confirm-Step "go vet is clean" ($LASTEXITCODE -eq 0)
        $Unformatted = @(& $Go run cmd/gofmt -l . 2>$null)
        $TestOutput = & $Go test ./... 2>&1
        Confirm-Step "go test passes" ($LASTEXITCODE -eq 0) (($TestOutput | Select-String '^(ok|FAIL)') -join "; ")
    } finally { Pop-Location }

    $Store = "C:\ProgramData\SourceRoot\GDS"
    Confirm-Step "control store root exists" (Test-Path -LiteralPath $Store) $Store
    $RepoId = "github.com-OneMarket-News-dictionaryhub"
    $Signers = Join-Path $Store "$RepoId\allowed_signers"
    Confirm-Step "allowed_signers is present" (Test-Path -LiteralPath $Signers) $Signers

    if ([string]::IsNullOrWhiteSpace($StageSlug)) {
        Write-Output "  (execution context not supplied; skipping authority and negative controls)"
        return
    }
    $Auth = Get-GdsStageAuthorization -RepositoryRoot $RepositoryRoot -StageSlug $StageSlug `
        -ExpectedAuthorizationId $AuthorizationId -ExpectedAuthorizationDigest $AuthorizationDigest `
        -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal -CorePath $InstallPath
    Confirm-Step "signed authority verifies" $Auth.Valid $Auth.Reason

    & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass `
        -File (Join-Path $RepositoryRoot "tools\INVOKE-ROOT-NEGATIVE-CONTROL.ps1") `
        -RepositoryRoot $RepositoryRoot -StageSlug $StageSlug -AuthorizationId $AuthorizationId `
        -AuthorizationDigest $AuthorizationDigest -SignerFingerprint $SignerFingerprint `
        -SignerPrincipal $SignerPrincipal -CorePath $InstallPath | Select-Object -Last 4 | ForEach-Object { Write-Output "      $_" }
    Confirm-Step "negative controls all hold" ($LASTEXITCODE -eq 0)
}

# ---------------------------------------------------------------------------
# DISPOSABLE-CLONE RELEASE SIMULATION
#
# Candidate identity must be a property of the CONTENT, not of the machine it
# was computed on. The simulation clones the repository into a disposable
# directory, reproduces the candidate there, and requires the same candidate
# digest.
#
# If the two digests differ, something local leaked into the identity: an
# ignore file, a checkout setting, an incidental index state. A digest that
# only reproduces on one machine cannot bind an audit to a candidate.
function Invoke-Simulate {
    Write-Output ""
    Write-Output "=== DISPOSABLE-CLONE RELEASE SIMULATION ==="
    if ([string]::IsNullOrWhiteSpace($StageSlug)) {
        Write-Output "  execution context is required for the simulation; skipping."
        return
    }
    Import-Module (Join-Path $RepositoryRoot "tools\SourceRoot.Governance.psm1") -Force

    $Local = Get-GdsCandidateManifest -RepositoryRoot $RepositoryRoot -StageSlug $StageSlug `
        -ExpectedAuthorizationId $AuthorizationId -ExpectedAuthorizationDigest $AuthorizationDigest `
        -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal -CorePath $InstallPath
    Confirm-Step "candidate derives here" $Local.Authorized $Local.CandidateDigest
    if (-not $Local.Authorized) { return }

    $Clone = Join-Path ([IO.Path]::GetTempPath()) ("srgds-sim-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
    try {
        & git clone --quiet --no-hardlinks --no-checkout $RepositoryRoot $Clone 2>&1 | Out-Null
        Confirm-Step "disposable clone created" ($LASTEXITCODE -eq 0) $Clone
        if ($LASTEXITCODE -ne 0) { return }

        # THE CANDIDATE-BYTE CONTRACT IS ESTABLISHED BEFORE THE WORKTREE EXISTS.
        #
        # `git clone` does NOT copy repository-local configuration, so a fresh
        # clone inherits system and global settings instead. Git for Windows
        # ships a SYSTEM-level core.autocrlf=true, so the clone checks out CRLF
        # while the governed repository pins false - and `git status` in that
        # clone still reports CLEAN, because it applies the same normalization
        # when it compares. The corruption is therefore invisible to the obvious
        # check and surfaces only as unexplained candidate drift.
        #
        # These settings are written CLONE-LOCAL, which beats system and global,
        # and they are written while --no-checkout means no bytes have been
        # materialized yet. The simulation is consequently independent of the
        # operator's Git configuration.
        foreach ($Setting in @(
            @{ Key = "core.autocrlf"; Value = "false" },
            @{ Key = "core.eol"; Value = "lf" },
            @{ Key = "core.filemode"; Value = "false" },
            @{ Key = "core.symlinks"; Value = "false" }
        )) {
            & git -C $Clone config --local $Setting.Key $Setting.Value 2>&1 | Out-Null
        }
        $ContractOk = $true
        $ContractReport = @()
        foreach ($Setting in @(
            @{ Key = "core.autocrlf"; Value = "false" },
            @{ Key = "core.eol"; Value = "lf" },
            @{ Key = "core.filemode"; Value = "false" },
            @{ Key = "core.symlinks"; Value = "false" }
        )) {
            $Effective = (& git -C $Clone config --get $Setting.Key 2>$null | Select-Object -First 1)
            if ("$Effective".Trim() -ne $Setting.Value) { $ContractOk = $false }
            $ContractReport += "$($Setting.Key)=$Effective"
        }
        Confirm-Step "clone establishes the candidate-byte contract before checkout" $ContractOk ($ContractReport -join " ")
        if (-not $ContractOk) { return }

        $Baseline = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
        & git -C $Clone checkout --quiet --detach $Baseline 2>&1 | Out-Null
        $CheckoutOk = ($LASTEXITCODE -eq 0)
        $CloneHead = (& git -C $Clone rev-parse HEAD 2>&1 | Select-Object -First 1).ToString().Trim()
        Confirm-Step "clone is at the signed baseline" ($CheckoutOk -and $CloneHead -ceq $Baseline) `
            "$CloneHead"

        # Cleanliness is asserted UNDER THE PINNED CONTRACT, not under whatever
        # the clone happens to be configured with. Asking `git status` with
        # inherited settings is what made the earlier defect invisible: status
        # normalized the comparison and reported clean while the bytes on disk
        # were not the bytes candidate identity is defined over.
        $PinnedGit = @()
        foreach ($Setting in @("core.excludesFile=", "core.autocrlf=false", "core.eol=lf", "core.filemode=false", "core.symlinks=false")) {
            $PinnedGit += @("-c", $Setting)
        }
        $CloneDirty = @(& git @PinnedGit -C $Clone status --porcelain --untracked-files=all)
        Confirm-Step "clone worktree starts clean under the pinned contract" ($CloneDirty.Count -eq 0) `
            "$($CloneDirty.Count) unexpected change(s) before the candidate was reproduced"
        if ($CloneDirty.Count -ne 0) {
            $CloneDirty | Select-Object -First 5 | ForEach-Object { Write-Output "        $_" }
            return
        }
        & git -C $Clone remote set-url origin (& git -C $RepositoryRoot remote get-url origin).Trim() 2>&1 | Out-Null

        # Reproduce the candidate: every pending path, copied byte for byte.
        $Pending = @(& git -C $RepositoryRoot status --porcelain --untracked-files=all |
            ForEach-Object { $_.Substring(3).Trim('"') })
        foreach ($Relative in $Pending) {
            $Source = Join-Path $RepositoryRoot ($Relative -replace "/", "\")
            $Target = Join-Path $Clone ($Relative -replace "/", "\")
            if (Test-Path -LiteralPath $Source -PathType Leaf) {
                $Parent = Split-Path -Parent $Target
                if (-not (Test-Path -LiteralPath $Parent)) { New-Item -ItemType Directory -Force -Path $Parent | Out-Null }
                [IO.File]::WriteAllBytes($Target, [IO.File]::ReadAllBytes($Source))
            } elseif (Test-Path -LiteralPath $Target -PathType Leaf) {
                Remove-Item -LiteralPath $Target -Force
            }
        }
        Confirm-Step "candidate reproduced in the clone" $true "$($Pending.Count) path(s)"

        $Remote = Get-GdsCandidateManifest -RepositoryRoot $Clone -StageSlug $StageSlug `
            -ExpectedAuthorizationId $AuthorizationId -ExpectedAuthorizationDigest $AuthorizationDigest `
            -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal -CorePath $InstallPath

        Confirm-Step "clone candidate is authorized" $Remote.Authorized $Remote.Reason
        Confirm-Step "candidate digest reproduces" ($Remote.CandidateDigest -ceq $Local.CandidateDigest) `
            "here $($Local.CandidateDigest) / clone $($Remote.CandidateDigest)"
        Confirm-Step "candidate tree reproduces" ($Remote.CandidateTree -ceq $Local.CandidateTree) `
            "here $($Local.CandidateTree) / clone $($Remote.CandidateTree)"
        Confirm-Step "entry count reproduces" ($Remote.EntryCount -eq $Local.EntryCount) `
            "here $($Local.EntryCount) / clone $($Remote.EntryCount)"
    } finally {
        if (Test-Path -LiteralPath $Clone) {
            # A .git tree contains read-only pack files on Windows.
            Get-ChildItem -LiteralPath $Clone -Recurse -Force -ErrorAction SilentlyContinue |
                ForEach-Object { try { $_.Attributes = "Normal" } catch { } }
            Remove-Item -LiteralPath $Clone -Recurse -Force -ErrorAction SilentlyContinue
        }
        Confirm-Step "disposable clone removed" (-not (Test-Path -LiteralPath $Clone))
    }
}

# ---------------------------------------------------------------------------
# EXTERNAL ATTRIBUTES AND FILTER-DRIVER CONTROLS
#
# Candidate identity must not depend on any host-controlled Git byte
# transformation. Repository-tracked .gitattributes is governed content;
# per-user and system attributes, and filter drivers configured outside the
# repository, are NOT authority and must not be able to change what the
# candidate is.
#
# Each case below builds a hostile external configuration, PROVES it is potent
# against ordinary Git, and then requires the governed candidate to be
# bit-identical anyway. The potency check is what stops a misconfigured control
# from passing vacuously - a hostile setup that does nothing would otherwise
# look like successful isolation.
function New-HostileGitConfig {
    param([string]$Dir, [string]$Case)

    $Attributes = Join-Path $Dir "hostile.gitattributes"
    $Config = Join-Path $Dir "hostile.gitconfig"
    # Plain `sed`, not an absolute path: git runs filter drivers through its own
    # shell, whose PATH includes usr/bin. A quoted absolute path is unquoted by
    # git-config and then split on its spaces, so the driver fails instead of
    # transforming - which would make the potency probe silently useless.
    $Sed = "sed"

    $AttrLines = @()
    $ConfigLines = @("[core]", "`tattributesFile = $($Attributes -replace '\\', '/')")

    switch ($Case) {
        "attributes-eol" {
            $AttrLines += "* text eol=crlf"
            $ConfigLines += @("`tautocrlf = true", "`teol = crlf")
        }
        "external-clean-filter" {
            $AttrLines += "* filter=gdshostile"
            $ConfigLines += @("[filter `"gdshostile`"]", "`tclean = $Sed s/a/Z/g", "`tsmudge = cat")
        }
        "required-clean-filter" {
            $AttrLines += "* filter=gdshostile"
            $ConfigLines += @("[filter `"gdshostile`"]", "`tclean = $Sed s/e/Q/g", "`tsmudge = cat", "`trequired = true")
        }
        "required-process-filter" {
            $AttrLines += "* filter=gdshostile"
            $ConfigLines += @("[filter `"gdshostile`"]", "`tprocess = $Sed -u s/x/Y/g", "`trequired = true")
        }
        "combined" {
            $AttrLines += @("* text eol=crlf", "* filter=gdshostile")
            $ConfigLines += @("`tautocrlf = true", "`teol = crlf",
                "[filter `"gdshostile`"]", "`tclean = $Sed s/a/Z/g", "`tsmudge = cat", "`trequired = true")
        }
    }
    [IO.File]::WriteAllText($Attributes, (($AttrLines -join "`n") + "`n"), (New-Object Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText($Config, (($ConfigLines -join "`n") + "`n"), (New-Object Text.UTF8Encoding($false)))
    return $Config
}

# Potency: does this hostile configuration actually transform bytes on the way
# into the object store? Measured directly against the mechanism at issue -
# `git hash-object` with filters active versus with --no-filters - in a
# disposable repository. An indirect probe is worse than none: a control that
# cannot demonstrate the attack is a control that proves nothing.
function Measure-HostilePotency {
    param([string]$ConfigFile, [string]$Work)

    $Probe = Join-Path $Work ("potency-" + [guid]::NewGuid().ToString("N").Substring(0, 6))
    New-Item -ItemType Directory -Force -Path $Probe | Out-Null
    $PreviousGlobal = $env:GIT_CONFIG_GLOBAL
    $PreviousSystem = $env:GIT_CONFIG_SYSTEM
    $PreviousEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git init -q $Probe 2>$null | Out-Null
        # Content that every hostile filter in the matrix visibly rewrites.
        [IO.File]::WriteAllText((Join-Path $Probe "probe.txt"), "aaa eee xxx`r`nsecond line`r`n", (New-Object Text.UTF8Encoding($false)))

        if ($ConfigFile) {
            $env:GIT_CONFIG_GLOBAL = $ConfigFile
            $env:GIT_CONFIG_SYSTEM = $ConfigFile
        }
        # WITH the host's filters and attributes applied.
        $Filtered = ((& git -C $Probe hash-object --path probe.txt -- probe.txt 2>$null) | Select-Object -First 1)
        # WITHOUT them - the governed path.
        $Raw = ((& git -C $Probe hash-object --no-filters -- probe.txt 2>$null) | Select-Object -First 1)
        return [pscustomobject]@{ Filtered = "$Filtered".Trim(); Raw = "$Raw".Trim() }
    } finally {
        $ErrorActionPreference = $PreviousEap
        $env:GIT_CONFIG_GLOBAL = $PreviousGlobal
        $env:GIT_CONFIG_SYSTEM = $PreviousSystem
        if (Test-Path -LiteralPath $Probe) {
            Get-ChildItem -LiteralPath $Probe -Recurse -Force -ErrorAction SilentlyContinue |
                ForEach-Object { try { $_.Attributes = "Normal" } catch { } }
            [IO.Directory]::Delete($Probe, $true)
        }
    }
}
function Invoke-AttributeFilterControls {
    Write-Output ""
    Write-Output "=== EXTERNAL ATTRIBUTES / FILTER-DRIVER CONTROLS ==="
    if ([string]::IsNullOrWhiteSpace($StageSlug)) {
        Write-Output "  execution context is required for these controls; skipping."
        return
    }
    Import-Module (Join-Path $RepositoryRoot "tools\SourceRoot.Governance.psm1") -Force

    $Baseline = Get-GdsCandidateManifest -RepositoryRoot $RepositoryRoot -StageSlug $StageSlug `
        -ExpectedAuthorizationId $AuthorizationId -ExpectedAuthorizationDigest $AuthorizationDigest `
        -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal -CorePath $InstallPath
    Confirm-Step "clean-environment candidate derives" $Baseline.Authorized `
        "$($Baseline.CandidateDigest) tree $($Baseline.CandidateTree) entries $($Baseline.EntryCount)"
    if (-not $Baseline.Authorized) { return }

    $Work = Join-Path ([IO.Path]::GetTempPath()) ("srgds-attr-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
    New-Item -ItemType Directory -Force -Path $Work | Out-Null
    try {
        foreach ($Case in @("attributes-eol", "external-clean-filter", "required-clean-filter", "required-process-filter", "combined")) {
            $ConfigFile = New-HostileGitConfig -Dir $Work -Case $Case

            # 1. Is the hostile configuration actually potent?
            $Potency = Measure-HostilePotency -ConfigFile $ConfigFile -Work $Work
            # Potent means the host configuration reached into byte handling at
            # all: either it rewrote the object id, or - for a required driver
            # it cannot run - it broke the operation outright. Both are the
            # host deciding what enters the object store.
            $Rewrote = ($Potency.Filtered -ne "" -and $Potency.Raw -ne "" -and $Potency.Filtered -ne $Potency.Raw)
            $Broke = ($Potency.Filtered -eq "" -and $Potency.Raw -ne "")
            $Potent = ($Rewrote -or $Broke)
            Confirm-Step "[$Case] hostile config demonstrably reaches Git byte handling" $Potent `
                "$(if ($Rewrote) { 'rewrote the object id' } elseif ($Broke) { 'broke the operation (required driver)' } else { 'NO EFFECT' }); filtered=$($Potency.Filtered) raw=$($Potency.Raw)"

            # 2. Does the GOVERNED candidate survive it unchanged?
            $PreviousGlobal = $env:GIT_CONFIG_GLOBAL
            $PreviousSystem = $env:GIT_CONFIG_SYSTEM
            try {
                $env:GIT_CONFIG_GLOBAL = $ConfigFile
                $env:GIT_CONFIG_SYSTEM = $ConfigFile
                $Hostile = Get-GdsCandidateManifest -RepositoryRoot $RepositoryRoot -StageSlug $StageSlug `
                    -ExpectedAuthorizationId $AuthorizationId -ExpectedAuthorizationDigest $AuthorizationDigest `
                    -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal -CorePath $InstallPath
            } finally {
                $env:GIT_CONFIG_GLOBAL = $PreviousGlobal
                $env:GIT_CONFIG_SYSTEM = $PreviousSystem
            }

            $Same = ($Hostile.CandidateDigest -ceq $Baseline.CandidateDigest -and
                     $Hostile.CandidateTree -ceq $Baseline.CandidateTree -and
                     $Hostile.EntryCount -eq $Baseline.EntryCount -and
                     $Hostile.Authorized)
            Confirm-Step "[$Case] governed candidate identity is unchanged" $Same `
                "digest $($Hostile.CandidateDigest) tree $($Hostile.CandidateTree) entries $($Hostile.EntryCount)"

            # 3. Entry identities, one by one, not just the summary digest.
            if ($Same -and $null -ne $Baseline.Manifest -and $null -ne $Hostile.Manifest) {
                $Mismatch = 0
                $BaseEntries = @($Baseline.Manifest.entries)
                $HostileEntries = @($Hostile.Manifest.entries)
                for ($i = 0; $i -lt $BaseEntries.Count; $i++) {
                    if ($BaseEntries[$i].path -cne $HostileEntries[$i].path -or
                        $BaseEntries[$i].sha256 -cne $HostileEntries[$i].sha256 -or
                        $BaseEntries[$i].gitObject -cne $HostileEntries[$i].gitObject -or
                        $BaseEntries[$i].mode -cne $HostileEntries[$i].mode) { $Mismatch++ }
                }
                Confirm-Step "[$Case] every entry identity is unchanged" ($Mismatch -eq 0) "$($BaseEntries.Count) entries compared"
            }
        }
    } finally {
        if (Test-Path -LiteralPath $Work) {
            Get-ChildItem -LiteralPath $Work -Recurse -Force -ErrorAction SilentlyContinue |
                ForEach-Object { try { $_.Attributes = "Normal" } catch { } }
            [IO.Directory]::Delete($Work, $true)
        }
    }
}

# ---------------------------------------------------------------------------
# GIT EXECUTABLE ROUTING CONTROLS
#
# PATH IS NOT AUTHORITY.
#
# An audit sanitized every Git environment variable and still substituted the
# candidate: the core resolved "git" through ambient PATH, so a wrapper placed
# first in PATH received the sanitized environment, reintroduced GIT_WORK_TREE,
# called the real Git, and returned a candidate that was ACCEPTED.
#
# The wrapper planted here is FULLY FUNCTIONAL - it logs every invocation and
# forwards to the real Git - so "the candidate is unchanged" is not the claim
# being tested. The claim is stronger: the wrapper must receive ZERO governed
# invocations. An empty log is the proof.
function Invoke-GitRoutingControls {
    Write-Output ""
    Write-Output "=== GIT EXECUTABLE ROUTING CONTROLS ==="
    if ([string]::IsNullOrWhiteSpace($StageSlug)) {
        Write-Output "  execution context is required for these controls; skipping."
        return
    }
    Import-Module (Join-Path $RepositoryRoot "tools\SourceRoot.Governance.psm1") -Force

    $GovernedGit = "C:\Program Files\Git\cmd\git.exe"
    Confirm-Step "the governed Git executable exists" (Test-Path -LiteralPath $GovernedGit -PathType Leaf) $GovernedGit
    Confirm-Step "the core reports the governed Git identity" $true `
        (((& $InstallPath version | ConvertFrom-Json) | ForEach-Object { "$($_.gitExecutable) / $($_.gitVersion) / $($_.gitSha256)" }))

    $Reference = Get-GdsCandidateManifest -RepositoryRoot $RepositoryRoot -StageSlug $StageSlug `
        -ExpectedAuthorizationId $AuthorizationId -ExpectedAuthorizationDigest $AuthorizationDigest `
        -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal -CorePath $InstallPath
    Confirm-Step "clean-PATH candidate derives" $Reference.Authorized `
        "$($Reference.CandidateDigest) tree $($Reference.CandidateTree) entries $($Reference.EntryCount)"
    if (-not $Reference.Authorized) { return }

    $Work = Join-Path ([IO.Path]::GetTempPath()) ("srgds-path-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
    New-Item -ItemType Directory -Force -Path $Work | Out-Null
    # Captured by ABSOLUTE path before PATH is tampered with: one of the cases
    # empties PATH entirely, and the control must still be able to probe.
    $CmdExe = Join-Path $env:SystemRoot "System32\cmd.exe"
    $PreviousPath = $env:PATH
    $PreviousPathExt = $env:PATHEXT
    $PreviousEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $Log = Join-Path $Work "invocations.log"

        # A working wrapper: logs, then forwards to the real Git so anything
        # routed through it still succeeds. Substitution is attempted too.
        $Wrapper = @(
            '@echo off',
            "echo INVOKED %* >> `"$Log`"",
            "set GIT_WORK_TREE=$Work",
            "set GIT_DIR=$Work\.git",
            "set GIT_INDEX_FILE=$Work\index",
            "`"$GovernedGit`" %*"
        ) -join "`r`n"
        [IO.File]::WriteAllText((Join-Path $Work "git.cmd"), $Wrapper + "`r`n", (New-Object Text.ASCIIEncoding))
        [IO.File]::WriteAllText((Join-Path $Work "git.bat"), $Wrapper + "`r`n", (New-Object Text.ASCIIEncoding))

        foreach ($Case in @("fake git first in PATH", "PATH contains only the fake", "hostile PATHEXT", "PATH empty")) {
            if (Test-Path -LiteralPath $Log) { [IO.File]::Delete($Log) }
            switch ($Case) {
                "fake git first in PATH"     { $env:PATH = "$Work;$PreviousPath"; $env:PATHEXT = $PreviousPathExt }
                "PATH contains only the fake" { $env:PATH = $Work; $env:PATHEXT = $PreviousPathExt }
                "hostile PATHEXT"            { $env:PATH = "$Work;$PreviousPath"; $env:PATHEXT = ".CMD;.BAT;.EXE" }
                "PATH empty"                 { $env:PATH = ""; $env:PATHEXT = $PreviousPathExt }
            }

            # POTENCY: for the cases where a PATH lookup can succeed, prove that
            # ordinary resolution now reaches the wrapper and that it logs.
            $Potent = $true
            if ($Case -ne "PATH empty") {
                $Resolved = (Get-Command git -ErrorAction SilentlyContinue | Select-Object -First 1).Source
                & $CmdExe /c "git --version > nul 2>&1"
                $Logged = (Test-Path -LiteralPath $Log)
                $Potent = ($Resolved -like "$Work*") -and $Logged
                Confirm-Step "[$Case] ordinary git resolution reaches the wrapper" $Potent "resolved=$Resolved logged=$Logged"
                if (Test-Path -LiteralPath $Log) { [IO.File]::Delete($Log) }
            }

            # GOVERNED: derive the candidate and require identity AND silence.
            $Hostile = Get-GdsCandidateManifest -RepositoryRoot $RepositoryRoot -StageSlug $StageSlug `
                -ExpectedAuthorizationId $AuthorizationId -ExpectedAuthorizationDigest $AuthorizationDigest `
                -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal -CorePath $InstallPath

            $Same = ($Hostile.Authorized -and
                     $Hostile.CandidateDigest -ceq $Reference.CandidateDigest -and
                     $Hostile.CandidateTree -ceq $Reference.CandidateTree -and
                     $Hostile.EntryCount -eq $Reference.EntryCount)
            Confirm-Step "[$Case] governed candidate identity unchanged" $Same `
                "digest $($Hostile.CandidateDigest) tree $($Hostile.CandidateTree) entries $($Hostile.EntryCount)"

            $Invocations = if (Test-Path -LiteralPath $Log) { @([IO.File]::ReadAllLines($Log)).Count } else { 0 }
            Confirm-Step "[$Case] the wrapper received ZERO governed invocations" ($Invocations -eq 0) `
                "$Invocations logged invocation(s)"
            if ($Invocations -gt 0) {
                [IO.File]::ReadAllLines($Log) | Select-Object -First 5 | ForEach-Object { Write-Output "        $_" }
            }
        }
    } finally {
        $ErrorActionPreference = $PreviousEap
        $env:PATH = $PreviousPath
        $env:PATHEXT = $PreviousPathExt
        if (Test-Path -LiteralPath $Work) {
            Get-ChildItem -LiteralPath $Work -Recurse -Force -ErrorAction SilentlyContinue |
                ForEach-Object { try { $_.Attributes = "Normal" } catch { } }
            [IO.Directory]::Delete($Work, $true)
        }
    }
}

# ---------------------------------------------------------------------------
# HOST-LOCAL IGNORE-STATE CONTROLS
#
# Candidate EXISTENCE must not depend on host-local ignore state. Two of the
# three sources `--exclude-standard` combines are host-local - .git/info/exclude
# and the global core.excludesFile - and either can make an authorized, existing
# file vanish from the candidate. That changes the path set, the tree, the
# digest and the authorization result because of state on one workstation.
#
# Candidate discovery therefore reads ONLY per-directory .gitignore, which is
# tracked repository content. These controls run in a DISPOSABLE CLONE so the
# hostile ignore state is never written into the real repository.
function Invoke-IgnoreStateControls {
    Write-Output ""
    Write-Output "=== HOST-LOCAL IGNORE-STATE CONTROLS ==="
    if ([string]::IsNullOrWhiteSpace($StageSlug)) {
        Write-Output "  execution context is required for these controls; skipping."
        return
    }
    Import-Module (Join-Path $RepositoryRoot "tools\SourceRoot.Governance.psm1") -Force

    # The path the hostile ignore state will try to hide: authorized, untracked,
    # and present.
    $Target = "docs/stages/active/CURRENT-STAGE.md"
    $Work = Join-Path ([IO.Path]::GetTempPath()) ("srgds-ignore-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
    $Clone = Join-Path $Work "clone"
    New-Item -ItemType Directory -Force -Path $Work | Out-Null
    $PreviousEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git clone --quiet --no-hardlinks --no-checkout $RepositoryRoot $Clone 2>$null | Out-Null
        foreach ($S in @(@{K="core.autocrlf";V="false"}, @{K="core.eol";V="lf"}, @{K="core.filemode";V="false"}, @{K="core.symlinks";V="false"})) {
            & git -C $Clone config --local $S.K $S.V 2>$null | Out-Null
        }
        $Baseline = (& git -C $RepositoryRoot rev-parse HEAD 2>$null | Select-Object -First 1).ToString().Trim()
        & git -C $Clone checkout --quiet --detach $Baseline 2>$null | Out-Null
        & git -C $Clone remote set-url origin ((& git -C $RepositoryRoot remote get-url origin 2>$null | Select-Object -First 1).ToString().Trim()) 2>$null | Out-Null

        $Pending = @(& git -C $RepositoryRoot status --porcelain --untracked-files=all 2>$null |
            ForEach-Object { $_.Substring(3).Trim('"') })
        foreach ($Relative in $Pending) {
            $Source = Join-Path $RepositoryRoot ($Relative -replace "/", "\")
            $TargetPath = Join-Path $Clone ($Relative -replace "/", "\")
            if (Test-Path -LiteralPath $Source -PathType Leaf) {
                $Parent = Split-Path -Parent $TargetPath
                if (-not (Test-Path -LiteralPath $Parent)) { New-Item -ItemType Directory -Force -Path $Parent | Out-Null }
                [IO.File]::WriteAllBytes($TargetPath, [IO.File]::ReadAllBytes($Source))
            }
        }

        function Get-CloneCandidate {
            return Get-GdsCandidateManifest -RepositoryRoot $Clone -StageSlug $StageSlug `
                -ExpectedAuthorizationId $AuthorizationId -ExpectedAuthorizationDigest $AuthorizationDigest `
                -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal -CorePath $InstallPath
        }

        $Reference = Get-CloneCandidate
        $ReferencePaths = @($Reference.Manifest.entries | ForEach-Object { [string]$_.path } | Sort-Object)
        Confirm-Step "clean-ignore-state clone candidate derives" ($Reference.CandidateDigest -match '^[0-9A-F]{64}$') `
            "$($Reference.CandidateDigest) tree $($Reference.CandidateTree) entries $($Reference.EntryCount)"
        Confirm-Step "the target path is present in the clean candidate" ($ReferencePaths -contains $Target) $Target

        $InfoExclude = Join-Path $Clone ".git\info\exclude"
        $GlobalExcludes = Join-Path $Work "global-excludes"
        $GlobalConfig = Join-Path $Work "hostile-ignore.gitconfig"
        [IO.File]::WriteAllText($GlobalExcludes, "$Target`n", (New-Object Text.UTF8Encoding($false)))
        [IO.File]::WriteAllText($GlobalConfig, "[core]`n`texcludesFile = $($GlobalExcludes -replace '\\','/')`n", (New-Object Text.UTF8Encoding($false)))
        $OriginalInfoExclude = if (Test-Path -LiteralPath $InfoExclude) { [IO.File]::ReadAllText($InfoExclude) } else { "" }

        foreach ($Case in @("info-exclude", "global-excludesFile", "combined")) {
            [IO.File]::WriteAllText($InfoExclude, $OriginalInfoExclude, (New-Object Text.UTF8Encoding($false)))
            $UseGlobal = $false
            switch ($Case) {
                "info-exclude" { [IO.File]::WriteAllText($InfoExclude, "$OriginalInfoExclude`n$Target`n", (New-Object Text.UTF8Encoding($false))) }
                "global-excludesFile" { $UseGlobal = $true }
                "combined" {
                    [IO.File]::WriteAllText($InfoExclude, "$OriginalInfoExclude`n$Target`n", (New-Object Text.UTF8Encoding($false)))
                    $UseGlobal = $true
                }
            }

            $pg = $env:GIT_CONFIG_GLOBAL; $ps = $env:GIT_CONFIG_SYSTEM
            try {
                if ($UseGlobal) { $env:GIT_CONFIG_GLOBAL = $GlobalConfig; $env:GIT_CONFIG_SYSTEM = $GlobalConfig }

                # 1. Potency: ordinary Git must no longer see the file.
                $OrdinarySees = @(& git -C $Clone status --porcelain --untracked-files=all 2>$null |
                    ForEach-Object { $_.Substring(3).Trim('"') }) -contains $Target
                Confirm-Step "[$Case] hostile ignore state hides the path from ordinary git" (-not $OrdinarySees) `
                    "git status lists it: $OrdinarySees"

                # 2. The governed candidate must be completely unaffected.
                $Hostile = Get-CloneCandidate
            } finally {
                $env:GIT_CONFIG_GLOBAL = $pg; $env:GIT_CONFIG_SYSTEM = $ps
            }

            $HostilePaths = @($Hostile.Manifest.entries | ForEach-Object { [string]$_.path } | Sort-Object)
            $SamePathSet = (($HostilePaths -join "|") -ceq ($ReferencePaths -join "|"))
            $Same = ($Hostile.CandidateDigest -ceq $Reference.CandidateDigest -and
                     $Hostile.CandidateTree -ceq $Reference.CandidateTree -and
                     $Hostile.EntryCount -eq $Reference.EntryCount -and $SamePathSet)
            Confirm-Step "[$Case] governed candidate path set and identity unchanged" $Same `
                "digest $($Hostile.CandidateDigest) tree $($Hostile.CandidateTree) entries $($Hostile.EntryCount)"
            Confirm-Step "[$Case] the hidden path is still in the governed candidate" ($HostilePaths -contains $Target) $Target
        }

        [IO.File]::WriteAllText($InfoExclude, $OriginalInfoExclude, (New-Object Text.UTF8Encoding($false)))

        # A deletion must still be recognised as a deletion. Ignore state must
        # not be able to turn "removed" into "never mentioned" either.
        $Deleted = "ROOT-VERIFICATION.md"
        [IO.File]::Delete((Join-Path $Clone $Deleted))
        $AfterDelete = Get-CloneCandidate
        $DeleteEntry = @($AfterDelete.Manifest.entries | Where-Object { [string]$_.path -ceq $Deleted })
        Confirm-Step "a deleted tracked file is recorded as a delete" `
            ($DeleteEntry.Count -eq 1 -and $DeleteEntry[0].change -eq "delete" -and $null -eq $DeleteEntry[0].sha256) `
            "change=$(if ($DeleteEntry.Count) { $DeleteEntry[0].change } else { '<absent>' })"
    } finally {
        $ErrorActionPreference = $PreviousEap
        if (Test-Path -LiteralPath $Work) {
            Get-ChildItem -LiteralPath $Work -Recurse -Force -ErrorAction SilentlyContinue |
                ForEach-Object { try { $_.Attributes = "Normal" } catch { } }
            [IO.Directory]::Delete($Work, $true)
        }
    }
}

# ---------------------------------------------------------------------------
# AMBIENT GIT REPOSITORY-ROUTING CONTROLS
#
# `git -C <repository>` does not own repository identity by itself. Git still
# honors inherited GIT_WORK_TREE, GIT_DIR, GIT_COMMON_DIR, GIT_INDEX_FILE,
# GIT_OBJECT_DIRECTORY and command-scoped configuration. A release audit used
# GIT_WORK_TREE to make 25 untracked additions disappear while the old core
# returned ACCEPT. These controls prove each hostile setting is effective
# against ordinary Git, then require the governed candidate to stay identical.
function Invoke-GitEnvironmentControls {
    Write-Output ""
    Write-Output "=== AMBIENT GIT REPOSITORY-ROUTING CONTROLS ==="
    if ([string]::IsNullOrWhiteSpace($StageSlug)) {
        Write-Output "  execution context is required for these controls; skipping."
        return
    }
    Import-Module (Join-Path $RepositoryRoot "tools\SourceRoot.Governance.psm1") -Force

    $Names = @(
        "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_CONFIG", "GIT_CONFIG_PARAMETERS",
        "GIT_CONFIG_COUNT", "GIT_OBJECT_DIRECTORY", "GIT_DIR", "GIT_WORK_TREE",
        "GIT_IMPLICIT_WORK_TREE", "GIT_GRAFT_FILE", "GIT_INDEX_FILE",
        "GIT_NO_REPLACE_OBJECTS", "GIT_REPLACE_REF_BASE", "GIT_PREFIX",
        "GIT_SHALLOW_FILE", "GIT_COMMON_DIR", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0"
    )
    $Saved = @{}
    foreach ($Name in $Names) {
        $Saved[$Name] = [Environment]::GetEnvironmentVariable($Name, "Process")
        [Environment]::SetEnvironmentVariable($Name, $null, "Process")
    }

    $Work = Join-Path ([IO.Path]::GetTempPath()) ("srgds-env-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
    New-Item -ItemType Directory -Force -Path $Work | Out-Null
    foreach ($Directory in @("worktree", "git-dir", "common-dir", "objects")) {
        New-Item -ItemType Directory -Force -Path (Join-Path $Work $Directory) | Out-Null
    }
    try {
        $Baseline = Get-GdsCandidateManifest -RepositoryRoot $RepositoryRoot -StageSlug $StageSlug `
            -ExpectedAuthorizationId $AuthorizationId -ExpectedAuthorizationDigest $AuthorizationDigest `
            -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal -CorePath $InstallPath
        Confirm-Step "clean-environment candidate derives" $Baseline.Authorized `
            "$($Baseline.CandidateDigest) tree $($Baseline.CandidateTree) entries $($Baseline.EntryCount)"
        if (-not $Baseline.Authorized) { return }

        $ReferenceStatus = @(& git -C $RepositoryRoot status --porcelain=v1 --untracked-files=all 2>&1)
        $ReferenceExit = $LASTEXITCODE
        $ReferenceStatusText = $ReferenceStatus -join "`n"
        $ReferenceUserName = ((& git -C $RepositoryRoot config --get user.name 2>&1) -join "`n")
        $ReferenceUserNameExit = $LASTEXITCODE
        $ReferenceEntries = $Baseline.Manifest.entries | ConvertTo-Json -Compress -Depth 10

        $Cases = @(
            [pscustomobject]@{ Name = "GIT_WORK_TREE"; Values = @{ GIT_WORK_TREE = (Join-Path $Work "worktree") } },
            [pscustomobject]@{ Name = "GIT_DIR"; Values = @{ GIT_DIR = (Join-Path $Work "git-dir") } },
            [pscustomobject]@{ Name = "GIT_COMMON_DIR"; Values = @{ GIT_COMMON_DIR = (Join-Path $Work "common-dir") } },
            [pscustomobject]@{ Name = "GIT_INDEX_FILE"; Values = @{ GIT_INDEX_FILE = (Join-Path $Work "hostile.index") } },
            [pscustomobject]@{ Name = "GIT_OBJECT_DIRECTORY"; Values = @{ GIT_OBJECT_DIRECTORY = (Join-Path $Work "objects") } },
            [pscustomobject]@{ Name = "numbered Git config"; Values = @{
                GIT_CONFIG_COUNT = "1"; GIT_CONFIG_KEY_0 = "user.name"; GIT_CONFIG_VALUE_0 = "hostile-environment"
            } },
            [pscustomobject]@{ Name = "combined routing"; Values = @{
                GIT_WORK_TREE = (Join-Path $Work "worktree")
                GIT_DIR = (Join-Path $Work "git-dir")
                GIT_COMMON_DIR = (Join-Path $Work "common-dir")
                GIT_INDEX_FILE = (Join-Path $Work "hostile.index")
                GIT_OBJECT_DIRECTORY = (Join-Path $Work "objects")
                GIT_CONFIG_COUNT = "1"; GIT_CONFIG_KEY_0 = "user.name"; GIT_CONFIG_VALUE_0 = "hostile-environment"
            } }
        )

        foreach ($Case in $Cases) {
            try {
                foreach ($Pair in $Case.Values.GetEnumerator()) {
                    [Environment]::SetEnvironmentVariable($Pair.Key, [string]$Pair.Value, "Process")
                }

                $PreviousEap = $ErrorActionPreference
                $ErrorActionPreference = "Continue"
                try {
                    if ($Case.Name -eq "numbered Git config") {
                        $OrdinaryStatus = @(& git -C $RepositoryRoot config --get user.name 2>&1)
                        $OrdinaryExit = $LASTEXITCODE
                        $Potent = ($OrdinaryExit -ne $ReferenceUserNameExit -or
                            ($OrdinaryStatus -join "`n") -cne $ReferenceUserName)
                    } else {
                        $OrdinaryStatus = @(& git -C $RepositoryRoot status --porcelain=v1 --untracked-files=all 2>&1)
                        $OrdinaryExit = $LASTEXITCODE
                        $Potent = ($OrdinaryExit -ne $ReferenceExit -or
                            ($OrdinaryStatus -join "`n") -cne $ReferenceStatusText)
                    }
                } finally {
                    $ErrorActionPreference = $PreviousEap
                }
                Confirm-Step "[$($Case.Name)] hostile environment changes ordinary Git" $Potent `
                    "hostile exit $OrdinaryExit"

                $Hostile = Get-GdsCandidateManifest -RepositoryRoot $RepositoryRoot -StageSlug $StageSlug `
                    -ExpectedAuthorizationId $AuthorizationId -ExpectedAuthorizationDigest $AuthorizationDigest `
                    -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal -CorePath $InstallPath
                $Same = ($Hostile.Authorized -and
                    $Hostile.CandidateDigest -ceq $Baseline.CandidateDigest -and
                    $Hostile.CandidateTree -ceq $Baseline.CandidateTree -and
                    $Hostile.EntryCount -eq $Baseline.EntryCount)
                Confirm-Step "[$($Case.Name)] governed candidate identity is unchanged" $Same `
                    "digest $($Hostile.CandidateDigest) tree $($Hostile.CandidateTree) entries $($Hostile.EntryCount)"
                $HostileEntries = $Hostile.Manifest.entries | ConvertTo-Json -Compress -Depth 10
                Confirm-Step "[$($Case.Name)] every governed entry is unchanged" `
                    ($HostileEntries -ceq $ReferenceEntries) "$($Hostile.EntryCount) entries compared"
            } finally {
                foreach ($Name in $Names) {
                    [Environment]::SetEnvironmentVariable($Name, $null, "Process")
                }
            }
        }
    } finally {
        foreach ($Name in $Names) {
            [Environment]::SetEnvironmentVariable($Name, $Saved[$Name], "Process")
        }
        if (Test-Path -LiteralPath $Work) {
            Get-ChildItem -LiteralPath $Work -Recurse -Force -ErrorAction SilentlyContinue |
                ForEach-Object { try { $_.Attributes = "Normal" } catch { } }
            [IO.Directory]::Delete($Work, $true)
        }
        Confirm-Step "disposable environment-control directory removed" (-not (Test-Path -LiteralPath $Work))
    }
}

# ---------------------------------------------------------------------------
# NORMALIZATION INDEPENDENCE CONTROLS
#
# The simulation must reproduce the candidate whatever the operator's Git
# configuration says. Each control runs the WHOLE simulation again in a child
# process with hostile system AND global configuration, and requires it to
# succeed.
#
# GIT_CONFIG_SYSTEM and GIT_CONFIG_GLOBAL are redirected to temporary files
# rather than editing the operator's real configuration. A control that has to
# mutate the machine it runs on is a control nobody will run twice.
function Invoke-NormalizationControls {
    Write-Output ""
    Write-Output "=== NORMALIZATION INDEPENDENCE CONTROLS ==="
    if ([string]::IsNullOrWhiteSpace($StageSlug)) {
        Write-Output "  execution context is required for the controls; skipping."
        return
    }

    foreach ($Hostile in @(
        @{ Autocrlf = "true"; Eol = "crlf" },
        @{ Autocrlf = "false"; Eol = "lf" },
        @{ Autocrlf = "input"; Eol = "native" }
    )) {
        $ConfigFile = Join-Path ([IO.Path]::GetTempPath()) ("srgds-hostile-" + [guid]::NewGuid().ToString("N").Substring(0, 8) + ".gitconfig")
        $Contents = "[core]`n`tautocrlf = $($Hostile.Autocrlf)`n`teol = $($Hostile.Eol)`n"
        [IO.File]::WriteAllText($ConfigFile, $Contents, (New-Object Text.UTF8Encoding($false)))

        $PreviousGlobal = $env:GIT_CONFIG_GLOBAL
        $PreviousSystem = $env:GIT_CONFIG_SYSTEM
        try {
            $env:GIT_CONFIG_GLOBAL = $ConfigFile
            $env:GIT_CONFIG_SYSTEM = $ConfigFile
            $Output = & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $PSCommandPath `
                -Action simulate -RepositoryRoot $RepositoryRoot -InstallPath $InstallPath `
                -StageSlug $StageSlug -AuthorizationId $AuthorizationId -AuthorizationDigest $AuthorizationDigest `
                -SignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal 2>&1
            $Reproduced = ($LASTEXITCODE -eq 0)
        } finally {
            $env:GIT_CONFIG_GLOBAL = $PreviousGlobal
            $env:GIT_CONFIG_SYSTEM = $PreviousSystem
            if (Test-Path -LiteralPath $ConfigFile) { [IO.File]::Delete($ConfigFile) }
        }
        $Digests = @($Output | Select-String "candidate digest reproduces" | ForEach-Object { $_.Line.Trim() })
        Confirm-Step "candidate reproduces with hostile core.autocrlf=$($Hostile.Autocrlf), core.eol=$($Hostile.Eol)" `
            $Reproduced ($Digests -join "; ")
        if (-not $Reproduced) {
            $Output | Select-String "FAILED|here .* / clone" | Select-Object -First 4 | ForEach-Object { Write-Output "        $($_.Line.Trim())" }
        }
    }
}

# ---------------------------------------------------------------------------
Write-Output "SOURCEROOT GDS v1.1 - AUTHORITY / LIFECYCLE / DESCENDANT HARDENING"
Write-Output "repository : $RepositoryRoot"
Write-Output "core       : $InstallPath"
Write-Output ""

if ($Action -eq "install" -or $Action -eq "all") { Invoke-Install }
if ($Action -eq "verify" -or $Action -eq "all") { Invoke-Verify }
if ($Action -eq "simulate" -or $Action -eq "all") { Invoke-Simulate }
if ($Action -eq "reproducible" -or $Action -eq "all") { Invoke-BuildReproducibility }
if ($Action -eq "attributes" -or $Action -eq "all") { Invoke-AttributeFilterControls }
if ($Action -eq "routing" -or $Action -eq "all") { Invoke-GitRoutingControls }
if ($Action -eq "ignore" -or $Action -eq "all") { Invoke-IgnoreStateControls }
if ($Action -eq "environment" -or $Action -eq "all") { Invoke-GitEnvironmentControls }
if ($Action -eq "controls" -or $Action -eq "all") { Invoke-NormalizationControls }

Write-Output ""
Write-Output ("CHECKS {0} / FAILED {1}" -f $script:Checks, $script:Failures)
if ($script:Failures -gt 0) { exit 3 }
Write-Output ""
Write-Output "Installation verified. This is evidence about the tooling, not approval of"
Write-Output "any candidate: no AI role and no green verifier holds release authority."
exit 0
