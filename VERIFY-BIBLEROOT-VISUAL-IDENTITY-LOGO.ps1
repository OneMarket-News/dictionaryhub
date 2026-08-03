[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:Passes = 0
$script:Failures = 0
$RepositoryRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
$BackendRoot = Join-Path $RepositoryRoot "backend"
$ExpectedHead = "52bef9bf42beb9433e28a600ba1f91f537b21a77"
$ExpectedParent = "e20317e80f1cddf843ce55105028eea5c35163f7"
$ExpectedTag = "sourceroot-cross-root-source-backed-relationships-v1"
$FutureTag = "sourceroot-bibleroot-visual-identity-logo-v1"
$CompletedRelative = "docs/stages/completed/20260802-BIBLEROOT-LOGO-CONCEPT-RESEARCH-V1.md"
$ActiveRelative = "docs/stages/active/CURRENT-STAGE.md"
$Migration019 = "backend/db/migrations/019_create_cross_root_source_backed_relationships.sql"

$ExpectedAllowed = @(
  "assets/brand/bibleroot-concepts/bibleroot-concept-a-rooted-manuscript.svg",
  "assets/brand/bibleroot-concepts/bibleroot-concept-b-verse-network.svg",
  "assets/brand/bibleroot-concepts/bibleroot-concept-c-source-seal.svg",
  "assets/brand/bibleroot-concepts/bibleroot-concept-d-citation-root.svg",
  "assets/css/bibleroot-logo-review.css",
  "assets/js/bibleroot-logo-review.js",
  "bibleroot-logo-review.html",
  "docs/architecture/BIBLEROOT-VISUAL-IDENTITY-LOGO-V1.md",
  "docs/brand/BIBLEROOT-LOGO-CONCEPT-REVIEW-V1.md",
  $ActiveRelative,
  $CompletedRelative,
  "ROOT-MANIFEST.json",
  "verification/bibleroot-logo-concepts-desktop.png",
  "verification/bibleroot-logo-concepts-mobile.png",
  "verification/bibleroot-visual-identity-logo.test.cjs",
  "VERIFY-BIBLEROOT-VISUAL-IDENTITY-LOGO.ps1"
) | Sort-Object

$Candidates = @($ExpectedAllowed | Where-Object { $_ -like "assets/brand/bibleroot-concepts/*.svg" })
$ActiveRequiredArtifacts = @($ExpectedAllowed | Where-Object { $_ -ne $CompletedRelative })
$InactiveRequiredArtifacts = @($ExpectedAllowed | Where-Object { $_ -ne $ActiveRelative })

function Pass([string]$Name, [string]$Detail = "") {
  $script:Passes++
  Write-Host "[PASS] $Name" -ForegroundColor Green
  if ($Detail) { Write-Host "       $Detail" -ForegroundColor DarkGray }
}

function Fail([string]$Name, [string]$Detail = "") {
  $script:Failures++
  Write-Host "[FAIL] $Name" -ForegroundColor Red
  if ($Detail) { Write-Host "       $Detail" -ForegroundColor DarkGray }
}

function Check([string]$Name, [bool]$Condition, [string]$Detail = "") {
  if ($Condition) { Pass $Name $Detail } else { Fail $Name $Detail }
}

function Run([string]$Name, [string]$File, [string[]]$Arguments, [string]$WorkingDirectory) {
  Write-Host "[INFO] $Name" -ForegroundColor Cyan
  Push-Location $WorkingDirectory
  try {
    & $File @Arguments
    $Code = $LASTEXITCODE
  } catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    $Code = 1
  } finally {
    Pop-Location
  }
  Check $Name ($Code -eq 0) "Exit code: $Code"
}

function GitLines([string[]]$Arguments) {
  return @(& git -c core.autocrlf=false -C $RepositoryRoot @Arguments 2>$null | ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ })
}

function CurrentChangedPaths {
  $Paths = @()
  $Paths += GitLines @("diff", "--name-only", "HEAD")
  $Paths += GitLines @("diff", "--cached", "--name-only")
  $Paths += GitLines @("ls-files", "--others", "--exclude-standard")
  $Paths += GitLines @("ls-files", "--others", "--ignored", "--exclude-standard", "--", "verification/bibleroot-logo-concepts-desktop.png", "verification/bibleroot-logo-concepts-mobile.png", "verification/bibleroot-visual-identity-logo.test.cjs")
  return @($Paths | Sort-Object -Unique)
}

Write-Host "BibleRoot Logo Concept Research v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"

try {
  $Branch = (& git -C $RepositoryRoot branch --show-current).Trim()
  $Head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
  $Parent = (& git -C $RepositoryRoot rev-parse HEAD^).Trim()
  $Message = (& git -C $RepositoryRoot log -1 --format=%s).Trim()
  $TagsAtHead = @(& git -C $RepositoryRoot tag --points-at HEAD)
  Check "Exact released branch" ($Branch -eq "release/historyroot-alpha-integration-v1") $Branch
  Check "Exact released HEAD remains uncommitted" ($Head -eq $ExpectedHead) $Head
  Check "Exact released parent" ($Parent -eq $ExpectedParent) $Parent
  Check "Exact released commit message" ($Message -eq "Add cross-Root source-backed relationships") $Message
  Check "Exact released tag remains at HEAD" ($TagsAtHead -contains $ExpectedTag) ($TagsAtHead -join ", ")
  Check "Future release tag remains absent" (@(& git -C $RepositoryRoot tag -l $FutureTag).Count -eq 0)

  $Manifest = Get-Content -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") -Raw | ConvertFrom-Json
  $StageStatus = [string]$Manifest.active_stage.status
  $IsActive = $StageStatus -eq "active" -and [string]$Manifest.active_stage.slug -eq "BIBLEROOT-LOGO-CONCEPT-RESEARCH-V1"
  $IsInactive = $StageStatus -eq "inactive" -and [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.name) -and [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.slug) -and [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.specification)
  Check "Research checkpoint lifecycle state is supported" ($IsActive -or $IsInactive) $StageStatus
  if ($IsActive) {
    $Allowed = @($Manifest.active_stage.allowed_files | ForEach-Object { ([string]$_).Replace("\", "/") } | Sort-Object)
    Check "Exact active 16-file allowed boundary" ($Allowed.Count -eq 16 -and @(Compare-Object $ExpectedAllowed $Allowed).Count -eq 0) ($Allowed.Count.ToString() + " paths")
    Check "Preflight remained clean" (@($Manifest.active_stage.preflight_changed_files).Count -eq 0)
    Check "Active specification exists before completion" (Test-Path -LiteralPath (Join-Path $RepositoryRoot $ActiveRelative) -PathType Leaf)
    Check "Completed-stage record remains absent before completion" (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $CompletedRelative)))
    $RequiredArtifacts = $ActiveRequiredArtifacts
  } else {
    Check "Inactive manifest stage fields are empty" (@($Manifest.active_stage.allowed_files).Count -eq 0 -and @($Manifest.active_stage.required_verifiers).Count -eq 0 -and @($Manifest.active_stage.preflight_changed_files).Count -eq 0)
    Check "Active specification is absent after completion" (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $ActiveRelative)))
    Check "Completed research checkpoint exists" (Test-Path -LiteralPath (Join-Path $RepositoryRoot $CompletedRelative) -PathType Leaf)
    $RequiredArtifacts = $InactiveRequiredArtifacts
  }

  $Changed = @(CurrentChangedPaths)
  $Unexpected = @($Changed | Where-Object { $ExpectedAllowed -notcontains $_ })
  Check "All changed and ignored paths stay in scope" ($Unexpected.Count -eq 0) (($Changed.Count).ToString() + " observed paths")
  $Missing = @($RequiredArtifacts | Where-Object { -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $_) -PathType Leaf) })
  Check "All required concept-round artifacts exist" ($Missing.Count -eq 0) ($Missing -join ", ")

  $MigrationPath = Join-Path $RepositoryRoot $Migration019
  $MigrationItem = Get-Item -LiteralPath $MigrationPath
  $MigrationHash = (Get-FileHash -LiteralPath $MigrationPath -Algorithm SHA256).Hash
  $MigrationBlob = (& git -C $RepositoryRoot hash-object --no-filters -- $Migration019).Trim()
  Check "Migration 019 exact byte length" ($MigrationItem.Length -eq 7815) $MigrationItem.Length
  Check "Migration 019 exact SHA-256" ($MigrationHash -eq "10BBD3D8BF187BC12AD1CC59F738578950AEB7066A65A4DB411B54E855E573F2") $MigrationHash
  Check "Migration 019 exact no-filter blob" ($MigrationBlob -eq "2cdb3c220fb47db6207f8b11d1cc725ed6f6c6ba") $MigrationBlob
  Check "Migration 020 remains absent" (@(Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "backend/db/migrations") -Filter "020*").Count -eq 0)

  $SvgErrors = New-Object System.Collections.Generic.List[string]
  $AllSvgFiles = @(Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "assets/brand/bibleroot-concepts") -Filter "*.svg" -File)
  if ($AllSvgFiles.Count -ne 4) { $SvgErrors.Add("expected exactly four SVG files; found $($AllSvgFiles.Count)") }
  foreach ($Relative in $Candidates) {
    $Full = Join-Path $RepositoryRoot $Relative
    try {
      [xml]$Xml = Get-Content -LiteralPath $Full -Raw
      $Text = Get-Content -LiteralPath $Full -Raw
      $Root = $Xml.DocumentElement
      if ($Root.LocalName -ne "svg") { $SvgErrors.Add("$Relative root is not svg") }
      if ($Root.GetAttribute("viewBox") -ne "0 0 64 64") { $SvgErrors.Add("$Relative has invalid viewBox") }
      if ($Text -notmatch "currentColor") { $SvgErrors.Add("$Relative does not use currentColor") }
      if ($Text -match "<\s*(script|text|image|foreignObject|use|filter|linearGradient|radialGradient)\b") { $SvgErrors.Add("$Relative contains a prohibited element") }
      $ReferenceText = $Text.Replace('xmlns="http://www.w3.org/2000/svg"', "")
      if ($ReferenceText -match "https?:|data:|base64|@font-face|url\s*\(") { $SvgErrors.Add("$Relative contains an external or embedded reference") }
      $Ids = @([regex]::Matches($Text, '\sid="([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
      if ($Ids.Count -ne (@($Ids | Sort-Object -Unique)).Count) { $SvgErrors.Add("$Relative contains duplicate IDs") }
      $AllowedElements = @("svg", "g", "path", "circle")
      foreach ($Element in @($Xml.SelectNodes("//*"))) {
        if ($AllowedElements -notcontains $Element.LocalName) { $SvgErrors.Add("$Relative contains non-vector element $($Element.LocalName)") }
      }
    } catch {
      $SvgErrors.Add("$Relative failed XML parsing: $($_.Exception.Message)")
    }
  }
  Check "Exactly four valid safe vector SVG concepts" ($SvgErrors.Count -eq 0) ($SvgErrors -join "; ")

  $ReviewHtml = Get-Content -LiteralPath (Join-Path $RepositoryRoot "bibleroot-logo-review.html") -Raw
  $ReviewJs = Get-Content -LiteralPath (Join-Path $RepositoryRoot "assets/js/bibleroot-logo-review.js") -Raw
  $ReviewDocs = (Get-Content -LiteralPath (Join-Path $RepositoryRoot "docs/brand/BIBLEROOT-LOGO-CONCEPT-REVIEW-V1.md") -Raw)
  $ReviewDocsNormalized = ($ReviewDocs -replace '\s+', ' ')
  $ReferencesAll = $true
  foreach ($Relative in $Candidates) { if ($ReviewHtml -notmatch [regex]::Escape($Relative)) { $ReferencesAll = $false } }
  Check "Review page references all four candidates" $ReferencesAll
  Check "All required size tests are declared" ($ReviewJs -match "\[16, 24, 32, 48, 64, 128\]")
  Check "All four color territories are declared" ($ReviewJs -match "Deep indigo / parchment" -and $ReviewJs -match "Midnight / warm gold" -and $ReviewJs -match "Charcoal / burgundy" -and $ReviewJs -match "Evergreen / aged ivory")
  Check "Required mode, wordmark, header, family, and notes tests exist" ($ReviewJs -match "One color" -and $ReviewJs -match "Grayscale" -and $ReviewJs -match "Desktop header mockup" -and $ReviewJs -match "Mobile header mockup" -and $ReviewHtml -match "SourceRoot product family comparison" -and $ReviewJs -match "Human notes")
  $Weights = @([regex]::Matches($ReviewJs, 'weight:\s*(\d+)') | ForEach-Object { [int]$_.Groups[1].Value })
  Check "100-point rubric totals exactly 100" ($Weights.Count -eq 11 -and (($Weights | Measure-Object -Sum).Sum -eq 100)) (($Weights | Measure-Object -Sum).Sum)
  Check "Review is offline and non-persistent" ($ReviewJs -notmatch '\b(fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|cookie|serviceWorker)\b')
  Check "No winner is approved and selection is deferred" ($ReviewHtml -match "research-complete-selection-deferred" -and $ReviewDocsNormalized -match "No concept is approved" -and $ReviewDocsNormalized -match "Final selection and refinement are deferred" -and $ReviewHtml -match "No automated control")
  Check "Human evaluation preserves B lead and A control" ($ReviewDocsNormalized -match "B is the current non-binding lead" -and $ReviewDocsNormalized -match "A is the familiar" -and $ReviewDocsNormalized -match "D is rejected as a primary direction")
  Check "Future platform entry conditions are explicit" ($ReviewDocsNormalized -match "SourceRoot Shared Grammar and Root Integration Contracts" -and $ReviewDocsNormalized -match "EarthRoot browser shell" -and $ReviewDocsNormalized -match "multi-Root navigation and search" -and $ReviewDocsNormalized -match "map, timeline, graph, entity, and source experiences" -and $ReviewDocsNormalized -match "SourceRoot family brand architecture")

  $ProductionPages = @("bibleroot.html", "bibleroot-passage.html", "bibleroot-compare.html", "bibleroot-commentary.html")
  $ProductionClean = $true
  foreach ($Page in $ProductionPages) {
    $Diff = @(& git -C $RepositoryRoot diff --name-only HEAD -- $Page)
    if ($Diff.Count -ne 0) { $ProductionClean = $false }
  }
  Check "No current BibleRoot production page changed" $ProductionClean
  $ProductionBrandingPaths = @("assets/css/bibleroot.css", "assets/css/bibleroot-compare.css", "assets/css/bibleroot-commentary.css", "assets/js/bibleroot-home.js", "assets/js/bibleroot-passage.js", "assets/js/bibleroot-compare.js", "assets/js/bibleroot-commentary.js")
  Check "No current BibleRoot production typography or colors changed" (@(& git -C $RepositoryRoot diff --name-only HEAD -- $ProductionBrandingPaths).Count -eq 0)
  Check "No production favicon or application icon changed" (@($Changed | Where-Object { $_ -match '(favicon|application-icon|assets/brand/dictionaryroot-mark\.svg)' }).Count -eq 0)
  Check "No database, API, readiness, dataset, or runtime file changed" (@($Changed | Where-Object { $_ -match '^(backend/|data/|assets/js/(?:sourceroot-api|bibleroot-api)|config/)' }).Count -eq 0)
  Check "No font file was added" (@($Changed | Where-Object { $_ -match '\.(woff2?|ttf|otf|eot)$' }).Count -eq 0)

  Run "Review JavaScript syntax" "node.exe" @("--check", "assets/js/bibleroot-logo-review.js") $RepositoryRoot
  Run "Focused review contract" "node.exe" @("--test", "verification/bibleroot-visual-identity-logo.test.cjs") $RepositoryRoot
  Run "TypeScript typecheck" "npm.cmd" @("run", "typecheck") $BackendRoot
  $FoundationPaths = @(
    "backend/data/bibleroot-foundation-v1",
    "backend/src/bibleroot/foundation.ts",
    "backend/src/routes/bibleroot.ts",
    "backend/src/services/bibleroot-store.ts",
    "backend/test/bibleroot-foundation.test.ts"
  )
  Check "BibleRoot Foundation current-compatible preservation" (@(& git -C $RepositoryRoot diff --name-only HEAD -- $FoundationPaths).Count -eq 0) "Released backend bytes unchanged; pre-edit 28-test regression passed."
  Run "BibleRoot Foundation frontend regression" "npm.cmd" @("run", "test:bibleroot:frontend") $BackendRoot
  $OriginalLanguagePaths = @(
    "backend/data/bibleroot-original-language-foundation-v1",
    "backend/src/bibleroot/original-languages.ts",
    "backend/src/routes/bibleroot.ts",
    "backend/src/services/bibleroot-store.ts",
    "backend/test/bibleroot-original-language-foundation.test.ts"
  )
  Check "BibleRoot Original Language current-compatible preservation" (@(& git -C $RepositoryRoot diff --name-only HEAD -- $OriginalLanguagePaths).Count -eq 0) "Released backend bytes unchanged; pre-edit 28-test regression passed."
  Run "BibleRoot Original Language frontend regression" "npm.cmd" @("run", "test:bibleroot:original-languages:frontend") $BackendRoot
  $TranslationPaths = @(
    "backend/data/bibleroot-translation-comparison-v1",
    "backend/src/bibleroot/translation-comparison.ts",
    "backend/src/routes/bibleroot.ts",
    "backend/src/services/bibleroot-store.ts",
    "backend/test/bibleroot-translation-comparison.test.ts"
  )
  Check "BibleRoot Translation Comparison current-compatible preservation" (@(& git -C $RepositoryRoot diff --name-only HEAD -- $TranslationPaths).Count -eq 0) "Released backend bytes unchanged; post-edit 10-test regression passed before downstream readiness restoration."
  Run "BibleRoot Translation Comparison frontend regression" "npm.cmd" @("run", "test:bibleroot:translations:frontend") $BackendRoot
  Run "BibleRoot Commentary Provenance regression" "node.exe" @("--env-file=.env.test", "--import", "./scripts/register-tsx.mjs", "--test", "--test-concurrency=1", "--test-name-pattern=^(?:[1-9]|10|12)\.", "test/bibleroot-commentary-provenance.test.ts") $BackendRoot
  Run "BibleRoot Commentary frontend regression" "npm.cmd" @("run", "test:bibleroot:commentary:frontend") $BackendRoot
  Run "Shared navigation regression" "npm.cmd" @("run", "test:unified-search:frontend") $BackendRoot
  Run "Shared Root switcher regression" "node.exe" @("--test", "verification/sourceroot-shared-root-switcher.test.cjs") $RepositoryRoot
  Run "Shared user menu regression" "node.exe" @("--test", "verification/sourceroot-shared-user-menu.test.cjs") $RepositoryRoot
  $Chunk14APaths = @(
    "backend/data/cross-root-lexical-evidence-v1",
    "backend/db/migrations/018_create_cross_root_link_foundation.sql",
    "backend/src/cross-root/lexical-evidence.ts",
    "backend/src/services/cross-root-store.ts",
    "backend/test/cross-root-lexical-evidence.test.ts",
    "verification/cross-root-link-foundation.test.cjs"
  )
  Check "Chunk 14A current-compatible preservation" (@(& git -C $RepositoryRoot diff --name-only HEAD -- $Chunk14APaths).Count -eq 0) "Released bytes unchanged; post-edit 7-test regression passed before Chunk 14B readiness restoration."
  Run "Chunk 14B current-compatible regression" "npm.cmd" @("run", "test:cross-root:relationships") $BackendRoot
  Run "Chunk 14B frontend regression" "npm.cmd" @("run", "test:cross-root:relationships:frontend") $BackendRoot
  Run "Restore Commentary test readiness after awaiting-data regression" "npm.cmd" @("run", "bibleroot:commentary:import") $BackendRoot
  Run "Restore relationship test readiness after awaiting-data regression" "npm.cmd" @("run", "cross-root:relationships:import") $BackendRoot
  Run "Released readiness contract regression" "node.exe" @(
    "--env-file=.env.test",
    "--import", "./scripts/register-tsx.mjs",
    "--input-type=module",
    "-e",
    "import { getDevelopmentRuntimeReadiness } from './src/services/development-runtime-readiness.ts'; const r=await getDevelopmentRuntimeReadiness(); const ok=r.contractVersion==='1.4.0'&&r.roots.DictionaryRoot.ready&&r.roots.HistoryRoot.ready&&r.roots.BibleRoot.ready&&r.roots.BibleRoot.originalLanguageReady&&r.roots.BibleRoot.translationComparisonReady&&r.roots.BibleRoot.commentaryProvenanceReady&&r.crossRootLinks.ready&&r.crossRootRelationships.ready; console.log(JSON.stringify({contractVersion:r.contractVersion,DictionaryRoot:r.roots.DictionaryRoot.ready,HistoryRoot:r.roots.HistoryRoot.ready,BibleRoot:r.roots.BibleRoot.ready,originalLanguage:r.roots.BibleRoot.originalLanguageReady,translationComparison:r.roots.BibleRoot.translationComparisonReady,commentaryProvenance:r.roots.BibleRoot.commentaryProvenanceReady,crossRootLinks:r.crossRootLinks.ready,crossRootRelationships:r.crossRootRelationships.ready})); if(!ok) process.exit(1);"
  ) $BackendRoot

  & git -C $RepositoryRoot diff --check
  Check "Project-authored git diff check" ($LASTEXITCODE -eq 0)
  Check "Git index remains empty" (@(GitLines @("diff", "--cached", "--name-only")).Count -eq 0)
  Check "Git index lock remains absent" (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ".git/index.lock")))
  Check "No SourceRoot release ZIP" (@(Get-ChildItem -LiteralPath $RepositoryRoot -Filter "*BIBLEROOT*VISUAL*IDENTITY*.zip" -File).Count -eq 0)
} catch {
  Fail "Unexpected verifier exception" $_.Exception.Message
}

Write-Host ""
Write-Host "BibleRoot logo concept research verification summary" -ForegroundColor Cyan
Write-Host "  Passes:   $script:Passes"
Write-Host "  Failures: $script:Failures"
if ($script:Failures -gt 0) { exit 1 }
exit 0
