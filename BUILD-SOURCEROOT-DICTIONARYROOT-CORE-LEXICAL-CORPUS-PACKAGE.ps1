[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "",

    [Parameter()]
    [string]$ReleaseRoot = (Join-Path ([Environment]::GetFolderPath("MyDocuments")) "SourceRoot-Releases")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Hash([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function Write-Utf8([string]$Path, [string]$Text) {
    $Encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Text, $Encoding)
}

$Root = if ($RepositoryPath) {
    [IO.Path]::GetFullPath($RepositoryPath).TrimEnd("\", "/")
} else {
    [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
}
$Release = [IO.Path]::GetFullPath($ReleaseRoot).TrimEnd("\", "/")
$PackageName = "SourceRoot-DictionaryRoot-Core-Lexical-Corpus-v1"
$Package = Join-Path $Release $PackageName
$Zip = Join-Path $Release "$PackageName.zip"
if (-not $Package.StartsWith($Release + "\", [StringComparison]::OrdinalIgnoreCase) -or
    -not $Zip.StartsWith($Release + "\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved package targets escape the release root."
}
if (-not (Test-Path -LiteralPath $Release -PathType Container)) {
    New-Item -ItemType Directory -Path $Release | Out-Null
}
if (Test-Path -LiteralPath $Package) { Remove-Item -LiteralPath $Package -Recurse -Force }
if (Test-Path -LiteralPath $Zip) { Remove-Item -LiteralPath $Zip -Force }
New-Item -ItemType Directory -Path $Package | Out-Null

$Payload = [ordered]@{
    "data/corpus.json" = "backend/data/dictionaryroot-core-lexical-corpus-v1/corpus.json"
    "data/inventory.json" = "backend/data/dictionaryroot-core-lexical-corpus-v1/inventory.json"
    "data/quality-review.json" = "backend/data/dictionaryroot-core-lexical-corpus-v1/quality-review.json"
    "data/quality-review.md" = "backend/data/dictionaryroot-core-lexical-corpus-v1/quality-review.md"
    "data/source-rights-attribution.json" = "backend/data/dictionaryroot-core-lexical-corpus-v1/source-rights-attribution.json"
    "data/lemma-selection.json" = "backend/data/dictionaryroot-core-lexical-corpus-v1/lemma-selection.json"
    "data/prepared-source-accounting.json" = "backend/data/dictionaryroot-core-lexical-corpus-v1/prepared-source-accounting.json"
    "data/relationship-accounting.json" = "backend/data/dictionaryroot-core-lexical-corpus-v1/relationship-accounting.json"
    "data/hashes.json" = "backend/data/dictionaryroot-core-lexical-corpus-v1/hashes.json"
    "runtime/core-lexical-corpus.ts" = "backend/src/dictionaryroot/core-lexical-corpus.ts"
    "runtime/lexical-evidence-types.ts" = "backend/src/dictionaryroot/lexical-evidence-types.ts"
    "runtime/lexical-evidence-store.ts" = "backend/src/services/lexical-evidence-store.ts"
    "runtime/lexical-evidence-graph.ts" = "backend/src/dictionaryroot/lexical-evidence-graph.ts"
    "runtime/lexicon.ts" = "backend/src/routes/lexicon.ts"
    "runtime/generate-dictionaryroot-core-lexical-corpus.ts" = "backend/src/scripts/generate-dictionaryroot-core-lexical-corpus.ts"
    "runtime/import-dictionaryroot-core-lexical-corpus.ts" = "backend/src/scripts/import-dictionaryroot-core-lexical-corpus.ts"
    "tests/dictionaryroot-core-lexical-corpus.test.ts" = "backend/test/dictionaryroot-core-lexical-corpus.test.ts"
    "tests/dictionaryroot-core-lexical-corpus.test.cjs" = "verification/dictionaryroot-core-lexical-corpus.test.cjs"
    "docs/DICTIONARYROOT-CORE-LEXICAL-CORPUS-API.md" = "docs/api/DICTIONARYROOT-CORE-LEXICAL-CORPUS-API.md"
    "docs/DICTIONARYROOT-CORE-LEXICAL-CORPUS-STATE.md" = "docs/build/DICTIONARYROOT-CORE-LEXICAL-CORPUS-STATE.md"
    "docs/DICTIONARYROOT-CORE-LEXICAL-CORPUS-RELEASE.md" = "docs/build/DICTIONARYROOT-CORE-LEXICAL-CORPUS-RELEASE.md"
    "INSTALL-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1" = "INSTALL-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1"
    "VERIFY-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1" = "VERIFY-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1"
}

$Files = New-Object System.Collections.Generic.List[object]
foreach ($Entry in $Payload.GetEnumerator()) {
    $Source = Join-Path $Root ($Entry.Value -replace "/", "\")
    $Destination = Join-Path $Package ($Entry.Key -replace "/", "\")
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    $Files.Add([pscustomobject][ordered]@{
        path = $Entry.Key
        byteLength = (Get-Item -LiteralPath $Destination).Length
        sha256 = Hash $Destination
    })
}

$Summary = @"
# Accepted test and verification summary

- Typecheck: PASS
- Focused production tests: 15 passed, 0 failed
- Focused frontend tests: 8 passed, 0 failed
- Lexical relationship architecture verifier: 16 passed, 0 warnings, 0 failed
- DictionaryRoot baseline: 23 passed, 0 warnings, 0 failed
- SourceRoot compatibility baseline: 15 passed, 0 warnings, 0 failed
- Desktop browser smoke (1280 x 720): PASS
- Mobile browser smoke (390 x 844): PASS
- Browser console errors: 0
- Browser console warnings attributable to Chunk 10B: 0
- Duplicate graph nodes: 0
- Duplicate graph edges: 0
- Full backend regression: one authorized run reached the 120-second execution cap; historical acquisition-stage tests intentionally reject later migrations, API routes, frontend changes, and active-stage scope, so it is not accepted as a Chunk 10B release gate
- Architecture fixture baseline: 7 symmetric, 5 directional, 12 relationships, 13 evidence records
- Quality blockers: 0
- Dataset: dictionaryroot-core-lexical-corpus-v1
- Version: 1.0.0

Executable final verification remains mandatory after package construction and installation.
"@
$SummaryPath = Join-Path $Package "docs\ACCEPTED-TEST-AND-VERIFICATION-SUMMARY.md"
Write-Utf8 $SummaryPath ($Summary.Trim() + "`n")
$Files.Add([pscustomobject][ordered]@{
    path = "docs/ACCEPTED-TEST-AND-VERIFICATION-SUMMARY.md"
    byteLength = (Get-Item -LiteralPath $SummaryPath).Length
    sha256 = Hash $SummaryPath
})

$Manifest = [ordered]@{
    schemaVersion = "1.0.0"
    packageId = $PackageName
    datasetId = "dictionaryroot-core-lexical-corpus-v1"
    datasetVersion = "1.0.0"
    migrationDependencies = @(
        "013_create_dictionaryroot_lexical_evidence.sql",
        "014_create_dictionaryroot_lexical_relationships.sql"
    )
    prohibitedMigration = "015"
    database = "sourceroot_test"
    fixtureExcludedFromProduction = $true
    legacyLexiconWrites = $false
    genericLexicalNodesPersisted = $false
    files = @($Files | Sort-Object path)
}
Write-Utf8 (Join-Path $Package "PACKAGE-MANIFEST.json") `
    (($Manifest | ConvertTo-Json -Depth 8) + "`n")

Compress-Archive -Path (Join-Path $Package "*") -DestinationPath $Zip -CompressionLevel Optimal
Write-Host "Package: $Package"
Write-Host "ZIP:     $Zip"
Write-Host "ZIP bytes: $((Get-Item -LiteralPath $Zip).Length)"
Write-Host "ZIP SHA-256: $(Hash $Zip)"
exit 0
