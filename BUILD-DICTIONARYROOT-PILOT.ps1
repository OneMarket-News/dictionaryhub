param(
    [ValidateRange(1, 25000)]
    [int]$Limit = 500,

    [string]$BundleId = "dictionaryroot-oewn-2025-pilot-500"
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repo = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
$backend = Join-Path $repo "backend"
$cache = Join-Path $env:LOCALAPPDATA "SourceRoot\oewn-2025"
$archive = Join-Path $cache "english-wordnet-2025.zip"
$extract = Join-Path $cache "extracted"
$outputDirectory = Join-Path $repo "data\dictionaryroot"
$output = Join-Path $outputDirectory "dictionaryroot-oewn-2025-pilot-$Limit.json"
$downloadUrl = "https://en-word.net/static/english-wordnet-2025.zip"

if (-not (Test-Path $backend)) {
    throw "SourceRoot backend was not found at $backend"
}

if ([string]::IsNullOrWhiteSpace($BundleId)) {
    throw "BundleId must not be empty."
}

New-Item -ItemType Directory -Path $cache -Force | Out-Null
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

if (-not (Test-Path $archive)) {
    Write-Host "Downloading Open English WordNet 2025..."
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archive -UseBasicParsing
    Write-Host "Downloaded $archive"
}
else {
    Write-Host "Using cached download: $archive"
}

$dataFile = Get-ChildItem -Path $extract -Filter "data.noun" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $dataFile) {
    Write-Host "Extracting Open English WordNet 2025..."
    Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $extract -Force | Out-Null
    Expand-Archive -Path $archive -DestinationPath $extract -Force
}
else {
    Write-Host "Using cached extracted files: $extract"
}

Write-Host ""
Write-Host "Building DictionaryRoot pilot bundle with $Limit nodes..."
Write-Host "Stable bundle identity: $BundleId"

& npm.cmd --prefix $backend run dictionaryroot:pilot -- `
    --source-dir $extract `
    --limit $Limit `
    --source-version 2025 `
    --bundle-id $BundleId `
    --output $output

if ($LASTEXITCODE -ne 0) {
    throw "DictionaryRoot pilot generation failed with exit code $LASTEXITCODE."
}

Write-Host ""
Write-Host "DictionaryRoot pilot created and locally validated:"
Write-Host $output
Write-Host ""
Write-Host "The filename records the scale, while bundleId remains the continuing dataset identity."
Write-Host ""
Write-Host "Start the backend in one PowerShell window:"
Write-Host "npm.cmd --prefix `"$backend`" run dev"
Write-Host ""
Write-Host "Then import the pilot in another PowerShell window:"
Write-Host "powershell -ExecutionPolicy Bypass -File `"$repo\IMPORT-DICTIONARYROOT-PILOT.ps1`" -Limit $Limit"
