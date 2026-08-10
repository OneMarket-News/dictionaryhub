# SourceRoot Governed Development System v1

## Stage identity

- Name: SourceRoot Governed Development System v1
- Slug: SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-V1
- Status: active
- Started: 2026-08-09
- Baseline commit: `15c547980aa6270cf1154cb9ed2a31b351dd0b77`
- Risk tier: Tier 2

## Objective

Formalize the smallest operational development-time governance contract that can safely govern Phase 15A: authority and release control, STOP semantics, four risk tiers, stage lifecycle and execution waves, ownership and specialist roles, the subagent task contract, retry and repair control, the verification funnel, resource guidance, and Knowledge Sync authority. Governance documentation and one static verifier only: no product, runtime, schema, migration, or released data change.

## Business value

SourceRoot already has stage scope, protected-behavior contracts, and focused
verification. What it did not have, in the repository, was a written account of
**who may decide what** while agents build it. That model lived only in
organizational memory, which is explicitly not an implementation authority.

Chunk 14C and the before-15A maintenance checkpoint both proved the cost of
that gap. Five runtime-enforcement defects in 14C, then three independent audit
rounds in maintenance, were all caught by independent review rather than by the
builder. The operating rules that produced those catches were real but
unwritten, so each stage re-derived them.

GDS v1 writes them down at the smallest size that can actually govern the next
phase. The measurable value is fewer re-derivations per stage, an unambiguous
escalation path, and a 15A reconnaissance task that can be instantiated from a
template instead of negotiated from scratch.

## Current source of truth

The checked-out repository at `15c547980aa6270cf1154cb9ed2a31b351dd0b77`.
Required current inputs are the existing governance contracts this stage
references rather than restates: `AGENTS.md`, `ROOT-VERIFICATION.md`,
`ROOT-PROTECTED-FUNCTIONALITY.md`, `docs/build/CODEX-STAGE-CONTRACT.md`,
`docs/build/AGENT-SAFETY-BASELINE.md`, `docs/build/STAGE-PACKAGE-STANDARD.md`,
`ROOT-MANIFEST.json`, and the three lifecycle tools. No backup, generated
package, or completed stage record was used as an implementation source.

## Allowed files

- `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260809-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-V1.md`
- `docs/stages/templates/STAGE-EXECUTION-RECORD-TEMPLATE.md`
- `docs/stages/templates/SUBAGENT-TASK-CONTRACT-TEMPLATE.md`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- The six existing governance contracts named above, read-only.
- `ROOT-MANIFEST.json` `known_verifiers` and `active_stage` declarations.
- The lifecycle tools, used rather than modified.
- The released 14C and before-15A completed stage records, as evidence of the
  operating rules being formalized.

## Required behavior

### 1. Authority and release control

The contract records five functions — Product Authority, Principal Architect,
Engineering Lead, Specialist Implementer/Reviewer, Independent Audit — by
**function first**, with the current implementation named separately so the
model survives a change of model, vendor, or tooling. **No AI role has final
release authority**, and that rule may not be delegated, inferred, waived by a
passing verifier, or self-granted.

### 2. STOP semantics

STOP is an authority boundary. When a STOP condition fires, execution
terminates unless the governing task contract already authorizes a *specific*
bounded recovery path for *that* condition. There is no general "reasonable
workaround" clause, and scope expansion, architecture uncertainty, a discovered
migration need, missing credentials, missing runtime artifacts, and ownership
conflict may never be reinterpreted as permission to continue.

### 3. Four risk tiers

Tier 1 documentation and mechanical work through Tier 4 irreversible actions,
each stating minimum approval authority, implementation expectations,
independent-review expectations, and escalation triggers. Ambiguity resolves
upward. Discovered consequences force reclassification *before* execution
continues.

### 4. Subagent task contract

Thirteen mandatory fields, with a template. A contract missing any field is not
executable. Scope expansion requires explicit re-authorization and no subagent
may expand its own ownership.

### 5. Ownership, waves, and specialist roles

Strict single ownership per wave; shared hotspots default to the Engineering
Lead; two subagents may not modify the same hotspot in one wave. Five execution
waves as governance structure rather than mandatory ceremony. Nine specialist
roles, with the Migration / Data Integrity Reviewer holding a veto on relevant
Tier 3 findings.

### 6. Retry, funnel, resources, Knowledge Sync

Two targeted repair attempts per materially equivalent failure, escalating on
the third, with a counter that tracks the defect rather than its description. A
verification funnel scaled by tier in which the builder is never the sole
approver. Effort, capacity, and model-routing guidance without automated
accounting. Knowledge Sync as a post-release phase in which Josh-Brain is
explicitly **not** an implementation authority.

### 7. Dogfood proof

Appendix A instantiates the real task schema for a future 15A reconnaissance
task, labelled **WORKED EXAMPLE — NOT AN AUTHORIZED STAGE**.

## Protected behavior

`ROOT-PROTECTED-FUNCTIONALITY.md` applies in full. Stage-specific protections:

- **No product, runtime, schema, migration, or released data change.** Nothing
  under `backend/src`, `backend/data`, `backend/db/migrations`, or any
  `package.json`. Migration count stays 20 and migration 020 stays absent.
- **No database access.** This stage requires no `sourceroot_test` connection;
  the focused verifier is static and touches neither database nor network.
- **Existing contracts are referenced, never restated or weakened.** In
  particular `docs/build/AGENT-SAFETY-BASELINE.md` remains authoritative for
  *product* agent safety; GDS governs *development-time* agents only, and the
  two must not be conflated.
- **Lifecycle tooling is used, not bypassed or modified.**
- Released 14A/14B/14C artifacts remain byte-identical.

## Non-goals

- Any agent framework, orchestrator, queue, workflow engine, database, API,
  plugin, daemon, MCP service, CI redesign, or new dependency.
- Automating Knowledge Sync.
- Building a telemetry platform.
- Designing 15A EarthRoot architecture beyond what Appendix A needs to prove
  the contract can be instantiated.
- Beginning 15A.

## Dependencies

Windows PowerShell 5.1, Git, and the existing lifecycle tools. No Node.js, no
PostgreSQL, no network.

## Risks

- **Governance sprawl.** Mitigated by a hard three-document limit, a line
  budget, and a rule to cross-reference rather than duplicate.
- **Conflict with existing contracts.** Mitigated by an explicit ownership
  table and by escalating conflicts instead of overriding.
- **Ceremony that stalls trivial work.** Mitigated by tier-scaled funnels and
  an explicit statement that Tier 1 must not carry Tier 3 ceremony.
- **A document contract nobody can check.** Mitigated by a static verifier that
  asserts each governance rule is actually present and that Appendix A
  instantiates every mandatory field.
- **Appendix A mistaken for authorization.** Mitigated by explicit labelling,
  an explicit non-authorization sentence, and verifier assertions on both.

## Acceptance criteria

1. `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1` reports 0 failures.
2. `tools/VERIFY-ROOT-REPOSITORY.ps1` reports 0 failures.
3. Exactly three durable Markdown artifacts plus one static verifier are added.
4. All three artifacts are UTF-8 without BOM and LF-only.
5. The authority model names all five functions and states that no AI role
   holds final release authority.
6. STOP semantics, four risk tiers, thirteen mandatory contract fields,
   ownership rules, the two-repair bound, the verification funnel, and Knowledge
   Sync authority are all present and verifier-asserted.
7. Appendix A is marked NOT AN AUTHORIZED STAGE, is Tier 3 / Architect-Scout /
   Wave 1, and instantiates every mandatory field.
8. No file outside the 7-path allowlist is created or modified.
9. No change under `backend/src`, `backend/data`, `backend/db/migrations`, or
   any package file; migration count 20; migration 020 absent.
10. Every changed PowerShell file parses under Windows PowerShell 5.1 and
    `git diff --check` is clean.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1`

## Manual browser checks

Not applicable. This stage adds governance documentation, two templates, and
one static verifier. No page, script, style, asset, route, or runtime behavior
is touched, so there is no rendered surface whose change could be observed.

## Live API checks

Not applicable. No route, handler, contract, or response shape is modified, and
the stage performs no database or network access at all.

## Required output

- The three durable governance artifacts and the focused static verifier.
- `ROOT-MANIFEST.json` registering the verifier and recording stage state.
- This stage record and the completion record produced by
  `COMPLETE-ROOT-STAGE.ps1`.
- A changeset prepared for independent audit, uncommitted.

## Completion record

- Completion date: 2026-08-09T14:07:25.6434790-05:00
- Verification skipped: False

### Verifier results

- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0
- VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1 -> exit 0

### Changed files

- `docs/build/SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-CONTRACT.md`
- `docs/stages/completed/20260809-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM-V1.md`
- `docs/stages/templates/STAGE-EXECUTION-RECORD-TEMPLATE.md`
- `docs/stages/templates/SUBAGENT-TASK-CONTRACT-TEMPLATE.md`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-GOVERNED-DEVELOPMENT-SYSTEM.ps1`

### Unresolved manual checks

- None reported

### Completion notes

#### Independent audit and targeted pre-commit repair

The first independent Codex audit of this stage returned **REQUIRES
CORRECTION** with five material findings. All five were repaired before commit,
inside the already-authorized 7-path allowlist. No stage was reopened, no
repair stage was created, and no new tracked path was introduced.

1. **Post-completion allowlist enforcement.** Once the stage completed, the
   manifest `active_stage` cleared and the Root verifier stopped enforcing
   scope, so nothing proved the pending changeset stayed authorized. The
   focused verifier now reads the authorized allowlist from the *completed
   stage record* — the canonical lifecycle evidence that survives completion —
   and asserts that the current changed and untracked paths are a subset of it.
   Git is invoked process-locally with `core.excludesFile=` and
   `core.autocrlf=false`; no global Git configuration was modified.
2. **Contradiction-resistant safety verification.** Presence-only checks let a
   contradictory clause coexist with a required clause and still pass. Safety
   rules are now section-scoped invariants: each section must contain its
   required canonical semantics **and** must not contain targeted contradictory
   semantics, across release authority, STOP/recovery, and Appendix A
   authorization.
3. **Independent Audit versus Product Authority.** The stage execution record
   template now carries two distinct sections — Independent Audit
   recommendation (auditor, recommendation, date, findings) and Product
   Authority release decision (approving authority, decision, date, reference)
   — and states that an audit PASS and a verifier PASS are **not** release
   approval.
4. **Contract conflict fires STOP.** The contract previously escalated
   conflicts without prohibiting execution while escalation was pending. It now
   requires STOP, escalate, do not select or apply either conflicting rule
   while resolution is pending, and resume only after explicit authorized
   resolution. GDS still asserts precedence over nothing; no automatic
   precedence rule was invented.
5. **Engineering Lead self-scope expansion.** The resolver is now explicit: the
   Engineering Lead may re-authorize a *subagent's* bounded Tier 1/2 expansion
   only while six stated conditions hold, may **not** self-re-authorize its own
   expansion, which requires Principal Architect re-authorization; changes to
   product intent, release boundary, major stage purpose, or Tier 4
   consequences escalate to the Product Authority; and any Tier 3 consequence
   reclassifies and escalates before execution continues, with no tier
   downgrade permitted to avoid the rule.

#### Verification after repair

- Focused GDS verifier: **160 pass / 0 fail**.
- `VERIFY-ROOT-REPOSITORY.ps1`: **51 pass / 0 warn / 0 fail**.
- Windows PowerShell 5.1 parse: PASS. `git diff --check`: PASS.
- No change under `backend/src`, `backend/data`, `backend/db/migrations`, or
  any package file. Migration count 20; migration 020 absent.

#### Negative controls

Fourteen disposable-fixture controls plus one live-repository control, all
matching expectation with zero fixture residue. Both defect classes are now
detected: removing a required safety clause fails, and **adding a
contradictory clause also fails** — the gap Codex identified. An unauthorized
path introduced into the live repository made the verifier fail and name the
offending path; it passed again once removed.

#### Preferred line-budget STOP and authority resolution

The preferred substantive-line target was approximately 700 or fewer lines.
The first repaired state reached **734 substantive lines**, so Claude Lead
**STOPPED and escalated** rather than self-authorizing further expansion. The
Principal Architect accepted that bounded architecture and implementation-
budget exception because the additional lines implement concrete safety
enforcement discovered by independent audit. The architectural decision was
to preserve meaningful safety assertions rather than delete them solely to
meet the preferred numerical target.

This was **not Product Authority release approval**. Final Product Authority
release approval remains a separate future decision.

#### Second independent re-audit and targeted repair attempt 2

The targeted Codex re-audit again returned **REQUIRES CORRECTION**. Four of the
original five blockers were closed, but Git child-process failures could still
be converted into empty verifier input, and this record did not yet preserve
the 734-line STOP and authority decision. Repair attempt 2 was limited to the
focused verifier's Git invocation boundary and this completed-stage evidence.
No GDS feature, tracked path, stage, product behavior, runtime behavior,
migration, schema, dependency, or release authority was added.

After repair attempt 2, the exact governed substantive total is **750 lines**:
274 GDS contract, 60 subagent template, 74 execution-record template, and 342
focused verifier. This remains within the Principal Architect's bounded
authorization of at most 800 lines for reliable Git exit handling and accurate
decision evidence.

#### Final verification after repair attempt 2

- The focused verifier captures each Git child's stdout, stderr, and exact exit
  code before interpreting output. Nonzero exit prevents output consumption and
  terminates verification fail-closed.
- Process-local failure shims forced exit 7 independently for `git diff
  --name-only`, `git ls-files --others --exclude-standard`, and `git diff
  --check`; all three focused-verifier executions exited 1 and named the failed
  Git command.
- A separate exit-0 shim emitted a benign stderr diagnostic; the focused
  verifier still passed **160 / 0**, proving stderr alone is not treated as a
  failed child process.
- Five consecutive canonical focused-verifier runs each reported **160 pass / 0
  fail**, with no intermittent Git result.
- The Root verifier reported **51 pass / 0 warn / 0 fail**. Windows PowerShell
  parsing and direct `git diff --check` passed.
- Unauthorized-path, AI-release contradiction, generic STOP bypass, positive
  Appendix-A authorization, and Engineering Lead self-reauthorization controls
  all failed as expected.
- Temporary process-local shims were created outside the repository, removed
  after the controls, and left **0 residual fixtures**.

Codex PASS has **not** occurred. The uncommitted changeset is prepared for a
final targeted independent commit-gate audit. Product Authority release
approval remains pending and separate.

#### Status

15A EarthRoot remains **NOT STARTED**. Appendix A remains a worked example that
grants no authorization. This changeset is uncommitted and prepared for
independent re-audit.
