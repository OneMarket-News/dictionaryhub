[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:Passed = 0
$script:Failed = 0
$ExpectedBranch = "release/historyroot-alpha-integration-v1"
$ExpectedHead = "8afb1bae19dc93e18e89351958defcf960e8c7c6"
$ExpectedParent = "b149b6bb2d39ee78557f7716975a07d1a84fcc06"
$ExpectedReleaseTag = "sourceroot-bibleroot-original-language-foundation-v1"
$ProhibitedTag = "sourceroot-immutable-source-artifact-preservation-rules-v1"
$StageSlug = "SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION-RULES-V1"
$ActiveStagePath = "docs/stages/active/CURRENT-STAGE.md"
$CompletedStagePath = "docs/stages/completed/20260801-SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION-RULES-V1.md"
$ExpectedAllowedFiles = @(
    ".gitattributes",
    "ROOT-MANIFEST.json",
    $ActiveStagePath,
    $CompletedStagePath,
    "docs/architecture/SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION-RULES-V1.md",
    "VERIFY-SOURCEROOT-IMMUTABLE-SOURCE-ARTIFACT-PRESERVATION.ps1"
)

$ProtectedRecords = @(
    [pscustomobject]@{ Path = "backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt"; Blob = "d3ecab05c777a1b1d765574b5ae51952166a30e5"; Length = 4336671L; Sha256 = "6DDEB05FC18E988AB569549603410FECF1A40604D826187C278B3B948A92C0E4"; Family = "Chunk 12 raw" },
    [pscustomobject]@{ Path = "backend/data/bibleroot-original-language-foundation-v1/raw/Eccl.xml"; Blob = "6081b66304dac20272ebfbc7d06e498e9a61c23c"; Length = 288538L; Sha256 = "28599B243D236813C5F4407CE477E9DF1019CBBEA88BA39AD4A95F1AEC8CECCF"; Family = "Chunk 13A raw" },
    [pscustomobject]@{ Path = "backend/data/bibleroot-original-language-foundation-v1/raw/Gen.xml"; Blob = "5cb3be5f2c65cead706ae6b0592b7a8a60d735ec"; Length = 1881356L; Sha256 = "87B6221B89CCD308A96B287EFB4520397912A16FE0F8CE4F788A3B4C09D8F2A4"; Family = "Chunk 13A raw" },
    [pscustomobject]@{ Path = "backend/data/bibleroot-original-language-foundation-v1/raw/Nestle1904.csv"; Blob = "6e2261001636cd9b4b2ad365f3c5bbd0776d085e"; Length = 9098651L; Sha256 = "F239AA40669138EED4BDA0BD4BDC7B2071687CAC26752FA5A1FD468F7FD0ABF0"; Family = "Chunk 13A raw" },
    [pscustomobject]@{ Path = "backend/data/bibleroot-original-language-foundation-v1/raw/Ps.xml"; Blob = "df97a48e7523ad4844feb9caf74c4eb041d22f7e"; Length = 1949574L; Sha256 = "6B4BC0EAFFF4787FC5DD10F5F3D4F753B132C71DC3D681818D8E73D95E74A6DB"; Family = "Chunk 13A raw" },
    [pscustomobject]@{ Path = "backend/data/bibleroot-original-language-foundation-v1/source-docs/nestle1904-README.md"; Blob = "fdd28fefd0a4494932192c36a20bea47f47b64d7"; Length = 8789L; Sha256 = "6B657411F03DA73738C7FF09576AD34BD3BB5575CB4218E1D3445C923C40C710"; Family = "Chunk 13A source docs" },
    [pscustomobject]@{ Path = "backend/data/bibleroot-original-language-foundation-v1/source-docs/nestle1904-parsing.txt"; Blob = "19d266d7cb11ef4ef9e595383e535a833ca23216"; Length = 5330L; Sha256 = "777B2B93ACDDB162DAD0CFA9AD83C1DBA5064FD5930163704E7DA02F7EEEDDB8"; Family = "Chunk 13A source docs" },
    [pscustomobject]@{ Path = "backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-HebrewMorphologyCodes.html"; Blob = "0b14b1b1aa434e096d67cec35a060fc51d5e56d7"; Length = 18944L; Sha256 = "4EF067CD9F2508DE19D81AAB93BF2D7E24D1687A7664C5168DE1411ADAF4EE1D"; Family = "Chunk 13A source docs" },
    [pscustomobject]@{ Path = "backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-LICENSE.md"; Blob = "714d9774fab23335b3130543fa1dc33e88f443b5"; Length = 1505L; Sha256 = "A3572C65155CE4FD7C482F635A7E3A903B69F28051961D1E9CC92AA8A657152C"; Family = "Chunk 13A source docs" },
    [pscustomobject]@{ Path = "backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-README.md"; Blob = "6011ccb0cc2c5b4bd5d0aadd364b0c72be621ef8"; Length = 5124L; Sha256 = "D0BE8DBBF3BDBA685B1C7C0E6E3C12265D4D113867E43DDA3D9746E6E6BB0F05"; Family = "Chunk 13A source docs" },
    [pscustomobject]@{ Path = "backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-parsing-README.md"; Blob = "375731d7cce96201323904b744aee097acb862c1"; Length = 7642L; Sha256 = "EB804C6C7245E323EF451DF0BF5DBD51511F72AFE4DCB48537708C2A43D8515B"; Family = "Chunk 13A source docs" }
)

function Write-Result {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("PASS", "FAIL")][string]$Level,
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Detail = ""
    )
    if ($Level -eq "PASS") { $script:Passed++; $Color = "Green" } else { $script:Failed++; $Color = "Red" }
    Write-Host "[$Level] $Name" -ForegroundColor $Color
    if (-not [string]::IsNullOrWhiteSpace($Detail)) { Write-Host "       $Detail" }
}

function Test-Condition {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$SuccessDetail = "",
        [string]$FailureDetail = ""
    )
    if ($Condition) { Write-Result "PASS" $Name $SuccessDetail } else { Write-Result "FAIL" $Name $FailureDetail }
}

function Resolve-RepositoryRoot {
    $Candidates = @($RepositoryPath, (Get-Location).Path, $PSScriptRoot)
    foreach ($Candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }
        if (-not (Test-Path -LiteralPath $Candidate -PathType Container)) { continue }
        $Resolved = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Candidate).Path).TrimEnd("\", "/")
        if ((Test-Path -LiteralPath (Join-Path $Resolved "ROOT-MANIFEST.json") -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $Resolved "backend\src\app.ts") -PathType Leaf)) { return $Resolved }
    }
    throw "Could not locate the dictionaryhub repository."
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Get-ChangedFiles {
    $Tracked = @(& git -c core.autocrlf=false diff --name-only)
    $Staged = @(& git -c core.autocrlf=false diff --cached --name-only)
    $Untracked = @(& git -c core.autocrlf=false ls-files --others --exclude-standard)
    return @($Tracked + $Staged + $Untracked | ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ } | Sort-Object -Unique)
}

function Test-StringSetsEqual {
    param([string[]]$Expected, [string[]]$Actual)
    $Difference = @(Compare-Object -ReferenceObject @($Expected | Sort-Object) -DifferenceObject @($Actual | Sort-Object))
    return $Difference.Count -eq 0
}

function Invoke-IsolatedAttributeCase {
    param(
        [Parameter(Mandatory = $true)][string]$CaseRoot,
        [Parameter(Mandatory = $true)][ValidateSet("true", "false")][string]$AutoCrlf
    )
    & git init --quiet $CaseRoot
    if ($LASTEXITCODE -ne 0) { throw "git init failed for core.autocrlf=$AutoCrlf" }
    & git -C $CaseRoot config core.autocrlf $AutoCrlf
    & git -C $CaseRoot config core.safecrlf false
    $Paths = @(
        "backend/data/example/raw/sample.txt",
        "backend/data/example/source-docs/sample.md",
        "src/app.ts",
        "backend/data/example/normalized.json",
        "backend/data/example/raw-adjacent/sample.txt",
        "backend/data/example/source-docs-adjacent/sample.md"
    )
    foreach ($Path in $Paths) {
        $Full = Join-Path $CaseRoot ($Path -replace "/", "\")
        $Directory = Split-Path -Parent $Full
        if (-not (Test-Path -LiteralPath $Directory -PathType Container)) { New-Item -ItemType Directory -Path $Directory -Force | Out-Null }
        [IO.File]::WriteAllBytes($Full, [Text.Encoding]::ASCII.GetBytes("alpha`r`nbeta`r`n"))
    }
    [IO.File]::Copy((Join-Path $script:RepositoryRoot ".gitattributes"), (Join-Path $CaseRoot ".gitattributes"), $true)
    [IO.File]::WriteAllBytes((Join-Path $CaseRoot ".git\info\attributes"), [byte[]]@())

    $RawPath = $Paths[0]
    $DocsPath = $Paths[1]
    $OrdinaryPaths = @($Paths[2..5])
    $RawAttr = (& git -C $CaseRoot check-attr text -- $RawPath).Trim()
    $DocsAttr = (& git -C $CaseRoot check-attr text -- $DocsPath).Trim()
    $OrdinaryAttrs = @($OrdinaryPaths | ForEach-Object { (& git -C $CaseRoot check-attr text -- $_).Trim() })
    $AttributesValid = ($RawAttr -eq "$RawPath`: text: unset") -and ($DocsAttr -eq "$DocsPath`: text: unset") -and (@($OrdinaryAttrs | Where-Object { $_ -notmatch ': text: unspecified$' }).Count -eq 0)

    $ProtectedPaths = @($RawPath, $DocsPath)
    $HashAgreement = $true
    $StageAgreement = $true
    $CheckoutAgreement = $true
    $ExpectedBytes = @{}
    foreach ($Path in $ProtectedPaths) {
        $Full = Join-Path $CaseRoot ($Path -replace "/", "\")
        $ExpectedBytes[$Path] = [Convert]::ToBase64String([IO.File]::ReadAllBytes($Full))
        $FilteredHash = (& git -C $CaseRoot hash-object -- $Path).Trim()
        $NoFilterHash = (& git -C $CaseRoot hash-object --no-filters -- $Path).Trim()
        if ($FilteredHash -ne $NoFilterHash) { $HashAgreement = $false }
    }
    & git -C $CaseRoot add -- .gitattributes @Paths
    if ($LASTEXITCODE -ne 0) { throw "git add failed for core.autocrlf=$AutoCrlf" }
    foreach ($Path in $ProtectedPaths) {
        $NoFilterHash = (& git -C $CaseRoot hash-object --no-filters -- $Path).Trim()
        $StagedHash = (& git -C $CaseRoot rev-parse ":$Path").Trim()
        if ($NoFilterHash -ne $StagedHash) { $StageAgreement = $false }
        [IO.File]::Delete((Join-Path $CaseRoot ($Path -replace "/", "\")))
        & git -C $CaseRoot checkout-index --force -- $Path
        if ($LASTEXITCODE -ne 0) { throw "git checkout-index failed for $Path" }
        $ActualBytes = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $CaseRoot ($Path -replace "/", "\"))))
        if ($ActualBytes -ne $ExpectedBytes[$Path]) { $CheckoutAgreement = $false }
    }
    $OrdinaryNoFilter = (& git -C $CaseRoot hash-object --no-filters -- $Paths[2]).Trim()
    $OrdinaryStaged = (& git -C $CaseRoot rev-parse ":$($Paths[2])").Trim()
    $OrdinaryBehavior = if ($AutoCrlf -eq "true") { $OrdinaryNoFilter -ne $OrdinaryStaged } else { $OrdinaryNoFilter -eq $OrdinaryStaged }

    return [pscustomobject]@{
        AutoCrlf = $AutoCrlf
        AttributesValid = $AttributesValid
        HashAgreement = $HashAgreement
        StageAgreement = $StageAgreement
        CheckoutAgreement = $CheckoutAgreement
        OrdinaryBehavior = $OrdinaryBehavior
    }
}

try {
    $script:RepositoryRoot = Resolve-RepositoryRoot
    Write-Result "PASS" "Repository location" $script:RepositoryRoot
} catch {
    Write-Result "FAIL" "Repository location" $_.Exception.Message
    exit 2
}

Push-Location $script:RepositoryRoot
try {
    $Head = (& git rev-parse HEAD).Trim()
    $Parent = (& git rev-parse HEAD^).Trim()
    $Branch = (& git branch --show-current).Trim()
    $TagsAtHead = @(& git tag --points-at HEAD)
    & git rev-parse --verify --quiet "refs/tags/$ProhibitedTag" *> $null
    $ProhibitedTagExists = $LASTEXITCODE -eq 0
    Test-Condition ($Branch -eq $ExpectedBranch) "Exact release branch" $Branch "Expected $ExpectedBranch; found $Branch."
    Test-Condition ($Head -eq $ExpectedHead) "No commit created from release baseline" $Head "Expected $ExpectedHead; found $Head."
    Test-Condition ($Parent -eq $ExpectedParent) "Exact release parent" $Parent "Expected $ExpectedParent; found $Parent."
    Test-Condition (($TagsAtHead -contains $ExpectedReleaseTag) -and ($TagsAtHead.Count -eq 1)) "Release tag at HEAD" ($TagsAtHead -join ", ") "Expected only $ExpectedReleaseTag at HEAD; found $($TagsAtHead -join ', ')."
    Test-Condition (-not $ProhibitedTagExists) "No preservation release tag created" $ProhibitedTag "Unexpected tag exists: $ProhibitedTag"
    Test-Condition (-not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot ".git\index.lock"))) "No Git index lock" "No lock exists." "The Git index lock exists."

    $Manifest = Get-Content -LiteralPath "ROOT-MANIFEST.json" -Raw | ConvertFrom-Json
    $Status = [string]$Manifest.active_stage.status
    $LifecycleValid = $false
    if ($Status -eq "active") {
        $LifecycleValid = ($Manifest.active_stage.slug -eq $StageSlug) -and ($Manifest.active_stage.specification -eq $ActiveStagePath) -and (Test-StringSetsEqual $ExpectedAllowedFiles @($Manifest.active_stage.allowed_files)) -and (Test-Path -LiteralPath $ActiveStagePath -PathType Leaf) -and (-not (Test-Path -LiteralPath $CompletedStagePath -PathType Leaf))
    } elseif ($Status -eq "inactive") {
        $LifecycleValid = [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.name) -and [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.slug) -and [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.specification) -and (@($Manifest.active_stage.allowed_files).Count -eq 0) -and (-not (Test-Path -LiteralPath $ActiveStagePath -PathType Leaf)) -and (Test-Path -LiteralPath $CompletedStagePath -PathType Leaf)
    }
    Test-Condition $LifecycleValid "Root stage lifecycle" "$Status state is valid." "Unexpected lifecycle state: $Status"

    $AttributesPath = Join-Path $script:RepositoryRoot ".gitattributes"
    $ExpectedAttributes = "# Preserve immutable upstream artifacts byte-for-byte.`nbackend/data/**/raw/** -text`nbackend/data/**/source-docs/** -text`n"
    $AttributesText = if (Test-Path -LiteralPath $AttributesPath -PathType Leaf) { [IO.File]::ReadAllText($AttributesPath).Replace("`r`n", "`n") } else { "" }
    Test-Condition ($AttributesText -eq $ExpectedAttributes) "Exact root .gitattributes policy" "Only the two protected path families use -text." "The root .gitattributes content differs from the approved policy."
    $EffectiveAttributeLines = @($AttributesText -split "`n" | Where-Object { $_ -and -not $_.StartsWith("#") })
    $NoBroadRules = ($EffectiveAttributeLines.Count -eq 2) -and ($EffectiveAttributeLines[0] -eq "backend/data/**/raw/** -text") -and ($EffectiveAttributeLines[1] -eq "backend/data/**/source-docs/** -text")
    Test-Condition $NoBroadRules "No broad or unrelated attribute rules" "Two narrow -text rules only." "Broad, filtered, EOL, language, diff, merge, or unrelated rules are present."

    $TrackedProtected = @(& git ls-files | Where-Object { $_ -match '^backend/data/.+/(raw|source-docs)/.+' })
    $ExpectedProtectedPaths = @($ProtectedRecords | ForEach-Object { $_.Path })
    Test-Condition (Test-StringSetsEqual $ExpectedProtectedPaths $TrackedProtected) "All tracked protected files enumerated" "$($TrackedProtected.Count) protected paths match the pre-stage inventory." "Tracked protected paths differ from the 11-file pre-stage inventory."

    $IdentityFailures = New-Object Collections.Generic.List[string]
    foreach ($Record in $ProtectedRecords) {
        $FullPath = Join-Path $script:RepositoryRoot ($Record.Path -replace "/", "\")
        if (-not (Test-Path -LiteralPath $FullPath -PathType Leaf)) { $IdentityFailures.Add("$($Record.Path) missing"); continue }
        $HeadBlob = (& git rev-parse "HEAD:$($Record.Path)").Trim()
        $NoFilterBlob = (& git hash-object --no-filters -- $Record.Path).Trim()
        $Length = (Get-Item -LiteralPath $FullPath).Length
        $Sha256 = Get-Sha256 $FullPath
        & git diff --quiet HEAD -- $Record.Path
        $WorktreeClean = $LASTEXITCODE -eq 0
        & git diff --cached --quiet HEAD -- $Record.Path
        $IndexClean = $LASTEXITCODE -eq 0
        if (($HeadBlob -ne $Record.Blob) -or ($NoFilterBlob -ne $Record.Blob) -or ($Length -ne $Record.Length) -or ($Sha256 -ne $Record.Sha256) -or (-not $WorktreeClean) -or (-not $IndexClean)) { $IdentityFailures.Add($Record.Path) }
    }
    Test-Condition ($IdentityFailures.Count -eq 0) "Protected HEAD blobs, lengths, SHA-256, worktree, and index" "All 11 protected paths retain exact pre-stage identities." "Mismatch: $($IdentityFailures -join ', ')"
    Test-Condition (@($ProtectedRecords | Where-Object { $_.Family -eq "Chunk 12 raw" -and $_.Blob -eq "d3ecab05c777a1b1d765574b5ae51952166a30e5" -and $_.Length -eq 4336671L -and $_.Sha256 -eq "6DDEB05FC18E988AB569549603410FECF1A40604D826187C278B3B948A92C0E4" }).Count -eq 1) "Chunk 12 Gutenberg baseline identity" "Tagged HEAD blob, 4,336,671 bytes, and SHA-256 are unchanged." "Chunk 12 baseline identity record differs."
    Test-Condition (@($IdentityFailures | Where-Object { $_ -match 'bibleroot-original-language-foundation-v1/raw/' }).Count -eq 0) "Chunk 13A raw source identities" "Four raw artifacts retain exact blobs, lengths, and SHA-256." "A Chunk 13A raw artifact differs."
    Test-Condition (@($IdentityFailures | Where-Object { $_ -match 'bibleroot-original-language-foundation-v1/source-docs/' }).Count -eq 0) "Chunk 13A pinned source-document identities" "Six pinned documents retain exact blobs, lengths, and SHA-256." "A Chunk 13A source document differs."

    $Chunk12ManifestPath = "backend/data/bibleroot-foundation-v1/dataset-manifest.json"
    $Chunk12MetadataPath = "backend/data/bibleroot-foundation-v1/source-metadata.json"
    $Chunk12Manifest = Get-Content -LiteralPath $Chunk12ManifestPath -Raw | ConvertFrom-Json
    $Chunk12Metadata = Get-Content -LiteralPath $Chunk12MetadataPath -Raw | ConvertFrom-Json
    $Chunk12RecordsValid = ((& git rev-parse "HEAD:$Chunk12ManifestPath").Trim() -eq "3a4234a8ca28ea4b1b9c7b5f060a1d110e288ad1") -and ((& git rev-parse "HEAD:$Chunk12MetadataPath").Trim() -eq "be1d378cabc3a69f129aec8b30468e295ec2377f") -and ($Chunk12Manifest.files.'raw/project-gutenberg-ebook-10-10-0.txt' -eq "0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986") -and ($Chunk12Metadata.source.byteLength -eq 4436268) -and ($Chunk12Metadata.source.sha256 -eq "0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986")
    Test-Condition $Chunk12RecordsValid "Chunk 12 accepted source records unchanged" "Manifest and source metadata retain their released hashes and lengths." "Chunk 12 accepted source records changed."

    $Chunk13ManifestPath = "backend/data/bibleroot-original-language-foundation-v1/dataset-manifest.json"
    $Chunk13MetadataPath = "backend/data/bibleroot-original-language-foundation-v1/source-metadata.json"
    $Chunk13Manifest = Get-Content -LiteralPath $Chunk13ManifestPath -Raw | ConvertFrom-Json
    $Chunk13Metadata = Get-Content -LiteralPath $Chunk13MetadataPath -Raw | ConvertFrom-Json
    $Chunk13RecordsValid = ((& git rev-parse "HEAD:$Chunk13ManifestPath").Trim() -eq "be96e22bc47458cc7036fbdf743ac4e645f6a599") -and ((& git rev-parse "HEAD:$Chunk13MetadataPath").Trim() -eq "58606e64453149547af07902f779981253c94df8") -and (@($Chunk13Manifest.files.PSObject.Properties | Where-Object { $_.Name -match '^(raw|source-docs)/' }).Count -eq 6) -and (@($Chunk13Metadata.documents).Count -eq 6) -and (@($Chunk13Metadata.artifacts).Count -eq 4)
    Test-Condition $Chunk13RecordsValid "Chunk 13A accepted source records unchanged" "Pinned refs and released source hashes remain recorded." "Chunk 13A source records changed."

    $Migration016 = "backend/db/migrations/016_create_bibleroot_original_language_foundation.sql"
    $Migration016Full = Join-Path $script:RepositoryRoot ($Migration016 -replace "/", "\")
    $Migration017 = @(Get-ChildItem -LiteralPath (Join-Path $script:RepositoryRoot "backend\db\migrations") -Filter "017*.sql" -File)
    $MigrationValid = (Test-Path -LiteralPath $Migration016Full -PathType Leaf) -and ((& git rev-parse "HEAD:$Migration016").Trim() -eq "93746e495b25bad4a3ecf7e81a7631e60d175f7c") -and ((Get-Item -LiteralPath $Migration016Full).Length -eq 6287L) -and ((Get-Sha256 $Migration016Full) -eq "02B6AE307A465472AA8A9DE89BB28514D6E7781AF4C12643EB6FB033A246F8BA") -and ($Migration017.Count -eq 0)
    Test-Condition $MigrationValid "Migration boundary" "Migration 016 is unchanged and migration 017 is absent." "Migration 016 changed or migration 017 exists."

    $TempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\")
    $TempRoot = Join-Path $TempParent ("sourceroot-immutable-attributes-" + [Guid]::NewGuid().ToString("N"))
    $IsolatedResults = @()
    try {
        if (-not $TempRoot.StartsWith($TempParent + "\", [StringComparison]::OrdinalIgnoreCase)) { throw "Temporary verification path escaped the system temp directory." }
        New-Item -ItemType Directory -Path $TempRoot | Out-Null
        $IsolatedResults = @(
            Invoke-IsolatedAttributeCase (Join-Path $TempRoot "autocrlf-true") "true"
            Invoke-IsolatedAttributeCase (Join-Path $TempRoot "autocrlf-false") "false"
        )
    } finally {
        $ResolvedTemp = [IO.Path]::GetFullPath($TempRoot).TrimEnd("\")
        if ((Test-Path -LiteralPath $ResolvedTemp -PathType Container) -and $ResolvedTemp.StartsWith($TempParent + "\", [StringComparison]::OrdinalIgnoreCase) -and ($ResolvedTemp -ne $TempParent)) { Remove-Item -LiteralPath $ResolvedTemp -Recurse -Force }
    }
    foreach ($Result in $IsolatedResults) {
        $CaseValid = $Result.AttributesValid -and $Result.HashAgreement -and $Result.StageAgreement -and $Result.CheckoutAgreement -and $Result.OrdinaryBehavior
        Test-Condition $CaseValid "Isolated core.autocrlf=$($Result.AutoCrlf) behavior" "Protected bytes stage and re-materialize exactly; ordinary text remains outside -text." "Independent attribute behavior failed for core.autocrlf=$($Result.AutoCrlf)."
    }
    Test-Condition (@($IsolatedResults | Where-Object { $_.AttributesValid -and $_.OrdinaryBehavior }).Count -eq 2) "Ordinary project text exclusion and narrow scope" "Ordinary, normalized, and adjacent paths report text unspecified in both cases." "The -text rules broaden beyond raw/source-docs."

    $ChangedFiles = @(Get-ChangedFiles)
    $OutsideAllowed = @($ChangedFiles | Where-Object { $ExpectedAllowedFiles -notcontains $_ })
    $ProtectedChanged = @($ChangedFiles | Where-Object { $_ -match '^backend/data/.+/(raw|source-docs)/.+' })
    Test-Condition (($OutsideAllowed.Count -eq 0) -and ($ProtectedChanged.Count -eq 0)) "Allowed-file boundary and protected stage diff" "$($ChangedFiles.Count) maintenance paths are within the 6-path boundary; no protected path changed." "Outside scope: $($OutsideAllowed -join ', '); protected: $($ProtectedChanged -join ', ')"

    $RepositoryZips = @(Get-ChildItem -LiteralPath $script:RepositoryRoot -Filter "*.zip" -File)
    $RepositoryZipNames = @($RepositoryZips | ForEach-Object { $_.Name })
    Test-Condition ($RepositoryZips.Count -eq 0) "No repository release ZIP created" "No root-level ZIP exists." "Unexpected ZIP: $($RepositoryZipNames -join ', ')"
    $AcceptedZips = @(
        [pscustomobject]@{ Path = "C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-DictionaryRoot-Core-Lexical-Corpus-v1.zip"; Length = 264507L; Sha256 = "E7640A0337F084D1EFFCFDC3B340A3AD7611FBA6E089ED2078B0AFE97EEAD8C0" },
        [pscustomobject]@{ Path = "C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1.zip"; Length = 260277L; Sha256 = "D4E11DD28EECC46BEFA76E3E4805BB8CDB6F8C8EE57FA07C72BEB898DF409D29" }
    )
    $ZipFailures = @($AcceptedZips | Where-Object { (-not (Test-Path -LiteralPath $_.Path -PathType Leaf)) -or ((Get-Item -LiteralPath $_.Path).Length -ne $_.Length) -or ((Get-Sha256 $_.Path) -ne $_.Sha256) })
    $ZipFailurePaths = @($ZipFailures | ForEach-Object { $_.Path })
    Test-Condition ($ZipFailures.Count -eq 0) "Accepted release ZIP identities" "Both accepted external ZIP lengths and SHA-256 values are unchanged." "Missing or changed: $($ZipFailurePaths -join ', ')"

    $IndexChanges = @(& git diff --cached --name-only)
    Test-Condition ($IndexChanges.Count -eq 0) "Git index remains empty" "No staged paths." "Staged paths: $($IndexChanges -join ', ')"
    $LocalAutoCrlf = (& git config --local --get core.autocrlf).Trim()
    $LocalEol = @(& git config --local --get core.eol)
    $InfoAttributes = Join-Path $script:RepositoryRoot ".git\info\attributes"
    Test-Condition (($LocalAutoCrlf -eq "false") -and ($LocalEol.Count -eq 0) -and (-not (Test-Path -LiteralPath $InfoAttributes))) "Local Git state unchanged and non-authoritative" "core.autocrlf=false; core.eol unset; .git/info/attributes absent." "Local Git configuration or info attributes differ from preflight."
} catch {
    Write-Result "FAIL" "Unexpected verifier exception" $_.Exception.Message
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "SourceRoot immutable source artifact preservation summary" -ForegroundColor Cyan
Write-Host "  Passes:   $script:Passed"
Write-Host "  Failures: $script:Failed"
if ($script:Failed -gt 0) { exit 1 }
exit 0
