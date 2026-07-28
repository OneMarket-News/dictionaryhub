[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",

    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [string]$PriorReleasePath = "C:\Users\Josh\Documents\SourceRoot-Releases",

    [Parameter()]
    [string]$BackupStamp = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$PackageName = "SourceRoot-Repeatable-Source-Preparation-Workflow-v1.1"
$NormalizedName = "sourceroot-repeatable-source-preparation-workflow-v1-1"
$StartingCommit = "7eef6b27f5c97a3e0de82a457ca06c828f9fe3df"
$Chunk7ZipHash = "018E8463542EE33A20CB24545B4D64E1BC0F8E9C1701E55EFE01D20AA15C39DC"
$Chunk6BundleHash = "D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F"

function Resolve-SafeRelativePath {
    param([string]$Root, [string]$RelativePath)
    $Normalized = $RelativePath.Replace("/", "\")
    if ([IO.Path]::IsPathRooted($Normalized) -or $Normalized -match '(^|\\)\.\.?($|\\)') {
        throw "Unsafe manifest path: $RelativePath"
    }
    $Full = [IO.Path]::GetFullPath((Join-Path $Root $Normalized))
    $Boundary = [IO.Path]::GetFullPath($Root).TrimEnd("\", "/") + "\"
    if (-not $Full.StartsWith($Boundary, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Manifest path escapes root: $RelativePath"
    }
    return $Full
}

try {
    $RepositoryRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepositoryPath).Path).TrimEnd("\", "/")
    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") -PathType Leaf)) {
        throw "Repository boundary marker ROOT-MANIFEST.json is missing."
    }
    $PackageRoot = if ($PackagePath) {
        [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PackagePath).Path).TrimEnd("\", "/")
    } elseif ((Test-Path -LiteralPath (Join-Path $PSScriptRoot "package-manifest.json") -PathType Leaf)) {
        [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
    } else {
        [IO.Path]::GetFullPath((Resolve-Path -LiteralPath (Join-Path $PSScriptRoot $PackageName)).Path).TrimEnd("\", "/")
    }
    if ($PackageRoot -eq $RepositoryRoot) { throw "Package root may not be the repository root." }

    $DatabaseLine = Get-Content -LiteralPath (Join-Path $RepositoryRoot "backend\.env.test") |
        Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    $DatabaseUrl = ($DatabaseLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
    $DatabaseName = ([Uri]$DatabaseUrl).AbsolutePath.Trim("/")
    if ($DatabaseName -ne "sourceroot_test") {
        throw "Refusing installation: configured database is '$DatabaseName', not sourceroot_test."
    }

    $Git = (Get-Command git.exe -ErrorAction Stop).Source
    $Head = (& $Git -C $RepositoryRoot rev-parse HEAD).Trim()
    if ($Head -ne $StartingCommit) { throw "Starting checkpoint mismatch: $Head" }
    $TagType = (& $Git -C $RepositoryRoot cat-file -t sourceroot-repeatable-source-preparation-workflow-v1).Trim()
    $TagCommit = (& $Git -C $RepositoryRoot rev-parse "sourceroot-repeatable-source-preparation-workflow-v1^{}").Trim()
    if ($TagType -ne "tag" -or $TagCommit -ne $StartingCommit) { throw "Accepted Chunk 7 tag compatibility failed." }
    $Chunk7Zip = Join-Path $PriorReleasePath "SourceRoot-Repeatable-Source-Preparation-Workflow-v1.zip"
    if (-not (Test-Path -LiteralPath $Chunk7Zip -PathType Leaf) -or
        (Get-FileHash -Algorithm SHA256 -LiteralPath $Chunk7Zip).Hash -ne $Chunk7ZipHash) {
        throw "Accepted Chunk 7 ZIP is missing or has the wrong SHA-256."
    }
    $Chunk6Bundle = Join-Path $RepositoryRoot "backend\data\historyroot-foundational-corpus-v1\historyroot-foundational-corpus-v1.bundle.json"
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Chunk6Bundle).Hash -ne $Chunk6BundleHash) {
        throw "Accepted Chunk 6 bundle hash is invalid."
    }
    $Migrations = @(Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "backend\db\migrations") -File | Select-Object -ExpandProperty Name)
    foreach ($Number in 1..12) {
        $Prefix = "{0:D3}_" -f $Number
        if (@($Migrations | Where-Object { $_.StartsWith($Prefix) }).Count -eq 0) { throw "Migration $Number is missing." }
    }
    if (@($Migrations | Where-Object { $_ -match '^013_' }).Count -gt 0) { throw "Migration 013 is forbidden." }
    if (@(& $Git -C $RepositoryRoot diff --name-only $StartingCommit -- backend/db/migrations).Count -gt 0) {
        throw "Accepted migrations changed."
    }

    $Manifest = Get-Content -Raw -LiteralPath (Join-Path $PackageRoot "package-manifest.json") | ConvertFrom-Json
    if ([string]$Manifest.schemaVersion -ne "1.1.0" -or
        [string]$Manifest.packageName -ne $PackageName -or
        [string]$Manifest.startingCommit -ne $StartingCommit) {
        throw "Package manifest identity or checkpoint is invalid."
    }
    $Entries = @($Manifest.files)
    if ($Entries.Count -eq 0) { throw "Package manifest has no payload files." }
    if (@($Entries.path | Group-Object | Where-Object Count -gt 1).Count -gt 0) { throw "Duplicate manifest paths." }
    foreach ($Entry in $Entries) {
        $Source = Resolve-SafeRelativePath (Join-Path $PackageRoot "payload") ([string]$Entry.path)
        if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw "Declared payload is missing: $($Entry.path)" }
        if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Source).Hash -ne [string]$Entry.sha256 -or
            (Get-Item -LiteralPath $Source).Length -ne [long]$Entry.size) {
            throw "Payload hash or size mismatch: $($Entry.path)"
        }
    }

    if (-not $BackupStamp) { $BackupStamp = Get-Date -Format "yyyyMMdd-HHmmss-fff" }
    if ($BackupStamp -notmatch '^[A-Za-z0-9_-]+$') { throw "BackupStamp contains unsafe characters." }
    $BackupRoot = Join-Path $RepositoryRoot "backups\$NormalizedName-$BackupStamp"
    if (Test-Path -LiteralPath $BackupRoot) { throw "Backup path already exists: $BackupRoot" }
    New-Item -ItemType Directory -Path $BackupRoot | Out-Null
    $Installed = New-Object System.Collections.Generic.List[object]
    foreach ($Entry in $Entries) {
        $Relative = [string]$Entry.path
        $Source = Resolve-SafeRelativePath (Join-Path $PackageRoot "payload") $Relative
        $Destination = Resolve-SafeRelativePath $RepositoryRoot $Relative
        $Existed = Test-Path -LiteralPath $Destination -PathType Leaf
        if ($Existed) {
            $BackupFile = Resolve-SafeRelativePath $BackupRoot $Relative
            New-Item -ItemType Directory -Path (Split-Path -Parent $BackupFile) -Force | Out-Null
            Copy-Item -LiteralPath $Destination -Destination $BackupFile -Force
        }
        New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
        $InstalledHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Destination).Hash
        if ($InstalledHash -ne [string]$Entry.sha256) { throw "Installed byte verification failed: $Relative" }
        $Installed.Add([ordered]@{ path = $Relative; replaced = $Existed; sha256 = $InstalledHash })
    }

    $PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
    & $PowerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepositoryRoot "VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1") `
        -RepositoryPath $RepositoryRoot -PackagePath $PackageRoot -PriorReleasePath $PriorReleasePath
    if ($LASTEXITCODE -ne 0) { throw "Maintenance verifier failed with exit $LASTEXITCODE." }

    $Record = [ordered]@{
        schemaVersion = "1.1.0"
        packageName = $PackageName
        installedAt = (Get-Date).ToString("o")
        repositoryPath = $RepositoryRoot
        packagePath = $PackageRoot
        databaseName = $DatabaseName
        startingCommit = $StartingCommit
        acceptedChunk6BundleSha256 = $Chunk6BundleHash
        backupPath = $BackupRoot
        files = @($Installed | ForEach-Object { $_ })
        verifierExitCode = 0
        databaseState = "accepted Chunk 6"
        gitOperationsPerformed = $false
        automaticImportOutsideTestsPerformed = $false
    }
    $RecordPath = Join-Path $BackupRoot "installation-record.json"
    $Encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($RecordPath, (($Record | ConvertTo-Json -Depth 8) + "`n"), $Encoding)
    Write-Host "[PASS] SourceRoot lossless context preparation support installed and verified." -ForegroundColor Green
    Write-Host "[INFO] Backup path: $BackupRoot" -ForegroundColor Cyan
    Write-Host "[INFO] Installation record: $RecordPath" -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    if ($null -ne (Get-Variable BackupRoot -ErrorAction SilentlyContinue)) {
        Write-Host "[INFO] Backup retained at: $BackupRoot" -ForegroundColor Cyan
    }
    exit 1
}
