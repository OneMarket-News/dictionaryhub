# SourceRoot Chunk 10A â€” DictionaryRoot Lexical Evidence Architecture

## Stage identity

- Name: SourceRoot Chunk 10A â€” DictionaryRoot Lexical Evidence Architecture
- Slug: SOURCEROOT-DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE-V1
- Status: active
- Started: 2026-07-28

## Objective

Implement normalized, inspectable DictionaryRoot lexical evidence architecture, a bounded deterministic fixture, additive read APIs, and targeted customer inspection without generating the production corpus.

## Business value

DictionaryRoot can preserve exact source wording, lexical form families,
competing origins, review decisions, source locators, and field provenance
without flattening them into one definition or generating a production
corpus.

## Current source of truth

The checked-out repository is canonical. The current OEWN integration,
DictionaryRoot customer files, SourceRoot database conventions, and
HistoryRoot records are protected inputs. Backups, packages, and completed
stage snapshots are not implementation sources.

## Allowed files

- `assets/css/dictionaryroot-live.css`
- `assets/js/dictionaryroot-api.js`
- `assets/js/dictionaryroot-concept.js`
- `assets/js/dictionaryroot-home.js`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/fixture.json`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/inventory.json`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/quality-review.json`
- `backend/db/migrations/013_create_dictionaryroot_lexical_evidence.sql`
- `backend/docs/migration-plan.md`
- `backend/package.json`
- `backend/src/dictionaryroot/lexical-evidence-fixture.ts`
- `backend/src/dictionaryroot/lexical-evidence-types.ts`
- `backend/src/routes/lexicon.ts`
- `backend/src/scripts/generate-dictionaryroot-lexical-evidence-fixture.ts`
- `backend/src/scripts/import-dictionaryroot-lexical-evidence-fixture.ts`
- `backend/src/services/lexical-evidence-store.ts`
- `backend/test/dictionaryroot-lexical-evidence-architecture.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE-CONTRACT.md`
- `docs/build/dictionaryroot-lexical-evidence-architecture-stage.md`
- `docs/customers/dictionaryroot/api-contract.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `ROOT-ARCHITECTURE.md`
- `ROOT-MANIFEST.json`
- `ROOT-VERIFICATION.md`
- `verification/dictionaryroot-lexical-evidence-architecture.test.cjs`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- Existing DictionaryRoot API client, Home, Concept, and live styles.
- Existing lexicon router and database helpers.
- Current migrations 001 through 012 and `sourceroot_test`.
- `ROOT-PROTECTED-FUNCTIONALITY.md`.

## Required behavior

- Add normalized lexical evidence tables through migration 013.
- Generate only the bounded deterministic architecture fixture.
- Import only that fixture into `sourceroot_test`, replacement-safely.
- Add bounded, deterministic, read-only lexical evidence routes.
- Combine live evidence discovery with existing OEWN Home results.
- Group Concept senses by part of speech and expose all evidence families.
- Preserve explicit loading, empty, unavailable, and no-fallback states.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected.
Stage-specific protections include OEWN search and attribution, exact-meaning
ranking, URL/history state, HistoryRoot data, source identity, and the
prohibition on embedded fixture or production-corpus fallback records.

## Non-goals

- Production corpus acquisition, generation, or import.
- Automatic etymology resolution, definition merging, or truth scoring.
- New write/governance workflows.
- Changes to HistoryRoot or the OEWN import.
- Service, port, deployment, or static-server management.

## Dependencies

- Node.js 22 or later and Windows PowerShell 5.1 compatibility.
- PostgreSQL `sourceroot_test` with migrations 001 through 013.
- Manually managed backend on port 3000 and frontend on port 8010 for smoke.

## Risks

- A backend connected to a database without migration 013 or the fixture
  returns a live evidence-route failure despite a healthy `/health`.
- Evidence must not duplicate or replace OEWN meaning records.
- Failed fixture replacement must roll back atomically.
- Responsive evidence cards must not cause horizontal overflow.
- Uncertainty, competing proposals, and source distinctions must remain
  visible.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Migration 013 creates all twelve normalized tables in a fresh schema.
2. Fixture generation is byte deterministic and repository-equal.
3. Quality accounting reports zero blockers and `productionCorpusGenerated`
   false.
4. Duplicate import is stable and failed replacement rolls back.
5. Backend architecture tests pass 17/17.
6. Targeted frontend tests pass 8/8.
7. Live browser smoke passes at 1280 by 720 and 390 by 844.
8. OEWN and HistoryRoot preservation checks pass.
9. Required stage and root verifiers pass.
10. Changed-file and index accounting is clean and within `allowed_files`.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE.ps1`

## Manual browser checks

- At 1280 by 720 and 390 by 844, search `bank` from `index.html`, confirm
  multiple fixture senses and noun/verb grouping, and open a fixture sense.
- Inspect source-specific claims, locators, provenance, forms, source
  comparisons, and explicit result/empty handling.
- Open `island` and confirm competing proposals and uncertainty.
- Open an existing OEWN concept and confirm attribution and navigation.
- Open `historyroot.html` and confirm live content and responsive navigation.
- At both viewports confirm no horizontal overflow and no console warnings or
  errors.

## Live API checks

- `GET http://127.0.0.1:3000/health` returns 200.
- Evidence search for `bank` returns 3 ordered fixture senses.
- Bank finance detail returns 2 distinct claims plus forms, locators, and
  provenance.
- Island detail returns 2 separate competing proposals including uncertainty.
- Invalid pagination returns 400 and an absent resource returns an empty list.
- No credential, token, or database URL is recorded.

## Required output

- Migration, types, store, routes, deterministic fixture, inventory, and
  quality review.
- Home, Concept, API-client, and responsive-style changes.
- Customer API contract, architecture contract, current-state and stage
  reports, migration plan, root architecture, and root verification updates.
- Chunk 10A verifier output, root verifier output, browser evidence, quality
  accounting, changed-file/index evidence, and completion record.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-29T17:51:32.9588246-05:00
- Verification skipped: True

### Verifier results

- SKIPPED explicitly with -SkipVerification

### Changed files

- `assets/css/dictionaryroot-live.css`
- `assets/js/dictionaryroot-api.js`
- `assets/js/dictionaryroot-concept.js`
- `assets/js/dictionaryroot-home.js`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/fixture.json`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/inventory.json`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/quality-review.json`
- `backend/db/migrations/013_create_dictionaryroot_lexical_evidence.sql`
- `backend/docs/migration-plan.md`
- `backend/package.json`
- `backend/src/dictionaryroot/lexical-evidence-fixture.ts`
- `backend/src/dictionaryroot/lexical-evidence-types.ts`
- `backend/src/routes/lexicon.ts`
- `backend/src/scripts/generate-dictionaryroot-lexical-evidence-fixture.ts`
- `backend/src/scripts/import-dictionaryroot-lexical-evidence-fixture.ts`
- `backend/src/services/lexical-evidence-store.ts`
- `backend/test/dictionaryroot-lexical-evidence-architecture.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE-CONTRACT.md`
- `docs/build/dictionaryroot-lexical-evidence-architecture-stage.md`
- `docs/customers/dictionaryroot/api-contract.md`
- `docs/stages/completed/20260729-SOURCEROOT-DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE-V1.md`
- `ROOT-ARCHITECTURE.md`
- `ROOT-MANIFEST.json`
- `ROOT-VERIFICATION.md`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Required verifiers were executed individually before completion: Chunk 10A verifier exit 0 (10/10) and active root verifier exit 0 (51 passes, 0 warnings, 0 failures). -SkipVerification prevents repetition of completed checks. Live fixture browser smoke passed at 1280x720 and 390x844 with no overflow or page console warnings/errors. Git diff checks passed and the index was empty.
