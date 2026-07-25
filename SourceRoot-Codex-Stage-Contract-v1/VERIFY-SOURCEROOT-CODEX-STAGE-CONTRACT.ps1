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
    if (-not [string]::IsNullOrWhiteSpace($Detail)) { Write-Host "       $Detail" }
}

function Resolve-RepositoryRoot {
    $Candidates = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($RepositoryPath)) { $Candidates.Add($RepositoryPath) }
    $Candidates.Add($PSScriptRoot)
    $Candidates.Add((Get-Location).Path)
    $Candidates.Add($DefaultRepository)
    foreach ($Candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }
        if (-not (Test-Path -LiteralPath $Candidate -PathType Container)) { continue }
        $Resolved = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Candidate).Path)
        if (
            (Test-Path -LiteralPath (Join-Path $Resolved "backend\src\app.ts") -PathType Leaf) -and
            (Test-Path -LiteralPath (Join-Path $Resolved "index.html") -PathType Leaf)
        ) {
            return $Resolved.TrimEnd("\", "/")
        }
    }
    throw "Could not locate the target dictionaryhub repository."
}

function Test-Headings {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string[]]$Headings
    )
    $Path = Join-Path $script:RepositoryRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Result -Level "FAIL" -Name "$RelativePath required headings" -Detail "File is missing."
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
        Write-Result -Level "PASS" -Name "$RelativePath required headings"
    } else {
        Write-Result -Level "FAIL" -Name "$RelativePath required headings" -Detail "Missing: $($Missing -join ', ')"
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
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $Path = Join-Path $script:RepositoryRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Result -Level "FAIL" -Name "PowerShell parse: $RelativePath" -Detail "File is missing."
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
        Write-Result -Level "PASS" -Name "PowerShell parse: $RelativePath"
    } else {
        Write-Result -Level "FAIL" -Name "PowerShell parse: $RelativePath" -Detail (($ParseErrors | ForEach-Object { $_.Message }) -join "; ")
    }
}

function Invoke-NestedVerifier {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$Name
    )
    $VerifierPath = Join-Path $script:RepositoryRoot $RelativePath
    if (-not (Test-Path -LiteralPath $VerifierPath -PathType Leaf)) {
        Write-Result -Level "FAIL" -Name $Name -Detail "Missing nested verifier: $RelativePath"
        return
    }
    $PowerShellCommand = Get-Command "powershell.exe" -ErrorAction SilentlyContinue
    if ($null -eq $PowerShellCommand) {
        $PowerShellCommand = Get-Command "powershell" -ErrorAction SilentlyContinue
    }
    if ($null -eq $PowerShellCommand) {
        Write-Result -Level "FAIL" -Name $Name -Detail "Windows PowerShell was not available to run the nested verifier."
        return
    }
    Write-Host ""
    Write-Host "---- $Name output ----" -ForegroundColor DarkCyan
    & $PowerShellCommand.Source -NoProfile -ExecutionPolicy Bypass -File $VerifierPath -RepositoryPath $script:RepositoryRoot
    $NestedExitCode = $LASTEXITCODE
    Write-Host "---- end nested output ----" -ForegroundColor DarkCyan
    if ($NestedExitCode -eq 0) {
        Write-Result -Level "PASS" -Name $Name
    } else {
        Write-Result -Level "FAIL" -Name $Name -Detail "Nested verifier exit code: $NestedExitCode"
    }
}

try {
    $script:RepositoryRoot = Resolve-RepositoryRoot
} catch {
    Write-Result -Level "FAIL" -Name "Repository location" -Detail $_.Exception.Message
    exit 2
}

if ([string]::IsNullOrWhiteSpace($PackagePath)) {
    if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "payload") -PathType Container) {
        $PackagePath = $PSScriptRoot
    }
}

Write-Host "SourceRoot Codex Stage Contract v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $script:RepositoryRoot"
if (-not [string]::IsNullOrWhiteSpace($PackagePath)) {
    Write-Host "Package:    $PackagePath"
}
Write-Host ""
Write-Result -Level "INFO" -Name "Verification mode" -Detail "Static contract, package, script, and nested baseline verification. No browser is opened and no live API or database is used."

$RequiredChunkFiles = @(
    "docs\build\CODEX-STAGE-CONTRACT.md",
    "docs\build\CURRENT-SOURCEROOT-STATE.md",
    "docs\build\STAGE-PACKAGE-STANDARD.md",
    "docs\build\AGENT-SAFETY-BASELINE.md",
    "docs\build\SOURCEROOT-BASELINE-MANIFEST.json",
    "VERIFY-SOURCEROOT-BASELINE.ps1",
    "VERIFY-DICTIONARYROOT-BASELINE.ps1",
    "VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1",
    "INSTALL-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1",
    "docs\build\codex-stage-contract-stage.md"
)
$MissingChunkFiles = @(
    $RequiredChunkFiles | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot $_) -PathType Leaf)
    }
)
if ($MissingChunkFiles.Count -eq 0) {
    Write-Result -Level "PASS" -Name "All required Chunk 0 repository files exist" -Detail "$($RequiredChunkFiles.Count) files found."
} else {
    Write-Result -Level "FAIL" -Name "All required Chunk 0 repository files exist" -Detail "Missing: $($MissingChunkFiles -join ', ')"
}

Test-Headings -RelativePath "docs\build\CODEX-STAGE-CONTRACT.md" -Headings @(
    "Source-of-Truth Rules",
    "Scope Rules",
    "Preservation Rules",
    "File-Delivery Rules",
    "Installer Rules",
    "Verification Rules",
    "Documentation Rules",
    "Final-Report Rules"
)
Test-Headings -RelativePath "docs\build\CURRENT-SOURCEROOT-STATE.md" -Headings @(
    "Repository Structure",
    "Technical Stack",
    "Current Backend Capabilities",
    "Current Frontend Experiences",
    "Current Verification Coverage",
    "Current Known Limitations",
    "Current Roadmap Position",
    "Next Dependency"
)
Test-Headings -RelativePath "docs\build\STAGE-PACKAGE-STANDARD.md" -Headings @(
    "Standard Package Layout",
    "Stage Manifest Schema",
    "Naming Conventions",
    "Versioning",
    "Current-State Update Rule"
)
Test-Headings -RelativePath "docs\build\AGENT-SAFETY-BASELINE.md" -Headings @(
    "Core Principle",
    "Autonomy Ladder",
    "Required Safeguards",
    "Permanently Human-Controlled Actions",
    "Required Agent Audit Record"
)

Test-TextMarkers -RelativePath "docs\build\CODEX-STAGE-CONTRACT.md" -Name "Permanent contract source-of-truth rules" -Markers @(
    "current repository",
    "older package",
    "Backups are historical recovery material",
    "Inspect current files",
    "Never replace a working system"
)
Test-TextMarkers -RelativePath "docs\build\CODEX-STAGE-CONTRACT.md" -Name "Permanent contract backup and installer rules" -Markers @(
    "Back up every file it replaces",
    "unique timestamped backup directory",
    "Report files added and replaced"
)
Test-TextMarkers -RelativePath "docs\build\CODEX-STAGE-CONTRACT.md" -Name "Permanent contract verification honesty rules" -Markers @(
    "Never claim browser verification",
    "Never claim live API verification",
    "Never hide failed checks",
    "Never weaken an expected result"
)
Test-TextMarkers -RelativePath "docs\build\AGENT-SAFETY-BASELINE.md" -Name "Agent baseline autonomy ladder" -Markers @(
    "Level 0",
    "Manual Operation",
    "Level 1",
    "AI Observation",
    "Level 2",
    "AI Recommendation",
    "Level 3",
    "Supervised Execution",
    "Level 4",
    "Bounded Autonomy",
    "Level 5",
    "Multi-Agent Operations"
)
Test-TextMarkers -RelativePath "docs\build\AGENT-SAFETY-BASELINE.md" -Name "Agent baseline untrusted-input protections" -Markers @(
    "Imported source content is untrusted input",
    "Prompt-Injection Protection",
    "Poisoned-Source Protection",
    "must never be treated as an operational instruction"
)
Test-TextMarkers -RelativePath "docs\build\AGENT-SAFETY-BASELINE.md" -Name "Agent baseline permanently human-controlled actions" -Markers @(
    "Approve contracts",
    "Delete conflicting evidence",
    "Expand their own permissions",
    "Delete production databases",
    "Approve their own actions"
)
Test-TextMarkers -RelativePath "docs\build\CURRENT-SOURCEROOT-STATE.md" -Name "Current-state record identifies the next stage" -Markers @(
    "SourceRoot Chunk 1",
    "Registry and API Contract Standardization"
)

$BaselineManifestPath = Join-Path $script:RepositoryRoot "docs\build\SOURCEROOT-BASELINE-MANIFEST.json"
if (Test-Path -LiteralPath $BaselineManifestPath -PathType Leaf) {
    try {
        $BaselineManifestText = Get-Content -LiteralPath $BaselineManifestPath -Raw
        $BaselineManifest = $BaselineManifestText | ConvertFrom-Json
        $RequiredManifestProperties = @(
            "repositoryPath",
            "baselineCreationDate",
            "backendEntryPoints",
            "frontendEntryPoints",
            "dictionaryRootPages",
            "migrationFiles",
            "existingTests",
            "existingInstallers",
            "existingVerifiers",
            "requiredRuntimeFiles",
            "filesFutureStagesMustPreserve",
            "currentRoadmapPosition",
            "nextStageDependency"
        )
        $MissingProperties = @(
            $RequiredManifestProperties | Where-Object {
                $BaselineManifest.PSObject.Properties.Name -notcontains $_
            }
        )
        if ($MissingProperties.Count -eq 0) {
            Write-Result -Level "PASS" -Name "Baseline manifest is valid JSON with required fields"
        } else {
            Write-Result -Level "FAIL" -Name "Baseline manifest is valid JSON with required fields" -Detail "Missing properties: $($MissingProperties -join ', ')"
        }

        $SecretAssignmentPattern = '(?i)"(?:password|secret|token|api[_-]?key|connection[_-]?string)"\s*:\s*"(?!\s*(?:none|null|redacted|not stored)\s*")[^"]+"'
        if ([regex]::IsMatch($BaselineManifestText, $SecretAssignmentPattern)) {
            Write-Result -Level "FAIL" -Name "Baseline manifest contains no obvious secrets" -Detail "A secret-like JSON assignment was detected."
        } else {
            Write-Result -Level "PASS" -Name "Baseline manifest contains no obvious secrets"
        }
    } catch {
        Write-Result -Level "FAIL" -Name "Baseline manifest is valid JSON with required fields" -Detail $_.Exception.Message
    }
} else {
    Write-Result -Level "FAIL" -Name "Baseline manifest is valid JSON with required fields" -Detail "Manifest is missing."
}

foreach ($Script in @(
    "VERIFY-SOURCEROOT-BASELINE.ps1",
    "VERIFY-DICTIONARYROOT-BASELINE.ps1",
    "VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1",
    "INSTALL-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1"
)) {
    Test-PowerShellParse -RelativePath $Script
}

$StageDocument = Join-Path $script:RepositoryRoot "docs\build\codex-stage-contract-stage.md"
if (Test-Path -LiteralPath $StageDocument -PathType Leaf) {
    Write-Result -Level "PASS" -Name "Stage documentation exists"
} else {
    Write-Result -Level "FAIL" -Name "Stage documentation exists" -Detail "Missing docs\build\codex-stage-contract-stage.md"
}

if (-not [string]::IsNullOrWhiteSpace($PackagePath)) {
    if (-not (Test-Path -LiteralPath $PackagePath -PathType Container)) {
        Write-Result -Level "FAIL" -Name "Stage package inspection" -Detail "Package path does not exist: $PackagePath"
    } else {
        $ResolvedPackage = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PackagePath).Path).TrimEnd("\", "/")
        $PackageRequired = @(
            "README-FIRST.md",
            "INSTALL-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1",
            "VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1",
            "docs\codex-stage-contract-stage.md",
            "manifest\stage-manifest.json"
        )
        $MissingPackageFiles = @(
            $PackageRequired | Where-Object {
                -not (Test-Path -LiteralPath (Join-Path $ResolvedPackage $_) -PathType Leaf)
            }
        )
        if ($MissingPackageFiles.Count -eq 0) {
            Write-Result -Level "PASS" -Name "Standard package root files exist"
        } else {
            Write-Result -Level "FAIL" -Name "Standard package root files exist" -Detail "Missing: $($MissingPackageFiles -join ', ')"
        }

        $PayloadRoot = Join-Path $ResolvedPackage "payload"
        if (Test-Path -LiteralPath $PayloadRoot -PathType Container) {
            $PayloadFiles = @(
                Get-ChildItem -LiteralPath $PayloadRoot -Recurse -File | ForEach-Object {
                    $_.FullName.Substring($PayloadRoot.Length).TrimStart("\", "/").Replace("\", "/")
                }
            )
            $ExpectedPayloadFiles = @(
                $RequiredChunkFiles | ForEach-Object { $_.Replace("\", "/") }
            )
            $UnexpectedPayload = @($PayloadFiles | Where-Object { $ExpectedPayloadFiles -notcontains $_ })
            $MissingPayload = @($ExpectedPayloadFiles | Where-Object { $PayloadFiles -notcontains $_ })
            if ($UnexpectedPayload.Count -eq 0 -and $MissingPayload.Count -eq 0) {
                Write-Result -Level "PASS" -Name "Package payload is limited to complete Chunk 0 files" -Detail "$($PayloadFiles.Count) payload files match the allow-list."
            } else {
                Write-Result -Level "FAIL" -Name "Package payload is limited to complete Chunk 0 files" -Detail "Unexpected: $($UnexpectedPayload -join ', '); missing: $($MissingPayload -join ', ')"
            }

            $FutureImplementation = @(
                $PayloadFiles | Where-Object {
                    $_ -match '(^|/)(backend|assets|data|config)/' -or
                    $_ -match '\.(ts|js|mjs|sql|html|css)$'
                }
            )
            if ($FutureImplementation.Count -eq 0) {
                Write-Result -Level "PASS" -Name "Package introduces no future-phase implementation files"
            } else {
                Write-Result -Level "FAIL" -Name "Package introduces no future-phase implementation files" -Detail "Implementation-like payload: $($FutureImplementation -join ', ')"
            }
        } else {
            Write-Result -Level "FAIL" -Name "Package payload exists" -Detail "Missing payload directory."
        }

        $StageManifestPath = Join-Path $ResolvedPackage "manifest\stage-manifest.json"
        if (Test-Path -LiteralPath $StageManifestPath -PathType Leaf) {
            try {
                $StageManifest = Get-Content -LiteralPath $StageManifestPath -Raw | ConvertFrom-Json
                $StageManifestOkay = (
                    $StageManifest.stageName -eq "SourceRoot-Codex-Stage-Contract" -and
                    $StageManifest.stageVersion -eq "v1" -and
                    $StageManifest.installerFilename -eq "INSTALL-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1" -and
                    $StageManifest.verifierFilename -eq "VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1"
                )
                if ($StageManifestOkay) {
                    Write-Result -Level "PASS" -Name "Package stage manifest is valid"
                } else {
                    Write-Result -Level "FAIL" -Name "Package stage manifest is valid" -Detail "Stage identity or script filenames do not match Chunk 0."
                }
            } catch {
                Write-Result -Level "FAIL" -Name "Package stage manifest is valid" -Detail $_.Exception.Message
            }
        }
    }
} else {
    Write-Result -Level "WARN" -Name "Stage package layout not inspected" -Detail "Pass -PackagePath after the package is assembled. Repository deliverables are still checked."
    $ImplementationLikeChunkFiles = @(
        $RequiredChunkFiles | Where-Object { $_ -match '\.(ts|js|mjs|sql|html|css)$' }
    )
    if ($ImplementationLikeChunkFiles.Count -eq 0) {
        Write-Result -Level "PASS" -Name "Repository Chunk 0 deliverables introduce no runtime implementation files"
    } else {
        Write-Result -Level "FAIL" -Name "Repository Chunk 0 deliverables introduce no runtime implementation files" -Detail ($ImplementationLikeChunkFiles -join ", ")
    }
}

Invoke-NestedVerifier -RelativePath "VERIFY-SOURCEROOT-BASELINE.ps1" -Name "Nested SourceRoot baseline verifier"
Invoke-NestedVerifier -RelativePath "VERIFY-DICTIONARYROOT-BASELINE.ps1" -Name "Nested DictionaryRoot baseline verifier"

Write-Result -Level "INFO" -Name "Browser checks" -Detail "Not performed. No browser was used."
Write-Result -Level "INFO" -Name "Live API checks" -Detail "Not performed. No API was called."
Write-Result -Level "INFO" -Name "Database checks" -Detail "Not performed. No PostgreSQL connection was made."

Write-Host ""
Write-Host "Stage contract verification summary" -ForegroundColor Cyan
Write-Host "Passed:   $script:Passed"
Write-Host "Failed:   $script:Failed"
Write-Host "Warnings: $script:Warnings"
Write-Host "Info:     $script:Info"

if ($script:Failed -gt 0) {
    exit 1
}
exit 0
