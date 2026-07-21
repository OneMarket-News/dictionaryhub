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

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Write-Host "Repository not found: $RepositoryPath" -ForegroundColor Red
    exit 2
}

$script:Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
Write-Host "DictionaryRoot Dynamic Sphere Expansion v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:Root"
Write-Host ""

$Required = @(
    "graph-v2.html",
    "assets\css\dictionaryroot-dynamic-sphere.css",
    "assets\css\dictionaryroot-hybrid-map.css",
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-graph.js",
    "backend\src\routes\lexicon.ts",
    "backend\src\services\dynamic-neighborhood.ts",
    "config\customers\dictionaryroot.json",
    "docs\customers\dictionaryroot\dynamic-sphere-expansion-stage.md"
)
$Missing = @($Required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:Root $_) -PathType Leaf) })
Result "Required dynamic-sphere files exist" ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "$($Required.Count) files found." })
if ($Missing.Count) { exit 1 }

Contains "graph-v2.html" @(
    "Dynamic expansion",
    "sphereExpansionDepth",
    "sphereExpansionLimit",
    "sphereExpandSelected",
    "sphereCollapseSelected",
    "sphereResetExpansions",
    "sphereStatCoreNodes",
    "sphereStatDynamicNodes",
    "assets/css/dictionaryroot-dynamic-sphere.css"
) "Knowledge Sphere exposes bounded dynamic expansion controls"

Contains "assets\js\dictionaryroot-api.js" @(
    "dynamicExpansion",
    "dynamicNeighborhood(nodeId, params)",
    "/dictionaryroot/lexicon/neighborhood/"
) "DictionaryRoot API client exposes the dynamic neighborhood route"

Contains "assets\js\dictionaryroot-graph.js" @(
    "expansionBranches: new Map()",
    "expandedNodeIds: new Set()",
    "async function expandBranch",
    "function collapseBranch",
    "function clearExpansions",
    "function restoreExpansions",
    "graphMembership(record)",
    'url.searchParams.set("expand"',
    "expandDepth",
    "maxNodes",
    "data-membership"
) "Knowledge Sphere supports expansion, collapse, membership, and URL restoration"

Contains "backend\src\routes\lexicon.ts" @(
    'lexiconRouter.get("/neighborhood/:nodeId"',
    "INVALID_EXPANSION",
    "getDictionaryRootDynamicNeighborhood"
) "SourceRoot exposes the bounded neighborhood endpoint"

Contains "backend\src\services\dynamic-neighborhood.ts" @(
    "DictionaryRootGraphMembership",
    "getDictionaryRootDynamicNeighborhood",
    "graphMembership",
    "records.size >= limit",
    "neighborLimit",
    "truncated"
) "Neighborhood service bounds node count and classifies graph membership"

Contains "assets\css\dictionaryroot-dynamic-sphere.css" @(
    ".dr-sphere-expansion-panel",
    '.dr-sphere-node[data-membership="dynamic"]',
    ".dr-sphere-node-membership",
    ".dr-sphere-membership-legend",
    "@media (max-width: 760px)",
    "@media (max-width: 480px)"
) "Dynamic expansion has core, on-demand, desktop, and mobile styles"

$ForbiddenFiles = @(
    "graph-v2.html",
    "assets\js\dictionaryroot-graph.js",
    "backend\src\services\dynamic-neighborhood.ts"
) | ForEach-Object { Get-Item -LiteralPath (Join-Path $script:Root $_) }
$Forbidden = @($ForbiddenFiles | Select-String -SimpleMatch -Pattern "data/nodes.json", "fallbackData", "fallbackNodes" -ErrorAction SilentlyContinue)
Result "Dynamic sphere has no legacy or fallback graph dependency" ($Forbidden.Count -eq 0) $(if ($Forbidden.Count) { ($Forbidden | ForEach-Object { "$($_.Path):$($_.LineNumber)" }) -join "; " } else { "" })

try {
    $Config = Get-Content -LiteralPath (Join-Path $script:Root "config\customers\dictionaryroot.json") -Raw | ConvertFrom-Json
    $Dynamic = $Config.dynamicExpansion
    $ConfigOkay = $null -ne $Dynamic -and [int]$Dynamic.defaultDepth -eq 1 -and [int]$Dynamic.maximumDepth -eq 2 -and [int]$Dynamic.maximumVisibleNodes -ge 50 -and [int]$Dynamic.maximumBranches -ge 1
    Result "Customer manifest defines bounded expansion defaults" $ConfigOkay
} catch {
    Result "Customer manifest defines bounded expansion defaults" $false $_.Exception.Message
    $Config = $null
}

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
    foreach ($File in @("assets\js\dictionaryroot-api.js", "assets\js\dictionaryroot-graph.js")) {
        $Output = & $Node.Source --check (Join-Path $script:Root $File) 2>&1
        Result "JavaScript syntax: $File" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
    }
} else {
    Warning "JavaScript syntax skipped" "Node.js was not found."
}

$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($Npm) {
    Push-Location (Join-Path $script:Root "backend")
    try {
        $Typecheck = & $Npm.Source run typecheck 2>&1
        Result "SourceRoot TypeScript typecheck" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Typecheck -join " " } else { "" })
    } finally {
        Pop-Location
    }
} else {
    Warning "SourceRoot TypeScript typecheck skipped" "npm.cmd was not found."
}

if ($SkipApi) {
    Warning "Live dynamic expansion checks skipped" "Run without -SkipApi with SourceRoot running."
} elseif ($null -eq $Config) {
    Result "Live dynamic expansion checks" $false "Customer manifest could not be parsed."
} else {
    $Base = if ($ApiBaseUrl) { $ApiBaseUrl.TrimEnd('/') } else { ([string]$Config.apiBaseUrl).TrimEnd('/') }
    $Origin = $Base -replace "/api/v1$", ""
    $Bundle = [System.Uri]::EscapeDataString([string]$Config.bundleId)
    $LexicalNodeId = "dictionaryroot-oewn-2025-noun-10702314"
    $CoreNodeId = "dictionaryroot-oewn-2025-noun-00017591"

    try {
        $Health = Invoke-RestMethod -Uri "$Origin/health" -Method Get -TimeoutSec 15
        Result "SourceRoot health endpoint responds" ($Health.status -eq "ok") "$Origin/health"
    } catch {
        Result "SourceRoot health endpoint responds" $false $_.Exception.Message
    }

    try {
        $Lexical = Invoke-RestMethod -Uri "$Base/dictionaryroot/lexicon/neighborhood/${LexicalNodeId}?depth=1&limit=24&bundleId=$Bundle" -Method Get -TimeoutSec 60
        $Items = @($Lexical.items)
        $Edges = @($Lexical.edges)
        $Root = @($Items | Where-Object { $_.node.nodeId -eq $LexicalNodeId }) | Select-Object -First 1
        Result "Lexical-only meaning expands through the live neighborhood route" ($Lexical.rootNodeId -eq $LexicalNodeId -and $Items.Count -gt 1 -and $Edges.Count -gt 0) "nodes=$($Items.Count); edges=$($Edges.Count); truncated=$($Lexical.truncated)"
        Result "Lexical-only root is labeled as loaded on demand" ($null -ne $Root -and $Root.graphMembership -eq "dynamic") "membership=$($Root.graphMembership)"
        $UniqueNodeIds = @($Items | ForEach-Object { $_.node.nodeId } | Sort-Object -Unique)
        $UniqueEdgeIds = @($Edges | ForEach-Object { $_.edgeId } | Sort-Object -Unique)
        Result "Live expansion suppresses duplicate nodes and edges" ($UniqueNodeIds.Count -eq $Items.Count -and $UniqueEdgeIds.Count -eq $Edges.Count) "nodes=$($Items.Count); uniqueNodes=$($UniqueNodeIds.Count); edges=$($Edges.Count); uniqueEdges=$($UniqueEdgeIds.Count)"
        Result "Live expansion respects the requested node limit" ($Items.Count -le 24) "nodes=$($Items.Count); limit=24"
    } catch {
        Result "Lexical-only meaning expands through the live neighborhood route" $false $_.Exception.Message
    }

    try {
        $Core = Invoke-RestMethod -Uri "$Base/dictionaryroot/lexicon/neighborhood/${CoreNodeId}?depth=1&limit=12&bundleId=$Bundle" -Method Get -TimeoutSec 60
        $CoreRoot = @($Core.items | Where-Object { $_.node.nodeId -eq $CoreNodeId }) | Select-Object -First 1
        Result "Curated graph meaning remains labeled as core" ($null -ne $CoreRoot -and $CoreRoot.graphMembership -eq "core") "membership=$($CoreRoot.graphMembership)"
    } catch {
        Result "Curated graph meaning remains labeled as core" $false $_.Exception.Message
    }

    try {
        $Coverage = Invoke-RestMethod -Uri "$Base/dictionaryroot/lexicon/coverage?q=value&bundleId=$Bundle" -Method Get -TimeoutSec 30
        Result "Existing exact value coverage remains compatible" ([int]$Coverage.exactSenseCount -eq 11 -and [int]$Coverage.graphSenseCount -gt 0 -and [int]$Coverage.lexicalOnlySenseCount -gt 0) "exact=$($Coverage.exactSenseCount); graph=$($Coverage.graphSenseCount); lexicalOnly=$($Coverage.lexicalOnlySenseCount)"
    } catch {
        Result "Existing exact value coverage remains compatible" $false $_.Exception.Message
    }
}

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host ""
Write-Host "Manual browser checks still required:"
Write-Host "  1. Open a lexical-only meaning in graph-v2.html and confirm it is marked Loaded on demand."
Write-Host "  2. Expand one-hop and two-hop branches, then collapse one branch and clear all dynamic nodes."
Write-Host "  3. Confirm core and dynamic nodes remain visually distinct in Map and Readable modes."
Write-Host "  4. Use browser Back and Forward and share a URL containing expand, expandDepth, and maxNodes."
Write-Host "  5. Confirm the visible node budget prevents uncontrolled expansion."
Write-Host "  6. Confirm mobile layouts at 390 x 844 and 320 x 568."
Write-Host "  7. Stop SourceRoot and confirm no fallback graph data appears."

if ($script:Failed -gt 0) { exit 1 }
exit 0
