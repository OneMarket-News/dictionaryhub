# SourceRoot DictionaryRoot Lexical Relationship Architecture v1

## Stage identity

- Name: SourceRoot DictionaryRoot Lexical Relationship Architecture v1
- Slug: SOURCEROOT-DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE-V1
- Status: active
- Started: 2026-07-29

## Objective

Implement canonical, sourced sense-to-sense lexical relationships, bounded read-only graph APIs, and targeted Knowledge Sphere integration without generating or importing a production corpus.

## Business value

DictionaryRoot gains a single durable identity for each sourced sense-to-sense
relationship, with independently inspectable evidence and a read-only graph
projection. Customers can explore lexical relationships without collapsing
distinct senses or creating a parallel generic-node model.

## Current source of truth

The checked-out repository at starting commit
`4ee8f392ab676eb8f47b3af1bcd9680b9ffea60d` is canonical. Migration 013,
the current lexical-evidence fixture, its importer and read APIs, and the
existing Knowledge Sphere are the implementation inputs. Backups, packages,
completed stages, and other repository snapshots are not implementation
sources.

## Allowed files

- `assets/js/dictionaryroot-api.js`
- `assets/js/dictionaryroot-graph.js`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/fixture.json`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/inventory.json`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/quality-review.json`
- `backend/db/migrations/014_create_dictionaryroot_lexical_relationships.sql`
- `backend/docs/migration-plan.md`
- `backend/package.json`
- `backend/src/dictionaryroot/lexical-evidence-fixture.ts`
- `backend/src/dictionaryroot/lexical-evidence-graph.ts`
- `backend/src/dictionaryroot/lexical-evidence-types.ts`
- `backend/src/routes/lexicon.ts`
- `backend/src/scripts/generate-dictionaryroot-lexical-evidence-fixture.ts`
- `backend/src/scripts/import-dictionaryroot-lexical-evidence-fixture.ts`
- `backend/src/services/lexical-evidence-store.ts`
- `backend/test/dictionaryroot-lexical-evidence-architecture.test.ts`
- `backend/test/dictionaryroot-lexical-relationship-architecture.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE-CONTRACT.md`
- `docs/build/dictionaryroot-lexical-relationship-architecture-stage.md`
- `docs/customers/dictionaryroot/api-contract.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `ROOT-ARCHITECTURE.md`
- `ROOT-MANIFEST.json`
- `ROOT-VERIFICATION.md`
- `verification/dictionaryroot-lexical-relationship-architecture.test.cjs`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- Migration 013 lexical-evidence identities and constraints.
- Current fixture types, generator, importer, store, routes, and generated
  artifacts.
- Existing DictionaryRoot API client and Knowledge Sphere.
- `ROOT-PROTECTED-FUNCTIONALITY.md`.
- PostgreSQL `sourceroot_test` ending at migration 013.

## Required behavior

- Add migration 014 with canonical relationships and separate evidence.
- Canonicalize symmetric endpoints deterministically and reject self-links and
  inverse duplicates.
- Extend only the bounded fixture with deterministic, sourced or explicitly
  test-only relationships.
- Keep replacement import atomic and duplicate-safe.
- Project migration 013 and 014 records into a bounded deterministic graph
  without persisting duplicate generic nodes.
- Add read-only seed, neighborhood, relationship-detail, and evidence APIs
  with explicit empty states.
- Connect Knowledge Sphere to the lexical-evidence graph while keeping senses,
  forms, claims, sources, locators, provenance, and uncertainty distinct.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected.
Stage-specific protections include the live SourceRoot API, OEWN meaning
compatibility, HistoryRoot 1.3.0, migration 013 identities, fixture-only
status, source attribution, URL/history state, responsive accessibility, and
the prohibition on embedded fallback knowledge.

## Non-goals

- DictionaryRoot Core Lexical Corpus v1 generation or import.
- Migration 015 or production writes to legacy lexicon tables.
- Generic persisted knowledge nodes for lexical graph objects.
- Relationship inference from model intuition.
- Write APIs, authentication, accounts, navigation redesign, HistoryRoot,
  BibleRoot, Chunk 11, packaging, release, or Git operations.

## Dependencies

- Node.js 22 or later, PostgreSQL, and Windows PowerShell 5.1.
- Accepted Chunk 10A architecture and fixture.
- Manually managed backend on port 3000 and frontend on port 8010 for browser
  smoke; this stage does not start or detach either service.

## Risks

- A relationship endpoint from another dataset could break ownership safety.
- Symmetric relationships could be duplicated in inverse order.
- Failed replacement could delete accepted fixture state unless transaction
  rollback remains complete.
- Graph traversal could become unbounded or merge distinct senses.
- Frontend labels or controls could introduce overflow or accessibility
  regressions.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Migration 014 is fresh-database and upgrade safe and migration 015 is
   absent.
2. Canonical relationship and evidence constraints reject self-links,
   cross-dataset endpoints, and duplicate symmetric pairs.
3. Fixture generation is repository-equal across two independent temporary
   directories and reports zero blockers.
4. Replacement import, duplicate reimport, and rollback-on-failure pass while
   HistoryRoot and legacy lexicon tables remain unchanged.
5. Graph seed, neighborhood, relationship detail, and evidence tests pass
   with stable IDs, deterministic ordering, explicit types, and limits.
6. Knowledge Sphere targeted tests and desktop/mobile smoke pass with no
   duplicate nodes or edges, horizontal overflow, console errors, or
   attributable warnings.
7. Typecheck, Chunk 10A, DictionaryRoot baseline, compatibility checks, the
   bounded stage verifier, and root verifier pass.
8. Migration 015, production corpus artifacts, packages, ZIPs, staged files,
   and Git history operations remain absent.

## Required verifier

- `VERIFY-DICTIONARYROOT-BASELINE.ps1`
- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE.ps1`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE.ps1`

## Manual browser checks

- Probe `http://127.0.0.1:3000/health` and
  `http://127.0.0.1:8010/index.html` before opening a browser.
- At 1280 by 720 and 390 by 844, open `graph-v2.html`, seed with `bank`, and
  confirm all three senses remain distinct while relationships are expandable
  and evidence is inspectable.
- Confirm forms remain forms, claims link to sources and locators, `island`
  keeps competing etymologies separate, and `logos` preserves uncertainty.
- Confirm no fallback records, duplicate nodes or edges, horizontal overflow,
  console errors, or attributable console warnings.

## Live API checks

- `GET /health` returns 200 against `sourceroot_test`.
- Seed lookup and bounded neighborhood for `bank` return stable ordered graph
  objects and three distinct senses.
- Relationship detail and evidence endpoints return sourced records or
  explicit empty results.
- Invalid pagination or limits return 400; missing resources never invent
  fallback data.

## Required output

- Migration 014, relationship types, store/import support, fixture additions,
  graph adapter and API routes.
- Targeted Knowledge Sphere integration, backend/frontend tests, final
  verifier, architecture contract, stage evidence, and current documentation.
- Exact migration, count, hash, verification, browser, changed-file, index,
  and non-goal evidence in the completion report.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-29T19:33:41.8056943-05:00
- Verification skipped: True

### Verifier results

- SKIPPED explicitly with -SkipVerification

### Changed files

- `assets/js/dictionaryroot-api.js`
- `assets/js/dictionaryroot-graph.js`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/fixture.json`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/inventory.json`
- `backend/data/dictionaryroot-lexical-evidence-architecture-fixture-v1/quality-review.json`
- `backend/db/migrations/014_create_dictionaryroot_lexical_relationships.sql`
- `backend/docs/migration-plan.md`
- `backend/package.json`
- `backend/src/dictionaryroot/lexical-evidence-fixture.ts`
- `backend/src/dictionaryroot/lexical-evidence-graph.ts`
- `backend/src/dictionaryroot/lexical-evidence-types.ts`
- `backend/src/routes/lexicon.ts`
- `backend/src/services/lexical-evidence-store.ts`
- `backend/test/dictionaryroot-lexical-evidence-architecture.test.ts`
- `backend/test/dictionaryroot-lexical-relationship-architecture.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE-CONTRACT.md`
- `docs/build/dictionaryroot-lexical-relationship-architecture-stage.md`
- `docs/customers/dictionaryroot/api-contract.md`
- `docs/stages/completed/20260729-SOURCEROOT-DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE-V1.md`
- `ROOT-ARCHITECTURE.md`
- `ROOT-MANIFEST.json`
- `ROOT-VERIFICATION.md`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Required verifiers were completed before lifecycle completion and were not repeated per user instruction: relationship verifier 16/16 with 0 warnings/failures, Chunk 10A verifier 10/10, DictionaryRoot baseline 23/23, SourceRoot baseline 15/15, and active root verifier 51/0/0. Focused backend 15/15, Chunk 10A backend 17/17, targeted frontend 8/8, and disposable fresh migrations 001-014 passed. Live Knowledge Sphere smoke passed at 1280x720 and 390x844 with bank, island, logos, relationship-evidence, duplicate-ID, overflow, and console checks. No unresolved manual checks.
