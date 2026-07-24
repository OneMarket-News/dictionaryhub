[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = $PSScriptRoot,

    [Parameter()]
    [string]$SourceVersion = "2025",

    [Parameter()]
    [string]$DatasetId = "dictionaryroot-oewn-2025-complete",

    [Parameter()]
    [string]$BundleId = "dictionaryroot-oewn-2025-pilot-500",

    [Parameter()]
    [ValidateRange(100, 5000)]
    [int]$BatchSize = 1000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repository = (Resolve-Path -LiteralPath $RepositoryPath).Path
$Backend = Join-Path $Repository "backend"
$Cache = Join-Path $env:LOCALAPPDATA "SourceRoot\oewn-$SourceVersion"
$Archive = Join-Path $Cache "english-wordnet-$SourceVersion.zip"
$Extract = Join-Path $Cache "extracted"
$DownloadUrl = "https://en-word.net/static/english-wordnet-$SourceVersion.zip"

if (-not (Test-Path -LiteralPath $Backend -PathType Container)) {
    throw "SourceRoot backend was not found at $Backend"
}
if (-not (Test-Path -LiteralPath (Join-Path $Backend ".env") -PathType Leaf)) {
    throw "backend\.env was not found. DATABASE_URL must be configured before importing the lexicon."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm.cmd was not found. Install Node.js and retry."
}

New-Item -ItemType Directory -Path $Cache -Force | Out-Null

if (-not (Test-Path -LiteralPath $Archive -PathType Leaf)) {
    Write-Host "Downloading Open English WordNet $SourceVersion..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $Archive -UseBasicParsing
    Write-Host "Downloaded: $Archive"
}
else {
    Write-Host "Using cached Open English WordNet archive: $Archive"
}

$DataNoun = Get-ChildItem -Path $Extract -Filter "data.noun" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $DataNoun) {
    Write-Host "Extracting Open English WordNet $SourceVersion..." -ForegroundColor Cyan
    Remove-Item $Extract -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $Extract -Force | Out-Null
    Expand-Archive -Path $Archive -DestinationPath $Extract -Force
}
else {
    Write-Host "Using cached extracted WordNet files: $Extract"
}

Write-Host ""
Write-Host "Applying SourceRoot database migrations..." -ForegroundColor Cyan
& npm.cmd --prefix $Backend run db:migrate
if ($LASTEXITCODE -ne 0) {
    throw "SourceRoot database migrations failed with exit code $LASTEXITCODE."
}

Write-Host ""
Write-Host "Importing complete DictionaryRoot lexical coverage..." -ForegroundColor Cyan
Write-Host "Dataset ID: $DatasetId"
Write-Host "Stable bundle ID: $BundleId"
Write-Host "The graph remains bounded; this import creates the complete exact-lemma index and on-demand concept records."

& npm.cmd --prefix $Backend run dictionaryroot:lexicon -- `
    --source-dir $Extract `
    --source-version $SourceVersion `
    --dataset-id $DatasetId `
    --bundle-id $BundleId `
    --batch-size $BatchSize

if ($LASTEXITCODE -ne 0) {
    throw "DictionaryRoot complete lexicon import failed with exit code $LASTEXITCODE."
}

Write-Host ""
Write-Host "Complete lexical coverage import finished." -ForegroundColor Green
Write-Host "Restart SourceRoot with:"
Write-Host "  cd `"$Backend`""
Write-Host "  npm.cmd run dev"
Write-Host ""
Write-Host "Then verify with:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$Repository\VERIFY-DICTIONARYROOT-COMPLETE-SENSE-COVERAGE.ps1`""
