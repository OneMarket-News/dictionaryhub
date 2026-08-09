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
    # Mutable lifecycle and governance artifacts are written UTF-8 without BOM
    # and with LF line endings. Normalization happens in memory at the write
    # boundary so no caller depends on platform-default newline behavior, and
    # so a governed file cannot drift to CRLF and dirty `git diff --check`.
    $Normalized = $Content -replace "`r`n", "`n" -replace "`r", "`n"
    $Encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Normalized, $Encoding)
}

function Read-Utf8File {
    param([string]$Path)
    # STRICT UTF-8 lifecycle read contract.
    #
    # Two decoding boundaries have to be closed here, not one. Windows
    # PowerShell 5.1 `Get-Content` decodes with the system ANSI code page, so
    # BOM-less UTF-8 was silently corrupted: an em dash (E2 80 94) became three
    # windows-1252 characters that the UTF-8 writer then persisted as mojibake.
    # `[IO.File]::ReadAllText($Path, $Encoding)` fixes that but still performs
    # byte-order-mark auto-detection, so it silently ACCEPTS UTF-16 and UTF-32
    # input that this contract must reject.
    #
    # Bytes are therefore read raw, the byte-order mark is classified
    # explicitly, and only UTF-8 is ever decoded.
    #
    #   Accepted: BOM-less UTF-8, and UTF-8 with a BOM. An accepted BOM is
    #             stripped and never reaches the content or the writer.
    #   Rejected: UTF-16LE/BE, UTF-32LE/BE, and any invalid UTF-8 sequence.
    #
    # There is no fallback decoder. Malformed input fails closed.
    $Bytes = [IO.File]::ReadAllBytes($Path)

    # UTF-32 signatures are tested first: UTF-32LE (FF FE 00 00) begins with
    # the UTF-16LE signature (FF FE), so the shorter test would shadow it.
    if ($Bytes.Length -ge 4 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE -and $Bytes[2] -eq 0x00 -and $Bytes[3] -eq 0x00) {
        throw "Lifecycle text must be UTF-8; a UTF-32LE byte-order mark was found: $Path"
    }
    if ($Bytes.Length -ge 4 -and $Bytes[0] -eq 0x00 -and $Bytes[1] -eq 0x00 -and $Bytes[2] -eq 0xFE -and $Bytes[3] -eq 0xFF) {
        throw "Lifecycle text must be UTF-8; a UTF-32BE byte-order mark was found: $Path"
    }
    if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) {
        throw "Lifecycle text must be UTF-8; a UTF-16LE byte-order mark was found: $Path"
    }
    if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF) {
        throw "Lifecycle text must be UTF-8; a UTF-16BE byte-order mark was found: $Path"
    }

    $Offset = 0
    if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
        $Offset = 3
    }
    # GetString over an explicit byte range performs no BOM auto-detection, and
    # throwOnInvalidBytes makes malformed UTF-8 throw instead of degrading to
    # U+FFFD replacement characters. An empty file decodes to an empty string.
    $Encoding = New-Object Text.UTF8Encoding($false, $true)
    return $Encoding.GetString($Bytes, $Offset, $Bytes.Length - $Offset)
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

    $Manifest = Read-Utf8File -Path $ManifestPath | ConvertFrom-Json
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

    $AllowedMarkdown = ($NormalizedAllowed | ForEach-Object { "- ``$_``" }) -join "`n"
    $VerifierMarkdown = ($NormalizedVerifiers | ForEach-Object { "- ``$_``" }) -join "`n"
    $Template = Read-Utf8File -Path $TemplatePath
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
    Write-Utf8File -Path $ManifestPath -Content ($ManifestJson + "`n")

    Write-Host "[PASS] Active stage created: $StageRelativePath" -ForegroundColor Green
    Write-Host "[INFO] Stage: $StageName [$StageSlug]" -ForegroundColor Cyan
    Write-Host "[INFO] Preflight changed files recorded: $($PreflightFiles.Count)" -ForegroundColor Cyan
    Write-Host "[INFO] Next: powershell -ExecutionPolicy Bypass -File `".\VERIFY-ROOT-REPOSITORY.ps1`"" -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
