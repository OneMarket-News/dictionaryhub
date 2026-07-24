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
  param([string]$Method, [string]$Uri, [hashtable]$Headers, [string]$Body = "")
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

Write-Host "DictionaryRoot User Accounts, Roles, Permissions, and Identity Provenance v1 verifier"
Write-Host "Repository: $Repository"
Write-Host ""

$Required = @(
  "accounts-v2.html",
  "assets\css\dictionaryroot-accounts.css",
  "assets\js\dictionaryroot-accounts.js",
  "backend\db\migrations\005_create_dictionaryroot_identity_access.sql",
  "backend\src\middleware\auth-context.ts",
  "backend\src\routes\auth.ts",
  "backend\src\services\identity-store.ts",
  "docs\customers\dictionaryroot\accounts-roles-permissions-stage.md",
  "VERIFY-DICTIONARYROOT-ACCOUNTS-ROLES-PERMISSIONS.ps1"
)
$Missing = @($Required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Repository $_) -PathType Leaf) })
Test-Check "Required identity and access files exist" ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: " + ($Missing -join ", ") } else { "$($Required.Count) files found." })
if ($Missing.Count -gt 0) { exit 1 }

$Page = Read-Text "accounts-v2.html"
Test-Check "Accounts page contains session, identity chooser, providers, roles, actors, and delegations" (($Page -match "Active session") -and ($Page -match "Development identity chooser") -and ($Page -match "Provider readiness") -and ($Page -match "Roles and permission boundaries") -and ($Page -match "Delegations"))
Test-Check "Accounts scripts load in API, brand, navigation, experience order" ($Page -match "dictionaryroot-api.js[\s\S]*dictionaryroot-brand.js[\s\S]*dictionaryroot-navigation.js[\s\S]*dictionaryroot-accounts.js")

$Migration = Read-Text "backend\db\migrations\005_create_dictionaryroot_identity_access.sql"
Test-Check "Identity schema contains providers, actors, roles, permissions, sessions, claims, and delegations" (($Migration -match "dictionaryroot_identity_providers") -and ($Migration -match "dictionaryroot_actors") -and ($Migration -match "dictionaryroot_roles") -and ($Migration -match "dictionaryroot_permissions") -and ($Migration -match "dictionaryroot_sessions") -and ($Migration -match "dictionaryroot_verification_claims") -and ($Migration -match "dictionaryroot_delegations"))
Test-Check "Migration seeds separate human and autonomous development identities" (($Migration -match "dictionaryroot-local-human-admin") -and ($Migration -match "dictionaryroot-local-human-reviewer") -and ($Migration -match "dictionaryroot-local-review-agent") -and ($Migration -match "autonomous_agent"))
Test-Check "Sensitive policies require verified-human approval and promotion" (($Migration -match "editorial.approve") -and ($Migration -match "graph.promote") -and ($Migration -match "verified_human") -and ($Migration -match "human_approval_required"))

$AuthRoute = Read-Text "backend\src\routes\auth.ts"
$AuthStore = Read-Text "backend\src\services\identity-store.ts"
$AuthMiddleware = Read-Text "backend\src\middleware\auth-context.ts"
Test-Check "SourceRoot exposes provider, development session, current actor, logout, actor, role, and delegation routes" (($AuthRoute -match '/providers') -and ($AuthRoute -match '/development-session') -and ($AuthRoute -match '/me') -and ($AuthRoute -match '/logout') -and ($AuthRoute -match '/actors') -and ($AuthRoute -match '/roles') -and ($AuthRoute -match '/delegations'))
Test-Check "Session tokens are random, hashed, expiring, and revocable" (($AuthStore -match "randomBytes") -and ($AuthStore -match "sha256") -and ($AuthStore -match "expires_at") -and ($AuthStore -match "revoked_at"))
Test-Check "Development sign-in is disabled in production mode" (($AuthStore -match 'process.env.NODE_ENV !== "production"') -and ($AuthStore -match "developmentModeEnabled"))
Test-Check "Permission middleware returns authentication and authorization errors" (($AuthMiddleware -match "AUTHENTICATION_REQUIRED") -and ($AuthMiddleware -match "PERMISSION_DENIED") -and ($AuthMiddleware -match "VERIFIED_HUMAN_REQUIRED"))

$Api = Read-Text "assets\js\dictionaryroot-api.js"
$Navigation = Read-Text "assets\js\dictionaryroot-navigation.js"
$Editorial = Read-Text "assets\js\dictionaryroot-editorial.js"
$Accounts = Read-Text "assets\js\dictionaryroot-accounts.js"
Test-Check "API client stores bearer sessions and exposes identity routes" (($Api -match "AUTH_STORAGE_KEY") -and ($Api -match "Authorization") -and ($Api -match "createDevelopmentSession") -and ($Api -match "identityRoles") -and ($Api -match "identityDelegations"))
Test-Check "Shared navigation exposes Accounts and active identity state" (($Navigation -match 'key: "accounts"') -and ($Navigation -match "accounts-v2.html") -and ($Navigation -match "dictionaryroot-account-chip") -and ($Navigation -match "dictionaryroot:authchange"))
Test-Check "Editorial UI derives reviewer identity from the session" (($Editorial -match "authMe") -and ($Editorial -match "Acting as") -and ($Editorial -match "verifiedHuman") -and (-not ($Editorial -match "reviewerName:clean")))
Test-Check "Accounts UI distinguishes humans, autonomous agents, verification, and delegation" (($Accounts -match "autonomous_agent") -and ($Accounts -match "verificationLevel") -and ($Accounts -match "humanApprovalRequired") -and ($Accounts -match "principalDisplayName"))
Test-Check "Identity UI has no fallback or mock public identities" (-not ($Accounts -match "fallback.*actor|mock.*actor|sample.*actor|fake.*human"))

foreach ($File in @("assets\js\dictionaryroot-api.js", "assets\js\dictionaryroot-brand.js", "assets\js\dictionaryroot-navigation.js", "assets\js\dictionaryroot-editorial.js", "assets\js\dictionaryroot-accounts.js")) {
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
    $Providers = Invoke-RestMethod -Uri "${AuthBase}/providers" -TimeoutSec 15
    Test-Check "Provider registry exposes a versioned replaceable interface" (($Providers.providerInterfaceVersion -eq "1.0") -and (@($Providers.providers).Count -ge 5) -and $Providers.sensitivePolicies.autonomousAgentsMayNotFinalize) "providers=$(@($Providers.providers).Count); mode=$($Providers.authMode)"

    $DevelopmentActors = Invoke-RestMethod -Uri "${AuthBase}/development-actors" -TimeoutSec 15
    $Admin = @($DevelopmentActors.actors | Where-Object { $_.actorId -eq "dictionaryroot-local-human-admin" })[0]
    $Reviewer = @($DevelopmentActors.actors | Where-Object { $_.actorId -eq "dictionaryroot-local-human-reviewer" })[0]
    $Agent = @($DevelopmentActors.actors | Where-Object { $_.actorId -eq "dictionaryroot-local-review-agent" })[0]
    Test-Check "Development registry returns administrator, reviewer, and agent fixtures" ($Admin.actorId -and $Reviewer.actorId -and $Agent.actorId) "actors=$(@($DevelopmentActors.actors).Count)"
    Test-Check "Actor classes remain explicit" (($Admin.actorType -eq "human") -and ($Reviewer.actorType -eq "human") -and ($Agent.actorType -eq "autonomous_agent")) "admin=$($Admin.actorType); agent=$($Agent.actorType)"

    $AdminSession = Invoke-RestMethod -Method Post -ContentType "application/json" -Body (@{ actorId = $Admin.actorId } | ConvertTo-Json -Compress) -Uri "${AuthBase}/development-session" -TimeoutSec 15
    $AdminHeaders = @{ Authorization = "Bearer $($AdminSession.token)" }
    $AdminMe = Invoke-RestMethod -Headers $AdminHeaders -Uri "${AuthBase}/me" -TimeoutSec 15
    Test-Check "Administrator session includes verified-human identity and sensitive permissions" (($AdminMe.actor.verificationLevel -eq "verified_human") -and (@($AdminMe.roles) -contains "administrator") -and (@($AdminMe.permissions) -contains "identity.read") -and (@($AdminMe.permissions) -contains "graph.promote")) "actor=$($AdminMe.actor.displayName)"

    $Roles = Invoke-RestMethod -Headers $AdminHeaders -Uri "${AuthBase}/roles" -TimeoutSec 15
    $Actors = Invoke-RestMethod -Headers $AdminHeaders -Uri "${AuthBase}/actors" -TimeoutSec 15
    $Delegations = Invoke-RestMethod -Headers $AdminHeaders -Uri "${AuthBase}/delegations" -TimeoutSec 15
    Test-Check "Administrator can inspect role matrix" (@($Roles.roles).Count -eq 5) "roles=$(@($Roles.roles).Count)"
    Test-Check "Administrator can inspect actor registry" (@($Actors.actors).Count -ge 3) "actors=$(@($Actors.actors).Count)"
    Test-Check "Administrator can inspect agent delegation" (@($Delegations.delegations | Where-Object { $_.delegateActorId -eq $Agent.actorId }).Count -ge 1) "delegations=$(@($Delegations.delegations).Count)"

    $ReviewerSession = Invoke-RestMethod -Method Post -ContentType "application/json" -Body (@{ actorId = $Reviewer.actorId } | ConvertTo-Json -Compress) -Uri "${AuthBase}/development-session" -TimeoutSec 15
    $ReviewerHeaders = @{ Authorization = "Bearer $($ReviewerSession.token)" }
    $ReviewerMe = Invoke-RestMethod -Headers $ReviewerHeaders -Uri "${AuthBase}/me" -TimeoutSec 15
    Test-Check "Reviewer receives review permission without final approval" ((@($ReviewerMe.permissions) -contains "editorial.review") -and (-not (@($ReviewerMe.permissions) -contains "editorial.approve"))) "permissions=$(@($ReviewerMe.permissions) -join ',')"
    $ReviewerIdentityStatus = Invoke-Status -Method "Get" -Uri "${AuthBase}/actors" -Headers $ReviewerHeaders
    Test-Check "Reviewer cannot inspect protected identity registry" ($ReviewerIdentityStatus -eq 403) "status=$ReviewerIdentityStatus"

    $AgentSession = Invoke-RestMethod -Method Post -ContentType "application/json" -Body (@{ actorId = $Agent.actorId } | ConvertTo-Json -Compress) -Uri "${AuthBase}/development-session" -TimeoutSec 15
    $AgentHeaders = @{ Authorization = "Bearer $($AgentSession.token)" }
    $AgentMe = Invoke-RestMethod -Headers $AgentHeaders -Uri "${AuthBase}/me" -TimeoutSec 15
    Test-Check "Agent session contains registered-service verification and human delegation" (($AgentMe.actor.verificationLevel -eq "registered_service") -and $AgentMe.delegation.humanApprovalRequired -eq $true -and $AgentMe.delegation.principalActorId) "principal=$($AgentMe.delegation.principalDisplayName)"

    $Queue = Invoke-RestMethod -Uri "${EditorialBase}/queue?bundleId=dictionaryroot-oewn-2025-pilot-500&category=lexical-only&status=all&page=1&limit=1" -TimeoutSec 30
    $NodeId = @($Queue.items)[0].nodeId
    if ($NodeId) {
      $RecommendationBody = @{ status = "in_review"; notes = "Agent dry run"; annotation = ""; promotionRecommendation = $true } | ConvertTo-Json -Compress
      $Recommendation = Invoke-RestMethod -Method Put -Headers $AgentHeaders -ContentType "application/json" -Body $RecommendationBody -Uri "${EditorialBase}/reviews/${NodeId}?dryRun=true" -TimeoutSec 15
      Test-Check "Agent may submit a non-final recommendation" ($Recommendation.valid -eq $true -and $Recommendation.actor.actorType -eq "autonomous_agent")

      $ApprovalBody = @{ status = "approved"; notes = "Denied dry run"; annotation = ""; promotionRecommendation = $true } | ConvertTo-Json -Compress
      $ApprovalStatus = Invoke-Status -Method "Put" -Uri "${EditorialBase}/reviews/${NodeId}?dryRun=true" -Headers $AgentHeaders -Body $ApprovalBody
      Test-Check "Agent final approval is denied" ($ApprovalStatus -eq 403) "status=$ApprovalStatus"

      $PromotionStatus = Invoke-Status -Method "Post" -Uri "${EditorialBase}/reviews/${NodeId}/promote?dryRun=true" -Headers $AgentHeaders -Body (@{ note = "Denied dry run" } | ConvertTo-Json -Compress)
      Test-Check "Agent graph promotion is denied" ($PromotionStatus -eq 403) "status=$PromotionStatus"
    }

    Invoke-RestMethod -Method Post -Headers $AgentHeaders -Uri "${AuthBase}/logout" -TimeoutSec 15 | Out-Null
    Invoke-RestMethod -Method Post -Headers $ReviewerHeaders -Uri "${AuthBase}/logout" -TimeoutSec 15 | Out-Null
    Invoke-RestMethod -Method Post -Headers $AdminHeaders -Uri "${AuthBase}/logout" -TimeoutSec 15 | Out-Null
  }
  catch {
    Test-Check "Live identity and authorization checks complete" $false $_.Exception.Message
  }
}

Write-Host ""
Write-Host "Verification summary"
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host ""
Write-Host "Manual browser checks still required:"
Write-Host "  1. Open accounts-v2.html and switch among administrator, reviewer, and agent identities."
Write-Host "  2. Confirm the navigation account chip updates after sign-in and sign-out."
Write-Host "  3. Confirm reviewer and agent sessions cannot approve or promote meanings."
Write-Host "  4. Confirm administrator approval and promotion events show verified-human provenance."
Write-Host "  5. Confirm layouts at 390 x 844 and 320 x 568."
Write-Host "  6. Stop SourceRoot and confirm no fallback identities, roles, or delegations appear."
if ($script:Failed -gt 0) { exit 1 }
