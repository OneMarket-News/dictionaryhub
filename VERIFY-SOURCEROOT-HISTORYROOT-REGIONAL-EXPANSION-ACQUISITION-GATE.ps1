<#
.SYNOPSIS
Bounded fail-closed verifier for the SourceRoot Chunk 9 acquisition gate.
#>
[CmdletBinding()]
param()

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
function Require-File([string]$Name, [string]$Path) {
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        Pass $Name $Path
    } else {
        Fail $Name "Missing: $Path"
    }
}

$RepositoryRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
$DataRoot = Join-Path $RepositoryRoot "backend\data\historyroot-regional-expansion-acquisition-v1"
$RegistryPath = Join-Path $DataRoot "candidate-sources.json"
$ReportPath = Join-Path $DataRoot "feasibility-report.json"
$ExpectedHead = "fefbe6fdded9c53fe27996cbaeb7980bca248f4c"
$ExpectedZipHash = "B159BAD009FF65C500BE6B57889619E576A1C2729E4469C101E494A4D318784F"
$ExpectedRegistryHash = "7651FB9363AEF1A0431DA76347F881F0B5EC0E5CC8A99F45B2376BCAAC755947"
$ExpectedReportHash = "9143C907A27E299B69391937CCEACC17AFD751EE01AA3B9F65CA98E800659D2B"
$ExpectedFiles = @(
    "ROOT-MANIFEST.json",
    "VERIFY-SOURCEROOT-HISTORYROOT-REGIONAL-EXPANSION-ACQUISITION-GATE.ps1",
    "backend/data/historyroot-regional-expansion-acquisition-v1/candidate-sources.json",
    "backend/data/historyroot-regional-expansion-acquisition-v1/feasibility-report.json",
    "backend/src/historyroot/regional-expansion-acquisition.ts",
    "backend/src/scripts/generate-historyroot-regional-expansion-acquisition.ts",
    "backend/test/historyroot-regional-expansion-acquisition.test.ts",
    "docs/build/HISTORYROOT-REGIONAL-EXPANSION-SCOPE.md",
    "docs/build/HISTORYROOT-REGIONAL-SOURCE-ACQUISITION-PLAN.md",
    "docs/build/historyroot-regional-expansion-acquisition-stage.md"
)

Write-Host "SourceRoot HistoryRoot regional expansion acquisition gate verifier" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"
Write-Host ""

try {
    $Head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
    $Branch = (& git -C $RepositoryRoot branch --show-current).Trim()
    $UpstreamName = (& git -C $RepositoryRoot rev-parse --abbrev-ref --symbolic-full-name '@{u}').Trim()
    $Upstream = (& git -C $RepositoryRoot rev-parse '@{u}').Trim()
    if (
        $Head -eq $ExpectedHead -and
        $Branch -eq "release/historyroot-alpha-integration-v1" -and
        $UpstreamName -eq "origin/release/historyroot-alpha-integration-v1" -and
        $Upstream -eq $ExpectedHead
    ) {
        Pass "Sealed starting checkpoint" "$Branch at $Head"
    } else {
        Fail "Sealed starting checkpoint" "HEAD=$Head branch=$Branch upstream=$UpstreamName@$Upstream"
    }
} catch {
    Fail "Sealed starting checkpoint" $_.Exception.Message
}

try {
    $Tag = (& git -C $RepositoryRoot rev-list -n 1 "sourceroot-historyroot-corpus-expansion-quality-v1").Trim()
    if ($Tag -eq $ExpectedHead) {
        Pass "Chunk 8 tag" $Tag
    } else {
        Fail "Chunk 8 tag" "Expected $ExpectedHead; received $Tag"
    }
} catch {
    Fail "Chunk 8 tag" $_.Exception.Message
}

$ExternalZip = "C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1.zip"
if ((Test-Path -LiteralPath $ExternalZip -PathType Leaf) -and (Hash $ExternalZip) -eq $ExpectedZipHash) {
    Pass "Chunk 8 external ZIP" $ExpectedZipHash
} else {
    Fail "Chunk 8 external ZIP" "Missing or hash mismatch: $ExternalZip"
}

$RepositoryPackageFolder = Join-Path $RepositoryRoot "SourceRoot-HistoryRoot-Corpus-Expansion-Quality-v1"
$RepositoryPackageZip = "$RepositoryPackageFolder.zip"
if (
    -not (Test-Path -LiteralPath $RepositoryPackageFolder) -and
    -not (Test-Path -LiteralPath $RepositoryPackageZip)
) {
    Pass "No repository Chunk 8 package artifacts"
} else {
    Fail "No repository Chunk 8 package artifacts" "Package folder or ZIP exists."
}

foreach ($RelativePath in $ExpectedFiles) {
    Require-File "Allowed artifact exists" (Join-Path $RepositoryRoot $RelativePath)
}

try {
    $Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
    $Allowed = @($Manifest.active_stage.allowed_files | Sort-Object)
    $ExpectedAllowed = @($ExpectedFiles | Sort-Object)
    if (
        $Manifest.active_stage.status -eq "active" -and
        $Manifest.active_stage.slug -eq "SOURCEROOT-HISTORYROOT-REGIONAL-EXPANSION-ACQUISITION-GATE" -and
        @(Compare-Object $ExpectedAllowed $Allowed).Count -eq 0
    ) {
        Pass "Active root-stage scope" "$($Allowed.Count) exact allowed files"
    } else {
        Fail "Active root-stage scope" "Stage is inactive, has the wrong slug, or allowed files differ."
    }
} catch {
    Fail "Active root-stage scope" $_.Exception.Message
}

try {
    $Changed = @(
        & git -C $RepositoryRoot status --porcelain=v1 --untracked-files=all |
            ForEach-Object { $_.Substring(3).Replace("\", "/") } |
            Where-Object { $_ }
    )
    $Unexpected = @(Compare-Object ($ExpectedFiles | Sort-Object) ($Changed | Sort-Object))
    if ($Unexpected.Count -eq 0) {
        Pass "Changed-file scope" "$($Changed.Count) exact allowed files"
    } else {
        Fail "Changed-file scope" ($Unexpected | Out-String)
    }
} catch {
    Fail "Changed-file scope" $_.Exception.Message
}

if ((Hash $RegistryPath) -eq $ExpectedRegistryHash) {
    Pass "Candidate registry identity" $ExpectedRegistryHash
} else {
    Fail "Candidate registry identity" "Hash mismatch."
}
if ((Hash $ReportPath) -eq $ExpectedReportHash) {
    Pass "Feasibility report identity" $ExpectedReportHash
} else {
    Fail "Feasibility report identity" "Hash mismatch."
}

try {
    $Registry = Get-Content -Raw -LiteralPath $RegistryPath | ConvertFrom-Json
    $Report = Get-Content -Raw -LiteralPath $ReportPath | ConvertFrom-Json
    $Accepted = @($Registry.candidates | Where-Object { $_.acquisitionStatus -eq "accepted" })
    $Rejected = @($Registry.candidates | Where-Object { $_.acquisitionStatus -eq "rejected" })
    if ($Registry.planningOnly -and $Report.planningOnly -and $Accepted.Count -eq 20 -and $Rejected.Count -eq 3) {
        Pass "Planning registry boundary" "20 accepted; 3 rejected; no corpus artifact"
    } else {
        Fail "Planning registry boundary" "Planning flags or candidate counts differ."
    }
    if (
        $Report.sourceSummary.categoryDistribution.indigenousLed -ge 5 -and
        $Report.sourceSummary.categoryDistribution.primaryOrArchival -ge 5 -and
        $Report.sourceSummary.categoryDistribution.institutional -ge 5 -and
        $Report.sourceSummary.categoryDistribution.archaeologicalOrScholarly -ge 5
    ) {
        Pass "Source-diversity gates" (
            "Indigenous={0}; primary/archival={1}; institutional={2}; archaeological/scholarly={3}" -f
            $Report.sourceSummary.categoryDistribution.indigenousLed,
            $Report.sourceSummary.categoryDistribution.primaryOrArchival,
            $Report.sourceSummary.categoryDistribution.institutional,
            $Report.sourceSummary.categoryDistribution.archaeologicalOrScholarly
        )
    } else {
        Fail "Source-diversity gates" "One or more category minimums failed."
    }
    $Unlocatable = @($Accepted | Where-Object {
        -not $_.locatorStrategy.bounded -or [string]::IsNullOrWhiteSpace($_.locatorStrategy.value)
    })
    $Unclassified = @($Accepted | Where-Object {
        [string]::IsNullOrWhiteSpace($_.rightsAccess.classification)
    })
    if ($Unlocatable.Count -eq 0 -and $Unclassified.Count -eq 0) {
        Pass "Accepted source metadata gates" "All accepted sources have rights and bounded locator strategies."
    } else {
        Fail "Accepted source metadata gates" "Unlocatable=$($Unlocatable.Count); unclassified=$($Unclassified.Count)"
    }
    if ($Report.recommendation -eq "GO" -and @($Report.blockers).Count -eq 0) {
        Pass "Feasibility recommendation" "GO with 0 blockers"
    } else {
        Fail "Feasibility recommendation" "Recommendation=$($Report.recommendation); blockers=$(@($Report.blockers).Count)"
    }
} catch {
    Fail "Acquisition artifact structure" $_.Exception.Message
}

$BundleFiles = @(Get-ChildItem -LiteralPath $DataRoot -File -Filter "*.bundle.json")
if ($BundleFiles.Count -eq 0) {
    Pass "No generated HistoryRoot corpus bundle"
} else {
    Fail "No generated HistoryRoot corpus bundle" "$($BundleFiles.Count) bundle file(s) found."
}

$MigrationNames = @(
    Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "backend\db\migrations") -File |
        Select-Object -ExpandProperty Name
)
$Numbers = @($MigrationNames | ForEach-Object {
    if ($_ -match '^(\d{3})') { $Matches[1] }
} | Sort-Object -Unique)
$ExpectedNumbers = @(1..12 | ForEach-Object { "{0:D3}" -f $_ })
if (@(Compare-Object $ExpectedNumbers $Numbers).Count -eq 0 -and -not ($Numbers -contains "013")) {
    Pass "Migration boundary" "001-012 present; 013 absent"
} else {
    Fail "Migration boundary" "Numeric migration set differs."
}

try {
    $EnvText = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "backend\.env.test")
    if ($EnvText -match '(?m)^DATABASE_URL\s*=.*sourceroot_test') {
        Pass "Test database boundary" "sourceroot_test"
    } else {
        Fail "Test database boundary" "DATABASE_URL does not target sourceroot_test."
    }
} catch {
    Fail "Test database boundary" $_.Exception.Message
}

try {
    $Bundle = Get-Content -Raw -LiteralPath (
        Join-Path $RepositoryRoot "backend\data\historyroot-corpus-expansion-quality-v1\historyroot-corpus-expansion-quality-v1.bundle.json"
    ) | ConvertFrom-Json
    if ($Bundle.version -eq "1.2.0") {
        Pass "Accepted HistoryRoot dataset" "1.2.0"
    } else {
        Fail "Accepted HistoryRoot dataset" "Version=$($Bundle.version)"
    }
} catch {
    Fail "Accepted HistoryRoot dataset" $_.Exception.Message
}

$Staged = @(& git -C $RepositoryRoot diff --cached --name-only)
if ($Staged.Count -eq 0) {
    Pass "Git index remains empty"
} else {
    Fail "Git index remains empty" ($Staged -join ", ")
}

$PriorErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$DiffCheckOutput = @(& git -C $RepositoryRoot diff --check 2>$null)
$DiffCheckExit = $LASTEXITCODE
$ErrorActionPreference = $PriorErrorAction
if ($DiffCheckExit -eq 0 -and $DiffCheckOutput.Count -eq 0) {
    Pass "git diff --check" "Exit 0 with zero output"
} else {
    Fail "git diff --check" ($DiffCheckOutput -join [Environment]::NewLine)
}

Write-Host ""
Write-Host "Summary: $($script:PassCount) passes, $($script:WarningCount) warnings, $($script:FailureCount) failures"
if ($script:FailureCount -gt 0) { exit 1 }
exit 0
