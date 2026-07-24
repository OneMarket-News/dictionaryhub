param(
    [ValidateRange(1, 25000)]
    [int]$Limit = 500,

    [string]$ApiOrigin = "http://localhost:3000",

    [ValidateRange(30, 3600)]
    [int]$ValidationTimeoutSeconds = 600,

    [ValidateRange(30, 7200)]
    [int]$ImportTimeoutSeconds = 1200
)

$ErrorActionPreference = "Stop"

$repo = $PSScriptRoot
$bundlePath = Join-Path $repo "data\dictionaryroot\dictionaryroot-oewn-2025-pilot-$Limit.json"
$apiOriginNormalized = $ApiOrigin.TrimEnd('/')
$apiBase = "$apiOriginNormalized/api/v1"
$totalTimer = [System.Diagnostics.Stopwatch]::StartNew()

if (-not (Test-Path $bundlePath)) {
    throw "DictionaryRoot pilot bundle was not found at $bundlePath. Run BUILD-DICTIONARYROOT-PILOT.ps1 first."
}

$curlCommand = Get-Command "curl.exe" -ErrorAction SilentlyContinue
if (-not $curlCommand) {
    throw "curl.exe was not found. This importer requires the Windows curl client for reliable large JSON uploads."
}

try {
    $health = Invoke-RestMethod -Uri "$apiOriginNormalized/health" -Method Get
}
catch {
    Write-Host "The SourceRoot backend is not reachable at $ApiOrigin."
    Write-Host "Start it with:"
    Write-Host "npm.cmd --prefix `"$repo\backend`" run dev"
    throw
}

$bundleFile = Get-Item $bundlePath
$bundleSizeMb = [math]::Round($bundleFile.Length / 1MB, 2)
$bundleDocument = Get-Content -Path $bundlePath -Raw | ConvertFrom-Json
$bundleId = [string]$bundleDocument.bundleId

if ([string]::IsNullOrWhiteSpace($bundleId)) {
    throw "The DictionaryRoot pilot bundle does not contain a bundleId."
}

$tempDirectory = Join-Path $env:TEMP ("sourceroot-dictionaryroot-import-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDirectory -Force | Out-Null

function Invoke-CurlJsonPost {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,

        [Parameter(Mandatory = $true)]
        [string]$InputPath,

        [Parameter(Mandatory = $true)]
        [string]$OutputPath,

        [Parameter(Mandatory = $true)]
        [int]$TimeoutSeconds
    )

    $arguments = @(
        "--http1.1",
        "--silent",
        "--show-error",
        "--connect-timeout", "10",
        "--max-time", "$TimeoutSeconds",
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json",
        "-H", "Expect:",
        "--data-binary", "@$InputPath",
        "--output", $OutputPath,
        "--write-out", "%{http_code}",
        $Url
    )

    $httpCodeText = (& curl.exe @arguments)
    $curlExitCode = $LASTEXITCODE
    $httpCode = 0

    if ($null -ne $httpCodeText) {
        [void][int]::TryParse(([string]$httpCodeText).Trim(), [ref]$httpCode)
    }

    $responseText = ""
    if (Test-Path $OutputPath) {
        $responseText = Get-Content -Path $OutputPath -Raw
    }

    if ($curlExitCode -ne 0) {
        if (-not [string]::IsNullOrWhiteSpace($responseText)) {
            Write-Host $responseText
        }

        throw "curl.exe failed with exit code $curlExitCode while calling $Url."
    }

    if ($httpCode -lt 200 -or $httpCode -ge 300) {
        if (-not [string]::IsNullOrWhiteSpace($responseText)) {
            Write-Host $responseText
        }

        throw "SourceRoot returned HTTP $httpCode while calling $Url."
    }

    if ([string]::IsNullOrWhiteSpace($responseText)) {
        throw "SourceRoot returned an empty response while calling $Url."
    }

    try {
        return $responseText | ConvertFrom-Json
    }
    catch {
        Write-Host $responseText
        throw "SourceRoot returned a response that was not valid JSON while calling $Url."
    }
}

try {
    Write-Host "Connected to SourceRoot backend: $($health.status)"
    Write-Host "Bundle ID: $bundleId"
    Write-Host "Bundle: $bundlePath"
    Write-Host "Bundle size: $bundleSizeMb MB"
    Write-Host "Upload client: curl.exe"
    Write-Host ""
    Write-Host "Validating DictionaryRoot pilot through the API..."

    $validationOutput = Join-Path $tempDirectory "validation.json"
    $validationTimer = [System.Diagnostics.Stopwatch]::StartNew()
    $validation = Invoke-CurlJsonPost `
        -Url "$apiBase/validate" `
        -InputPath $bundlePath `
        -OutputPath $validationOutput `
        -TimeoutSeconds $ValidationTimeoutSeconds
    $validationTimer.Stop()

    $validation.summary | Format-List

    if (-not $validation.canImport) {
        Write-Host "Validation blocked the import."
        $validation.errors | Format-Table -AutoSize
        throw "DictionaryRoot pilot did not pass API validation."
    }

    Write-Host "Importing DictionaryRoot pilot into PostgreSQL..."

    $importOutput = Join-Path $tempDirectory "import.json"
    $importTimer = [System.Diagnostics.Stopwatch]::StartNew()
    $import = Invoke-CurlJsonPost `
        -Url "$apiBase/import" `
        -InputPath $bundlePath `
        -OutputPath $importOutput `
        -TimeoutSeconds $ImportTimeoutSeconds
    $importTimer.Stop()

    $import | Format-List
    $totalTimer.Stop()

    Write-Host ""
    Write-Host "Performance"
    Write-Host "API validation: $([math]::Round($validationTimer.Elapsed.TotalMilliseconds, 1)) ms"
    Write-Host "PostgreSQL import: $([math]::Round($importTimer.Elapsed.TotalMilliseconds, 1)) ms"
    Write-Host "Total script: $([math]::Round($totalTimer.Elapsed.TotalMilliseconds, 1)) ms"
    Write-Host ""
    Write-Host "DictionaryRoot pilot import request completed."
    Write-Host "Run verification with:"
    Write-Host "powershell -ExecutionPolicy Bypass -File `"$repo\VERIFY-DICTIONARYROOT-PILOT.ps1`" -Limit $Limit"
    Write-Host ""
    Write-Host "Run performance benchmarks with:"
    Write-Host "powershell -ExecutionPolicy Bypass -File `"$repo\BENCHMARK-DICTIONARYROOT-PILOT.ps1`" -Limit $Limit"
}
finally {
    Remove-Item $tempDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
