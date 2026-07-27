<#
.SYNOPSIS
Selects an existing stage specification as the active Root stage.

.PARAMETER StageSpecification
Repository-relative or absolute path to a stage Markdown file inside the
repository.

.PARAMETER AllowedFiles
Optional explicit allowed-file list. When omitted, the script parses the
Allowed files section when possible, then falls back to the current manifest.

.PARAMETER RequiredVerifiers
Optional explicit verifier list. When omitted, the script parses the Required
verifier section when possible, then falls back to the current manifest.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$StageSpecification,

    [Parameter()]
    [string[]]$AllowedFiles,

    [Parameter()]
    [string[]]$RequiredVerifiers
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

function ConvertTo-RepositoryRelativePath {
    param([Parameter(Mandatory = $true)][string]$FullPath)
    $Resolved = [IO.Path]::GetFullPath($FullPath)
    if (-not $Resolved.StartsWith($script:RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Stage specification must be inside the repository."
    }
    return $Resolved.Substring($script:RepositoryRoot.Length + 1).Replace("\", "/")
}

function Get-MarkdownSectionList {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Heading
    )
    $Items = New-Object System.Collections.Generic.List[string]
    $InSection = $false
    foreach ($Line in ($Text -split "`r?`n")) {
        if ($Line -match '^##\s+(.+?)\s*$') {
            $InSection = $Matches[1].Trim().Equals($Heading, [StringComparison]::OrdinalIgnoreCase)
            continue
        }
        if ($InSection -and $Line -match '^\s*-\s+`{0,2}([^`]+?)`{0,2}\s*$') {
            $Items.Add($Matches[1].Trim())
        }
    }
    return @($Items | ForEach-Object { $_ })
}

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    $Encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $Encoding)
}

function Get-CurrentChangedFiles {
    if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) { return @() }
    $Tracked = @(& git -c core.autocrlf=false -C $script:RepositoryRoot diff --name-only 2>$null)
    $Staged = @(& git -c core.autocrlf=false -C $script:RepositoryRoot diff --cached --name-only 2>$null)
    $Untracked = @(& git -c core.autocrlf=false -C $script:RepositoryRoot ls-files --others --exclude-standard 2>$null)
    return @($Tracked + $Staged + $Untracked |
        ForEach-Object { ([string]$_).Trim().Replace("\", "/") } |
        Where-Object { $_ } |
        Sort-Object -Unique)
}

try {
    $script:RepositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..")).TrimEnd("\", "/")
    $ManifestPath = Join-Path $script:RepositoryRoot "ROOT-MANIFEST.json"
    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        throw "ROOT-MANIFEST.json is missing."
    }

    $CandidatePath = if ([IO.Path]::IsPathRooted($StageSpecification)) {
        [IO.Path]::GetFullPath($StageSpecification)
    } else {
        [IO.Path]::GetFullPath((Join-Path $script:RepositoryRoot ($StageSpecification -replace "/", "\")))
    }
    if (-not (Test-Path -LiteralPath $CandidatePath -PathType Leaf)) {
        throw "Stage specification does not exist: $StageSpecification"
    }
    $StageRelativePath = ConvertTo-RepositoryRelativePath -FullPath $CandidatePath
    $StageText = Get-Content -LiteralPath $CandidatePath -Raw
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json

    $NameMatch = [regex]::Match($StageText, '(?m)^-\s*Name:\s*(.+?)\s*$')
    $SlugMatch = [regex]::Match($StageText, '(?m)^-\s*Slug:\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*$')
    $StageName = if ($NameMatch.Success) { $NameMatch.Groups[1].Value.Trim() } else { [IO.Path]::GetFileNameWithoutExtension($CandidatePath) }
    $StageSlug = if ($SlugMatch.Success) {
        $SlugMatch.Groups[1].Value.Trim()
    } else {
        (($StageName.ToUpperInvariant() -replace '[^A-Z0-9]+', '-') -replace '(^-|-$)', '')
    }
    if ($StageSlug -notmatch '^[A-Z0-9]+(?:-[A-Z0-9]+)*$') {
        throw "The stage slug is missing or invalid."
    }

    $ParsedAllowed = @(Get-MarkdownSectionList -Text $StageText -Heading "Allowed files")
    $ParsedVerifiers = @(Get-MarkdownSectionList -Text $StageText -Heading "Required verifier")
    $UseAllowed = if ($PSBoundParameters.ContainsKey("AllowedFiles")) {
        @($AllowedFiles)
    } elseif ($ParsedAllowed.Count -gt 0) {
        $ParsedAllowed
    } elseif ($null -ne $Manifest.active_stage) {
        @($Manifest.active_stage.allowed_files)
    } else {
        @()
    }
    $UseVerifiers = if ($PSBoundParameters.ContainsKey("RequiredVerifiers")) {
        @($RequiredVerifiers)
    } elseif ($ParsedVerifiers.Count -gt 0) {
        $ParsedVerifiers
    } elseif ($null -ne $Manifest.active_stage) {
        @($Manifest.active_stage.required_verifiers)
    } else {
        @()
    }

    $NormalizedAllowed = @($UseAllowed + @("ROOT-MANIFEST.json", $StageRelativePath) |
        ForEach-Object { ConvertTo-SafeRelativePath -Path ([string]$_) } |
        Sort-Object -Unique)
    $NormalizedVerifiers = @($UseVerifiers |
        ForEach-Object { ConvertTo-SafeRelativePath -Path ([string]$_) } |
        Sort-Object -Unique)
    if ($NormalizedVerifiers.Count -eq 0) {
        throw "No required verifiers were supplied or parsed."
    }

    $PreflightFiles = @(Get-CurrentChangedFiles)
    $Manifest.active_stage = [pscustomobject][ordered]@{
        name = $StageName
        slug = $StageSlug
        specification = $StageRelativePath
        allowed_files = $NormalizedAllowed
        required_verifiers = $NormalizedVerifiers
        preflight_changed_files = $PreflightFiles
        status = "active"
    }
    $ManifestJson = $Manifest | ConvertTo-Json -Depth 30
    $null = $ManifestJson | ConvertFrom-Json
    Write-Utf8File -Path $ManifestPath -Content ($ManifestJson + "`r`n")

    Write-Host "[PASS] Active stage selected." -ForegroundColor Green
    Write-Host "[INFO] Name: $StageName" -ForegroundColor Cyan
    Write-Host "[INFO] Slug: $StageSlug" -ForegroundColor Cyan
    Write-Host "[INFO] Specification: $StageRelativePath" -ForegroundColor Cyan
    Write-Host "[INFO] Allowed files: $($NormalizedAllowed.Count)" -ForegroundColor Cyan
    Write-Host "[INFO] Required verifiers: $($NormalizedVerifiers -join ', ')" -ForegroundColor Cyan
    Write-Host "[INFO] Preflight changed files recorded: $($PreflightFiles.Count)" -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
