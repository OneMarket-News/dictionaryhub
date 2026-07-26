[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "",

    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [string]$PriorReleasePath = "C:\Users\Josh\Documents\SourceRoot-Releases"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0
$script:Info = 0
$DefaultRepository = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
$PackageFolderName = "SourceRoot-Contextual-Assertions-Evidence-Versioning-v1"
$InstallerName = "INSTALL-SOURCEROOT-CONTEXTUAL-ASSERTIONS-EVIDENCE-VERSIONING.ps1"
$VerifierName = "VERIFY-SOURCEROOT-CONTEXTUAL-ASSERTIONS-EVIDENCE-VERSIONING.ps1"

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
            (Test-Path -LiteralPath (Join-Path $Resolved "index.html") -PathType Leaf)
        ) {
            return $Resolved
        }
    }
    throw "Could not locate the dictionaryhub repository."
}

function Resolve-PackageRoot {
    if ($PackagePath -and (Test-Path -LiteralPath $PackagePath -PathType Container)) {
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
        Write-Result "FAIL" $Name "Missing file: $Path"
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
    $Text = Get-Content -LiteralPath (Join-Path $script:RepositoryRoot $Path) -Raw
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

function Invoke-ExactChunk3Verifier {
    param([string]$PowerShellPath)

    $Chunk3StartingCommit = "ef8cd09f6ef97458f1751612a86c2f4314885775"
    $ExpectedZips = [ordered]@{
        "SourceRoot-Codex-Stage-Contract-v1.zip" = "e9cb42323bca5bddf3bcdccefc738f0e96d48289d7a99ddaa35912dc7a24b2bd"
        "SourceRoot-Registry-API-Contract-v1.zip" = "a519114ae8bf7949afd91852bfe03ac19965dc2f975b53363acd38cc65da2980"
        "SourceRoot-Frontend-API-Observability-v1.zip" = "00b29762befef901c854944f740ea0c032dd9cc71a9c5cf037ccb13368b9455f"
        "SourceRoot-Contextual-Identity-Time-Refinement-v1.zip" = "1cd1c8e97b99955a84ac1ba46e0fc9405cba786d62ca13b2ed5b016631ddf8ff"
    }
    if (-not (Test-Path -LiteralPath $PriorReleasePath -PathType Container)) {
        Write-Result "FAIL" "Exact immutable Chunk 0-3 package verification" "Release directory is unavailable: $PriorReleasePath"
        return
    }
    foreach ($Name in $ExpectedZips.Keys) {
        $Path = Join-Path $PriorReleasePath $Name
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
            Write-Result "FAIL" "Exact immutable Chunk 0-3 package verification" "Missing exact artifact: $Path"
            return
        }
        $Actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($Actual -ne $ExpectedZips[$Name]) {
            Write-Result "FAIL" "Exact immutable Chunk 0-3 package verification" "Exact artifact hash mismatch: $Name"
            return
        }
    }
    $Chunk3Folder = Join-Path $PriorReleasePath "SourceRoot-Contextual-Identity-Time-Refinement-v1"
    if (-not (Test-Path -LiteralPath (Join-Path $Chunk3Folder "manifest\stage-manifest.json") -PathType Leaf)) {
        Write-Result "FAIL" "Exact immutable Chunk 0-3 package verification" "Expanded exact Chunk 3 package is unavailable."
        return
    }

    $Git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($null -eq $Git) {
        Write-Result "FAIL" "Exact immutable Chunk 0-3 package verification" "git.exe is unavailable."
        return
    }
    $TempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
    $TempRoot = Join-Path $TempBase ("sourceroot-chunk4-prior-" + [guid]::NewGuid().ToString("N"))
    $Snapshot = Join-Path $TempRoot "repository"
    $Archive = Join-Path $TempRoot "checkpoint.zip"
    try {
        New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
        $ResolvedTemp = [IO.Path]::GetFullPath($TempRoot)
        if (-not $ResolvedTemp.StartsWith($TempBase + "\", [StringComparison]::OrdinalIgnoreCase)) {
            throw "Temporary isolation path escaped the validated system temporary directory."
        }
        & $Git.Source "-C" $script:RepositoryRoot "archive" "--format=zip" "--output=$Archive" "HEAD"
        if ($LASTEXITCODE -ne 0) { throw "Checkpoint extraction base could not be created." }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot -Force
        foreach ($MigrationName in $PriorMigrationHashes.Keys) {
            Copy-Item -LiteralPath (
                Join-Path $script:RepositoryRoot ("backend\db\migrations\" + $MigrationName)
            ) -Destination (
                Join-Path $Snapshot ("backend\db\migrations\" + $MigrationName)
            ) -Force
        }

        Copy-Item -LiteralPath (Join-Path $script:RepositoryRoot "backend\.env.test") `
            -Destination (Join-Path $Snapshot "backend\.env.test") -Force
        $FrontendHarness = "verification\frontend-api-observability.test.cjs"
        $FrontendHarnessSource = Join-Path $script:RepositoryRoot $FrontendHarness
        if (-not (Test-Path -LiteralPath $FrontendHarnessSource -PathType Leaf)) {
            throw "The prior-stage auxiliary frontend verification harness is unavailable: $FrontendHarnessSource"
        }
        New-Item -ItemType Directory -Path (Split-Path -Parent (Join-Path $Snapshot $FrontendHarness)) -Force | Out-Null
        Copy-Item -LiteralPath $FrontendHarnessSource -Destination (Join-Path $Snapshot $FrontendHarness) -Force
        $SnapshotModules = Join-Path $Snapshot "backend\node_modules"
        New-Item -ItemType Junction -Path $SnapshotModules `
            -Target (Join-Path $script:RepositoryRoot "backend\node_modules") | Out-Null
        & $Git.Source "-C" $Snapshot "init" "--quiet"
        if ($LASTEXITCODE -ne 0) { throw "Temporary Git metadata could not be initialized." }
        & $Git.Source "-C" $Snapshot "fetch" "--quiet" "--no-tags" `
            $script:RepositoryRoot $Chunk3StartingCommit
        if ($LASTEXITCODE -ne 0) { throw "Chunk 3 starting-checkpoint objects could not be loaded." }
        & $Git.Source "-C" $Snapshot "update-ref" "--no-deref" "HEAD" $Chunk3StartingCommit
        if ($LASTEXITCODE -ne 0) { throw "Temporary Git HEAD could not be fixed to the Chunk 3 starting checkpoint." }

        $Chunk3Manifest = Get-Content -LiteralPath (Join-Path $Chunk3Folder "manifest\stage-manifest.json") -Raw |
            ConvertFrom-Json
        foreach ($Relative in @($Chunk3Manifest.filesAdded) + @($Chunk3Manifest.filesReplaced)) {
            $Normalized = $Relative -replace '/', '\'
            $Source = Join-Path (Join-Path $Chunk3Folder "payload") $Normalized
            $Destination = Join-Path $Snapshot $Normalized
            New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
            Copy-Item -LiteralPath $Source -Destination $Destination -Force
        }

        foreach ($Name in $ExpectedZips.Keys) {
            Copy-Item -LiteralPath (Join-Path $PriorReleasePath $Name) -Destination (Join-Path $Snapshot $Name) -Force
        }
        foreach ($PriorZipName in @(
            "SourceRoot-Codex-Stage-Contract-v1.zip",
            "SourceRoot-Registry-API-Contract-v1.zip",
            "SourceRoot-Frontend-API-Observability-v1.zip"
        )) {
            Expand-Archive -LiteralPath (Join-Path $PriorReleasePath $PriorZipName) -DestinationPath $Snapshot -Force
        }
        Copy-Item -LiteralPath $Chunk3Folder -Destination $Snapshot -Recurse -Force

        Write-Host ""
        Write-Host "---- Exact-byte isolated Chunk 3 verifier output ----" -ForegroundColor DarkCyan
        Push-Location $Snapshot
        try {
            & $PowerShellPath -NoProfile -ExecutionPolicy Bypass `
                -File (Join-Path $Snapshot "VERIFY-SOURCEROOT-CONTEXTUAL-IDENTITY-TIME.ps1") `
                -RepositoryPath $Snapshot `
                -PackagePath (Join-Path $Snapshot "SourceRoot-Contextual-Identity-Time-Refinement-v1") `
                -PriorReleasePath $Snapshot
            $Code = $LASTEXITCODE
        } finally {
            Pop-Location
        }
        Write-Host "---- end Exact-byte isolated Chunk 3 verifier output ----" -ForegroundColor DarkCyan
        if ($Code -eq 0) {
            Write-Result "PASS" "Exact immutable Chunk 0-3 package verification" `
                "Exact external ZIP bytes were hash-verified; exact Chunk 3 payload bytes were overlaid into an isolated starting-checkpoint snapshot. The ignored frontend test harness was copied byte-for-byte as a non-package test input. Chunk 3 and its nested Chunk 0-2 checks passed."
        } else {
            Write-Result "FAIL" "Exact immutable Chunk 0-3 package verification" "Chunk 3 verifier exit code: $Code"
        }
    } catch {
        Write-Result "FAIL" "Exact immutable Chunk 0-3 package verification" $_.Exception.Message
    } finally {
        if (Test-Path -LiteralPath $TempRoot -PathType Container) {
            $ResolvedCleanup = [IO.Path]::GetFullPath($TempRoot)
            if ($ResolvedCleanup.StartsWith($TempBase + "\sourceroot-chunk4-prior-", [StringComparison]::OrdinalIgnoreCase)) {
                foreach ($Link in @(
                    (Join-Path $Snapshot "backend\node_modules")
                )) {
                    if (Test-Path -LiteralPath $Link) {
                        [IO.Directory]::Delete($Link, $false)
                    }
                }
                Remove-Item -LiteralPath $ResolvedCleanup -Recurse -Force
            }
        }
    }
}

try {
    $script:RepositoryRoot = Resolve-RepositoryRoot
} catch {
    Write-Result "FAIL" "Repository location" $_.Exception.Message
    exit 2
}
$script:PackageRoot = Resolve-PackageRoot

Write-Host "SourceRoot Contextual Assertions, Evidence, and Versioning v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:RepositoryRoot"
if ($script:PackageRoot) { Write-Host "Package:    $script:PackageRoot" }
Write-Result "INFO" "Static checks" "Files, contracts, migration integrity, syntax, package bytes, exclusions, and secrets."
Write-Result "INFO" "Test-database checks" "Only backend\.env.test is used, after the database name is exactly sourceroot_test."
Write-Result "INFO" "In-process API checks" "Supertest exercises Express without a separately running server."
Write-Result "INFO" "Independent live API checks" "Not performed."
Write-Result "INFO" "Browser checks" "Not performed; no frontend file is changed by this stage."

$RequiredFiles = @(
    "backend\package.json",
    "backend\db\migrations\012_refine_contextual_assertions_evidence_versioning.sql",
    "backend\src\contextual-types.ts",
    "backend\src\observers\data-quality-provenance-observer.ts",
    "backend\src\observers\platform-operations-observer.ts",
    "backend\src\routes\context.ts",
    "backend\src\routes\import.ts",
    "backend\src\routes\search.ts",
    "backend\src\services\contextual-schemas.ts",
    "backend\src\services\context-import-store.ts",
    "backend\src\services\context-store.ts",
    "backend\src\services\contextual-governance.ts",
    "backend\src\services\context-version-store.ts",
    "backend\src\services\import-store.ts",
    "backend\src\services\search-store.ts",
    "backend\src\services\workflow-store.ts",
    "backend\test\contextual-assertions-evidence-versioning.test.ts",
    "backend\test\helpers\database.ts",
    "docs\build\CONTEXTUAL-ASSERTIONS-EVIDENCE-VERSIONING-CONTRACT.md",
    "docs\build\contextual-assertions-evidence-versioning-stage.md",
    "docs\build\CURRENT-SOURCEROOT-STATE.md",
    "docs\build\SOURCEROOT-BASELINE-MANIFEST.json",
    $InstallerName,
    $VerifierName
)
Test-Files $RequiredFiles "Required Chunk 4 files exist"

Test-Headings "docs\build\CONTEXTUAL-ASSERTIONS-EVIDENCE-VERSIONING-CONTRACT.md" @(
    "Contract identity", "Semantic boundaries", "Compatibility",
    "Claim attribution", "Claim relationships", "Evidence-to-claim links",
    "Source locators", "Immutable claim versions",
    "Immutable evidence versions",
    "Correction, supersession, retraction, and current state",
    "Existing revisions and governance", "Import and replacement retention",
    "Read API", "Search", "Field-level provenance", "Level 1 observers",
    "Migration", "Examples", "Known limits"
)
Test-Headings "docs\build\contextual-assertions-evidence-versioning-stage.md" @(
    "Stage identity", "Exact starting checkpoint", "Mandatory inventory findings",
    "Baseline before implementation", "Implementation", "Migration behavior",
    "Verification results", "Package and installation",
    "Browser and live API status", "Known limitations", "Next dependency"
)

Test-Markers "backend\db\migrations\012_refine_contextual_assertions_evidence_versioning.sql" @(
    "context_claim_attributions", "context_claim_relations",
    "context_evidence_claim_links", "context_source_locators",
    "context_claim_versions", "context_evidence_versions",
    "context_claim_current_versions", "context_evidence_current_versions",
    "prevent_context_version_mutation", "ON DELETE NO ACTION"
) "Migration 012 contains additive normalized children and immutable versions"
Test-Markers "backend\src\contextual-types.ts" @(
    "claimAttributions", "claimRelations", "claimVersions",
    "evidenceClaimLinks", "evidenceVersions", "sourceLocators",
    "ContextEvidenceType"
) "Legacy claim/evidence fields and Chunk 4 types coexist"
Test-Markers "backend\src\routes\context.ts" @(
    "/claim-versions", "/evidence-versions", "/claim-evidence-links",
    "/claim-relationships", "/claim-attributions",
    "withCollectionContract"
) "Five Chunk 4 context collections are read-only Registry API routes"
Test-Markers "backend\src\services\search-store.ts" @(
    "context-claim-version", "context-evidence", "claimId",
    "current"
) "Search includes distinct historical claim versions and evidence"
Test-Markers "backend\src\services\contextual-governance.ts" @(
    "loadGovernedContextExtensions", "replaceAssertionEvidenceExtensions",
    "claimAttributions", "claimRelations", "evidenceClaimLinks",
    "sourceLocators"
) "Governance preserves Chunk 4 child snapshots"
Test-Markers "backend\src\services\workflow-store.ts" @(
    "appendGovernedContextVersion", "governed_publication",
    "governed_rollback", "contextualVersionId"
) "Governance publication and rollback append immutable versions"
Test-Markers "backend\src\observers\data-quality-provenance-observer.ts" @(
    "claim_without_provenance", "evidence_basis_missing",
    "version_predecessor_cycle", "multiple_current_versions",
    "content_hash_mismatch", "contradiction_without_provenance"
) "Data Quality observer covers Chunk 4 diagnostics"

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
if ($MigrationProblems.Count -eq 0) {
    Write-Result "PASS" "Migration ordering and prior migration integrity" "Migrations 001-011 retain their starting-checkpoint hashes; 012 is the sole next migration."
} else {
    Write-Result "FAIL" "Migration ordering and prior migration integrity" ($MigrationProblems -join ", ")
}

$RuntimeFiles = @(
    "backend\src\contextual-types.ts",
    "backend\src\services\contextual-schemas.ts",
    "backend\src\services\context-import-store.ts",
    "backend\src\services\context-store.ts",
    "backend\src\services\contextual-governance.ts",
    "backend\src\services\context-version-store.ts",
    "backend\src\services\search-store.ts",
    "backend\src\services\workflow-store.ts",
    "backend\src\routes\context.ts"
)
$RuntimeText = ($RuntimeFiles | ForEach-Object { Get-Content -LiteralPath (Join-Path $script:RepositoryRoot $_) -Raw }) -join "`n"
if ($RuntimeText -notmatch '(?i)truthProbability|credibilityScore|consensusScore|canonicalClaim|embedding|vectorSearch|inferContradiction') {
    Write-Result "PASS" "No truth engine, semantic inference, or vector search path exists"
} else {
    Write-Result "FAIL" "No truth engine, semantic inference, or vector search path exists" "An excluded runtime capability marker was found."
}

$ContextRouteText = Get-Content -LiteralPath (Join-Path $script:RepositoryRoot "backend\src\routes\context.ts") -Raw
if ($ContextRouteText -notmatch '(?i)contextRouter\.(post|put|patch|delete)\s*\(') {
    Write-Result "PASS" "Public contextual route boundary remains read-only"
} else {
    Write-Result "FAIL" "Public contextual route boundary remains read-only" "A contextual write route marker was found."
}

$ObserverText = Get-Content -LiteralPath (Join-Path $script:RepositoryRoot "backend\src\observers\data-quality-provenance-observer.ts") -Raw
$MutationPattern = '(?i)\b(writeFile|appendFile|unlink|rmSync|execSync|spawnSync|child_process|fetch|pool\.query|database\.query)\b'
if (-not [regex]::IsMatch($ObserverText, $MutationPattern)) {
    Write-Result "PASS" "Data Quality observer remains deterministic and read-only"
} else {
    Write-Result "FAIL" "Data Quality observer remains deterministic and read-only" "A mutation, network, shell, or database marker was found."
}
$PlatformText = Get-Content -LiteralPath (Join-Path $script:RepositoryRoot "backend\src\observers\platform-operations-observer.ts") -Raw
if (-not [regex]::IsMatch($PlatformText, $MutationPattern)) {
    Write-Result "PASS" "Platform Operations Observer remains read-only"
} else {
    Write-Result "FAIL" "Platform Operations Observer remains read-only" "A mutation, network, shell, or database marker was found."
}

Test-PowerShellParse (Join-Path $script:RepositoryRoot $InstallerName) $InstallerName
Test-PowerShellParse (Join-Path $script:RepositoryRoot $VerifierName) $VerifierName

$Node = Get-Command node.exe -ErrorAction SilentlyContinue
$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
$PowerShell = Get-Command powershell.exe -ErrorAction SilentlyContinue
if ($null -eq $Node) {
    Write-Result "FAIL" "Relevant JavaScript syntax" "node.exe is unavailable."
} else {
    foreach ($Path in @("backend\scripts\register-tsx.mjs", "assets\js\sourceroot-api.js")) {
        Invoke-Check "JavaScript syntax: $Path" $Node.Source @("--check", (Join-Path $script:RepositoryRoot $Path)) $script:RepositoryRoot
    }
}

$DatabaseIsTestScoped = $false
$EnvPath = Join-Path $script:RepositoryRoot "backend\.env.test"
try {
    $DatabaseLine = Get-Content -LiteralPath $EnvPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
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

if ($null -eq $Npm) {
    Write-Result "FAIL" "TypeScript and backend verification" "npm.cmd is unavailable."
} else {
    Invoke-Check "Backend TypeScript typecheck" $Npm.Source @("--prefix", "backend", "run", "typecheck") $script:RepositoryRoot
    if ($DatabaseIsTestScoped) {
        Invoke-Check "Test-scoped migration 012" $Npm.Source @("--prefix", "backend", "run", "db:migrate:test") $script:RepositoryRoot
        Invoke-Check "Focused Chunk 4 assertions/evidence/versioning tests" $Npm.Source @("--prefix", "backend", "run", "test:context-assertions-versioning") $script:RepositoryRoot
        Invoke-Check "Focused Chunk 3 identity/time regression tests" $Npm.Source @("--prefix", "backend", "run", "test:context-refinement") $script:RepositoryRoot
        Invoke-Check "Existing contextual foundation tests" $Npm.Source @("--prefix", "backend", "run", "test:context") $script:RepositoryRoot
        Invoke-Check "Registry API Contract 1.0 tests" $Npm.Source @("--prefix", "backend", "run", "test:registry-contract") $script:RepositoryRoot
        Invoke-Check "Observability regression tests" $Npm.Source @("--prefix", "backend", "run", "test:observability") $script:RepositoryRoot
        Invoke-Check "HistoryRoot governance regression tests" $Npm.Source @("--prefix", "backend", "run", "test:governance:historyroot") $script:RepositoryRoot
        Invoke-Check "Complete backend test suite" $Npm.Source @("--prefix", "backend", "test") $script:RepositoryRoot
    } else {
        foreach ($Name in @(
            "Test-scoped migration 012", "Focused Chunk 4 assertions/evidence/versioning tests",
            "Focused Chunk 3 identity/time regression tests",
            "Existing contextual foundation tests", "Registry API Contract 1.0 tests",
            "Observability regression tests", "HistoryRoot governance regression tests",
            "Complete backend test suite"
        )) {
            Write-Result "FAIL" $Name "Not run because sourceroot_test scope was not proven."
        }
    }
}

if ($null -eq $PowerShell) {
    Write-Result "FAIL" "Nested baseline and prior-stage verifiers" "powershell.exe is unavailable."
} else {
    foreach ($Nested in @(
        @("VERIFY-SOURCEROOT-BASELINE.ps1", "SourceRoot baseline verifier"),
        @("VERIFY-DICTIONARYROOT-BASELINE.ps1", "DictionaryRoot baseline verifier"),
        @("VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1", "Chunk 0 verifier")
    )) {
        Invoke-Check $Nested[1] $PowerShell.Source @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
            (Join-Path $script:RepositoryRoot $Nested[0]), "-RepositoryPath", $script:RepositoryRoot
        ) $script:RepositoryRoot
    }
    Invoke-ExactChunk3Verifier $PowerShell.Source
}

if (-not $script:PackageRoot) {
    Write-Result "FAIL" "Stage package layout" "Package directory was not found."
} else {
    $PackageRequired = @(
        "README-FIRST.md",
        $InstallerName,
        $VerifierName,
        "manifest\stage-manifest.json",
        "docs\CONTEXTUAL-ASSERTIONS-EVIDENCE-VERSIONING-CONTRACT.md",
        "docs\contextual-assertions-evidence-versioning-stage.md"
    )
    $PackageMissing = @($PackageRequired | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $script:PackageRoot $_) -PathType Leaf)
    })
    if ($PackageMissing.Count -eq 0) {
        Write-Result "PASS" "Stage package file completeness" "$($PackageRequired.Count) required package files found."
    } else {
        Write-Result "FAIL" "Stage package file completeness" ($PackageMissing -join ", ")
    }
    $ManifestPath = Join-Path $script:PackageRoot "manifest\stage-manifest.json"
    try {
        $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        if (
            $Manifest.stageName -eq "SourceRoot-Contextual-Assertions-Evidence-Versioning" -and
            $Manifest.stageVersion -eq "v1" -and
            $Manifest.targetRepository -eq "dictionaryhub" -and
            $Manifest.requiredPreviousStage -eq "SourceRoot Chunk 3 - Contextual Identity and Time Refinement v1"
        ) {
            Write-Result "PASS" "Package manifest identity"
        } else {
            Write-Result "FAIL" "Package manifest identity" "Identity, version, target, or prerequisite is incorrect."
        }
    } catch {
        Write-Result "FAIL" "Package manifest parses" $_.Exception.Message
        $Manifest = $null
    }

    if ($null -ne $Manifest) {
        $AllFiles = @($Manifest.filesAdded) + @($Manifest.filesReplaced)
        $PayloadRoot = Join-Path $script:PackageRoot "payload"
        $Physical = @(
            Get-ChildItem -LiteralPath $PayloadRoot -File -Recurse |
                ForEach-Object { $_.FullName.Substring($PayloadRoot.Length + 1).Replace("\", "/") }
        )
        $Declared = @($AllFiles | Sort-Object)
        $ActualFiles = @($Physical | Sort-Object)
        if (($Declared -join "`n") -eq ($ActualFiles -join "`n")) {
            Write-Result "PASS" "Manifest payload list matches package payload" "$($Declared.Count) complete files."
        } else {
            Write-Result "FAIL" "Manifest payload list matches package payload" "Declared and physical payload paths differ."
        }

        $HashMap = @{}
        foreach ($Entry in @($Manifest.payloadHashes)) {
            $HashMap[[string]$Entry.path] = ([string]$Entry.sha256).ToLowerInvariant()
        }
        if (
            $HashMap.Count -eq $AllFiles.Count -and
            @($Manifest.payloadHashes).Count -eq $AllFiles.Count
        ) {
            Write-Result "PASS" "Manifest declares one hash per payload file" "$($AllFiles.Count) hashes."
        } else {
            Write-Result "FAIL" "Manifest declares one hash per payload file" "Payload/hash counts or unique paths differ."
        }
        $PackageHashProblems = [Collections.Generic.List[string]]::new()
        $InstalledHashProblems = [Collections.Generic.List[string]]::new()
        foreach ($Relative in $AllFiles) {
            $PackageFile = Join-Path $PayloadRoot ($Relative -replace '/', '\')
            $InstalledFile = Join-Path $script:RepositoryRoot ($Relative -replace '/', '\')
            if (-not (Test-Path -LiteralPath $PackageFile -PathType Leaf) -or -not $HashMap.ContainsKey($Relative)) {
                $PackageHashProblems.Add($Relative)
                continue
            }
            $Expected = $HashMap[$Relative]
            if ((Get-FileHash -LiteralPath $PackageFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Expected) {
                $PackageHashProblems.Add($Relative)
            }
            if (
                -not (Test-Path -LiteralPath $InstalledFile -PathType Leaf) -or
                (Get-FileHash -LiteralPath $InstalledFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Expected
            ) {
                $InstalledHashProblems.Add($Relative)
            }
        }
        if ($PackageHashProblems.Count -eq 0) {
            Write-Result "PASS" "Payload hashes match manifest"
        } else {
            Write-Result "FAIL" "Payload hashes match manifest" ($PackageHashProblems -join ", ")
        }
        if ($InstalledHashProblems.Count -eq 0) {
            Write-Result "PASS" "Installed hashes match exact payload"
        } else {
            Write-Result "FAIL" "Installed hashes match exact payload" ($InstalledHashProblems -join ", ")
        }

        $Excluded = @(
            $AllFiles | Where-Object {
                $_ -match '(^|/)(node_modules|backups|\.git)(/|$)' -or
                $_ -match '\.(env|dump|bak)$' -or
                $_ -match '^SourceRoot-(Codex|Registry|Frontend)-'
            }
        )
        if ($Excluded.Count -eq 0) {
            Write-Result "PASS" "Package exclusions"
        } else {
            Write-Result "FAIL" "Package exclusions" ($Excluded -join ", ")
        }

        $SecretPattern = '(?im)^\s*(?:DATABASE_URL|PASSWORD|SECRET|API_KEY|ACCESS_TOKEN|PRIVATE_KEY)\s*=\s*(?!\s*(?:none|null|redacted|placeholder|test-placeholder)\s*$).+$|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
        $Secrets = [Collections.Generic.List[string]]::new()
        foreach ($Relative in $AllFiles) {
            $Text = Get-Content -LiteralPath (Join-Path $PayloadRoot ($Relative -replace '/', '\')) -Raw
            if ([regex]::IsMatch($Text, $SecretPattern)) { $Secrets.Add($Relative) }
        }
        if ($Secrets.Count -eq 0) {
            Write-Result "PASS" "Package contains no obvious secrets"
        } else {
            Write-Result "FAIL" "Package contains no obvious secrets" ($Secrets -join ", ")
        }

        Test-PowerShellParse (Join-Path $script:PackageRoot $InstallerName) "package $InstallerName"
        Test-PowerShellParse (Join-Path $script:PackageRoot $VerifierName) "package $VerifierName"
    }
}

$ZipCandidates = @(
    (Join-Path $script:RepositoryRoot ($PackageFolderName + ".zip"))
)
if ($script:PackageRoot) {
    $ZipCandidates += (Join-Path (Split-Path -Parent $script:PackageRoot) ($PackageFolderName + ".zip"))
}
$ZipPath = $ZipCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if ($null -eq $ZipPath) {
    Write-Result "FAIL" "ZIP structure and bytes" "Missing $PackageFolderName.zip"
} elseif (-not $script:PackageRoot) {
    Write-Result "FAIL" "ZIP structure and bytes" "Package folder is unavailable for byte comparison."
} else {
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $Zip = [IO.Compression.ZipFile]::OpenRead($ZipPath)
        try {
            $Prefix = $PackageFolderName + "/"
            $BadTop = @($Zip.Entries | Where-Object {
                $_.FullName -and -not $_.FullName.Replace("\", "/").StartsWith($Prefix)
            })
            $BadPaths = @($Zip.Entries | Where-Object {
                $Name = $_.FullName
                $Name -match '\\' -or
                $Name -match '(^|/)\.\.(/|$)' -or
                $Name -match '^[A-Za-z]:' -or
                $Name.StartsWith("/")
            })
            $PackageFiles = @(Get-ChildItem -LiteralPath $script:PackageRoot -File -Recurse)
            $ExpectedEntries = @($PackageFiles | ForEach-Object {
                $Prefix + $_.FullName.Substring($script:PackageRoot.Length + 1).Replace("\", "/")
            })
            $EntriesByName = @{}
            foreach ($Entry in $Zip.Entries) {
                $NormalizedEntryName = $Entry.FullName.Replace("\", "/")
                if (-not $NormalizedEntryName.EndsWith("/")) { $EntriesByName[$NormalizedEntryName] = $Entry }
            }
            $Problems = [Collections.Generic.List[string]]::new()
            foreach ($EntryName in $ExpectedEntries) {
                if (-not $EntriesByName.ContainsKey($EntryName)) {
                    $Problems.Add("$EntryName missing")
                    continue
                }
                $PackageFile = Join-Path $script:PackageRoot ($EntryName.Substring($Prefix.Length) -replace '/', '\')
                $Stream = $EntriesByName[$EntryName].Open()
                try { $ZipHash = Get-StreamHash $Stream } finally { $Stream.Dispose() }
                $PackageHash = (Get-FileHash -LiteralPath $PackageFile -Algorithm SHA256).Hash.ToLowerInvariant()
                if ($ZipHash -ne $PackageHash) { $Problems.Add("$EntryName differs") }
            }
            $Extra = @($EntriesByName.Keys | Where-Object { $ExpectedEntries -notcontains $_ })
            if ($BadTop.Count -eq 0 -and $BadPaths.Count -eq 0 -and $Problems.Count -eq 0 -and $Extra.Count -eq 0) {
                Write-Result "PASS" "ZIP structure and bytes" "One top-level folder; every file matches the assembled package."
            } else {
                Write-Result "FAIL" "ZIP structure and bytes" "Bad top-level: $($BadTop.Count); unsafe paths: $($BadPaths.Count); problems: $($Problems -join ', '); extra: $($Extra -join ', ')"
            }
        } finally {
            $Zip.Dispose()
        }
    } catch {
        Write-Result "FAIL" "ZIP structure and bytes" $_.Exception.Message
    }
}

$GitForDiff = Get-Command git.exe -ErrorAction SilentlyContinue
if ($null -eq $GitForDiff) {
    Write-Result "FAIL" "git diff --check" "git.exe is unavailable."
} else {
    Invoke-Check "git diff --check" $GitForDiff.Source @(
        "-C", $script:RepositoryRoot, "diff", "--check"
    ) $script:RepositoryRoot
}

Write-Result "INFO" "Browser checks" "Not run; this backend/data-contract stage intentionally changes no frontend files."
Write-Result "INFO" "Independent live API checks" "Not run; API coverage is in-process."
Write-Host ""
Write-Host "Summary: $script:Passed passed, $script:Failed failed, $script:Warnings warnings, $script:Info informational." -ForegroundColor Cyan
if ($script:Failed -gt 0) { exit 1 }
exit 0


