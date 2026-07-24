[CmdletBinding()]
param(
    [string]$RepositoryPath = $PSScriptRoot,
    [switch]$UseDocker,
    [switch]$SkipDependencies,
    [switch]$SkipMigrations
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    throw "Repository not found: $RepositoryPath"
}

$Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
$Backend = Join-Path $Root "backend"
$EnvFile = Join-Path $Backend ".env"
$EnvExample = Join-Path $Backend ".env.example"
$ComposeFile = Join-Path $Root "docker-compose.local.yml"

Write-Host "DictionaryRoot Governed Platform local setup (hotfix 1.0.2)" -ForegroundColor Cyan
Write-Host "Repository: $Root"

if (-not (Test-Path -LiteralPath $EnvExample -PathType Leaf)) {
    throw "Environment example not found: $EnvExample"
}

if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    Copy-Item -LiteralPath $EnvExample -Destination $EnvFile
    Write-Host "Created backend\.env from the local-development example." -ForegroundColor Green
    Write-Host "Review BOOTSTRAP_ADMIN_EMAILS before your first sign-in." -ForegroundColor Yellow
} else {
    $ExistingKeys = @{}
    foreach ($Line in Get-Content -LiteralPath $EnvFile) {
        if ($Line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=') {
            $ExistingKeys[$Matches[1]] = $true
        }
    }

    $MissingLines = New-Object System.Collections.Generic.List[string]
    foreach ($Line in Get-Content -LiteralPath $EnvExample) {
        if ($Line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=') {
            $Key = $Matches[1]
            if (-not $ExistingKeys.ContainsKey($Key)) {
                [void]$MissingLines.Add($Line)
                $ExistingKeys[$Key] = $true
            }
        }
    }

    if ($MissingLines.Count -gt 0) {
        Add-Content -LiteralPath $EnvFile -Value ""
        Add-Content -LiteralPath $EnvFile -Value "# Added by DictionaryRoot Governed Platform setup hotfix 1.0.2"
        Add-Content -LiteralPath $EnvFile -Value $MissingLines
        Write-Host "Preserved backend\.env and added $($MissingLines.Count) missing governed-platform setting(s)." -ForegroundColor Green
    } else {
        Write-Host "Preserved backend\.env; all governed-platform settings are already present." -ForegroundColor Green
    }
}

if ($UseDocker) {
    $Docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $Docker) {
        throw "Docker was not found. Install and start Docker Desktop, then rerun this command. To use an existing local PostgreSQL installation instead, rerun without -UseDocker."
    }
    if (-not (Test-Path -LiteralPath $ComposeFile -PathType Leaf)) {
        throw "Docker Compose file not found: $ComposeFile"
    }

    $DockerStatus = @(& $Docker.Source version --format '{{.Server.Version}}' 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is installed but its engine is not running. Start Docker Desktop, wait until it is ready, and rerun setup. $($DockerStatus -join ' ')"
    }

    & $Docker.Source compose -f $ComposeFile up -d postgres
    if ($LASTEXITCODE -ne 0) {
        throw "Docker could not start the local PostgreSQL service."
    }

    $DatabaseReady = $false
    for ($Attempt = 1; $Attempt -le 30; $Attempt++) {
        $ReadyOutput = @(& $Docker.Source compose -f $ComposeFile exec -T postgres pg_isready -U postgres -d sourceroot 2>&1)
        if ($LASTEXITCODE -eq 0) {
            $DatabaseReady = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $DatabaseReady) {
        throw "The PostgreSQL container started but did not become ready within 60 seconds. Check Docker Desktop and run 'docker compose -f `"$ComposeFile`" logs postgres'."
    }
    Write-Host "Local PostgreSQL container is ready." -ForegroundColor Green
}

$Node = Get-Command node -ErrorAction SilentlyContinue
$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $Node -or -not $Npm) {
    throw "Node.js and npm.cmd were not found. Install Node.js 22 or newer."
}

$NodeVersionText = (& $Node.Source --version).TrimStart('v')
$NodeMajor = 0
if (-not [int]::TryParse(($NodeVersionText -split '\.')[0], [ref]$NodeMajor)) {
    throw "Unable to determine the installed Node.js version: $NodeVersionText"
}
if ($NodeMajor -lt 22) {
    throw "Node.js 22 or newer is required. Installed version: $NodeVersionText"
}

Push-Location $Backend
try {
    if (-not $SkipDependencies) {
        & $Npm.Source ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm dependency installation failed."
        }
        Write-Host "Backend dependencies installed from package-lock.json." -ForegroundColor Green
    }

    if (-not $SkipMigrations) {
        & $Npm.Source run db:migrate
        if ($LASTEXITCODE -ne 0) {
            throw "Database migrations failed. Confirm DATABASE_URL and PostgreSQL availability."
        }
        Write-Host "Governed-platform database migrations applied." -ForegroundColor Green
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Local setup complete." -ForegroundColor Cyan
Write-Host "Start the product with:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$Root\START-DICTIONARYROOT-GOVERNED-PLATFORM.ps1`""
Write-Host "Local development authentication is enabled only by the development environment. Disable it in staging and production."
