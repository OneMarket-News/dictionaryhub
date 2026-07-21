[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",

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
    Get-Content -LiteralPath (Join-Path $script:Root $RelativePath) -Raw
}

function Contains([string]$RelativePath, [string[]]$Markers, [string]$Name) {
    $Content = Text $RelativePath
    $Missing = @($Markers | Where-Object { $Content.IndexOf($_, [System.StringComparison]::Ordinal) -lt 0 })
    Result $Name ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "" })
}

function ApiItems($Payload) {
    if ($null -eq $Payload) { return @() }
    if ($Payload -is [System.Array]) { return @($Payload) }
    foreach ($Name in @("items", "results", "nodes", "revisions")) {
        if ($Payload.PSObject.Properties.Name -contains $Name) { return @($Payload.$Name) }
    }
    return @()
}

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Write-Host "Repository not found: $RepositoryPath" -ForegroundColor Red
    exit 2
}
$script:Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
Write-Host "DictionaryRoot Revision and Knowledge History v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:Root"
Write-Host ""

$Required = @(
    "history-v2.html",
    "concept-v2.html",
    "assets\css\dictionaryroot-history.css",
    "assets\css\dictionaryroot-navigation.css",
    "assets\js\dictionaryroot-history.js",
    "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-concept.js",
    "assets\js\dictionaryroot-api.js",
    "backend\src\services\revision-store.ts",
    "docs\customers\dictionaryroot\api-contract.md",
    "docs\customers\dictionaryroot\revision-history-stage.md"
)
$Missing = @($Required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:Root $_) -PathType Leaf) })
Result "Required revision-history files exist" ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "$($Required.Count) files found." })
if ($Missing.Count) { exit 1 }

Contains "history-v2.html" @(
    "dictionaryroot-history.css",
    "dictionaryroot-history.js",
    "dictionaryroot-navigation.js",
    "dictionaryrootHistoryTimeline",
    "dictionaryrootHistoryComparison",
    "dictionaryrootHistoryRevisionDetail"
) "History page loads the complete experience"

Contains "assets\js\dictionaryroot-navigation.js" @(
    '{ key: "history", label: "History", href: "history-v2.html" }',
    '"history-v2.html": "history"',
    'targetPage === "history"',
    'View history',
    'revisionId'
) "Shared navigation includes context-aware History links"

Contains "assets\js\dictionaryroot-history.js" @(
    'state.client.searchNodes(term, { limit: 100 })',
    'DictionaryRootApi.rankMeaningResults',
    'DictionaryRootApi.exactMeaningResults',
    'state.client.concept(nodeId)',
    'state.client.listAll("revisions"',
    'objectType: "node"',
    'objectType: "import-bundle"',
    'rawData',
    'snapshotFromRevision',
    'global.addEventListener("popstate"',
    'No fallback data was used'
) "History uses live exact meanings, revisions, comparison, and Back/Forward"

Contains "backend\src\services\revision-store.ts" @(
    'rawData: Record<string, unknown>',
    'raw_data: Record<string, unknown> | null',
    'rawData: row.raw_data || {}',
    'raw_data,'
) "Revision API exposes original imported revision metadata"

Contains "assets\js\dictionaryroot-concept.js" @(
    'experienceHref("history-v2.html"',
    'Review knowledge history',
    'View history'
) "Concept Experience links into knowledge history"

Contains "assets\css\dictionaryroot-history.css" @(
    ".dr-history-workspace",
    ".dr-history-timeline",
    '[data-status="disputed"]',
    '[data-status="superseded"]',
    "@media (max-width: 760px)"
) "History status and responsive styles are present"

$ForbiddenFiles = @(
    "history-v2.html",
    "assets\js\dictionaryroot-history.js",
    "assets\js\dictionaryroot-navigation.js",
    "assets\js\dictionaryroot-concept.js"
) | ForEach-Object { Get-Item -LiteralPath (Join-Path $script:Root $_) }
$Forbidden = @($ForbiddenFiles | Select-String -SimpleMatch -Pattern "data/nodes.json", "data\nodes.json" -ErrorAction SilentlyContinue)
Result "No legacy or fallback history dependency" ($Forbidden.Count -eq 0)

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
    foreach ($File in @("assets\js\dictionaryroot-history.js", "assets\js\dictionaryroot-navigation.js", "assets\js\dictionaryroot-concept.js")) {
        $Output = & $Node.Source --check (Join-Path $script:Root $File) 2>&1
        Result "JavaScript syntax: $File" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
    }
} else { Warning "JavaScript syntax checks skipped" "Node.js was not found." }

$Npm = Get-Command npm -ErrorAction SilentlyContinue
if ($Npm) {
    Push-Location (Join-Path $script:Root "backend")
    try {
        $Output = & $Npm.Source run typecheck --silent 2>&1
        Result "SourceRoot TypeScript typecheck" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
    } finally { Pop-Location }
} else { Warning "SourceRoot TypeScript typecheck skipped" "npm was not found." }

try {
    $Config = Get-Content -LiteralPath (Join-Path $script:Root "config\customers\dictionaryroot.json") -Raw | ConvertFrom-Json
} catch {
    Result "DictionaryRoot customer manifest parses" $false $_.Exception.Message
    $Config = $null
}

if ($SkipApi) {
    Warning "Live SourceRoot revision checks skipped" "Run again without -SkipApi while the backend is running after restart."
} elseif ($null -eq $Config) {
    Result "Live SourceRoot revision checks" $false "Customer manifest could not be parsed."
} else {
    $Base = if ($ApiBaseUrl) { $ApiBaseUrl.TrimEnd('/') } else { ([string]$Config.apiBaseUrl).TrimEnd('/') }
    $Origin = $Base -replace "/api/v1$", ""
    try {
        $Health = Invoke-RestMethod -Uri "$Origin/health" -Method Get -TimeoutSec 12
        Result "SourceRoot health endpoint responds" ($null -ne $Health) "$Origin/health"
    } catch { Result "SourceRoot health endpoint responds" $false $_.Exception.Message }

    $SearchItems = @()
    try {
        $Query = [System.Uri]::EscapeDataString("knowledge")
        $Bundle = [System.Uri]::EscapeDataString([string]$Config.bundleId)
        $Domain = [System.Uri]::EscapeDataString([string]$Config.domain)
        $Payload = Invoke-RestMethod -Uri "$Base/search?q=$Query&type=node&bundleId=$Bundle&domain=$Domain&page=1&limit=100" -Method Get -TimeoutSec 20
        $SearchItems = @(ApiItems $Payload)
        Result "Live exact-meaning search returns records" ($SearchItems.Count -gt 0) "$($SearchItems.Count) records returned."
    } catch { Result "Live exact-meaning search returns records" $false $_.Exception.Message }

    $RevisionItems = @()
    try {
        $Bundle = [System.Uri]::EscapeDataString([string]$Config.bundleId)
        $Payload = Invoke-RestMethod -Uri "$Base/revisions?bundleId=$Bundle&page=1&limit=100" -Method Get -TimeoutSec 20
        $RevisionItems = @(ApiItems $Payload)
        Result "Live SourceRoot revision registry returns records" ($RevisionItems.Count -gt 0) "$($RevisionItems.Count) revision records returned."
    } catch { Result "Live SourceRoot revision registry returns records" $false $_.Exception.Message }

    if ($RevisionItems.Count -gt 0) {
        $First = $RevisionItems[0]
        $HasRawData = $First.PSObject.Properties.Name -contains "rawData"
        Result "Revision list exposes rawData" $HasRawData $(if (-not $HasRawData) { "Restart SourceRoot so the updated revision-store service is loaded." } else { "" })
        try {
            $RevisionId = [System.Uri]::EscapeDataString([string]$First.revisionId)
            $Detail = Invoke-RestMethod -Uri "$Base/revisions/$RevisionId" -Method Get -TimeoutSec 20
            $DetailOkay = $null -ne $Detail -and ($Detail.PSObject.Properties.Name -contains "rawData")
            Result "Live revision detail resolves with rawData" $DetailOkay ([string]$First.revisionId)
        } catch { Result "Live revision detail resolves with rawData" $false $_.Exception.Message }
    }
}

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host ""
Write-Host "Manual browser checks still required:" -ForegroundColor Yellow
Write-Host "  1. Search a multi-sense word and open two exact histories."
Write-Host "  2. Move Concept -> History -> Sphere -> Sources and confirm context remains in the URL."
Write-Host "  3. Select revisions and status filters, then use browser Back and Forward."
Write-Host "  4. Confirm the mobile History layout at 390 x 844 and 320 x 568."
Write-Host "  5. Stop SourceRoot and confirm History shows API-offline states without fallback data."

if ($script:Failed -gt 0) { exit 1 }
exit 0
