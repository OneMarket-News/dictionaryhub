[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = ""
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

function Read-Text([string]$RelativePath) {
    return Get-Content -LiteralPath (Join-Path $script:Root ($RelativePath -replace "/", "\")) -Raw
}

function Contains-All([string]$Name, [string]$RelativePath, [string[]]$Markers) {
    try {
        $Text = Read-Text $RelativePath
        $Missing = @($Markers | Where-Object {
            $Text.IndexOf($_, [StringComparison]::Ordinal) -lt 0
        })
        if ($Missing.Count -eq 0) {
            Pass $Name "$RelativePath"
        } else {
            Fail $Name "Missing: $($Missing -join ', ')"
        }
    } catch {
        Fail $Name $_.Exception.Message
    }
}

function Run([string]$Name, [string]$File, [string[]]$Arguments) {
    Push-Location $script:Root
    try {
        & $File @Arguments
        $Code = $LASTEXITCODE
    } catch {
        Write-Host $_.Exception.Message
        $Code = 1
    } finally {
        Pop-Location
    }
    if ($Code -eq 0) { Pass $Name "Exit 0." } else { Fail $Name "Exit $Code." }
}

function Hash([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

$RootInput = if ([string]::IsNullOrWhiteSpace($RepositoryPath)) {
    $PSScriptRoot
} else {
    $RepositoryPath
}
$script:Root = [IO.Path]::GetFullPath($RootInput).TrimEnd("\", "/")
$ExpectedHead = "a467f854e158949240f01ff52c77bf66331197f5"
$ExpectedBranch = "release/historyroot-alpha-integration-v1"
$ExpectedStage = "SOURCEROOT-SHARED-ROOT-SWITCHER-NAVIGATION-POLISH-V1"
$ExpectedAllowed = @(
    "ROOT-MANIFEST.json",
    "VERIFY-SOURCEROOT-SHARED-ROOT-SWITCHER-NAVIGATION-POLISH.ps1",
    "assets/css/sourceroot-root-switcher.css",
    "assets/js/dictionaryroot-navigation.js",
    "assets/js/historyroot-shared.js",
    "assets/js/sourceroot-root-switcher.js",
    "docs/build/SOURCEROOT-SHARED-ROOT-SWITCHER-BROWSER-EVIDENCE.md",
    "docs/build/SOURCEROOT-SHARED-ROOT-SWITCHER-STATE.md",
    "docs/stages/active/CURRENT-STAGE.md",
    "docs/stages/completed/20260730-SOURCEROOT-SHARED-ROOT-SWITCHER-NAVIGATION-POLISH-V1.md",
    "sourceroot-search.html",
    "sourceroot.html",
    "verification/sourceroot-root-switcher-dictionaryroot-desktop-closed.png",
    "verification/sourceroot-root-switcher-dictionaryroot-desktop-open.png",
    "verification/sourceroot-root-switcher-historyroot-desktop-closed.png",
    "verification/sourceroot-root-switcher-historyroot-desktop-open.png",
    "verification/sourceroot-root-switcher-mobile-open.png",
    "verification/sourceroot-shared-root-switcher.test.cjs"
)

Write-Host "SourceRoot Shared Root Switcher Navigation Polish v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:Root"

try {
    $Head = (& git -C $script:Root rev-parse HEAD).Trim()
    $Branch = (& git -C $script:Root branch --show-current).Trim()
    $Remote = (& git -C $script:Root rev-parse "origin/$ExpectedBranch").Trim()
    if ($Head -eq $ExpectedHead -and $Branch -eq $ExpectedBranch -and $Remote -eq $ExpectedHead) {
        Pass "Starting checkpoint" "$Branch at $Head; local remote-tracking ref exact."
    } else {
        Fail "Starting checkpoint" "branch=$Branch head=$Head remote=$Remote"
    }
} catch {
    Fail "Starting checkpoint" $_.Exception.Message
}

try {
    $Manifest = Read-Text "ROOT-MANIFEST.json" | ConvertFrom-Json
    $ActualAllowed = @($Manifest.active_stage.allowed_files | Sort-Object)
    $AllowedExact = (
        $ActualAllowed.Count -eq $ExpectedAllowed.Count -and
        (@(Compare-Object $ExpectedAllowed $ActualAllowed).Count -eq 0)
    )
    if ($Manifest.active_stage.slug -eq $ExpectedStage -and
        $Manifest.active_stage.status -eq "active" -and $AllowedExact) {
        Pass "Bounded Root stage" "$($ActualAllowed.Count) explicit allowed files."
    } else {
        Fail "Bounded Root stage" "slug=$($Manifest.active_stage.slug) status=$($Manifest.active_stage.status) allowed=$($ActualAllowed.Count)"
    }
} catch {
    Fail "Bounded Root stage" $_.Exception.Message
}

try {
    $Tracked = @(& git -c core.autocrlf=false -C $script:Root diff --name-only)
    $Untracked = @(& git -C $script:Root ls-files --others --exclude-standard)
    $Changed = @($Tracked + $Untracked |
        ForEach-Object { ([string]$_).Trim().Replace("\", "/") } |
        Where-Object { $_ } |
        Sort-Object -Unique)
    $Unauthorized = @($Changed | Where-Object { $ExpectedAllowed -notcontains $_ })
    if ($Unauthorized.Count -eq 0) {
        Pass "Stage changed-file boundary" "$($Changed.Count) visible changed files; zero unauthorized."
    } else {
        Fail "Stage changed-file boundary" ($Unauthorized -join ", ")
    }
} catch {
    Fail "Stage changed-file boundary" $_.Exception.Message
}

try {
    $MigrationRoot = Join-Path $script:Root "backend\db\migrations"
    $Migrations = @(Get-ChildItem -LiteralPath $MigrationRoot -File -Filter "*.sql")
    $Complete = (1..14 | ForEach-Object {
        $Prefix = "{0:D3}_" -f $_
        @($Migrations | Where-Object { $_.Name.StartsWith($Prefix) }).Count -gt 0
    }) -notcontains $false
    $Migration015 = @($Migrations | Where-Object { $_.Name.StartsWith("015_") }).Count
    & git -c core.autocrlf=false -C $script:Root diff --quiet $ExpectedHead -- "backend/db/migrations"
    if ($Complete -and $Migration015 -eq 0 -and $LASTEXITCODE -eq 0) {
        Pass "Migration boundary" "001-014 present and unchanged; 015 absent."
    } else {
        Fail "Migration boundary" "complete=$Complete migration015=$Migration015"
    }
} catch {
    Fail "Migration boundary" $_.Exception.Message
}

try {
    & git -c core.autocrlf=false -C $script:Root diff --quiet $ExpectedHead -- "backend"
    $BackendDiffCode = $LASTEXITCODE
    $BackendUntracked = @(& git -C $script:Root ls-files --others --exclude-standard -- "backend")
    if ($BackendDiffCode -eq 0 -and $BackendUntracked.Count -eq 0) {
        Pass "Backend and database boundary" "No backend route, service, database, or other backend file changed."
    } else {
        Fail "Backend and database boundary" "A backend file differs or is untracked."
    }
} catch {
    Fail "Backend and database boundary" $_.Exception.Message
}

try {
    $CorpusPaths = @(
        "backend/data/dictionaryroot-core-lexical-corpus-v1",
        "backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1",
        "backend/data/historyroot-wampanoag-regional-corpus-v1",
        "data/historyroot/plymouth-v1"
    )
    & git -c core.autocrlf=false -C $script:Root diff --quiet $ExpectedHead -- @CorpusPaths
    if ($LASTEXITCODE -eq 0) {
        Pass "Corpus bytes" "DictionaryRoot and HistoryRoot corpus paths unchanged."
    } else {
        Fail "Corpus bytes" "A protected corpus path differs."
    }
} catch {
    Fail "Corpus bytes" $_.Exception.Message
}

try {
    $ReleaseRoot = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "SourceRoot-Releases"
    $DictionaryZip = Join-Path $ReleaseRoot "SourceRoot-DictionaryRoot-Core-Lexical-Corpus-v1.zip"
    $HistoryZip = Join-Path $ReleaseRoot "SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1.zip"
    $DictionaryLength = (Get-Item -LiteralPath $DictionaryZip).Length
    $DictionaryHash = Hash $DictionaryZip
    $HistoryHash = Hash $HistoryZip
    if ($DictionaryLength -eq 264507 -and
        $DictionaryHash -eq "E7640A0337F084D1EFFCFDC3B340A3AD7611FBA6E089ED2078B0AFE97EEAD8C0" -and
        $HistoryHash -eq "D4E11DD28EECC46BEFA76E3E4805BB8CDB6F8C8EE57FA07C72BEB898DF409D29") {
        Pass "Accepted release ZIP identities" "DictionaryRoot bytes/hash and HistoryRoot hash exact."
    } else {
        Fail "Accepted release ZIP identities" "An accepted release ZIP identity differs."
    }
} catch {
    Fail "Accepted release ZIP identities" $_.Exception.Message
}

Contains-All "Shared Root registry" "assets/js/sourceroot-root-switcher.js" @(
    "const REGISTRY =",
    'id: "SourceRoot"',
    'displayName: "SourceRoot Home"',
    'id: "SourceRootSearch"',
    'displayName: "Search All Roots"',
    'destinationType: "utility"',
    'id: "DictionaryRoot"',
    'id: "HistoryRoot"',
    "available",
    "canonicalUrl",
    "order"
)

Contains-All "Shared switcher implementation" "assets/js/sourceroot-root-switcher.js" @(
    '"Switch Roots"',
    'document.createElement("button")',
    'document.createElement("nav")',
    'setAttribute("aria-expanded"',
    'setAttribute("aria-controls", menuId)',
    'setAttribute("aria-current", "page")',
    'event.key === "Escape"',
    'document.addEventListener("click"',
    'event.key === "Enter" || event.key === " "',
    "new WeakMap()",
    "trigger.focus()"
)

Contains-All "SourceRoot integration" "sourceroot.html" @(
    'data-sourceroot-root-switcher',
    'data-current-root="SourceRoot"',
    "assets/js/sourceroot-root-switcher.js",
    'action="sourceroot-search.html"'
)

Contains-All "Unified-search integration" "sourceroot-search.html" @(
    'data-sourceroot-root-switcher',
    'data-current-root="SourceRootSearch"',
    'class="sr-breadcrumbs"',
    "assets/js/sourceroot-unified-search.js"
)

Contains-All "DictionaryRoot integration" "assets/js/dictionaryroot-navigation.js" @(
    'SourceRootRootSwitcher.init({ mount, currentId: "DictionaryRoot" })',
    'data-sourceroot-root-switcher',
    "dictionaryroot-product-nav",
    "sr-dictionaryroot-breadcrumbs"
)

Contains-All "HistoryRoot integration" "assets/js/historyroot-shared.js" @(
    'SourceRootRootSwitcher.init({ mount, currentId: "HistoryRoot" })',
    '"data-sourceroot-root-switcher": ""',
    "historyroot-nav",
    "sr-historyroot-breadcrumbs"
)

try {
    $SourceRootHomeText = Read-Text "sourceroot.html"
    $UnifiedSearchText = Read-Text "sourceroot-search.html"
    $DictionaryNavigationText = Read-Text "assets/js/dictionaryroot-navigation.js"
    $HistoryNavigationText = Read-Text "assets/js/historyroot-shared.js"
    $LegacyRendered = (
        $SourceRootHomeText.Contains('<nav class="sr-root-nav"') -or
        $UnifiedSearchText.Contains('<nav class="sr-root-switcher"') -or
        $DictionaryNavigationText.Contains('class="sr-dr-root-switcher"') -or
        $HistoryNavigationText.Contains('className: "sr-hr-root-switcher"') -or
        $HistoryNavigationText.Contains('className: "historyroot-family-link"')
    )
    if (-not $LegacyRendered) {
        Pass "Legacy cross-Root UI removal" "No old strip or redundant Root pill is rendered."
    } else {
        Fail "Legacy cross-Root UI removal" "A legacy rendered marker remains."
    }
} catch {
    Fail "Legacy cross-Root UI removal" $_.Exception.Message
}

Contains-All "Contextual discovery preservation" "assets/js/dictionaryroot-concept.js" @(
    "Search this term in HistoryRoot",
    "does not prove that this DictionaryRoot sense was intended"
)
Contains-All "Reverse contextual discovery preservation" "assets/js/historyroot-record.js" @(
    "Compare possible meanings in DictionaryRoot",
    "does not establish what a historical speaker or source intended"
)

Run "Changed JavaScript syntax" "node" @(
    "--check", "assets/js/sourceroot-root-switcher.js"
)
Run "DictionaryRoot navigation syntax" "node" @(
    "--check", "assets/js/dictionaryroot-navigation.js"
)
Run "HistoryRoot shared-navigation syntax" "node" @(
    "--check", "assets/js/historyroot-shared.js"
)
Run "Focused shared-switcher frontend contract" "node" @(
    "--test", "verification/sourceroot-shared-root-switcher.test.cjs"
)
Run "Chunk 11 frontend preservation" "node" @(
    "--test", "verification/sourceroot-unified-search-navigation.test.cjs"
)
Run "DictionaryRoot frontend preservation" "node" @(
    "--test", "verification/dictionaryroot-core-lexical-corpus.test.cjs"
)
Run "HistoryRoot frontend preservation" "node" @(
    "--test", "verification/context-review-experience.test.cjs"
)

try {
    $Evidence = Read-Text "docs/build/SOURCEROOT-SHARED-ROOT-SWITCHER-BROWSER-EVIDENCE.md"
    $RequiredEvidence = @(
        "Desktop result: PASS",
        "Mobile result: PASS",
        "Outside click: PASS",
        "Escape and focus return: PASS",
        "Enter and Space: PASS",
        "Console errors: 0",
        "Attributable console warnings: 0",
        "Horizontal overflow: 0",
        "Quality blockers: 0"
    )
    $MissingEvidence = @($RequiredEvidence | Where-Object {
        $Evidence.IndexOf($_, [StringComparison]::Ordinal) -lt 0
    })
    if ($MissingEvidence.Count -eq 0) {
        Pass "Browser and quality evidence" "Desktop/mobile interaction, console, overflow, and quality markers exact."
    } else {
        Fail "Browser and quality evidence" "Missing: $($MissingEvidence -join ', ')"
    }
} catch {
    Fail "Browser and quality evidence" $_.Exception.Message
}

try {
    $Screenshots = @(
        "verification/sourceroot-root-switcher-dictionaryroot-desktop-closed.png",
        "verification/sourceroot-root-switcher-dictionaryroot-desktop-open.png",
        "verification/sourceroot-root-switcher-historyroot-desktop-closed.png",
        "verification/sourceroot-root-switcher-historyroot-desktop-open.png",
        "verification/sourceroot-root-switcher-mobile-open.png"
    )
    $MissingScreenshots = @($Screenshots | Where-Object {
        $Path = Join-Path $script:Root ($_ -replace "/", "\")
        -not (Test-Path -LiteralPath $Path -PathType Leaf) -or
        (Test-Path -LiteralPath $Path -PathType Leaf) -and (Get-Item -LiteralPath $Path).Length -eq 0
    })
    if ($MissingScreenshots.Count -eq 0) {
        Pass "Screenshot evidence" "Five non-empty current-stage screenshots."
    } else {
        Fail "Screenshot evidence" ($MissingScreenshots -join ", ")
    }
} catch {
    Fail "Screenshot evidence" $_.Exception.Message
}

try {
    $TrackedZips = @(& git -C $script:Root ls-files "*.zip")
    $UntrackedZips = @(& git -C $script:Root ls-files --others --exclude-standard "*.zip")
    if ($TrackedZips.Count -eq 0 -and $UntrackedZips.Count -eq 0) {
        Pass "Repository ZIP boundary" "No tracked or visible untracked ZIP."
    } else {
        Fail "Repository ZIP boundary" (($TrackedZips + $UntrackedZips) -join ", ")
    }
} catch {
    Fail "Repository ZIP boundary" $_.Exception.Message
}

try {
    $Index = @(& git -C $script:Root diff --cached --name-only)
    if ($Index.Count -eq 0) {
        Pass "Git mutation boundary" "HEAD unchanged; branch unchanged; index empty; no release tag created by this verifier."
    } else {
        Fail "Git mutation boundary" "Git index contains staged paths."
    }
} catch {
    Fail "Git mutation boundary" $_.Exception.Message
}

Write-Host ""
Write-Host "Shared Root switcher verifier summary" -ForegroundColor Cyan
Write-Host "Pass count:    $script:PassCount"
Write-Host "Warning count: $script:WarningCount"
Write-Host "Failure count: $script:FailureCount"

if ($script:FailureCount -gt 0 -or $script:WarningCount -gt 0) {
    Write-Host "Overall result: FAIL" -ForegroundColor Red
    exit 1
}

Write-Host "Overall result: PASS" -ForegroundColor Green
exit 0
