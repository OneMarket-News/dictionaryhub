[CmdletBinding()]
param(
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",
    [switch]$SkipApi,
    [string]$ApiBaseUrl = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0

function Result {
    param([string]$Name, [bool]$Okay, [string]$Detail = "")
    if ($Okay) { $script:Passed++; Write-Host "[PASS] $Name" -ForegroundColor Green }
    else { $script:Failed++; Write-Host "[FAIL] $Name" -ForegroundColor Red }
    if ($Detail) { Write-Host "       $Detail" }
}

function Warning {
    param([string]$Name, [string]$Detail = "")
    $script:Warnings++
    Write-Host "[WARN] $Name" -ForegroundColor Yellow
    if ($Detail) { Write-Host "       $Detail" }
}

function Text([string]$RelativePath) {
    return Get-Content -LiteralPath (Join-Path $script:Root $RelativePath) -Raw
}

function Contains {
    param([string]$RelativePath, [string[]]$Needles, [string]$Name)
    $Content = Text $RelativePath
    $Missing = @($Needles | Where-Object { $Content.IndexOf($_, [System.StringComparison]::Ordinal) -lt 0 })
    Result $Name ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "" })
}

function ApiItems($Payload) {
    if ($null -eq $Payload) { return @() }
    if ($Payload -is [System.Array]) { return @($Payload) }
    foreach ($Name in @("items", "results", "lemmas")) {
        if ($Payload.PSObject.Properties.Name -contains $Name) { return @($Payload.$Name) }
    }
    return @()
}

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Write-Host "Repository not found: $RepositoryPath" -ForegroundColor Red
    exit 2
}

$script:Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
Write-Host "DictionaryRoot Coverage and Data Quality Dashboard v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:Root"
Write-Host ""

$Required = @(
    "coverage-v2.html",
    "index.html",
    "assets\css\dictionaryroot-coverage.css",
    "assets\css\dictionaryroot-home.css",
    "assets\css\dictionaryroot-navigation.css",
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-brand.js",
    "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-coverage.js",
    "config\dictionaryroot-brand.json",
    "config\customers\dictionaryroot.json",
    "backend\src\routes\lexicon.ts",
    "backend\src\services\lexical-store.ts",
    "docs\customers\dictionaryroot\coverage-data-quality-stage.md"
)
$Missing = @($Required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:Root $_) -PathType Leaf) })
Result "Required coverage-dashboard files exist" ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "$($Required.Count) files found." })
if ($Missing.Count) { exit 1 }

Contains "coverage-v2.html" @(
    "See what DictionaryRoot knows",
    "dictionaryrootCoverageMetrics",
    "dictionaryrootCoverageQueue",
    "dictionaryrootCoveragePos",
    "dictionaryrootCoverageFilterForm",
    "dictionaryrootCoverageResults",
    "assets/css/dictionaryroot-coverage.css",
    "assets/js/dictionaryroot-coverage.js"
) "Coverage page contains summary, quality queue, POS, filters, and results"

$CoverageText = Text "coverage-v2.html"
$ApiIndex = $CoverageText.IndexOf("assets/js/dictionaryroot-api.js")
$BrandIndex = $CoverageText.IndexOf("assets/js/dictionaryroot-brand.js")
$NavigationIndex = $CoverageText.IndexOf("assets/js/dictionaryroot-navigation.js")
$ExperienceIndex = $CoverageText.IndexOf("assets/js/dictionaryroot-coverage.js")
Result "Coverage scripts load in API, brand, navigation, experience order" ($ApiIndex -ge 0 -and $BrandIndex -gt $ApiIndex -and $NavigationIndex -gt $BrandIndex -and $ExperienceIndex -gt $NavigationIndex)

Contains "assets\js\dictionaryroot-navigation.js" @(
    '{ key: "coverage", label: "Coverage", href: "coverage-v2.html" }',
    '"coverage-v2.html": "coverage"',
    'targetPage === "coverage"',
    "preserveCoverageFilters",
    "coverageSearch"
) "Shared navigation includes active, context-aware Coverage behavior"

Contains "assets\js\dictionaryroot-brand.js" @(
    '{ label: "Coverage", href: "coverage-v2.html" }',
    '"coverage-v2.html": {'
) "DictionaryRoot brand fallback includes Coverage"

Contains "index.html" @(
    'href="coverage-v2.html"',
    "Measure coverage and quality",
    "Open Coverage"
) "Home exposes the Coverage experience"

Contains "backend\src\routes\lexicon.ts" @(
    'lexiconRouter.get("/dashboard"',
    'lexiconRouter.get("/lemmas"',
    "parsePagination",
    "INVALID_FILTER"
) "Lexicon routes expose dashboard and paginated lemma coverage"

Contains "backend\src\services\lexical-store.ts" @(
    "getDictionaryRootCoverageDashboard",
    "listDictionaryRootLemmaCoverage",
    "graphCoveredSenseCount",
    "sourceBackedSenseCount",
    "reviewRequiredSenseCount",
    "conceptRevisionCoveredSenseCount",
    "CROSS JOIN LATERAL UNNEST",
    "datasetRevisionCount"
) "Coverage service derives graph, source, review, history, and lemma metrics"

Contains "assets\js\dictionaryroot-coverage.js" @(
    "/dictionaryroot/lexicon/dashboard",
    "/dictionaryroot/lexicon/lemmas",
    "No fallback counts are displayed",
    "No fallback records were used",
    'global.addEventListener("popstate"',
    "global.history[mode",
    'navHref("concept-v2.html"',
    'navHref("graph-v2.html"',
    'navHref("sources-v2.html"',
    'navHref("history-v2.html"'
) "Coverage experience uses live diagnostics, URL state, and cross-experience links"

Contains "assets\css\dictionaryroot-coverage.css" @(
    ".dr-coverage-metric-grid",
    ".dr-coverage-bars",
    ".dr-coverage-queue",
    ".dr-coverage-pos-table",
    ".dr-coverage-filter-form",
    ".dr-coverage-result",
    "@media (max-width: 900px)",
    "@media (max-width: 480px)"
) "Coverage desktop, tablet, and mobile styles are present"

$ForbiddenFiles = @(
    "coverage-v2.html",
    "assets\js\dictionaryroot-coverage.js"
) | ForEach-Object { Get-Item -LiteralPath (Join-Path $script:Root $_) }
$Forbidden = @($ForbiddenFiles | Select-String -SimpleMatch -Pattern "data/nodes.json", "data\nodes.json", "fallbackData", "fallbackRecords" -ErrorAction SilentlyContinue)
Result "Coverage dashboard has no legacy or fallback knowledge dependency" ($Forbidden.Count -eq 0) $(if ($Forbidden.Count) { ($Forbidden | ForEach-Object { "$($_.Path):$($_.LineNumber)" }) -join "; " } else { "" })

try {
    $Brand = Get-Content -LiteralPath (Join-Path $script:Root "config\dictionaryroot-brand.json") -Raw | ConvertFrom-Json
    $CoverageNav = @($Brand.navigation | Where-Object { $_.href -eq "coverage-v2.html" -and $_.label -eq "Coverage" }).Count -gt 0
    Result "Brand manifest exposes Coverage" $CoverageNav
} catch { Result "Brand manifest exposes Coverage" $false $_.Exception.Message }

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
    foreach ($File in @("assets\js\dictionaryroot-brand.js", "assets\js\dictionaryroot-navigation.js", "assets\js\dictionaryroot-coverage.js")) {
        $Output = & $Node.Source --check (Join-Path $script:Root $File) 2>&1
        Result "JavaScript syntax: $File" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
    }
} else { Warning "JavaScript syntax skipped" "Node.js was not found." }

$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($Npm) {
    Push-Location (Join-Path $script:Root "backend")
    try {
        $Typecheck = & $Npm.Source run typecheck 2>&1
        Result "SourceRoot TypeScript typecheck" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Typecheck -join " " } else { "" })
    } finally { Pop-Location }
} else { Warning "SourceRoot TypeScript typecheck skipped" "npm.cmd was not found." }

try { $Config = Get-Content -LiteralPath (Join-Path $script:Root "config\customers\dictionaryroot.json") -Raw | ConvertFrom-Json }
catch { Result "DictionaryRoot customer manifest parses" $false $_.Exception.Message; $Config = $null }

if ($SkipApi) {
    Warning "Live coverage checks skipped" "Run without -SkipApi with SourceRoot running and the complete lexical index imported."
} elseif ($null -eq $Config) {
    Result "Live coverage checks" $false "Customer manifest could not be parsed."
} else {
    $Base = if ($ApiBaseUrl) { $ApiBaseUrl.TrimEnd('/') } else { ([string]$Config.apiBaseUrl).TrimEnd('/') }
    $Origin = $Base -replace "/api/v1$", ""
    $Bundle = [System.Uri]::EscapeDataString([string]$Config.bundleId)

    try {
        $Health = Invoke-RestMethod -Uri "$Origin/health" -Method Get -TimeoutSec 15
        Result "SourceRoot health endpoint responds" ($Health.status -eq "ok") "$Origin/health"
    } catch { Result "SourceRoot health endpoint responds" $false $_.Exception.Message }

    try {
        $Dashboard = Invoke-RestMethod -Uri "$Base/dictionaryroot/lexicon/dashboard?bundleId=$Bundle" -Method Get -TimeoutSec 60
        $Synsets = [int64]$Dashboard.synsetCount
        $Graph = [int64]$Dashboard.graphCoveredSenseCount
        $Lexical = [int64]$Dashboard.lexicalOnlySenseCount
        $Backed = [int64]$Dashboard.sourceBackedSenseCount
        $Unsupported = [int64]$Dashboard.unsupportedSenseCount
        $Revised = [int64]$Dashboard.conceptRevisionCoveredSenseCount
        $RevisionGap = [int64]$Dashboard.conceptRevisionGapSenseCount
        $PosTotal = [int64](($Dashboard.partOfSpeech | Measure-Object -Property senseCount -Sum).Sum)
        $CoreOkay = $Dashboard.available -eq $true -and $Synsets -gt 10000 -and [int64]$Dashboard.lemmaCount -gt 10000 -and [int64]$Dashboard.relationCount -gt 10000
        Result "Live coverage dashboard is available" $CoreOkay "synsets=$Synsets; lemmas=$($Dashboard.lemmaCount); relations=$($Dashboard.relationCount)"
        Result "Graph coverage partitions complete meanings" (($Graph + $Lexical) -eq $Synsets) "graph=$Graph; lexicalOnly=$Lexical; total=$Synsets"
        Result "Source coverage partitions complete meanings" (($Backed + $Unsupported) -eq $Synsets) "sourceBacked=$Backed; unsupported=$Unsupported; total=$Synsets"
        Result "Concept revision coverage partitions complete meanings" (($Revised + $RevisionGap) -eq $Synsets) "conceptRevisions=$Revised; gap=$RevisionGap; total=$Synsets"
        Result "Part-of-speech totals match complete meanings" ($PosTotal -eq $Synsets) "partOfSpeechTotal=$PosTotal; total=$Synsets"
        Result "Dataset-level revision count remains separate" ([int64]$Dashboard.datasetRevisionCount -gt 0) "datasetRevisions=$($Dashboard.datasetRevisionCount)"
    } catch {
        Result "Live coverage dashboard is available" $false $_.Exception.Message
        Result "Graph coverage partitions complete meanings" $false $_.Exception.Message
        Result "Source coverage partitions complete meanings" $false $_.Exception.Message
        Result "Concept revision coverage partitions complete meanings" $false $_.Exception.Message
        Result "Part-of-speech totals match complete meanings" $false $_.Exception.Message
        Result "Dataset-level revision count remains separate" $false $_.Exception.Message
    }

    try {
        $LemmaPayload = Invoke-RestMethod -Uri "$Base/dictionaryroot/lexicon/lemmas?bundleId=$Bundle&coverage=incomplete&sort=gaps&page=1&limit=10" -Method Get -TimeoutSec 90
        $Items = @(ApiItems $LemmaPayload)
        $RowsOkay = $LemmaPayload.available -eq $true -and [int64]$LemmaPayload.total -gt 0 -and $Items.Count -gt 0
        Result "Live incomplete-coverage lemma registry returns rows" $RowsOkay "total=$($LemmaPayload.total); pageItems=$($Items.Count)"
        $PartitionsOkay = $true
        foreach ($Item in $Items) {
            $Exact = [int64]$Item.exactSenseCount
            if (([int64]$Item.graphSenseCount + [int64]$Item.lexicalOnlySenseCount) -ne $Exact) { $PartitionsOkay = $false }
            if (([int64]$Item.sourceBackedSenseCount + [int64]$Item.unsupportedSenseCount) -ne $Exact) { $PartitionsOkay = $false }
            if (([int64]$Item.conceptRevisionSenseCount + [int64]$Item.conceptRevisionGapSenseCount) -ne $Exact) { $PartitionsOkay = $false }
        }
        Result "Lemma rows preserve graph, source, and revision partitions" $PartitionsOkay
        $HasLinks = @($Items | Where-Object { $_.representativeNodeId }).Count -eq $Items.Count
        Result "Lemma rows expose representative concept IDs" $HasLinks
    } catch {
        Result "Live incomplete-coverage lemma registry returns rows" $false $_.Exception.Message
        Result "Lemma rows preserve graph, source, and revision partitions" $false $_.Exception.Message
        Result "Lemma rows expose representative concept IDs" $false $_.Exception.Message
    }

    try {
        $ValueQuery = [System.Uri]::EscapeDataString("value")
        $ValueCoverage = Invoke-RestMethod -Uri "$Base/dictionaryroot/lexicon/coverage?bundleId=$Bundle&q=$ValueQuery" -Method Get -TimeoutSec 30
        $ValueOkay = $ValueCoverage.available -eq $true -and [int64]$ValueCoverage.exactSenseCount -gt 1 -and ([int64]$ValueCoverage.graphSenseCount + [int64]$ValueCoverage.lexicalOnlySenseCount) -eq [int64]$ValueCoverage.exactSenseCount
        Result "Existing exact value coverage remains compatible" $ValueOkay "exact=$($ValueCoverage.exactSenseCount); graph=$($ValueCoverage.graphSenseCount); lexicalOnly=$($ValueCoverage.lexicalOnlySenseCount)"
    } catch { Result "Existing exact value coverage remains compatible" $false $_.Exception.Message }
}

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host ""
Write-Host "Manual browser checks still required:" -ForegroundColor Yellow
Write-Host "  1. Open coverage-v2.html and confirm summary, bars, quality queue, POS table, and lemma rows render."
Write-Host "  2. Filter lexical-only, partial, complete, needs-review, source gaps, and no-history states."
Write-Host "  3. Search value, bank, and light; open rows in Concept, Sphere, Sources, and History."
Write-Host "  4. Use browser Back and Forward through searches, filters, and pagination."
Write-Host "  5. Confirm layouts at 390 x 844 and 320 x 568."
Write-Host "  6. Stop SourceRoot and confirm no fallback counts or records appear."

if ($script:Failed -gt 0) { exit 1 }
exit 0
