# SourceRoot Chunk 8 â€” HistoryRoot Corpus Expansion and Quality Review v1

## Stage identity

- Name: SourceRoot Chunk 8 â€” HistoryRoot Corpus Expansion and Quality Review v1
- Slug: SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY-V1
- Status: active
- Started: 2026-07-28

## Objective

Use the accepted v1.1 repeatable source-preparation workflow to promote a materially expanded subset of accepted HistoryRoot content and produce a deterministic corpus-quality review without introducing unsupported facts, truth scores, a parallel importer, database migrations, API changes, or customer-interface changes.

## Business value

Expands the reviewed HistoryRoot inventory from 8 to 116 records and from 25
to 49 claims while proving that the accepted v1.1 preparation workflow,
existing importer, search, and Context Review preserve the larger corpus.

## Current source of truth

The checked-out repository at starting commit
`95b90865abf21cefefc5c608d778327737e997ac` is canonical. Inputs are the
accepted Chunk 6 inventory, replacement-safe bundle and source register plus
the accepted v1.1 lossless workspace. Backups, packages, and older snapshots
are not implementation sources.

## Allowed files

- `backend/data/historyroot-corpus-expansion-quality-v1/corpus-inventory.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/expansion-workspace.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/historyroot-corpus-expansion-quality-v1.bundle.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/quality-review.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/quality-review.md`
- `backend/package.json`
- `backend/src/historyroot/corpus-quality-review.ts`
- `backend/src/scripts/generate-historyroot-corpus-expansion.ts`
- `backend/src/scripts/import-historyroot-corpus-expansion.ts`
- `backend/test/historyroot-corpus-expansion-quality.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/HISTORYROOT-CORPUS-EXPANSION-QUALITY-CONTRACT.md`
- `docs/build/historyroot-corpus-expansion-quality-stage.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `docs/stages/active/CURRENT-STAGE.md`
- `INSTALL-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- Accepted Chunk 6 inventory, bundle, and source register
- Accepted v1.1 lossless preparation workspace
- Existing v1.1 validator and generator
- Existing SourceRoot bundle validator and importer
- Existing search and Context Review reads
- Chunk 6, Chunk 7, and v1.1 permanent contracts and stage records

## Required behavior

- Generate the approved schema 1.1.0 workspace through accepted local material.
- Meet every mandatory expansion delta.
- Generate bundle, inventory, and quality outputs deterministically.
- Preserve all six v1.1 contextual collection families.
- Produce zero blocker findings and no composite score.
- Import twice through the existing importer into only `sourceroot_test`.
- Resolve newly promoted records and claims through existing customer reads.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. This
stage additionally protects Chunk 6 corpus bytes, Chunk 7 golden bytes, v1.1
workspace bytes, migrations 001â€“012, existing importer logic, API routes,
frontend files, accepted canonical IDs, and replacement-safe import.

## Non-goals

- External historical research, scraping, OCR, or AI extraction
- Truth, credibility, confidence, reliability, or composite quality scores
- New migrations, API routes, frontend behavior, or importer persistence logic
- Contributor workflow, production ingestion, or frontend redesign

## Dependencies

Node.js, npm, Windows PowerShell 5.1 compatibility, PostgreSQL
`sourceroot_test`, accepted local release ZIPs, the unchanged v1.1 workflow,
the accepted SourceRoot importer, and the existing local customer pages.

## Risks

Primary risks are loss of contextual dependencies, invented locator or
provenance data, rights-use conflicts, duplicate global IDs, artificial
versions, replacement import deleting unrelated data, or package path
traversal. The installer hashes every payload and backs up every replaced
destination.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Workspace schema 1.1.0 validates and generates through unchanged v1.1.
2. Expansion deltas are at least +5 records, +10 claims, +3 sources/accounts,
   +5 locators, +5 provenance, and one contextual object.
3. Bundle, inventory, JSON review, and Markdown review regenerate byte-exactly.
4. Quality review has zero blockers and no composite score.
5. Focused suite passes 73/73 and prior compatibility suites remain exact.
6. Existing importer, duplicate-safe replacement, search, and Context Review
   pass only against `sourceroot_test`.
7. No unauthorized stage path changes.

## Required verifier

- `VERIFY-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`

## Manual browser checks

After installation, load one newly promoted record, one newly promoted claim,
one supported contextual object, and existing Patuxet/Plymouth content against
the real local backend at one desktop and one narrow-mobile viewport. Verify
attribution, reporting account, locator, evidence-role separation, search,
and zero console errors.

## Live API checks

Use the local SourceRoot API backed by exactly `sourceroot_test`. Search must
find newly promoted records and claims; three promoted claim IDs must return
Context Review payloads with attribution, locators, and provenance. No
production or development database is permitted.

## Required output

Workspace, generated bundle, corpus inventory, quality JSON and Markdown,
quality-review engine, generation and delegating import scripts, 73-test
suite, permanent contract, stage record, installer, verifier, completed
root-stage record, package folder, ZIP, hashes, installer backup and record,
full regression evidence, immutable replay, and browser smoke evidence.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-28T10:00:20.8569936-05:00
- Verification skipped: False

### Verifier results

- VERIFY-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1 -> exit 0

### Changed files

- `backend/data/historyroot-corpus-expansion-quality-v1/corpus-inventory.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/expansion-workspace.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/historyroot-corpus-expansion-quality-v1.bundle.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/quality-review.json`
- `backend/data/historyroot-corpus-expansion-quality-v1/quality-review.md`
- `backend/package.json`
- `backend/src/historyroot/corpus-quality-review.ts`
- `backend/src/scripts/generate-historyroot-corpus-expansion.ts`
- `backend/src/scripts/import-historyroot-corpus-expansion.ts`
- `backend/test/historyroot-corpus-expansion-quality.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/HISTORYROOT-CORPUS-EXPANSION-QUALITY-CONTRACT.md`
- `docs/build/historyroot-corpus-expansion-quality-stage.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `docs/stages/completed/20260728-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY-V1.md`
- `INSTALL-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Chunk 8 implementation completed with deterministic generation, zero quality blockers, focused 73/73 tests, active-stage scope enforcement, and no Git history operation. Package, installer, final regression, immutable replay, and browser smoke proceed in the documented inactive-stage acceptance phase.
