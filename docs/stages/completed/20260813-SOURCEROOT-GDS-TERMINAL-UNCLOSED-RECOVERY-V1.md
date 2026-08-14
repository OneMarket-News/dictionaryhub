# SourceRoot GDS Terminal Unclosed Recovery

## Stage identity

- Name: SourceRoot GDS Terminal Unclosed Recovery
- Slug: SOURCEROOT-GDS-TERMINAL-UNCLOSED-RECOVERY-V1
- Status: active
- Started: 2026-08-13

## Objective

Authoritative role resolution, RecoveryEligibility, three-state installer
classification, corrected role tests, and clone-independent migration bytes;
establish a green superseding closure release for
4d325d303e7f95c06bec9604abe3b04cab079fc2.

## Business value

The predecessor release reached terminal state but never closed: an audit
established that its AuditBinding was authenticated by the Product Authority key
rather than an independent auditor, so it does not satisfy the corrected auditor
model. Two things follow, and both are worth money.

First, the repository currently has no governed way forward. A boolean terminal
state can only call that release "released" or "invalid", and both answers are
false. Until a third answer exists, every stage after it is blocked or must
launder the defect to proceed.

Second, the same audit found that roles were caller-selectable, which means
every role check in the system proved less than it appeared to. That is a
standing integrity exposure across all six governed object types, not a
cosmetic one.

## Current source of truth

The checked-out repository is canonical. Required current inputs:

- the signed control store at `C:\ProgramData\SourceRoot\GDS\<repository-id>`,
  specifically `allowed_signers`, `roles`, and the signed StageAuthorization,
  AuditBinding, ReleaseAuthorization, ReleaseCommitBinding and
  RecoveryEligibility objects
- the committed predecessor release commit
  `4d325d303e7f95c06bec9604abe3b04cab079fc2` and its tree

Do not use backups, generated packages, or completed stages as implementation
sources.

## Allowed files

- `.gitattributes`
- `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md`
- `docs/build/SRGDS-CORE-BUILD-CONTRACT.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `governance/schemas/gds-authority-lifecycle-v1.schema.json`
- `INSTALL-SOURCEROOT-GDS-RELEASE-TERMINAL-STATE.ps1`
- `ROOT-MANIFEST.json`
- `tools/INVOKE-ROOT-GOVERNANCE.ps1`
- `tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1`
- `tools/SourceRoot.Governance.psm1`
- `tools/srgds-core/internal/authority/authority.go`
- `tools/srgds-core/internal/authority/authority_test.go`
- `tools/srgds-core/main.go`
- `VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1`
- `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md` sections 2, 3,
  5 and 13.10 through 13.12
- `docs/build/SRGDS-CORE-BUILD-CONTRACT.md`
- `governance/schemas/gds-authority-lifecycle-v1.schema.json`
- `tools/srgds-core/internal/authority/authority.go`
- the signed control-store objects listed under "Current source of truth"

## Required behavior

1. **Authoritative role resolution.** Role occupancy is read from a configured
   `roles` file beside `allowed_signers` at the ACL-protected trust root. The
   trust core resolves role to principal to registered key to derived
   fingerprint itself. Caller-supplied `-signer-principal` and
   `-signer-fingerprint` are assertions checked against that resolution and
   never define it. Every ambiguity fails closed.
2. **RecoveryEligibility.** A sixth governed object type, signed by the
   configured Product Authority, recording that one exact TERMINAL-UNCLOSED
   predecessor may be recovered from exactly once by one exact recovery stage.
   It is keyed by both dimensions on disk and re-states both in its signed
   bytes. `hopLimit` is exactly `1`, read as an integer. It carries the four
   legacy evidence digests so the non-conforming chain stays findable, and
   asserts nothing about whether that chain conforms.
3. **Eligibility grants nothing.** The object carries only scalar facts, exposes
   no method, and has no path set. It is meaningful only when bound to a
   StageAuthorization for the same recovery stage whose baseline is the
   predecessor it names.
4. **A distinct verdict.** `recovery-eligibility` returns `ELIGIBLE`, never
   `ACCEPT`, and the PowerShell surface returns an object with an `Eligible`
   property and no `Accepted`, `Released`, `Authorized` or path property.
5. **Three-state installer classification.** `CONFORMING-TERMINAL`,
   `LEGACY-RECOVERY-ELIGIBLE`, `INVALID-UNTRUSTED`. Conformance is decided from
   the release chain alone, before eligibility is loaded, so eligibility cannot
   promote anything to `CONFORMING-TERMINAL`. Absence of context reports
   `UNCLASSIFIED` and is a skip, not a state.
6. **Corrected role tests.** The Go suite exercises two genuinely distinct keys,
   and refuses the auditor from Product Authority roles while it asserts its own
   entirely valid identity.
7. **Clone-independent migration bytes.** Governed migrations are bound by the
   audited candidate and the released tree, so they must survive any clone
   unchanged, including under `core.autocrlf=true`.

## Protected behavior

`ROOT-PROTECTED-FUNCTIONALITY.md` applies unchanged. Stage-specific
protections:

- No AuditBinding predating the corrected auditor model is reissued, amended, or
  represented as independently authenticated. Legacy objects are preserved
  exactly as they are and reported as not satisfying the rule.
- The predecessor commit `4d325d30` and its tree remain immutable. Recovery
  supersedes it for closure only and does not invalidate it.
- `SeparationOfDuties` and the corrected `auditorIdentity` rule from 13.12 are
  strengthened, never relaxed. No legacy or date exemption is introduced.
- Terminal release state remains provable only from the complete historical
  chain and continues to confer no mutation authority.
- The PowerShell module gains no trust-core implementation: no canonical
  serialization, digesting, path grammar, or signature handling.
- Released 14A through 15A behavior, the migration chain, and the pinned GDS
  release facts are unchanged.

## Non-goals

- Reissuing, backdating, or "repairing" the predecessor's AuditBinding.
- Any general post-release repair authority. Exactly one recovery hop is
  authorized and no second recovery is implicitly permitted.
- Creating the AuditBinding, ReleaseAuthorization or ReleaseCommitBinding for
  this stage. Those are Product Authority and independent-auditor acts that
  follow the Tier-3 audit.
- Beginning 15B, or any work outside the allowed files above.
- Changing the lifecycle state machine, the candidate identity algorithm, or the
  deterministic build recipe.

## Dependencies

- The governed Go toolchain at `C:\Program Files\Go` reporting
  `go version go1.26.5 windows/amd64`.
- The trust core `srgds-core`, built from `tools/srgds-core` by the recorded
  deterministic recipe.
- The ACL-protected control store, containing a `roles` file that assigns
  `product-authority` and `independent-auditor` to distinct principals holding
  distinct registered keys.
- A signed RecoveryEligibility for `4d325d303e7f95c06bec9604abe3b04cab079fc2`
  and a StageAuthorization for this stage baselined on that same commit.
- The predecessor stage `SOURCEROOT-GDS-RELEASE-TERMINAL-STATE-V1`.

## Risks

- **Laundering.** The central risk of this stage is that eligibility becomes a
  way to call a non-conforming chain conforming. Mitigated by deciding
  conformance before eligibility is loaded, by a distinct verdict word, by the
  absence of any `Accepted` property, and by adversarial tests over each.
- **Eligibility by omission.** A skipped verifier or an unsupplied context
  records nothing while looking like a pass. Mitigated by stating every
  non-exercised family out loud and by requiring the recovery classification to
  be reported positively.
- **Role table availability.** Role resolution now depends on a file that did
  not previously exist; a missing or malformed table refuses every governed
  load. This is deliberate fail-closed behavior, and the rollback is to restore
  the table, never to reintroduce caller-selected roles.
- **Clone divergence.** A checkout under `core.autocrlf=true` rewrote governed
  migration bytes and broke the terminal attribution comparison. Mitigated by
  `backend/db/migrations/*.sql -text` and proved by a disposable clone.
- **Compatibility boundary.** Releases before this stage do not satisfy the
  corrected model and will report as non-conforming. That is the correct answer
  and is not a regression introduced here.

## Acceptance criteria

Deterministic checks:

1. `gofmt -l` reports nothing and `go vet ./...` is clean under
   `tools/srgds-core`.
2. `go test ./...` passes under `tools/srgds-core`, including the adversarial
   RecoveryEligibility suite covering signer role, predecessor replay, stage
   replay, hop limit as integer, schema exactness, tamper detection, and the
   structural proof that eligibility carries no path set and exposes no method.
3. `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1` exits 0 with zero
   failures.
4. `VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1` exits 0 with zero
   failures.
5. `tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1` exits 0 with every control held,
   including the RECOVERY family, and states every family it did not exercise.
6. `INSTALL-SOURCEROOT-GDS-RELEASE-TERMINAL-STATE.ps1 -Action all` exits 0 with
   zero failed checks.
7. The installer classifies `4d325d303e7f95c06bec9604abe3b04cab079fc2` as
   `LEGACY-RECOVERY-ELIGIBLE`, reported positively, with predecessor context
   supplied. A classification reached by omitting context is not acceptable
   evidence.
8. The trust core reports `ELIGIBLE` for the signed eligibility with
   `predecessorConforming: NO` and `grantsMutationAuthority: NO`, and
   `release-state` continues to REJECT the same predecessor.
9. In a disposable clone made with `core.autocrlf=true`, every file under
   `backend/db/migrations/` is byte-identical to the bound release tree, with
   zero CRLF pairs, and the Go suite passes there unchanged.

Manual evidence:

10. Independent Tier-3 audit of this candidate by the configured
    `independent-auditor`, who is not the Product Authority and does not share
    its key. Not performed by this stage.

## Required verifier

- `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1`

## Manual browser checks

Not applicable. This stage changes governance tooling, the trust core, contract
documentation and repository attributes only. It adds no route, no UI, no
rendered surface, and no package or dependency change, so there is no page whose
behavior could differ. `VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1`
independently asserts that no route or UI change is present.

## Live API checks

Not applicable. No API surface is added or modified. The backend typecheck and
the EarthRoot semantics, adapter and provenance suites run inside
`VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1` against the local test
database and cover the runtime behavior this stage could have disturbed.

## Required output

- The trust core verb `recovery-eligibility`, the `RecoveryEligibility` object
  type, and configured role resolution, all with adversarial coverage.
- Three-state terminal classification in
  `INSTALL-SOURCEROOT-GDS-RELEASE-TERMINAL-STATE.ps1`.
- The RECOVERY negative-control family.
- Contract sections 13.13 through 13.16 and the corresponding build-contract
  sections.
- `backend/db/migrations/*.sql -text` in `.gitattributes`.
- Completion-report evidence: verifier pass and failure counts for both required
  verifiers, the negative-control held and failed counts, the installer check
  counts, the reported classification for `4d325d30`, the frozen candidate
  digest and tree, and the disposable-clone migration measurements for both the
  unfixed and fixed arms.

## Completion record

- Completion date: 2026-08-13T19:58:27.2703852-05:00
- Verification skipped: False

### Verifier results

- VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1 -> exit 0

### Changed files

- `.gitattributes`
- `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md`
- `docs/build/SRGDS-CORE-BUILD-CONTRACT.md`
- `docs/stages/completed/20260813-SOURCEROOT-GDS-TERMINAL-UNCLOSED-RECOVERY-V1.md`
- `governance/schemas/gds-authority-lifecycle-v1.schema.json`
- `INSTALL-SOURCEROOT-GDS-RELEASE-TERMINAL-STATE.ps1`
- `ROOT-MANIFEST.json`
- `tools/INVOKE-ROOT-GOVERNANCE.ps1`
- `tools/INVOKE-ROOT-NEGATIVE-CONTROL.ps1`
- `tools/SourceRoot.Governance.psm1`
- `tools/srgds-core/internal/authority/authority.go`
- `tools/srgds-core/internal/authority/authority_test.go`
- `tools/srgds-core/main.go`
- `VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY.ps1`
- `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1`

### Unresolved manual checks

- Independent Tier-3 audit by the configured independent-auditor principal: NOT PERFORMED. This stage stops here by instruction.

### Completion notes

Recovery for the TERMINAL-UNCLOSED predecessor 4d325d303e7f95c06bec9604abe3b04cab079fc2.

Role occupancy is now configured in a roles file at the ACL-protected trust root
and resolved by the trust core; caller-supplied identity is an assertion only.
RecoveryEligibility is added as the sixth governed object type, signed by the
configured Product Authority, covering exactly one predecessor and one recovery
stage with hopLimit 1 read as an integer. It carries the four legacy evidence
digests, asserts nothing about conformance, exposes no method and carries no
path set, and is meaningful only when bound to a StageAuthorization baselined on
the predecessor it names. The verdict word is ELIGIBLE and the PowerShell answer
has no Accepted property.

The installer classifies HEAD into CONFORMING-TERMINAL, LEGACY-RECOVERY-ELIGIBLE
or INVALID-UNTRUSTED, deciding conformance from the release chain alone before
eligibility is loaded. For 4d325d30 the reported classification is
LEGACY-RECOVERY-ELIGIBLE, established with full predecessor context rather than
by omission.

Evidence: go vet clean and gofmt clean; go test ./... green including 26 new
adversarial eligibility cases; VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM
187 pass / 0 fail; VERIFY-SOURCEROOT-EARTHROOT-PLACE-GEOGRAPHY-POLITY 135 pass /
0 fail; negative controls 68 held / 0 failed including the new RECOVERY family;
installer -Action all 27 passed / 0 failed. In a disposable core.autocrlf=true
clone without backend/db/migrations/*.sql -text, all 21 migrations diverged with
4446 CRLF pairs and migration 020 hashed a9d00c46 against bound ab146237; with
the attribute applied, 0 CRLF pairs, 0 divergences, and the Go suite passed
unchanged.

This stage stops at independent Tier-3 audit. No AuditBinding, no
ReleaseAuthorization, no ReleaseCommitBinding, no commit, no tag, no push.
