[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepositoryRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\", "/")
$Checks = 0
$Failures = 0

function Add-Check {
    param([bool]$Condition, [string]$Message)
    $script:Checks++
    if ($Condition) {
        Write-Host "[PASS] $Message" -ForegroundColor Green
    } else {
        $script:Failures++
        Write-Host "[FAIL] $Message" -ForegroundColor Red
    }
}

function Git-Lines {
    param([string[]]$Arguments)
    return @(& git -c core.autocrlf=false -C $RepositoryRoot @Arguments 2>$null |
        ForEach-Object { ([string]$_).Trim().Replace("\", "/") } |
        Where-Object { $_ })
}

function Current-ChangedFiles {
    return @(Git-Lines @("diff", "--name-only") +
        Git-Lines @("diff", "--cached", "--name-only") +
        Git-Lines @("ls-files", "--others", "--exclude-standard") |
        Sort-Object -Unique)
}

function Invoke-ChildCheck {
    param(
        [string]$Message,
        [string]$WorkingDirectory,
        [string]$Command,
        [string[]]$Arguments
    )
    Push-Location $WorkingDirectory
    try {
        $Output = @(& $Command @Arguments 2>&1)
        $Code = $LASTEXITCODE
        if ($Code -eq 0) {
            @($Output | Select-Object -Last 10) | ForEach-Object { Write-Host ([string]$_) }
        } else {
            $Output | ForEach-Object { Write-Host ([string]$_) }
        }
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
        $Code = 1
    } finally {
        Pop-Location
    }
    Add-Check ($Code -eq 0) $Message
}

try {
    $ExpectedHead = "d98f38a07116a24f028cb290abb99036905b160b"
    $ExpectedParent = "8afb1bae19dc93e18e89351958defcf960e8c7c6"
    $ExpectedTag = "sourceroot-immutable-source-artifact-preservation-rules-v1"
    Add-Check ((Git-Lines @("branch", "--show-current")) -eq "release/historyroot-alpha-integration-v1") "Expected release branch is checked out"
    Add-Check ((Git-Lines @("rev-parse", "HEAD")) -eq $ExpectedHead) "Baseline HEAD is unchanged"
    Add-Check ((Git-Lines @("rev-parse", "HEAD^")) -eq $ExpectedParent) "Baseline parent is unchanged"
    Add-Check (((Git-Lines @("tag", "--points-at", "HEAD")) -join "`n") -eq $ExpectedTag) "No tag was added or removed at HEAD"
    Add-Check (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot ".git\index.lock"))) "Git index lock is absent"
    Add-Check (@(Git-Lines @("diff", "--cached", "--name-only")).Count -eq 0) "Git index is empty"

    $Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
    $ActiveSlug = "SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING-V1"
    $StageActive = [string]$Manifest.active_stage.status -eq "active"
    $StageInactive = [string]$Manifest.active_stage.status -eq "inactive"
    $LifecycleValid = ($StageActive -and [string]$Manifest.active_stage.slug -eq $ActiveSlug -and
        (Test-Path -LiteralPath (Join-Path $RepositoryRoot "docs\stages\active\CURRENT-STAGE.md"))) -or
        ($StageInactive -and [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.slug) -and
        -not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "docs\stages\active\CURRENT-STAGE.md")) -and
        (Test-Path -LiteralPath (Join-Path $RepositoryRoot "docs\stages\completed\20260801-SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING-V1.md")))
    Add-Check $LifecycleValid "Root stage lifecycle is valid while active or completed"

    $Allowed = @(
        "ROOT-MANIFEST.json",
        "assets/js/sourceroot-root-switcher.js",
        "backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt",
        "backend/package.json",
        "backend/src/lib/local-development-database.ts",
        "backend/src/routes/health.ts",
        "backend/src/scripts/development-runtime.ts",
        "backend/src/scripts/import-bibleroot-foundation.ts",
        "backend/src/scripts/import-bibleroot-original-language-foundation.ts",
        "backend/src/services/development-runtime-readiness.ts",
        "backend/test/local-development-runtime.test.ts",
        "docs/architecture/SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING-V1.md",
        "docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md",
        "docs/stages/active/CURRENT-STAGE.md",
        "docs/stages/completed/20260801-SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING-V1.md",
        "verification/sourceroot-local-development-runtime.test.cjs",
        "verification/sourceroot-shared-root-switcher.test.cjs",
        "VERIFY-SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING.ps1"
    )
    $Unexpected = @(Current-ChangedFiles | Where-Object { $Allowed -notcontains $_ })
    Add-Check ($Unexpected.Count -eq 0) "Every changed path is inside the exact 18-path boundary"
    if ($StageActive) {
        Add-Check (@($Manifest.active_stage.allowed_files).Count -eq 18 -and
            @($Manifest.active_stage.allowed_files | Where-Object { $Allowed -notcontains $_ }).Count -eq 0) "Active manifest declares the exact allowed boundary"
    } else {
        Add-Check (@($Manifest.active_stage.allowed_files).Count -eq 0) "Completed manifest has no active allowed paths"
    }

    $Attributes = (& git -C $RepositoryRoot show HEAD:.gitattributes 2>$null) -join "`n"
    $ExpectedAttributes = "# Preserve immutable upstream artifacts byte-for-byte.`nbackend/data/**/raw/** -text`nbackend/data/**/source-docs/** -text"
    Add-Check ($Attributes.TrimEnd() -eq $ExpectedAttributes) "Committed immutable-source attributes are exact"

    $Gutenberg = Join-Path $RepositoryRoot "backend\data\bibleroot-foundation-v1\raw\project-gutenberg-ebook-10-10-0.txt"
    $GutenbergHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Gutenberg).Hash
    $FilteredBlob = (& git -C $RepositoryRoot hash-object -- $Gutenberg).Trim()
    $NoFilterBlob = (& git -C $RepositoryRoot hash-object --no-filters -- $Gutenberg).Trim()
    $TextAttribute = (& git -C $RepositoryRoot check-attr text -- $Gutenberg) -join ""
    Add-Check ((Get-Item -LiteralPath $Gutenberg).Length -eq 4436268 -and $GutenbergHash -eq "0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986") "Accepted Gutenberg byte length and SHA-256 are exact"
    Add-Check ($FilteredBlob -eq "0ddceccdd1569bb5f5992aa33e33aa8aa99eee6e" -and $FilteredBlob -eq $NoFilterBlob) "Filtered and no-filter Gutenberg blobs are exact"
    Add-Check ($TextAttribute -match 'text: unset$') "Protected Gutenberg text attribute is unset"

    $TempIndex = Join-Path ([IO.Path]::GetTempPath()) ("sourceroot-runtime-recovery-" + [guid]::NewGuid().ToString("N") + ".index")
    $TempObjects = $TempIndex + ".objects"
    $PriorIndex = $env:GIT_INDEX_FILE
    $PriorObjectDirectory = $env:GIT_OBJECT_DIRECTORY
    $PriorAlternates = $env:GIT_ALTERNATE_OBJECT_DIRECTORIES
    try {
        New-Item -ItemType Directory -Path $TempObjects | Out-Null
        $env:GIT_INDEX_FILE = $TempIndex
        $env:GIT_OBJECT_DIRECTORY = $TempObjects
        $env:GIT_ALTERNATE_OBJECT_DIRECTORIES = Join-Path $RepositoryRoot ".git\objects"
        & git -C $RepositoryRoot read-tree HEAD 2>$null
        & git -C $RepositoryRoot add -- "backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt" 2>$null
        $StagedLine = (& git -C $RepositoryRoot ls-files -s -- "backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt") -join ""
        Add-Check ($StagedLine -match "100644 0ddceccdd1569bb5f5992aa33e33aa8aa99eee6e 0") "Isolated temporary index stages the accepted exact blob"
    } finally {
        if ($null -eq $PriorIndex) { Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue } else { $env:GIT_INDEX_FILE = $PriorIndex }
        if ($null -eq $PriorObjectDirectory) { Remove-Item Env:GIT_OBJECT_DIRECTORY -ErrorAction SilentlyContinue } else { $env:GIT_OBJECT_DIRECTORY = $PriorObjectDirectory }
        if ($null -eq $PriorAlternates) { Remove-Item Env:GIT_ALTERNATE_OBJECT_DIRECTORIES -ErrorAction SilentlyContinue } else { $env:GIT_ALTERNATE_OBJECT_DIRECTORIES = $PriorAlternates }
        if (Test-Path -LiteralPath $TempIndex) { Remove-Item -LiteralPath $TempIndex -Force }
        $TempLock = $TempIndex + ".lock"
        if (Test-Path -LiteralPath $TempLock) { Remove-Item -LiteralPath $TempLock -Force }
        if (Test-Path -LiteralPath $TempObjects) {
            $ResolvedTemp = [IO.Path]::GetFullPath($TempObjects)
            $ResolvedSystemTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
            if ($ResolvedTemp.StartsWith($ResolvedSystemTemp, [StringComparison]::OrdinalIgnoreCase)) {
                Remove-Item -LiteralPath $ResolvedTemp -Recurse -Force
            }
        }
    }

    $Protected = @(
        @("backend/data/bibleroot-original-language-foundation-v1/raw/Eccl.xml", 288538, "28599B243D236813C5F4407CE477E9DF1019CBBEA88BA39AD4A95F1AEC8CECCF"),
        @("backend/data/bibleroot-original-language-foundation-v1/raw/Gen.xml", 1881356, "87B6221B89CCD308A96B287EFB4520397912A16FE0F8CE4F788A3B4C09D8F2A4"),
        @("backend/data/bibleroot-original-language-foundation-v1/raw/Nestle1904.csv", 9098651, "F239AA40669138EED4BDA0BD4BDC7B2071687CAC26752FA5A1FD468F7FD0ABF0"),
        @("backend/data/bibleroot-original-language-foundation-v1/raw/Ps.xml", 1949574, "6B4BC0EAFFF4787FC5DD10F5F3D4F753B132C71DC3D681818D8E73D95E74A6DB"),
        @("backend/data/bibleroot-original-language-foundation-v1/source-docs/nestle1904-README.md", 8789, "6B657411F03DA73738C7FF09576AD34BD3BB5575CB4218E1D3445C923C40C710"),
        @("backend/data/bibleroot-original-language-foundation-v1/source-docs/nestle1904-parsing.txt", 5330, "777B2B93ACDDB162DAD0CFA9AD83C1DBA5064FD5930163704E7DA02F7EEEDDB8"),
        @("backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-HebrewMorphologyCodes.html", 18944, "4EF067CD9F2508DE19D81AAB93BF2D7E24D1687A7664C5168DE1411ADAF4EE1D"),
        @("backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-LICENSE.md", 1505, "A3572C65155CE4FD7C482F635A7E3A903B69F28051961D1E9CC92AA8A657152C"),
        @("backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-README.md", 5124, "D0BE8DBBF3BDBA685B1C7C0E6E3C12265D4D113867E43DDA3D9746E6E6BB0F05"),
        @("backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-parsing-README.md", 7642, "EB804C6C7245E323EF451DF0BF5DBD51511F72AFE4DCB48537708C2A43D8515B")
    )
    $ProtectedValid = $true
    foreach ($Identity in $Protected) {
        $Path = Join-Path $RepositoryRoot ($Identity[0] -replace "/", "\")
        if ((Get-Item -LiteralPath $Path).Length -ne [long]$Identity[1] -or
            (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash -ne [string]$Identity[2] -or
            @(Git-Lines @("diff", "--name-only", "HEAD", "--", [string]$Identity[0])).Count -ne 0) {
            $ProtectedValid = $false
        }
    }
    Add-Check $ProtectedValid "All ten non-repaired protected source identities are unchanged"

    $Migration = Join-Path $RepositoryRoot "backend\db\migrations\016_create_bibleroot_original_language_foundation.sql"
    Add-Check ((& git -C $RepositoryRoot rev-parse "HEAD:backend/db/migrations/016_create_bibleroot_original_language_foundation.sql").Trim() -eq "93746e495b25bad4a3ecf7e81a7631e60d175f7c" -and
        (Get-Item -LiteralPath $Migration).Length -eq 6287 -and
        (Get-FileHash -Algorithm SHA256 -LiteralPath $Migration).Hash -eq "02B6AE307A465472AA8A9DE89BB28514D6E7781AF4C12643EB6FB033A246F8BA") "Migration 016 is unchanged"
    Add-Check (@(Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "backend\db\migrations") -Filter "017*" -File).Count -eq 0) "Migration 017 is absent"
    Add-Check (@(Git-Lines @("diff", "--name-only", "--", "backend/db/migrations")).Count -eq 0) "No migration is changed"

    $Package = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "backend\package.json") | ConvertFrom-Json
    Add-Check ([string]$Package.scripts.'dev:provision' -eq "node --env-file=.env --import ./scripts/register-tsx.mjs src/scripts/development-runtime.ts provision" -and [string]$Package.scripts.'dev:status' -eq "node --env-file=.env --import ./scripts/register-tsx.mjs src/scripts/development-runtime.ts status") "Explicit provision and status scripts exist"
    $Safety = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "backend\src\lib\local-development-database.ts")
    Add-Check ($Safety -match 'NODE_ENV=development' -and $Safety -match 'rejects remote database hosts' -and $Safety -match 'database name sourceroot' -and $Safety -match 'WeakSet') "Database safety guards are present"
    $FoundationImporter = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "backend\src\scripts\import-bibleroot-foundation.ts")
    $OriginalImporter = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "backend\src\scripts\import-bibleroot-original-language-foundation.ts")
    Add-Check ($FoundationImporter -match 'restricted to sourceroot_test' -and $OriginalImporter -match 'restricted to sourceroot_test') "Historical test-only importer restrictions remain"
    Add-Check (@(Current-ChangedFiles | Where-Object { $_ -match '(?i)translation.?comparison' }).Count -eq 0) "No Translation Comparison path exists in the change"
    Add-Check (@(Current-ChangedFiles | Where-Object { $_ -match '(?i)\.zip$' }).Count -eq 0) "No ZIP was created or changed"

    Invoke-ChildCheck "Backend typecheck passes" (Join-Path $RepositoryRoot "backend") "npm.cmd" @("run", "typecheck")
    Invoke-ChildCheck "Test database migrations apply" (Join-Path $RepositoryRoot "backend") "npm.cmd" @("run", "db:migrate:test")
    Invoke-ChildCheck "Focused database-safety and source-validation tests pass" (Join-Path $RepositoryRoot "backend") "node" @("--env-file=.env.test", "--import", "./scripts/register-tsx.mjs", "--test", "--test-concurrency=1", "test/local-development-runtime.test.ts")
    Invoke-ChildCheck "DictionaryRoot applicable corpus regressions pass (frozen pre-015 assertion excluded)" (Join-Path $RepositoryRoot "backend") "node" @("--env-file=.env.test", "--import", "./scripts/register-tsx.mjs", "--test", "--test-concurrency=1", "--test-name-pattern=^(?:[1-9]|1[0-4])[.]", "test/dictionaryroot-core-lexical-corpus.test.ts")
    Invoke-ChildCheck "BibleRoot Foundation applicable regressions pass (frozen pre-016 table-list assertion excluded)" (Join-Path $RepositoryRoot "backend") "node" @("--env-file=.env.test", "--import", "./scripts/register-tsx.mjs", "--test", "--test-concurrency=1", "--test-name-pattern=^(?:[1-9]|1[013-9]|2[0-8])[.]", "test/bibleroot-foundation.test.ts")
    Invoke-ChildCheck "BibleRoot Original Language idempotency and API regression passes" (Join-Path $RepositoryRoot "backend") "npm.cmd" @("run", "test:bibleroot:original-languages")
    Invoke-ChildCheck "Focused and shared frontend readiness regressions pass" $RepositoryRoot "node" @("--test", "verification/sourceroot-local-development-runtime.test.cjs", "verification/sourceroot-shared-root-switcher.test.cjs", "verification/dictionaryroot-core-lexical-corpus.test.cjs", "verification/bibleroot-foundation.test.cjs", "verification/bibleroot-original-language-foundation.test.cjs")

    & git -C $RepositoryRoot diff --check -- "." ":(exclude)backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt"
    Add-Check ($LASTEXITCODE -eq 0) "git diff --check passes for every project-authored change"
    & git -c "core.whitespace=cr-at-eol,-blank-at-eol" -C $RepositoryRoot diff --check -- "backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt"
    Add-Check ($LASTEXITCODE -eq 0) "Protected artifact diff check passes with its accepted CRLF and one pinned upstream trailing space"
} catch {
    $Failures++
    Write-Host "[FAIL] Verifier exception: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "[SUMMARY] Checks: $Checks | Warnings: 0 | Failures: $Failures" -ForegroundColor Cyan
if ($Failures -ne 0) { exit 1 }
exit 0
