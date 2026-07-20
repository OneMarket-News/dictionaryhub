$ErrorActionPreference = "Stop"

$RepoRoot = "C:\Users\Josh\Documents\GitHub\dictionaryhub"

function Pass([string]$Message) {
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Check-Marker([string]$RelativePath, [string[]]$Markers) {
    $Path = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing file: $RelativePath"
    }
    $Content = Get-Content -LiteralPath $Path -Raw
    foreach ($Marker in $Markers) {
        if ($Content -notlike "*$Marker*") {
            throw "Expected readability marker '$Marker' was not found in $RelativePath"
        }
    }
    Pass $RelativePath
}

Write-Host "DictionaryRoot graph readability verification" -ForegroundColor Cyan
Write-Host ""

Check-Marker "graph-v2.html" @(
    "dictionaryroot-graph-page",
    "Fit graph",
    "dictionaryroot-graph.js"
)

Check-Marker "assets\css\dictionaryroot-live.css" @(
    ".dictionaryroot-graph-page .dr-live-main",
    ".dr-graph-node .dr-node-card",
    "height: 760px"
)

Check-Marker "assets\js\dictionaryroot-graph.js" @(
    "function fitGraph",
    "function wrapNodeLabel",
    "function edgeEndpoints",
    "dr-node-card"
)

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCommand) {
    & node --check (Join-Path $RepoRoot "assets\js\dictionaryroot-graph.js")
    if ($LASTEXITCODE -ne 0) {
        throw "dictionaryroot-graph.js failed JavaScript syntax verification."
    }
    Pass "JavaScript syntax"
} else {
    Write-Host "[INFO] Node was not available, so JavaScript syntax verification was skipped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Graph readability code is installed." -ForegroundColor Green
Write-Host "Refresh graph-v2.html with Ctrl+F5 to bypass the browser cache."
