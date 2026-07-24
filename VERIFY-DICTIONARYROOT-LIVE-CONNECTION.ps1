$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot

function Pass([string]$Message) {
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Check-File([string]$RelativePath, [string]$Marker) {
    $Path = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing file: $RelativePath"
    }
    if ($Marker) {
        $Content = Get-Content -LiteralPath $Path -Raw
        if ($Content -notlike "*$Marker*") {
            throw "Expected live connection marker was not found in $RelativePath"
        }
    }
    Pass $RelativePath
}

Write-Host "DictionaryRoot live customer verification" -ForegroundColor Cyan
Write-Host ""

Check-File "concept-v2.html" "dictionaryroot-concept.js"
Check-File "graph-v2.html" "dictionaryroot-graph.js"
Check-File "assets\css\dictionaryroot-live.css" ".dr-graph-stage"
Check-File "assets\js\dictionaryroot-api.js" "searchNodes"
Check-File "assets\js\dictionaryroot-concept.js" "DictionaryRootApi.loadManifest"
Check-File "assets\js\dictionaryroot-graph.js" "loadNeighborhood"
Check-File "config\customers\dictionaryroot.json" '"domain": "DictionaryRoot"'
Check-File "docs\customers\dictionaryroot\live-connection-stage.md" "Live customer capabilities"

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCommand) {
    & node --check (Join-Path $RepoRoot "assets\js\dictionaryroot-api.js")
    if ($LASTEXITCODE -ne 0) { throw "dictionaryroot-api.js failed JavaScript syntax verification." }
    & node --check (Join-Path $RepoRoot "assets\js\dictionaryroot-concept.js")
    if ($LASTEXITCODE -ne 0) { throw "dictionaryroot-concept.js failed JavaScript syntax verification." }
    & node --check (Join-Path $RepoRoot "assets\js\dictionaryroot-graph.js")
    if ($LASTEXITCODE -ne 0) { throw "dictionaryroot-graph.js failed JavaScript syntax verification." }
    Pass "JavaScript syntax"
} else {
    Write-Host "[INFO] Node was not available, so JavaScript syntax checks were skipped." -ForegroundColor Yellow
}

$ManifestPath = Join-Path $RepoRoot "config\customers\dictionaryroot.json"
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$ApiBase = ([string]$Manifest.apiBaseUrl).TrimEnd('/')
$ApiOrigin = $ApiBase -replace "/api/v1$", ""
$BundleId = [uri]::EscapeDataString([string]$Manifest.bundleId)
$Domain = [uri]::EscapeDataString([string]$Manifest.domain)

Write-Host ""
Write-Host "Testing live SourceRoot customer requests..." -ForegroundColor Cyan

try {
    $Health = Invoke-RestMethod -Method Get -Uri "$ApiOrigin/health" -TimeoutSec 15
    Pass "SourceRoot API health"

    $SearchUri = "$ApiBase/search?q=knowledge&bundleId=$BundleId&domain=$Domain&type=node&page=1&limit=5"
    $Search = Invoke-RestMethod -Method Get -Uri $SearchUri -TimeoutSec 20
    if (-not $Search.results -or $Search.results.Count -lt 1) {
        throw "Live customer search returned no DictionaryRoot node results."
    }
    $NodeId = [string]$Search.results[0].id
    Pass "Customer-filtered search returned $($Search.total) node matches"

    $Node = Invoke-RestMethod -Method Get -Uri "$ApiBase/nodes/$([uri]::EscapeDataString($NodeId))" -TimeoutSec 15
    if (-not $Node.nodeId) { throw "Node response did not include nodeId." }
    Pass "Concept node loaded: $($Node.title)"

    $Assertions = Invoke-RestMethod -Method Get -Uri "$ApiBase/nodes/$([uri]::EscapeDataString($NodeId))/assertions" -TimeoutSec 15
    Pass "Concept assertions loaded: $($Assertions.total)"

    $Edges = Invoke-RestMethod -Method Get -Uri "$ApiBase/nodes/$([uri]::EscapeDataString($NodeId))/edges" -TimeoutSec 15
    Pass "Concept relationships loaded: $($Edges.total)"
} catch {
    Write-Host ""
    Write-Host "[FAIL] The files are installed, but the live customer request failed." -ForegroundColor Red
    Write-Host "Start the SourceRoot backend, confirm PostgreSQL contains the DictionaryRoot bundle, and run this verifier again."
    throw
}

Write-Host ""
Write-Host "DictionaryRoot Customer #001 is connected to SourceRoot." -ForegroundColor Green
Write-Host "Open concept-v2.html and graph-v2.html through your local frontend server."
