[CmdletBinding()]
param(
    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [string]$RepositoryPath = ""
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

$PackageRoot = if ($PackagePath) {
    [IO.Path]::GetFullPath($PackagePath).TrimEnd("\", "/")
} else {
    [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
}
$RepositoryRoot = if ($RepositoryPath) {
    [IO.Path]::GetFullPath($RepositoryPath).TrimEnd("\", "/")
} elseif ($env:SOURCEROOT_REPOSITORY_PATH) {
    [IO.Path]::GetFullPath($env:SOURCEROOT_REPOSITORY_PATH).TrimEnd("\", "/")
} else {
    [IO.Path]::GetFullPath((Get-Location).Path).TrimEnd("\", "/")
}
$BackendRoot = Join-Path $RepositoryRoot "backend"
$RecordRoot = ""

try {
    Write-Host "SourceRoot Chunk 10B installer" -ForegroundColor Cyan
    if ($PackageRoot.StartsWith($RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "The release package must be external to the Git repository."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $BackendRoot "package.json") -PathType Leaf)) {
        throw "RepositoryPath must identify the SourceRoot repository (or set SOURCEROOT_REPOSITORY_PATH)."
    }
    $ManifestPath = Join-Path $PackageRoot "PACKAGE-MANIFEST.json"
    $Manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
    if ($Manifest.packageId -ne "SourceRoot-DictionaryRoot-Core-Lexical-Corpus-v1" -or
        $Manifest.datasetId -ne "dictionaryroot-core-lexical-corpus-v1" -or
        $Manifest.datasetVersion -ne "1.0.0") {
        throw "Package identity or version is invalid."
    }
    foreach ($File in @($Manifest.files)) {
        $Relative = ([string]$File.path).Replace("/", "\")
        if ([IO.Path]::IsPathRooted($Relative) -or $Relative -match '(^|\\)\.\.?($|\\)') {
            throw "Unsafe package path: $Relative"
        }
        $Path = [IO.Path]::GetFullPath((Join-Path $PackageRoot $Relative))
        if (-not $Path.StartsWith($PackageRoot + "\", [StringComparison]::OrdinalIgnoreCase) -or
            -not (Test-Path -LiteralPath $Path -PathType Leaf) -or
            (Hash $Path) -ne ([string]$File.sha256).ToUpperInvariant()) {
            throw "Package hash validation failed: $Relative"
        }
    }

    $DatabaseLine = Get-Content -LiteralPath (Join-Path $BackendRoot ".env.test") |
        Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
    if (-not $DatabaseLine) { throw "DATABASE_URL is missing from backend/.env.test." }
    $DatabaseUrl = $DatabaseLine.Substring("DATABASE_URL=".Length).Trim().Trim('"')
    $DatabaseName = ([Uri]$DatabaseUrl).AbsolutePath.TrimStart("/")
    if ($DatabaseName -ne "sourceroot_test") {
        throw "Refusing database '$DatabaseName'; exactly sourceroot_test is required."
    }
    $MigrationLines = & psql $DatabaseUrl --no-psqlrc --tuples-only --no-align --command `
        "SELECT migration_name FROM schema_migrations ORDER BY migration_name;"
    if ($LASTEXITCODE -ne 0) { throw "Could not read the migration ledger." }
    $Migrations = @(
        $MigrationLines |
            ForEach-Object { ([string]$_).Trim() } |
            Where-Object { $_ }
    )
    foreach ($Required in @(
        "013_create_dictionaryroot_lexical_evidence.sql",
        "014_create_dictionaryroot_lexical_relationships.sql"
    )) {
        if ($Migrations -notcontains $Required) { throw "Required migration is absent: $Required" }
    }
    if (@($Migrations | Where-Object { $_ -like "015*" }).Count -gt 0) {
        throw "Migration 015 is outside this installer's approved boundary."
    }

    $Stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $PackageParent = Split-Path -Parent $PackageRoot
    $RecordRoot = Join-Path $PackageParent `
        "SourceRoot-DictionaryRoot-Core-Lexical-Corpus-v1-installation-records\$Stamp"
    New-Item -ItemType Directory -Path $RecordRoot -Force | Out-Null
    $Before = & psql $DatabaseUrl --no-psqlrc --tuples-only --no-align --command `
        "SELECT json_build_object('datasets',(SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM (SELECT dataset_id,version,status,fixture_only FROM dictionaryroot_lexical_evidence_datasets ORDER BY dataset_id) d),'legacy_datasets',(SELECT COUNT(*) FROM dictionaryroot_lexicon_datasets),'legacy_synsets',(SELECT COUNT(*) FROM dictionaryroot_lexicon_synsets),'legacy_relations',(SELECT COUNT(*) FROM dictionaryroot_lexicon_relations));"
    if ($LASTEXITCODE -ne 0) { throw "Pre-install database snapshot failed." }
    Write-Utf8 (Join-Path $RecordRoot "pre-install-database.json") (($Before | Out-String).Trim() + "`n")

    $CorpusPath = Join-Path $PackageRoot "data\corpus.json"
    Push-Location $BackendRoot
    try {
        & node --env-file=.env.test --import ./scripts/register-tsx.mjs `
            ./src/scripts/import-dictionaryroot-core-lexical-corpus.ts $CorpusPath
        if ($LASTEXITCODE -ne 0) { throw "Initial production import failed." }
        & node --env-file=.env.test --import ./scripts/register-tsx.mjs `
            ./src/scripts/import-dictionaryroot-core-lexical-corpus.ts $CorpusPath
        if ($LASTEXITCODE -ne 0) { throw "Duplicate-safe reimport failed." }
    } finally {
        Pop-Location
    }

    $After = & psql $DatabaseUrl --no-psqlrc --tuples-only --no-align --command `
        "SELECT json_build_object('production_datasets',(SELECT COUNT(*) FROM dictionaryroot_lexical_evidence_datasets WHERE dataset_id='dictionaryroot-core-lexical-corpus-v1' AND version='1.0.0' AND fixture_only=FALSE),'fixture_datasets',(SELECT COUNT(*) FROM dictionaryroot_lexical_evidence_datasets WHERE fixture_only=TRUE),'legacy_datasets',(SELECT COUNT(*) FROM dictionaryroot_lexicon_datasets),'legacy_synsets',(SELECT COUNT(*) FROM dictionaryroot_lexicon_synsets),'legacy_relations',(SELECT COUNT(*) FROM dictionaryroot_lexicon_relations));"
    if ($LASTEXITCODE -ne 0) { throw "Post-install database verification failed." }
    $AfterObject = $After | ConvertFrom-Json
    if ($AfterObject.production_datasets -ne 1 -or $AfterObject.fixture_datasets -ne 0 -or
        $AfterObject.legacy_datasets -ne 0 -or $AfterObject.legacy_synsets -ne 0 -or
        $AfterObject.legacy_relations -ne 0) {
        throw "Installed database boundary is invalid: $After"
    }
    Write-Utf8 (Join-Path $RecordRoot "post-install-database.json") (($After | Out-String).Trim() + "`n")

    & powershell.exe -NoProfile -ExecutionPolicy Bypass `
        -File (Join-Path $PackageRoot "VERIFY-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1") `
        -RepositoryPath $RepositoryRoot -PackagePath $PackageRoot -SkipExecutableChecks
    $VerifierExit = $LASTEXITCODE
    if ($VerifierExit -ne 0) { throw "Package verifier failed after import." }

    $Record = [ordered]@{
        schemaVersion = "1.0.0"
        packageId = $Manifest.packageId
        datasetId = "dictionaryroot-core-lexical-corpus-v1"
        datasetVersion = "1.0.0"
        installedAt = (Get-Date).ToUniversalTime().ToString("o")
        database = $DatabaseName
        repositoryPath = $RepositoryRoot
        packagePath = $PackageRoot
        backupPath = $RecordRoot
        packageHashesVerified = $true
        replacementSafeImportVerified = $true
        duplicateSafeReimportVerified = $true
        fixtureExcluded = $true
        legacyLexiconTablesEmpty = $true
        packageVerifierExitCode = $VerifierExit
    }
    Write-Utf8 (Join-Path $RecordRoot "installation-record.json") `
        (($Record | ConvertTo-Json -Depth 6) + "`n")
    Write-Host "Installer: PASS" -ForegroundColor Green
    Write-Host "Installation record: $(Join-Path $RecordRoot 'installation-record.json')"
    exit 0
} catch {
    Write-Error $_.Exception.Message
    if ($RecordRoot) { Write-Host "Recovery records retained: $RecordRoot" }
    exit 1
}
