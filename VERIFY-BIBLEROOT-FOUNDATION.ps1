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
$ExpectedHead = "957d58ddaf53522bec19bb1cbe436d6f6b670dbd"
$ExpectedBranch = "release/historyroot-alpha-integration-v1"
$CurrentReleaseTag = "sourceroot-shared-user-menu-navigation-polish-v1"
$RecommendedReleaseTag = "sourceroot-bibleroot-foundation-v1"

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
    $CurrentTagObjectType = (& git cat-file -t $CurrentReleaseTag 2>$null).Trim()
    $CurrentTagCommit = (& git rev-parse "$CurrentReleaseTag^{}" 2>$null).Trim()
    & git rev-parse --verify --quiet "refs/tags/$RecommendedReleaseTag" *> $null
    $RecommendedTagExists = $LASTEXITCODE -eq 0
    $IndexChanges = @(& git diff --cached --name-only)

    Test-Condition ($Head -eq $ExpectedHead) "Starting HEAD is unchanged" $Head "Expected $ExpectedHead; found $Head."
    Test-Condition ($Branch -eq $ExpectedBranch) "Current branch is unchanged" $Branch "Expected $ExpectedBranch; found $Branch."
    Test-Condition ($RemoteBranch -eq $ExpectedHead) "Remote-tracking branch identity" $RemoteBranch "Expected $ExpectedHead; found $RemoteBranch."
    Test-Condition (
        ($CurrentTagObjectType -eq "tag") -and ($CurrentTagCommit -eq $ExpectedHead)
    ) "Current annotated release tag" "$CurrentReleaseTag -> $CurrentTagCommit" "The required annotated tag is missing or points elsewhere."
    Test-Condition (-not $RecommendedTagExists) "Recommended release tag remains absent" $RecommendedReleaseTag "The prohibited recommended tag exists."
    Test-Condition ($IndexChanges.Count -eq 0) "Git index remains empty" "No staged changes." "Staged paths: $($IndexChanges -join ', ')"

    $ManifestPath = Join-Path $script:RepositoryRoot "ROOT-MANIFEST.json"
    $StagePath = Join-Path $script:RepositoryRoot "docs\stages\active\CURRENT-STAGE.md"
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $StageText = Get-Content -LiteralPath $StagePath -Raw
    $AllowedFiles = @($Manifest.active_stage.allowed_files)
    $RequiredVerifiers = @($Manifest.active_stage.required_verifiers)

    Test-Condition (
        ($Manifest.active_stage.slug -eq "BIBLEROOT-FOUNDATION-V1") -and
        ($Manifest.active_stage.status -eq "active") -and
        ($AllowedFiles.Count -eq 44)
    ) "Bounded active Root stage" "BibleRoot Foundation v1; 44 explicit paths." "Active-stage identity, status, or allowed-file count differs."
    Test-Condition (
        ($RequiredVerifiers -contains "VERIFY-BIBLEROOT-FOUNDATION.ps1") -and
        ($RequiredVerifiers -contains "VERIFY-ROOT-REPOSITORY.ps1")
    ) "Required verifiers declared" ($RequiredVerifiers -join ", ") "Required verifier declaration is incomplete."
    Test-Condition (
        ($StageText -match "Project Gutenberg") -and
        ($StageText -match "110") -and
        ($StageText -match "sourceroot_test")
    ) "Active stage is concrete" "Source, count, and database boundary are documented." "The stage specification is incomplete."

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
    Test-Condition (
        $OutsideScope.Count -eq 0
    ) "Working-tree changes stay inside stage scope" "$($ChangedPaths.Count) changed paths are authorized." "Outside scope: $($OutsideScope -join ', ')"

    $MigrationFiles = @(
        Get-ChildItem -LiteralPath (Join-Path $script:RepositoryRoot "backend\db\migrations") -Filter "*.sql" |
            Sort-Object Name
    )
    & git diff --quiet $ExpectedHead -- "backend/db/migrations/001*.sql" "backend/db/migrations/002*.sql" "backend/db/migrations/003*.sql" "backend/db/migrations/004*.sql" "backend/db/migrations/005*.sql" "backend/db/migrations/006*.sql" "backend/db/migrations/007*.sql" "backend/db/migrations/008*.sql" "backend/db/migrations/009*.sql" "backend/db/migrations/010*.sql" "backend/db/migrations/011*.sql" "backend/db/migrations/012*.sql" "backend/db/migrations/013*.sql" "backend/db/migrations/014*.sql"
    $PriorMigrationsUnchanged = $LASTEXITCODE -eq 0
    Test-Condition (
        ($MigrationFiles.Count -eq 16) -and
        ($MigrationFiles[-1].Name -eq "015_create_bibleroot_foundation.sql") -and
        $PriorMigrationsUnchanged
    ) "Migration boundary" "Migrations 001-014 unchanged; migration 015 is the only addition." "Migration numbering/count or an existing migration changed."

    $DatasetRoot = Join-Path $script:RepositoryRoot "backend\data\bibleroot-foundation-v1"
    $DatasetManifest = Get-Content -LiteralPath (Join-Path $DatasetRoot "dataset-manifest.json") -Raw | ConvertFrom-Json
    $RawPath = Join-Path $DatasetRoot "raw\project-gutenberg-ebook-10-10-0.txt"
    $RawFile = Get-Item -LiteralPath $RawPath
    $RawHash = Get-Sha256 $RawPath
    Test-Condition (
        ($RawFile.Length -eq 4436268) -and
        ($RawHash -eq "0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986")
    ) "Official source artifact identity" "$($RawFile.Length) bytes; $RawHash" "Raw artifact bytes or SHA-256 differ."

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
    Test-Condition (
        $HashFailures.Count -eq 0
    ) "Dataset file hashes" "$($ExpectedFileHashes.Count) exact hashes match." "Mismatch: $($HashFailures -join ', ')"

    $Canon = Get-Content -LiteralPath (Join-Path $DatasetRoot "canon.json") -Raw | ConvertFrom-Json
    $Verses = Get-Content -LiteralPath (Join-Path $DatasetRoot "verses.json") -Raw | ConvertFrom-Json
    $Phrases = Get-Content -LiteralPath (Join-Path $DatasetRoot "phrases.json") -Raw | ConvertFrom-Json
    $OccurrenceCount = @($Phrases | ForEach-Object { @($_.occurrences) }).Count
    Test-Condition (
        (@($Canon.books).Count -eq 66) -and
        ($Verses.Count -eq 110) -and
        ($Phrases.Count -eq 9) -and
        ($OccurrenceCount -eq 13) -and
        ($DatasetManifest.normalizedTextSha256 -eq "BD71CDBB98C44A9DBEC0A2B6D59E83CB93290FB04CFA1BAC5022E4F8B88818FF")
    ) "Dataset counts and normalized identity" "66 books; 110 verses; 9 phrases; 13 exact occurrences." "A required dataset count or normalized SHA-256 differs."

    $RequiredFiles = @(
        "backend\db\migrations\015_create_bibleroot_foundation.sql",
        "backend\src\bibleroot\foundation.ts",
        "backend\src\routes\bibleroot.ts",
        "backend\src\services\bibleroot-store.ts",
        "backend\src\scripts\prepare-bibleroot-foundation.ts",
        "backend\src\scripts\import-bibleroot-foundation.ts",
        "backend\test\bibleroot-foundation.test.ts",
        "bibleroot.html",
        "bibleroot-passage.html",
        "docs\api\BIBLEROOT-FOUNDATION-API.md",
        "docs\architecture\BIBLEROOT-CITATION-IDENTITY-CONTRACT.md",
        "docs\architecture\BIBLEROOT-FOUNDATION-ARCHITECTURE.md",
        "docs\build\BIBLEROOT-FOUNDATION-BROWSER-EVIDENCE.md",
        "docs\build\BIBLEROOT-FOUNDATION-STATE.md",
        "docs\sources\BIBLEROOT-KJV-SOURCE.md",
        "verification\bibleroot-foundation-home-desktop.png",
        "verification\bibleroot-foundation-genesis-1-desktop.png",
        "verification\bibleroot-foundation-john-1-desktop.png",
        "verification\bibleroot-foundation-switch-roots-desktop.png",
        "verification\bibleroot-foundation-provenance-desktop.png",
        "verification\bibleroot-foundation-passage-mobile.png"
    )
    $MissingFiles = @($RequiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot $_) -PathType Leaf) })
    Test-Condition ($MissingFiles.Count -eq 0) "Required implementation and evidence files" "$($RequiredFiles.Count) files found." "Missing: $($MissingFiles -join ', ')"

    $EvidenceText = Get-Content -LiteralPath (Join-Path $script:RepositoryRoot "docs\build\BIBLEROOT-FOUNDATION-BROWSER-EVIDENCE.md") -Raw
    Test-Condition (
        ([regex]::Matches($EvidenceText, "Console errors: 0\.").Count -eq 2) -and
        ([regex]::Matches($EvidenceText, "Attributable console warnings: 0\.").Count -eq 2) -and
        ([regex]::Matches($EvidenceText, "Horizontal overflow: 0\.").Count -eq 2)
    ) "Browser evidence result" "Desktop and mobile each record zero errors, warnings, and overflow." "Browser evidence is incomplete or non-zero."

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
    Test-Condition $DictionaryZipValid "Accepted DictionaryRoot release ZIP" "Length and SHA-256 match." "Accepted DictionaryRoot ZIP is missing or changed."
    Test-Condition $HistoryZipValid "Accepted HistoryRoot release ZIP" "SHA-256 matches." "Accepted HistoryRoot ZIP is missing or changed."
    $RepositoryZipNames = @($RepositoryZips | Select-Object -ExpandProperty Name)
    Test-Condition ($RepositoryZips.Count -eq 0) "No repository ZIP package" "No root-level ZIP exists." "Unexpected ZIP: $($RepositoryZipNames -join ', ')"

    $BackendRoot = Join-Path $script:RepositoryRoot "backend"
    Invoke-ProcessCheck "TypeScript typecheck" "npm.cmd" @("run", "typecheck") $BackendRoot
    Invoke-ProcessCheck "BibleRoot backend tests" "npm.cmd" @("run", "test:bibleroot:foundation") $BackendRoot
    Invoke-ProcessCheck "BibleRoot frontend contract" "npm.cmd" @("run", "test:bibleroot:frontend") $BackendRoot
    Invoke-ProcessCheck "Shared user-menu preservation" "node.exe" @("--test", "verification/sourceroot-shared-user-menu.test.cjs") $script:RepositoryRoot
    Invoke-ProcessCheck "Shared Root-switcher preservation" "node.exe" @("--test", "verification/sourceroot-shared-root-switcher.test.cjs") $script:RepositoryRoot
    Invoke-ProcessCheck "Unified-search preservation" "node.exe" @("--test", "verification/sourceroot-unified-search-navigation.test.cjs") $script:RepositoryRoot
    Invoke-ProcessCheck "DictionaryRoot observability preservation" "node.exe" @("--test", "verification/frontend-api-observability.test.cjs") $script:RepositoryRoot
    Invoke-ProcessCheck "HistoryRoot review preservation" "node.exe" @("--test", "verification/context-review-experience.test.cjs") $script:RepositoryRoot

    try {
        $Health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -Method Get -TimeoutSec 10
        $Editions = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/bibleroot/editions" -Method Get -TimeoutSec 10
        $Books = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/bibleroot/books?edition=br-edition-kjv-pg10-2024" -Method Get -TimeoutSec 10
        $Passage = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/bibleroot/passages?edition=br-edition-kjv-pg10-2024&reference=Genesis%201" -Method Get -TimeoutSec 10
        $LiveApiValid = (
            ($Health.status -eq "ok") -and
            (@($Editions.items).Count -eq 1) -and
            (@($Books.items).Count -eq 66) -and
            (@($Passage.verses).Count -eq 31)
        )
        Test-Condition $LiveApiValid "Live BibleRoot read API" "Health, 1 edition, 66 books, and 31 Genesis 1 verses." "A live API response had unexpected content."
    } catch {
        Write-Result -Level "FAIL" -Name "Live BibleRoot read API" -Detail $_.Exception.Message
    }

    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/v1/bibleroot/editions" -Method Post -UseBasicParsing -TimeoutSec 10 *> $null
        Write-Result -Level "FAIL" -Name "BibleRoot write API remains unavailable" -Detail "POST unexpectedly succeeded."
    } catch {
        $StatusCode = 0
        if ($null -ne $_.Exception.Response) {
            $StatusCode = [int]$_.Exception.Response.StatusCode
        }
        Test-Condition (
            $StatusCode -eq 404
        ) "BibleRoot write API remains unavailable" "POST returned 404." "Expected 404; received $StatusCode."
    }
} catch {
    Write-Result -Level "FAIL" -Name "Unexpected verifier exception" -Detail $_.Exception.Message
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "BibleRoot Foundation verification summary" -ForegroundColor Cyan
Write-Host "  Passes:   $script:Passed"
Write-Host "  Warnings: $script:Warnings"
Write-Host "  Failures: $script:Failed"

if (($script:Warnings -gt 0) -or ($script:Failed -gt 0)) {
    exit 1
}

exit 0
