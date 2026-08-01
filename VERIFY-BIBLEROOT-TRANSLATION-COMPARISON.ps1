[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepositoryRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$BackendRoot = Join-Path $RepositoryRoot "backend"
$PassCount = 0
$FailureCount = 0

function Pass([string]$Message) {
    $script:PassCount += 1
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
    $script:FailureCount += 1
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) { Pass $Message } else { Fail $Message }
}

function Invoke-Gate([string]$Name, [string]$WorkingDirectory, [scriptblock]$Command) {
    Push-Location $WorkingDirectory
    try {
        & $Command
        if ($LASTEXITCODE -eq 0) { Pass $Name } else { Fail "$Name (exit $LASTEXITCODE)" }
    } catch {
        Fail "$Name ($($_.Exception.Message))"
    } finally {
        Pop-Location
    }
}

Write-Host "BibleRoot Translation Comparison v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"

$Branch = (& git -C $RepositoryRoot branch --show-current).Trim()
$Head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
$Parent = (& git -C $RepositoryRoot rev-parse HEAD^).Trim()
$Tags = @(& git -C $RepositoryRoot tag --points-at HEAD)
Assert-True ($Branch -eq "release/historyroot-alpha-integration-v1") "Expected branch"
Assert-True ($Head -eq "8661c2948b340458b8f1ab933a4e553614ff163e") "Expected unchanged baseline HEAD"
Assert-True ($Parent -eq "d98f38a07116a24f028cb290abb99036905b160b") "Expected baseline parent"
Assert-True (($Tags.Count -eq 1) -and ($Tags[0] -eq "sourceroot-local-development-runtime-recovery-and-provisioning-v1")) "No tag was created or changed"

$Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
$CompletedRelative = "docs/stages/completed/20260801-BIBLEROOT-TRANSLATION-COMPARISON-V1.md"
$CompletedPath = Join-Path $RepositoryRoot ($CompletedRelative -replace "/", "\")
$IsExpectedActive = $Manifest.active_stage.status -eq "active" -and $Manifest.active_stage.slug -eq "BIBLEROOT-TRANSLATION-COMPARISON-V1"
$IsExpectedInactive = $Manifest.active_stage.status -eq "inactive" -and (Test-Path -LiteralPath $CompletedPath -PathType Leaf)
Assert-True ($IsExpectedActive -or $IsExpectedInactive) "Stage lifecycle is expected active or completed/inactive"

$Allowed = @(
    "assets/css/bibleroot-compare.css",
    "assets/js/bibleroot-api.js",
    "assets/js/bibleroot-compare.js",
    "backend/data/bibleroot-translation-comparison-v1/dataset-manifest.json",
    "backend/data/bibleroot-translation-comparison-v1/hashes.json",
    "backend/data/bibleroot-translation-comparison-v1/IMPORT-NOTES.md",
    "backend/data/bibleroot-translation-comparison-v1/normalized/asv.json",
    "backend/data/bibleroot-translation-comparison-v1/normalized/web.json",
    "backend/data/bibleroot-translation-comparison-v1/normalized/ylt.json",
    "backend/data/bibleroot-translation-comparison-v1/raw/eng-asv_usfm.zip",
    "backend/data/bibleroot-translation-comparison-v1/raw/engwebp_usfm.zip",
    "backend/data/bibleroot-translation-comparison-v1/raw/engylt_usfm.zip",
    "backend/data/bibleroot-translation-comparison-v1/rights-metadata.json",
    "backend/data/bibleroot-translation-comparison-v1/source-docs/details-eng-asv.html",
    "backend/data/bibleroot-translation-comparison-v1/source-docs/details-engwebp.html",
    "backend/data/bibleroot-translation-comparison-v1/source-docs/details-engylt.html",
    "backend/data/bibleroot-translation-comparison-v1/source-docs/ebible-public-domain.html",
    "backend/data/bibleroot-translation-comparison-v1/source-metadata.json",
    "backend/package.json",
    "backend/src/bibleroot/translation-comparison.ts",
    "backend/src/routes/bibleroot.ts",
    "backend/src/scripts/development-runtime.ts",
    "backend/src/scripts/import-bibleroot-translation-comparison.ts",
    "backend/src/scripts/prepare-bibleroot-translation-comparison.ts",
    "backend/src/services/bibleroot-store.ts",
    "backend/src/services/development-runtime-readiness.ts",
    "backend/test/bibleroot-foundation.test.ts",
    "backend/test/bibleroot-translation-comparison.test.ts",
    "bibleroot.html",
    "bibleroot-compare.html",
    "bibleroot-passage.html",
    "docs/architecture/BIBLEROOT-TRANSLATION-COMPARISON-ARCHITECTURE.md",
    "docs/build/BIBLEROOT-TRANSLATION-COMPARISON-BROWSER-EVIDENCE.md",
    "docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md",
    "docs/stages/active/CURRENT-STAGE.md",
    $CompletedRelative,
    "ROOT-MANIFEST.json",
    "verification/bibleroot-translation-comparison.test.cjs",
    "verification/bibleroot-translation-comparison-desktop.png",
    "verification/bibleroot-translation-comparison-mobile.png",
    "VERIFY-BIBLEROOT-TRANSLATION-COMPARISON.ps1"
)
Assert-True ($Allowed.Count -eq 41) "Exact 41-file allowed boundary declared"
if ($IsExpectedActive) {
    $Declared = @($Manifest.active_stage.allowed_files | Sort-Object)
    Assert-True ([string]::Join("|", $Declared) -eq [string]::Join("|", ($Allowed | Sort-Object))) "Manifest allowed boundary is exact"
}
$Changed = @(
    & git -C $RepositoryRoot diff --name-only
    & git -C $RepositoryRoot diff --cached --name-only
    & git -C $RepositoryRoot ls-files --others --exclude-standard
    & git -C $RepositoryRoot ls-files --others --ignored --exclude-standard -- "verification/bibleroot-translation-comparison*"
) | ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ } | Sort-Object -Unique
$Outside = @($Changed | Where-Object { $Allowed -notcontains $_ })
Assert-True ($Outside.Count -eq 0) "All changed and required ignored paths stay inside the allowed boundary"
$Missing = @($Allowed | Where-Object {
    $_ -ne "docs/stages/active/CURRENT-STAGE.md" -and
    $_ -ne $CompletedRelative -and
    -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ($_ -replace "/", "\")) -PathType Leaf)
})
if ($IsExpectedActive) { $Missing = @($Missing | Where-Object { $_ -ne $CompletedRelative }) }
if ($IsExpectedInactive) { $Missing = @($Missing | Where-Object { $_ -ne "docs/stages/active/CURRENT-STAGE.md" }) }
Assert-True ($Missing.Count -eq 0) "Required stage artifacts exist"

Assert-True (-not (Get-ChildItem -LiteralPath (Join-Path $BackendRoot "db\migrations") -File | Where-Object Name -Like "017*")) "Migration 017 remains absent"
$IndexPaths = @(& git -C $RepositoryRoot diff --cached --name-only)
Assert-True ($IndexPaths.Count -eq 0) "Git index is empty"
Assert-True (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ".git\index.lock"))) "Git index lock is absent"

$SourceMetadata = Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "data\bibleroot-translation-comparison-v1\source-metadata.json") | ConvertFrom-Json
foreach ($Artifact in $SourceMetadata.artifacts) {
    $RawRelative = "backend/data/bibleroot-translation-comparison-v1/raw/$($Artifact.filename)"
    $RawPath = Join-Path $RepositoryRoot ($RawRelative -replace "/", "\")
    $Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $RawPath).Hash
    $Blob = (& git -C $RepositoryRoot hash-object --no-filters -- $RawRelative).Trim()
    $Attribute = (& git -C $RepositoryRoot check-attr text -- $RawRelative) -join ""
    Assert-True (((Get-Item -LiteralPath $RawPath).Length -eq [int64]$Artifact.byteLength) -and ($Hash -eq $Artifact.sha256) -and ($Blob -eq $Artifact.gitBlob)) "Exact raw identity: $($Artifact.filename)"
    Assert-True ($Attribute -match "text: unset") "Git -text protection: $($Artifact.filename)"
}
$Gutenberg = Join-Path $BackendRoot "data\bibleroot-foundation-v1\raw\project-gutenberg-ebook-10-10-0.txt"
Assert-True (((Get-Item -LiteralPath $Gutenberg).Length -eq 4436268) -and ((Get-FileHash -Algorithm SHA256 -LiteralPath $Gutenberg).Hash -eq "0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986") -and ((& git -C $RepositoryRoot hash-object --no-filters -- "backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt").Trim() -eq "0ddceccdd1569bb5f5992aa33e33aa8aa99eee6e")) "Protected Gutenberg identity preserved"

$DatasetManifest = Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "data\bibleroot-translation-comparison-v1\dataset-manifest.json") | ConvertFrom-Json
$RightsMetadata = Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "data\bibleroot-translation-comparison-v1\rights-metadata.json") | ConvertFrom-Json
Assert-True (($DatasetManifest.expectedCounts.editions -eq 4) -and ($DatasetManifest.expectedCounts.canonicalVerses -eq 110) -and ($DatasetManifest.expectedCounts.newVerseTexts -eq 330)) "Expected four-edition corpus counts"
Assert-True (($RightsMetadata.records.Count -eq 3) -and (@($RightsMetadata.records | Where-Object { -not $_.statement -or -not $_.territorialLimitation }).Count -eq 0)) "Rights metadata is complete"

$UnexpectedZip = @($Changed | Where-Object { $_ -like "*.zip" -and $_ -notlike "backend/data/bibleroot-translation-comparison-v1/raw/*.zip" })
Assert-True ($UnexpectedZip.Count -eq 0) "No release ZIP or unrelated ZIP was created"
$ForbiddenPaths = @($Changed | Where-Object { $_ -match "13C|commentary-provenance|alignment" })
Assert-True ($ForbiddenPaths.Count -eq 0) "No Chunk 13C or inferred-alignment path was created"

Invoke-Gate "Backend typecheck" $BackendRoot { & npm.cmd run typecheck }
Invoke-Gate "Deterministic preparation" $BackendRoot { & npm.cmd run bibleroot:translations:prepare }
Invoke-Gate "Translation source/import/corpus/API tests" $BackendRoot { & npm.cmd run test:bibleroot:translations }
Invoke-Gate "Translation frontend tests" $BackendRoot { & npm.cmd run test:bibleroot:translations:frontend }
Invoke-Gate "BibleRoot Foundation regression" $BackendRoot { & npm.cmd run test:bibleroot:foundation }
Invoke-Gate "BibleRoot Foundation frontend regression" $BackendRoot { & npm.cmd run test:bibleroot:frontend }
Invoke-Gate "BibleRoot Original Language regression" $BackendRoot { & npm.cmd run test:bibleroot:original-languages }
Invoke-Gate "BibleRoot Original Language frontend regression" $BackendRoot { & npm.cmd run test:bibleroot:original-languages:frontend }
Invoke-Gate "Local development runtime regression" $BackendRoot { & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 test/local-development-runtime.test.ts }
Invoke-Gate "Project-authored git diff check" $RepositoryRoot { & git -c core.autocrlf=false diff --check }

Write-Host ""
Write-Host "Verifier summary" -ForegroundColor Cyan
Write-Host "Pass count: $PassCount"
Write-Host "Failure count: $FailureCount"
if ($FailureCount -gt 0) {
    Write-Host "Overall result: FAIL" -ForegroundColor Red
    exit 1
}
Write-Host "Overall result: PASS" -ForegroundColor Green
exit 0
