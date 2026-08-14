<#
.SYNOPSIS
Reusable negative-control harness for the SourceRoot governed development system.

.DESCRIPTION
A verifier that only ever passes proves nothing. Every control below asserts
that the system REFUSES something, and the harness fails if any refusal does not
happen. A control that cannot fail is not a control.

Five families:

  SELECTION   authority is selected by explicit id AND digest, never by
              existence, recency, or sort order, and one issuance can never be
              answered by another
  INTEGRITY   tampered bytes, wrong keys, wrong namespaces and non-canonical
              form are refused
  GRAMMAR     unsafe paths and unauthorized paths are refused
  RECOVERY    a signed recovery eligibility covers exactly one predecessor and
              one recovery stage, is issuable only by the configured Product
              Authority, and never becomes release state or path authority.
              This family is APPLICABILITY-GATED and reports exactly one of
              three states, because a completed recovery is a success and must
              not be reported as a failure:
                IN-FLIGHT     a recovery is live; the full adversarial family
                              R0-R16 genuinely exercises
                SPENT         the one hop is taken. The REAL signed eligibility
                              must authenticate first and only then be refused,
                              because a refusal earned by asking about a stage
                              that never had an eligibility proves nothing.
                              R0'/R15'/R16'/R17/R18 carry it; R3-R11 are RETIRED
                              rather than counted, because they would refuse
                              every input and so prove nothing
                NOT-SUPPLIED  the historical recovery identity is incomplete;
                              explicitly not exercised, never substituted from
                              current authority
              Response-shape controls R12.*, R13 and R14 apply in every state.
  STRUCTURE   the PowerShell module contains no trust-core implementation, and
              the trust core is present and answers

The harness mutates NOTHING in the repository and NOTHING in the control store.
Every negative case is expressed by asking the core a question whose only honest
answer is a refusal.

.EXAMPLE
  ./tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1
#>
[CmdletBinding()]
param(
    [Parameter()][string]$RepositoryRoot,
    [Parameter()][string]$StageSlug = $env:SRGDS_STAGE,
    [Parameter()][string]$AuthorizationId = $env:SRGDS_AUTHORIZATION_ID,
    [Parameter()][string]$AuthorizationDigest = $env:SRGDS_AUTHORIZATION_DIGEST,
    [Parameter()][string]$SignerFingerprint = $env:SRGDS_SIGNER_FINGERPRINT,
    [Parameter()][string]$SignerPrincipal = $env:SRGDS_SIGNER_PRINCIPAL,
    [Parameter()][string]$ReleasedStageSlug = $env:SRGDS_RELEASED_STAGE,
    [Parameter()][string]$ReleasedAuthorizationId = $env:SRGDS_RELEASED_AUTHORIZATION_ID,
    [Parameter()][string]$ReleasedAuthorizationDigest = $env:SRGDS_RELEASED_AUTHORIZATION_DIGEST,
    [Parameter()][string]$AuditDigest = $env:SRGDS_AUDIT_DIGEST,
    [Parameter()][string]$ReleaseDigest = $env:SRGDS_RELEASE_DIGEST,
    [Parameter()][string]$AuditorPrincipal = $env:SRGDS_AUDITOR_PRINCIPAL,
    [Parameter()][string]$AuditorFingerprint = $env:SRGDS_AUDITOR_FINGERPRINT,
    [Parameter()][string]$CommitBindingDigest = $env:SRGDS_COMMIT_BINDING_DIGEST,
    [Parameter()][string]$SupersededCommit = $env:SRGDS_SUPERSEDED_COMMIT,
    [Parameter()][string]$EligibilityDigest = $env:SRGDS_ELIGIBILITY_DIGEST,
    # THE CALLER'S ASSERTION ABOUT THE HISTORICAL RECOVERY IDENTITY.
    #
    # Two audits found two halves of one rule here. The first found the controls
    # building their context from CURRENT authority: after a follow-up stage
    # opened they looked for an eligibility filed under that stage, found no such
    # file, and reported the refusal as a spent hop. That proved only that a file
    # which never existed does not exist.
    #
    # Naming the historical recovery explicitly fixed that, and introduced the
    # second half of the defect: a NAME IS NOT AN AUTHENTICATION. An older but
    # validly signed authorization for the same recovery stage and the same
    # baseline also authenticates the eligibility and is also refused at the
    # baseline, so it too could be presented as the spend - even though it is not
    # the authorization the released recovery chain is bound to.
    #
    # These three values therefore remain REQUIRED, so omission stays visible,
    # but they are an ASSERTION TO BE CHECKED and never the source of truth. The
    # authoritative identity is derived below from something signed.
    [Parameter()][string]$RecoveryStageSlug = $env:SRGDS_RECOVERY_STAGE,
    [Parameter()][string]$RecoveryAuthorizationId = $env:SRGDS_RECOVERY_AUTHORIZATION_ID,
    [Parameter()][string]$RecoveryAuthorizationDigest = $env:SRGDS_RECOVERY_AUTHORIZATION_DIGEST,
    [Parameter()][string]$CorePath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}
Import-Module (Join-Path $PSScriptRoot "SourceRoot.Governance.psm1") -Force

$script:Passed = 0
$script:Failed = 0

function Test-Control {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Expectation,
        [Parameter(Mandatory = $true)][bool]$Held,
        [Parameter()][string]$Detail
    )
    if ($Held) { $script:Passed++; $Mark = "HELD" } else { $script:Failed++; $Mark = "*** FAILED ***" }
    Write-Output ("{0,-8} {1,-62} {2}" -f $Id, $Expectation, $Mark)
    if ($Detail) { Write-Output "         $Detail" }
}

function Test-Refusal {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Expectation,
        [Parameter(Mandatory = $true)][scriptblock]$Attempt
    )
    # A refusal may arrive as a REJECT verdict or as a thrown error. Both are
    # refusals; neither is success. Anything else is an acceptance.
    try {
        $Result = & $Attempt
        $Refused = -not [bool]$Result
        $Detail = $(if ($Refused) { "rejected" } else { "ACCEPTED" })
    } catch {
        $Refused = $true
        $Detail = "threw: $($_.Exception.Message.Split([Environment]::NewLine)[0])"
    }
    Test-Control -Id $Id -Expectation $Expectation -Held $Refused -Detail $Detail
}

$Context = @{
    RepositoryRoot              = $RepositoryRoot
    StageSlug                   = $StageSlug
    ExpectedAuthorizationId     = $AuthorizationId
    ExpectedAuthorizationDigest = $AuthorizationDigest
    ExpectedSignerFingerprint   = $SignerFingerprint
    SignerPrincipal             = $SignerPrincipal
}
if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $Context.CorePath = $CorePath }

# The RELEASED predecessor is a separate execution context because it describes a
# DIFFERENT commit. Conflating it with current authority is the mistake the
# terminal-state stage exists to remove.
$ReleaseContext = @{
    RepositoryRoot              = $RepositoryRoot
    StageSlug                   = $ReleasedStageSlug
    ExpectedAuthorizationId     = $ReleasedAuthorizationId
    ExpectedAuthorizationDigest = $ReleasedAuthorizationDigest
    ExpectedSignerFingerprint   = $SignerFingerprint
    SignerPrincipal             = $SignerPrincipal
    AuditDigest                 = $AuditDigest
    ReleaseDigest               = $ReleaseDigest
    AuditorPrincipal            = $AuditorPrincipal
    AuditorFingerprint          = $AuditorFingerprint
    CommitBindingDigest         = $CommitBindingDigest
}
if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $ReleaseContext.CorePath = $CorePath }
$ReleaseContextComplete = (@(@($ReleaseContext.Values) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)

function Get-VariantRelease {
    param([hashtable]$Override)
    $Copy = @{}
    foreach ($Key in $ReleaseContext.Keys) { $Copy[$Key] = $ReleaseContext[$Key] }
    foreach ($Key in $Override.Keys) { $Copy[$Key] = $Override[$Key] }
    return $Copy
}

function Get-VariantContext {
    # Returns a COPY of the execution context with one or more values replaced.
    # The result must be bound to a variable before splatting: @(Get-VariantContext ...)
    # would wrap the hashtable in an array and splat it positionally.
    param([hashtable]$Override)
    $Copy = @{}
    foreach ($Key in $Context.Keys) { $Copy[$Key] = $Context[$Key] }
    foreach ($Key in $Override.Keys) { $Copy[$Key] = $Override[$Key] }
    return $Copy
}

Write-Output "SOURCEROOT GDS NEGATIVE CONTROL HARNESS"
Write-Output "repository : $RepositoryRoot"
Write-Output "core       : $(Get-SrgdsCorePath -Path $CorePath)"
Write-Output ""

# ---------------------------------------------------------------------------
Write-Output "=== POSITIVE BASELINE (the harness must be able to observe success) ==="
# A repository is governed in exactly one of two ways, and which one it is
# depends on where HEAD stands:
#
#   IN-FLIGHT  HEAD is a signed baseline. Current authority verifies, and the
#              SELECTION / INTEGRITY / GRAMMAR families below are live.
#   TERMINAL   HEAD is a release commit. Current authority is correctly and
#              permanently unavailable, and the governed fact is instead that
#              HEAD is the released truth, provable only from the historical
#              chain and conferring nothing.
#
# Refusing to run in the second state was the harness reproducing, in its own
# positive baseline, the defect the rest of the system just removed.
$Baseline = Get-GdsStageAuthorization @Context
$Terminal = $null
$TerminalHolds = $false
if ($ReleaseContextComplete) {
    $Terminal = Test-GdsReleaseState @ReleaseContext
    $TerminalHolds = $Terminal.Released
}
$Mode = $(if ($Baseline.Valid) { "in-flight" } elseif ($TerminalHolds) { "terminal" } else { "ungoverned" })

Test-Control -Id "P0" -Expectation "a governed state is observable ($Mode)" -Held ($Mode -ne "ungoverned") `
    -Detail $(if ($Baseline.Valid) { $Baseline.Reason } elseif ($null -ne $Terminal) { $Terminal.Reason } else { "no released-stage context was supplied" })
if ($Mode -eq "ungoverned") {
    Write-Output ""
    Write-Output "The positive baseline failed. Every negative control below would pass"
    Write-Output "vacuously, so the harness stops rather than reporting a green run."
    exit 2
}
if (-not $ReleaseContextComplete) {
    # Said out loud. A family that quietly does not run looks identical to a
    # family that ran and held, and this harness exists precisely to make that
    # confusion impossible.
    Write-Output ""
    Write-Output "=== TERMINAL: NOT EXERCISED IN THIS RUN ==="
    Write-Output "The released-stage context is incomplete, so no terminal release state"
    Write-Output "could be established and the terminal controls did NOT run. This is a SKIP."
    foreach ($Pair in @(
        @{ Name = "SRGDS_RELEASED_STAGE"; Value = $ReleasedStageSlug },
        @{ Name = "SRGDS_RELEASED_AUTHORIZATION_ID"; Value = $ReleasedAuthorizationId },
        @{ Name = "SRGDS_RELEASED_AUTHORIZATION_DIGEST"; Value = $ReleasedAuthorizationDigest },
        @{ Name = "SRGDS_AUDIT_DIGEST"; Value = $AuditDigest },
        @{ Name = "SRGDS_RELEASE_DIGEST"; Value = $ReleaseDigest },
        @{ Name = "SRGDS_AUDITOR_PRINCIPAL"; Value = $AuditorPrincipal },
        @{ Name = "SRGDS_AUDITOR_FINGERPRINT"; Value = $AuditorFingerprint },
        @{ Name = "SRGDS_COMMIT_BINDING_DIGEST"; Value = $CommitBindingDigest }
    )) {
        if ([string]::IsNullOrWhiteSpace($Pair.Value)) { Write-Output "  missing: $($Pair.Name)" }
    }
}
if ($TerminalHolds) {
    Test-Control -Id "P1" -Expectation "the terminal release tree is the audited candidate tree" `
        -Held ($Terminal.Tree -ceq $Terminal.CandidateTree) -Detail "$($Terminal.Tree) / $($Terminal.CandidateTree)"
}

# ---------------------------------------------------------------------------
# AUDITOR SEPARATION.
#
# Contract section 2 requires the reviewing and approving functions to be held
# by distinct actors. An audit found the implementation did not enforce it: the
# Product Authority key authenticated every AuditBinding ever issued while the
# object named someone else as the auditor.
#
# These controls run in EVERY mode, because the separation is a property of the
# configured identities rather than of any particular release. The cryptographic
# properties are proven exhaustively in the Go suite; what is checked here is
# that the execution context this repository actually runs with keeps the two
# roles apart, and that naming the Product Authority as the auditor is refused.
Write-Output ""
Write-Output "=== AUDITOR SEPARATION (reviewing and approving are distinct actors) ==="
Test-Control -Id "A1" -Expectation "the auditor principal is not the Product Authority principal" `
    -Held ($AuditorPrincipal -cne $SignerPrincipal) -Detail "$AuditorPrincipal vs $SignerPrincipal"
Test-Control -Id "A2" -Expectation "the auditor key is not the Product Authority key" `
    -Held ($AuditorFingerprint -cne $SignerFingerprint) -Detail "$AuditorFingerprint vs $SignerFingerprint"
if ($ReleaseContextComplete) {
    Test-Refusal -Id "A3" -Expectation "naming the Product Authority as the independent auditor is refused" -Attempt {
        $AsSelf = Get-VariantRelease @{ AuditorPrincipal = $SignerPrincipal; AuditorFingerprint = $SignerFingerprint }
        (Test-GdsReleaseState @AsSelf).Released
    }
}

# ---------------------------------------------------------------------------
if ($TerminalHolds) {
    Write-Output ""
    Write-Output "=== TERMINAL (a released state proves history and grants nothing) ==="

    # The controls that matter most: terminal state must not become a way to
    # obtain authority, and it must not accept a chain it cannot reconstruct.
    Test-Control -Id "T1" -Expectation "terminal state confers NO current authority over HEAD" `
        -Held ($Terminal.CurrentAuthorityAtHead -ceq "REJECTED") -Detail $Terminal.CurrentAuthorityAtHead

    $HistoricalAsCurrent = Get-GdsStageAuthorization -RepositoryRoot $RepositoryRoot -StageSlug $ReleasedStageSlug `
        -ExpectedAuthorizationId $ReleasedAuthorizationId -ExpectedAuthorizationDigest $ReleasedAuthorizationDigest `
        -ExpectedSignerFingerprint $SignerFingerprint -SignerPrincipal $SignerPrincipal
    Test-Control -Id "T2" -Expectation "the consumed authorization still fails as CURRENT authority" `
        -Held (-not $HistoricalAsCurrent.Valid) -Detail $HistoricalAsCurrent.Reason

    # Every binding in the chain must be load-bearing. If any of these is
    # accepted, terminal state is a hole rather than a proof.
    $TerminalVariants = @(
        @{ Id = "T3"; What = "a released authorization id that was never issued"; Over = @{ ExpectedAuthorizationId = "00000000-0000-4000-8000-000000000000" } },
        @{ Id = "T4"; What = "a released authorization digest that is one byte wrong"; Over = @{ ExpectedAuthorizationDigest = ("0" * 64) } },
        @{ Id = "T5"; What = "an audit binding digest that is not the audited one"; Over = @{ AuditDigest = ("0" * 64) } },
        @{ Id = "T6"; What = "a release authorization digest that is not the signed one"; Over = @{ ReleaseDigest = ("0" * 64) } },
        @{ Id = "T7"; What = "an auditor principal the audit was not issued to"; Over = @{ AuditorPrincipal = "not-the-auditor@example.invalid" } },
        @{ Id = "T8"; What = "an auditor key fingerprint that did not sign the audit"; Over = @{ AuditorFingerprint = "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } },
        @{ Id = "T9"; What = "a signer fingerprint that did not sign the authorization"; Over = @{ ExpectedSignerFingerprint = "SHA256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" } },
        @{ Id = "T10"; What = "a released stage slug that does not name this release"; Over = @{ StageSlug = "SOURCEROOT-NO-SUCH-STAGE-V1" } },
        # The audit finding: parent and tree do not identify a commit.
        @{ Id = "T11"; What = "a release commit binding digest that was never signed"; Over = @{ CommitBindingDigest = ("0" * 64) } }
    )
    foreach ($Variant in $TerminalVariants) {
        # The override is carried in a variable that is NOT a Test-Refusal
        # parameter name. Naming it $Attempt splatted the scriptblock itself,
        # so every control "held" by throwing a parameter-binding error - eight
        # controls that could not fail, which is exactly what this harness
        # exists to make impossible.
        $TerminalOverride = $Variant.Over
        Test-Refusal -Id $Variant.Id -Expectation "release state is refused for $($Variant.What)" -Attempt {
            $ReleaseVariant = Get-VariantRelease $TerminalOverride; (Test-GdsReleaseState @ReleaseVariant).Released
        }
    }
}

# ---------------------------------------------------------------------------
# RECOVERY.
#
# A released-stage context that is COMPLETE but does not establish terminal
# state is the case this family exists for, and it used to be invisible: the
# terminal block simply did not run, and the harness said nothing, so a
# predecessor whose audit chain fails the corrected auditor model looked exactly
# like a run where the terminal family held. That is the confusion this harness
# was written to make impossible, reproduced inside the harness itself.
#
# So it is now stated out loud, and the honest positive fact is asserted in its
# place: the predecessor is NOT released truth, AND a signed Product Authority
# eligibility permits exactly one bounded recovery of it. Both halves are
# controls. Eligibility that could not be refused would be a rubber stamp, and
# eligibility that quietly implied release state would be the laundering the
# whole corrected model exists to prevent.
# ===========================================================================
# THE AUTHORITATIVE RECOVERY IDENTITY IS DERIVED, NOT ACCEPTED.
#
# The eligibility lookup below is driven by an identity this harness derives
# from something SIGNED. The caller's assertion never selects it.
#
# Where the authority comes from depends on the state, and both sources are
# already authenticated before this point:
#
#   IN-FLIGHT  the current StageAuthorization, which the positive baseline P0
#              has already verified by id, digest, signature and schema.
#   SPENT      the released recovery chain. `release-state` accepts only after
#              it has verified the signed ReleaseCommitBinding AND found the
#              released authorization's id and digest equal to the ones named
#              INSIDE that binding. So once $TerminalHolds is true, the released
#              authorization identity is a chain-authenticated fact.
#
# That second point is what closes the substitution hole. An older, validly
# signed authorization for the same stage and baseline can authenticate an
# eligibility and be refused at the baseline, which is why it could previously
# masquerade as the spend. It cannot, however, be the authorization named inside
# the signed ReleaseCommitBinding - only one authorization is. Deriving from the
# binding therefore distinguishes "an authorization that would also be refused"
# from "the authorization this release is actually bound to".
# ===========================================================================
$AuthoritativeRecovery = $null
$AuthoritativeRecoverySource = ""
if ($TerminalHolds) {
    $AuthoritativeRecovery = @{
        StageSlug           = $ReleasedStageSlug
        AuthorizationId     = $ReleasedAuthorizationId
        AuthorizationDigest = $ReleasedAuthorizationDigest
    }
    $AuthoritativeRecoverySource = "the signed ReleaseCommitBinding, authenticated by release-state"
} elseif ($Baseline.Valid) {
    $AuthoritativeRecovery = @{
        StageSlug           = $Baseline.StageSlug
        AuthorizationId     = $Baseline.AuthorizationId
        AuthorizationDigest = $Baseline.Digest
    }
    $AuthoritativeRecoverySource = "the current StageAuthorization, authenticated by the positive baseline"
}

# The context is built from the DERIVED identity. Substituting the caller's
# assertion here would reintroduce the defect no matter how it is later checked.
$RecoveryContext = @{
    RepositoryRoot              = $RepositoryRoot
    RecoveryStageSlug           = $(if ($null -ne $AuthoritativeRecovery) { $AuthoritativeRecovery.StageSlug } else { "" })
    ExpectedAuthorizationId     = $(if ($null -ne $AuthoritativeRecovery) { $AuthoritativeRecovery.AuthorizationId } else { "" })
    ExpectedAuthorizationDigest = $(if ($null -ne $AuthoritativeRecovery) { $AuthoritativeRecovery.AuthorizationDigest } else { "" })
    ExpectedSignerFingerprint   = $SignerFingerprint
    SignerPrincipal             = $SignerPrincipal
    SupersededCommit            = $SupersededCommit
    EligibilityDigest           = $EligibilityDigest
}
if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $RecoveryContext.CorePath = $CorePath }

# The caller must still state which recovery it means, so that omission remains
# an explicit NOT-SUPPLIED rather than a silent default.
$RecoveryAssertionComplete = (@(@(
    $RecoveryStageSlug, $RecoveryAuthorizationId, $RecoveryAuthorizationDigest,
    $SupersededCommit, $EligibilityDigest
) | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0)
$RecoveryContextComplete = $RecoveryAssertionComplete -and ($null -ne $AuthoritativeRecovery)

function Get-VariantRecovery {
    param([hashtable]$Override)
    $Copy = @{}
    foreach ($Key in $RecoveryContext.Keys) { $Copy[$Key] = $RecoveryContext[$Key] }
    foreach ($Key in $Override.Keys) { $Copy[$Key] = $Override[$Key] }
    return $Copy
}

if ($ReleaseContextComplete -and -not $TerminalHolds) {
    Write-Output ""
    Write-Output "=== TERMINAL: DID NOT HOLD (stated, never silently skipped) ==="
    Write-Output "The released-stage context was COMPLETE and terminal release state was"
    Write-Output "still refused. The predecessor is not released truth:"
    Write-Output "  $($Terminal.Reason)"
    Write-Output "The terminal controls did not run because there is no terminal state for"
    Write-Output "them to perturb. This is not a pass, and it is not a missing context."
}

if ($RecoveryContextComplete) {
    # ===================================================================
    # APPLICABILITY, NOT CONTEXT COMPLETENESS.
    #
    # This family used to run whenever the caller supplied a superseded commit
    # and an eligibility digest. That is a question about the CALLER, and it is
    # the wrong one. The question is whether a recovery is still IN FLIGHT.
    #
    # The two coincided until the recovery release landed and then diverged: the
    # context stayed complete while the one hop became spent, so the family kept
    # demanding ELIGIBLE from an eligibility that is now correctly refused. It
    # reported the right governance outcome as three failures - the same "a fact
    # true at one moment written down as a durable invariant" defect the
    # recovery stage existed to remove, committed by the checking code itself.
    #
    # Worse than the three red lines: in the spent state the nine refusal
    # variants below hold for the WRONG REASON. Everything is refused because
    # the authorization is consumed, not because the perturbation was caught. A
    # family whose positive baseline cannot hold proves nothing, and nine
    # vacuous HELD lines are more dangerous than three honest failures. So in
    # the spent state they are RETIRED, not counted.
    #
    # The discriminator is structural and never matched against reason text: the
    # recovery stage's own release is terminal at HEAD, and eligibility no
    # longer verifies. Text is a message; state is evidence.
    # ===================================================================
    $Eligibility = Test-GdsRecoveryEligibility @RecoveryContext
    $RecoveryInFlight = [bool]$Eligibility.Eligible

    if ($RecoveryInFlight) {
    Write-Output ""
    Write-Output "=== RECOVERY / IN-FLIGHT (a non-conforming predecessor is eligible, and eligibility grants nothing) ==="

    # R0 is the positive baseline for this family. Without it every refusal
    # below could be a refusal of everything.
    Test-Control -Id "R0" -Expectation "the exact predecessor is ELIGIBLE for one bounded recovery" `
        -Held $Eligibility.Eligible -Detail "$($Eligibility.Verdict): $($Eligibility.SupersededCommit)"

    Test-Control -Id "R1" -Expectation "eligibility names the predecessor it was asked about" `
        -Held ($Eligibility.SupersededCommit -ceq $SupersededCommit) -Detail $Eligibility.SupersededCommit
    Test-Control -Id "R2" -Expectation "the recovery stage is baselined on that exact predecessor" `
        -Held ($Eligibility.RecoveryBaseline -ceq $SupersededCommit) -Detail $Eligibility.RecoveryBaseline

    $RecoveryVariants = @(
        @{ Id = "R3"; What = "a predecessor the eligibility was not issued for"; Over = @{ SupersededCommit = ("a" * 40) } },
        @{ Id = "R4"; What = "a recovery stage the eligibility does not name"; Over = @{ RecoveryStageSlug = "SOURCEROOT-NO-SUCH-RECOVERY-V1" } },
        @{ Id = "R5"; What = "an eligibility digest that was never signed"; Over = @{ EligibilityDigest = ("0" * 64) } },
        @{ Id = "R6"; What = "an eligibility digest that is not a SHA-256"; Over = @{ EligibilityDigest = "not-a-digest" } },
        # Occupancy, not assertion. The auditor's principal and key are entirely
        # valid; they simply do not hold the role that issues eligibility.
        @{ Id = "R7"; What = "the independent auditor asserting its own valid identity"; Over = @{ SignerPrincipal = $AuditorPrincipal; ExpectedSignerFingerprint = $AuditorFingerprint } },
        @{ Id = "R8"; What = "a principal that is in no role at all"; Over = @{ SignerPrincipal = "someone-else" } },
        # Eligibility detached from a recovery authorization authorizes nothing.
        @{ Id = "R9"; What = "a recovery authorization id that was never issued"; Over = @{ ExpectedAuthorizationId = "00000000-0000-4000-8000-000000000000" } },
        @{ Id = "R10"; What = "a recovery authorization digest that is one byte wrong"; Over = @{ ExpectedAuthorizationDigest = ("0" * 64) } },
        @{ Id = "R11"; What = "a malformed predecessor commit id"; Over = @{ SupersededCommit = "HEAD" } }
    )
    foreach ($Variant in $RecoveryVariants) {
        $RecoveryOverride = $Variant.Over
        Test-Refusal -Id $Variant.Id -Expectation "eligibility is refused for $($Variant.What)" -Attempt {
            $RecoveryVariant = Get-VariantRecovery $RecoveryOverride; (Test-GdsRecoveryEligibility @RecoveryVariant).Eligible
        }
    }

    Test-Control -Id "R15" -Expectation "the verdict is ELIGIBLE and never ACCEPT" `
        -Held ($Eligibility.Verdict -ceq "ELIGIBLE") -Detail $Eligibility.Verdict

    # And the predecessor really is still non-conforming. Eligibility having
    # been granted must change nothing about the release question.
    if ($ReleaseContextComplete) {
        Test-Refusal -Id "R16" -Expectation "an eligible predecessor is still NOT released truth" -Attempt {
            (Test-GdsReleaseState @ReleaseContext).Released
        }
    }

    } else {
    # ===================================================================
    # RECOVERY / SPENT.
    #
    # The one authorized hop has been taken. This is a SUCCESS state, and the
    # controls here prove it positively rather than inferring it from an
    # absence of failures. "We asked and the answer was no" and "we stopped
    # asking" must never look alike.
    # ===================================================================
    Write-Output ""
    Write-Output "=== RECOVERY / SPENT (the one authorized hop has been taken and cannot be replayed) ==="
    Write-Output "Authoritative recovery identity derived from $AuthoritativeRecoverySource :"
    Write-Output "  stage         $($AuthoritativeRecovery.StageSlug)"
    Write-Output "  authorization $($AuthoritativeRecovery.AuthorizationId)"
    Write-Output "  digest        $($AuthoritativeRecovery.AuthorizationDigest)"
    Write-Output "The real signed eligibility authenticated under that identity, then was refused:"
    Write-Output "  $($Eligibility.Reason)"

    # R19 IS THE CONTROL THAT MAKES NAMING INSUFFICIENT.
    #
    # The caller's assertion is compared, field by field, against the identity
    # derived from the signed chain. It cannot select the identity - the lookup
    # above already used the derived one - so this control exists to refuse a
    # caller who is talking about a DIFFERENT authorization than the one the
    # release is bound to.
    #
    # This is what an older-but-valid authorization for the same stage and
    # baseline fails. It would authenticate an eligibility and it would be
    # refused at the baseline, so every other control here would hold for it.
    # Only equality with the chain-authenticated identity separates it from the
    # authorization this release actually consumed.
    $AssertionMatches =
        ($RecoveryStageSlug -ceq $AuthoritativeRecovery.StageSlug) -and
        ($RecoveryAuthorizationId -ceq $AuthoritativeRecovery.AuthorizationId) -and
        ($RecoveryAuthorizationDigest -ceq $AuthoritativeRecovery.AuthorizationDigest)
    Test-Control -Id "R19" -Expectation "the asserted recovery identity IS the chain-authenticated one" `
        -Held $AssertionMatches `
        -Detail $(if ($AssertionMatches) { "asserted identity equals the authorization named in the signed ReleaseCommitBinding" } else { "ASSERTED $RecoveryStageSlug / $RecoveryAuthorizationId / $RecoveryAuthorizationDigest -- AUTHORITATIVE $($AuthoritativeRecovery.StageSlug) / $($AuthoritativeRecovery.AuthorizationId) / $($AuthoritativeRecovery.AuthorizationDigest)" })

    # R0' IS THE POSITIVE BASELINE, AND IT MUST NOT BE SATISFIABLE BY ABSENCE.
    #
    # An audit rejected the first version of this control: it asked about the
    # follow-up stage, no eligibility object exists under that name, and the
    # resulting "REJECT" proved only that a nonexistent file is unreadable. A
    # refusal earned by asking the wrong question is not evidence of anything.
    #
    # So the spend is proven in two parts, and BOTH are required:
    #
    #   AUTHENTICATED  the core read, verified and parsed the real object -
    #                  proven by it reporting the object's own contents back:
    #                  the classification, the exact expected digest, and the
    #                  predecessor it names. A missing file yields none of these.
    #   THEN REFUSED   and having authenticated it, the core still refused,
    #                  because the recovery baseline it is bound to is no longer
    #                  HEAD. That is the spend, and nothing weaker demonstrates
    #                  it.
    $Authenticated = ($Eligibility.Classification -ceq "TERMINAL-UNCLOSED") -and
                     ($Eligibility.EligibilityDigest -ceq $EligibilityDigest) -and
                     ($Eligibility.SupersededCommit -ceq $SupersededCommit) -and
                     ($Eligibility.RecoveryStageSlug -ceq $RecoveryStageSlug)
    # RecoveryBaseline is emitted only once the core has loaded the recovery
    # StageAuthorization, so a non-empty value naming the predecessor proves the
    # refusal happened at the binding step and not at the file-open step.
    $RefusedAtTheSpend = ($Eligibility.RecoveryBaseline -ceq $SupersededCommit)
    Test-Control -Id "R0'" -Expectation "the REAL eligibility authenticates, then is refused because the hop is spent" `
        -Held ($Authenticated -and $RefusedAtTheSpend -and (-not $Eligibility.Eligible) -and ($Eligibility.Verdict -ceq "REJECT")) `
        -Detail "authenticated=$Authenticated refusedAtBinding=$RefusedAtTheSpend verdict=$($Eligibility.Verdict) classification=$($Eligibility.Classification) baseline=$($Eligibility.RecoveryBaseline)"

    Test-Control -Id "R15'" -Expectation "a spent eligibility never returns ACCEPT or ELIGIBLE" `
        -Held (($Eligibility.Verdict -cne "ACCEPT") -and ($Eligibility.Verdict -cne "ELIGIBLE")) `
        -Detail $Eligibility.Verdict

    # R16' is the exact inverse of the in-flight R16, and it is the honest
    # statement here: the recovery landed, so HEAD IS released truth.
    if ($ReleaseContextComplete) {
        $SpentRelease = Test-GdsReleaseState @ReleaseContext
        Test-Control -Id "R16'" -Expectation "HEAD is the conforming recovery release" `
            -Held $SpentRelease.Released -Detail $SpentRelease.Commit
    }

    # R17 makes the spend irreversible. Re-supplying the REAL eligibility with
    # every field exactly correct - right stage, right authorization, right
    # predecessor, right digest - must still be refused. If it were not, "one
    # hop" would be a suggestion rather than a bound.
    #
    # Like R0', this is only meaningful because the object authenticates first.
    # A refusal that never reached the object would satisfy a naive refusal
    # check while proving nothing, so the replay attempt is required to reach
    # the binding step too.
    $Replay = Test-GdsRecoveryEligibility @RecoveryContext
    Test-Control -Id "R17" -Expectation "re-supplying the exact signed eligibility does not revive the spent hop" `
        -Held ((-not $Replay.Eligible) -and
               ($Replay.EligibilityDigest -ceq $EligibilityDigest) -and
               ($Replay.RecoveryBaseline -ceq $SupersededCommit)) `
        -Detail "replayed the exact object: $($Replay.Verdict), still bound to baseline $($Replay.RecoveryBaseline)"

    # And the spend is specifically a BASELINE fact, not an incidental error.
    Test-Control -Id "R18" -Expectation "the refusal names the consumed baseline, not a missing or malformed object" `
        -Held ($Eligibility.Reason -like "*not the authorized baseline*") `
        -Detail $Eligibility.Reason

    # R3-R11 ARE RETIRED, NOT HELD.
    #
    # Every one of them would "hold" here, because a consumed authorization
    # refuses everything. That is a refusal for the wrong reason. Counting them
    # would inflate the held total with nine controls that can no longer
    # distinguish a caught perturbation from a dead code path, which is exactly
    # the vacuous-green this harness exists to prevent.
    Write-Output ""
    Write-Output "  RETIRED IN THIS STATE (not counted as held, not counted as failed):"
    Write-Output "    R3-R11 perturb an eligibility that no longer verifies at all. They would"
    Write-Output "    refuse every input, including inputs they are supposed to catch, so they"
    Write-Output "    can no longer tell a real refusal from a vacuous one. Their positive"
    Write-Output "    baseline R0 is unsatisfiable here by design; R0' replaces it."
    Write-Output "    They are exercised for real by the IN-FLIGHT state."
    }

    # ===================================================================
    # RESPONSE SHAPE - APPLICABLE IN BOTH STATES.
    #
    # ELIGIBLE shares an exit code with ACCEPT, which is exactly the kind of
    # near-miss that becomes a defect the first time a caller checks the wrong
    # field. The answer must be unable to report release, acceptance, or any
    # path grant - not merely report them as false.
    #
    # These test the SHAPE of the answer rather than the viability of a
    # recovery, and shape does not change when the hop is spent. Gating them on
    # applicability would have dropped six real controls the moment the recovery
    # landed.
    # ===================================================================
    Write-Output ""
    Write-Output "=== RECOVERY / RESPONSE SHAPE (applies in every applicability state) ==="
    $Fields = @($Eligibility.PSObject.Properties.Name)
    foreach ($Forbidden in @("Accepted", "Released", "Authorized", "Valid", "AllowedPaths", "ProtectedPaths")) {
        Test-Control -Id "R12.$Forbidden" -Expectation "the eligibility answer cannot report '$Forbidden'" `
            -Held (-not ($Fields -ccontains $Forbidden)) -Detail $(if ($Fields -ccontains $Forbidden) { "FIELD PRESENT" } else { "absent" })
    }
    Test-Control -Id "R13" -Expectation "eligibility reports the predecessor as NOT conforming" `
        -Held ($Eligibility.PredecessorConforming -ceq "NO") -Detail $Eligibility.PredecessorConforming
    Test-Control -Id "R14" -Expectation "eligibility grants NO mutation authority" `
        -Held ($Eligibility.GrantsMutationAuthority -ceq "NO") -Detail $Eligibility.GrantsMutationAuthority
} else {
    Write-Output ""
    Write-Output "=== RECOVERY / NOT-SUPPLIED: NOT EXERCISED IN THIS RUN ==="
    Write-Output "The recovery controls did NOT run. This is a SKIP, not a pass."
    if ($null -eq $AuthoritativeRecovery) {
        Write-Output "No authoritative recovery identity could be DERIVED: neither a proven"
        Write-Output "released recovery chain nor a valid current authority is available, so"
        Write-Output "there is nothing signed to authenticate an identity against. The caller's"
        Write-Output "assertion alone is never sufficient to proceed."
    }
    if (-not $RecoveryAssertionComplete) {
        Write-Output "The caller's recovery assertion is incomplete. It is required even though"
        Write-Output "it is not authoritative, so that omission stays visible instead of"
        Write-Output "defaulting silently."
    }
    foreach ($Pair in @(
        @{ Name = "SRGDS_RECOVERY_STAGE"; Value = $RecoveryStageSlug },
        @{ Name = "SRGDS_RECOVERY_AUTHORIZATION_ID"; Value = $RecoveryAuthorizationId },
        @{ Name = "SRGDS_RECOVERY_AUTHORIZATION_DIGEST"; Value = $RecoveryAuthorizationDigest },
        @{ Name = "SRGDS_SUPERSEDED_COMMIT"; Value = $SupersededCommit },
        @{ Name = "SRGDS_ELIGIBILITY_DIGEST"; Value = $EligibilityDigest }
    )) {
        if ([string]::IsNullOrWhiteSpace($Pair.Value)) { Write-Output "  missing: $($Pair.Name)" }
    }
}

if (-not $Baseline.Valid) {
    Write-Output ""
    Write-Output "=== SELECTION / INTEGRITY / GRAMMAR: SKIPPED ==="
    Write-Output "HEAD is a terminal release state, so no current authorization governs it."
    Write-Output "Those families perturb CURRENT authority, which already refuses everything"
    Write-Output "here; running them would report refusals that prove nothing. This is a SKIP."
    Write-Output ""
    Write-Output ("controls held : {0}" -f $script:Passed)
    Write-Output ("controls failed: {0}" -f $script:Failed)
    if ($script:Failed -gt 0) { Write-Output "NEGATIVE CONTROL RESULT: FAIL"; exit 1 }
    Write-Output "NEGATIVE CONTROL RESULT: PASS (terminal family only)"
    exit 0
}

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "=== SELECTION ==="

Test-Refusal -Id "S1" -Expectation "the current id with a foreign digest" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationDigest = ("0" * 64) }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S2" -Expectation "a nonexistent authorizationId" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationId = "00000000-0000-4000-8000-000000000000" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S3" -Expectation "an uppercase spelling of the current id" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationId = $AuthorizationId.ToUpperInvariant() }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S4" -Expectation "an id shaped like a path traversal" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationId = "../../../etc/passwd" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S5" -Expectation "an empty expected digest" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationDigest = "" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S6" -Expectation "an empty expected id" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationId = "" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "S7" -Expectation "a stage slug nothing is signed for" -Attempt {
    $Variant = Get-VariantContext @{ StageSlug = "SOURCEROOT-NO-SUCH-STAGE-V1" }; (Get-GdsStageAuthorization @Variant).Valid
}

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "=== INTEGRITY ==="

Test-Refusal -Id "I1" -Expectation "a foreign signer fingerprint" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedSignerFingerprint = "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "I2" -Expectation "a malformed signer fingerprint" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedSignerFingerprint = "not-a-fingerprint" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "I3" -Expectation "a principal that is not in allowed_signers" -Attempt {
    $Variant = Get-VariantContext @{ SignerPrincipal = "someone-else" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "I4" -Expectation "a digest that is not a SHA-256" -Attempt {
    $Variant = Get-VariantContext @{ ExpectedAuthorizationDigest = "not-a-digest" }; (Get-GdsStageAuthorization @Variant).Valid
}
Test-Refusal -Id "I5" -Expectation "a repository that is not a repository" -Attempt {
    $Variant = Get-VariantContext @{ RepositoryRoot = $env:TEMP }; (Get-GdsStageAuthorization @Variant).Valid
}

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "=== GRAMMAR ==="

$Unsafe = @(
    "a.txt:stream",
    "../outside.txt",
    "/absolute.txt",
    "backend/db/migrations/020_create_earthroot_place_polity_foundation.sql",
    "engine/anything.ts",
    ".gitignore",
    "tools/srgds-core/go.sum",
    "tools/srgds-core/internal/authority/authority.go.bak"
)
foreach ($Entry in $Unsafe) {
    $Index = [Array]::IndexOf($Unsafe, $Entry) + 1
    Test-Refusal -Id "G$Index" -Expectation "path is not authorized: $Entry" -Attempt {
        (Test-GdsPathAuthorized @Context -Path @($Entry)).Authorized
    }
}

# A path that IS authorized must still be reported as authorized, or the
# grammar controls above would pass because everything is refused.
#
# The sample is drawn from the CURRENT signed authorization, not pinned. It used
# to be the literal tools/srgds-core/main.go, which was an authorized path under
# one earlier issuance and is deliberately PROTECTED under others - so a stage
# that guards the trust core failed its own positive control while the grammar
# was working perfectly. That is a stage-coupled assumption written down as a
# durable invariant, the same defect class this harness exists to catch.
#
# Taking the first allowed path keeps the control honest for every issuance: a
# valid authorization always has at least one, and if it somehow has none there
# is nothing legitimate to accept and the control fails rather than being
# skipped.
# Taken in the signed object's own order. Re-sorting here would be
# locale-dependent: PowerShell's Sort-Object is culture-aware even with
# -CaseSensitive, so it can pick a different sample on a different machine. The
# trust core has already verified that allowedPaths is in strict UTF-16 ordinal
# order, so the first element is a deterministic, signature-derived choice.
$Sample = @($Baseline.AllowedPaths)[0]
if ([string]::IsNullOrWhiteSpace($Sample)) {
    Test-Control -Id "G0" -Expectation "the current authorization declares at least one allowed path" `
        -Held $false -Detail "no allowed path exists, so the grammar family cannot be shown to accept anything"
} else {
    Test-Control -Id "G0" -Expectation "an authorized path is still authorized: $Sample" `
        -Held ((Test-GdsPathAuthorized @Context -Path @($Sample)).Authorized) `
        -Detail "sample drawn from the current signed authorization, proving the grammar family is not refusing everything"
}

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "=== LIFECYCLE ==="

$Forbidden = @(
    @{ From = "AUDIT_PASSED"; To = "RELEASED" },
    @{ From = "DEFINED"; To = "RELEASED" },
    @{ From = "RELEASED"; To = "ACTIVE" },
    @{ From = "AUDIT_FAILED"; To = "AUDIT_PASSED" },
    @{ From = "ACTIVE"; To = "ACTIVE" },
    @{ From = "SHIPPED"; To = "RELEASED" }
)
$Index = 0
foreach ($Transition in $Forbidden) {
    $Index++
    Test-Refusal -Id "L$Index" -Expectation "$($Transition.From) -> $($Transition.To)" -Attempt {
        (Test-GdsLifecycleTransition -From $Transition.From -To $Transition.To -CorePath $CorePath).Allowed
    }
}
Test-Control -Id "L0" -Expectation "AUDIT_PASSED -> RELEASE_AUTHORIZED is permitted" `
    -Held ((Test-GdsLifecycleTransition -From "AUDIT_PASSED" -To "RELEASE_AUTHORIZED" -CorePath $CorePath).Allowed) `
    -Detail "control that proves the lifecycle family is not refusing everything"

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output "=== STRUCTURE: DURABLE NO-POWERSHELL-TRUST-CORE GUARD ==="
#
# This is the guard that keeps the architecture decision from decaying. A future
# edit that reintroduces canonical serialization, digesting, path grammar or
# signature handling into PowerShell fails here, whatever it is called.

$ModulePath = Join-Path $PSScriptRoot "SourceRoot.Governance.psm1"
$ModuleText = [IO.File]::ReadAllText($ModulePath)
# Comments are stripped first - BLOCK comments too - so the module may DESCRIBE
# what it must not do without tripping the guard that checks it does not do it.
$ModuleCode = [regex]::Replace($ModuleText, '(?s)<#.*?#>', '')
$ModuleCode = ($ModuleCode -split "`n" | Where-Object { $_.TrimStart() -notmatch '^\s*#' }) -join "`n"

$Forbidden = @{
    "Get-FileHash"        = "digesting"
    "SHA256Managed"       = "digesting"
    "System.Security.Cryptography" = "cryptography"
    "ssh-keygen"          = "signature verification"
    "StringComparer"      = "ordinal comparison for canonical ordering"
    "ConvertTo-Json"      = "serialization of governance objects"
    "[Text.UTF8Encoding]" = "canonical encoding"
    "git diff-tree"       = "candidate identity"
    "git write-tree"      = "candidate identity"
    "GIT_INDEX_FILE"      = "candidate index construction"
    "hash-object"         = "object identity"
}
$Index = 0
foreach ($Needle in ($Forbidden.Keys | Sort-Object)) {
    $Index++
    $Present = $ModuleCode.Contains($Needle)
    Test-Control -Id "N$Index" -Expectation "module implements no $($Forbidden[$Needle]): '$Needle'" `
        -Held (-not $Present) -Detail $(if ($Present) { "FOUND in executable code" } else { "" })
}

# ConvertFrom-Json is permitted for EXACTLY one purpose: reading a verdict the
# core just produced. More than one use means something else is being parsed.
$JsonUses = ([regex]::Matches($ModuleCode, "ConvertFrom-Json")).Count
Test-Control -Id "N90" -Expectation "module parses JSON in exactly one place (verdicts only)" `
    -Held ($JsonUses -eq 1) -Detail "$JsonUses use(s) in executable code"

# And the core must actually be the thing answering.
$Version = Get-SrgdsCoreVersion -CorePath $CorePath
Test-Control -Id "N91" -Expectation "the trust core is present and answers" `
    -Held ($Version -like "srgds-core/*") -Detail $Version

Test-Refusal -Id "N92" -Expectation "a missing trust core fails closed rather than falling back" -Attempt {
    $null = Get-SrgdsCorePath -Path (Join-Path $env:TEMP "srgds-core-that-does-not-exist.exe")
    $true
}

# ---------------------------------------------------------------------------
Write-Output ""
Write-Output ("CONTROLS HELD {0} / FAILED {1}" -f $script:Passed, $script:Failed)
if ($script:Failed -gt 0) {
    Write-Output ""
    Write-Output "A failed control means the system ACCEPTED something it must refuse."
    exit 3
}
Write-Output ""
Write-Output "Every control held. This is evidence that the refusals are real; it is not"
Write-Output "approval of any candidate, and it never has been."
exit 0
