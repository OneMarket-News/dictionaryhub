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
$PackageFolderName = "SourceRoot-Registry-API-Contract-v1"

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
    param(
        [string]$RelativePath,
        [string[]]$Headings
    )

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
    param(
        [string]$RelativePath,
        [string[]]$Markers,
        [string]$Name
    )

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

Write-Host "SourceRoot Registry API Contract v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:RepositoryRoot"
if (-not [string]::IsNullOrWhiteSpace($script:PackageRoot)) {
    Write-Host "Package:    $script:PackageRoot"
}
Write-Host ""
Write-Result -Level "INFO" -Name "Static checks" -Detail "Files, documentation, source integration, syntax, manifest, hashes, ZIP, and secret patterns are checked."
Write-Result -Level "INFO" -Name "Test-database checks" -Detail "The focused and full backend suites use backend\.env.test only after its database name is confirmed test-scoped."
Write-Result -Level "INFO" -Name "In-process API checks" -Detail "Supertest exercises the Express application in process."
Write-Result -Level "INFO" -Name "Independent live API checks" -Detail "Not performed. No separately running backend is called."
Write-Result -Level "INFO" -Name "Browser checks" -Detail "Not performed. No browser is opened."

$RequiredFiles = @(
    "backend\src\lib\api-contract.ts",
    "backend\src\lib\query-params.ts",
    "backend\test\registry-api-contract.test.ts",
    "docs\build\REGISTRY-API-CONTRACT.md",
    "docs\build\registry-api-contract-stage.md",
    "docs\build\CURRENT-SOURCEROOT-STATE.md",
    "VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1",
    "INSTALL-SOURCEROOT-REGISTRY-API-CONTRACT.ps1"
)
Test-RequiredFiles -RelativePaths $RequiredFiles

Test-DocumentHeadings -RelativePath "docs\build\REGISTRY-API-CONTRACT.md" -Headings @(
    "Collection Response Requirements",
    "Pagination Requirements",
    "Filtering Requirements",
    "Sorting Requirements",
    "Error Contract",
    "Registry Metadata",
    "Archive and Deprecation Conventions",
    "Route-Contract Matrix",
    "Compatibility Rules",
    "Deferred Exceptions"
)

Test-TextMarkers -RelativePath "backend\src\lib\api-contract.ts" -Name "Shared collection and error utilities" -Markers @(
    "REGISTRY_API_CONTRACT_VERSION",
    "withCollectionContract",
    "createApiError",
    "safeValidationDetails"
)
Test-TextMarkers -RelativePath "backend\src\lib\query-params.ts" -Name "Shared query utilities" -Markers @(
    "parseNonNegativeInteger",
    "clampLimit",
    "parseSort",
    "normalizeFilters",
    "getUnsupportedQueryParameters"
)

foreach ($Route in @(
    "nodes.ts",
    "assertions.ts",
    "edges.ts",
    "sources.ts",
    "revisions.ts",
    "import.ts",
    "search.ts",
    "context.ts",
    "bundles.ts"
)) {
    Test-TextMarkers -RelativePath ("backend\src\routes\" + $Route) -Name "Shared contract route integration: $Route" -Markers @(
        "withCollectionContract",
        "parseSort"
    )
}

Test-TextMarkers -RelativePath "backend\test\registry-api-contract.test.ts" -Name "Focused compatibility coverage" -Markers @(
    "legacy keys",
    "unknown filters",
    "stable ties",
    "source-linked",
    "internal errors"
)

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

foreach ($ScriptName in @(
    "VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1",
    "INSTALL-SOURCEROOT-REGISTRY-API-CONTRACT.ps1"
)) {
    Test-PowerShellParse -Path (Join-Path $script:RepositoryRoot $ScriptName) -Label $ScriptName
}

if (-not [string]::IsNullOrWhiteSpace($script:PackageRoot)) {
    foreach ($ScriptName in @(
        "VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1",
        "INSTALL-SOURCEROOT-REGISTRY-API-CONTRACT.ps1"
    )) {
        Test-PowerShellParse -Path (Join-Path $script:PackageRoot $ScriptName) -Label ("package\" + $ScriptName)
    }
}

if ($null -eq $NodeCommand) {
    Write-Result -Level "FAIL" -Name "Relevant JavaScript syntax" -Detail "Node.js is unavailable."
} else {
    foreach ($JavaScriptFile in @(
        "assets\js\dictionaryroot-api.js",
        "assets\js\historyroot-api.js"
    )) {
        Invoke-ProcessCheck -Name "JavaScript syntax: $JavaScriptFile" -FilePath $NodeCommand.Source -Arguments @(
            "--check",
            (Join-Path $script:RepositoryRoot $JavaScriptFile)
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
        Invoke-ProcessCheck -Name "Focused registry contract tests" -FilePath $NpmCommand.Source -Arguments @(
            "--prefix", "backend", "run", "test:registry-contract"
        ) -WorkingDirectory $script:RepositoryRoot
        Invoke-ProcessCheck -Name "Complete backend test suite" -FilePath $NpmCommand.Source -Arguments @(
            "--prefix", "backend", "test"
        ) -WorkingDirectory $script:RepositoryRoot
    } else {
        Write-Result -Level "FAIL" -Name "Focused registry contract tests" -Detail "Not run because test database scope was not proven."
        Write-Result -Level "FAIL" -Name "Complete backend test suite" -Detail "Not run because test database scope was not proven."
    }
}

if ($null -eq $PowerShellCommand) {
    Write-Result -Level "FAIL" -Name "Nested baseline verifiers" -Detail "Windows PowerShell is unavailable."
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
}

if ([string]::IsNullOrWhiteSpace($script:PackageRoot)) {
    Write-Result -Level "FAIL" -Name "Stage package layout" -Detail "Package directory was not found. Pass -PackagePath or assemble $PackageFolderName."
} else {
    $PackageRequired = @(
        "README-FIRST.md",
        "INSTALL-SOURCEROOT-REGISTRY-API-CONTRACT.ps1",
        "VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1",
        "docs\registry-api-contract-stage.md",
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
    $Manifest = $null
    try {
        $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        $RequiredProperties = @(
            "schemaVersion",
            "stageName",
            "stageVersion",
            "createdDate",
            "targetRepository",
            "requiredPreviousStage",
            "filesAdded",
            "filesReplaced",
            "filesIntentionallyUntouched",
            "migrations",
            "apisChanged",
            "frontendPagesChanged",
            "documentationChanged",
            "installerFilename",
            "verifierFilename",
            "rollbackInstructions",
            "knownLimitations",
            "explicitExclusions",
            "acceptanceChecks",
            "payloadHashes"
        )
        $MissingProperties = @(
            $RequiredProperties | Where-Object {
                $Manifest.PSObject.Properties.Name -notcontains $_
            }
        )
        $IdentityOkay = (
            $Manifest.stageName -eq "SourceRoot-Registry-API-Contract" -and
            $Manifest.stageVersion -eq "v1" -and
            $Manifest.installerFilename -eq "INSTALL-SOURCEROOT-REGISTRY-API-CONTRACT.ps1" -and
            $Manifest.verifierFilename -eq "VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1"
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
        foreach ($HashEntry in @($Manifest.payloadHashes)) {
            $PayloadFile = Join-Path $PayloadRoot ($HashEntry.path -replace '/', '\')
            if (-not (Test-Path -LiteralPath $PayloadFile -PathType Leaf)) {
                $HashFailures.Add("$($HashEntry.path): missing")
                continue
            }
            $ActualHash = (Get-FileHash -LiteralPath $PayloadFile -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($ActualHash -ne ([string]$HashEntry.sha256).ToLowerInvariant()) {
                $HashFailures.Add("$($HashEntry.path): hash mismatch")
            }
        }
        if ($HashFailures.Count -eq 0 -and @($Manifest.payloadHashes).Count -eq $ExpectedPaths.Count) {
            Write-Result -Level "PASS" -Name "Package payload hashes match manifest"
        } else {
            Write-Result -Level "FAIL" -Name "Package payload hashes match manifest" -Detail (($HashFailures.ToArray()) -join "; ")
        }

        $InstalledHashFailures = New-Object System.Collections.Generic.List[string]
        foreach ($HashEntry in @($Manifest.payloadHashes)) {
            $InstalledFile = Join-Path $script:RepositoryRoot ($HashEntry.path -replace '/', '\')
            if (-not (Test-Path -LiteralPath $InstalledFile -PathType Leaf)) {
                $InstalledHashFailures.Add("$($HashEntry.path): missing")
                continue
            }
            $InstalledHash = (Get-FileHash -LiteralPath $InstalledFile -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($InstalledHash -ne ([string]$HashEntry.sha256).ToLowerInvariant()) {
                $InstalledHashFailures.Add("$($HashEntry.path): differs from payload")
            }
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
            if ($Extension -notin @(".ts", ".js", ".json", ".md", ".ps1")) { continue }
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

$ZipPath = Join-Path $script:RepositoryRoot ($PackageFolderName + ".zip")
if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) {
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
                "$PackageFolderName/payload/docs/build/REGISTRY-API-CONTRACT.md",
                "$PackageFolderName/INSTALL-SOURCEROOT-REGISTRY-API-CONTRACT.ps1",
                "$PackageFolderName/VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1"
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
Write-Host "Registry API contract verification summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host "Info:     $script:Info"

if ($script:Failed -gt 0) {
    exit 1
}
exit 0
