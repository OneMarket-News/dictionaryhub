[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "C:\Users\Josh\Documents\GitHub\dictionaryhub",

    [Parameter()]
    [switch]$SkipApi,

    [Parameter()]
    [string]$ApiBaseUrl = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0

function Result {
    param([string]$Name, [bool]$Okay, [string]$Detail = "")
    if ($Okay) { $script:Passed++; Write-Host "[PASS] $Name" -ForegroundColor Green }
    else { $script:Failed++; Write-Host "[FAIL] $Name" -ForegroundColor Red }
    if ($Detail) { Write-Host "       $Detail" }
}

function Warning {
    param([string]$Name, [string]$Detail = "")
    $script:Warnings++
    Write-Host "[WARN] $Name" -ForegroundColor Yellow
    if ($Detail) { Write-Host "       $Detail" }
}

function Text([string]$RelativePath) {
    Get-Content -LiteralPath (Join-Path $script:Root $RelativePath) -Raw
}

function Contains([string]$RelativePath, [string[]]$Markers, [string]$Name) {
    $Content = Text $RelativePath
    $Missing = @($Markers | Where-Object { $Content.IndexOf($_, [System.StringComparison]::Ordinal) -lt 0 })
    Result $Name ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "" })
}

function ApiItems($Payload) {
    if ($null -eq $Payload) { return @() }
    if ($Payload -is [System.Array]) { return @($Payload) }
    foreach ($Name in @("items", "results", "nodes", "assertions", "edges")) {
        if ($Payload.PSObject.Properties.Name -contains $Name) { return @($Payload.$Name) }
    }
    return @()
}

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    Write-Host "Repository not found: $RepositoryPath" -ForegroundColor Red
    exit 2
}
$script:Root = (Resolve-Path -LiteralPath $RepositoryPath).Path
Write-Host "DictionaryRoot Complete-Sense Search and Lexical Coverage v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:Root"
Write-Host ""

$Required = @(
    "BUILD-IMPORT-DICTIONARYROOT-LEXICON.ps1",
    "VERIFY-DICTIONARYROOT-COMPLETE-SENSE-COVERAGE.ps1",
    "assets\css\dictionaryroot-navigation.css",
    "assets\js\dictionaryroot-navigation.js",
    "backend\db\migrations\003_create_dictionaryroot_lexicon.sql",
    "backend\src\app.ts",
    "backend\src\dictionaryroot\oewn-wndb.ts",
    "backend\src\routes\lexicon.ts",
    "backend\src\routes\nodes.ts",
    "backend\src\scripts\import-dictionaryroot-lexicon.ts",
    "backend\src\services\lexical-store.ts",
    "backend\src\services\node-store.ts",
    "backend\src\services\search-store.ts",
    "backend\test\lexical-store.test.ts",
    "docs\customers\dictionaryroot\api-contract.md",
    "docs\customers\dictionaryroot\complete-sense-coverage-stage.md"
)
$Missing = @($Required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:Root $_) -PathType Leaf) })
Result "Required complete-sense files exist" ($Missing.Count -eq 0) $(if ($Missing.Count) { "Missing: $($Missing -join ', ')" } else { "$($Required.Count) files found." })
if ($Missing.Count) { exit 1 }

Contains "backend\db\migrations\003_create_dictionaryroot_lexicon.sql" @(
    "dictionaryroot_lexicon_datasets",
    "dictionaryroot_lexicon_synsets",
    "dictionaryroot_lexicon_relations",
    "normalized_lemmas TEXT[]",
    "USING GIN(normalized_lemmas)"
) "Complete lexical index schema is installed"

Contains "backend\src\scripts\import-dictionaryroot-lexicon.ts" @(
    "loadWordNetSynsets",
    "dictionaryroot_lexicon_synsets",
    "dictionaryroot_lexicon_relations",
    "batch-size",
    "DictionaryRoot complete lexical index imported."
) "Batched official WordNet importer is present"

Contains "backend\src\services\lexical-store.ts" @(
    "searchDictionaryRootExactSenses",
    "normalized_lemmas @> ARRAY",
    "getDictionaryRootLemmaCoverage",
    "getDictionaryRootLexicalNodeById",
    "getDictionaryRootLexicalAssertionsByNodeId",
    "getDictionaryRootLexicalEdgesByNodeId",
    'lexicalCoverage: "complete-lemma"'
) "Lexical search, diagnostics, and on-demand concepts are present"

Contains "backend\src\services\search-store.ts" @(
    "searchDictionaryRootExactSenses",
    "lexical.coverage.lexicalOnlySenseCount",
    'exactSensePolicy: "complete-lemma"',
    "...lexical.items",
    "related.slice"
) "Search returns every exact sense before related matches"

Contains "backend\src\routes\nodes.ts" @(
    "getDictionaryRootLexicalAssertionsByNodeId",
    "getDictionaryRootLexicalEdgesByNodeId"
) "Existing node routes resolve lexical-only concepts"

Contains "backend\src\routes\lexicon.ts" @(
    'lexiconRouter.get("/status"',
    'lexiconRouter.get("/coverage"'
) "Coverage diagnostics endpoints are present"

Contains "assets\js\dictionaryroot-navigation.js" @(
    "const relatedLimit = Math.max(0, 12 - exact.length)",
    "exact.concat(related.slice(0, relatedLimit))",
    "complete exact senses",
    "Complete lexicon · on-demand graph",
    "coverage.partOfSpeechCounts"
) "Global search displays all exact senses and coverage"

$NavigationText = Text "assets\js\dictionaryroot-navigation.js"
Result "Legacy ten-result exact-sense truncation is removed" (-not $NavigationText.Contains("ordered.slice(0, 10)"))

Contains "BUILD-IMPORT-DICTIONARYROOT-LEXICON.ps1" @(
    'english-wordnet-$SourceVersion.zip',
    'npm.cmd --prefix $Backend run db:migrate',
    'npm.cmd --prefix $Backend run dictionaryroot:lexicon',
    "The graph remains bounded"
) "Build/import workflow separates lexical and graph coverage"

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
    foreach ($File in @("assets\js\dictionaryroot-navigation.js")) {
        $Output = & $Node.Source --check (Join-Path $script:Root $File) 2>&1
        Result "JavaScript syntax: $File" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
    }
} else { Warning "JavaScript syntax skipped" "Node.js was not found." }

$NpmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($NpmCmd) {
    Push-Location (Join-Path $script:Root "backend")
    try {
        $Output = & $NpmCmd.Source run typecheck --silent 2>&1
        Result "SourceRoot TypeScript typecheck" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -ne 0) { $Output -join " " } else { "" })
    } finally { Pop-Location }
} else { Warning "TypeScript typecheck skipped" "npm.cmd was not found." }

try {
    $Config = Get-Content -LiteralPath (Join-Path $script:Root "config\customers\dictionaryroot.json") -Raw | ConvertFrom-Json
} catch {
    Result "DictionaryRoot manifest parses" $false $_.Exception.Message
    $Config = $null
}

if ($SkipApi) {
    Warning "Live complete-sense checks skipped" "Run without -SkipApi after migrations, lexical import, and SourceRoot restart."
} elseif ($null -eq $Config) {
    Result "Live complete-sense checks" $false "Customer manifest could not be parsed."
} else {
    $Base = if ($ApiBaseUrl) { $ApiBaseUrl.TrimEnd('/') } else { ([string]$Config.apiBaseUrl).TrimEnd('/') }
    $Origin = $Base -replace "/api/v1$", ""
    $Bundle = [System.Uri]::EscapeDataString([string]$Config.bundleId)

    try {
        $Health = Invoke-RestMethod -Uri "$Origin/health" -Method Get -TimeoutSec 15
        Result "SourceRoot health endpoint responds" ($Health.status -eq "ok") "$Origin/health"
    } catch { Result "SourceRoot health endpoint responds" $false $_.Exception.Message }

    $LexiconStatus = $null
    try {
        $LexiconStatus = Invoke-RestMethod -Uri "$Base/dictionaryroot/lexicon/status?bundleId=$Bundle" -Method Get -TimeoutSec 30
        $StatusOkay = $LexiconStatus.available -eq $true -and [int]$LexiconStatus.synsetCount -gt 10000 -and [int]$LexiconStatus.lemmaCount -gt 10000
        Result "Complete Open English WordNet lexicon is imported" $StatusOkay $(if ($LexiconStatus) { "synsets=$($LexiconStatus.synsetCount); lemmas=$($LexiconStatus.lemmaCount); relations=$($LexiconStatus.relationCount)" } else { "Run BUILD-IMPORT-DICTIONARYROOT-LEXICON.ps1." })
    } catch { Result "Complete Open English WordNet lexicon is imported" $false $_.Exception.Message }

    $Coverage = $null
    try {
        $Coverage = Invoke-RestMethod -Uri "$Base/dictionaryroot/lexicon/coverage?q=value&bundleId=$Bundle" -Method Get -TimeoutSec 30
        $CoverageOkay = $Coverage.available -eq $true -and [int]$Coverage.exactSenseCount -gt 1 -and $Coverage.complete -eq $true
        Result "'value' coverage reports multiple complete exact senses" $CoverageOkay "exact=$($Coverage.exactSenseCount); graph=$($Coverage.graphSenseCount); lexicalOnly=$($Coverage.lexicalOnlySenseCount)"
    } catch { Result "'value' coverage reports multiple complete exact senses" $false $_.Exception.Message }

    $Search = $null
    $Exact = @()
    try {
        $Search = Invoke-RestMethod -Uri "$Base/search?q=value&type=node&bundleId=$Bundle&domain=DictionaryRoot&page=1&limit=100" -Method Get -TimeoutSec 30
        $Items = @(ApiItems $Search)
        $Exact = @($Items | Where-Object {
            $IsExact = ([string]$_.title).ToLowerInvariant() -eq "value"
            if ($_.metadata -and $_.metadata.lemmas) {
                foreach ($Lemma in @($_.metadata.lemmas)) {
                    if (([string]$Lemma).ToLowerInvariant() -eq "value") { $IsExact = $true }
                }
            }
            $IsExact
        })
        $ExpectedCount = if ($Coverage) { [int]$Coverage.exactSenseCount } else { 0 }
        $Complete = $Search.exactSensePolicy -eq "complete-lemma" -and $Exact.Count -eq $ExpectedCount -and $Exact.Count -gt 1
        Result "Search returns every exact 'value' sense" $Complete "searchExact=$($Exact.Count); coverageExact=$ExpectedCount"
    } catch { Result "Search returns every exact 'value' sense" $false $_.Exception.Message }

    $Monetary = @($Exact | Where-Object { ([string]$_.summary) -match '(?i)money|monetary|worth|price|amount|economic|market value' } | Select-Object -First 1)
    Result "Monetary/economic 'value' meaning is present" ($Monetary.Count -gt 0) $(if ($Monetary.Count) { [string]$Monetary[0].summary } else { "No exact value definition mentioned money, worth, price, amount, economic, or market value." })

    if ($Monetary.Count -gt 0) {
        $NodeId = [System.Uri]::EscapeDataString([string]$Monetary[0].id)
        try {
            $NodeDetail = Invoke-RestMethod -Uri "$Base/nodes/$NodeId" -Method Get -TimeoutSec 20
            Result "Lexical monetary sense resolves through existing node route" ($NodeDetail.nodeId -eq [string]$Monetary[0].id) ([string]$NodeDetail.nodeId)
        } catch { Result "Lexical monetary sense resolves through existing node route" $false $_.Exception.Message }

        try {
            $Assertions = Invoke-RestMethod -Uri "$Base/nodes/$NodeId/assertions" -Method Get -TimeoutSec 20
            Result "Lexical monetary sense exposes source-backed definition" (@(ApiItems $Assertions).Count -gt 0) "$(@(ApiItems $Assertions).Count) assertions returned."
        } catch { Result "Lexical monetary sense exposes source-backed definition" $false $_.Exception.Message }

        try {
            $Edges = Invoke-RestMethod -Uri "$Base/nodes/$NodeId/edges" -Method Get -TimeoutSec 20
            Result "Lexical monetary sense relationship route responds" ($null -ne $Edges -and $Edges.PSObject.Properties.Name -contains "outgoingTotal") "incoming=$($Edges.incomingTotal); outgoing=$($Edges.outgoingTotal)"
        } catch { Result "Lexical monetary sense relationship route responds" $false $_.Exception.Message }
    }
}

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host ""
Write-Host "Manual browser checks still required:" -ForegroundColor Yellow
Write-Host "  1. Search value and confirm monetary, numerical, moral/importance, and lightness senses are separated when present in OEWN."
Write-Host "  2. Confirm every exact result appears before related matches and each shows a part of speech."
Write-Host "  3. Open a lexical-only sense in Concept, Sphere, Sources, and History."
Write-Host "  4. Confirm browser Back/Forward and context-preserving URLs."
Write-Host "  5. Confirm mobile search results at 390 x 844 and SourceRoot-offline states without fallback data."

if ($script:Failed -gt 0) { exit 1 }
exit 0
