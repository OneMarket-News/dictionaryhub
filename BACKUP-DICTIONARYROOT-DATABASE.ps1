[CmdletBinding()]
param(
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",
    [string]$DatabaseUrl = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
if (-not $DatabaseUrl) {
    $EnvFile = Join-Path $Root "backend\.env"
    if (Test-Path -LiteralPath $EnvFile) {
        $Line = Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
        if ($Line) { $DatabaseUrl = $Line.Substring("DATABASE_URL=".Length).Trim() }
    }
}
if (-not $DatabaseUrl) { throw "DATABASE_URL was not supplied and was not found in backend\.env." }
$PgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $PgDump) { throw "pg_dump was not found. Install PostgreSQL client tools." }
$Directory = Join-Path $Root "backups\database"
New-Item -ItemType Directory -Path $Directory -Force | Out-Null
$Output = Join-Path $Directory ("dictionaryroot-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".dump")
& $PgDump.Source --dbname=$DatabaseUrl --format=custom --file=$Output
if ($LASTEXITCODE -ne 0) { throw "Database backup failed." }
Write-Host "Database backup created: $Output" -ForegroundColor Green
