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
$script:Info = 0
$DefaultRepository = "C:\Users\Josh\Documents\GitHub\dictionaryhub"

function Write-Result {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("PASS", "FAIL", "WARN", "INFO")][string]$Level,
        [Parameter(Mandatory = $true)][string]$Name,
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
    if (-not [string]::IsNullOrWhiteSpace($Detail)) {
        Write-Host "       $Detail"
    }
}

function Resolve-RepositoryRoot {
    $Candidates = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($RepositoryPath)) {
        $Candidates.Add($RepositoryPath)
    }
    $Candidates.Add($PSScriptRoot)
    $Candidates.Add((Get-Location).Path)
    $Candidates.Add($DefaultRepository)

    foreach ($Candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }
        if (-not (Test-Path -LiteralPath $Candidate -PathType Container)) { continue }
        $Resolved = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Candidate).Path)
        if (
            (Test-Path -LiteralPath (Join-Path $Resolved "backend\src\app.ts") -PathType Leaf) -and
            (Test-Path -LiteralPath (Join-Path $Resolved "config\customers\dictionaryroot.json") -PathType Leaf)
        ) {
            return $Resolved.TrimEnd("\", "/")
        }
    }

    throw "Could not locate a repository containing backend\src\app.ts and config\customers\dictionaryroot.json."
}

function Test-RequiredFiles {
    param(
        [Parameter(Mandatory = $true)][string[]]$RelativePaths,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $Missing = @(
        $RelativePaths | Where-Object {
            -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot $_) -PathType Leaf)
        }
    )
    if ($Missing.Count -eq 0) {
        Write-Result -Level "PASS" -Name $Name -Detail "$($RelativePaths.Count) required files found."
    } else {
        Write-Result -Level "FAIL" -Name $Name -Detail "Missing: $($Missing -join ', ')"
    }
}

function Test-TextMarkers {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string[]]$Markers,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $Path = Join-Path $script:RepositoryRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Result -Level "FAIL" -Name $Name -Detail "Missing file: $RelativePath"
        return
    }
    $Text = Get-Content -LiteralPath $Path -Raw
    $Missing = @(
        $Markers | Where-Object {
            $Text.IndexOf($_, [System.StringComparison]::Ordinal) -lt 0
        }
    )
    if ($Missing.Count -eq 0) {
        Write-Result -Level "PASS" -Name $Name
    } else {
        Write-Result -Level "FAIL" -Name $Name -Detail "Missing markers in ${RelativePath}: $($Missing -join ', ')"
    }
}

try {
    $script:RepositoryRoot = Resolve-RepositoryRoot
} catch {
    Write-Result -Level "FAIL" -Name "Repository location" -Detail $_.Exception.Message
    exit 2
}

Write-Host "SourceRoot baseline verifier v1" -ForegroundColor Cyan
Write-Host "Repository: $script:RepositoryRoot"
Write-Host ""
Write-Result -Level "INFO" -Name "Verification mode" -Detail "Static and local syntax checks only. This verifier does not start the backend, connect to PostgreSQL, call a live API, open a browser, or modify files."

$ManifestPath = Join-Path $script:RepositoryRoot "docs\build\SOURCEROOT-BASELINE-MANIFEST.json"
$Manifest = $null
if (Test-Path -LiteralPath $ManifestPath -PathType Leaf) {
    try {
        $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        Write-Result -Level "PASS" -Name "Baseline manifest parses as JSON" -Detail "schemaVersion=$($Manifest.schemaVersion)"
    } catch {
        Write-Result -Level "FAIL" -Name "Baseline manifest parses as JSON" -Detail $_.Exception.Message
    }
} else {
    Write-Result -Level "FAIL" -Name "Baseline manifest exists" -Detail "Missing docs\build\SOURCEROOT-BASELINE-MANIFEST.json"
}

$RequiredBackendFiles = @(
    "backend\package.json",
    "backend\package-lock.json",
    "backend\tsconfig.json",
    "backend\src\app.ts",
    "backend\src\server.ts",
    "backend\src\lib\database.ts",
    "backend\src\lib\query-params.ts",
    "backend\src\routes\health.ts",
    "backend\src\routes\validate.ts",
    "backend\src\routes\import.ts",
    "backend\src\routes\nodes.ts",
    "backend\src\routes\assertions.ts",
    "backend\src\routes\edges.ts",
    "backend\src\routes\sources.ts",
    "backend\src\routes\search.ts",
    "backend\src\routes\bundles.ts",
    "backend\src\services\validator.ts",
    "backend\src\services\import-store.ts",
    "backend\src\services\node-store.ts",
    "backend\src\services\assertion-store.ts",
    "backend\src\services\edge-store.ts",
    "backend\src\services\source-store.ts",
    "backend\src\services\search-store.ts"
)
Test-RequiredFiles -RelativePaths $RequiredBackendFiles -Name "Required SourceRoot backend files"

Test-TextMarkers -RelativePath "backend\src\app.ts" -Name "Backend entry points mount core SourceRoot routes" -Markers @(
    'app.use(healthRouter)',
    'app.use("/api/v1", validateRouter)',
    'app.use("/api/v1/import", importRouter)',
    'app.use("/api/v1/search", searchRouter)',
    'app.use("/api/v1/nodes", nodesRouter)',
    'app.use("/api/v1/assertions", assertionsRouter)',
    'app.use("/api/v1/edges", edgesRouter)',
    'app.use("/api/v1/sources", sourcesRouter)'
)
Test-TextMarkers -RelativePath "backend\src\routes\health.ts" -Name "Health and deployment-readiness routes are present" -Markers @(
    'healthRouter.get("/health"',
    'healthRouter.get("/api/v1/deployment-readiness"'
)
Test-TextMarkers -RelativePath "backend\src\services\validator.ts" -Name "Bundle validation implementation is present" -Markers @(
    "export function validateBundle",
    "validateNode",
    "validateAssertion",
    "validateEdge",
    "validateSource",
    "checkSourceReferences",
    "checkDuplicates"
)
Test-TextMarkers -RelativePath "backend\src\routes\import.ts" -Name "Dry validation and persisted import paths are present" -Markers @(
    "validateBundle(bundle)",
    "saveImportedBundle(bundle)",
    "listImportedBundles",
    "getImportedBundle"
)
Test-TextMarkers -RelativePath "backend\src\services\import-store.ts" -Name "Normalized import and imported-bundle tracking are present" -Markers @(
    "insertSources",
    "insertNodes",
    "insertAssertions",
    "insertEdges",
    "insertRevisions",
    "export async function saveImportedBundle"
)
Test-TextMarkers -RelativePath "backend\src\routes\search.ts" -Name "Search route and filters are present" -Markers @(
    "searchKnowledge",
    "validSearchTypes",
    "request.query.bundleId",
    "request.query.domain"
)

$MigrationFiles = @()
$TestFiles = @()
if ($null -ne $Manifest) {
    $MigrationFiles = @($Manifest.migrationFiles | ForEach-Object { [string]$_ })
    $TestFiles = @($Manifest.existingTests | ForEach-Object { [string]$_ })
}
if ($MigrationFiles.Count -eq 0) {
    $MigrationFiles = @(
        "backend\db\migrations\001_create_imported_bundles.sql",
        "backend\db\migrations\002_create_knowledge_tables.sql"
    )
}
if ($TestFiles.Count -eq 0) {
    $TestFiles = @(
        "backend\test\api.test.ts",
        "backend\test\validator.test.ts",
        "backend\test\schema.test.ts",
        "backend\test\import.test.ts"
    )
}
Test-RequiredFiles -RelativePaths $MigrationFiles -Name "Recorded migration files"
Test-RequiredFiles -RelativePaths $TestFiles -Name "Recorded backend test files"

Test-TextMarkers -RelativePath "backend\db\migrations\001_create_imported_bundles.sql" -Name "Imported-bundle table migration is present" -Markers @(
    "CREATE TABLE IF NOT EXISTS imported_bundles"
)
Test-TextMarkers -RelativePath "backend\db\migrations\002_create_knowledge_tables.sql" -Name "Core registry table migration is present" -Markers @(
    "CREATE TABLE IF NOT EXISTS sources",
    "CREATE TABLE IF NOT EXISTS nodes",
    "CREATE TABLE IF NOT EXISTS assertions",
    "CREATE TABLE IF NOT EXISTS edges",
    "CREATE TABLE IF NOT EXISTS revisions"
)

$PowerShellFiles = @(
    Get-ChildItem -LiteralPath $script:RepositoryRoot -Recurse -File -Filter "*.ps1" |
        Where-Object {
            $_.FullName -notmatch '[\\/](backups|node_modules|\.git)[\\/]'
        }
)
$PowerShellParseFailures = New-Object System.Collections.Generic.List[string]
foreach ($File in $PowerShellFiles) {
    $Tokens = $null
    $ParseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $File.FullName,
        [ref]$Tokens,
        [ref]$ParseErrors
    )
    if ($ParseErrors.Count -gt 0) {
        $Relative = $File.FullName.Substring($script:RepositoryRoot.Length).TrimStart("\", "/")
        $PowerShellParseFailures.Add("$Relative ($($ParseErrors.Count) parse errors)")
    }
}
if ($PowerShellParseFailures.Count -eq 0) {
    Write-Result -Level "PASS" -Name "PowerShell scripts parse" -Detail "$($PowerShellFiles.Count) scripts parsed without errors."
} else {
    Write-Result -Level "FAIL" -Name "PowerShell scripts parse" -Detail ($PowerShellParseFailures -join "; ")
}

$NodeCommand = Get-Command "node" -ErrorAction SilentlyContinue
if ($null -eq $NodeCommand) {
    Write-Result -Level "WARN" -Name "Node.js JavaScript syntax checks skipped" -Detail "Node.js is unavailable."
} else {
    $JavaScriptFiles = @(
        Get-ChildItem -LiteralPath (Join-Path $script:RepositoryRoot "engine") -File -Filter "*.js"
    )
    $JavaScriptFailures = New-Object System.Collections.Generic.List[string]
    foreach ($File in $JavaScriptFiles) {
        $Output = & $NodeCommand.Source --check $File.FullName 2>&1
        if ($LASTEXITCODE -ne 0) {
            $JavaScriptFailures.Add("$($File.Name): $($Output -join ' ')")
        }
    }
    if ($JavaScriptFailures.Count -eq 0) {
        Write-Result -Level "PASS" -Name "SourceRoot engine JavaScript syntax" -Detail "$($JavaScriptFiles.Count) files checked with node --check."
    } else {
        Write-Result -Level "FAIL" -Name "SourceRoot engine JavaScript syntax" -Detail ($JavaScriptFailures -join "; ")
    }
}

$TypeScriptExecutable = Join-Path $script:RepositoryRoot "backend\node_modules\.bin\tsc.cmd"
$NpmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if ($null -eq $NpmCommand -or -not (Test-Path -LiteralPath $TypeScriptExecutable -PathType Leaf)) {
    Write-Result -Level "WARN" -Name "Backend TypeScript typecheck skipped" -Detail "Install backend dependencies with npm ci, then run npm.cmd --prefix backend run typecheck."
} else {
    $TypecheckOutput = & $NpmCommand.Source --prefix (Join-Path $script:RepositoryRoot "backend") run typecheck 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Result -Level "PASS" -Name "Backend TypeScript typecheck" -Detail "npm run typecheck completed successfully."
    } else {
        Write-Result -Level "FAIL" -Name "Backend TypeScript typecheck" -Detail ($TypecheckOutput -join " ")
    }
}

$GitCommand = Get-Command "git" -ErrorAction SilentlyContinue
if ($null -ne $GitCommand -and (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot ".git") -PathType Container)) {
    $CurrentBranch = (& $GitCommand.Source -C $script:RepositoryRoot branch --show-current 2>$null | Select-Object -First 1)
    $CurrentCommit = (& $GitCommand.Source -C $script:RepositoryRoot rev-parse HEAD 2>$null | Select-Object -First 1)
    Write-Result -Level "INFO" -Name "Current Git identity" -Detail "branch=$CurrentBranch; commit=$CurrentCommit"
} else {
    Write-Result -Level "WARN" -Name "Git identity unavailable" -Detail "Git is unavailable or the target has no .git directory."
}

Write-Result -Level "INFO" -Name "Backend-dependent checks" -Detail "Not run. This verifier did not start or call the backend."
Write-Result -Level "INFO" -Name "PostgreSQL-dependent checks" -Detail "Not run. This verifier never connects to or modifies a database."
Write-Result -Level "INFO" -Name "Browser-dependent checks" -Detail "Not run. No browser was used."
Write-Result -Level "INFO" -Name "Live API checks" -Detail "Not run. No API request was made."

Write-Host ""
Write-Host "SourceRoot baseline summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host "Info:     $script:Info"

if ($script:Failed -gt 0) {
    exit 1
}
exit 0
