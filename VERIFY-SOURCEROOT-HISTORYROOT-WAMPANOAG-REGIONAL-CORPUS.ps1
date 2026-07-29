<#
.SYNOPSIS
Fail-closed verifier for SourceRoot Chunk 9.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "",

    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [switch]$FinalAcceptance,

    [Parameter()]
    [switch]$SkipExecutableChecks
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:PassCount = 0
$script:WarningCount = 0
$script:FailureCount = 0

function Pass([string]$Name, [string]$Detail = "") {
    $script:PassCount++
    Write-Host "[PASS] $Name" -ForegroundColor Green
    if ($Detail) { Write-Host "       $Detail" }
}
function Fail([string]$Name, [string]$Detail = "") {
    $script:FailureCount++
    Write-Host "[FAIL] $Name" -ForegroundColor Red
    if ($Detail) { Write-Host "       $Detail" }
}
function Hash([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function Check-Hash([string]$Name, [string]$Path, [string]$Expected) {
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        $Actual = Hash $Path
        if ($Actual -eq $Expected) { Pass $Name $Actual } else { Fail $Name $Actual }
    } else { Fail $Name "Missing: $Path" }
}
function Safe-Relative([string]$Path) {
    return -not (
        [string]::IsNullOrWhiteSpace($Path) -or
        [IO.Path]::IsPathRooted($Path) -or
        $Path.Replace("\", "/") -match '(^|/)\.{1,2}(/|$)'
    )
}
function Run(
    [string]$Name,
    [string]$File,
    [string[]]$Arguments,
    [string]$WorkingDirectory
) {
    Push-Location $WorkingDirectory
    try {
        & $File @Arguments
        $Code = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($Code -eq 0) { Pass $Name "Exit 0." } else { Fail $Name "Exit $Code." }
}

$RepositoryRoot = if ($RepositoryPath) {
    [IO.Path]::GetFullPath($RepositoryPath).TrimEnd("\", "/")
} elseif (Test-Path -LiteralPath (Join-Path $PSScriptRoot "ROOT-MANIFEST.json")) {
    [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
} else {
    throw "RepositoryPath is required when the verifier runs outside the repository."
}
$BackendRoot = Join-Path $RepositoryRoot "backend"
$DataRoot = Join-Path $BackendRoot "data\historyroot-wampanoag-regional-corpus-v1"
$ReleaseRoot = "C:\Users\Josh\Documents\SourceRoot-Releases"
$Expected = [ordered]@{
    "expansion-workspace.json" = "87901F6D5BC672FC2BC2ACC2559296EF8AC5BA5634E2954FDC3D265A063C3A4C"
    "historyroot-wampanoag-regional-corpus-v1.bundle.json" = "E3BFEBD9D98353BB9F05893E2865C838DF04E322F18E0F4E68CE124B32665B02"
    "corpus-inventory.json" = "CEDB0E5073819899EEAA027A036076C16CA72F324619A2F0D11AA58D3B9A84C8"
    "quality-review.json" = "B552061303688F472C0B50E65A0139CFDE9D87E7D77A0CC43208AD16E80617D5"
    "quality-review.md" = "D8D53AE7784A68CFE5FCBFD0313B9A670E801335DF22F9C91697D6A32F5C3140"
}

Write-Host "SourceRoot Chunk 9 HistoryRoot regional corpus verifier" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"

try {
    $Branch = (& git -C $RepositoryRoot branch --show-current).Trim()
    $Head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
    $UpstreamName = (& git -C $RepositoryRoot rev-parse --abbrev-ref --symbolic-full-name '@{u}').Trim()
    $Upstream = (& git -C $RepositoryRoot rev-parse '@{u}').Trim()
    if (
        $Branch -eq "release/historyroot-alpha-integration-v1" -and
        $Head -eq "7890995eafdb031230439c6f97750274273711ab" -and
        $UpstreamName -eq "origin/release/historyroot-alpha-integration-v1" -and
        $Upstream -eq $Head
    ) {
        Pass "Starting checkpoint" "$Branch at $Head"
    } else {
        Fail "Starting checkpoint" "Branch=$Branch HEAD=$Head upstream=$UpstreamName@$Upstream"
    }
} catch { Fail "Starting checkpoint" $_.Exception.Message }

try {
    $Tag = (& git -C $RepositoryRoot rev-parse 'sourceroot-historyroot-corpus-expansion-quality-v1^{}').Trim()
    if ($Tag -eq "fefbe6fdded9c53fe27996cbaeb7980bca248f4c") {
        Pass "Chunk 8 tag identity" $Tag
    } else { Fail "Chunk 8 tag identity" $Tag }
} catch { Fail "Chunk 8 tag identity" $_.Exception.Message }

Check-Hash "Candidate registry identity" `
    (Join-Path $BackendRoot "data\historyroot-regional-expansion-acquisition-v1\candidate-sources.json") `
    "7651FB9363AEF1A0431DA76347F881F0B5EC0E5CC8A99F45B2376BCAAC755947"
Check-Hash "Feasibility report identity" `
    (Join-Path $BackendRoot "data\historyroot-regional-expansion-acquisition-v1\feasibility-report.json") `
    "9143C907A27E299B69391937CCEACC17AFD751EE01AA3B9F65CA98E800659D2B"
Check-Hash "Chunk 8 release ZIP identity" `
    (Join-Path $ReleaseRoot "SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1.zip") `
    "B159BAD009FF65C500BE6B57889619E576A1C2729E4469C101E494A4D318784F"

try {
    $Registry = Get-Content -Raw -LiteralPath (Join-Path $BackendRoot "data\historyroot-regional-expansion-acquisition-v1\candidate-sources.json") | ConvertFrom-Json
    $Accepted = @($Registry.candidates | Where-Object acquisitionStatus -eq "accepted")
    $Rejected = @($Registry.candidates | Where-Object acquisitionStatus -eq "rejected")
    $Counts = @(
        $Accepted.Count,
        $Rejected.Count,
        @($Accepted | Where-Object { $_.categories.indigenousLed }).Count,
        @($Accepted | Where-Object { $_.categories.primaryOrArchival }).Count,
        @($Accepted | Where-Object { $_.categories.institutional }).Count,
        @($Accepted | Where-Object { $_.categories.archaeologicalOrScholarly }).Count
    )
    if (($Counts -join ",") -eq "20,3,8,7,14,12") {
        Pass "Acquisition candidate counts" "Accepted/rejected/Indigenous/primary/institutional/archaeological = $($Counts -join '/')."
    } else { Fail "Acquisition candidate counts" ($Counts -join "/") }
} catch { Fail "Acquisition candidate counts" $_.Exception.Message }

$Migrations = @(Get-ChildItem -LiteralPath (Join-Path $BackendRoot "db\migrations") -File -Filter "*.sql")
$Complete = (1..12 | ForEach-Object {
    $Prefix = "{0:D3}_" -f $_
    @($Migrations | Where-Object { $_.Name.StartsWith($Prefix) }).Count -gt 0
}) -notcontains $false
$Has013 = @($Migrations | Where-Object { $_.Name.StartsWith("013_") }).Count -gt 0
if ($Complete -and -not $Has013) {
    Pass "Migration boundary" "001-012 present; 013 absent."
} else { Fail "Migration boundary" "complete=$Complete has013=$Has013" }

foreach ($Entry in $Expected.GetEnumerator()) {
    $Path = Join-Path $DataRoot $Entry.Key
    if ((Test-Path -LiteralPath $Path -PathType Leaf) -and
        (Hash $Path) -eq $Entry.Value) {
        Pass "Artifact $($Entry.Key)" "$((Get-Item -LiteralPath $Path).Length) bytes; $($Entry.Value)"
    } else { Fail "Artifact $($Entry.Key)" "Missing or hash mismatch." }
}

try {
    $Workspace = Get-Content -Raw -LiteralPath (Join-Path $DataRoot "expansion-workspace.json") | ConvertFrom-Json
    $Bundle = Get-Content -Raw -LiteralPath (Join-Path $DataRoot "historyroot-wampanoag-regional-corpus-v1.bundle.json") | ConvertFrom-Json
    $Inventory = Get-Content -Raw -LiteralPath (Join-Path $DataRoot "corpus-inventory.json") | ConvertFrom-Json
    $QualityText = Get-Content -Raw -LiteralPath (Join-Path $DataRoot "quality-review.json")
    $Quality = $QualityText | ConvertFrom-Json
    if ($Workspace.schemaVersion -eq "1.1.0" -and $Workspace.approvals.approved) {
        Pass "Workspace schema and approval"
    } else { Fail "Workspace schema and approval" }
    if ($Bundle.bundleId -eq "historyroot-plymouth-knowledge-dataset-v1" -and $Bundle.version -eq "1.3.0") {
        Pass "Bundle identity and version" "$($Bundle.bundleId) $($Bundle.version)"
    } else { Fail "Bundle identity and version" }
    $ExpectedAdditions = [ordered]@{
        records = 54; claims = 28; sources = 20; accounts = 14
        dateExpressions = 32; relationships = 48; locators = 28
        fieldProvenance = 32; evidenceLinks = 18; claimRelations = 8
    }
    $Bad = @($ExpectedAdditions.GetEnumerator() | Where-Object {
        [int]$Inventory.additionCounts.PSObject.Properties[$_.Key].Value -ne [int]$_.Value
    })
    if ($Bad.Count -eq 0) { Pass "Projected addition counts" ($ExpectedAdditions | ConvertTo-Json -Compress) }
    else { Fail "Projected addition counts" ($Bad.Name -join ", ") }
    if (
        [int]$Quality.findingCounts.blocker -eq 0 -and
        @($Quality.newOrphanRecordIds).Count -eq 0 -and
        @($Quality.newOrphanAccountIds).Count -eq 0
    ) {
        Pass "Quality blockers and new orphans" "0 blockers; 0 new record/account orphans."
    } else { Fail "Quality blockers and new orphans" }
    if (
        @($Quality.existingOrphansConnected).Count -eq 8 -and
        @($Quality.existingOrphanAccountsConnected).Count -eq 1
    ) {
        Pass "Responsible orphan reduction" "8 records; 1 account."
    } else { Fail "Responsible orphan reduction" }
    if ($QualityText -notmatch '(?i)truthScore|reliabilityScore|credibilityPercentage|compositeQualityScore') {
        Pass "No universal score"
    } else { Fail "No universal score" }
} catch { Fail "Corpus JSON contract" $_.Exception.Message }

try {
    $Changed = @(& git -C $RepositoryRoot diff --name-only "7890995eafdb031230439c6f97750274273711ab")
    $Forbidden = @($Changed | Where-Object {
        $_ -match '^(assets/|.*\.html$|backend/src/routes/|backend/db/migrations/)' -or
        $_ -eq "backend/src/services/import-store.ts" -or
        $_ -match '^backend/src/source-preparation/'
    })
    if ($Forbidden.Count -eq 0) {
        Pass "Protected change boundary" "No frontend, API route, migration, importer, or preparation-engine change."
    } else { Fail "Protected change boundary" ($Forbidden -join ", ") }
} catch { Fail "Protected change boundary" $_.Exception.Message }

if (-not $SkipExecutableChecks) {
    try {
        $TemporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("historyroot-chunk9-verify-" + [Guid]::NewGuid().ToString("N"))
        $First = Join-Path $TemporaryRoot "first"
        $Second = Join-Path $TemporaryRoot "second"
        New-Item -ItemType Directory -Path $First, $Second -Force | Out-Null
        Run "First clean generation" "npm.cmd" @("run", "historyroot:wampanoag-regional:generate", "--", "--output-directory", $First) $BackendRoot
        Run "Second clean generation" "npm.cmd" @("run", "historyroot:wampanoag-regional:generate", "--", "--output-directory", $Second) $BackendRoot
        $Equal = $true
        foreach ($Name in $Expected.Keys) {
            $FirstPath = Join-Path $First $Name
            $SecondPath = Join-Path $Second $Name
            $RepoPath = Join-Path $DataRoot $Name
            $Equal = $Equal -and
                ((Get-Item -LiteralPath $FirstPath).Length -eq (Get-Item -LiteralPath $SecondPath).Length) -and
                ((Get-Item -LiteralPath $FirstPath).Length -eq (Get-Item -LiteralPath $RepoPath).Length) -and
                ((Hash $FirstPath) -eq (Hash $SecondPath)) -and
                ((Hash $FirstPath) -eq (Hash $RepoPath))
        }
        if ($Equal) { Pass "Five-artifact determinism" "Lengths, hashes, and bytes match." }
        else { Fail "Five-artifact determinism" }
    } catch { Fail "Five-artifact determinism" $_.Exception.Message }
    Run "TypeScript typecheck" "npm.cmd" @("run", "typecheck") $BackendRoot
    Run "Chunk 9 focused suite" "npm.cmd" @("run", "test:historyroot:wampanoag-regional") $BackendRoot
    Run "Root repository verifier" "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $RepositoryRoot "VERIFY-ROOT-REPOSITORY.ps1")) $RepositoryRoot
    Run "git diff --check" "git" @("-C", $RepositoryRoot, "diff", "--check") $RepositoryRoot
} else {
    Pass "Executable checks intentionally delegated" "Installer performs generation, import, and then calls this verifier for static/package checks."
}

if ($PackagePath) {
    try {
        $PackageRoot = [IO.Path]::GetFullPath($PackagePath).TrimEnd("\", "/")
        $Manifest = Get-Content -Raw -LiteralPath (Join-Path $PackageRoot "PACKAGE-MANIFEST.json") | ConvertFrom-Json
        $Files = @($Manifest.files)
        $Unsafe = @($Files | Where-Object { -not (Safe-Relative ([string]$_.path)) })
        $Missing = @()
        $BadHash = @()
        foreach ($File in $Files) {
            $Full = Join-Path $PackageRoot ([string]$File.path -replace "/", "\")
            if (-not (Test-Path -LiteralPath $Full -PathType Leaf)) { $Missing += $File.path }
            elseif ((Hash $Full) -ne ([string]$File.sha256).ToUpperInvariant()) { $BadHash += $File.path }
        }
        $Declared = @("PACKAGE-MANIFEST.json") + @($Files | ForEach-Object { [string]$_.path })
        $Actual = @(Get-ChildItem -LiteralPath $PackageRoot -Recurse -File | ForEach-Object {
            $_.FullName.Substring($PackageRoot.Length + 1).Replace("\", "/")
        })
        $Extras = @($Actual | Where-Object { $Declared -notcontains $_ })
        if (
            $Manifest.packageId -eq "SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1" -and
            $Unsafe.Count -eq 0 -and $Missing.Count -eq 0 -and
            $BadHash.Count -eq 0 -and $Extras.Count -eq 0
        ) {
            Pass "Package manifest and payloads" "$($Files.Count) payloads."
        } else {
            Fail "Package manifest and payloads" "unsafe=$($Unsafe.Count) missing=$($Missing.Count) badHash=$($BadHash.Count) extras=$($Extras.Count)"
        }
    } catch { Fail "Package manifest and payloads" $_.Exception.Message }
}

if ($FinalAcceptance) {
    try {
        $RecordPath = Join-Path $RepositoryRoot "docs\stages\completed\20260728-SOURCEROOT-HISTORYROOT-WAMPANOAG-REGIONAL-CORPUS-V1.md"
        $Record = Get-Content -Raw -LiteralPath $RecordPath
        $Markers = @(
            "Full backend regression: PASS",
            "Browser smoke: PASS",
            "Immutable release replay: PASS",
            "Installer: PASS",
            "Final package verification: PASS"
        )
        $MissingMarkers = @($Markers | Where-Object { $Record -notmatch [regex]::Escape($_) })
        if ($MissingMarkers.Count -eq 0) { Pass "Final acceptance record" }
        else { Fail "Final acceptance record" ($MissingMarkers -join "; ") }
    } catch { Fail "Final acceptance record" $_.Exception.Message }
}

Write-Host ""
Write-Host "Chunk 9 verifier summary" -ForegroundColor Cyan
Write-Host "Pass count:    $script:PassCount"
Write-Host "Warning count: $script:WarningCount"
Write-Host "Failure count: $script:FailureCount"
$Result = if ($script:FailureCount -eq 0 -and $script:WarningCount -eq 0) { "PASS" } else { "FAIL" }
Write-Host "Overall result: $Result"
if ($script:FailureCount -gt 0 -or $script:WarningCount -gt 0) { exit 1 }
exit 0
