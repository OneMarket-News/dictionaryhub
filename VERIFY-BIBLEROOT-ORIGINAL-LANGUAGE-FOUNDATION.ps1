[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0
$ExpectedHead = "b149b6bb2d39ee78557f7716975a07d1a84fcc06"
$ExpectedBranch = "release/historyroot-alpha-integration-v1"
$BaselineTag = "sourceroot-bibleroot-foundation-v1"
$ProhibitedTag = "sourceroot-bibleroot-original-language-foundation-v1"

function Write-Result {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("PASS", "FAIL", "WARN")]
        [string]$Level,
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string]$Detail = ""
    )

    $Color = "Gray"
    switch ($Level) {
        "PASS" { $script:Passed++; $Color = "Green" }
        "FAIL" { $script:Failed++; $Color = "Red" }
        "WARN" { $script:Warnings++; $Color = "Yellow" }
    }
    Write-Host "[$Level] $Name" -ForegroundColor $Color
    if (-not [string]::IsNullOrWhiteSpace($Detail)) {
        Write-Host "       $Detail"
    }
}

function Test-Condition {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$SuccessDetail = "",
        [string]$FailureDetail = ""
    )
    if ($Condition) {
        Write-Result -Level "PASS" -Name $Name -Detail $SuccessDetail
    } else {
        Write-Result -Level "FAIL" -Name $Name -Detail $FailureDetail
    }
}

function Resolve-RepositoryRoot {
    $Candidates = @($RepositoryPath, (Get-Location).Path, $PSScriptRoot)
    foreach ($Candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }
        if (-not (Test-Path -LiteralPath $Candidate -PathType Container)) { continue }
        $Resolved = [System.IO.Path]::GetFullPath(
            (Resolve-Path -LiteralPath $Candidate).Path
        ).TrimEnd("\", "/")
        if (
            (Test-Path -LiteralPath (Join-Path $Resolved "ROOT-MANIFEST.json") -PathType Leaf) -and
            (Test-Path -LiteralPath (Join-Path $Resolved "backend\src\app.ts") -PathType Leaf)
        ) {
            return $Resolved
        }
    }
    throw "Could not locate the dictionaryhub repository."
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    $Stream = [System.IO.File]::OpenRead($Path)
    try {
        $Sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($Sha.ComputeHash($Stream))).Replace("-", "")
        } finally {
            $Sha.Dispose()
        }
    } finally {
        $Stream.Dispose()
    }
}

function Invoke-ProcessCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )
    Write-Host ""
    Write-Host "---- $Name output ----" -ForegroundColor DarkCyan
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        $ExitCode = $LASTEXITCODE
    } catch {
        $ExitCode = 1
        Write-Host $_.Exception.Message
    } finally {
        Pop-Location
    }
    Write-Host "---- end $Name output ----" -ForegroundColor DarkCyan
    Test-Condition `
        -Condition ($ExitCode -eq 0) `
        -Name $Name `
        -SuccessDetail "Exit code 0." `
        -FailureDetail "Exit code $ExitCode."
}

try {
    $script:RepositoryRoot = Resolve-RepositoryRoot
    Write-Result -Level "PASS" -Name "Repository location" -Detail $script:RepositoryRoot
} catch {
    Write-Result -Level "FAIL" -Name "Repository location" -Detail $_.Exception.Message
    exit 2
}

Push-Location $script:RepositoryRoot
try {
    $Head = (& git rev-parse HEAD).Trim()
    $Branch = (& git branch --show-current).Trim()
    $RemoteBranch = (& git rev-parse "refs/remotes/origin/$ExpectedBranch").Trim()
    $BaselineTagType = (& git cat-file -t $BaselineTag 2>$null).Trim()
    $BaselineTagCommit = (& git rev-parse "$BaselineTag^{}" 2>$null).Trim()
    & git rev-parse --verify --quiet "refs/tags/$ProhibitedTag" *> $null
    $ProhibitedTagExists = $LASTEXITCODE -eq 0
    $IndexChanges = @(& git diff --cached --name-only)

    Test-Condition ($Head -eq $ExpectedHead) "Starting HEAD is unchanged" $Head "Expected $ExpectedHead; found $Head."
    Test-Condition ($Branch -eq $ExpectedBranch) "Current branch is unchanged" $Branch "Expected $ExpectedBranch; found $Branch."
    Test-Condition ($RemoteBranch -eq $ExpectedHead) "Remote-tracking branch identity" $RemoteBranch "Expected $ExpectedHead; found $RemoteBranch."
    Test-Condition (
        ($BaselineTagType -eq "tag") -and ($BaselineTagCommit -eq $ExpectedHead)
    ) "Baseline annotated tag" "$BaselineTag -> $BaselineTagCommit" "The baseline tag is missing, lightweight, or points elsewhere."
    Test-Condition (-not $ProhibitedTagExists) "No new release tag" $ProhibitedTag "A release tag was created during this stage."
    Test-Condition ($IndexChanges.Count -eq 0) "Git index remains empty" "No staged changes." "Staged paths: $($IndexChanges -join ', ')"
    Test-Condition (-not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot ".git\index.lock"))) "No Git index lock" "No lock file exists." "The Git index lock exists."

    $ManifestPath = Join-Path $script:RepositoryRoot "ROOT-MANIFEST.json"
    $StagePath = Join-Path $script:RepositoryRoot "docs\stages\active\CURRENT-STAGE.md"
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $StageText = Get-Content -LiteralPath $StagePath -Raw
    $AllowedFiles = @($Manifest.active_stage.allowed_files)
    $RequiredVerifiers = @($Manifest.active_stage.required_verifiers)
    Test-Condition (
        ($Manifest.active_stage.slug -eq "BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION-V1") -and
        ($Manifest.active_stage.status -eq "active") -and
        ($AllowedFiles.Count -eq 50)
    ) "Bounded active Root stage" "13A active with 50 explicit paths." "Active-stage identity, status, or allowed-file count differs."
    Test-Condition (
        ($RequiredVerifiers -contains "VERIFY-BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION.ps1") -and
        ($RequiredVerifiers -contains "VERIFY-ROOT-REPOSITORY.ps1")
    ) "Required verifiers declared" ($RequiredVerifiers -join ", ") "The required verifier declaration is incomplete."
    Test-Condition (
        ($StageText -match "v\.2\.2") -and
        ($StageText -match "rel-1-3") -and
        ($StageText -match "sourceroot_test") -and
        ($StageText -match "Psalm 23")
    ) "Active stage is concrete" "Pinned refs, DB boundary, and Psalm mapping are documented." "The active stage specification is incomplete."

    $ChangedPaths = @(
        & git status --porcelain=v1 -uall |
            ForEach-Object {
                if ($_.Length -ge 4) {
                    $Path = $_.Substring(3).Trim('"').Replace("\", "/")
                    if ($Path -match " -> ") { $Path = ($Path -split " -> ")[-1].Trim('"') }
                    $Path
                }
            }
    )
    $OutsideScope = @($ChangedPaths | Where-Object { $AllowedFiles -notcontains $_ })
    Test-Condition ($OutsideScope.Count -eq 0) "Working-tree changes stay inside stage scope" "$($ChangedPaths.Count) changed paths are authorized." "Outside scope: $($OutsideScope -join ', ')"

    $MigrationRoot = Join-Path $script:RepositoryRoot "backend\db\migrations"
    $Migration016 = Join-Path $MigrationRoot "016_create_bibleroot_original_language_foundation.sql"
    $Migration017 = @(Get-ChildItem -LiteralPath $MigrationRoot -Filter "017*.sql" -File)
    & git diff --quiet $ExpectedHead -- "backend/db/migrations/001*.sql" "backend/db/migrations/002*.sql" "backend/db/migrations/003*.sql" "backend/db/migrations/004*.sql" "backend/db/migrations/005*.sql" "backend/db/migrations/006*.sql" "backend/db/migrations/007*.sql" "backend/db/migrations/008*.sql" "backend/db/migrations/009*.sql" "backend/db/migrations/010*.sql" "backend/db/migrations/011*.sql" "backend/db/migrations/012*.sql" "backend/db/migrations/013*.sql" "backend/db/migrations/014*.sql" "backend/db/migrations/015*.sql"
    $PriorMigrationsUnchanged = $LASTEXITCODE -eq 0
    Test-Condition (
        (Test-Path -LiteralPath $Migration016 -PathType Leaf) -and
        ($Migration017.Count -eq 0) -and
        $PriorMigrationsUnchanged
    ) "Migration boundary" "Migrations 001-015 unchanged; migration 016 present; migration 017 absent." "Migration 016/017 or prior migration identity is invalid."

    $DatasetRoot = Join-Path $script:RepositoryRoot "backend\data\bibleroot-original-language-foundation-v1"
    $DatasetManifest = Get-Content -LiteralPath (Join-Path $DatasetRoot "dataset-manifest.json") -Raw | ConvertFrom-Json
    $ExpectedRaw = @(
        @{ Path = "raw\Gen.xml"; Length = 1881356; Sha = "87B6221B89CCD308A96B287EFB4520397912A16FE0F8CE4F788A3B4C09D8F2A4" },
        @{ Path = "raw\Ps.xml"; Length = 1949574; Sha = "6B4BC0EAFFF4787FC5DD10F5F3D4F753B132C71DC3D681818D8E73D95E74A6DB" },
        @{ Path = "raw\Eccl.xml"; Length = 288538; Sha = "28599B243D236813C5F4407CE477E9DF1019CBBEA88BA39AD4A95F1AEC8CECCF" },
        @{ Path = "raw\Nestle1904.csv"; Length = 9098651; Sha = "F239AA40669138EED4BDA0BD4BDC7B2071687CAC26752FA5A1FD468F7FD0ABF0" }
    )
    $RawFailures = New-Object System.Collections.Generic.List[string]
    foreach ($Expected in $ExpectedRaw) {
        $RawPath = Join-Path $DatasetRoot $Expected.Path
        if (
            (-not (Test-Path -LiteralPath $RawPath -PathType Leaf)) -or
            ((Get-Item -LiteralPath $RawPath).Length -ne $Expected.Length) -or
            ((Get-Sha256 $RawPath) -ne $Expected.Sha)
        ) {
            $RawFailures.Add($Expected.Path)
        }
    }
    Test-Condition ($RawFailures.Count -eq 0) "Pinned raw artifact identity" "Four exact lengths and SHA-256 values match." "Mismatch: $($RawFailures -join ', ')"

    $ExpectedFileHashes = @($DatasetManifest.files.PSObject.Properties)
    $HashFailures = New-Object System.Collections.Generic.List[string]
    foreach ($Property in $ExpectedFileHashes) {
        $FilePath = Join-Path $DatasetRoot $Property.Name
        if (
            (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) -or
            ((Get-Sha256 $FilePath) -ne ([string]$Property.Value))
        ) {
            $HashFailures.Add($Property.Name)
        }
    }
    Test-Condition ($HashFailures.Count -eq 0) "Prepared file hashes" "$($ExpectedFileHashes.Count) exact hashes match." "Mismatch: $($HashFailures -join ', ')"

    $Counts = $DatasetManifest.expectedCounts
    Test-Condition (
        ($DatasetManifest.normalizedDatasetSha256 -eq "474D7338BD57A8AD8C725B32E9BAA6B540ED4F327A3AAB6D0B009D773303F779") -and
        ($Counts.editions -eq 2) -and ($Counts.sourceArtifacts -eq 4) -and
        ($Counts.sourceVerses -eq 111) -and ($Counts.tokens -eq 1592) -and
        ($Counts.tokensByLanguage.he -eq 764) -and ($Counts.tokensByLanguage.grc -eq 828) -and
        ($Counts.lemmas -eq 1592) -and ($Counts.morphologies -eq 2420) -and
        ($Counts.missingAnalysis -eq 0) -and ($Counts.ambiguousAnalysis -eq 7) -and
        ($Counts.mappings -eq 111) -and ($Counts.mappingTypes.one_to_one -eq 110) -and
        ($Counts.mappingTypes.omitted_or_untranslated -eq 1)
    ) "Normalized dataset identity and counts" "SHA-256, 1592 tokens, 111 segments/mappings, 2420 morphology rows, and analysis states match." "A normalized identity or count differs."

    $SourceMetadata = Get-Content -LiteralPath (Join-Path $DatasetRoot "source-metadata.json") -Raw | ConvertFrom-Json
    $SourceMetadataText = Get-Content -LiteralPath (Join-Path $DatasetRoot "source-metadata.json") -Raw
    Test-Condition (
        ($SourceMetadataText -match "6a5db284c715c18b239422e57bb89684e6a19f00") -and
        ($SourceMetadataText -match "f2e8fef56eeea892697b5d511a87b8545d6c3dda") -and
        ($SourceMetadataText -match "v\.2\.2") -and
        ($SourceMetadataText -match "rel-1-3")
    ) "Immutable source refs" "Both tag names and resolved commits are recorded." "Pinned source refs are incomplete."

    $RequiredFiles = @(
        "backend\src\bibleroot\original-languages.ts",
        "backend\src\scripts\prepare-bibleroot-original-language-foundation.ts",
        "backend\src\scripts\import-bibleroot-original-language-foundation.ts",
        "backend\test\bibleroot-original-language-foundation.test.ts",
        "verification\bibleroot-original-language-foundation.test.cjs",
        "docs\api\BIBLEROOT-ORIGINAL-LANGUAGE-API.md",
        "docs\architecture\BIBLEROOT-ORIGINAL-LANGUAGE-ARCHITECTURE.md",
        "docs\architecture\BIBLEROOT-ORIGINAL-LANGUAGE-TOKEN-AND-MAPPING-CONTRACT.md",
        "docs\build\BIBLEROOT-ORIGINAL-LANGUAGE-BROWSER-EVIDENCE.md",
        "docs\build\BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION-STATE.md",
        "docs\sources\BIBLEROOT-ORIGINAL-LANGUAGE-SOURCES-AND-RIGHTS.md",
        "verification\bibleroot-original-language-genesis-1-desktop.png",
        "verification\bibleroot-original-language-psalm-23-desktop.png",
        "verification\bibleroot-original-language-ecclesiastes-3-desktop.png",
        "verification\bibleroot-original-language-john-1-desktop.png",
        "verification\bibleroot-original-language-genesis-1-mobile.png",
        "verification\bibleroot-original-language-psalm-23-mobile.png",
        "verification\bibleroot-original-language-unavailable-mobile.png",
        "verification\bibleroot-original-language-provenance-desktop.png"
    )
    $MissingFiles = @($RequiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot $_) -PathType Leaf) })
    Test-Condition ($MissingFiles.Count -eq 0) "Required implementation and evidence files" "$($RequiredFiles.Count) files found." "Missing: $($MissingFiles -join ', ')"

    $EvidenceText = Get-Content -LiteralPath (Join-Path $script:RepositoryRoot "docs\build\BIBLEROOT-ORIGINAL-LANGUAGE-BROWSER-EVIDENCE.md") -Raw
    Test-Condition (
        ($EvidenceText -match "Genesis 1 \| Desktop \| RTL \| 31 \| 434") -and
        ($EvidenceText -match "Psalm 23 \| Desktop \| RTL \| 7 \| 57") -and
        ($EvidenceText -match "Ecclesiastes 3 \| Desktop \| RTL \| 22 \| 273") -and
        ($EvidenceText -match "John 1 \| Desktop \| LTR \| 51 \| 828") -and
        ($EvidenceText -match "Console errors: 0\.") -and
        ($EvidenceText -match "Console warnings: 0\.") -and
        ($EvidenceText -match "Unresolved browser checks: 0\.")
    ) "Fresh browser evidence" "Four passages, desktop/mobile states, zero console output, and zero unresolved checks recorded." "Browser evidence is incomplete or non-zero."

    & git diff --quiet $ExpectedHead -- "backend/test/bibleroot-foundation.test.ts" "verification/bibleroot-foundation.test.cjs"
    $HistoricalTestsUnchanged = $LASTEXITCODE -eq 0
    Test-Condition $HistoricalTestsUnchanged "Historical BibleRoot verifier inputs unchanged" "Chunk 12 test files remain byte-identical to HEAD." "A frozen Chunk 12 test file changed."

    $DictionaryZip = "C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-DictionaryRoot-Core-Lexical-Corpus-v1.zip"
    $HistoryZip = "C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1.zip"
    $DictionaryZipValid = (
        (Test-Path -LiteralPath $DictionaryZip -PathType Leaf) -and
        ((Get-Item -LiteralPath $DictionaryZip).Length -eq 264507) -and
        ((Get-Sha256 $DictionaryZip) -eq "E7640A0337F084D1EFFCFDC3B340A3AD7611FBA6E089ED2078B0AFE97EEAD8C0")
    )
    $HistoryZipValid = (
        (Test-Path -LiteralPath $HistoryZip -PathType Leaf) -and
        ((Get-Sha256 $HistoryZip) -eq "D4E11DD28EECC46BEFA76E3E4805BB8CDB6F8C8EE57FA07C72BEB898DF409D29")
    )
    $RepositoryZips = @(Get-ChildItem -LiteralPath $script:RepositoryRoot -Filter "*.zip" -File)
    Test-Condition $DictionaryZipValid "Accepted DictionaryRoot release ZIP" "Length and SHA-256 match." "The accepted DictionaryRoot ZIP is missing or changed."
    Test-Condition $HistoryZipValid "Accepted HistoryRoot release ZIP" "SHA-256 matches." "The accepted HistoryRoot ZIP is missing or changed."
    $RepositoryZipNames = @($RepositoryZips | Select-Object -ExpandProperty Name)
    Test-Condition ($RepositoryZips.Count -eq 0) "No repository ZIP package" "No root-level ZIP exists." "Unexpected ZIP: $($RepositoryZipNames -join ', ')"

    $BackendRoot = Join-Path $script:RepositoryRoot "backend"
    Invoke-ProcessCheck "TypeScript typecheck" "npm.cmd" @("run", "typecheck") $BackendRoot
    Invoke-ProcessCheck "Deterministic original-language preparation" "npm.cmd" @("run", "bibleroot:original-languages:prepare") $BackendRoot
    Invoke-ProcessCheck "Transactional original-language import" "npm.cmd" @("run", "bibleroot:original-languages:import") $BackendRoot
    Invoke-ProcessCheck "Original-language backend tests" "npm.cmd" @("run", "test:bibleroot:original-languages") $BackendRoot
    Invoke-ProcessCheck "Original-language frontend tests" "npm.cmd" @("run", "test:bibleroot:original-languages:frontend") $BackendRoot
    Invoke-ProcessCheck "Live Chunk 12 preservation tests" "node.exe" @("--env-file=.env.test", "--import", "./scripts/register-tsx.mjs", "--test", "--test-concurrency=1", "--test-name-pattern=^(?:[1-9]|1[013-9]|2[0-8])\.", "test/bibleroot-foundation.test.ts") $BackendRoot
    Invoke-ProcessCheck "Unified-search backend preservation" "npm.cmd" @("run", "test:unified-search") $BackendRoot
    Invoke-ProcessCheck "Shared user-menu preservation" "node.exe" @("--test", "verification/sourceroot-shared-user-menu.test.cjs") $script:RepositoryRoot
    Invoke-ProcessCheck "Shared Root-switcher preservation" "node.exe" @("--test", "verification/sourceroot-shared-root-switcher.test.cjs") $script:RepositoryRoot
    Invoke-ProcessCheck "Unified-search frontend preservation" "node.exe" @("--test", "verification/sourceroot-unified-search-navigation.test.cjs") $script:RepositoryRoot
    Invoke-ProcessCheck "DictionaryRoot observability preservation" "node.exe" @("--test", "verification/frontend-api-observability.test.cjs") $script:RepositoryRoot
    Invoke-ProcessCheck "HistoryRoot review preservation" "node.exe" @("--test", "verification/context-review-experience.test.cjs") $script:RepositoryRoot

    try {
        $Editions = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/bibleroot/original-language/editions" -Method Get -TimeoutSec 10
        $Expectations = @(
            @{ Reference = "Genesis 1"; Verses = 31; Tokens = 434; Direction = "rtl" },
            @{ Reference = "Psalm 23"; Verses = 7; Tokens = 57; Direction = "rtl" },
            @{ Reference = "Ecclesiastes 3"; Verses = 22; Tokens = 273; Direction = "rtl" },
            @{ Reference = "John 1"; Verses = 51; Tokens = 828; Direction = "ltr" }
        )
        $LiveFailures = New-Object System.Collections.Generic.List[string]
        foreach ($Expected in $Expectations) {
            $Encoded = [System.Uri]::EscapeDataString($Expected.Reference)
            $Passage = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/bibleroot/original-language/passages?reference=$Encoded" -Method Get -TimeoutSec 15
            $TokenCount = @($Passage.verses | ForEach-Object { @($_.tokens) }).Count
            if (
                (@($Passage.verses).Count -ne $Expected.Verses) -or
                ($TokenCount -ne $Expected.Tokens) -or
                ($Passage.direction -ne $Expected.Direction)
            ) {
                $LiveFailures.Add($Expected.Reference)
            }
        }
        Test-Condition (
            (@($Editions.items).Count -eq 2) -and ($LiveFailures.Count -eq 0)
        ) "Live original-language read API" "Two editions and all four chapter counts/directions match." "Unexpected live result: $($LiveFailures -join ', ')"
    } catch {
        Write-Result -Level "FAIL" -Name "Live original-language read API" -Detail $_.Exception.Message
    }

    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/v1/bibleroot/original-language/editions" -Method Post -UseBasicParsing -TimeoutSec 10 *> $null
        Write-Result -Level "FAIL" -Name "Original-language write API remains unavailable" -Detail "POST unexpectedly succeeded."
    } catch {
        $StatusCode = 0
        if ($null -ne $_.Exception.Response) { $StatusCode = [int]$_.Exception.Response.StatusCode }
        Test-Condition ($StatusCode -eq 404) "Original-language write API remains unavailable" "POST returned 404." "Expected 404; received $StatusCode."
    }
} catch {
    Write-Result -Level "FAIL" -Name "Unexpected verifier exception" -Detail $_.Exception.Message
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "BibleRoot Original Language Foundation verification summary" -ForegroundColor Cyan
Write-Host "  Passes:   $script:Passed"
Write-Host "  Warnings: $script:Warnings"
Write-Host "  Failures: $script:Failed"

if (($script:Warnings -gt 0) -or ($script:Failed -gt 0)) { exit 1 }
exit 0
