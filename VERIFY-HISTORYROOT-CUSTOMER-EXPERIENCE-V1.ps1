[CmdletBinding()]
param(
  [string]$ExpectedBranch =
    "feature/historyroot-customer-experience-v1",
  [switch]$AllowStackedGovernanceChanges
)

$ErrorActionPreference = "Continue"
$ExpectedBaseCommit = "6a26de35ff219c201a608149751f50fd4c17191b"
$ExpectedFoundationCommit = "ec01f4a8b6ab3220cb5a8e700bad029f5c4cff03"
$ExpectedMainCommit = "da3694c01dd16a831f09e9c5a85b825746fe289d"
$RepositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendRoot = Join-Path $RepositoryRoot "backend"
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0

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

Write-Host "HistoryRoot Customer Experience v1 verifier"
Write-Host "Repository: $RepositoryRoot"
Write-Host ""

Push-Location $RepositoryRoot
try {
  $branch = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -eq 0 -and $branch -eq $ExpectedBranch) {
    Write-Pass "Expected HistoryRoot customer-experience branch is active"
  } else {
    Write-Fail "Expected branch $ExpectedBranch; found $branch"
  }

  & git merge-base --is-ancestor $ExpectedBaseCommit HEAD
  if ($LASTEXITCODE -eq 0) {
    Write-Pass "Plymouth dataset commit is an ancestor of HEAD"
  } else {
    Write-Fail "Plymouth dataset commit is not an ancestor of HEAD"
  }

  & git merge-base --is-ancestor $ExpectedFoundationCommit HEAD
  if ($LASTEXITCODE -eq 0) {
    Write-Pass "Contextual knowledge foundation is an ancestor of HEAD"
  } else {
    Write-Fail "Contextual knowledge foundation is not an ancestor of HEAD"
  }

  $localMain = (& git rev-parse main).Trim()
  $originMain = (& git rev-parse origin/main).Trim()
  if (
    $LASTEXITCODE -eq 0 -and
    $localMain -eq $ExpectedMainCommit -and
    $originMain -eq $ExpectedMainCommit
  ) {
    Write-Pass "Local main and origin/main remain at the untouched expected commit"
  } else {
    Write-Fail "Main changed: local=$localMain origin=$originMain expected=$ExpectedMainCommit"
  }

  $requiredFiles = @(
    "historyroot.html",
    "history-explore-v1.html",
    "history-timeline-v1.html",
    "history-record-v1.html",
    "history-sources-v1.html",
    "history-graph-v1.html",
    "assets/css/historyroot.css",
    "assets/js/historyroot-api.js",
    "assets/js/historyroot-shared.js",
    "assets/js/historyroot-home.js",
    "assets/js/historyroot-explore.js",
    "assets/js/historyroot-timeline.js",
    "assets/js/historyroot-record.js",
    "assets/js/historyroot-sources.js",
    "assets/js/historyroot-graph.js",
    "config/customers/historyroot.json",
    "verification/historyroot-customer-experience.test.mjs",
    "VERIFY-HISTORYROOT-RESPONSIVE.mjs",
    "docs/customers/historyroot/customer-experience-v1.md",
    "VERIFY-HISTORYROOT-CUSTOMER-EXPERIENCE-V1.ps1",
    "backend/db/migrations/009_create_contextual_knowledge_foundation.sql"
  )
  $missingFiles = @(
    $requiredFiles |
      Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $_) -PathType Leaf)
      }
  )
  if ($missingFiles.Count -eq 0) {
    Write-Pass "All six pages, shared assets, tests, documentation, and migration 009 exist"
  } else {
    Write-Fail "Missing required files: $($missingFiles -join ', ')"
  }

  $pages = @(
    "historyroot.html",
    "history-explore-v1.html",
    "history-timeline-v1.html",
    "history-record-v1.html",
    "history-sources-v1.html",
    "history-graph-v1.html"
  )
  $pageFailures = @()
  $duplicateIdPages = @()
  foreach ($page in $pages) {
    $contents = Get-Content -LiteralPath (Join-Path $RepositoryRoot $page) -Raw
    $h1Count = ([regex]::Matches($contents, "<h1(?:\s|>)")).Count
    $ids = @(
      [regex]::Matches($contents, '\bid="([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value }
    )
    $duplicateIds = @(
      $ids |
        Group-Object |
        Where-Object { $_.Count -gt 1 } |
        Select-Object -ExpandProperty Name
    )
    if ($duplicateIds.Count -gt 0) {
      $duplicateIdPages += "$page ($($duplicateIds -join ', '))"
    }
    $apiIndex = $contents.IndexOf("assets/js/historyroot-api.js")
    $sharedIndex = $contents.IndexOf("assets/js/historyroot-shared.js")
    $lastHistoryScriptIndex = $contents.LastIndexOf("assets/js/historyroot-")
    if (
      $h1Count -ne 1 -or
      $contents -notmatch 'name="viewport"' -or
      $contents -notmatch "assets/css/historyroot.css" -or
      $apiIndex -lt 0 -or
      $sharedIndex -le $apiIndex -or
      $lastHistoryScriptIndex -le $sharedIndex
    ) {
      $pageFailures += $page
    }
  }
  if ($pageFailures.Count -eq 0) {
    Write-Pass "All six pages have one H1, responsive metadata, shared CSS, and safe script order"
  } else {
    Write-Fail "Page structure or script order failed: $($pageFailures -join ', ')"
  }
  if ($duplicateIdPages.Count -eq 0) {
    Write-Pass "All six pages use unique HTML IDs"
  } else {
    Write-Fail "Duplicate HTML IDs found: $($duplicateIdPages -join '; ')"
  }

  Test-FileContainsAll `
    -Label "Shared navigation covers the five experiences and DictionaryRoot family link" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-shared.js") `
    -RequiredText @(
      '{ key: "home", label: "Home"',
      '{ key: "explore", label: "Explore"',
      '{ key: "timeline", label: "Timeline"',
      '{ key: "sources", label: "Sources"',
      '{ key: "graph", label: "Knowledge Graph"',
      'text: "DictionaryRoot"',
      '"aria-expanded"'
    )

  Test-FileContainsAll `
    -Label "Live-only API client handles timeout, malformed, offline, and missing-dataset states" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-api.js") `
    -RequiredText @(
      "AbortController",
      "MALFORMED_RESPONSE",
      "TIMEOUT",
      "OFFLINE",
      "datasetAvailable",
      "/context/records/",
      "/sources"
    )

  Test-FileContainsAll `
    -Label "Shared customer state explicitly refuses historical fallback records" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-shared.js") `
    -RequiredText @(
      "DATASET_NOT_IMPORTED",
      "No historical fallback data is shown.",
      "HistoryRoot is temporarily offline",
      "Try again"
    )

  $customerScripts = @(
    Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "assets/js") `
      -Filter "historyroot-*.js" |
      Get-Content -Raw
  ) -join "`n"
  if (
    $customerScripts -notmatch "\.innerHTML\s*=" -and
    $customerScripts -notmatch "insertAdjacentHTML" -and
    $customerScripts -match "textContent" -and
    $customerScripts -match "createTextNode"
  ) {
    Write-Pass "Customer scripts render API data with safe DOM text operations"
  } else {
    Write-Fail "Unsafe HTML rendering or missing safe DOM construction was detected"
  }

  Test-FileContainsAll `
    -Label "Explore preserves aliases, canonical deduplication, filters, and browser history" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-explore.js") `
    -RequiredText @(
      "dedupeRecords",
      "temporalBySubject",
      "uncertain",
      "culturalMemories",
      "updateUrl",
      "popstate"
    )

  Test-FileContainsAll `
    -Label "Timeline preserves precision, uncertainty, separate periods, and progressive disclosure" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-timeline.js") `
    -RequiredText @(
      "temporalPrecisionLabel",
      "temporalUncertainty",
      "Background context",
      "Core period",
      "1692 transition",
      "Cultural-memory afterlife",
      "PAGE_SIZE"
    )

  Test-FileContainsAll `
    -Label "Record detail covers evidence, attribution, qualified causality, memory, and sources" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-record.js") `
    -RequiredText @(
      "Claims and evidence",
      "Evidence limit:",
      "Attributed perspective:",
      "Causal qualification:",
      "Cultural memory and afterlife",
      "Sources"
    )

  Test-FileContainsAll `
    -Label "Document transmission keeps a lost original separate from textual witnesses" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-record.js") `
    -RequiredText @(
      "Document and textual transmission",
      "textual_witness_of",
      "embodied_work",
      "Original does not survive",
      "originalLost"
    )

  Test-FileContainsAll `
    -Label "Source experience exposes classification, access, locators, limitations, rights, and links" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-sources.js") `
    -RequiredText @(
      "sourceClassLabel",
      "Access status",
      "Locators inspected",
      "Limitations",
      "License or rights",
      "externalLink",
      "sourceLinkedRecords"
    )

  Test-FileContainsAll `
    -Label "Focused graph is bounded, selectable, URL-addressable, and accessible as a list" `
    -Path (Join-Path $RepositoryRoot "assets/js/historyroot-graph.js") `
    -RequiredText @(
      "maximumNodeLimit",
      "buildNeighborhood",
      "aria-pressed",
      'updateUrl({ id: focusId })',
      "applyKindsFromUrl",
      "Also known as:",
      "Qualification:",
      "popstate",
      "historyrootGraphList"
    )

  Test-FileContainsAll `
    -Label "Responsive and reduced-motion hooks cover HistoryRoot surfaces" `
    -Path (Join-Path $RepositoryRoot "assets/css/historyroot.css") `
    -RequiredText @(
      "@media (max-width: 1320px)",
      "@media (max-width: 900px)",
      "@media (max-width: 680px)",
      "@media (max-width: 420px)",
      "@media (prefers-reduced-motion: reduce)",
      ".historyroot-menu-button",
      ".hr-graph-stage"
    )

  Test-FileContainsAll `
    -Label "Customer documentation records architecture, safety, live review, and pilot boundaries" `
    -Path (Join-Path $RepositoryRoot "docs/customers/historyroot/customer-experience-v1.md") `
    -RequiredText @(
      "static historical-record fallback",
      "Mayflower Compact",
      "perspective",
      "test database",
      "remove-historyroot-plymouth",
      "Pilot boundaries"
    )

  Test-FileContainsAll `
    -Label "Domain-neutral APIs expose existing perspective links and source review fields" `
    -Path (Join-Path $RepositoryRoot "backend/src/services/context-store.ts") `
    -RequiredText @(
      "perspectiveLinks",
      "context_record_perspectives",
      "perspectiveId",
      "stance",
      "notes"
    )
  Test-FileContainsAll `
    -Label "Source reads merge governed raw source fields without a migration" `
    -Path (Join-Path $RepositoryRoot "backend/src/services/source-store.ts") `
    -RequiredText @(
      "...row.raw_data",
      "raw_data",
      "sourceId: row.source_id"
    )

  $statusLines = @(& git status --porcelain=v1)
  $pendingPaths = @(
    $statusLines |
      ForEach-Object {
        if ($_.Length -gt 3) {
          $_.Substring(3).Trim('"')
        }
      }
  )
  $unwantedPending = @(
    $pendingPaths |
      Where-Object {
        $_ -match "(^|/)node_modules/" -or
        $_ -match "(^|/)\.env($|\.)" -or
        $_ -match "(^|/)(tmp|temp|coverage|dist|screenshots?)/" -or
        $_ -match "\.(zip|7z|rar|tar|tgz|tar\.gz|dump|bak|tmp|temp|log)$"
      }
  )
  if ($unwantedPending.Count -eq 0) {
    Write-Pass "Pending changes contain no secrets files, dependencies, generated output, archives, or temporary artifacts"
  } else {
    Write-Fail "Unwanted pending files found: $($unwantedPending -join ', ')"
  }

  $unexpectedPending = @(
    $pendingPaths |
      Where-Object {
        $path = $_
        $customerAllowed =
          $path -match "^history(root|-explore-v1|-timeline-v1|-record-v1|-sources-v1|-graph-v1)\.html$" -or
          $path -match "^assets/(css/historyroot\.css|js/historyroot-[a-z-]+\.js)$" -or
          $path -match "^config/customers/historyroot\.json$" -or
          $path -match "^backend/src/services/(context-store|source-store)\.ts$" -or
          $path -match "^backend/test/(contextual-knowledge|historyroot-plymouth)\.test\.ts$" -or
          $path -match "^verification/historyroot-customer-experience\.test\.mjs$" -or
          $path -match "^docs/customers/historyroot/customer-experience-v1\.md$" -or
          $path -match "^VERIFY-HISTORYROOT-(CUSTOMER-EXPERIENCE-V1\.ps1|RESPONSIVE\.mjs)$"
        $governanceAllowed = $AllowStackedGovernanceChanges -and (
          $path -match "^VERIFY-(GOVERNED-HISTORYROOT-ALPHA-V1|HISTORYROOT-PLYMOUTH-KNOWLEDGE-DATASET-V1|SOURCEROOT-CONTEXTUAL-KNOWLEDGE-FOUNDATION)\.ps1$" -or
          $path -match "^assets/(css/historyroot-governance\.css|js/(dictionaryroot-auth|historyroot-governance|historyroot-governance-entry)\.js)$" -or
          $path -match "^backend/(docs/migration-plan\.md|package\.json|db/migrations/010_extend_contextual_governance\.sql|src/(app\.ts|routes/workflow\.ts|services/(audit-store|contextual-governance|search-store|workflow-store)\.ts)|test/(governed-historyroot\.test\.ts|helpers/database\.ts))$" -or
          $path -match "^docs/customers/historyroot/governed-historyroot-alpha-v1\.md$" -or
          $path -match "^history-(governance|proposal|review-queue|review|revisions)-v1\.html$" -or
          $path -match "^verification/governed-historyroot\.test\.mjs$"
        )
        -not ($customerAllowed -or $governanceAllowed)
      }
  )
  if ($unexpectedPending.Count -eq 0) {
    Write-Pass "Pending changes are limited to intended customer, generic read-API, test, verifier, and documentation areas"
  } else {
    Write-Fail "Unrelated pending files found: $($unexpectedPending -join ', ')"
  }

  $trackedUnwanted = @(
    & git ls-files |
      Where-Object {
        $_ -match "(^|/)node_modules/" -or
        $_ -match "\.(zip|7z|rar|tar|tgz|tar\.gz|dump|bak)$"
      }
  )
  if ($trackedUnwanted.Count -eq 0) {
    Write-Pass "No dependency trees, generated archives, or database dumps are tracked"
  } else {
    Write-Fail "Unwanted tracked artifacts found: $($trackedUnwanted -join ', ')"
  }

  $trackedEnvironment = @(
    & git ls-files |
      Where-Object {
        $_ -match "(^|/)\.env($|\.)" -and
        $_ -notmatch "\.example$"
      }
  )
  $secretMatches = @(
    & git grep -I -n -E `
      "BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{32,}" `
      -- . `
      ":(exclude)VERIFY-HISTORYROOT-CUSTOMER-EXPERIENCE-V1.ps1"
  )
  $secretExit = $LASTEXITCODE
  $actionableSecretMatches = @(
    $secretMatches |
      Where-Object { $_ -notmatch "\\n\.\.\.\\n|\.\.\." }
  )
  if (
    $trackedEnvironment.Count -eq 0 -and
    ($secretExit -eq 1 -or $actionableSecretMatches.Count -eq 0)
  ) {
    Write-Pass "No tracked environment files or recognizable secret material were found"
  } else {
    Write-Fail "Potential committed secret material or environment files were found"
  }

  & git diff --check
  if ($LASTEXITCODE -eq 0) {
    Write-Pass "Tracked diff passes whitespace and conflict-marker checks"
  } else {
    Write-Fail "git diff --check reported a problem"
  }

  $syntaxFailed = $false
  Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "assets/js") `
    -Filter "historyroot-*.js" |
    ForEach-Object {
      & node.exe --check $_.FullName
      if ($LASTEXITCODE -ne 0) {
        $syntaxFailed = $true
      }
    }
  if ($syntaxFailed) {
    Write-Fail "A HistoryRoot JavaScript file failed syntax validation"
  } else {
    Write-Pass "All HistoryRoot JavaScript files pass Node syntax validation"
  }
} finally {
  Pop-Location
}

Invoke-NativeCheck `
  -Label "Targeted HistoryRoot static and DOM tests" `
  -WorkingDirectory $RepositoryRoot `
  -FilePath "node.exe" `
  -Arguments @("--test", "verification/historyroot-customer-experience.test.mjs")

Invoke-NativeCheck `
  -Label "Backend TypeScript validation" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "typecheck")

Invoke-NativeCheck `
  -Label "Plymouth dataset structural and provenance validation" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "historyroot:plymouth:validate")

Invoke-NativeCheck `
  -Label "HistoryRoot dataset, live API, alias, source, and exact-sense regressions" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "test:historyroot:plymouth")

Invoke-NativeCheck `
  -Label "Contextual read API and DictionaryRoot exact-sense regressions" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "test:context")

Invoke-NativeCheck `
  -Label "HistoryRoot desktop, tablet, and mobile browser checks" `
  -WorkingDirectory $RepositoryRoot `
  -FilePath "node.exe" `
  -Arguments @("VERIFY-HISTORYROOT-RESPONSIVE.mjs")

Write-Host ""
Write-Host "HistoryRoot Customer Experience v1 verification totals"
Write-Host "Passed: $script:Passed"
Write-Host "Failed: $script:Failed"
Write-Host "Warnings: $script:Warnings"

if ($script:Failed -gt 0) {
  exit 1
}

exit 0
