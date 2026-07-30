[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "",

    [Parameter()]
    [switch]$SkipExecutableChecks,

    [Parameter()]
    [switch]$SkipLiveApiChecks
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

function Run(
    [string]$Name,
    [string]$File,
    [string[]]$Arguments,
    [string]$WorkingDirectory
) {
    $Code = 1
    Push-Location $WorkingDirectory
    try {
        & $File @Arguments
        $Code = $LASTEXITCODE
    } catch {
        Write-Host $_.Exception.Message
        $Code = 1
    } finally {
        Pop-Location
    }
    if ($Code -eq 0) {
        Pass $Name "Exit 0."
    } else {
        Fail $Name "Exit $Code."
    }
}

function Read-DatabaseUrl([string]$BackendPath) {
    $EnvironmentPath = Join-Path $BackendPath ".env.test"
    $Line = Get-Content -LiteralPath $EnvironmentPath |
        Where-Object { $_ -match "^DATABASE_URL=" } |
        Select-Object -First 1
    if (-not $Line) {
        throw "DATABASE_URL is missing from backend/.env.test."
    }
    $Value = $Line.Substring("DATABASE_URL=".Length).Trim()
    if (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or
        ($Value.StartsWith("'") -and $Value.EndsWith("'"))) {
        $Value = $Value.Substring(1, $Value.Length - 2)
    }
    return $Value
}

function Invoke-PsqlQuery([string]$DatabaseUrl, [string]$Sql) {
    $Output = & psql.exe $DatabaseUrl --no-psqlrc --tuples-only --no-align `
        --set ON_ERROR_STOP=1 --command $Sql
    if ($LASTEXITCODE -ne 0) {
        throw "psql exited with code $LASTEXITCODE."
    }
    return (@($Output) -join "`n").Trim()
}

function Read-Api([string]$Uri) {
    return Invoke-RestMethod -Method Get -Uri $Uri -TimeoutSec 15
}

$Root = if ([string]::IsNullOrWhiteSpace($RepositoryPath)) {
    [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
} else {
    [IO.Path]::GetFullPath($RepositoryPath).TrimEnd("\", "/")
}
$Backend = Join-Path $Root "backend"
$ExpectedHead = "49a75dff63c7f7d3fc3f1c7277cabb5b9ebc0b0e"
$ExpectedBranch = "release/historyroot-alpha-integration-v1"
$ExpectedStage = "SOURCEROOT-UNIFIED-CROSS-EXPERIENCE-SEARCH-NAVIGATION-V1"
$DictionaryDatasetId = "dictionaryroot-core-lexical-corpus-v1"
$HistoryDatasetId = "historyroot-plymouth-knowledge-dataset-v1"

Write-Host "SourceRoot Chunk 11 Unified Cross-Experience Search and Navigation verifier" -ForegroundColor Cyan
Write-Host "Repository: $Root"

try {
    $Head = (& git -C $Root rev-parse HEAD).Trim()
    $Branch = (& git -C $Root branch --show-current).Trim()
    $Remote = (& git -C $Root rev-parse "origin/$ExpectedBranch").Trim()
    if ($Head -eq $ExpectedHead -and $Branch -eq $ExpectedBranch -and
        $Remote -eq $ExpectedHead) {
        Pass "Current starting checkpoint" "$Branch at $Head; remote exact."
    } else {
        Fail "Current starting checkpoint" "branch=$Branch head=$Head remote=$Remote"
    }
} catch {
    Fail "Current starting checkpoint" $_.Exception.Message
}

try {
    $Manifest = Get-Content -Raw -LiteralPath (Join-Path $Root "ROOT-MANIFEST.json") |
        ConvertFrom-Json
    if ($Manifest.active_stage.slug -eq $ExpectedStage -and
        $Manifest.active_stage.status -eq "active" -and
        @($Manifest.active_stage.allowed_files).Count -eq 28) {
        Pass "Bounded Root stage" "Chunk 11 active with 28 explicit allowed files."
    } else {
        Fail "Bounded Root stage" "Active stage identity, status, or allowed-file count is invalid."
    }
} catch {
    Fail "Bounded Root stage" $_.Exception.Message
}

try {
    $EvidenceText = Get-Content -Raw -LiteralPath (
        Join-Path $Root "docs\build\sourceroot-unified-cross-experience-search-navigation-stage.md"
    )
    $RequiredSuperseded = @(
        "31b73c4f",
        "completed stage to remain active",
        "shared-asset changes"
    )
    $Missing = @($RequiredSuperseded | Where-Object {
        $EvidenceText.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -lt 0
    })
    & git -c core.autocrlf=false -C $Root diff --quiet $ExpectedHead -- `
        "VERIFY-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1" `
        "VERIFY-SOURCEROOT-HISTORYROOT-WAMPANOAG-REGIONAL-CORPUS.ps1"
    $HistoricalVerifiersUnchanged = $LASTEXITCODE -eq 0
    if ($Missing.Count -eq 0 -and $HistoricalVerifiersUnchanged) {
        Pass "Superseded release assertions" "Three historical assertions documented; frozen verifiers unchanged."
    } else {
        Fail "Superseded release assertions" "missing=$($Missing -join ',') frozen=$HistoricalVerifiersUnchanged"
    }
} catch {
    Fail "Superseded release assertions" $_.Exception.Message
}

try {
    $MigrationRoot = Join-Path $Backend "db\migrations"
    $Migrations = @(Get-ChildItem -LiteralPath $MigrationRoot -File -Filter "*.sql")
    $Complete = (1..14 | ForEach-Object {
        $Prefix = "{0:D3}_" -f $_
        @($Migrations | Where-Object { $_.Name.StartsWith($Prefix) }).Count -gt 0
    }) -notcontains $false
    $Migration015 = @($Migrations | Where-Object {
        $_.Name.StartsWith("015_")
    }).Count
    if ($Complete -and $Migration015 -eq 0) {
        Pass "Migration boundary" "001-014 present; migration 015 absent."
    } else {
        Fail "Migration boundary" "complete=$Complete migration015=$Migration015"
    }
    & git -c core.autocrlf=false -C $Root diff --quiet $ExpectedHead -- `
        "backend/db/migrations"
    if ($LASTEXITCODE -eq 0) {
        Pass "Migration bytes" "Migrations are unchanged from the accepted checkpoint."
    } else {
        Fail "Migration bytes" "A migration differs from the accepted checkpoint."
    }
} catch {
    Fail "Migration preservation" $_.Exception.Message
}

try {
    $CorpusPaths = @(
        "backend/data/dictionaryroot-core-lexical-corpus-v1",
        "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1",
        "backend/data/historyroot-wampanoag-regional-corpus-v1",
        "data/historyroot/plymouth-v1"
    )
    & git -c core.autocrlf=false -C $Root diff --quiet $ExpectedHead -- @CorpusPaths
    if ($LASTEXITCODE -eq 0) {
        Pass "Corpus bytes" "DictionaryRoot and HistoryRoot corpus paths are unchanged."
    } else {
        Fail "Corpus bytes" "A protected corpus path differs from the accepted checkpoint."
    }
} catch {
    Fail "Corpus bytes" $_.Exception.Message
}

try {
    $DictionaryData = Join-Path $Backend "data\dictionaryroot-core-lexical-corpus-v1"
    $DictionaryCorpus = Get-Content -Raw -LiteralPath (
        Join-Path $DictionaryData "corpus.json"
    ) | ConvertFrom-Json
    $DictionaryQuality = Get-Content -Raw -LiteralPath (
        Join-Path $DictionaryData "quality-review.json"
    ) | ConvertFrom-Json
    $HistoryBundle = Get-Content -Raw -LiteralPath (
        Join-Path $Backend "data\historyroot-wampanoag-regional-corpus-v1\historyroot-wampanoag-regional-corpus-v1.bundle.json"
    ) | ConvertFrom-Json
    if ($DictionaryCorpus.dataset.datasetId -eq $DictionaryDatasetId -and
        $DictionaryCorpus.dataset.version -eq "1.0.0" -and
        -not [bool]$DictionaryCorpus.dataset.fixtureOnly -and
        $HistoryBundle.bundleId -eq $HistoryDatasetId -and
        $HistoryBundle.version -eq "1.3.0") {
        Pass "Corpus identities" "DictionaryRoot 1.0.0 and HistoryRoot 1.3.0 exact."
    } else {
        Fail "Corpus identities" "A protected corpus identity or version differs."
    }
    if ([int]$DictionaryQuality.blockerCount -eq 0 -and
        [int]$DictionaryQuality.fixtureLeakage -eq 0 -and
        [int]$DictionaryQuality.legacyLexiconWrites -eq 0 -and
        [int]$DictionaryQuality.genericDuplicateLexicalNodes -eq 0) {
        Pass "DictionaryRoot quality boundary" "Zero blockers, leakage, legacy writes, or generic nodes."
    } else {
        Fail "DictionaryRoot quality boundary" ($DictionaryQuality | ConvertTo-Json -Compress)
    }
} catch {
    Fail "Corpus metadata" $_.Exception.Message
}

try {
    $Fixture = Get-Content -Raw -LiteralPath (
        Join-Path $Backend "data\dictionaryroot-lexical-evidence-architecture-fixture-v1\fixture.json"
    ) | ConvertFrom-Json
    $Symmetric = @($Fixture.relationships | Where-Object directionality -eq "symmetric").Count
    $Directional = @($Fixture.relationships | Where-Object directionality -eq "directional").Count
    if (@($Fixture.relationships).Count -eq 12 -and
        @($Fixture.relationshipEvidence).Count -eq 13 -and
        $Symmetric -eq 7 -and $Directional -eq 5) {
        Pass "Fixture preservation" "12 relationships; 13 evidence; 7 symmetric; 5 directional."
    } else {
        Fail "Fixture preservation" "relationships=$(@($Fixture.relationships).Count) evidence=$(@($Fixture.relationshipEvidence).Count) symmetric=$Symmetric directional=$Directional"
    }
} catch {
    Fail "Fixture preservation" $_.Exception.Message
}

try {
    $ReleaseRoot = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "SourceRoot-Releases"
    $DictionaryZip = Join-Path $ReleaseRoot "SourceRoot-DictionaryRoot-Core-Lexical-Corpus-v1.zip"
    $HistoryZip = Join-Path $ReleaseRoot "SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1.zip"
    $DictionaryLength = (Get-Item -LiteralPath $DictionaryZip).Length
    $DictionaryHash = Hash $DictionaryZip
    $HistoryHash = Hash $HistoryZip
    if ($DictionaryLength -eq 264507 -and
        $DictionaryHash -eq "E7640A0337F084D1EFFCFDC3B340A3AD7611FBA6E089ED2078B0AFE97EEAD8C0" -and
        $HistoryHash -eq "D4E11DD28EECC46BEFA76E3E4805BB8CDB6F8C8EE57FA07C72BEB898DF409D29") {
        Pass "Accepted release ZIP identities" "DictionaryRoot 264507 bytes and both SHA-256 values exact."
    } else {
        Fail "Accepted release ZIP identities" "dictionaryLength=$DictionaryLength dictionaryHash=$DictionaryHash historyHash=$HistoryHash"
    }
} catch {
    Fail "Accepted release ZIP identities" $_.Exception.Message
}

try {
    $BrowserEvidencePath = Join-Path $Root "docs\build\SOURCEROOT-UNIFIED-SEARCH-BROWSER-EVIDENCE.md"
    $BrowserEvidence = Get-Content -Raw -LiteralPath $BrowserEvidencePath
    $DesktopShot = Join-Path $Root "verification\chunk11-unified-search-desktop.png"
    $MobileShot = Join-Path $Root "verification\chunk11-unified-search-mobile.png"
    $RequiredEvidence = @(
        "1280x720",
        "390x844",
        "Console errors: 0",
        "Attributable warnings: 0",
        "Horizontal overflow: 0",
        "bank",
        "Plymouth",
        "community"
    )
    $MissingEvidence = @($RequiredEvidence | Where-Object {
        $BrowserEvidence.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -lt 0
    })
    $ScreenshotsValid = (Test-Path -LiteralPath $DesktopShot -PathType Leaf) -and
        (Test-Path -LiteralPath $MobileShot -PathType Leaf) -and
        (Get-Item -LiteralPath $DesktopShot).Length -gt 1000 -and
        (Get-Item -LiteralPath $MobileShot).Length -gt 1000
    if ($MissingEvidence.Count -eq 0 -and $ScreenshotsValid) {
        Pass "Browser evidence" "Desktop/mobile evidence complete with zero console or overflow findings."
    } else {
        Fail "Browser evidence" "missing=$($MissingEvidence -join ',') screenshots=$ScreenshotsValid"
    }
} catch {
    Fail "Browser evidence" $_.Exception.Message
}

try {
    $Migration015 = @(Get-ChildItem -LiteralPath (Join-Path $Backend "db\migrations") `
        -File -Filter "015_*.sql").Count
    $RepositoryZips = @(Get-ChildItem -LiteralPath $Root -File -Filter "*.zip").Count
    $UnifiedService = Get-Content -Raw -LiteralPath (
        Join-Path $Backend "src\services\unified-search.ts"
    )
    $UnifiedRoute = Get-Content -Raw -LiteralPath (
        Join-Path $Backend "src\routes\unified-search.ts"
    )
    $NoPersistence = $UnifiedService -notmatch "\b(INSERT|UPDATE|DELETE)\b"
    $Bounded = $UnifiedService -match "UNIFIED_SEARCH_PER_ROOT_LIMIT\s*=\s*100" -and
        $UnifiedService -match "UNIFIED_SEARCH_MAX_LIMIT\s*=\s*20" -and
        $UnifiedService -match "UNIFIED_SEARCH_MAX_PAGE\s*=\s*5" -and
        $UnifiedRoute -match "UNIFIED_SEARCH_MAX_LIMIT" -and
        $UnifiedRoute -match "UNIFIED_SEARCH_MAX_PAGE"
    if ($Migration015 -eq 0 -and $RepositoryZips -eq 0 -and
        $NoPersistence -and $Bounded) {
        Pass "Read-only bounded implementation" "No migration 015, repository ZIP, write SQL, or unbounded request."
    } else {
        Fail "Read-only bounded implementation" "migration015=$Migration015 zips=$RepositoryZips noPersistence=$NoPersistence bounded=$Bounded"
    }
} catch {
    Fail "Read-only bounded implementation" $_.Exception.Message
}

if (-not $SkipExecutableChecks) {
    Run "TypeScript typecheck" "npm.cmd" @("run", "typecheck") $Backend
    Run "Supported backend regression" "node" @(
        "--env-file=.env.test",
        "--import", "./scripts/register-tsx.mjs",
        "--test",
        "--test-concurrency=1",
        "test/api.test.ts",
        "test/local-development-cors.test.ts",
        "test/platform-stabilization.test.ts",
        "test/registry-api-contract.test.ts"
    ) $Backend
    Run "HistoryRoot Plymouth preservation" "npm.cmd" @(
        "run", "test:historyroot:plymouth"
    ) $Backend
    Run "HistoryRoot current substantive preservation" "node" @(
        "--env-file=.env.test",
        "--import", "./scripts/register-tsx.mjs",
        "--test",
        "--test-concurrency=1",
        "--test-name-pattern=^(?:[1-9]|[12][0-9]|3[0-9])\.",
        "test/historyroot-wampanoag-regional-corpus.test.ts"
    ) $Backend
    Run "DictionaryRoot relationship backend" "npm.cmd" @(
        "run", "test:dictionaryroot:lexical-relationships"
    ) $Backend
    Run "DictionaryRoot relationship frontend" "npm.cmd" @(
        "run", "test:dictionaryroot:lexical-relationships:frontend"
    ) $Backend
    Run "DictionaryRoot current backend" "npm.cmd" @(
        "run", "test:dictionaryroot:core-lexical-corpus"
    ) $Backend
    Run "DictionaryRoot current frontend" "npm.cmd" @(
        "run", "test:dictionaryroot:core-lexical-corpus:frontend"
    ) $Backend
    Run "Chunk 11 backend" "npm.cmd" @("run", "test:unified-search") $Backend
    Run "Chunk 11 frontend" "npm.cmd" @(
        "run", "test:unified-search:frontend"
    ) $Backend
}

try {
    $DatabaseUrl = Read-DatabaseUrl $Backend
    $DatabaseState = Invoke-PsqlQuery $DatabaseUrl @"
SELECT current_database()
  || '|' || COALESCE((
    SELECT version FROM dictionaryroot_lexical_evidence_datasets
    WHERE dataset_id='$DictionaryDatasetId'
  ), '')
  || '|' || COALESCE((
    SELECT version FROM imported_bundles
    WHERE bundle_id='$HistoryDatasetId'
  ), '')
  || '|' || (
    SELECT COUNT(*) FROM schema_migrations WHERE migration_name LIKE '015%'
  )
  || '|' || (
    SELECT COUNT(*) FROM dictionaryroot_lexical_evidence_datasets
    WHERE fixture_only=TRUE
  )
  || '|' || (SELECT COUNT(*) FROM dictionaryroot_lexicon_datasets)
  || '|' || (SELECT COUNT(*) FROM dictionaryroot_lexicon_synsets)
  || '|' || (SELECT COUNT(*) FROM dictionaryroot_lexicon_relations)
  || '|' || (
    SELECT COUNT(*) FROM nodes
    WHERE lower(COALESCE(domain, ''))='dictionaryroot'
  );
"@
    $State = $DatabaseState.Split("|")
    if ($State.Count -eq 9 -and
        $State[0] -eq "sourceroot_test" -and
        $State[1] -eq "1.0.0" -and
        $State[2] -eq "1.3.0" -and
        @($State[3..8] | Where-Object { $_ -ne "0" }).Count -eq 0) {
        Pass "Current-checkpoint database" "sourceroot_test; datasets exact; migration 015, fixture, legacy tables, and generic nodes all zero."
    } else {
        Fail "Current-checkpoint database" $DatabaseState
    }

    $AppliedMigrations = @((
        Invoke-PsqlQuery $DatabaseUrl "SELECT migration_name FROM schema_migrations ORDER BY migration_name;"
    ) -split "`n" | Where-Object { $_ })
    $DiskMigrations = @(Get-ChildItem -LiteralPath (Join-Path $Backend "db\migrations") `
        -File -Filter "*.sql" | Sort-Object Name | Select-Object -ExpandProperty Name)
    $MissingApplied = @($DiskMigrations | Where-Object {
        $AppliedMigrations -notcontains $_
    })
    $UnexpectedApplied = @($AppliedMigrations | Where-Object {
        $DiskMigrations -notcontains $_
    })
    if ($MissingApplied.Count -eq 0 -and $UnexpectedApplied.Count -eq 0) {
        Pass "Applied migration checkpoint" "$($AppliedMigrations.Count) accepted migration files applied; no 015."
    } else {
        Fail "Applied migration checkpoint" "missing=$($MissingApplied -join ',') unexpected=$($UnexpectedApplied -join ',')"
    }
} catch {
    Fail "Current-checkpoint database" $_.Exception.Message
}

if (-not $SkipLiveApiChecks) {
    try {
        $Health = Read-Api "http://127.0.0.1:3000/health"
        if ($Health.status -eq "ok") {
            Pass "Live backend health" "Current backend returned healthy on port 3000."
        } else {
            Fail "Live backend health" ($Health | ConvertTo-Json -Compress)
        }
    } catch {
        Fail "Live backend health" $_.Exception.Message
    }

    try {
        $Bank = Read-Api "http://127.0.0.1:3000/api/v1/search/unified?q=bank&roots=DictionaryRoot"
        $BankIds = @($Bank.items | ForEach-Object resultId)
        if ($Bank.availability.status -eq "all-available" -and
            $Bank.counts.DictionaryRoot -gt 0 -and
            $Bank.counts.HistoryRoot -eq 0 -and
            @($BankIds | Select-Object -Unique).Count -eq $BankIds.Count -and
            @($Bank.items | Where-Object {
                $_.datasetId -ne $DictionaryDatasetId -or
                $_.datasetVersion -ne "1.0.0" -or
                $_.canonicalUrl -notlike "concept-v2.html?*"
            }).Count -eq 0) {
            Pass "Live DictionaryRoot unified search" "$($Bank.counts.DictionaryRoot) canonical bank results; no duplicates."
        } else {
            Fail "Live DictionaryRoot unified search" ($Bank | ConvertTo-Json -Compress -Depth 4)
        }
    } catch {
        Fail "Live DictionaryRoot unified search" $_.Exception.Message
    }

    try {
        $Plymouth = Read-Api "http://127.0.0.1:3000/api/v1/search/unified?q=Plymouth&roots=HistoryRoot"
        $PlymouthIds = @($Plymouth.items | ForEach-Object resultId)
        if ($Plymouth.availability.status -eq "all-available" -and
            $Plymouth.counts.HistoryRoot -gt 0 -and
            $Plymouth.counts.DictionaryRoot -eq 0 -and
            @($PlymouthIds | Select-Object -Unique).Count -eq $PlymouthIds.Count -and
            @($Plymouth.items | Where-Object {
                $_.datasetId -ne $HistoryDatasetId -or
                $_.datasetVersion -ne "1.3.0" -or
                $_.canonicalUrl -notmatch "^history-(record|context-review)-v1\.html\?"
            }).Count -eq 0) {
            Pass "Live HistoryRoot unified search" "$($Plymouth.counts.HistoryRoot) canonical Plymouth results; no duplicates."
        } else {
            Fail "Live HistoryRoot unified search" ($Plymouth | ConvertTo-Json -Compress -Depth 4)
        }
    } catch {
        Fail "Live HistoryRoot unified search" $_.Exception.Message
    }

    try {
        $MixedFirst = Read-Api "http://127.0.0.1:3000/api/v1/search/unified?q=community"
        $MixedSecond = Read-Api "http://127.0.0.1:3000/api/v1/search/unified?q=community"
        $FirstIds = @($MixedFirst.items | ForEach-Object resultId)
        $SecondIds = @($MixedSecond.items | ForEach-Object resultId)
        $Stable = ($FirstIds -join "|") -eq ($SecondIds -join "|")
        $BothRoots = @($MixedFirst.items.rootId | Select-Object -Unique).Count -eq 2
        if ($MixedFirst.availability.status -eq "all-available" -and
            $MixedFirst.counts.DictionaryRoot -gt 0 -and
            $MixedFirst.counts.HistoryRoot -gt 0 -and
            $MixedFirst.counts.duplicateResultIds -eq 0 -and
            $BothRoots -and $Stable) {
            Pass "Live mixed deterministic search" "Both Roots present; stable repeated order; duplicate count zero."
        } else {
            Fail "Live mixed deterministic search" "status=$($MixedFirst.availability.status) both=$BothRoots stable=$Stable duplicates=$($MixedFirst.counts.duplicateResultIds)"
        }
    } catch {
        Fail "Live mixed deterministic search" $_.Exception.Message
    }

    try {
        $Coverage = Read-Api "http://127.0.0.1:3000/api/v1/dictionaryroot/lexicon/evidence/coverage"
        $HistorySearch = Read-Api "http://127.0.0.1:3000/api/v1/search?q=Plymouth&domain=HistoryRoot&limit=5"
        if ($Coverage.datasetId -eq $DictionaryDatasetId -and
            $Coverage.datasetVersion -eq "1.0.0" -and
            @($HistorySearch.items).Count -gt 0) {
            Pass "Existing Root APIs" "DictionaryRoot coverage and HistoryRoot search remain live."
        } else {
            Fail "Existing Root APIs" "Coverage or HistoryRoot search identity failed."
        }
    } catch {
        Fail "Existing Root APIs" $_.Exception.Message
    }
}

try {
    & git -c core.autocrlf=false -C $Root diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Pass "Git index empty" "No staged changes."
    } else {
        Fail "Git index empty" "The index contains staged changes."
    }
    $PreviousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $DiffCheck = & git -c core.autocrlf=true -C $Root diff --check 2>$null
    $DiffCheckExit = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorPreference
    if ($DiffCheckExit -eq 0) {
        Pass "git diff --check" "Exit 0; no whitespace errors."
    } else {
        Fail "git diff --check" (@($DiffCheck) -join "`n")
    }
} catch {
    Fail "Git read-only checks" $_.Exception.Message
}

Write-Host ""
Write-Host "Chunk 11 verifier summary" -ForegroundColor Cyan
Write-Host "Pass count:    $script:PassCount"
Write-Host "Warning count: $script:WarningCount"
Write-Host "Failure count: $script:FailureCount"
if ($script:FailureCount -gt 0 -or $script:WarningCount -gt 0) {
    exit 1
}
exit 0
