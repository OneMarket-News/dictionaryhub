# SourceRoot Chunk 7 â€” Repeatable Source Preparation Workflow v1

## Stage identity

- Name: SourceRoot Chunk 7 â€” Repeatable Source Preparation Workflow v1
- Slug: SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1
- Status: active
- Started: 2026-07-27

## Objective

Create a deterministic, review-first source-preparation workflow that produces standard accepted SourceRoot bundles without adding a second importer, parallel schema, public interface, or automated research system.

## Business value

Explain the measurable repository, customer, or operational value.

## Current source of truth

The checked-out repository is canonical. Identify any required current
inputs. Do not use backups, generated packages, or completed stages as
implementation sources.

## Allowed files

- `backend/data/source-preparation-workflow-v1/golden-workspace.json`
- `backend/package.json`
- `backend/src/scripts/prepare-sourceroot-workspace.ts`
- `backend/src/source-preparation/source-preparation-engine.ts`
- `backend/src/source-preparation/source-preparation-schema.ts`
- `backend/src/source-preparation/source-preparation-types.ts`
- `backend/test/source-preparation-workflow.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/REPEATABLE-SOURCE-PREPARATION-WORKFLOW-CONTRACT.md`
- `docs/build/repeatable-source-preparation-workflow-stage.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `docs/stages/active/CURRENT-STAGE.md`
- `INSTALL-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW.ps1`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

List the smallest set of current source files, contracts, and evidence needed
for this stage.

## Required behavior

Describe the behavior the stage must add or preserve.

## Protected behavior

Reference `ROOT-PROTECTED-FUNCTIONALITY.md` and list stage-specific
protections.

## Non-goals

List tempting but out-of-scope changes.

## Dependencies

List required services, tools, data, or preceding stages.

## Risks

List failure modes, compatibility boundaries, and rollback concerns.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Replace with a concrete condition.
2. Replace with a concrete condition.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`

## Manual browser checks

List exact pages, state, viewport, interaction, console, and expected result,
or state why browser verification is not applicable.

## Live API checks

List exact non-secret environment, requests, expected responses, and failure
behavior, or state why live API verification is not applicable.

## Required output

List required artifacts and completion-report evidence.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-27T12:25:50.0721264-05:00
- Verification skipped: False

### Verifier results

- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0

### Changed files

- `backend/data/source-preparation-workflow-v1/golden-workspace.json`
- `backend/package.json`
- `backend/src/scripts/prepare-sourceroot-workspace.ts`
- `backend/src/source-preparation/source-preparation-engine.ts`
- `backend/src/source-preparation/source-preparation-schema.ts`
- `backend/src/source-preparation/source-preparation-types.ts`
- `backend/test/source-preparation-workflow.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/REPEATABLE-SOURCE-PREPARATION-WORKFLOW-CONTRACT.md`
- `docs/build/repeatable-source-preparation-workflow-stage.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `docs/stages/completed/20260727-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1.md`
- `INSTALL-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW.ps1`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Implemented the deterministic SourceRoot preparation workflow, approved golden workspace, 40 focused tests, contract, verifier, and installer. No browser or live external research check applies because no customer-facing file or network workflow changed.
