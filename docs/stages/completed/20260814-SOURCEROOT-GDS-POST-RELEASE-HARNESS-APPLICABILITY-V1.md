# SourceRoot GDS Post-Release Harness Applicability

## Stage identity

- Name: SourceRoot GDS Post-Release Harness Applicability
- Slug: SOURCEROOT-GDS-POST-RELEASE-HARNESS-APPLICABILITY-V1
- Status: active
- Started: 2026-08-14

## Objective

Make the RECOVERY control family and the installer classification reachability
probes state their applicability preconditions, so a completed recovery is
reported honestly instead of as a failure.

## Business value

The recovery release `7bf7ab2c` is conforming-terminal, yet the harness that
proves it reports three failed controls and the installer reports two. Every
one of those five red lines is the harness misreading a correct governance
outcome. That has two costs.

First, a red harness at a green release is indistinguishable from a red harness
at a broken one. The next person to run it cannot tell which they are looking
at, and the usual response to a known-false failure is to stop reading the
output at all.

Second, and worse, nine of the controls in that family currently report HELD
for the wrong reason. Once the hop is spent every perturbation is refused
because the authorization is consumed, not because the perturbation was caught.
A family whose positive baseline can no longer hold proves nothing, and nine
vacuous HELD lines are more dangerous than three honest failures.

## Current source of truth

The checked-out repository at `7bf7ab2c8c9d8d018335cf1b313b6ed7494910e7` is
canonical. Required current inputs:

- the signed control store at `C:\ProgramData\SourceRoot\GDS\<repository-id>`,
  including the existing recovery-stage StageAuthorization
  `512015a7-7de2-46c4-b940-ef2d715778c7` and RecoveryEligibility
  `F6EBBBFE0E6CE626D524329FE8E5012E53CDDF0A1CBFA9C38AFF95015027A943`, both read
  only and neither reissued
- the predecessor commit `4d325d303e7f95c06bec9604abe3b04cab079fc2`, used as a
  disposable checkout to regression-test the IN-FLIGHT state

Do not use backups, generated packages, or completed stages as implementation
sources.

## Allowed files

- `.gitattributes`
- `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260814-SOURCEROOT-GDS-POST-RELEASE-HARNESS-APPLICABILITY-V1.md`
- `governance/schemas/gds-authority-lifecycle-v1.schema.json`
- `INSTALL-SOURCEROOT-GDS-RELEASE-TERMINAL-STATE.ps1`
- `ROOT-MANIFEST.json`
- `tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- `tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1`, the RECOVERY family
- `INSTALL-SOURCEROOT-GDS-RELEASE-TERMINAL-STATE.ps1`, `Invoke-Classify` and
  `Invoke-Controls`
- `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md` section 13.16
- `governance/schemas/gds-authority-lifecycle-v1.schema.json`, top-level
  `description` only

## Required behavior

**The defect.** Both sites gate on CONTEXT COMPLETENESS -- "did the caller
supply a superseded commit and an eligibility digest?" -- when the question they
must answer is APPLICABILITY: "is a recovery still in flight?" Those two
coincided before the recovery release and diverge after it. This is the same
defect class the recovery stage existed to remove: a fact true at one moment
written down as a durable invariant.

**The discriminator already exists** and requires no new plumbing. It must be
structural, never matched against reason text: the recovery stage's own release
is terminal at HEAD, and eligibility no longer verifies because its
authorization is consumed.

1. **Three applicability states.** The RECOVERY family reports exactly one of:

   | State | Meaning |
   |---|---|
   | IN-FLIGHT | a recovery is live; the existing R0-R16 family genuinely exercises |
   | SPENT | the one hop is consumed; positively prove it is unreplayable |
   | NOT-SUPPLIED | no recovery context offered; explicitly not exercised |

2. **The authoritative recovery identity is DERIVED from something signed; the
   caller may only assert against it.** Two Tier-3 audits found the two halves
   of this rule. The first found the controls asking about CURRENT authority
   after a follow-up stage opened, so a missing eligibility file was counted as
   a spent hop. The second found that naming the historical recovery explicitly
   was still not enough: an older but validly signed authorization for the same
   recovery stage and the same baseline also authenticates an eligibility and is
   also refused at the baseline, so it too could be presented as the spend.

   A name is not an authentication. The harness therefore derives the identity
   and never accepts one:

   | State | Authoritative source |
   |---|---|
   | IN-FLIGHT | the current StageAuthorization, already verified by the positive baseline |
   | SPENT | the released recovery chain: `release-state` accepts only after verifying the signed ReleaseCommitBinding and finding the released authorization's id and digest equal to those named inside it |

   `SRGDS_RECOVERY_STAGE`, `SRGDS_RECOVERY_AUTHORIZATION_ID` and
   `SRGDS_RECOVERY_AUTHORIZATION_DIGEST` remain REQUIRED so that omission stays
   visible, but they drive nothing. The eligibility lookup uses the derived
   identity, and `R19` compares the assertion against it field by field. Same
   stage and same baseline are not interchangeable with the one authorization
   the release is actually bound to.

3. **SPENT is positively proven, never assumed.** The real signed object must
   AUTHENTICATE first and only then be refused:

   - `R0'` the released chain authenticates the exact recovery authorization,
     the caller assertion equals it, the REAL eligibility authenticates, and it
     is THEN refused because the recovery baseline is no longer HEAD
   - `R15'` a spent eligibility never returns ACCEPT or ELIGIBLE
   - `R16'` HEAD is the conforming recovery release
   - `R17` re-supplying the exact chain-bound authorization and eligibility does
     not revive the hop, and the replay still reaches the binding step
   - `R18` the authorization assertion matches the released chain and the
     refusal names the consumed baseline, not a missing or malformed object

3. **R3-R11 are retired, not counted.** In the SPENT state they are refused for
   the wrong reason, so they are printed as explicitly non-applicable and
   contribute to neither the held nor the failed count.

4. **R12.\*, R13, R14 remain applicable in both states.** They test the shape of
   the answer rather than the viability of a recovery, and that shape does not
   change when the hop is spent.

5. **Installer reachability is gated on classification, not on context.**
   While a legacy recovery is in flight the probe proves eligibility cannot
   PROMOTE a non-conforming chain; once HEAD is CONFORMING-TERMINAL the same
   probe proves eligibility cannot DEMOTE a conforming one. The second direction
   is a control that does not exist today.

6. **`-CorePath` is forwarded** to the nested negative-control script.

7. **Contract 13.16 records the applicability precondition**, and the schema's
   top-level `description` says six objects rather than four.

## Protected behavior

`ROOT-PROTECTED-FUNCTIONALITY.md` applies unchanged. Stage-specific
protections, each also enforced structurally by the signed protected path set:

- **`tools/srgds-core/` is byte-identical.** No Go source, no test, no build
  input changes. `release-state` semantics are untouched by construction.
- **`docs/stages/completed/20260813-SOURCEROOT-GDS-TERMINAL-UNCLOSED-RECOVERY-V1.md`
  is byte-identical.** It is released, audited history. Its 187/181 wording is
  not wrong: it accurately recorded a pre-completion measurement at the time of
  writing. Editing it to tidy a number is the history rewriting this system
  forbids.
- **No RecoveryEligibility is reissued, reopened, or reused.** The spent hop
  stays spent, and `R17` asserts it.
- Terminal controls P0, P1 and T1-T11 are unchanged and must remain held.
- The IN-FLIGHT branch keeps its exact current semantics; this stage adds
  applicability around it and subtracts nothing from it.
- `tools/SourceRoot.Governance.psm1`, `tools/INVOKE-ROOT-GOVERNANCE.ps1`, both
  required verifiers, and `docs/build/SRGDS-CORE-BUILD-CONTRACT.md` are
  protected.

## Non-goals

- Any second recovery hop. This stage is baselined on a CONFORMING-TERMINAL
  release, so the one-hop provision of section 13.10 does not apply and is not
  invoked.
- Making a spent eligibility valid again by any route.
- Weakening, relaxing, or reordering any terminal control.
- Amending the released recovery completion record.
- Beginning 15B, tagging, or publishing.

## Dependencies

- The governed Go toolchain reporting `go version go1.26.5 windows/amd64`,
  used only to rebuild and re-test an unchanged trust core.
- The ACL-protected control store and its `roles` table.
- The predecessor commit `4d325d30`, reachable for the disposable IN-FLIGHT
  regression checkout.

## Risks

- **Regression of the IN-FLIGHT branch.** After this stage no live recovery
  exists in the repository, so the IN-FLIGHT path could rot unnoticed. Mitigated
  by acceptance criterion 2, which exercises it against real signed evidence in
  a disposable checkout rather than trusting that it still works.
- **Silent skipping.** A three-state family could degrade into "print nothing
  when unsure". Mitigated by requiring every state to print its name and its
  reason, and by requiring SPENT to carry positive assertions rather than an
  absence of failures.
- **Scope creep into the trust core.** Mitigated structurally: `tools/srgds-core/`
  is in the signed protected set, so an attempted edit is refused rather than
  reviewed.
- **Date-derived completion path.** The signed allowlist pins the completion
  record to `20260814-`. Completion must occur on 2026-08-14 local time;
  crossing local midnight puts the record outside the signed authority.

## Acceptance criteria

Deterministic checks:

1. At HEAD with the COMPLETE HISTORICAL recovery identity,
   `tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1` exits 0, reports the SPENT state,
   holds `R0'`, `R15'`, `R16'`, `R17`, `R18`, `R12.*`, `R13`, `R14`, and prints
   R3-R11 as retired without counting them.

1a. **Authorization-identity matrix.** The asserted recovery identity is checked
    against the chain-authenticated one. Exactly one input succeeds:

    | Asserted authorization | Required |
    |---|---|
    | `512015a7…` / `D1645599…` (bound into the ReleaseCommitBinding) | SPENT succeeds |
    | `0d19e827…` / `11B3BCA6…` (older, valid, same stage AND same baseline) | fails |
    | `35fb7647…` / `876E90B0…` (superseded) | fails |
    | follow-up stage authorization | fails |
    | correct id, wrong digest | fails |
    | wrong id, correct digest | fails |
    | nonexistent authorization | fails |

    The second row is the one that matters: it is validly signed, for the right
    stage, on the right baseline, and it authenticates the eligibility and is
    refused at the baseline exactly as the true one is. Nothing but equality
    with the chain-authenticated identity separates them.
1b. **Same-stage authorization substitution.** Supplying authorization
    `0d19e827-ea83-46cb-96b0-0e5eaf4db4b9` / digest
    `11B3BCA6A2253C1BF1745C3E72D8391996C6F60DE6731ACED0C5767D19A0DEA7`
    must also FAIL `R0'`, `R17` and `R18`. It is validly signed and shares the
    recovery stage and baseline, but the released recovery commit binding names
    `512015a7-7de2-46c4-b940-ef2d715778c7` / digest
    `D16455992F8211D3E0D6790F3898DF74071C0006A7B15C616EF9DAECED6830BC`.
2. In a disposable checkout at `4d325d303e7f95c06bec9604abe3b04cab079fc2`, using
   the existing signed recovery evidence, the harness reports the IN-FLIGHT
   state and the genuine R0-R16 family holds exactly as before.
3. With recovery context omitted, the harness still reports NOT-SUPPLIED as an
   explicit non-execution and names the missing variables.
4. `INSTALL-SOURCEROOT-GDS-RELEASE-TERMINAL-STATE.ps1 -Action all` with COMPLETE
   context exits 0 with zero failed checks, classifies HEAD
   `CONFORMING-TERMINAL`, and holds the demotion-resistance assertion.
5. P0, P1 and T1-T11 remain held and unchanged.
6. `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1` exits 0 with zero
   failures.
7. `VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1` exits 0 with zero
   failures.
8. `go vet ./...`, `gofmt -l`, and `go test ./...` are clean under
   `tools/srgds-core`, and the candidate manifest contains no path beneath
   `tools/srgds-core/`.
9. In a disposable `core.autocrlf=true` clone, every file under
   `backend/db/migrations/` is byte-identical to the bound release tree with
   zero CRLF pairs.
10. The candidate contains no change to
    `docs/stages/completed/20260813-SOURCEROOT-GDS-TERMINAL-UNCLOSED-RECOVERY-V1.md`.

Manual evidence:

11. Independent Tier-3 audit by the configured `independent-auditor`. Not
    performed by this stage.

## Required verifier

- `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1`

## Manual browser checks

Not applicable. This stage changes two PowerShell harnesses, one contract
document, one schema description string, and one `.gitattributes` comment. It
adds no route, no UI, no rendered surface, and no package or dependency change.
`VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1` independently asserts
that no route or UI change is present.

## Live API checks

Not applicable. No API surface is added or modified. The backend typecheck and
the EarthRoot semantics, adapter and provenance suites run inside
`VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1` and cover the runtime
behavior this stage could have disturbed.

## Required output

- Three-state applicability in the RECOVERY negative-control family, with
  `R0'`, `R15'`, `R16'` and `R17`, and R3-R11 retired in the SPENT state.
- Classification-gated reachability probes in the installer, proving promotion
  resistance while a legacy recovery is in flight and demotion resistance once
  HEAD is conforming.
- `-CorePath` forwarded to the nested control script.
- Contract section 13.16 amended with the applicability precondition; schema
  `description` corrected to six objects; `.gitattributes` comment corrected to
  distinguish the per-file and total CRLF measurements.
- Completion-report evidence: control counts for all three applicability states,
  installer check counts, both verifier pass and failure counts, proof that the
  candidate touches nothing beneath `tools/srgds-core/` and does not touch the
  released recovery completion record, and the frozen candidate digest and tree.

## Completion record

- Completion date: 2026-08-14T11:07:23.6197583-05:00
- Verification skipped: False

### Verifier results

- VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1 -> exit 0

### Changed files

- `.gitattributes`
- `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md`
- `docs/stages/completed/20260814-SOURCEROOT-GDS-POST-RELEASE-HARNESS-APPLICABILITY-V1.md`
- `governance/schemas/gds-authority-lifecycle-v1.schema.json`
- `INSTALL-SOURCEROOT-GDS-RELEASE-TERMINAL-STATE.ps1`
- `ROOT-MANIFEST.json`
- `tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1`

### Unresolved manual checks

- Independent Tier-3 audit by an actor that did NOT author candidate bytes: NOT PERFORMED. This stage stops here.

### Completion notes

SEPARATION-OF-DUTIES CORRECTION plus the underlying fix, implemented by the
Claude Lead implementation actor. Candidate CA4BBC3A is not used: its bytes were
authored by the Tier-3 auditor which then audited them, so its AuditBinding
cannot serve as independent review. Candidate 6303743F was correctly rejected.

Codex deltas identified and reclaimed. Its harness delta (+70/-23) was reverted
to my authored version and the requirement reimplemented independently; its
contract 13.16 prose and its edit to the stage specification were rewritten in
my own words to match the implementation I actually built, which differs in
control attribution.

THE UNDERLYING DEFECT. Naming the historical recovery explicitly was not enough.
An older but validly signed authorization for the SAME recovery stage and the
SAME baseline also authenticates the eligibility and is also refused at the
baseline, so every SPENT control held for it even though it is not the
authorization the released recovery chain is bound to. A name is not an
authentication; specificity is not authority.

THE FIX. The authoritative recovery identity is DERIVED from something signed
and never accepted from the caller. IN-FLIGHT derives it from the current
StageAuthorization already verified by the positive baseline. SPENT derives it
from the released recovery chain: release-state accepts only after verifying the
signed ReleaseCommitBinding and finding the released authorization id and digest
equal to those named inside that binding, so those values are chain-authenticated
facts. The eligibility lookup uses the derived identity. The caller's assertion
remains REQUIRED so omission stays visible, and new control R19 compares it to
the derived identity field by field.

AUTHORIZATION-IDENTITY MATRIX, all seven proven independently:
  512015a7 / D1645599 (bound into the ReleaseCommitBinding)  SPENT succeeds, 72 held / 0 failed
  0d19e827 / 11B3BCA6 (older, valid, same stage AND baseline) FAILS R19, exit 3
  35fb7647 / 876E90B0 (superseded)                            FAILS R19, exit 3
  follow-up stage authorization                               FAILS R19, exit 3
  correct id / wrong digest                                   FAILS R19, exit 3
  wrong id / correct digest                                   FAILS R19, exit 3
  nonexistent authorization                                   FAILS R19, exit 3
The second row is the one that matters: validly signed, right stage, right
baseline, authenticates the eligibility and is refused at the baseline exactly
as the true one is. Only equality with the chain-authenticated identity
separates them.

PRESERVED. IN-FLIGHT regression in a disposable 4d325d30 checkout: 68 held / 0
failed with R0-R16 genuinely exercised. NOT-SUPPLIED: 58 held / 0 failed, naming
every missing variable and refusing to substitute anything.

MATRIX. Installer -Action all 23 passed / 0 failed, CONFORMING-TERMINAL, demotion
resistance held; GDS verifier 187 / 0; EarthRoot verifier 135 / 0; negative
controls 72 held / 0 failed including P0/P1/T1-T11; gofmt, go vet and go test
./... clean across 7 packages; disposable core.autocrlf=true clone 21 migrations,
0 CRLF, 0 divergences.

PRESERVED BYTE-IDENTICAL and proven so: tools/srgds-core/ (0 paths changed, so
release-state semantics are untouched by construction) and the released recovery
completion record 20260813-...RECOVERY-V1.md (0 changes). No RecoveryEligibility
was created, reissued, reopened or reused; the historical object is untouched and
remains refused.

DEFERRED BY INSTRUCTION: cryptographic candidate-authorship attestation. This
stage records authorship in prose only. Recommended as future GDS hardening,
because the trust core still cannot answer who wrote candidate bytes - the gap
that made this correction necessary.

This stage stops at independent Tier-3 audit. No AuditBinding, no
ReleaseAuthorization, no release commit, no tag, no push, no publication.
