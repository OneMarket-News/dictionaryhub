# Stage Execution Record — SourceRoot GDS Authority / Lifecycle / Descendant Hardening

Governed by `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md`.

Recorded by hand at stage completion. This is a retrospective, not a telemetry
system: no automated collection exists or is planned for GDS v1. Record what
is known; write `not measured` rather than estimating.

> **STATUS: CANDIDATE, NOT RELEASED.** This record is written at candidate
> completion so an independent audit has something to audit. The Independent
> Audit and Product Authority sections below are deliberately blank. Nothing in
> this file is approval, and no green result reported here is approval.

## Identity

| Field | Value |
|---|---|
| Stage name | SourceRoot GDS Authority / Lifecycle / Descendant Hardening |
| Stage slug | `SOURCEROOT-GDS-AUTHORITY-LIFECYCLE-DESCENDANT-HARDENING-V1` |
| Risk tier | 3 |
| Baseline commit | `3febc64dcf956edb14aa84917557128e39927ac5` |
| Completion date | candidate complete 2026-08-12; not released |

## Effort

| Field | Value |
|---|---|
| Planned effort | not measured |
| Actual effort | not measured |
| Largest source of variance | The architecture escalation. The stage began as a PowerShell hardening pass and became a language migration of the trust core after two audits found materially equivalent defects in the same place. |

## Execution

| Field | Value |
|---|---|
| Agents / subagents used | none; single-session execution |
| Specialist roles engaged | Product Authority (signing), Principal Architect (rulings), Independent Audit (Codex Tier-3, Waves 1 audits) |
| Execution waves run | Bootstrap (authority selection), G1–G7 (Go trust core), 2–6 (tooling, harness, installer, documentation) |
| Maximum parallelism | 1 |
| Changed files | 30 candidate paths, all within the signed 38 |

## Verification

| Field | Value |
|---|---|
| Verifiers run and results | Current repair replay: `go vet ./...` clean; `gofmt -l` empty; `go test ./...` **201 named tests, 0 failures, 0 skips**; negative-control harness **43 controls held, 0 failed**; full installer/adversarial matrix **90 checks, 0 failed**. Earlier stage verifiers: `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1` **181 pass / 0 fail**; `VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1` **85 / 0**; `VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1` **135 / 0**; release-gate correctly REJECTs (exit 3) with no audit binding present. |
| Tests run and results | See above. Both real Product Authority objects verify natively and re-canonicalize byte-for-byte: `14890DDA…D595` (current) and `D09C272F…63BC` (superseded). |
| Failures encountered | Documented below rather than smoothed over. |
| Targeted repair attempts | Two Wave-1 PowerShell repair cycles (both judged materially equivalent by audit), then one architecture escalation, then one canonicalization correction after Principal Architect review. |
| Independent audit findings | Wave-1 audits FAIL / FAIL. Full Go-candidate re-audit found one material blocker: inherited `GIT_WORK_TREE` could substitute candidate identity. Targeted repair and adversarial replay are complete; an independent post-repair audit is still required. |
| Escaped defects found after release | not applicable; not released |

### Failures encountered, in order

1. **Two PowerShell repair cycles failed to close the defect class.** Both
   audits found materially equivalent defects sitting on documented PowerShell
   behaviours: collection-to-scalar collapse, case-insensitive comparison,
   duplicate-name merging in `ConvertFrom-Json`, U+FFFD substitution, console
   code-page decoding. This triggered the architecture escalation.

2. **`git add -A` failed under Go with `unable to create temporary file`.** The
   first hypothesis (Windows per-drive environment entries) was wrong; the
   correction to `cmd.Environ()` was kept because it is right, but it was not
   the cause. The actual cause was environmental: spawned processes cannot write
   into the repository tree in the execution environment. Diagnosis by probe
   rather than by guessing led to the fix below.

3. **Manifest construction was not read-only.** Investigating (2) exposed that
   `git add -A` had been writing loose blobs and trees into the repository's own
   object database on every manifest — unreferenced garbage after each run. The
   core now redirects `GIT_OBJECT_DIRECTORY` to a disposable store with the
   repository's database attached as a read-only alternate.

4. **A dead directory-grant branch.** `Authorized` matched trailing-slash
   allowed entries as subtree grants, but the loader rejects any allowed entry
   with a trailing slash, so the branch could never fire. It advertised a
   capability that cannot be signed. Surfaced by a test, not by review.

5. **A bypass written for test convenience.** A `SkipBaselineCheck` field was
   added to make tests easier, then removed before its tests were written: it is
   the same defect as the `-SkipHeadCheck` switch an earlier audit rejected. A
   bypass that exists for tests is a bypass that exists.

6. **Canonicalization shrank the input domain.** The first implementation
   resolved .NET/Go key-ordering divergence by rejecting property names at or
   above U+E000. Principal Architect review required the ordering be reproduced
   instead. The domain belongs to the authority schema, not to the serializer.

7. **A stray empty `main.go` at the repository root**, created by a failed
   PowerShell command whose `[IO.File]::WriteAllText` ran with a null value
   against .NET's working directory. It was caught by the governance system as
   an unauthorized candidate path, and removed.

## Governance

| Field | Value |
|---|---|
| Architecture escalations | 1 — PowerShell judged to carry runtime-semantics risk unacceptable for a trust core; split model approved (Go core, PowerShell orchestration) |
| Risk-tier reclassifications | none |
| Scope-expansion re-authorizations | 1 — superseding authorization `a8f6cf37…` (38 paths) replacing `b7a1c3e2…` (21 paths), signed after review |
| STOP conditions fired | Multiple: after issuance and before signing; after the bootstrap; after G1–G7; and the standing STOP before any commit, tag, push, or release |
| Veto exercised | not applicable |
| Human interventions | Product Authority signing (twice); Principal Architect rulings on scope, architecture, the legacy filename, and canonical ordering |

### Deliberate omissions

- The unversioned legacy authorization filename was **not** retired. Ruled
  transitional compatibility, out of scope for this stage.
- No third-party JSON Schema validator was added. The committed-schema test
  compares contract **shape**, not every pattern constraint; pattern constraints
  are enforced by typed Go validation and tested separately. This limit is
  stated because the Tier-3 audit will challenge whether it is sufficient.

## Independent Audit recommendation

A recommendation, not a release. **An Independent Audit PASS is not release
approval, and a verifier PASS is not release approval.**

| Field | Value |
|---|---|
| Auditor / actor | |
| Recommendation | |
| Recommendation date | |
| Material findings or reference | |

## Product Authority release decision

**Only the Product Authority may make the final SourceRoot release decision.**
This section is completed by a human and is left blank until that decision is
actually made.

| Field | Value |
|---|---|
| Approving authority | |
| Decision | |
| Decision date | |
| Release authorization or reference | |

## Outcome

| Field | Value |
|---|---|
| Final outcome | Targeted ambient-Git repair complete, awaiting independent post-repair Codex Tier-3 re-audit. Not committed, tagged, pushed, integrated or released. |
| Deferred findings | N8 (superuser DB role) and N9 (object-side typed-predicate SQL gap) remain open and activation-blocking. Deferred register A–H from 15A remains open. The 15A exact-21 debt and non-authoritative scanner cleanup remain open. Verifier conversions to the trust core are incomplete (see below). |
| Lessons worth carrying forward | A defect that repeats after two targeted repairs is evidence about the material, not about the effort. Diagnose environment failures with a probe before theorising. A test-only bypass is a bypass. Solving a cross-implementation disagreement by narrowing the accepted input domain moves the problem into the schema, where it does not belong. |

## Primary metric

Verified durable progress ÷ (AI credits + human time + rework).

Qualitative judgment: **positive, with substantial rework already paid.** The
durable progress is a trust core whose decisions are reproducible off the
machine that made them — the disposable-clone simulation reproduces the
candidate digest and tree exactly — and which verifies real Product Authority
signatures without shelling out to `ssh-keygen`. The rework was two full
PowerShell repair cycles that an audit judged materially equivalent, plus one
canonicalization correction. That rework bought the evidence for the
architecture decision; it was not wasted, but it was not free either.

Evidence: 201 Go test cases, 43 negative controls, both real signed objects
re-canonicalizing byte-for-byte, and a candidate digest that reproduces in a
disposable clone at a different path.

## Completion work carried out after the first candidate report

The first candidate report listed four items as incomplete. All four are now
done, and one defect it reported as open was root-caused and repaired.

**Disposable-clone simulation defect — repaired.** The simulation reported a
digest mismatch whose real cause was upstream: the clone's worktree was in the
`--no-checkout` state when the core was asked about it, so the core correctly
described a tree containing only the copied files (368 deletes + 26 adds = the
394 entries observed). The step that should have caught this inferred success
from `$LASTEXITCODE -eq 0`, which is a stale-value trap — the preceding `git
clone` had already set it to 0, so the check could report OK without the
checkout having taken effect. The repair stops inferring state and observes it:
the clone's actual HEAD is compared to the baseline, and the worktree is
asserted CLEAN before anything is copied into it, aborting with the count if not.
The underlying property was never in doubt and is now proven every run — the
candidate digest and candidate tree reproduce exactly in a disposable clone at a
different path.

**Three verifiers converted.** Each carried an identical 111-line "legacy
stage-identity parser", marked non-authoritative and unused, which left three
copies of legacy authority logic in the tree looking authoritative to anyone who
did not read the header. All three are removed; no call site existed. Each
verifier now delegates authority and candidate questions to `srgds-core` and
cross-checks its own view of the changeset against the candidate the core
derived.

Converting them exposed four assertions failing for the reason this stage
exists: they attributed pending work to a path list pinned inside the verifier,
behind an anchor window that closes when HEAD moves. Each was superseded by the
signed authorization, which is strictly stronger — signed, stored outside the
candidate, and not editable by the stage it governs. Two conversions were wrong
on the first attempt and were corrected rather than forced:

- the shared-grammar drift rule initially asked whether a file was in the
  candidate, when the drift in question was **committed** 15A history; the rule
  now distinguishes committed drift (a historical release fact, verified against
  the pinned release tree) from uncommitted drift (a durable invariant, answered
  by the signed authorization);
- the EarthRoot cross-check initially demanded set EQUALITY between its
  changeset and the candidate, but the two measure from **different baselines** —
  the 15A canonical baseline versus the signed GDS baseline. The relation is
  containment, and it is now asserted as containment.

**Contract updated.** `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md`
gains section 13 covering the orchestration/trust-core split, versioned
authorization selection, the candidate-tree model, audit binding, release
authorization, release-gate semantics, and the historical-fact versus
durable-invariant rule. Sections 1–12 are untouched, so their pinned assertions
still hold.

**Manifest updated.** The installer is registered in `known_installers`.
`active_stage` was deliberately left alone: populating `allowed_files` would
copy authority into the candidate, which is the anti-pattern this stage exists
to remove.

### Executable routing — the boundary an audit found last

A Tier-3 audit sanitized every Git environment variable and still substituted
the candidate. The core resolved `git` through ambient `PATH`, so a wrapper
placed earlier in `PATH` received the sanitized environment, reintroduced
`GIT_WORK_TREE`, called the real Git, and returned a substituted candidate that
was **ACCEPTED**.

The finding is worth recording as a principle rather than a patch:

> Sanitizing environment variables is insufficient when the executable itself is
> selected through ambient PATH. The governed subprocess boundary is explicit
> executable identity + direct invocation + sanitized environment + explicit Git
> configuration. **PATH is not authority.**

This is the same shape as three earlier findings in this stage — authority that
lived somewhere the candidate or the workstation could reach. Each repair moved
one more decision out of ambient state:

| Finding | Ambient input that was deciding |
|---|---|
| autocrlf / clone | system-level Git config |
| attributes / filters | per-user and system attributes, external filter drivers |
| ignore state | `.git/info/exclude`, global `excludesFile` |
| **executable routing** | **`PATH`** |

The repair binds an absolute, version-checked, SHA-256-checked Git executable
and fails closed. The attack is now a permanent regression at two levels: Go
tests that require the planted wrapper to receive zero invocations, and an
installer control that plants a *working* logging wrapper and requires an empty
log across four PATH configurations.

### Still deliberately not done

- The stage templates were not modified; nothing in this stage required it.
- The unversioned legacy authorization filename was not retired (Principal
  Architect ruling: transitional, out of scope).
- No third-party JSON Schema validator was added.

## Tier-3 ambient Git environment blocker and targeted repair

The full candidate re-audit found one material release blocker after the first
candidate report. With inherited `GIT_WORK_TREE` directed to an empty disposable
directory, the pre-correction installed core returned `ACCEPT`, zero unauthorized
paths, and only five entries. All 25 untracked candidate additions disappeared.
The wrong candidate was internally self-consistent:

- normal: digest `D0025112B1669806DF61A69C40189FD078DEB4FC08B801578D845F5E2FEB11D6`,
  tree `e59ef83e0484d107e52f052ef732954dd54e3124`, 30 entries;
- hostile: digest `FCD4E3FFA100E97D264BCC6119FCD3DFEE947FE2DB383D4F217420A51E9B76C6`,
  tree `cd87417b7e9ff6c81d8c3ada135e4c47464c7839`, five entries.

The cause was architectural at the process boundary: `git -C` does not override
Git's repository-local environment. The runner now removes every variable named
by `git rev-parse --local-env-vars`, plus numbered `GIT_CONFIG_KEY_*` and
`GIT_CONFIG_VALUE_*`, before appending the core's fixed contract and disposable
workspace values. The filter is case-insensitive and preserves Windows hidden
per-drive entries from `cmd.Environ()`.

Regression evidence exists at three levels:

1. synthetic runner-environment tests require hostile routing to be removed and
   controlled workspace values to survive;
2. real-repository Go tests require both runner calls and the full candidate
   builder to ignore combined hostile routing;
3. installer `-Action environment` proves seven hostile cases are potent against
   ordinary Git, then requires authorization, digest, tree, count, and every
   candidate entry to remain identical.

The rebuilt deterministic binary is
`5AC5A4D00A057B8BDF65492D17EE78F02F9ABDEA0E35BDCF848CDEFF2F492798`.
The full current installer replay completed **90 checks / 0 failures**, including
the **23 / 0** ambient-environment matrix. This closes the reproduced defect; it
does not constitute an Independent Audit PASS or Product Authority release.
