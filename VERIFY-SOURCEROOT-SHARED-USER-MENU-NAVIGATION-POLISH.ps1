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
            Pass $Name $RelativePath
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
$ExpectedHead = "8d889e9abc0f9fbb28415b011b0435ab720cee26"
$ExpectedBranch = "release/historyroot-alpha-integration-v1"
$ExpectedStage = "SOURCEROOT-SHARED-USER-MENU-NAVIGATION-POLISH-V1"
$RootSwitcherTag = "sourceroot-shared-root-switcher-navigation-polish-v1"
$RecommendedTag = "sourceroot-shared-user-menu-navigation-polish-v1"
$ExpectedAllowed = @(
    "assets/css/sourceroot-user-menu.css",
    "assets/js/dictionaryroot-navigation.js",
    "assets/js/historyroot-shared.js",
    "assets/js/sourceroot-root-switcher.js",
    "assets/js/sourceroot-user-menu.js",
    "docs/build/SOURCEROOT-SHARED-USER-MENU-BROWSER-EVIDENCE.md",
    "docs/build/SOURCEROOT-SHARED-USER-MENU-STATE.md",
    "docs/stages/active/CURRENT-STAGE.md",
    "docs/stages/completed/20260730-SOURCEROOT-SHARED-USER-MENU-NAVIGATION-POLISH-V1.md",
    "ROOT-MANIFEST.json",
    "sourceroot.html",
    "sourceroot-search.html",
    "verification/sourceroot-shared-user-menu.test.cjs",
    "verification/sourceroot-user-menu-dictionaryroot-desktop-closed.png",
    "verification/sourceroot-user-menu-dictionaryroot-desktop-open.png",
    "verification/sourceroot-user-menu-historyroot-desktop-open.png",
    "verification/sourceroot-user-menu-mobile-open.png",
    "verification/sourceroot-user-menu-sourceroot-desktop-open.png",
    "VERIFY-SOURCEROOT-SHARED-USER-MENU-NAVIGATION-POLISH.ps1"
)

Write-Host "SourceRoot Shared User Menu Navigation Polish v1 verifier" -ForegroundColor Cyan
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
    $TagType = (& git -C $script:Root cat-file -t $RootSwitcherTag).Trim()
    $LocalTag = (& git -C $script:Root rev-parse "$RootSwitcherTag^{}").Trim()
    $RemoteLine = @(& git -C $script:Root ls-remote origin "refs/tags/$RootSwitcherTag^{}")
    $RemoteTag = if ($LASTEXITCODE -eq 0 -and $RemoteLine.Count -eq 1) {
        ([string]$RemoteLine[0] -split "\s+")[0]
    } else {
        ""
    }
    if ($TagType -eq "tag" -and $LocalTag -eq $ExpectedHead -and $RemoteTag -eq $ExpectedHead) {
        Pass "Root-switcher release tag identity" "Local and remote annotated tag dereference to $ExpectedHead."
    } else {
        Fail "Root-switcher release tag identity" "type=$TagType local=$LocalTag remote=$RemoteTag"
    }
} catch {
    Fail "Root-switcher release tag identity" $_.Exception.Message
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
    $BackendDiff = $LASTEXITCODE
    $BackendUntracked = @(& git -C $script:Root ls-files --others --exclude-standard -- "backend")
    if ($BackendDiff -eq 0 -and $BackendUntracked.Count -eq 0) {
        Pass "Backend and database boundary" "No backend file changed."
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
        Pass "Corpus and dataset boundary" "DictionaryRoot and HistoryRoot bytes unchanged."
    } else {
        Fail "Corpus and dataset boundary" "A corpus or dataset path differs."
    }
} catch {
    Fail "Corpus and dataset boundary" $_.Exception.Message
}

try {
    $DictionaryZip = "C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-DictionaryRoot-Core-Lexical-Corpus-v1.zip"
    $HistoryZip = "C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1.zip"
    $DictionaryExact = (
        (Get-Item -LiteralPath $DictionaryZip).Length -eq 264507 -and
        (Hash $DictionaryZip) -eq "E7640A0337F084D1EFFCFDC3B340A3AD7611FBA6E089ED2078B0AFE97EEAD8C0"
    )
    $HistoryExact = (Hash $HistoryZip) -eq "D4E11DD28EECC46BEFA76E3E4805BB8CDB6F8C8EE57FA07C72BEB898DF409D29"
    if ($DictionaryExact -and $HistoryExact) {
        Pass "Accepted release ZIP identities" "DictionaryRoot bytes/hash and HistoryRoot hash exact."
    } else {
        Fail "Accepted release ZIP identities" "One accepted release ZIP differs."
    }
} catch {
    Fail "Accepted release ZIP identities" $_.Exception.Message
}

Contains-All "Shared user-menu registry" "assets/js/sourceroot-user-menu.js" @(
    'const REGISTRY = Object.freeze([',
    'id: "SourceRootSignIn"',
    'id: "SourceRootEditorial"',
    'id: "SourceRootWorkflow"',
    'id: "SourceRootAccount"',
    'canonicalUrl: "account-v1.html"',
    'canonicalUrl: "editorial-v2.html"',
    'canonicalUrl: "workflow-v1.html"',
    'authenticationEnforcedByComponent: false',
    'availabilityStatus: "available"',
    'currentFiles:',
    'order:',
    'group:'
)

Contains-All "Shared user-menu implementation" "assets/js/sourceroot-user-menu.js" @(
    'settings.triggerLabel || "Sign in"',
    'setAttribute("aria-expanded", "false")',
    'setAttribute("aria-controls", panelId)',
    'event.key === "Enter" || event.key === " "',
    'event.key === "Escape"',
    'trigger.focus()',
    '!mount.contains(event.target)',
    'const instances = new WeakMap()',
    'if (instances.has(mount)) return instances.get(mount)',
    'while (document.getElementById(id))',
    'document.createElement("nav")',
    'document.createElement("a")',
    'authState: "signed-out"'
)

Contains-All "Root-switcher coordination" "assets/js/sourceroot-root-switcher.js" @(
    'sourceroot:navigation-menu-open',
    'menu: "root-switcher"',
    'event.detail.owner !== mount) close(false)'
)

Contains-All "SourceRoot integration" "sourceroot.html" @(
    'data-sourceroot-user-menu',
    'assets/css/sourceroot-user-menu.css',
    'assets/js/sourceroot-user-menu.js',
    'data-current-root="SourceRoot"'
)

Contains-All "Unified-search integration" "sourceroot-search.html" @(
    'data-sourceroot-user-menu',
    'assets/css/sourceroot-user-menu.css',
    'assets/js/sourceroot-user-menu.js',
    'data-current-root="SourceRootSearch"'
)

Contains-All "DictionaryRoot integration" "assets/js/dictionaryroot-navigation.js" @(
    "initializeUserMenu",
    "SourceRootUserMenu.init",
    "data-sourceroot-user-menu",
    'data-current-root="DictionaryRoot"',
    "sr-dictionaryroot-breadcrumbs"
)

Contains-All "HistoryRoot integration" "assets/js/historyroot-shared.js" @(
    "initializeUserMenu",
    "SourceRootUserMenu.init",
    '"data-sourceroot-user-menu"',
    '"data-current-root": "HistoryRoot"',
    "sr-historyroot-breadcrumbs"
)

try {
    $DictionaryNavigation = Read-Text "assets/js/dictionaryroot-navigation.js"
    $NavMatch = [regex]::Match($DictionaryNavigation, 'const NAV_ITEMS = \[(?<items>[\s\S]*?)\n  \];')
    $Items = $NavMatch.Groups["items"].Value
    $PublicPresent = @("Home", "Concept", "Knowledge Sphere", "Sources", "History", "Coverage") |
        ForEach-Object { $Items.Contains("label: `"$($_)`"") }
    $WorkspaceAbsent = @("Editorial", "Workflow", "Account") |
        ForEach-Object { -not $Items.Contains("label: `"$($_)`"") }
    if ($NavMatch.Success -and ($PublicPresent -notcontains $false) -and ($WorkspaceAbsent -notcontains $false)) {
        Pass "DictionaryRoot public navigation boundary" "Six public items; no workspace tabs."
    } else {
        Fail "DictionaryRoot public navigation boundary" "Public or workspace item boundary differs."
    }
} catch {
    Fail "DictionaryRoot public navigation boundary" $_.Exception.Message
}

Contains-All "Contextual discovery preservation" "assets/js/dictionaryroot-concept.js" @(
    "Search this term in HistoryRoot",
    "does not prove that this DictionaryRoot sense was intended"
)
Contains-All "Reverse contextual discovery preservation" "assets/js/historyroot-record.js" @(
    "Compare possible meanings in DictionaryRoot",
    "does not establish what a historical speaker or source intended"
)

try {
    $Component = Read-Text "assets/js/sourceroot-user-menu.js"
    if ($Component -notmatch 'Sign out|signOut|logout|displayName|avatar|initials|signed-in' -and
        $Component -notmatch '/api/|fetch\(|XMLHttpRequest|WebSocket') {
        Pass "Authentication and backend boundary" "No fake signed-in state, Sign out, or backend dependency."
    } else {
        Fail "Authentication and backend boundary" "A forbidden auth or backend marker is present."
    }
} catch {
    Fail "Authentication and backend boundary" $_.Exception.Message
}

Run "User-menu JavaScript syntax" "node" @("--check", "assets/js/sourceroot-user-menu.js")
Run "Root-switcher JavaScript syntax" "node" @("--check", "assets/js/sourceroot-root-switcher.js")
Run "DictionaryRoot navigation syntax" "node" @("--check", "assets/js/dictionaryroot-navigation.js")
Run "HistoryRoot shared-navigation syntax" "node" @("--check", "assets/js/historyroot-shared.js")
Run "Focused shared user-menu contract" "node" @("--test", "verification/sourceroot-shared-user-menu.test.cjs")
Run "Focused Root-switcher preservation" "node" @("--test", "verification/sourceroot-shared-root-switcher.test.cjs")
Run "Chunk 11 and unified-search preservation" "node" @("--test", "verification/sourceroot-unified-search-navigation.test.cjs")
Run "DictionaryRoot frontend preservation" "node" @("--test", "verification/dictionaryroot-core-lexical-corpus.test.cjs")
Run "HistoryRoot frontend preservation" "node" @("--test", "verification/context-review-experience.test.cjs")

try {
    $Evidence = Read-Text "docs/build/SOURCEROOT-SHARED-USER-MENU-BROWSER-EVIDENCE.md"
    $RequiredEvidence = @(
        "Desktop result: PASS",
        "Mobile result: PASS",
        "Pointer click: PASS",
        "Enter and Space: PASS",
        "Outside click: PASS",
        "Escape and focus return: PASS",
        "Normal Tab navigation: PASS",
        "Console errors: 0",
        "Attributable console warnings: 0",
        "Horizontal overflow: 0",
        "Quality blockers: 0",
        "Unresolved review findings: 0"
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
        "verification/sourceroot-user-menu-dictionaryroot-desktop-closed.png",
        "verification/sourceroot-user-menu-dictionaryroot-desktop-open.png",
        "verification/sourceroot-user-menu-historyroot-desktop-open.png",
        "verification/sourceroot-user-menu-sourceroot-desktop-open.png",
        "verification/sourceroot-user-menu-mobile-open.png"
    )
    $MissingScreenshots = @($Screenshots | Where-Object {
        $Full = Join-Path $script:Root ($_ -replace "/", "\")
        -not (Test-Path -LiteralPath $Full -PathType Leaf) -or (Get-Item -LiteralPath $Full).Length -le 0
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
    $RepositoryZips = @(& git -C $script:Root ls-files -- "*.zip")
    $UntrackedZips = @(& git -C $script:Root ls-files --others --exclude-standard -- "*.zip")
    $IgnoredZips = @(& git -C $script:Root ls-files --others --ignored --exclude-standard -- "*.zip")
    if (($RepositoryZips.Count + $UntrackedZips.Count + $IgnoredZips.Count) -eq 0) {
        Pass "Repository ZIP boundary" "No tracked, untracked, or ignored ZIP."
    } else {
        Fail "Repository ZIP boundary" "A ZIP exists inside the repository."
    }
} catch {
    Fail "Repository ZIP boundary" $_.Exception.Message
}

try {
    $Index = @(& git -C $script:Root diff --cached --name-only)
    $RecommendedTagExists = @(& git -C $script:Root tag -l $RecommendedTag).Count
    $Head = (& git -C $script:Root rev-parse HEAD).Trim()
    $Branch = (& git -C $script:Root branch --show-current).Trim()
    if ($Index.Count -eq 0 -and $RecommendedTagExists -eq 0 -and
        $Head -eq $ExpectedHead -and $Branch -eq $ExpectedBranch) {
        Pass "Git mutation boundary" "HEAD and branch unchanged; index empty; recommended tag absent."
    } else {
        Fail "Git mutation boundary" "index=$($Index.Count) tag=$RecommendedTagExists head=$Head branch=$Branch"
    }
} catch {
    Fail "Git mutation boundary" $_.Exception.Message
}

Write-Host ""
Write-Host "Shared user-menu verifier summary" -ForegroundColor Cyan
Write-Host "Pass count:    $script:PassCount"
Write-Host "Warning count: $script:WarningCount"
Write-Host "Failure count: $script:FailureCount"

if ($script:FailureCount -eq 0 -and $script:WarningCount -eq 0) {
    Write-Host "Overall result: PASS" -ForegroundColor Green
    exit 0
}

Write-Host "Overall result: FAIL" -ForegroundColor Red
exit 1
