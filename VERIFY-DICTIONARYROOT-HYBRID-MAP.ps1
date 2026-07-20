param(
  [string]$RepoRoot = "C:\Users\Josh\Documents\GitHub\dictionaryhub",
  [string]$ApiBaseUrl = "http://localhost:3000/api/v1"
)

$ErrorActionPreference = "Stop"
$Files = @(
  "graph-v2.html",
  "assets\css\dictionaryroot-live.css",
  "assets\js\dictionaryroot-api.js",
  "assets\js\dictionaryroot-concept.js",
  "assets\js\dictionaryroot-graph.js",
  "backend\src\services\search-store.ts",
  "docs\customers\dictionaryroot\hybrid-map-stage.md"
)

Write-Host "DictionaryRoot Hybrid Map verification"
Write-Host ""
foreach ($RelativePath in $Files) {
  $Path = Join-Path $RepoRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "[FAIL] Missing $RelativePath" }
  Write-Host "[PASS] $RelativePath"
}

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCommand) {
  foreach ($RelativePath in @("assets\js\dictionaryroot-api.js", "assets\js\dictionaryroot-concept.js", "assets\js\dictionaryroot-graph.js")) {
    & node --check (Join-Path $RepoRoot $RelativePath)
    if ($LASTEXITCODE -ne 0) { throw "[FAIL] JavaScript syntax: $RelativePath" }
  }
  Write-Host "[PASS] JavaScript syntax"
}

$GraphScriptText = Get-Content (Join-Path $RepoRoot "assets\js\dictionaryroot-graph.js") -Raw
$GraphPageText = Get-Content (Join-Path $RepoRoot "graph-v2.html") -Raw
$HasDefaultMapMode = $GraphScriptText -match 'mode:\s*"map"'
$HasReadableRenderer = $GraphScriptText -match 'state\.mode\s*===\s*"readable"'
$HasMapControl = $GraphPageText -match 'id="graphModeMap"'
$HasReadableControl = $GraphPageText -match 'id="graphModeReadable"'
if (-not ($HasDefaultMapMode -and $HasReadableRenderer -and $HasMapControl -and $HasReadableControl)) {
  throw "[FAIL] Hybrid graph mode code was not found."
}
Write-Host "[PASS] Map Mode and Readable Mode"

$SearchStoreText = Get-Content (Join-Path $RepoRoot "backend\src\services\search-store.ts") -Raw
if ($SearchStoreText -notmatch "metadata -> 'lemmas'" -or $SearchStoreText -notmatch "JSONB_ARRAY_ELEMENTS_TEXT") {
  throw "[FAIL] Exact lexical search code was not found."
}
Write-Host "[PASS] Exact lexical search code"

Write-Host ""
Write-Host "Testing live SourceRoot customer search..."
$HealthUrl = $ApiBaseUrl -replace '/api/v1$', '/health'
try {
  $Health = Invoke-RestMethod -Uri $HealthUrl -Method Get
} catch {
  throw "[FAIL] SourceRoot API could not be reached. Restart the backend and run verification again."
}
if ($Health.status -ne "ok") { throw "[FAIL] SourceRoot API health" }
Write-Host "[PASS] SourceRoot API health"

$Query = [System.Uri]::EscapeDataString("knowledge")
$Bundle = [System.Uri]::EscapeDataString("dictionaryroot-oewn-2025-pilot-500")
$Domain = [System.Uri]::EscapeDataString("DictionaryRoot")
$SearchUrl = "$ApiBaseUrl/search?q=$Query&type=node&bundleId=$Bundle&domain=$Domain&page=1&limit=100"
$Response = Invoke-RestMethod -Uri $SearchUrl -Method Get
$Results = @($Response.results)
if ($Results.Count -eq 0) { throw "[FAIL] DictionaryRoot search returned no results." }

$Exact = @($Results | Where-Object {
  $TitleExact = ([string]$_.title).ToLowerInvariant() -eq "knowledge"
  $LemmaExact = $false
  if ($_.metadata -and $_.metadata.lemmas) {
    foreach ($Lemma in @($_.metadata.lemmas)) {
      if (([string]$Lemma).ToLowerInvariant() -eq "knowledge") { $LemmaExact = $true }
    }
  }
  $TitleExact -or $LemmaExact
})
if ($Exact.Count -eq 0) {
  throw "[FAIL] Search did not return an exact 'knowledge' lemma. Restart the backend and try again."
}
Write-Host "[PASS] Exact 'knowledge' meanings returned: $($Exact.Count)"
Write-Host ""
Write-Host "DictionaryRoot Hybrid Map verification passed."
Write-Host "Open graph-v2.html, press Ctrl+F5, and choose an exact knowledge sense."
