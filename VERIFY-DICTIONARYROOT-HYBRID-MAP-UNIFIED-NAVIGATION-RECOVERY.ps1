[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Passed = 0
$Failed = 0

function Result {
    param([string]$Name, [bool]$Okay, [string]$Detail = "")
    if ($Okay) {
        $script:Passed++
        Write-Host "[PASS] $Name" -ForegroundColor Green
    }
    else {
        $script:Failed++
        Write-Host "[FAIL] $Name" -ForegroundColor Red
    }
    if ($Detail) { Write-Host "       $Detail" }
}

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Write-Host "Repository not found: $RepositoryPath" -ForegroundColor Red
    exit 2
}

$Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
Write-Host "DictionaryRoot Hybrid Map + Unified Navigation Recovery verifier" -ForegroundColor Cyan
Write-Host "Repository: $Root"
Write-Host ""

$Required = @(
    "graph-v2.html",
    "assets\css\dictionaryroot-hybrid-map.css",
    "assets\css\dictionaryroot-navigation.css",
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-brand.js",
    "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-graph.js",
    "docs\customers\dictionaryroot\hybrid-map-unified-navigation-recovery-v1.md"
)
$Missing = @($Required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Root $_) -PathType Leaf) })
Result "Required recovery and navigation files exist" ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "$($Required.Count) files found." })
if ($Missing.Count) { exit 1 }

$Html = Get-Content -LiteralPath (Join-Path $Root "graph-v2.html") -Raw
$Graph = Get-Content -LiteralPath (Join-Path $Root "assets\js\dictionaryroot-graph.js") -Raw
$Css = Get-Content -LiteralPath (Join-Path $Root "assets\css\dictionaryroot-hybrid-map.css") -Raw

$ModeHtmlOkay = $Html -match 'id="graphModeMap"' -and $Html -match 'id="graphModeReadable"' -and $Html -match 'dictionaryroot-hybrid-map\.css'
Result "Map Mode and Readable Mode controls are installed" $ModeHtmlOkay

$ModeJsOkay = $Graph -match 'mode:\s*"map"' -and $Graph -match 'state\.mode\s*===\s*"readable"' -and $Graph -match 'setGraphMode\("map"' -and $Graph -match 'setGraphMode\("readable"'
Result "Hybrid mode state and render branches are installed" $ModeJsOkay

$HistoryOkay = $Graph -match 'url\.searchParams\.set\("mode", state\.mode\)' -and $Graph -match 'params\.get\("mode"\)' -and $Graph -match 'global\.addEventListener\("popstate"'
Result "Graph mode participates in URL and Back/Forward state" $HistoryOkay

$NavigationOkay = $Html -match 'dictionaryroot-navigation\.css' -and $Html -match 'dictionaryroot-navigation\.js' -and $Graph -match 'DictionaryRootNavigation\.buildHref' -and $Graph -match 'experienceHref\("concept-v2\.html"' -and $Graph -match 'sources-v2\.html'
Result "Shared navigation and cross-experience context remain present" $NavigationOkay

$MeaningOkay = $Graph -match 'DictionaryRootApi\.rankMeaningResults' -and $Graph -match 'DictionaryRootApi\.exactMeaningResults' -and $Graph -match 'DictionaryRootApi\.meaningMatchRank'
Result "Exact-meaning search and ranking remain present" $MeaningOkay

$CssOkay = $Css -match '\.dr-sphere-stage\.map-mode' -and $Css -match '\.dr-sphere-stage\.readable-mode' -and $Css -match '\[aria-pressed="true"\]'
Result "Hybrid mode visual states are present" $CssOkay

$Forbidden = @(@($Html, $Graph, $Css) | Select-String -SimpleMatch -Pattern "data/nodes.json", "data\nodes.json" -ErrorAction SilentlyContinue)
Result "No legacy fallback graph dependency" ($Forbidden.Count -eq 0)

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
    $Output = & $Node.Source --check (Join-Path $Root "assets\js\dictionaryroot-graph.js") 2>&1
    Result "JavaScript syntax: dictionaryroot-graph.js" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
}
else {
    Result "JavaScript syntax: dictionaryroot-graph.js" $false "Node.js was not found."
}

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Cyan
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"
Write-Host ""
Write-Host "Still required:" -ForegroundColor Yellow
Write-Host "  1. Run VERIFY-DICTIONARYROOT-HYBRID-MAP.ps1 with SourceRoot running."
Write-Host "  2. Run VERIFY-DICTIONARYROOT-UNIFIED-NAVIGATION-SEARCH.ps1 with SourceRoot running."
Write-Host "  3. Confirm Map and Readable modes manually in the browser."

if ($Failed -gt 0) { exit 1 }
exit 0
