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

# ---------------------------------------------------------------------------
# LEGACY STAGE-IDENTITY PARSER - REMOVED
#
# A Markdown-aware scanner used to live here, duplicated verbatim in three
# verifiers, to read stage identity out of a governed record. The fourth Codex
# audit proved that parser-based authorization is the wrong boundary: a record
# inside the candidate cannot establish what the candidate is allowed to be.
# The block was retained for a while marked NON-AUTHORITATIVE and UNUSED, which
# left three copies of legacy authority logic sitting in the tree looking
# authoritative to anyone who did not read the header.
#
# It is gone. Authority is read from the external signed control store by
# srgds-core, and this verifier delegates to it rather than parsing anything.
# See the GDS v1.1 TRUST CORE DELEGATION section below.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# ANCHORED COMPLETED-BUT-UNCOMMITTED WINDOW
#
# Computed ONCE and consumed by every gate that needs it, so no gate can fall
# back to a weaker rule. Authority comes from the constants below and Git state,
# never from mutable record content. Only the exact pinned record path must exist.
#
# This is a BOUNDED compensating control for the current 15A candidate while it
# is completed but deliberately uncommitted pending independent audit. It is
# not a general control plane, and deferred item H requires a future governed
# stage to retire it.
# ---------------------------------------------------------------------------
$script:AnchoredBaseline = "d55a45b9ed4e9065c186bf48a5a17ec3b5b71eb6"
$script:AnchoredDescendantSlug = "SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY-V1"
$script:AnchoredRecordRelative = "docs/stages/completed/20260810-$script:AnchoredDescendantSlug.md"
# The external Principal Architect exact allowlist. Twenty paths, no more.
$script:AnchoredDescendantPaths = @(
    "ROOT-MANIFEST.json",
    "VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1",
    "VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1",
    "VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1",
    "VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1",
    "backend/db/migrations/020_create_earthroot_place_polity_foundation.sql",
    "backend/src/earthroot/adapter.ts",
    "backend/src/earthroot/contract.ts",
    "backend/src/earthroot/domain.ts",
    "backend/src/earthroot/payload.ts",
    "backend/src/earthroot/store.ts",
    "backend/src/sourceroot/object-types.ts",
    "backend/test/earthroot-adapter.test.ts",
    "backend/test/earthroot-provenance.test.ts",
    "backend/test/earthroot-semantics.test.ts",
    "backend/test/sourceroot-shared-grammar.test.ts",
    "docs/architecture/SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY-V1.md",
    "docs/stages/active/CURRENT-STAGE.md",
    $script:AnchoredRecordRelative,
    "verification/sourceroot-shared-grammar.test.cjs"
)

function Get-AnchoredWindow([string]$RepositoryRoot) {
    $Head = (& git -C $RepositoryRoot rev-parse HEAD 2>$null)
    if ($Head) { $Head = $Head.Trim() }
    if ($Head -ne $script:AnchoredBaseline) {
        return @{ Open = $false; Reason = "HEAD has moved off the anchored baseline; the window is permanently closed" }
    }
    # A historical completed record is TRACKED. The record of a stage completed
    # but not yet committed is UNTRACKED. Only the latter opens the window, and
    # exactly one may exist, so an old record can never authorize present work.
    $Untracked = @(
        & git -C $RepositoryRoot ls-files --others --exclude-standard -- "docs/stages/completed" |
            ForEach-Object { ([string]$_).Trim().Replace("\", "/") } | Where-Object { $_ -like "*.md" }
    )
    if ($Untracked.Count -ne 1) {
        return @{ Open = $false; Reason = "expected exactly one uncommitted completed record, found $($Untracked.Count)" }
    }
    if ($Untracked[0] -ne $script:AnchoredRecordRelative) {
        return @{ Open = $false; Reason = "uncommitted completed record is not the anchored one: $($Untracked[0])" }
    }
    $Path = Join-Path $RepositoryRoot ($script:AnchoredRecordRelative -replace "/", "\")
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return @{ Open = $false; Reason = "anchored record is not readable" }
    }
    return @{ Open = $true; Reason = "open for pinned stage $script:AnchoredDescendantSlug; record content is non-authoritative" }
}

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
# GDS v1.1 TRUST CORE DELEGATION
#
# Trust-critical questions - is there a valid signed authorization, and is the
# candidate inside it - are ANSWERED BY srgds-core, not by this verifier. A
# verifier that re-derived them would be a second implementation of the rules,
# and two implementations of one rule eventually disagree, at which point the
# more permissive one is the one that matters.
#
# This section therefore contains no digesting, no path grammar, no signature
# handling and no candidate derivation. It asks, and it reports.
#
# Execution context comes from OUTSIDE the repository. When it is absent the
# section is skipped explicitly and says so: a skipped check is never counted
# as a passing one.
# ---------------------------------------------------------------------------
$GdsModule = Join-Path $PSScriptRoot "tools\SourceRoot.Governance.psm1"
$GdsContext = @{
    Stage       = $env:SRGDS_STAGE
    Id          = $env:SRGDS_AUTHORIZATION_ID
    Digest      = $env:SRGDS_AUTHORIZATION_DIGEST
    Fingerprint = $env:SRGDS_SIGNER_FINGERPRINT
    Principal   = $env:SRGDS_SIGNER_PRINCIPAL
}
$GdsContextComplete = (@(@($GdsContext.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)
# Results are published for the governance sections BELOW, which must attribute
# pending work to the SIGNED authorization rather than to a path list pinned
# inside this file. A pinned list is a release-state fact; a signed
# authorization is authority.
$script:GdsAuthorityValid = $false
$script:GdsCandidateAuthorized = $false
$script:GdsCandidatePaths = @()
$script:GdsCandidateEntries = @()
$script:GdsBaselineCommit = ""
$script:GdsTerminalRelease = $false
$script:GdsRelease = $null
$script:GdsGovernanceMode = "ungoverned"

# The RELEASED predecessor, supplied separately from current authority because
# they are different facts about different commits. Absent context simply means
# terminal state cannot be established in this run.
$GdsReleaseContext = @{
    StageSlug                   = $env:SRGDS_RELEASED_STAGE
    ExpectedAuthorizationId     = $env:SRGDS_RELEASED_AUTHORIZATION_ID
    ExpectedAuthorizationDigest = $env:SRGDS_RELEASED_AUTHORIZATION_DIGEST
    ExpectedSignerFingerprint   = $env:SRGDS_SIGNER_FINGERPRINT
    SignerPrincipal             = $env:SRGDS_SIGNER_PRINCIPAL
    AuditDigest                 = $env:SRGDS_AUDIT_DIGEST
    ReleaseDigest               = $env:SRGDS_RELEASE_DIGEST
    AuditorPrincipal            = $env:SRGDS_AUDITOR_PRINCIPAL
    AuditorFingerprint          = $env:SRGDS_AUDITOR_FINGERPRINT
    CommitBindingDigest         = $env:SRGDS_COMMIT_BINDING_DIGEST
}
$GdsReleaseContextComplete = (@(@($GdsReleaseContext.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)

if (-not (Test-Path -LiteralPath $GdsModule -PathType Leaf)) {
    Assert-True $false "GDS orchestration module is present"
} elseif (-not $GdsContextComplete) {
    Write-Host "[SKIP] GDS trust core delegation: execution context not supplied (SRGDS_*)" -ForegroundColor Yellow
    Write-Host "       This is a SKIP, not a PASS. Authority was not checked in this run."
} else {
    Import-Module $GdsModule -Force

    $GdsCoreVersion = ""
    try { $GdsCoreVersion = Get-SrgdsCoreVersion } catch { $GdsCoreVersion = "" }
    Assert-True ($GdsCoreVersion -like "srgds-core/*") "GDS trust core is present and answers ($GdsCoreVersion)"

    if ($GdsCoreVersion -like "srgds-core/*") {
        $GdsAuth = Get-GdsStageAuthorization -RepositoryRoot $PSScriptRoot -StageSlug $GdsContext.Stage `
            -ExpectedAuthorizationId $GdsContext.Id -ExpectedAuthorizationDigest $GdsContext.Digest `
            -ExpectedSignerFingerprint $GdsContext.Fingerprint -SignerPrincipal $GdsContext.Principal
        $script:GdsAuthorityValid = $GdsAuth.Valid

        # TERMINAL RELEASE STATE.
        #
        # Current authority requires HEAD to equal the signed baseline, so after
        # a release commit it is correctly and PERMANENTLY unavailable. Asserting
        # it anyway made these verifiers fail against the very release they exist
        # to verify - the fifth appearance of one defect class: a release-state
        # fact treated as a durable invariant.
        #
        # The governed question after release is different: is HEAD the released
        # truth? That is answered only from the complete historical chain, and it
        # grants nothing. The core proves, as part of answering, that the
        # historical authorization STILL fails as current authority at HEAD.
        if (-not $script:GdsAuthorityValid -and $GdsReleaseContextComplete) {
            $script:GdsRelease = Test-GdsReleaseState -RepositoryRoot $PSScriptRoot @GdsReleaseContext
            $script:GdsTerminalRelease = $script:GdsRelease.Released
        }
        $script:GdsGovernanceMode =
            if ($script:GdsAuthorityValid) { "in-flight" }
            elseif ($script:GdsTerminalRelease) { "terminal" }
            else { "ungoverned" }

        Assert-True ($script:GdsGovernanceMode -ne "ungoverned") `
            "Governance state is established through the trust core: $($script:GdsGovernanceMode)"

        if ($script:GdsAuthorityValid) {
            Assert-True ($GdsAuth.AuthorizationId -ceq $GdsContext.Id) `
                "The authorization the core returned is the issuance execution context selected"
            Assert-True ($GdsAuth.Digest -ceq $GdsContext.Digest.ToUpperInvariant()) `
                "The authorization bytes are the exact bytes execution context named"
        } elseif ($script:GdsTerminalRelease) {
            Assert-True ($script:GdsRelease.Tree -ceq $script:GdsRelease.CandidateTree) `
                "HEAD's tree is the audited candidate tree ($($script:GdsRelease.CandidateTree))"
            Assert-True ($script:GdsRelease.AuditVerdict -ceq "PASS") `
                "The released candidate carries a PASS audit binding from $($script:GdsRelease.AuditorIdentity)"
            Assert-True ($script:GdsRelease.BoundReleaseCommit -ceq $script:GdsRelease.Commit) `
                "A signed release commit binding names this exact commit, not merely its parent and tree"
            Assert-True ($script:GdsRelease.CurrentAuthorityAtHead -ceq "REJECTED") `
                "Terminal release state confers NO authority over HEAD; the consumed authorization stays consumed"
        }

        if ($GdsAuth.Valid) {
            $GdsCandidate = Get-GdsCandidateManifest -RepositoryRoot $PSScriptRoot -StageSlug $GdsContext.Stage `
                -ExpectedAuthorizationId $GdsContext.Id -ExpectedAuthorizationDigest $GdsContext.Digest `
                -ExpectedSignerFingerprint $GdsContext.Fingerprint -SignerPrincipal $GdsContext.Principal
            $script:GdsCandidateAuthorized = $GdsCandidate.Authorized
            if ($null -ne $GdsCandidate.Manifest) {
                $script:GdsCandidateEntries = @($GdsCandidate.Manifest.entries)
                $script:GdsCandidatePaths = @($script:GdsCandidateEntries | ForEach-Object { [string]$_.path })
            }
            $script:GdsBaselineCommit = [string]$GdsAuth.BaselineCommit
            Assert-True $GdsCandidate.Authorized `
                "Every candidate path is inside the signed authority ($($GdsCandidate.Reason))"
            Assert-True ($GdsCandidate.CandidateDigest -match '^[0-9A-F]{64}$') `
                "The candidate has a determinate identity ($($GdsCandidate.CandidateDigest))"

            # Determinism, measured rather than asserted: the same tree must
            # yield the same identity when asked twice.
            $GdsRepeat = Get-GdsCandidateManifest -RepositoryRoot $PSScriptRoot -StageSlug $GdsContext.Stage `
                -ExpectedAuthorizationId $GdsContext.Id -ExpectedAuthorizationDigest $GdsContext.Digest `
                -ExpectedSignerFingerprint $GdsContext.Fingerprint -SignerPrincipal $GdsContext.Principal
            Assert-True ($GdsRepeat.CandidateDigest -ceq $GdsCandidate.CandidateDigest) `
                "Candidate identity is deterministic across repeated derivation"
        }

        # A green result here is EVIDENCE, never approval. Release requires a
        # separate signed release authorization over one exact PASS audit.
        Assert-True (-not (Test-GdsLifecycleTransition -From "AUDIT_PASSED" -To "RELEASED").Allowed) `
            "A passing audit cannot reach RELEASED without a release authorization"
    }
}


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

    # -----------------------------------------------------------------------
    # HISTORICAL GDS RELEASE FACTS, read from the PINNED release commit.
    #
    # The GDS release changeset stayed inside its 7-path allowlist, and no
    # active specification was present in the released tree. Both were true AT
    # THE RELEASE BOUNDARY. Asserting them against the working tree instead turns
    # them into "no governed stage may ever run again", which fails for every
    # legitimate descendant and pressures future work to weaken this verifier
    # rather than respect it.
    # -----------------------------------------------------------------------
    $GdsReleaseCommit = "d55a45b9ed4e9065c186bf48a5a17ec3b5b71eb6"
    $GdsReleaseTag = "sourceroot-governed-development-system-v1"

    $ResolvedTag = (Invoke-RepositoryGit @("rev-list", "-n", "1", $GdsReleaseTag))
    Assert-True ($LASTEXITCODE -eq 0 -and ([string]$ResolvedTag).Trim() -eq $GdsReleaseCommit) `
        "Release tag $GdsReleaseTag still resolves to the pinned GDS release commit"

    Invoke-RepositoryGit @("merge-base", "--is-ancestor", $GdsReleaseCommit, "HEAD") | Out-Null
    Assert-True ($LASTEXITCODE -eq 0) "GDS release commit remains in the current branch ancestry"

    $ReleaseChangeset = @(Invoke-RepositoryGit @("diff", "--name-only", "$GdsReleaseCommit^", $GdsReleaseCommit))
    $ReleaseChangesetOk = ($LASTEXITCODE -eq 0)
    # Fail closed: an empty result from a broken git call must never read as
    # "the release changed nothing, therefore it was compliant".
    Assert-True ($ReleaseChangesetOk -and $ReleaseChangeset.Count -gt 0) `
        "GDS release changeset is inspectable at the pinned release commit"
    $ReleaseUnauthorized = @($ReleaseChangeset | Where-Object { $Allowed -notcontains $_ })
    Assert-True ($ReleaseChangesetOk -and $ReleaseUnauthorized.Count -eq 0) `
        "GDS release changeset stayed inside the completed GDS allowlist (historical release fact)"
    if ($ReleaseUnauthorized.Count -gt 0) {
        foreach ($Path in $ReleaseUnauthorized) { Write-Host "       unauthorized at release: $Path" -ForegroundColor Red }
    }

    $ReleaseTree = @(Invoke-RepositoryGit @("ls-tree", "-r", "--name-only", $GdsReleaseCommit))
    $ReleaseTreeOk = ($LASTEXITCODE -eq 0)
    Assert-True ($ReleaseTreeOk -and $ReleaseTree.Count -gt 0) `
        "GDS release tree is inspectable at the pinned release commit"
    Assert-True ($ReleaseTreeOk -and (-not ($ReleaseTree -contains "docs/stages/active/CURRENT-STAGE.md"))) `
        "No active specification exists in the GDS release tree (historical release fact)"
    $ReleaseMigrations = @($ReleaseTree | Where-Object { $_ -like "backend/db/migrations/*.sql" })
    Assert-True ($ReleaseTreeOk -and $ReleaseMigrations.Count -eq 20) `
        "Migration count was 20 at the GDS release (historical release fact)"
    Assert-True ($ReleaseTreeOk -and (-not ($ReleaseMigrations | Where-Object { $_ -like "*/020*" }))) `
        "Migration 020 was absent at the GDS release (historical release fact)"
    foreach ($Boundary in @("backend/src/", "backend/data/", "backend/db/migrations/")) {
        Assert-True ($ReleaseChangesetOk -and (@($ReleaseChangeset | Where-Object { $_ -like "$Boundary*" }).Count -eq 0)) `
            "GDS release itself changed nothing under $Boundary (historical release fact)"
    }
    Assert-True ($ReleaseChangesetOk -and (@($ReleaseChangeset | Where-Object { $_ -like "*package.json" -or $_ -like "*package-lock.json" }).Count -eq 0)) `
        "GDS release itself made no package or dependency change (historical release fact)"

    # -----------------------------------------------------------------------
    # CURRENT DESCENDANT GOVERNANCE.
    #
    # Present work is bounded by the CURRENT active stage, not by the old
    # completed GDS allowlist. Descendant mode is NOT a bypass: when a stage is
    # active its allowlist is enforced exactly as strictly, and when no stage is
    # active nothing may be pending at all.
    # -----------------------------------------------------------------------
    $CurrentManifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
    $CurrentStage = $null
    if ($CurrentManifest.PSObject.Properties.Name -contains "active_stage") { $CurrentStage = $CurrentManifest.active_stage }

    $Pending = @(Invoke-RepositoryGit @("diff", "--name-only", "HEAD"))
    $PendingOk = ($LASTEXITCODE -eq 0)
    $Pending += @(Invoke-RepositoryGit @("ls-files", "--others", "--exclude-standard"))
    $PendingOk = $PendingOk -and ($LASTEXITCODE -eq 0)
    Assert-True $PendingOk "Current pending inventory is readable (git succeeded)"
    $Pending = @($Pending | Sort-Object -Unique)

    if ($null -ne $CurrentStage -and [string]$CurrentStage.status -eq "active") {
        $CurrentAllowed = @()
        if ($CurrentStage.PSObject.Properties.Name -contains "allowed_files") {
            $CurrentAllowed = @($CurrentStage.allowed_files)
        }
        Assert-True ($CurrentAllowed.Count -gt 0) "Active descendant stage declares a governed allowlist"
        $CurrentSlug = ""
        if ($CurrentStage.PSObject.Properties.Name -contains "slug") { $CurrentSlug = [string]$CurrentStage.slug }
        Assert-True (-not [string]::IsNullOrWhiteSpace($CurrentSlug)) "Active descendant stage is identified by slug"

        # THE MANIFEST MAY NOT AUTHORIZE ITSELF.
        #
        # ROOT-MANIFEST.json is normally inside its own stage allowlist, so
        # reading the write boundary out of that file alone would let a stage
        # widen its own scope by appending a path to allowed_files and then
        # editing whatever it just authorized. That is precisely the
        # self-re-authorization the GDS contract forbids. The manifest is
        # therefore bound to the AUTHORED stage specification: every entry must
        # also appear in the specification's "Allowed files" section, which the
        # manifest cannot edit on its own behalf.
        $SpecRelative = ""
        if ($CurrentStage.PSObject.Properties.Name -contains "specification") { $SpecRelative = [string]$CurrentStage.specification }
        # The specification pointer is FIXED, not a free choice. Without this the
        # manifest could name any allowlisted document that happens to contain an
        # "Allowed files" heading and promote it to the authority that validates
        # the manifest, which is self-authorization by redirection.
        Assert-True ($SpecRelative -eq "docs/stages/active/CURRENT-STAGE.md") `
            "Active stage specification pointer is the canonical active stage path"
        $SpecPath = ""
        if (-not [string]::IsNullOrWhiteSpace($SpecRelative)) {
            $SpecPath = Join-Path $RepositoryRoot ($SpecRelative -replace "/", "\")
        }
        Assert-True ((-not [string]::IsNullOrWhiteSpace($SpecPath)) -and (Test-Path -LiteralPath $SpecPath -PathType Leaf)) `
            "Active descendant stage names a readable authored specification"
        if (-not [string]::IsNullOrWhiteSpace($SpecPath) -and (Test-Path -LiteralPath $SpecPath -PathType Leaf)) {
            $SpecDocument = Read-GovernedDocument $SpecRelative
            Assert-True ($null -ne $SpecDocument) "Active stage specification is readable as strict UTF-8"
            $SpecAllowedSection = Get-Section $SpecDocument.Text "(?m)^## Allowed files\s*$"
            $SpecAllowed = @([regex]::Matches($SpecAllowedSection, "``([^``]+)``") | ForEach-Object { $_.Groups[1].Value })
            Assert-True ($SpecAllowed.Count -gt 0) "Active stage specification declares its own allowlist"
            $SelfAuthorized = @($CurrentAllowed | Where-Object { $SpecAllowed -notcontains $_ })
            Assert-True ($SpecAllowed.Count -gt 0 -and $SelfAuthorized.Count -eq 0) `
                "Manifest allowlist is authorized by the stage specification, never self-widened"
            if ($SelfAuthorized.Count -gt 0) {
                foreach ($Path in $SelfAuthorized) { Write-Host "       self-authorized: $Path" -ForegroundColor Red }
            }
        }

        # Directory-marker entries are honoured the way the Root verifier honours
        # them, so a stage that legitimately declares a subtree is not forced to
        # enumerate every file or to weaken this verifier instead.
        $Unauthorized = @($Pending | Where-Object {
            $Candidate = $_
            -not (@($CurrentAllowed | Where-Object {
                $Entry = [string]$_
                ($Candidate -eq $Entry) -or ($Entry.EndsWith("/") -and $Candidate.StartsWith($Entry))
            }).Count -gt 0)
        })
        Assert-True ($PendingOk -and $Unauthorized.Count -eq 0) `
            "Pending changeset stays inside the CURRENT active stage allowlist"
        if ($Unauthorized.Count -gt 0) {
            foreach ($Path in $Unauthorized) { Write-Host "       unauthorized: $Path" -ForegroundColor Red }
        }
    } else {
        # No governed stage is active, so no UNGOVERNED work may be pending.
        #
        # "No active stage" does not imply "nothing pending". The release
        # boundary requires a completed stage to stay uncommitted until an
        # independent audit runs, so completed-but-uncommitted is an AUTHORIZED
        # state, and demanding an empty changeset failed a stage for completing
        # correctly.
        #
        # An intermediate revision fixed that by unioning the allowlists of ALL
        # completed stage records. An independent Tier 3 audit showed that is
        # unsafe: completed records are mutable untracked markdown, so the union
        # accepts unrelated dirty work, lets an OLD record authorize NEW changes,
        # and can be forged outright by dropping a file into the directory.
        #
        # The rule is therefore ANCHORED. Pending work is admissible only inside
        # a narrow window belonging to the ONE stage that just completed, and the
        # authorizing path set is pinned HERE rather than read from the record,
        # so a record can never widen its own authority. This is a bounded
        # compensating control for the current candidate, not a general control
        # plane; deferred item "GDS baseline-to-candidate changeset authority"
        # remains open and is not solved by it.
        $Window = Get-AnchoredWindow $RepositoryRoot
        $WindowReason = $Window.Reason
        # Paths come from the ANCHOR, never from the record.
        $CompletedAuthorized = @()
        if ($Window.Open) { $CompletedAuthorized = $script:AnchoredDescendantPaths }
        $UngovernedPending = @($Pending | Where-Object {
            $Candidate = $_
            -not (@($CompletedAuthorized | Where-Object {
                $Entry = [string]$_
                ($Candidate -eq $Entry) -or ($Entry.EndsWith("/") -and $Candidate.StartsWith($Entry))
            }).Count -gt 0)
        })
        # GDS v1.1 SUPERSESSION.
        #
        # The anchored window above is a bounded compensating control built when
        # authority had nowhere else to live: a path set pinned INSIDE this file,
        # opened by a release-state fact. It closes when HEAD moves, which is how
        # a released verifier ends up failing correct work.
        #
        # When a valid SIGNED authorization governs the current candidate, that
        # authorization is the authority and this file is not. Attribution is
        # then answered by srgds-core. The check does not become weaker: the core
        # requires every pending path to be inside signed, externally stored,
        # Product-Authority-signed bounds, which is strictly stronger than a list
        # this file could edit. What is added here is a CROSS-CHECK - the paths
        # this verifier sees pending must be exactly the paths the core put in
        # the candidate, so the two views cannot silently diverge.
        if ($script:GdsAuthorityValid -and $script:GdsCandidateAuthorized) {
            $PendingSet = @($Pending | Sort-Object -Unique)
            $CandidateSet = @($script:GdsCandidatePaths | Sort-Object -Unique)
            $OnlyPending = @($PendingSet | Where-Object { $CandidateSet -notcontains $_ })
            $OnlyCandidate = @($CandidateSet | Where-Object { $PendingSet -notcontains $_ })
            Assert-True ($PendingOk -and $OnlyPending.Count -eq 0 -and $OnlyCandidate.Count -eq 0) `
                "Pending work is attributable to the signed authorization, and this verifier's view of it matches the candidate the core derived"
            foreach ($Path in $OnlyPending) { Write-Host "       pending but not in the candidate: $Path" -ForegroundColor Red }
            foreach ($Path in $OnlyCandidate) { Write-Host "       in the candidate but not pending: $Path" -ForegroundColor Red }

            # WHERE A STAGE DECLARES ITSELF DEPENDS ON HOW FAR IT HAS GOT.
            #
            # This asserted that the ACTIVE specification file is present, which
            # conflated two different things: that the stage declared a
            # specification (durable, true of the whole stage) and that the file
            # exists at this instant (a state fact that stops being true the
            # moment the stage completes).
            #
            # It made a releasable candidate impossible. Completion consumes the
            # active specification - the GDS release tree at d55a45b is verified
            # above to contain none - so a candidate that consumed it failed
            # HERE, while a candidate that kept it produced a release tree that
            # fails the terminal assertion below. No candidate could satisfy
            # both. That is the same defect this whole line of work has been
            # closing: an instant's state written down as an invariant.
            #
            # The corrected rule follows the lifecycle. A governed stage declares
            # itself in EXACTLY ONE place: the active specification while work is
            # in progress, or the completed record once it is consumed. The
            # completed record is not read from the directory, where any file
            # could be dropped in - it must be a path the SIGNED authorization
            # put in this candidate.
            #
            # This is not a relaxation. "Neither present" fails exactly as
            # before, and "both present" - a half-consumed stage, which the
            # previous check accepted - now fails as well.
            # A completed record is a DECLARATION OF COMPLETION, so recognising
            # one loosely lets the candidate manufacture its own completion
            # authority. A Tier-3 audit found the previous form did exactly
            # that: a case-insensitive wildcard and "Count -gt 0", which accept
            # any number of records and several spellings of one.
            #
            # Recognition is now singular and canonical. Exactly ONE entry, in
            # exactly the canonical path form, matched ORDINALLY, not a
            # deletion, drawn from the SIGNED candidate rather than from
            # directory contents, and actually present on disk. Zero records,
            # two records, case-varied duplicates and deletion-only entries all
            # fail to establish completion.
            $ActiveSpecPresent = Test-Path -LiteralPath (Join-Path $RepositoryRoot "docs\stages\active\CURRENT-STAGE.md")

            # Candidates are collected CASE-INSENSITIVELY and then required to be
            # a single CANONICAL one. Filtering case-sensitively first would
            # silently ignore a case-varied twin instead of rejecting it, and on
            # a case-insensitive filesystem the two spellings are one file - an
            # ambiguity that must fail, not be quietly resolved.
            $CompletedEntries = @($script:GdsCandidateEntries | Where-Object {
                (([string]$_.path) -imatch '^docs/stages/completed/[^/]+\.md$') -and (([string]$_.change) -cne "delete")
            })
            $CompletedSpecPresent = ($CompletedEntries.Count -eq 1) -and
                (([string]$CompletedEntries[0].path) -cmatch '^docs/stages/completed/[^/]+\.md$') -and
                (Test-Path -LiteralPath (Join-Path $RepositoryRoot (([string]$CompletedEntries[0].path) -replace "/", "\")) -PathType Leaf)
            Assert-True ($ActiveSpecPresent -ne $CompletedSpecPresent) `
                "A signed governed stage in flight declares its specification in exactly one place (active: $ActiveSpecPresent, consumed into exactly one authorized completed record: $CompletedSpecPresent, completed entries: $($CompletedEntries.Count))"
        } elseif ($script:GdsTerminalRelease) {
            # TERMINAL RELEASE STATE. No authorization governs HEAD, and none
            # should: current authority requires HEAD to be a signed baseline,
            # and HEAD is a release commit. There is consequently nothing for
            # pending work to be attributed TO, so this branch admits none -
            # which is strictly stronger than the signed branch above, not a
            # relaxation of it.
            Assert-True ($PendingOk -and $Pending.Count -eq 0) `
                "At a terminal release state nothing is pending against HEAD ($($Pending.Count) found)"
            foreach ($Path in $Pending) { Write-Host "       pending at a terminal release: $Path" -ForegroundColor Red }
            Assert-True (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "docs\stages\active\CURRENT-STAGE.md"))) `
                "At a terminal release state the active specification stays consumed"
        } else {
            Assert-True ($PendingOk -and $UngovernedPending.Count -eq 0) `
                "With no active stage and no signed authorization, every pending path is attributable to the anchored completed stage"
            if ($UngovernedPending.Count -gt 0) {
                Write-Host "       anchored window: $WindowReason" -ForegroundColor Red
                foreach ($Path in $UngovernedPending) { Write-Host "       ungoverned: $Path" -ForegroundColor Red }
            }
            Assert-True (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot "docs\stages\active\CURRENT-STAGE.md"))) `
                "With no active stage, the active specification stays consumed"
        }
    }
}

# ---------------------------------------------------------------------------
# PRESERVATION INVARIANTS
# ---------------------------------------------------------------------------
# A descendant migration EXISTING is not a GDS failure. What GDS durably
# guarantees is that the released chain is never rewritten or shortened: the
# count may grow, never shrink, and the 20 migrations present at release must
# still be present now.
$Migrations = @(Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "backend\db\migrations") -File -Filter "*.sql")
Assert-True ($Migrations.Count -ge 20) `
    "Migration chain is never shortened below the 20 present at GDS release (found $($Migrations.Count))"

# Presence by NAME is not integrity. Comparing the release blob SHA against the
# current file content is what makes "never rewritten" true: renaming nothing
# while silently rewriting the body of a released migration would otherwise pass.
$ReleaseMigrationBlobs = @{}
foreach ($Line in @(Invoke-RepositoryGit @("ls-tree", "-r", $GdsReleaseCommit, "backend/db/migrations/"))) {
    if ($Line -match "^\s*\d+\s+blob\s+([0-9a-f]{40})\s+(.+)$") {
        $ReleaseMigrationBlobs[[IO.Path]::GetFileName($Matches[2].Trim())] = $Matches[1]
    }
}
Assert-True ($ReleaseMigrationBlobs.Count -eq 20) `
    "Release migration blob identities are inspectable at the pinned release commit"

$RewrittenSinceRelease = @()
$MissingSinceRelease = @()
foreach ($Name in $ReleaseMigrationBlobs.Keys) {
    $Current = @($Migrations | Where-Object { $_.Name -ceq $Name })
    if ($Current.Count -ne 1) { $MissingSinceRelease += $Name; continue }
    $CurrentBlob = ([string](Invoke-RepositoryGit @("hash-object", "--no-filters", "--", "backend/db/migrations/$Name"))).Trim()
    if ($CurrentBlob -ne $ReleaseMigrationBlobs[$Name]) { $RewrittenSinceRelease += $Name }
}
Assert-True ($MissingSinceRelease.Count -eq 0) "Every migration present at GDS release is still present"
if ($MissingSinceRelease.Count -gt 0) {
    foreach ($Name in $MissingSinceRelease) { Write-Host "       missing since release: $Name" -ForegroundColor Red }
}
Assert-True ($RewrittenSinceRelease.Count -eq 0) `
    "No migration present at GDS release has been rewritten since"
if ($RewrittenSinceRelease.Count -gt 0) {
    foreach ($Name in $RewrittenSinceRelease) { Write-Host "       rewritten since release: $Name" -ForegroundColor Red }
}

# A migration beyond the release set must be ATTRIBUTABLE to a governed stage.
# Without this, growth is unconditionally permitted and an agent can commit an
# arbitrary migration, declare the stage inactive, and pass a clean tree.
$NewMigrations = @($Migrations | Where-Object { -not $ReleaseMigrationBlobs.ContainsKey($_.Name) })
$GovernedPaths = New-Object System.Collections.Generic.HashSet[string]
# The manifest may only grant attribution while it is ACTIVE, because the
# manifest-to-specification binding that stops self-widening runs only in the
# active branch. Consuming allowed_files with no status gate reopened the exact
# bypass this check exists to close: commit a migration, declare the stage
# inactive, and let the ungoverned manifest attribute it to itself.
if ($null -ne $CurrentStage -and
    [string]$CurrentStage.status -eq "active" -and
    $CurrentStage.PSObject.Properties.Name -contains "allowed_files") {
    foreach ($Path in @($CurrentStage.allowed_files)) { [void]$GovernedPaths.Add([string]$Path) }
}
# An independent audit found this previously enumerated EVERY completed record
# and unioned their declared paths. That is generic completed-record authority
# and it is prohibited: a historical record could authorize a NEW migration
# forever merely because its allowlist once named that path, and a forged record
# dropped into the directory could authorize anything at all.
#
# Attribution is now tied to the SAME anchored stage transition that governs the
# pending changeset. Only the one stage that just completed, still uncommitted
# and still matching the external anchor, can explain a migration beyond the
# release set. Old records authorize nothing; forged records authorize nothing.
#
# This is the smallest bounded correction consistent with the existing external
# 15A anchor. Permanent authority architecture is deferred to GDS maintenance
# (deferred items A, B, and H).
$MigrationWindow = Get-AnchoredWindow $RepositoryRoot
if ($MigrationWindow.Open) {
    foreach ($Path in $script:AnchoredDescendantPaths) { [void]$GovernedPaths.Add([string]$Path) }
}
$UngovernedMigrations = @($NewMigrations | Where-Object { -not $GovernedPaths.Contains("backend/db/migrations/$($_.Name)") })

# GDS v1.1 SUPERSESSION, on the same reasoning as the pending-path rule above.
#
# Under a valid signed authorization, attribution of a migration is answered by
# whether the CANDIDATE touches it. The signed authorization for this stage
# protects backend/ outright, so no migration can enter this candidate at all -
# and that is asserted here rather than assumed. Migrations that already exist
# in the baseline are historical release facts belonging to the stage that
# introduced them; they are not this candidate's to attribute, and demanding
# that a closed anchor window keep vouching for them is what turned a released
# fact into a permanent invariant.
if ($script:GdsAuthorityValid -and $script:GdsCandidateAuthorized) {
    $CandidateMigrations = @($script:GdsCandidatePaths | Where-Object { $_ -like "backend/db/migrations/*" })
    Assert-True ($CandidateMigrations.Count -eq 0) `
        "The signed authorization admits no migration into this candidate ($($CandidateMigrations.Count) found)"
    foreach ($Path in $CandidateMigrations) { Write-Host "       candidate migration: $Path" -ForegroundColor Red }
} elseif ($script:GdsTerminalRelease) {
    # TERMINAL MIGRATION ATTRIBUTION.
    #
    # The anchored development window is STRUCTURALLY unavailable here. It is
    # open only while HEAD is still a historical baseline, and a release moves
    # HEAD by definition, so after terminalization it can never attribute
    # anything again. Continuing to ask it was the same defect this system keeps
    # closing: a fact true at one commit written down as a durable invariant.
    # It made migration 020 - committed governed history from the 15A stage -
    # read as ungoverned at the very release that shipped it.
    #
    # The durable evidence at terminal state is the RELEASE TREE ITSELF. A
    # Product Authority ReleaseCommitBinding names this exact commit, its tree is
    # the audited candidate tree, and a PASS audit and a Product Authority
    # release authorization cover that candidate. A migration inside that tree
    # was therefore inside a signed, independently audited candidate. Nothing
    # else is accepted as attribution - not the manifest, not a completed
    # record, not the filesystem.
    #
    # This is not a relaxation of the window it replaces. It additionally binds
    # the BYTES of every migration that entered after the GDS release, migration
    # 020 among them, which the release-set blob comparison above cannot cover
    # because 020 is not in that set. A migration edited, added, renamed or
    # removed after the release diverges from the bound tree and fails here.
    $BoundMigrations = @{}
    foreach ($Line in @(Invoke-RepositoryGit @("ls-tree", "-r", "HEAD", "backend/db/migrations/"))) {
        if ($Line -match "^\s*\d+\s+blob\s+([0-9a-f]{40})\s+(.+)$") {
            $BoundMigrations[[IO.Path]::GetFileName($Matches[2].Trim())] = $Matches[1]
        }
    }
    # Fail closed: an unreadable tree must never read as "no migrations, so
    # nothing to attribute".
    Assert-True ($BoundMigrations.Count -ge 20) `
        "The bound release tree's migration set is inspectable ($($BoundMigrations.Count) found)"

    $NotInBoundTree = @()
    $DivergedFromBoundTree = @()
    foreach ($Item in $Migrations) {
        if (-not $BoundMigrations.ContainsKey($Item.Name)) { $NotInBoundTree += $Item.Name; continue }
        $Blob = ([string](Invoke-RepositoryGit @("hash-object", "--no-filters", "--", "backend/db/migrations/$($Item.Name)"))).Trim()
        if ($Blob -cne $BoundMigrations[$Item.Name]) { $DivergedFromBoundTree += $Item.Name }
    }
    $MissingFromBoundSet = @()
    foreach ($Name in $BoundMigrations.Keys) {
        if (@($Migrations | Where-Object { $_.Name -ceq $Name }).Count -ne 1) { $MissingFromBoundSet += $Name }
    }

    Assert-True ($NotInBoundTree.Count -eq 0) `
        "Every migration present is attributable to the cryptographically bound release tree ($($NotInBoundTree.Count) unattributable)"
    foreach ($Name in $NotInBoundTree) { Write-Host "       not in the bound release tree: $Name" -ForegroundColor Red }

    Assert-True ($DivergedFromBoundTree.Count -eq 0) `
        "Every attributed migration is byte-identical to the bound release tree ($($DivergedFromBoundTree.Count) diverged)"
    foreach ($Name in $DivergedFromBoundTree) { Write-Host "       diverged from the bound release tree: $Name" -ForegroundColor Red }

    Assert-True ($MissingFromBoundSet.Count -eq 0) `
        "Every migration in the bound release tree is still present ($($MissingFromBoundSet.Count) missing)"
    foreach ($Name in $MissingFromBoundSet) { Write-Host "       missing from the bound release set: $Name" -ForegroundColor Red }
} else {
    if ($UngovernedMigrations.Count -gt 0) {
        Write-Host "       migration attribution window: $($MigrationWindow.Reason)" -ForegroundColor Red
    }
    Assert-True ($UngovernedMigrations.Count -eq 0) `
        "Every migration added since GDS release is attributable to a governed stage"
    if ($UngovernedMigrations.Count -gt 0) {
        foreach ($Item in $UngovernedMigrations) { Write-Host "       ungoverned migration: $($Item.Name)" -ForegroundColor Red }
    }
}

# Current product/runtime and migration changes are governed by the CURRENT
# active stage, enforced above. GDS does not own that boundary, and asserting
# "no change under backend/src/" here would forbid all future development.
$Manifest = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "ROOT-MANIFEST.json") | ConvertFrom-Json
Assert-True (@($Manifest.known_verifiers) -contains "VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1") "This verifier is declared in the manifest"
# The GDS stage itself is completed. A LATER stage may legitimately be active,
# but it must never be the GDS stage reopened.
$ActiveStatus = ""
$ActiveSlug = ""
if ($Manifest.PSObject.Properties.Name -contains "active_stage" -and $null -ne $Manifest.active_stage) {
    $ActiveStatus = [string]$Manifest.active_stage.status
    if ($Manifest.active_stage.PSObject.Properties.Name -contains "slug") { $ActiveSlug = [string]$Manifest.active_stage.slug }
}
Assert-True ($ActiveStatus -eq "inactive" -or $ActiveStatus -eq "active") "Manifest declares a coherent stage status"
Assert-True ($ActiveSlug -ne "SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-V1") `
    "The completed GDS stage is never reopened as the active stage"

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
