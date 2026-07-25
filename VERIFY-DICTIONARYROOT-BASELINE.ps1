[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0
$script:Info = 0
$DefaultRepository = "C:\Users\Josh\Documents\GitHub\dictionaryhub"

function Write-Result {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("PASS", "FAIL", "WARN", "INFO")][string]$Level,
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Detail = ""
    )
    $Color = "Gray"
    switch ($Level) {
        "PASS" { $script:Passed++; $Color = "Green" }
        "FAIL" { $script:Failed++; $Color = "Red" }
        "WARN" { $script:Warnings++; $Color = "Yellow" }
        "INFO" { $script:Info++; $Color = "Cyan" }
    }
    Write-Host "[$Level] $Name" -ForegroundColor $Color
    if (-not [string]::IsNullOrWhiteSpace($Detail)) { Write-Host "       $Detail" }
}

function Resolve-RepositoryRoot {
    $Candidates = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($RepositoryPath)) { $Candidates.Add($RepositoryPath) }
    $Candidates.Add($PSScriptRoot)
    $Candidates.Add((Get-Location).Path)
    $Candidates.Add($DefaultRepository)
    foreach ($Candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }
        if (-not (Test-Path -LiteralPath $Candidate -PathType Container)) { continue }
        $Resolved = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Candidate).Path)
        if (
            (Test-Path -LiteralPath (Join-Path $Resolved "index.html") -PathType Leaf) -and
            (Test-Path -LiteralPath (Join-Path $Resolved "config\customers\dictionaryroot.json") -PathType Leaf)
        ) {
            return $Resolved.TrimEnd("\", "/")
        }
    }
    throw "Could not locate a repository containing index.html and config\customers\dictionaryroot.json."
}

function Get-RepositoryText {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    return Get-Content -LiteralPath (Join-Path $script:RepositoryRoot $RelativePath) -Raw
}

function Test-Markers {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string[]]$Markers,
        [Parameter(Mandatory = $true)][string]$Name
    )
    $Path = Join-Path $script:RepositoryRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Result -Level "FAIL" -Name $Name -Detail "Missing file: $RelativePath"
        return
    }
    $Text = Get-Content -LiteralPath $Path -Raw
    $Missing = @(
        $Markers | Where-Object {
            $Text.IndexOf($_, [System.StringComparison]::Ordinal) -lt 0
        }
    )
    if ($Missing.Count -eq 0) {
        Write-Result -Level "PASS" -Name $Name
    } else {
        Write-Result -Level "FAIL" -Name $Name -Detail "Missing markers in ${RelativePath}: $($Missing -join ', ')"
    }
}

try {
    $script:RepositoryRoot = Resolve-RepositoryRoot
} catch {
    Write-Result -Level "FAIL" -Name "Repository location" -Detail $_.Exception.Message
    exit 2
}

Write-Host "DictionaryRoot baseline verifier v1" -ForegroundColor Cyan
Write-Host "Repository: $script:RepositoryRoot"
Write-Host ""
Write-Result -Level "INFO" -Name "Verification mode" -Detail "Static and local JavaScript syntax checks only. This verifier does not start the backend, connect to PostgreSQL, call a live API, or open a browser."

$RequiredFiles = @(
    "index.html",
    "graph-v2.html",
    "concept-v2.html",
    "sources-v2.html",
    "assets\brand\dictionaryroot-mark.svg",
    "assets\css\dictionaryroot-brand.css",
    "assets\css\dictionaryroot-navigation.css",
    "assets\css\dictionaryroot-live.css",
    "assets\css\dictionaryroot-home.css",
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-auth.js",
    "assets\js\dictionaryroot-brand.js",
    "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-home.js",
    "assets\js\dictionaryroot-graph.js",
    "assets\js\dictionaryroot-concept.js",
    "assets\js\dictionaryroot-sources.js",
    "config\customers\dictionaryroot.json",
    "config\dictionaryroot-brand.json"
)
$MissingFiles = @(
    $RequiredFiles | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot $_) -PathType Leaf)
    }
)
if ($MissingFiles.Count -eq 0) {
    Write-Result -Level "PASS" -Name "Required DictionaryRoot experience files" -Detail "$($RequiredFiles.Count) files found."
} else {
    Write-Result -Level "FAIL" -Name "Required DictionaryRoot experience files" -Detail "Missing: $($MissingFiles -join ', ')"
}

if ($MissingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "DictionaryRoot baseline summary" -ForegroundColor Cyan
    Write-Host "Passed:   $script:Passed"
    Write-Host "Failed:   $script:Failed"
    Write-Host "Warnings: $script:Warnings"
    Write-Host "Info:     $script:Info"
    exit 1
}

try {
    $CustomerManifest = Get-RepositoryText -RelativePath "config\customers\dictionaryroot.json" | ConvertFrom-Json
    $ManifestValid = (
        $CustomerManifest.customerId -eq "dictionaryroot" -and
        $CustomerManifest.customerName -eq "DictionaryRoot" -and
        -not [string]::IsNullOrWhiteSpace([string]$CustomerManifest.apiBaseUrl) -and
        -not [string]::IsNullOrWhiteSpace([string]$CustomerManifest.bundleId)
    )
    if ($ManifestValid) {
        Write-Result -Level "PASS" -Name "DictionaryRoot customer branding and API manifest" -Detail "customerId=$($CustomerManifest.customerId); bundleId=$($CustomerManifest.bundleId)"
    } else {
        Write-Result -Level "FAIL" -Name "DictionaryRoot customer branding and API manifest" -Detail "Required customerId, customerName, apiBaseUrl, or bundleId is missing."
    }
} catch {
    Write-Result -Level "FAIL" -Name "DictionaryRoot customer branding and API manifest" -Detail $_.Exception.Message
}

Test-Markers -RelativePath "index.html" -Name "DictionaryRoot Home experience markers" -Markers @(
    "DictionaryRoot",
    'id="dictionaryrootHomeSearchForm"',
    'id="dictionaryrootHomeResults"',
    "assets/js/dictionaryroot-home.js"
)
Test-Markers -RelativePath "graph-v2.html" -Name "Knowledge Sphere experience markers" -Markers @(
    "Knowledge Sphere",
    'id="dictionaryrootGraph"',
    'id="dictionaryrootGraphDetails"',
    "assets/js/dictionaryroot-graph.js"
)
Test-Markers -RelativePath "concept-v2.html" -Name "Concept Experience markers" -Markers @(
    "Concept Experience",
    'id="dictionaryrootSenseChooser"',
    'id="dictionaryrootConceptDetail"',
    "assets/js/dictionaryroot-concept.js"
)
Test-Markers -RelativePath "sources-v2.html" -Name "Source Experience markers" -Markers @(
    "Source Experience",
    'id="dictionaryrootSourceGrid"',
    'id="dictionaryrootSourceDetails"',
    "assets/js/dictionaryroot-sources.js"
)

$PageScriptOrder = @{
    "index.html" = @(
        "assets/js/dictionaryroot-api.js",
        "assets/js/dictionaryroot-auth.js",
        "assets/js/dictionaryroot-brand.js",
        "assets/js/dictionaryroot-navigation.js",
        "assets/js/dictionaryroot-home.js"
    )
    "graph-v2.html" = @(
        "assets/js/dictionaryroot-api.js",
        "assets/js/dictionaryroot-auth.js",
        "assets/js/dictionaryroot-brand.js",
        "assets/js/dictionaryroot-navigation.js",
        "assets/js/dictionaryroot-graph.js"
    )
    "concept-v2.html" = @(
        "assets/js/dictionaryroot-api.js",
        "assets/js/dictionaryroot-auth.js",
        "assets/js/dictionaryroot-brand.js",
        "assets/js/dictionaryroot-navigation.js",
        "assets/js/dictionaryroot-concept.js"
    )
    "sources-v2.html" = @(
        "assets/js/dictionaryroot-api.js",
        "assets/js/dictionaryroot-auth.js",
        "assets/js/dictionaryroot-brand.js",
        "assets/js/dictionaryroot-navigation.js",
        "assets/js/dictionaryroot-sources.js"
    )
}
foreach ($Page in @("index.html", "graph-v2.html", "concept-v2.html", "sources-v2.html")) {
    $Content = Get-RepositoryText -RelativePath $Page
    $PreviousIndex = -1
    $OrderValid = $true
    foreach ($Script in $PageScriptOrder[$Page]) {
        $CurrentIndex = $Content.IndexOf($Script, [System.StringComparison]::Ordinal)
        if ($CurrentIndex -lt 0 -or $CurrentIndex -le $PreviousIndex) {
            $OrderValid = $false
            break
        }
        $PreviousIndex = $CurrentIndex
    }
    if ($OrderValid) {
        Write-Result -Level "PASS" -Name "$Page script initialization order"
    } else {
        Write-Result -Level "FAIL" -Name "$Page script initialization order" -Detail "Expected API, auth, brand, navigation, then page experience."
    }
}

foreach ($Page in @("index.html", "graph-v2.html", "concept-v2.html", "sources-v2.html")) {
    $Content = Get-RepositoryText -RelativePath $Page
    $Matches = [regex]::Matches($Content, '\bid\s*=\s*["'']([^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $Ids = @($Matches | ForEach-Object { $_.Groups[1].Value })
    $Duplicates = @(
        $Ids | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name }
    )
    if ($Ids.Count -gt 0 -and $Duplicates.Count -eq 0) {
        Write-Result -Level "PASS" -Name "$Page unique HTML element IDs" -Detail "$($Ids.Count) IDs inspected."
    } else {
        Write-Result -Level "FAIL" -Name "$Page unique HTML element IDs" -Detail "Duplicates: $($Duplicates -join ', ')"
    }
}

Test-Markers -RelativePath "assets\js\dictionaryroot-api.js" -Name "Live SourceRoot API client and exact-meaning compatibility" -Markers @(
    "class DictionaryRootApiClient",
    "apiBaseUrl",
    "fetch(url",
    "health()",
    "searchNodes(query",
    "meaningMatchRank",
    "exactMeaningResults",
    "rankMeaningResults",
    "sourceExperience"
)
Test-Markers -RelativePath "assets\js\dictionaryroot-navigation.js" -Name "Shared responsive navigation and unified live search" -Markers @(
    '{ key: "home", label: "Home", href: "index.html" }',
    '{ key: "concept", label: "Concept", href: "concept-v2.html" }',
    '{ key: "graph", label: "Knowledge Sphere", href: "graph-v2.html" }',
    '{ key: "sources", label: "Sources", href: "sources-v2.html" }',
    'aria-current="page"',
    "dictionaryroot-mobile-menu-button",
    "client.searchNodes",
    "No fallback data was used"
)
Test-Markers -RelativePath "assets\js\dictionaryroot-brand.js" -Name "DictionaryRoot branding and SourceRoot attribution" -Markers @(
    "DictionaryRoot",
    "Powered by",
    "SourceRoot"
)

Test-Markers -RelativePath "assets\js\dictionaryroot-home.js" -Name "Home loading, empty, offline, and URL-state behavior" -Markers @(
    "loading",
    "No matching meaning was found",
    "service is unavailable",
    "No fallback",
    "URLSearchParams",
    'addEventListener("popstate"'
)
Test-Markers -RelativePath "assets\js\dictionaryroot-graph.js" -Name "Sphere loading, empty, offline, context-link, and URL behavior" -Markers @(
    "Loading center concept",
    "No matching meaning was found",
    "could not reach its knowledge service",
    'experienceHref("concept-v2.html"',
    'experienceHref("sources-v2.html"',
    "global.history.pushState",
    'addEventListener("popstate"'
)
Test-Markers -RelativePath "assets\js\dictionaryroot-concept.js" -Name "Concept loading, empty, offline, context-link, and URL behavior" -Markers @(
    "Loading source-backed concept details",
    "No matching meaning was found",
    "could not reach its knowledge service",
    "This meaning could not be loaded",
    "Concept unavailable",
    'experienceHref("graph-v2.html"',
    'experienceHref("sources-v2.html"',
    "global.history.pushState",
    'addEventListener("popstate"'
)
Test-Markers -RelativePath "assets\js\dictionaryroot-sources.js" -Name "Sources loading, empty, offline, context-link, and URL behavior" -Markers @(
    "Connecting to SourceRoot",
    "No source records are available",
    "SourceRoot API is offline",
    'experienceHref("concept-v2.html"',
    'experienceHref("graph-v2.html"',
    "global.history.pushState",
    'addEventListener("popstate"'
)

$CoreFrontendPaths = @(
    "index.html",
    "graph-v2.html",
    "concept-v2.html",
    "sources-v2.html",
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-home.js",
    "assets\js\dictionaryroot-graph.js",
    "assets\js\dictionaryroot-concept.js",
    "assets\js\dictionaryroot-sources.js"
)
$ForbiddenMatches = New-Object System.Collections.Generic.List[string]
foreach ($RelativePath in $CoreFrontendPaths) {
    $Text = Get-RepositoryText -RelativePath $RelativePath
    foreach ($Forbidden in @("data/nodes.json", "data\nodes.json", "Stanford Encyclopedia", "Merriam-Webster")) {
        if ($Text.IndexOf($Forbidden, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $ForbiddenMatches.Add("$RelativePath -> $Forbidden")
        }
    }
}
if ($ForbiddenMatches.Count -eq 0) {
    Write-Result -Level "PASS" -Name "Deprecated static and demonstration fallback references are absent"
} else {
    Write-Result -Level "FAIL" -Name "Deprecated static and demonstration fallback references are absent" -Detail ($ForbiddenMatches -join "; ")
}

$NodeCommand = Get-Command "node" -ErrorAction SilentlyContinue
if ($null -eq $NodeCommand) {
    Write-Result -Level "WARN" -Name "DictionaryRoot JavaScript syntax checks skipped" -Detail "Node.js is unavailable."
} else {
    $DictionaryScripts = @(
        Get-ChildItem -LiteralPath (Join-Path $script:RepositoryRoot "assets\js") -File -Filter "dictionaryroot-*.js"
    )
    $SyntaxFailures = New-Object System.Collections.Generic.List[string]
    foreach ($File in $DictionaryScripts) {
        $Output = & $NodeCommand.Source --check $File.FullName 2>&1
        if ($LASTEXITCODE -ne 0) {
            $SyntaxFailures.Add("$($File.Name): $($Output -join ' ')")
        }
    }
    if ($SyntaxFailures.Count -eq 0) {
        Write-Result -Level "PASS" -Name "DictionaryRoot JavaScript syntax" -Detail "$($DictionaryScripts.Count) scripts checked with node --check."
    } else {
        Write-Result -Level "FAIL" -Name "DictionaryRoot JavaScript syntax" -Detail ($SyntaxFailures -join "; ")
    }
}

Write-Result -Level "INFO" -Name "Backend-dependent checks" -Detail "Not run. Static files and local syntax were inspected only."
Write-Result -Level "INFO" -Name "PostgreSQL-dependent checks" -Detail "Not run. This verifier never connects to or modifies a database."
Write-Result -Level "INFO" -Name "Browser-dependent checks" -Detail "Not run. No browser was used; responsive layout and interaction remain manual/browser checks."
Write-Result -Level "INFO" -Name "Live API checks" -Detail "Not run. No API request was made."

Write-Host ""
Write-Host "DictionaryRoot baseline summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host "Info:     $script:Info"

if ($script:Failed -gt 0) {
    exit 1
}
exit 0
