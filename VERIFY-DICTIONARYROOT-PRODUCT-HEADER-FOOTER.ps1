param(
  [string]$Repository = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
$Passed = 0
$Failed = 0
$Warnings = 0

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

Write-Host "DictionaryRoot Product Header and Footer Refinement v1 verifier"
Write-Host "Repository: $Repository"
Write-Host ""

$CssPath = Join-Path $Repository "assets\css\dictionaryroot-navigation.css"
$JsPath = Join-Path $Repository "assets\js\dictionaryroot-navigation.js"
$Pages = @(
  "index.html",
  "concept-v2.html",
  "graph-v2.html",
  "sources-v2.html",
  "history-v2.html",
  "coverage-v2.html",
  "editorial-v2.html",
  "accounts-v2.html"
)

Test-Check "Shared navigation stylesheet exists" (Test-Path -LiteralPath $CssPath)
Test-Check "Shared navigation JavaScript exists" (Test-Path -LiteralPath $JsPath)

$MissingPages = @($Pages | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Repository $_)) })
Test-Check "All DictionaryRoot customer pages exist" ($MissingPages.Count -eq 0) ($(if ($MissingPages.Count) { "Missing: " + ($MissingPages -join ", ") } else { "$($Pages.Count) pages found." }))

if (Test-Path -LiteralPath $JsPath) {
  $Js = [System.IO.File]::ReadAllText($JsPath)
  Test-Check "Primary navigation is separated from management tools" ($Js -match 'PRIMARY_NAV_ITEMS' -and $Js -match 'MANAGE_NAV_ITEMS')
  Test-Check "Manage contains Coverage, Editorial, and Accounts" ($Js -match 'Coverage' -and $Js -match 'Editorial' -and $Js -match 'Accounts' -and $Js -match 'dictionaryroot-manage-menu')
  Test-Check "Identity control is rendered in a dedicated far-right area" ($Js -match 'dictionaryroot-unified-account-area' -and $Js -match 'dictionaryroot-account-menu')
  Test-Check "Signed-in identity includes role and sign-out controls" ($Js -match 'dictionaryroot-account-role' -and $Js -match 'data-dr-sign-out')
  Test-Check "Context breadcrumb is below the main header row" ($Js -match 'dictionaryroot-context-bar' -and $Js -match 'dictionaryroot-context-breadcrumb')
  Test-Check "Powered by SourceRoot is rendered in the page footer" ($Js -match 'dictionaryroot-platform-footer' -and $Js -match 'dictionaryroot-platform-credit')
  Test-Check "Footer reports live SourceRoot status without fallback data" ($Js -match 'refreshPlatformStatus' -and $Js -match 'SourceRoot connected' -and $Js -match 'SourceRoot offline')
  Test-Check "Old Powered by control is not inserted in the header" (-not ($Js -match '<span class="dictionaryroot-powered-by"'))
}

if (Test-Path -LiteralPath $CssPath) {
  $Css = [System.IO.File]::ReadAllText($CssPath)
  Test-Check "Header remains sticky" ($Css -match 'position:\s*sticky')
  Test-Check "Desktop header has brand, search, navigation, and account columns" ($Css -match 'grid-template-columns:\s*auto\s+minmax\(300px,\s*410px\)\s+minmax\(0,\s*1fr\)\s+auto')
  Test-Check "Account area is aligned to the far right" ($Css -match '\.dictionaryroot-unified-account-area\s*\{[\s\S]*?justify-self:\s*end')
  Test-Check "Manage and account dropdown panels are styled" ($Css -match '\.dictionaryroot-manage-panel' -and $Css -match '\.dictionaryroot-account-panel')
  Test-Check "Navigation moves to a second row before collision" ($Css -match '@media \(max-width:\s*1479px\) and \(min-width:\s*1101px\)')
  Test-Check "Mobile navigation collapses at 1100px" ($Css -match '@media \(max-width:\s*1100px\)')
  Test-Check "Context breadcrumb styling is present" ($Css -match '\.dictionaryroot-context-breadcrumb')
  Test-Check "Platform footer is right aligned and responsive" ($Css -match '\.dictionaryroot-platform-footer-inner' -and $Css -match 'justify-content:\s*space-between')
}

foreach ($Page in $Pages) {
  $Path = Join-Path $Repository $Page
  if (Test-Path -LiteralPath $Path) {
    $Html = [System.IO.File]::ReadAllText($Path)
    Test-Check "$Page loads the shared navigation assets" ($Html -match 'assets/css/dictionaryroot-navigation\.css' -and $Html -match 'assets/js/dictionaryroot-navigation\.js')
  }
}

if ((Test-Path -LiteralPath $JsPath) -and (Get-Command node -ErrorAction SilentlyContinue)) {
  $Output = & node --check $JsPath 2>&1
  Test-Check "JavaScript syntax: dictionaryroot-navigation.js" ($LASTEXITCODE -eq 0) ($(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" }))
} else {
  Write-Host "[WARN] Node.js is unavailable; JavaScript syntax was not checked."
  $Warnings++
}

Write-Host ""
Write-Host "Verification summary"
Write-Host "Passed:   $Passed"
Write-Host "Failed:   $Failed"
Write-Host "Warnings: $Warnings"
Write-Host ""
Write-Host "Manual browser checks still required:"
Write-Host "  1. Press Ctrl+F5 on Accounts, Editorial, Coverage, Sphere, and Concept."
Write-Host "  2. Confirm Sign in or the current identity stays at the far-right edge."
Write-Host "  3. Confirm Manage opens Coverage, Editorial, and Accounts."
Write-Host "  4. Confirm the context breadcrumb updates through search and Back/Forward."
Write-Host "  5. Confirm Powered by SourceRoot appears in the bottom-right footer."
Write-Host "  6. Test 1752, 1440, 1280, 1100, 900, 390, and 320 pixel widths."

if ($Failed -gt 0) { exit 1 }
