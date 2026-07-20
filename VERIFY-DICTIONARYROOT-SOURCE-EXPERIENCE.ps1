param(
  [string]$RepoRoot = "C:\Users\Josh\Documents\GitHub\dictionaryhub",
  [string]$ApiBaseUrl = "http://localhost:3000/api/v1"
)

$ErrorActionPreference = "Stop"
$script:Failures = New-Object System.Collections.Generic.List[string]

function Pass([string]$Message) {
  Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
  Write-Host "[FAIL] $Message" -ForegroundColor Red
  $script:Failures.Add($Message)
}

function Get-Text([string]$RelativePath) {
  $Path = Join-Path $RepoRoot $RelativePath
  if (-not (Test-Path $Path)) { return "" }
  return Get-Content $Path -Raw
}

function Test-ContainsPattern([string]$Text, [string]$Pattern, [string]$Message) {
  if ($Text -match $Pattern) { Pass $Message } else { Fail $Message }
}

function Test-AbsentPattern([string]$Text, [string]$Pattern, [string]$Message) {
  if ($Text -notmatch $Pattern) { Pass $Message } else { Fail $Message }
}

function Extract-Items($Payload, [string[]]$Properties) {
  if ($null -eq $Payload) { return @() }
  if ($Payload -is [System.Array]) { return @($Payload) }
  foreach ($Property in $Properties) {
    if ($Payload.PSObject.Properties.Name -contains $Property -and $null -ne $Payload.$Property) {
      return @($Payload.$Property)
    }
  }
  return @()
}

function Has-SourceId($Record, [string]$SourceId) {
  foreach ($Value in @($Record.sourceIds)) {
    if ([string]$Value -eq $SourceId) { return $true }
  }
  return $false
}

Write-Host "DictionaryRoot Source Experience v1 verification"
Write-Host "Repository: $RepoRoot"
Write-Host "API: $ApiBaseUrl"
Write-Host ""

$RequiredFiles = @(
  "sources-v2.html",
  "graph-v2.html",
  "concept-v2.html",
  "assets\css\dictionaryroot-live.css",
  "assets\js\dictionaryroot-api.js",
  "assets\js\dictionaryroot-brand.js",
  "assets\js\dictionaryroot-sources.js",
  "assets\js\dictionaryroot-graph.js",
  "assets\js\dictionaryroot-concept.js",
  "config\customers\dictionaryroot.json",
  "docs\customers\dictionaryroot\source-experience-stage.md"
)

foreach ($RelativePath in $RequiredFiles) {
  $Path = Join-Path $RepoRoot $RelativePath
  if (Test-Path $Path) { Pass "Required file exists: $RelativePath" } else { Fail "Missing required file: $RelativePath" }
}

Write-Host ""
Write-Host "Static and structural checks"

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCommand) {
  foreach ($RelativePath in @(
    "assets\js\dictionaryroot-api.js",
    "assets\js\dictionaryroot-brand.js",
    "assets\js\dictionaryroot-sources.js",
    "assets\js\dictionaryroot-graph.js",
    "assets\js\dictionaryroot-concept.js"
  )) {
    $Path = Join-Path $RepoRoot $RelativePath
    if (Test-Path $Path) {
      & node --check $Path
      if ($LASTEXITCODE -eq 0) { Pass "JavaScript syntax: $RelativePath" } else { Fail "JavaScript syntax: $RelativePath" }
    }
  }
} else {
  Fail "Node.js is required for JavaScript syntax verification."
}

$HtmlText = Get-Text "sources-v2.html"
$SourceText = Get-Text "assets\js\dictionaryroot-sources.js"
$ApiText = Get-Text "assets\js\dictionaryroot-api.js"
$CssText = Get-Text "assets\css\dictionaryroot-live.css"
$GraphHtmlText = Get-Text "graph-v2.html"
$GraphJsText = Get-Text "assets\js\dictionaryroot-graph.js"
$ConceptHtmlText = Get-Text "concept-v2.html"
$ConceptJsText = Get-Text "assets\js\dictionaryroot-concept.js"
$CombinedSourcePageText = $HtmlText + "`n" + $SourceText

$RequiredElementPatterns = @(
  'id="dictionaryrootSourceSearch"',
  'id="dictionaryrootSourceTypeFilter"',
  'id="dictionaryrootSourceSort"',
  'id="dictionaryrootSourceGrid"',
  'id="dictionaryrootSourceDetails"',
  'id="dictionaryrootSourceOffline"',
  'assets/js/dictionaryroot-sources\.js'
)
$MissingElement = $false
foreach ($Pattern in $RequiredElementPatterns) {
  if ($HtmlText -notmatch $Pattern) { $MissingElement = $true }
}
if ($MissingElement) { Fail "Required source-page elements and script references exist" } else { Pass "Required source-page elements and script references exist" }

if (
  $HtmlText -match 'DictionaryRoot Customer #001' -and
  $HtmlText -match 'assets/css/dictionaryroot-brand\.css' -and
  $HtmlText -match 'assets/js/dictionaryroot-brand\.js' -and
  $HtmlText -match 'dictionaryroot-source-page'
) { Pass "DictionaryRoot customer branding is used" } else { Fail "DictionaryRoot customer branding is used" }

Test-ContainsPattern $HtmlText 'Powered by SourceRoot|Live provenance through SourceRoot' "SourceRoot attribution is visible"

if (
  $ApiText -match 'async listAll\(' -and
  $ApiText -match 'sources\(params, options\)' -and
  $ApiText -match 'async listSourceLinkedRecords\(' -and
  $ApiText -match 'async sourceExperience\(' -and
  $ApiText -match 'this\.listSourceLinkedRecords\("assertions"' -and
  $ApiText -match 'this\.listSourceLinkedRecords\("edges"' -and
  $ApiText -match 'this\.nodesByIds\('
) { Pass "API client composes live sources, assertions, relationships, and nodes" } else { Fail "API client composes live sources, assertions, relationships, and nodes" }

if (
  $SourceText -match 'state\.client\.sources\(' -and
  $SourceText -match 'state\.client\.sourceExperience\(' -and
  $SourceText -match 'experience\.assertions' -and
  $SourceText -match 'experience\.nodes' -and
  $SourceText -match 'experience\.edges'
) { Pass "Source page retrieves live SourceRoot records" } else { Fail "Source page retrieves live SourceRoot records" }

Test-ContainsPattern $SourceText 'concept-v2\.html\?id=' "Concept links use concept-v2.html?id="
Test-ContainsPattern $SourceText 'graph-v2\.html\?center=' "Knowledge Sphere links use graph-v2.html?center="
Test-ContainsPattern $SourceText 'global\.addEventListener\("popstate"' "Browser Back/Forward support exists"
Test-ContainsPattern $SourceText 'params\.set\("source"' "Selected-source URL state exists"
Test-ContainsPattern $CssText 'DictionaryRoot Source Experience v1' "Source Experience stylesheet section exists"
Test-ContainsPattern $CssText 'grid-template-columns: minmax\(0, 1fr\) clamp\(400px, 31vw, 520px\)' "Full-width source workspace exists"
Test-ContainsPattern $CssText '\.dr-source-sticky-card' "Sticky source details layout exists"

Test-AbsentPattern $CombinedSourcePageText 'data/nodes(?:-v2-root)?\.json' "Static node JSON is absent"
Test-AbsentPattern $CombinedSourcePageText '(?i)fallbackSources|hardcodedSources|fallback source records' "Fallback source records are absent"
Test-AbsentPattern $CombinedSourcePageText '(?i)Stanford Encyclopedia|Merriam-Webster|Merriam Webster' "Old Stanford and Merriam-Webster demo data is absent"
Test-AbsentPattern $CombinedSourcePageText '(?i)(?:href|return|`|\")\s*=?\s*[`\"]concept\.html' "Old concept.html links are absent"
Test-AbsentPattern $CombinedSourcePageText '(?i)(?:href|return|`|\")\s*=?\s*[`\"]graph\.html' "Old graph.html links are absent"

if ($GraphHtmlText -match 'id="dictionaryrootGraphStage"' -and $GraphHtmlText -match 'id="dictionaryrootGraphNodes"' -and $GraphJsText -match 'dictionaryrootGraphStage') {
  Pass "Knowledge Sphere remains intact"
} else {
  Fail "Knowledge Sphere remains intact"
}

if ($ConceptHtmlText -match 'id="dictionaryrootSenseChooser"' -and $ConceptHtmlText -match 'id="dictionaryrootConceptSummary"' -and $ConceptJsText -match 'state\.client\.concept') {
  Pass "Concept Experience remains intact"
} else {
  Fail "Concept Experience remains intact"
}

Write-Host ""
Write-Host "Live SourceRoot checks"

$Manifest = $null
$BundleId = ""
try {
  $ManifestPath = Join-Path $RepoRoot "config\customers\dictionaryroot.json"
  $Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
  $BundleId = [string]$Manifest.bundleId
  if ([string]::IsNullOrWhiteSpace($BundleId)) {
    Fail "DictionaryRoot manifest contains a bundleId"
  } else {
    Pass "DictionaryRoot bundle configured: $BundleId"
  }
} catch {
  Fail "DictionaryRoot manifest can be read: $($_.Exception.Message)"
}

$HealthOk = $false
try {
  $ServiceRoot = $ApiBaseUrl -replace '/api/v1/?$', ''
  $Health = Invoke-RestMethod -Uri "$ServiceRoot/health" -Method Get
  if ($Health.status -eq "ok") {
    $HealthOk = $true
    Pass "SourceRoot API health"
  } else {
    Fail "SourceRoot API health returned an unexpected status"
  }
} catch {
  Fail "SourceRoot API health: $($_.Exception.Message)"
}

$SelectedSource = $null
$SelectedSourceId = ""
if ($HealthOk -and -not [string]::IsNullOrWhiteSpace($BundleId)) {
  try {
    $EncodedBundle = [System.Uri]::EscapeDataString($BundleId)
    $SourcePayload = Invoke-RestMethod -Uri "$ApiBaseUrl/sources?bundleId=$EncodedBundle&page=1&limit=100" -Method Get
    $Sources = @(Extract-Items $SourcePayload @("sources", "items", "results"))
    if ($Sources.Count -gt 0) {
      Pass "At least one live source can be retrieved: $($Sources.Count)"
    } else {
      Fail "At least one live source can be retrieved"
    }

    $OewnSources = @($Sources | Where-Object {
      $SourceSearchText = @($_.sourceId, $_.name, $_.publisher, $_.notes, $_.url) -join " "
      $SourceSearchText -match '(?i)oewn|open english wordnet|wordnet'
    })

    if ($OewnSources.Count -gt 0) {
      $SelectedSource = $OewnSources[0]
      Pass "Recorded OEWN lexical source is present"
    } else {
      Fail "Recorded OEWN lexical source is present"
    }

    if ($null -ne $SelectedSource) {
      $SelectedSourceId = [string]$SelectedSource.sourceId
      if ([string]::IsNullOrWhiteSpace($SelectedSourceId)) { $SelectedSourceId = [string]$SelectedSource.id }
    }
  } catch {
    Fail "Source registry retrieval: $($_.Exception.Message)"
  }
}

$LoadedSource = $null
if (-not [string]::IsNullOrWhiteSpace($SelectedSourceId)) {
  try {
    $EncodedSourceId = [System.Uri]::EscapeDataString($SelectedSourceId)
    $LoadedSource = Invoke-RestMethod -Uri "$ApiBaseUrl/sources/$EncodedSourceId" -Method Get
    if ($LoadedSource.sourceId -or $LoadedSource.name) {
      Pass "Recorded OEWN lexical source can be loaded: $SelectedSourceId"
    } else {
      Fail "Recorded OEWN lexical source can be loaded"
    }
  } catch {
    Fail "Recorded OEWN lexical source can be loaded: $($_.Exception.Message)"
  }
}

$MatchedAssertion = $null
if ($null -ne $LoadedSource -and -not [string]::IsNullOrWhiteSpace($BundleId)) {
  try {
    $Page = 1
    $TotalPages = 1
    do {
      $EncodedBundle = [System.Uri]::EscapeDataString($BundleId)
      $EncodedSourceId = [System.Uri]::EscapeDataString($SelectedSourceId)
      $AssertionPayload = Invoke-RestMethod -Uri "$ApiBaseUrl/assertions?bundleId=$EncodedBundle&sourceId=$EncodedSourceId&page=$Page&limit=100" -Method Get
      $Assertions = @(Extract-Items $AssertionPayload @("assertions", "items", "results"))
      $MatchedAssertion = @($Assertions | Where-Object { Has-SourceId $_ $SelectedSourceId } | Select-Object -First 1)
      if ($AssertionPayload.totalPages) { $TotalPages = [int]$AssertionPayload.totalPages }
      if ($MatchedAssertion.Count -gt 0) { $MatchedAssertion = $MatchedAssertion[0]; break }
      $Page++
    } while ($Page -le $TotalPages)

    if ($null -ne $MatchedAssertion) {
      Pass "At least one assertion connected to the OEWN source can be retrieved"
    } else {
      Fail "At least one assertion connected to the OEWN source can be retrieved"
    }
  } catch {
    Fail "Source assertion retrieval: $($_.Exception.Message)"
  }
}

if ($null -ne $MatchedAssertion) {
  try {
    $NodeId = [string]$MatchedAssertion.nodeId
    if ([string]::IsNullOrWhiteSpace($NodeId)) {
      Fail "Source-linked assertion contains a nodeId"
    } else {
      Pass "Source-linked assertion contains a nodeId"
      $EncodedNodeId = [System.Uri]::EscapeDataString($NodeId)
      $Node = Invoke-RestMethod -Uri "$ApiBaseUrl/nodes/$EncodedNodeId" -Method Get
      if ($Node.nodeId -or $Node.title) {
        Pass "At least one linked node can be retrieved: $NodeId"
      } else {
        Fail "At least one linked node can be retrieved"
      }
    }
  } catch {
    Fail "Linked node retrieval: $($_.Exception.Message)"
  }
}

Write-Host ""
if ($script:Failures.Count -gt 0) {
  Write-Host "DictionaryRoot Source Experience v1 verification found $($script:Failures.Count) failure(s)." -ForegroundColor Red
  exit 1
}

Write-Host "DictionaryRoot Source Experience v1 verification passed." -ForegroundColor Green
Write-Host "Open sources-v2.html and press Ctrl+F5 to inspect the live source library."
exit 0
