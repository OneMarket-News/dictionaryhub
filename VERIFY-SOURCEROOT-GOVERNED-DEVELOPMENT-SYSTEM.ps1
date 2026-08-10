<#
.SYNOPSIS
Focused verifier for SourceRoot Governed Development System v1.

.DESCRIPTION
Static and deterministic. No database access, no network access, no test
execution. It validates the three durable GDS Markdown artifacts, their
encoding, the governance rules they must express, the Appendix A worked
example, the pending changeset against the completed stage allowlist, and the
preservation invariants this governance stage must not disturb.

Safety rules are checked as SECTION-SCOPED INVARIANTS rather than as presence
of a phrase: each safety section must contain its required canonical semantics
AND must not contain targeted contradictory semantics. Presence-only checking
allowed a contradiction to coexist with the required clause and still pass.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepositoryRoot = $PSScriptRoot
$PassCount = 0
$FailureCount = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) { $script:PassCount++; Write-Host "[PASS] $Message" -ForegroundColor Green }
    else { $script:FailureCount++; Write-Host "[FAIL] $Message" -ForegroundColor Red }
}

# Process-local Git only. A host-level global excludes file may be unreadable;
# neutralizing it here is deterministic, never persisted, and fails closed by
# widening rather than narrowing the observed changeset. autocrlf is pinned so
# a line-ending advisory on stderr cannot become a terminating
# NativeCommandError under Windows PowerShell 5.1 StrictMode. Global
# configuration is never modified.
function Invoke-RepositoryGit([string[]]$GitArguments) {
    $All = @("-c", "core.excludesFile=", "-c", "core.autocrlf=false", "-C", $RepositoryRoot) + $GitArguments
    $Previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $RawOutput = @(& git @All 2>&1)
        $ExitCode = [int]$LASTEXITCODE
    } finally { $ErrorActionPreference = $Previous }

    $StdOut = @($RawOutput | Where-Object { $_ -isnot [Management.Automation.ErrorRecord] } |
        ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
    $StdErr = @($RawOutput | Where-Object { $_ -is [Management.Automation.ErrorRecord] } |
        ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
    $Result = [pscustomobject]@{
        ExitCode = $ExitCode
        StdOut = $StdOut
        StdErr = $StdErr
        CommandDescription = "git " + ($All -join " ")
    }
    if ($Result.ExitCode -ne 0) {
        $Detail = if ($Result.StdErr.Count -gt 0) { ": " + ($Result.StdErr -join " | ") } else { "" }
        throw "Git command failed with exit $($Result.ExitCode): $($Result.CommandDescription)$Detail"
    }
    return @($Result.StdOut)
}

# Strict UTF-8 read: no BOM auto-detection, no ANSI fallback.
function Read-GovernedDocument([string]$RelativePath) {
    $Full = Join-Path $RepositoryRoot ($RelativePath -replace "/", "\")
    if (-not (Test-Path -LiteralPath $Full -PathType Leaf)) { return $null }
    $Bytes = [IO.File]::ReadAllBytes($Full)
    $Offset = 0
    if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) { $Offset = 3 }
    return [pscustomobject]@{
        Path = $RelativePath
        HasBom = ($Offset -eq 3)
        CarriageReturns = @($Bytes | Where-Object { $_ -eq 13 }).Count
        Text = (New-Object Text.UTF8Encoding($false, $true)).GetString($Bytes, $Offset, $Bytes.Length - $Offset)
    }
}

# Governed documents are hard-wrapped, so a sentence spans line breaks and
# emphasis splits phrases. Structural checks use raw text with line anchors;
# semantic checks use derived forms so a harmless reflow cannot fail a rule
# that is intact.
function ConvertTo-FlatText([string]$Text) { return ($Text -replace "\s+", " ") }
function ConvertTo-PlainText([string]$Text) { return ((($Text -replace "[*`]", "") -replace "\s+", " ")) }

# Returns the plain-text body of one "## " section, up to the next "## ".
function Get-Section([string]$Text, [string]$HeadingRegex) {
    $Start = [regex]::Match($Text, $HeadingRegex)
    if (-not $Start.Success) { return "" }
    $Rest = $Text.Substring($Start.Index + $Start.Length)
    $Next = [regex]::Match($Rest, "(?m)^##\s")
    $Body = if ($Next.Success) { $Rest.Substring(0, $Next.Index) } else { $Rest }
    return (ConvertTo-PlainText $Body)
}

# A safety invariant is required semantics PLUS absence of targeted
# contradictions. Both halves must hold for the section to be sound.
function Assert-SectionInvariant {
    param(
        [string]$Section,
        [string]$Label,
        [string[]]$Required = @(),
        [string[]]$Prohibited = @()
    )
    if ([string]::IsNullOrWhiteSpace($Section)) {
        Assert-True $false "$Label section is present"
        return
    }
    foreach ($Pattern in $Required) {
        Assert-True ($Section -match $Pattern) "$Label requires: $Pattern"
    }
    foreach ($Pattern in $Prohibited) {
        Assert-True (-not ($Section -match $Pattern)) "$Label rejects contradiction: $Pattern"
    }
}

Write-Host "SourceRoot Governed Development System v1 verifier" -ForegroundColor Cyan
Write-Host "Repository: $RepositoryRoot"
Write-Host ""

$ContractPath = "docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md"
$TaskPath     = "docs/stages/templates/SUBAGENT-TASK-CONTRACT-TEMPLATE.md"
$RecordPath   = "docs/stages/templates/STAGE-EXECUTION-RECORD-TEMPLATE.md"

$Paths = @($ContractPath, $TaskPath, $RecordPath)
$Documents = $Paths | ForEach-Object { Read-GovernedDocument $_ }
foreach ($Index in 0..2) {
    $Document = $Documents[$Index]
    Assert-True ($null -ne $Document) "Durable GDS artifact exists: $($Paths[$Index])"
    if ($null -eq $Document) { continue }
    Assert-True (-not $Document.HasBom) "UTF-8 without BOM: $($Paths[$Index])"
    Assert-True ($Document.CarriageReturns -eq 0) "LF line endings only: $($Paths[$Index])"
}
if ($Documents -contains $null) {
    Write-Host "[FAIL] Cannot continue without all three durable artifacts." -ForegroundColor Red
    Write-Host "Failure count: $FailureCount" -ForegroundColor Red
    exit 1
}
$Contract = $Documents[0].Text
$TaskTemplate = $Documents[1].Text
$Record = $Documents[2].Text
$ContractPlain = ConvertTo-PlainText $Contract
$TaskPlain = ConvertTo-PlainText $TaskTemplate
$RecordPlain = ConvertTo-PlainText $Record

$IdentitySection  = Get-Section $Contract "(?m)^## 1\. .*$"
$AuthoritySection = Get-Section $Contract "(?m)^## 2\. .*$"
$StopSection      = Get-Section $Contract "(?m)^## 3\. .*$"
$AppendixSection  = Get-Section $Contract "(?m)^## 12\. .*$"

# ---------------------------------------------------------------------------
# SAFETY INVARIANT A - FINAL RELEASE AUTHORITY
# ---------------------------------------------------------------------------
foreach ($Role in @("Product Authority", "Principal Architect", "Engineering Lead", "Independent Audit")) {
    Assert-True ($AuthoritySection -match [regex]::Escape($Role)) "Authority section names the $Role function"
}
foreach ($Name in @("Josh", "Sol", "Claude Lead", "Codex")) {
    Assert-True ($AuthoritySection -match [regex]::Escape($Name)) "Authority section records the current implementation: $Name"
}
Assert-SectionInvariant -Section $AuthoritySection -Label "Release authority" -Required @(
    "No AI role has final release authority",
    "may not approve its own scope expansion",
    "green verifier is evidence, never approval",
    "Implementation completion is not release completion"
) -Prohibited @(
    "(?i)(?<!No )(AI role|Engineering Lead|Independent Audit|Principal Architect|Specialist|subagent|Codex|Claude Lead|Sol)\b[^.]{0,70}\b(has|holds|is granted|receives|may exercise)\b[^.]{0,40}final release authority",
    "(?i)final release authority (may be|can be|is) (delegated|granted|assigned|transferred)",
    "(?i)(may|can) (approve|authorize) (its|their) own release",
    "(?i)a (passing|green) verifier (is|constitutes) (release )?approval"
)

# ---------------------------------------------------------------------------
# SAFETY INVARIANT B - STOP AND BOUNDED RECOVERY
# ---------------------------------------------------------------------------
Assert-SectionInvariant -Section $StopSection -Label "STOP semantics" -Required @(
    "STOP is an authority boundary",
    "execution terminates",
    "specific.{0,40}bounded recovery path",
    "no general .reasonable workaround. clause",
    "recovery path that would itself need a recovery path is not bounded"
) -Prohibited @(
    "(?i)(may|can) continue (despite|notwithstanding|after) (a |an )?STOP",
    "(?i)reasonable workaround (is|may be|are) (permitted|allowed|acceptable)",
    "(?i)(continue|proceed)[^.]{0,50}pending (a )?(later )?review",
    "(?i)generic recovery (path|is|may)",
    "(?i)any STOP condition (may|can) be (recovered|resumed|overridden)",
    "(?i)inferred permission (is|may be) (sufficient|acceptable|enough)"
)
foreach ($Condition in @("scope expansion", "architecture uncertainty", "missing credentials", "ownership conflict")) {
    Assert-True ($StopSection -match [regex]::Escape($Condition)) "STOP section enumerates: $Condition"
}

# ---------------------------------------------------------------------------
# SAFETY INVARIANT C - APPENDIX A / 15A AUTHORIZATION
# ---------------------------------------------------------------------------
Assert-SectionInvariant -Section $AppendixSection -Label "Appendix A" -Required @(
    "WORKED EXAMPLE .{0,3} NOT AN AUTHORIZED STAGE",
    "does not open, authorize, schedule, or begin",
    "must not be executed",
    "SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY-V1",
    "Risk tier: Tier 3",
    "Architect / Scout",
    "Wave 1 reconnaissance",
    "not a final architecture",
    "no migration 020"
) -Prohibited @(
    "(?i)(is|are|hereby) authoriz(ed|es)[^.]{0,50}(15A|EarthRoot)",
    "(?i)(may|can|is cleared to) (begin|start|open|execute|schedule)[^.]{0,50}(15A|EarthRoot|this stage|the worked task)",
    "(?i)this appendix authorizes",
    "(?i)implementation may proceed",
    "(?i)Appendix A (is|constitutes) authorization"
)

# ---------------------------------------------------------------------------
# SAFETY INVARIANT D - CONTRACT CONFLICT FIRES STOP
# ---------------------------------------------------------------------------
Assert-SectionInvariant -Section $IdentitySection -Label "Contract conflict" -Required @(
    "GDS asserts precedence over nothing",
    "a conflict is a STOP condition",
    "Do not select or apply either conflicting rule while resolution is pending",
    "Resume only after an explicit authorized resolution",
    "Conflict resolution requires authority"
) -Prohibited @(
    "(?i)newest (rule )?wins",
    "(?i)most specific (rule )?wins",
    "(?i)GDS (always )?(wins|takes precedence|overrides)",
    "(?i)(may|can) continue while (the )?(conflict|resolution) is pending"
)

# ---------------------------------------------------------------------------
# SAFETY INVARIANT E - SCOPE EXPANSION RESOLVER
# ---------------------------------------------------------------------------
Assert-SectionInvariant -Section $StopSection -Label "Scope expansion resolver" -Required @(
    "No agent may self-approve a scope or risk-tier change",
    "Engineering Lead may not self-re-authorize its own scope expansion",
    "requires Principal Architect re-authorization",
    "Escalate to the Product Authority",
    "reclassified and escalated before execution continues",
    "No one may downgrade a tier"
) -Prohibited @(
    "(?i)Engineering Lead may (self-re-authorize|re-authorize its own)",
    "(?i)(may|can) reclassify after"
)

# ---------------------------------------------------------------------------
# RISK TIERS
# ---------------------------------------------------------------------------
$TierMatches = @([regex]::Matches($Contract, "(?m)^\|\s*\*\*([1-4])\*\*\s*\|"))
Assert-True ($TierMatches.Count -eq 4) "Exactly four risk tiers are defined"
Assert-True ((@($TierMatches | ForEach-Object { $_.Groups[1].Value }) -join "") -eq "1234") "Risk tiers are numbered 1 through 4 in order"
Assert-True ($ContractPlain -match "higher tier applies") "Ambiguous tier resolves upward"

# ---------------------------------------------------------------------------
# SUBAGENT TASK CONTRACT
# ---------------------------------------------------------------------------
$MandatoryFields = @(
    "Task", "Risk tier", "Specialist role", "Execution wave", "Owned files",
    "Allowed reads", "Prohibited actions", "Input assumptions", "Required output",
    "Invariants to preserve", "Tests and verification", "STOP conditions",
    "Escalation criteria"
)
foreach ($Field in $MandatoryFields) {
    Assert-True ($TaskTemplate -match ("(?m)^##\s+" + [regex]::Escape($Field) + "\s*$")) "Task contract template defines mandatory field: $Field"
    Assert-True ($AppendixSection -match ("- " + [regex]::Escape($Field) + ":")) "Appendix A instantiates mandatory field: $Field"
}
Assert-True ($TaskPlain -match "Scope expansion requires explicit re-authorization\.") "Task contract forbids silent scope expansion"
Assert-True ($TaskPlain -match "may not expand its own ownership") "Task contract forbids self-expanded ownership"

# ---------------------------------------------------------------------------
# OWNERSHIP, RETRY, FUNNEL, KNOWLEDGE SYNC
# ---------------------------------------------------------------------------
Assert-True ($ContractPlain -match "Shared hotspots are owned by the Engineering Lead") "Shared hotspots default to Engineering Lead ownership"
Assert-True ($ContractPlain -match "must not independently modify the same shared hotspot") "Parallel subagents may not collide on a shared hotspot"
Assert-True ($ContractPlain -match "holds a veto") "Migration / Data Integrity Reviewer holds a veto"
Assert-True ($ContractPlain -match "at most two targeted repair") "Retry bound is two targeted repair attempts"
Assert-True ($ContractPlain -match "On the third recurrence") "Third recurrence escalates"
Assert-True ($ContractPlain -match "does not reset it") "Failure counter cannot be reset by reframing"
Assert-True ($ContractPlain -match "builder is never the sole approver") "Builder is never the sole approver"
foreach ($Stage in @("subagent self-test", "focused verifier", "adversarial review", "release approval")) {
    Assert-True ($ContractPlain -match [regex]::Escape($Stage)) "Verification funnel includes: $Stage"
}
Assert-True ($ContractPlain -match "Josh-Brain is not an implementation authority") "Josh-Brain is explicitly not an implementation authority"
Assert-True ($ContractPlain -match "runs after a meaningful release or checkpoint") "Knowledge Sync runs after release, not before"
Assert-True ($ContractPlain -match "Knowledge Sync automation is not implemented") "Knowledge Sync automation is declared not implemented"

# ---------------------------------------------------------------------------
# EXISTING CONTRACTS REFERENCED, NOT DUPLICATED
# ---------------------------------------------------------------------------
foreach ($Reference in @(
    "AGENTS.md", "ROOT-VERIFICATION.md", "ROOT-PROTECTED-FUNCTIONALITY.md",
    "docs/build/CODEX-STAGE-CONTRACT.md", "docs/build/AGENT-SAFETY-BASELINE.md",
    "docs/build/STAGE-PACKAGE-STANDARD.md"
)) {
    Assert-True ($ContractPlain -match [regex]::Escape($Reference)) "GDS references the existing contract: $Reference"
}
Assert-True ($ContractPlain -match "must not be conflated") "GDS separates product-agent safety from development-time governance"

# ---------------------------------------------------------------------------
# EXECUTION RECORD - AUDIT RECOMMENDATION VS RELEASE DECISION
# ---------------------------------------------------------------------------
foreach ($Section in @("Identity", "Effort", "Execution", "Verification", "Governance",
                       "Independent Audit recommendation", "Product Authority release decision", "Outcome")) {
    Assert-True ($Record -match ("(?m)^##\s+" + [regex]::Escape($Section) + "\s*$")) "Execution record defines section: $Section"
}
foreach ($Field in @("Auditor / actor", "Recommendation", "Recommendation date", "Material findings or reference")) {
    Assert-True ($RecordPlain -match ("\| " + [regex]::Escape($Field) + " \|")) "Execution record records audit field: $Field"
}
foreach ($Field in @("Approving authority", "Decision", "Decision date", "Release authorization or reference")) {
    Assert-True ($RecordPlain -match ("\| " + [regex]::Escape($Field) + " \|")) "Execution record records release field: $Field"
}
Assert-True ($RecordPlain -match "An Independent Audit PASS is not release approval") "Execution record: audit PASS is not release approval"
Assert-True ($RecordPlain -match "a verifier PASS is not release approval") "Execution record: verifier PASS is not release approval"
Assert-True ($RecordPlain -match "Only the Product Authority may make the final SourceRoot release decision") "Execution record: only Product Authority releases"
Assert-True ($RecordPlain -match "no automated collection exists") "Execution record is explicitly not a telemetry system"

# ---------------------------------------------------------------------------
# POST-COMPLETION ALLOWLIST ENFORCEMENT
#
# Once the stage is completed the manifest active_stage is cleared and the
# Root verifier stops enforcing scope, so the authorized allowlist is read from
# the completed stage record, which is the canonical lifecycle evidence.
# ---------------------------------------------------------------------------
$CompletedRecords = @(Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "docs\stages\completed") -File -Filter "*-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-V1.md")
Assert-True ($CompletedRecords.Count -eq 1) "Exactly one completed GDS stage record exists"
if ($CompletedRecords.Count -eq 1) {
    $CompletedRelative = "docs/stages/completed/" + $CompletedRecords[0].Name
    $CompletedDocument = Read-GovernedDocument $CompletedRelative
    Assert-True ($null -ne $CompletedDocument) "Completed GDS stage record is readable as strict UTF-8"
    $AllowedSection = Get-Section $CompletedDocument.Text "(?m)^## Allowed files\s*$"
    $Allowed = @([regex]::Matches($AllowedSection, "``([^``]+)``") | ForEach-Object { $_.Groups[1].Value })
    Assert-True ($Allowed.Count -eq 7) "Completed GDS allowlist declares 7 authorized paths"
    Assert-True ($Allowed -contains $CompletedRelative) "Completed record is itself inside the authorized allowlist"
    Assert-True ($Allowed -contains "docs/stages/active/CURRENT-STAGE.md") "Allowlist retains the consumed active specification path"

    $Pending = @(Invoke-RepositoryGit @("diff", "--name-only", "HEAD")) +
               @(Invoke-RepositoryGit @("ls-files", "--others", "--exclude-standard"))
    $Pending = @($Pending | Sort-Object -Unique)
    $Unauthorized = @($Pending | Where-Object { $Allowed -notcontains $_ })
    Assert-True ($Unauthorized.Count -eq 0) "Pending changeset stays inside the completed GDS allowlist"
    if ($Unauthorized.Count -gt 0) {
        foreach ($Path in $Unauthorized) { Write-Host "       unauthorized: $Path" -ForegroundColor Red }
    }
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "docs\stages\active\CURRENT-STAGE.md"))) "Active specification remains consumed by completion"
}

# ---------------------------------------------------------------------------
# PRESERVATION INVARIANTS
# ---------------------------------------------------------------------------
$Migrations = @(Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "backend\db\migrations") -File -Filter "*.sql")
Assert-True ($Migrations.Count -eq 20) "Migration count remains 20"
Assert-True (-not ($Migrations | Where-Object { $_.Name -like "020*" })) "Migration 020 is absent"

$Changed = @(Invoke-RepositoryGit @("diff", "--name-only", "HEAD")) +
           @(Invoke-RepositoryGit @("ls-files", "--others", "--exclude-standard"))
foreach ($Boundary in @("backend/src/", "backend/data/", "backend/db/migrations/")) {
    Assert-True (@($Changed | Where-Object { $_ -like "$Boundary*" }).Count -eq 0) "No change under $Boundary"
}
Assert-True (@($Changed | Where-Object { $_ -like "*package.json" -or $_ -like "*package-lock.json" }).Count -eq 0) "No package or dependency change"

$Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
Assert-True (@($Manifest.known_verifiers) -contains "VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1") "This verifier is declared in the manifest"
Assert-True ([string]$Manifest.active_stage.status -eq "inactive") "GDS stage is completed and inactive"

Invoke-RepositoryGit @("diff", "--check") | Out-Null
Assert-True ($LASTEXITCODE -eq 0) "git diff --check reports no whitespace error"
Assert-True (@(Invoke-RepositoryGit @("diff", "--cached", "--name-only")).Count -eq 0) "Git index is empty"

Write-Host ""
Write-Host "Verifier summary" -ForegroundColor Cyan
Write-Host "Pass count: $PassCount"
Write-Host "Failure count: $FailureCount"
if ($FailureCount -gt 0) { Write-Host "Overall result: FAIL" -ForegroundColor Red; exit 1 }
Write-Host "Overall result: PASS" -ForegroundColor Green
exit 0
