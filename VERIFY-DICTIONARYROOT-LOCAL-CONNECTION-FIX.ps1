param(
    [string]$RepositoryPath = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
$Backend = Join-Path $Root "backend"
$Passed = 0
$Failed = 0

function Pass([string]$Message, [string]$Detail = "") {
    $script:Passed++
    Write-Host "[PASS] $Message" -ForegroundColor Green
    if ($Detail) { Write-Host "       $Detail" }
}

function Fail([string]$Message, [string]$Detail = "") {
    $script:Failed++
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    if ($Detail) { Write-Host "       $Detail" }
}

Write-Host "DictionaryRoot Local Development Connection Fix v1.0.1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $Root"
Write-Host ""

$StaticVerifier = Join-Path $Root "VERIFY-DICTIONARYROOT-LOCAL-CONNECTION-FIX.mjs"
& node.exe $StaticVerifier --repository $Root
if ($LASTEXITCODE -eq 0) { Pass "Static connection and guest-read checks" } else { Fail "Static connection and guest-read checks" }

$ApiScript = Join-Path $Root "assets\js\dictionaryroot-api.js"
& node.exe --check $ApiScript
if ($LASTEXITCODE -eq 0) { Pass "DictionaryRoot API JavaScript syntax" } else { Fail "DictionaryRoot API JavaScript syntax" }

& npm.cmd --prefix $Backend run typecheck
if ($LASTEXITCODE -eq 0) { Pass "Backend semantic TypeScript typecheck" } else { Fail "Backend semantic TypeScript typecheck" }

Push-Location $Backend
try {
    & node.exe --import tsx --test "test/local-development-cors.test.ts"
    if ($LASTEXITCODE -eq 0) { Pass "Local-development CORS behavior test" } else { Fail "Local-development CORS behavior test" }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Summary: $Passed passed, $Failed failed."
if ($Failed -gt 0) { exit 1 }
exit 0
