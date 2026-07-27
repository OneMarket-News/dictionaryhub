<#
.SYNOPSIS
Verification-gates and completes the active Root stage.

.PARAMETER SkipVerification
Explicitly skips required verifier execution and records that fact.

.PARAMETER UnresolvedManualCheck
Manual checks that remain unresolved at completion.

.PARAMETER CompletionNotes
Optional completion note stored with the completed stage.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$SkipVerification,

    [Parameter()]
    [string[]]$UnresolvedManualCheck = @(),

    [Parameter()]
    [string]$CompletionNotes = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    $Encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $Encoding)
}

function ConvertTo-SafeFullPath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $Normalized = $RelativePath.Trim().Replace("/", "\")
    if ([IO.Path]::IsPathRooted($Normalized) -or $Normalized -match '(^|\\)\.{1,2}(\\|$)') {
        throw "Unsafe repository-relative path: $RelativePath"
    }
    $Full = [IO.Path]::GetFullPath((Join-Path $script:RepositoryRoot $Normalized))
    if (-not $Full.StartsWith($script:RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes the repository: $RelativePath"
    }
    return $Full
}

function Get-ChangedFiles {
    if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) {
        return @("[Git unavailable]")
    }
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
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    if (
        $null -eq $Manifest.active_stage -or
        [string]$Manifest.active_stage.status -ne "active" -or
        [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.specification)
    ) {
        throw "No active stage exists."
    }

    $StagePath = ConvertTo-SafeFullPath -RelativePath ([string]$Manifest.active_stage.specification)
    if (-not (Test-Path -LiteralPath $StagePath -PathType Leaf)) {
        throw "Active stage specification is missing: $($Manifest.active_stage.specification)"
    }

    $VerifierResults = New-Object System.Collections.Generic.List[string]
    if ($SkipVerification) {
        Write-Host "[WARN] Required verification explicitly skipped." -ForegroundColor Yellow
        $VerifierResults.Add("SKIPPED explicitly with -SkipVerification")
    } else {
        $RequiredVerifiers = @($Manifest.active_stage.required_verifiers)
        if ($RequiredVerifiers.Count -eq 0) {
            throw "The active stage has no required verifiers."
        }
        $PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
        foreach ($VerifierValue in $RequiredVerifiers) {
            $VerifierRelative = [string]$VerifierValue
            $VerifierPath = ConvertTo-SafeFullPath -RelativePath $VerifierRelative
            if (-not (Test-Path -LiteralPath $VerifierPath -PathType Leaf)) {
                throw "Required verifier is missing: $VerifierRelative"
            }
            Write-Host "[INFO] Running required verifier: $VerifierRelative" -ForegroundColor Cyan
            & $PowerShell -NoProfile -ExecutionPolicy Bypass -File $VerifierPath
            $VerifierExitCode = $LASTEXITCODE
            $VerifierResults.Add("$VerifierRelative -> exit $VerifierExitCode")
            if ($VerifierExitCode -ne 0) {
                throw "Required verifier failed: $VerifierRelative (exit $VerifierExitCode)"
            }
        }
    }

    $CompletedDirectory = Join-Path $script:RepositoryRoot "docs\stages\completed"
    if (-not (Test-Path -LiteralPath $CompletedDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $CompletedDirectory | Out-Null
    }
    $DatePrefix = (Get-Date).ToString("yyyyMMdd")
    $BaseName = "$DatePrefix-$($Manifest.active_stage.slug).md"
    $CompletedPath = Join-Path $CompletedDirectory $BaseName
    $Counter = 1
    while (Test-Path -LiteralPath $CompletedPath) {
        $CompletedPath = Join-Path $CompletedDirectory ("{0}-{1:D2}-{2}.md" -f $DatePrefix, $Counter, $Manifest.active_stage.slug)
        $Counter++
    }

    Move-Item -LiteralPath $StagePath -Destination $CompletedPath
    $ChangedFiles = @(Get-ChangedFiles)
    $CompletionBuilder = New-Object Text.StringBuilder
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("## Completion record")
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("- Completion date: $([DateTimeOffset]::Now.ToString("o"))")
    [void]$CompletionBuilder.AppendLine("- Verification skipped: $([bool]$SkipVerification)")
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("### Verifier results")
    [void]$CompletionBuilder.AppendLine()
    foreach ($Result in $VerifierResults) {
        [void]$CompletionBuilder.AppendLine("- $Result")
    }
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("### Changed files")
    [void]$CompletionBuilder.AppendLine()
    if ($ChangedFiles.Count -eq 0) {
        [void]$CompletionBuilder.AppendLine("- None")
    } else {
        foreach ($Path in $ChangedFiles) {
            [void]$CompletionBuilder.AppendLine("- ``$Path``")
        }
    }
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("### Unresolved manual checks")
    [void]$CompletionBuilder.AppendLine()
    if ($UnresolvedManualCheck.Count -eq 0) {
        [void]$CompletionBuilder.AppendLine("- None reported")
    } else {
        foreach ($Check in $UnresolvedManualCheck) {
            [void]$CompletionBuilder.AppendLine("- $Check")
        }
    }
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("### Completion notes")
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine($(if ([string]::IsNullOrWhiteSpace($CompletionNotes)) { "None." } else { $CompletionNotes.Trim() }))

    $CompletedText = Get-Content -LiteralPath $CompletedPath -Raw
    Write-Utf8File -Path $CompletedPath -Content ($CompletedText.TrimEnd() + "`r`n" + $CompletionBuilder.ToString())

    $Manifest.active_stage = [pscustomobject][ordered]@{
        name = ""
        slug = ""
        specification = ""
        allowed_files = @()
        required_verifiers = @()
        preflight_changed_files = @()
        status = "inactive"
    }
    $ManifestJson = $Manifest | ConvertTo-Json -Depth 30
    $null = $ManifestJson | ConvertFrom-Json
    Write-Utf8File -Path $ManifestPath -Content ($ManifestJson + "`r`n")

    $CompletedRelative = $CompletedPath.Substring($script:RepositoryRoot.Length + 1).Replace("\", "/")
    Write-Host "[PASS] Stage completed: $CompletedRelative" -ForegroundColor Green
    Write-Host "[INFO] The manifest active stage is now inactive." -ForegroundColor Cyan
    Write-Host "[INFO] No commit or push was performed." -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
