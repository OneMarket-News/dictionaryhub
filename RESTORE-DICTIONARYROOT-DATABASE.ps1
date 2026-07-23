[CmdletBinding(SupportsShouldProcess=$true, ConfirmImpact="High")]
param(
    [Parameter(Mandatory=$true)][string]$BackupPath,
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",
    [string]$DatabaseUrl = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) { throw "Backup not found: $BackupPath" }
$Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
if (-not $DatabaseUrl) {
    $EnvFile = Join-Path $Root "backend\.env"
    if (Test-Path -LiteralPath $EnvFile) {
        $Line = Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
        if ($Line) { $DatabaseUrl = $Line.Substring("DATABASE_URL=".Length).Trim() }
    }
}
if (-not $DatabaseUrl) { throw "DATABASE_URL was not supplied and was not found in backend\.env." }
$PgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $PgRestore) { throw "pg_restore was not found. Install PostgreSQL client tools." }
if ($PSCmdlet.ShouldProcess($DatabaseUrl, "Restore DictionaryRoot database from $BackupPath")) {
    & $PgRestore.Source --dbname=$DatabaseUrl --clean --if-exists --no-owner $BackupPath
    if ($LASTEXITCODE -ne 0) { throw "Database restore failed." }
    Write-Host "Database restore completed." -ForegroundColor Green
}
