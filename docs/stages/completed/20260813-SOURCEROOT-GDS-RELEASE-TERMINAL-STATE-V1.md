# SourceRoot GDS Release Terminal State v1

| Field | Value |
|---|---|
| Stage slug | `SOURCEROOT-GDS-RELEASE-TERMINAL-STATE-V1` |
| Risk tier | 3 |
| Baseline commit | `ee327bdf0853d8ff67f8e546ff6427d8a221a982` |
| Authorization | `65ac0155-03b1-4ff7-89e8-56379eca5afd` |
| Authorization SHA-256 | `3F3510B87E0C1A44565E7321737EDD2F0FC26CC3666BA996CB3662B762693B84` |
| Allowed paths | 18 |
| Protected paths | 27 |
| Superseded issuance | `2302e85f-8147-437b-b37b-956b63c1f5a3` (17 allowed), immutable |
| Signer | `joshua-product-authority`, `SHA256:MHHB00WXsjj5eovi+1DRYg6NiknT4ZiLXjKaCT1b+Oo` |

> **This record is not authority.** It is a repository file describing work that
> a signed authorization in the external control store governed. Nothing reads
> it to decide anything.

## Why this stage exists

The previous stage passed an independent Codex Tier-3 audit, was signed for
release, and was committed as `ee327bdf`. Immediately afterwards all three
governed verifiers began to FAIL against that release.

Nothing was wrong with the release. Current authority requires HEAD to equal the
signed baseline, so committing the candidate made that question permanently
unanswerable -- the invariant working as designed. The verifiers were treating
"unanswerable" as "unauthorized": the fifth appearance of a single defect class,
this time inside the machinery built to remove it.

## What was built, in two rounds

### Round one: terminal release state

A **second reader over the same signed bytes**. A governed repository is in one
of two states:

- **IN-FLIGHT** -- HEAD is the signed baseline. A current authorization confers
  bounded mutation authority over an allowed path set.
- **TERMINAL** -- HEAD is a release commit. No current authorization exists and
  none can. What is established instead is *what was released*, reconstructed
  from committed history, conferring nothing.

`srgds-core release-state` establishes the second, from the historical chain
alone.

### Round two: the exact release commit

Codex audited round one and found a material blocker. `release-state` proved the
parent, the tree, and the signed chain -- and that identifies a commit only by
accident. Codex built two commits over one parent and one tree; both were
accepted.

I reproduced it independently before repairing it, in a disposable clone:

```
released  : ee327bdf0853d8ff67f8e546ff6427d8a221a982   released=True
impostor  : d32192a1897380cdc98ef010ba1b77935fc6118e   released=True
parent    : 3febc64dcf956edb14aa84917557128e39927ac5   (identical)
tree      : 2ee7ea07b2b99d11460f0af17ffa1f80ba016c14   (identical)
```

My impostor SHA differs from the one Codex reported only because author identity
and timestamps differ -- which is precisely the point. A commit object holds a
tree, a parent, an author, a committer, a message and two timestamps. The chain
covered the first two; the rest were unsigned and free.

This could not be fixed inside the `ReleaseAuthorization`, which is signed
*before* the commit exists and cannot name a SHA that does not yet exist. So a
fifth governed object was added.

## ReleaseCommitBinding

A Product Authority statement, signed after the commit exists, that one exact
commit is the release of one exact audited candidate. It grants nothing.

It is keyed in the control store by **candidate digest, not commit SHA**:

```
<store>/commits/<stageSlug>.<candidateDigest>.commit.json
```

so a caller cannot choose which commit gets validated by choosing a filename.

The governed sequence is now:

1. StageAuthorization -- 2. Candidate -- 3. PASS AuditBinding --
4. ReleaseAuthorization -- 5. the release commit --
6. **ReleaseCommitBinding** -- 7. terminal release-state verification --
8. tags, packages, publication

`release-state` requires it, and additionally asserts HEAD equals
`releaseCommit`, HEAD^ equals `releaseParent` equals the signed baseline, HEAD's
tree equals `releaseTree` equals `candidateTree`, and that the binding names by
digest the same authorization, audit and release authorization that were
independently verified.

**The lifecycle package was not modified.** `RELEASE_AUTHORIZED -> RELEASED`
with `RELEASED` terminal already described this transition correctly; what was
missing was evidence binding the transition to a specific commit, not a new
state. Verified by leaving the package untouched and green.

## Prohibitions, all enforced structurally

- **No generic descendant allowance.** `TestHistoricalAuthorizationNeverBecomes
  CurrentAuthority` walks three real commits past the baseline and fails if
  authority ever returns -- including immediately after a historical read.
- **No baseline bypass.** `Load` still requires HEAD to equal the baseline, with
  no parameter, switch or field that skips it.
- **No path authority.** `HistoricalAuthorization` and `ReleaseCommitBinding`
  carry no path data and expose no methods. Reflection tests fail if a field or
  method is added that could authorize a mutation, and they also assert
  `Authorization` still *has* `PathAuthorized`, so the separation cannot be
  satisfied by gutting the wrong side.
- **No hard-coded commit.** The expected commit is read from signed bytes. There
  is no exception for `ee327bdf` or any other SHA.
- **No caller-supplied expected commit.** `release-state` takes
  `-commit-binding-digest`, naming which signed object must answer -- never an
  `-expected-commit`. A SHA on a command line is a claim, not evidence.

## Scope

Supersession was required for exactly one path. `governance/schemas/gds-
authority-lifecycle-v1.schema.json` is the single committed schema for all GDS
objects; its `objectType` enum and `oneOf` admitted four types, so a fifth was
invalid against it. It was protected under the `governance/` prefix.

A path may not be both allowed and protected -- the loader calls
`pathgrammar.Disjoint` and refuses a self-contradictory authorization -- so the
protected prefix narrowed to `governance/history/`. Allowed paths remain
exact-match only, so no other file under `governance/schemas/` became writable,
and `governance/history/` remains guarded.

## Files changed

| Path | Change |
|---|---|
| `governance/schemas/gds-authority-lifecycle-v1.schema.json` | `ReleaseCommitBinding` as a first-class object type |
| `tools/srgds-core/internal/authority/authority.go` | historical reader; granting/reading chain split; commit binding loader and chain |
| `tools/srgds-core/internal/candidate/candidate.go` | `BuildFromTrees` sharing derivation with `Build` |
| `tools/srgds-core/main.go` | `release-state`, requiring the commit binding |
| `tools/srgds-core/internal/authority/authority_test.go` | terminal-state and commit-binding adversarial tests |
| `tools/srgds-core/internal/candidate/candidate_test.go` | reconstruction-fidelity tests |
| `tools/SourceRoot.Governance.psm1` | `Test-GdsReleaseState`, `Get-GdsGovernanceState` |
| `tools/INVOKE-ROOT-GOVERNANCE.ps1` | `release-state` action; terminal-aware `status` |
| `tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1` | mode-aware baseline; terminal controls; explicit skip reporting |
| three `VERIFY-SOURCEROOT-*.ps1` | terminal-state mode |
| `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md` | sections 13.7 and 13.8 |
| `docs/build/SRGDS-CORE-BUILD-CONTRACT.md` | command contract and terminal invariants |
| `docs/stages/active/CURRENT-STAGE.md` | rewritten for this stage |
| `ROOT-MANIFEST.json` | new installer declared |
| `INSTALL-SOURCEROOT-GDS-RELEASE-TERMINAL-STATE.ps1` | new |
| `docs/stages/completed/20260813-...-V1.md` | this record |

## Verification

| Gate | Result |
|---|---|
| `go test ./...` | all packages pass |
| `INSTALL-...-RELEASE-TERMINAL-STATE.ps1 -Action all` | 0 failed |
| `tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1` | 43 controls held, 0 failed |
| `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1` | 181 pass, 0 fail |
| `VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1` | 84 pass, 0 fail |
| `VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1` | 135 pass, 0 fail |

The blocker is closed at the real release commit. With no signed binding,
`release-state` at `ee327bdf` now REJECTs where it previously ACCEPTed, and
omitting the flag entirely is an ERROR rather than a silent pass.

## Two defects found in my own work during this stage

Recorded because both are the kind that pass quietly.

**Eight controls that could not fail.** Terminal controls T3-T10 "held" by
throwing parameter-binding errors: `$Attempt` was also `Test-Refusal`'s
parameter name, so `@Attempt` splatted the scriptblock instead of the context.
Renamed; they now genuinely reject.

**A context-completeness check that lied.** Every `*Complete` guard used
`-not ($values | Where-Object { IsNullOrWhiteSpace($_) })`. When the filter
yields exactly ONE element PowerShell collapses the pipeline to a scalar, so
`-not` tested that string's truthiness: `-not ""` is `$true`, and a context
missing exactly one value reported COMPLETE. Two or more missing values behaved
correctly, which is why it survived every earlier run. This is the first hazard
named in the governance module header, reproduced in the code that decides
whether trust context was supplied. All six sites now count an explicitly
wrapped array.

## What this stage did NOT prove

Stated plainly rather than left to be discovered.

**No terminal release state has been established end-to-end against this
repository.** `ee327bdf` has no `ReleaseCommitBinding`, and the ruling is
explicit that one must not be fabricated or pre-signed. Terminal-state checks
therefore report an explicit SKIP naming the missing variable, and the
terminal negative-control family does not run. A SKIP is never counted as a
PASS, and the harness prints which family did not run.

What IS proven now:

- The trust core's behaviour, exhaustively, in Go, against a hermetic fixture
  with its own generated key -- including the impostor-commit regression, which
  builds both commits for real and fails loudly if the fixture ever produces one
  commit twice rather than passing vacuously.
- That the gate is wired into the live decision: at the real `ee327bdf`, a
  binding digest that was never signed is REFUSED, and the refusal names the
  release commit binding.

What is NOT proven until the Product Authority signs a binding: the PowerShell
terminal path on an ACCEPT verdict, and the verifiers' terminal branches. Those
first become exercisable at the next release commit.

## Consuming the active specification

The active specification `docs/stages/active/CURRENT-STAGE.md` is **consumed** by
this stage: the candidate deletes it rather than carrying a modified copy into
the release tree. That matches the GDS release at `d55a45b`, whose tree is
verified to contain no active specification.

Precisely: `d55a45b` establishes terminal ABSENCE, it did not perform a
deletion. The path appears exactly once in history, added at `ee327bd`;
`docs/stages/active/` is empty at `d55a45b` and its ancestors, and the six-path
`d55a45b` changeset performs no such deletion. An earlier draft of this record
said `d55a45b` "consumed" the file, which claimed more than the repository
proves. There is no transition commit to cite because none exists -- `ee327bd`
is where the file was introduced, and consuming it is this stage's work.

Carrying it forward was a material blocker. A release tree containing an active
specification says a stage is still in progress at the exact commit that ended
it, and the terminal assertion "the active specification stays consumed" would
have failed against this stage's own release.

Fixing it exposed a sixth instance of the defect class this whole line of work
has been closing. The in-flight branch asserted that the active specification
FILE is present, which conflated two different things: that the stage declared a
specification (durable) and that the file exists right now (an instant's state,
false the moment the stage completes). The two assertions were mutually
unsatisfiable, and it was demonstrated rather than argued: deleting the file
produced exactly one failure, the in-flight assertion; keeping it produced a
release tree that fails the terminal assertion. **No candidate could satisfy
both, so no releasable candidate existed.**

The rule now follows the lifecycle: a governed stage declares itself in exactly
one place -- the active specification while work is in progress, or the completed
record once it is consumed. The completed record is not read from the directory,
where any file could be dropped in; it must be a path the signed authorization
put in this candidate.

This is not a relaxation, and that was demonstrated too:

| State | Old rule | New rule |
|---|---|---|
| active only (in development) | PASS | PASS |
| completed only (consumed, releasable) | **FAIL** | PASS |
| both present (half-consumed) | **PASS** | **FAIL** |
| neither (undeclared) | FAIL | FAIL |

One corrected acceptance, one new rejection. The terminal assertion was not
touched.

## Execution context

Recorded here because the active specification that used to carry it is consumed
by this stage. None of these values is authority; each merely NAMES an object the
trust core must find and verify for itself in the external control store.

| Variable | Value |
|---|---|
| `SRGDS_STAGE` | `SOURCEROOT-GDS-RELEASE-TERMINAL-STATE-V1` |
| `SRGDS_AUTHORIZATION_ID` | `65ac0155-03b1-4ff7-89e8-56379eca5afd` |
| `SRGDS_AUTHORIZATION_DIGEST` | `3F3510B87E0C1A44565E7321737EDD2F0FC26CC3666BA996CB3662B762693B84` |
| `SRGDS_SIGNER_PRINCIPAL` | `joshua-product-authority` |
| `SRGDS_SIGNER_FINGERPRINT` | `SHA256:MHHB00WXsjj5eovi+1DRYg6NiknT4ZiLXjKaCT1b+Oo` |
| `SRGDS_RELEASED_STAGE` | `SOURCEROOT-GDS-AUTHORITY-LIFECYCLE-DESCENDANT-HARDENING-V1` |
| `SRGDS_RELEASED_AUTHORIZATION_ID` | `a8f6cf37-225b-42f6-a4ea-a333935825d4` |
| `SRGDS_RELEASED_AUTHORIZATION_DIGEST` | `14890DDA6BFA967E825ED5B9BDDB58C9724CBEDE8853C0869660F8D5B55FD595` |
| `SRGDS_AUDIT_DIGEST` | `67D09C03560FCE8D29DD12EC90AACACD764205E8AEAD595BC735620A6E98C472` |
| `SRGDS_RELEASE_DIGEST` | `898B18F1B65D2685BB3DB8EB66F5389542B08699FEA31056A723F0C4935B7F2F` |
| `SRGDS_AUDITOR_PRINCIPAL` | `joshua-product-authority` |
| `SRGDS_AUDITOR_FINGERPRINT` | `SHA256:MHHB00WXsjj5eovi+1DRYg6NiknT4ZiLXjKaCT1b+Oo` |
| `SRGDS_COMMIT_BINDING_DIGEST` | unset until the Product Authority signs one for this release |

The released predecessor is supplied separately from current authority because
they describe different commits. With `SRGDS_COMMIT_BINDING_DIGEST` unset, the
released-stage context is incomplete and terminal-state checks report an explicit
SKIP naming the missing variable -- never a pass.

## Standing constraints observed

- Every changed path is inside the signed 18. No path outside was touched.
- No commit, tag, package, push, primary integration, 15A release, or 15B.
- No Codex signature, no Product Authority key, and no ReleaseCommitBinding was
  fabricated.
- Ready for one independent Codex Tier-3 audit. A green verifier is evidence,
  never approval.
