<#
.SYNOPSIS
Installs SourceRoot Chunk 8 into the checked-out repository and imports only
into sourceroot_test.

.PARAMETER PackagePath
Package folder containing PACKAGE-MANIFEST.json and declared payloads.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string]$PackagePath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Hash([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function Safe-Relative([string]$Path) {
    if (
        [string]::IsNullOrWhiteSpace($Path) -or
        [IO.Path]::IsPathRooted($Path) -or
        $Path.Replace("\", "/") -match '(^|/)\.{1,2}(/|$)'
    ) {
        return $false
    }
    return $true
}
function Contained-Path([string]$Root, [string]$Relative) {
    if (-not (Safe-Relative $Relative)) {
        throw "Unsafe repository-relative destination: $Relative"
    }
    $Full = [IO.Path]::GetFullPath((Join-Path $Root ($Relative -replace "/", "\")))
    if (-not $Full.StartsWith($Root + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Destination escapes repository: $Relative"
    }
    return $Full
}
function Write-Utf8([string]$Path, [string]$Text) {
    $Encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Text, $Encoding)
}

$ScriptRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
$RunsFromPackage = Test-Path -LiteralPath (Join-Path $ScriptRoot "PACKAGE-MANIFEST.json") -PathType Leaf
$RepositoryRoot = if ($RunsFromPackage) {
    [IO.Path]::GetFullPath((Join-Path $ScriptRoot "..")).TrimEnd("\", "/")
} else {
    $ScriptRoot
}
$PackageRoot = if ($PackagePath) {
    [IO.Path]::GetFullPath($PackagePath).TrimEnd("\", "/")
} elseif ($RunsFromPackage) {
    $ScriptRoot
} else {
    Join-Path $RepositoryRoot "SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1"
}
$BackendRoot = Join-Path $RepositoryRoot "backend"
$ReleaseRoot = "C:\Users\Josh\Documents\SourceRoot-Releases"
$BackupRoot = ""
$InstallationRecord = ""

try {
    Write-Host "SourceRoot HistoryRoot corpus expansion installer v1" -ForegroundColor Cyan
    Write-Host "Repository: $RepositoryRoot"
    Write-Host "Package:    $PackageRoot"

    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") -PathType Leaf)) {
        throw "Repository boundary validation failed."
    }
    if (-not $PackageRoot.StartsWith($RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Package must be inside the checked-out repository."
    }
    $ManifestPath = Join-Path $PackageRoot "PACKAGE-MANIFEST.json"
    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        throw "Package manifest is missing."
    }
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    if (
        [string]$Manifest.packageId -ne "SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1" -or
        [string]$Manifest.schemaVersion -ne "1.0.0"
    ) {
        throw "Package identity or schema version is invalid."
    }

    $V11 = (& git -C $RepositoryRoot rev-parse 'sourceroot-repeatable-source-preparation-workflow-v1.1^{}').Trim()
    $V1 = (& git -C $RepositoryRoot rev-parse 'sourceroot-repeatable-source-preparation-workflow-v1^{}').Trim()
    if ($V11 -ne "95b90865abf21cefefc5c608d778327737e997ac") {
        throw "v1.1 maintenance tag identity is incompatible."
    }
    if ($V1 -ne "7eef6b27f5c97a3e0de82a457ca06c828f9fe3df") {
        throw "Original Chunk 7 tag identity is incompatible."
    }
    if ((Hash (Join-Path $ReleaseRoot "SourceRoot-Repeatable-Source-Preparation-Workflow-v1.1.zip")) -ne "4EC0688F43D8EC94579167AB60F84FF499790B41C26FCF4C92E93F328C2778B1") {
        throw "v1.1 maintenance ZIP identity is incompatible."
    }
    if ((Hash (Join-Path $ReleaseRoot "SourceRoot-Repeatable-Source-Preparation-Workflow-v1.zip")) -ne "018E8463542EE33A20CB24545B4D64E1BC0F8E9C1701E55EFE01D20AA15C39DC") {
        throw "Original Chunk 7 ZIP identity is incompatible."
    }
    if ((Hash (Join-Path $BackendRoot "data\historyroot-foundational-corpus-v1\historyroot-foundational-corpus-v1.bundle.json")) -ne "D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F") {
        throw "Accepted Chunk 6 bundle changed."
    }

    $Migrations = @(Get-ChildItem -LiteralPath (Join-Path $BackendRoot "db\migrations") -File -Filter "*.sql")
    foreach ($Number in 1..12) {
        $Prefix = "{0:D3}_" -f $Number
        if (@($Migrations | Where-Object { $_.Name.StartsWith($Prefix) }).Count -eq 0) {
            throw "Migration $("{0:D3}" -f $Number) is missing."
        }
    }
    if (@($Migrations | Where-Object { $_.Name.StartsWith("013_") }).Count -gt 0) {
        throw "Migration 013 is prohibited."
    }

    $DatabaseLine = Get-Content -LiteralPath (Join-Path $BackendRoot ".env.test") |
        Where-Object { $_ -match '^DATABASE_URL=' } |
        Select-Object -First 1
    if (-not $DatabaseLine) {
        throw "DATABASE_URL is missing from backend/.env.test."
    }
    $DatabaseUrl = $DatabaseLine.Substring("DATABASE_URL=".Length).Trim().Trim('"')
    $DatabaseName = ([Uri]$DatabaseUrl).AbsolutePath.TrimStart("/")
    if ($DatabaseName -ne "sourceroot_test") {
        throw "Refusing database '$DatabaseName'; exactly sourceroot_test is required."
    }

    $Files = @($Manifest.files)
    $Duplicates = @($Files | Group-Object path | Where-Object { $_.Count -gt 1 })
    if ($Duplicates.Count -gt 0) {
        throw "Package manifest contains duplicate paths."
    }
    foreach ($File in $Files) {
        $Relative = [string]$File.path
        if (-not (Safe-Relative $Relative)) {
            throw "Unsafe package path: $Relative"
        }
        $Source = [IO.Path]::GetFullPath((Join-Path $PackageRoot ($Relative -replace "/", "\")))
        if (-not $Source.StartsWith($PackageRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
            throw "Package path escapes package root: $Relative"
        }
        if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
            throw "Declared package file is missing: $Relative"
        }
        if ((Hash $Source) -ne ([string]$File.sha256).ToUpperInvariant()) {
            throw "Package payload hash mismatch: $Relative"
        }
        if ([string]$File.destination) {
            $null = Contained-Path $RepositoryRoot ([string]$File.destination)
        }
    }

    $Actual = @(Get-ChildItem -LiteralPath $PackageRoot -Recurse -File | ForEach-Object {
        $_.FullName.Substring($PackageRoot.Length + 1).Replace("\", "/")
    })
    $Declared = @("PACKAGE-MANIFEST.json") + @($Files | ForEach-Object { [string]$_.path })
    $Extras = @($Actual | Where-Object { $Declared -notcontains $_ })
    if ($Extras.Count -gt 0) {
        throw "Package contains undeclared files: $($Extras -join ', ')"
    }

    $Stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $BackupRoot = Join-Path $RepositoryRoot "backups\sourceroot-historyroot-corpus-expansion-quality-v1-$Stamp"
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    $Installed = New-Object System.Collections.Generic.List[object]
    foreach ($File in $Files | Where-Object { [string]$_.destination }) {
        $Source = Join-Path $PackageRoot ([string]$File.path -replace "/", "\")
        $DestinationRelative = [string]$File.destination
        $Destination = Contained-Path $RepositoryRoot $DestinationRelative
        if (Test-Path -LiteralPath $Destination -PathType Leaf) {
            $Backup = Join-Path $BackupRoot ($DestinationRelative -replace "/", "\")
            $BackupDirectory = Split-Path -Parent $Backup
            New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
            Copy-Item -LiteralPath $Destination -Destination $Backup -Force
        }
        $DestinationDirectory = Split-Path -Parent $Destination
        New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
        if ((Hash $Destination) -ne ([string]$File.sha256).ToUpperInvariant()) {
            throw "Installed-byte verification failed: $DestinationRelative"
        }
        $Installed.Add([pscustomobject][ordered]@{
            destination = $DestinationRelative
            sha256 = Hash $Destination
        })
    }

    $RegenerationRoot = Join-Path ([IO.Path]::GetTempPath()) ("historyroot-chunk8-install-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $RegenerationRoot -Force | Out-Null
    Push-Location $BackendRoot
    try {
        & npm.cmd run historyroot:expansion:generate -- --output-directory $RegenerationRoot
        if ($LASTEXITCODE -ne 0) { throw "Independent generation failed." }
        foreach ($Name in @(
            "historyroot-corpus-expansion-quality-v1.bundle.json",
            "corpus-inventory.json",
            "quality-review.json",
            "quality-review.md"
        )) {
            if ((Hash (Join-Path $RegenerationRoot $Name)) -ne (Hash (Join-Path $BackendRoot "data\historyroot-corpus-expansion-quality-v1\$Name"))) {
                throw "Independent regeneration differs: $Name"
            }
        }
        & npm.cmd run historyroot:expansion:import
        if ($LASTEXITCODE -ne 0) { throw "Expanded corpus import failed." }
    } finally {
        Pop-Location
    }

    & powershell.exe -NoProfile -ExecutionPolicy Bypass `
        -File (Join-Path $RepositoryRoot "VERIFY-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1")
    if ($LASTEXITCODE -ne 0) {
        throw "Installed Chunk 8 verifier failed."
    }

    $InstallationRecord = Join-Path $BackupRoot "installation-record.json"
    $Record = [ordered]@{
        schemaVersion = "1.0.0"
        packageId = [string]$Manifest.packageId
        installedAt = [DateTimeOffset]::Now.ToString("o")
        repository = $RepositoryRoot
        database = "sourceroot_test"
        backupPath = $BackupRoot
        installedFiles = @($Installed | ForEach-Object { $_ })
        bundleId = "historyroot-plymouth-knowledge-dataset-v1"
        bundleVersion = "1.2.0"
        verifierExitCode = 0
        gitOperationPerformed = $false
    }
    Write-Utf8 $InstallationRecord (($Record | ConvertTo-Json -Depth 10) + "`r`n")

    Write-Host "[PASS] SourceRoot Chunk 8 installed." -ForegroundColor Green
    Write-Host "[INFO] Backup path: $BackupRoot" -ForegroundColor Cyan
    Write-Host "[INFO] Installation record: $InstallationRecord" -ForegroundColor Cyan
    Write-Host "[INFO] sourceroot_test now contains the accepted Chunk 8 replacement state." -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    if ($BackupRoot) { Write-Host "[INFO] Backup path: $BackupRoot" -ForegroundColor Cyan }
    if ($InstallationRecord) { Write-Host "[INFO] Installation record: $InstallationRecord" -ForegroundColor Cyan }
    exit 1
}
