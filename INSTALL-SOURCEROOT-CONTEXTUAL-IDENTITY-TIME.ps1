[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",

    [Parameter()]
    [string]$PriorReleasePath = "C:\Users\Josh\Documents\SourceRoot-Releases"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$StageFolderName = "SourceRoot-Contextual-Identity-Time-Refinement-v1"
$NormalizedStageName = "sourceroot-contextual-identity-time-refinement-v1"
$VerifierName = "VERIFY-SOURCEROOT-CONTEXTUAL-IDENTITY-TIME.ps1"

function Stop-Install {
    param([string]$Message, [string]$BackupPath = "")
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    if ($BackupPath) {
        Write-Host "[INFO] Backup retained at: $BackupPath" -ForegroundColor Cyan
    }
    exit 1
}

function Resolve-PackageRoot {
    if (
        (Test-Path -LiteralPath (Join-Path $PSScriptRoot "manifest\stage-manifest.json") -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $PSScriptRoot "payload") -PathType Container)
    ) {
        return [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
    }
    $Nested = Join-Path $PSScriptRoot $StageFolderName
    if (
        (Test-Path -LiteralPath (Join-Path $Nested "manifest\stage-manifest.json") -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $Nested "payload") -PathType Container)
    ) {
        return [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Nested).Path).TrimEnd("\", "/")
    }
    throw "Could not locate the $StageFolderName package beside the installer."
}

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Stop-Install "Repository does not exist: $RepositoryPath"
}
$RepositoryRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepositoryPath).Path).TrimEnd("\", "/")

$RequiredMarkers = @(
    "backend\src\app.ts",
    "backend\package.json",
    "backend\.env.test",
    "backend\db\migrations\009_create_contextual_knowledge_foundation.sql",
    "backend\db\migrations\010_extend_contextual_governance.sql",
    "docs\build\CODEX-STAGE-CONTRACT.md",
    "docs\build\REGISTRY-API-CONTRACT.md",
    "docs\build\FRONTEND-API-OBSERVABILITY-CONTRACT.md",
    "VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1",
    "VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1",
    "VERIFY-SOURCEROOT-FRONTEND-API-OBSERVABILITY.ps1"
)
$MissingMarkers = @($RequiredMarkers | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $_) -PathType Leaf)
})
if ($MissingMarkers.Count -gt 0) {
    Stop-Install "Repository or Chunk 0-2 markers are missing: $($MissingMarkers -join ', ')"
}

$DatabaseLine = Get-Content -LiteralPath (Join-Path $RepositoryRoot "backend\.env.test") |
    Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
    Select-Object -First 1
try {
    $DatabaseUrl = ($DatabaseLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
    $DatabaseName = ([Uri]$DatabaseUrl).AbsolutePath.Trim("/")
} catch {
    Stop-Install "backend\.env.test does not contain a parseable DATABASE_URL."
}
if ($DatabaseName -ne "sourceroot_test") {
    Stop-Install "Refusing test migration: configured database is '$DatabaseName', not sourceroot_test."
}

try {
    $PackageRoot = Resolve-PackageRoot
    $ManifestPath = Join-Path $PackageRoot "manifest\stage-manifest.json"
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
} catch {
    Stop-Install "Package could not be validated: $($_.Exception.Message)"
}
if (
    $Manifest.stageName -ne "SourceRoot-Contextual-Identity-Time-Refinement" -or
    $Manifest.stageVersion -ne "v1" -or
    $Manifest.targetRepository -ne "dictionaryhub" -or
    $Manifest.requiredPreviousStage -ne "SourceRoot Chunk 2 - Shared Frontend API Layer, Logging, and Observability v1"
) {
    Stop-Install "Package manifest identity or prerequisite is incorrect."
}

$PayloadRoot = Join-Path $PackageRoot "payload"
$FilesAdded = @($Manifest.filesAdded)
$FilesReplaced = @($Manifest.filesReplaced)
$AllFiles = @($FilesAdded + $FilesReplaced)
if ($AllFiles.Count -eq 0 -or ($AllFiles | Select-Object -Unique).Count -ne $AllFiles.Count) {
    Stop-Install "Manifest payload lists are empty or contain duplicates."
}

$HashMap = @{}
foreach ($Entry in @($Manifest.payloadHashes)) {
    $HashMap[[string]$Entry.path] = ([string]$Entry.sha256).ToLowerInvariant()
}
foreach ($RelativePath in $AllFiles) {
    $Source = Join-Path $PayloadRoot ($RelativePath -replace '/', '\')
    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
        Stop-Install "Package payload is missing $RelativePath."
    }
    $Actual = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash.ToLowerInvariant()
    if (-not $HashMap.ContainsKey($RelativePath) -or $HashMap[$RelativePath] -ne $Actual) {
        Stop-Install "Payload hash validation failed for $RelativePath."
    }
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$BackupRoot = Join-Path $RepositoryRoot ("backups\" + $NormalizedStageName + "-" + $Timestamp)
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
$PreExistingAdded = [Collections.Generic.List[string]]::new()
$BackedUp = [Collections.Generic.List[string]]::new()
$InstalledHashes = [Collections.Generic.List[object]]::new()

try {
    foreach ($RelativePath in $AllFiles) {
        $NormalizedPath = $RelativePath -replace '/', '\'
        $Destination = [IO.Path]::GetFullPath((Join-Path $RepositoryRoot $NormalizedPath))
        if (-not $Destination.StartsWith($RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
            throw "Unsafe payload destination: $RelativePath"
        }
        if (Test-Path -LiteralPath $Destination -PathType Leaf) {
            $BackupFile = Join-Path $BackupRoot $NormalizedPath
            New-Item -ItemType Directory -Path (Split-Path -Parent $BackupFile) -Force | Out-Null
            Copy-Item -LiteralPath $Destination -Destination $BackupFile -Force
            $BackedUp.Add($RelativePath)
            if ($FilesAdded -contains $RelativePath) {
                $PreExistingAdded.Add($RelativePath)
            }
        }
    }

    foreach ($RelativePath in $AllFiles) {
        $NormalizedPath = $RelativePath -replace '/', '\'
        $Source = Join-Path $PayloadRoot $NormalizedPath
        $Destination = Join-Path $RepositoryRoot $NormalizedPath
        New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
        $Actual = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($Actual -ne $HashMap[$RelativePath]) {
            throw "Installed file hash mismatch: $RelativePath"
        }
        $InstalledHashes.Add([ordered]@{ path = $RelativePath; sha256 = $Actual })
    }
} catch {
    Stop-Install "Installation failed: $($_.Exception.Message)" $BackupRoot
}

$Record = [ordered]@{
    schemaVersion = "1.0"
    stageName = $Manifest.stageName
    stageVersion = $Manifest.stageVersion
    installedAt = (Get-Date).ToString("o")
    repositoryPath = $RepositoryRoot
    packagePath = $PackageRoot
    priorReleasePath = $PriorReleasePath
    backupPath = $BackupRoot
    addedFiles = $FilesAdded
    addedFilesPreExisting = $PreExistingAdded.ToArray()
    replacedFiles = $FilesReplaced
    backedUpFiles = $BackedUp.ToArray()
    payloadHashes = @($Manifest.payloadHashes)
    installedHashes = $InstalledHashes.ToArray()
    filesIntentionallyUntouched = @($Manifest.filesIntentionallyUntouched)
    rollbackInstructions = @($Manifest.rollbackInstructions)
}
$Record | ConvertTo-Json -Depth 10 |
    Set-Content -LiteralPath (Join-Path $BackupRoot "installation-record.json") -Encoding UTF8

Write-Host "SourceRoot Contextual Identity and Time Refinement v1 installation report" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"
Write-Host "Package:    $PackageRoot"
Write-Host "Backup:     $BackupRoot"
foreach ($RelativePath in $FilesAdded) { Write-Host "[ADDED] $RelativePath" -ForegroundColor Green }
foreach ($RelativePath in $FilesReplaced) { Write-Host "[REPLACED] $RelativePath" -ForegroundColor Yellow }
foreach ($Item in @($Manifest.filesIntentionallyUntouched)) { Write-Host "[UNTOUCHED] $Item" -ForegroundColor Cyan }

$PowerShell = Get-Command powershell.exe -ErrorAction SilentlyContinue
if ($null -eq $PowerShell) {
    Stop-Install "Windows PowerShell is unavailable; verification could not run." $BackupRoot
}
& $PowerShell.Source -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepositoryRoot $VerifierName) `
    -RepositoryPath $RepositoryRoot -PackagePath $PackageRoot -PriorReleasePath $PriorReleasePath
if ($LASTEXITCODE -ne 0) {
    Stop-Install "Stage verifier failed with exit code $LASTEXITCODE." $BackupRoot
}

Write-Host "[PASS] SourceRoot Contextual Identity and Time Refinement v1 installed and verified." -ForegroundColor Green
Write-Host "[INFO] Backup: $BackupRoot" -ForegroundColor Cyan
Write-Host "[INFO] Browser checks: not performed." -ForegroundColor Cyan
Write-Host "[INFO] Independent live API checks: not performed." -ForegroundColor Cyan
exit 0
