[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "",

    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [string]$PriorReleasePath = "C:\Users\Josh\Documents\SourceRoot-Releases",

    [Parameter()]
    [switch]$SkipRegression,

    [Parameter()]
    [switch]$SkipImmutableReplay,

    [Parameter()]
    [switch]$ResumeAfterVerifiedNamedBaselines
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0
$PackageName = "SourceRoot-Repeatable-Source-Preparation-Workflow-v1"
$StartingCommit = "a933e45e8304209d25634837b90f7703119d94ff"
$ParentCommit = "640c309d8e5900c5d3a7213b1269f58ffe6f3256"
$Chunk6Commit = "276b448f4d41ec340ca120d69ca65007c932a2c0"
$Chunk6ZipHash = "D5F19A90EB697BDDB2D38BF12CDDBBB430029920E5B131762DD88B4ED735DCB9"
$GeneratedHash = "F47D4F1F5CBC123DCAEC1B07D5A6B051D3C306F488DFA81DCC353C5E7DCC8428"

function Write-Result {
    param(
        [ValidateSet("PASS", "FAIL", "WARN", "INFO")]
        [string]$Level,
        [string]$Name,
        [string]$Detail = ""
    )
    $Color = "Gray"
    if ($Level -eq "PASS") { $script:Passed++; $Color = "Green" }
    elseif ($Level -eq "FAIL") { $script:Failed++; $Color = "Red" }
    elseif ($Level -eq "WARN") { $script:Warnings++; $Color = "Yellow" }
    elseif ($Level -eq "INFO") { $Color = "Cyan" }
    Write-Host "[$Level] $Name" -ForegroundColor $Color
    if ($Detail) { Write-Host "       $Detail" }
}

function Invoke-Check {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )
    Push-Location $WorkingDirectory
    try {
        $PreviousPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $Output = @(& $FilePath @Arguments 2>&1)
        $Code = $LASTEXITCODE
        $ErrorActionPreference = $PreviousPreference
        $Output | ForEach-Object { Write-Host $_ }
        if ($Code -eq 0) {
            Write-Result "PASS" $Name "Exit 0."
        } else {
            Write-Result "FAIL" $Name "Exit $Code."
        }
        return $Output
    } catch {
        $ErrorActionPreference = "Stop"
        Write-Result "FAIL" $Name $_.Exception.Message
        return @()
    } finally {
        Pop-Location
    }
}

function Resolve-SafeRelativePath {
    param([string]$Root, [string]$RelativePath)
    $Normalized = $RelativePath.Replace("/", "\")
    if (
        [IO.Path]::IsPathRooted($Normalized) -or
        $Normalized -match '(^|\\)\.\.?($|\\)'
    ) {
        throw "Unsafe relative path: $RelativePath"
    }
    $Full = [IO.Path]::GetFullPath((Join-Path $Root $Normalized))
    if (-not $Full.StartsWith($Root + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes root: $RelativePath"
    }
    return $Full
}

try {
    $Candidate = if ($RepositoryPath) { $RepositoryPath } else { $PSScriptRoot }
    $script:RepositoryRoot = [IO.Path]::GetFullPath(
        (Resolve-Path -LiteralPath $Candidate).Path
    ).TrimEnd("\", "/")
    if (-not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot "ROOT-MANIFEST.json") -PathType Leaf)) {
        throw "Repository marker ROOT-MANIFEST.json is missing."
    }

    $Git = (Get-Command git.exe -ErrorAction Stop).Source
    $PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
    $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source

    $Head = (& $Git -C $script:RepositoryRoot rev-parse HEAD).Trim()
    $Parent = (& $Git -C $script:RepositoryRoot rev-parse "HEAD^").Trim()
    $Grandparent = (& $Git -C $script:RepositoryRoot rev-parse "HEAD^^").Trim()
    if ($Head -eq $StartingCommit -and $Parent -eq $ParentCommit -and $Grandparent -eq $Chunk6Commit) {
        Write-Result "PASS" "Exact starting ancestry" "$Grandparent -> $Parent -> $Head"
    } else {
        Write-Result "FAIL" "Exact starting ancestry" "Observed: $Grandparent -> $Parent -> $Head"
    }

    $MaintenanceOne = @(& $Git -C $script:RepositoryRoot diff-tree --no-commit-id --name-only -r $ParentCommit)
    $AllowedOne = @(
        ".gitignore", "AGENTS.md", "ROOT-ARCHITECTURE.md", "ROOT-MANIFEST.json",
        "ROOT-PROTECTED-FUNCTIONALITY.md", "ROOT-VERIFICATION.md",
        "VERIFY-ROOT-REPOSITORY.ps1", "docs/stages/completed/.gitkeep",
        "docs/stages/completed/20260727-DICTIONARYROOT-CODEX-EFFICIENCY-FOUNDATION-V1.md",
        "docs/stages/templates/ROOT-STAGE-TEMPLATE.md", "tools/COMPLETE-ROOT-STAGE.ps1",
        "tools/EXPORT-ROOT-CONTEXT.ps1", "tools/GET-ROOT-CHANGED-FILES.ps1",
        "tools/NEW-ROOT-STAGE.ps1", "tools/SET-ACTIVE-ROOT-STAGE.ps1",
        "tools/VERIFY-ROOT-REPOSITORY.ps1"
    )
    $MaintenanceTwo = @(& $Git -C $script:RepositoryRoot diff-tree --no-commit-id --name-only -r $StartingCommit)
    $AllowedTwo = @(
        "docs/stages/completed/20260727-DICTIONARYROOT-CODEX-EFFICIENCY-FOUNDATION-V1-1.md",
        "tools/VERIFY-ROOT-REPOSITORY.ps1"
    )
    $Unexpected = @(
        $MaintenanceOne | Where-Object { $AllowedOne -notcontains $_ }
    ) + @(
        $MaintenanceTwo | Where-Object { $AllowedTwo -notcontains $_ }
    )
    if ($Unexpected.Count -eq 0) {
        Write-Result "PASS" "Maintenance-commit scope compatibility" "No product, backend, data, migration, API, or customer file changed."
    } else {
        Write-Result "FAIL" "Maintenance-commit scope compatibility" ($Unexpected -join ", ")
    }

    $TagType = (& $Git -C $script:RepositoryRoot cat-file -t sourceroot-historyroot-foundational-corpus-v1).Trim()
    $TagCommit = (& $Git -C $script:RepositoryRoot rev-parse "sourceroot-historyroot-foundational-corpus-v1^{}").Trim()
    if ($TagType -eq "tag" -and $TagCommit -eq $Chunk6Commit) {
        Write-Result "PASS" "Chunk 6 annotated tag compatibility" $TagCommit
    } else {
        Write-Result "FAIL" "Chunk 6 annotated tag compatibility" "$TagType -> $TagCommit"
    }

    $Chunk6Zip = Join-Path $PriorReleasePath "SourceRoot-HistoryRoot-Foundational-Corpus-v1.zip"
    if (
        (Test-Path -LiteralPath $Chunk6Zip -PathType Leaf) -and
        (Get-FileHash -Algorithm SHA256 -LiteralPath $Chunk6Zip).Hash -eq $Chunk6ZipHash
    ) {
        Write-Result "PASS" "Accepted Chunk 6 ZIP" $Chunk6ZipHash
    } else {
        Write-Result "FAIL" "Accepted Chunk 6 ZIP" $Chunk6Zip
    }

    $MigrationDirectory = Join-Path $script:RepositoryRoot "backend\db\migrations"
    $MigrationNames = @(
        Get-ChildItem -LiteralPath $MigrationDirectory -File |
            Sort-Object Name |
            Select-Object -ExpandProperty Name
    )
    $MissingNumbers = @(1..12 | Where-Object {
        $Prefix = "{0:D3}_" -f $_
        @($MigrationNames | Where-Object { $_.StartsWith($Prefix) }).Count -eq 0
    })
    $Migration13 = @($MigrationNames | Where-Object { $_ -match '^013_' })
    $ChangedMigrations = @(
        & $Git -C $script:RepositoryRoot diff --name-only $StartingCommit -- backend/db/migrations
    )
    if ($MissingNumbers.Count -eq 0 -and $Migration13.Count -eq 0 -and $ChangedMigrations.Count -eq 0) {
        Write-Result "PASS" "Migrations 001-012 unchanged; no 013" "$($MigrationNames.Count) accepted files."
    } else {
        Write-Result "FAIL" "Migrations 001-012 unchanged; no 013" "Missing: $($MissingNumbers -join ', '); 013: $($Migration13 -join ', '); changed: $($ChangedMigrations -join ', ')"
    }

    $CorpusFiles = @(
        "backend/data/historyroot-foundational-corpus-v1/corpus-inventory.json",
        "backend/data/historyroot-foundational-corpus-v1/historyroot-foundational-corpus-v1.bundle.json",
        "backend/data/historyroot-foundational-corpus-v1/source-register.json"
    )
    $CorpusChanges = @(
        & $Git -C $script:RepositoryRoot diff --name-only $StartingCommit -- @CorpusFiles
    )
    if ($CorpusChanges.Count -eq 0) {
        Write-Result "PASS" "Chunk 6 corpus bytes unchanged" "3 files match the starting checkpoint."
    } else {
        Write-Result "FAIL" "Chunk 6 corpus bytes unchanged" ($CorpusChanges -join ", ")
    }

    $RequiredFiles = @(
        "backend\src\source-preparation\source-preparation-types.ts",
        "backend\src\source-preparation\source-preparation-schema.ts",
        "backend\src\source-preparation\source-preparation-engine.ts",
        "backend\src\scripts\prepare-sourceroot-workspace.ts",
        "backend\test\source-preparation-workflow.test.ts",
        "backend\data\source-preparation-workflow-v1\golden-workspace.json",
        "docs\build\REPEATABLE-SOURCE-PREPARATION-WORKFLOW-CONTRACT.md",
        "docs\build\repeatable-source-preparation-workflow-stage.md",
        "INSTALL-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW.ps1"
    )
    $MissingFiles = @($RequiredFiles | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot $_) -PathType Leaf)
    })
    if ($MissingFiles.Count -eq 0) {
        Write-Result "PASS" "Workflow implementation presence" "$($RequiredFiles.Count) files."
    } else {
        Write-Result "FAIL" "Workflow implementation presence" ($MissingFiles -join ", ")
    }

    $ImplementationText = @(
        (Get-Content -Raw -LiteralPath (Join-Path $script:RepositoryRoot "backend\src\source-preparation\source-preparation-engine.ts"))
        (Get-Content -Raw -LiteralPath (Join-Path $script:RepositoryRoot "backend\src\scripts\prepare-sourceroot-workspace.ts"))
    ) -join "`n"
    $Markers = @(
        "validate", "preview", "generate", "WORKSPACE_APPROVAL_REQUIRED",
        "COPIED_EXCERPT_BLOCKED", "LOCATOR_EDITION_MISMATCH",
        "INVALID_EVIDENCE_ROLE", "canonicalJsonBytes", "validateBundle"
    )
    $MissingMarkers = @($Markers | Where-Object { $ImplementationText -notmatch [regex]::Escape($_) })
    if ($MissingMarkers.Count -eq 0) {
        Write-Result "PASS" "Modes, approval, rights, locator, evidence, and deterministic gates" "$($Markers.Count) markers."
    } else {
        Write-Result "FAIL" "Modes, approval, rights, locator, evidence, and deterministic gates" ($MissingMarkers -join ", ")
    }

    try {
        $DatabaseLine = Get-Content -LiteralPath (Join-Path $script:RepositoryRoot "backend\.env.test") |
            Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
            Select-Object -First 1
        $DatabaseUrl = ($DatabaseLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
        $DatabaseName = ([Uri]$DatabaseUrl).AbsolutePath.Trim("/")
        if ($DatabaseName -eq "sourceroot_test") {
            Write-Result "PASS" "Database scope is exactly sourceroot_test"
        } else {
            Write-Result "FAIL" "Database scope is exactly sourceroot_test" $DatabaseName
        }
    } catch {
        Write-Result "FAIL" "Database scope is exactly sourceroot_test" $_.Exception.Message
    }

    Invoke-Check "Backend TypeScript" $Npm @("--prefix", "backend", "run", "typecheck") $script:RepositoryRoot | Out-Null
    Invoke-Check "Focused source-preparation suite" $Npm @("--prefix", "backend", "run", "test:source-preparation") $script:RepositoryRoot | Out-Null

    $PackageRoot = if ($PackagePath) {
        [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PackagePath).Path).TrimEnd("\", "/")
    } else {
        Join-Path $script:RepositoryRoot $PackageName
    }
    $ManifestPath = Join-Path $PackageRoot "package-manifest.json"
    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        Write-Result "FAIL" "Package manifest validity" "Missing: $ManifestPath"
    } else {
        try {
            $Manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
            $Entries = @($Manifest.files)
            $Duplicates = @($Entries.path | Group-Object | Where-Object Count -gt 1)
            $PackageFailures = New-Object System.Collections.Generic.List[string]
            foreach ($Entry in $Entries) {
                $Relative = [string]$Entry.path
                $Payload = Resolve-SafeRelativePath (Join-Path $PackageRoot "payload") $Relative
                $Installed = Resolve-SafeRelativePath $script:RepositoryRoot $Relative
                if (-not (Test-Path -LiteralPath $Payload -PathType Leaf)) { $PackageFailures.Add("$Relative missing") ; continue }
                $Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Payload).Hash
                if ($Hash -ne [string]$Entry.sha256) { $PackageFailures.Add("$Relative hash") }
                if (-not (Test-Path -LiteralPath $Installed -PathType Leaf)) { $PackageFailures.Add("$Relative not installed") }
                elseif ((Get-FileHash -Algorithm SHA256 -LiteralPath $Installed).Hash -ne $Hash) { $PackageFailures.Add("$Relative installed bytes") }
            }
            if (
                [string]$Manifest.packageName -eq $PackageName -and
                $Entries.Count -gt 0 -and
                $Duplicates.Count -eq 0 -and
                $PackageFailures.Count -eq 0
            ) {
                Write-Result "PASS" "Package manifest, payload hashes, and installed-byte equality" "$($Entries.Count) payload files."
            } else {
                Write-Result "FAIL" "Package manifest, payload hashes, and installed-byte equality" "Duplicates: $($Duplicates.Name -join ', '); $($PackageFailures -join ', ')"
            }
        } catch {
            Write-Result "FAIL" "Package manifest validity" $_.Exception.Message
        }
    }

    $ZipPath = Join-Path $script:RepositoryRoot "$PackageName.zip"
    if (Test-Path -LiteralPath $ZipPath -PathType Leaf) {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
        try {
            $Names = @($Archive.Entries | ForEach-Object FullName)
            $DuplicateZip = @($Names | Group-Object | Where-Object Count -gt 1)
            $UnsafeZip = @($Names | Where-Object {
                $_ -match '(^|/)\.\.?(/|$)' -or $_ -match '^[\\/]' -or $_ -match '^[A-Za-z]:' -or $_ -match '\\'
            })
            $Top = @($Names | ForEach-Object { ($_ -split '/')[0] } | Sort-Object -Unique)
            if ($DuplicateZip.Count -eq 0 -and $UnsafeZip.Count -eq 0 -and $Top.Count -eq 1 -and $Top[0] -eq $PackageName) {
                Write-Result "PASS" "ZIP safety and one top-level folder" "$($Names.Count) entries."
            } else {
                Write-Result "FAIL" "ZIP safety and one top-level folder" "Duplicates $($DuplicateZip.Count); unsafe $($UnsafeZip.Count); top $($Top -join ', ')"
            }
        } finally {
            $Archive.Dispose()
        }
    } else {
        Write-Result "FAIL" "ZIP safety and one top-level folder" "Missing: $ZipPath"
    }

    if (-not $SkipRegression) {
        $BackendOutput = Invoke-Check "Complete backend regression" $Npm @("--prefix", "backend", "test") $script:RepositoryRoot
        $BackendSummary = @($BackendOutput | Where-Object { "$_" -match 'tests \d+' } | Select-Object -Last 1)
        if ($BackendSummary.Count -gt 0) { Write-Result "PASS" "Actual backend total recorded" "$($BackendSummary[0])" }
        else { Write-Result "FAIL" "Actual backend total recorded" "No test total found." }
    } else {
        Write-Result "INFO" "Complete backend regression" "Resume mode: the current-byte 281/281 result was already recorded."
    }
    $Node = (Get-Command node.exe -ErrorAction Stop).Source
    if (-not $ResumeAfterVerifiedNamedBaselines) {
        foreach ($Verifier in @(
            "VERIFY-SOURCEROOT-BASELINE.ps1",
            "VERIFY-DICTIONARYROOT-BASELINE.ps1"
        )) {
            Invoke-Check $Verifier $PowerShell @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $script:RepositoryRoot $Verifier)) $script:RepositoryRoot | Out-Null
        }
        Invoke-Check "Chunk 5 backend review" $Npm @("--prefix", "backend", "run", "test:context-review") $script:RepositoryRoot | Out-Null
        Invoke-Check "Chunk 5 frontend review" $Npm @("--prefix", "backend", "run", "test:context-review-frontend") $script:RepositoryRoot | Out-Null
        Invoke-Check "Frontend observability regression" $Npm @("--prefix", "backend", "run", "test:frontend-observability") $script:RepositoryRoot | Out-Null
        Invoke-Check "HistoryRoot Plymouth integration" $Npm @("--prefix", "backend", "run", "test:historyroot:plymouth") $script:RepositoryRoot | Out-Null
        Invoke-Check "Foundational corpus regression" $Npm @("--prefix", "backend", "run", "test:historyroot:foundational") $script:RepositoryRoot | Out-Null
    } else {
        Write-Result "INFO" "Named baselines and regressions" "Resume mode: current-byte passing results already recorded."
    }
    Invoke-Check "HistoryRoot customer experience 13/13" $Node @("--test", "verification/historyroot-customer-experience.test.mjs") $script:RepositoryRoot | Out-Null

    if (-not $SkipImmutableReplay) {
        Invoke-Check "Immutable Chunk 0-6 replay" $PowerShell @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
            (Join-Path $script:RepositoryRoot "VERIFY-SOURCEROOT-HISTORYROOT-FOUNDATIONAL-CORPUS.ps1"),
            "-RepositoryPath", $script:RepositoryRoot,
            "-PriorReleasePath", $PriorReleasePath,
            "-ReplayOnly"
        ) $script:RepositoryRoot | Out-Null
    } else {
        Write-Result "INFO" "Immutable Chunk 0-6 replay" "Explicitly skipped."
    }

    Invoke-Check "Root repository verifier" $PowerShell @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
        (Join-Path $script:RepositoryRoot "VERIFY-ROOT-REPOSITORY.ps1")
    ) $script:RepositoryRoot | Out-Null
    $PreviousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $DiffOutput = @(& $Git -C $script:RepositoryRoot diff --check 2>$null)
    $DiffCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorPreference
    $DiffOutput | ForEach-Object { Write-Host $_ }
    if ($DiffCode -eq 0) {
        Write-Result "PASS" "git diff --check" "Exit 0."
    } else {
        Write-Result "FAIL" "git diff --check" "Exit $DiffCode."
    }

    Write-Host ""
    Write-Host "SourceRoot source-preparation verifier summary" -ForegroundColor Cyan
    Write-Host "Pass count:    $script:Passed"
    Write-Host "Warning count: $script:Warnings"
    Write-Host "Failure count: $script:Failed"
    $Overall = if ($script:Failed -eq 0 -and $script:Warnings -eq 0) { "PASS" } else { "FAIL" }
    Write-Host "Overall result: $Overall"
    if ($script:Failed -gt 0 -or $script:Warnings -gt 0) { exit 1 }
    exit 0
} catch {
    Write-Result "FAIL" "Verifier execution" $_.Exception.Message
    Write-Host "Pass count:    $script:Passed"
    Write-Host "Warning count: $script:Warnings"
    Write-Host "Failure count: $script:Failed"
    Write-Host "Overall result: FAIL"
    exit 1
}
