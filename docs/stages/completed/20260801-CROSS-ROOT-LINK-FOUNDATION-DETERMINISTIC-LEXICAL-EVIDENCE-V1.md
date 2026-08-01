# Cross-Root Link Foundation and Deterministic Lexical Evidence v1

## Stage identity

- Name: Cross-Root Link Foundation and Deterministic Lexical Evidence v1
- Slug: CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-V1
- Status: active
- Started: 2026-08-01

## Objective

Establish typed, evidence-bearing cross-Root resources and deterministic exact lexical observations between accepted DictionaryRoot lemmas and bounded public HistoryRoot and BibleRoot English text without sense, equivalence, influence, significance, or causation inference.

## Business value

Customers can verify exact wording shared by a DictionaryRoot lemma and a
released BibleRoot or HistoryRoot record while seeing the original surface,
field, offsets, context, source versions, algorithm, and review boundary. The
experience prevents textual overlap from being presented as shared meaning.

## Current source of truth

The checked-out repository at
`a4964dcf2ea1d4a330be8887fe189f2475782612` is canonical. Inputs are the
released DictionaryRoot core lexical corpus, HistoryRoot 1.3.0 bundle,
BibleRoot Foundation, and Translation Comparison normalized datasets. No
backup, archive, mutable development database, or completed-stage output is an
implementation source.

## Allowed files

- `assets/css/cross-root-links.css`
- `assets/js/bibleroot-passage.js`
- `assets/js/cross-root-api.js`
- `assets/js/cross-root-links.js`
- `assets/js/dictionaryroot-concept.js`
- `assets/js/historyroot-record.js`
- `backend/data/cross-root-link-foundation-v1/BUILD-NOTES.md`
- `backend/data/cross-root-link-foundation-v1/COVERAGE.md`
- `backend/data/cross-root-link-foundation-v1/dataset-manifest.json`
- `backend/data/cross-root-link-foundation-v1/evidence.json`
- `backend/data/cross-root-link-foundation-v1/hashes.json`
- `backend/data/cross-root-link-foundation-v1/input-fingerprints.json`
- `backend/data/cross-root-link-foundation-v1/links.json`
- `backend/data/cross-root-link-foundation-v1/MATCHING-RULES.md`
- `backend/data/cross-root-link-foundation-v1/resource-registry.json`
- `backend/db/migrations/018_create_cross_root_link_foundation.sql`
- `backend/package.json`
- `backend/src/app.ts`
- `backend/src/cross-root/lexical-evidence.ts`
- `backend/src/lib/local-development-database.ts`
- `backend/src/routes/cross-root.ts`
- `backend/src/scripts/development-runtime.ts`
- `backend/src/scripts/import-cross-root-lexical-evidence.ts`
- `backend/src/scripts/prepare-cross-root-lexical-evidence.ts`
- `backend/src/services/cross-root-store.ts`
- `backend/src/services/development-runtime-readiness.ts`
- `backend/test/bibleroot-commentary-provenance.test.ts`
- `backend/test/cross-root-lexical-evidence.test.ts`
- `backend/test/local-development-runtime.test.ts`
- `bibleroot-passage.html`
- `concept-v2.html`
- `cross-root-links.html`
- `docs/architecture/CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-ARCHITECTURE.md`
- `docs/build/CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-BROWSER-EVIDENCE.md`
- `docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260801-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-V1.md`
- `history-record-v1.html`
- `ROOT-MANIFEST.json`
- `verification/cross-root-link-foundation.test.cjs`
- `verification/cross-root-links-desktop.png`
- `verification/cross-root-links-mobile.png`
- `VERIFY-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- The accepted 500-lemma DictionaryRoot core corpus.
- The released 1.3.0 HistoryRoot bundle and its canonical public field model.
- BibleRoot KJV Foundation and normalized ASV, WEB, and YLT verse text for the
  four bounded chapters.
- Migrations 001-017, local-development authorization, readiness 1.2.0, live
  API conventions, and the three canonical frontend entry points.

## Required behavior

- Migration 018 adds typed resources, directional links, occurrence evidence,
  dataset fingerprints, derivation kind, review state, offsets, and hashes.
- Offline preparation is fingerprint-locked and byte deterministic.
- Import is test-only by default, locally authorized for development,
  transactional, idempotent, and validates actual Root resources.
- Read-only APIs and the dedicated UI expose evidence without fallback links
  or semantic conclusions.
- Readiness 1.3.0 adds only the top-level `crossRootLinks` capability.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md`. Stage-specific protections
include every released dataset/artifact identity, Root readiness meanings,
HistoryRoot governance, BibleRoot layer separation and rights, search ranking,
canonical URL/history behavior, live-only data, accessibility, and migration
001-017 immutability.

## Non-goals

Sense inference, semantic/entity equivalence, BibleRoot-to-HistoryRoot links,
Original Language or commentary matching, scores, embeddings, fuzzy matching,
influence, causation, significance, agreement/contradiction, Chunk 14B/14C,
migration 019, installers, release archives, and Git history operations.

## Dependencies

Node.js 22+, PostgreSQL test/local-development databases, migrations 001-018,
the released three-Root corpus, backend port 3000, existing frontend port 5500,
and browser acceptance tooling.

## Risks

Input drift, target-field drift, Unicode-boundary or offset errors, duplicate
occurrences, polymorphic integrity loss, partial replacement, false semantic
presentation, hidden fallback links, readiness regression, mobile overflow,
and scope drift. Fingerprints, exact reconstruction, database constraints,
transactions, preservation hashes, and explicit UI boundaries fail closed.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Exactly 1,568 typed resources deterministically produce 2,233 directional
   links and 2,765 reconstructable UTF-16 occurrence records from eight exact
   committed inputs.
2. Migration, preparation, import/idempotency/rollback, API, readiness,
   frontend, all prior Root regressions, active/inactive verifiers, live
   development acceptance, desktop/mobile/accessibility/unavailable behavior,
   protected identities, allowed scope, and empty index pass with no unresolved
   manual checks.

## Required verifier

- `VERIFY-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE.ps1`
- `VERIFY-ROOT-REPOSITORY.ps1`

## Manual browser checks

On `cross-root-links.html`, use canonical entry points for a lemma with both
target Roots, one Bible edition-text record, one HistoryRoot record, a
registered no-link resource, and an invalid resource. Verify evidence,
disclaimers, canonical links, URL/back-forward, keyboard focus, 1280x720 and
390x844 layouts, overflow, zero console errors/warnings, deliberate API stop,
no fallback, retry, and recovery. Capture desktop and mobile screenshots.

## Live API checks

Against authorized local development port 3000, check `/coverage` and `/links`
for DictionaryRoot, HistoryRoot, and BibleRoot typed public IDs. Verify exact
counts/evidence/order/hashes, structured invalid requests, honest awaiting or
unavailable behavior, and absence of semantic fields, stack traces, paths, and
credentials.

## Required output

Migration 018; six deterministic dataset JSON files and three explanatory
records; preparation/import/domain/store/route/runtime changes; backend and
frontend tests; dedicated HTML/JS/CSS and three narrow entry points;
architecture/runbook/browser evidence; desktop/mobile screenshots; focused
verifier; completed stage record; and the required 62-item final report.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-08-01T16:14:32.8693825-05:00
- Verification skipped: False

### Verifier results

- VERIFY-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE.ps1 -> exit 0
- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0

### Changed files

- `assets/css/cross-root-links.css`
- `assets/js/bibleroot-passage.js`
- `assets/js/cross-root-api.js`
- `assets/js/cross-root-links.js`
- `assets/js/dictionaryroot-concept.js`
- `assets/js/historyroot-record.js`
- `backend/data/cross-root-link-foundation-v1/BUILD-NOTES.md`
- `backend/data/cross-root-link-foundation-v1/COVERAGE.md`
- `backend/data/cross-root-link-foundation-v1/dataset-manifest.json`
- `backend/data/cross-root-link-foundation-v1/evidence.json`
- `backend/data/cross-root-link-foundation-v1/hashes.json`
- `backend/data/cross-root-link-foundation-v1/input-fingerprints.json`
- `backend/data/cross-root-link-foundation-v1/links.json`
- `backend/data/cross-root-link-foundation-v1/MATCHING-RULES.md`
- `backend/data/cross-root-link-foundation-v1/resource-registry.json`
- `backend/db/migrations/018_create_cross_root_link_foundation.sql`
- `backend/package.json`
- `backend/src/app.ts`
- `backend/src/cross-root/lexical-evidence.ts`
- `backend/src/lib/local-development-database.ts`
- `backend/src/routes/cross-root.ts`
- `backend/src/scripts/development-runtime.ts`
- `backend/src/scripts/import-cross-root-lexical-evidence.ts`
- `backend/src/scripts/prepare-cross-root-lexical-evidence.ts`
- `backend/src/services/cross-root-store.ts`
- `backend/src/services/development-runtime-readiness.ts`
- `backend/test/bibleroot-commentary-provenance.test.ts`
- `backend/test/cross-root-lexical-evidence.test.ts`
- `backend/test/local-development-runtime.test.ts`
- `cross-root-links.html`
- `docs/architecture/CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-ARCHITECTURE.md`
- `docs/build/CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-BROWSER-EVIDENCE.md`
- `docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md`
- `docs/stages/completed/20260801-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE-V1.md`
- `ROOT-MANIFEST.json`
- `VERIFY-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Implemented Chunk 14A cross-Root typed resource/link/evidence schema, deterministic exact lexical observation corpus, fail-closed idempotent importer, readiness/API/UI/canonical entry points, provenance documentation, and browser evidence; focused verifier and repository verifier passed.
