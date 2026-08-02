[CmdletBinding()]
param()

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

$Branch = (& git -C $RepositoryRoot branch --show-current).Trim()
$Head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
$Parent = (& git -C $RepositoryRoot rev-parse HEAD^).Trim()
$Tags = @(& git -C $RepositoryRoot tag --points-at HEAD)
Assert-True ($Branch -eq "release/historyroot-alpha-integration-v1") "Corrected release branch"
Assert-True ($Head -eq "e20317e80f1cddf843ce55105028eea5c35163f7") "Corrected release HEAD remains unchanged"
Assert-True ($Parent -eq "a4964dcf2ea1d4a330be8887fe189f2475782612") "Corrected release parent remains unchanged"
Assert-True (($Tags.Count -eq 1) -and ($Tags[0] -eq "sourceroot-cross-root-link-foundation-v1")) "No commit or tag was created"

$Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
$CompletedRelative = "docs/stages/completed/20260801-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-V1.md"
$CompletedPath = Join-Path $RepositoryRoot ($CompletedRelative -replace "/", "\")
$IsActive = $Manifest.active_stage.status -eq "active" -and $Manifest.active_stage.slug -eq "CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-V1"
$IsInactive = $Manifest.active_stage.status -eq "inactive" -and (Test-Path -LiteralPath $CompletedPath -PathType Leaf)
Assert-True ($IsActive -or $IsInactive) "Stage lifecycle is active or completed/inactive"

$Allowed = @(
    "assets/css/cross-root-relationships.css","assets/js/cross-root-api.js","assets/js/cross-root-relationships.js","assets/js/historyroot-record.js",
    "backend/data/cross-root-source-backed-relationships-v1/BUILD-NOTES.md","backend/data/cross-root-source-backed-relationships-v1/COVERAGE.md","backend/data/cross-root-source-backed-relationships-v1/dataset-manifest.json","backend/data/cross-root-source-backed-relationships-v1/hashes.json","backend/data/cross-root-source-backed-relationships-v1/input-fingerprints.json","backend/data/cross-root-source-backed-relationships-v1/relationship-assertions.json","backend/data/cross-root-source-backed-relationships-v1/relationship-evidence.json","backend/data/cross-root-source-backed-relationships-v1/RELATIONSHIP-RULES.md",
    "backend/db/migrations/019_create_cross_root_source_backed_relationships.sql","backend/package.json","backend/src/cross-root/source-backed-relationships.ts","backend/src/lib/local-development-database.ts","backend/src/routes/cross-root.ts","backend/src/scripts/development-runtime.ts","backend/src/scripts/import-cross-root-source-backed-relationships.ts","backend/src/scripts/prepare-cross-root-source-backed-relationships.ts","backend/src/services/cross-root-relationship-store.ts","backend/src/services/development-runtime-readiness.ts","backend/test/cross-root-source-backed-relationships.test.ts","backend/test/local-development-runtime.test.ts",
    "cross-root-relationships.html","docs/architecture/CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-ARCHITECTURE.md","docs/brand/BIBLEROOT-LOGO-DESIGN-BRIEF-V1.md","docs/build/CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-BROWSER-EVIDENCE.md","docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md","docs/stages/active/CURRENT-STAGE.md",$CompletedRelative,"history-record-v1.html","ROOT-MANIFEST.json","verification/cross-root-relationships-desktop.png","verification/cross-root-relationships-mobile.png","verification/cross-root-source-backed-relationships.test.cjs","VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1"
)
Assert-True ($Allowed.Count -eq 37) "Exact 37-file allowed boundary"
if ($IsActive) {
    Assert-True ([string]::Join("|", @($Manifest.active_stage.allowed_files | Sort-Object)) -eq [string]::Join("|", @($Allowed | Sort-Object))) "Manifest allowed boundary is exact"
}
$Changed = @(
    & git -C $RepositoryRoot diff --name-only
    & git -C $RepositoryRoot diff --cached --name-only
    & git -C $RepositoryRoot ls-files --others --exclude-standard
    & git -C $RepositoryRoot ls-files --others --ignored --exclude-standard -- "verification/cross-root-relationships-*" "verification/cross-root-source-backed-relationships.test.cjs"
) | ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ } | Sort-Object -Unique
$Outside = @($Changed | Where-Object { $Allowed -notcontains $_ })
Assert-True ($Outside.Count -eq 0) "All changed and ignored artifacts are within the allowed boundary"
$Missing = @($Allowed | Where-Object {
    $_ -ne "docs/stages/active/CURRENT-STAGE.md" -and $_ -ne $CompletedRelative -and
    -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ($_ -replace "/", "\")) -PathType Leaf)
})
if ($IsActive) { $Missing = @($Missing | Where-Object { $_ -ne $CompletedRelative }) }
if ($IsInactive) { $Missing = @($Missing | Where-Object { $_ -ne "docs/stages/active/CURRENT-STAGE.md" }) }
Assert-True ($Missing.Count -eq 0) "All required stage and ignored artifacts exist"
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
$BibleRootRuntimeChanges = @($Changed | Where-Object { $_ -match "(?i)bibleroot" -and $_ -ne "docs/brand/BIBLEROOT-LOGO-DESIGN-BRIEF-V1.md" })
Assert-True ($BibleRootRuntimeChanges.Count -eq 0) "No current BibleRoot runtime or branding file changed"
$BrandAssets = @($Changed | Where-Object { $_ -match "(?i)(bibleroot.*\.(svg|png|ico)|\.(woff2?|ttf|otf))$" })
Assert-True ($BrandAssets.Count -eq 0) "No BibleRoot production image, favicon, application icon, or font file was added"
Assert-True (@($Changed | Where-Object { $_ -like "*.zip" }).Count -eq 0) "No release ZIP"

Invoke-Gate "Test database migrations" $BackendRoot { & npm.cmd run db:migrate:test }
Invoke-Gate "Deterministic relationship preparation" $BackendRoot { & npm.cmd run cross-root:relationships:prepare }
Invoke-Gate "Backend typecheck" $BackendRoot { & npm.cmd run typecheck }
Invoke-Gate "Source-backed relationship corpus/import/API/readiness tests" $BackendRoot { & npm.cmd run test:cross-root:relationships }
Invoke-Gate "Source-backed relationship frontend tests" $BackendRoot { & npm.cmd run test:cross-root:relationships:frontend }
Invoke-Gate "Local-development safety regression" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 test/local-development-runtime.test.ts }
Invoke-Gate "DictionaryRoot corpus regression (current-compatible assertions)" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 --test-name-pattern="^(?:[1-9]|1[0-4])[.]" test/dictionaryroot-core-lexical-corpus.test.ts }
Invoke-Gate "DictionaryRoot lexical evidence regression (current-compatible assertions)" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 --test-name-pattern="^(?:[1-6]|8|9|1[1-7])[.]" test/dictionaryroot-lexical-evidence-architecture.test.ts }
Invoke-Gate "DictionaryRoot lexical relationships regression (current-compatible assertions)" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 --test-name-pattern="^(?:1|[3-9]|1[0-3]|15)[.]" test/dictionaryroot-lexical-relationship-architecture.test.ts }
Invoke-Gate "Chunk 14A lexical link regression (current-compatible assertions)" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 --test-name-pattern="^[1-7][.]" test/cross-root-lexical-evidence.test.ts }
Invoke-Gate "HistoryRoot public corpus regression (current-compatible assertions)" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 --test-name-pattern="^(?:[1-9]|[1-3][0-9])[.]" test/historyroot-wampanoag-regional-corpus.test.ts }
Invoke-Gate "HistoryRoot governance, revision, and authorization regression" $BackendRoot { & npm.cmd run test:governance:historyroot }
Invoke-Gate "BibleRoot Foundation regression" $BackendRoot { & npm.cmd run test:bibleroot:foundation }
Invoke-Gate "BibleRoot Original Language regression" $BackendRoot { & npm.cmd run test:bibleroot:original-languages }
Invoke-Gate "BibleRoot Translation Comparison regression" $BackendRoot { & npm.cmd run test:bibleroot:translations }
Invoke-Gate "BibleRoot Commentary Provenance regression (current-compatible assertions)" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 --test-name-pattern="^(?:[1-9]|10|12)[.]" test/bibleroot-commentary-provenance.test.ts }
Invoke-Gate "Shared navigation regression" $BackendRoot { & npm.cmd run test:unified-search:frontend }
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
