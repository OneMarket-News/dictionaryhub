param(
  [string]$RepoRoot = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$failures = New-Object System.Collections.Generic.List[string]
$passes = New-Object System.Collections.Generic.List[string]

function Pass {
  param([Parameter(Mandatory = $true)][string]$Message)
  $script:passes.Add($Message)
  Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Fail {
  param([Parameter(Mandatory = $true)][string]$Message)
  $script:failures.Add($Message)
  Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Check-File {
  param([Parameter(Mandatory = $true)][string]$RelativePath)
  $path = Join-Path $RepoRoot $RelativePath
  if (Test-Path -LiteralPath $path) {
    Pass -Message "$RelativePath exists"
  }
  else {
    Fail -Message "$RelativePath is missing"
  }
}

function Check-Page {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][string]$ExpectedTitle
  )

  $path = Join-Path $RepoRoot $RelativePath
  if (-not (Test-Path -LiteralPath $path)) {
    Fail -Message "$RelativePath is missing"
    return
  }

  $content = [System.IO.File]::ReadAllText($path)

  if ($content.Contains("<title>$ExpectedTitle</title>")) {
    Pass -Message "$RelativePath has the DictionaryRoot title"
  }
  else {
    Fail -Message "$RelativePath title was not updated"
  }

  if ($content.Contains("assets/css/dictionaryroot-brand.css")) {
    Pass -Message "$RelativePath loads shared brand CSS"
  }
  else {
    Fail -Message "$RelativePath is missing shared brand CSS"
  }

  if ($content.Contains("assets/js/dictionaryroot-api.js")) {
    Pass -Message "$RelativePath loads the customer API client"
  }
  else {
    Fail -Message "$RelativePath is missing the customer API client"
  }

  if ($content.Contains("assets/js/dictionaryroot-brand.js")) {
    Pass -Message "$RelativePath loads the customer experience layer"
  }
  else {
    Fail -Message "$RelativePath is missing the customer experience layer"
  }
}

if (-not (Test-Path -LiteralPath $RepoRoot)) {
  throw "Repository root not found: $RepoRoot"
}

Write-Host "DictionaryRoot Customer Foundation verification"
Write-Host ""

$requiredFiles = @(
  "config\customers\dictionaryroot.json",
  "config\dictionaryroot-brand.json",
  "assets\brand\dictionaryroot-mark.svg",
  "assets\css\dictionaryroot-brand.css",
  "assets\js\dictionaryroot-api.js",
  "assets\js\dictionaryroot-brand.js",
  "dictionaryroot-connection.html",
  "DICTIONARYROOT-CUSTOMER-001.md",
  "docs\customers\dictionaryroot\requirements.md",
  "docs\customers\dictionaryroot\api-contract.md",
  "docs\customers\dictionaryroot\acceptance-checklist.md",
  "docs\customers\dictionaryroot\integration-record.md"
)

foreach ($requiredFile in $requiredFiles) {
  Check-File -RelativePath $requiredFile
}

Check-Page -RelativePath "concept-v2.html" -ExpectedTitle "DictionaryRoot &mdash; Concept Explorer"
Check-Page -RelativePath "graph-v2.html" -ExpectedTitle "DictionaryRoot &mdash; Knowledge Graph"
Check-Page -RelativePath "sources-v2.html" -ExpectedTitle "DictionaryRoot &mdash; Sources"

Write-Host ""
Write-Host "Summary: $($passes.Count) passed, $($failures.Count) failed."

if ($failures.Count -gt 0) {
  exit 1
}

Write-Host "DictionaryRoot customer foundation is installed correctly." -ForegroundColor Green
exit 0
