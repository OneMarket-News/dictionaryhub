[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = $PSScriptRoot,

    [Parameter()]
    [switch]$SkipApi,

    [Parameter()]
    [string]$ApiBaseUrl = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0

function Write-VerificationResult {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][bool]$Passed,
        [string]$Detail = ""
    )

    if ($Passed) {
        $script:Passed++
        Write-Host "[PASS] $Name" -ForegroundColor Green
    }
    else {
        $script:Failed++
        Write-Host "[FAIL] $Name" -ForegroundColor Red
    }

    if ($Detail) {
        Write-Host "       $Detail"
    }
}

function Write-VerificationWarning {
    param([Parameter(Mandatory = $true)][string]$Name, [string]$Detail = "")
    $script:Warnings++
    Write-Host "[WARN] $Name" -ForegroundColor Yellow
    if ($Detail) { Write-Host "       $Detail" }
}

function Get-Text {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $Path = Join-Path $script:RepositoryRoot $RelativePath
    return Get-Content -LiteralPath $Path -Raw
}

function Test-TextContains {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string[]]$Needles,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $Text = Get-Text -RelativePath $RelativePath
    $Missing = @($Needles | Where-Object { $Text.IndexOf($_, [System.StringComparison]::Ordinal) -lt 0 })
    Write-VerificationResult -Name $Name -Passed ($Missing.Count -eq 0) -Detail $(if ($Missing.Count -gt 0) { "Missing markers: $($Missing -join ', ')" } else { "" })
}

function Get-ApiItems {
    param($Payload)
    if ($null -eq $Payload) { return @() }
    if ($Payload -is [System.Array]) { return @($Payload) }
    foreach ($Property in @("items", "results", "nodes", "sources", "assertions", "edges")) {
        if ($Payload.PSObject.Properties.Name -contains $Property) {
            $Value = $Payload.$Property
            if ($null -ne $Value) { return @($Value) }
        }
    }
    return @()
}

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Write-Host "Repository not found: $RepositoryPath" -ForegroundColor Red
    exit 2
}

$script:RepositoryRoot = (Resolve-Path -LiteralPath $RepositoryPath).Path
Write-Host "DictionaryRoot Unified Navigation and Search v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:RepositoryRoot"
Write-Host ""

$RequiredFiles = @(
    "assets\brand\dictionaryroot-mark.svg",
    "assets\css\dictionaryroot-brand.css",
    "assets\css\dictionaryroot-live.css",
    "assets\css\dictionaryroot-navigation.css",
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-brand.js",
    "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-concept.js",
    "assets\js\dictionaryroot-graph.js",
    "assets\js\dictionaryroot-sources.js",
    "config\customers\dictionaryroot.json",
    "concept-v2.html",
    "graph-v2.html",
    "sources-v2.html",
    "index.html",
    "accounts-v2.html",
    "explore.html",
    "docs\customers\dictionaryroot\unified-navigation-search-v1.md"
)

$MissingFiles = @($RequiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot $_) -PathType Leaf) })
Write-VerificationResult -Name "Required replacement files exist" -Passed ($MissingFiles.Count -eq 0) -Detail $(if ($MissingFiles.Count -gt 0) { "Missing: $($MissingFiles -join ', ')" } else { "$($RequiredFiles.Count) files found." })

if ($MissingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Verification cannot continue until the missing files are installed." -ForegroundColor Red
    exit 1
}

$BaselineFiles = @(
    "assets\css\dictionaryroot-brand.css",
    "assets\css\dictionaryroot-live.css",
    "assets\js\dictionaryroot-api.js",
    "config\customers\dictionaryroot.json",
    "explore.html"
)
foreach ($RelativePath in $BaselineFiles) {
    $Item = Get-Item -LiteralPath (Join-Path $script:RepositoryRoot $RelativePath)
    Write-VerificationResult -Name "Shared baseline remains present: $RelativePath" -Passed ($Item.Length -gt 0) -Detail $(if ($Item.Length -le 0) { "File is empty." } else { "size=$($Item.Length) bytes" })
}

Test-TextContains -RelativePath "assets\js\dictionaryroot-api.js" -Name "API baseline retains search, source, dynamic graph, editorial, and identity clients" -Needles @(
    "class DictionaryRootApiClient",
    "searchNodes",
    "sourceExperience",
    "dynamicNeighborhood",
    "editorialReview",
    "authProviders",
    "authMe"
)

Test-TextContains -RelativePath "config\customers\dictionaryroot.json" -Name "Customer manifest retains complete product capabilities" -Needles @(
    '"customerId": "dictionaryroot"',
    '"editorialReview": true',
    '"identityAccess": true',
    '"providerInterfaceVersion": "1.0"'
)

foreach ($Page in @("index.html", "concept-v2.html", "graph-v2.html", "sources-v2.html", "accounts-v2.html")) {
    $Content = Get-Text -RelativePath $Page
    $HasCss = $Content.Contains('assets/css/dictionaryroot-navigation.css')
    $HasJs = $Content.Contains('assets/js/dictionaryroot-navigation.js')
    $ApiIndex = $Content.IndexOf('assets/js/dictionaryroot-api.js')
    $BrandIndex = $Content.IndexOf('assets/js/dictionaryroot-brand.js')
    $NavigationIndex = $Content.IndexOf('assets/js/dictionaryroot-navigation.js')
    $OrderOkay = ($ApiIndex -ge 0 -and $BrandIndex -gt $ApiIndex -and $NavigationIndex -gt $BrandIndex)
    Write-VerificationResult -Name "$Page loads shared navigation assets" -Passed ($HasCss -and $HasJs -and $OrderOkay) -Detail $(if (-not $OrderOkay) { "Expected script order: API, branding, navigation, page experience." } else { "" })
}

Test-TextContains -RelativePath "index.html" -Name "DictionaryRoot Home loads shared navigation and discovery assets" -Needles @(
    "assets/css/dictionaryroot-navigation.css",
    "assets/css/dictionaryroot-home.css",
    "assets/js/dictionaryroot-navigation.js",
    "assets/js/dictionaryroot-home.js"
)

Test-TextContains -RelativePath "assets\js\dictionaryroot-navigation.js" -Name "Shared navigation includes DictionaryRoot Home and Accounts" -Needles @(
    '{ key: "home", label: "Home", href: "index.html" }',
    '"index.html": "home"',
    'buildHref("index.html")',
    '{ key: "accounts", label: "Accounts", href: "accounts-v2.html" }',
    '"accounts-v2.html": "accounts"'
)

Test-TextContains -RelativePath "assets\js\dictionaryroot-navigation.js" -Name "Global search uses live exact-meaning ranking" -Needles @(
    "client.searchNodes(term, { limit: 100 })",
    "DictionaryRootApi.rankMeaningResults",
    "DictionaryRootApi.exactMeaningResults",
    "DictionaryRootApi.meaningMatchRank",
    "No fallback data was used"
)

Test-TextContains -RelativePath "assets\js\dictionaryroot-navigation.js" -Name "Shared navigation has active, responsive, and context-aware behavior" -Needles @(
    'aria-current="page"',
    "dictionaryroot-mobile-menu-button",
    "buildHref",
    "meaning",
    "nodeId",
    "sourceId",
    "dictionaryroot:urlchange"
)

Test-TextContains -RelativePath "assets\css\dictionaryroot-navigation.css" -Name "Mobile navigation and global result panel styles are present" -Needles @(
    "@media (max-width: 900px)",
    "dictionaryroot-global-search-panel",
    'dictionaryroot-product-nav a[aria-current="page"]',
    "dictionaryroot-mobile-menu-button"
)

Test-TextContains -RelativePath "assets\js\dictionaryroot-api.js" -Name "SourceRoot API and meaning-ranking compatibility remain present" -Needles @(
    "class DictionaryRootApiClient",
    "meaningMatchRank",
    "exactMeaningResults",
    "rankMeaningResults",
    "sourceExperience",
    "listSourceLinkedRecords"
)

Test-TextContains -RelativePath "assets\js\dictionaryroot-concept.js" -Name "Concept Experience preserves URL history and cross-experience context" -Needles @(
    'global.addEventListener("popstate"',
    'experienceHref("graph-v2.html"',
    "Inspect source record",
    "state.client.concept(nodeId)"
)

Test-TextContains -RelativePath "assets\js\dictionaryroot-graph.js" -Name "Knowledge Sphere supports Back/Forward and context links" -Needles @(
    'global.addEventListener("popstate"',
    "global.history.pushState",
    "global.history.replaceState",
    "history: null",
    "Inspect source record",
    'experienceHref("concept-v2.html"'
)

Test-TextContains -RelativePath "assets\js\dictionaryroot-sources.js" -Name "Source Experience preserves source, meaning, and node context" -Needles @(
    'params.set("meaning"',
    'params.set("nodeId"',
    'global.addEventListener("popstate"',
    "sourceExperience(id",
    "conceptHref",
    "sphereHref"
)

$LiveFrontendFiles = @(
    "concept-v2.html",
    "graph-v2.html",
    "sources-v2.html",
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-brand.js",
    "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-concept.js",
    "assets\js\dictionaryroot-graph.js",
    "assets\js\dictionaryroot-sources.js"
) | ForEach-Object { Get-Item -LiteralPath (Join-Path $script:RepositoryRoot $_) }
$ForbiddenMatches = @($LiveFrontendFiles | Select-String -SimpleMatch -Pattern "data/nodes.json", "data\nodes.json" -ErrorAction SilentlyContinue)
Write-VerificationResult -Name "No legacy data/nodes.json dependency" -Passed ($ForbiddenMatches.Count -eq 0) -Detail $(if ($ForbiddenMatches.Count -gt 0) { ($ForbiddenMatches | ForEach-Object { "$($_.Path):$($_.LineNumber)" }) -join "; " } else { "" })

try {
    $Config = Get-Content -LiteralPath (Join-Path $script:RepositoryRoot "config\customers\dictionaryroot.json") -Raw | ConvertFrom-Json
    $ConfigOkay = ($Config.customerId -eq "dictionaryroot" -and $Config.apiBaseUrl -and $Config.bundleId)
    Write-VerificationResult -Name "DictionaryRoot customer manifest is valid" -Passed ([bool]$ConfigOkay) -Detail "customerId=$($Config.customerId); apiBaseUrl=$($Config.apiBaseUrl); bundleId=$($Config.bundleId)"
}
catch {
    Write-VerificationResult -Name "DictionaryRoot customer manifest is valid" -Passed $false -Detail $_.Exception.Message
    $Config = $null
}

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($null -ne $NodeCommand) {
    $JavaScriptFiles = @(
        "assets\js\dictionaryroot-api.js",
        "assets\js\dictionaryroot-brand.js",
        "assets\js\dictionaryroot-navigation.js",
        "assets\js\dictionaryroot-concept.js",
        "assets\js\dictionaryroot-graph.js",
        "assets\js\dictionaryroot-sources.js"
    )
    foreach ($RelativePath in $JavaScriptFiles) {
        $Output = & $NodeCommand.Source --check (Join-Path $script:RepositoryRoot $RelativePath) 2>&1
        $Okay = ($LASTEXITCODE -eq 0)
        Write-VerificationResult -Name "JavaScript syntax: $RelativePath" -Passed $Okay -Detail $(if (-not $Okay) { ($Output -join " ") } else { "" })
    }
}
else {
    Write-VerificationWarning -Name "Node.js syntax checks skipped" -Detail "Install Node.js or run node --check against each DictionaryRoot JavaScript file."
}

if ($SkipApi) {
    Write-VerificationWarning -Name "Live SourceRoot API checks skipped" -Detail "Run again without -SkipApi while the backend is running."
}
elseif ($null -eq $Config) {
    Write-VerificationResult -Name "Live SourceRoot API checks" -Passed $false -Detail "Customer manifest could not be parsed."
}
else {
    $ResolvedApiBase = if ($ApiBaseUrl) { $ApiBaseUrl.TrimEnd('/') } else { ([string]$Config.apiBaseUrl).TrimEnd('/') }
    $ServiceOrigin = $ResolvedApiBase -replace "/api/v1$", ""
    try {
        $Health = Invoke-RestMethod -Uri "$ServiceOrigin/health" -Method Get -TimeoutSec 12
        Write-VerificationResult -Name "SourceRoot health endpoint responds" -Passed ($null -ne $Health) -Detail "$ServiceOrigin/health"
    }
    catch {
        Write-VerificationResult -Name "SourceRoot health endpoint responds" -Passed $false -Detail $_.Exception.Message
    }

    try {
        $EncodedQuery = [System.Uri]::EscapeDataString("knowledge")
        $EncodedBundle = [System.Uri]::EscapeDataString([string]$Config.bundleId)
        $EncodedDomain = [System.Uri]::EscapeDataString([string]$Config.domain)
        $SearchUri = "$ResolvedApiBase/search?q=$EncodedQuery&type=node&bundleId=$EncodedBundle&domain=$EncodedDomain&page=1&limit=100"
        $SearchPayload = Invoke-RestMethod -Uri $SearchUri -Method Get -TimeoutSec 20
        $SearchItems = @(Get-ApiItems -Payload $SearchPayload)
        Write-VerificationResult -Name "Live exact-meaning search returns node records" -Passed ($SearchItems.Count -gt 0) -Detail "$($SearchItems.Count) records returned for knowledge."
    }
    catch {
        Write-VerificationResult -Name "Live exact-meaning search returns node records" -Passed $false -Detail $_.Exception.Message
        $SearchItems = @()
    }

    try {
        $EncodedBundle = [System.Uri]::EscapeDataString([string]$Config.bundleId)
        $SourcesUri = "$ResolvedApiBase/sources?bundleId=$EncodedBundle&page=1&limit=5"
        $SourcesPayload = Invoke-RestMethod -Uri $SourcesUri -Method Get -TimeoutSec 20
        $SourceItems = @(Get-ApiItems -Payload $SourcesPayload)
        Write-VerificationResult -Name "Live SourceRoot source registry returns records" -Passed ($SourceItems.Count -gt 0) -Detail "$($SourceItems.Count) source records returned."
    }
    catch {
        Write-VerificationResult -Name "Live SourceRoot source registry returns records" -Passed $false -Detail $_.Exception.Message
    }

    if ($SearchItems.Count -gt 0) {
        $FirstSearchItem = $SearchItems[0]
        $FirstNodeId = ""
        if ($FirstSearchItem.PSObject.Properties.Name -contains "id") {
            $FirstNodeId = [string]$FirstSearchItem.id
        }
        elseif ($FirstSearchItem.PSObject.Properties.Name -contains "nodeId") {
            $FirstNodeId = [string]$FirstSearchItem.nodeId
        }

        if ($FirstNodeId) {
            try {
                $NodeUri = "$ResolvedApiBase/nodes/$([System.Uri]::EscapeDataString($FirstNodeId))"
                $NodePayload = Invoke-RestMethod -Uri $NodeUri -Method Get -TimeoutSec 20
                Write-VerificationResult -Name "Live concept node endpoint resolves a search result" -Passed ($null -ne $NodePayload) -Detail $FirstNodeId
            }
            catch {
                Write-VerificationResult -Name "Live concept node endpoint resolves a search result" -Passed $false -Detail $_.Exception.Message
            }
        }
        else {
            Write-VerificationResult -Name "Live concept node endpoint resolves a search result" -Passed $false -Detail "Search result did not include id or nodeId."
        }
    }
}

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host ""
Write-Host "Manual browser checks still required:" -ForegroundColor Yellow
Write-Host "  1. Confirm desktop and mobile navigation layout."
Write-Host "  2. Search a word with multiple exact senses and choose each result."
Write-Host "  3. Move Concept -> Sphere -> Sources and confirm node/source context remains in the URL."
Write-Host "  4. Use browser Back and Forward through searches, sphere centers, and source selections."
Write-Host "  5. Stop SourceRoot and confirm global search and each experience show API-offline states without fallback data."

if ($script:Failed -gt 0) {
    exit 1
}

exit 0
