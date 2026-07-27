# {{STAGE_NAME}}

## Stage identity

- Name: {{STAGE_NAME}}
- Slug: {{STAGE_SLUG}}
- Status: active
- Started: {{DATE}}

## Objective

{{OBJECTIVE}}

## Business value

Explain the measurable repository, customer, or operational value.

## Current source of truth

The checked-out repository is canonical. Identify any required current
inputs. Do not use backups, generated packages, or completed stages as
implementation sources.

## Allowed files

{{ALLOWED_FILES}}

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

{{REQUIRED_VERIFIERS}}

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
