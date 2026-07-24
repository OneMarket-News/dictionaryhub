[CmdletBinding()]
param(
  [string]$ExpectedBranch =
    "feature/sourceroot-contextual-knowledge-foundation-v1"
)

$ErrorActionPreference = "Continue"
$ExpectedBaseCommit = "da3694c01dd16a831f09e9c5a85b825746fe289d"
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

Write-Host "SourceRoot Contextual Knowledge Foundation v1 verifier"
Write-Host "Repository: $RepositoryRoot"
Write-Host ""

Push-Location $RepositoryRoot
try {
  $branch = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -eq 0 -and $branch -eq $ExpectedBranch) {
    Write-Pass "Expected feature branch is active"
  } else {
    Write-Fail "Expected branch $ExpectedBranch; found $branch"
  }

  & git merge-base --is-ancestor $ExpectedBaseCommit HEAD
  if ($LASTEXITCODE -eq 0) {
    Write-Pass "Expected base commit is an ancestor of HEAD"
  } else {
    Write-Fail "Expected base commit is not an ancestor of HEAD"
  }

  $requiredFiles = @(
    "backend/db/migrations/009_create_contextual_knowledge_foundation.sql",
    "backend/src/contextual-types.ts",
    "backend/src/services/contextual-schemas.ts",
    "backend/src/services/context-import-store.ts",
    "backend/src/services/context-store.ts",
    "backend/src/routes/context.ts",
    "backend/test/contextual-knowledge.test.ts",
    "backend/test/fixtures/contextual-historyroot-valid.json",
    "docs/platform/contextual-knowledge-foundation-v1.md",
    "VERIFY-SOURCEROOT-CONTEXTUAL-KNOWLEDGE-FOUNDATION.ps1"
  )
  $missingFiles = @(
    $requiredFiles |
      Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $_) -PathType Leaf)
      }
  )
  if ($missingFiles.Count -eq 0) {
    Write-Pass "All required Chunk 1 files exist"
  } else {
    Write-Fail "Missing required files: $($missingFiles -join ', ')"
  }

  $migrationPath = Join-Path $BackendRoot "db/migrations/009_create_contextual_knowledge_foundation.sql"
  Test-FileContainsAll `
    -Label "Migration contains normalized contextual structures, constraints, indexes, and ownership" `
    -Path $migrationPath `
    -RequiredText @(
      "CREATE TABLE IF NOT EXISTS context_records",
      "CREATE TABLE IF NOT EXISTS context_entities",
      "CREATE TABLE IF NOT EXISTS context_temporal_assertions",
      "CREATE TABLE IF NOT EXISTS context_accounts",
      "CREATE TABLE IF NOT EXISTS context_claims",
      "CREATE TABLE IF NOT EXISTS context_evidence",
      "CREATE TABLE IF NOT EXISTS context_interpretations",
      "CREATE TABLE IF NOT EXISTS context_perspectives",
      "CREATE TABLE IF NOT EXISTS context_causal_links",
      "CREATE TABLE IF NOT EXISTS context_relationships",
      "CREATE TABLE IF NOT EXISTS context_cultural_memories",
      "FOREIGN KEY",
      "CREATE INDEX",
      "ON DELETE CASCADE",
      "JSONB"
    )

  Test-FileContainsAll `
    -Label "Context route is registered beneath /api/v1/context" `
    -Path (Join-Path $BackendRoot "src/app.ts") `
    -RequiredText @(
      'import { contextRouter } from "./routes/context.js";',
      'app.use("/api/v1/context", contextRouter);'
    )

  Test-FileContainsAll `
    -Label "Backward-compatible optional import and transactional contextual persistence are wired" `
    -Path (Join-Path $BackendRoot "src/services/import-store.ts") `
    -RequiredText @(
      'await client.query("BEGIN")',
      "deleteContextRecords",
      "insertContextualBundle",
      'await client.query("COMMIT")',
      'await client.query("ROLLBACK")'
    )

  Test-FileContainsAll `
    -Label "Search integration retains DictionaryRoot exact-sense protection" `
    -Path (Join-Path $BackendRoot "src/services/search-store.ts") `
    -RequiredText @(
      "searchDictionaryRootExactSenses",
      "context-entity",
      "context-account",
      "context-claim",
      "context-interpretation",
      "context-relationship",
      'exactSensePolicy: "complete-lemma"'
    )

  $domainNeutralFiles = @(
    "backend/db/migrations/009_create_contextual_knowledge_foundation.sql",
    "backend/src/contextual-types.ts",
    "backend/src/services/contextual-schemas.ts",
    "backend/src/services/context-import-store.ts",
    "backend/src/services/context-store.ts",
    "backend/src/routes/context.ts"
  )
  $domainSpecificMatches = @()
  foreach ($relativePath in $domainNeutralFiles) {
    $fullPath = Join-Path $RepositoryRoot $relativePath
    if (Test-Path -LiteralPath $fullPath) {
      $domainSpecificMatches += Select-String `
        -LiteralPath $fullPath `
        -Pattern "Plymouth|Colonial|HistoryRoot|BibleRoot|NewsRoot" `
        -CaseSensitive:$false
    }
  }
  if ($domainSpecificMatches.Count -eq 0) {
    Write-Pass "Framework implementation uses domain-neutral naming"
  } else {
    Write-Fail "Domain-specific naming appears in framework implementation"
  }

  $trackedFiles = @(& git ls-files)
  $committedNodeModules = @(
    $trackedFiles |
      Where-Object { $_ -match "(^|/)node_modules/" }
  )
  if ($committedNodeModules.Count -eq 0) {
    Write-Pass "No node_modules files are committed"
  } else {
    Write-Fail "Committed node_modules files found"
  }

  $committedArchives = @(
    $trackedFiles |
      Where-Object {
        $_ -match "\.(zip|7z|rar|tar|tgz|tar\.gz|dump|bak)$"
      }
  )
  if ($committedArchives.Count -eq 0) {
    Write-Pass "No generated archives or database dumps are committed"
  } else {
    Write-Fail "Committed archive or database dump found: $($committedArchives -join ', ')"
  }

  $committedEnvironmentFiles = @(
    $trackedFiles |
      Where-Object {
        $_ -match "(^|/)\.env($|\.)" -and
        $_ -notmatch "\.example$"
      }
  )
  $secretMatches = @(
    & git grep -I -n -E `
      "BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{32,}" `
      -- . `
      ":(exclude)VERIFY-SOURCEROOT-CONTEXTUAL-KNOWLEDGE-FOUNDATION.ps1"
  )
  $secretGrepExit = $LASTEXITCODE
  $actionableSecretMatches = @(
    $secretMatches |
      Where-Object { $_ -notmatch "\\n\.\.\.\\n|\.\.\." }
  )
  if (
    $committedEnvironmentFiles.Count -eq 0 -and
    ($secretGrepExit -eq 1 -or $actionableSecretMatches.Count -eq 0)
  ) {
    Write-Pass "No committed environment files or recognizable secrets were found"
  } else {
    Write-Fail "Potential committed secret material found"
  }

  $changedFiles = @(& git diff --name-only $ExpectedBaseCommit)
  $changedHistoryPages = @(
    $changedFiles |
      Where-Object {
        $_ -match "(?i)historyroot.*\.html$|(?i)history.*\.html$"
      }
  )
  if ($changedHistoryPages.Count -eq 0) {
    Write-Pass "No unintended customer-facing HistoryRoot pages were added or changed"
  } else {
    Write-Fail "Customer-facing HistoryRoot page changes found: $($changedHistoryPages -join ', ')"
  }

  if ($changedFiles.Count -gt 0) {
    Write-Pass "Git diff contains Chunk 1 changes for review"
  } else {
    Write-WarningResult "No changes were found relative to the expected base commit"
  }
} finally {
  Pop-Location
}

Invoke-NativeCheck `
  -Label "PostgreSQL contextual migration is available and applies cleanly" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "db:migrate:test")

Invoke-NativeCheck `
  -Label "TypeScript typecheck" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "typecheck")

Invoke-NativeCheck `
  -Label "Contextual validation, import, API, search, deletion, FK, and exact-sense tests" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "test:context")

Invoke-NativeCheck `
  -Label "Full backend regression tests" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("test")

Write-Host ""
Write-Host "Verifier summary"
Write-Host "Passed:   $script:Passed" -ForegroundColor Green
Write-Host "Failed:   $script:Failed" -ForegroundColor $(if ($script:Failed -eq 0) { "Green" } else { "Red" })
Write-Host "Warnings: $script:Warnings" -ForegroundColor $(if ($script:Warnings -eq 0) { "Green" } else { "Yellow" })

if ($script:Failed -gt 0) {
  exit 1
}

exit 0
