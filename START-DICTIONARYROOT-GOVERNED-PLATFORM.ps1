[CmdletBinding()]
param(
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",
    [int]$FrontendPort = 8080
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) { throw "Repository not found: $RepositoryPath" }
$Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
$Backend = Join-Path $Root "backend"
if (-not (Test-Path -LiteralPath (Join-Path $Backend ".env") -PathType Leaf)) {
    throw "backend\.env is missing. Run SETUP-DICTIONARYROOT-GOVERNED-PLATFORM.ps1 first."
}
if (-not (Test-Path -LiteralPath (Join-Path $Backend "node_modules") -PathType Container)) {
    throw "Backend dependencies are missing. Run SETUP-DICTIONARYROOT-GOVERNED-PLATFORM.ps1 first."
}

$PythonCommand = $null
if (Get-Command py -ErrorAction SilentlyContinue) { $PythonCommand = "py" }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $PythonCommand = "python" }
else { throw "Python was not found. Install Python or start another static web server on port $FrontendPort." }

$BackendCommand = "Set-Location -LiteralPath '$($Backend.Replace("'", "''"))'; npm.cmd start"
$FrontendCommand = "Set-Location -LiteralPath '$($Root.Replace("'", "''"))'; $PythonCommand -m http.server $FrontendPort"

Start-Process powershell.exe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $BackendCommand)
Start-Sleep -Seconds 1
Start-Process powershell.exe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $FrontendCommand)

Write-Host "DictionaryRoot services launched in separate PowerShell windows." -ForegroundColor Green
Write-Host "Frontend: http://localhost:$FrontendPort/index.html"
Write-Host "Backend health: http://localhost:3000/health"
Write-Host "Account: http://localhost:$FrontendPort/account-v1.html"
Write-Host "Workflow: http://localhost:$FrontendPort/workflow-v1.html"
Write-Host "Administration: http://localhost:$FrontendPort/admin-v1.html"
