param(
  [string]$RepoRoot = "C:\Users\Josh\Documents\GitHub\dictionaryhub",
  [string]$ApiBaseUrl = "http://localhost:3000/api/v1"
)

$ErrorActionPreference = "Stop"

$Files = @(
  "graph-v2.html",
  "assets\css\dictionaryroot-live.css",
  "assets\js\dictionaryroot-api.js",
  "assets\js\dictionaryroot-brand.js",
  "assets\js\dictionaryroot-graph.js",
  "config\customers\dictionaryroot.json",
  "docs\customers\dictionaryroot\knowledge-sphere-stage.md"
)

Write-Host "DictionaryRoot Knowledge Sphere Full-Width v1.1 verification"
Write-Host ""

foreach ($RelativePath in $Files) {
  $Path = Join-Path $RepoRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "[FAIL] Missing $RelativePath"
  }
  Write-Host "[PASS] $RelativePath"
}

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCommand) {
  foreach ($RelativePath in @(
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-brand.js",
    "assets\js\dictionaryroot-graph.js"
  )) {
    & node --check (Join-Path $RepoRoot $RelativePath)
    if ($LASTEXITCODE -ne 0) {
      throw "[FAIL] JavaScript syntax: $RelativePath"
    }
  }
  Write-Host "[PASS] JavaScript syntax"
}

$HtmlText = Get-Content (Join-Path $RepoRoot "graph-v2.html") -Raw
if (
  $HtmlText -notmatch 'class="dr-sphere-control-set dr-sphere-control-set-primary"' -or
  $HtmlText -notmatch 'id="sphereStatNeighborhoodEdges"' -or
  $HtmlText -notmatch 'id="sphereStatCenterEdges"' -or
  $HtmlText -notmatch 'id="dictionaryrootGraphNodes"'
) {
  throw "[FAIL] Full-width control hierarchy or relationship summaries were not found."
}
Write-Host "[PASS] Full-width control hierarchy and graph summaries"

$GraphText = Get-Content (Join-Path $RepoRoot "assets\js\dictionaryroot-graph.js") -Raw
if (
  $GraphText -notmatch 'function spherePositions' -or
  $GraphText -notmatch 'function buildNeighborhood' -or
  $GraphText -notmatch 'function neighborhoodEdges' -or
  $GraphText -notmatch 'function groupedRelations' -or
  $GraphText -notmatch 'elements\.input\.value = centerLabel' -or
  $GraphText -notmatch 'state\.client\.nodeEdges' -or
  $GraphText -notmatch 'state\.client\.concept'
) {
  throw "[FAIL] Full-width live sphere behavior was not found."
}
if ($GraphText -match 'data/nodes\.json') {
  throw "[FAIL] Static data/nodes.json loading is still present."
}
Write-Host "[PASS] Search synchronization and deduplicated relationship behavior"
Write-Host "[PASS] Live SourceRoot sphere engine"
Write-Host "[PASS] Static graph data removed"

$CssText = Get-Content (Join-Path $RepoRoot "assets\css\dictionaryroot-live.css") -Raw
if (
  $CssText -notmatch 'Knowledge Sphere v1\.1' -or
  $CssText -notmatch 'width: min\(96vw, 3000px\)' -or
  $CssText -notmatch 'height: clamp\(760px, 72vh, 1040px\)' -or
  $CssText -notmatch 'grid-template-columns: minmax\(0, 1fr\) clamp\(400px, 25vw, 540px\)' -or
  $CssText -notmatch '\.dr-sphere-details-scroll\s*\{[^}]*max-height: none' 
) {
  throw "[FAIL] Full-width Knowledge Sphere styling was not found."
}
Write-Host "[PASS] Full-width layout, larger sphere, and natural details scrolling"

Write-Host ""
Write-Host "Testing live SourceRoot customer data..."

$HealthUrl = $ApiBaseUrl -replace '/api/v1$', '/health'
$Health = Invoke-RestMethod -Uri $HealthUrl -Method Get
if ($Health.status -ne "ok") {
  throw "[FAIL] SourceRoot API health"
}
Write-Host "[PASS] SourceRoot API health"

$Query = [System.Uri]::EscapeDataString("knowledge")
$Bundle = [System.Uri]::EscapeDataString("dictionaryroot-oewn-2025-pilot-500")
$Domain = [System.Uri]::EscapeDataString("DictionaryRoot")
$SearchUrl = "$ApiBaseUrl/search?q=$Query&type=node&bundleId=$Bundle&domain=$Domain&page=1&limit=100"
$Response = Invoke-RestMethod -Uri $SearchUrl -Method Get
$Results = @($Response.results)

if ($Results.Count -eq 0) {
  throw "[FAIL] DictionaryRoot search returned no results."
}

$Exact = @($Results | Where-Object {
  $TitleExact = ([string]$_.title).ToLowerInvariant() -eq "knowledge"
  $LemmaExact = $false
  if ($_.metadata -and $_.metadata.lemmas) {
    foreach ($Lemma in @($_.metadata.lemmas)) {
      if (([string]$Lemma).ToLowerInvariant() -eq "knowledge") {
        $LemmaExact = $true
      }
    }
  }
  $TitleExact -or $LemmaExact
})

if ($Exact.Count -eq 0) {
  throw "[FAIL] Search did not return an exact knowledge lemma."
}
Write-Host "[PASS] Exact knowledge meanings returned: $($Exact.Count)"

$NodeId = [string]$Exact[0].id
if ([string]::IsNullOrWhiteSpace($NodeId)) {
  throw "[FAIL] Exact search result did not include a node id."
}

$EncodedNodeId = [System.Uri]::EscapeDataString($NodeId)
$Node = Invoke-RestMethod -Uri "$ApiBaseUrl/nodes/$EncodedNodeId" -Method Get
if (-not $Node.nodeId) {
  throw "[FAIL] Exact knowledge node could not be loaded."
}
Write-Host "[PASS] Exact knowledge node loaded"

$Edges = Invoke-RestMethod -Uri "$ApiBaseUrl/nodes/$EncodedNodeId/edges" -Method Get
$IncomingCount = @($Edges.incoming).Count
$OutgoingCount = @($Edges.outgoing).Count
if (($IncomingCount + $OutgoingCount) -eq 0) {
  throw "[FAIL] Exact knowledge node returned no live relationships."
}
Write-Host "[PASS] Live relationships returned: $($IncomingCount + $OutgoingCount)"

Write-Host ""
Write-Host "DictionaryRoot Knowledge Sphere Full-Width v1.1 verification passed."
Write-Host "Open graph-v2.html, press Ctrl+F5, and test recentering from knowledge to another meaning."
