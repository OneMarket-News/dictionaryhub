param(
  [string]$RepoRoot = $PSScriptRoot,
  [string]$ApiBaseUrl = "http://localhost:3000/api/v1"
)

$ErrorActionPreference = "Stop"

$Files = @(
  "concept-v2.html",
  "graph-v2.html",
  "assets\css\dictionaryroot-live.css",
  "assets\js\dictionaryroot-api.js",
  "assets\js\dictionaryroot-brand.js",
  "assets\js\dictionaryroot-concept.js",
  "config\customers\dictionaryroot.json",
  "docs\customers\dictionaryroot\concept-experience-stage.md"
)

Write-Host "DictionaryRoot Concept Experience v1 verification"
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
    "assets\js\dictionaryroot-concept.js"
  )) {
    & node --check (Join-Path $RepoRoot $RelativePath)
    if ($LASTEXITCODE -ne 0) {
      throw "[FAIL] JavaScript syntax: $RelativePath"
    }
  }
  Write-Host "[PASS] JavaScript syntax"
}

$HtmlText = Get-Content (Join-Path $RepoRoot "concept-v2.html") -Raw
if (
  $HtmlText -notmatch 'class="dr-live-main dr-concept-main"' -or
  $HtmlText -notmatch 'id="dictionaryrootSenseChooser"' -or
  $HtmlText -notmatch 'id="dictionaryrootConceptSummary"' -or
  $HtmlText -notmatch 'class="dr-concept-workspace"' -or
  $HtmlText -notmatch 'assets/js/dictionaryroot-concept.js'
) {
  throw "[FAIL] Concept Experience page structure was not found."
}
Write-Host "[PASS] Full-width concept workspace and exact-sense chooser"

$ConceptText = Get-Content (Join-Path $RepoRoot "assets\js\dictionaryroot-concept.js") -Raw
if (
  $ConceptText -notmatch 'function groupedRelations' -or
  $ConceptText -notmatch 'function renderRelationshipSections' -or
  $ConceptText -notmatch 'function renderSourcesSection' -or
  $ConceptText -notmatch 'state\.client\.concept' -or
  $ConceptText -notmatch 'state\.client\.nodesByIds' -or
  $ConceptText -notmatch 'global\.addEventListener\("popstate"' -or
  $ConceptText -notmatch 'elements\.input\.value = state\.currentLabel'
) {
  throw "[FAIL] Live concept, relationship grouping, or navigation behavior was not found."
}
if ($ConceptText -match 'data/nodes\.json' -or $ConceptText -match 'fallbackNodes') {
  throw "[FAIL] Static concept data is still present."
}
Write-Host "[PASS] Live concept retrieval, grouped relationships, and URL navigation"
Write-Host "[PASS] Static concept data removed"

$CssText = Get-Content (Join-Path $RepoRoot "assets\css\dictionaryroot-live.css") -Raw
if (
  $CssText -notmatch 'DictionaryRoot Concept Experience v1' -or
  $CssText -notmatch 'width: min\(1540px, calc\(100% - 2rem\)\)' -or
  $CssText -notmatch 'grid-template-columns: minmax\(0, 1fr\) clamp\(360px, 26vw, 440px\)' -or
  $CssText -notmatch '\.dr-concept-relationship-grid' -or
  $CssText -notmatch '\.dr-concept-sticky-card'
) {
  throw "[FAIL] Concept Experience styling was not found."
}
Write-Host "[PASS] Full-width definition-first styling and responsive relationship layout"

$GraphText = Get-Content (Join-Path $RepoRoot "graph-v2.html") -Raw
if ($GraphText -notmatch 'id="dictionaryrootGraphStage"' -or $GraphText -notmatch 'id="dictionaryrootGraphNodes"') {
  throw "[FAIL] The verified Knowledge Sphere page is no longer intact."
}
Write-Host "[PASS] Knowledge Sphere page remains intact"

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

$AssertionPayload = Invoke-RestMethod -Uri "$ApiBaseUrl/nodes/$EncodedNodeId/assertions" -Method Get
$AssertionItems = @()
if ($AssertionPayload -is [System.Array]) {
  $AssertionItems = @($AssertionPayload)
} elseif ($AssertionPayload.assertions) {
  $AssertionItems = @($AssertionPayload.assertions)
} elseif ($AssertionPayload.items) {
  $AssertionItems = @($AssertionPayload.items)
}

$Definitions = @($AssertionItems | Where-Object { ([string]$_.assertionType).ToLowerInvariant() -eq "definition" })
if ($Definitions.Count -eq 0) {
  throw "[FAIL] Exact knowledge node returned no definition assertion."
}
Write-Host "[PASS] Definition assertions returned: $($Definitions.Count)"

$Edges = Invoke-RestMethod -Uri "$ApiBaseUrl/nodes/$EncodedNodeId/edges" -Method Get
$IncomingCount = @($Edges.incoming).Count
$OutgoingCount = @($Edges.outgoing).Count
$RelationshipCount = $IncomingCount + $OutgoingCount
if ($RelationshipCount -eq 0) {
  throw "[FAIL] Exact knowledge node returned no live relationships."
}
Write-Host "[PASS] Live relationships returned: $RelationshipCount"

$SourceIds = New-Object System.Collections.Generic.List[string]
foreach ($SourceId in @($Node.sourceIds)) {
  if (-not [string]::IsNullOrWhiteSpace([string]$SourceId)) { $SourceIds.Add([string]$SourceId) }
}
foreach ($Assertion in $AssertionItems) {
  foreach ($SourceId in @($Assertion.sourceIds)) {
    if (-not [string]::IsNullOrWhiteSpace([string]$SourceId)) { $SourceIds.Add([string]$SourceId) }
  }
}
$UniqueSourceIds = @($SourceIds | Select-Object -Unique)
if ($UniqueSourceIds.Count -eq 0) {
  throw "[FAIL] Exact knowledge node did not expose a source identifier."
}

$EncodedSourceId = [System.Uri]::EscapeDataString([string]$UniqueSourceIds[0])
$Source = Invoke-RestMethod -Uri "$ApiBaseUrl/sources/$EncodedSourceId" -Method Get
if (-not $Source.sourceId -and -not $Source.name) {
  throw "[FAIL] Recorded lexical source could not be loaded."
}
Write-Host "[PASS] Recorded lexical source loaded"

Write-Host ""
Write-Host "DictionaryRoot Concept Experience v1 verification passed."
Write-Host "Open concept-v2.html, press Ctrl+F5, search knowledge, choose its exact sense, and open a connected meaning."
