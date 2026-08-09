<#
.SYNOPSIS
Verification-gates and completes the active Root stage.

.PARAMETER SkipVerification
Explicitly skips required verifier execution and records that fact.

.PARAMETER UnresolvedManualCheck
Manual checks that remain unresolved at completion.

.PARAMETER CompletionNotes
Optional completion note stored with the completed stage.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$SkipVerification,

    [Parameter()]
    [string[]]$UnresolvedManualCheck = @(),

    [Parameter()]
    [string]$CompletionNotes = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    # Mutable lifecycle and governance artifacts are written UTF-8 without BOM
    # and with LF line endings. Normalization happens in memory at the write
    # boundary, which also covers StringBuilder.AppendLine output.
    $Normalized = $Content -replace "`r`n", "`n" -replace "`r", "`n"
    $Encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Normalized, $Encoding)
}

function Read-Utf8File {
    param([string]$Path)
    # STRICT UTF-8 lifecycle read contract.
    #
    # Two decoding boundaries have to be closed here, not one. Windows
    # PowerShell 5.1 `Get-Content` decodes with the system ANSI code page, so
    # BOM-less UTF-8 was silently corrupted: an em dash (E2 80 94) became three
    # windows-1252 characters that the UTF-8 writer then persisted as mojibake.
    # `[IO.File]::ReadAllText($Path, $Encoding)` fixes that but still performs
    # byte-order-mark auto-detection, so it silently ACCEPTS UTF-16 and UTF-32
    # input that this contract must reject.
    #
    # Bytes are therefore read raw, the byte-order mark is classified
    # explicitly, and only UTF-8 is ever decoded.
    #
    #   Accepted: BOM-less UTF-8, and UTF-8 with a BOM. An accepted BOM is
    #             stripped and never reaches the content or the writer.
    #   Rejected: UTF-16LE/BE, UTF-32LE/BE, and any invalid UTF-8 sequence.
    #
    # There is no fallback decoder. Malformed input fails closed.
    $Bytes = [IO.File]::ReadAllBytes($Path)

    # UTF-32 signatures are tested first: UTF-32LE (FF FE 00 00) begins with
    # the UTF-16LE signature (FF FE), so the shorter test would shadow it.
    if ($Bytes.Length -ge 4 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE -and $Bytes[2] -eq 0x00 -and $Bytes[3] -eq 0x00) {
        throw "Lifecycle text must be UTF-8; a UTF-32LE byte-order mark was found: $Path"
    }
    if ($Bytes.Length -ge 4 -and $Bytes[0] -eq 0x00 -and $Bytes[1] -eq 0x00 -and $Bytes[2] -eq 0xFE -and $Bytes[3] -eq 0xFF) {
        throw "Lifecycle text must be UTF-8; a UTF-32BE byte-order mark was found: $Path"
    }
    if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) {
        throw "Lifecycle text must be UTF-8; a UTF-16LE byte-order mark was found: $Path"
    }
    if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF) {
        throw "Lifecycle text must be UTF-8; a UTF-16BE byte-order mark was found: $Path"
    }

    $Offset = 0
    if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
        $Offset = 3
    }
    # GetString over an explicit byte range performs no BOM auto-detection, and
    # throwOnInvalidBytes makes malformed UTF-8 throw instead of degrading to
    # U+FFFD replacement characters. An empty file decodes to an empty string.
    $Encoding = New-Object Text.UTF8Encoding($false, $true)
    return $Encoding.GetString($Bytes, $Offset, $Bytes.Length - $Offset)
}

function ConvertTo-SafeFullPath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $Normalized = $RelativePath.Trim().Replace("/", "\")
    if ([IO.Path]::IsPathRooted($Normalized) -or $Normalized -match '(^|\\)\.{1,2}(\\|$)') {
        throw "Unsafe repository-relative path: $RelativePath"
    }
    $Full = [IO.Path]::GetFullPath((Join-Path $script:RepositoryRoot $Normalized))
    if (-not $Full.StartsWith($script:RepositoryRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes the repository: $RelativePath"
    }
    return $Full
}

function Get-ChangedFiles {
    if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) {
        return @("[Git unavailable]")
    }
    $Tracked = @(& git -c core.autocrlf=false -C $script:RepositoryRoot diff --name-only 2>$null)
    $Staged = @(& git -c core.autocrlf=false -C $script:RepositoryRoot diff --cached --name-only 2>$null)
    $Untracked = @(& git -c core.autocrlf=false -C $script:RepositoryRoot ls-files --others --exclude-standard 2>$null)
    return @($Tracked + $Staged + $Untracked |
        ForEach-Object { ([string]$_).Trim().Replace("\", "/") } |
        Where-Object { $_ } |
        Sort-Object -Unique)
}

try {
    $script:RepositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..")).TrimEnd("\", "/")
    $ManifestPath = Join-Path $script:RepositoryRoot "ROOT-MANIFEST.json"
    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        throw "ROOT-MANIFEST.json is missing."
    }
    $Manifest = Read-Utf8File -Path $ManifestPath | ConvertFrom-Json
    if (
        $null -eq $Manifest.active_stage -or
        [string]$Manifest.active_stage.status -ne "active" -or
        [string]::IsNullOrWhiteSpace([string]$Manifest.active_stage.specification)
    ) {
        throw "No active stage exists."
    }

    $StagePath = ConvertTo-SafeFullPath -RelativePath ([string]$Manifest.active_stage.specification)
    if (-not (Test-Path -LiteralPath $StagePath -PathType Leaf)) {
        throw "Active stage specification is missing: $($Manifest.active_stage.specification)"
    }

    # VALIDATE FIRST, MUTATE SECOND.
    #
    # Everything derived from the stage record's own content is computed here,
    # while the governed filesystem is still untouched. Previously the record
    # was moved into docs/stages/completed and only then decoded, so an
    # undecodable stage file failed AFTER the move: the active record was gone,
    # an orphan sat in the completed directory, and the manifest still claimed
    # an active stage pointing at a path that no longer existed. Reading and
    # shaping the content up front means any content-derived failure now leaves
    # stage state exactly as it was found.
    $StageText = Read-Utf8File -Path $StagePath
    if ([string]::IsNullOrWhiteSpace($StageText)) {
        throw "Active stage specification is empty: $($Manifest.active_stage.specification)"
    }
    if ($StageText -notmatch '(?m)^#\s+\S') {
        throw "Active stage specification has no title heading: $($Manifest.active_stage.specification)"
    }

    # The stage template ships a terminal "## Completion record" placeholder.
    # Replace that section rather than appending after it, so a completed
    # record always carries exactly one completion heading. Truncating at the
    # LAST such heading also makes re-completion idempotent: a regenerated
    # record replaces the previous one instead of stacking duplicates.
    $StageLines = @($StageText -split "`r?`n")
    $TerminalHeadingIndex = -1
    for ($Index = $StageLines.Count - 1; $Index -ge 0; $Index--) {
        if (([string]$StageLines[$Index]).Trim() -eq "## Completion record") {
            $TerminalHeadingIndex = $Index
            break
        }
    }
    $StageBody = if ($TerminalHeadingIndex -gt 0) {
        ($StageLines[0..($TerminalHeadingIndex - 1)] -join "`n")
    } elseif ($TerminalHeadingIndex -eq 0) {
        ""
    } else {
        $StageText
    }

    $VerifierResults = New-Object System.Collections.Generic.List[string]
    if ($SkipVerification) {
        Write-Host "[WARN] Required verification explicitly skipped." -ForegroundColor Yellow
        $VerifierResults.Add("SKIPPED explicitly with -SkipVerification")
    } else {
        $RequiredVerifiers = @($Manifest.active_stage.required_verifiers)
        if ($RequiredVerifiers.Count -eq 0) {
            throw "The active stage has no required verifiers."
        }
        $PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
        foreach ($VerifierValue in $RequiredVerifiers) {
            $VerifierRelative = [string]$VerifierValue
            $VerifierPath = ConvertTo-SafeFullPath -RelativePath $VerifierRelative
            if (-not (Test-Path -LiteralPath $VerifierPath -PathType Leaf)) {
                throw "Required verifier is missing: $VerifierRelative"
            }
            Write-Host "[INFO] Running required verifier: $VerifierRelative" -ForegroundColor Cyan
            & $PowerShell -NoProfile -ExecutionPolicy Bypass -File $VerifierPath
            $VerifierExitCode = $LASTEXITCODE
            $VerifierResults.Add("$VerifierRelative -> exit $VerifierExitCode")
            if ($VerifierExitCode -ne 0) {
                throw "Required verifier failed: $VerifierRelative (exit $VerifierExitCode)"
            }
        }
    }

    $CompletedDirectory = Join-Path $script:RepositoryRoot "docs\stages\completed"
    if (-not (Test-Path -LiteralPath $CompletedDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $CompletedDirectory | Out-Null
    }
    $DatePrefix = (Get-Date).ToString("yyyyMMdd")
    $BaseName = "$DatePrefix-$($Manifest.active_stage.slug).md"
    $CompletedPath = Join-Path $CompletedDirectory $BaseName
    $Counter = 1
    while (Test-Path -LiteralPath $CompletedPath) {
        $CompletedPath = Join-Path $CompletedDirectory ("{0}-{1:D2}-{2}.md" -f $DatePrefix, $Counter, $Manifest.active_stage.slug)
        $Counter++
    }
    # Destination conditions are proven before the move, so completion never
    # overwrites an existing record and never mutates stage state only to fail
    # on a directory it could not have written to anyway.
    if (Test-Path -LiteralPath $CompletedPath) {
        throw "Completed stage destination already exists: $CompletedPath"
    }
    if (-not (Test-Path -LiteralPath $CompletedDirectory -PathType Container)) {
        throw "Completed stage directory is missing: $CompletedDirectory"
    }

    Move-Item -LiteralPath $StagePath -Destination $CompletedPath
    $ChangedFiles = @(Get-ChangedFiles)
    $CompletionBuilder = New-Object Text.StringBuilder
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("## Completion record")
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("- Completion date: $([DateTimeOffset]::Now.ToString("o"))")
    [void]$CompletionBuilder.AppendLine("- Verification skipped: $([bool]$SkipVerification)")
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("### Verifier results")
    [void]$CompletionBuilder.AppendLine()
    foreach ($Result in $VerifierResults) {
        [void]$CompletionBuilder.AppendLine("- $Result")
    }
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("### Changed files")
    [void]$CompletionBuilder.AppendLine()
    if ($ChangedFiles.Count -eq 0) {
        [void]$CompletionBuilder.AppendLine("- None")
    } else {
        foreach ($Path in $ChangedFiles) {
            [void]$CompletionBuilder.AppendLine("- ``$Path``")
        }
    }
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("### Unresolved manual checks")
    [void]$CompletionBuilder.AppendLine()
    if ($UnresolvedManualCheck.Count -eq 0) {
        [void]$CompletionBuilder.AppendLine("- None reported")
    } else {
        foreach ($Check in $UnresolvedManualCheck) {
            [void]$CompletionBuilder.AppendLine("- $Check")
        }
    }
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine("### Completion notes")
    [void]$CompletionBuilder.AppendLine()
    [void]$CompletionBuilder.AppendLine($(if ([string]::IsNullOrWhiteSpace($CompletionNotes)) { "None." } else { $CompletionNotes.Trim() }))

    # $StageBody was decoded and truncated before any mutation occurred, so
    # nothing derived from the record's own content can fail from here on.
    Write-Utf8File -Path $CompletedPath -Content ($StageBody.TrimEnd() + "`n" + $CompletionBuilder.ToString())

    $Manifest.active_stage = [pscustomobject][ordered]@{
        name = ""
        slug = ""
        specification = ""
        allowed_files = @()
        required_verifiers = @()
        preflight_changed_files = @()
        status = "inactive"
    }
    $ManifestJson = $Manifest | ConvertTo-Json -Depth 30
    $null = $ManifestJson | ConvertFrom-Json
    Write-Utf8File -Path $ManifestPath -Content ($ManifestJson + "`r`n")

    $CompletedRelative = $CompletedPath.Substring($script:RepositoryRoot.Length + 1).Replace("\", "/")
    Write-Host "[PASS] Stage completed: $CompletedRelative" -ForegroundColor Green
    Write-Host "[INFO] The manifest active stage is now inactive." -ForegroundColor Cyan
    Write-Host "[INFO] No commit or push was performed." -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
