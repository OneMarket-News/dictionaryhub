[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$script:PassCount = 0
$script:FailCount = 0
$script:WarningCount = 0
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Result {
    param([string]$Status, [string]$Name, [string]$Detail)
    Write-Host "[$Status] $Name - $Detail"
    if ($Status -eq "PASS") { $script:PassCount += 1 }
    if ($Status -eq "FAIL") { $script:FailCount += 1 }
}

function Assert-True {
    param([string]$Name, [bool]$Condition, [string]$Detail)
    if ($Condition) { Write-Result "PASS" $Name $Detail }
    else { Write-Result "FAIL" $Name $Detail }
}

function Read-RootText {
    param([string]$RelativePath)
    return [IO.File]::ReadAllText((Join-Path $Root $RelativePath))
}

function Contains-All {
    param([string]$RelativePath, [string[]]$Markers)
    $Text = Read-RootText $RelativePath
    $Missing = @($Markers | Where-Object {
        $Text.IndexOf($_, [StringComparison]::Ordinal) -lt 0
    })
    $Detail = if ($Missing.Count -eq 0) {
        "$($Markers.Count) required markers present."
    } else {
        "Missing: $($Missing -join ', ')"
    }
    Assert-True $RelativePath ($Missing.Count -eq 0) $Detail
}

function Invoke-NpmCheck {
    param([string]$Name, [string[]]$Arguments)
    Push-Location (Join-Path $Root "backend")
    try {
        & npm.cmd @Arguments
        $ExitCode = $LASTEXITCODE
        Assert-True $Name ($ExitCode -eq 0) "npm.cmd $($Arguments -join ' ') exit $ExitCode."
    } catch {
        Write-Result "FAIL" $Name $_.Exception.Message
    } finally {
        Pop-Location
    }
}

Write-Host "SourceRoot DictionaryRoot Lexical Relationship Architecture verifier v1"

$Required = @(
    "backend/db/migrations/014_create_dictionaryroot_lexical_relationships.sql",
    "backend/src/dictionaryroot/lexical-evidence-graph.ts",
    "backend/test/dictionaryroot-lexical-relationship-architecture.test.ts",
    "verification/dictionaryroot-lexical-relationship-architecture.test.cjs",
    "docs/build/DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE-CONTRACT.md",
    "docs/build/dictionaryroot-lexical-relationship-architecture-stage.md",
    "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/fixture.json",
    "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/inventory.json",
    "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/quality-review.json"
)
$Missing = @($Required | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $Root $_) -PathType Leaf)
})
$RequiredDetail = if ($Missing.Count -eq 0) {
    "$($Required.Count) files present."
} else {
    "Missing: $($Missing -join ', ')"
}
Assert-True "Required artifacts" ($Missing.Count -eq 0) $RequiredDetail

$Fixture = $null
$Inventory = $null
$Quality = $null
try {
    $Fixture = Read-RootText "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/fixture.json" | ConvertFrom-Json
    $Inventory = Read-RootText "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/inventory.json" | ConvertFrom-Json
    $Quality = Read-RootText "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/quality-review.json" | ConvertFrom-Json
    Write-Result "PASS" "Fixture JSON" "Fixture, inventory, and quality review parse."
} catch {
    Write-Result "FAIL" "Fixture JSON" $_.Exception.Message
}

if ($null -ne $Fixture -and $null -ne $Inventory -and $null -ne $Quality) {
    Assert-True "Fixture identity" (
        $Fixture.dataset.datasetId -eq "dictionaryroot-lexical-evidence-architecture-fixture-v1" -and
        $Fixture.dataset.fixtureOnly -eq $true -and
        $Quality.productionCorpusGenerated -eq $false
    ) "Original fixture-only identity retained; production corpus is false."
    Assert-True "Relationship accounting" (
        $Inventory.counts.relationships -eq 12 -and
        $Inventory.counts.relationshipEvidence -eq 13 -and
        $Fixture.relationships.Count -eq 12 -and
        $Fixture.relationshipEvidence.Count -eq 13
    ) "12 canonical relationships and 13 evidence rows."
    Assert-True "Fixture quality" ($Quality.blockerCount -eq 0) "Zero blockers."
}

Contains-All "backend/db/migrations/014_create_dictionaryroot_lexical_relationships.sql" @(
    "dictionaryroot_lexical_relationship_types",
    "dictionaryroot_lexical_relationships",
    "dictionaryroot_lexical_relationship_evidence",
    "source_sense_id < target_sense_id",
    "source_sense_id <> target_sense_id",
    "ON DELETE CASCADE"
)
$Migration015 = @(Get-ChildItem -LiteralPath (Join-Path $Root "backend/db/migrations") `
    -Filter "015*" -File)
Assert-True "Migration 015 absent" ($Migration015.Count -eq 0) "No migration 015 file exists."

Contains-All "backend/src/dictionaryroot/lexical-evidence-types.ts" @(
    "LexicalRelationshipType",
    "LexicalRelationshipDirectionality",
    "LexicalRelationshipEvidence"
)
Contains-All "backend/src/routes/lexicon.ts" @(
    "/evidence/graph/seeds",
    "/evidence/graph/neighborhood/:seedId",
    "/evidence/relationships/:relationshipId",
    "/evidence/relationships/:relationshipId/evidence"
)
Contains-All "backend/src/dictionaryroot/lexical-evidence-graph.ts" @(
    "HAS_SENSE",
    "HAS_FORM",
    "HAS_DEFINITION_CLAIM",
    "HAS_STRUCTURED_LOCATOR",
    "HAS_FIELD_PROVENANCE",
    "HAS_LEXICAL_RELATIONSHIP",
    "SUPPORTED_BY_EVIDENCE"
)
Contains-All "assets/js/dictionaryroot-graph.js" @(
    "lexicalEvidenceGraphSeeds",
    "lexicalEvidenceGraphNeighborhood",
    "lexicalEvidenceRelationshipEvidence",
    "relationship-evidence"
)
Contains-All "docs/build/DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE-CONTRACT.md" @(
    "Symmetric endpoints",
    "Nothing derived is",
    "No route writes",
    "Island proposals remain separate"
)

Invoke-NpmCheck "Typecheck" @("run", "typecheck")
Invoke-NpmCheck "Focused backend" @("run", "test:dictionaryroot:lexical-relationships")
Invoke-NpmCheck "Targeted frontend" @("run", "test:dictionaryroot:lexical-relationships:frontend")
Invoke-NpmCheck "Chunk 10A backend" @("run", "test:dictionaryroot:lexical-evidence")

Write-Host ""
Write-Host "Lexical relationship architecture verifier summary"
Write-Host "Pass count:    $script:PassCount"
Write-Host "Warning count: $script:WarningCount"
Write-Host "Failure count: $script:FailCount"
if ($script:FailCount -gt 0) { exit 1 }
exit 0
