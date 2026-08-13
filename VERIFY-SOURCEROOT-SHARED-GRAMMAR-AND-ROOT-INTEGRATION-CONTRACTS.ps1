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

# ---------------------------------------------------------------------------
# LEGACY STAGE-IDENTITY PARSER - REMOVED
#
# A Markdown-aware scanner used to live here, duplicated verbatim in three
# verifiers, to read stage identity out of a governed record. The fourth Codex
# audit proved that parser-based authorization is the wrong boundary: a record
# inside the candidate cannot establish what the candidate is allowed to be.
# The block was retained for a while marked NON-AUTHORITATIVE and UNUSED, which
# left three copies of legacy authority logic sitting in the tree looking
# authoritative to anyone who did not read the header.
#
# It is gone. Authority is read from the external signed control store by
# srgds-core, and this verifier delegates to it rather than parsing anything.
# See the GDS v1.1 TRUST CORE DELEGATION section below.
# ---------------------------------------------------------------------------

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
# GDS v1.1 TRUST CORE DELEGATION
#
# Trust-critical questions - is there a valid signed authorization, and is the
# candidate inside it - are ANSWERED BY srgds-core, not by this verifier. A
# verifier that re-derived them would be a second implementation of the rules,
# and two implementations of one rule eventually disagree, at which point the
# more permissive one is the one that matters.
#
# This section therefore contains no digesting, no path grammar, no signature
# handling and no candidate derivation. It asks, and it reports.
#
# Execution context comes from OUTSIDE the repository. When it is absent the
# section is skipped explicitly and says so: a skipped check is never counted
# as a passing one.
# ---------------------------------------------------------------------------
$GdsModule = Join-Path $PSScriptRoot "tools\SourceRoot.Governance.psm1"
$GdsContext = @{
    Stage       = $env:SRGDS_STAGE
    Id          = $env:SRGDS_AUTHORIZATION_ID
    Digest      = $env:SRGDS_AUTHORIZATION_DIGEST
    Fingerprint = $env:SRGDS_SIGNER_FINGERPRINT
    Principal   = $env:SRGDS_SIGNER_PRINCIPAL
}
$GdsContextComplete = -not (@($GdsContext.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) })
# Results are published for the governance sections BELOW, which must attribute
# pending work to the SIGNED authorization rather than to a path list pinned
# inside this file. A pinned list is a release-state fact; a signed
# authorization is authority.
$script:GdsAuthorityValid = $false
$script:GdsCandidateAuthorized = $false
$script:GdsCandidatePaths = @()

if (-not (Test-Path -LiteralPath $GdsModule -PathType Leaf)) {
    Assert-True $false "GDS orchestration module is present"
} elseif (-not $GdsContextComplete) {
    Write-Host "[SKIP] GDS trust core delegation: execution context not supplied (SRGDS_*)" -ForegroundColor Yellow
    Write-Host "       This is a SKIP, not a PASS. Authority was not checked in this run."
} else {
    Import-Module $GdsModule -Force

    $GdsCoreVersion = ""
    try { $GdsCoreVersion = Get-SrgdsCoreVersion } catch { $GdsCoreVersion = "" }
    Assert-True ($GdsCoreVersion -like "srgds-core/*") "GDS trust core is present and answers ($GdsCoreVersion)"

    if ($GdsCoreVersion -like "srgds-core/*") {
        $GdsAuth = Get-GdsStageAuthorization -RepositoryRoot $PSScriptRoot -StageSlug $GdsContext.Stage `
            -ExpectedAuthorizationId $GdsContext.Id -ExpectedAuthorizationDigest $GdsContext.Digest `
            -ExpectedSignerFingerprint $GdsContext.Fingerprint -SignerPrincipal $GdsContext.Principal
        Assert-True $GdsAuth.Valid "Signed stage authorization verifies through the trust core"
        $script:GdsAuthorityValid = $GdsAuth.Valid
        Assert-True ($GdsAuth.AuthorizationId -ceq $GdsContext.Id) `
            "The authorization the core returned is the issuance execution context selected"
        Assert-True ($GdsAuth.Digest -ceq $GdsContext.Digest.ToUpperInvariant()) `
            "The authorization bytes are the exact bytes execution context named"

        if ($GdsAuth.Valid) {
            $GdsCandidate = Get-GdsCandidateManifest -RepositoryRoot $PSScriptRoot -StageSlug $GdsContext.Stage `
                -ExpectedAuthorizationId $GdsContext.Id -ExpectedAuthorizationDigest $GdsContext.Digest `
                -ExpectedSignerFingerprint $GdsContext.Fingerprint -SignerPrincipal $GdsContext.Principal
            $script:GdsCandidateAuthorized = $GdsCandidate.Authorized
            if ($null -ne $GdsCandidate.Manifest) {
                $script:GdsCandidatePaths = @($GdsCandidate.Manifest.entries | ForEach-Object { [string]$_.path })
            }
            Assert-True $GdsCandidate.Authorized `
                "Every candidate path is inside the signed authority ($($GdsCandidate.Reason))"
            Assert-True ($GdsCandidate.CandidateDigest -match '^[0-9A-F]{64}$') `
                "The candidate has a determinate identity ($($GdsCandidate.CandidateDigest))"

            # Determinism, measured rather than asserted: the same tree must
            # yield the same identity when asked twice.
            $GdsRepeat = Get-GdsCandidateManifest -RepositoryRoot $PSScriptRoot -StageSlug $GdsContext.Stage `
                -ExpectedAuthorizationId $GdsContext.Id -ExpectedAuthorizationDigest $GdsContext.Digest `
                -ExpectedSignerFingerprint $GdsContext.Fingerprint -SignerPrincipal $GdsContext.Principal
            Assert-True ($GdsRepeat.CandidateDigest -ceq $GdsCandidate.CandidateDigest) `
                "Candidate identity is deterministic across repeated derivation"
        }

        # A green result here is EVIDENCE, never approval. Release requires a
        # separate signed release authorization over one exact PASS audit.
        Assert-True (-not (Test-GdsLifecycleTransition -From "AUDIT_PASSED" -To "RELEASED").Allowed) `
            "A passing audit cannot reach RELEASED without a release authorization"
    }
}


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

# The released 14C contract surface splits into TWO governed classes, and
# conflating them was the descendant-awareness defect this maintenance repairs.
#
#   FROZEN. Modules no governed descendant is authorized to edit. Byte-identity
#     is the correct durable invariant and stays enforced forever.
#
#   GOVERNED-EXTENSIBLE. `object-types.ts` is the DECLARED EXTENSION POINT of
#     the shared grammar: the released architecture explicitly permits later
#     governed stages to ADD object types and persistence-to-network mappings
#     there, and the two 14C verification suites must be able to learn about
#     those additions. Byte-freezing them contradicted an authorization the same
#     release granted, so a legitimate descendant failed by construction.
#     Their durable guarantee is SEMANTIC compatibility - historical mappings
#     preserved with their released meaning, reverse mapping unambiguous, proved
#     by the focused contract suite - plus GOVERNED AUTHORIZATION here: drift is
#     admissible only while a stage whose own allowlist names the file is
#     active. An ungoverned edit still fails, so nothing is silently weakened.
$ContractSurfaceFrozen = @(
    "backend/src/sourceroot/addressing.ts",
    "backend/src/sourceroot/contracts.ts",
    "backend/src/sourceroot/identity-assertions.ts",
    "backend/src/sourceroot/query-vocabulary.ts",
    "backend/src/sourceroot/response-envelope.ts",
    "backend/src/sourceroot/root-registry.ts",
    "backend/src/routes/sourceroot-contracts.ts",
    "backend/test/fixtures/sourceroot-jerusalem-contract-fixture.ts"
)
$ContractSurfaceGoverned = @(
    "backend/src/sourceroot/object-types.ts",
    "backend/test/sourceroot-shared-grammar.test.ts",
    "verification/sourceroot-shared-grammar.test.cjs"
)
# The union must still be the complete released surface, so a file can never be
# quietly dropped from protection by being listed in neither class.
$ContractSurface = @($ContractSurfaceFrozen + $ContractSurfaceGoverned)
Assert-True ($ContractSurface.Count -eq 11) "The released 14C contract surface is still accounted for in full (11 files)"
Assert-True (@($ContractSurfaceFrozen | Where-Object { $ContractSurfaceGoverned -contains $_ }).Count -eq 0) "No contract file is classified both frozen and extensible"

# HISTORICAL: every file of the surface existed with its canonical bytes in the
# pinned release tree. A failed or empty Git lookup is a FAILURE, never a
# vacuous pass, so a broken historical probe cannot be read as success.
$ReleasedSurfaceBlobs = @{}
$SurfaceUnreadable = @()
foreach ($Relative in $ContractSurface) {
    $ReleasedBlob = (& git -C $RepositoryRoot rev-parse --verify --quiet "${ReleaseCommit}:$Relative")
    if ($ReleasedBlob) { $ReleasedBlob = $ReleasedBlob.Trim() }
    if (-not $ReleasedBlob) { $SurfaceUnreadable += $Relative } else { $ReleasedSurfaceBlobs[$Relative] = $ReleasedBlob }
}
Assert-True ($SurfaceUnreadable.Count -eq 0) "Released 14C contract surface has its canonical bytes in the pinned release tree (historical release fact)"
if ($SurfaceUnreadable.Count -gt 0) {
    Write-Host "       Not readable at the release commit: $($SurfaceUnreadable -join ', ')" -ForegroundColor Red
}

# DURABLE: frozen modules never drift.
$ContractDrift = @()
foreach ($Relative in $ContractSurfaceFrozen) {
    $CurrentBlob = (& git -C $RepositoryRoot hash-object --no-filters -- $Relative 2>$null)
    if ($CurrentBlob) { $CurrentBlob = $CurrentBlob.Trim() }
    if (-not $ReleasedSurfaceBlobs.ContainsKey($Relative) -or -not $CurrentBlob -or $ReleasedSurfaceBlobs[$Relative] -ne $CurrentBlob) {
        $ContractDrift += $Relative
    }
}
Assert-True ($ContractDrift.Count -eq 0) "Frozen 14C contract modules are byte-identical to the release"
if ($ContractDrift.Count -gt 0) {
    Write-Host "       Contract drift: $($ContractDrift -join ', ')" -ForegroundColor Red
}

# DURABLE: an extensible file may differ from the release ONLY under an active
# governed stage that names it. Unchanged is always acceptable; changed without
# authorization is not.
#
# ANCHORED AUTHORIZATION. A completed stage record is a MUTABLE, UNTRACKED
# markdown file. An independent Tier 3 audit demonstrated that trusting one
# merely because it exists and names a path is forgeable: anyone can drop a file
# into docs/stages/completed with an "Allowed files" section and authorize
# arbitrary drift of a governed 14C surface. An earlier revision of this gate
# unioned every completed record's allowlist and was exactly that unsafe.
#
# Authorization therefore comes from TWO sources only:
#
#   1. An ACTIVE stage whose manifest allowlist names the path. The manifest is
#      itself governed and the Root verifier checks it.
#
#   2. The ANCHORED completed-stage window below, which exists so that a stage
#      that has completed but must stay uncommitted pending independent audit is
#      not treated as ungoverned. The window is deliberately narrow and is NOT a
#      general control plane.
#
# The window's authority does NOT come from the record. It comes from constants
# pinned HERE, in a file that is itself inside the externally authorized
# candidate and under independent audit. The exact record path must exist, but
# its mutable Markdown content is documentation/evidence only and cannot open,
# close, widen, narrow, or redirect authority.
$AnchoredBaseline = "d55a45b9ed4e9065c186bf48a5a17ec3b5b71eb6"
$AnchoredDescendantSlug = "SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY-V1"
# The external Principal Architect exact allowlist. Twenty paths, no more.
$AnchoredDescendantPaths = @(
    "ROOT-MANIFEST.json",
    "VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1",
    "VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1",
    "VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1",
    "VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1",
    "backend/db/migrations/020_create_earthroot_place_polity_foundation.sql",
    "backend/src/earthroot/adapter.ts",
    "backend/src/earthroot/contract.ts",
    "backend/src/earthroot/domain.ts",
    "backend/src/earthroot/payload.ts",
    "backend/src/earthroot/store.ts",
    "backend/src/sourceroot/object-types.ts",
    "backend/test/earthroot-adapter.test.ts",
    "backend/test/earthroot-provenance.test.ts",
    "backend/test/earthroot-semantics.test.ts",
    "backend/test/sourceroot-shared-grammar.test.ts",
    "docs/architecture/SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY-V1.md",
    "docs/stages/active/CURRENT-STAGE.md",
    "docs/stages/completed/20260810-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY-V1.md",
    "verification/sourceroot-shared-grammar.test.cjs"
)

$ActiveAllowed = @()
if ($Manifest.active_stage -and $Manifest.active_stage.allowed_files) {
    $ActiveAllowed = @($Manifest.active_stage.allowed_files | ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ })
}

# The anchored window opens only when EVERY condition holds.
$AnchoredWindowOpen = $false
$AnchoredWindowReason = "closed"
$HeadCommit = (& git -C $RepositoryRoot rev-parse HEAD 2>$null)
if ($HeadCommit) { $HeadCommit = $HeadCommit.Trim() }
$CompletedStageRoot = Join-Path $RepositoryRoot "docs\stages\completed"
if ($HeadCommit -ne $AnchoredBaseline) {
    # Once the candidate commits, the window closes permanently and ordinary
    # rules resume. A stale anchor can never keep authorizing drift.
    $AnchoredWindowReason = "HEAD has moved off the anchored baseline"
} else {
    # Historical records are TRACKED. The record of a stage that completed but
    # has not been committed is UNTRACKED. Only the latter can open the window,
    # and there must be exactly one, so an old committed record can never
    # authorize present drift.
    $UntrackedCompleted = @(
        & git -C $RepositoryRoot ls-files --others --exclude-standard -- "docs/stages/completed" |
            ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ -like "*.md" }
    )
    if ($UntrackedCompleted.Count -ne 1) {
        $AnchoredWindowReason = "expected exactly one uncommitted completed record, found $($UntrackedCompleted.Count)"
    } else {
        $CandidateRecord = $UntrackedCompleted[0]
        $ExpectedRecord = "docs/stages/completed/20260810-$AnchoredDescendantSlug.md"
        if ($CandidateRecord -ne $ExpectedRecord) {
            $AnchoredWindowReason = "uncommitted completed record is not the anchored one: $CandidateRecord"
        } elseif (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ($CandidateRecord -replace "/", "\")) -PathType Leaf)) {
            $AnchoredWindowReason = "anchored record path is not readable"
        } else {
            $AnchoredWindowOpen = $true
            $AnchoredWindowReason = "open for pinned stage $AnchoredDescendantSlug; record content is non-authoritative"
        }
    }
}
# Paths come from the ANCHOR, never from the record.
if ($AnchoredWindowOpen) { $ActiveAllowed += $AnchoredDescendantPaths }
$ActiveAllowed = @($ActiveAllowed | Sort-Object -Unique)
$UngovernedDrift = @()
foreach ($Relative in $ContractSurfaceGoverned) {
    $CurrentBlob = (& git -C $RepositoryRoot hash-object --no-filters -- $Relative 2>$null)
    if ($CurrentBlob) { $CurrentBlob = $CurrentBlob.Trim() }
    if (-not $CurrentBlob) { $UngovernedDrift += "$Relative (missing)"; continue }
    if (-not $ReleasedSurfaceBlobs.ContainsKey($Relative)) { $UngovernedDrift += "$Relative (no released blob)"; continue }
    if ($ReleasedSurfaceBlobs[$Relative] -eq $CurrentBlob) { continue }
    # GDS v1.1 SUPERSESSION.
    #
    # Drift from the released blob has two entirely different meanings, and the
    # anchored rule conflated them:
    #
    #   COMMITTED drift   an earlier governed stage changed this file and the
    #                     change is in history. That is a HISTORICAL RELEASE
    #                     FACT. The released surface is verified against the
    #                     PINNED RELEASE TREE elsewhere in this file, where it
    #                     stays true forever. Requiring a window pinned in this
    #                     file to keep vouching for it is what makes a released
    #                     fact decay into a permanent invariant that fails as
    #                     soon as HEAD moves.
    #
    #   UNCOMMITTED drift someone is changing an extensible contract file RIGHT
    #                     NOW. That is a DURABLE INVARIANT question, and it is
    #                     answered by the signed authorization through the core.
    #
    # Only the second is this candidate's to answer.
    if ($script:GdsAuthorityValid -and $script:GdsCandidateAuthorized) {
        $PendingDrift = @(& git @RepositoryLocalGit status --porcelain --untracked-files=all -- $Relative |
            Where-Object { $_ })
        if ($PendingDrift.Count -gt 0 -and $script:GdsCandidatePaths -notcontains $Relative) {
            $UngovernedDrift += "$Relative (uncommitted, outside the signed candidate)"
        }
    } elseif ($ActiveAllowed -notcontains $Relative) { $UngovernedDrift += $Relative }
}
Assert-True ($UngovernedDrift.Count -eq 0) "Extensible 14C contract files changed only under anchored governed authorization"
if ($UngovernedDrift.Count -gt 0) {
    Write-Host "       Ungoverned drift: $($UngovernedDrift -join ', ')" -ForegroundColor Red
    Write-Host "       Anchored completed-stage window: $AnchoredWindowReason" -ForegroundColor Red
}

# HISTORICAL: the released persistence-to-network mapping count, read from the
# pinned blob rather than constrained on today's file.
$ReleasedObjectTypesText = ((& git -C $RepositoryRoot show "${ReleaseCommit}:backend/src/sourceroot/object-types.ts" 2>$null) -join "`n")
Assert-True ($ReleasedObjectTypesText.Length -gt 0) "Released 14C object-types.ts is readable at the pinned release commit"
$ReleasedMappingCount = ([regex]::Matches($ReleasedObjectTypesText, 'persistenceResourceType:\s*"')).Count
Assert-True ($ReleasedMappingCount -eq 3) "Released object-type mapping count was 3 at the 14C release (historical release fact)"

# DURABLE: the mapping set may GROW under a governed stage but never shrinks,
# and every mapping released at 14C survives by name.
$CurrentObjectTypesText = Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "src\sourceroot\object-types.ts")
$CurrentMappingCount = ([regex]::Matches($CurrentObjectTypesText, 'persistenceResourceType:\s*"')).Count
Assert-True ($CurrentMappingCount -ge $ReleasedMappingCount) "The persistence-to-network mapping set never shrinks below the released 3 (found $CurrentMappingCount)"
foreach ($ReleasedMapping in @("lemma", "accepted-contextual-record", "edition-verse-text")) {
    Assert-True ($CurrentObjectTypesText -match [regex]::Escape("persistenceResourceType: `"$ReleasedMapping`"")) "Historical 14C mapping survives by name: $ReleasedMapping"
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

# HISTORICAL: at the 14C release the chain was exactly 20 migrations and 020
# did not exist. Both are facts about the RELEASE TREE and are inspected there,
# so they stay true forever however many governed migrations land afterwards.
# Asserting them against the WORKING TREE was the descendant-awareness defect:
# it made every authorized future migration fail by construction, which is a
# defect in this verifier and not in the descendant stage.
$ReleasedMigrationPaths = @(
    & git -C $RepositoryRoot ls-tree -r --name-only "$ReleaseCommit" -- "backend/db/migrations" |
        ForEach-Object { ([string]$_).Trim().Replace("\", "/") } |
        Where-Object { $_ -like "*.sql" } | Sort-Object -Unique
)
# A failed or empty Git lookup FAILS CLOSED rather than passing vacuously.
#
# It must also fail LEGIBLY. A bounded control that made this lookup return
# nothing crashed the run with IndexOutOfRange on the high-water-mark
# computation below, under Set-StrictMode with $ErrorActionPreference "Stop".
# The run stopped non-zero, so nothing passed vacuously, but every later
# assertion was skipped and the operator saw a stack trace instead of a named
# failing gate. The historical set is therefore proven inspectable FIRST, and
# every check that depends on it is skipped explicitly with its own recorded
# failure rather than being allowed to throw.
$ReleasedMigrationsReadable = ($ReleasedMigrationPaths.Count -gt 0)
Assert-True $ReleasedMigrationsReadable "Released 14C migration set is inspectable at the pinned release commit"
Assert-True ($ReleasedMigrationPaths.Count -eq 20) "Migration count was 20 at the 14C release (historical release fact)"
# Guarded, because "no 020 in an EMPTY set" is vacuously true. An unreadable
# pinned tree must never be able to satisfy a historical absence claim.
if (-not $ReleasedMigrationsReadable) {
    Assert-True $false "Migration 020's absence at the 14C release is unverifiable because the pinned release set could not be read"
} else {
    Assert-True (@($ReleasedMigrationPaths | Where-Object { (Split-Path $_ -Leaf) -like "020*" }).Count -eq 0) "Migration 020 was absent at the 14C release (historical release fact)"
}

# DURABLE: every migration released at 14C still exists today with its released
# bytes. The chain may GROW under a governed stage; it may never shrink, and a
# released migration may never be rewritten or removed. This is what actually
# protects released schema, and it survives legitimate descendants.
$ReleasedMigrationDrift = @()
foreach ($Relative in $ReleasedMigrationPaths) {
    $ReleasedBlob = (& git -C $RepositoryRoot rev-parse --verify --quiet "${ReleaseCommit}:$Relative")
    $CurrentBlob = (& git -C $RepositoryRoot hash-object --no-filters -- $Relative 2>$null)
    if ($ReleasedBlob) { $ReleasedBlob = $ReleasedBlob.Trim() }
    if ($CurrentBlob) { $CurrentBlob = $CurrentBlob.Trim() }
    if (-not $ReleasedBlob -or -not $CurrentBlob -or $ReleasedBlob -ne $CurrentBlob) {
        $ReleasedMigrationDrift += $Relative
    }
}
# Also guarded: an empty released set makes the loop above iterate zero times,
# so "no drift" would be true because nothing was compared, not because nothing
# changed. Preservation must be proved against a set that was actually read.
if (-not $ReleasedMigrationsReadable) {
    Assert-True $false "Released migration preservation is unverifiable because the pinned release set could not be read"
} else {
    Assert-True ($ReleasedMigrationDrift.Count -eq 0) "Every migration released at 14C is still present and byte-identical"
    if ($ReleasedMigrationDrift.Count -gt 0) {
        Write-Host "       Released migration drift: $($ReleasedMigrationDrift -join ', ')" -ForegroundColor Red
    }
}

$Migrations = @(Get-ChildItem -LiteralPath $MigrationRoot -File -Filter "*.sql")
Assert-True ($Migrations.Count -ge $ReleasedMigrationPaths.Count) "Migration chain never shrinks below the 20 released at 14C (found $($Migrations.Count))"

# A descendant may only APPEND. An addition that sorts at or below the released
# high-water mark would be a renumbering of released history wearing a new name,
# which is how a rewritten old migration could otherwise hide behind a new one.
if (-not $ReleasedMigrationsReadable) {
    Assert-True $false "Append-only migration ordering is unverifiable because the pinned release set could not be read"
} else {
    $ReleasedMigrationNames = @($ReleasedMigrationPaths | ForEach-Object { Split-Path $_ -Leaf })
    $HighestReleasedMigration = @($ReleasedMigrationNames | Sort-Object)[-1]
    $AddedMigrationNames = @($Migrations | ForEach-Object { $_.Name } | Where-Object { $ReleasedMigrationNames -notcontains $_ })
    $MisorderedAdditions = @($AddedMigrationNames | Where-Object { [string]::Compare($_, $HighestReleasedMigration, [System.StringComparison]::Ordinal) -le 0 })
    Assert-True ($MisorderedAdditions.Count -eq 0) "Every migration added since the 14C release sorts after the released chain, so released history cannot be renumbered"
    if ($MisorderedAdditions.Count -gt 0) {
        Write-Host "       Misordered additions: $($MisorderedAdditions -join ', ')" -ForegroundColor Red
    }
}

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
