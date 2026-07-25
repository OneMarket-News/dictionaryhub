# SourceRoot Codex Stage Contract

## Contract Identity

- Stage contract: SourceRoot Codex Stage Contract
- Contract version: v1
- Effective stage: SourceRoot Chunk 0 — Codex Stage Contract and Baseline Harness v1
- Applies to: every later SourceRoot Codex implementation stage

This contract is the permanent build and delivery agreement for staged SourceRoot work. A later stage may add stricter requirements, but it must not silently weaken this contract.

## Source-of-Truth Rules

1. The current repository and any explicitly identified latest uploaded files are the source of truth.
2. Never rebuild from an older package, backup, prototype, or remembered version.
3. Backups are historical recovery material, not implementation sources.
4. Inspect current files before deciding what must change.
5. Never replace a working system with a simplified recreation.
6. When the repository and a roadmap statement differ, preserve the repository and document the discrepancy.
7. Record the inspected branch and commit when Git makes them available.

## Scope Rules

1. Implement only the named chunk.
2. Do not implement future roadmap phases early.
3. List explicit exclusions for every stage.
4. Prefer the smallest coherent change that satisfies the current acceptance gate.
5. Do not redesign unrelated working functionality.
6. Shared utilities may be introduced only when directly required by the current stage.
7. A stage must distinguish required work, optional supporting work, and excluded work.

## Preservation Rules

Every stage must:

- Preserve working APIs.
- Preserve database compatibility unless a migration is part of the approved stage.
- Preserve customer branding.
- Preserve navigation and URL behavior.
- Preserve loading, empty, and offline states.
- Preserve existing source provenance.
- Preserve external identifiers.
- Preserve historical records and previous versions.
- Never silently replace or delete conflicting evidence.
- Never add fabricated fallback data merely to make a page appear functional.

Preservation does not mean defects can never be fixed. It means a named stage must identify the affected behavior, provide a compatible migration or replacement where required, verify the change, and document the rollback path.

## File-Delivery Rules

Every implementation stage must provide:

- Complete replacement or addition files.
- A stage manifest.
- Stage documentation.
- An installer.
- Backups of replaced files.
- A verifier.
- Regression checks.
- Explicit known limitations.
- Exact tests performed.
- Exact tests not performed.

Code snippets must not be the primary deliverable. Repository-relative paths in the stage manifest must use forward slashes so the manifest is portable across operating systems.

## Installer Rules

Every installer must:

- Accept or reliably locate the repository path.
- Confirm the target repository.
- Back up every file it replaces.
- Use a unique timestamped backup directory.
- Copy complete files.
- Avoid deleting unrelated files.
- Stop on material errors.
- Report files added and replaced.
- Never claim verification passed unless the verifier was actually executed and passed.

An installer must validate that its payload is complete before changing the target. Its backup must retain repository-relative paths. It must leave the backup in place after success or failure and record enough information to identify newly added files during rollback.

## Verification Rules

Every verifier must:

- Be nondestructive.
- Produce clear `[PASS]`, `[FAIL]`, `[WARN]`, and `[INFO]` results.
- Exit nonzero when required checks fail.
- State which checks are static.
- State which checks require the backend.
- State which checks require PostgreSQL.
- State which checks require a browser.
- State which checks require live API access.
- Never claim browser verification when no browser was used.
- Never claim live API verification when the API was not called.
- Never hide failed checks.
- Never weaken an expected result merely to force a pass.

Skipped checks are not passes. A warning may report an unavailable optional runtime, but a required acceptance check must fail if it cannot be performed. Static content checks establish only the facts they inspect; they do not prove runtime, database, browser, security, accessibility, performance, or production behavior.

## Documentation Rules

Every stage document must record:

- Stage name and version.
- Objective.
- Files added.
- Files replaced.
- Backup location.
- Migrations added.
- APIs added or changed.
- Frontend behavior added or changed.
- Tests executed.
- Tests passed.
- Tests not executed.
- Known limitations.
- Explicit exclusions.
- Rollback procedure.
- Next dependency.

Statements about test results must name the command or check and its observed outcome. Documentation must distinguish project-management classifications from independent technical, security, accessibility, and production-readiness audits.

## Final-Report Rules

Codex must conclude each stage with:

- Summary of completed work.
- Files added.
- Files replaced.
- Files intentionally untouched.
- Installer result.
- Verifier result.
- Tests executed.
- Tests not executed.
- Known limitations.
- Exact next dependency.
- Downloadable ZIP location.

The final report must use `PASS`, `PARTIAL`, or `FAIL` consistently with the observed acceptance checks. It must not upgrade a partial result to a pass because an unavailable check is inconvenient.

## Conflict Resolution

If a later stage instruction conflicts with this contract:

1. Follow the user's explicit current-stage instruction.
2. Preserve the current repository unless the user explicitly authorizes the conflicting change.
3. Record the conflict, decision, evidence, and effect in the stage documentation.
4. Do not use a backup or old release as a substitute for current repository inspection.

## Acceptance

A stage satisfies this contract only when its package is complete, its installer and verifier are honest about what they did, required static checks pass, any unperformed runtime checks are identified, protected behavior remains intact, and the exact next dependency is documented.
