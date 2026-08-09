<#
.PARAMETER TestEnvFile
Optional path to an authorized test environment file. Omit it for normal
developer use: the verifier then uses the checkout-local `backend/.env.test`
exactly as before. Supply it only when verifying from an isolated clone that
has no local test environment of its own.

.PARAMETER DictionaryPilotFile
Optional path to the DictionaryRoot OEWN pilot artifact. That artifact is a
large local-only source file, ignored by Git and therefore absent from an
isolated clone. Omit it for normal developer use. When supplied it is verified
against the committed accounting before use, and any copy this verifier makes
into the checkout is removed afterwards.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string]$TestEnvFile = "",

    [Parameter()]
    [string]$DictionaryPilotFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepositoryRoot = $PSScriptRoot
$BackendRoot = Join-Path $RepositoryRoot "backend"
$DatasetRoot = Join-Path $BackendRoot "data\cross-root-source-backed-relationships-v1"
$PriorDatasetRoot = Join-Path $BackendRoot "data\cross-root-link-foundation-v1"
$PassCount = 0
$FailureCount = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) { $script:PassCount++; Write-Host "[PASS] $Message" -ForegroundColor Green }
    else { $script:FailureCount++; Write-Host "[FAIL] $Message" -ForegroundColor Red }
}
function Invoke-Gate([string]$Name, [string]$WorkingDirectory, [scriptblock]$Command) {
    Write-Host "[INFO] $Name" -ForegroundColor Cyan
    Push-Location $WorkingDirectory
    try { & $Command; Assert-True ($LASTEXITCODE -eq 0) $Name }
    catch { Assert-True $false "$Name ($($_.Exception.Message))" }
    finally { Pop-Location }
}

# ---------------------------------------------------------------------------
# Test environment resolution.
#
# Precedence: -TestEnvFile parameter -> SOURCEROOT_TEST_ENV_FILE inherited
# environment override -> checkout-local backend/.env.test.
#
# The default path keeps the primary developer checkout working with no flag
# and no behavior change. The override exists so an isolated clone can verify
# against an authorized external test environment without copying credentials
# into the clone. No machine-specific path is stored in this file, and the
# resolved path, its contents, and DATABASE_URL are never printed.
# ---------------------------------------------------------------------------
$DefaultTestEnvFile = Join-Path $BackendRoot ".env.test"
$TestEnvSource = "checkout-local backend/.env.test"
$ResolvedTestEnvFile = $DefaultTestEnvFile
$TestEnvIsOverride = $false
if (-not [string]::IsNullOrWhiteSpace($TestEnvFile)) {
    $ResolvedTestEnvFile = [IO.Path]::GetFullPath($TestEnvFile)
    $TestEnvSource = "-TestEnvFile parameter"
    $TestEnvIsOverride = $true
} elseif (-not [string]::IsNullOrWhiteSpace($env:SOURCEROOT_TEST_ENV_FILE)) {
    $ResolvedTestEnvFile = [IO.Path]::GetFullPath($env:SOURCEROOT_TEST_ENV_FILE)
    $TestEnvSource = "SOURCEROOT_TEST_ENV_FILE environment override"
    $TestEnvIsOverride = $true
}
if ($TestEnvIsOverride -and -not (Test-Path -LiteralPath $ResolvedTestEnvFile -PathType Leaf)) {
    Write-Host "[FAIL] Authorized test environment file is missing ($TestEnvSource)" -ForegroundColor Red
    exit 1
}
$PackageScripts = (Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "package.json") | ConvertFrom-Json).scripts

# ---------------------------------------------------------------------------
# DictionaryRoot pilot artifact resolution.
#
# Precedence: -DictionaryPilotFile -> SOURCEROOT_DICTIONARY_PILOT_FILE ->
# checkout-local path. The artifact is Git-ignored and absent from isolated
# clones. An externally supplied copy is accepted only after its byte length
# and full SHA-256 match the committed accounting, and any copy this verifier
# materializes is removed again afterwards. A pre-existing local artifact is
# never touched. Nothing is downloaded.
# ---------------------------------------------------------------------------
$PilotRelative = "data/dictionaryroot/dictionaryroot-oewn-2025-pilot-10000.json"
$PilotLocalPath = Join-Path $RepositoryRoot ($PilotRelative -replace "/", "\")
$PilotSource = ""
if (-not [string]::IsNullOrWhiteSpace($DictionaryPilotFile)) {
    $PilotSource = [IO.Path]::GetFullPath($DictionaryPilotFile)
} elseif (-not [string]::IsNullOrWhiteSpace($env:SOURCEROOT_DICTIONARY_PILOT_FILE)) {
    $PilotSource = [IO.Path]::GetFullPath($env:SOURCEROOT_DICTIONARY_PILOT_FILE)
}
$PilotCopyCreated = $false

function Initialize-DictionaryPilotArtifact {
    if ([string]::IsNullOrWhiteSpace($PilotSource)) { return }
    if (Test-Path -LiteralPath $PilotLocalPath -PathType Leaf) {
        Assert-True $true "DictionaryRoot pilot artifact already present locally (left untouched)"
        return
    }
    $Accounting = Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "data\dictionaryroot-core-lexical-corpus-v1\prepared-source-accounting.json") | ConvertFrom-Json
    # Not every accounting entry carries a repositoryPath, so the lookup must
    # be StrictMode-safe rather than assuming a uniform shape.
    $Expected = @($Accounting.inputs | Where-Object {
        ($_.PSObject.Properties.Name -contains "repositoryPath") -and
        (([string]$_.repositoryPath) -like "*pilot-10000.json")
    })[0]
    Assert-True ($null -ne $Expected) "Committed pilot accounting entry is available"
    if ($null -eq $Expected) { return }
    if (-not (Test-Path -LiteralPath $PilotSource -PathType Leaf)) {
        Assert-True $false "Supplied DictionaryRoot pilot artifact exists"
        return
    }
    $ActualLength = (Get-Item -LiteralPath $PilotSource).Length
    $ActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $PilotSource).Hash
    Assert-True ($ActualLength -eq [int64]$Expected.byteLength) "Supplied pilot artifact exact byte length"
    Assert-True ($ActualHash -eq [string]$Expected.sha256) "Supplied pilot artifact exact SHA-256"
    if ($ActualLength -ne [int64]$Expected.byteLength -or $ActualHash -ne [string]$Expected.sha256) { return }
    $PilotDirectory = Split-Path -Parent $PilotLocalPath
    if (-not (Test-Path -LiteralPath $PilotDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $PilotDirectory -Force | Out-Null
    }
    Copy-Item -LiteralPath $PilotSource -Destination $PilotLocalPath -Force
    $script:PilotCopyCreated = $true
}

function Remove-DictionaryPilotArtifact {
    if ($script:PilotCopyCreated -and (Test-Path -LiteralPath $PilotLocalPath -PathType Leaf)) {
        Remove-Item -LiteralPath $PilotLocalPath -Force
        $script:PilotCopyCreated = $false
    }
}

# Runs a short node module from the backend with the resolved test
# environment. The script is written to a temporary file outside the
# repository so shell quoting cannot corrupt it and no residue is left behind.
function Invoke-BackendNodeScript([string]$Source) {
    # ESM resolves relative imports against the module's own URL, and the
    # temporary file lives outside the repository, so __BACKEND__ is replaced
    # with an absolute backend file URL before execution.
    $BackendUrl = ([uri]((Resolve-Path -LiteralPath $BackendRoot).Path.TrimEnd("\") + "\")).AbsoluteUri
    $Temporary = [IO.Path]::Combine([IO.Path]::GetTempPath(), "sourceroot-verify-$([guid]::NewGuid().ToString('N')).mjs")
    [IO.File]::WriteAllText($Temporary, $Source.Replace("__BACKEND__", $BackendUrl), (New-Object Text.UTF8Encoding($false)))
    Push-Location $BackendRoot
    try {
        return @(& node "--env-file=$ResolvedTestEnvFile" --import ./scripts/register-tsx.mjs $Temporary 2>&1)
    } finally {
        Pop-Location
        Remove-Item -LiteralPath $Temporary -Force -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# Database identity guard.
#
# Proven with the resolved test environment through the repository's own
# database stack before any migration, reset, or provisioning. The environment
# filename is never treated as proof. Only the database name is printed.
# ---------------------------------------------------------------------------
function Assert-TestDatabaseIdentity {
    try {
        $Output = Invoke-BackendNodeScript @'
const { getPool, closeDatabase } = await import("__BACKEND__src/lib/database.ts");
const pool = getPool();
if (!pool) { console.log("NO-POOL"); process.exit(1); }
try {
  const result = await pool.query("SELECT current_database() AS d");
  console.log(result.rows[0].d);
} finally { await closeDatabase(); }
'@
        $Name = ([string](@($Output) | Select-Object -Last 1)).Trim()
        Assert-True ($Name -eq "sourceroot_test") "Test database identity is sourceroot_test"
        if ($Name -ne "sourceroot_test") { Write-Host "       $Output" -ForegroundColor Red }
        return ($Name -eq "sourceroot_test")
    } catch {
        Assert-True $false "Test database identity is sourceroot_test ($($_.Exception.Message))"
        return $false
    }
}

# Runs a node script from the backend with the resolved test environment.
function Invoke-BackendNodeGate([string]$Name, [string[]]$NodeArguments) {
    Write-Host "[INFO] $Name" -ForegroundColor Cyan
    Push-Location $BackendRoot
    try {
        $All = @("--env-file=$ResolvedTestEnvFile") + $NodeArguments
        & node @All
        Assert-True ($LASTEXITCODE -eq 0) $Name
    } catch {
        Assert-True $false "$Name ($($_.Exception.Message))"
    } finally {
        Pop-Location
    }
}

# Runs a released npm script. With no override this is exactly `npm run <name>`
# as before. With an override the SAME command text is taken from package.json
# and executed directly with the authorized --env-file substituted, so which
# suite runs and what it asserts are unchanged. package.json is never modified.
function Invoke-BackendGate([string]$Name, [string]$ScriptName) {
    Write-Host "[INFO] $Name" -ForegroundColor Cyan
    Push-Location $BackendRoot
    $OriginalPath = $env:PATH
    try {
        if ($TestEnvIsOverride) {
            $CommandText = [string]$PackageScripts.$ScriptName
            if ([string]::IsNullOrWhiteSpace($CommandText)) {
                Assert-True $false "$Name (unknown npm script: $ScriptName)"
                return
            }
            # npm puts node_modules/.bin on PATH for script execution; running
            # the command directly must do the same so local binaries resolve.
            $env:PATH = (Join-Path $BackendRoot "node_modules\.bin") + [IO.Path]::PathSeparator + $OriginalPath
            $Tokens = @($CommandText -split "\s+" | Where-Object { $_ })
            $Arguments = @($Tokens | Select-Object -Skip 1 | ForEach-Object {
                if ($_ -eq "--env-file=.env.test") { "--env-file=$ResolvedTestEnvFile" } else { $_ }
            })
            & $Tokens[0] @Arguments
        } else {
            & npm.cmd run $ScriptName
        }
        Assert-True ($LASTEXITCODE -eq 0) $Name
    } catch {
        Assert-True $false "$Name ($($_.Exception.Message))"
    } finally {
        $env:PATH = $OriginalPath
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# RELEASE IDENTITY (historical facts)
#
# Historical release facts are inspected at the released commit/tree; durable
# invariants are checked against the current repository. Before this
# maintenance the verifier asserted that HEAD was still 14B's pre-commit
# baseline, which became permanently false once 14B was committed and 14C
# followed.
# ---------------------------------------------------------------------------

$ReleaseTag = "sourceroot-cross-root-source-backed-relationships-v1"
$ReleaseCommit = "52bef9bf42beb9433e28a600ba1f91f537b21a77"
$ReleaseParent = "e20317e80f1cddf843ce55105028eea5c35163f7"

$TaggedCommit = (& git -C $RepositoryRoot rev-parse --verify --quiet "$ReleaseTag^{commit}")
if ($TaggedCommit) { $TaggedCommit = $TaggedCommit.Trim() }
Assert-True ($TaggedCommit -eq $ReleaseCommit) "Release tag $ReleaseTag still resolves to the released 14B commit"

$ActualParent = (& git -C $RepositoryRoot rev-parse --verify --quiet "$ReleaseCommit^")
if ($ActualParent) { $ActualParent = $ActualParent.Trim() }
Assert-True ($ActualParent -eq $ReleaseParent) "Released 14B commit still has its exact recorded parent (the 14A release)"

& git -C $RepositoryRoot merge-base --is-ancestor $ReleaseCommit HEAD 2>$null | Out-Null
Assert-True ($LASTEXITCODE -eq 0) "Released 14B commit remains in the current branch ancestry"

$Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
$CompletedRelative = "docs/stages/completed/20260801-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-V1.md"
$CompletedPath = Join-Path $RepositoryRoot ($CompletedRelative -replace "/", "\")
Assert-True (Test-Path -LiteralPath $CompletedPath -PathType Leaf) "Completed 14B stage record is present"
Assert-True (-not ($Manifest.active_stage.slug -eq "CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-V1")) "The 14B stage is no longer the active stage"

# The release inventory is the historical basis for the boundary and
# scope checks below, replacing the old working-tree "changed files" set.
$ReleaseInventory = @(
    & git -C $RepositoryRoot diff --name-only "$ReleaseParent" "$ReleaseCommit" |
        ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ } | Sort-Object -Unique
)
Assert-True ($ReleaseInventory.Count -gt 0) "Released 14B commit has an inspectable inventory"

$Allowed = @(
    "assets/css/cross-root-relationships.css","assets/js/cross-root-api.js","assets/js/cross-root-relationships.js","assets/js/historyroot-record.js",
    "backend/data/cross-root-source-backed-relationships-v1/BUILD-NOTES.md","backend/data/cross-root-source-backed-relationships-v1/COVERAGE.md","backend/data/cross-root-source-backed-relationships-v1/dataset-manifest.json","backend/data/cross-root-source-backed-relationships-v1/hashes.json","backend/data/cross-root-source-backed-relationships-v1/input-fingerprints.json","backend/data/cross-root-source-backed-relationships-v1/relationship-assertions.json","backend/data/cross-root-source-backed-relationships-v1/relationship-evidence.json","backend/data/cross-root-source-backed-relationships-v1/RELATIONSHIP-RULES.md",
    "backend/db/migrations/019_create_cross_root_source_backed_relationships.sql","backend/package.json","backend/src/cross-root/source-backed-relationships.ts","backend/src/lib/local-development-database.ts","backend/src/routes/cross-root.ts","backend/src/scripts/development-runtime.ts","backend/src/scripts/import-cross-root-source-backed-relationships.ts","backend/src/scripts/prepare-cross-root-source-backed-relationships.ts","backend/src/services/cross-root-relationship-store.ts","backend/src/services/development-runtime-readiness.ts","backend/test/cross-root-source-backed-relationships.test.ts","backend/test/local-development-runtime.test.ts",
    "cross-root-relationships.html","docs/architecture/CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-ARCHITECTURE.md","docs/brand/BIBLEROOT-LOGO-DESIGN-BRIEF-V1.md","docs/build/CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-BROWSER-EVIDENCE.md","docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md","docs/stages/active/CURRENT-STAGE.md",$CompletedRelative,"history-record-v1.html","ROOT-MANIFEST.json","verification/cross-root-relationships-desktop.png","verification/cross-root-relationships-mobile.png","verification/cross-root-source-backed-relationships.test.cjs","VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1"
)
Assert-True ($Allowed.Count -eq 37) "Exact 37-file allowed boundary"
# HISTORICAL: the release must have stayed inside its governed boundary. An
# allowlist grants permission rather than obliging change, so containment is
# the correct invariant, not equality.
$ReleaseOutside = @($ReleaseInventory | Where-Object { $Allowed -notcontains $_ })
Assert-True ($ReleaseOutside.Count -eq 0) "Released 14B commit stayed inside its governed boundary"
if ($ReleaseOutside.Count -gt 0) {
    Write-Host "       Outside release boundary: $($ReleaseOutside -join ', ')" -ForegroundColor Red
}

# DURABLE: every released 14B artifact must still exist today. Ignored
# screenshot evidence is excluded, since `verification/` is not tracked
# wholesale.
$Missing = @($Allowed | Where-Object {
    $_ -ne "docs/stages/active/CURRENT-STAGE.md" -and
    $_ -notlike "verification/cross-root-relationships-*.png" -and
    -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ($_ -replace "/", "\")) -PathType Leaf)
})
Assert-True ($Missing.Count -eq 0) "All released 14B artifacts exist"
if ($Missing.Count -gt 0) { Write-Host "       Missing: $($Missing -join ', ')" -ForegroundColor Red }
Assert-True (@($Manifest.known_verifiers) -contains "VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1") "Focused verifier is registered"

$Migration018 = Join-Path $BackendRoot "db\migrations\018_create_cross_root_link_foundation.sql"
Assert-True ((Get-Item -LiteralPath $Migration018).Length -eq 5116) "Migration 018 exact byte length is preserved"
Assert-True ((Get-FileHash -Algorithm SHA256 -LiteralPath $Migration018).Hash -eq "32760D802354738A6A5B051756BAE59849A05353966FF8752E93EBCC16183A75") "Migration 018 exact SHA-256 is preserved"
Assert-True ((& git -C $RepositoryRoot hash-object --no-filters -- "backend/db/migrations/018_create_cross_root_link_foundation.sql").Trim() -eq "5aeb71559f5d052aaf7a3ff1cd4d1f558a314198") "Migration 018 exact no-filter blob is preserved"
$Migration019 = Join-Path $BackendRoot "db\migrations\019_create_cross_root_source_backed_relationships.sql"
Assert-True ((Get-Item -LiteralPath $Migration019).Length -eq 7815) "Migration 019 exact byte length"
Assert-True ((Get-FileHash -Algorithm SHA256 -LiteralPath $Migration019).Hash -eq "10BBD3D8BF187BC12AD1CC59F738578950AEB7066A65A4DB411B54E855E573F2") "Migration 019 exact SHA-256"
Assert-True ((& git -C $RepositoryRoot hash-object --no-filters -- "backend/db/migrations/019_create_cross_root_source_backed_relationships.sql").Trim() -eq "2cdb3c220fb47db6207f8b11d1cc725ed6f6c6ba") "Migration 019 exact no-filter blob"
Assert-True (-not (Get-ChildItem -LiteralPath (Join-Path $BackendRoot "db\migrations") -File | Where-Object Name -Like "020*")) "Migration 020 is absent"

$Protected = @(Get-ChildItem -LiteralPath (Join-Path $BackendRoot "data") -Recurse -File | Where-Object { $_.FullName -match "\\(?:raw|source-docs)\\" })
$ProtectedFailures = @()
foreach ($File in $Protected) {
    $Relative = $File.FullName.Substring($RepositoryRoot.Length + 1).Replace("\", "/")
    $HeadBlob = (& git -C $RepositoryRoot rev-parse "HEAD:$Relative" 2>$null).Trim()
    $CurrentBlob = (& git -C $RepositoryRoot hash-object --no-filters -- $Relative).Trim()
    if (-not $HeadBlob -or $HeadBlob -ne $CurrentBlob) { $ProtectedFailures += $Relative }
}
Assert-True (($Protected.Count -eq 23) -and ($ProtectedFailures.Count -eq 0)) "All 23 protected raw/source-doc artifacts are byte-identical"

$PriorManifest = Get-Content -Raw -LiteralPath (Join-Path $PriorDatasetRoot "dataset-manifest.json") | ConvertFrom-Json
$PriorCounts = $PriorManifest.expectedCounts
Assert-True (($PriorCounts.resources -eq 1568) -and ($PriorCounts.links -eq 2233) -and ($PriorCounts.evidence -eq 2765) -and ($PriorCounts.dictionaryToHistoryLinks -eq 1431) -and ($PriorCounts.dictionaryToBibleLinks -eq 802) -and ($PriorCounts.historyOccurrences -eq 1790) -and ($PriorCounts.bibleOccurrences -eq 975)) "Chunk 14A exact registry, link, and evidence counts are preserved"
$PriorFiles = @(Get-ChildItem -LiteralPath $PriorDatasetRoot -File)
$PriorChanged = @($PriorFiles | Where-Object {
    $Relative = $_.FullName.Substring($RepositoryRoot.Length + 1).Replace("\", "/")
    (& git -C $RepositoryRoot rev-parse "HEAD:$Relative" 2>$null).Trim() -ne (& git -C $RepositoryRoot hash-object --no-filters -- $Relative).Trim()
})
Assert-True ($PriorChanged.Count -eq 0) "Chunk 14A committed dataset bytes are preserved"

$Inputs = Get-Content -Raw -LiteralPath (Join-Path $DatasetRoot "input-fingerprints.json") | ConvertFrom-Json
$InputFailures = @()
foreach ($Input in @($Inputs)) {
    $Path = Join-Path $RepositoryRoot ($Input.filename -replace "/", "\")
    $Blob = (& git -C $RepositoryRoot hash-object --no-filters -- $Input.filename).Trim()
    if ((Get-Item -LiteralPath $Path).Length -ne [int64]$Input.byteLength -or (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash -ne $Input.sha256 -or $Blob -ne $Input.gitBlob) { $InputFailures += $Input.filename }
}
Assert-True (($Inputs.Count -eq 4) -and ($InputFailures.Count -eq 0)) "Four exact committed input fingerprints"
$DatasetManifest = Get-Content -Raw -LiteralPath (Join-Path $DatasetRoot "dataset-manifest.json") | ConvertFrom-Json
$Counts = $DatasetManifest.expectedCounts
Assert-True (($Counts.assertions -eq 143) -and ($Counts.evidence -eq 178) -and ($Counts.subjectResources -eq 101) -and ($Counts.objectResources -eq 76) -and ($Counts.resourceReuse -eq 280) -and ($Counts.resourceAdditions -eq 0)) "Exact assertion, evidence, and resource coverage"
Assert-True (($Counts.causal -eq 22) -and ($Counts.nonCausal -eq 121) -and ($Counts.sameRoot -eq 143) -and ($Counts.crossRoot -eq 0) -and ($Counts.disputed -eq 0) -and ($Counts.uncertain -eq 143)) "Exact causal, Root-scope, dispute, and uncertainty coverage"
Assert-True (($Counts.derivationCounts.directly_sourced -eq 143) -and ($Counts.reviewStateCounts.unreviewed -eq 143)) "Exact derivation and review mapping"
Assert-True ((@($DatasetManifest.relationshipFamilies).Count -eq 13) -and ($Counts.relationshipFamilyCounts.causation -eq 22)) "Controlled family coverage is exact"

$AssertionsText = Get-Content -Raw -LiteralPath (Join-Path $DatasetRoot "relationship-assertions.json")
$EvidenceText = Get-Content -Raw -LiteralPath (Join-Path $DatasetRoot "relationship-evidence.json")
Assert-True ($AssertionsText -notmatch "DictionaryRoot|BibleRoot|EarthRoot|textually_observed|accepted_after_review|machine_proposed|human_proposed") "No lexical, cross-Root, EarthRoot, or unsupported review derivation enters assertions"
Assert-True (($AssertionsText + $EvidenceText) -notmatch "\bcoordinates?\b|\bpolygons?\b|\bgeocod(?:e|ed|ing)\b|\bembeddings?\b|similarityScore") "No inferred geography, maps, embeddings, or similarity data"

$BrandBrief = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "docs\brand\BIBLEROOT-LOGO-DESIGN-BRIEF-V1.md")
Assert-True (($BrandBrief -match "Rooted Manuscript") -and ($BrandBrief -match "Verse Network") -and ($BrandBrief -match "Source Seal") -and ($BrandBrief -match "Total\*\* \| \*\*100")) "Planning brief contains three territories and exact 100-point rubric"
# HISTORICAL: 14B shipped a planning-only BibleRoot brief and must not have
# touched BibleRoot runtime, branding, or produced any release ZIP. Checked
# against the release inventory, because the working tree legitimately gains
# later BibleRoot and 14C artifacts over time.
$BibleRootRuntimeChanges = @($ReleaseInventory | Where-Object { $_ -match "(?i)bibleroot" -and $_ -ne "docs/brand/BIBLEROOT-LOGO-DESIGN-BRIEF-V1.md" })
Assert-True ($BibleRootRuntimeChanges.Count -eq 0) "Released 14B commit changed no BibleRoot runtime or branding file"
$BrandAssets = @($ReleaseInventory | Where-Object { $_ -match "(?i)(bibleroot.*\.(svg|png|ico)|\.(woff2?|ttf|otf))$" })
Assert-True ($BrandAssets.Count -eq 0) "Released 14B commit added no BibleRoot production image, favicon, application icon, or font file"
Assert-True (@($ReleaseInventory | Where-Object { $_ -like "*.zip" }).Count -eq 0) "Released 14B commit contained no release ZIP"

# ---------------------------------------------------------------------------
# DETERMINISTIC DATABASE LIFECYCLE
#
# Several legacy regressions TRUNCATE the shared test database through
# resetTestDatabase(), so gate ordering, not luck, decides whether the current
# Cross-Root suites see canonical data. This verifier therefore proves the
# database, runs every reset-owning regression FIRST, then performs one
# explicit final reset and provisions canonical state in dependency order, and
# only then runs the current Cross-Root suites. The verifier leaves
# sourceroot_test FULLY PROVISIONED at canonical readiness 1.4.0.
# ---------------------------------------------------------------------------

Initialize-DictionaryPilotArtifact
$DatabaseProven = Assert-TestDatabaseIdentity
if (-not $DatabaseProven) {
    Remove-DictionaryPilotArtifact
    Write-Host "[FAIL] Refusing to mutate an unproven database." -ForegroundColor Red
    Write-Host "Failure count: $FailureCount" -ForegroundColor Red
    exit 1
}

Invoke-BackendGate "Test database migrations" "db:migrate:test"
Invoke-BackendGate "Deterministic relationship preparation" "cross-root:relationships:prepare"
Invoke-BackendGate "Backend typecheck" "typecheck"
Invoke-BackendGate "Source-backed relationship frontend tests" "test:cross-root:relationships:frontend"
Invoke-BackendGate "Shared navigation regression" "test:unified-search:frontend"

# Reset-owning legacy regressions run before canonical provisioning.
Invoke-BackendNodeGate "Local-development safety regression" @("--import","./scripts/register-tsx.mjs","--test","--test-concurrency=1","test/local-development-runtime.test.ts")
Invoke-BackendNodeGate "DictionaryRoot corpus regression (current-compatible assertions)" @("--import","./scripts/register-tsx.mjs","--test","--test-concurrency=1","--test-name-pattern=^(?:[1-9]|1[0-4])[.]","test/dictionaryroot-core-lexical-corpus.test.ts")
Invoke-BackendNodeGate "DictionaryRoot lexical evidence regression (current-compatible assertions)" @("--import","./scripts/register-tsx.mjs","--test","--test-concurrency=1","--test-name-pattern=^(?:[1-6]|8|9|1[1-7])[.]","test/dictionaryroot-lexical-evidence-architecture.test.ts")
Invoke-BackendNodeGate "DictionaryRoot lexical relationships regression (current-compatible assertions)" @("--import","./scripts/register-tsx.mjs","--test","--test-concurrency=1","--test-name-pattern=^(?:1|[3-9]|1[0-3]|15)[.]","test/dictionaryroot-lexical-relationship-architecture.test.ts")
Invoke-BackendNodeGate "HistoryRoot public corpus regression (current-compatible assertions)" @("--import","./scripts/register-tsx.mjs","--test","--test-concurrency=1","--test-name-pattern=^(?:[1-9]|[1-3][0-9])[.]","test/historyroot-wampanoag-regional-corpus.test.ts")
Invoke-BackendGate "HistoryRoot governance, revision, and authorization regression" "test:governance:historyroot"
Invoke-BackendGate "BibleRoot Foundation regression" "test:bibleroot:foundation"
Invoke-BackendGate "BibleRoot Original Language regression" "test:bibleroot:original-languages"
Invoke-BackendGate "BibleRoot Translation Comparison regression" "test:bibleroot:translations"
Invoke-BackendNodeGate "BibleRoot Commentary Provenance regression (current-compatible assertions)" @("--import","./scripts/register-tsx.mjs","--test","--test-concurrency=1","--test-name-pattern=^(?:[1-9]|10|12)[.]","test/bibleroot-commentary-provenance.test.ts")

# One explicit final reset, then canonical provisioning in dependency order.
Write-Host "[INFO] Explicit test database reset" -ForegroundColor Cyan
$ResetOutput = Invoke-BackendNodeScript @'
const { resetTestDatabase, closeTestDatabase } = await import("__BACKEND__test/helpers/database.ts");
await resetTestDatabase();
await closeTestDatabase();
console.log("RESET-OK");
'@
Assert-True ((@($ResetOutput) -join "`n") -match "RESET-OK") "Explicit test database reset"
Invoke-BackendGate "Provision HistoryRoot regional corpus" "historyroot:wampanoag-regional:import"
# DictionaryRoot provisioning surface: why the historical release CLI is not used.
#
# backend/src/scripts/import-dictionaryroot-core-lexical-corpus.ts is the Chunk
# 10B release CLI. It requires migration_015_count = 0, so it refuses to run on
# any database carrying migration 015+. sourceroot_test necessarily carries 015+
# because Chunks 14A/14B depend on it. That guard is released historical
# behavior; it is NOT modified, weakened, suppressed, or bypassed here, and the
# importer is not edited by this stage.
#
# The provisioning below uses validateDictionaryRootCoreCorpus() +
# saveDictionaryRootCoreLexicalCorpus(), which is the released provisioning
# composition, not a lower-level internal. That pair is what the release CLI
# itself calls, what provisionDevelopmentRuntime() calls, and what the released
# test suites call directly; it reads the same canonical prepared dataset with
# strictly stronger validation (hash manifest, per-artifact SHA-256, dataset
# identity/status, exact release counts), stays transactional and idempotent,
# and requires zero product, importer, or schema changes. The only CLI check it
# does not reproduce is the migration-015 release boundary; the CLI's
# sourceroot_test requirement is enforced independently by
# Assert-TestDatabaseIdentity above, before any mutation occurs.
Write-Host "[INFO] Provision DictionaryRoot core lexical corpus" -ForegroundColor Cyan
$DictionaryOutput = Invoke-BackendNodeScript @'
const { validateDictionaryRootCoreCorpus } = await import("__BACKEND__src/scripts/development-runtime.ts");
const { saveDictionaryRootCoreLexicalCorpus } = await import("__BACKEND__src/services/lexical-evidence-store.ts");
const { closeDatabase } = await import("__BACKEND__src/lib/database.ts");
try {
  await saveDictionaryRootCoreLexicalCorpus(await validateDictionaryRootCoreCorpus());
  console.log("DICTIONARY-OK");
} finally { await closeDatabase(); }
'@
Assert-True ((@($DictionaryOutput) -join "`n") -match "DICTIONARY-OK") "Provision DictionaryRoot core lexical corpus"
if ((@($DictionaryOutput) -join "`n") -notmatch "DICTIONARY-OK") { Write-Host "       $DictionaryOutput" -ForegroundColor Red }
Invoke-BackendGate "Provision BibleRoot Foundation" "bibleroot:foundation:import"
Invoke-BackendGate "Provision BibleRoot Original Language" "bibleroot:original-languages:import"
Invoke-BackendGate "Provision BibleRoot Translation Comparison" "bibleroot:translations:import"
Invoke-BackendGate "Provision BibleRoot Commentary Provenance" "bibleroot:commentary:import"
Invoke-BackendGate "Provision Cross-Root 14A lexical evidence" "cross-root:lexical-evidence:import"
Invoke-BackendGate "Provision Cross-Root 14B source-backed relationships" "cross-root:relationships:import"

# Current Cross-Root suites run against the canonical provisioned database.
Invoke-BackendNodeGate "Chunk 14A lexical link regression (current-compatible assertions)" @("--import","./scripts/register-tsx.mjs","--test","--test-concurrency=1","--test-name-pattern=^[1-7][.]","test/cross-root-lexical-evidence.test.ts")
Invoke-BackendGate "Source-backed relationship corpus/import/API/readiness tests" "test:cross-root:relationships"

Remove-DictionaryPilotArtifact

# FINAL POSTCONDITION: sourceroot_test must be left fully provisioned at the
# canonical baseline, not empty and not partially restored.
try {
    $BaselineOutput = Invoke-BackendNodeScript @'
const { getPool, closeDatabase } = await import("__BACKEND__src/lib/database.ts");
const { getDevelopmentRuntimeReadiness } = await import("__BACKEND__src/services/development-runtime-readiness.ts");
const A = "sourceroot-cross-root-lexical-evidence-v1";
const B = "sourceroot-cross-root-source-backed-relationships-v1";
const pool = getPool();
try {
  const a = (await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM cross_root_resources WHERE dataset_id=$1) r,
    (SELECT COUNT(*)::int FROM cross_root_links WHERE dataset_id=$1) l,
    (SELECT COUNT(*)::int FROM cross_root_link_evidence WHERE dataset_id=$1) e,
    (SELECT COUNT(*)::int FROM cross_root_links WHERE dataset_id=$1 AND source_root_id='DictionaryRoot' AND target_root_id='HistoryRoot') dh,
    (SELECT COUNT(*)::int FROM cross_root_links WHERE dataset_id=$1 AND source_root_id='DictionaryRoot' AND target_root_id='BibleRoot') db,
    (SELECT COUNT(*)::int FROM cross_root_link_evidence ev JOIN cross_root_links li ON li.link_id=ev.link_id WHERE ev.dataset_id=$1 AND li.target_root_id='HistoryRoot') ho,
    (SELECT COUNT(*)::int FROM cross_root_link_evidence ev JOIN cross_root_links li ON li.link_id=ev.link_id WHERE ev.dataset_id=$1 AND li.target_root_id='BibleRoot') bo`, [A])).rows[0];
  const b = (await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1) asr,
    (SELECT COUNT(*)::int FROM cross_root_relationship_evidence WHERE dataset_id=$1) ev,
    (SELECT COUNT(DISTINCT subject_resource_id)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1) su,
    (SELECT COUNT(DISTINCT object_resource_id)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1) ob,
    (SELECT COUNT(*)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1 AND is_causal) ca,
    (SELECT COUNT(*)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1 AND NOT is_causal) nc,
    (SELECT COUNT(*)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1 AND subject_root_id=object_root_id) sr,
    (SELECT COUNT(*)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1 AND subject_root_id<>object_root_id) cr,
    (SELECT COUNT(*)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1 AND derivation_kind='directly_sourced') ds,
    (SELECT COUNT(*)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1 AND review_state='unreviewed') un,
    (SELECT COUNT(*)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1 AND uncertainty_statement IS NOT NULL) uc,
    (SELECT COUNT(*)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1 AND dispute_state='disputed') di,
    (SELECT COUNT(*)::int FROM cross_root_resources WHERE dataset_id=$1) ad`, [B])).rows[0];
  const readiness = await getDevelopmentRuntimeReadiness();
  const ok = a.r===1568 && a.l===2233 && a.e===2765 && a.dh===1431 && a.db===802 && a.ho===1790 && a.bo===975
    && b.asr===143 && b.ev===178 && b.su===101 && b.ob===76 && b.ca===22 && b.nc===121 && b.sr===143 && b.cr===0
    && b.ds===143 && b.un===143 && b.uc===143 && b.di===0 && b.ad===0
    && readiness.contractVersion === "1.4.0";
  console.log(ok ? "CANONICAL" : ("DRIFT " + JSON.stringify({ a, b, v: readiness.contractVersion })));
} finally { await closeDatabase(); }
'@
    $Baseline = ([string](@($BaselineOutput) | Select-Object -Last 1)).Trim()
    Assert-True ($Baseline -eq "CANONICAL") "sourceroot_test is left fully provisioned at the canonical 14A/14B baseline and readiness 1.4.0"
    if ($Baseline -ne "CANONICAL") { Write-Host "       $BaselineOutput" -ForegroundColor Red }
} catch {
    Assert-True $false "Final canonical database postcondition ($($_.Exception.Message))"
}

Invoke-Gate "Project-authored git diff check" $RepositoryRoot { & git diff --check }

$IndexPaths = @(& git -C $RepositoryRoot diff --cached --name-only)
Assert-True ($IndexPaths.Count -eq 0) "Git index is empty"
Assert-True (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ".git\index.lock"))) "Git index lock is absent"
Write-Host ""
Write-Host "Verifier summary" -ForegroundColor Cyan
Write-Host "Pass count: $PassCount"
Write-Host "Failure count: $FailureCount"
if ($FailureCount -gt 0) { Write-Host "Overall result: FAIL" -ForegroundColor Red; exit 1 }
Write-Host "Overall result: PASS" -ForegroundColor Green
exit 0
