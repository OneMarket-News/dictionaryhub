[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$ExpectedBranch = "feature/governed-historyroot-alpha-v1"
$ExpectedBaseCommit = "947a242fff4c112e0cb6749d0711978de8b5591e"
$ExpectedDatasetCommit = "6a26de35ff219c201a608149751f50fd4c17191b"
$ExpectedFoundationCommit = "ec01f4a8b6ab3220cb5a8e700bad029f5c4cff03"
$ExpectedMainCommit = "da3694c01dd16a831f09e9c5a85b825746fe289d"
$RepositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendRoot = Join-Path $RepositoryRoot "backend"
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0
$script:Information = 0

function Write-Pass {
  param([string]$Message)
  $script:Passed += 1
  Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-Fail {
  param([string]$Message)
  $script:Failed += 1
  Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-WarningResult {
  param([string]$Message)
  $script:Warnings += 1
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-InfoResult {
  param([string]$Message)
  $script:Information += 1
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Test-FileContainsAll {
  param(
    [string]$Label,
    [string]$Path,
    [string[]]$RequiredText
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Write-Fail "$Label is missing: $Path"
    return
  }
  $contents = Get-Content -LiteralPath $Path -Raw
  $missing = @(
    $RequiredText |
      Where-Object { $contents -notmatch [regex]::Escape($_) }
  )
  if ($missing.Count -eq 0) {
    Write-Pass $Label
  } else {
    Write-Fail "$Label is missing required text: $($missing -join ', ')"
  }
}

function Invoke-NativeCheck {
  param(
    [string]$Label,
    [string]$WorkingDirectory,
    [string]$FilePath,
    [string[]]$Arguments
  )

  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    $exitCode = $LASTEXITCODE
  } catch {
    Write-Fail "$Label threw an exception: $($_.Exception.Message)"
    return
  } finally {
    Pop-Location
  }
  if ($exitCode -eq 0) {
    Write-Pass $Label
  } else {
    Write-Fail "$Label exited with code $exitCode"
  }
}

Write-Host "Governed HistoryRoot Alpha v1 verifier"
Write-Host "Repository: $RepositoryRoot"
Write-Host ""

Push-Location $RepositoryRoot
try {
  $branch = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -eq 0 -and $branch -eq $ExpectedBranch) {
    Write-Pass "Expected governed HistoryRoot branch is active"
  } else {
    Write-Fail "Expected branch $ExpectedBranch; found $branch"
  }

  foreach ($ancestor in @(
    @($ExpectedBaseCommit, "HistoryRoot customer-experience commit"),
    @($ExpectedDatasetCommit, "Plymouth dataset commit"),
    @($ExpectedFoundationCommit, "Contextual foundation commit")
  )) {
    & git merge-base --is-ancestor $ancestor[0] HEAD
    if ($LASTEXITCODE -eq 0) {
      Write-Pass "$($ancestor[1]) is in HEAD ancestry"
    } else {
      Write-Fail "$($ancestor[1]) is not in HEAD ancestry"
    }
  }

  $localMain = (& git rev-parse main).Trim()
  $originMain = (& git rev-parse origin/main).Trim()
  if (
    $LASTEXITCODE -eq 0 -and
    $localMain -eq $ExpectedMainCommit -and
    $originMain -eq $ExpectedMainCommit
  ) {
    Write-Pass "Local main and origin/main remain unchanged"
  } else {
    Write-Fail "Main changed: local=$localMain origin=$originMain"
  }

  $requiredFiles = @(
    "history-governance-v1.html",
    "history-proposal-v1.html",
    "history-review-queue-v1.html",
    "history-review-v1.html",
    "history-revisions-v1.html",
    "assets/css/historyroot-governance.css",
    "assets/js/historyroot-governance.js",
    "assets/js/historyroot-governance-entry.js",
    "backend/db/migrations/010_extend_contextual_governance.sql",
    "backend/src/services/contextual-governance.ts",
    "backend/test/governed-historyroot.test.ts",
    "verification/governed-historyroot.test.mjs",
    "docs/customers/historyroot/governed-historyroot-alpha-v1.md",
    "VERIFY-GOVERNED-HISTORYROOT-ALPHA-V1.ps1"
  )
  $missingFiles = @(
    $requiredFiles |
      Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $_) -PathType Leaf)
      }
  )
  if ($missingFiles.Count -eq 0) {
    Write-Pass "Required governance pages, assets, migration, services, tests, and documentation exist"
  } else {
    Write-Fail "Missing required files: $($missingFiles -join ', ')"
  }

  Test-FileContainsAll `
    -Label "Migration 010 extends the existing domain-neutral proposal and publication model" `
    -Path (Join-Path $BackendRoot "db/migrations/010_extend_contextual_governance.sql") `
    -RequiredText @(
      "ALTER TABLE dr_change_proposals",
      "root_key",
      "bundle_id",
      "change_type",
      "base_version_token",
      "validation_result",
      "prior_snapshot",
      "cultural_memory",
      "CREATE INDEX"
    )

  Test-FileContainsAll `
    -Label "Generic governance route preserves the existing workflow mount" `
    -Path (Join-Path $BackendRoot "src/app.ts") `
    -RequiredText @(
      'app.use("/api/v1/dictionaryroot/workflow", workflowRouter);',
      'app.use("/api/v1/governance", workflowRouter);',
      "cache-control",
      "no-store"
    )

  Test-FileContainsAll `
    -Label "Authentication, CSRF, permissions, and organization scope guard every workflow mutation" `
    -Path (Join-Path $BackendRoot "src/routes/workflow.ts") `
    -RequiredText @(
      "workflowRouter.use(requireAuthentication)",
      "requireCsrf",
      'requirePermission("revision.create")',
      'requirePermission("revision.comment")',
      'requirePermission("revision.publish")',
      "hasOrganizationPermission",
      "authorizedOrganizationIds",
      "The proposal was not found or is not accessible"
    )

  Test-FileContainsAll `
    -Label "Proposal model exposes dataset, change, validation, and stale-base state" `
    -Path (Join-Path $BackendRoot "src/services/workflow-store.ts") `
    -RequiredText @(
      "rootKey",
      "bundleId",
      "changeType",
      "baseVersionToken",
      "validation",
      "staleBase",
      "STALE_PROPOSAL_BASE"
    )

  Test-FileContainsAll `
    -Label "Historical validation protects evidence, locators, limitations, uncertainty, attribution, causality, memory, aliases, and references" `
    -Path (Join-Path $BackendRoot "src/services/contextual-governance.ts") `
    -RequiredText @(
      "CLAIM_EVIDENCE_REQUIRED",
      "SOURCE_LOCATOR_REQUIRED",
      "SOURCE_LIMITATION_REQUIRED",
      "TEMPORAL_CERTAINTY_SUPPORT_REQUIRED",
      "UNCERTAINTY_REMOVAL_UNJUSTIFIED",
      "INTERPRETATION_ATTRIBUTION_REQUIRED",
      "PERSPECTIVE_ATTRIBUTION_REQUIRED",
      "CAUSAL_QUALIFICATION_REQUIRED",
      "CULTURAL_MEMORY_ATTRIBUTION_REQUIRED",
      "DUPLICATE_ENTITY_NAME",
      "GOVERNANCE_REFERENCE_NOT_FOUND",
      "does not prove historical truth"
    )

  Test-FileContainsAll `
    -Label "Publication and rollback use locking, revalidation, transactions, revisions, and retained snapshots" `
    -Path (Join-Path $BackendRoot "src/services/workflow-store.ts") `
    -RequiredText @(
      'await client.query("BEGIN")',
      "pg_advisory_xact_lock",
      "materializeGovernedSnapshot",
      "prior_snapshot",
      "governed-publication",
      "governed-rollback",
      "ROLLBACK_TARGET_CONFLICT",
      'await client.query("COMMIT")',
      'await client.query("ROLLBACK")'
    )

  Test-FileContainsAll `
    -Label "New-record rollback remains non-destructive and public stores exclude withdrawn records" `
    -Path (Join-Path $BackendRoot "src/services/contextual-governance.ts") `
    -RequiredText @(
      "hideNewGovernedTarget",
      "governance-withdrawn",
      "governanceVisibility",
      "withdrawn"
    )

  Test-FileContainsAll `
    -Label "Public contextual records exclude governed withdrawals" `
    -Path (Join-Path $BackendRoot "src/services/context-store.ts") `
    -RequiredText @("cr.status <> 'governance-withdrawn'")

  Test-FileContainsAll `
    -Label "Public source reads exclude governed withdrawals" `
    -Path (Join-Path $BackendRoot "src/services/source-store.ts") `
    -RequiredText @("governanceVisibility", "'public'")

  Test-FileContainsAll `
    -Label "Public search excludes governed contextual and source withdrawals" `
    -Path (Join-Path $BackendRoot "src/services/search-store.ts") `
    -RequiredText @("governanceVisibility", "governance-withdrawn")

  Test-FileContainsAll `
    -Label "Governance interface uses actual permissions and workflow actions" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-governance.js") `
    -RequiredText @(
      'revision.create',
      'revision.submit',
      'revision.review',
      'revision.publish',
      "request-changes",
      "approve",
      "reject",
      "publish",
      "rollback"
    )

  Test-FileContainsAll `
    -Label "Structured editor and record-aware diff cover all governed historical structures" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-governance.js") `
    -RequiredText @(
      "temporal_assertion:",
      "claim:",
      "evidence:",
      "source:",
      "interpretation:",
      "perspective:",
      "causal_link:",
      "cultural_memory:",
      "renderDiff",
      "HIGH_RISK_FIELDS"
    )

  Test-FileContainsAll `
    -Label "Public record correction entry is permission-aware and revision history remains public" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-governance-entry.js") `
    -RequiredText @(
      'auth.hasPermission("revision.create")',
      "history-revisions-v1.html",
      "history-proposal-v1.html",
      "Public record reading remains independent"
    )

  $governanceScripts = @(
    Get-Content -LiteralPath (Join-Path $RepositoryRoot "assets/js/historyroot-governance.js") -Raw
    Get-Content -LiteralPath (Join-Path $RepositoryRoot "assets/js/historyroot-governance-entry.js") -Raw
  ) -join "`n"
  if (
    $governanceScripts -notmatch "\.innerHTML\s*=" -and
    $governanceScripts -notmatch "insertAdjacentHTML" -and
    $governanceScripts -match "textContent"
  ) {
    Write-Pass "Governance scripts use safe DOM text rendering"
  } else {
    Write-Fail "Unsafe governance HTML insertion was detected"
  }

  $pageFailures = @()
  $duplicateIdPages = @()
  foreach ($pageName in @(
    "history-governance-v1.html",
    "history-proposal-v1.html",
    "history-review-queue-v1.html",
    "history-review-v1.html",
    "history-revisions-v1.html"
  )) {
    $contents = Get-Content -LiteralPath (Join-Path $RepositoryRoot $pageName) -Raw
    $ids = @(
      [regex]::Matches($contents, '\bid="([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value }
    )
    $duplicates = @(
      $ids |
        Group-Object |
        Where-Object { $_.Count -gt 1 } |
        Select-Object -ExpandProperty Name
    )
    if ($duplicates.Count -gt 0) {
      $duplicateIdPages += "$pageName ($($duplicates -join ', '))"
    }
    if (
      ([regex]::Matches($contents, "<h1(?:\s|>)")).Count -ne 1 -or
      $contents -notmatch 'name="viewport"' -or
      $contents -notmatch "historyroot-governance.css" -or
      $contents -notmatch "historyroot-governance.js"
    ) {
      $pageFailures += $pageName
    }
  }
  if ($pageFailures.Count -eq 0) {
    Write-Pass "Governance pages have responsive metadata, one H1, shared CSS, and shared JavaScript"
  } else {
    Write-Fail "Governance page structure failed: $($pageFailures -join ', ')"
  }
  if ($duplicateIdPages.Count -eq 0) {
    Write-Pass "Governance pages use unique HTML IDs"
  } else {
    Write-Fail "Duplicate HTML IDs found: $($duplicateIdPages -join '; ')"
  }

  Test-FileContainsAll `
    -Label "Responsive governance CSS covers stacked diffs, mobile actions, focus, and reduced motion" `
    -Path (Join-Path $RepositoryRoot "assets/css/historyroot-governance.css") `
    -RequiredText @(
      "@media (max-width: 900px)",
      "@media (max-width: 620px)",
      ".hrg-diff",
      ":focus-visible",
      "prefers-reduced-motion: reduce"
    )

  Test-FileContainsAll `
    -Label "PostgreSQL tests cover sessions, scopes, lifecycle, publication, rollback, validation, and concurrency" `
    -Path (Join-Path $BackendRoot "test/governed-historyroot.test.ts") `
    -RequiredText @(
      "public contextual reads remain unauthenticated",
      "contributors submit",
      "organization scoping",
      "atomically updates public APIs",
      "drafts and rejected proposals",
      "rollback restores",
      "new records publish",
      "historical validation blocks",
      "protects attribution",
      "concurrent proposals detect stale bases"
    )

  Test-FileContainsAll `
    -Label "Documentation states architecture, roles, lifecycle, setup, safeguards, and limitations" `
    -Path (Join-Path $RepositoryRoot "docs/customers/historyroot/governed-historyroot-alpha-v1.md") `
    -RequiredText @(
      "Architecture reused",
      "Actual roles and permissions",
      "Lifecycle mapping",
      "Historical validation",
      "Publication, public/private separation, and search",
      "Revision history and rollback",
      "Local setup",
      "Known limitations and remaining gaps"
    )

  $domainNeutralFiles = @(
    "backend/db/migrations/010_extend_contextual_governance.sql",
    "backend/src/services/contextual-governance.ts",
    "backend/src/services/workflow-store.ts",
    "backend/src/routes/workflow.ts"
  )
  $persistenceNames = @()
  foreach ($relativePath in $domainNeutralFiles) {
    $persistenceNames += Select-String `
      -LiteralPath (Join-Path $RepositoryRoot $relativePath) `
      -Pattern "HistoryRootProposal|HistoryRootRevision|HistoryRootPublication|HistoryRootRollback" `
      -CaseSensitive:$false
  }
  if ($persistenceNames.Count -eq 0) {
    Write-Pass "No HistoryRoot-specific governance persistence model was introduced"
  } else {
    Write-Fail "HistoryRoot-specific governance persistence naming was found"
  }

  $tracked = @(& git ls-files)
  $trackedNodeModules = @($tracked | Where-Object { $_ -match "(^|/)node_modules/" })
  $trackedArchives = @(
    $tracked |
      Where-Object { $_ -match "\.(zip|7z|rar|tar|tgz|tar\.gz|dump|bak)$" }
  )
  $trackedEnvironment = @(
    $tracked |
      Where-Object {
        $_ -match "(^|/)\.env($|\.)" -and
        $_ -notmatch "\.example$"
      }
  )
  if (
    $trackedNodeModules.Count -eq 0 -and
    $trackedArchives.Count -eq 0 -and
    $trackedEnvironment.Count -eq 0
  ) {
    Write-Pass "No tracked node_modules, archives, dumps, backups, or environment files were found"
  } else {
    Write-Fail "Unwanted tracked generated or environment files were found"
  }

  $statusPaths = @(
    & git status --short |
      ForEach-Object {
        if ($_.Length -gt 3) { $_.Substring(3).Trim('"') }
      }
  )
  $temporaryPaths = @(
    $statusPaths |
      Where-Object {
        $_ -match "(?i)(^|/)(tmp|temp|playwright-report|test-results|browser-profile|sessions?)(/|$)" -or
        $_ -match "(?i)\.(tmp|log|zip|7z|rar|bak|dump)$"
      }
  )
  if ($temporaryPaths.Count -eq 0) {
    Write-Pass "No pending temporary output, session, browser profile, archive, or log files were found"
  } else {
    Write-Fail "Pending temporary output found: $($temporaryPaths -join ', ')"
  }

  $secretPattern =
    "BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{32,}|dr_session="
  $secretMatches = @(
    $statusPaths |
      Sort-Object -Unique |
      Where-Object { $_ -ne "VERIFY-GOVERNED-HISTORYROOT-ALPHA-V1.ps1" } |
      ForEach-Object {
        $pendingPath = Join-Path $RepositoryRoot $_
        if (Test-Path -LiteralPath $pendingPath -PathType Leaf) {
          $content = [System.IO.File]::ReadAllText(
            $pendingPath,
            [System.Text.Encoding]::UTF8
          )
          if ($content -match $secretPattern) { $_ }
        }
      }
  )
  if ($secretMatches.Count -eq 0) {
    Write-Pass "No recognizable credentials, private keys, API keys, or session cookies were found"
  } else {
    Write-Fail "Potential secret material found"
  }

  & git diff --check
  if ($LASTEXITCODE -eq 0) {
    Write-Pass "git diff --check passes"
  } else {
    Write-Fail "git diff --check reported a problem"
  }

  $syntaxFailed = $false
  foreach ($scriptName in @(
    "assets/js/historyroot-governance.js",
    "assets/js/historyroot-governance-entry.js",
    "assets/js/dictionaryroot-auth.js"
  )) {
    & node.exe --check (Join-Path $RepositoryRoot $scriptName)
    if ($LASTEXITCODE -ne 0) { $syntaxFailed = $true }
  }
  if ($syntaxFailed) {
    Write-Fail "A changed browser JavaScript file failed syntax validation"
  } else {
    Write-Pass "Changed browser JavaScript passes syntax validation"
  }
} finally {
  Pop-Location
}

Invoke-NativeCheck `
  -Label "Governed HistoryRoot static, URL-state, responsive, and accessibility tests" `
  -WorkingDirectory $RepositoryRoot `
  -FilePath "node.exe" `
  -Arguments @("--test", "verification/governed-historyroot.test.mjs")

Invoke-NativeCheck `
  -Label "Governed HistoryRoot PostgreSQL lifecycle, authorization, validation, publication, rollback, and concurrency tests" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "test:governance:historyroot")

Invoke-NativeCheck `
  -Label "HistoryRoot customer-experience regression verifier" `
  -WorkingDirectory $RepositoryRoot `
  -FilePath "powershell.exe" `
  -Arguments @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    ".\VERIFY-HISTORYROOT-CUSTOMER-EXPERIENCE-V1.ps1",
    "-ExpectedBranch",
    $ExpectedBranch,
    "-AllowStackedGovernanceChanges"
  )

Invoke-NativeCheck `
  -Label "HistoryRoot Plymouth dataset and contextual-foundation regression verifier" `
  -WorkingDirectory $RepositoryRoot `
  -FilePath "powershell.exe" `
  -Arguments @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    ".\VERIFY-HISTORYROOT-PLYMOUTH-KNOWLEDGE-DATASET-V1.ps1",
    "-ExpectedBranch",
    $ExpectedBranch,
    "-AllowStackedCustomerChanges",
    "-AllowStackedGovernanceChanges"
  )

Write-InfoResult "Automated checks verify structure, provenance, attribution, process, and regressions; they do not prove historical accuracy or editorial truth."
Write-InfoResult "This verifier is not a security, legal, accessibility, or academic certification."

Write-Host ""
Write-Host "Governed HistoryRoot Alpha v1 verifier totals"
Write-Host "Passed:   $script:Passed" -ForegroundColor Green
Write-Host "Failed:   $script:Failed" -ForegroundColor $(if ($script:Failed -eq 0) { "Green" } else { "Red" })
Write-Host "Warnings: $script:Warnings" -ForegroundColor $(if ($script:Warnings -eq 0) { "Green" } else { "Yellow" })
Write-Host "Info:     $script:Information" -ForegroundColor Cyan

if ($script:Failed -gt 0) {
  exit 1
}

exit 0
