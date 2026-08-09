<#
.SYNOPSIS
Focused verifier for Chunk 14C, SourceRoot Shared Grammar and Root Integration
Contracts v1.

.DESCRIPTION
Verifies the contract-only stage boundary: exact changed-file scope, released
Chunk 14A and 14B baselines, byte-identical migrations 018 and 019, absence of
migration 020, preserved development runtime readiness 1.4.0, the focused
backend contract tests, the static semantic-safety suite, backend typecheck,
and a clean Git working state with no commit, tag, or staged change.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_OPTIONAL_LOCKS = "0"

$RepositoryRoot = $PSScriptRoot
$BackendRoot = Join-Path $RepositoryRoot "backend"
$MigrationRoot = Join-Path $BackendRoot "db\migrations"
$PassCount = 0
$FailureCount = 0
$WarningCount = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) {
        $script:PassCount++
        Write-Host "[PASS] $Message" -ForegroundColor Green
    } else {
        $script:FailureCount++
        Write-Host "[FAIL] $Message" -ForegroundColor Red
    }
}

function Write-VerifierWarning([string]$Message) {
    $script:WarningCount++
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Invoke-Gate([string]$Name, [string]$WorkingDirectory, [scriptblock]$Command) {
    Write-Host "[INFO] $Name" -ForegroundColor Cyan
    Push-Location $WorkingDirectory
    try {
        & $Command
        Assert-True ($LASTEXITCODE -eq 0) $Name
    } catch {
        Assert-True $false "$Name ($($_.Exception.Message))"
    } finally {
        Pop-Location
    }
}

Write-Host "SourceRoot Shared Grammar and Root Integration Contracts v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"
Write-Host ""

# ---------------------------------------------------------------------------
# 1. RELEASE IDENTITY (historical facts)
#
# This verifier protects two different things, and they must not be confused:
#
#   A. HISTORICAL RELEASE FACTS - what the 14C release actually was. These are
#      inspected at the released commit/tree and never change, no matter how
#      much legitimate work lands afterwards.
#
#   B. DURABLE SEMANTIC INVARIANTS - what must still hold in the repository
#      today. These are checked against current code.
#
# Before this maintenance the verifier asserted that HEAD was still the
# pre-commit baseline, that no tag existed, and that the static suite was
# untracked. Those were true only during 14C development and became
# permanently false the moment 14C was committed, tagged, and released.
# ---------------------------------------------------------------------------

$ReleaseTag = "sourceroot-shared-grammar-root-integration-contracts-v1"
$ReleaseCommit = "d995e4c3ceff18c8fdd4f696a853494eb4f0daea"
$ReleaseParent = "1363be2b3e5f8ad44674207915cc84c8d2a15026"

$TaggedCommit = (& git -C $RepositoryRoot rev-parse --verify --quiet "$ReleaseTag^{commit}")
if ($TaggedCommit) { $TaggedCommit = $TaggedCommit.Trim() }
Assert-True ($TaggedCommit -eq $ReleaseCommit) "Release tag $ReleaseTag still resolves to the released 14C commit"

$ActualParent = (& git -C $RepositoryRoot rev-parse --verify --quiet "$ReleaseCommit^")
if ($ActualParent) { $ActualParent = $ActualParent.Trim() }
Assert-True ($ActualParent -eq $ReleaseParent) "Released 14C commit still has its exact recorded parent"

& git -C $RepositoryRoot merge-base --is-ancestor $ReleaseCommit HEAD 2>$null | Out-Null
Assert-True ($LASTEXITCODE -eq 0) "Released 14C commit remains in the current branch ancestry"

# Later legitimate SourceRoot commits are expected and must not fail this
# verifier. Only removal of the release from history is a failure.

$Staged = @(& git -C $RepositoryRoot diff --cached --name-only | Where-Object { $_ })
Assert-True ($Staged.Count -eq 0) "No staged change exists"

$IndexLock = Join-Path $RepositoryRoot ".git\index.lock"
Assert-True (-not (Test-Path -LiteralPath $IndexLock)) "Git index.lock is absent"

& git -C $RepositoryRoot diff --check | Out-Null
Assert-True ($LASTEXITCODE -eq 0) "git diff --check reports no whitespace error"

$Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
$CompletedRelative = "docs/stages/completed/20260808-SOURCEROOT-SHARED-GRAMMAR-ROOT-INTEGRATION-CONTRACTS-V1.md"
$CompletedPath = Join-Path $RepositoryRoot ($CompletedRelative -replace "/", "\")
$ActiveRelative = "docs/stages/active/CURRENT-STAGE.md"
Assert-True (Test-Path -LiteralPath $CompletedPath -PathType Leaf) "Completed 14C stage record is present"
Assert-True (-not ($Manifest.active_stage.slug -eq "SOURCEROOT-SHARED-GRAMMAR-ROOT-INTEGRATION-CONTRACTS-V1")) "The 14C stage is no longer the active stage"

# ---------------------------------------------------------------------------
# 2. Exact implementation boundary
# ---------------------------------------------------------------------------

$Allowed = @(
    "ROOT-MANIFEST.json",
    "VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1",
    "backend/src/app.ts",
    "backend/src/routes/sourceroot-contracts.ts",
    "backend/src/sourceroot/addressing.ts",
    "backend/src/sourceroot/contracts.ts",
    "backend/src/sourceroot/identity-assertions.ts",
    "backend/src/sourceroot/object-types.ts",
    "backend/src/sourceroot/query-vocabulary.ts",
    "backend/src/sourceroot/response-envelope.ts",
    "backend/src/sourceroot/root-registry.ts",
    "backend/test/fixtures/sourceroot-jerusalem-contract-fixture.ts",
    "backend/test/sourceroot-shared-grammar.test.ts",
    "docs/architecture/SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS-V1.md",
    "docs/build/SOURCEROOT-SHARED-GRAMMAR-CONTRACT.md",
    $ActiveRelative,
    $CompletedRelative,
    "verification/sourceroot-shared-grammar.test.cjs"
)
Assert-True ($Allowed.Count -eq 18) "Exact 18-file allowed boundary"

# HISTORICAL: the released 14C commit must have stayed inside its governed
# boundary. An allowlist grants permission rather than obliging change, so the
# correct invariant is containment, not equality.
$ReleaseInventory = @(
    & git -C $RepositoryRoot diff --name-only "$ReleaseParent" "$ReleaseCommit" |
        ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ } | Sort-Object -Unique
)
Assert-True ($ReleaseInventory.Count -gt 0) "Released 14C commit has an inspectable inventory"
$ReleaseOutside = @($ReleaseInventory | Where-Object { $Allowed -notcontains $_ })
Assert-True ($ReleaseOutside.Count -eq 0) "Released 14C commit stayed inside its governed boundary"
if ($ReleaseOutside.Count -gt 0) {
    Write-Host "       Outside release boundary: $($ReleaseOutside -join ', ')" -ForegroundColor Red
}

# HISTORICAL: the static semantic-safety suite shipped inside the release even
# though `verification/` is ignored, which required a deliberate force-add.
$ReleasedStaticSuite = @(
    & git -C $RepositoryRoot ls-tree -r --name-only "$ReleaseCommit" -- "verification/sourceroot-shared-grammar.test.cjs" |
        Where-Object { $_ }
)
Assert-True ($ReleasedStaticSuite.Count -eq 1) "Static semantic-safety suite is present in the released 14C tree"

# Scope discovery must be DETERMINISTIC and REPOSITORY-LOCAL.
#
# An independent audit found that a user-global Git excludes file can hide a
# repository file from governed scope verification. Discovery therefore
# neutralizes core.excludesFile by pointing it at a path that cannot exist, so
# only the repository .gitignore and the clone-local .git/info/exclude apply.
# Unrelated global configuration is never read or printed.
$NoGlobalExcludes = Join-Path $RepositoryRoot ".git\info\sourceroot-no-global-excludes"
$RepositoryLocalGit = @("-C", $RepositoryRoot, "-c", "core.excludesFile=$NoGlobalExcludes")
Assert-True (-not (Test-Path -LiteralPath $NoGlobalExcludes)) "Global-exclude neutralization path does not exist"

# DURABLE: the released 14C contract surface must be byte-identical to what
# shipped. A stage-time "only allowlisted files changed" check cannot survive
# later releases, but "the contracts themselves never drifted" must hold
# forever, so that is what is enforced here.
$ContractSurface = @(
    "backend/src/sourceroot/addressing.ts",
    "backend/src/sourceroot/contracts.ts",
    "backend/src/sourceroot/identity-assertions.ts",
    "backend/src/sourceroot/object-types.ts",
    "backend/src/sourceroot/query-vocabulary.ts",
    "backend/src/sourceroot/response-envelope.ts",
    "backend/src/sourceroot/root-registry.ts",
    "backend/src/routes/sourceroot-contracts.ts",
    "verification/sourceroot-shared-grammar.test.cjs",
    "backend/test/sourceroot-shared-grammar.test.ts",
    "backend/test/fixtures/sourceroot-jerusalem-contract-fixture.ts"
)
$ContractDrift = @()
foreach ($Relative in $ContractSurface) {
    $ReleasedBlob = (& git -C $RepositoryRoot rev-parse --verify --quiet "${ReleaseCommit}:$Relative")
    $CurrentBlob = (& git -C $RepositoryRoot hash-object --no-filters -- $Relative 2>$null)
    if ($ReleasedBlob) { $ReleasedBlob = $ReleasedBlob.Trim() }
    if ($CurrentBlob) { $CurrentBlob = $CurrentBlob.Trim() }
    if (-not $ReleasedBlob -or -not $CurrentBlob -or $ReleasedBlob -ne $CurrentBlob) {
        $ContractDrift += $Relative
    }
}
Assert-True ($ContractDrift.Count -eq 0) "Released 14C contract surface is byte-identical to the release"
if ($ContractDrift.Count -gt 0) {
    Write-Host "       Contract drift: $($ContractDrift -join ', ')" -ForegroundColor Red
}

# Nothing may be visible to repository-local discovery yet hidden from the
# ambient view, because that difference is exactly where a governed file could
# disappear. Anything intentionally local must be declared in the repository
# .gitignore or in the clone-local .git/info/exclude, both inspectable.
$RepositoryLocalUntracked = @(
    & git @RepositoryLocalGit ls-files --others --exclude-standard
) | ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ } | Sort-Object -Unique
$AmbientUntracked = @(
    & git -C $RepositoryRoot ls-files --others --exclude-standard
) | ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ } | Sort-Object -Unique
$HiddenByGlobalOnly = @($RepositoryLocalUntracked | Where-Object { $AmbientUntracked -notcontains $_ })
Assert-True ($HiddenByGlobalOnly.Count -eq 0) "No repository file is hidden from governed scope by a user-global Git exclude"
if ($HiddenByGlobalOnly.Count -gt 0) {
    Write-Host "       Hidden only by global excludes: $($HiddenByGlobalOnly -join ', ')" -ForegroundColor Red
}

# The clone-local Claude configuration must stay untracked and outside the
# governed allowlist, and must be excluded by repository-local metadata rather
# than by an ambient user-global rule.
$ClaudeLocalSettings = ".claude/settings.local.json"
Assert-True ($Allowed -notcontains $ClaudeLocalSettings) "Clone-local Claude configuration is not in the governed allowlist"
$ClaudeTracked = @(& git @RepositoryLocalGit ls-files -- $ClaudeLocalSettings | Where-Object { $_ })
Assert-True ($ClaudeTracked.Count -eq 0) "Clone-local Claude configuration is not tracked"
if (Test-Path -LiteralPath (Join-Path $RepositoryRoot ($ClaudeLocalSettings -replace "/", "\")) -PathType Leaf) {
    & git @RepositoryLocalGit check-ignore -q -- $ClaudeLocalSettings | Out-Null
    Assert-True ($LASTEXITCODE -eq 0) "Clone-local Claude configuration is excluded by repository-local Git metadata"
}

# The active-stage document belongs to whatever stage is running now, so it is
# excluded from the released-artifact presence check.
$Missing = @($Allowed | Where-Object {
    $_ -ne $ActiveRelative -and
    -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ($_ -replace "/", "\")) -PathType Leaf)
})
Assert-True ($Missing.Count -eq 0) "All released 14C artifacts exist"
if ($Missing.Count -gt 0) {
    Write-Host "       Missing: $($Missing -join ', ')" -ForegroundColor Red
}

Assert-True (@($Manifest.known_verifiers) -contains "VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1") "Focused verifier is registered in the manifest"

# The static semantic-safety suite sits under the ignored `verification/`
# directory, so it required a deliberate force-add to enter the release. Before
# the release it had to be ignored-and-untracked; now it must be TRACKED, or it
# has been lost from the repository. The durable invariant is that a governed
# stage artifact cannot silently vanish, and after release that means tracked.
$StaticSuiteRelative = "verification/sourceroot-shared-grammar.test.cjs"
$StaticSuitePath = Join-Path $RepositoryRoot ($StaticSuiteRelative -replace "/", "\")
# The message wording below is pinned by the released static semantic-safety
# suite, which is byte-frozen. The ASSERTION SEMANTICS are what this
# maintenance corrects; the wording stays so a released artifact need not be
# reopened.
Assert-True (Test-Path -LiteralPath $StaticSuitePath -PathType Leaf) "Intended ignored stage artifact exists on disk"
Assert-True ($Allowed -contains $StaticSuiteRelative) "Intended ignored stage artifact is inside the governed allowlist"
$StaticSuiteTracked = @(& git @RepositoryLocalGit ls-files -- $StaticSuiteRelative | Where-Object { $_ })
Assert-True ($StaticSuiteTracked.Count -eq 1) "Static semantic-safety suite is tracked, having been force-added into the release"

# ---------------------------------------------------------------------------
# 3. Migration policy
# ---------------------------------------------------------------------------

$Migration018 = Join-Path $MigrationRoot "018_create_cross_root_link_foundation.sql"
Assert-True ((Get-Item -LiteralPath $Migration018).Length -eq 5116) "Migration 018 exact byte length is preserved"
Assert-True ((Get-FileHash -Algorithm SHA256 -LiteralPath $Migration018).Hash -eq "32760D802354738A6A5B051756BAE59849A05353966FF8752E93EBCC16183A75") "Migration 018 exact SHA-256 is preserved"

$Migration019 = Join-Path $MigrationRoot "019_create_cross_root_source_backed_relationships.sql"
Assert-True ((Get-FileHash -Algorithm SHA256 -LiteralPath $Migration019).Hash -eq "10BBD3D8BF187BC12AD1CC59F738578950AEB7066A65A4DB411B54E855E573F2") "Migration 019 exact SHA-256 is preserved"

$Migrations = @(Get-ChildItem -LiteralPath $MigrationRoot -File -Filter "*.sql")
Assert-True ($Migrations.Count -eq 20) "Migration count is unchanged at 20"
Assert-True (@($Migrations | Where-Object { $_.Name -like "020*" }).Count -eq 0) "Migration 020 is absent"

$Migration019Text = Get-Content -Raw -LiteralPath $Migration019
Assert-True ($Migration019Text -match "predicate TEXT NOT NULL,") "Migration 019 predicate column remains unconstrained TEXT"
Assert-True ($Migration019Text -match "ck_cross_root_relationship_identity_self_guard") "Migration 019 identity self-guard is unchanged and is not predicate governance"

# ---------------------------------------------------------------------------
# 4. Released baselines
# ---------------------------------------------------------------------------

$ChunkA = (Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "data\cross-root-link-foundation-v1\dataset-manifest.json") | ConvertFrom-Json).expectedCounts
Assert-True ($ChunkA.resources -eq 1568) "Chunk 14A resources remain 1568"
Assert-True ($ChunkA.links -eq 2233) "Chunk 14A links remain 2233"
Assert-True ($ChunkA.evidence -eq 2765) "Chunk 14A evidence remains 2765"
Assert-True ($ChunkA.dictionaryToHistoryLinks -eq 1431) "Chunk 14A Dictionary to History links remain 1431"
Assert-True ($ChunkA.dictionaryToBibleLinks -eq 802) "Chunk 14A Dictionary to Bible links remain 802"
Assert-True ($ChunkA.historyOccurrences -eq 1790) "Chunk 14A History occurrences remain 1790"
Assert-True ($ChunkA.bibleOccurrences -eq 975) "Chunk 14A Bible occurrences remain 975"

$ChunkB = (Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "data\cross-root-source-backed-relationships-v1\dataset-manifest.json") | ConvertFrom-Json).expectedCounts
Assert-True ($ChunkB.assertions -eq 143) "Chunk 14B assertions remain 143"
Assert-True ($ChunkB.evidence -eq 178) "Chunk 14B evidence remains 178"
Assert-True ($ChunkB.subjectResources -eq 101) "Chunk 14B subjects remain 101"
Assert-True ($ChunkB.objectResources -eq 76) "Chunk 14B objects remain 76"
Assert-True ($ChunkB.causal -eq 22) "Chunk 14B causal assertions remain 22"
Assert-True ($ChunkB.nonCausal -eq 121) "Chunk 14B non-causal assertions remain 121"
Assert-True ($ChunkB.sameRoot -eq 143) "Chunk 14B same-Root assertions remain 143"
Assert-True ($ChunkB.crossRoot -eq 0) "Chunk 14B cross-Root assertions remain 0"
Assert-True ($ChunkB.disputed -eq 0) "Chunk 14B disputed assertions remain 0"
Assert-True ($ChunkB.uncertain -eq 143) "Chunk 14B uncertain assertions remain 143"
Assert-True ($ChunkB.resourceReuse -eq 280) "Chunk 14B resource reuse remains 280"
Assert-True ($ChunkB.resourceAdditions -eq 0) "Chunk 14B resource additions remain 0"
Assert-True ($ChunkB.derivationCounts.directly_sourced -eq 143) "Chunk 14B directly sourced assertions remain 143"
Assert-True ($ChunkB.reviewStateCounts.unreviewed -eq 143) "Chunk 14B unreviewed assertions remain 143"

# ---------------------------------------------------------------------------
# 5. Readiness and contract-only boundary
# ---------------------------------------------------------------------------

$Readiness = Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "src\services\development-runtime-readiness.ts")
Assert-True ($Readiness -match 'contractVersion:\s*"1\.4\.0"') "Development runtime readiness remains 1.4.0"
Assert-True (-not ($Readiness -match "sourceroot/contracts")) "Readiness service is untouched by this stage"

$AppText = Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "src\app.ts")
Assert-True ($AppText -match 'app\.use\("/api/v1/sourceroot", sourceRootContractsRouter\)') "Contract discovery router is mounted"

$RouterText = Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "src\routes\sourceroot-contracts.ts")
Assert-True (-not ($RouterText -match "\.(post|put|patch|delete)\(")) "Contract discovery surface exposes no mutation route"
Assert-True (-not ($RouterText -match "getPool|cross-root-store|development-runtime-readiness")) "Contract discovery surface reads no database or Root store"

$ContractModules = @(
    "addressing.ts", "object-types.ts", "root-registry.ts", "identity-assertions.ts",
    "query-vocabulary.ts", "response-envelope.ts", "contracts.ts"
)
$ModuleRoot = Join-Path $BackendRoot "src\sourceroot"
$MissingModules = @($ContractModules | Where-Object { -not (Test-Path -LiteralPath (Join-Path $ModuleRoot $_) -PathType Leaf) })
Assert-True ($MissingModules.Count -eq 0) "All seven SourceRoot contract modules exist"
$ExtraModules = @(Get-ChildItem -LiteralPath $ModuleRoot -File -Filter "*.ts" | Where-Object { $ContractModules -notcontains $_.Name })
Assert-True ($ExtraModules.Count -eq 0) "No undeclared module exists inside the SourceRoot contract boundary"

Assert-True (-not (Test-Path -LiteralPath (Join-Path $ModuleRoot "jerusalem-contract-fixture.ts"))) "The Jerusalem fixture is not present in production source"

# ---------------------------------------------------------------------------
# 6. PowerShell and test execution
# ---------------------------------------------------------------------------

$ParseErrors = $null
$Tokens = $null
$null = [Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $RepositoryRoot "VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1"),
    [ref]$Tokens,
    [ref]$ParseErrors
)
Assert-True (@($ParseErrors).Count -eq 0) "This verifier parses under Windows PowerShell"

$Node = Get-Command node -ErrorAction SilentlyContinue
$NodeModules = Join-Path $BackendRoot "node_modules"

if ($null -eq $Node) {
    Write-VerifierWarning "Node.js is unavailable; contract test execution is not claimed."
} elseif (-not (Test-Path -LiteralPath $NodeModules -PathType Container)) {
    Write-VerifierWarning "backend/node_modules is absent; run 'npm ci' in backend to execute the contract tests. No test PASS is claimed."
} else {
    Invoke-Gate "Backend typecheck" $BackendRoot {
        & npm.cmd run --silent typecheck
    }
    Invoke-Gate "Focused SourceRoot shared-grammar contract tests" $BackendRoot {
        & node --import ./scripts/register-tsx.mjs --test --test-concurrency=1 test/sourceroot-shared-grammar.test.ts
    }
    Invoke-Gate "Static semantic-safety verification" $RepositoryRoot {
        & node --test verification/sourceroot-shared-grammar.test.cjs
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "Verifier summary" -ForegroundColor Cyan
Write-Host "Pass count:    $PassCount"
Write-Host "Warning count: $WarningCount"
Write-Host "Failure count: $FailureCount"
if ($FailureCount -eq 0) {
    Write-Host "Overall result: PASS" -ForegroundColor Green
    exit 0
}
Write-Host "Overall result: FAIL" -ForegroundColor Red
exit 1
