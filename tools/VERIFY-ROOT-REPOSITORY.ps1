<#
.SYNOPSIS
Verifies DictionaryRoot repository governance and protected static structure.

.DESCRIPTION
Checks foundation files, manifest safety, declared experiences and assets,
canonical HTML structure, JavaScript syntax, forbidden runtime fallback
patterns, active-stage scope, and existing verifier discovery.

.PARAMETER RepositoryPath
Optional repository path. Defaults to the parent of this script directory.

.PARAMETER RunExistingVerifiers
Runs each discovered root VERIFY-*.ps1 except VERIFY-ROOT-REPOSITORY.ps1.
Existing verifiers are otherwise discovered and reported only.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "",

    [Parameter()]
    [switch]$RunExistingVerifiers
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:PassCount = 0
$script:WarningCount = 0
$script:FailureCount = 0
$script:InfoCount = 0

function Write-VerificationPass {
    param([string]$Name, [string]$Detail = "")
    $script:PassCount++
    Write-Host "[PASS] $Name" -ForegroundColor Green
    if ($Detail) { Write-Host "       $Detail" }
}

function Write-VerificationFail {
    param([string]$Name, [string]$Detail = "")
    $script:FailureCount++
    Write-Host "[FAIL] $Name" -ForegroundColor Red
    if ($Detail) { Write-Host "       $Detail" }
}

function Write-VerificationWarning {
    param([string]$Name, [string]$Detail = "")
    $script:WarningCount++
    Write-Host "[WARN] $Name" -ForegroundColor Yellow
    if ($Detail) { Write-Host "       $Detail" }
}

function Write-VerificationInfo {
    param([string]$Name, [string]$Detail = "")
    $script:InfoCount++
    Write-Host "[INFO] $Name" -ForegroundColor Cyan
    if ($Detail) { Write-Host "       $Detail" }
}

function Resolve-RepositoryRoot {
    $Candidate = if ([string]::IsNullOrWhiteSpace($RepositoryPath)) {
        Join-Path $PSScriptRoot ".."
    } else {
        $RepositoryPath
    }
    if (-not (Test-Path -LiteralPath $Candidate -PathType Container)) {
        throw "Repository path does not exist: $Candidate"
    }
    $Resolved = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Candidate).Path).TrimEnd("\", "/")
    if (
        -not (Test-Path -LiteralPath (Join-Path $Resolved "index.html") -PathType Leaf) -or
        -not (Test-Path -LiteralPath (Join-Path $Resolved "config\customers\dictionaryroot.json") -PathType Leaf)
    ) {
        throw "Path is not the DictionaryRoot repository: $Resolved"
    }
    return $Resolved
}

function Resolve-RepositoryRelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [switch]$AllowDirectoryMarker
    )
    if (
        [string]::IsNullOrWhiteSpace($RelativePath) -or
        [IO.Path]::IsPathRooted($RelativePath) -or
        $RelativePath.Contains("\") -or
        $RelativePath -match '(^|/)\.{1,2}(/|$)'
    ) {
        throw "Unsafe repository-relative path: $RelativePath"
    }
    $Normalized = if ($AllowDirectoryMarker) { $RelativePath.TrimEnd("/") } else { $RelativePath }
    if ([string]::IsNullOrWhiteSpace($Normalized)) {
        throw "Unsafe empty repository-relative path: $RelativePath"
    }
    $Full = [IO.Path]::GetFullPath((Join-Path $script:RepositoryRoot ($Normalized -replace "/", "\")))
    if (-not $Full.StartsWith($script:RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes the repository: $RelativePath"
    }
    return $Full
}

function ConvertTo-RepositoryRelativePath {
    param([Parameter(Mandatory = $true)][string]$FullPath)
    $Resolved = [IO.Path]::GetFullPath($FullPath)
    if (-not $Resolved.StartsWith($script:RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside the repository: $FullPath"
    }
    return $Resolved.Substring($script:RepositoryRoot.Length + 1).Replace("\", "/")
}

function Test-RequiredFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    try {
        $FullPath = Resolve-RepositoryRelativePath -RelativePath $RelativePath
        if (Test-Path -LiteralPath $FullPath -PathType Leaf) {
            Write-VerificationPass "Required file: $RelativePath"
            return $true
        }
        Write-VerificationFail "Required file: $RelativePath" "File is missing."
        return $false
    } catch {
        Write-VerificationFail "Required file: $RelativePath" $_.Exception.Message
        return $false
    }
}

function Test-JsonFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    try {
        $FullPath = Resolve-RepositoryRelativePath -RelativePath $RelativePath
        $Parsed = Get-Content -LiteralPath $FullPath -Raw | ConvertFrom-Json
        Write-VerificationPass "Valid JSON: $RelativePath"
        return $Parsed
    } catch {
        Write-VerificationFail "Valid JSON: $RelativePath" $_.Exception.Message
        return $null
    }
}

function Test-Property {
    param(
        [Parameter(Mandatory = $true)][object]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )
    return $null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name
}

function Test-SafeManifestPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [switch]$AllowDirectoryMarker
    )
    try {
        $null = Resolve-RepositoryRelativePath -RelativePath $Path -AllowDirectoryMarker:$AllowDirectoryMarker
        return $true
    } catch {
        return $false
    }
}

function Test-ExcludedReference {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string[]]$ExcludedPaths
    )
    $Normalized = $RelativePath.Replace("\", "/").TrimStart("/")
    foreach ($Value in $ExcludedPaths) {
        $Excluded = ([string]$Value).Replace("\", "/").TrimStart("/")
        if ($Excluded.EndsWith("/")) {
            if ($Normalized.StartsWith($Excluded, [StringComparison]::OrdinalIgnoreCase)) { return $true }
        } elseif ($Normalized.Equals($Excluded, [StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Test-CanonicalHtml {
    param(
        [Parameter(Mandatory = $true)][object]$Experience,
        [Parameter(Mandatory = $true)][string[]]$ExcludedPaths
    )
    $PageRelative = [string]$Experience.file
    try {
        $PagePath = Resolve-RepositoryRelativePath -RelativePath $PageRelative
        if (-not (Test-Path -LiteralPath $PagePath -PathType Leaf)) { return }
        $Text = Get-Content -LiteralPath $PagePath -Raw

        $IdMatches = [regex]::Matches(
            $Text,
            '\bid\s*=\s*["''](?<id>[^"'']+)["'']',
            [Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
        $DuplicateIds = @($IdMatches |
            ForEach-Object { $_.Groups["id"].Value } |
            Group-Object |
            Where-Object { $_.Count -gt 1 } |
            Select-Object -ExpandProperty Name)
        if ($DuplicateIds.Count -eq 0) {
            Write-VerificationPass "$PageRelative has unique static HTML IDs" "$($IdMatches.Count) IDs inspected."
        } else {
            Write-VerificationFail "$PageRelative has unique static HTML IDs" "Duplicates: $($DuplicateIds -join ', ')"
        }

        $ReferenceMatches = New-Object System.Collections.Generic.List[object]
        foreach ($Match in [regex]::Matches(
            $Text,
            '<script\b[^>]*\bsrc\s*=\s*["''](?<path>[^"'']+)["'']',
            [Text.RegularExpressions.RegexOptions]::IgnoreCase
        )) {
            $ReferenceMatches.Add($Match)
        }
        foreach ($Match in [regex]::Matches(
            $Text,
            '<link\b[^>]*\bhref\s*=\s*["''](?<path>[^"'']+)["'']',
            [Text.RegularExpressions.RegexOptions]::IgnoreCase
        )) {
            $ReferenceMatches.Add($Match)
        }

        $MissingReferences = New-Object System.Collections.Generic.List[string]
        $ExcludedReferences = New-Object System.Collections.Generic.List[string]
        $UnsafeReferences = New-Object System.Collections.Generic.List[string]
        $PageDirectory = Split-Path -Parent $PagePath
        foreach ($Match in $ReferenceMatches) {
            $Reference = $Match.Groups["path"].Value.Trim()
            if ([string]::IsNullOrWhiteSpace($Reference) -or $Reference -match '^(?:[a-z][a-z0-9+.-]*:|//|#)') {
                continue
            }
            $PathOnly = ($Reference -split '[?#]', 2)[0]
            try {
                $FullReference = [IO.Path]::GetFullPath((Join-Path $PageDirectory ($PathOnly -replace "/", "\")))
                if (-not $FullReference.StartsWith($script:RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
                    $UnsafeReferences.Add($Reference)
                    continue
                }
                $RelativeReference = ConvertTo-RepositoryRelativePath -FullPath $FullReference
                if (Test-ExcludedReference -RelativePath $RelativeReference -ExcludedPaths $ExcludedPaths) {
                    $ExcludedReferences.Add($RelativeReference)
                }
                if (-not (Test-Path -LiteralPath $FullReference -PathType Leaf)) {
                    $MissingReferences.Add($RelativeReference)
                }
            } catch {
                $UnsafeReferences.Add($Reference)
            }
        }
        if ($MissingReferences.Count -eq 0 -and $UnsafeReferences.Count -eq 0) {
            Write-VerificationPass "$PageRelative local script/link references" "$($ReferenceMatches.Count) references inspected."
        } else {
            Write-VerificationFail "$PageRelative local script/link references" "Missing: $($MissingReferences -join ', '); unsafe: $($UnsafeReferences -join ', ')"
        }
        if ($ExcludedReferences.Count -eq 0) {
            Write-VerificationPass "$PageRelative avoids excluded paths"
        } else {
            Write-VerificationFail "$PageRelative avoids excluded paths" ($ExcludedReferences -join ", ")
        }

        $PreviousIndex = -1
        $OrderFailures = New-Object System.Collections.Generic.List[string]
        foreach ($ScriptPathValue in @($Experience.initialization_order)) {
            $ScriptPath = [string]$ScriptPathValue
            $CurrentIndex = $Text.IndexOf($ScriptPath, [StringComparison]::Ordinal)
            if ($CurrentIndex -lt 0) {
                $OrderFailures.Add("missing $ScriptPath")
            } elseif ($CurrentIndex -le $PreviousIndex) {
                $OrderFailures.Add("out of order $ScriptPath")
            } else {
                $PreviousIndex = $CurrentIndex
            }
        }
        if ($OrderFailures.Count -eq 0) {
            Write-VerificationPass "$PageRelative protected initialization order"
        } else {
            Write-VerificationFail "$PageRelative protected initialization order" ($OrderFailures -join "; ")
        }
    } catch {
        Write-VerificationFail "$PageRelative HTML verification" $_.Exception.Message
    }
}

try {
    $script:RepositoryRoot = Resolve-RepositoryRoot
} catch {
    Write-Host "[FAIL] Repository location: $($_.Exception.Message)" -ForegroundColor Red
    exit 2
}

Write-Host "DictionaryRoot root repository verifier v1" -ForegroundColor Cyan
Write-Host "Repository: $script:RepositoryRoot"
Write-Host ""
Write-VerificationInfo "Verification boundary" "Static repository checks only; no browser, live API, database, installer, or existing stage verifier is run by default."

$RequiredFiles = @(
    "AGENTS.md",
    "ROOT-MANIFEST.json",
    "ROOT-ARCHITECTURE.md",
    "ROOT-PROTECTED-FUNCTIONALITY.md",
    "ROOT-VERIFICATION.md",
    "docs/stages/completed/.gitkeep",
    "docs/stages/templates/ROOT-STAGE-TEMPLATE.md",
    "tools/NEW-ROOT-STAGE.ps1",
    "tools/SET-ACTIVE-ROOT-STAGE.ps1",
    "tools/COMPLETE-ROOT-STAGE.ps1",
    "tools/EXPORT-ROOT-CONTEXT.ps1",
    "tools/GET-ROOT-CHANGED-FILES.ps1",
    "tools/VERIFY-ROOT-REPOSITORY.ps1",
    "VERIFY-ROOT-REPOSITORY.ps1"
)
foreach ($RequiredFile in $RequiredFiles) {
    $null = Test-RequiredFile -RelativePath $RequiredFile
}

$PowerShellParseFailures = New-Object System.Collections.Generic.List[string]
foreach ($ScriptRelativePath in @($RequiredFiles | Where-Object { $_.EndsWith(".ps1", [StringComparison]::OrdinalIgnoreCase) })) {
    $Tokens = $null
    $ParseErrors = $null
    $ScriptFullPath = Resolve-RepositoryRelativePath -RelativePath $ScriptRelativePath
    $null = [Management.Automation.Language.Parser]::ParseFile(
        $ScriptFullPath,
        [ref]$Tokens,
        [ref]$ParseErrors
    )
    foreach ($ParseError in @($ParseErrors)) {
        $PowerShellParseFailures.Add("$ScriptRelativePath`: $($ParseError.Message)")
    }
}
if ($PowerShellParseFailures.Count -eq 0) {
    Write-VerificationPass "Foundation PowerShell syntax" "7 scripts parsed by Windows PowerShell."
} else {
    Write-VerificationFail "Foundation PowerShell syntax" ($PowerShellParseFailures -join "; ")
}

$Manifest = Test-JsonFile -RelativePath "ROOT-MANIFEST.json"
if ($null -eq $Manifest) {
    Write-Host ""
    Write-Host "Repository verifier summary" -ForegroundColor Cyan
    Write-Host "Pass count:    $script:PassCount"
    Write-Host "Warning count: $script:WarningCount"
    Write-Host "Failure count: $script:FailureCount"
    Write-Host "Overall result: FAIL"
    exit 1
}

$IsActiveStage = (
    $null -ne $Manifest.active_stage -and
    [string]$Manifest.active_stage.status -eq "active"
)

$RequiredManifestSections = @(
    "schema_version", "project", "canonical_experiences", "shared_assets",
    "protected_capabilities", "repository_rules", "excluded_paths",
    "known_verifiers", "known_installers", "active_stage"
)
$MissingSections = @($RequiredManifestSections | Where-Object { -not (Test-Property -Object $Manifest -Name $_) })
if ($MissingSections.Count -eq 0) {
    Write-VerificationPass "Required manifest sections" "$($RequiredManifestSections.Count) sections found."
} else {
    Write-VerificationFail "Required manifest sections" "Missing: $($MissingSections -join ', ')"
}

if (
    [string]$Manifest.schema_version -eq "1.0.0" -and
    [string]$Manifest.project.name -eq "DictionaryRoot" -and
    [string]$Manifest.project.platform -eq "SourceRoot"
) {
    Write-VerificationPass "Manifest project identity"
} else {
    Write-VerificationFail "Manifest project identity" "Expected schema 1.0.0, DictionaryRoot, and SourceRoot."
}

$ManifestPathValues = New-Object System.Collections.Generic.List[object]
foreach ($Property in $Manifest.canonical_experiences.PSObject.Properties) {
    $Experience = $Property.Value
    $ManifestPathValues.Add([pscustomobject]@{ path = [string]$Experience.file; directory = $false; kind = "canonical file" })
    $ManifestPathValues.Add([pscustomobject]@{ path = [string]$Experience.page_script; directory = $false; kind = "page script" })
    foreach ($Path in @($Experience.initialization_order)) {
        $ManifestPathValues.Add([pscustomobject]@{ path = [string]$Path; directory = $false; kind = "initialization path" })
    }
}
foreach ($Property in $Manifest.shared_assets.PSObject.Properties) {
    foreach ($Path in @($Property.Value)) {
        $ManifestPathValues.Add([pscustomobject]@{ path = [string]$Path; directory = $false; kind = "shared asset" })
    }
}
foreach ($Path in @($Manifest.known_verifiers)) {
    $ManifestPathValues.Add([pscustomobject]@{ path = [string]$Path; directory = $false; kind = "known verifier" })
}
foreach ($Path in @($Manifest.known_installers)) {
    $ManifestPathValues.Add([pscustomobject]@{ path = [string]$Path; directory = $false; kind = "known installer" })
}
if ($IsActiveStage) {
    $ManifestPathValues.Add([pscustomobject]@{ path = [string]$Manifest.active_stage.specification; directory = $false; kind = "active specification" })
    foreach ($Path in @($Manifest.active_stage.allowed_files)) {
        $ManifestPathValues.Add([pscustomobject]@{ path = [string]$Path; directory = ([string]$Path).EndsWith("/"); kind = "allowed file" })
    }
    foreach ($Path in @($Manifest.active_stage.required_verifiers)) {
        $ManifestPathValues.Add([pscustomobject]@{ path = [string]$Path; directory = $false; kind = "required verifier" })
    }
}
foreach ($Path in @($Manifest.excluded_paths)) {
    $ManifestPathValues.Add([pscustomobject]@{ path = [string]$Path; directory = ([string]$Path).EndsWith("/"); kind = "excluded path" })
}

$UnsafeManifestPaths = @($ManifestPathValues | Where-Object {
    -not (Test-SafeManifestPath -Path $_.path -AllowDirectoryMarker:$_.directory)
})
if ($UnsafeManifestPaths.Count -eq 0) {
    Write-VerificationPass "Manifest paths are repository-relative and contained" "$($ManifestPathValues.Count) path declarations checked."
} else {
    Write-VerificationFail "Manifest paths are repository-relative and contained" (($UnsafeManifestPaths | ForEach-Object { "$($_.kind):$($_.path)" }) -join ", ")
}

$AllowedFiles = @($Manifest.active_stage.allowed_files | ForEach-Object { [string]$_ })
$DuplicateAllowed = @($AllowedFiles | Group-Object | Where-Object { $_.Count -gt 1 } | Select-Object -ExpandProperty Name)
$MissingFoundationAllowances = @()
if ([string]$Manifest.active_stage.slug -eq "DICTIONARYROOT-CODEX-EFFICIENCY-FOUNDATION-V1") {
    $FoundationAllowedPaths = @(".gitignore", "docs/stages/active/CURRENT-STAGE.md") + $RequiredFiles
    $MissingFoundationAllowances = @($FoundationAllowedPaths | Where-Object { $AllowedFiles -notcontains $_ })
}
if (-not $IsActiveStage) {
    if ($AllowedFiles.Count -eq 0 -and $DuplicateAllowed.Count -eq 0) {
        Write-VerificationPass "Inactive-stage allowed_files" "No active scope is declared."
    } else {
        Write-VerificationFail "Inactive-stage allowed_files" "An inactive stage must not retain allowed files."
    }
} elseif ($AllowedFiles.Count -gt 0 -and $DuplicateAllowed.Count -eq 0 -and $MissingFoundationAllowances.Count -eq 0) {
    Write-VerificationPass "Active-stage allowed_files" "$($AllowedFiles.Count) unique repository-relative paths."
} else {
    Write-VerificationFail "Active-stage allowed_files" "Count: $($AllowedFiles.Count); duplicates: $($DuplicateAllowed -join ', '); missing foundation paths: $($MissingFoundationAllowances -join ', ')"
}

if ($IsActiveStage) {
    if (
        -not [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.name) -and
        -not [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.slug)
    ) {
        Write-VerificationPass "Active-stage identity" "$($Manifest.active_stage.name) [$($Manifest.active_stage.slug)]"
    } else {
        Write-VerificationFail "Active-stage identity" "An active stage must have a name and slug."
    }
} else {
    if (
        [string]$Manifest.active_stage.status -eq "inactive" -and
        [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.name) -and
        [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.slug)
    ) {
        Write-VerificationPass "Inactive-stage identity" "No active stage is currently selected."
    } else {
        Write-VerificationFail "Inactive-stage identity" "Inactive stage state is inconsistent."
    }
}

if ($IsActiveStage) {
    try {
        $ActiveSpecPath = Resolve-RepositoryRelativePath -RelativePath ([string]$Manifest.active_stage.specification)
        if (Test-Path -LiteralPath $ActiveSpecPath -PathType Leaf) {
            Write-VerificationPass "Active-stage specification exists" ([string]$Manifest.active_stage.specification)
        } else {
            Write-VerificationFail "Active-stage specification exists" ([string]$Manifest.active_stage.specification)
        }
    } catch {
        Write-VerificationFail "Active-stage specification exists" $_.Exception.Message
    }
} elseif ([string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.specification)) {
    Write-VerificationPass "Inactive-stage specification" "No active specification is declared."
} else {
    Write-VerificationFail "Inactive-stage specification" "Inactive stage retains a specification path."
}

$RequiredExclusions = @(".git/", ".root-context/", "backups/", "backend/node_modules/", "backend/dist/")
$MissingExclusions = @($RequiredExclusions | Where-Object { @($Manifest.excluded_paths) -notcontains $_ })
if ($MissingExclusions.Count -eq 0) {
    Write-VerificationPass "Required excluded paths recorded" "$($Manifest.excluded_paths.Count) exclusions declared."
} else {
    Write-VerificationFail "Required excluded paths recorded" "Missing: $($MissingExclusions -join ', ')"
}

foreach ($Property in $Manifest.canonical_experiences.PSObject.Properties) {
    $Experience = $Property.Value
    $Exists = $true
    foreach ($Path in @([string]$Experience.file, [string]$Experience.page_script)) {
        try {
            if (-not (Test-Path -LiteralPath (Resolve-RepositoryRelativePath -RelativePath $Path) -PathType Leaf)) {
                $Exists = $false
            }
        } catch {
            $Exists = $false
        }
    }
    if ($Exists) {
        Write-VerificationPass "Canonical experience: $($Experience.name)" "$($Experience.file)"
    } else {
        Write-VerificationFail "Canonical experience: $($Experience.name)" "Declared page or page script is missing."
    }
}

$MissingSharedAssets = New-Object System.Collections.Generic.List[string]
$SharedAssetCount = 0
foreach ($Property in $Manifest.shared_assets.PSObject.Properties) {
    foreach ($PathValue in @($Property.Value)) {
        $SharedAssetCount++
        $Path = [string]$PathValue
        try {
            if (-not (Test-Path -LiteralPath (Resolve-RepositoryRelativePath -RelativePath $Path) -PathType Leaf)) {
                $MissingSharedAssets.Add($Path)
            }
        } catch {
            $MissingSharedAssets.Add($Path)
        }
    }
}
if ($MissingSharedAssets.Count -eq 0) {
    Write-VerificationPass "Declared shared assets exist" "$SharedAssetCount declarations inspected."
} else {
    Write-VerificationFail "Declared shared assets exist" ($MissingSharedAssets -join ", ")
}

$MissingKnownVerifiers = @($Manifest.known_verifiers | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot ([string]$_)) -PathType Leaf)
})
if ($MissingKnownVerifiers.Count -eq 0) {
    Write-VerificationPass "Declared verifier files exist" "$($Manifest.known_verifiers.Count) verifiers."
} else {
    Write-VerificationFail "Declared verifier files exist" ($MissingKnownVerifiers -join ", ")
}

$MissingKnownInstallers = @($Manifest.known_installers | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot ([string]$_)) -PathType Leaf)
})
if ($MissingKnownInstallers.Count -eq 0) {
    Write-VerificationPass "Declared installer files exist" "$($Manifest.known_installers.Count) installers."
} else {
    Write-VerificationFail "Declared installer files exist" ($MissingKnownInstallers -join ", ")
}

foreach ($Property in $Manifest.canonical_experiences.PSObject.Properties) {
    Test-CanonicalHtml -Experience $Property.Value -ExcludedPaths @($Manifest.excluded_paths)
}
Write-VerificationInfo "Dynamic reference boundary" "Runtime-generated navigation and API URLs require browser/live checks and are not guessed by static HTML inspection."

$JavaScriptPaths = New-Object System.Collections.Generic.List[string]
foreach ($Property in $Manifest.canonical_experiences.PSObject.Properties) {
    $JavaScriptPaths.Add([string]$Property.Value.page_script)
}
foreach ($GroupName in @("navigation", "branding", "api_clients", "utilities")) {
    foreach ($PathValue in @($Manifest.shared_assets.$GroupName)) {
        $Path = [string]$PathValue
        if ($Path.EndsWith(".js", [StringComparison]::OrdinalIgnoreCase)) {
            $JavaScriptPaths.Add($Path)
        }
    }
}
$UniqueJavaScriptPaths = @($JavaScriptPaths | Sort-Object -Unique)
$Node = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $Node) {
    Write-VerificationWarning "JavaScript syntax checks" "Node.js is unavailable; no syntax PASS is claimed."
} else {
    $JavaScriptFailures = New-Object System.Collections.Generic.List[string]
    foreach ($Path in $UniqueJavaScriptPaths) {
        try {
            $FullPath = Resolve-RepositoryRelativePath -RelativePath $Path
            $Output = @(& $Node.Source --check $FullPath 2>&1)
            if ($LASTEXITCODE -ne 0) {
                $JavaScriptFailures.Add("$Path`: $($Output -join ' ')")
            }
        } catch {
            $JavaScriptFailures.Add("$Path`: $($_.Exception.Message)")
        }
    }
    if ($JavaScriptFailures.Count -eq 0) {
        Write-VerificationPass "JavaScript syntax checks" "$($UniqueJavaScriptPaths.Count) files passed node --check."
    } else {
        Write-VerificationFail "JavaScript syntax checks" ($JavaScriptFailures -join "; ")
    }
}

$RuntimeFiles = @(
    Get-ChildItem -LiteralPath (Join-Path $script:RepositoryRoot "assets\js") -File -Filter "dictionaryroot-*.js" |
        Select-Object -ExpandProperty FullName
)
$RuntimeFiles += Join-Path $script:RepositoryRoot "assets\js\sourceroot-api.js"
$RuntimeFiles += @($Manifest.canonical_experiences.PSObject.Properties | ForEach-Object {
    Resolve-RepositoryRelativePath -RelativePath ([string]$_.Value.file)
})
$ForbiddenPatterns = @("data/nodes.json", "fallbackSourceData", "staticSourceRecords")
$ForbiddenFindings = New-Object System.Collections.Generic.List[string]
foreach ($RuntimeFile in @($RuntimeFiles | Sort-Object -Unique)) {
    $Text = Get-Content -LiteralPath $RuntimeFile -Raw
    foreach ($Pattern in $ForbiddenPatterns) {
        if ($Text.IndexOf($Pattern, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $ForbiddenFindings.Add("$(ConvertTo-RepositoryRelativePath -FullPath $RuntimeFile):$Pattern")
        }
    }
}
if ($ForbiddenFindings.Count -eq 0) {
    Write-VerificationPass "Forbidden runtime fallback patterns" "$($RuntimeFiles.Count) runtime files inspected."
} else {
    Write-VerificationFail "Forbidden runtime fallback patterns" ($ForbiddenFindings -join ", ")
}

$ChangedTool = Join-Path $script:RepositoryRoot "tools\GET-ROOT-CHANGED-FILES.ps1"
if ($IsActiveStage) {
    try {
        $PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
        $ChangedOutput = @(& $PowerShell -NoProfile -ExecutionPolicy Bypass -File $ChangedTool -AsJson -CheckAllowedFiles -AllowUntracked 2>$null)
        $ChangedExitCode = $LASTEXITCODE
        $ChangedResult = ($ChangedOutput -join "`n") | ConvertFrom-Json
        if ($ChangedExitCode -eq 0 -and [int]$ChangedResult.unauthorized_count -eq 0) {
            Write-VerificationPass "Active-stage changed-file scope" "$($ChangedResult.change_count) changed files; 0 unauthorized."
        } else {
            Write-VerificationFail "Active-stage changed-file scope" "Exit $ChangedExitCode; unauthorized: $(@($ChangedResult.unauthorized_files) -join ', ')"
        }
    } catch {
        Write-VerificationFail "Active-stage changed-file scope" $_.Exception.Message
    }
} else {
    Write-VerificationPass "Inactive-stage changed-file scope" "No active stage; allowed-file enforcement skipped."
}

$DiscoveredVerifiers = @(
    Get-ChildItem -LiteralPath $script:RepositoryRoot -File -Filter "VERIFY-*.ps1" |
        Where-Object { $_.Name -ne "VERIFY-ROOT-REPOSITORY.ps1" } |
        Sort-Object Name
)
$UndeclaredVerifiers = @($DiscoveredVerifiers | Where-Object { @($Manifest.known_verifiers) -notcontains $_.Name })
if ($UndeclaredVerifiers.Count -eq 0) {
    Write-VerificationPass "Existing root verifier discovery" "$($DiscoveredVerifiers.Count) existing verifiers discovered and declared."
} else {
    Write-VerificationFail "Existing root verifier discovery" "Not declared: $($UndeclaredVerifiers.Name -join ', ')"
}

if ($RunExistingVerifiers) {
    $PowerShell = (Get-Command powershell.exe -ErrorAction SilentlyContinue)
    if ($null -eq $PowerShell) {
        Write-VerificationFail "Existing verifier execution" "powershell.exe is unavailable."
    } else {
        foreach ($Verifier in $DiscoveredVerifiers) {
            Write-VerificationInfo "Running existing verifier" $Verifier.Name
            & $PowerShell.Source -NoProfile -ExecutionPolicy Bypass -File $Verifier.FullName
            $ExitCode = $LASTEXITCODE
            if ($ExitCode -eq 0) {
                Write-VerificationPass "Existing verifier: $($Verifier.Name)" "Exit 0."
            } else {
                Write-VerificationFail "Existing verifier: $($Verifier.Name)" "Exit $ExitCode."
            }
        }
    }
} else {
    Write-VerificationInfo "Existing verifier execution" "Skipped by default. Use -RunExistingVerifiers for explicit execution."
}

try {
    $GitIgnore = Get-Content -LiteralPath (Join-Path $script:RepositoryRoot ".gitignore") -Raw
    if ($GitIgnore -match '(?m)^\.root-context/\s*$') {
        Write-VerificationPass "Generated context is ignored"
    } else {
        Write-VerificationFail "Generated context is ignored" ".gitignore does not contain .root-context/."
    }
} catch {
    Write-VerificationFail "Generated context is ignored" $_.Exception.Message
}

Write-Host ""
Write-Host "Repository verifier summary" -ForegroundColor Cyan
Write-Host "Pass count:    $script:PassCount"
Write-Host "Warning count: $script:WarningCount"
Write-Host "Failure count: $script:FailureCount"
$OverallResult = if ($script:FailureCount -eq 0) { "PASS" } else { "FAIL" }
Write-Host "Overall result: $OverallResult"

if ($script:FailureCount -gt 0) { exit 1 }
exit 0
