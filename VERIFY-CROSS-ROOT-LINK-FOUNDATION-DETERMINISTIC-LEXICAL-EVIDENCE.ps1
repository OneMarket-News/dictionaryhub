[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepositoryRoot = $PSScriptRoot
$BackendRoot = Join-Path $RepositoryRoot "backend"
$DatasetRoot = Join-Path $BackendRoot "data\cross-root-link-foundation-v1"
$PassCount = 0
$FailureCount = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) { $script:PassCount++; Write-Host "[PASS] $Message" -ForegroundColor Green }
    else { $script:FailureCount++; Write-Host "[FAIL] $Message" -ForegroundColor Red }
}
function Invoke-Gate([string]$Name, [string]$WorkingDirectory, [scriptblock]$Command) {
    Write-Host "[INFO] $Name" -ForegroundColor Cyan
    Push-Location $WorkingDirectory
    try { & $Command; Assert-True ($LASTEXITCODE -eq 0) $Name } catch { Assert-True $false "$Name ($($_.Exception.Message))" } finally { Pop-Location }
}

$Branch = (& git -C $RepositoryRoot branch --show-current).Trim()
$Head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
$Parent = (& git -C $RepositoryRoot rev-parse HEAD^).Trim()
$Tags = @(& git -C $RepositoryRoot tag --points-at HEAD)
Assert-True ($Branch -eq "release/historyroot-alpha-integration-v1") "Expected branch"
Assert-True ($Head -eq "a4964dcf2ea1d4a330be8887fe189f2475782612") "Baseline HEAD is unchanged"
Assert-True ($Parent -eq "5c81eeec2cc5d38799179c90000cdd158f80e26d") "Baseline parent is unchanged"
Assert-True (($Tags.Count -eq 1) -and ($Tags[0] -eq "sourceroot-bibleroot-commentary-interpretation-provenance-v1")) "No commit or tag was created"

$Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
$CompletedRelative = "docs/stages/completed/20260801-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-V1.md"
$CompletedPath = Join-Path $RepositoryRoot ($CompletedRelative -replace "/", "\")
$IsActive = $Manifest.active_stage.status -eq "active" -and $Manifest.active_stage.slug -eq "CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-V1"
$IsInactive = $Manifest.active_stage.status -eq "inactive" -and (Test-Path -LiteralPath $CompletedPath -PathType Leaf)
Assert-True ($IsActive -or $IsInactive) "Stage lifecycle is active or completed/inactive"

$Allowed = @(
    "assets/css/cross-root-links.css","assets/js/bibleroot-passage.js","assets/js/cross-root-api.js","assets/js/cross-root-links.js","assets/js/dictionaryroot-concept.js","assets/js/historyroot-record.js",
    "backend/data/cross-root-link-foundation-v1/BUILD-NOTES.md","backend/data/cross-root-link-foundation-v1/COVERAGE.md","backend/data/cross-root-link-foundation-v1/dataset-manifest.json","backend/data/cross-root-link-foundation-v1/evidence.json","backend/data/cross-root-link-foundation-v1/hashes.json","backend/data/cross-root-link-foundation-v1/input-fingerprints.json","backend/data/cross-root-link-foundation-v1/links.json","backend/data/cross-root-link-foundation-v1/MATCHING-RULES.md","backend/data/cross-root-link-foundation-v1/resource-registry.json",
    "backend/db/migrations/018_create_cross_root_link_foundation.sql","backend/package.json","backend/src/app.ts","backend/src/cross-root/lexical-evidence.ts","backend/src/lib/local-development-database.ts","backend/src/routes/cross-root.ts","backend/src/scripts/development-runtime.ts","backend/src/scripts/import-cross-root-lexical-evidence.ts","backend/src/scripts/prepare-cross-root-lexical-evidence.ts","backend/src/services/cross-root-store.ts","backend/src/services/development-runtime-readiness.ts","backend/test/bibleroot-commentary-provenance.test.ts","backend/test/cross-root-lexical-evidence.test.ts","backend/test/local-development-runtime.test.ts",
    "bibleroot-passage.html","concept-v2.html","cross-root-links.html","docs/architecture/CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-ARCHITECTURE.md","docs/build/CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-BROWSER-EVIDENCE.md","docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md","docs/stages/active/CURRENT-STAGE.md",$CompletedRelative,"history-record-v1.html","ROOT-MANIFEST.json","verification/cross-root-link-foundation.test.cjs","verification/cross-root-links-desktop.png","verification/cross-root-links-mobile.png","VERIFY-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE.ps1"
)
Assert-True ($Allowed.Count -eq 43) "Exact 43-file allowed boundary"
if ($IsActive) { Assert-True ([string]::Join("|", @($Manifest.active_stage.allowed_files | Sort-Object)) -eq [string]::Join("|", @($Allowed | Sort-Object))) "Manifest allowed boundary is exact" }
$Changed = @(
    & git -C $RepositoryRoot diff --name-only
    & git -C $RepositoryRoot diff --cached --name-only
    & git -C $RepositoryRoot ls-files --others --exclude-standard
    & git -C $RepositoryRoot ls-files --others --ignored --exclude-standard -- "verification/cross-root*"
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

$Migration = Join-Path $BackendRoot "db\migrations\018_create_cross_root_link_foundation.sql"
Assert-True ((Get-Item -LiteralPath $Migration).Length -eq 5116) "Migration 018 exact byte length"
Assert-True ((Get-FileHash -Algorithm SHA256 -LiteralPath $Migration).Hash -eq "32760D802354738A6A5B051756BAE59849A05353966FF8752E93EBCC16183A75") "Migration 018 exact SHA-256"
Assert-True ((& git -C $RepositoryRoot hash-object --no-filters -- "backend/db/migrations/018_create_cross_root_link_foundation.sql").Trim() -eq "5aeb71559f5d052aaf7a3ff1cd4d1f558a314198") "Migration 018 exact no-filter blob"
Assert-True (-not (Get-ChildItem -LiteralPath (Join-Path $BackendRoot "db\migrations") -File | Where-Object Name -Like "019*")) "Migration 019 is absent"

$Inputs = Get-Content -Raw -LiteralPath (Join-Path $DatasetRoot "input-fingerprints.json") | ConvertFrom-Json
$InputFailures = @()
foreach ($Input in @($Inputs)) {
    $Path = Join-Path $RepositoryRoot ($Input.filename -replace "/", "\")
    $Blob = (& git -C $RepositoryRoot hash-object --no-filters -- $Input.filename).Trim()
    if ((Get-Item -LiteralPath $Path).Length -ne [int64]$Input.byteLength -or (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash -ne $Input.sha256 -or $Blob -ne $Input.gitBlob) { $InputFailures += $Input.filename }
}
Assert-True (($Inputs.Count -eq 8) -and ($InputFailures.Count -eq 0)) "Eight exact committed input fingerprints"

$Protected = @(Get-ChildItem -LiteralPath (Join-Path $BackendRoot "data") -Recurse -File | Where-Object { $_.FullName -match "\\(?:raw|source-docs)\\" })
$ProtectedFailures = @()
foreach ($File in $Protected) {
    $Relative = $File.FullName.Substring($RepositoryRoot.Length + 1).Replace("\", "/")
    $HeadBlob = (& git -C $RepositoryRoot rev-parse "HEAD:$Relative" 2>$null).Trim()
    $CurrentBlob = (& git -C $RepositoryRoot hash-object --no-filters -- $Relative).Trim()
    if (-not $HeadBlob -or $HeadBlob -ne $CurrentBlob) { $ProtectedFailures += $Relative }
}
Assert-True (($Protected.Count -eq 23) -and ($ProtectedFailures.Count -eq 0)) "All 23 protected raw/source-doc artifacts are preserved"

$DatasetManifest = Get-Content -Raw -LiteralPath (Join-Path $DatasetRoot "dataset-manifest.json") | ConvertFrom-Json
$Counts = $DatasetManifest.expectedCounts
Assert-True (($Counts.resources -eq 1568) -and ($Counts.links -eq 2233) -and ($Counts.evidence -eq 2765) -and ($Counts.dictionaryToBibleLinks -eq 802) -and ($Counts.dictionaryToHistoryLinks -eq 1431) -and ($Counts.bibleOccurrences -eq 975) -and ($Counts.historyOccurrences -eq 1790)) "Exact governed corpus counts"
$Authored = @(
    Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "src\cross-root\lexical-evidence.ts")
    Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "src\services\cross-root-store.ts")
    Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "assets\js\cross-root-links.js")
) -join "`n"
Assert-True ($Authored -notmatch "semanticSimilarity|confidenceScore|importanceScore|inferredSense|sameMeaning|theologicalMeaning|historicalInfluence|embedding") "No semantic scores, inferred senses, equivalence, influence, or embeddings"
Assert-True (@($Changed | Where-Object { $_ -match "14B|14C|entity-link|research-orchestration" }).Count -eq 0) "No Chunk 14B or 14C work"
Assert-True (@($Changed | Where-Object { $_ -like "*.zip" }).Count -eq 0) "No SourceRoot release ZIP"

Invoke-Gate "Test database migrations" $BackendRoot { & npm.cmd run db:migrate:test }
Invoke-Gate "Deterministic preparation" $BackendRoot { & npm.cmd run cross-root:lexical-evidence:prepare }
Invoke-Gate "Backend typecheck" $BackendRoot { & npm.cmd run typecheck }
Invoke-Gate "Cross-Root matching/corpus/import/API/readiness tests" $BackendRoot { & npm.cmd run test:cross-root:lexical-evidence }
Invoke-Gate "Cross-Root frontend tests" $BackendRoot { & npm.cmd run test:cross-root:frontend }
Invoke-Gate "Local-development safety regression" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 test/local-development-runtime.test.ts }
Invoke-Gate "DictionaryRoot corpus regression (current compatible assertions)" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 --test-name-pattern="^(?:[1-9]|1[0-4])[.]" test/dictionaryroot-core-lexical-corpus.test.ts }
Invoke-Gate "HistoryRoot governance regression" $BackendRoot { & npm.cmd run test:governance:historyroot }
Invoke-Gate "BibleRoot Foundation regression" $BackendRoot { & npm.cmd run test:bibleroot:foundation }
Invoke-Gate "BibleRoot Original Language regression" $BackendRoot { & npm.cmd run test:bibleroot:original-languages }
Invoke-Gate "BibleRoot Translation Comparison regression" $BackendRoot { & npm.cmd run test:bibleroot:translations }
Invoke-Gate "BibleRoot Commentary Provenance regression" $BackendRoot { & npm.cmd run test:bibleroot:commentary }
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
