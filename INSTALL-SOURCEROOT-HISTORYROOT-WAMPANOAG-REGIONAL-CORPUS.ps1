<#
.SYNOPSIS
Backup-first installer for SourceRoot Chunk 9.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [string]$RepositoryPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Hash([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function Safe-Relative([string]$Path) {
    return -not (
        [string]::IsNullOrWhiteSpace($Path) -or
        [IO.Path]::IsPathRooted($Path) -or
        $Path.Replace("\", "/") -match '(^|/)\.{1,2}(/|$)'
    )
}
function Contained([string]$Root, [string]$Relative) {
    if (-not (Safe-Relative $Relative)) {
        throw "Unsafe repository-relative path: $Relative"
    }
    $Full = [IO.Path]::GetFullPath((Join-Path $Root ($Relative -replace "/", "\")))
    if (-not $Full.StartsWith($Root + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes repository: $Relative"
    }
    return $Full
}
function Write-Utf8([string]$Path, [string]$Text) {
    $Encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Text, $Encoding)
}

$ScriptRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
$PackageRoot = if ($PackagePath) {
    [IO.Path]::GetFullPath($PackagePath).TrimEnd("\", "/")
} elseif (Test-Path -LiteralPath (Join-Path $ScriptRoot "PACKAGE-MANIFEST.json")) {
    $ScriptRoot
} else {
    throw "PackagePath is required when the installer is not launched from a package folder."
}
$RepositoryRoot = if ($RepositoryPath) {
    [IO.Path]::GetFullPath($RepositoryPath).TrimEnd("\", "/")
} elseif (Test-Path -LiteralPath (Join-Path (Get-Location) "ROOT-MANIFEST.json")) {
    [IO.Path]::GetFullPath((Get-Location).Path).TrimEnd("\", "/")
} elseif (Test-Path -LiteralPath (Join-Path $ScriptRoot "ROOT-MANIFEST.json")) {
    $ScriptRoot
} else {
    throw "RepositoryPath is required when the repository cannot be discovered from the current location."
}
$BackendRoot = Join-Path $RepositoryRoot "backend"
$BackupRoot = ""

try {
    Write-Host "SourceRoot Chunk 9 regional corpus installer" -ForegroundColor Cyan
    Write-Host "Repository: $RepositoryRoot"
    Write-Host "Package:    $PackageRoot"

    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") -PathType Leaf)) {
        throw "Repository boundary validation failed."
    }
    if ($PackageRoot.Equals($RepositoryRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Package root must not be the repository root."
    }
    $ManifestPath = Join-Path $PackageRoot "PACKAGE-MANIFEST.json"
    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        throw "PACKAGE-MANIFEST.json is missing."
    }
    $Manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
    if (
        [string]$Manifest.schemaVersion -ne "1.0.0" -or
        [string]$Manifest.packageId -ne "SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1"
    ) {
        throw "Package identity or schema is invalid."
    }

    $Head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
    if ($Head -ne "7890995eafdb031230439c6f97750274273711ab") {
        throw "Repository HEAD is incompatible: $Head"
    }
    $Tag = (& git -C $RepositoryRoot rev-parse 'sourceroot-historyroot-corpus-expansion-quality-v1^{}').Trim()
    if ($Tag -ne "fefbe6fdded9c53fe27996cbaeb7980bca248f4c") {
        throw "Chunk 8 tag identity is incompatible."
    }
    $PriorZip = "C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1.zip"
    if ((Hash $PriorZip) -ne "B159BAD009FF65C500BE6B57889619E576A1C2729E4469C101E494A4D318784F") {
        throw "Chunk 8 release ZIP identity is incompatible."
    }

    $Migrations = @(Get-ChildItem -LiteralPath (Join-Path $BackendRoot "db\migrations") -File -Filter "*.sql")
    foreach ($Number in 1..12) {
        $Prefix = "{0:D3}_" -f $Number
        if (@($Migrations | Where-Object { $_.Name.StartsWith($Prefix) }).Count -eq 0) {
            throw "Migration $Prefix is missing."
        }
    }
    if (@($Migrations | Where-Object { $_.Name.StartsWith("013_") }).Count -gt 0) {
        throw "Migration 013 is prohibited."
    }

    $DatabaseLine = Get-Content -LiteralPath (Join-Path $BackendRoot ".env.test") |
        Where-Object { $_ -match '^DATABASE_URL=' } |
        Select-Object -First 1
    if (-not $DatabaseLine) { throw "DATABASE_URL is missing from backend/.env.test." }
    $DatabaseUrl = $DatabaseLine.Substring("DATABASE_URL=".Length).Trim().Trim('"')
    $DatabaseName = ([Uri]$DatabaseUrl).AbsolutePath.TrimStart("/")
    if ($DatabaseName -ne "sourceroot_test") {
        throw "Refusing database '$DatabaseName'; exactly sourceroot_test is required."
    }

    $Files = @($Manifest.files)
    $DuplicatePaths = @($Files | Group-Object path | Where-Object Count -gt 1)
    if ($DuplicatePaths.Count -gt 0) { throw "Duplicate package paths are prohibited." }
    foreach ($File in $Files) {
        $Relative = [string]$File.path
        if (-not (Safe-Relative $Relative)) { throw "Unsafe package path: $Relative" }
        $Source = [IO.Path]::GetFullPath((Join-Path $PackageRoot ($Relative -replace "/", "\")))
        if (-not $Source.StartsWith($PackageRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
            throw "Package path escapes the package root: $Relative"
        }
        if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
            throw "Declared payload is missing: $Relative"
        }
        if ((Hash $Source) -ne ([string]$File.sha256).ToUpperInvariant()) {
            throw "Payload hash mismatch: $Relative"
        }
        if ([string]$File.destination) {
            $null = Contained $RepositoryRoot ([string]$File.destination)
        }
    }
    $Declared = @("PACKAGE-MANIFEST.json") + @($Files | ForEach-Object { [string]$_.path })
    $Actual = @(Get-ChildItem -LiteralPath $PackageRoot -Recurse -File | ForEach-Object {
        $_.FullName.Substring($PackageRoot.Length + 1).Replace("\", "/")
    })
    $Extras = @($Actual | Where-Object { $Declared -notcontains $_ })
    if ($Extras.Count -gt 0) { throw "Package contains undeclared files: $($Extras -join ', ')" }

    $Stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $BackupRoot = Join-Path $RepositoryRoot "backups\sourceroot-historyroot-wampanoag-regional-corpus-v1-$Stamp"
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    $Installed = New-Object System.Collections.Generic.List[object]

    # Backup every existing destination before writing the first payload.
    foreach ($File in $Files | Where-Object { [string]$_.destination }) {
        $Relative = [string]$File.destination
        $Destination = Contained $RepositoryRoot $Relative
        if (Test-Path -LiteralPath $Destination -PathType Leaf) {
            $Backup = Join-Path $BackupRoot ($Relative -replace "/", "\")
            New-Item -ItemType Directory -Path (Split-Path -Parent $Backup) -Force | Out-Null
            Copy-Item -LiteralPath $Destination -Destination $Backup -Force
        }
    }

    foreach ($File in $Files | Where-Object { [string]$_.destination }) {
        $Source = Join-Path $PackageRoot ([string]$File.path -replace "/", "\")
        $Relative = [string]$File.destination
        $Destination = Contained $RepositoryRoot $Relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
        if ((Hash $Destination) -ne ([string]$File.sha256).ToUpperInvariant()) {
            throw "Installed byte verification failed: $Relative"
        }
        $Installed.Add([pscustomobject][ordered]@{
            destination = $Relative
            sha256 = Hash $Destination
        })
    }

    $RegenerationRoot = Join-Path ([IO.Path]::GetTempPath()) ("historyroot-chunk9-install-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $RegenerationRoot -Force | Out-Null
    Push-Location $BackendRoot
    try {
        & npm.cmd run historyroot:wampanoag-regional:generate -- --output-directory $RegenerationRoot
        if ($LASTEXITCODE -ne 0) { throw "Independent regeneration failed." }
        foreach ($Name in @(
            "expansion-workspace.json",
            "historyroot-wampanoag-regional-corpus-v1.bundle.json",
            "corpus-inventory.json",
            "quality-review.json",
            "quality-review.md"
        )) {
            $InstalledArtifact = Join-Path $BackendRoot "data\historyroot-wampanoag-regional-corpus-v1\$Name"
            if ((Hash (Join-Path $RegenerationRoot $Name)) -ne (Hash $InstalledArtifact)) {
                throw "Independent regeneration differs: $Name"
            }
        }
        & npm.cmd run historyroot:wampanoag-regional:import
        if ($LASTEXITCODE -ne 0) { throw "First replacement-safe import failed." }
        & npm.cmd run historyroot:wampanoag-regional:import
        if ($LASTEXITCODE -ne 0) { throw "Duplicate-safe reimport failed." }
    } finally {
        Pop-Location
    }

    & powershell.exe -NoProfile -ExecutionPolicy Bypass `
        -File (Join-Path $RepositoryRoot "VERIFY-SOURCEROOT-HISTORYROOT-WAMPANOAG-REGIONAL-CORPUS.ps1") `
        -RepositoryPath $RepositoryRoot `
        -PackagePath $PackageRoot `
        -SkipExecutableChecks
    $VerifierExitCode = $LASTEXITCODE
    if ($VerifierExitCode -ne 0) { throw "Installed Chunk 9 verifier failed." }

    $InstallationRecord = Join-Path $BackupRoot "installation-record.json"
    $Record = [ordered]@{
        schemaVersion = "1.0.0"
        packageId = [string]$Manifest.packageId
        installedAt = (Get-Date).ToUniversalTime().ToString("o")
        repositoryPath = $RepositoryRoot
        packagePath = $PackageRoot
        database = $DatabaseName
        canonicalBundleId = "historyroot-plymouth-knowledge-dataset-v1"
        datasetVersion = "1.3.0"
        backupPath = $BackupRoot
        installedFiles = @($Installed | ForEach-Object { $_ })
        regenerationVerified = $true
        replacementSafeImportVerified = $true
        duplicateSafeReimportVerified = $true
        verifierExitCode = $VerifierExitCode
    }
    Write-Utf8 $InstallationRecord (($Record | ConvertTo-Json -Depth 8) + "`n")
    Write-Host "Installer: PASS" -ForegroundColor Green
    Write-Host "Backup: $BackupRoot"
    Write-Host "Installation record: $InstallationRecord"
    exit 0
} catch {
    Write-Error $_.Exception.Message
    if ($BackupRoot) { Write-Host "Backup retained: $BackupRoot" }
    exit 1
}
