<#
.SYNOPSIS
Stable root entry point for DictionaryRoot repository verification.

.PARAMETER RunExistingVerifiers
Passes through the explicit request to run discovered root verifiers.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$RunExistingVerifiers
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ToolPath = Join-Path $PSScriptRoot "tools\VERIFY-ROOT-REPOSITORY.ps1"
if (-not (Test-Path -LiteralPath $ToolPath -PathType Leaf)) {
    Write-Host "[FAIL] Repository verifier tool is missing: $ToolPath" -ForegroundColor Red
    exit 2
}

try {
    $PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
    $Arguments = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $ToolPath,
        "-RepositoryPath", $PSScriptRoot
    )
    if ($RunExistingVerifiers) {
        $Arguments += "-RunExistingVerifiers"
    }
    & $PowerShell @Arguments
    $ChildExitCode = $LASTEXITCODE
    exit $ChildExitCode
} catch {
    Write-Host "[FAIL] Could not invoke the repository verifier: $($_.Exception.Message)" -ForegroundColor Red
    exit 2
}
