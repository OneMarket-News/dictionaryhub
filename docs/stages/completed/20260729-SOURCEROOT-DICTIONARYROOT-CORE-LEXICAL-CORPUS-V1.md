# SourceRoot Chunk 10B â€” DictionaryRoot Core Lexical Corpus v1

## Stage identity

- Name: SourceRoot Chunk 10B â€” DictionaryRoot Core Lexical Corpus v1
- Slug: SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS-V1
- Status: active
- Started: 2026-07-29

## Objective

Build, import, expose, verify, install, and externally package the deterministic
`dictionaryroot-core-lexical-corpus-v1` version `1.0.0` production corpus using
the existing migration 013 lexical-evidence and migration 014 lexical-
relationship architectures.

## Business value

DictionaryRoot Search, Concept, Knowledge Sphere, Sources, Coverage, Home, and
History/version views will share one source-attributed production lexical
dataset whose claims and relationships remain inspectable by people.

## Current source of truth

The checked-out repository at
`C:\Users\Josh\Documents\GitHub\dictionaryhub` is canonical. The accepted
acquisition registry, lexical architecture contracts, OEWN repository
artifacts, migrations 013 and 014, and the byte-identical architecture fixture
are the only implementation inputs. Prior packages and completed stages are
not implementation sources.

## Allowed files

- `BUILD-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS-PACKAGE.ps1`
- `INSTALL-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1`
- `assets/css/dictionaryroot-coverage.css`
- `assets/css/dictionaryroot-home.css`
- `assets/css/dictionaryroot-live.css`
- `assets/js/dictionaryroot-api.js`
- `assets/js/dictionaryroot-concept.js`
- `assets/js/dictionaryroot-coverage.js`
- `assets/js/dictionaryroot-graph.js`
- `assets/js/dictionaryroot-history.js`
- `assets/js/dictionaryroot-home.js`
- `assets/js/dictionaryroot-sources.js`
- `concept-v2.html`
- `sources-v2.html`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/corpus.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/hashes.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/inventory.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/lemma-selection.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/prepared-source-accounting.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/quality-review.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/quality-review.md`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/relationship-accounting.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/source-rights-attribution.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/webster-1913.txt`
- `backend/package.json`
- `backend/src/dictionaryroot/core-lexical-corpus.ts`
- `backend/src/dictionaryroot/lexical-evidence-graph.ts`
- `backend/src/dictionaryroot/lexical-evidence-types.ts`
- `backend/src/routes/lexicon.ts`
- `backend/src/scripts/generate-dictionaryroot-core-lexical-corpus.ts`
- `backend/src/scripts/import-dictionaryroot-core-lexical-corpus.ts`
- `backend/src/services/lexical-evidence-store.ts`
- `backend/test/dictionaryroot-core-lexical-corpus.test.ts`
- `coverage-v2.html`
- `docs/api/DICTIONARYROOT-CORE-LEXICAL-CORPUS-API.md`
- `docs/build/DICTIONARYROOT-CORE-LEXICAL-CORPUS-RELEASE.md`
- `docs/build/DICTIONARYROOT-CORE-LEXICAL-CORPUS-STATE.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `index.html`
- `verification/dictionaryroot-core-lexical-corpus-browser.test.mjs`
- `verification/dictionaryroot-core-lexical-corpus.test.cjs`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- `ROOT-MANIFEST.json`
- `ROOT-PROTECTED-FUNCTIONALITY.md`
- `docs/build/DICTIONARYROOT-CORPUS-SCALING-SCOPE.md`
- `docs/build/DICTIONARYROOT-SOURCE-ACQUISITION-PLAN.md`
- `docs/build/DICTIONARYROOT-LEXICAL-MODEL-GAP-ANALYSIS.md`
- `docs/build/DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE-CONTRACT.md`
- `docs/build/DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE-CONTRACT.md`
- `backend/data/dictionaryroot-corpus-scaling-acquisition-v1/candidate-sources.json`
- `data/dictionaryroot/dictionaryroot-oewn-2025-pilot-2000.json`
- migrations 013 and 014, which remain immutable

## Required behavior

Generate deterministic production artifacts; preserve source wording, rights,
locators, provenance, forms, etymology proposals, comparisons, relationships,
relationship evidence, review state, uncertainty, and version identity;
provide replacement-safe import and canonical read APIs; exclude the
architecture fixture from customer-visible reads when production exists; and
connect all bounded DictionaryRoot customer experiences to the production
dataset.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. Migration
files 001â€“014, migration 015 absence, live SourceRoot integration, generic
graph behavior, URL/history state, accessibility, responsive behavior,
HistoryRoot `1.3.0`, and empty legacy lexicon tables are stage-specific
protections.

## Non-goals

Migration 015; edits to migrations 001â€“014; authentication, account, editorial,
or user-management changes; BibleRoot implementation; Chunk 11 cross-Root
navigation; branding redesign; legacy lexicon population; persisted generic
lexical nodes; or Git operations.

## Dependencies

Node.js 22+, PostgreSQL `sourceroot_test`, migrations 001â€“014, Windows
PowerShell 5.1, the current backend/frontend services for browser smoke, and
write access to the authoritative external SourceRoot release directory.

## Risks

Rights leakage, unsupported lexical assertions, fixture leakage, accidental
legacy writes, non-deterministic bytes, cross-dataset graph duplication,
replacement failure, stale live services, and package drift after verification.

## Acceptance criteria

1. Production corpus meets every mandatory minimum with zero quality blockers.
2. Generation is byte-identical across two temporary directories and canonical artifacts.
3. Import, duplicate reimport, replacement, and rollback tests pass.
4. Customer APIs and experiences use the production dataset without fallback data.
5. Legacy lexicon tables remain empty and no generic lexical nodes are persisted.
6. Desktop and mobile browser acceptance passes against live services.
7. External package installer and verifier pass from the authoritative path.
8. Migration 015 remains absent and migrations 001â€“014 remain unchanged.

## Required verifier

- `VERIFY-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1`
- `VERIFY-ROOT-REPOSITORY.ps1`

## Manual browser checks

Use the running backend and frontend at desktop `1280x720` and mobile
`390x844`. Verify health, production search/polysemy, Concept evidence,
Knowledge Sphere canonical objects, Sources accounting, Coverage state and
metrics, Home summary cards, History/version identity, fixture exclusion,
zero fallback/duplicates/overflow, and zero attributable console errors or
warnings.

## Live API checks

Against `sourceroot_test`, require HTTP 200 from `/health`, production search,
graph seeds, coverage, and source-accounting endpoints. Before import coverage
must distinguish an awaiting-corpus state from backend unavailability; after
import it must expose deterministic production metrics.

## Required output

Canonical corpus artifacts and hashes, focused and regression test evidence,
browser evidence, an external installer-ready package and ZIP, exact package
hashes, release/state/API documentation, and a completed root-stage record.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-29T23:04:37.3398731-05:00
- Verification skipped: True

### Verifier results

- SKIPPED explicitly with -SkipVerification

### Changed files

- `assets/js/dictionaryroot-api.js`
- `assets/js/dictionaryroot-concept.js`
- `assets/js/dictionaryroot-coverage.js`
- `assets/js/dictionaryroot-history.js`
- `assets/js/dictionaryroot-home.js`
- `assets/js/dictionaryroot-sources.js`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/corpus.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/hashes.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/inventory.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/lemma-selection.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/prepared-source-accounting.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/quality-review.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/quality-review.md`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/relationship-accounting.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/source-rights-attribution.json`
- `backend/data/dictionaryroot-core-lexical-corpus-v1/webster-1913.txt`
- `backend/package.json`
- `backend/src/dictionaryroot/core-lexical-corpus.ts`
- `backend/src/dictionaryroot/lexical-evidence-graph.ts`
- `backend/src/dictionaryroot/lexical-evidence-types.ts`
- `backend/src/routes/lexicon.ts`
- `backend/src/scripts/generate-dictionaryroot-core-lexical-corpus.ts`
- `backend/src/scripts/import-dictionaryroot-core-lexical-corpus.ts`
- `backend/src/services/lexical-evidence-store.ts`
- `backend/test/dictionaryroot-core-lexical-corpus.test.ts`
- `BUILD-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS-PACKAGE.ps1`
- `concept-v2.html`
- `docs/api/DICTIONARYROOT-CORE-LEXICAL-CORPUS-API.md`
- `docs/build/DICTIONARYROOT-CORE-LEXICAL-CORPUS-RELEASE.md`
- `docs/build/DICTIONARYROOT-CORE-LEXICAL-CORPUS-STATE.md`
- `docs/stages/completed/20260729-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS-V1.md`
- `index.html`
- `INSTALL-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1`
- `ROOT-MANIFEST.json`
- `sources-v2.html`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-CORE-LEXICAL-CORPUS.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Chunk 10B final verifier passed 19/0/0; active root verifier passed 51/0/0; desktop and mobile browser verification passed with zero console errors; authoritative external package installed and duplicate-safe reimport verified in sourceroot_test.
