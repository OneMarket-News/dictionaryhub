[CmdletBinding()]
param(
  [string]$Repository = $PSScriptRoot,
  [switch]$SkipApi
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0

function Test-Check {
  param([string]$Name, [bool]$Condition, [string]$Detail = "")
  if ($Condition) { Write-Host "[PASS] $Name" -ForegroundColor Green; $script:Passed++ }
  else { Write-Host "[FAIL] $Name" -ForegroundColor Red; $script:Failed++ }
  if ($Detail) { Write-Host "       $Detail" }
}

function Read-Text([string]$RelativePath) {
  return [System.IO.File]::ReadAllText((Join-Path $Repository $RelativePath), [System.Text.Encoding]::UTF8)
}

function Invoke-Status {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [string]$Body = ""
  )
  try {
    $Parameters = @{ Method = $Method; Uri = $Uri; Headers = $Headers; UseBasicParsing = $true; TimeoutSec = 20 }
    if ($Body) { $Parameters.ContentType = "application/json"; $Parameters.Body = $Body }
    $Response = Invoke-WebRequest @Parameters
    return [int]$Response.StatusCode
  }
  catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      return [int]$_.Exception.Response.StatusCode.value__
    }
    throw
  }
}

if (-not (Test-Path -LiteralPath $Repository -PathType Container)) {
  Write-Host "Repository not found: $Repository" -ForegroundColor Red
  exit 2
}

Write-Host "DictionaryRoot Editorial and Review Workflow v1 verifier"
Write-Host "Repository: $Repository"
Write-Host ""

$Required = @(
  "editorial-v2.html",
  "accounts-v2.html",
  "assets\css\dictionaryroot-editorial.css",
  "assets\js\dictionaryroot-editorial.js",
  "backend\db\migrations\004_create_dictionaryroot_editorial_reviews.sql",
  "backend\db\migrations\005_create_dictionaryroot_identity_access.sql",
  "backend\src\routes\editorial.ts",
  "backend\src\services\editorial-store.ts",
  "backend\src\services\identity-store.ts",
  "docs\customers\dictionaryroot\editorial-review-workflow-stage.md",
  "VERIFY-DICTIONARYROOT-EDITORIAL-REVIEW.ps1"
)
$Missing = @($Required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Repository $_) -PathType Leaf) })
Test-Check "Required editorial workflow files exist" ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: " + ($Missing -join ", ") } else { "$($Required.Count) files found." })
if ($Missing.Count -gt 0) { exit 1 }

$Page = Read-Text "editorial-v2.html"
Test-Check "Editorial page contains queue, review form, audit history, promotion, and authenticated actor controls" (($Page -match "Meaning-level queue") -and ($Page -match "dictionaryrootEditorialReviewForm") -and ($Page -match "Review history") -and ($Page -match "Promote approved meaning") -and ($Page -match "Authenticated actor") -and ($Page -match "accounts-v2.html"))
Test-Check "Editorial scripts load in API, brand, navigation, experience order" ($Page -match "dictionaryroot-api.js[\s\S]*dictionaryroot-brand.js[\s\S]*dictionaryroot-navigation.js[\s\S]*dictionaryroot-editorial.js")

$Migration = Read-Text "backend\db\migrations\005_create_dictionaryroot_identity_access.sql"
Test-Check "Editorial provenance schema links reviews and events to actors" (($Migration -match "actor_snapshot") -and ($Migration -match "dictionaryroot_editorial_review_actor") -and ($Migration -match "delegated_by_actor_id"))

$Route = Read-Text "backend\src\routes\editorial.ts"
$Store = Read-Text "backend\src\services\editorial-store.ts"
Test-Check "SourceRoot exposes summary, queue, review, and promotion endpoints" (($Route -match '/summary') -and ($Route -match '/queue') -and ($Route -match '/reviews/:nodeId') -and ($Route -match '/promote'))
Test-Check "Editorial writes require authenticated permissions and verified-human finalization" (($Route -match "requireDictionaryRootAuth") -and ($Route -match "editorial.approve") -and ($Route -match "graph.promote") -and ($Route -match "isVerifiedHuman"))
Test-Check "Editorial service stores actor and delegation provenance" (($Store -match "actorSnapshot") -and ($Store -match "actor_id") -and ($Store -match "delegated_by_actor_id") -and ($Store -match "agent-recommendation") -and ($Store -match "editorial-promotion"))

$Frontend = Read-Text "assets\js\dictionaryroot-editorial.js"
Test-Check "Editorial experience uses session identity and permission-aware controls" (($Frontend -match "authMe") -and ($Frontend -match "editorial.approve") -and ($Frontend -match "graph.promote") -and ($Frontend -match "autonomous agent") -and ($Frontend -match "saveEditorialReview") -and ($Frontend -match "promoteEditorialMeaning"))
Test-Check "Editorial workflow has no fallback review or identity data" (-not ($Frontend -match "fallback.*review|sample.*review|mock.*review|fallback.*identity"))

foreach ($File in @("assets\js\dictionaryroot-api.js", "assets\js\dictionaryroot-navigation.js", "assets\js\dictionaryroot-editorial.js", "assets\js\dictionaryroot-accounts.js")) {
  $Output = & node --check (Join-Path $Repository $File) 2>&1
  Test-Check "JavaScript syntax: $File" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
}

Push-Location (Join-Path $Repository "backend")
try {
  $Typecheck = & npm.cmd run typecheck 2>&1
  Test-Check "SourceRoot TypeScript typecheck" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Typecheck -join " " } else { "" })
} finally { Pop-Location }

if (-not $SkipApi) {
  try {
    $Health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 10
    Test-Check "SourceRoot health endpoint responds" ($null -ne $Health) "http://localhost:3000/health"
  } catch { Test-Check "SourceRoot health endpoint responds" $false $_.Exception.Message }

  $AuthBase = "http://localhost:3000/api/v1/dictionaryroot/auth"
  $EditorialBase = "http://localhost:3000/api/v1/dictionaryroot/editorial"
  try {
    $DevelopmentActors = Invoke-RestMethod -Uri "${AuthBase}/development-actors" -TimeoutSec 15
    $Admin = @($DevelopmentActors.actors | Where-Object { $_.actorId -eq "dictionaryroot-local-human-admin" })[0]
    $Agent = @($DevelopmentActors.actors | Where-Object { $_.actorId -eq "dictionaryroot-local-review-agent" })[0]
    Test-Check "Development identities separate human and autonomous actors" ($Admin.actorType -eq "human" -and $Agent.actorType -eq "autonomous_agent") "human=$($Admin.actorId); agent=$($Agent.actorId)"

    $AdminSessionBody = @{ actorId = $Admin.actorId } | ConvertTo-Json -Compress
    $AdminSession = Invoke-RestMethod -Method Post -ContentType "application/json" -Body $AdminSessionBody -Uri "${AuthBase}/development-session" -TimeoutSec 15
    $AdminHeaders = @{ Authorization = "Bearer $($AdminSession.token)" }
    $AdminMe = Invoke-RestMethod -Headers $AdminHeaders -Uri "${AuthBase}/me" -TimeoutSec 15
    Test-Check "Verified-human administrator session resolves" (($AdminMe.actor.actorType -eq "human") -and ($AdminMe.actor.verificationLevel -eq "verified_human") -and (@($AdminMe.permissions) -contains "editorial.approve") -and (@($AdminMe.permissions) -contains "graph.promote")) "actor=$($AdminMe.actor.displayName)"

    $Summary = Invoke-RestMethod -Uri "${EditorialBase}/summary?bundleId=dictionaryroot-oewn-2025-pilot-500" -TimeoutSec 30
    Test-Check "Live editorial summary is available" (($Summary.totalMeanings -gt 100000) -and ($Summary.lexicalOnlyMeanings -gt 0)) "total=$($Summary.totalMeanings); lexicalOnly=$($Summary.lexicalOnlyMeanings); unreviewed=$($Summary.unreviewed)"

    $Queue = Invoke-RestMethod -Uri "${EditorialBase}/queue?bundleId=dictionaryroot-oewn-2025-pilot-500&category=lexical-only&status=all&page=1&limit=5" -TimeoutSec 30
    $First = @($Queue.items)[0]
    Test-Check "Live lexical-only review queue returns meaning records" (($Queue.total -gt 0) -and $First.nodeId -and (-not $First.graphCovered)) "total=$($Queue.total); first=$($First.nodeId)"

    if ($First.nodeId) {
      $Detail = Invoke-RestMethod -Uri "${EditorialBase}/reviews/$($First.nodeId)" -TimeoutSec 15
      Test-Check "Meaning-level review detail resolves with provenance fields" (($Detail.item.nodeId -eq $First.nodeId) -and ($Detail.item.PSObject.Properties.Name -contains "actorType")) "status=$($Detail.item.reviewStatus); events=$(@($Detail.events).Count)"

      $AdminReviewBody = @{ status = "approved"; notes = "Verifier dry run"; annotation = ""; promotionRecommendation = $true } | ConvertTo-Json -Compress
      $AdminDryRun = Invoke-RestMethod -Method Put -Headers $AdminHeaders -ContentType "application/json" -Body $AdminReviewBody -Uri "${EditorialBase}/reviews/$($First.nodeId)?dryRun=true" -TimeoutSec 15
      Test-Check "Verified-human administrator may validate final approval" ($AdminDryRun.valid -eq $true -and $AdminDryRun.actor.actorType -eq "human")

      $PromotionBody = @{ note = "Verifier dry run" } | ConvertTo-Json -Compress
      $PromotionDryRun = Invoke-RestMethod -Method Post -Headers $AdminHeaders -ContentType "application/json" -Body $PromotionBody -Uri "${EditorialBase}/reviews/$($First.nodeId)/promote?dryRun=true" -TimeoutSec 15
      Test-Check "Verified-human administrator may validate graph promotion" ($PromotionDryRun.valid -eq $true -and $PromotionDryRun.actor.verificationLevel -eq "verified_human")

      $AgentSessionBody = @{ actorId = $Agent.actorId } | ConvertTo-Json -Compress
      $AgentSession = Invoke-RestMethod -Method Post -ContentType "application/json" -Body $AgentSessionBody -Uri "${AuthBase}/development-session" -TimeoutSec 15
      $AgentHeaders = @{ Authorization = "Bearer $($AgentSession.token)" }
      $AgentMe = Invoke-RestMethod -Headers $AgentHeaders -Uri "${AuthBase}/me" -TimeoutSec 15
      Test-Check "Autonomous-agent session preserves delegation" (($AgentMe.actor.actorType -eq "autonomous_agent") -and $AgentMe.delegation.humanApprovalRequired -eq $true -and $AgentMe.delegation.principalActorId) "delegatedBy=$($AgentMe.delegation.principalDisplayName)"

      $AgentReviewBody = @{ status = "in_review"; notes = "Agent recommendation dry run"; annotation = ""; promotionRecommendation = $true } | ConvertTo-Json -Compress
      $AgentDryRun = Invoke-RestMethod -Method Put -Headers $AgentHeaders -ContentType "application/json" -Body $AgentReviewBody -Uri "${EditorialBase}/reviews/$($First.nodeId)?dryRun=true" -TimeoutSec 15
      Test-Check "Autonomous agent may validate a non-final recommendation" ($AgentDryRun.valid -eq $true -and $AgentDryRun.actor.actorType -eq "autonomous_agent")

      $AgentApprovalBody = @{ status = "approved"; notes = "Must be denied"; annotation = ""; promotionRecommendation = $true } | ConvertTo-Json -Compress
      $ApprovalStatus = Invoke-Status -Method "Put" -Uri "${EditorialBase}/reviews/$($First.nodeId)?dryRun=true" -Headers $AgentHeaders -Body $AgentApprovalBody
      Test-Check "Autonomous agent cannot finalize approval" ($ApprovalStatus -eq 403) "status=$ApprovalStatus"

      $PromotionStatus = Invoke-Status -Method "Post" -Uri "${EditorialBase}/reviews/$($First.nodeId)/promote?dryRun=true" -Headers $AgentHeaders -Body $PromotionBody
      Test-Check "Autonomous agent cannot promote into curated graph" ($PromotionStatus -eq 403) "status=$PromotionStatus"

      Invoke-RestMethod -Method Post -Headers $AgentHeaders -Uri "${AuthBase}/logout" -TimeoutSec 15 | Out-Null
    }
    Invoke-RestMethod -Method Post -Headers $AdminHeaders -Uri "${AuthBase}/logout" -TimeoutSec 15 | Out-Null
  }
  catch {
    Test-Check "Live authenticated editorial policy checks complete" $false $_.Exception.Message
  }
}

Write-Host ""
Write-Host "Verification summary"
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host ""
Write-Host "Manual browser checks still required:"
Write-Host "  1. Sign in as Local Human Reviewer and confirm non-final review controls work but approval is unavailable."
Write-Host "  2. Sign in as DictionaryRoot Review Agent and confirm recommendation provenance and human-only finalization messaging."
Write-Host "  3. Sign in as Local Human Administrator, approve a test meaning, and promote it into the curated graph."
Write-Host "  4. Confirm audit events show actor type, verification, and delegation."
Write-Host "  5. Confirm layouts at 390 x 844 and 320 x 568."
Write-Host "  6. Stop SourceRoot and confirm no fallback identities or review records appear."
if ($script:Failed -gt 0) { exit 1 }
