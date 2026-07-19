param(
    [ValidateRange(1, 25000)]
    [int]$Limit = 500,

    [string]$ApiOrigin = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

$repo = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
$bundlePath = Join-Path $repo "data\dictionaryroot\dictionaryroot-oewn-2025-pilot-$Limit.json"
$apiBase = "$($ApiOrigin.TrimEnd('/'))/api/v1"

if (-not (Test-Path $bundlePath)) {
    throw "DictionaryRoot pilot bundle was not found at $bundlePath. Run BUILD-DICTIONARYROOT-PILOT.ps1 first."
}

try {
    $health = Invoke-RestMethod -Uri "$($ApiOrigin.TrimEnd('/'))/health" -Method Get
}
catch {
    Write-Host "The SourceRoot backend is not reachable at $ApiOrigin."
    Write-Host "Start it with:"
    Write-Host "npm.cmd --prefix `"C:\Users\Josh\Documents\GitHub\dictionaryhub\backend`" run dev"
    throw
}

Write-Host "Connected to SourceRoot backend: $($health.status)"
Write-Host ""
Write-Host "Validating DictionaryRoot pilot through the API..."

$validation = Invoke-RestMethod `
    -Uri "$apiBase/validate" `
    -Method Post `
    -ContentType "application/json" `
    -InFile $bundlePath

$validation.summary | Format-List

if (-not $validation.canImport) {
    Write-Host "Validation blocked the import."
    $validation.errors | Format-Table -AutoSize
    throw "DictionaryRoot pilot did not pass API validation."
}

Write-Host "Importing DictionaryRoot pilot into PostgreSQL..."

$import = Invoke-RestMethod `
    -Uri "$apiBase/import" `
    -Method Post `
    -ContentType "application/json" `
    -InFile $bundlePath

$import | Format-List

Write-Host ""
Write-Host "DictionaryRoot pilot import request completed."
Write-Host "Run verification with:"
Write-Host "powershell -ExecutionPolicy Bypass -File `"$repo\VERIFY-DICTIONARYROOT-PILOT.ps1`" -Limit $Limit"
