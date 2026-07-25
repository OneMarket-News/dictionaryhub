[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$StageName = "sourceroot-codex-stage-contract-v1"
$ScriptRoot = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
$PackagePayload = Join-Path $ScriptRoot "payload"
$SourceRoot = $ScriptRoot
if (Test-Path -LiteralPath $PackagePayload -PathType Container) {
    $SourceRoot = [System.IO.Path]::GetFullPath($PackagePayload).TrimEnd("\", "/")
}

$Files = @(
    "docs\build\CODEX-STAGE-CONTRACT.md",
    "docs\build\CURRENT-SOURCEROOT-STATE.md",
    "docs\build\STAGE-PACKAGE-STANDARD.md",
    "docs\build\AGENT-SAFETY-BASELINE.md",
    "docs\build\SOURCEROOT-BASELINE-MANIFEST.json",
    "VERIFY-SOURCEROOT-BASELINE.ps1",
    "VERIFY-DICTIONARYROOT-BASELINE.ps1",
    "VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1",
    "INSTALL-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1",
    "docs\build\codex-stage-contract-stage.md"
)

Write-Host "SourceRoot Codex Stage Contract v1 installer" -ForegroundColor Cyan
Write-Host "Package source: $SourceRoot"

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Write-Host "[FAIL] Repository does not exist: $RepositoryPath" -ForegroundColor Red
    exit 2
}
$RepositoryRoot = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepositoryPath).Path).TrimEnd("\", "/")
Write-Host "Target repository: $RepositoryRoot"

$HasSourceRootMarker = Test-Path -LiteralPath (Join-Path $RepositoryRoot "backend\src\app.ts") -PathType Leaf
$HasDictionaryRootMarker = Test-Path -LiteralPath (Join-Path $RepositoryRoot "config\customers\dictionaryroot.json") -PathType Leaf
if (-not ($HasSourceRootMarker -or $HasDictionaryRootMarker)) {
    Write-Host "[FAIL] Target does not contain an expected SourceRoot or DictionaryRoot marker." -ForegroundColor Red
    exit 2
}
Write-Host "[PASS] Target repository markers confirmed." -ForegroundColor Green

$MissingSourceFiles = @(
    $Files | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $SourceRoot $_) -PathType Leaf)
    }
)
if ($MissingSourceFiles.Count -gt 0) {
    Write-Host "[FAIL] Stage payload is incomplete." -ForegroundColor Red
    Write-Host "       Missing: $($MissingSourceFiles -join ', ')"
    exit 2
}
Write-Host "[PASS] Stage payload is complete ($($Files.Count) files)." -ForegroundColor Green

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$BackupRoot = Join-Path $RepositoryRoot "backups\$StageName-$Timestamp"
if (Test-Path -LiteralPath $BackupRoot) {
    Write-Host "[FAIL] Refusing to reuse an existing backup directory: $BackupRoot" -ForegroundColor Red
    exit 2
}
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
Write-Host "[INFO] Backup: $BackupRoot" -ForegroundColor Cyan

$AddedFiles = New-Object System.Collections.Generic.List[string]
$ReplacedFiles = New-Object System.Collections.Generic.List[string]
$InstallationRecords = New-Object System.Collections.Generic.List[object]

try {
    foreach ($RelativePath in $Files) {
        $SourcePath = [System.IO.Path]::GetFullPath((Join-Path $SourceRoot $RelativePath))
        $TargetPath = [System.IO.Path]::GetFullPath((Join-Path $RepositoryRoot $RelativePath))
        $TargetDirectory = Split-Path -Parent $TargetPath
        if (-not (Test-Path -LiteralPath $TargetDirectory -PathType Container)) {
            New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null
        }

        $Status = "added"
        $OriginalSha256 = $null
        if (Test-Path -LiteralPath $TargetPath -PathType Leaf) {
            $Status = "replaced"
            $BackupPath = Join-Path $BackupRoot $RelativePath
            $BackupDirectory = Split-Path -Parent $BackupPath
            if (-not (Test-Path -LiteralPath $BackupDirectory -PathType Container)) {
                New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
            }
            Copy-Item -LiteralPath $TargetPath -Destination $BackupPath -Force
            $OriginalSha256 = (Get-FileHash -LiteralPath $TargetPath -Algorithm SHA256).Hash
            $ReplacedFiles.Add($RelativePath)
        } else {
            $AddedFiles.Add($RelativePath)
        }

        if (-not $SourcePath.Equals($TargetPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -Force
        }

        $SourceSha256 = (Get-FileHash -LiteralPath $SourcePath -Algorithm SHA256).Hash
        $InstalledSha256 = (Get-FileHash -LiteralPath $TargetPath -Algorithm SHA256).Hash
        if ($SourceSha256 -ne $InstalledSha256) {
            throw "Installed file hash does not match the payload: $RelativePath"
        }

        $InstallationRecords.Add([pscustomobject]@{
            relativePath = $RelativePath.Replace("\", "/")
            status = $Status
            originalSha256 = $OriginalSha256
            sourceSha256 = $SourceSha256
            installedSha256 = $InstalledSha256
        })
        Write-Host "[$($Status.ToUpper())] $RelativePath"
    }

    $InstallRecord = [ordered]@{
        stage = "SourceRoot Codex Stage Contract v1"
        installedAt = [DateTime]::Now.ToString("o")
        repository = $RepositoryRoot
        packageSource = $SourceRoot
        backup = $BackupRoot
        addedFiles = @($AddedFiles | ForEach-Object { $_ })
        replacedFiles = @($ReplacedFiles | ForEach-Object { $_ })
        files = @($InstallationRecords | ForEach-Object { $_ })
        rollback = @(
            "Restore every replaced file from this backup while preserving its relative path.",
            "Remove only files listed in addedFiles if a complete rollback is required.",
            "Run the pre-stage verification appropriate to the restored repository."
        )
    }
    $InstallRecord | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $BackupRoot "installation-record.json") -Encoding UTF8
} catch {
    Write-Host "[FAIL] Installation copy failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[INFO] Backup retained at: $BackupRoot" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "[INFO] Added files: $($AddedFiles.Count)" -ForegroundColor Cyan
foreach ($File in $AddedFiles) { Write-Host "       $File" }
Write-Host "[INFO] Replaced files: $($ReplacedFiles.Count)" -ForegroundColor Cyan
foreach ($File in $ReplacedFiles) { Write-Host "       $File" }
Write-Host "[INFO] Backup retained at: $BackupRoot" -ForegroundColor Cyan

$VerifierPath = Join-Path $RepositoryRoot "VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1"
$PowerShellCommand = Get-Command "powershell.exe" -ErrorAction SilentlyContinue
if ($null -eq $PowerShellCommand) {
    $PowerShellCommand = Get-Command "powershell" -ErrorAction SilentlyContinue
}
if ($null -eq $PowerShellCommand) {
    Write-Host "[FAIL] Windows PowerShell is unavailable; stage verification could not run." -ForegroundColor Red
    Write-Host "[INFO] Backup retained at: $BackupRoot" -ForegroundColor Cyan
    exit 1
}

$VerifierArguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $VerifierPath,
    "-RepositoryPath", $RepositoryRoot
)
if (Test-Path -LiteralPath (Join-Path $ScriptRoot "payload") -PathType Container) {
    $VerifierArguments += @("-PackagePath", $ScriptRoot)
}

Write-Host ""
Write-Host "[INFO] Running the stage verifier. This does not perform browser, live API, or database verification." -ForegroundColor Cyan
& $PowerShellCommand.Source @VerifierArguments
$VerifierExitCode = $LASTEXITCODE
if ($VerifierExitCode -ne 0) {
    Write-Host "[FAIL] Stage verification failed with exit code $VerifierExitCode." -ForegroundColor Red
    Write-Host "[INFO] Backup retained for rollback: $BackupRoot" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "[PASS] SourceRoot Codex Stage Contract v1 installed and its static verifier passed." -ForegroundColor Green
Write-Host "[INFO] No browser verification was performed." -ForegroundColor Cyan
Write-Host "[INFO] No live API verification was performed." -ForegroundColor Cyan
Write-Host "[INFO] No PostgreSQL verification was performed." -ForegroundColor Cyan
Write-Host "[INFO] Backup: $BackupRoot" -ForegroundColor Cyan
exit 0
