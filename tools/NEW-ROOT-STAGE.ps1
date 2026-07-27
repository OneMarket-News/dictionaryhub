<#
.SYNOPSIS
Creates a new active Root stage from the repository template.

.DESCRIPTION
Writes docs/stages/active/CURRENT-STAGE.md and updates ROOT-MANIFEST.json
through parsed PowerShell objects. Existing active work is protected unless
-Force is explicit.

.PARAMETER StageName
Human-readable stage name.

.PARAMETER StageSlug
Uppercase letters, numbers, and single hyphens.

.PARAMETER Objective
Concise stage objective.

.PARAMETER AllowedFiles
Repository-relative paths the stage may change. The active specification and
ROOT-MANIFEST.json are added automatically.

.PARAMETER RequiredVerifiers
Repository-relative verifier paths.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$StageName,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$StageSlug,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Objective,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string[]]$AllowedFiles,

    [Parameter()]
    [string[]]$RequiredVerifiers = @("VERIFY-ROOT-REPOSITORY.ps1"),

    [Parameter()]
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function ConvertTo-SafeRelativePath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $Normalized = $Path.Trim().Replace("\", "/")
    while ($Normalized.StartsWith("./", [StringComparison]::Ordinal)) {
        $Normalized = $Normalized.Substring(2)
    }
    if (
        [string]::IsNullOrWhiteSpace($Normalized) -or
        [IO.Path]::IsPathRooted($Path) -or
        $Normalized -match '(^|/)\.{1,2}(/|$)' -or
        $Normalized.IndexOfAny([IO.Path]::GetInvalidPathChars()) -ge 0
    ) {
        throw "Unsafe repository-relative path: $Path"
    }
    return $Normalized
}

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    $Encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $Encoding)
}

function Get-CurrentChangedFiles {
    $Git = Get-Command git -ErrorAction SilentlyContinue
    if ($null -eq $Git) { return @() }
    $Tracked = @(& git -c core.autocrlf=false -C $script:RepositoryRoot diff --name-only 2>$null)
    $Staged = @(& git -c core.autocrlf=false -C $script:RepositoryRoot diff --cached --name-only 2>$null)
    $Untracked = @(& git -c core.autocrlf=false -C $script:RepositoryRoot ls-files --others --exclude-standard 2>$null)
    return @($Tracked + $Staged + $Untracked |
        ForEach-Object { ([string]$_).Trim().Replace("\", "/") } |
        Where-Object { $_ } |
        Sort-Object -Unique)
}

try {
    if ($StageSlug -notmatch '^[A-Z0-9]+(?:-[A-Z0-9]+)*$') {
        throw "StageSlug must contain uppercase letters, numbers, and single hyphens only."
    }

    $script:RepositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..")).TrimEnd("\", "/")
    $ManifestPath = Join-Path $script:RepositoryRoot "ROOT-MANIFEST.json"
    $TemplatePath = Join-Path $script:RepositoryRoot "docs\stages\templates\ROOT-STAGE-TEMPLATE.md"
    $StageRelativePath = "docs/stages/active/CURRENT-STAGE.md"
    $StagePath = Join-Path $script:RepositoryRoot ($StageRelativePath -replace "/", "\")

    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        throw "ROOT-MANIFEST.json is missing."
    }
    if (-not (Test-Path -LiteralPath $TemplatePath -PathType Leaf)) {
        throw "Root stage template is missing: docs/stages/templates/ROOT-STAGE-TEMPLATE.md"
    }

    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $HasActiveStage = (
        $null -ne $Manifest.active_stage -and
        [string]$Manifest.active_stage.status -eq "active" -and
        -not [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.name)
    )
    if ($HasActiveStage -and -not $Force) {
        throw "An active stage already exists: $($Manifest.active_stage.name). Use -Force only after preserving or completing it."
    }
    if ((Test-Path -LiteralPath $StagePath -PathType Leaf) -and -not $Force) {
        throw "The active stage document already exists. Use -Force only when replacement is intentional."
    }

    $NormalizedAllowed = @($AllowedFiles + @("ROOT-MANIFEST.json", $StageRelativePath) |
        ForEach-Object { ConvertTo-SafeRelativePath -Path ([string]$_) } |
        Sort-Object -Unique)
    $NormalizedVerifiers = @($RequiredVerifiers |
        ForEach-Object { ConvertTo-SafeRelativePath -Path ([string]$_) } |
        Sort-Object -Unique)
    if ($NormalizedVerifiers.Count -eq 0) {
        throw "At least one required verifier must be supplied."
    }

    $AllowedMarkdown = ($NormalizedAllowed | ForEach-Object { "- ``$_``" }) -join "`r`n"
    $VerifierMarkdown = ($NormalizedVerifiers | ForEach-Object { "- ``$_``" }) -join "`r`n"
    $Template = Get-Content -LiteralPath $TemplatePath -Raw
    $StageContent = $Template.Replace("{{STAGE_NAME}}", $StageName.Trim())
    $StageContent = $StageContent.Replace("{{STAGE_SLUG}}", $StageSlug)
    $StageContent = $StageContent.Replace("{{DATE}}", (Get-Date).ToString("yyyy-MM-dd"))
    $StageContent = $StageContent.Replace("{{OBJECTIVE}}", $Objective.Trim())
    $StageContent = $StageContent.Replace("{{ALLOWED_FILES}}", $AllowedMarkdown)
    $StageContent = $StageContent.Replace("{{REQUIRED_VERIFIERS}}", $VerifierMarkdown)

    $PreflightFiles = @(Get-CurrentChangedFiles)
    $Manifest.active_stage = [pscustomobject][ordered]@{
        name = $StageName.Trim()
        slug = $StageSlug
        specification = $StageRelativePath
        allowed_files = $NormalizedAllowed
        required_verifiers = $NormalizedVerifiers
        preflight_changed_files = $PreflightFiles
        status = "active"
    }
    $ManifestJson = $Manifest | ConvertTo-Json -Depth 30
    $null = $ManifestJson | ConvertFrom-Json

    $StageDirectory = Split-Path -Parent $StagePath
    if (-not (Test-Path -LiteralPath $StageDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $StageDirectory | Out-Null
    }
    Write-Utf8File -Path $StagePath -Content $StageContent
    Write-Utf8File -Path $ManifestPath -Content ($ManifestJson + "`r`n")

    Write-Host "[PASS] Active stage created: $StageRelativePath" -ForegroundColor Green
    Write-Host "[INFO] Stage: $StageName [$StageSlug]" -ForegroundColor Cyan
    Write-Host "[INFO] Preflight changed files recorded: $($PreflightFiles.Count)" -ForegroundColor Cyan
    Write-Host "[INFO] Next: powershell -ExecutionPolicy Bypass -File `".\VERIFY-ROOT-REPOSITORY.ps1`"" -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
