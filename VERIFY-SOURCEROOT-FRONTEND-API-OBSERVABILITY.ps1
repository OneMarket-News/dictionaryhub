[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "",

    [Parameter()]
    [string]$PackagePath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0
$script:Info = 0
$DefaultRepository = "C:\Users\Josh\Documents\GitHub\dictionaryhub"
$PackageFolderName = "SourceRoot-Frontend-API-Observability-v1"
$InstallerName = "INSTALL-SOURCEROOT-FRONTEND-API-OBSERVABILITY.ps1"
$VerifierName = "VERIFY-SOURCEROOT-FRONTEND-API-OBSERVABILITY.ps1"

function Write-Result {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("PASS", "FAIL", "WARN", "INFO")]
        [string]$Level,

        [Parameter(Mandatory = $true)]
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
    if (-not [string]::IsNullOrWhiteSpace($Detail)) {
        Write-Host "       $Detail"
    }
}

function Resolve-RepositoryRoot {
    $Candidates = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($RepositoryPath)) {
        $Candidates.Add($RepositoryPath)
    }
    $Candidates.Add($DefaultRepository)
    $Candidates.Add((Get-Location).Path)
    $Candidates.Add($PSScriptRoot)

    foreach ($Candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }
        if (-not (Test-Path -LiteralPath $Candidate -PathType Container)) { continue }
        $Resolved = [System.IO.Path]::GetFullPath(
            (Resolve-Path -LiteralPath $Candidate).Path
        ).TrimEnd("\", "/")
        if (
            (Test-Path -LiteralPath (Join-Path $Resolved "backend\src\app.ts") -PathType Leaf) -and
            (Test-Path -LiteralPath (Join-Path $Resolved "index.html") -PathType Leaf)
        ) {
            return $Resolved
        }
    }
    throw "Could not locate the target dictionaryhub repository."
}

function Resolve-PackageRoot {
    if (-not [string]::IsNullOrWhiteSpace($PackagePath)) {
        if (Test-Path -LiteralPath $PackagePath -PathType Container) {
            return [System.IO.Path]::GetFullPath(
                (Resolve-Path -LiteralPath $PackagePath).Path
            ).TrimEnd("\", "/")
        }
        return ""
    }
    if (
        (Test-Path -LiteralPath (Join-Path $PSScriptRoot "payload") -PathType Container) -and
        (Test-Path -LiteralPath (Join-Path $PSScriptRoot "manifest\stage-manifest.json") -PathType Leaf)
    ) {
        return [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
    }
    $RepositoryPackage = Join-Path $script:RepositoryRoot $PackageFolderName
    if (Test-Path -LiteralPath $RepositoryPackage -PathType Container) {
        return [System.IO.Path]::GetFullPath($RepositoryPackage).TrimEnd("\", "/")
    }
    return ""
}

function Test-RequiredFiles {
    param([string[]]$RelativePaths)
    $Missing = @(
        $RelativePaths | Where-Object {
            -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot $_) -PathType Leaf)
        }
    )
    if ($Missing.Count -eq 0) {
        Write-Result -Level "PASS" -Name "Required stage files exist" -Detail "$($RelativePaths.Count) files found."
    } else {
        Write-Result -Level "FAIL" -Name "Required stage files exist" -Detail "Missing: $($Missing -join ', ')"
    }
}

function Test-DocumentHeadings {
    param([string]$RelativePath, [string[]]$Headings)
    $Path = Join-Path $script:RepositoryRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Result -Level "FAIL" -Name "$RelativePath headings" -Detail "File is missing."
        return
    }
    $Text = Get-Content -LiteralPath $Path -Raw
    $Missing = @(
        $Headings | Where-Object {
            $Pattern = '(?im)^#{1,6}\s+' + [regex]::Escape($_) + '\s*$'
            -not [regex]::IsMatch($Text, $Pattern)
        }
    )
    if ($Missing.Count -eq 0) {
        Write-Result -Level "PASS" -Name "$RelativePath required sections"
    } else {
        Write-Result -Level "FAIL" -Name "$RelativePath required sections" -Detail "Missing: $($Missing -join ', ')"
    }
}

function Test-TextMarkers {
    param([string]$RelativePath, [string[]]$Markers, [string]$Name)
    $Path = Join-Path $script:RepositoryRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Result -Level "FAIL" -Name $Name -Detail "Missing file: $RelativePath"
        return
    }
    $Text = Get-Content -LiteralPath $Path -Raw
    $Missing = @(
        $Markers | Where-Object {
            $Text.IndexOf($_, [System.StringComparison]::OrdinalIgnoreCase) -lt 0
        }
    )
    if ($Missing.Count -eq 0) {
        Write-Result -Level "PASS" -Name $Name
    } else {
        Write-Result -Level "FAIL" -Name $Name -Detail "Missing markers: $($Missing -join ', ')"
    }
}

function Test-PowerShellParse {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Result -Level "FAIL" -Name "PowerShell parse: $Label" -Detail "File is missing."
        return
    }
    $Tokens = $null
    $ParseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $Path,
        [ref]$Tokens,
        [ref]$ParseErrors
    )
    if ($ParseErrors.Count -eq 0) {
        Write-Result -Level "PASS" -Name "PowerShell parse: $Label"
    } else {
        Write-Result -Level "FAIL" -Name "PowerShell parse: $Label" -Detail (($ParseErrors | ForEach-Object { $_.Message }) -join "; ")
    }
}

function Invoke-ProcessCheck {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )
    Write-Host ""
    Write-Host "---- $Name output ----" -ForegroundColor DarkCyan
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        $ExitCode = $LASTEXITCODE
    } catch {
        $ExitCode = 1
        Write-Host $_.Exception.Message
    } finally {
        Pop-Location
    }
    Write-Host "---- end $Name output ----" -ForegroundColor DarkCyan
    if ($ExitCode -eq 0) {
        Write-Result -Level "PASS" -Name $Name
    } else {
        Write-Result -Level "FAIL" -Name $Name -Detail "Exit code: $ExitCode"
    }
}

try {
    $script:RepositoryRoot = Resolve-RepositoryRoot
} catch {
    Write-Result -Level "FAIL" -Name "Repository location" -Detail $_.Exception.Message
    exit 2
}
$script:PackageRoot = Resolve-PackageRoot

Write-Host "SourceRoot Frontend API and Observability v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:RepositoryRoot"
if (-not [string]::IsNullOrWhiteSpace($script:PackageRoot)) {
    Write-Host "Package:    $script:PackageRoot"
}
Write-Host ""
Write-Result -Level "INFO" -Name "Static checks" -Detail "Files, docs, browser integration, syntax, manifest, hashes, ZIP, exclusions, and secret patterns are checked."
Write-Result -Level "INFO" -Name "Test-database checks" -Detail "Backend tests use backend\.env.test only after its database name is proven test-scoped."
Write-Result -Level "INFO" -Name "In-process API checks" -Detail "Supertest exercises the Express application in process."
Write-Result -Level "INFO" -Name "Independent live API checks" -Detail "Not performed. No separately running backend is called."
Write-Result -Level "INFO" -Name "Browser checks" -Detail "Not performed. Browser-compatible code is checked with Node and the VM harness; no browser is opened."

$RequiredFiles = @(
    "assets\js\sourceroot-api.js",
    "backend\scripts\register-tsx.mjs",
    "backend\src\lib\diagnostics.ts",
    "backend\src\lib\request-id.ts",
    "backend\src\middleware\request-logging.ts",
    "backend\src\observers\platform-operations-observer.ts",
    "backend\src\observers\data-quality-provenance-observer.ts",
    "backend\test\observability.test.ts",
    "backend\test\observers.test.ts",
    "verification\frontend-api-observability.test.cjs",
    "docs\build\FRONTEND-API-OBSERVABILITY-CONTRACT.md",
    "docs\build\frontend-api-observability-stage.md",
    "docs\build\CURRENT-SOURCEROOT-STATE.md",
    "docs\build\SOURCEROOT-BASELINE-MANIFEST.json",
    $VerifierName,
    $InstallerName
)
Test-RequiredFiles -RelativePaths $RequiredFiles

Test-DocumentHeadings -RelativePath "docs\build\FRONTEND-API-OBSERVABILITY-CONTRACT.md" -Headings @(
    "Shared Frontend API Layer",
    "Error Categories",
    "Correlation-ID Contract",
    "Structured Log Schema",
    "Redaction Rules",
    "Diagnostic Event Model",
    "Platform Operations Observer",
    "Data Quality and Provenance Observer",
    "Level 1 Authority Restrictions",
    "Human-Review Requirements",
    "Deferred Production-Monitoring Work",
    "Deferred Agent Autonomy",
    "Compatibility Exceptions"
)
Test-DocumentHeadings -RelativePath "docs\build\frontend-api-observability-stage.md" -Headings @(
    "Starting State",
    "Pre-Change Verification",
    "Frontend Consumer Inventory",
    "Shared-Client Decisions",
    "Deferred Consumers",
    "Observer Designs",
    "Observer Authority Levels",
    "Rollback Procedure",
    "Next Dependency"
)

Test-TextMarkers -RelativePath "assets\js\sourceroot-api.js" -Name "Shared frontend request layer" -Markers @(
    "SourceRootApiLayer",
    "DEFAULT_TIMEOUT_MS",
    "AbortController",
    "X-Request-ID",
    "frontend_network_failure",
    "frontend_timeout",
    "invalid_response"
)
Test-TextMarkers -RelativePath "assets\js\dictionaryroot-api.js" -Name "DictionaryRoot shared transport adoption" -Markers @(
    "SourceRootApiLayer.request",
    "DictionaryRootApiClient",
    "DictionaryRootApiError",
    "sourceExperience",
    "nodesByIds"
)
Test-TextMarkers -RelativePath "assets\js\historyroot-api.js" -Name "HistoryRoot shared transport adoption" -Markers @(
    "SourceRootApiLayer.request",
    "HistoryRootApiClient",
    "HistoryRootApiError",
    "sourceLinkedRecords",
    "recordsByIds"
)
Test-TextMarkers -RelativePath "engine\sourceRootApi.js" -Name "SourceRoot shared transport adoption" -Markers @(
    "SourceRootApiLayer.request",
    "fetchJson",
    "getItems",
    "bindPagination"
)
Test-TextMarkers -RelativePath "backend\src\lib\request-id.ts" -Name "Correlation middleware" -Markers @(
    "safeRequestId",
    "randomUUID",
    "request.correlationId",
    "x-request-id"
)
Test-TextMarkers -RelativePath "backend\src\lib\diagnostics.ts" -Name "Structured logging and redaction" -Markers @(
    "StructuredDiagnosticEvent",
    "redactSensitiveData",
    "authorization",
    "cookie",
    "password",
    "request_completed",
    "import_completed",
    "observer_report_created"
)
Test-TextMarkers -RelativePath "backend\src\observers\platform-operations-observer.ts" -Name "Platform Operations Observer" -Markers @(
    "observePlatformOperations",
    "authorityLevel: 1",
    "readOnly: true",
    "correlationIds",
    "humanSummary"
)
Test-TextMarkers -RelativePath "backend\src\observers\data-quality-provenance-observer.ts" -Name "Data Quality and Provenance Observer" -Markers @(
    "observeDataQualityAndProvenance",
    "authorityLevel: 1",
    "readOnly: true",
    "missing_attribution",
    "broken_source_relationship",
    "suggestedHumanReviewAction"
)
Test-TextMarkers -RelativePath "backend\test\observability.test.ts" -Name "Correlation and redaction test coverage" -Markers @(
    "safe caller correlation ID",
    "never grants authentication",
    "redacts secrets",
    "never records headers"
)
Test-TextMarkers -RelativePath "backend\test\observers.test.ts" -Name "Read-only observer test coverage" -Markers @(
    "groups recurring failures",
    "JSON.stringify(input)",
    "missing_attribution",
    "clean records"
)

$HtmlLoadFailures = New-Object System.Collections.Generic.List[string]
foreach ($HtmlFile in @(Get-ChildItem -LiteralPath $script:RepositoryRoot -Filter "*.html" -File)) {
    $Html = Get-Content -LiteralPath $HtmlFile.FullName -Raw
    foreach ($ClientMarker in @(
        "assets/js/dictionaryroot-api.js",
        "assets/js/historyroot-api.js",
        "engine/sourceRootApi.js"
    )) {
        $ClientIndex = $Html.IndexOf($ClientMarker, [System.StringComparison]::OrdinalIgnoreCase)
        if ($ClientIndex -lt 0) { continue }
        $SharedIndex = $Html.IndexOf("assets/js/sourceroot-api.js", [System.StringComparison]::OrdinalIgnoreCase)
        if ($SharedIndex -lt 0 -or $SharedIndex -gt $ClientIndex) {
            $HtmlLoadFailures.Add("$($HtmlFile.Name): $ClientMarker")
        }
    }
}
if ($HtmlLoadFailures.Count -eq 0) {
    Write-Result -Level "PASS" -Name "Migrated pages load shared transport before wrappers"
} else {
    Write-Result -Level "FAIL" -Name "Migrated pages load shared transport before wrappers" -Detail ($HtmlLoadFailures.ToArray() -join ", ")
}

$ObserverText = (
    (Get-Content -LiteralPath (Join-Path $script:RepositoryRoot "backend\src\observers\platform-operations-observer.ts") -Raw) +
    (Get-Content -LiteralPath (Join-Path $script:RepositoryRoot "backend\src\observers\data-quality-provenance-observer.ts") -Raw)
)
$MutationPattern = '(?i)\b(writeFile|appendFile|unlink|rmSync|execSync|spawnSync|child_process|fetch|database\.query|pool\.query)\b'
if (-not [regex]::IsMatch($ObserverText, $MutationPattern)) {
    Write-Result -Level "PASS" -Name "Observers expose no mutation, shell, network, or database operation"
} else {
    Write-Result -Level "FAIL" -Name "Observers expose no mutation, shell, network, or database operation" -Detail "A prohibited capability marker was found."
}

$EnvTestPath = Join-Path $script:RepositoryRoot "backend\.env.test"
$DatabaseIsTestScoped = $false
if (Test-Path -LiteralPath $EnvTestPath -PathType Leaf) {
    $DatabaseLine = Get-Content -LiteralPath $EnvTestPath | Where-Object {
        $_ -match '^\s*DATABASE_URL\s*='
    } | Select-Object -First 1
    if ($null -ne $DatabaseLine) {
        $DatabaseUrl = ($DatabaseLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
        try {
            $DatabaseUri = [System.Uri]$DatabaseUrl
            $DatabaseName = $DatabaseUri.AbsolutePath.Trim("/")
            if ($DatabaseName -match '(?i)test') {
                $DatabaseIsTestScoped = $true
                Write-Result -Level "PASS" -Name "Test database is explicitly test-scoped" -Detail "Database name: $DatabaseName"
            } else {
                Write-Result -Level "FAIL" -Name "Test database is explicitly test-scoped" -Detail "The configured database name does not contain 'test'."
            }
        } catch {
            Write-Result -Level "FAIL" -Name "Test database is explicitly test-scoped" -Detail "DATABASE_URL could not be parsed."
        }
    } else {
        Write-Result -Level "FAIL" -Name "Test database is explicitly test-scoped" -Detail "DATABASE_URL is absent from backend\.env.test."
    }
} else {
    Write-Result -Level "FAIL" -Name "Test database is explicitly test-scoped" -Detail "backend\.env.test is missing."
}

$PowerShellCommand = Get-Command "powershell.exe" -ErrorAction SilentlyContinue
if ($null -eq $PowerShellCommand) {
    $PowerShellCommand = Get-Command "powershell" -ErrorAction SilentlyContinue
}
$NodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
if ($null -eq $NodeCommand) {
    $NodeCommand = Get-Command "node" -ErrorAction SilentlyContinue
}
$NpmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if ($null -eq $NpmCommand) {
    $NpmCommand = Get-Command "npm" -ErrorAction SilentlyContinue
}

foreach ($ScriptName in @($VerifierName, $InstallerName)) {
    Test-PowerShellParse -Path (Join-Path $script:RepositoryRoot $ScriptName) -Label $ScriptName
}
if (-not [string]::IsNullOrWhiteSpace($script:PackageRoot)) {
    foreach ($ScriptName in @($VerifierName, $InstallerName)) {
        Test-PowerShellParse -Path (Join-Path $script:PackageRoot $ScriptName) -Label ("package\" + $ScriptName)
    }
}

if ($null -eq $NodeCommand) {
    Write-Result -Level "FAIL" -Name "Relevant JavaScript syntax" -Detail "Node.js is unavailable."
} else {
    foreach ($JavaScriptFile in @(
        "assets\js\sourceroot-api.js",
        "assets\js\dictionaryroot-api.js",
        "assets\js\historyroot-api.js",
        "engine\sourceRootApi.js",
        "backend\scripts\register-tsx.mjs",
        "verification\frontend-api-observability.test.cjs"
    )) {
        Invoke-ProcessCheck -Name "JavaScript syntax: $JavaScriptFile" -FilePath $NodeCommand.Source -Arguments @(
            "--check",
            (Join-Path $script:RepositoryRoot $JavaScriptFile)
        ) -WorkingDirectory $script:RepositoryRoot
    }
    if ($null -eq $NpmCommand) {
        Write-Result -Level "FAIL" -Name "Focused frontend API and compatibility tests" -Detail "npm is unavailable."
    } else {
        Invoke-ProcessCheck -Name "Focused frontend API and compatibility tests" -FilePath $NpmCommand.Source -Arguments @(
            "--prefix", "backend", "run", "test:frontend-observability"
        ) -WorkingDirectory $script:RepositoryRoot
    }
}

if ($null -eq $NpmCommand) {
    Write-Result -Level "FAIL" -Name "TypeScript and backend tests" -Detail "npm is unavailable."
} else {
    Invoke-ProcessCheck -Name "Backend TypeScript typecheck" -FilePath $NpmCommand.Source -Arguments @(
        "--prefix", "backend", "run", "typecheck"
    ) -WorkingDirectory $script:RepositoryRoot
    if ($DatabaseIsTestScoped) {
        Invoke-ProcessCheck -Name "Focused correlation, logging, and observer tests" -FilePath $NpmCommand.Source -Arguments @(
            "--prefix", "backend", "run", "test:observability"
        ) -WorkingDirectory $script:RepositoryRoot
        Invoke-ProcessCheck -Name "Chunk 1 focused registry contract tests" -FilePath $NpmCommand.Source -Arguments @(
            "--prefix", "backend", "run", "test:registry-contract"
        ) -WorkingDirectory $script:RepositoryRoot
        Invoke-ProcessCheck -Name "Complete backend test suite" -FilePath $NpmCommand.Source -Arguments @(
            "--prefix", "backend", "test"
        ) -WorkingDirectory $script:RepositoryRoot
    } else {
        Write-Result -Level "FAIL" -Name "Focused correlation, logging, and observer tests" -Detail "Not run because test database scope was not proven."
        Write-Result -Level "FAIL" -Name "Chunk 1 focused registry contract tests" -Detail "Not run because test database scope was not proven."
        Write-Result -Level "FAIL" -Name "Complete backend test suite" -Detail "Not run because test database scope was not proven."
    }
}

if ($null -eq $PowerShellCommand) {
    Write-Result -Level "FAIL" -Name "Nested prior-stage verifiers" -Detail "Windows PowerShell is unavailable."
} else {
    foreach ($Nested in @(
        @("VERIFY-SOURCEROOT-BASELINE.ps1", "Nested SourceRoot baseline verifier"),
        @("VERIFY-DICTIONARYROOT-BASELINE.ps1", "Nested DictionaryRoot baseline verifier"),
        @("VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1", "Nested Chunk 0 contract verifier")
    )) {
        Invoke-ProcessCheck -Name $Nested[1] -FilePath $PowerShellCommand.Source -Arguments @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", (Join-Path $script:RepositoryRoot $Nested[0]),
            "-RepositoryPath", $script:RepositoryRoot
        ) -WorkingDirectory $script:RepositoryRoot
    }

    $GitCommand = Get-Command "git.exe" -ErrorAction SilentlyContinue
    if ($null -eq $GitCommand) {
        $GitCommand = Get-Command "git" -ErrorAction SilentlyContinue
    }
    if ($null -eq $GitCommand) {
        Write-Result -Level "FAIL" -Name "Nested Chunk 1 contract verifier" -Detail "Git is unavailable for the isolated prior-stage snapshot."
    } else {
        $TempParent = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd("\", "/")
        $TempRoot = Join-Path $TempParent ("sourceroot-chunk1-verifier-" + [guid]::NewGuid().ToString("N"))
        $SnapshotRoot = Join-Path $TempRoot "repository"
        $ArchivePath = Join-Path $TempRoot "snapshot.zip"
        $NodeModulesJunction = Join-Path $SnapshotRoot "backend\node_modules"
        $PreviousNodeOptions = $env:NODE_OPTIONS
        try {
            New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
            & $GitCommand.Source "-C" $script:RepositoryRoot "archive" "--format=zip" "--output=$ArchivePath" "HEAD"
            if ($LASTEXITCODE -ne 0) {
                throw "git archive failed with exit code $LASTEXITCODE."
            }
            New-Item -ItemType Directory -Path $SnapshotRoot -Force | Out-Null
            Expand-Archive -LiteralPath $ArchivePath -DestinationPath $SnapshotRoot -Force
            $CurrentChunk1Package = Join-Path $script:RepositoryRoot "SourceRoot-Registry-API-Contract-v1"
            $SnapshotChunk1Package = Join-Path $SnapshotRoot "SourceRoot-Registry-API-Contract-v1"
            foreach ($PackageItem in @(Get-ChildItem -LiteralPath $CurrentChunk1Package -Force)) {
                Copy-Item -LiteralPath $PackageItem.FullName -Destination $SnapshotChunk1Package -Recurse -Force
            }
            $Chunk1Manifest = Get-Content -LiteralPath (Join-Path $CurrentChunk1Package "manifest\stage-manifest.json") -Raw | ConvertFrom-Json
            foreach ($RelativePath in @($Chunk1Manifest.filesAdded) + @($Chunk1Manifest.filesReplaced)) {
                $PriorSource = Join-Path $CurrentChunk1Package ("payload\" + ($RelativePath -replace '/', '\'))
                $PriorDestination = Join-Path $SnapshotRoot ($RelativePath -replace '/', '\')
                New-Item -ItemType Directory -Path (Split-Path -Parent $PriorDestination) -Force | Out-Null
                Copy-Item -LiteralPath $PriorSource -Destination $PriorDestination -Force
            }
            Copy-Item -LiteralPath (Join-Path $script:RepositoryRoot "backend\.env.test") -Destination (Join-Path $SnapshotRoot "backend\.env.test") -Force
            Copy-Item -LiteralPath (Join-Path $script:RepositoryRoot "SourceRoot-Registry-API-Contract-v1.zip") -Destination (Join-Path $SnapshotRoot "SourceRoot-Registry-API-Contract-v1.zip") -Force
            New-Item -ItemType Junction -Path $NodeModulesJunction -Target (Join-Path $script:RepositoryRoot "backend\node_modules") | Out-Null
            $ShimPath = (Join-Path $script:RepositoryRoot "backend\scripts\register-tsx.mjs").Replace("\", "/")
            $env:NODE_OPTIONS = "--import=file:///$ShimPath"
            Invoke-ProcessCheck -Name "Nested Chunk 1 contract verifier" -FilePath $PowerShellCommand.Source -Arguments @(
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", (Join-Path $SnapshotRoot "VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1"),
                "-RepositoryPath", $SnapshotRoot,
                "-PackagePath", (Join-Path $SnapshotRoot "SourceRoot-Registry-API-Contract-v1")
            ) -WorkingDirectory $SnapshotRoot
        } catch {
            Write-Result -Level "FAIL" -Name "Nested Chunk 1 contract verifier" -Detail $_.Exception.Message
        } finally {
            if ($null -eq $PreviousNodeOptions) {
                Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
            } else {
                $env:NODE_OPTIONS = $PreviousNodeOptions
            }
            if (Test-Path -LiteralPath $NodeModulesJunction) {
                [System.IO.Directory]::Delete($NodeModulesJunction, $false)
            }
            $ResolvedTempRoot = [System.IO.Path]::GetFullPath($TempRoot)
            if (
                (Test-Path -LiteralPath $ResolvedTempRoot) -and
                $ResolvedTempRoot.StartsWith($TempParent + "\", [System.StringComparison]::OrdinalIgnoreCase) -and
                $ResolvedTempRoot.Length -gt ($TempParent.Length + 20)
            ) {
                Remove-Item -LiteralPath $ResolvedTempRoot -Recurse -Force
            }
        }
    }
}

$Manifest = $null
if ([string]::IsNullOrWhiteSpace($script:PackageRoot)) {
    Write-Result -Level "FAIL" -Name "Stage package layout" -Detail "Package directory was not found. Pass -PackagePath or assemble $PackageFolderName."
} else {
    $PackageRequired = @(
        "README-FIRST.md",
        $InstallerName,
        $VerifierName,
        "docs\frontend-api-observability-stage.md",
        "docs\FRONTEND-API-OBSERVABILITY-CONTRACT.md",
        "manifest\stage-manifest.json"
    )
    $MissingPackage = @(
        $PackageRequired | Where-Object {
            -not (Test-Path -LiteralPath (Join-Path $script:PackageRoot $_) -PathType Leaf)
        }
    )
    if ($MissingPackage.Count -eq 0) {
        Write-Result -Level "PASS" -Name "Standard package root files exist"
    } else {
        Write-Result -Level "FAIL" -Name "Standard package root files exist" -Detail "Missing: $($MissingPackage -join ', ')"
    }

    $ManifestPath = Join-Path $script:PackageRoot "manifest\stage-manifest.json"
    try {
        $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        $RequiredProperties = @(
            "schemaVersion", "stageName", "stageVersion", "createdDate",
            "targetRepository", "requiredPreviousStage", "filesAdded",
            "filesReplaced", "filesIntentionallyUntouched", "migrations",
            "apisChanged", "frontendPagesChanged", "documentationChanged",
            "installerFilename", "verifierFilename", "rollbackInstructions",
            "knownLimitations", "explicitExclusions", "acceptanceChecks",
            "payloadHashes"
        )
        $MissingProperties = @(
            $RequiredProperties | Where-Object {
                $Manifest.PSObject.Properties.Name -notcontains $_
            }
        )
        $IdentityOkay = (
            $Manifest.stageName -eq "SourceRoot-Frontend-API-Observability" -and
            $Manifest.stageVersion -eq "v1" -and
            $Manifest.installerFilename -eq $InstallerName -and
            $Manifest.verifierFilename -eq $VerifierName
        )
        if ($MissingProperties.Count -eq 0 -and $IdentityOkay) {
            Write-Result -Level "PASS" -Name "Package manifest parses with required fields"
        } else {
            Write-Result -Level "FAIL" -Name "Package manifest parses with required fields" -Detail "Missing: $($MissingProperties -join ', '); identity valid: $IdentityOkay"
        }
    } catch {
        Write-Result -Level "FAIL" -Name "Package manifest parses with required fields" -Detail $_.Exception.Message
    }

    if ($null -ne $Manifest) {
        if (@($Manifest.migrations).Count -eq 0) {
            Write-Result -Level "PASS" -Name "No database migration added"
        } else {
            Write-Result -Level "FAIL" -Name "No database migration added" -Detail "Manifest lists migrations."
        }
        if (
            (@($Manifest.explicitExclusions) -join " ").IndexOf("automatic", [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
            (@($Manifest.explicitExclusions) -join " ").IndexOf("Level 2", [System.StringComparison]::OrdinalIgnoreCase) -ge 0
        ) {
            Write-Result -Level "PASS" -Name "Excluded future features remain documented and absent"
        } else {
            Write-Result -Level "FAIL" -Name "Excluded future features remain documented and absent" -Detail "Required exclusion markers are missing."
        }

        $PayloadRoot = Join-Path $script:PackageRoot "payload"
        $ExpectedPaths = @($Manifest.filesAdded) + @($Manifest.filesReplaced)
        $PayloadFiles = @(
            Get-ChildItem -LiteralPath $PayloadRoot -Recurse -File | ForEach-Object {
                $_.FullName.Substring($PayloadRoot.Length).TrimStart("\", "/").Replace("\", "/")
            }
        )
        $MissingPayload = @($ExpectedPaths | Where-Object { $PayloadFiles -notcontains $_ })
        $UnexpectedPayload = @($PayloadFiles | Where-Object { $ExpectedPaths -notcontains $_ })
        if ($MissingPayload.Count -eq 0 -and $UnexpectedPayload.Count -eq 0) {
            Write-Result -Level "PASS" -Name "Package payload matches manifest" -Detail "$($PayloadFiles.Count) complete files."
        } else {
            Write-Result -Level "FAIL" -Name "Package payload matches manifest" -Detail "Missing: $($MissingPayload -join ', '); unexpected: $($UnexpectedPayload -join ', ')"
        }

        $HashFailures = New-Object System.Collections.Generic.List[string]
        $InstalledHashFailures = New-Object System.Collections.Generic.List[string]
        foreach ($HashEntry in @($Manifest.payloadHashes)) {
            $PayloadFile = Join-Path $PayloadRoot ($HashEntry.path -replace '/', '\')
            $InstalledFile = Join-Path $script:RepositoryRoot ($HashEntry.path -replace '/', '\')
            if (-not (Test-Path -LiteralPath $PayloadFile -PathType Leaf)) {
                $HashFailures.Add("$($HashEntry.path): missing")
                continue
            }
            $ExpectedHash = ([string]$HashEntry.sha256).ToLowerInvariant()
            $ActualHash = (Get-FileHash -LiteralPath $PayloadFile -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($ActualHash -ne $ExpectedHash) {
                $HashFailures.Add("$($HashEntry.path): hash mismatch")
            }
            if (-not (Test-Path -LiteralPath $InstalledFile -PathType Leaf)) {
                $InstalledHashFailures.Add("$($HashEntry.path): missing")
            } else {
                $InstalledHash = (Get-FileHash -LiteralPath $InstalledFile -Algorithm SHA256).Hash.ToLowerInvariant()
                if ($InstalledHash -ne $ExpectedHash) {
                    $InstalledHashFailures.Add("$($HashEntry.path): differs from payload")
                }
            }
        }
        if ($HashFailures.Count -eq 0 -and @($Manifest.payloadHashes).Count -eq $ExpectedPaths.Count) {
            Write-Result -Level "PASS" -Name "Package payload hashes match manifest"
        } else {
            Write-Result -Level "FAIL" -Name "Package payload hashes match manifest" -Detail (($HashFailures.ToArray()) -join "; ")
        }
        if ($InstalledHashFailures.Count -eq 0) {
            Write-Result -Level "PASS" -Name "Installed files match packaged payload hashes"
        } else {
            Write-Result -Level "FAIL" -Name "Installed files match packaged payload hashes" -Detail (($InstalledHashFailures.ToArray()) -join "; ")
        }

        $SecretPattern = '(?im)^\s*(?:DATABASE_URL|PASSWORD|SECRET|API_KEY|ACCESS_TOKEN|PRIVATE_KEY)\s*=\s*(?!\s*(?:none|null|redacted|placeholder|test-placeholder)\s*$).+$|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
        $SecretFindings = New-Object System.Collections.Generic.List[string]
        foreach ($RelativePath in $ExpectedPaths) {
            $Candidate = Join-Path $PayloadRoot ($RelativePath -replace '/', '\')
            $Extension = [System.IO.Path]::GetExtension($Candidate).ToLowerInvariant()
            if ($Extension -notin @(".ts", ".js", ".mjs", ".cjs", ".json", ".md", ".ps1", ".html")) { continue }
            $Text = Get-Content -LiteralPath $Candidate -Raw
            if ([regex]::IsMatch($Text, $SecretPattern)) {
                $SecretFindings.Add($RelativePath)
            }
        }
        if ($SecretFindings.Count -eq 0) {
            Write-Result -Level "PASS" -Name "Package contains no obvious secrets"
        } else {
            Write-Result -Level "FAIL" -Name "Package contains no obvious secrets" -Detail ($SecretFindings.ToArray() -join ", ")
        }
    }
}

$ZipCandidates = New-Object System.Collections.Generic.List[string]
$ZipCandidates.Add((Join-Path $script:RepositoryRoot ($PackageFolderName + ".zip")))
if (-not [string]::IsNullOrWhiteSpace($script:PackageRoot)) {
    $ZipCandidates.Add((Join-Path (Split-Path -Parent $script:PackageRoot) ($PackageFolderName + ".zip")))
}
$ZipPath = $ZipCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if ($null -eq $ZipPath) {
    Write-Result -Level "FAIL" -Name "ZIP structure" -Detail "Missing $PackageFolderName.zip"
} else {
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $Archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
        try {
            $Entries = @($Archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
            $BadTopLevel = @(
                $Entries | Where-Object {
                    -not $_.StartsWith($PackageFolderName + "/", [System.StringComparison]::Ordinal)
                }
            )
            $RequiredZipEntries = @(
                "$PackageFolderName/README-FIRST.md",
                "$PackageFolderName/manifest/stage-manifest.json",
                "$PackageFolderName/payload/assets/js/sourceroot-api.js",
                "$PackageFolderName/payload/docs/build/FRONTEND-API-OBSERVABILITY-CONTRACT.md",
                "$PackageFolderName/$InstallerName",
                "$PackageFolderName/$VerifierName"
            )
            $MissingZipEntries = @(
                $RequiredZipEntries | Where-Object { $Entries -notcontains $_ }
            )
            if ($BadTopLevel.Count -eq 0 -and $MissingZipEntries.Count -eq 0) {
                Write-Result -Level "PASS" -Name "ZIP structure" -Detail "One expected top-level folder with required files."
            } else {
                Write-Result -Level "FAIL" -Name "ZIP structure" -Detail "Bad top-level: $($BadTopLevel -join ', '); missing: $($MissingZipEntries -join ', ')"
            }
        } finally {
            $Archive.Dispose()
        }
    } catch {
        Write-Result -Level "FAIL" -Name "ZIP structure" -Detail $_.Exception.Message
    }
}

Write-Host ""
Write-Host "Frontend API and observability verification summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host "Info:     $script:Info"
if ($script:Failed -gt 0) { exit 1 }
exit 0
