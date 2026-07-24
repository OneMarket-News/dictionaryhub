[CmdletBinding()]
param(
  [string]$ExpectedBranch =
    "feature/historyroot-plymouth-knowledge-dataset-v1",
  [switch]$AllowStackedCustomerChanges,
  [switch]$AllowStackedGovernanceChanges
)

$ErrorActionPreference = "Continue"
$FoundationCommit =
  "ec01f4a8b6ab3220cb5a8e700bad029f5c4cff03"
$ExpectedMainCommit =
  "da3694c01dd16a831f09e9c5a85b825746fe289d"
$RepositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendRoot = Join-Path $RepositoryRoot "backend"
$DatasetRoot = Join-Path $RepositoryRoot "data/historyroot/plymouth-v1"
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

Write-Host "HistoryRoot Plymouth Knowledge Dataset v1 verifier"
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

  & git merge-base --is-ancestor $FoundationCommit HEAD
  if ($LASTEXITCODE -eq 0) {
    Write-Pass "Contextual-foundation commit is an ancestor of HEAD"
  } else {
    Write-Fail "Contextual-foundation commit is not an ancestor of HEAD"
  }

  $mainCommit = (& git rev-parse main).Trim()
  if ($LASTEXITCODE -eq 0 -and $mainCommit -eq $ExpectedMainCommit) {
    Write-Pass "Local main remains at the expected untouched commit"
  } else {
    Write-Fail "Local main changed: expected $ExpectedMainCommit; found $mainCommit"
  }

  $requiredFiles = @(
    "backend/db/migrations/009_create_contextual_knowledge_foundation.sql",
    "backend/src/historyroot/plymouth-dataset.ts",
    "backend/src/scripts/generate-historyroot-plymouth.ts",
    "backend/src/scripts/validate-historyroot-plymouth.ts",
    "backend/src/scripts/import-historyroot-plymouth.ts",
    "backend/src/scripts/remove-historyroot-plymouth.ts",
    "backend/test/historyroot-plymouth.test.ts",
    "data/historyroot/plymouth-v1/historyroot-plymouth-v1.bundle.json",
    "data/historyroot/plymouth-v1/manifest.json",
    "data/historyroot/plymouth-v1/source-register.json",
    "data/historyroot/plymouth-v1/claim-evidence-matrix.json",
    "data/historyroot/plymouth-v1/open-questions-and-gaps.md",
    "data/historyroot/plymouth-v1/historical-review-guide.md",
    "docs/customers/historyroot/plymouth-knowledge-dataset-v1.md",
    "VERIFY-HISTORYROOT-PLYMOUTH-KNOWLEDGE-DATASET-V1.ps1"
  )
  $missingFiles = @(
    $requiredFiles |
      Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $_) -PathType Leaf)
      }
  )
  if ($missingFiles.Count -eq 0) {
    Write-Pass "All required dataset, tooling, test, review, and documentation files exist"
  } else {
    Write-Fail "Missing required files: $($missingFiles -join ', ')"
  }

  Test-FileContainsAll `
    -Label "Manifest preserves disclaimer, scope, source policy, and schema decision" `
    -Path (Join-Path $DatasetRoot "manifest.json") `
    -RequiredText @(
      "A machine-assisted pilot dataset awaiting further historical, editorial, and tribal review.",
      '"core": "1616-1691"',
      '"transition": "1692 implementation of the 1691 Province charter"',
      '"detailedClaimsRequire": "accessed-and-inspected"',
      '"schemaDecision": "No migration is required.'
    )

  Test-FileContainsAll `
    -Label "Source register exposes access status, locators, limitations, and rejected candidates" `
    -Path (Join-Path $DatasetRoot "source-register.json") `
    -RequiredText @(
      '"accessStatus": "accessed-and-inspected"',
      '"accessStatus": "metadata-verified-not-inspected"',
      '"accessStatus": "bibliographic-only"',
      '"accessStatus": "rejected"',
      '"locatorsInspected"',
      '"limitations"',
      '"supportsDetailedClaims"'
    )

  Test-FileContainsAll `
    -Label "Review package states historical and tribal review boundaries" `
    -Path (Join-Path $DatasetRoot "historical-review-guide.md") `
    -RequiredText @(
      "tribal review",
      "historical accuracy",
      "access status",
      "causal"
    )

  $manifest = Get-Content `
    -LiteralPath (Join-Path $DatasetRoot "manifest.json") `
    -Raw |
      ConvertFrom-Json
  $expectedCounts = @{
    people = 25
    groups = 10
    places = 22
    events = 45
    sources = 20
    claims = 49
    evidence = 49
    interpretations = 12
    perspectives = 10
    causalLinks = 18
    relationships = 71
    culturalMemories = 6
    contextualRecords = 393
  }
  $countMismatches = @(
    $expectedCounts.Keys |
      Where-Object {
        [int]$manifest.counts.$_ -ne [int]$expectedCounts[$_]
      }
  )
  if ($countMismatches.Count -eq 0) {
    Write-Pass "Manifest record totals match the reviewed target set"
  } else {
    Write-Fail "Manifest count mismatch: $($countMismatches -join ', ')"
  }

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
        $_ -match "\.(zip|7z|rar|tar|tgz|tar\.gz|dump|bak|tmp|temp)$"
      }
  )
  if ($unwantedPending.Count -eq 0) {
    Write-Pass "Pending changes contain no secrets files, dependencies, archives, dumps, or temporary artifacts"
  } else {
    Write-Fail "Unwanted pending files found: $($unwantedPending -join ', ')"
  }

  $unexpectedChanges = @(
    $pendingPaths |
      Where-Object {
        $path = $_
        $datasetAllowed =
          $path -match "^backend/package\.json$" -or
          $path -match "^backend/src/historyroot/" -or
          $path -match "^backend/src/scripts/(generate|validate|import|remove)-historyroot-plymouth\.ts$" -or
          $path -match "^backend/src/services/(import-store|search-store)\.ts$" -or
          $path -match "^backend/test/historyroot-plymouth\.test\.ts$" -or
          $path -match "^data/historyroot/($|plymouth-v1/)" -or
          $path -match "^docs/customers/historyroot/" -or
          $path -match "^VERIFY-(HISTORYROOT-PLYMOUTH-KNOWLEDGE-DATASET-V1|SOURCEROOT-CONTEXTUAL-KNOWLEDGE-FOUNDATION)\.ps1$"
        $governanceAllowed = $AllowStackedGovernanceChanges -and (
          $path -match "^VERIFY-(GOVERNED-HISTORYROOT-ALPHA-V1|HISTORYROOT-CUSTOMER-EXPERIENCE-V1)\.ps1$" -or
          $path -match "^assets/(css/historyroot-governance\.css|js/(dictionaryroot-auth|historyroot-governance|historyroot-governance-entry)\.js)$" -or
          $path -match "^backend/(docs/migration-plan\.md|db/migrations/010_extend_contextual_governance\.sql|src/(app\.ts|routes/workflow\.ts|services/(audit-store|context-store|contextual-governance|source-store|workflow-store)\.ts)|test/(governed-historyroot\.test\.ts|helpers/database\.ts))$" -or
          $path -match "^history-(governance|proposal|record|review-queue|review|revisions)-v1\.html$" -or
          $path -match "^verification/governed-historyroot\.test\.mjs$"
        )
        -not ($datasetAllowed -or $governanceAllowed)
      }
  )
  if ($unexpectedChanges.Count -eq 0) {
    Write-Pass "Pending changes are limited to the intended architecture areas"
  } else {
    Write-Fail "Unrelated pending changes found: $($unexpectedChanges -join ', ')"
  }

  & git diff --check
  if ($LASTEXITCODE -eq 0) {
    Write-Pass "Tracked diff passes whitespace and conflict-marker checks"
  } else {
    Write-Fail "git diff --check reported a problem"
  }
} finally {
  Pop-Location
}

Invoke-NativeCheck `
  -Label "Dataset generator is reproducible" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "historyroot:plymouth:generate")

Invoke-NativeCheck `
  -Label "Dataset structural and provenance validator" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "historyroot:plymouth:validate")

Invoke-NativeCheck `
  -Label "PostgreSQL migration 009 is available and applies cleanly" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "db:migrate:test")

Invoke-NativeCheck `
  -Label "Plymouth validation, import, replace, rollback, removal, API, search, and exact-sense tests" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "test:historyroot:plymouth")

Invoke-NativeCheck `
  -Label "Dataset import lifecycle: first import" `
  -WorkingDirectory $BackendRoot `
  -FilePath "node.exe" `
  -Arguments @(
    "--env-file=.env.test",
    "--import",
    "tsx",
    "src/scripts/import-historyroot-plymouth.ts"
  )

Invoke-NativeCheck `
  -Label "Dataset import lifecycle: idempotent replacement" `
  -WorkingDirectory $BackendRoot `
  -FilePath "node.exe" `
  -Arguments @(
    "--env-file=.env.test",
    "--import",
    "tsx",
    "src/scripts/import-historyroot-plymouth.ts"
  )

Invoke-NativeCheck `
  -Label "Dataset import lifecycle: allow-listed removal" `
  -WorkingDirectory $BackendRoot `
  -FilePath "node.exe" `
  -Arguments @(
    "--env-file=.env.test",
    "--import",
    "tsx",
    "src/scripts/remove-historyroot-plymouth.ts"
  )

$contextualVerifierArguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  ".\VERIFY-SOURCEROOT-CONTEXTUAL-KNOWLEDGE-FOUNDATION.ps1",
  "-ExpectedBranch",
  $ExpectedBranch
)
if ($AllowStackedCustomerChanges) {
  $contextualVerifierArguments += "-AllowCustomerChanges"
}

Invoke-NativeCheck `
  -Label "Contextual foundation verifier and full regression suite" `
  -WorkingDirectory $RepositoryRoot `
  -FilePath "powershell.exe" `
  -Arguments $contextualVerifierArguments

Write-InfoResult `
  "This verifier checks structure, provenance controls, lifecycle behavior, and regressions; it is not proof of historical accuracy."

Write-Host ""
Write-Host "Verifier summary"
Write-Host "Passed:   $script:Passed" -ForegroundColor Green
Write-Host "Failed:   $script:Failed" -ForegroundColor $(if ($script:Failed -eq 0) { "Green" } else { "Red" })
Write-Host "Warnings: $script:Warnings" -ForegroundColor $(if ($script:Warnings -eq 0) { "Green" } else { "Yellow" })
Write-Host "Info:     $script:Information" -ForegroundColor Cyan

if ($script:Failed -gt 0) {
  exit 1
}

exit 0
