<#
.SYNOPSIS
Exports a compact, derived DictionaryRoot development context.

.PARAMETER IncludeFile
Repository-relative text files to include explicitly.

.PARAMETER MaxCharactersPerFile
Maximum characters retained from each included or summarized file.

.PARAMETER IncludeGitDiff
Includes a bounded current tracked-file diff.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string[]]$IncludeFile = @(),

    [Parameter()]
    [ValidateRange(256, 50000)]
    [int]$MaxCharactersPerFile = 4000,

    [Parameter()]
    [switch]$IncludeGitDiff
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )
    $Encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $Encoding)
}

function ConvertTo-RelativePath {
    param([Parameter(Mandatory = $true)][string]$FullPath)
    $Resolved = [IO.Path]::GetFullPath($FullPath)
    if (-not $Resolved.StartsWith($script:RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside the repository: $FullPath"
    }
    return $Resolved.Substring($script:RepositoryRoot.Length + 1).Replace("\", "/")
}

function Resolve-InRepositoryFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    $Candidate = if ([IO.Path]::IsPathRooted($Path)) {
        [IO.Path]::GetFullPath($Path)
    } else {
        [IO.Path]::GetFullPath((Join-Path $script:RepositoryRoot ($Path -replace "/", "\")))
    }
    if (-not $Candidate.StartsWith($script:RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Requested path is outside the repository: $Path"
    }
    if (-not (Test-Path -LiteralPath $Candidate -PathType Leaf)) {
        throw "Requested file does not exist: $Path"
    }
    return $Candidate
}

function Test-ExcludedPath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $Normalized = $RelativePath.Replace("\", "/").TrimStart("/")
    foreach ($Value in $script:ExcludedPaths) {
        $Excluded = ([string]$Value).Replace("\", "/").TrimStart("/")
        if ($Excluded.EndsWith("/")) {
            if ($Normalized.StartsWith($Excluded, [StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
        } elseif ($Normalized.Equals($Excluded, [StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Test-SensitivePath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $Normalized = $RelativePath.Replace("\", "/")
    $Name = [IO.Path]::GetFileName($Normalized)
    return (
        $Name -eq ".env" -or
        $Name.StartsWith(".env.", [StringComparison]::OrdinalIgnoreCase) -or
        $Normalized -match '(?i)(^|/)(credential|credentials|secret|secrets|token|tokens)(/|\.|$)' -or
        $Normalized -match '(?i)\.(pfx|p12|pem|key|keystore)$'
    )
}

function Test-TextFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    $AllowedExtensions = @(
        ".md", ".txt", ".json", ".html", ".css", ".js", ".mjs", ".cjs",
        ".ts", ".tsx", ".ps1", ".psm1", ".yml", ".yaml", ".xml", ".svg",
        ".sql", ".example", ".gitignore"
    )
    $Name = [IO.Path]::GetFileName($Path)
    if ($Name -eq ".gitignore") { return $true }
    return $AllowedExtensions -contains [IO.Path]::GetExtension($Path).ToLowerInvariant()
}

function Get-BoundedText {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][int]$Limit
    )
    $Text = Get-Content -LiteralPath $Path -Raw
    if ($Text.Length -le $Limit) { return $Text }
    return $Text.Substring(0, $Limit) + "`r`n`r`n[TRUNCATED after $Limit characters]"
}

function Add-Bullets {
    param(
        [Parameter(Mandatory = $true)][Text.StringBuilder]$Builder,
        [object[]]$Values
    )
    $Items = @($Values)
    if ($Items.Count -eq 0) {
        [void]$Builder.AppendLine("- None")
        return
    }
    foreach ($Value in $Items) {
        [void]$Builder.AppendLine("- ``$([string]$Value)``")
    }
}

try {
    $script:RepositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..")).TrimEnd("\", "/")
    $ManifestPath = Join-Path $script:RepositoryRoot "ROOT-MANIFEST.json"
    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        throw "ROOT-MANIFEST.json is missing."
    }
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $script:ExcludedPaths = @($Manifest.excluded_paths)

    $OutputDirectory = Join-Path $script:RepositoryRoot ".root-context"
    if (-not (Test-Path -LiteralPath $OutputDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
    }
    $OutputPath = Join-Path $OutputDirectory "ROOT-CONTEXT.md"

    $Builder = New-Object Text.StringBuilder
    [void]$Builder.AppendLine("# DictionaryRoot Compact Repository Context")
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("> Derived development artifact generated from the checked-out repository.")
    [void]$Builder.AppendLine("> It is not a source of truth and must not replace current source inspection.")
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("Generated: $([DateTimeOffset]::Now.ToString("o"))")
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("## Project identity")
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("- Name: $($Manifest.project.name)")
    [void]$Builder.AppendLine("- Platform: $($Manifest.project.platform)")
    [void]$Builder.AppendLine("- Type: $($Manifest.project.repository_type)")
    [void]$Builder.AppendLine("- Status: $($Manifest.project.status)")
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("## Active stage")
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("- Name: $($Manifest.active_stage.name)")
    [void]$Builder.AppendLine("- Slug: $($Manifest.active_stage.slug)")
    [void]$Builder.AppendLine("- Status: $($Manifest.active_stage.status)")
    [void]$Builder.AppendLine("- Specification: ``$($Manifest.active_stage.specification)``")
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("### Allowed files")
    [void]$Builder.AppendLine()
    Add-Bullets -Builder $Builder -Values @($Manifest.active_stage.allowed_files)
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("### Required verifiers")
    [void]$Builder.AppendLine()
    Add-Bullets -Builder $Builder -Values @($Manifest.active_stage.required_verifiers)
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("## Canonical experiences")
    [void]$Builder.AppendLine()
    foreach ($Property in $Manifest.canonical_experiences.PSObject.Properties) {
        $Experience = $Property.Value
        [void]$Builder.AppendLine("- $($Experience.name): ``$($Experience.file)`` -> ``$($Experience.page_script)``")
    }
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("## Shared assets")
    [void]$Builder.AppendLine()
    foreach ($Property in $Manifest.shared_assets.PSObject.Properties) {
        [void]$Builder.AppendLine("### $($Property.Name)")
        [void]$Builder.AppendLine()
        Add-Bullets -Builder $Builder -Values @($Property.Value)
        [void]$Builder.AppendLine()
    }
    [void]$Builder.AppendLine("## Protected capabilities")
    [void]$Builder.AppendLine()
    Add-Bullets -Builder $Builder -Values @($Manifest.protected_capabilities)
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("## Excluded paths")
    [void]$Builder.AppendLine()
    Add-Bullets -Builder $Builder -Values @($Manifest.excluded_paths)
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("## Changed-file summary")
    [void]$Builder.AppendLine()
    $StatusLines = @(& git -c core.autocrlf=false -C $script:RepositoryRoot status --short --untracked-files=all 2>$null)
    if ($LASTEXITCODE -eq 0) {
        if ($StatusLines.Count -eq 0) {
            [void]$Builder.AppendLine("- No tracked, staged, or untracked non-ignored changes.")
        } else {
            foreach ($Line in $StatusLines) {
                [void]$Builder.AppendLine("- ``$($Line.TrimEnd())``")
            }
        }
    } else {
        [void]$Builder.AppendLine("- [WARN] Git status could not be read.")
        Write-Host "[WARN] Git status could not be read." -ForegroundColor Yellow
    }
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("## Selected architecture summary")
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine('```text')
    [void]$Builder.AppendLine((Get-BoundedText -Path (Join-Path $script:RepositoryRoot "ROOT-ARCHITECTURE.md") -Limit $MaxCharactersPerFile))
    [void]$Builder.AppendLine('```')
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine("## Selected protected-functionality summary")
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine('```text')
    [void]$Builder.AppendLine((Get-BoundedText -Path (Join-Path $script:RepositoryRoot "ROOT-PROTECTED-FUNCTIONALITY.md") -Limit $MaxCharactersPerFile))
    [void]$Builder.AppendLine('```')
    [void]$Builder.AppendLine()

    if ($IncludeFile.Count -gt 0) {
        [void]$Builder.AppendLine("## Explicitly included files")
        [void]$Builder.AppendLine()
        foreach ($RequestedPath in $IncludeFile) {
            try {
                $FullPath = Resolve-InRepositoryFile -Path $RequestedPath
                $RelativePath = ConvertTo-RelativePath -FullPath $FullPath
                if (Test-ExcludedPath -RelativePath $RelativePath) {
                    Write-Host "[WARN] Skipped excluded path: $RelativePath" -ForegroundColor Yellow
                    [void]$Builder.AppendLine("- [WARN] Excluded path skipped: ``$RelativePath``")
                    continue
                }
                if (Test-SensitivePath -RelativePath $RelativePath) {
                    Write-Host "[WARN] Skipped potentially sensitive path: $RelativePath" -ForegroundColor Yellow
                    [void]$Builder.AppendLine("- [WARN] Potentially sensitive path skipped: ``$RelativePath``")
                    continue
                }
                if (-not (Test-TextFile -Path $FullPath)) {
                    Write-Host "[WARN] Skipped non-text path: $RelativePath" -ForegroundColor Yellow
                    [void]$Builder.AppendLine("- [WARN] Non-text path skipped: ``$RelativePath``")
                    continue
                }
                [void]$Builder.AppendLine("### ``$RelativePath``")
                [void]$Builder.AppendLine()
                [void]$Builder.AppendLine('```text')
                [void]$Builder.AppendLine((Get-BoundedText -Path $FullPath -Limit $MaxCharactersPerFile))
                [void]$Builder.AppendLine('```')
                [void]$Builder.AppendLine()
            } catch {
                Write-Host "[WARN] $($_.Exception.Message)" -ForegroundColor Yellow
                [void]$Builder.AppendLine("- [WARN] $($_.Exception.Message)")
            }
        }
    }

    if ($IncludeGitDiff) {
        [void]$Builder.AppendLine("## Bounded tracked-file diff")
        [void]$Builder.AppendLine()
        $Diff = (& git -c core.autocrlf=false -C $script:RepositoryRoot diff --no-ext-diff --unified=1 2>$null) -join "`n"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN] Git diff could not be read." -ForegroundColor Yellow
            [void]$Builder.AppendLine("[WARN] Git diff could not be read.")
        } elseif ([string]::IsNullOrWhiteSpace($Diff)) {
            [void]$Builder.AppendLine("No unstaged tracked-file diff.")
        } else {
            $DiffLimit = [Math]::Min(20000, $MaxCharactersPerFile * 3)
            if ($Diff.Length -gt $DiffLimit) {
                $Diff = $Diff.Substring(0, $DiffLimit) + "`n`n[TRUNCATED after $DiffLimit characters]"
            }
            [void]$Builder.AppendLine('```diff')
            [void]$Builder.AppendLine($Diff)
            [void]$Builder.AppendLine('```')
        }
        [void]$Builder.AppendLine()
    }

    [void]$Builder.AppendLine("## Next recommended commands")
    [void]$Builder.AppendLine()
    [void]$Builder.AppendLine('```powershell')
    [void]$Builder.AppendLine('powershell -ExecutionPolicy Bypass -File ".\tools\GET-ROOT-CHANGED-FILES.ps1" -CheckAllowedFiles -AllowUntracked')
    foreach ($Verifier in @($Manifest.active_stage.required_verifiers)) {
        [void]$Builder.AppendLine("powershell -ExecutionPolicy Bypass -File `".\$Verifier`"")
    }
    [void]$Builder.AppendLine('```')

    Write-Utf8File -Path $OutputPath -Content $Builder.ToString()
    Write-Host "[PASS] Root context exported: $OutputPath" -ForegroundColor Green
    Write-Host "[INFO] The file is derived and ignored by Git." -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
