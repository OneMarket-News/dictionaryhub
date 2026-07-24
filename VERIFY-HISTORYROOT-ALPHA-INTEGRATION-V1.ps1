[CmdletBinding()]
param(
  [string]$ExpectedBranch = "release/historyroot-alpha-integration-v1"
)

$ErrorActionPreference = "Continue"
$RepositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendRoot = Join-Path $RepositoryRoot "backend"
$ExpectedMain = "da3694c01dd16a831f09e9c5a85b825746fe289d"
$RequiredAncestors = @(
  @("ec01f4a8b6ab3220cb5a8e700bad029f5c4cff03", "SourceRoot contextual foundation"),
  @("6a26de35ff219c201a608149751f50fd4c17191b", "HistoryRoot Plymouth dataset"),
  @("947a242fff4c112e0cb6749d0711978de8b5591e", "HistoryRoot customer experience"),
  @("0b53afe6dd68e500d87d04a5a22e9652eccfb623", "Governed HistoryRoot alpha")
)
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0
$script:Information = 0

function Write-Pass([string]$Message) {
  $script:Passed += 1
  Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-Fail([string]$Message) {
  $script:Failed += 1
  Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-InfoResult([string]$Message) {
  $script:Information += 1
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
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

Write-Host "HistoryRoot Alpha Integration and Platform Stabilization v1 verifier"
Write-Host "Repository: $RepositoryRoot"
Write-Host ""

Push-Location $RepositoryRoot
try {
  $branch = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -eq 0 -and $branch -eq $ExpectedBranch) {
    Write-Pass "Expected release branch is active"
  } else {
    Write-Fail "Expected branch $ExpectedBranch; found $branch"
  }

  $localMain = (& git rev-parse main).Trim()
  $originMain = (& git rev-parse origin/main).Trim()
  if ($localMain -eq $ExpectedMain -and $originMain -eq $ExpectedMain) {
    Write-Pass "Local main and origin/main remain unchanged"
  } else {
    Write-Fail "Main changed: local=$localMain origin=$originMain"
  }

  foreach ($ancestor in $RequiredAncestors) {
    & git merge-base --is-ancestor $ancestor[0] HEAD
    if ($LASTEXITCODE -eq 0) {
      Write-Pass "$($ancestor[1]) commit is in release ancestry"
    } else {
      Write-Fail "$($ancestor[1]) commit is missing from release ancestry"
    }
  }

  $mergeSubjects = @(& git log --merges --format=%s "$ExpectedMain..HEAD")
  $requiredMergeSubjects = @(
    "Merge SourceRoot contextual knowledge foundation v1",
    "Merge HistoryRoot Plymouth knowledge dataset v1",
    "Merge HistoryRoot customer experience v1",
    "Merge Governed HistoryRoot alpha v1"
  )
  $missingMergeSubjects = @($requiredMergeSubjects | Where-Object { $_ -notin $mergeSubjects })
  if ($missingMergeSubjects.Count -eq 0) {
    Write-Pass "All four milestone merge boundaries are present"
  } else {
    Write-Fail "Missing milestone merge commits: $($missingMergeSubjects -join ', ')"
  }

  $requiredDocs = @(
    "README.md",
    "developer-quick-start.md",
    "installation-guide.md",
    "deployment-guide.md",
    "architecture-guide.md",
    "release-checklist.md",
    "merge-checklist.md",
    "recovery-guide.md"
  )
  $documentationRoot = Join-Path $RepositoryRoot "docs/platform/historyroot-alpha-integration-v1"
  $missingDocs = @(
    $requiredDocs |
      Where-Object { -not (Test-Path -LiteralPath (Join-Path $documentationRoot $_) -PathType Leaf) }
  )
  if ($missingDocs.Count -eq 0) {
    Write-Pass "Installation, deployment, architecture, quick-start, release, merge, and recovery documentation exists"
  } else {
    Write-Fail "Missing release documentation: $($missingDocs -join ', ')"
  }

  $obsoleteFiles = @(
    "h",
    "assets/css/dictionaryroot-accounts.css",
    "assets/js/dictionaryroot-accounts.js",
    "backend/src/middleware/auth-context.ts",
    "backend/src/services/identity-store.ts"
  )
  $remainingObsolete = @(
    $obsoleteFiles |
      Where-Object { Test-Path -LiteralPath (Join-Path $RepositoryRoot $_) }
  )
  if ($remainingObsolete.Count -eq 0) {
    Write-Pass "Accidental output and dead account/auth compatibility code are removed"
  } else {
    Write-Fail "Obsolete files remain: $($remainingObsolete -join ', ')"
  }

  $hardCodedScripts = @(
    Get-ChildItem -LiteralPath $RepositoryRoot -Filter "*.ps1" -File |
      Where-Object {
        (Get-Content -LiteralPath $_.FullName -Raw) -match "C:\\Users\\[^\\]+\\"
      } |
      Select-Object -ExpandProperty Name
  )
  if ($hardCodedScripts.Count -eq 0) {
    Write-Pass "Operational PowerShell scripts derive repository paths portably"
  } else {
    Write-Fail "Developer-specific paths remain in scripts: $($hardCodedScripts -join ', ')"
  }

  $tracked = @(& git ls-files)
  $unwanted = @(
    $tracked |
      Where-Object {
        $_ -match "(^|/)node_modules/" -or
        $_ -match "(^|/)\.env($|\.)" -and $_ -notmatch "\.example$" -or
        $_ -match "\.(zip|7z|rar|tar|tgz|tar\.gz|dump|bak|tmp|log)$"
      }
  )
  if ($unwanted.Count -eq 0) {
    Write-Pass "No dependencies, secrets files, archives, dumps, backups, temporary files, or logs are tracked"
  } else {
    Write-Fail "Unwanted tracked files found: $($unwanted -join ', ')"
  }

  & git diff --check
  if ($LASTEXITCODE -eq 0) {
    Write-Pass "git diff --check passes"
  } else {
    Write-Fail "git diff --check reported a problem"
  }
} finally {
  Pop-Location
}

Invoke-NativeCheck `
  -Label "Integration static, portability, deployment, and page checks" `
  -WorkingDirectory $RepositoryRoot `
  -FilePath "node.exe" `
  -Arguments @("--test", "verification/historyroot-alpha-integration.test.mjs")

Invoke-NativeCheck `
  -Label "TypeScript typecheck" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "typecheck")

Invoke-NativeCheck `
  -Label "Production TypeScript build" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "build")

Invoke-NativeCheck `
  -Label "Full backend regression suite" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("test")

Invoke-NativeCheck `
  -Label "Plymouth dataset structural and provenance validator" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "historyroot:plymouth:validate")

Invoke-NativeCheck `
  -Label "Fresh PostgreSQL migration, import, replacement, and removal lifecycle" `
  -WorkingDirectory $BackendRoot `
  -FilePath "npm.cmd" `
  -Arguments @("run", "verify:fresh-install")

Invoke-NativeCheck `
  -Label "Governed, customer, dataset, contextual, responsive, and DictionaryRoot regression matrix" `
  -WorkingDirectory $RepositoryRoot `
  -FilePath "powershell.exe" `
  -Arguments @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    ".\VERIFY-GOVERNED-HISTORYROOT-ALPHA-V1.ps1",
    "-ExpectedBranch",
    $ExpectedBranch
  )

Write-InfoResult "Automated verification checks platform behavior and process; it is not historical, legal, security, accessibility, or editorial certification."

Write-Host ""
Write-Host "HistoryRoot Alpha Integration v1 verifier totals"
Write-Host "Passed:   $script:Passed" -ForegroundColor Green
Write-Host "Failed:   $script:Failed" -ForegroundColor $(if ($script:Failed -eq 0) { "Green" } else { "Red" })
Write-Host "Warnings: $script:Warnings" -ForegroundColor $(if ($script:Warnings -eq 0) { "Green" } else { "Yellow" })
Write-Host "Info:     $script:Information" -ForegroundColor Cyan

if ($script:Failed -gt 0) {
  exit 1
}

exit 0
