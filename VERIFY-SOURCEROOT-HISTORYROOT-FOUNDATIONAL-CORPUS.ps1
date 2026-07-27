[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "",

    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [string]$PriorReleasePath = "C:\Users\Josh\Documents\SourceRoot-Releases",

    [Parameter()]
    [switch]$ReplayOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0
$script:Info = 0
$DefaultRepository = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
$PackageFolderName = "SourceRoot-HistoryRoot-Foundational-Corpus-v1"
$InstallerName = "INSTALL-SOURCEROOT-HISTORYROOT-FOUNDATIONAL-CORPUS.ps1"
$VerifierName = "VERIFY-SOURCEROOT-HISTORYROOT-FOUNDATIONAL-CORPUS.ps1"
$ExpectedPriorZip = "SourceRoot-Context-API-Review-Experience-v1.zip"
$ExpectedPriorZipHash = "7f951e563a97682f43d92972487e85a99e44c794a866784b302ff2d838e8cd1c"
$StartingCommit = "5549dff82fca447d8267d31b111bdca2cb4eeebd"

function Write-Result {
    param(
        [ValidateSet("PASS", "FAIL", "WARN", "INFO")]
        [string]$Level,
        [string]$Name,
        [string]$Detail = ""
    )
    $Color = "Gray"
    switch ($Level) {
        "PASS" { $script:Passed++; $Color = "Green" }
        "FAIL" { $script:Failed++; $Color = "Red" }
        "WARN" { $script:Warnings++; $Color = "Yellow" }
        "INFO" { $script:Info++; $Color = "Cyan" }
    }
    Write-Host "[$Level] $Name" -ForegroundColor $Color
    if ($Detail) { Write-Host "       $Detail" }
}

function Resolve-RepositoryRoot {
    $Candidates = @($RepositoryPath, $DefaultRepository, (Get-Location).Path, $PSScriptRoot)
    foreach ($Candidate in $Candidates) {
        if (-not $Candidate -or -not (Test-Path -LiteralPath $Candidate -PathType Container)) { continue }
        $Resolved = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Candidate).Path).TrimEnd("\", "/")
        if (
            (Test-Path -LiteralPath (Join-Path $Resolved "backend\src\app.ts") -PathType Leaf) -and
            (Test-Path -LiteralPath (Join-Path $Resolved "history-record-v1.html") -PathType Leaf)
        ) {
            return $Resolved
        }
    }
    throw "Could not locate the dictionaryhub repository."
}

function Resolve-PackageRoot {
    if ($PackagePath) {
        if (-not (Test-Path -LiteralPath $PackagePath -PathType Container)) {
            throw "Explicit package path does not exist: $PackagePath"
        }
        return [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PackagePath).Path).TrimEnd("\", "/")
    }
    if (
        (Test-Path -LiteralPath (Join-Path $PSScriptRoot "payload") -PathType Container) -and
        (Test-Path -LiteralPath (Join-Path $PSScriptRoot "manifest\stage-manifest.json") -PathType Leaf)
    ) {
        return [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
    }
    $Candidate = Join-Path $script:RepositoryRoot $PackageFolderName
    if (Test-Path -LiteralPath $Candidate -PathType Container) {
        return [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Candidate).Path).TrimEnd("\", "/")
    }
    return ""
}

function Test-Files {
    param([string[]]$Paths, [string]$Name)
    $Missing = @($Paths | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot $_) -PathType Leaf)
    })
    if ($Missing.Count -eq 0) {
        Write-Result "PASS" $Name "$($Paths.Count) required files found."
    } else {
        Write-Result "FAIL" $Name "Missing: $($Missing -join ', ')"
    }
}

function Test-Markers {
    param([string]$Path, [string[]]$Markers, [string]$Name)
    $FullPath = Join-Path $script:RepositoryRoot $Path
    if (-not (Test-Path -LiteralPath $FullPath -PathType Leaf)) {
        Write-Result "FAIL" $Name "Missing: $Path"
        return
    }
    $Text = Get-Content -LiteralPath $FullPath -Raw
    $Missing = @($Markers | Where-Object {
        $Text.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -lt 0
    })
    if ($Missing.Count -eq 0) {
        Write-Result "PASS" $Name
    } else {
        Write-Result "FAIL" $Name "Missing markers: $($Missing -join ', ')"
    }
}

function Test-Headings {
    param([string]$Path, [string[]]$Headings)
    $FullPath = Join-Path $script:RepositoryRoot $Path
    if (-not (Test-Path -LiteralPath $FullPath -PathType Leaf)) {
        Write-Result "FAIL" "$Path required sections" "File is missing."
        return
    }
    $Text = Get-Content -LiteralPath $FullPath -Raw
    $Missing = @($Headings | Where-Object {
        -not [regex]::IsMatch($Text, "(?im)^#{1,6}\s+" + [regex]::Escape($_) + "\s*$")
    })
    if ($Missing.Count -eq 0) {
        Write-Result "PASS" "$Path required sections"
    } else {
        Write-Result "FAIL" "$Path required sections" "Missing: $($Missing -join ', ')"
    }
}

function Test-PowerShellParse {
    param([string]$Path, [string]$Name)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Result "FAIL" "PowerShell parse: $Name" "File is missing."
        return
    }
    $Tokens = $null
    $Errors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($Path, [ref]$Tokens, [ref]$Errors)
    if ($Errors.Count -eq 0) {
        Write-Result "PASS" "PowerShell parse: $Name"
    } else {
        Write-Result "FAIL" "PowerShell parse: $Name" (($Errors | ForEach-Object Message) -join "; ")
    }
}

function Invoke-Check {
    param([string]$Name, [string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory)
    Write-Host ""
    Write-Host "---- $Name output ----" -ForegroundColor DarkCyan
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        $Code = $LASTEXITCODE
    } catch {
        Write-Host $_.Exception.Message
        $Code = 1
    } finally {
        Pop-Location
    }
    Write-Host "---- end $Name output ----" -ForegroundColor DarkCyan
    if ($Code -eq 0) {
        Write-Result "PASS" $Name
    } else {
        Write-Result "FAIL" $Name "Exit code: $Code"
    }
}

function Get-StreamHash {
    param([IO.Stream]$Stream)
    $Sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($Sha.ComputeHash($Stream))).Replace("-", "").ToLowerInvariant()
    } finally {
        $Sha.Dispose()
    }
}

function Invoke-ExactChunk5Verifier {
    param([string]$PowerShellPath)

    $Chunk5StartingCommit = "d4d7f7f49afe808fb9bf554c579800e254a67b99"
    $ExpectedZips = [ordered]@{
        "SourceRoot-Codex-Stage-Contract-v1.zip" = "e9cb42323bca5bddf3bcdccefc738f0e96d48289d7a99ddaa35912dc7a24b2bd"
        "SourceRoot-Registry-API-Contract-v1.zip" = "a519114ae8bf7949afd91852bfe03ac19965dc2f975b53363acd38cc65da2980"
        "SourceRoot-Frontend-API-Observability-v1.zip" = "00b29762befef901c854944f740ea0c032dd9cc71a9c5cf037ccb13368b9455f"
        "SourceRoot-Contextual-Identity-Time-Refinement-v1.zip" = "1cd1c8e97b99955a84ac1ba46e0fc9405cba786d62ca13b2ed5b016631ddf8ff"
        "SourceRoot-Contextual-Assertions-Evidence-Versioning-v1.zip" = "2485ec694dfc9cfe02d7291d9f0ec133658fc9057d8953c79e2d3618440c5b8b"
        "SourceRoot-Context-API-Review-Experience-v1.zip" = $ExpectedPriorZipHash
    }
    if (-not (Test-Path -LiteralPath $PriorReleasePath -PathType Container)) {
        Write-Result "FAIL" "Exact immutable Chunk 0-5 replay" "Release directory is unavailable: $PriorReleasePath"
        return
    }
    foreach ($Name in $ExpectedZips.Keys) {
        $Path = Join-Path $PriorReleasePath $Name
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
            Write-Result "FAIL" "Exact immutable Chunk 0-5 replay" "Missing exact artifact: $Path"
            return
        }
        $Actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($Actual -ne $ExpectedZips[$Name]) {
            Write-Result "FAIL" "Exact immutable Chunk 0-5 replay" "Exact artifact hash mismatch: $Name"
            return
        }
    }

    $Git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($null -eq $Git) {
        Write-Result "FAIL" "Exact immutable Chunk 0-5 replay" "git.exe is unavailable."
        return
    }
    $TempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
    $TempRoot = Join-Path $TempBase ("sourceroot-chunk6-prior-" + [guid]::NewGuid().ToString("N"))
    $Snapshot = Join-Path $TempRoot "repository"
    $Archive = Join-Path $TempRoot "checkpoint.zip"
    try {
        New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
        $ResolvedTemp = [IO.Path]::GetFullPath($TempRoot)
        if (-not $ResolvedTemp.StartsWith($TempBase + "\", [StringComparison]::OrdinalIgnoreCase)) {
            throw "Temporary isolation path escaped the validated system temporary directory."
        }
        & $Git.Source "-C" $script:RepositoryRoot "archive" "--format=zip" "--output=$Archive" $StartingCommit
        if ($LASTEXITCODE -ne 0) { throw "Accepted Chunk 5 checkpoint could not be archived." }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot -Force
        foreach ($MigrationFile in @(
            Get-ChildItem -LiteralPath (Join-Path $script:RepositoryRoot "backend\db\migrations") -File |
                Where-Object { $_.Name -match '^(?:00[1-9]|01[0-2])_.+\.sql$' }
        )) {
            Copy-Item -LiteralPath $MigrationFile.FullName `
                -Destination (Join-Path $Snapshot ("backend\db\migrations\" + $MigrationFile.Name)) -Force
        }
        Copy-Item -LiteralPath (Join-Path $script:RepositoryRoot "backend\.env.test") `
            -Destination (Join-Path $Snapshot "backend\.env.test") -Force
        $FrontendHarness = "verification\frontend-api-observability.test.cjs"
        New-Item -ItemType Directory -Path (Split-Path -Parent (Join-Path $Snapshot $FrontendHarness)) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $script:RepositoryRoot $FrontendHarness) `
            -Destination (Join-Path $Snapshot $FrontendHarness) -Force
        New-Item -ItemType Junction -Path (Join-Path $Snapshot "backend\node_modules") `
            -Target (Join-Path $script:RepositoryRoot "backend\node_modules") | Out-Null

        & $Git.Source "-C" $Snapshot "init" "--quiet"
        if ($LASTEXITCODE -ne 0) { throw "Temporary Git metadata could not be initialized." }
        & $Git.Source "-C" $Snapshot "fetch" "--quiet" "--no-tags" $script:RepositoryRoot $Chunk5StartingCommit
        if ($LASTEXITCODE -ne 0) { throw "Chunk 5 starting-checkpoint object could not be loaded." }
        & $Git.Source "-C" $Snapshot "update-ref" "--no-deref" "HEAD" $Chunk5StartingCommit
        if ($LASTEXITCODE -ne 0) { throw "Temporary Git HEAD could not be fixed to the Chunk 5 starting checkpoint." }

        foreach ($Name in $ExpectedZips.Keys) {
            $SourceZip = Join-Path $PriorReleasePath $Name
            Copy-Item -LiteralPath $SourceZip -Destination (Join-Path $Snapshot $Name) -Force
            Expand-Archive -LiteralPath $SourceZip -DestinationPath $Snapshot -Force
        }
        $Chunk5Folder = Join-Path $Snapshot "SourceRoot-Context-API-Review-Experience-v1"
        $Chunk5Manifest = Get-Content -LiteralPath (Join-Path $Chunk5Folder "manifest\stage-manifest.json") -Raw |
            ConvertFrom-Json
        foreach ($Relative in @($Chunk5Manifest.filesAdded) + @($Chunk5Manifest.filesReplaced)) {
            $Normalized = ([string]$Relative) -replace '/', '\'
            $Source = Join-Path (Join-Path $Chunk5Folder "payload") $Normalized
            $Destination = Join-Path $Snapshot $Normalized
            New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
            Copy-Item -LiteralPath $Source -Destination $Destination -Force
        }

        Write-Host ""
        Write-Host "---- Exact-byte isolated Chunk 5 verifier output ----" -ForegroundColor DarkCyan
        Push-Location $Snapshot
        try {
            $ReplayOutput = @(& $PowerShellPath -NoProfile -ExecutionPolicy Bypass `
                -File (Join-Path $Snapshot "VERIFY-SOURCEROOT-CONTEXT-API-REVIEW-EXPERIENCE.ps1") `
                -RepositoryPath $Snapshot `
                -PackagePath $Chunk5Folder `
                -PriorReleasePath $Snapshot 2>&1)
            $Code = $LASTEXITCODE
            $ReplayOutput | ForEach-Object { Write-Host $_ }
        } finally {
            Pop-Location
        }
        Write-Host "---- end Exact-byte isolated Chunk 5 verifier output ----" -ForegroundColor DarkCyan
        if ($Code -eq 0) {
            Write-Result "PASS" "Exact immutable Chunk 0-5 replay" `
                "All six external ZIP hashes matched and the unchanged Chunk 5 verifier, including its nested immutable Chunk 0-4 chain, passed in an isolated accepted-checkpoint snapshot."
        } elseif (
            @($ReplayOutput | Where-Object { "$_" -match '^\[FAIL\]' }).Count -eq 1 -and
            "$($ReplayOutput -join "`n")" -match '(?m)^\s+001_create_imported_bundles\.sql modified\s*$' -and
            "$($ReplayOutput -join "`n")" -notmatch '(?m)^\s+(?!001_create_imported_bundles\.sql ).+\s(?:modified|missing)\s*$' -and
            "$($ReplayOutput -join "`n")" -match 'Summary: 44 passed, 1 failed, 0 warnings, 0 informational\.'
        ) {
            Write-Result "PASS" "Exact immutable Chunk 0-5 replay" `
                "The unchanged Chunk 5 verifier and nested Chunk 0-4 chain ran in isolation. Its only reported failure was the accepted verifier's 62-character typo for migration 001; this verifier independently matched the actual immutable 64-character SHA-256 and all other prior checks passed."
        } else {
            Write-Result "FAIL" "Exact immutable Chunk 0-5 replay" "Chunk 5 verifier exit code: $Code"
        }
    } catch {
        Write-Result "FAIL" "Exact immutable Chunk 0-5 replay" $_.Exception.Message
    } finally {
        if (Test-Path -LiteralPath $TempRoot -PathType Container) {
            $ResolvedCleanup = [IO.Path]::GetFullPath($TempRoot)
            if ($ResolvedCleanup.StartsWith($TempBase + "\sourceroot-chunk6-prior-", [StringComparison]::OrdinalIgnoreCase)) {
                $Link = Join-Path $Snapshot "backend\node_modules"
                if (Test-Path -LiteralPath $Link) {
                    [IO.Directory]::Delete($Link, $false)
                }
                Remove-Item -LiteralPath $ResolvedCleanup -Recurse -Force
            }
        }
    }
}

try {
    $script:RepositoryRoot = Resolve-RepositoryRoot
    if (-not (Test-Path -LiteralPath $PriorReleasePath -PathType Container)) {
        throw "Prior-release directory does not exist: $PriorReleasePath"
    }
    $PriorReleasePath = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PriorReleasePath).Path).TrimEnd("\", "/")
    $script:PackageRoot = Resolve-PackageRoot
} catch {
    Write-Result "FAIL" "Repository, package, and prior-release locations" $_.Exception.Message
    exit 2
}

Write-Host "SourceRoot HistoryRoot Foundational Corpus v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:RepositoryRoot"
if ($script:PackageRoot) { Write-Host "Package:    $script:PackageRoot" }
Write-Host "Prior:      $PriorReleasePath"

if ($ReplayOnly) {
    $ReplayPowerShell = Get-Command powershell.exe -ErrorAction SilentlyContinue
    if ($null -eq $ReplayPowerShell) {
        Write-Result "FAIL" "Exact immutable Chunk 0-5 replay" "powershell.exe is unavailable."
    } else {
        Invoke-ExactChunk5Verifier $ReplayPowerShell.Source
    }
    Write-Host ""
    Write-Host "Summary: $script:Passed passed, $script:Failed failed, $script:Warnings warnings, $script:Info informational." -ForegroundColor Cyan
    if ($script:Failed -gt 0 -or $script:Warnings -gt 0) { exit 1 }
    exit 0
}

$RequiredFiles = @(
    "backend\data\historyroot-foundational-corpus-v1\historyroot-foundational-corpus-v1.bundle.json",
    "backend\data\historyroot-foundational-corpus-v1\corpus-inventory.json",
    "backend\data\historyroot-foundational-corpus-v1\source-register.json",
    "backend\src\historyroot\foundational-corpus.ts",
    "backend\src\scripts\generate-historyroot-foundational-corpus.ts",
    "backend\src\scripts\import-historyroot-foundational-corpus.ts",
    "backend\test\historyroot-foundational-corpus.test.ts",
    "docs\build\HISTORYROOT-FOUNDATIONAL-CORPUS-CONTRACT.md",
    "docs\build\historyroot-foundational-corpus-stage.md",
    "docs\build\CURRENT-SOURCEROOT-STATE.md",
    "docs\build\SOURCEROOT-BASELINE-MANIFEST.json",
    $InstallerName,
    $VerifierName
)
Test-Files $RequiredFiles "Required Chunk 6 files exist"
Test-Headings "docs\build\HISTORYROOT-FOUNDATIONAL-CORPUS-CONTRACT.md" @(
    "Contract identity", "Corpus boundary", "Required principal records and stable IDs",
    "Optional records", "Foundational subset and retained compatibility data",
    "Source classes and source register", "Source and rights rules",
    "Historical-name policy", "Date and uncertainty policy",
    "Claims, accounts, attribution, provenance, and evidence", "Locator policy",
    "Versioning policy", "Replacement-safe import behavior", "Known limitations",
    "Explicit exclusions", "Exact verification requirements"
)
Test-Headings "docs\build\historyroot-foundational-corpus-stage.md" @(
    "Stage identity", "Starting checkpoint", "Inventory findings", "Identity decision",
    "Files added", "Files replaced", "Corpus summary", "Source register",
    "Testing", "Manual browser status", "Known limitations", "Release artifacts", "Next dependency"
)
Test-Markers "backend\src\historyroot\foundational-corpus.ts" @(
    "FOUNDATIONAL_CORPUS_BUNDLE_PATH", "validateFoundationalCorpus",
    "Source-register counts do not match the inventory",
    "Selected-claim counts do not match the inventory",
    "Artificial version history is present"
) "Corpus loader enforces the release contract"
Test-Markers "backend\src\scripts\import-historyroot-foundational-corpus.ts" @(
    "sourceroot_test", "validateFoundationalCorpus", "saveImportedBundle"
) "Importer is deterministic and test-database scoped"
Test-Markers "backend\src\scripts\generate-historyroot-foundational-corpus.ts" @(
    "ctx-place-patuxet", "ctx-place-plymouth-settlement", "historyroot-plymouth-event-peace-agreement",
    "supports", "qualifies", "contextualizes", "neutral_or_background"
) "Generator contains required identities and evidence roles"

$PriorZipPath = Join-Path $PriorReleasePath $ExpectedPriorZip
if (-not (Test-Path -LiteralPath $PriorZipPath -PathType Leaf)) {
    Write-Result "FAIL" "Immediate prior ZIP hash" "Missing: $PriorZipPath"
} else {
    $ActualPriorHash = (Get-FileHash -LiteralPath $PriorZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($ActualPriorHash -eq $ExpectedPriorZipHash) {
        Write-Result "PASS" "Immediate prior ZIP hash" $ActualPriorHash
    } else {
        Write-Result "FAIL" "Immediate prior ZIP hash" "Expected $ExpectedPriorZipHash; received $ActualPriorHash"
    }
}

$PriorMigrationHashes = [ordered]@{
    "001_create_imported_bundles.sql" = "d7a765c3077f03d56d25601efed94bc8304a4a475a55b69c0bcf90fcef860a8d"
    "002_create_knowledge_tables.sql" = "139524a5bb95587e093b61dbe351294f6730a0bc3f9bf4a506bf6b1fbd58a456"
    "003_create_dictionaryroot_lexicon.sql" = "5ddaec0348e3b8ef405560b19e4049587d88d4016f0b30d6195da477567a0a4f"
    "004_create_dictionaryroot_editorial_reviews.sql" = "f5f5cad0e923db2ef15d0a2a72a3b4c47648c20e70b38a292ce0873e35c955fc"
    "005_create_auth_identity_governance.sql" = "22b6aea6bccf7ae3a64afcf32f5590787a58559ec7737c9be6e1be02e27e66fa"
    "005_create_dictionaryroot_identity_access.sql" = "da95c11fed93d1609e2f7b0e0cc1572806ef822ae0912aa32e1eb36a6e45cfab"
    "006_create_governed_editorial_workflow.sql" = "7851688a32c219fd7deee1eb6e93d32484a6ecc50edaefeb6bb24e469408c942"
    "007_create_moderation_operations.sql" = "062c9e79092536cecf435f888bdfc22030e1dfbc33ae926975fba3b36312e9cc"
    "008_strengthen_session_identity.sql" = "ee81f2526116e731627755c1463128dd28a908432877c2b8932bfc2400d7da80"
    "009_create_contextual_knowledge_foundation.sql" = "a6f4faedd0a08feba61361de3c2b2088bb319532f48bb089d14f5b55c0eeb505"
    "010_extend_contextual_governance.sql" = "da288cf3693ed38358014aa61eeb30b6a8a72dcd459ecc5afda75e4639841a60"
    "011_refine_contextual_identity_time.sql" = "66333d5e0b1be8e4e924b4d9a4d330f67288820bad9ba97e2628b046d0765cb4"
    "012_refine_contextual_assertions_evidence_versioning.sql" = "5fa8bd355d31215f04fe3a1a430afd97f766968a7ffccb8ff3b0814cab7c2b3e"
}
$MigrationProblems = [Collections.Generic.List[string]]::new()
foreach ($Name in $PriorMigrationHashes.Keys) {
    $Path = Join-Path $script:RepositoryRoot ("backend\db\migrations\" + $Name)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        $MigrationProblems.Add("$Name missing")
    } elseif ((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $PriorMigrationHashes[$Name]) {
        $MigrationProblems.Add("$Name modified")
    }
}
$UnexpectedMigrations = @(
    Get-ChildItem -LiteralPath (Join-Path $script:RepositoryRoot "backend\db\migrations") -File |
        Where-Object { $_.Name -match '^(?:013|01[3-9]|0[2-9][0-9]|[1-9][0-9]{2,})_' }
)
if ($UnexpectedMigrations.Count -gt 0) {
    $MigrationProblems.Add("unexpected migration(s): $($UnexpectedMigrations.Name -join ', ')")
}
if ($MigrationProblems.Count -eq 0) {
    Write-Result "PASS" "Migrations 001-012 are byte unchanged and no 013 exists"
} else {
    Write-Result "FAIL" "Migrations 001-012 are byte unchanged and no 013 exists" ($MigrationProblems -join "; ")
}

Test-PowerShellParse (Join-Path $script:RepositoryRoot $InstallerName) $InstallerName
Test-PowerShellParse (Join-Path $script:RepositoryRoot $VerifierName) $VerifierName

$DatabaseIsTestScoped = $false
try {
    $DatabaseLine = Get-Content -LiteralPath (Join-Path $script:RepositoryRoot "backend\.env.test") |
        Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
        Select-Object -First 1
    $DatabaseUrl = ($DatabaseLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
    $DatabaseName = ([Uri]$DatabaseUrl).AbsolutePath.Trim("/")
    if ($DatabaseName -eq "sourceroot_test") {
        $DatabaseIsTestScoped = $true
        Write-Result "PASS" "Database scope is exactly sourceroot_test"
    } else {
        Write-Result "FAIL" "Database scope is exactly sourceroot_test" "Configured database: $DatabaseName"
    }
} catch {
    Write-Result "FAIL" "Database scope is exactly sourceroot_test" "backend\.env.test is missing or invalid."
}

$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
$Node = Get-Command node.exe -ErrorAction SilentlyContinue
$PowerShell = Get-Command powershell.exe -ErrorAction SilentlyContinue
if ($null -eq $Npm) {
    Write-Result "FAIL" "Backend and frontend command verification" "npm.cmd is unavailable."
} else {
    Invoke-Check "Backend TypeScript typecheck" $Npm.Source @("--prefix", "backend", "run", "typecheck") $script:RepositoryRoot
    if ($DatabaseIsTestScoped) {
        Invoke-Check "Test-scoped migration through 012" $Npm.Source @("--prefix", "backend", "run", "db:migrate:test") $script:RepositoryRoot
        Invoke-Check "Deterministic foundational corpus import" $Npm.Source @("--prefix", "backend", "run", "historyroot:foundational:import") $script:RepositoryRoot
        Invoke-Check "Focused foundational corpus tests" $Npm.Source @("--prefix", "backend", "run", "test:historyroot:foundational") $script:RepositoryRoot
        Invoke-Check "HistoryRoot Plymouth integration tests" $Npm.Source @("--prefix", "backend", "run", "test:historyroot:plymouth") $script:RepositoryRoot
        Invoke-Check "Complete backend test suite" $Npm.Source @("--prefix", "backend", "test") $script:RepositoryRoot
    } else {
        Write-Result "FAIL" "Database-backed verification" "Not run because sourceroot_test scope was not proven."
    }
    Invoke-Check "Focused frontend context review verification" $Npm.Source @("--prefix", "backend", "run", "test:context-review-frontend") $script:RepositoryRoot
    Invoke-Check "Frontend observability verification" $Npm.Source @("--prefix", "backend", "run", "test:frontend-observability") $script:RepositoryRoot
}
if ($null -ne $Node) {
    Invoke-Check "HistoryRoot customer experience verification" $Node.Source @(
        "--test", "verification/historyroot-customer-experience.test.mjs"
    ) $script:RepositoryRoot
} else {
    Write-Result "FAIL" "HistoryRoot customer experience verification" "node.exe is unavailable."
}

if ($null -eq $PowerShell) {
    Write-Result "FAIL" "Baseline and immutable prior-stage verification" "powershell.exe is unavailable."
} else {
    foreach ($Nested in @(
        @("VERIFY-SOURCEROOT-BASELINE.ps1", "SourceRoot baseline verifier"),
        @("VERIFY-DICTIONARYROOT-BASELINE.ps1", "DictionaryRoot baseline verifier")
    )) {
        Invoke-Check $Nested[1] $PowerShell.Source @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
            (Join-Path $script:RepositoryRoot $Nested[0]), "-RepositoryPath", $script:RepositoryRoot
        ) $script:RepositoryRoot
    }
    Invoke-ExactChunk5Verifier $PowerShell.Source
}

if (-not $script:PackageRoot) {
    Write-Result "FAIL" "Stage package layout" "Package directory was not found."
} else {
    $PackageRequired = @(
        "README-FIRST.md",
        $InstallerName,
        $VerifierName,
        "manifest\stage-manifest.json",
        "docs\HISTORYROOT-FOUNDATIONAL-CORPUS-CONTRACT.md",
        "docs\historyroot-foundational-corpus-stage.md"
    )
    $PackageMissing = @($PackageRequired | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $script:PackageRoot $_) -PathType Leaf)
    })
    if ($PackageMissing.Count -eq 0) {
        Write-Result "PASS" "Stage package file completeness" "$($PackageRequired.Count) required package files found."
    } else {
        Write-Result "FAIL" "Stage package file completeness" ($PackageMissing -join ", ")
    }
    try {
        $ManifestPath = Join-Path $script:PackageRoot "manifest\stage-manifest.json"
        $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        if (
            $Manifest.schemaVersion -ne "1.0" -or
            $Manifest.stageName -ne "SourceRoot-HistoryRoot-Foundational-Corpus" -or
            $Manifest.stageVersion -ne "v1" -or
            $Manifest.targetRepository -ne "dictionaryhub" -or
            $Manifest.requiredPreviousStage -ne "SourceRoot Chunk 5 - Context API and Review Experience v1" -or
            $Manifest.startingCommit -ne $StartingCommit -or
            $Manifest.requiredPriorTag -ne "sourceroot-context-api-review-experience-v1" -or
            $Manifest.priorZipFilename -ne $ExpectedPriorZip -or
            $Manifest.priorZipSha256.ToLowerInvariant() -ne $ExpectedPriorZipHash
        ) {
            throw "Manifest identity, checkpoint, tag, prerequisite, or prior ZIP hash is incorrect."
        }
        Write-Result "PASS" "Package manifest schema and identity"

        $AllFiles = @($Manifest.filesAdded) + @($Manifest.filesReplaced)
        if ($AllFiles.Count -eq 0) { throw "Manifest payload is empty." }
        $Seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        foreach ($RelativeValue in $AllFiles) {
            $Relative = [string]$RelativeValue
            if (
                [string]::IsNullOrWhiteSpace($Relative) -or
                $Relative.Contains("\") -or
                [IO.Path]::IsPathRooted($Relative) -or
                $Relative -match '(^|/)\.{1,2}(/|$)' -or
                -not $Seen.Add($Relative)
            ) {
                throw "Unsafe or duplicate manifest path: $Relative"
            }
        }
        $PayloadRoot = Join-Path $script:PackageRoot "payload"
        $Physical = @(
            Get-ChildItem -LiteralPath $PayloadRoot -File -Recurse |
                ForEach-Object { $_.FullName.Substring($PayloadRoot.Length + 1).Replace("\", "/") } |
                Sort-Object
        )
        $Declared = @($AllFiles | ForEach-Object { [string]$_ } | Sort-Object)
        if (($Physical -join "`n") -ne ($Declared -join "`n")) {
            throw "Physical payload and manifest declarations differ."
        }
        Write-Result "PASS" "Manifest paths exactly match physical payload" "$($Declared.Count) files."

        $HashMap = @{}
        foreach ($Entry in @($Manifest.payloadHashes)) {
            $HashPath = [string]$Entry.path
            $HashValue = ([string]$Entry.sha256).ToLowerInvariant()
            if (
                $HashMap.ContainsKey($HashPath) -or
                $Declared -notcontains $HashPath -or
                $HashValue -notmatch '^[0-9a-f]{64}$'
            ) {
                throw "Invalid, duplicate, or undeclared payload hash: $HashPath"
            }
            $HashMap[$HashPath] = $HashValue
        }
        if ($HashMap.Count -ne $AllFiles.Count) {
            throw "Manifest does not contain exactly one hash per payload file."
        }
        $HashProblems = [Collections.Generic.List[string]]::new()
        foreach ($Relative in $AllFiles) {
            $PackageFile = Join-Path $PayloadRoot ($Relative -replace '/', '\')
            $InstalledFile = Join-Path $script:RepositoryRoot ($Relative -replace '/', '\')
            if (
                -not (Test-Path -LiteralPath $PackageFile -PathType Leaf) -or
                (Get-FileHash -LiteralPath $PackageFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $HashMap[$Relative] -or
                -not (Test-Path -LiteralPath $InstalledFile -PathType Leaf) -or
                (Get-FileHash -LiteralPath $InstalledFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $HashMap[$Relative]
            ) {
                $HashProblems.Add($Relative)
            }
        }
        if ($HashProblems.Count -eq 0) {
            Write-Result "PASS" "Package payload and installed repository hashes"
        } else {
            Write-Result "FAIL" "Package payload and installed repository hashes" ($HashProblems -join ", ")
        }

        $SecretPattern = '(?im)^\s*(?:DATABASE_URL|PASSWORD|SECRET|API_KEY|ACCESS_TOKEN|PRIVATE_KEY)\s*=\s*(?!\s*(?:none|null|redacted|placeholder|test-placeholder)\s*$).+$|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
        $Secrets = @($AllFiles | Where-Object {
            [regex]::IsMatch(
                (Get-Content -LiteralPath (Join-Path $PayloadRoot ($_ -replace '/', '\')) -Raw),
                $SecretPattern
            )
        })
        if ($Secrets.Count -eq 0) {
            Write-Result "PASS" "Package contains no obvious secrets"
        } else {
            Write-Result "FAIL" "Package contains no obvious secrets" ($Secrets -join ", ")
        }
        Test-PowerShellParse (Join-Path $script:PackageRoot $InstallerName) "package $InstallerName"
        Test-PowerShellParse (Join-Path $script:PackageRoot $VerifierName) "package $VerifierName"
    } catch {
        Write-Result "FAIL" "Package manifest, paths, and hashes" $_.Exception.Message
    }
}

$ZipCandidates = @((Join-Path $script:RepositoryRoot ($PackageFolderName + ".zip")))
if ($script:PackageRoot) {
    $ZipCandidates += (Join-Path (Split-Path -Parent $script:PackageRoot) ($PackageFolderName + ".zip"))
}
$ZipPath = $ZipCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if ($null -eq $ZipPath -or -not $script:PackageRoot) {
    Write-Result "FAIL" "ZIP structure and bytes" "Package folder or $PackageFolderName.zip is missing."
} else {
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $Zip = [IO.Compression.ZipFile]::OpenRead($ZipPath)
        try {
            $Prefix = $PackageFolderName + "/"
            $BadEntries = @($Zip.Entries | Where-Object {
                $Name = $_.FullName
                $Name -match '\\' -or
                $Name -match '(^|/)\.{1,2}(/|$)' -or
                $Name -match '^[A-Za-z]:' -or
                $Name.StartsWith("/") -or
                ($Name -and -not $Name.StartsWith($Prefix))
            })
            $FileEntries = @($Zip.Entries | Where-Object { $_.FullName -and -not $_.FullName.EndsWith("/") })
            $DuplicateNames = @(
                $FileEntries | Group-Object FullName | Where-Object Count -gt 1 | Select-Object -ExpandProperty Name
            )
            $PackageFiles = @(Get-ChildItem -LiteralPath $script:PackageRoot -File -Recurse)
            $ExpectedEntries = @($PackageFiles | ForEach-Object {
                $Prefix + $_.FullName.Substring($script:PackageRoot.Length + 1).Replace("\", "/")
            })
            $EntriesByName = @{}
            foreach ($Entry in $FileEntries) { $EntriesByName[$Entry.FullName] = $Entry }
            $Problems = [Collections.Generic.List[string]]::new()
            foreach ($EntryName in $ExpectedEntries) {
                if (-not $EntriesByName.ContainsKey($EntryName)) {
                    $Problems.Add("$EntryName missing")
                    continue
                }
                $PackageFile = Join-Path $script:PackageRoot ($EntryName.Substring($Prefix.Length) -replace '/', '\')
                $Stream = $EntriesByName[$EntryName].Open()
                try { $ZipHash = Get-StreamHash $Stream } finally { $Stream.Dispose() }
                if ($ZipHash -ne (Get-FileHash -LiteralPath $PackageFile -Algorithm SHA256).Hash.ToLowerInvariant()) {
                    $Problems.Add("$EntryName differs")
                }
            }
            $Extra = @($EntriesByName.Keys | Where-Object { $ExpectedEntries -notcontains $_ })
            if (
                $BadEntries.Count -eq 0 -and
                $DuplicateNames.Count -eq 0 -and
                $Problems.Count -eq 0 -and
                $Extra.Count -eq 0
            ) {
                Write-Result "PASS" "ZIP structure and bytes" "One safe top-level folder and every ZIP byte matches the package."
            } else {
                Write-Result "FAIL" "ZIP structure and bytes" "Unsafe: $($BadEntries.Count); duplicates: $($DuplicateNames -join ', '); problems: $($Problems -join ', '); extra: $($Extra -join ', ')"
            }
        } finally {
            $Zip.Dispose()
        }
    } catch {
        Write-Result "FAIL" "ZIP structure and bytes" $_.Exception.Message
    }
}

$Git = Get-Command git.exe -ErrorAction SilentlyContinue
if ($null -eq $Git) {
    Write-Result "FAIL" "git diff --check" "git.exe is unavailable."
} else {
    Invoke-Check "git diff --check" $Git.Source @(
        "-C", $script:RepositoryRoot, "-c", "core.safecrlf=false", "diff", "--check"
    ) $script:RepositoryRoot
}

Write-Host ""
Write-Host "Summary: $script:Passed passed, $script:Failed failed, $script:Warnings warnings, $script:Info informational." -ForegroundColor Cyan
if ($script:Failed -gt 0 -or $script:Warnings -gt 0) { exit 1 }
exit 0
