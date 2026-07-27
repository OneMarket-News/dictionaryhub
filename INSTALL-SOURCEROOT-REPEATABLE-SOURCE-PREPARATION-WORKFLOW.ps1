[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",

    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [string]$PriorReleasePath = "C:\Users\Josh\Documents\SourceRoot-Releases",

    [Parameter()]
    [string]$BackupStamp = "",

    [Parameter()]
    [switch]$ResumeAfterVerifiedRegression,

    [Parameter()]
    [switch]$ResumeAfterVerifiedNamedBaselines,

    [Parameter()]
    [switch]$ResumeAfterVerifiedImmutableReplay
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$PackageName = "SourceRoot-Repeatable-Source-Preparation-Workflow-v1"
$NormalizedName = "sourceroot-repeatable-source-preparation-workflow-v1"
$StartingCommit = "a933e45e8304209d25634837b90f7703119d94ff"
$Chunk6Commit = "276b448f4d41ec340ca120d69ca65007c932a2c0"
$Chunk6ZipHash = "D5F19A90EB697BDDB2D38BF12CDDBBB430029920E5B131762DD88B4ED735DCB9"

function Stop-Install {
    param([string]$Message, [string]$BackupPath = "")
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    if ($BackupPath) {
        Write-Host "[INFO] Backup retained at: $BackupPath" -ForegroundColor Cyan
    }
    exit 1
}

function Resolve-SafeRelativePath {
    param([string]$Root, [string]$RelativePath)
    $Normalized = $RelativePath.Replace("/", "\")
    if (
        [IO.Path]::IsPathRooted($Normalized) -or
        $Normalized -match '(^|\\)\.\.?($|\\)'
    ) {
        throw "Unsafe manifest path: $RelativePath"
    }
    $Full = [IO.Path]::GetFullPath((Join-Path $Root $Normalized))
    if (-not $Full.StartsWith($Root + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Manifest path escapes its root: $RelativePath"
    }
    return $Full
}

try {
    if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
        throw "Repository does not exist: $RepositoryPath"
    }
    $RepositoryRoot = [IO.Path]::GetFullPath(
        (Resolve-Path -LiteralPath $RepositoryPath).Path
    ).TrimEnd("\", "/")
    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") -PathType Leaf)) {
        throw "Repository boundary marker ROOT-MANIFEST.json is missing."
    }
    $PackageRoot = if ($PackagePath) {
        if (-not (Test-Path -LiteralPath $PackagePath -PathType Container)) {
            throw "Package does not exist: $PackagePath"
        }
        [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PackagePath).Path).TrimEnd("\", "/")
    } elseif (
        (Test-Path -LiteralPath (Join-Path $PSScriptRoot "package-manifest.json") -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $PSScriptRoot "payload") -PathType Container)
    ) {
        [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
    } else {
        $Candidate = Join-Path $PSScriptRoot $PackageName
        if (-not (Test-Path -LiteralPath (Join-Path $Candidate "package-manifest.json") -PathType Leaf)) {
            throw "Could not locate the $PackageName package."
        }
        [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Candidate).Path).TrimEnd("\", "/")
    }
    if ($PackageRoot -eq $RepositoryRoot) {
        throw "Package root may not be the repository root."
    }

    $DatabaseLine = Get-Content -LiteralPath (Join-Path $RepositoryRoot "backend\.env.test") |
        Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
        Select-Object -First 1
    $DatabaseUrl = ($DatabaseLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
    $DatabaseName = ([Uri]$DatabaseUrl).AbsolutePath.Trim("/")
    if ($DatabaseName -ne "sourceroot_test") {
        throw "Refusing installation: configured database is '$DatabaseName', not sourceroot_test."
    }

    $Git = (Get-Command git.exe -ErrorAction Stop).Source
    $Head = (& $Git -C $RepositoryRoot rev-parse HEAD).Trim()
    if ($Head -ne $StartingCommit) {
        throw "Starting checkpoint mismatch: $Head"
    }
    $TagType = (& $Git -C $RepositoryRoot cat-file -t sourceroot-historyroot-foundational-corpus-v1).Trim()
    $TagCommit = (& $Git -C $RepositoryRoot rev-parse "sourceroot-historyroot-foundational-corpus-v1^{}").Trim()
    if ($TagType -ne "tag" -or $TagCommit -ne $Chunk6Commit) {
        throw "Accepted Chunk 6 tag compatibility failed."
    }
    $Chunk6Zip = Join-Path $PriorReleasePath "SourceRoot-HistoryRoot-Foundational-Corpus-v1.zip"
    if (
        -not (Test-Path -LiteralPath $Chunk6Zip -PathType Leaf) -or
        (Get-FileHash -Algorithm SHA256 -LiteralPath $Chunk6Zip).Hash -ne $Chunk6ZipHash
    ) {
        throw "Accepted Chunk 6 ZIP is missing or has the wrong SHA-256."
    }
    $Migrations = @(
        Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "backend\db\migrations") -File |
            Select-Object -ExpandProperty Name
    )
    foreach ($Number in 1..12) {
        $Prefix = "{0:D3}_" -f $Number
        if (@($Migrations | Where-Object { $_.StartsWith($Prefix) }).Count -eq 0) {
            throw "Migration $Number is missing."
        }
    }
    if (@($Migrations | Where-Object { $_ -match '^013_' }).Count -gt 0) {
        throw "Migration 013 is forbidden."
    }

    $ManifestPath = Join-Path $PackageRoot "package-manifest.json"
    $Manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
    if (
        [string]$Manifest.schemaVersion -ne "1.0.0" -or
        [string]$Manifest.packageName -ne $PackageName -or
        [string]$Manifest.startingCommit -ne $StartingCommit
    ) {
        throw "Package manifest identity or checkpoint is invalid."
    }
    $Entries = @($Manifest.files)
    if ($Entries.Count -eq 0) { throw "Package manifest has no payload files." }
    $Duplicates = @($Entries.path | Group-Object | Where-Object Count -gt 1)
    if ($Duplicates.Count -gt 0) {
        throw "Duplicate manifest paths: $($Duplicates.Name -join ', ')"
    }
    foreach ($Entry in $Entries) {
        $Source = Resolve-SafeRelativePath (Join-Path $PackageRoot "payload") ([string]$Entry.path)
        if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
            throw "Declared payload is missing: $($Entry.path)"
        }
        $Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Source).Hash
        if ($Hash -ne [string]$Entry.sha256) {
            throw "Payload hash mismatch: $($Entry.path)"
        }
        if ((Get-Item -LiteralPath $Source).Length -ne [long]$Entry.size) {
            throw "Payload size mismatch: $($Entry.path)"
        }
    }

    if (-not $BackupStamp) {
        $BackupStamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    }
    if ($BackupStamp -notmatch '^[A-Za-z0-9_-]+$') {
        throw "BackupStamp contains unsafe characters."
    }
    $BackupRoot = Join-Path $RepositoryRoot "backups\$NormalizedName-$BackupStamp"
    if (Test-Path -LiteralPath $BackupRoot) {
        throw "Backup path already exists: $BackupRoot"
    }
    New-Item -ItemType Directory -Path $BackupRoot | Out-Null

    $Installed = New-Object System.Collections.Generic.List[object]
    foreach ($Entry in $Entries) {
        $Relative = [string]$Entry.path
        $Source = Resolve-SafeRelativePath (Join-Path $PackageRoot "payload") $Relative
        $Destination = Resolve-SafeRelativePath $RepositoryRoot $Relative
        $Existed = Test-Path -LiteralPath $Destination -PathType Leaf
        if ($Existed) {
            $BackupFile = Resolve-SafeRelativePath $BackupRoot $Relative
            $BackupDirectory = Split-Path -Parent $BackupFile
            if (-not (Test-Path -LiteralPath $BackupDirectory -PathType Container)) {
                New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
            }
            Copy-Item -LiteralPath $Destination -Destination $BackupFile -Force
        }
        $DestinationDirectory = Split-Path -Parent $Destination
        if (-not (Test-Path -LiteralPath $DestinationDirectory -PathType Container)) {
            New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
        }
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
        $InstalledHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Destination).Hash
        if ($InstalledHash -ne [string]$Entry.sha256) {
            throw "Installed byte verification failed: $Relative"
        }
        $Installed.Add([ordered]@{
            path = $Relative
            replaced = $Existed
            sha256 = $InstalledHash
        })
    }

    $PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
    $Verifier = Join-Path $RepositoryRoot "VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW.ps1"
    $VerifierArguments = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $Verifier,
        "-RepositoryPath", $RepositoryRoot,
        "-PackagePath", $PackageRoot,
        "-PriorReleasePath", $PriorReleasePath
    )
    if ($ResumeAfterVerifiedRegression) {
        $VerifierArguments += "-SkipRegression"
    }
    if ($ResumeAfterVerifiedNamedBaselines) {
        $VerifierArguments += "-ResumeAfterVerifiedNamedBaselines"
    }
    if ($ResumeAfterVerifiedImmutableReplay) {
        $VerifierArguments += "-SkipImmutableReplay"
    }
    & $PowerShell @VerifierArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Complete Chunk 7 verifier failed with exit $LASTEXITCODE."
    }

    $Record = [ordered]@{
        schemaVersion = "1.0.0"
        packageName = $PackageName
        installedAt = (Get-Date).ToString("o")
        repositoryPath = $RepositoryRoot
        packagePath = $PackageRoot
        databaseName = $DatabaseName
        startingCommit = $StartingCommit
        backupPath = $BackupRoot
        files = @($Installed | ForEach-Object { $_ })
        verifierExitCode = 0
        resumedAfterVerifiedRegression = [bool]$ResumeAfterVerifiedRegression
        resumedAfterVerifiedNamedBaselines = [bool]$ResumeAfterVerifiedNamedBaselines
        resumedAfterVerifiedImmutableReplay = [bool]$ResumeAfterVerifiedImmutableReplay
        gitOperationsPerformed = $false
        automaticImportPerformed = $false
    }
    $RecordPath = Join-Path $BackupRoot "installation-record.json"
    $Encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText(
        $RecordPath,
        (($Record | ConvertTo-Json -Depth 8) + "`n"),
        $Encoding
    )
    Write-Host "[PASS] SourceRoot repeatable source preparation workflow installed and verified." -ForegroundColor Green
    Write-Host "[INFO] Backup path: $BackupRoot" -ForegroundColor Cyan
    Write-Host "[INFO] Installation record: $RecordPath" -ForegroundColor Cyan
    exit 0
} catch {
    Stop-Install $_.Exception.Message $(if ($null -ne (Get-Variable BackupRoot -ErrorAction SilentlyContinue)) { $BackupRoot } else { "" })
}
