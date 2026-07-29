[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$script:PassCount = 0
$script:FailCount = 0
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
    $Missing = @($Markers | Where-Object { $Text.IndexOf($_, [StringComparison]::Ordinal) -lt 0 })
    if ($Missing.Count -eq 0) {
        $Detail = "$($Markers.Count) required markers present."
    } else {
        $Detail = "Missing: $($Missing -join ', ')"
    }
    Assert-True $RelativePath ($Missing.Count -eq 0) $Detail
}

Write-Host "SourceRoot Chunk 10A verifier"

$Required = @(
    "backend/db/migrations/013_create_dictionaryroot_lexical_evidence.sql",
    "backend/src/dictionaryroot/lexical-evidence-types.ts",
    "backend/src/dictionaryroot/lexical-evidence-fixture.ts",
    "backend/src/services/lexical-evidence-store.ts",
    "backend/src/routes/lexicon.ts",
    "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/fixture.json",
    "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/inventory.json",
    "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/quality-review.json",
    "docs/build/DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE-CONTRACT.md",
    "docs/build/dictionaryroot-lexical-evidence-architecture-stage.md",
    "verification/dictionaryroot-lexical-evidence-architecture.test.cjs"
)
$MissingRequired = @($Required | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $Root $_) -PathType Leaf)
})
if ($MissingRequired.Count -eq 0) {
    $RequiredDetail = "$($Required.Count) files present."
} else {
    $RequiredDetail = "Missing: $($MissingRequired -join ', ')"
}
Assert-True "Required artifacts" ($MissingRequired.Count -eq 0) $RequiredDetail

try {
    $Fixture = Read-RootText "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/fixture.json" | ConvertFrom-Json
    $Inventory = Read-RootText "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/inventory.json" | ConvertFrom-Json
    $Quality = Read-RootText "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/quality-review.json" | ConvertFrom-Json
    Assert-True "Fixture JSON" $true "Fixture, inventory, and quality review parse."
} catch {
    Write-Result "FAIL" "Fixture JSON" $_.Exception.Message
}

if ($null -ne $Fixture -and $null -ne $Inventory -and $null -ne $Quality) {
    Assert-True "Fixture-only identity" (
        $Fixture.dataset.datasetId -eq "dictionaryroot-lexical-evidence-architecture-fixture-v1" -and
        $Fixture.dataset.fixtureOnly -eq $true -and
        $Quality.productionCorpusGenerated -eq $false
    ) "Synthetic architecture fixture; production corpus is false."

    $CountsMatch =
        $Inventory.counts.sources -eq 5 -and
        $Inventory.counts.lemmas -eq 10 -and
        $Inventory.counts.senses -eq 16 -and
        $Inventory.counts.definitionClaims -eq 22 -and
        $Inventory.counts.forms -eq 10 -and
        $Inventory.counts.etymologyProposals -eq 4 -and
        $Inventory.counts.sourceComparisons -eq 4 -and
        $Inventory.counts.locators -eq 40 -and
        $Inventory.counts.fieldProvenance -eq 72
    Assert-True "Fixture accounting" $CountsMatch "5/10/16/22/10/4/4/40/72."
    Assert-True "Fixture quality" ($Quality.blockerCount -eq 0) "Zero blockers."
}

Contains-All "backend/db/migrations/013_create_dictionaryroot_lexical_evidence.sql" @(
    "dictionaryroot_lexical_lemmas",
    "dictionaryroot_lexical_senses",
    "dictionaryroot_lexical_definition_claims",
    "dictionaryroot_lexical_forms",
    "dictionaryroot_lexical_etymology_proposals",
    "dictionaryroot_lexical_source_comparisons",
    "dictionaryroot_lexical_source_locators",
    "dictionaryroot_lexical_field_provenance"
)
Contains-All "backend/src/routes/lexicon.ts" @(
    "/evidence/search",
    "/evidence/lemmas/:lemmaId",
    "/evidence/senses/:senseId",
    "/evidence/objects/:subjectId/:resource"
)
Contains-All "assets/js/dictionaryroot-api.js" @(
    "lexicalEvidenceSearchAll",
    "lexicalEvidenceLemma",
    "lexicalEvidenceSense"
)
Contains-All "assets/js/dictionaryroot-concept.js" @(
    "Source-specific definition claims",
    "Variant, historical, and family forms",
    "Etymology proposals",
    "Reviewed source comparisons",
    "Field-level provenance"
)
Contains-All "docs/build/DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE-CONTRACT.md" @(
    "fixture-only",
    "Competing proposals remain separate",
    "explicit empty results",
    "temporary generations must match"
)

Write-Host "[INFO] Completed typecheck, migration/import, 17 backend checks, and 8 frontend checks are accepted from the resumed-stage record and are not repeated by this verifier."
Write-Host "[INFO] Live browser acceptance remains separately recorded; this verifier does not manage services."
Write-Host "[INFO] PASS=$script:PassCount FAIL=$script:FailCount"
if ($script:FailCount -gt 0) { exit 1 }
exit 0
