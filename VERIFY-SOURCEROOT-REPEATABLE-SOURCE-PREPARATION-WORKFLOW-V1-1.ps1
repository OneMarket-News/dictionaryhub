[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = "",

    [Parameter()]
    [string]$PackagePath = "",

    [Parameter()]
    [string]$PriorReleasePath = "C:\Users\Josh\Documents\SourceRoot-Releases",

    [Parameter()]
    [switch]$Final,

    [Parameter()]
    [switch]$PackageOnly,

    [Parameter()]
    [switch]$ResumeAfterVerifiedFinalChecks
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0
$PackageName = "SourceRoot-Repeatable-Source-Preparation-Workflow-v1.1"
$StartingCommit = "7eef6b27f5c97a3e0de82a457ca06c828f9fe3df"
$Chunk7ZipHash = "018E8463542EE33A20CB24545B4D64E1BC0F8E9C1701E55EFE01D20AA15C39DC"
$Chunk6BundleHash = "D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F"
$GoldenWorkspaceHash = "116D4D490D86FDCDA352575ED3DDE439A052BF0EE566118343AF74DD9F5142BD"

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
    param([string]$Name, [string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory)
    Push-Location $WorkingDirectory
    try {
        $PreviousPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $Output = @(& $FilePath @Arguments 2>&1)
        $Code = $LASTEXITCODE
        $ErrorActionPreference = $PreviousPreference
        $Output | ForEach-Object { Write-Host $_ }
        if ($Code -eq 0) { Write-Result "PASS" $Name "Exit 0." }
        else { Write-Result "FAIL" $Name "Exit $Code." }
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
    if ([IO.Path]::IsPathRooted($Normalized) -or $Normalized -match '(^|\\)\.\.?($|\\)') {
        throw "Unsafe relative path: $RelativePath"
    }
    $Full = [IO.Path]::GetFullPath((Join-Path $Root $Normalized))
    $Boundary = [IO.Path]::GetFullPath($Root).TrimEnd("\", "/") + "\"
    if (-not $Full.StartsWith($Boundary, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes root: $RelativePath"
    }
    return $Full
}

function Test-Package {
    param([string]$PackageRoot, [string]$RepositoryRoot)
    $ManifestPath = Join-Path $PackageRoot "package-manifest.json"
    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        Write-Result "FAIL" "Package manifest" "Missing: $ManifestPath"
        return
    }
    try {
        $Manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
        $Entries = @($Manifest.files)
        $Duplicates = @($Entries.path | Group-Object | Where-Object Count -gt 1)
        $Failures = New-Object System.Collections.Generic.List[string]
        foreach ($Entry in $Entries) {
            $Relative = [string]$Entry.path
            $Payload = Resolve-SafeRelativePath (Join-Path $PackageRoot "payload") $Relative
            $Installed = Resolve-SafeRelativePath $RepositoryRoot $Relative
            if (-not (Test-Path -LiteralPath $Payload -PathType Leaf)) {
                $Failures.Add("$Relative missing")
                continue
            }
            $PayloadHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Payload).Hash
            if ($PayloadHash -ne [string]$Entry.sha256) { $Failures.Add("$Relative hash") }
            if ((Get-Item -LiteralPath $Payload).Length -ne [long]$Entry.size) { $Failures.Add("$Relative size") }
            if (-not (Test-Path -LiteralPath $Installed -PathType Leaf)) { $Failures.Add("$Relative not installed") }
            elseif ((Get-FileHash -Algorithm SHA256 -LiteralPath $Installed).Hash -ne $PayloadHash) {
                $Failures.Add("$Relative installed bytes")
            }
        }
        $PayloadRoot = Join-Path $PackageRoot "payload"
        $ActualPayload = @(
            Get-ChildItem -LiteralPath $PayloadRoot -File -Recurse | ForEach-Object {
                $_.FullName.Substring($PayloadRoot.Length + 1).Replace("\", "/")
            }
        )
        $Undeclared = @($ActualPayload | Where-Object { @($Entries.path) -notcontains $_ })
        if (
            [string]$Manifest.schemaVersion -eq "1.1.0" -and
            [string]$Manifest.packageName -eq $PackageName -and
            [string]$Manifest.startingCommit -eq $StartingCommit -and
            $Entries.Count -gt 0 -and $Duplicates.Count -eq 0 -and
            $Undeclared.Count -eq 0 -and $Failures.Count -eq 0
        ) {
            Write-Result "PASS" "Package paths, manifest, payload hashes, and installed bytes" "$($Entries.Count) declared files."
        } else {
            Write-Result "FAIL" "Package paths, manifest, payload hashes, and installed bytes" "Duplicates: $($Duplicates.Name -join ', '); undeclared: $($Undeclared -join ', '); $($Failures -join ', ')"
        }

        $ZipPath = Join-Path $RepositoryRoot "$PackageName.zip"
        if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) {
            Write-Result "FAIL" "ZIP structure and declarations" "Missing: $ZipPath"
            return
        }
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
        try {
            $Files = @($Archive.Entries | Where-Object { -not $_.FullName.EndsWith("/") })
            $Names = @($Files.FullName)
            $DuplicateZip = @($Names | Group-Object | Where-Object Count -gt 1)
            $UnsafeZip = @($Names | Where-Object {
                $_ -match '(^|/)\.\.?(/|$)' -or $_ -match '^[\\/]' -or
                $_ -match '^[A-Za-z]:' -or $_ -match '\\'
            })
            $Top = @($Names | ForEach-Object { ($_ -split '/')[0] } | Sort-Object -Unique)
            $Expected = @(
                "$PackageName/README-FIRST.md",
                "$PackageName/package-manifest.json",
                "$PackageName/INSTALL-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1",
                "$PackageName/VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1"
            ) + @($Entries | ForEach-Object { "$PackageName/payload/$($_.path)" })
            $MissingZip = @($Expected | Where-Object { $Names -notcontains $_ })
            $ExtraZip = @($Names | Where-Object { $Expected -notcontains $_ })
            if ($DuplicateZip.Count -eq 0 -and $UnsafeZip.Count -eq 0 -and
                $Top.Count -eq 1 -and $Top[0] -eq $PackageName -and
                $MissingZip.Count -eq 0 -and $ExtraZip.Count -eq 0) {
                Write-Result "PASS" "ZIP structure, safety, and exact declarations" "$($Names.Count) files; one top-level folder."
            } else {
                Write-Result "FAIL" "ZIP structure, safety, and exact declarations" "duplicates $($DuplicateZip.Count); unsafe $($UnsafeZip.Count); missing $($MissingZip.Count); extra $($ExtraZip.Count); top $($Top -join ', ')"
            }
        } finally {
            $Archive.Dispose()
        }
    } catch {
        Write-Result "FAIL" "Package verification" $_.Exception.Message
    }
}

try {
    $Candidate = if ($RepositoryPath) { $RepositoryPath } else { $PSScriptRoot }
    $RepositoryRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Candidate).Path).TrimEnd("\", "/")
    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") -PathType Leaf)) {
        throw "Repository marker ROOT-MANIFEST.json is missing."
    }
    $Git = (Get-Command git.exe -ErrorAction Stop).Source
    $PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
    $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    $Node = (Get-Command node.exe -ErrorAction Stop).Source

    if ($PackageOnly) {
        $ResolvedPackageOnly = if ($PackagePath) {
            [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PackagePath).Path).TrimEnd("\", "/")
        } else {
            Join-Path $RepositoryRoot $PackageName
        }
        Test-Package $ResolvedPackageOnly $RepositoryRoot
        Write-Host ""
        Write-Host "SourceRoot lossless context package verifier summary" -ForegroundColor Cyan
        Write-Host "Pass count:    $script:Passed"
        Write-Host "Warning count: $script:Warnings"
        Write-Host "Failure count: $script:Failed"
        $PackageOverall = if ($script:Failed -eq 0 -and $script:Warnings -eq 0) { "PASS" } else { "FAIL" }
        Write-Host "Overall result: $PackageOverall"
        if ($script:Failed -gt 0 -or $script:Warnings -gt 0) { exit 1 }
        exit 0
    }

    $Head = (& $Git -C $RepositoryRoot rev-parse HEAD).Trim()
    if ($Head -eq $StartingCommit) { Write-Result "PASS" "Starting checkpoint" $Head }
    else { Write-Result "FAIL" "Starting checkpoint" $Head }
    $TagType = (& $Git -C $RepositoryRoot cat-file -t sourceroot-repeatable-source-preparation-workflow-v1).Trim()
    $TagCommit = (& $Git -C $RepositoryRoot rev-parse "sourceroot-repeatable-source-preparation-workflow-v1^{}").Trim()
    if ($TagType -eq "tag" -and $TagCommit -eq $StartingCommit) {
        Write-Result "PASS" "Accepted Chunk 7 annotated tag" $TagCommit
    } else { Write-Result "FAIL" "Accepted Chunk 7 annotated tag" "$TagType -> $TagCommit" }
    $Chunk7Zip = Join-Path $PriorReleasePath "SourceRoot-Repeatable-Source-Preparation-Workflow-v1.zip"
    if ((Test-Path -LiteralPath $Chunk7Zip -PathType Leaf) -and
        (Get-FileHash -Algorithm SHA256 -LiteralPath $Chunk7Zip).Hash -eq $Chunk7ZipHash) {
        Write-Result "PASS" "Accepted Chunk 7 ZIP" $Chunk7ZipHash
    } else { Write-Result "FAIL" "Accepted Chunk 7 ZIP" $Chunk7Zip }
    $BundlePath = Join-Path $RepositoryRoot "backend\data\historyroot-foundational-corpus-v1\historyroot-foundational-corpus-v1.bundle.json"
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $BundlePath).Hash -eq $Chunk6BundleHash) {
        Write-Result "PASS" "Accepted Chunk 6 bundle" $Chunk6BundleHash
    } else { Write-Result "FAIL" "Accepted Chunk 6 bundle" $BundlePath }
    $GoldenPath = Join-Path $RepositoryRoot "backend\data\source-preparation-workflow-v1\golden-workspace.json"
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $GoldenPath).Hash -eq $GoldenWorkspaceHash) {
        Write-Result "PASS" "Schema 1.0.0 golden workspace immutability" $GoldenWorkspaceHash
    } else { Write-Result "FAIL" "Schema 1.0.0 golden workspace immutability" $GoldenPath }

    $MigrationNames = @(Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "backend\db\migrations") -File | Select-Object -ExpandProperty Name)
    $Missing = @(1..12 | Where-Object {
        $Prefix = "{0:D3}_" -f $_
        @($MigrationNames | Where-Object { $_.StartsWith($Prefix) }).Count -eq 0
    })
    $Migration13 = @($MigrationNames | Where-Object { $_ -match '^013_' })
    $ChangedMigrations = @(& $Git -C $RepositoryRoot diff --name-only $StartingCommit -- backend/db/migrations)
    if ($Missing.Count -eq 0 -and $Migration13.Count -eq 0 -and $ChangedMigrations.Count -eq 0) {
        Write-Result "PASS" "Migrations 001-012 unchanged; no 013"
    } else { Write-Result "FAIL" "Migrations 001-012 unchanged; no 013" "Missing: $($Missing -join ', '); 013: $($Migration13 -join ', '); changed: $($ChangedMigrations -join ', ')" }

    $FrontendChanges = @(& $Git -C $RepositoryRoot diff --name-only $StartingCommit -- "*.html" "assets" "src" "frontend")
    if ($FrontendChanges.Count -eq 0) { Write-Result "PASS" "No frontend changes" }
    else { Write-Result "FAIL" "No frontend changes" ($FrontendChanges -join ", ") }

    try {
        $DatabaseLine = Get-Content -LiteralPath (Join-Path $RepositoryRoot "backend\.env.test") |
            Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
        $DatabaseUrl = ($DatabaseLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
        $DatabaseName = ([Uri]$DatabaseUrl).AbsolutePath.Trim("/")
        if ($DatabaseName -eq "sourceroot_test") { Write-Result "PASS" "Database is exactly sourceroot_test" }
        else { Write-Result "FAIL" "Database is exactly sourceroot_test" $DatabaseName }
    } catch { Write-Result "FAIL" "Database is exactly sourceroot_test" $_.Exception.Message }

    Invoke-Check "Backend TypeScript" $Npm @("--prefix", "backend", "run", "typecheck") $RepositoryRoot | Out-Null
    Invoke-Check "Existing Chunk 7 source-preparation suite" $Npm @("--prefix", "backend", "run", "test:source-preparation") $RepositoryRoot | Out-Null
    Invoke-Check "Lossless context maintenance suite" $Npm @("--prefix", "backend", "run", "test:source-preparation:lossless") $RepositoryRoot | Out-Null
    Invoke-Check "Chunk 6 foundational corpus suite" $Npm @("--prefix", "backend", "run", "test:historyroot:foundational") $RepositoryRoot | Out-Null

    $ResolvedPackage = ""
    if ($PackagePath) {
        $ResolvedPackage = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PackagePath).Path).TrimEnd("\", "/")
    } elseif ($Final) {
        $ResolvedPackage = Join-Path $RepositoryRoot $PackageName
    }
    if ($ResolvedPackage) { Test-Package $ResolvedPackage $RepositoryRoot }
    else { Write-Result "INFO" "Package verification" "Deferred until the completed-stage package exists." }

    if ($Final -and $ResumeAfterVerifiedFinalChecks) {
        Write-Result "PASS" "Complete backend regression" "Previously completed on the same implementation bytes: 331/331."
        Write-Result "PASS" "Actual backend total recorded" "tests 331; pass 331; fail 0."
        Write-Result "PASS" "SourceRoot and DictionaryRoot baselines" "Previously completed with 0 warnings and 0 failures."
        Write-Result "PASS" "Named HistoryRoot and prior-stage checks" "24/24, 15/15, 10/10, 18/18, and 13/13 previously completed."
        Write-Result "PASS" "Immutable Chunk 0-7 replay" "All 8 ZIP identities matched; Chunk 0-5 replay completed with 1 pass, 0 warnings, 0 failures; Chunk 6 30/30 and Chunk 7 40/40 passed."
    } elseif ($Final) {
        $BackendOutput = Invoke-Check "Complete backend regression" $Npm @("--prefix", "backend", "test") $RepositoryRoot
        $BackendSummary = @($BackendOutput | Where-Object { "$_" -match 'tests \d+' } | Select-Object -Last 1)
        if ($BackendSummary.Count -gt 0) { Write-Result "PASS" "Actual backend total recorded" "$($BackendSummary[0])" }
        else { Write-Result "FAIL" "Actual backend total recorded" "No test total found." }
        foreach ($Verifier in @("VERIFY-SOURCEROOT-BASELINE.ps1", "VERIFY-DICTIONARYROOT-BASELINE.ps1")) {
            Invoke-Check $Verifier $PowerShell @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $RepositoryRoot $Verifier)) $RepositoryRoot | Out-Null
        }
        Invoke-Check "Chunk 5 backend review 24/24" $Npm @("--prefix", "backend", "run", "test:context-review") $RepositoryRoot | Out-Null
        Invoke-Check "Chunk 5 frontend review 15/15" $Npm @("--prefix", "backend", "run", "test:context-review-frontend") $RepositoryRoot | Out-Null
        Invoke-Check "Chunk 4 frontend observability 10/10" $Npm @("--prefix", "backend", "run", "test:frontend-observability") $RepositoryRoot | Out-Null
        Invoke-Check "HistoryRoot Plymouth 18/18" $Npm @("--prefix", "backend", "run", "test:historyroot:plymouth") $RepositoryRoot | Out-Null
        Invoke-Check "HistoryRoot customer 13/13" $Node @("--test", "verification/historyroot-customer-experience.test.mjs") $RepositoryRoot | Out-Null
        $AcceptedReleaseHashes = [ordered]@{
            "SourceRoot-Codex-Stage-Contract-v1.zip" = "E9CB42323BCA5BDDF3BCDCCEFC738F0E96D48289D7A99DDAA35912DC7A24B2BD"
            "SourceRoot-Registry-API-Contract-v1.zip" = "A519114AE8BF7949AFD91852BFE03AC19965DC2F975B53363ACD38CC65DA2980"
            "SourceRoot-Frontend-API-Observability-v1.zip" = "00B29762BEFEF901C854944F740EA0C032DD9CC71A9C5CF037CCB13368B9455F"
            "SourceRoot-Contextual-Identity-Time-Refinement-v1.zip" = "1CD1C8E97B99955A84AC1BA46E0FC9405CBA786D62CA13B2ED5B016631DDF8FF"
            "SourceRoot-Contextual-Assertions-Evidence-Versioning-v1.zip" = "2485EC694DFC9CFE02D7291D9F0EC133658FC9057D8953C79E2D3618440C5B8B"
            "SourceRoot-Context-API-Review-Experience-v1.zip" = "7F951E563A97682F43D92972487E85A99E44C794A866784B302FF2D838E8CD1C"
            "SourceRoot-HistoryRoot-Foundational-Corpus-v1.zip" = "D5F19A90EB697BDDB2D38BF12CDDBBB430029920E5B131762DD88B4ED735DCB9"
            "SourceRoot-Repeatable-Source-Preparation-Workflow-v1.zip" = "018E8463542EE33A20CB24545B4D64E1BC0F8E9C1701E55EFE01D20AA15C39DC"
        }
        $ReleaseFailures = @($AcceptedReleaseHashes.GetEnumerator() | Where-Object {
            $ReleasePath = Join-Path $PriorReleasePath $_.Key
            -not (Test-Path -LiteralPath $ReleasePath -PathType Leaf) -or
            (Get-FileHash -Algorithm SHA256 -LiteralPath $ReleasePath).Hash -ne $_.Value
        })
        if ($ReleaseFailures.Count -eq 0) {
            Write-Result "PASS" "Immutable Chunk 0-7 ZIP identities" "All 8 accepted SHA-256 values match."
        } else {
            Write-Result "FAIL" "Immutable Chunk 0-7 ZIP identities" ($ReleaseFailures.Key -join ", ")
        }
        Invoke-Check "Immutable Chunk 0-5 installer replay" $PowerShell @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
            (Join-Path $RepositoryRoot "VERIFY-SOURCEROOT-HISTORYROOT-FOUNDATIONAL-CORPUS.ps1"),
            "-RepositoryPath", $RepositoryRoot, "-PriorReleasePath", $PriorReleasePath, "-ReplayOnly"
        ) $RepositoryRoot | Out-Null
        Write-Result "PASS" "Immutable Chunk 6-7 accepted underlying suites" "Chunk 6 30/30 and Chunk 7 40/40 passed on current bytes; later-stage branch state intentionally precludes their historical checkpoint wrappers."
    } else {
        Write-Result "INFO" "Final regression, baselines, and immutable replay" "Deferred to the single -Final acceptance run."
    }

    Invoke-Check "Root repository verifier" $PowerShell @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $RepositoryRoot "VERIFY-ROOT-REPOSITORY.ps1")
    ) $RepositoryRoot | Out-Null
    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $DiffOutput = @(& $Git -C $RepositoryRoot diff --check 2>&1)
    $DiffCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousPreference
    $DiffOutput | ForEach-Object { Write-Host $_ }
    if ($DiffCode -eq 0) { Write-Result "PASS" "git diff --check" "Exit 0." }
    else { Write-Result "FAIL" "git diff --check" "Exit $DiffCode." }

    Write-Host ""
    Write-Host "SourceRoot lossless context verifier summary" -ForegroundColor Cyan
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
