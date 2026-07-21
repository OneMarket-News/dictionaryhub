param(
  [string]$Repository = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
)

$ErrorActionPreference = "Stop"
$Passed = 0
$Failed = 0
$Warnings = 0

function Test-Check([string]$Name, [bool]$Condition, [string]$Detail = "") {
  if ($Condition) { Write-Host "[PASS] $Name" -ForegroundColor Green; $script:Passed++ }
  else { Write-Host "[FAIL] $Name" -ForegroundColor Red; $script:Failed++ }
  if ($Detail) { Write-Host "       $Detail" }
}

function Read-Text([string]$RelativePath) {
  return [System.IO.File]::ReadAllText((Join-Path $Repository $RelativePath), [System.Text.Encoding]::UTF8)
}

Write-Host "DictionaryRoot Editorial and Review Workflow v1 verifier"
Write-Host "Repository: $Repository"
Write-Host ""

$Required = @(
  "editorial-v2.html",
  "assets\css\dictionaryroot-editorial.css",
  "assets\js\dictionaryroot-editorial.js",
  "backend\db\migrations\004_create_dictionaryroot_editorial_reviews.sql",
  "backend\src\routes\editorial.ts",
  "backend\src\services\editorial-store.ts",
  "docs\customers\dictionaryroot\editorial-review-workflow-stage.md",
  "VERIFY-DICTIONARYROOT-EDITORIAL-REVIEW.ps1"
)
$Missing = @($Required | Where-Object { -not (Test-Path (Join-Path $Repository $_)) })
Test-Check "Required editorial workflow files exist" ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: " + ($Missing -join ", ") } else { "$($Required.Count) files found." })

$Page = Read-Text "editorial-v2.html"
Test-Check "Editorial page contains queue, review form, audit history, and promotion controls" (($Page -match "Meaning-level queue") -and ($Page -match "dictionaryrootEditorialReviewForm") -and ($Page -match "Review history") -and ($Page -match "Promote approved meaning"))
Test-Check "Editorial scripts load in API, brand, navigation, experience order" ($Page -match "dictionaryroot-api.js[\s\S]*dictionaryroot-brand.js[\s\S]*dictionaryroot-navigation.js[\s\S]*dictionaryroot-editorial.js")

$Migration = Read-Text "backend\db\migrations\004_create_dictionaryroot_editorial_reviews.sql"
Test-Check "Editorial review and event schema is present" (($Migration -match "dictionaryroot_editorial_reviews") -and ($Migration -match "dictionaryroot_editorial_review_events") -and ($Migration -match "promotion_recommendation"))

$Route = Read-Text "backend\src\routes\editorial.ts"
$Store = Read-Text "backend\src\services\editorial-store.ts"
Test-Check "SourceRoot exposes summary, queue, review, and promotion endpoints" (($Route -match '/summary') -and ($Route -match '/queue') -and ($Route -match '/reviews/:nodeId') -and ($Route -match '/promote'))
Test-Check "Editorial service enforces approved promotion and creates graph history" (($Store -match 'review_status !== "approved"') -and ($Store -match "INSERT INTO nodes") -and ($Store -match "editorial-promotion") -and ($Store -match "dictionaryroot_editorial_review_events"))

$Navigation = Read-Text "assets\js\dictionaryroot-navigation.js"
$Brand = Read-Text "config\dictionaryroot-brand.json"
Test-Check "Shared navigation and brand manifest expose Editorial" (($Navigation -match "editorial-v2.html") -and ($Navigation -match 'key: "editorial"') -and ($Brand -match "editorial-v2.html"))

$Frontend = Read-Text "assets\js\dictionaryroot-editorial.js"
Test-Check "Editorial experience uses live API, URL state, review save, and promotion" (($Frontend -match "editorialSummary") -and ($Frontend -match "editorialQueue") -and ($Frontend -match "saveEditorialReview") -and ($Frontend -match "promoteEditorialMeaning") -and ($Frontend -match "popstate"))
Test-Check "Editorial workflow has no fallback review data" (-not ($Frontend -match "fallback.*review|sample.*review|mock.*review"))

foreach ($File in @("assets\js\dictionaryroot-api.js", "assets\js\dictionaryroot-navigation.js", "assets\js\dictionaryroot-editorial.js")) {
  $Output = & node --check (Join-Path $Repository $File) 2>&1
  Test-Check "JavaScript syntax: $File" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
}

Push-Location (Join-Path $Repository "backend")
try {
  $Typecheck = & npm.cmd run typecheck 2>&1
  Test-Check "SourceRoot TypeScript typecheck" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Typecheck -join " " } else { "" })
} finally { Pop-Location }

try {
  $Health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 10
  Test-Check "SourceRoot health endpoint responds" ($null -ne $Health) "http://localhost:3000/health"
} catch { Test-Check "SourceRoot health endpoint responds" $false $_.Exception.Message }

$Base = "http://localhost:3000/api/v1/dictionaryroot/editorial"
try {
  $Summary = Invoke-RestMethod -Uri "$Base/summary?bundleId=dictionaryroot-oewn-2025-pilot-500" -TimeoutSec 30
  Test-Check "Live editorial summary is available" (($Summary.totalMeanings -gt 100000) -and ($Summary.lexicalOnlyMeanings -gt 0)) "total=$($Summary.totalMeanings); lexicalOnly=$($Summary.lexicalOnlyMeanings); unreviewed=$($Summary.unreviewed)"
} catch { Test-Check "Live editorial summary is available" $false $_.Exception.Message }

try {
  $Queue = Invoke-RestMethod -Uri "$Base/queue?bundleId=dictionaryroot-oewn-2025-pilot-500&category=lexical-only&status=all&page=1&limit=5" -TimeoutSec 30
  $First = @($Queue.items)[0]
  Test-Check "Live lexical-only review queue returns meaning records" (($Queue.total -gt 0) -and $First.nodeId -and (-not $First.graphCovered)) "total=$($Queue.total); first=$($First.nodeId)"
  if ($First.nodeId) {
    $Detail = Invoke-RestMethod -Uri "$Base/reviews/$($First.nodeId)" -TimeoutSec 15
    Test-Check "Meaning-level review detail resolves" ($Detail.item.nodeId -eq $First.nodeId) "status=$($Detail.item.reviewStatus); events=$(@($Detail.events).Count)"
    $Body = @{ status="in_review"; reviewerName="Verifier"; notes="Dry run"; annotation=""; promotionRecommendation=$false } | ConvertTo-Json
    $DryRun = Invoke-RestMethod -Method Put -ContentType "application/json" -Body $Body -Uri "$Base/reviews/$($First.nodeId)?dryRun=true" -TimeoutSec 15
    Test-Check "Review write route validates without mutating data" ($DryRun.valid -eq $true -and $DryRun.dryRun -eq $true)
    $PromotionBody = @{ reviewerName="Verifier"; note="Dry run" } | ConvertTo-Json
    $PromotionDryRun = Invoke-RestMethod -Method Post -ContentType "application/json" -Body $PromotionBody -Uri "$Base/reviews/$($First.nodeId)/promote?dryRun=true" -TimeoutSec 15
    Test-Check "Promotion route validates without mutating data" ($PromotionDryRun.valid -eq $true -and $PromotionDryRun.dryRun -eq $true)
  }
} catch { Test-Check "Live lexical-only review queue returns meaning records" $false $_.Exception.Message }

Write-Host ""
Write-Host "Verification summary"
Write-Host "Passed:   $Passed"
Write-Host "Failed:   $Failed"
Write-Host "Warnings: $Warnings"
Write-Host ""
Write-Host "Manual browser checks still required:"
Write-Host "  1. Open editorial-v2.html and review value, bank, and light meanings."
Write-Host "  2. Save each status, notes, annotations, and promotion recommendations."
Write-Host "  3. Confirm audit events appear and Back/Forward restores queue and selection."
Write-Host "  4. Approve one lexical-only test meaning, promote it, and confirm it becomes Curated core in Sphere and Coverage."
Write-Host "  5. Confirm layouts at 390 x 844 and 320 x 568."
Write-Host "  6. Stop SourceRoot and confirm no fallback review records appear."
if ($Failed -gt 0) { exit 1 }
