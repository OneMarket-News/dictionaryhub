[CmdletBinding()]
param(
    [string]$RepositoryPath = $PSScriptRoot,
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
    foreach ($Name in @("items", "results", "nodes")) {
        if ($Payload.PSObject.Properties.Name -contains $Name) { return @($Payload.$Name) }
    }
    return @()
}

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Write-Host "Repository not found: $RepositoryPath" -ForegroundColor Red
    exit 2
}

$script:Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
Write-Host "DictionaryRoot Home and Discovery Experience v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:Root"
Write-Host ""

$Required = @(
    "index.html",
    "assets\css\dictionaryroot-home.css",
    "assets\css\dictionaryroot-navigation.css",
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-brand.js",
    "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-home.js",
    "config\dictionaryroot-brand.json",
    "config\customers\dictionaryroot.json",
    "docs\customers\dictionaryroot\home-discovery-stage.md"
)
$Missing = @($Required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:Root $_) -PathType Leaf) })
Result "Required Home and Discovery files exist" ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "$($Required.Count) files found." })
if ($Missing.Count) { exit 1 }

Contains "index.html" @(
    "Find the meaning you intend. Then see what it connects to.",
    "dictionaryrootHomeSearchForm",
    "dictionaryrootHomeValueDemo",
    "dictionaryrootHomeRecentSearches",
    "assets/css/dictionaryroot-home.css",
    "assets/js/dictionaryroot-home.js"
) "Home page contains the complete discovery experience"

$IndexText = Text "index.html"
$ApiIndex = $IndexText.IndexOf("assets/js/dictionaryroot-api.js")
$BrandIndex = $IndexText.IndexOf("assets/js/dictionaryroot-brand.js")
$NavigationIndex = $IndexText.IndexOf("assets/js/dictionaryroot-navigation.js")
$HomeIndex = $IndexText.IndexOf("assets/js/dictionaryroot-home.js")
Result "Home scripts load in API, brand, navigation, experience order" ($ApiIndex -ge 0 -and $BrandIndex -gt $ApiIndex -and $NavigationIndex -gt $BrandIndex -and $HomeIndex -gt $NavigationIndex)

Contains "assets\js\dictionaryroot-navigation.js" @(
    '{ key: "home", label: "Home", href: "index.html" }',
    '"index.html": "home"',
    'targetPage === "home"',
    'buildHref("index.html")'
) "Shared navigation has active DictionaryRoot Home behavior"

Contains "assets\js\dictionaryroot-home.js" @(
    "client.searchNodes(query, { limit: 100 })",
    "DictionaryRootApi.rankMeaningResults",
    "DictionaryRootApi.exactMeaningResults",
    "exact.concat(related.slice(0, 6))",
    "dictionaryroot/lexicon/status",
    "global.history[method]",
    'global.addEventListener("popstate"',
    "No fallback records were used",
    "No fallback definitions were used"
) "Home uses live complete-sense search, coverage, and browser history"

Contains "assets\js\dictionaryroot-home.js" @(
    "themeForDefinition",
    "Monetary worth",
    "Numerical quantity",
    "Importance or principle",
    "Color lightness",
    'client.searchNodes("value", { limit: 100 })'
) "Live value demonstration separates distinct ideas"

Contains "assets\css\dictionaryroot-home.css" @(
    ".dr-home-hero",
    ".dr-home-results",
    ".dr-home-experience-grid",
    ".dr-home-value-grid",
    "@media (max-width: 760px)",
    "@media (max-width: 560px)"
) "Home desktop, tablet, and mobile styles are present"

$ForbiddenFiles = @("index.html", "assets\js\dictionaryroot-home.js") | ForEach-Object { Get-Item -LiteralPath (Join-Path $script:Root $_) }
$Forbidden = @($ForbiddenFiles | Select-String -SimpleMatch -Pattern "data/nodes.json", "data\nodes.json" -ErrorAction SilentlyContinue)
Result "Home has no legacy graph or fallback knowledge dependency" ($Forbidden.Count -eq 0) $(if ($Forbidden.Count) { ($Forbidden | ForEach-Object { "$($_.Path):$($_.LineNumber)" }) -join "; " } else { "" })

try {
    $Brand = Get-Content -LiteralPath (Join-Path $script:Root "config\dictionaryroot-brand.json") -Raw | ConvertFrom-Json
    $HomeNav = @($Brand.navigation | Where-Object { $_.href -eq "index.html" -and $_.label -eq "Home" }).Count -gt 0
    Result "DictionaryRoot branding exposes Home as the product entry point" $HomeNav
} catch { Result "DictionaryRoot branding exposes Home as the product entry point" $false $_.Exception.Message }

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
    foreach ($File in @("assets\js\dictionaryroot-brand.js", "assets\js\dictionaryroot-navigation.js", "assets\js\dictionaryroot-home.js")) {
        $Output = & $Node.Source --check (Join-Path $script:Root $File) 2>&1
        Result "JavaScript syntax: $File" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
    }
} else { Warning "JavaScript syntax skipped" "Node.js was not found." }

try { $Config = Get-Content -LiteralPath (Join-Path $script:Root "config\customers\dictionaryroot.json") -Raw | ConvertFrom-Json }
catch { Result "DictionaryRoot customer manifest parses" $false $_.Exception.Message; $Config = $null }

if ($SkipApi) {
    Warning "Live Home checks skipped" "Run without -SkipApi with SourceRoot running and the complete lexical index imported."
} elseif ($null -eq $Config) {
    Result "Live Home checks" $false "Customer manifest could not be parsed."
} else {
    $Base = if ($ApiBaseUrl) { $ApiBaseUrl.TrimEnd('/') } else { ([string]$Config.apiBaseUrl).TrimEnd('/') }
    $Origin = $Base -replace "/api/v1$", ""
    $Bundle = [System.Uri]::EscapeDataString([string]$Config.bundleId)

    try {
        $Health = Invoke-RestMethod -Uri "$Origin/health" -Method Get -TimeoutSec 15
        Result "SourceRoot health endpoint responds" ($Health.status -eq "ok") "$Origin/health"
    } catch { Result "SourceRoot health endpoint responds" $false $_.Exception.Message }

    try {
        $Status = Invoke-RestMethod -Uri "$Base/dictionaryroot/lexicon/status?bundleId=$Bundle" -Method Get -TimeoutSec 30
        $Okay = $Status.available -eq $true -and [int]$Status.synsetCount -gt 10000 -and [int]$Status.lemmaCount -gt 10000 -and [int]$Status.relationCount -gt 10000
        Result "Live Home coverage statistics are available" $Okay "synsets=$($Status.synsetCount); lemmas=$($Status.lemmaCount); relations=$($Status.relationCount)"
    } catch { Result "Live Home coverage statistics are available" $false $_.Exception.Message }

    try {
        $Search = Invoke-RestMethod -Uri "$Base/search?q=value&type=node&bundleId=$Bundle&domain=DictionaryRoot&page=1&limit=100" -Method Get -TimeoutSec 30
        $Items = @(ApiItems $Search)
        $Exact = @($Items | Where-Object {
            $IsExact = ([string]$_.title).ToLowerInvariant() -eq "value"
            if ($_.metadata -and $_.metadata.lemmas) {
                foreach ($Lemma in @($_.metadata.lemmas)) { if (([string]$Lemma).ToLowerInvariant() -eq "value") { $IsExact = $true } }
            }
            $IsExact
        })
        Result "Home discovery query returns multiple complete exact value senses" ($Search.exactSensePolicy -eq "complete-lemma" -and $Exact.Count -gt 1) "$($Exact.Count) exact senses returned."
        $Monetary = @($Exact | Where-Object { ([string]$_.summary) -match '(?i)money|goods or services|fair equivalent|price|economic|monetary' })
        Result "Home value demonstration has a live monetary sense" ($Monetary.Count -gt 0) $(if ($Monetary.Count) { [string]$Monetary[0].summary } else { "No monetary value sense returned." })
    } catch {
        Result "Home discovery query returns multiple complete exact value senses" $false $_.Exception.Message
        Result "Home value demonstration has a live monetary sense" $false $_.Exception.Message
    }
}

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host ""
Write-Host "Manual browser checks still required:" -ForegroundColor Yellow
Write-Host "  1. Confirm the Home page explains DictionaryRoot clearly on desktop and at 390 x 844 and 320 x 568."
Write-Host "  2. Search value, bank, and light; confirm every exact sense appears before related matches."
Write-Host "  3. Open results in Concept, Sphere, Sources, and History and confirm context remains in the URL."
Write-Host "  4. Use browser Back and Forward through Home searches."
Write-Host "  5. Stop SourceRoot and confirm coverage, search, and the value demonstration show honest offline states."

if ($script:Failed -gt 0) { exit 1 }
exit 0
