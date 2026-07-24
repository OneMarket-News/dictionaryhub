param(
  [string]$Repository = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
$Passed = 0
$Failed = 0

function Test-Check {
  param(
    [string]$Name,
    [bool]$Condition,
    [string]$Detail = ""
  )

  if ($Condition) {
    Write-Host "[PASS] $Name"
    if ($Detail) { Write-Host "       $Detail" }
    $script:Passed++
  } else {
    Write-Host "[FAIL] $Name"
    if ($Detail) { Write-Host "       $Detail" }
    $script:Failed++
  }
}

Write-Host "DictionaryRoot Navigation Overlap Fix v1 verifier"
Write-Host "Repository: $Repository"
Write-Host ""

$CssPath = Join-Path $Repository "assets\css\dictionaryroot-navigation.css"
$JsPath = Join-Path $Repository "assets\js\dictionaryroot-navigation.js"
$AccountsPath = Join-Path $Repository "accounts-v2.html"

Test-Check "Shared navigation stylesheet exists" (Test-Path -LiteralPath $CssPath)
Test-Check "Shared navigation JavaScript exists" (Test-Path -LiteralPath $JsPath)
Test-Check "Accounts page exists" (Test-Path -LiteralPath $AccountsPath)

if (Test-Path -LiteralPath $CssPath) {
  $Css = [System.IO.File]::ReadAllText($CssPath)

  Test-Check "Header uses a wider responsive desktop container" ($Css -match 'width:\s*min\(1720px,\s*calc\(100% - 2rem\)\)')
  Test-Check "Search width is reduced to preserve navigation space" ($Css -match '--dr-nav-search-width:\s*380px')
  Test-Check "Navigation column is allowed to shrink safely" ($Css -match 'grid-template-columns:\s*auto\s+minmax\(280px,\s*var\(--dr-nav-search-width\)\)\s+minmax\(0,\s*1fr\)')
  Test-Check "Navigation wrapper clips cross-column overflow" ($Css -match '\.dictionaryroot-unified-nav-wrap\s*\{[^}]*overflow:\s*hidden')
  Test-Check "Navigation links use bounded horizontal overflow" ($Css -match '\.dictionaryroot-unified-header \.dictionaryroot-product-nav\s*\{[^}]*overflow-x:\s*auto')
  Test-Check "Large desktop compaction breakpoint is present" ($Css -match '@media \(max-width:\s*1800px\) and \(min-width:\s*1321px\)')
  Test-Check "Compact desktop moves navigation to a separate row" ($Css -match '@media \(max-width:\s*1320px\) and \(min-width:\s*901px\)' -and $Css -match 'grid-column:\s*1 / -1;[\s\S]*?grid-row:\s*2')
  Test-Check "Nonessential context is hidden before collision" ($Css -match '\.dictionaryroot-unified-context,[\s\S]*?\.dictionaryroot-unified-header \.dictionaryroot-powered-by\s*\{\s*display:\s*none')
}

if (Test-Path -LiteralPath $AccountsPath) {
  $Accounts = [System.IO.File]::ReadAllText($AccountsPath)
  Test-Check "Accounts page loads the shared navigation stylesheet" ($Accounts -match 'assets/css/dictionaryroot-navigation\.css')
}

if ((Test-Path -LiteralPath $JsPath) -and (Get-Command node -ErrorAction SilentlyContinue)) {
  $Output = & node --check $JsPath 2>&1
  Test-Check "JavaScript syntax: dictionaryroot-navigation.js" ($LASTEXITCODE -eq 0) ($(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" }))
}

Write-Host ""
Write-Host "Verification summary"
Write-Host "Passed:   $Passed"
Write-Host "Failed:   $Failed"
Write-Host "Warnings: 0"
Write-Host ""
Write-Host "Manual browser checks still required:"
Write-Host "  1. Open accounts-v2.html and press Ctrl+F5."
Write-Host "  2. Confirm the Search button and Home/Concept links do not overlap."
Write-Host "  3. Resize through 1752, 1600, 1440, 1320, 1024, and mobile widths."
Write-Host "  4. Confirm all navigation links remain reachable and the mobile Menu still opens."

if ($Failed -gt 0) { exit 1 }
