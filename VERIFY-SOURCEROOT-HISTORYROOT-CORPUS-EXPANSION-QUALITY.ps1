<#
.SYNOPSIS
Fail-closed verifier for SourceRoot Chunk 8.

.PARAMETER FinalAcceptance
Requires the completed stage record, stable package folder and ZIP, installer
evidence, full regression evidence, immutable replay, and browser smoke.

.PARAMETER PackagePath
Optional package folder. Defaults to the repository-root Chunk 8 package.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$FinalAcceptance,

    [Parameter()]
    [string]$PackagePath = ""
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
function Info([string]$Name, [string]$Detail = "") {
    Write-Host "[INFO] $Name" -ForegroundColor Cyan
    if ($Detail) { Write-Host "       $Detail" }
}
function Hash([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function Require-Hash([string]$Name, [string]$Path, [string]$Expected) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Fail $Name "Missing: $Path"
        return
    }
    $Actual = Hash $Path
    if ($Actual -eq $Expected) {
        Pass $Name $Actual
    } else {
        Fail $Name "Expected $Expected; received $Actual"
    }
}
function Run-Command(
    [string]$Name,
    [string]$File,
    [string[]]$Arguments,
    [string]$WorkingDirectory
) {
    Push-Location $WorkingDirectory
    try {
        & $File @Arguments
        $ExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($ExitCode -eq 0) {
        Pass $Name "Exit 0."
    } else {
        Fail $Name "Exit $ExitCode."
    }
}
function Safe-Relative([string]$Path) {
    if (
        [string]::IsNullOrWhiteSpace($Path) -or
        [IO.Path]::IsPathRooted($Path) -or
        $Path.Replace("\", "/") -match '(^|/)\.{1,2}(/|$)'
    ) {
        return $false
    }
    return $true
}

$RepositoryRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
$BackendRoot = Join-Path $RepositoryRoot "backend"
$DataRoot = Join-Path $BackendRoot "data\historyroot-corpus-expansion-quality-v1"
$ReleaseRoot = "C:\Users\Josh\Documents\SourceRoot-Releases"
$Expected = [ordered]@{
    "expansion-workspace.json" = "5670D0D88A1BCBE7C1B2A20FC3FAE4D68F8A77C25A1E54ADAA8AC22BE7A72837"
    "historyroot-corpus-expansion-quality-v1.bundle.json" = "532AA4030A210F5C4EBEF8A5F2794496C10D2F0A5F72447D2BA778D5D1A55A09"
    "corpus-inventory.json" = "CAA21EB4A5282F9D57ABD08F2CCF01C25475C1E2512E5B30373EADBE57518645"
    "quality-review.json" = "B2F61EB003E35D4D60DB9CA42246BBE170B939C1BFC6A4CD0E0976EA40824237"
    "quality-review.md" = "D0F09E107D45D94EC9D59B88FB8CF0042E9B2F720755FC20C51C715B46A66313"
}

Write-Host "SourceRoot HistoryRoot corpus expansion and quality verifier v1" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"
Write-Host ""

try {
    $Branch = (& git -C $RepositoryRoot branch --show-current).Trim()
    $Head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
    $UpstreamName = (& git -C $RepositoryRoot rev-parse --abbrev-ref --symbolic-full-name '@{u}').Trim()
    $Upstream = (& git -C $RepositoryRoot rev-parse '@{u}').Trim()
    if (
        $Branch -eq "release/historyroot-alpha-integration-v1" -and
        $Head -eq "95b90865abf21cefefc5c608d778327737e997ac" -and
        $UpstreamName -eq "origin/release/historyroot-alpha-integration-v1" -and
        $Upstream -eq $Head
    ) {
        Pass "Starting checkpoint compatibility" "$Branch at $Head"
    } else {
        Fail "Starting checkpoint compatibility" "Branch=$Branch HEAD=$Head upstream=$UpstreamName@$Upstream"
    }
} catch {
    Fail "Starting checkpoint compatibility" $_.Exception.Message
}

try {
    $V11 = (& git -C $RepositoryRoot rev-parse 'sourceroot-repeatable-source-preparation-workflow-v1.1^{}').Trim()
    $V1 = (& git -C $RepositoryRoot rev-parse 'sourceroot-repeatable-source-preparation-workflow-v1^{}').Trim()
    if ($V11 -eq "95b90865abf21cefefc5c608d778327737e997ac") {
        Pass "v1.1 maintenance tag identity" $V11
    } else { Fail "v1.1 maintenance tag identity" $V11 }
    if ($V1 -eq "7eef6b27f5c97a3e0de82a457ca06c828f9fe3df") {
        Pass "Original Chunk 7 tag identity" $V1
    } else { Fail "Original Chunk 7 tag identity" $V1 }
} catch {
    Fail "Preparation tag identity" $_.Exception.Message
}

Require-Hash "v1.1 maintenance ZIP identity" `
    (Join-Path $ReleaseRoot "SourceRoot-Repeatable-Source-Preparation-Workflow-v1.1.zip") `
    "4EC0688F43D8EC94579167AB60F84FF499790B41C26FCF4C92E93F328C2778B1"
Require-Hash "Original Chunk 7 ZIP identity" `
    (Join-Path $ReleaseRoot "SourceRoot-Repeatable-Source-Preparation-Workflow-v1.zip") `
    "018E8463542EE33A20CB24545B4D64E1BC0F8E9C1701E55EFE01D20AA15C39DC"
Require-Hash "Chunk 6 accepted bundle immutability" `
    (Join-Path $BackendRoot "data\historyroot-foundational-corpus-v1\historyroot-foundational-corpus-v1.bundle.json") `
    "D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F"
Require-Hash "Chunk 7 golden workspace immutability" `
    (Join-Path $BackendRoot "data\source-preparation-workflow-v1\golden-workspace.json") `
    "116D4D490D86FDCDA352575ED3DDE439A052BF0EE566118343AF74DD9F5142BD"
Require-Hash "v1.1 workspace immutability" `
    (Join-Path $BackendRoot "data\source-preparation-workflow-v1\lossless-context-workspace.json") `
    "806BFD14348D570FDF8B7EB84820D1E722155FDDD8A9B2913B808B6AD60B21E3"

$Migrations = @(Get-ChildItem -LiteralPath (Join-Path $BackendRoot "db\migrations") -File -Filter "*.sql")
$Has001To012 = (1..12 | ForEach-Object {
    $Prefix = "{0:D3}_" -f $_
    @($Migrations | Where-Object { $_.Name.StartsWith($Prefix) }).Count -gt 0
}) -notcontains $false
$Has013 = @($Migrations | Where-Object { $_.Name.StartsWith("013_") }).Count -gt 0
if ($Has001To012 -and -not $Has013) {
    Pass "Migration ceiling" "001 through 012 present; 013 absent."
} else {
    Fail "Migration ceiling" "001-012 complete=$Has001To012; 013 present=$Has013"
}

foreach ($Entry in $Expected.GetEnumerator()) {
    Require-Hash "Installed artifact: $($Entry.Key)" `
        (Join-Path $DataRoot $Entry.Key) $Entry.Value
}

try {
    $Workspace = Get-Content -LiteralPath (Join-Path $DataRoot "expansion-workspace.json") -Raw | ConvertFrom-Json
    $Inventory = Get-Content -LiteralPath (Join-Path $DataRoot "corpus-inventory.json") -Raw | ConvertFrom-Json
    $QualityText = Get-Content -LiteralPath (Join-Path $DataRoot "quality-review.json") -Raw
    $Quality = $QualityText | ConvertFrom-Json
    if (
        [string]$Workspace.schemaVersion -eq "1.1.0" -and
        [string]$Workspace.preparationStatus -eq "approved" -and
        [bool]$Workspace.approvals.approved
    ) {
        Pass "Workspace schema and approval" "Schema 1.1.0; approved."
    } else {
        Fail "Workspace schema and approval"
    }
    $DeltasPass = (
        [int]$Inventory.deltaFromSelectedChunk6.records -ge 5 -and
        [int]$Inventory.deltaFromSelectedChunk6.claims -ge 10 -and
        [int]$Inventory.deltaFromSelectedChunk6.sources -ge 3 -and
        [int]$Inventory.deltaFromSelectedChunk6.locators -ge 5 -and
        [int]$Inventory.deltaFromSelectedChunk6.fieldProvenance -ge 5
    )
    if ($DeltasPass) {
        Pass "Mandatory expansion deltas" "Records +$($Inventory.deltaFromSelectedChunk6.records), claims +$($Inventory.deltaFromSelectedChunk6.claims), sources +$($Inventory.deltaFromSelectedChunk6.sources), locators +$($Inventory.deltaFromSelectedChunk6.locators), provenance +$($Inventory.deltaFromSelectedChunk6.fieldProvenance)."
    } else {
        Fail "Mandatory expansion deltas"
    }
    if (
        [int]$Quality.findingCounts.blocker -eq 0 -and
        [int]$Quality.contextualCollectionCoverage.claimAttributions -ge 25 -and
        [int]$Quality.contextualCollectionCoverage.interpretations -ge 12 -and
        [int]$Quality.contextualCollectionCoverage.perspectives -ge 10 -and
        [int]$Quality.contextualCollectionCoverage.perspectiveLinks -ge 18 -and
        [int]$Quality.contextualCollectionCoverage.causalLinks -ge 18 -and
        [int]$Quality.contextualCollectionCoverage.culturalMemories -ge 6
    ) {
        Pass "Quality blockers and contextual collections" "0 blockers; six families preserved."
    } else {
        Fail "Quality blockers and contextual collections"
    }
    if ($QualityText -notmatch '(?i)truthScore|reliabilityScore|credibilityPercentage|confidencePercentage|compositeQualityScore') {
        Pass "No composite score"
    } else {
        Fail "No composite score" "A prohibited score field was found."
    }
} catch {
    Fail "Expansion JSON validation" $_.Exception.Message
}

try {
    $TemporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("historyroot-chunk8-verify-" + [Guid]::NewGuid().ToString("N"))
    $First = Join-Path $TemporaryRoot "first"
    $Second = Join-Path $TemporaryRoot "second"
    New-Item -ItemType Directory -Path $First, $Second -Force | Out-Null
    Push-Location $BackendRoot
    try {
        & npm.cmd run historyroot:expansion:generate -- --output-directory $First
        $FirstExit = $LASTEXITCODE
        & npm.cmd run historyroot:expansion:generate -- --output-directory $Second
        $SecondExit = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    $Equal = $FirstExit -eq 0 -and $SecondExit -eq 0
    foreach ($Name in @(
        "historyroot-corpus-expansion-quality-v1.bundle.json",
        "corpus-inventory.json",
        "quality-review.json",
        "quality-review.md"
    )) {
        $Equal = $Equal -and
            (Hash (Join-Path $First $Name)) -eq (Hash (Join-Path $Second $Name)) -and
            (Hash (Join-Path $First $Name)) -eq (Hash (Join-Path $DataRoot $Name))
    }
    if ($Equal) {
        Pass "Deterministic regeneration" "Two clean generations and installed bytes match."
    } else {
        Fail "Deterministic regeneration"
    }
} catch {
    Fail "Deterministic regeneration" $_.Exception.Message
}

Run-Command "TypeScript typecheck" "npm.cmd" @("run", "typecheck") $BackendRoot
Run-Command "Chunk 8 focused suite" "npm.cmd" @("run", "test:historyroot:expansion") $BackendRoot
Run-Command "Root repository verifier" "powershell.exe" @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", (Join-Path $RepositoryRoot "VERIFY-ROOT-REPOSITORY.ps1")
) $RepositoryRoot
Run-Command "git diff --check" "git" @("-C", $RepositoryRoot, "diff", "--check") $RepositoryRoot

try {
    $Changed = @(& git -C $RepositoryRoot diff --name-only "95b90865abf21cefefc5c608d778327737e997ac")
    $Forbidden = @($Changed | Where-Object {
        $_ -match '^(assets/|.*\.html$|backend/src/routes/|backend/db/migrations/)' -or
        $_ -eq "backend/src/services/import-store.ts" -or
        $_ -match '^backend/src/source-preparation/'
    })
    if ($Forbidden.Count -eq 0) {
        Pass "Protected implementation boundaries" "No frontend, API route, migration, importer, or v1.1 workflow changes."
    } else {
        Fail "Protected implementation boundaries" ($Forbidden -join ", ")
    }
} catch {
    Fail "Protected implementation boundaries" $_.Exception.Message
}

$DefaultPackage = Join-Path $RepositoryRoot "SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1"
$UsePackage = if ($PackagePath) { [IO.Path]::GetFullPath($PackagePath) } else { $DefaultPackage }
if ($FinalAcceptance -or (Test-Path -LiteralPath $UsePackage -PathType Container)) {
    try {
        $ManifestPath = Join-Path $UsePackage "PACKAGE-MANIFEST.json"
        $PackageManifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        $PackageFiles = @($PackageManifest.files)
        $BadPaths = @($PackageFiles | Where-Object { -not (Safe-Relative ([string]$_.path)) })
        $Missing = @()
        $BadHashes = @()
        foreach ($File in $PackageFiles) {
            $Full = Join-Path $UsePackage ([string]$File.path -replace "/", "\")
            if (-not (Test-Path -LiteralPath $Full -PathType Leaf)) {
                $Missing += [string]$File.path
            } elseif ((Hash $Full) -ne ([string]$File.sha256).ToUpperInvariant()) {
                $BadHashes += [string]$File.path
            }
        }
        $Declared = @("PACKAGE-MANIFEST.json") + @($PackageFiles | ForEach-Object { [string]$_.path })
        $Actual = @(Get-ChildItem -LiteralPath $UsePackage -Recurse -File | ForEach-Object {
            $_.FullName.Substring($UsePackage.Length + 1).Replace("\", "/")
        })
        $Extras = @($Actual | Where-Object { $Declared -notcontains $_ })
        if ($BadPaths.Count -eq 0 -and $Missing.Count -eq 0 -and $BadHashes.Count -eq 0 -and $Extras.Count -eq 0) {
            Pass "Package manifest and payload hashes" "$($PackageFiles.Count) payloads."
        } else {
            Fail "Package manifest and payload hashes" "Unsafe=$($BadPaths.Count) missing=$($Missing.Count) badHash=$($BadHashes.Count) extras=$($Extras.Count)"
        }

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $ZipPath = "$UsePackage.zip"
        $Zip = [IO.Compression.ZipFile]::OpenRead($ZipPath)
        try {
            $EntryNames = @($Zip.Entries | ForEach-Object { $_.FullName })
            $Duplicates = @($EntryNames | Group-Object | Where-Object { $_.Count -gt 1 })
            $UnsafeEntries = @($EntryNames | Where-Object {
                $_ -match '\\' -or $_ -match '(^|/)\.\.(/|$)' -or
                [IO.Path]::IsPathRooted($_) -or
                -not $_.StartsWith("SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1/")
            })
            if ($Duplicates.Count -eq 0 -and $UnsafeEntries.Count -eq 0) {
                Pass "ZIP structure" "$($EntryNames.Count) forward-slash entries; one top-level folder."
            } else {
                Fail "ZIP structure" "Duplicates=$($Duplicates.Count) unsafe=$($UnsafeEntries.Count)"
            }
        } finally {
            $Zip.Dispose()
        }
    } catch {
        Fail "Package verification" $_.Exception.Message
    }
} elseif ($FinalAcceptance) {
    Fail "Final package exists" $UsePackage
} else {
    Info "Package verification" "Deferred until the inactive-stage package phase."
}

if ($FinalAcceptance) {
    try {
        $StageRecord = Get-Content -LiteralPath (Join-Path $RepositoryRoot "docs\build\historyroot-corpus-expansion-quality-stage.md") -Raw
        $RequiredEvidence = @(
            "Full backend result: 404/404",
            "SourceRoot baseline: 0 failures, 0 warnings",
            "DictionaryRoot baseline: 0 failures, 0 warnings",
            "Browser data smoke: PASS",
            "Immutable release replay: PASS",
            "Installer: PASS",
            "Final verifier: 0 warnings, 0 failures"
        )
        $MissingEvidence = @($RequiredEvidence | Where-Object { $StageRecord -notmatch [regex]::Escape($_) })
        if ($MissingEvidence.Count -eq 0 -and $StageRecord -notmatch "pending final acceptance") {
            Pass "Final acceptance evidence" "Regression, baselines, replay, installer, browser, and final counts recorded."
        } else {
            Fail "Final acceptance evidence" ($MissingEvidence -join "; ")
        }
    } catch {
        Fail "Final acceptance evidence" $_.Exception.Message
    }
}

Write-Host ""
Write-Host "Chunk 8 verifier summary" -ForegroundColor Cyan
Write-Host "Pass count:    $script:PassCount"
Write-Host "Warning count: $script:WarningCount"
Write-Host "Failure count: $script:FailureCount"
$Result = if ($script:FailureCount -eq 0 -and $script:WarningCount -eq 0) { "PASS" } else { "FAIL" }
Write-Host "Overall result: $Result"
if ($script:FailureCount -gt 0 -or $script:WarningCount -gt 0) { exit 1 }
exit 0
