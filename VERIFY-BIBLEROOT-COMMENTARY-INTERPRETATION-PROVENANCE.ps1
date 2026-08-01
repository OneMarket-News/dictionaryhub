[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepositoryRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$BackendRoot = Join-Path $RepositoryRoot "backend"
$DatasetRoot = Join-Path $BackendRoot "data\bibleroot-commentary-interpretation-provenance-v1"
$PassCount = 0
$FailureCount = 0

function Pass([string]$Message) { $script:PassCount += 1; Write-Host "[PASS] $Message" -ForegroundColor Green }
function Fail([string]$Message) { $script:FailureCount += 1; Write-Host "[FAIL] $Message" -ForegroundColor Red }
function Assert-True([bool]$Condition, [string]$Message) { if ($Condition) { Pass $Message } else { Fail $Message } }
function Invoke-Gate([string]$Name, [string]$WorkingDirectory, [scriptblock]$Command) {
    Push-Location $WorkingDirectory
    try {
        & $Command
        if ($LASTEXITCODE -eq 0) { Pass $Name } else { Fail "$Name (exit $LASTEXITCODE)" }
    } catch { Fail "$Name ($($_.Exception.Message))" } finally { Pop-Location }
}

Write-Host "BibleRoot Commentary and Interpretation Provenance v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"

$Branch = (& git -C $RepositoryRoot branch --show-current).Trim()
$Head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
$Parent = (& git -C $RepositoryRoot rev-parse HEAD^).Trim()
$Tags = @(& git -C $RepositoryRoot tag --points-at HEAD)
Assert-True ($Branch -eq "release/historyroot-alpha-integration-v1") "Expected branch"
Assert-True ($Head -eq "5c81eeec2cc5d38799179c90000cdd158f80e26d") "Expected unchanged baseline HEAD"
Assert-True ($Parent -eq "8661c2948b340458b8f1ab933a4e553614ff163e") "Expected baseline parent"
Assert-True (($Tags.Count -eq 1) -and ($Tags[0] -eq "sourceroot-bibleroot-translation-comparison-v1")) "No commit or tag was created or changed"

$Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
$CompletedRelative = "docs/stages/completed/20260801-BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-V1.md"
$CompletedPath = Join-Path $RepositoryRoot ($CompletedRelative -replace "/", "\")
$IsExpectedActive = $Manifest.active_stage.status -eq "active" -and $Manifest.active_stage.slug -eq "BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-V1"
$IsExpectedInactive = $Manifest.active_stage.status -eq "inactive" -and (Test-Path -LiteralPath $CompletedPath -PathType Leaf)
Assert-True ($IsExpectedActive -or $IsExpectedInactive) "Stage lifecycle is expected active or completed/inactive"

$Allowed = @(
    "assets/css/bibleroot-commentary.css",
    "assets/js/bibleroot-api.js",
    "assets/js/bibleroot-commentary.js",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/ACQUISITION-NOTES.md",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/dataset-manifest.json",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/hashes.json",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/IMPORT-NOTES.md",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/normalized/jfb.json",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/normalized/mhc.json",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/PREPARATION-NOTES.md",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/raw/JFB.zip",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/raw/MHC.zip",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/REJECTED-SOURCES.md",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/rights-metadata.json",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/source-docs/crosswire-jfb-module.html",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/source-docs/crosswire-mhc-module.html",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/source-docs/crosswire-rawzip-index.html",
    "backend/data/bibleroot-commentary-interpretation-provenance-v1/source-metadata.json",
    "backend/db/migrations/017_create_bibleroot_commentary_provenance.sql",
    "backend/package.json",
    "backend/src/bibleroot/commentary-provenance.ts",
    "backend/src/lib/local-development-database.ts",
    "backend/src/routes/bibleroot.ts",
    "backend/src/scripts/development-runtime.ts",
    "backend/src/scripts/import-bibleroot-commentary-provenance.ts",
    "backend/src/scripts/prepare-bibleroot-commentary-provenance.ts",
    "backend/src/services/bibleroot-store.ts",
    "backend/src/services/development-runtime-readiness.ts",
    "backend/test/bibleroot-commentary-provenance.test.ts",
    "backend/test/bibleroot-translation-comparison.test.ts",
    "backend/test/local-development-runtime.test.ts",
    "bibleroot.html",
    "bibleroot-commentary.html",
    "bibleroot-compare.html",
    "bibleroot-passage.html",
    "docs/architecture/BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-ARCHITECTURE.md",
    "docs/build/BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-BROWSER-EVIDENCE.md",
    "docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md",
    "docs/stages/active/CURRENT-STAGE.md",
    $CompletedRelative,
    "ROOT-MANIFEST.json",
    "verification/bibleroot-commentary-desktop.png",
    "verification/bibleroot-commentary-mobile.png",
    "verification/bibleroot-commentary-provenance.test.cjs",
    "VERIFY-BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE.ps1"
)
Assert-True ($Allowed.Count -eq 45) "Exact 45-file allowed boundary declared"
if ($IsExpectedActive) {
    $Declared = @($Manifest.active_stage.allowed_files | Sort-Object)
    Assert-True ([string]::Join("|", $Declared) -eq [string]::Join("|", ($Allowed | Sort-Object))) "Manifest allowed boundary is exact"
}
$Changed = @(
    & git -C $RepositoryRoot diff --name-only
    & git -C $RepositoryRoot diff --cached --name-only
    & git -C $RepositoryRoot ls-files --others --exclude-standard
    & git -C $RepositoryRoot ls-files --others --ignored --exclude-standard -- "verification/bibleroot-commentary*"
) | ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ } | Sort-Object -Unique
$Outside = @($Changed | Where-Object { $Allowed -notcontains $_ })
Assert-True ($Outside.Count -eq 0) "All changed and ignored required paths stay inside the allowed boundary"
$Missing = @($Allowed | Where-Object {
    $_ -ne "docs/stages/active/CURRENT-STAGE.md" -and $_ -ne $CompletedRelative -and
    -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ($_ -replace "/", "\")) -PathType Leaf)
})
if ($IsExpectedActive) { $Missing = @($Missing | Where-Object { $_ -ne $CompletedRelative }) }
if ($IsExpectedInactive) { $Missing = @($Missing | Where-Object { $_ -ne "docs/stages/active/CURRENT-STAGE.md" }) }
Assert-True ($Missing.Count -eq 0) "Required stage artifacts exist"

$Migration = Join-Path $BackendRoot "db\migrations\017_create_bibleroot_commentary_provenance.sql"
Assert-True ((Get-Item -LiteralPath $Migration).Length -eq 4940) "Migration 017 exact byte length"
Assert-True ((Get-FileHash -Algorithm SHA256 -LiteralPath $Migration).Hash -eq "748EA16A3207B96896FAB738AA5E19FE0513AA8E7481C941A90F49DA06601EF5") "Migration 017 exact SHA-256"
Assert-True ((& git -C $RepositoryRoot hash-object --no-filters -- "backend/db/migrations/017_create_bibleroot_commentary_provenance.sql").Trim() -eq "15953835d8b57ca8146abc8079cf7cdf38b92ebd") "Migration 017 exact no-filter blob"
Assert-True (-not (Get-ChildItem -LiteralPath (Join-Path $BackendRoot "db\migrations") -File | Where-Object Name -Like "018*")) "Migration 018 remains absent"

$SourceMetadata = Get-Content -Raw -LiteralPath (Join-Path $DatasetRoot "source-metadata.json") | ConvertFrom-Json
$RightsMetadata = Get-Content -Raw -LiteralPath (Join-Path $DatasetRoot "rights-metadata.json") | ConvertFrom-Json
foreach ($Artifact in @($SourceMetadata.artifacts)) {
    $Relative = "backend/data/bibleroot-commentary-interpretation-provenance-v1/raw/$($Artifact.filename)"
    $Path = Join-Path $RepositoryRoot ($Relative -replace "/", "\")
    $IdentityMatches = (Get-Item -LiteralPath $Path).Length -eq [int64]$Artifact.byteLength -and
        (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash -eq $Artifact.sha256 -and
        (& git -C $RepositoryRoot hash-object --no-filters -- $Relative).Trim() -eq $Artifact.gitBlob
    Assert-True $IdentityMatches "Exact raw identity: $($Artifact.filename)"
    Assert-True ((& git -C $RepositoryRoot check-attr text -- $Relative) -join "" -match "text: unset") "Git -text protection: $($Artifact.filename)"
}
foreach ($Document in @($SourceMetadata.documents)) {
    $Relative = "backend/data/bibleroot-commentary-interpretation-provenance-v1/source-docs/$($Document.filename)"
    $Path = Join-Path $RepositoryRoot ($Relative -replace "/", "\")
    $IdentityMatches = (Get-Item -LiteralPath $Path).Length -eq [int64]$Document.byteLength -and
        (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash -eq $Document.sha256 -and
        (& git -C $RepositoryRoot hash-object --no-filters -- $Relative).Trim() -eq $Document.gitBlob
    Assert-True $IdentityMatches "Exact source-document identity: $($Document.filename)"
    Assert-True ((& git -C $RepositoryRoot check-attr text -- $Relative) -join "" -match "text: unset") "Git -text protection: $($Document.filename)"
}
Assert-True (($RightsMetadata.records.Count -eq 2) -and (@($RightsMetadata.records | Where-Object { -not $_.statement -or -not $_.attribution -or -not $_.territorialLimitation -or $_.evidenceDocuments.Count -lt 2 }).Count -eq 0)) "Rights metadata is complete and territorially qualified"

$DatasetManifest = Get-Content -Raw -LiteralPath (Join-Path $DatasetRoot "dataset-manifest.json") | ConvertFrom-Json
$Expected = $DatasetManifest.expectedCounts
Assert-True (($Expected.works -eq 2) -and ($Expected.passages -eq 4) -and ($Expected.canonicalVerses -eq 110) -and ($Expected.sections -eq 96) -and ($Expected.statements -eq 3450) -and ($Expected.anchors -eq 96) -and ($Expected.coverageGaps -eq 14)) "Exact accepted commentary corpus counts"
Assert-True (($DatasetManifest.acceptedWorkIds.Count -eq 2) -and ($DatasetManifest.rejectedCandidates -contains "John Gill's Exposition of the Entire Bible")) "Accepted and rejected work decisions are explicit"

$ProtectedCurrent = @(Get-ChildItem -LiteralPath (Join-Path $BackendRoot "data") -Recurse -File | Where-Object {
    ($_.FullName -match "\\(?:raw|source-docs)\\") -and $_.FullName -notmatch "bibleroot-commentary-interpretation-provenance-v1"
})
$ProtectedMismatch = @()
foreach ($File in $ProtectedCurrent) {
    $Relative = $File.FullName.Substring($RepositoryRoot.Length + 1).Replace("\", "/")
    $HeadBlob = (& git -C $RepositoryRoot rev-parse "HEAD:$Relative" 2>$null).Trim()
    $CurrentBlob = (& git -C $RepositoryRoot hash-object --no-filters -- $Relative).Trim()
    if (-not $HeadBlob -or $HeadBlob -ne $CurrentBlob) { $ProtectedMismatch += $Relative }
}
Assert-True (($ProtectedCurrent.Count -eq 18) -and ($ProtectedMismatch.Count -eq 0)) "All 18 previously released raw/source-doc artifacts are byte-preserved"
$Gutenberg = Join-Path $BackendRoot "data\bibleroot-foundation-v1\raw\project-gutenberg-ebook-10-10-0.txt"
Assert-True (((Get-Item -LiteralPath $Gutenberg).Length -eq 4436268) -and ((Get-FileHash -Algorithm SHA256 -LiteralPath $Gutenberg).Hash -eq "0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986") -and ((& git -C $RepositoryRoot hash-object --no-filters -- "backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt").Trim() -eq "0ddceccdd1569bb5f5992aa33e33aa8aa99eee6e")) "Protected Gutenberg identity preserved"

$CombinedAuthored = @(
    Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "src\bibleroot\commentary-provenance.ts")
    Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "src\services\bibleroot-store.ts")
    Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "assets\js\bibleroot-commentary.js")
    Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "bibleroot-commentary.html")
) -join "`n"
$NoGeneratedOrRankedContent =
    $CombinedAuthored -notmatch "truthScore|agreementScore|disagreementScore|orthodoxyLabel|heresyLabel|doctrineClassification|generatedCommentary" -and
    $CombinedAuthored -match "generatedSummary:\s*false" -and
    $CombinedAuthored -match "inferredAgreement:\s*false" -and
    $CombinedAuthored -match "wordAlignment:\s*false"
Assert-True $NoGeneratedOrRankedContent "No generated commentary, ranking, doctrine, agreement inference, or word alignment"
$UnexpectedZip = @($Changed | Where-Object { $_ -like "*.zip" -and $_ -notin @("backend/data/bibleroot-commentary-interpretation-provenance-v1/raw/MHC.zip", "backend/data/bibleroot-commentary-interpretation-provenance-v1/raw/JFB.zip") })
Assert-True ($UnexpectedZip.Count -eq 0) "No SourceRoot release ZIP or unrelated ZIP was created"
$LaterStage = @($Changed | Where-Object { $_ -match "13D|CHUNK-?14|semantic-alignment|theology-ranking|belief-recommendation" })
Assert-True ($LaterStage.Count -eq 0) "No later-stage work was created"

Invoke-Gate "Test database migrations" $BackendRoot { & npm.cmd run db:migrate:test }
Invoke-Gate "Backend typecheck" $BackendRoot { & npm.cmd run typecheck }
Invoke-Gate "Deterministic commentary preparation" $BackendRoot { & npm.cmd run bibleroot:commentary:prepare }
Invoke-Gate "Commentary source/corpus/anchor/import/API/readiness tests" $BackendRoot { & npm.cmd run test:bibleroot:commentary }
Invoke-Gate "Commentary frontend tests" $BackendRoot { & npm.cmd run test:bibleroot:commentary:frontend }
Invoke-Gate "BibleRoot Foundation regression" $BackendRoot { & npm.cmd run test:bibleroot:foundation }
Invoke-Gate "BibleRoot Foundation frontend regression" $BackendRoot { & npm.cmd run test:bibleroot:frontend }
Invoke-Gate "BibleRoot Original Language regression" $BackendRoot { & npm.cmd run test:bibleroot:original-languages }
Invoke-Gate "BibleRoot Original Language frontend regression" $BackendRoot { & npm.cmd run test:bibleroot:original-languages:frontend }
Invoke-Gate "BibleRoot Translation Comparison regression" $BackendRoot { & npm.cmd run test:bibleroot:translations }
Invoke-Gate "BibleRoot Translation Comparison frontend regression" $BackendRoot { & npm.cmd run test:bibleroot:translations:frontend }
Invoke-Gate "Local development runtime regression" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 test/local-development-runtime.test.ts }
Invoke-Gate "DictionaryRoot core corpus regression (current compatible assertions)" $BackendRoot {
    & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 --test-name-pattern="^(?:[1-9]|1[0-4])[.]" test/dictionaryroot-core-lexical-corpus.test.ts
}
Invoke-Gate "HistoryRoot governance preservation regression" $BackendRoot { & npm.cmd run test:governance:historyroot }
Invoke-Gate "Project-authored git diff check" $RepositoryRoot { & git -c core.autocrlf=false diff --check }

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
