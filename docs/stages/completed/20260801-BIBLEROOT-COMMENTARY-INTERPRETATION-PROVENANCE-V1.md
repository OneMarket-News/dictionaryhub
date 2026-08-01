# BibleRoot Commentary and Interpretation Provenance v1

## Stage identity

- Name: BibleRoot Commentary and Interpretation Provenance v1
- Slug: BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-V1
- Status: active
- Started: 2026-08-01

## Objective

Build a source-verifiable, attributed historical-commentary layer for the four accepted BibleRoot passages without SourceRoot endorsement, reconciliation, ranking, theological judgment, or generated interpretation.

## Business value

Customers can inspect historical commentary beside a shared canonical passage
while retaining named attribution, exact edition, immutable artifact, locator,
statement offsets, checksum, rights, and dataset evidence. Commentary is
attributed source content; every interpretation statement is source-authored.
SourceRoot does not endorse, reconcile, rank, or decide theological truth.
Different interpretations may coexist. Absence is not evidence against a view,
and corpus inclusion is not a quality ranking.

## Current source of truth

The checked-out repository at
`5c81eeec2cc5d38799179c90000cdd158f80e26d` is canonical. Inputs are the
released BibleRoot Foundation, Original Language, Translation Comparison, and
local-development runtime records plus exact CrossWire MHC 2.2 and JFB 3.0
artifacts acquired for this stage. No backup, generated package, completed
stage, or other snapshot is an implementation source.

## Allowed files

- `assets/css/bibleroot-commentary.css`
- `assets/js/bibleroot-api.js`
- `assets/js/bibleroot-commentary.js`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/ACQUISITION-NOTES.md`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/dataset-manifest.json`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/hashes.json`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/IMPORT-NOTES.md`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/normalized/jfb.json`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/normalized/mhc.json`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/PREPARATION-NOTES.md`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/raw/JFB.zip`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/raw/MHC.zip`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/REJECTED-SOURCES.md`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/rights-metadata.json`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/source-docs/crosswire-jfb-module.html`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/source-docs/crosswire-mhc-module.html`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/source-docs/crosswire-rawzip-index.html`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/source-metadata.json`
- `backend/db/migrations/017_create_bibleroot_commentary_provenance.sql`
- `backend/package.json`
- `backend/src/bibleroot/commentary-provenance.ts`
- `backend/src/lib/local-development-database.ts`
- `backend/src/routes/bibleroot.ts`
- `backend/src/scripts/development-runtime.ts`
- `backend/src/scripts/import-bibleroot-commentary-provenance.ts`
- `backend/src/scripts/prepare-bibleroot-commentary-provenance.ts`
- `backend/src/services/bibleroot-store.ts`
- `backend/src/services/development-runtime-readiness.ts`
- `backend/test/bibleroot-commentary-provenance.test.ts`
- `backend/test/bibleroot-translation-comparison.test.ts`
- `backend/test/local-development-runtime.test.ts`
- `bibleroot.html`
- `bibleroot-commentary.html`
- `bibleroot-compare.html`
- `bibleroot-passage.html`
- `docs/architecture/BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-ARCHITECTURE.md`
- `docs/build/BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-BROWSER-EVIDENCE.md`
- `docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260801-BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-V1.md`
- `ROOT-MANIFEST.json`
- `verification/bibleroot-commentary-desktop.png`
- `verification/bibleroot-commentary-mobile.png`
- `verification/bibleroot-commentary-provenance.test.cjs`
- `VERIFY-BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- Migrations 015 and 016, the accepted 110 canonical verses, existing source
  publication/artifact infrastructure, and rights components.
- Released KJV, Original Language, and Translation Comparison datasets.
- Exact CrossWire MHC 2.2 and JFB 3.0 archives, module pages, and raw ZIP index.
- Current BibleRoot route/store/client/page and local runtime safety patterns.

## Required behavior

- Migration 017 adds only commentary works, full source sections, canonical
  anchors, and exact source-authored statements.
- Preparation is offline, deterministic, retains exact OSIS slices and source
  scope, and records zero-length source entries as coverage gaps.
- Import is test-only by default, transaction-safe, idempotent, and authorized
  for local development only through the released safety token.
- APIs and UI expose source-authored text and provenance without summaries,
  rankings, agreement inference, doctrine classification, or word alignment.
- Readiness adds `commentaryProvenanceReady` while preserving prior meanings.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md`. Stage-specific protections
are exact Foundation/Original Language/Translation Comparison artifacts and
rows, canonical anchor scope, statement offsets, source/rights identities,
shared navigation, honest unavailable states, and the no-static-fallback,
no-endorsement, no-ranking, no-inference boundary.

## Non-goals

Full-Bible commentary, John Gill without verified transcription rights,
commercial study notes, modern copyrighted notes, theology tables, truth or
quality rankings, agreement/disagreement inference, AI commentary or summary,
belief recommendations, semantic scoring, translation or morphology alignment,
migration 018, Chunk 14, installers, release ZIPs, and Git history operations.

## Dependencies

Node.js 22+, local PostgreSQL test/development databases, migrations 001-017,
the four preceding released runtime layers, static frontend service, backend
port 3000, frontend port 5500, and browser acceptance tooling.

## Risks

Artifact drift, public-domain overstatement, OSIS loss, false verse narrowing,
sentence-offset drift, partial replacement, hidden fallback text, misleading
theological presentation, large response rendering, mobile overflow, and stage
scope drift. All artifact, anchor, offset, import, and UI boundaries fail closed.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Exact accepted artifacts deterministically produce two works, 96 sections,
   3,450 statements, 96 anchors, and 14 explicit coverage-gap ranges across the
   four bounded passages.
2. Migration/import/readiness/APIs/frontend, all prior Root regressions, active
   and inactive verifiers, local API/browser acceptance, responsive and
   unavailable states, protected identities, scope, and empty index pass with
   no unresolved manual checks.

## Required verifier

- `VERIFY-BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE.ps1`

## Manual browser checks

On `bibleroot-commentary.html` against the local provisioned API, exercise all
four references, both works, gap display, statement navigation, work/section
provenance dialogs, rights and cross-layer links, URL state, keyboard focus,
1280x720 and 390x844 layout, horizontal overflow, console output, and genuine
API-unavailable behavior. Capture one desktop and one mobile screenshot.

## Live API checks

Against local development port 3000, call `/commentaries` and `/commentary` for
Genesis 1, Psalm 23, Ecclesiastes 3, and John 1 with both accepted work IDs.
Verify ordered sections/statements, provenance, rights, gaps, structured invalid
requests, and honest awaiting-data semantics without exposing database URLs.

## Required output

Two exact raw archives, three captured evidence pages, two normalized work
files, manifests/hashes/rights and acquisition notes, migration 017,
preparation/import/runtime/API integration, focused backend/frontend tests,
commentary HTML/JS/CSS, four navigation entry points, architecture/runbook/
browser evidence, focused verifier, completed stage record, and the required
70-item final report.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-08-01T14:59:29.8361239-05:00
- Verification skipped: False

### Verifier results

- VERIFY-BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE.ps1 -> exit 0

### Changed files

- `assets/css/bibleroot-commentary.css`
- `assets/js/bibleroot-api.js`
- `assets/js/bibleroot-commentary.js`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/ACQUISITION-NOTES.md`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/dataset-manifest.json`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/hashes.json`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/IMPORT-NOTES.md`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/normalized/jfb.json`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/normalized/mhc.json`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/PREPARATION-NOTES.md`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/raw/JFB.zip`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/raw/MHC.zip`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/REJECTED-SOURCES.md`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/rights-metadata.json`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/source-docs/crosswire-jfb-module.html`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/source-docs/crosswire-mhc-module.html`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/source-docs/crosswire-rawzip-index.html`
- `backend/data/bibleroot-commentary-interpretation-provenance-v1/source-metadata.json`
- `backend/db/migrations/017_create_bibleroot_commentary_provenance.sql`
- `backend/package.json`
- `backend/src/bibleroot/commentary-provenance.ts`
- `backend/src/lib/local-development-database.ts`
- `backend/src/routes/bibleroot.ts`
- `backend/src/scripts/development-runtime.ts`
- `backend/src/scripts/import-bibleroot-commentary-provenance.ts`
- `backend/src/scripts/prepare-bibleroot-commentary-provenance.ts`
- `backend/src/services/bibleroot-store.ts`
- `backend/src/services/development-runtime-readiness.ts`
- `backend/test/bibleroot-commentary-provenance.test.ts`
- `backend/test/bibleroot-translation-comparison.test.ts`
- `backend/test/local-development-runtime.test.ts`
- `bibleroot.html`
- `bibleroot-commentary.html`
- `bibleroot-compare.html`
- `bibleroot-passage.html`
- `docs/architecture/BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-ARCHITECTURE.md`
- `docs/build/BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-BROWSER-EVIDENCE.md`
- `docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md`
- `docs/stages/completed/20260801-BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE-V1.md`
- `ROOT-MANIFEST.json`
- `VERIFY-BIBLEROOT-COMMENTARY-INTERPRETATION-PROVENANCE.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Chunk 13C implementation, deterministic corpus, local provisioning, live API/browser acceptance, responsive screenshots, and active-state verification completed with no unresolved manual checks.
