<#
.SYNOPSIS
Reports tracked, staged, and untracked non-ignored repository changes.

.DESCRIPTION
Uses Git when available, normalizes paths to forward slashes, and can compare
the result with the active stage's allowed_files and preflight_changed_files.

.PARAMETER AsJson
Writes one JSON result instead of human-readable lines.

.PARAMETER CheckAllowedFiles
Returns a nonzero exit when a changed path is neither allowed by the active
stage nor recorded as a preflight change.

.PARAMETER AllowUntracked
Allows an untracked path to satisfy active-stage allowed_files during strict
checking. Untracked files are always reported.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$AsJson,

    [Parameter()]
    [switch]$CheckAllowedFiles,

    [Parameter()]
    [switch]$AllowUntracked
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function ConvertTo-RootRelativePath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $Normalized = ($Path.Trim() -replace "\\", "/")
    while ($Normalized.StartsWith("./", [StringComparison]::Ordinal)) {
        $Normalized = $Normalized.Substring(2)
    }
    return $Normalized
}

function Test-StagePathMatch {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter()][AllowEmptyCollection()][string[]]$Candidates = @()
    )
    foreach ($CandidateValue in $Candidates) {
        $Candidate = ConvertTo-RootRelativePath -Path ([string]$CandidateValue)
        if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }
        if ($Candidate.EndsWith("/")) {
            if ($Path.StartsWith($Candidate, [StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
        } elseif ($Path.Equals($Candidate, [StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

try {
    $RepositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..")).TrimEnd("\", "/")
    $ManifestPath = Join-Path $RepositoryRoot "ROOT-MANIFEST.json"
    $GitCommand = Get-Command git -ErrorAction SilentlyContinue

    if ($null -eq $GitCommand) {
        $Result = [ordered]@{
            repository = $RepositoryRoot
            git_available = $false
            check_allowed_files = [bool]$CheckAllowedFiles
            allow_untracked = [bool]$AllowUntracked
            change_count = 0
            unauthorized_count = 0
            changes = @()
            unauthorized_files = @()
            message = "Git is unavailable; changed files could not be determined."
        }
        if ($AsJson) {
            $Result | ConvertTo-Json -Depth 8
        } else {
            Write-Host "[WARN] Git is unavailable; changed files could not be determined." -ForegroundColor Yellow
        }
        if ($CheckAllowedFiles) { exit 2 }
        exit 0
    }

    & git -c core.autocrlf=false -C $RepositoryRoot rev-parse --git-dir 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Repository root is not a Git worktree: $RepositoryRoot"
    }

    $AllowedFiles = @()
    $PreflightFiles = @()
    if (Test-Path -LiteralPath $ManifestPath -PathType Leaf) {
        $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        if ($null -ne $Manifest.active_stage) {
            if ($null -ne $Manifest.active_stage.allowed_files) {
                $AllowedFiles = @($Manifest.active_stage.allowed_files | ForEach-Object {
                    ConvertTo-RootRelativePath -Path ([string]$_)
                })
            }
            if (
                $Manifest.active_stage.PSObject.Properties.Name -contains "preflight_changed_files" -and
                $null -ne $Manifest.active_stage.preflight_changed_files
            ) {
                $PreflightFiles = @($Manifest.active_stage.preflight_changed_files | ForEach-Object {
                    ConvertTo-RootRelativePath -Path ([string]$_)
                })
            }
        }
    } elseif ($CheckAllowedFiles) {
        throw "ROOT-MANIFEST.json is required for allowed-file checking."
    }

    $Unstaged = @(& git -c core.autocrlf=false -C $RepositoryRoot diff --name-only --diff-filter=ACDMRTUXB 2>$null |
        ForEach-Object { ConvertTo-RootRelativePath -Path ([string]$_) } |
        Where-Object { $_ })
    if ($LASTEXITCODE -ne 0) { throw "Git failed while reading unstaged changes." }

    $Staged = @(& git -c core.autocrlf=false -C $RepositoryRoot diff --cached --name-only --diff-filter=ACDMRTUXB 2>$null |
        ForEach-Object { ConvertTo-RootRelativePath -Path ([string]$_) } |
        Where-Object { $_ })
    if ($LASTEXITCODE -ne 0) { throw "Git failed while reading staged changes." }

    $Untracked = @(& git -c core.autocrlf=false -C $RepositoryRoot ls-files --others --exclude-standard 2>$null |
        ForEach-Object { ConvertTo-RootRelativePath -Path ([string]$_) } |
        Where-Object { $_ })
    if ($LASTEXITCODE -ne 0) { throw "Git failed while reading untracked files." }

    $AllPaths = @($Unstaged + $Staged + $Untracked | Sort-Object -Unique)
    $Changes = New-Object System.Collections.Generic.List[object]
    $Unauthorized = New-Object System.Collections.Generic.List[string]

    foreach ($Path in $AllPaths) {
        $IsUnstaged = $Unstaged -contains $Path
        $IsStaged = $Staged -contains $Path
        $IsUntracked = $Untracked -contains $Path
        $IsAllowed = Test-StagePathMatch -Path $Path -Candidates $AllowedFiles
        $IsPreflight = Test-StagePathMatch -Path $Path -Candidates $PreflightFiles
        $IsAuthorized = $IsPreflight -or (
            $IsAllowed -and (-not $IsUntracked -or $AllowUntracked)
        )
        if ($CheckAllowedFiles -and -not $IsAuthorized) {
            $Unauthorized.Add($Path)
        }

        $StatusParts = New-Object System.Collections.Generic.List[string]
        if ($IsStaged) { $StatusParts.Add("staged") }
        if ($IsUnstaged) { $StatusParts.Add("unstaged") }
        if ($IsUntracked) { $StatusParts.Add("untracked") }

        $Changes.Add([pscustomobject][ordered]@{
            path = $Path
            status = ($StatusParts -join ",")
            staged = $IsStaged
            unstaged = $IsUnstaged
            untracked = $IsUntracked
            allowed_by_stage = $IsAllowed
            present_at_preflight = $IsPreflight
            authorized = $IsAuthorized
        })
    }

    $Result = [ordered]@{
        repository = $RepositoryRoot
        git_available = $true
        check_allowed_files = [bool]$CheckAllowedFiles
        allow_untracked = [bool]$AllowUntracked
        change_count = $Changes.Count
        unauthorized_count = $Unauthorized.Count
        changes = @($Changes | ForEach-Object { $_ })
        unauthorized_files = @($Unauthorized | ForEach-Object { $_ })
    }

    if ($AsJson) {
        $Result | ConvertTo-Json -Depth 8
    } else {
        if ($Changes.Count -eq 0) {
            Write-Host "[PASS] No tracked, staged, or untracked non-ignored changes." -ForegroundColor Green
        } else {
            Write-Host "[INFO] Changed files: $($Changes.Count)" -ForegroundColor Cyan
            foreach ($Change in $Changes) {
                $Scope = if ($Change.present_at_preflight) {
                    "preflight"
                } elseif ($Change.allowed_by_stage) {
                    "allowed"
                } else {
                    "out-of-scope"
                }
                Write-Host ("[INFO] {0} [{1}; {2}]" -f $Change.path, $Change.status, $Scope)
            }
        }

        if ($CheckAllowedFiles) {
            if ($Unauthorized.Count -eq 0) {
                Write-Host "[PASS] Every changed file is allowed or recorded at preflight." -ForegroundColor Green
            } else {
                foreach ($Path in $Unauthorized) {
                    Write-Host "[FAIL] Unauthorized changed file: $Path" -ForegroundColor Red
                }
            }
        }
    }

    if ($CheckAllowedFiles -and $Unauthorized.Count -gt 0) { exit 1 }
    exit 0
} catch {
    if ($AsJson) {
        [ordered]@{
            repository = if ($null -ne (Get-Variable RepositoryRoot -ErrorAction SilentlyContinue)) { $RepositoryRoot } else { "" }
            git_available = $null
            check_allowed_files = [bool]$CheckAllowedFiles
            allow_untracked = [bool]$AllowUntracked
            change_count = 0
            unauthorized_count = 0
            changes = @()
            unauthorized_files = @()
            error = $_.Exception.Message
            error_at = $_.ScriptStackTrace
        } | ConvertTo-Json -Depth 8
    } else {
        Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ScriptStackTrace) { Write-Host "       $($_.ScriptStackTrace)" }
    }
    exit 2
}
