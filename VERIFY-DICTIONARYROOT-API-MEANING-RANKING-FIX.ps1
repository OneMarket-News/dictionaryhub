param(
  [string]$RepoRoot = $PSScriptRoot
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

Write-Host "DictionaryRoot API meaning-ranking compatibility verification"
Write-Host "Repository: $RepoRoot"
Write-Host ""

$RequiredFiles = @(
  "assets\js\dictionaryroot-api.js",
  "assets\js\dictionaryroot-graph.js",
  "assets\js\dictionaryroot-concept.js",
  "assets\js\dictionaryroot-sources.js",
  "graph-v2.html",
  "concept-v2.html",
  "sources-v2.html",
  "docs\customers\dictionaryroot\api-meaning-ranking-compatibility-fix.md"
)

foreach ($RelativePath in $RequiredFiles) {
  $Path = Join-Path $RepoRoot $RelativePath
  if (Test-Path $Path) {
    Pass "Required file exists: $RelativePath"
  } else {
    Fail "Missing required file: $RelativePath"
  }
}

Write-Host ""
Write-Host "Static compatibility checks"

$ApiPath = Join-Path $RepoRoot "assets\js\dictionaryroot-api.js"
$ApiText = Get-Text "assets\js\dictionaryroot-api.js"
$GraphText = Get-Text "assets\js\dictionaryroot-graph.js"
$ConceptText = Get-Text "assets\js\dictionaryroot-concept.js"
$SourceText = Get-Text "assets\js\dictionaryroot-sources.js"

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCommand -and (Test-Path $ApiPath)) {
  & node --check $ApiPath
  if ($LASTEXITCODE -eq 0) {
    Pass "JavaScript syntax: assets\js\dictionaryroot-api.js"
  } else {
    Fail "JavaScript syntax: assets\js\dictionaryroot-api.js"
  }
} else {
  Fail "Node.js and dictionaryroot-api.js are required for syntax verification"
}

$MeaningFunctions = @(
  "preferredMeaningLabel",
  "meaningMatchRank",
  "exactMeaningResults",
  "rankMeaningResults"
)

foreach ($FunctionName in $MeaningFunctions) {
  if ($ApiText -match ("function\s+" + [regex]::Escape($FunctionName) + "\s*\(")) {
    Pass "Meaning helper is implemented: $FunctionName"
  } else {
    Fail "Meaning helper is implemented: $FunctionName"
  }

  if ($ApiText -match ("(?m)^\s*" + [regex]::Escape($FunctionName) + ",?\s*$")) {
    Pass "Meaning helper is exported: $FunctionName"
  } else {
    Fail "Meaning helper is exported: $FunctionName"
  }
}

if (
  $GraphText -match 'DictionaryRootApi\.rankMeaningResults' -and
  $GraphText -match 'DictionaryRootApi\.exactMeaningResults' -and
  $GraphText -match 'DictionaryRootApi\.preferredMeaningLabel' -and
  $GraphText -match 'DictionaryRootApi\.meaningMatchRank'
) {
  Pass "Knowledge Sphere meaning-helper calls are supported"
} else {
  Fail "Knowledge Sphere meaning-helper calls are supported"
}

if (
  $ConceptText -match 'DictionaryRootApi\.rankMeaningResults' -and
  $ConceptText -match 'DictionaryRootApi\.exactMeaningResults' -and
  $ConceptText -match 'DictionaryRootApi\.preferredMeaningLabel' -and
  $ConceptText -match 'DictionaryRootApi\.meaningMatchRank'
) {
  Pass "Concept Experience meaning-helper calls are supported"
} else {
  Fail "Concept Experience meaning-helper calls are supported"
}

if (
  $ApiText -match 'async\s+sourceExperience\s*\(' -and
  $ApiText -match 'async\s+listSourceLinkedRecords\s*\(' -and
  $ApiText -match 'sources\(params, options\)' -and
  $SourceText -match 'state\.client\.sourceExperience\('
) {
  Pass "Source Experience API composition remains intact"
} else {
  Fail "Source Experience API composition remains intact"
}

Write-Host ""
Write-Host "Runtime meaning-ranking checks"

if ($NodeCommand -and (Test-Path $ApiPath)) {
  $RuntimeScript = @'
const fs = require("fs");
const vm = require("vm");

const apiPath = process.env.DICTIONARYROOT_API_PATH;
const code = fs.readFileSync(apiPath, "utf8");
const context = {
  window: {},
  console,
  URLSearchParams,
  AbortController,
  performance,
  setTimeout,
  clearTimeout
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(code, context, { filename: apiPath });

const api = context.window.DictionaryRootApi;
const requiredFunctions = [
  "preferredMeaningLabel",
  "meaningMatchRank",
  "exactMeaningResults",
  "rankMeaningResults"
];
for (const name of requiredFunctions) {
  if (!api || typeof api[name] !== "function") {
    throw new Error(`Missing runtime helper: ${name}`);
  }
}

const records = [
  {
    id: "related",
    title: "knowledgeable",
    summary: "having or showing knowledge",
    metadata: { lemmas: ["knowledgeable"] }
  },
  {
    id: "alias",
    title: "cognition",
    summary: "the result of perceiving, learning, and reasoning",
    metadata: { lemmas: ["cognition", "knowledge"] }
  },
  {
    id: "canonical",
    title: "knowledge",
    summary: "cognition and understanding",
    metadata: { lemmas: ["knowledge"] }
  }
];

if (api.meaningMatchRank(records[2], "knowledge") !== 0) {
  throw new Error("Canonical exact-title rank is not zero.");
}
if (api.meaningMatchRank(records[1], "knowledge") !== 1) {
  throw new Error("Exact OEWN lemma/synonym rank is not one.");
}
if (api.preferredMeaningLabel(records[1], "knowledge") !== "knowledge") {
  throw new Error("Exact query lemma is not selected as the preferred display label.");
}

const exact = api.exactMeaningResults(records, "knowledge");
if (exact.length !== 2) {
  throw new Error(`Expected two exact meanings, received ${exact.length}.`);
}

const ranked = api.rankMeaningResults(records, "knowledge");
if (ranked[0].id !== "canonical" || ranked[1].id !== "alias" || ranked[2].id !== "related") {
  throw new Error(`Unexpected ranking order: ${ranked.map((item) => item.id).join(", ")}`);
}

const prototype = api.DictionaryRootApiClient && api.DictionaryRootApiClient.prototype;
for (const method of ["sources", "sourceExperience", "concept", "nodesByIds"]) {
  if (!prototype || typeof prototype[method] !== "function") {
    throw new Error(`Source/client method was lost: ${method}`);
  }
}

console.log("DictionaryRoot meaning-ranking runtime test passed.");
'@

  $TempTest = Join-Path ([System.IO.Path]::GetTempPath()) ("dictionaryroot-api-ranking-" + [guid]::NewGuid().ToString("N") + ".js")
  try {
    Set-Content -Path $TempTest -Value $RuntimeScript -Encoding UTF8
    $env:DICTIONARYROOT_API_PATH = $ApiPath
    & node $TempTest
    if ($LASTEXITCODE -eq 0) {
      Pass "Exact title, OEWN synonym, related-result ranking, and source-method preservation"
    } else {
      Fail "Exact title, OEWN synonym, related-result ranking, and source-method preservation"
    }
  } catch {
    Fail "Runtime meaning-ranking verification: $($_.Exception.Message)"
  } finally {
    Remove-Item Env:\DICTIONARYROOT_API_PATH -ErrorAction SilentlyContinue
    Remove-Item $TempTest -Force -ErrorAction SilentlyContinue
  }
} else {
  Fail "Runtime meaning-ranking checks could not run"
}

Write-Host ""
if ($script:Failures.Count -gt 0) {
  Write-Host "DictionaryRoot API meaning-ranking compatibility verification found $($script:Failures.Count) failure(s)." -ForegroundColor Red
  exit 1
}

Write-Host "DictionaryRoot API meaning-ranking compatibility verification passed." -ForegroundColor Green
Write-Host "Open graph-v2.html and concept-v2.html, then press Ctrl+F5."
exit 0
