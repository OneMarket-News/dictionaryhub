[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "",

    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [switch]$SkipExecutableChecks
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:PassCount = 0
$script:WarningCount = 0
$script:FailureCount = 0

function Pass([string]$Name, [string]$Detail = "") {
    $script:PassCount++
    Write-Host "[PASS] $Name" -ForegroundColor Green
    if ($Detail) { Write-Host "       $Detail" }
}
function Fail([string]$Name, [string]$Detail = "") {
    $script:FailureCount++
    Write-Host "[FAIL] $Name" -ForegroundColor Red
    if ($Detail) { Write-Host "       $Detail" }
}
function Hash([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function Run([string]$Name, [string]$File, [string[]]$Arguments, [string]$WorkingDirectory) {
    Push-Location $WorkingDirectory
    try {
        & $File @Arguments
        $Code = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($Code -eq 0) { Pass $Name "Exit 0." } else { Fail $Name "Exit $Code." }
}

$Root = if ($RepositoryPath) {
    [IO.Path]::GetFullPath($RepositoryPath).TrimEnd("\", "/")
} else {
    [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
}
$Backend = Join-Path $Root "backend"
$Data = Join-Path $Backend "data\dictionaryroot-core-lexical-corpus-v1"
$ExpectedHead = "31b73c4fbc6c73831626191fa24a02f9646a022a"

Write-Host "SourceRoot Chunk 10B DictionaryRoot Core Lexical Corpus verifier" -ForegroundColor Cyan
Write-Host "Repository: $Root"

try {
    $Head = (& git -C $Root rev-parse HEAD).Trim()
    $Branch = (& git -C $Root branch --show-current).Trim()
    $Remote = (& git -C $Root rev-parse origin/release/historyroot-alpha-integration-v1).Trim()
    if ($Head -eq $ExpectedHead -and
        $Branch -eq "release/historyroot-alpha-integration-v1" -and
        $Remote -eq $ExpectedHead) {
        Pass "Starting checkpoint" "$Branch at $Head; remote exact."
    } else { Fail "Starting checkpoint" "branch=$Branch head=$Head remote=$Remote" }
} catch { Fail "Starting checkpoint" $_.Exception.Message }

try {
    $Manifest = Get-Content -Raw -LiteralPath (Join-Path $Root "ROOT-MANIFEST.json") | ConvertFrom-Json
    if ($Manifest.active_stage.slug -eq "SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS-V1" -and
        $Manifest.active_stage.status -eq "active") {
        Pass "Root stage identity" "$($Manifest.active_stage.allowed_files.Count) explicit allowed files."
    } else { Fail "Root stage identity" "Chunk 10B is not the active bounded stage." }
} catch { Fail "Root stage identity" $_.Exception.Message }

try {
    $Migrations = @(Get-ChildItem -LiteralPath (Join-Path $Backend "db\migrations") -File -Filter "*.sql")
    $Complete = (1..14 | ForEach-Object {
        $Prefix = "{0:D3}_" -f $_
        @($Migrations | Where-Object { $_.Name.StartsWith($Prefix) }).Count -gt 0
    }) -notcontains $false
    $Migration014 = Test-Path -LiteralPath (Join-Path $Backend "db\migrations\014_create_dictionaryroot_lexical_relationships.sql")
    $Migration015 = @($Migrations | Where-Object { $_.Name.StartsWith("015_") }).Count
    if ($Complete -and $Migration014 -and $Migration015 -eq 0) {
        Pass "Migration boundary" "001-014 present; canonical 014 present; 015 absent."
    } else { Fail "Migration boundary" "complete=$Complete migration014=$Migration014 migration015=$Migration015" }
    & git -c core.autocrlf=false -C $Root diff --quiet $ExpectedHead -- backend/db/migrations
    if ($LASTEXITCODE -eq 0) { Pass "Migrations unchanged" "No migration diff from starting checkpoint." }
    else { Fail "Migrations unchanged" "A migration differs from the starting checkpoint." }
} catch { Fail "Migration boundary" $_.Exception.Message }

try {
    $Hashes = Get-Content -Raw -LiteralPath (Join-Path $Data "hashes.json") | ConvertFrom-Json
    $Bad = @()
    foreach ($Artifact in @($Hashes.artifacts)) {
        $Path = Join-Path $Data ([string]$Artifact.name)
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf) -or
            (Get-Item -LiteralPath $Path).Length -ne [long]$Artifact.byteLength -or
            (Hash $Path) -ne ([string]$Artifact.sha256).ToUpperInvariant()) {
            $Bad += [string]$Artifact.name
        }
    }
    if ($Bad.Count -eq 0) { Pass "Canonical artifact hashes" "$($Hashes.artifacts.Count) artifacts exact." }
    else { Fail "Canonical artifact hashes" ($Bad -join ", ") }
    if ((Hash (Join-Path $Data "webster-1913.txt")) -eq
        "86FB9C28C32008EA288CA4BCF34F4F0D3D11CCF9E0898294D98B73671497F1D3") {
        Pass "Prepared Webster source" "Pinned Project Gutenberg bytes exact."
    } else { Fail "Prepared Webster source" "SHA-256 mismatch." }
} catch { Fail "Canonical artifacts" $_.Exception.Message }

try {
    $CorpusText = Get-Content -Raw -LiteralPath (Join-Path $Data "corpus.json")
    $Corpus = $CorpusText | ConvertFrom-Json
    $Inventory = Get-Content -Raw -LiteralPath (Join-Path $Data "inventory.json") | ConvertFrom-Json
    $Quality = Get-Content -Raw -LiteralPath (Join-Path $Data "quality-review.json") | ConvertFrom-Json
    if ($Corpus.dataset.datasetId -eq "dictionaryroot-core-lexical-corpus-v1" -and
        $Corpus.dataset.version -eq "1.0.0" -and
        -not [bool]$Corpus.dataset.fixtureOnly) {
        Pass "Production dataset identity" "$($Corpus.dataset.datasetId) $($Corpus.dataset.version)"
    } else { Fail "Production dataset identity" "Identity, version, or fixture flag invalid." }
    $Minimums = [ordered]@{
        sources=12; lemmas=300; senses=600; definitionClaims=600; forms=150
        etymologyProposals=100; sourceComparisons=100; locators=600
        fieldProvenance=600; relationships=400; relationshipEvidence=400
        historicalOrObsoleteSenses=50; technicalOrSpecializedSenses=50
        uncertaintyBearingStructures=50
    }
    $Failures = @($Minimums.GetEnumerator() | Where-Object {
        [int]$Inventory.counts.PSObject.Properties[$_.Key].Value -lt [int]$_.Value
    })
    if ($Failures.Count -eq 0) {
        Pass "Corpus mandatory minimums" ($Inventory.counts | ConvertTo-Json -Compress)
    } else { Fail "Corpus mandatory minimums" ($Failures.Key -join ", ") }
    if ([int]$Quality.blockerCount -eq 0 -and
        [int]$Quality.fixtureLeakage -eq 0 -and
        [int]$Quality.legacyLexiconWrites -eq 0 -and
        [int]$Quality.genericDuplicateLexicalNodes -eq 0) {
        Pass "Quality boundary" "Zero blockers, fixture leakage, legacy writes, or generic nodes."
    } else { Fail "Quality boundary" ($Quality | ConvertTo-Json -Compress) }
    $Restricted = @("oed-online", "merriam-webster-online", "etymonline")
    $RestrictedClaims = @($Corpus.definitionClaims | Where-Object { $Restricted -contains $_.sourceId })
    if ($RestrictedClaims.Count -eq 0) { Pass "Restricted source text" "No restricted source supplies a claim." }
    else { Fail "Restricted source text" "$($RestrictedClaims.Count) prohibited claims." }
} catch { Fail "Corpus structure" $_.Exception.Message }

try {
    $FixtureHash = Hash (Join-Path $Backend "data\dictionaryroot-lexical-evidence-architecture-fixture-v1\fixture.json")
    if ($FixtureHash -eq "DB8F3EB4CA079663764598AED954417F2658DC9781863C007517EE4D4C1E4799") {
        Pass "Architecture fixture immutable" $FixtureHash
    } else { Fail "Architecture fixture immutable" $FixtureHash }
    $Fixture = Get-Content -Raw -LiteralPath (Join-Path $Backend "data\dictionaryroot-lexical-evidence-architecture-fixture-v1\fixture.json") | ConvertFrom-Json
    $Symmetric = @($Fixture.relationships | Where-Object directionality -eq "symmetric").Count
    $Directional = @($Fixture.relationships | Where-Object directionality -eq "directional").Count
    if ($Symmetric -eq 7 -and $Directional -eq 5 -and
        $Fixture.relationships.Count -eq 12 -and $Fixture.relationshipEvidence.Count -eq 13) {
        Pass "Corrected fixture distribution" "7 symmetric / 5 directional / 12 / 13."
    } else { Fail "Corrected fixture distribution" "$Symmetric/$Directional" }
} catch { Fail "Architecture fixture" $_.Exception.Message }

try {
    $PriorZip = Join-Path ([Environment]::GetFolderPath("MyDocuments")) `
        "SourceRoot-Releases\SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1.zip"
    if ((Hash $PriorZip) -eq "D4E11DD28EECC46BEFA76E3E4805BB8CDB6F8C8EE57FA07C72BEB898DF409D29") {
        Pass "Prior release immutable"
    } else { Fail "Prior release immutable" "Chunk 9 ZIP hash mismatch." }
} catch { Fail "Prior release immutable" $_.Exception.Message }

if ($PackagePath) {
    try {
        $PackageRoot = [IO.Path]::GetFullPath($PackagePath).TrimEnd("\", "/")
        $PackageManifest = Get-Content -Raw -LiteralPath (Join-Path $PackageRoot "PACKAGE-MANIFEST.json") | ConvertFrom-Json
        $BadPackage = @()
        foreach ($File in @($PackageManifest.files)) {
            $Path = Join-Path $PackageRoot (([string]$File.path) -replace "/", "\")
            if (-not (Test-Path -LiteralPath $Path -PathType Leaf) -or
                (Hash $Path) -ne ([string]$File.sha256).ToUpperInvariant()) {
                $BadPackage += [string]$File.path
            }
        }
        if ($PackageManifest.packageId -eq "SourceRoot-DictionaryRoot-Core-Lexical-Corpus-v1" -and
            $BadPackage.Count -eq 0) {
            Pass "External package identity" "$($PackageManifest.files.Count) payload files exact."
        } else { Fail "External package identity" ($BadPackage -join ", ") }
    } catch { Fail "External package identity" $_.Exception.Message }
}

if (-not $SkipExecutableChecks) {
    Run "Typecheck" "npm.cmd" @("run", "typecheck") $Backend
    Run "Focused production tests" "npm.cmd" @("run", "test:dictionaryroot:core-lexical-corpus") $Backend
    Run "Focused frontend tests" "npm.cmd" @("run", "test:dictionaryroot:core-lexical-corpus:frontend") $Backend
}

try {
    & git -c core.autocrlf=false -C $Root diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Pass "Git index empty" "No staged changes." }
    else { Fail "Git index empty" "The index contains staged changes." }
    $PreviousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $DiffCheck = & git -c core.autocrlf=true -C $Root diff --check 2>$null
    $DiffCheckExit = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorPreference
    if ($DiffCheckExit -eq 0) { Pass "git diff --check" "Exit 0; no whitespace errors." }
    else { Fail "git diff --check" (@($DiffCheck) -join "`n") }
} catch { Fail "Git read-only checks" $_.Exception.Message }

Write-Host ""
Write-Host "Chunk 10B verifier summary" -ForegroundColor Cyan
Write-Host "Pass count:    $script:PassCount"
Write-Host "Warning count: $script:WarningCount"
Write-Host "Failure count: $script:FailureCount"
if ($script:FailureCount -gt 0 -or $script:WarningCount -gt 0) { exit 1 }
exit 0
