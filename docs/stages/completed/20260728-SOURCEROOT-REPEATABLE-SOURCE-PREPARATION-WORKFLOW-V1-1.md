# SourceRoot Repeatable Source Preparation Workflow v1.1 â€” Lossless Context Collection Support

## Stage identity

- Name: SourceRoot Repeatable Source Preparation Workflow v1.1 â€” Lossless Context Collection Support
- Slug: SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1
- Status: active
- Started: 2026-07-28

## Objective

Extend the accepted Chunk 7 workspace schema, validation, deterministic generation, and regression coverage so the complete accepted HistoryRoot replacement bundle can be represented and regenerated losslessly without changing historical content, importer behavior, customer interfaces, or database schema.

## Business value

Removes the loss-of-data boundary that blocked preparation-workflow adoption
for the accepted HistoryRoot replacement bundle while preserving the
customer-visible data state exactly.

## Current source of truth

The checked-out repository at
`7eef6b27f5c97a3e0de82a457ca06c828f9fe3df` is canonical. The accepted
Chunk 6 bundle and Chunk 7 workspace implementation are the only data and
workflow implementation sources.

## Allowed files

- `backend/data/source-preparation-workflow-v1/lossless-context-workspace.json`
- `backend/package.json`
- `backend/src/source-preparation/source-preparation-engine.ts`
- `backend/src/source-preparation/source-preparation-schema.ts`
- `backend/src/source-preparation/source-preparation-types.ts`
- `backend/test/source-preparation-lossless-context.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/LOSSLESS-CONTEXT-COLLECTION-SUPPORT-CONTRACT.md`
- `docs/build/lossless-context-collection-support-stage.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `docs/stages/active/CURRENT-STAGE.md`
- `INSTALL-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- Accepted Chunk 6 replacement bundle with SHA-256
  `D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F`.
- Accepted Chunk 7 golden workspace and preparation types, schema, engine,
  CLI, tests, contract, and stage record.
- Existing SourceRoot validator and replacement-safe importer.
- Test database `sourceroot_test`.

## Required behavior

- Preserve schema `1.0.0` behavior and golden output bytes.
- Add schema `1.1.0` support for claim attributions, interpretations,
  perspectives, perspective links, causal links, and cultural memories.
- Validate preparation status, canonical identity, supported enums, and
  cross-collection dependencies.
- Regenerate the complete accepted Chunk 6 bundle byte-for-byte twice.
- Preserve replacement-safe and duplicate-safe import, search, and Context
  Review behavior.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected.
Stage-specific protections include the accepted Chunk 6 bundle bytes, Chunk 7
golden workspace bytes and generated hash, importer implementation, database
schema, routes, customer files, canonical IDs, attribution, evidence roles,
uncertain dates, relationships, and version history.

## Non-goals

- Chunk 8 corpus expansion or quality review.
- New historical research, extraction, rights determination, or truth score.
- Importer, migration, API, frontend, customer-content, or product changes.
- A parallel preparation system or generator.

## Dependencies

- Node.js and installed backend dependencies.
- PostgreSQL test database named exactly `sourceroot_test`.
- Accepted local Chunk 6 and Chunk 7 release artifacts.
- Windows PowerShell 5.1-compatible lifecycle and release tooling.

## Risks

- A changed serialization order would fail exact-byte reproduction.
- Missing dependency validation could allow destructive replacement import.
- Altered schema `1.0.0` behavior would invalidate the accepted Chunk 7
  release.
- Any database target other than `sourceroot_test` is prohibited.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Schema `1.0.0`, its golden workspace, 40-case suite, and generated hash
   remain unchanged.
2. Schema `1.1.0` exposes and validates all six missing collections.
3. Two independent generations exactly equal each other and the accepted
   493,760-byte Chunk 6 bundle.
4. The 50-case maintenance suite and 30-case foundational suite pass.
5. Existing importer, replacement reimport, search, and Context Review
   preserve the accepted data state.
6. No importer, migration, route, frontend, or accepted corpus file changes.
7. Required verifiers report zero warnings and zero failures.

## Required verifier

- `VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1`

## Manual browser checks

Not applicable. This maintenance stage changes no customer-facing file or
accepted customer data state, so no browser-visible difference or browser
certification is claimed.

## Live API checks

Database-backed tests use only `sourceroot_test` and exercise the existing
importer, search route, and Context Review route through the application.
No external API or network access is permitted.

## Required output

- Updated preparation types, schema, and engine.
- Human-readable lossless workspace and focused maintenance tests.
- Permanent contract, stage record, state documents, installer, verifier,
  completed lifecycle record, package folder, and ZIP.
- Exact hashes, byte lengths, test counts, importer evidence, replay evidence,
  backup path, installation record, and confirmation of unchanged customer
  files and data.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-28T08:35:35.5955932-05:00
- Verification skipped: False

### Verifier results

- VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1 -> exit 0

### Changed files

- `backend/data/source-preparation-workflow-v1/lossless-context-workspace.json`
- `backend/package.json`
- `backend/src/source-preparation/source-preparation-engine.ts`
- `backend/src/source-preparation/source-preparation-schema.ts`
- `backend/src/source-preparation/source-preparation-types.ts`
- `backend/test/source-preparation-lossless-context.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/LOSSLESS-CONTEXT-COLLECTION-SUPPORT-CONTRACT.md`
- `docs/build/lossless-context-collection-support-stage.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `docs/stages/completed/20260728-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.md`
- `INSTALL-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Schema 1.1.0 adds lossless support for six accepted contextual collection families while preserving schema 1.0.0 bytes and exact accepted Chunk 6 bundle reproduction. Final package, installer, regression, baselines, and immutable replay follow after stage completion.
