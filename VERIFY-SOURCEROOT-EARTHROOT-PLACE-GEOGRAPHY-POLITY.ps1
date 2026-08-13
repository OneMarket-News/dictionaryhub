<#
.SYNOPSIS
Focused verifier for SourceRoot EarthRoot Place / Geography / Polity v1 (15A).

.PARAMETER TestEnvFile
Optional path to an authorized test environment file. Omit for normal developer
use: the checkout-local backend/.env.test is used exactly as before.

.DESCRIPTION
Static contract verification plus the focused EarthRoot suites. It proves the
15A semantic foundation exists AND that it did not buy that foundation by
weakening anything released: no coordinates, no geometry, no spatial query, no
Root promotion, no IMPLEMENTED or PROVIDED object type, no real corpus, no 14C
shared-contract mutation, and no damage to migrations 018 and 019.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string]$TestEnvFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepositoryRoot = $PSScriptRoot
$PassCount = 0
$FailureCount = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) { $script:PassCount++; Write-Host "[PASS] $Message" -ForegroundColor Green }
    else { $script:FailureCount++; Write-Host "[FAIL] $Message" -ForegroundColor Red }
}

$DefaultTestEnvFile = Join-Path $RepositoryRoot "backend\.env.test"
$ResolvedTestEnvFile = $DefaultTestEnvFile
$TestEnvIsOverride = $false
if (-not [string]::IsNullOrWhiteSpace($TestEnvFile)) {
    $ResolvedTestEnvFile = [IO.Path]::GetFullPath($TestEnvFile); $TestEnvIsOverride = $true
} elseif (-not [string]::IsNullOrWhiteSpace($env:SOURCEROOT_TEST_ENV_FILE)) {
    $ResolvedTestEnvFile = [IO.Path]::GetFullPath($env:SOURCEROOT_TEST_ENV_FILE); $TestEnvIsOverride = $true
}
if ($TestEnvIsOverride -and -not (Test-Path -LiteralPath $ResolvedTestEnvFile -PathType Leaf)) {
    Write-Host "[FAIL] Authorized test environment file is missing." -ForegroundColor Red
    exit 1
}
$BackendRoot = Join-Path $RepositoryRoot "backend"

function Invoke-RepositoryGit([string[]]$GitArguments) {
    $All = @("-c", "core.excludesFile=", "-c", "core.autocrlf=false", "-C", $RepositoryRoot) + $GitArguments
    $Previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { return @(& git @All 2>$null | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ }) }
    finally { $ErrorActionPreference = $Previous }
}

function Read-Text([string]$RelativePath) {
    $Full = Join-Path $RepositoryRoot ($RelativePath -replace "/", "\")
    if (-not (Test-Path -LiteralPath $Full -PathType Leaf)) { return $null }
    $Bytes = [IO.File]::ReadAllBytes($Full)
    $Offset = 0
    if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) { $Offset = 3 }
    return (New-Object Text.UTF8Encoding($false, $true)).GetString($Bytes, $Offset, $Bytes.Length - $Offset)
}
function Flatten([string]$Text) { return (($Text -replace "[*``]", "") -replace "\s+", " ") }

function Invoke-BackendNodeGate([string]$Name, [string[]]$NodeArguments) {
    Write-Host "[INFO] $Name" -ForegroundColor Cyan
    Push-Location $BackendRoot
    try {
        & node (@("--env-file=$ResolvedTestEnvFile") + $NodeArguments)
        Assert-True ($LASTEXITCODE -eq 0) $Name
    } catch { Assert-True $false "$Name ($($_.Exception.Message))" }
    finally { Pop-Location }
}

function Invoke-BackendGate([string]$Name, [string]$ScriptName) {
    Write-Host "[INFO] $Name" -ForegroundColor Cyan
    Push-Location $BackendRoot
    $OriginalPath = $env:PATH
    try {
        if ($TestEnvIsOverride) {
            $Scripts = (Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "package.json") | ConvertFrom-Json).scripts
            $CommandText = [string]$Scripts.$ScriptName
            $env:PATH = (Join-Path $BackendRoot "node_modules\.bin") + [IO.Path]::PathSeparator + $OriginalPath
            $Tokens = @($CommandText -split "\s+" | Where-Object { $_ })
            $Arguments = @($Tokens | Select-Object -Skip 1 | ForEach-Object {
                if ($_ -eq "--env-file=.env.test") { "--env-file=$ResolvedTestEnvFile" } else { $_ }
            })
            & $Tokens[0] @Arguments
        } else { & npm.cmd run $ScriptName }
        Assert-True ($LASTEXITCODE -eq 0) $Name
    } catch { Assert-True $false "$Name ($($_.Exception.Message))" }
    finally { $env:PATH = $OriginalPath; Pop-Location }
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

Write-Host "SourceRoot EarthRoot Place / Geography / Polity v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"
Write-Host ""

# ---------------------------------------------------------------------------
# ARTIFACTS
# ---------------------------------------------------------------------------
$Artifacts = @(
    "backend/src/earthroot/contract.ts",
    "backend/src/earthroot/domain.ts",
    "backend/src/earthroot/payload.ts",
    "backend/src/earthroot/adapter.ts",
    "backend/src/earthroot/store.ts",
    "backend/db/migrations/020_create_earthroot_place_polity_foundation.sql",
    "docs/architecture/SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY-V1.md"
)
$Texts = @{}
foreach ($Artifact in $Artifacts) {
    $Text = Read-Text $Artifact
    Assert-True ($null -ne $Text) "EarthRoot artifact exists: $Artifact"
    if ($null -ne $Text) { $Texts[$Artifact] = Flatten $Text }
}
if ($Texts.Count -ne $Artifacts.Count) {
    Write-Host "Failure count: $FailureCount" -ForegroundColor Red; exit 1
}

$Contract = $Texts["backend/src/earthroot/contract.ts"]
$Domain   = $Texts["backend/src/earthroot/domain.ts"]
$Payload  = $Texts["backend/src/earthroot/payload.ts"]
$Adapter  = $Texts["backend/src/earthroot/adapter.ts"]
$Migration = $Texts["backend/db/migrations/020_create_earthroot_place_polity_foundation.sql"]

# ---------------------------------------------------------------------------
# PLACE / POLITY SEPARATION AND GOVERNED PREDICATES
# ---------------------------------------------------------------------------
Assert-True ($Contract -match 'EARTHROOT_ENTITY_TYPES = \["place", "polity"\]') "Place and polity are distinct entity classes"
foreach ($Predicate in @("named_as", "classified_as", "located_within", "governed_by", "administered_by")) {
    Assert-True ($Contract -match [regex]::Escape("`"$Predicate`"")) "Governed predicate declared: $Predicate"
}
foreach ($Synonym in @('"within"', '"part_of"', '"community_within"')) {
    Assert-True (-not ($Contract -match [regex]::Escape("$Synonym,"))) "No containment synonym declared: $Synonym"
}
# SUBJECT-side only. Saying "enforced in the database" unqualified would print
# the exact claim the N9 deferral names as a defect: object-side typing is NOT
# independently enforced in SQL, because ck_earthroot_predicate_typing evaluates
# NULL (and a NULL CHECK passes) when object_entity_type is NULL, and the
# composite object foreign key is MATCH SIMPLE. The release attestation must not
# contradict the deferral it ships with.
Assert-True ($Migration -match "ck_earthroot_predicate_typing") `
    "Predicate endpoint typing exists in the database and is enforced on the SUBJECT side (object side is deferred: N9)"
Assert-True ($Migration -match "ck_earthroot_assertion_no_self") "A resource cannot be related to itself"
Assert-True ($Migration -match "ck_earthroot_assertion_object_exclusive") "An assertion object is a resource or a literal, never both"

# ---------------------------------------------------------------------------
# CANONICAL PUBLIC ID
# ---------------------------------------------------------------------------
Assert-True ($Domain -match "randomUUID") "canonicalPublicId uses an existing runtime facility"
Assert-True ($Domain -match "canonical-public-id-opaque") "A non-opaque canonicalPublicId is rejected"
Assert-True ($Migration -match "canonical_public_id ~ ") "The database constrains canonicalPublicId shape"
Assert-True ($Migration -match "uq_earthroot_resource_canonical") "canonicalPublicId is unique within a dataset"

# ---------------------------------------------------------------------------
# TEMPORAL HONESTY
# ---------------------------------------------------------------------------
Assert-True ($Contract -match "not a claim that the relationship is timeless") "not_asserted is explicitly not timelessness"
Assert-True ($Migration -match "ck_earthroot_not_asserted_is_empty") "not_asserted carries no bounds in the database"
Assert-True ($Migration -match "ck_earthroot_asserted_has_content") "An asserted validity must carry content"
Assert-True ($Migration -match "ck_earthroot_temporal_bounds_ordered") "Interval bounds are ordered"
Assert-True ($Payload -match "payload-temporal-meaning-required") "Every payload temporal block states its meaning"

# ---------------------------------------------------------------------------
# EVIDENCE AND PROVENANCE
# ---------------------------------------------------------------------------
Assert-True ($Domain -match "evidence-required") "An assertion without evidence is not canonical"
Assert-True ($Migration -match "earthroot_assertion_requires_evidence") "Evidence is required by a deferred constraint trigger"
Assert-True ($Migration -match "DEFERRABLE INITIALLY DEFERRED") "Evidence enforcement is deferred to commit"
foreach ($Field in @("sourceLocator", "sourceDatasetId", "sourceDatasetVersion")) {
    Assert-True ($Domain -match [regex]::Escape("`"$Field`"")) "Evidence requires field: $Field"
}

# ---------------------------------------------------------------------------
# NO GEOMETRY, NO SPATIAL QUERY
# ---------------------------------------------------------------------------
Assert-True ($Contract -match "EARTHROOT_FORBIDDEN_SPATIAL_KEYS") "Spatial keys are explicitly forbidden"
Assert-True ($Domain -match "no-spatial-data") "Spatial keys are rejected at validation"
Assert-True ($Payload -match "payload-no-spatial-data") "Spatial keys are rejected in the public payload"
# Executable SQL only. The migration's own comment block names the spatial
# constructs in order to declare their absence, so a whole-file match would
# fail on the very sentence that documents the prohibition. Comments are
# stripped and the assertion is applied to the code, which is what it is
# actually about.
$MigrationRaw = Read-Text "backend/db/migrations/020_create_earthroot_place_polity_foundation.sql"
$MigrationCode = Flatten (
    (($MigrationRaw -split "`n") | Where-Object { $_ -notmatch "^\s*--" }) -join "`n"
)
foreach ($Forbidden in @("latitude", "longitude", "geometry", "geojson", "postgis", "ST_", "bbox", "polygon")) {
    Assert-True (-not ($MigrationCode -match [regex]::Escape($Forbidden))) "Migration 020 SQL declares no $Forbidden"
}
Assert-True (-not ($MigrationCode -match "(?i)\b(GEOGRAPHY|GEOMETRY|POINT)\s*\(")) "Migration 020 SQL declares no spatial column type"
Assert-True (-not ($MigrationCode -match "(?i)CREATE\s+EXTENSION")) "Migration 020 creates no database extension"
Assert-True (-not ($MigrationCode -match "(?i)\bGIST\b|\bSPGIST\b")) "Migration 020 creates no spatial index"
Assert-True (-not ($MigrationCode -match "(?i)\b(DROP|ALTER)\s+TABLE\s+cross_root_(links|link_evidence|relationship)")) "Migration 020 does not alter released 14A/14B relationship tables"
Assert-True ($MigrationCode -match "(?i)ADD CONSTRAINT ck_cross_root_resource_root_id") "Migration 020 widens the cross-Root root_id constraint"
# Matches destructive STATEMENTS, not the keyword. "AFTER TRUNCATE ON" is the
# trigger event that GUARDS against truncation, and banning the bare word would
# forbid the guard while still permitting an actual `TRUNCATE some_table;`.
$MigrationStatements = $MigrationCode -replace "(?i)AFTER\s+TRUNCATE", "AFTER_TRUNCATE_EVENT"
Assert-True (-not ($MigrationStatements -match "(?i)\bDELETE\s+FROM\b|\bTRUNCATE\b|\bUPDATE\s+cross_root")) "Migration 020 performs no destructive data transformation"
Assert-True ($MigrationCode -match "(?i)AFTER\s+TRUNCATE") "Migration 020 still declares the truncation guard"
Assert-True (-not ($Adapter -match "evaluateSpatialQuery")) "The adapter does not implement spatial query"

# ---------------------------------------------------------------------------
# ROOT LIFECYCLE AND MATURITY - NO PROMOTION
# ---------------------------------------------------------------------------
Assert-True ($Adapter -match "isEarthRootNetworkAvailable") "Network availability is stated in code, not assumed"

# Every preservation claim below is measured against the FIXED canonical
# baseline, never against HEAD. Diffing against HEAD compares the stage to
# itself: the moment this stage commits, "the released Root registry is
# unmodified" would pass even if that commit had rewritten it. A fixed
# baseline keeps these assertions meaningful before and after completion.
$BaselineCommit = "d55a45b9ed4e9065c186bf48a5a17ec3b5b71eb6"
Invoke-RepositoryGit @("cat-file", "-e", "$BaselineCommit^{commit}") | Out-Null
Assert-True ($LASTEXITCODE -eq 0) "Canonical baseline commit $($BaselineCommit.Substring(0,7)) is present"
Invoke-RepositoryGit @("merge-base", "--is-ancestor", $BaselineCommit, "HEAD") | Out-Null
Assert-True ($LASTEXITCODE -eq 0) "Canonical baseline is an ancestor of HEAD"

$RegistryChanged = @(Invoke-RepositoryGit @("diff", "--name-only", $BaselineCommit, "--", "backend/src/sourceroot/root-registry.ts"))
Assert-True ($RegistryChanged.Count -eq 0) "The released Root registry is unmodified since the canonical baseline"
foreach ($Shared in @("addressing.ts", "identity-assertions.ts", "response-envelope.ts", "query-vocabulary.ts")) {
    $Changed = @(Invoke-RepositoryGit @("diff", "--name-only", $BaselineCommit, "--", "backend/src/sourceroot/$Shared"))
    Assert-True ($Changed.Count -eq 0) "Released 14C contract is unmodified since the canonical baseline: $Shared"
}
$ObjectTypes = Read-Text "backend/src/sourceroot/object-types.ts"
$ObjectFlat = Flatten $ObjectTypes
Assert-True ($ObjectFlat -match 'objectType: "place", displayName: "Place",.{0,200}plannedOwner: "EarthRoot"') "place is owned by EarthRoot"
Assert-True ($ObjectFlat -match 'objectType: "polity", displayName: "Polity",.{0,200}plannedOwner: "EarthRoot"') "polity is owned by EarthRoot"
# The maturity ruling: neither type may become IMPLEMENTED or PROVIDED in 15A.
#
# The previous regex form could NEVER match and so proved nothing: object-types
# declares no `maturity:` field at all, and [^}] cannot cross a definition's
# closing brace to reach any `provided:`. It passed by construction.
#
# What actually holds the property: the released registry is byte-unmodified
# since the canonical baseline (asserted above), and the released maturity
# matrix derives provided/implemented from that registry rather than from this
# file. The behavioural assertions -- canRootRespond("EarthRoot") === false and
# provided/implemented false for both types -- live in the EarthRoot adapter
# suite, which this verifier executes below. This static check is therefore
# narrowed to what it can honestly prove: 15A introduced no maturity marking
# into object-types.ts at all.
Assert-True (-not ($ObjectFlat -match '(?i)\bmaturity\s*:')) `
    "object-types.ts declares no maturity marking; maturity comes from the released registry"
Assert-True (-not ($ObjectFlat -match '(?i)\bprovided\s*:\s*true')) `
    "object-types.ts marks nothing PROVIDED"
Assert-True ($ObjectFlat -match 'persistenceResourceType: "place", rootId: "EarthRoot"') "EarthRoot place persistence mapping is declared"
Assert-True ($ObjectFlat -match 'persistenceResourceType: "polity", rootId: "EarthRoot"') "EarthRoot polity persistence mapping is declared"

# ---------------------------------------------------------------------------
# PRESERVATION
# ---------------------------------------------------------------------------
$Migrations = @(Get-ChildItem -LiteralPath (Join-Path $BackendRoot "db\migrations") -File -Filter "*.sql")
Assert-True ($Migrations.Count -eq 21) "Migration count is 21 after migration 020"
Assert-True ([bool]($Migrations | Where-Object Name -eq "020_create_earthroot_place_polity_foundation.sql")) "Migration 020 is present"
Assert-True ((Get-Item -LiteralPath (Join-Path $BackendRoot "db\migrations\018_create_cross_root_link_foundation.sql")).Length -eq 5116) "Migration 018 byte length is unchanged"
Assert-True ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $BackendRoot "db\migrations\018_create_cross_root_link_foundation.sql")).Hash -eq "32760D802354738A6A5B051756BAE59849A05353966FF8752E93EBCC16183A75") "Migration 018 SHA-256 is unchanged"
Assert-True ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $BackendRoot "db\migrations\019_create_cross_root_source_backed_relationships.sql")).Hash -eq "10BBD3D8BF187BC12AD1CC59F738578950AEB7066A65A4DB411B54E855E573F2") "Migration 019 SHA-256 is unchanged"

$Changed = @(Invoke-RepositoryGit @("diff", "--name-only", $BaselineCommit)) + @(Invoke-RepositoryGit @("ls-files", "--others", "--exclude-standard"))
Assert-True (@($Changed | Where-Object { $_ -like "backend/data/*" }).Count -eq 0) "No backend/data change; 15A ships no real corpus"
Assert-True (@($Changed | Where-Object { $_ -like "*package*.json" }).Count -eq 0) "No package or dependency change"
Assert-True (@($Changed | Where-Object { $_ -like "assets/*" -or $_ -like "*.html" }).Count -eq 0) "No route or UI change"
foreach ($Adapter17 in @("historyroot-adapter", "bibleroot-adapter", "dictionaryroot-adapter")) {
    Assert-True (@($Changed | Where-Object { $_ -like "*$Adapter17*" }).Count -eq 0) "Chunk 17A-17C adapter not pulled forward: $Adapter17"
}

# ---------------------------------------------------------------------------
# WAVE 5: MIGRATION DETERMINISM
#
# The Wave 4 veto was raised because 020 located a released constraint by
# pattern match and dropped whichever row happened to come back first. These
# assertions require the deterministic form AND prohibit the defective one, so
# a regression cannot pass by adding the right text while keeping the wrong.
# ---------------------------------------------------------------------------
Assert-True ($MigrationCode -match "DROP CONSTRAINT IF EXISTS cross_root_resources_root_id_check") `
    "Migration 020 drops the released root_id CHECK by its exact deterministic name"
Assert-True ($MigrationCode -match "DROP CONSTRAINT IF EXISTS cross_root_resources_resource_type_check") `
    "Migration 020 drops the released resource_type CHECK by its exact deterministic name"
Assert-True (-not ($MigrationCode -match "(?i)conname\s+LIKE")) `
    "Migration 020 never locates a released constraint by LIKE pattern"
Assert-True (-not ($MigrationCode -match "(?i)pg_constraint[^;]*LIMIT\s+1")) `
    "Migration 020 never drops whichever constraint a LIMIT 1 happens to return"
Assert-True ($MigrationCode -match "(?i)RAISE\s+EXCEPTION") `
    "Migration 020 proves its own post-condition and fails loudly rather than fails open"
Assert-True ($Migration -match "earthroot_evidence_delete_keeps_assertion_sourced") `
    "Deleting the final evidence row cannot silently orphan a canonical assertion"
Assert-True ($Migration -match "require_earthroot_evidence_on_delete") `
    "The evidence-delete guard is a real function, not a comment"
Assert-True ($MigrationCode -match "(?i)AFTER DELETE OR UPDATE ON earthroot_assertion_evidence") `
    "Evidence removal is guarded on UPDATE as well as DELETE, so re-pointing cannot orphan"
Assert-True ($MigrationCode -match "(?i)LIKE '%lemma%'") `
    "The post-condition also detects a surviving narrow resource_type constraint, not only a Root-shaped one"
Assert-True ($MigrationCode -match "uq_earthroot_assertion_dataset") `
    "Assertions expose a composite key for the evidence foreign key"
Assert-True ($MigrationCode -match "(?i)FOREIGN KEY \(assertion_id, dataset_id\)") `
    "Evidence references its assertion compositely, so dataset divergence is unrepresentable"

# ---------------------------------------------------------------------------
# WAVE 5: PUBLISHED SUMMARIES ARE DERIVED, NOT ASSERTED
#
# Behavioural intent, checked structurally: the adapter must compute these
# values from the contributing assertions. A hardcoded literal in the result
# item is the exact defect Wave 4 found.
# ---------------------------------------------------------------------------
$AdapterFlat = Flatten $Adapter
Assert-True (-not ($AdapterFlat -match 'derivation:\s*"directly_sourced"')) `
    "Adapter never hardcodes derivation on the published item"
Assert-True (-not ($AdapterFlat -match 'reviewState:\s*"')) `
    "Adapter never hardcodes reviewState on the published item"
Assert-True (-not ($AdapterFlat -match 'certainty:\s*"')) `
    "Adapter never hardcodes certainty on the published item"
foreach ($Deriver in @("deriveAggregateDerivation", "deriveAggregateReviewState", "deriveAggregateCertainty")) {
    Assert-True ($Adapter -match "function $Deriver") "Published summary is derived by $Deriver"
}
Assert-True ($Adapter -match "governedContributions") `
    "One governed contributing set drives the payload and the provenance alike"
Assert-True ($Adapter -match 'assertionStatus === "active"' -and $Adapter -match 'reviewState !== "rejected"') `
    "Rejected and withdrawn material contributes nothing public"
Assert-True ($Adapter -match "reconcileInput") `
    "Caller-supplied maps are reconciled before anything is published"
Assert-True ($Adapter -match "readonly fixtureOnly: boolean") `
    "The synthetic-fixture disclosure is REQUIRED, so omission cannot publish synthetic data as real"
Assert-True ($Adapter -match "fixture-disclosure-required") `
    "An omitted fixture disclosure fails closed"
Assert-True ($MigrationCode -match "(?i)AFTER TRUNCATE ON earthroot_assertion_evidence") `
    "TRUNCATE cannot strip evidence and leave canonical assertions unsourced"
Assert-True ($Adapter -match "relationship-object-dataset-disagreement") `
    "An unqualified relationship object cannot span datasets"
Assert-True ($Adapter -match "relationship-object-is-self") `
    "A resource can never be published as its own relationship object"
Assert-True ($Adapter -match "preferred\.length !== 1") `
    "Two undisputed preferred names are ambiguous, never resolved by array order"
Assert-True ($Adapter -match "x\.e\.evidenceOrder - y\.e\.evidenceOrder") `
    "The published source locator follows the governed evidence order"
# The deferred activation gates must be RECORDED somewhere durable, not merely
# asserted in prose. An earlier draft claimed the N9 gap "is recorded as a
# deferred activation gate" while no register existed anywhere in the repository.
$ArchitectureDoc = Read-Text "docs/architecture/SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY-V1.md"
Assert-True ($null -ne $ArchitectureDoc -and ($ArchitectureDoc -match "(?m)^##\s+Deferred activation gates\s*$")) `
    "The architecture document carries a deferred activation gate register"
foreach ($Gate in @(
    "EARTHROOT TYPED-PREDICATE DB ENFORCEMENT",
    "DATABASE RUNTIME PRIVILEGE HARDENING",
    "MIGRATION RUNNER CONTENT-IDENTITY",
    "GDS STAGE AUTHORIZATION ANCHOR",
    "GDS BASELINE-TO-CANDIDATE CHANGESET AUTHORITY")) {
    Assert-True ($ArchitectureDoc -match [regex]::Escape($Gate)) "Deferred gate is registered: $Gate"
}
Assert-True ($ArchitectureDoc -match "(?i)do NOT constrain a superuser|not constrain a superuser") `
    "The register states plainly that the guards do not constrain a superuser"

Assert-True ($Payload -match "payload-not-asserted-meaning-pinned") `
    "The not_asserted meaning is pinned, so absence cannot be reworded as timelessness"
Assert-True ($Payload -match "payload-disputed-name-not-preferred") `
    "A disputed name can never be published as the preferred identity string"
Assert-True ($Domain -match "evidence\.evidenceOrder < 1") `
    "evidenceOrder validation matches the database CHECK exactly"

# ---------------------------------------------------------------------------
# WAVE 5: NEGATIVE CONTROLS EXIST AND ARE EXECUTED
# ---------------------------------------------------------------------------
$AdapterTests = Read-Text "backend/test/earthroot-adapter.test.ts"
Assert-True ($null -ne $AdapterTests) "The adapter suite exists"
$NegativeControls = ([regex]::Matches($AdapterTests, 'test\("NC-\d+\.')).Count
Assert-True ($NegativeControls -ge 10) `
    "At least ten negative controls prove the repairs detect their defects (found $NegativeControls)"

# ---------------------------------------------------------------------------
# WAVE 5: STAGE ALLOWLIST CONTAINMENT
#
# The allowlist is a permission SUPERSET: every changed path must appear in it,
# but the stage need not touch every allowed path.
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
$GdsContextComplete = (@(@($GdsContext.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)
# Results are published for the governance sections BELOW, which must attribute
# pending work to the SIGNED authorization rather than to a path list pinned
# inside this file. A pinned list is a release-state fact; a signed
# authorization is authority.
$script:GdsAuthorityValid = $false
$script:GdsCandidateAuthorized = $false
$script:GdsCandidatePaths = @()
$script:GdsCandidateEntries = @()
$script:GdsBaselineCommit = ""
$script:GdsTerminalRelease = $false
$script:GdsRelease = $null
$script:GdsGovernanceMode = "ungoverned"

# The RELEASED predecessor, supplied separately from current authority because
# they are different facts about different commits. Absent context simply means
# terminal state cannot be established in this run.
$GdsReleaseContext = @{
    StageSlug                   = $env:SRGDS_RELEASED_STAGE
    ExpectedAuthorizationId     = $env:SRGDS_RELEASED_AUTHORIZATION_ID
    ExpectedAuthorizationDigest = $env:SRGDS_RELEASED_AUTHORIZATION_DIGEST
    ExpectedSignerFingerprint   = $env:SRGDS_SIGNER_FINGERPRINT
    SignerPrincipal             = $env:SRGDS_SIGNER_PRINCIPAL
    AuditDigest                 = $env:SRGDS_AUDIT_DIGEST
    ReleaseDigest               = $env:SRGDS_RELEASE_DIGEST
    AuditorPrincipal            = $env:SRGDS_AUDITOR_PRINCIPAL
    AuditorFingerprint          = $env:SRGDS_AUDITOR_FINGERPRINT
    CommitBindingDigest         = $env:SRGDS_COMMIT_BINDING_DIGEST
}
$GdsReleaseContextComplete = (@(@($GdsReleaseContext.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)

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
        $script:GdsAuthorityValid = $GdsAuth.Valid

        # TERMINAL RELEASE STATE.
        #
        # Current authority requires HEAD to equal the signed baseline, so after
        # a release commit it is correctly and PERMANENTLY unavailable. Asserting
        # it anyway made these verifiers fail against the very release they exist
        # to verify - the fifth appearance of one defect class: a release-state
        # fact treated as a durable invariant.
        #
        # The governed question after release is different: is HEAD the released
        # truth? That is answered only from the complete historical chain, and it
        # grants nothing. The core proves, as part of answering, that the
        # historical authorization STILL fails as current authority at HEAD.
        if (-not $script:GdsAuthorityValid -and $GdsReleaseContextComplete) {
            $script:GdsRelease = Test-GdsReleaseState -RepositoryRoot $PSScriptRoot @GdsReleaseContext
            $script:GdsTerminalRelease = $script:GdsRelease.Released
        }
        $script:GdsGovernanceMode =
            if ($script:GdsAuthorityValid) { "in-flight" }
            elseif ($script:GdsTerminalRelease) { "terminal" }
            else { "ungoverned" }

        Assert-True ($script:GdsGovernanceMode -ne "ungoverned") `
            "Governance state is established through the trust core: $($script:GdsGovernanceMode)"

        if ($script:GdsAuthorityValid) {
            Assert-True ($GdsAuth.AuthorizationId -ceq $GdsContext.Id) `
                "The authorization the core returned is the issuance execution context selected"
            Assert-True ($GdsAuth.Digest -ceq $GdsContext.Digest.ToUpperInvariant()) `
                "The authorization bytes are the exact bytes execution context named"
        } elseif ($script:GdsTerminalRelease) {
            Assert-True ($script:GdsRelease.Tree -ceq $script:GdsRelease.CandidateTree) `
                "HEAD's tree is the audited candidate tree ($($script:GdsRelease.CandidateTree))"
            Assert-True ($script:GdsRelease.AuditVerdict -ceq "PASS") `
                "The released candidate carries a PASS audit binding from $($script:GdsRelease.AuditorIdentity)"
            Assert-True ($script:GdsRelease.BoundReleaseCommit -ceq $script:GdsRelease.Commit) `
                "A signed release commit binding names this exact commit, not merely its parent and tree"
            Assert-True ($script:GdsRelease.CurrentAuthorityAtHead -ceq "REJECTED") `
                "Terminal release state confers NO authority over HEAD; the consumed authorization stays consumed"
        }

        if ($GdsAuth.Valid) {
            $GdsCandidate = Get-GdsCandidateManifest -RepositoryRoot $PSScriptRoot -StageSlug $GdsContext.Stage `
                -ExpectedAuthorizationId $GdsContext.Id -ExpectedAuthorizationDigest $GdsContext.Digest `
                -ExpectedSignerFingerprint $GdsContext.Fingerprint -SignerPrincipal $GdsContext.Principal
            $script:GdsCandidateAuthorized = $GdsCandidate.Authorized
            if ($null -ne $GdsCandidate.Manifest) {
                $script:GdsCandidateEntries = @($GdsCandidate.Manifest.entries)
                $script:GdsCandidatePaths = @($script:GdsCandidateEntries | ForEach-Object { [string]$_.path })
            }
            $script:GdsBaselineCommit = [string]$GdsAuth.BaselineCommit
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
# The allowlist is read from ROOT-MANIFEST.json, which is what the lifecycle
# tooling actually enforces. Scraping every backticked list item out of the
# stage markdown instead would silently absorb the REQUIRED VERIFIERS section
# and grant write permission to released verifiers nobody authorized changing.
# After completion the active stage is gone. The exact completed-record PATH is
# a required artifact-presence condition. Its mutable Markdown CONTENT is
# documentation/evidence only and does not participate in authorization.
#
# An independent Tier 3 audit found the previous revision selected that mutable
# record, parsed its "Allowed files" section, and used the result as the
# authority the candidate was measured against. That is self-authorization: the
# artifact under audit supplied the rule it was judged by, so swapping one path
# for another inside the record silently redefined what "in scope" meant.
#
# The authorized path set and stage identity come exclusively from the PINNED
# EXTERNAL ANCHOR below. Only the pinned record path must exist; no record field
# can open, close, widen, narrow, or redirect the window. Deferred item H
# requires a future governed stage to retire this temporary anchor.
$AnchoredBaseline = "d55a45b9ed4e9065c186bf48a5a17ec3b5b71eb6"
$AnchoredDescendantSlug = "SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY-V1"
$AnchoredRecordRelative = "docs/stages/completed/20260810-$AnchoredDescendantSlug.md"
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
    $AnchoredRecordRelative,
    "verification/sourceroot-shared-grammar.test.cjs"
)

$Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
$ActiveStage = $null
if ($Manifest.PSObject.Properties.Name -contains "active_stage") { $ActiveStage = $Manifest.active_stage }

$AllowedPaths = @()
$AllowlistSource = ""
$AnchorReason = "not evaluated"
# The fallback triggers on an EMPTY allowlist, not on a missing property.
# COMPLETE-ROOT-STAGE.ps1 does not delete active_stage; it rewrites it with
# allowed_files set to an empty array.
if (
    $null -ne $ActiveStage -and
    $ActiveStage.PSObject.Properties.Name -contains "allowed_files" -and
    @($ActiveStage.allowed_files).Count -gt 0
) {
    $AllowedPaths = @($ActiveStage.allowed_files)
    $AllowlistSource = "ROOT-MANIFEST.json active_stage"
} else {
    # Completed-but-uncommitted audit window. Authority is determined entirely
    # by pinned machine facts and Git state. Human Markdown is not authority.
    $HeadCommit = @(Invoke-RepositoryGit @("rev-parse", "HEAD"))
    $Head = if ($HeadCommit.Count -gt 0) { $HeadCommit[0] } else { "" }
    $UntrackedCompleted = @(
        Invoke-RepositoryGit @("ls-files", "--others", "--exclude-standard", "--", "docs/stages/completed") |
            ForEach-Object { ([string]$_).Replace("\", "/") } | Where-Object { $_ -like "*.md" }
    )
    $RecordFull = Join-Path $RepositoryRoot ($AnchoredRecordRelative -replace "/", "\")
    if ($Head -ne $AnchoredBaseline) {
        $AnchorReason = "HEAD has moved off the anchored baseline; the window is permanently closed"
    } elseif ($UntrackedCompleted.Count -ne 1) {
        $AnchorReason = "expected exactly one uncommitted completed record, found $($UntrackedCompleted.Count)"
    } elseif ($UntrackedCompleted[0] -ne $AnchoredRecordRelative) {
        $AnchorReason = "uncommitted completed record is not the anchored one: $($UntrackedCompleted[0])"
    } elseif (-not (Test-Path -LiteralPath $RecordFull -PathType Leaf)) {
        $AnchorReason = "anchored record is not readable"
    } else {
        $AllowedPaths = $AnchoredDescendantPaths
        $AllowlistSource = "pinned external anchor (completed-but-uncommitted window for $AnchoredDescendantSlug)"
        $AnchorReason = "open; pinned record path exists and record content is non-authoritative"
    }
    if ($AllowedPaths.Count -eq 0) {
        Write-Host "       anchored window: $AnchorReason" -ForegroundColor Red
    }
}

if ($AllowedPaths.Count -gt 0) {
    Assert-True $true "The governed allowlist is readable from the $AllowlistSource"
    # The Principal Architect expanded this stage twice, each time by explicit
    # ruling after a STOP: 15 to 17 when the released 14B and GDS verifiers had
    # to be repaired, then 17 to EXACTLY 20 when the released 14C verifier and
    # its two test suites showed the same release-state-as-durable-invariant
    # defect. The cap tracks the current ruling; leaving it behind an expansion
    # made the stage fail its own required gate while the GDS verifier accepted
    # the same allowlist. No 21st path is authorized.
    Assert-True ($AllowedPaths.Count -le 20) `
        "Governed allowlist stays within the authorized maximum of 20 paths (declares $($AllowedPaths.Count))"
    foreach ($Excluded in @("backend/src/sourceroot/root-registry.ts")) {
        Assert-True ($AllowedPaths -notcontains $Excluded) "Allowlist excludes $Excluded"
    }

    # Measured against the canonical baseline, NOT against git status. Reading
    # only the pending changeset would make this section silently vacuous the
    # moment the stage commits: status returns nothing, the loop below never
    # runs, and zero assertions execute while the section still reports success.
    # --untracked-files=all expands a new directory into its individual files, so
    # a whole unreviewed subtree can never be waved through as one allowed entry.
    $ChangedPaths = @(
        @(Invoke-RepositoryGit @("diff", "--name-only", $BaselineCommit)) +
        @(Invoke-RepositoryGit @("ls-files", "--others", "--exclude-standard"))
    ) | ForEach-Object { $_.Trim().Trim('"') } | Where-Object { $_ -ne "" } | Sort-Object -Unique
    Assert-True ($ChangedPaths.Count -gt 0) `
        "The stage has a measurable changeset against the canonical baseline ($($ChangedPaths.Count) paths)"
    foreach ($Changed in $ChangedPaths) {
        $Normalized = $Changed -replace '\\', '/'
        $Covered = $false
        foreach ($Allowed in $AllowedPaths) {
            if ($Normalized -eq $Allowed -or $Normalized.StartsWith(($Allowed.TrimEnd('/') + "/"))) { $Covered = $true; break }
        }
        Assert-True $Covered "Changed path is inside the stage allowlist: $Normalized"
    }
} elseif ($script:GdsAuthorityValid -and $script:GdsCandidateAuthorized) {
    # GDS v1.1 SUPERSESSION.
    #
    # Neither legacy source of an allowlist is available: the manifest declares
    # no active stage, and the pinned completed-stage window has closed because
    # HEAD moved past the release it was anchored to. Under the legacy model
    # that is a hard failure - the verifier has nowhere to read authority from.
    #
    # It now does. The governed allowlist is the SIGNED authorization in the
    # external control store, and the core has already decided every candidate
    # path against it. This branch does not re-derive that decision; it
    # CROSS-CHECKS it, by requiring that the changeset this verifier measures is
    # exactly the candidate the core derived. Two independent views of "what
    # changed" that disagree would mean one of them is looking at the wrong
    # tree, and that is worth failing on.
    #
    # The 20-path cap above is deliberately NOT applied here. It is a 15A
    # ruling about 15A's allowlist; the current signed authorization is a
    # different issuance with different bounds, and silently enforcing an old
    # cap against a new authorization would be this file overriding a signature.
    $ChangedPaths = @(
        @(Invoke-RepositoryGit @("diff", "--name-only", $BaselineCommit)) +
        @(Invoke-RepositoryGit @("ls-files", "--others", "--exclude-standard"))
    ) | ForEach-Object { $_.Trim().Trim('"').Replace("\", "/") } | Where-Object { $_ -ne "" } | Sort-Object -Unique
    $CandidateSet = @($script:GdsCandidatePaths | Sort-Object -Unique)

    # The two views measure from DIFFERENT baselines, and conflating them is a
    # mistake worth naming. This verifier measures from the 15A canonical
    # baseline, so its changeset includes 15A's own COMMITTED work. The core
    # measures from the baseline the CURRENT authorization signed, so its
    # candidate is only what is pending now.
    #
    # The relation between them is therefore CONTAINMENT, not equality: every
    # path the core put in the candidate must also be changed relative to the
    # older baseline. A candidate path that is somehow NOT changed relative to
    # the older baseline would mean the two are looking at different trees.
    # Paths in the other direction are 15A's committed history and are reported
    # for the reader, not failed.
    $CandidateOutsideChangeset = @($CandidateSet | Where-Object { $ChangedPaths -notcontains $_ })
    $CommittedOnly = @($ChangedPaths | Where-Object { $CandidateSet -notcontains $_ })

    # THE ACTIVE-SPECIFICATION LIFECYCLE TRANSITION.
    #
    # An earlier version of this excused ANY candidate path that was absent at
    # the 15A baseline and absent now. A Tier-3 audit proved that is an ABSENCE
    # HEURISTIC, not a lifecycle rule: deleting an unrelated authorized path,
    # docs/build/SRGDS-CORE-BUILD-CONTRACT.md, satisfied it and reconciliation
    # still passed. Any authorized file added after the 15A baseline could be
    # deleted and vanish from this check entirely.
    #
    # The excusal is therefore pinned to ONE named transition - consuming the
    # active specification - and every fact it depends on is proven separately.
    # If any single fact fails, nothing is excused and reconciliation fails,
    # which is the safe direction.
    #
    # The path is compared with -ceq against the canonical spelling, so
    # case-variant, separator-variant, traversal, alias and rename forms simply
    # are not equal to it. The core has already guaranteed every candidate path
    # is a safe single Git path, so no normalization happens here: normalizing
    # would let two distinct paths collapse into one identity.
    $LifecycleSpecPath = "docs/stages/active/CURRENT-STAGE.md"
    $AgreedAbsent = @()

    # FACT 0 - the only path that may ever be excused, and only once.
    $Nominated = @($CandidateOutsideChangeset | Where-Object { ([string]$_) -ceq $LifecycleSpecPath })
    if ($Nominated.Count -eq 1) {
        # FACT 1 - exactly one candidate entry names it, and
        # FACT 2 - its disposition is exactly a deletion.
        $SpecEntries = @($script:GdsCandidateEntries | Where-Object { ([string]$_.path) -ceq $LifecycleSpecPath })
        $OneEntry = ($SpecEntries.Count -eq 1)
        $IsDeletion = $OneEntry -and (([string]$SpecEntries[0].change) -ceq "delete")

        # FACT 3 - it EXISTED at the signed StageAuthorization baseline. A
        # deletion of something that was never there is not a transition. The
        # baseline comes from the signed authorization through the core, not
        # from a literal written here.
        $AtSigned = @(Invoke-RepositoryGit @("ls-tree", "--name-only", $script:GdsBaselineCommit, $LifecycleSpecPath))
        $PresentAtSignedBaseline = (@($AtSigned | Where-Object { ([string]$_) -ceq $LifecycleSpecPath }).Count -eq 1)

        # FACT 4 - it is absent at the 15A historical comparison baseline, which
        # is why no diff from there can report it.
        $At15A = @(Invoke-RepositoryGit @("ls-tree", "--name-only", $BaselineCommit, $LifecycleSpecPath))
        $AbsentAt15A = (@($At15A | Where-Object { ([string]$_) -ceq $LifecycleSpecPath }).Count -eq 0)

        # FACT 5 - it is absent from the candidate state. The worktree is what
        # the candidate tree is built from, so its absence there is the same
        # absence, and it is confirmed independently by the manifest disposition
        # above rather than inferred from it.
        $AbsentNow = -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ($LifecycleSpecPath -replace "/", "\")) -PathType Leaf)

        $Facts = [ordered]@{
            "exactly one candidate entry"       = $OneEntry
            "disposition is delete"             = $IsDeletion
            "present at the signed baseline"    = $PresentAtSignedBaseline
            "absent at the 15A baseline"        = $AbsentAt15A
            "absent from the candidate state"   = $AbsentNow
        }
        $AllHold = -not (@($Facts.Values | Where-Object { -not $_ }).Count -gt 0)
        if ($AllHold) {
            $AgreedAbsent = @($LifecycleSpecPath)
            Write-Host "       active specification consumed - lifecycle transition proven, so no diff from the 15A baseline can report it: $LifecycleSpecPath"
        } else {
            Write-Host "       lifecycle excusal REFUSED for ${LifecycleSpecPath}:" -ForegroundColor Red
            foreach ($Key in $Facts.Keys) {
                if (-not $Facts[$Key]) { Write-Host "         unproven: $Key" -ForegroundColor Red }
            }
        }
    } elseif ($Nominated.Count -gt 1) {
        Write-Host "       lifecycle excusal REFUSED: $($Nominated.Count) entries name the active specification" -ForegroundColor Red
    }
    $CandidateOutsideChangeset = @($CandidateOutsideChangeset | Where-Object { $AgreedAbsent -notcontains ([string]$_) })

    Assert-True $true "The governed allowlist is readable from the signed authorization in the external control store"
    Assert-True ($ChangedPaths.Count -gt 0) `
        "The stage has a measurable changeset against the canonical baseline ($($ChangedPaths.Count) paths)"
    Assert-True ($CandidateOutsideChangeset.Count -eq 0) `
        "Every path in the trust core's candidate is present in this verifier's changeset ($($CandidateSet.Count) candidate / $($ChangedPaths.Count) changed)"
    foreach ($Path in $CandidateOutsideChangeset) { Write-Host "       in the candidate but not changed: $Path" -ForegroundColor Red }
    if ($CommittedOnly.Count -gt 0) {
        Write-Host "       committed since the 15A canonical baseline, outside this candidate: $($CommittedOnly.Count) path(s)"
    }
} elseif ($script:GdsTerminalRelease) {
    # TERMINAL RELEASE STATE.
    #
    # No authorization governs HEAD, and none should. Every path between the 15A
    # canonical baseline and HEAD is COMMITTED release history that was inside a
    # signed candidate when it landed, and the core has already proven from the
    # historical chain that HEAD's tree IS the audited candidate tree. Demanding
    # a live allowlist for history is the same defect this stage exists to close.
    #
    # This branch is not a bypass. It admits ZERO pending paths, where the
    # allowlist branches above admit a signed set.
    $PendingPaths = @(Invoke-RepositoryGit @("status", "--porcelain", "--untracked-files=all"))
    Assert-True ($PendingPaths.Count -eq 0) `
        "At a terminal release state nothing is pending against HEAD ($($PendingPaths.Count) found)"
    foreach ($Path in $PendingPaths) { Write-Host "       pending at a terminal release: $Path" -ForegroundColor Red }
    Assert-True ($script:GdsRelease.Tree -ceq $script:GdsRelease.CandidateTree) `
        "The 15A changeset is committed governed history: HEAD's tree is the audited candidate tree"
} else {
    Assert-True $false "A governed state is available: an active manifest allowlist, the pinned completed-stage window, a signed authorization, or a proven terminal release"
}

# ---------------------------------------------------------------------------
# FOCUSED SUITES
# ---------------------------------------------------------------------------
Invoke-BackendGate "Test database migrations" "db:migrate:test"
Invoke-BackendGate "Backend typecheck" "typecheck"
Invoke-BackendNodeGate "EarthRoot semantics suite" @("--import","./scripts/register-tsx.mjs","--test","--test-concurrency=1","test/earthroot-semantics.test.ts")
Invoke-BackendNodeGate "EarthRoot adapter suite" @("--import","./scripts/register-tsx.mjs","--test","--test-concurrency=1","test/earthroot-adapter.test.ts")
Invoke-BackendNodeGate "EarthRoot provenance suite" @("--import","./scripts/register-tsx.mjs","--test","--test-concurrency=1","test/earthroot-provenance.test.ts")

Invoke-RepositoryGit @("diff", "--check") | Out-Null
Assert-True ($LASTEXITCODE -eq 0) "git diff --check reports no whitespace error"
Assert-True (@(Invoke-RepositoryGit @("diff", "--cached", "--name-only")).Count -eq 0) "Git index is empty"

Write-Host ""
Write-Host "Verifier summary" -ForegroundColor Cyan
Write-Host "Pass count: $PassCount"
Write-Host "Failure count: $FailureCount"
if ($FailureCount -gt 0) { Write-Host "Overall result: FAIL" -ForegroundColor Red; exit 1 }
Write-Host "Overall result: PASS" -ForegroundColor Green
exit 0
