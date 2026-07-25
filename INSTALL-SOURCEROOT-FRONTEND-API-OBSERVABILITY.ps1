[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$StageFolderName = "SourceRoot-Frontend-API-Observability-v1"
$NormalizedStageName = "sourceroot-frontend-api-observability-v1"
$DefaultRepository = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
$VerifierName = "VERIFY-SOURCEROOT-FRONTEND-API-OBSERVABILITY.ps1"

function Fail-Installation {
    param([string]$Message, [string]$BackupPath = "")
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    if (-not [string]::IsNullOrWhiteSpace($BackupPath)) {
        Write-Host "[INFO] Backup retained at: $BackupPath" -ForegroundColor Cyan
    }
    exit 1
}

function Resolve-PackageRoot {
    $DirectManifest = Join-Path $PSScriptRoot "manifest\stage-manifest.json"
    $DirectPayload = Join-Path $PSScriptRoot "payload"
    if (
        (Test-Path -LiteralPath $DirectManifest -PathType Leaf) -and
        (Test-Path -LiteralPath $DirectPayload -PathType Container)
    ) {
        return [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
    }

    $Nested = Join-Path $PSScriptRoot $StageFolderName
    if (
        (Test-Path -LiteralPath (Join-Path $Nested "manifest\stage-manifest.json") -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $Nested "payload") -PathType Container)
    ) {
        return [System.IO.Path]::GetFullPath(
            (Resolve-Path -LiteralPath $Nested).Path
        ).TrimEnd("\", "/")
    }
    throw "Could not locate the $StageFolderName package beside the installer."
}

if ([string]::IsNullOrWhiteSpace($RepositoryPath)) {
    $RepositoryPath = $DefaultRepository
}
if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Fail-Installation "Repository does not exist: $RepositoryPath"
}
$RepositoryRoot = [System.IO.Path]::GetFullPath(
    (Resolve-Path -LiteralPath $RepositoryPath).Path
).TrimEnd("\", "/")

$RequiredRepositoryMarkers = @(
    "backend\src\app.ts",
    "backend\package.json",
    "index.html",
    "config\customers\dictionaryroot.json",
    "docs\build\CODEX-STAGE-CONTRACT.md",
    "docs\build\CURRENT-SOURCEROOT-STATE.md",
    "docs\build\STAGE-PACKAGE-STANDARD.md",
    "docs\build\AGENT-SAFETY-BASELINE.md",
    "docs\build\REGISTRY-API-CONTRACT.md",
    "docs\build\registry-api-contract-stage.md",
    "VERIFY-SOURCEROOT-BASELINE.ps1",
    "VERIFY-DICTIONARYROOT-BASELINE.ps1",
    "VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1",
    "VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1"
)
$MissingMarkers = @(
    $RequiredRepositoryMarkers | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $_) -PathType Leaf)
    }
)
if ($MissingMarkers.Count -gt 0) {
    Fail-Installation "Repository, Chunk 0, or Chunk 1 markers are missing: $($MissingMarkers -join ', ')"
}

try {
    $PackageRoot = Resolve-PackageRoot
} catch {
    Fail-Installation $_.Exception.Message
}
$ManifestPath = Join-Path $PackageRoot "manifest\stage-manifest.json"
try {
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
} catch {
    Fail-Installation "Package manifest is invalid JSON: $($_.Exception.Message)"
}
if (
    $Manifest.stageName -ne "SourceRoot-Frontend-API-Observability" -or
    $Manifest.stageVersion -ne "v1" -or
    $Manifest.targetRepository -ne "dictionaryhub"
) {
    Fail-Installation "Package manifest identity does not match SourceRoot Frontend API and Observability v1."
}

$PayloadRoot = Join-Path $PackageRoot "payload"
$FilesAdded = @($Manifest.filesAdded)
$FilesReplaced = @($Manifest.filesReplaced)
$AllPayloadFiles = $FilesAdded + $FilesReplaced
if ($AllPayloadFiles.Count -eq 0) {
    Fail-Installation "Package manifest does not list payload files."
}
$MissingPayload = @(
    $AllPayloadFiles | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $PayloadRoot ($_ -replace '/', '\')) -PathType Leaf)
    }
)
if ($MissingPayload.Count -gt 0) {
    Fail-Installation "Package payload is incomplete: $($MissingPayload -join ', ')"
}

$HashMap = @{}
foreach ($HashEntry in @($Manifest.payloadHashes)) {
    $HashMap[[string]$HashEntry.path] = ([string]$HashEntry.sha256).ToLowerInvariant()
}
foreach ($RelativePath in $AllPayloadFiles) {
    $SourcePath = Join-Path $PayloadRoot ($RelativePath -replace '/', '\')
    $ActualHash = (Get-FileHash -LiteralPath $SourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if (-not $HashMap.ContainsKey($RelativePath) -or $HashMap[$RelativePath] -ne $ActualHash) {
        Fail-Installation "Payload hash validation failed for $RelativePath."
    }
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$BackupRoot = Join-Path $RepositoryRoot ("backups\" + $NormalizedStageName + "-" + $Timestamp)
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
$PreExistingAddedFiles = New-Object System.Collections.Generic.List[string]
$BackedUpFiles = New-Object System.Collections.Generic.List[string]

try {
    foreach ($RelativePath in $AllPayloadFiles) {
        $NormalizedRelativePath = $RelativePath -replace '/', '\'
        $DestinationPath = [System.IO.Path]::GetFullPath(
            (Join-Path $RepositoryRoot $NormalizedRelativePath)
        )
        if (-not $DestinationPath.StartsWith($RepositoryRoot + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Unsafe payload destination: $RelativePath"
        }
        if (Test-Path -LiteralPath $DestinationPath -PathType Leaf) {
            $BackupPath = Join-Path $BackupRoot $NormalizedRelativePath
            $BackupDirectory = Split-Path -Parent $BackupPath
            New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
            Copy-Item -LiteralPath $DestinationPath -Destination $BackupPath -Force
            $BackedUpFiles.Add($RelativePath)
            if ($FilesAdded -contains $RelativePath) {
                $PreExistingAddedFiles.Add($RelativePath)
            }
        }
    }

    foreach ($RelativePath in $AllPayloadFiles) {
        $NormalizedRelativePath = $RelativePath -replace '/', '\'
        $SourcePath = Join-Path $PayloadRoot $NormalizedRelativePath
        $DestinationPath = Join-Path $RepositoryRoot $NormalizedRelativePath
        $DestinationDirectory = Split-Path -Parent $DestinationPath
        New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
        Copy-Item -LiteralPath $SourcePath -Destination $DestinationPath -Force
        $InstalledHash = (Get-FileHash -LiteralPath $DestinationPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($InstalledHash -ne $HashMap[$RelativePath]) {
            throw "Installed file hash mismatch: $RelativePath"
        }
    }
} catch {
    Fail-Installation "Installation failed: $($_.Exception.Message)" $BackupRoot
}

$InstallationRecord = [ordered]@{
    schemaVersion = "1.0"
    stageName = $Manifest.stageName
    stageVersion = $Manifest.stageVersion
    installedAt = (Get-Date).ToString("o")
    repositoryPath = $RepositoryRoot
    packagePath = $PackageRoot
    backupPath = $BackupRoot
    addedFiles = $FilesAdded
    addedFilesPreExisting = $PreExistingAddedFiles.ToArray()
    replacedFiles = $FilesReplaced
    backedUpFiles = $BackedUpFiles.ToArray()
    filesIntentionallyUntouched = @($Manifest.filesIntentionallyUntouched)
}
$InstallationRecord | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $BackupRoot "installation-record.json") -Encoding UTF8

Write-Host ""
Write-Host "SourceRoot Frontend API and Observability v1 installation report" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"
Write-Host "Package:    $PackageRoot"
Write-Host "Backup:     $BackupRoot"
Write-Host ""
foreach ($RelativePath in $FilesAdded) {
    Write-Host "[ADDED] $RelativePath" -ForegroundColor Green
}
foreach ($RelativePath in $FilesReplaced) {
    Write-Host "[REPLACED] $RelativePath" -ForegroundColor Yellow
}
foreach ($Description in @($Manifest.filesIntentionallyUntouched)) {
    Write-Host "[UNTOUCHED] $Description" -ForegroundColor Cyan
}

$VerifierPath = Join-Path $RepositoryRoot $VerifierName
$PowerShellCommand = Get-Command "powershell.exe" -ErrorAction SilentlyContinue
if ($null -eq $PowerShellCommand) {
    $PowerShellCommand = Get-Command "powershell" -ErrorAction SilentlyContinue
}
if ($null -eq $PowerShellCommand) {
    Fail-Installation "Windows PowerShell is unavailable; stage verification could not run." $BackupRoot
}

Write-Host ""
Write-Host "[INFO] Running static, test-database, and in-process API verification." -ForegroundColor Cyan
Write-Host "[INFO] No browser or independent live API verification is claimed." -ForegroundColor Cyan
& $PowerShellCommand.Source -NoProfile -ExecutionPolicy Bypass -File $VerifierPath -RepositoryPath $RepositoryRoot -PackagePath $PackageRoot
$VerifierExitCode = $LASTEXITCODE
if ($VerifierExitCode -ne 0) {
    Fail-Installation "Stage verifier failed with exit code $VerifierExitCode." $BackupRoot
}

Write-Host ""
Write-Host "[PASS] SourceRoot Frontend API and Observability v1 installed and verified." -ForegroundColor Green
Write-Host "[INFO] Backup: $BackupRoot" -ForegroundColor Cyan
Write-Host "[INFO] Browser checks: not performed." -ForegroundColor Cyan
Write-Host "[INFO] Independent live API checks: not performed." -ForegroundColor Cyan
exit 0

