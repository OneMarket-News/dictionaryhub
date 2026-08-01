# BibleRoot Translation Comparison v1

## Stage identity

- Name: BibleRoot Translation Comparison v1
- Slug: BIBLEROOT-TRANSLATION-COMPARISON-V1
- Status: active
- Started: 2026-08-01

## Objective

Build a source-verifiable, non-interpretive four-edition comparison experience for the 110 accepted BibleRoot canonical verses.

## Business value

Customers can compare exact public-domain wording across four editions while
moving from each displayed text to its edition, artifact, checksum, rights,
dataset, and canonical verse evidence without receiving interpretation or a
translation-quality ranking.

## Current source of truth

The checked-out repository at
`8661c2948b340458b8f1ab933a4e553614ff163e` is canonical. Required inputs are
the released BibleRoot Foundation, Original Language Foundation, and Local
Development Runtime checkpoints plus exact eBible.org USFM archives acquired
for this stage. No backup, package, or historical snapshot is an
implementation source.

## Allowed files

- `assets/css/bibleroot-compare.css`
- `assets/js/bibleroot-api.js`
- `assets/js/bibleroot-compare.js`
- `backend/data/bibleroot-translation-comparison-v1/dataset-manifest.json`
- `backend/data/bibleroot-translation-comparison-v1/hashes.json`
- `backend/data/bibleroot-translation-comparison-v1/IMPORT-NOTES.md`
- `backend/data/bibleroot-translation-comparison-v1/normalized/asv.json`
- `backend/data/bibleroot-translation-comparison-v1/normalized/web.json`
- `backend/data/bibleroot-translation-comparison-v1/normalized/ylt.json`
- `backend/data/bibleroot-translation-comparison-v1/raw/eng-asv_usfm.zip`
- `backend/data/bibleroot-translation-comparison-v1/raw/engwebp_usfm.zip`
- `backend/data/bibleroot-translation-comparison-v1/raw/engylt_usfm.zip`
- `backend/data/bibleroot-translation-comparison-v1/rights-metadata.json`
- `backend/data/bibleroot-translation-comparison-v1/source-docs/details-eng-asv.html`
- `backend/data/bibleroot-translation-comparison-v1/source-docs/details-engwebp.html`
- `backend/data/bibleroot-translation-comparison-v1/source-docs/details-engylt.html`
- `backend/data/bibleroot-translation-comparison-v1/source-docs/ebible-public-domain.html`
- `backend/data/bibleroot-translation-comparison-v1/source-metadata.json`
- `backend/package.json`
- `backend/src/bibleroot/translation-comparison.ts`
- `backend/src/routes/bibleroot.ts`
- `backend/src/scripts/development-runtime.ts`
- `backend/src/scripts/import-bibleroot-translation-comparison.ts`
- `backend/src/scripts/prepare-bibleroot-translation-comparison.ts`
- `backend/src/services/bibleroot-store.ts`
- `backend/src/services/development-runtime-readiness.ts`
- `backend/test/bibleroot-foundation.test.ts`
- `backend/test/bibleroot-translation-comparison.test.ts`
- `bibleroot.html`
- `bibleroot-compare.html`
- `bibleroot-passage.html`
- `docs/architecture/BIBLEROOT-TRANSLATION-COMPARISON-ARCHITECTURE.md`
- `docs/build/BIBLEROOT-TRANSLATION-COMPARISON-BROWSER-EVIDENCE.md`
- `docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260801-BIBLEROOT-TRANSLATION-COMPARISON-V1.md`
- `ROOT-MANIFEST.json`
- `verification/bibleroot-translation-comparison.test.cjs`
- `verification/bibleroot-translation-comparison-desktop.png`
- `verification/bibleroot-translation-comparison-mobile.png`
- `VERIFY-BIBLEROOT-TRANSLATION-COMPARISON.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- Migrations 015 and 016 and the existing canonical verse/edition model.
- Released KJV rows and immutable Project Gutenberg artifact.
- Released Original Language mappings and protected artifacts.
- Existing BibleRoot route, store, frontend, and runtime readiness patterns.
- Exact ASV, WEB, and YLT public-domain USFM archives and captured rights pages.

## Required behavior

- Preserve KJV and all prior Root datasets unchanged.
- Deterministically prepare 110 verses for each of three new accepted editions.
- Import 330 new verse texts transactionally and idempotently without migration 017.
- Expose four-edition metadata and synchronized read-only comparison APIs.
- Provide provenance, rights, checksum, dataset, mechanical highlighting, and
  Original Language passage access in an accessible responsive page.
- Report separate `translationComparisonReady` without redefining Foundation readiness.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md`, especially live APIs,
source identity, shared navigation, URL state, loading/offline states,
accessibility, responsive behavior, original-language boundaries, and the
prohibition on static fallback knowledge data. Stage-specific protections are
the accepted KJV/Gutenberg identities, all Chunk 13A artifacts and mappings,
and the no-commentary/no-ranking/no-inferred-alignment boundary.

## Non-goals

Copyrighted modern translations, full-Bible comparison, commentary,
interpretation provenance, theology, translation-quality claims, semantic
scores, glosses, word alignment, morphology judgments, migration 017/018,
installers, packages, ZIP releases, and Git history operations.

## Dependencies

Node.js 22+, local PostgreSQL test/development databases, frontend port 5500,
backend port 3000, migrations 001–016, the three preceding released
checkpoints, and browser acceptance tooling.

## Risks

Artifact drift, imprecise edition identity, rights overstatement, USFM marker
leakage, verse-number mismatch, KJV duplication, partial import, misleading
highlighting, hidden API failure, mobile overflow, and lifecycle scope drift.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Exact accepted artifacts and deterministic normalized outputs validate;
   four editions expose 110 canonical positions each, with 330 new verse rows.
2. Importer safety/idempotency/rollback, readiness, APIs, frontend, prior
   BibleRoot/runtime regressions, desktop/mobile browser acceptance, active and
   inactive verifiers, scope, and empty-index checks pass with no unresolved
   manual checks.

## Required verifier

- `VERIFY-BIBLEROOT-TRANSLATION-COMPARISON.ps1`

## Manual browser checks

On `bibleroot-compare.html` against the local provisioned API, exercise all
four references, all four editions, selection and highlight controls,
provenance/rights dialog, Original Language links, URL state, keyboard focus,
1280×720 and 390×844 layout, horizontal overflow, console errors/warnings, and
API-offline behavior. Capture one desktop and one mobile screenshot.

## Live API checks

Against local development port 3000, call `/translations` and `/comparison`
for Genesis 1, Psalm 23, Ecclesiastes 3, and John 1 with all accepted edition
IDs. Verify 31, 6, 22, and 51 ordered rows, exact metadata, structured invalid
requests, and an honest awaiting-data contract. Do not expose database URLs.

## Required output

Three exact raw archives, captured source documents, normalized editions,
manifests/hashes/rights metadata, preparation/import code, readiness and API
integration, focused backend/frontend tests, comparison HTML/JS/CSS, two
navigation entry points, architecture/runbook/browser evidence, focused
verifier, completed stage record, and the 50-item final evidence report.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-08-01T13:30:22.4481377-05:00
- Verification skipped: False

### Verifier results

- VERIFY-BIBLEROOT-TRANSLATION-COMPARISON.ps1 -> exit 0

### Changed files

- `assets/css/bibleroot-compare.css`
- `assets/js/bibleroot-api.js`
- `assets/js/bibleroot-compare.js`
- `backend/data/bibleroot-translation-comparison-v1/dataset-manifest.json`
- `backend/data/bibleroot-translation-comparison-v1/hashes.json`
- `backend/data/bibleroot-translation-comparison-v1/IMPORT-NOTES.md`
- `backend/data/bibleroot-translation-comparison-v1/normalized/asv.json`
- `backend/data/bibleroot-translation-comparison-v1/normalized/web.json`
- `backend/data/bibleroot-translation-comparison-v1/normalized/ylt.json`
- `backend/data/bibleroot-translation-comparison-v1/raw/eng-asv_usfm.zip`
- `backend/data/bibleroot-translation-comparison-v1/raw/engwebp_usfm.zip`
- `backend/data/bibleroot-translation-comparison-v1/raw/engylt_usfm.zip`
- `backend/data/bibleroot-translation-comparison-v1/rights-metadata.json`
- `backend/data/bibleroot-translation-comparison-v1/source-docs/details-eng-asv.html`
- `backend/data/bibleroot-translation-comparison-v1/source-docs/details-engwebp.html`
- `backend/data/bibleroot-translation-comparison-v1/source-docs/details-engylt.html`
- `backend/data/bibleroot-translation-comparison-v1/source-docs/ebible-public-domain.html`
- `backend/data/bibleroot-translation-comparison-v1/source-metadata.json`
- `backend/package.json`
- `backend/src/bibleroot/translation-comparison.ts`
- `backend/src/routes/bibleroot.ts`
- `backend/src/scripts/development-runtime.ts`
- `backend/src/scripts/import-bibleroot-translation-comparison.ts`
- `backend/src/scripts/prepare-bibleroot-translation-comparison.ts`
- `backend/src/services/bibleroot-store.ts`
- `backend/src/services/development-runtime-readiness.ts`
- `backend/test/bibleroot-foundation.test.ts`
- `backend/test/bibleroot-translation-comparison.test.ts`
- `bibleroot.html`
- `bibleroot-compare.html`
- `bibleroot-passage.html`
- `docs/architecture/BIBLEROOT-TRANSLATION-COMPARISON-ARCHITECTURE.md`
- `docs/build/BIBLEROOT-TRANSLATION-COMPARISON-BROWSER-EVIDENCE.md`
- `docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md`
- `docs/stages/completed/20260801-BIBLEROOT-TRANSLATION-COMPARISON-V1.md`
- `ROOT-MANIFEST.json`
- `VERIFY-BIBLEROOT-TRANSLATION-COMPARISON.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Chunk 13B implemented with exact public-domain artifacts, deterministic preparation and import, four-edition APIs/UI, local-development readiness, active-state verification, and completed desktop/mobile browser acceptance with no unresolved manual checks.
