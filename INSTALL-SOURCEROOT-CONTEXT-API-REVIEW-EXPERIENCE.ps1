[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",

    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [string]$PriorReleasePath = "C:\Users\Josh\Documents\SourceRoot-Releases"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$StageFolderName = "SourceRoot-Context-API-Review-Experience-v1"
$NormalizedStageName = "sourceroot-context-api-review-experience-v1"
$VerifierName = "VERIFY-SOURCEROOT-CONTEXT-API-REVIEW-EXPERIENCE.ps1"
$ExpectedPriorZip = "SourceRoot-Contextual-Assertions-Evidence-Versioning-v1.zip"
$ExpectedPriorZipHash = "2485ec694dfc9cfe02d7291d9f0ec133658fc9057d8953c79e2d3618440c5b8b"

function Stop-Install {
    param([string]$Message, [string]$BackupPath = "")
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    if ($BackupPath) {
        Write-Host "[INFO] Backup retained at: $BackupPath" -ForegroundColor Cyan
    }
    exit 1
}

function Resolve-PackageRoot {
    if ($PackagePath) {
        if (-not (Test-Path -LiteralPath $PackagePath -PathType Container)) {
            throw "Explicit package path does not exist: $PackagePath"
        }
        return [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PackagePath).Path).TrimEnd("\", "/")
    }
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
    throw "Could not locate the $StageFolderName package."
}

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Stop-Install "Repository does not exist: $RepositoryPath"
}
if (-not (Test-Path -LiteralPath $PriorReleasePath -PathType Container)) {
    Stop-Install "Prior-release directory does not exist: $PriorReleasePath"
}
$RepositoryRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepositoryPath).Path).TrimEnd("\", "/")
$PriorReleaseRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PriorReleasePath).Path).TrimEnd("\", "/")

$RequiredMarkers = @(
    "backend\src\app.ts",
    "backend\package.json",
    "backend\.env.test",
    "backend\db\migrations\009_create_contextual_knowledge_foundation.sql",
    "backend\db\migrations\010_extend_contextual_governance.sql",
    "backend\db\migrations\011_refine_contextual_identity_time.sql",
    "backend\db\migrations\012_refine_contextual_assertions_evidence_versioning.sql",
    "docs\build\CODEX-STAGE-CONTRACT.md",
    "docs\build\CONTEXTUAL-ASSERTIONS-EVIDENCE-VERSIONING-CONTRACT.md",
    "VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1",
    "VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1",
    "VERIFY-SOURCEROOT-FRONTEND-API-OBSERVABILITY.ps1",
    "VERIFY-SOURCEROOT-CONTEXTUAL-IDENTITY-TIME.ps1",
    "VERIFY-SOURCEROOT-CONTEXTUAL-ASSERTIONS-EVIDENCE-VERSIONING.ps1"
)
$MissingMarkers = @($RequiredMarkers | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $_) -PathType Leaf)
})
if ($MissingMarkers.Count -gt 0) {
    Stop-Install "Repository or Chunk 0-4 markers are missing: $($MissingMarkers -join ', ')"
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
    Stop-Install "Refusing automated verification: configured database is '$DatabaseName', not sourceroot_test."
}

$PriorZipPath = Join-Path $PriorReleaseRoot $ExpectedPriorZip
if (-not (Test-Path -LiteralPath $PriorZipPath -PathType Leaf)) {
    Stop-Install "Immediate prior release ZIP is missing: $PriorZipPath"
}
$ActualPriorZipHash = (Get-FileHash -LiteralPath $PriorZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ActualPriorZipHash -ne $ExpectedPriorZipHash) {
    Stop-Install "Immediate prior release ZIP hash mismatch."
}

try {
    $PackageRoot = Resolve-PackageRoot
    if ($PackageRoot -eq $RepositoryRoot) {
        throw "Package root and repository root cannot be the same directory."
    }
    $ManifestPath = Join-Path $PackageRoot "manifest\stage-manifest.json"
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
} catch {
    Stop-Install "Package could not be validated: $($_.Exception.Message)"
}
if (
    $Manifest.schemaVersion -ne "1.0" -or
    $Manifest.stageName -ne "SourceRoot-Context-API-Review-Experience" -or
    $Manifest.stageVersion -ne "v1" -or
    $Manifest.targetRepository -ne "dictionaryhub" -or
    $Manifest.requiredPreviousStage -ne "SourceRoot Chunk 4 - Contextual Assertions, Evidence, and Versioning v1" -or
    $Manifest.startingCommit -ne "d4d7f7f49afe808fb9bf554c579800e254a67b99" -or
    $Manifest.requiredPriorTag -ne "sourceroot-contextual-assertions-evidence-versioning-v1" -or
    $Manifest.priorZipFilename -ne $ExpectedPriorZip -or
    $Manifest.priorZipSha256.ToLowerInvariant() -ne $ExpectedPriorZipHash
) {
    Stop-Install "Package manifest identity, prerequisite, checkpoint, tag, or prior ZIP is incorrect."
}

$PayloadRoot = [IO.Path]::GetFullPath((Join-Path $PackageRoot "payload")).TrimEnd("\", "/")
$FilesAdded = @($Manifest.filesAdded)
$FilesReplaced = @($Manifest.filesReplaced)
$AllFiles = @($FilesAdded + $FilesReplaced)
if ($AllFiles.Count -eq 0) {
    Stop-Install "Manifest payload lists are empty."
}
$SeenPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$ResolvedDestinations = @{}
foreach ($RelativePathValue in $AllFiles) {
    $RelativePath = [string]$RelativePathValue
    if (
        [string]::IsNullOrWhiteSpace($RelativePath) -or
        $RelativePath.Contains("\") -or
        [IO.Path]::IsPathRooted($RelativePath) -or
        $RelativePath -match '(^|/)\.{1,2}(/|$)' -or
        -not $SeenPaths.Add($RelativePath)
    ) {
        Stop-Install "Manifest contains an unsafe or duplicate payload path: $RelativePath"
    }
    $NormalizedPath = $RelativePath -replace '/', '\'
    $ResolvedSource = [IO.Path]::GetFullPath((Join-Path $PayloadRoot $NormalizedPath))
    $ResolvedDestination = [IO.Path]::GetFullPath((Join-Path $RepositoryRoot $NormalizedPath))
    if (-not $ResolvedSource.StartsWith($PayloadRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        Stop-Install "Manifest payload path escapes the package: $RelativePath"
    }
    if (-not $ResolvedDestination.StartsWith($RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        Stop-Install "Manifest destination escapes the repository: $RelativePath"
    }
    if (
        $ResolvedDestination.StartsWith($PackageRoot + "\", [StringComparison]::OrdinalIgnoreCase) -or
        $ResolvedDestination.Equals($ResolvedSource, [StringComparison]::OrdinalIgnoreCase)
    ) {
        Stop-Install "Unsafe package source/destination overlap: $RelativePath"
    }
    $ResolvedDestinations[$RelativePath] = $ResolvedDestination
}
$PhysicalFiles = @(
    Get-ChildItem -LiteralPath $PayloadRoot -File -Recurse |
        ForEach-Object { $_.FullName.Substring($PayloadRoot.Length + 1).Replace("\", "/") } |
        Sort-Object
)
$DeclaredFiles = @($AllFiles | ForEach-Object { [string]$_ } | Sort-Object)
if (($PhysicalFiles -join "`n") -ne ($DeclaredFiles -join "`n")) {
    Stop-Install "Manifest payload lists do not exactly match the physical payload files."
}

$HashMap = @{}
$PayloadHashEntries = @($Manifest.payloadHashes)
if ($PayloadHashEntries.Count -ne $AllFiles.Count) {
    Stop-Install "Manifest must declare exactly one hash for every payload file."
}
foreach ($Entry in $PayloadHashEntries) {
    $HashPath = [string]$Entry.path
    $HashValue = ([string]$Entry.sha256).ToLowerInvariant()
    if (
        $HashMap.ContainsKey($HashPath) -or
        $DeclaredFiles -notcontains $HashPath -or
        $HashValue -notmatch '^[0-9a-f]{64}$'
    ) {
        Stop-Install "Manifest contains an invalid, duplicate, or undeclared payload hash: $HashPath"
    }
    $HashMap[$HashPath] = $HashValue
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

foreach ($RelativePath in $FilesReplaced) {
    if (-not (Test-Path -LiteralPath $ResolvedDestinations[$RelativePath] -PathType Leaf)) {
        Stop-Install "A declared replacement does not exist in the repository: $RelativePath"
    }
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$BackupRoot = Join-Path $RepositoryRoot ("backups\" + $NormalizedStageName + "-" + $Timestamp)
$ResolvedBackupRoot = [IO.Path]::GetFullPath($BackupRoot)
if (-not $ResolvedBackupRoot.StartsWith($RepositoryRoot + "\backups\", [StringComparison]::OrdinalIgnoreCase)) {
    Stop-Install "Backup path escaped the repository backup directory."
}
New-Item -ItemType Directory -Path $ResolvedBackupRoot -Force | Out-Null
$PreExistingAdded = [Collections.Generic.List[string]]::new()
$BackedUp = [Collections.Generic.List[string]]::new()
$InstalledHashes = [Collections.Generic.List[object]]::new()

try {
    foreach ($RelativePath in $AllFiles) {
        $Destination = $ResolvedDestinations[$RelativePath]
        if (Test-Path -LiteralPath $Destination -PathType Leaf) {
            $BackupFile = Join-Path $ResolvedBackupRoot ($RelativePath -replace '/', '\')
            New-Item -ItemType Directory -Path (Split-Path -Parent $BackupFile) -Force | Out-Null
            Copy-Item -LiteralPath $Destination -Destination $BackupFile -Force
            $BackedUp.Add($RelativePath)
            if ($FilesAdded -contains $RelativePath) {
                $PreExistingAdded.Add($RelativePath)
            }
        }
    }

    foreach ($RelativePath in $AllFiles) {
        $Source = Join-Path $PayloadRoot ($RelativePath -replace '/', '\')
        $Destination = $ResolvedDestinations[$RelativePath]
        New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
        $Actual = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($Actual -ne $HashMap[$RelativePath]) {
            throw "Installed file hash mismatch: $RelativePath"
        }
        $InstalledHashes.Add([ordered]@{ path = $RelativePath; sha256 = $Actual })
    }
} catch {
    Stop-Install "Installation failed: $($_.Exception.Message)" $ResolvedBackupRoot
}

$InstallationRecordPath = Join-Path $ResolvedBackupRoot "installation-record.json"
$Record = [ordered]@{
    schemaVersion = "1.0"
    stageName = $Manifest.stageName
    stageVersion = $Manifest.stageVersion
    installedAt = (Get-Date).ToString("o")
    repositoryPath = $RepositoryRoot
    packagePath = $PackageRoot
    priorReleasePath = $PriorReleaseRoot
    priorZipPath = $PriorZipPath
    priorZipSha256 = $ActualPriorZipHash
    backupPath = $ResolvedBackupRoot
    addedFiles = $FilesAdded
    addedFilesPreExisting = $PreExistingAdded.ToArray()
    replacedFiles = $FilesReplaced
    backedUpFiles = $BackedUp.ToArray()
    payloadHashes = @($Manifest.payloadHashes)
    installedHashes = $InstalledHashes.ToArray()
    filesIntentionallyUntouched = @($Manifest.filesIntentionallyUntouched)
    rollbackInstructions = @($Manifest.rollbackInstructions)
}
$Record | ConvertTo-Json -Depth 12 |
    Set-Content -LiteralPath $InstallationRecordPath -Encoding UTF8

Write-Host "SourceRoot Context API and Review Experience v1 installation report" -ForegroundColor Cyan
Write-Host "Repository:          $RepositoryRoot"
Write-Host "Package:             $PackageRoot"
Write-Host "Backup:              $ResolvedBackupRoot"
Write-Host "Installation record: $InstallationRecordPath"
foreach ($RelativePath in $FilesAdded) { Write-Host "[ADDED] $RelativePath" -ForegroundColor Green }
foreach ($RelativePath in $FilesReplaced) { Write-Host "[REPLACED] $RelativePath" -ForegroundColor Yellow }

$PowerShell = Get-Command powershell.exe -ErrorAction SilentlyContinue
if ($null -eq $PowerShell) {
    Stop-Install "Windows PowerShell is unavailable; verification could not run." $ResolvedBackupRoot
}
& $PowerShell.Source -NoProfile -ExecutionPolicy Bypass `
    -File (Join-Path $RepositoryRoot $VerifierName) `
    -RepositoryPath $RepositoryRoot `
    -PackagePath $PackageRoot `
    -PriorReleasePath $PriorReleaseRoot
if ($LASTEXITCODE -ne 0) {
    Stop-Install "Stage verifier failed with exit code $LASTEXITCODE." $ResolvedBackupRoot
}

Write-Host "[PASS] SourceRoot Context API and Review Experience v1 installed and verified." -ForegroundColor Green
Write-Host "[INFO] Backup: $ResolvedBackupRoot" -ForegroundColor Cyan
Write-Host "[INFO] Installation record: $InstallationRecordPath" -ForegroundColor Cyan
exit 0
