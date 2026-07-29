[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:PassCount = 0
$script:WarningCount = 0
$script:FailureCount = 0
$script:RepositoryRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
$script:BackendRoot = Join-Path $script:RepositoryRoot "backend"

function Add-Pass {
    param([string]$Message, [string]$Detail = "")
    $script:PassCount++
    Write-Host "[PASS] $Message" -ForegroundColor Green
    if ($Detail) { Write-Host "       $Detail" -ForegroundColor DarkGray }
}

function Add-Failure {
    param([string]$Message, [string]$Detail = "")
    $script:FailureCount++
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    if ($Detail) { Write-Host "       $Detail" -ForegroundColor DarkGray }
}

function Assert-Equal {
    param([string]$Message, $Actual, $Expected)
    if ($Actual -eq $Expected) {
        Add-Pass -Message $Message -Detail ([string]$Actual)
    } else {
        Add-Failure -Message $Message -Detail "Expected '$Expected'; found '$Actual'."
    }
}

function Assert-True {
    param([string]$Message, [bool]$Condition, [string]$Detail = "")
    if ($Condition) {
        Add-Pass -Message $Message -Detail $Detail
    } else {
        Add-Failure -Message $Message -Detail $Detail
    }
}

function Get-ChangedFiles {
    $Tracked = @(& git -c core.autocrlf=false -C $script:RepositoryRoot diff --name-only 2>$null)
    $Staged = @(& git -c core.autocrlf=false -C $script:RepositoryRoot diff --cached --name-only 2>$null)
    $Untracked = @(& git -C $script:RepositoryRoot ls-files --others --exclude-standard 2>$null)
    return @($Tracked + $Staged + $Untracked |
        ForEach-Object { ([string]$_).Trim().Replace("\", "/") } |
        Where-Object { $_ } |
        Sort-Object -Unique)
}

Write-Host "SourceRoot DictionaryRoot corpus-scaling acquisition gate verifier v1"
Write-Host "Repository: $script:RepositoryRoot"
Write-Host ""

try {
    Assert-Equal "Canonical repository path" $script:RepositoryRoot "C:\Users\Josh\Documents\GitHub\dictionaryhub"
    Assert-Equal "Required starting commit" (& git -C $script:RepositoryRoot rev-parse HEAD) "01eab17573f5eb9a6e957093496c500cf67a07db"
    Assert-Equal "Required branch" (& git -C $script:RepositoryRoot branch --show-current) "release/historyroot-alpha-integration-v1"
    Assert-Equal "Remote-tracking branch identity" (& git -C $script:RepositoryRoot rev-parse origin/release/historyroot-alpha-integration-v1) "01eab17573f5eb9a6e957093496c500cf67a07db"
    Assert-Equal "Local tag target" (& git -C $script:RepositoryRoot rev-list -n 1 sourceroot-historyroot-wampanoag-regional-corpus-v1) "01eab17573f5eb9a6e957093496c500cf67a07db"

    $ZipPath = "C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1.zip"
    Assert-True "Chunk 9 external ZIP exists" (Test-Path -LiteralPath $ZipPath -PathType Leaf) $ZipPath
    if (Test-Path -LiteralPath $ZipPath -PathType Leaf) {
        Assert-Equal "Chunk 9 external ZIP SHA-256" (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash "D4E11DD28EECC46BEFA76E3E4805BB8CDB6F8C8EE57FA07C72BEB898DF409D29"
    }

    $ManifestPath = Join-Path $script:RepositoryRoot "ROOT-MANIFEST.json"
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    Assert-Equal "Root stage is the bounded Chunk 10 gate" ([string]$Manifest.active_stage.slug) "SOURCEROOT-DICTIONARYROOT-CORPUS-SCALING-ACQUISITION-GATE"
    Assert-Equal "Active stage file count" @($Manifest.active_stage.allowed_files).Count 12
    Assert-Equal "Preflight changed-file count" @($Manifest.active_stage.preflight_changed_files).Count 0

    $RequiredFiles = @(
        "docs/build/DICTIONARYROOT-CORPUS-SCALING-SCOPE.md",
        "docs/build/DICTIONARYROOT-SOURCE-ACQUISITION-PLAN.md",
        "docs/build/DICTIONARYROOT-LEXICAL-MODEL-GAP-ANALYSIS.md",
        "backend/data/dictionaryroot-corpus-scaling-acquisition-v1/candidate-sources.json",
        "backend/data/dictionaryroot-corpus-scaling-acquisition-v1/feasibility-report.json",
        "backend/src/dictionaryroot/corpus-scaling-acquisition.ts",
        "backend/src/scripts/generate-dictionaryroot-corpus-scaling-acquisition.ts",
        "backend/test/dictionaryroot-corpus-scaling-acquisition.test.ts",
        "docs/build/dictionaryroot-corpus-scaling-acquisition-stage.md",
        "VERIFY-SOURCEROOT-DICTIONARYROOT-CORPUS-SCALING-ACQUISITION-GATE.ps1"
    )
    foreach ($RelativePath in $RequiredFiles) {
        $FullPath = Join-Path $script:RepositoryRoot ($RelativePath -replace "/", "\")
        Assert-True "Required deliverable: $RelativePath" (Test-Path -LiteralPath $FullPath -PathType Leaf)
    }

    $CandidatePath = Join-Path $script:BackendRoot "data\dictionaryroot-corpus-scaling-acquisition-v1\candidate-sources.json"
    $ReportPath = Join-Path $script:BackendRoot "data\dictionaryroot-corpus-scaling-acquisition-v1\feasibility-report.json"
    $CandidateData = Get-Content -LiteralPath $CandidatePath -Raw | ConvertFrom-Json
    $Candidates = @()
    foreach ($Candidate in $CandidateData) {
        $Candidates += $Candidate
    }
    $Report = Get-Content -LiteralPath $ReportPath -Raw | ConvertFrom-Json
    $Accepted = @($Candidates | Where-Object { $_.acquisitionStatus -eq "accepted" })
    $Rejected = @($Candidates | Where-Object { $_.acquisitionStatus -eq "rejected" })

    Assert-Equal "Candidate source count" $Candidates.Count 22
    Assert-Equal "Accepted candidate count" $Accepted.Count 17
    Assert-Equal "Rejected candidate count" $Rejected.Count 5
    Assert-True "General lexical source threshold" (@($Accepted | Where-Object { $_.categories -contains "general_lexical" }).Count -ge 5)
    Assert-True "Historical/etymological source threshold" (@($Accepted | Where-Object { $_.categories -contains "historical_or_etymological" }).Count -ge 4)
    Assert-True "Institutional/technical source threshold" (@($Accepted | Where-Object { $_.categories -contains "institutional_or_technical" }).Count -ge 3)
    Assert-True "Corpus/morphology/network source threshold" (@($Accepted | Where-Object { $_.categories -contains "corpus_morphology_or_lexical_network" }).Count -ge 3)
    Assert-True "Multi-source comparison threshold" (@($Accepted | Where-Object { $_.categories -contains "multi_source_comparison" }).Count -ge 3)

    $DuplicateCandidateIds = @($Candidates | Group-Object candidateId | Where-Object { $_.Count -gt 1 })
    Assert-Equal "No duplicate candidate IDs" $DuplicateCandidateIds.Count 0
    Assert-True "Accepted sources have reusable rights classes" (@($Accepted | Where-Object { $_.rightsClass -notin @("public_domain", "open_license") }).Count -eq 0)
    Assert-True "All candidates have rights evidence" (@($Candidates | Where-Object { -not $_.rightsEvidenceUrl -or -not $_.licenseOrPublicDomainBasis }).Count -eq 0)
    Assert-True "All candidates have bounded locators" (@($Candidates | Where-Object { -not $_.boundedLocatorStrategy }).Count -eq 0)
    Assert-True "All candidates have rationales" (@($Candidates | Where-Object { -not $_.acceptanceOrRejectionRationale }).Count -eq 0)

    Assert-Equal "Repository baseline bundle" ([string]$Report.baseline.repositoryArtifact.bundleId) "dictionaryroot-oewn-2025-pilot-500"
    Assert-Equal "Repository baseline version" ([string]$Report.baseline.repositoryArtifact.version) "0.1.0-oewn-2025"
    Assert-Equal "Repository baseline lemmas" ([int]$Report.baseline.repositoryArtifact.lemmas) 654
    Assert-Equal "Repository baseline senses" ([int]$Report.baseline.repositoryArtifact.senses) 500
    Assert-Equal "Repository baseline claims" ([int]$Report.baseline.repositoryArtifact.claims) 928
    Assert-Equal "Repository baseline relationships" ([int]$Report.baseline.repositoryArtifact.relationships) 436
    Assert-Equal "Database boundary" ([string]$Report.baseline.database.name) "sourceroot_test"
    Assert-Equal "Accepted HistoryRoot version" ([string]$Report.baseline.database.acceptedHistoryRootVersion) "1.3.0"
    Assert-Equal "Migration 013 absent in report" ([bool]$Report.baseline.database.migration013Present) $false
    Assert-True "Migration 012 present" (Test-Path -LiteralPath (Join-Path $script:BackendRoot "db\migrations\012_refine_contextual_assertions_evidence_versioning.sql"))
    Assert-True "Migration 013 absent" (-not (Test-Path -LiteralPath (Join-Path $script:BackendRoot "db\migrations\013_create_dictionaryroot_corpus.sql")))

    Assert-Equal "Recommendation" ([string]$Report.recommendation.decision) "CONDITIONAL_GO"
    Assert-Equal "Blocker finding count" @($Report.findings.blockers).Count 0
    Assert-True "Mandatory minimum is feasible" ([bool]$Report.mandatoryMinimum.feasible)
    Assert-True "Projected source count meets minimum" ([int]$Report.projectedProductionTarget.acceptedSources -ge [int]$Report.mandatoryMinimum.usableAcceptedSources)
    Assert-True "Lexical capability inventory is complete" (@($Report.lexicalModelCapabilities).Count -eq 33)
    Assert-True "Frontend gap inventory is complete" (@($Report.frontendGaps).Count -eq 10)
    Assert-True "Coverage metric inventory is complete" (@($Report.coverageMetrics).Count -ge 29)

    $ArtifactFiles = @(Get-ChildItem -LiteralPath (Split-Path -Parent $CandidatePath) -File | Select-Object -ExpandProperty Name | Sort-Object)
    Assert-True "No production corpus bundle in acquisition directory" (
        $ArtifactFiles.Count -eq 2 -and
        $ArtifactFiles[0] -eq "candidate-sources.json" -and
        $ArtifactFiles[1] -eq "feasibility-report.json"
    ) ($ArtifactFiles -join ", ")

    $AllowedFiles = @($Manifest.active_stage.allowed_files | ForEach-Object { [string]$_ } | Sort-Object)
    $ChangedFiles = @(Get-ChangedFiles)
    $Unauthorized = @($ChangedFiles | Where-Object { $AllowedFiles -notcontains $_ })
    Assert-Equal "Exact root-stage changed-file count" $ChangedFiles.Count 12
    Assert-Equal "Unauthorized changed files" $Unauthorized.Count 0
    $IndexOutput = ((@(& git -C $script:RepositoryRoot diff --cached --name-only) | ForEach-Object { [string]$_ }) -join "")
    Assert-Equal "Git index is empty" $IndexOutput ""
    Assert-True "No changed package or ZIP" (@($ChangedFiles | Where-Object { $_ -match '(^|/)(package|release)(/|$)|\.zip$' }).Count -eq 0)
    Assert-True "No frontend source changed" (@($ChangedFiles | Where-Object { $_ -like "assets/*" -or $_ -match '\.html$' }).Count -eq 0)
    Assert-True "No API route changed" (@($ChangedFiles | Where-Object { $_ -like "backend/src/routes/*" }).Count -eq 0)
    Assert-True "No importer implementation changed" ($ChangedFiles -notcontains "backend/src/scripts/import-dictionaryroot-lexicon.ts")
    Assert-True "No migration changed" (@($ChangedFiles | Where-Object { $_ -like "backend/db/migrations/*" }).Count -eq 0)

    Write-Host "[INFO] Running TypeScript typecheck" -ForegroundColor Cyan
    & npm.cmd --prefix $script:BackendRoot run typecheck
    if ($LASTEXITCODE -eq 0) { Add-Pass "TypeScript typecheck" } else { Add-Failure "TypeScript typecheck" "Exit $LASTEXITCODE" }

    Write-Host "[INFO] Running focused acquisition tests" -ForegroundColor Cyan
    Push-Location $script:BackendRoot
    try {
        & node --env-file=.env.test --import ./scripts/register-tsx.mjs --test --test-concurrency=1 test/dictionaryroot-corpus-scaling-acquisition.test.ts
        if ($LASTEXITCODE -eq 0) { Add-Pass "Focused acquisition suite" "25 tests" } else { Add-Failure "Focused acquisition suite" "Exit $LASTEXITCODE" }
    } finally {
        Pop-Location
    }

    $CandidateBytes = [IO.File]::ReadAllBytes($CandidatePath)
    $ReportBytes = [IO.File]::ReadAllBytes($ReportPath)
    Assert-True "Candidate artifact has normalized final LF" ($CandidateBytes[$CandidateBytes.Length - 1] -eq 10 -and $CandidateBytes[$CandidateBytes.Length - 2] -ne 10)
    Assert-True "Feasibility artifact has normalized final LF" ($ReportBytes[$ReportBytes.Length - 1] -eq 10 -and $ReportBytes[$ReportBytes.Length - 2] -ne 10)
    Add-Pass "Candidate artifact identity" "$($CandidateBytes.Length) bytes; $((Get-FileHash -LiteralPath $CandidatePath -Algorithm SHA256).Hash)"
    Add-Pass "Feasibility artifact identity" "$($ReportBytes.Length) bytes; $((Get-FileHash -LiteralPath $ReportPath -Algorithm SHA256).Hash)"
} catch {
    Add-Failure "Verifier execution" $_.Exception.Message
}

Write-Host ""
Write-Host "DictionaryRoot corpus-scaling acquisition gate summary"
Write-Host "Pass count:    $script:PassCount"
Write-Host "Warning count: $script:WarningCount"
Write-Host "Failure count: $script:FailureCount"

if ($script:FailureCount -eq 0 -and $script:WarningCount -eq 0) {
    Write-Host "Overall result: PASS" -ForegroundColor Green
    exit 0
}

Write-Host "Overall result: FAIL" -ForegroundColor Red
exit 1
