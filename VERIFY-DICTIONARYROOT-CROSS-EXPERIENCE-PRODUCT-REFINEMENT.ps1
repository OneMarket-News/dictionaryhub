[CmdletBinding()]
param(
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",
    [switch]$SkipBrowser,
    [switch]$RequireBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0

function Result {
    param([string]$Name, [bool]$Okay, [string]$Detail = "")
    if ($Okay) {
        $script:Passed++
        Write-Host "[PASS] $Name" -ForegroundColor Green
    } else {
        $script:Failed++
        Write-Host "[FAIL] $Name" -ForegroundColor Red
    }
    if ($Detail) { Write-Host "       $Detail" }
}

function Warning {
    param([string]$Name, [string]$Detail = "")
    $script:Warnings++
    Write-Host "[WARN] $Name" -ForegroundColor Yellow
    if ($Detail) { Write-Host "       $Detail" }
}

function Read-Text([string]$RelativePath) {
    return Get-Content -LiteralPath (Join-Path $script:Root $RelativePath) -Raw
}

function Contains-All {
    param([string]$RelativePath, [string[]]$Needles, [string]$Name)
    $Content = Read-Text $RelativePath
    $Missing = @($Needles | Where-Object { $Content.IndexOf($_, [System.StringComparison]::Ordinal) -lt 0 })
    Result $Name ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "" })
}

function In-Order {
    param([string]$RelativePath, [string[]]$Needles, [string]$Name)
    $Content = Read-Text $RelativePath
    $Last = -1
    $Missing = @()
    foreach ($Needle in $Needles) {
        $Found = $Content.IndexOf($Needle, [System.StringComparison]::Ordinal)
        if ($Found -lt 0) { $Missing += $Needle; continue }
        if ($Found -le $Last) { $Missing += "$Needle (out of order)"; continue }
        $Last = $Found
    }
    Result $Name ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing/out of order: $($Missing -join ', ')" } else { "" })
}

if ($RequireBrowser -and $SkipBrowser) {
    Write-Host "-RequireBrowser and -SkipBrowser cannot be used together." -ForegroundColor Red
    exit 2
}

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Write-Host "Repository not found: $RepositoryPath" -ForegroundColor Red
    exit 2
}

$script:Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
Write-Host "DictionaryRoot Cross-Experience Product Refinement v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:Root"
Write-Host ""

$Required = @(
    "index.html",
    "concept-v2.html",
    "graph-v2.html",
    "coverage-v2.html",
    "editorial-v2.html",
    "history-v2.html",
    "assets\css\dictionaryroot-product-refinement.css",
    "assets\js\dictionaryroot-home.js",
    "assets\js\dictionaryroot-coverage.js",
    "assets\js\dictionaryroot-history.js",
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-brand.js",
    "assets\js\dictionaryroot-navigation.js",
    "VERIFY-DICTIONARYROOT-RESPONSIVE.mjs",
    "docs\customers\dictionaryroot\cross-experience-product-refinement-v1.md"
)
$MissingFiles = @($Required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:Root $_) -PathType Leaf) })
Result "Required refinement files exist" ($MissingFiles.Count -eq 0) $(if ($MissingFiles.Count) { "Missing: $($MissingFiles -join ', ')" } else { "$($Required.Count) files found." })
if ($MissingFiles.Count) { exit 1 }

$Pages = @(
    @{ File = "index.html"; Script = "assets/js/dictionaryroot-home.js" },
    @{ File = "concept-v2.html"; Script = "assets/js/dictionaryroot-concept.js" },
    @{ File = "graph-v2.html"; Script = "assets/js/dictionaryroot-graph.js" },
    @{ File = "coverage-v2.html"; Script = "assets/js/dictionaryroot-coverage.js" },
    @{ File = "editorial-v2.html"; Script = "assets/js/dictionaryroot-editorial.js" },
    @{ File = "history-v2.html"; Script = "assets/js/dictionaryroot-history.js" }
)

foreach ($Page in $Pages) {
    Contains-All $Page.File @(
        "assets/css/dictionaryroot-brand.css",
        "assets/css/dictionaryroot-navigation.css",
        "assets/css/dictionaryroot-live.css",
        "assets/css/dictionaryroot-product-refinement.css",
        "assets/js/dictionaryroot-api.js",
        "assets/js/dictionaryroot-brand.js",
        "assets/js/dictionaryroot-navigation.js",
        $Page.Script
    ) "$($Page.File) keeps branding, navigation, live API, and page behavior"

    In-Order $Page.File @(
        "assets/js/dictionaryroot-api.js",
        "assets/js/dictionaryroot-brand.js",
        "assets/js/dictionaryroot-navigation.js",
        $Page.Script
    ) "$($Page.File) preserves shared script initialization order"

    $Html = Read-Text $Page.File
    $IdMatches = [regex]::Matches($Html, '\bid\s*=\s*["'']([^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $DuplicateIds = @($IdMatches | ForEach-Object { $_.Groups[1].Value } | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
    Result "$($Page.File) has unique element IDs" ($DuplicateIds.Count -eq 0) $(if ($DuplicateIds.Count) { "Duplicate IDs: $($DuplicateIds -join ', ')" } else { "" })
}

Contains-All "index.html" @(
    "dictionaryrootHomeSynsetCount",
    "dictionaryrootHomeLemmaCount",
    "dictionaryrootHomeRelationCount",
    "dictionaryrootHomeGraphCount",
    "dictionaryrootHomeLexicalOnlyCount",
    "dictionaryrootHomeSourceBackedCount",
    "dictionaryrootHomeReviewedCount",
    "dictionaryrootHomeHistoryCount",
    "coverage-v2.html?coverage=lexical-only",
    "coverage-v2.html?sourceCoverage=source-backed",
    "coverage-v2.html?review=reviewed",
    "coverage-v2.html?historyCoverage=with-history"
) "Homepage exposes eight live, clickable coverage measures"

Contains-All "assets\js\dictionaryroot-home.js" @(
    "/dictionaryroot/lexicon/dashboard",
    "graphCoveragePercent",
    "sourceCoveragePercent",
    "reviewedSenseCount",
    "conceptRevisionCoveredSenseCount",
    "datasetRevisionCount",
    "dataset-lineage record"
) "Homepage coverage panel uses the live dashboard and honest lineage language"

Contains-All "graph-v2.html" @(
    '<details id="sphereAdvancedControls"',
    "Advanced sphere controls",
    "sphereLensSelect",
    "sphereDomainFilter",
    "sphereExpansionDepth",
    "sphereExpansionLimit",
    "sphereExpandSelected",
    "sphereCollapseSelected",
    "sphereResetExpansions",
    "sphereExpansionStatus"
) "Knowledge Sphere keeps all advanced controls inside a native collapsible surface"

Contains-All "assets\js\dictionaryroot-coverage.js" @(
    'data-coverage-filter="all"',
    'data-coverage-filter="complete"',
    'data-coverage-filter="lexical-only"',
    'data-source-filter="source-backed"',
    'data-review-filter="reviewed"',
    'data-history-filter="with-history"',
    "updateUrl(settings.history)",
    'loadLemmaCoverage({ history: "push", scroll: true })',
    "Meanings with concept history",
    "dataset-lineage record"
) "Coverage metrics are clickable filters with preserved URL state"

Contains-All "assets\js\dictionaryroot-history.js" @(
    "Current live state",
    "not a revision",
    "Concept-specific revision records",
    "Concept-specific",
    "Dataset lineage",
    'data-scope="${escapeHtml(scope)}"',
    'scope === "concept" ? "Concept-specific" : "Dataset lineage"'
) "History distinguishes live state, concept revisions, and dataset lineage"

Contains-All "editorial-v2.html" @(
    "Authenticated, permission-gated decisions",
    "Authenticated reviewer identity",
    "backend derives this identity from the active session",
    "cannot grant review or publication authority",
    "role permissions, proposals, decisions, publications, and rollback events remain separate provenance records",
    'data-surface="account"'
) "Editorial identity messaging is accurate and provenance-aware"

Contains-All "assets\css\dictionaryroot-product-refinement.css" @(
    "width: min(96vw, 1880px)",
    ".dictionaryroot-concept-page .dr-concept-workspace",
    ".dictionaryroot-history-page .dr-history-workspace",
    ".dr-sphere-advanced-controls",
    "button.dr-coverage-metric",
    ".dr-editorial-identity-card",
    ".dr-editorial-account-surface",
    "--dr-refine-account-surface: #dce8f4",
    "@media (max-width: 1320px)",
    "@media (max-width: 1120px)",
    "@media (max-width: 820px)",
    "@media (max-width: 520px)",
    "font-size: max(0.78rem, 12.5px)"
) "Refinement stylesheet covers width, readability, controls, accounts, and responsive states"

$PreservationFiles = @(
    "index.html",
    "concept-v2.html",
    "graph-v2.html",
    "coverage-v2.html",
    "editorial-v2.html",
    "history-v2.html",
    "assets\js\dictionaryroot-home.js",
    "assets\js\dictionaryroot-coverage.js",
    "assets\js\dictionaryroot-history.js"
)
$LegacyMatches = @()
foreach ($Relative in $PreservationFiles) {
    $LegacyMatches += @(Select-String -LiteralPath (Join-Path $script:Root $Relative) -SimpleMatch -Pattern "data/nodes.json", "fallbackData", "fallbackNodes" -ErrorAction SilentlyContinue)
}
Result "Refined experiences contain no legacy graph or fallback data dependency" ($LegacyMatches.Count -eq 0) $(if ($LegacyMatches.Count) { ($LegacyMatches | ForEach-Object { "$($_.Path):$($_.LineNumber)" }) -join "; " } else { "" })

$ApiClient = Read-Text "assets\js\dictionaryroot-api.js"
Result "Shared SourceRoot API client remains present" ($ApiClient.Contains("dictionaryroot") -and $ApiClient.Contains("fetch")) "assets/js/dictionaryroot-api.js"

$Navigation = Read-Text "assets\js\dictionaryroot-navigation.js"
Result "Unified navigation and global search remain present" ($Navigation.Contains("dictionaryroot-unified-header") -and $Navigation.Contains("global")) "assets/js/dictionaryroot-navigation.js"

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
    foreach ($File in @(
        "assets\js\dictionaryroot-home.js",
        "assets\js\dictionaryroot-coverage.js",
        "assets\js\dictionaryroot-history.js",
        "assets\js\dictionaryroot-graph.js",
        "assets\js\dictionaryroot-concept.js",
        "assets\js\dictionaryroot-editorial.js",
        "VERIFY-DICTIONARYROOT-RESPONSIVE.mjs"
    )) {
        $Output = & $Node.Source --check (Join-Path $script:Root $File) 2>&1
        Result "JavaScript syntax: $File" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
    }

    if ($SkipBrowser) {
        Warning "Responsive browser verification skipped" "Rerun without -SkipBrowser to test desktop, tablet, and mobile viewports."
    } else {
        $ResponsiveOutput = @(& $Node.Source (Join-Path $script:Root "VERIFY-DICTIONARYROOT-RESPONSIVE.mjs") --root $script:Root 2>&1)
        $ResponsiveText = $ResponsiveOutput -join [Environment]::NewLine
        $Skipped = $ResponsiveText.Contains("RESPONSIVE SKIP:")
        if ($Skipped -and $RequireBrowser) {
            Result "Responsive browser verification" $false $ResponsiveText
        } elseif ($Skipped) {
            Warning "Responsive browser verification unavailable" $ResponsiveText
        } else {
            Result "Responsive browser verification" ($LASTEXITCODE -eq 0) $ResponsiveText
        }
    }
} else {
    Warning "JavaScript and responsive verification skipped" "Node.js was not found."
    if ($RequireBrowser) { Result "Responsive browser verification required" $false "Node.js was not found." }
}

Write-Host ""
Write-Host "Summary: $script:Passed passed, $script:Failed failed, $script:Warnings warning(s)." -ForegroundColor Cyan
if ($script:Failed -gt 0) { exit 1 }
exit 0
