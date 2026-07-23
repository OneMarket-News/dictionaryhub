[CmdletBinding()]
param(
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",
    [switch]$RunBrowserVerification,
    [switch]$SkipVerification
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$StageName = "dictionaryroot-governed-platform-foundation-v1"
$SourceRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path)).TrimEnd('\','/')
if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    throw "Repository not found: $RepositoryPath"
}
$RepositoryRoot = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepositoryPath).Path).TrimEnd('\','/')
$Separator = [System.IO.Path]::DirectorySeparatorChar
if ($SourceRoot -eq $RepositoryRoot -or $SourceRoot.StartsWith($RepositoryRoot + $Separator, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Extract the release ZIP outside the repository before running the installer. This protects the pre-install backup."
}

$Files = @(
    ".gitignore",
    "BACKUP-DICTIONARYROOT-DATABASE.ps1",
    "DICTIONARYROOT-GOVERNED-PLATFORM-FOUNDATION-v1-MANIFEST.txt",
    "INSTALL-DICTIONARYROOT-GOVERNED-PLATFORM-FOUNDATION.ps1",
    "RESTORE-DICTIONARYROOT-DATABASE.ps1",
    "ROLLBACK-DICTIONARYROOT-GOVERNED-PLATFORM-FOUNDATION.md",
    "SETUP-DICTIONARYROOT-GOVERNED-PLATFORM.ps1",
    "START-DICTIONARYROOT-GOVERNED-PLATFORM.ps1",
    "VERIFY-DICTIONARYROOT-CROSS-EXPERIENCE-PRODUCT-REFINEMENT.ps1",
    "VERIFY-DICTIONARYROOT-GOVERNANCE-RESPONSIVE.mjs",
    "VERIFY-DICTIONARYROOT-GOVERNED-PLATFORM-FOUNDATION.ps1",
    "VERIFY-DICTIONARYROOT-RESPONSIVE.mjs",
    "VERIFY-DICTIONARYROOT-TYPESCRIPT-SYNTAX.mjs",
    "acceptable-use.html",
    "account-v1.html",
    "admin-v1.html",
    "assets\css\dictionaryroot-governance.css",
    "assets\js\dictionaryroot-account.js",
    "assets\js\dictionaryroot-admin.js",
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-auth.js",
    "assets\js\dictionaryroot-editorial.js",
    "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-workflow.js",
    "backend\.dockerignore",
    "backend\.env.example",
    "backend\Dockerfile",
    "backend\README.md",
    "backend\config\production.env.example",
    "backend\config\staging.env.example",
    "backend\db\migrations\005_create_auth_identity_governance.sql",
    "backend\db\migrations\006_create_governed_editorial_workflow.sql",
    "backend\db\migrations\007_create_moderation_operations.sql",
    "backend\db\migrations\008_strengthen_session_identity.sql",
    "backend\docs\openapi-governance.yaml",
    "backend\package-lock.json",
    "backend\package.json",
    "backend\scripts\backup-postgres.sh",
    "backend\scripts\restore-postgres.sh",
    "backend\src\app.ts",
    "backend\src\auth\types.ts",
    "backend\src\lib\runtime-config.ts",
    "backend\src\lib\security.ts",
    "backend\src\middleware\auth.ts",
    "backend\src\routes\account.ts",
    "backend\src\routes\admin.ts",
    "backend\src\routes\auth.ts",
    "backend\src\routes\editorial.ts",
    "backend\src\routes\health.ts",
    "backend\src\routes\import.ts",
    "backend\src\routes\moderation.ts",
    "backend\src\routes\workflow.ts",
    "backend\src\server.ts",
    "backend\src\services\admin-store.ts",
    "backend\src\services\audit-store.ts",
    "backend\src\services\auth-providers.ts",
    "backend\src\services\auth-store.ts",
    "backend\src\services\workflow-store.ts",
    "backend\test\governance-surface.test.ts",
    "backend\test\helpers\database.ts",
    "concept-v2.html",
    "corrections-policy.html",
    "coverage-v2.html",
    "docker-compose.local.yml",
    "docs\customers\dictionaryroot\authentication-provider-setup.md",
    "docs\customers\dictionaryroot\deployment-readiness.md",
    "docs\customers\dictionaryroot\governed-platform-foundation-v1.md",
    "docs\customers\dictionaryroot\pilot-readiness-checklist.md",
    "docs\customers\dictionaryroot\security-and-governance.md",
    "editorial-v2.html",
    "graph-v2.html",
    "history-v2.html",
    "index.html",
    "privacy.html",
    "sources-v2.html",
    "terms.html",
    "workflow-v1.html"
)

Write-Host "DictionaryRoot Governed Platform Foundation v1 (installer hotfix 1.0.1)" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"

$Missing = @($Files | Where-Object { -not (Test-Path -LiteralPath (Join-Path $SourceRoot $_) -PathType Leaf) })
if ($Missing.Count) {
    throw "The extracted package is incomplete. Missing: $($Missing -join ', ')"
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $RepositoryRoot ("backups\$StageName-$Timestamp")
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
Write-Host "Backup:     $BackupRoot"
Write-Host ""

$Manifest = New-Object System.Collections.Generic.List[object]
$BackedUp = 0
$Installed = 0
foreach ($RelativePath in $Files) {
    $SourcePath = Join-Path $SourceRoot $RelativePath
    $TargetPath = Join-Path $RepositoryRoot $RelativePath
    $TargetDirectory = Split-Path -Parent $TargetPath
    if (-not (Test-Path -LiteralPath $TargetDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null
    }

    $Status = "New"
    if (Test-Path -LiteralPath $TargetPath -PathType Leaf) {
        $Status = "Replaced"
        $BackupPath = Join-Path $BackupRoot $RelativePath
        $BackupDirectory = Split-Path -Parent $BackupPath
        if (-not (Test-Path -LiteralPath $BackupDirectory -PathType Container)) {
            New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
        }
        Copy-Item -LiteralPath $TargetPath -Destination $BackupPath -Force
        $BackedUp++
    }

    Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -Force
    $Installed++
    $Manifest.Add([pscustomobject]@{
        RelativePath = $RelativePath
        Status = $Status
        SourceSha256 = (Get-FileHash -LiteralPath $SourcePath -Algorithm SHA256).Hash
        InstalledSha256 = (Get-FileHash -LiteralPath $TargetPath -Algorithm SHA256).Hash
    })
}

$Manifest | Export-Csv -LiteralPath (Join-Path $BackupRoot "install-manifest.csv") -NoTypeInformation -Encoding UTF8
@(
    "Stage: DictionaryRoot Governed Platform Foundation v1"
    "InstalledAt: $([DateTime]::Now.ToString('o'))"
    "Repository: $RepositoryRoot"
    "PackageSource: $SourceRoot"
    "BackedUpFiles: $BackedUp"
    "InstalledFiles: $Installed"
    "New files are recorded in install-manifest.csv and must be deleted manually for a complete file rollback."
) | Set-Content -LiteralPath (Join-Path $BackupRoot "install-summary.txt") -Encoding UTF8

Write-Host "Installation copy completed." -ForegroundColor Green
Write-Host "Backed up files: $BackedUp"
Write-Host "Installed files: $Installed"
Write-Host ""

if (-not $SkipVerification) {
    Write-Host "Running governed-platform source verification..." -ForegroundColor Cyan
    $Verifier = Join-Path $RepositoryRoot "VERIFY-DICTIONARYROOT-GOVERNED-PLATFORM-FOUNDATION.ps1"
    $VerifierArguments = @("-ExecutionPolicy", "Bypass", "-File", $Verifier, "-RepositoryPath", $RepositoryRoot)
    if (-not $RunBrowserVerification) { $VerifierArguments += "-SkipBrowser" }
    $PowerShell = Get-Command powershell.exe -ErrorAction SilentlyContinue
    if (-not $PowerShell) { $PowerShell = Get-Command powershell -ErrorAction Stop }
    & $PowerShell.Source @VerifierArguments
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Verification failed. The timestamped backup is preserved for rollback: $BackupRoot" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Governed-platform files installed successfully." -ForegroundColor Green
Write-Host "Next, configure dependencies and PostgreSQL:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$RepositoryRoot\SETUP-DICTIONARYROOT-GOVERNED-PLATFORM.ps1`" -UseDocker"
Write-Host "The setup step does not create Google, Apple, email, hosting, or legal-provider accounts for you."
