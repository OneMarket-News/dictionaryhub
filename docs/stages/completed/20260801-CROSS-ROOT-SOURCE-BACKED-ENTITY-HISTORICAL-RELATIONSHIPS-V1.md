# Cross-Root Source-Backed Entity and Historical Relationships v1

## Stage identity

- Name: Cross-Root Source-Backed Entity and Historical Relationships v1
- Slug: CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-V1
- Status: active
- Started: 2026-08-01

## Objective

Create a governed source-backed relationship assertion layer that preserves released HistoryRoot wording, uncertainty, dispute, review state, evidence, provenance, and deterministic identity without promoting Chunk 14A lexical observations, plus a separate planning-only BibleRoot logo and visual-identity brief.

## Business value

Customers can inspect the exact released record behind a historical relationship, including its uncertainty and provenance, while the platform gains a reusable semantic assertion contract that cannot be confused with lexical discovery. The stage adds deterministic provisioning and readiness evidence and plansâ€”but does not produceâ€”a professional BibleRoot family identity.

## Current source of truth

The checked-out release branch at corrected baseline HEAD `e20317e80f1cddf843ce55105028eea5c35163f7` is canonical. Required governed inputs are the released HistoryRoot 1.3.0 bundle; migration 018; the Chunk 14A resource registry, manifests, and hashes; current HistoryRoot APIs/pages; local runtime/readiness; and current Root-family interface/branding patterns. Backups, archives, old snapshots, generated packages, and mutable database contents are not implementation sources.

## Allowed files

- `assets/css/cross-root-relationships.css`
- `assets/js/cross-root-api.js`
- `assets/js/cross-root-relationships.js`
- `assets/js/historyroot-record.js`
- `backend/data/cross-root-source-backed-relationships-v1/BUILD-NOTES.md`
- `backend/data/cross-root-source-backed-relationships-v1/COVERAGE.md`
- `backend/data/cross-root-source-backed-relationships-v1/dataset-manifest.json`
- `backend/data/cross-root-source-backed-relationships-v1/hashes.json`
- `backend/data/cross-root-source-backed-relationships-v1/input-fingerprints.json`
- `backend/data/cross-root-source-backed-relationships-v1/relationship-assertions.json`
- `backend/data/cross-root-source-backed-relationships-v1/relationship-evidence.json`
- `backend/data/cross-root-source-backed-relationships-v1/RELATIONSHIP-RULES.md`
- `backend/db/migrations/019_create_cross_root_source_backed_relationships.sql`
- `backend/package.json`
- `backend/src/cross-root/source-backed-relationships.ts`
- `backend/src/lib/local-development-database.ts`
- `backend/src/routes/cross-root.ts`
- `backend/src/scripts/development-runtime.ts`
- `backend/src/scripts/import-cross-root-source-backed-relationships.ts`
- `backend/src/scripts/prepare-cross-root-source-backed-relationships.ts`
- `backend/src/services/cross-root-relationship-store.ts`
- `backend/src/services/development-runtime-readiness.ts`
- `backend/test/cross-root-source-backed-relationships.test.ts`
- `backend/test/local-development-runtime.test.ts`
- `cross-root-relationships.html`
- `docs/architecture/CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-ARCHITECTURE.md`
- `docs/brand/BIBLEROOT-LOGO-DESIGN-BRIEF-V1.md`
- `docs/build/CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-BROWSER-EVIDENCE.md`
- `docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260801-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-V1.md`
- `history-record-v1.html`
- `ROOT-MANIFEST.json`
- `verification/cross-root-relationships-desktop.png`
- `verification/cross-root-relationships-mobile.png`
- `verification/cross-root-source-backed-relationships.test.cjs`
- `VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- Released `historyroot-plymouth-knowledge-dataset-v1` version 1.3.0 bundle.
- Chunk 14A `sourceroot-cross-root-link-foundation-v1` resource registry and exact manifests/hashes.
- Migrations 009-012 and 018; current runtime, API, HistoryRoot record page, stage tools, and repository contracts.
- Current SourceRoot, DictionaryRoot, HistoryRoot, and BibleRoot family patterns for the planning-only brand brief.

## Required behavior

- Add narrow migration 019 with independent dataset/assertion/evidence tables and evidence-at-commit enforcement; do not add migration 020.
- Deterministically prepare all and only qualifying released HistoryRoot relationship and causal-link records, preserving native predicates, review/certainty/uncertainty/dispute, exact evidence, offsets, provenance, hashes, and order.
- Reuse exact Chunk 14A registry resources without changing any Chunk 14A link/evidence row; create no inferred cross-Root semantic assertion.
- Import transactionally with exact-state skipping, rollback, and deterministic repair.
- Add readiness contract 1.4.0 `crossRootRelationships` without redefining prior fields.
- Add read-only coverage/list/detail APIs with bounded filters and structured errors.
- Add a live-data-only responsive/accessible customer page and an API-gated HistoryRoot entry point.
- Add the requested planning-only BibleRoot logo brief with three territories, color/typography planning, a 100-point rubric, and future governed-stage contract.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. Stage-specific protections are migration 018 and all 23 raw/source-document identities, all 1,568 registry resources, 2,233 lexical links, 2,765 lexical evidence rows, readiness 1.3 semantics, the three released Roots and BibleRoot layers, HistoryRoot governance/revision/auth boundaries, existing API routes, script order, shared navigation/account behavior, canonical URLs, and honest failure states. No lexical observation can become semantic evidence.

## Non-goals

No network acquisition, external knowledge graph, LLM extraction, embeddings, similarity scoring, universal identity merge, inferred geography/causation/meaning/influence, EarthRoot/coordinates/maps/geocoding, commentary or Original Language import, mutation API, broad ontology, release ZIP, commit/tag/push, migration 020, final logo artwork, generated logo image, production SVG/PNG/favicon/icon, color replacement, brand replacement, font file, final trademark clearance, or automated concept selection.

## Dependencies

Node.js 22+, PostgreSQL development/test databases, PowerShell 5.1-compatible verification, the released HistoryRoot 1.3.0 and Chunk 14A datasets, migration 018, shared SourceRoot API/client/navigation, and the existing frontend server for browser QA.

## Risks

Primary risks are accidentally strengthening source wording, equating labels, conflating publication with semantic acceptance, merging causal and associative claims, corrupting prior Root or Chunk 14A rows during replacement, dishonest offsets/citations, readiness regression, static fallback data, inaccessible/overflowing evidence, and the planning brief causing production brand changes. Constraints, deterministic validation, transactional tests, regressions, and browser evidence address these risks.

## Acceptance criteria

1. Migration 019 is justified, narrow, independently hashed, enforced by constraints, and migration 018 is byte-identical while migration 020 is absent.
2. Preparation is offline, database-independent, ordered, repeatable, and byte-identical across two runs.
3. Dataset coverage is exactly 143 assertions, 178 evidence, 101 subjects, 76 objects, 280 reused resources, zero additions, 22 causal, 121 non-causal, 143 uncertain/unreviewed/directly-sourced/same-Root, zero disputed/cross-Root/accepted.
4. All 13 family counts, source-native predicate counts, exclusions, source fingerprints, and output hashes validate.
5. Every assertion has evidence; every offset excerpt reconstructs; all endpoints and source records reuse exact registered resources; no orphan/duplicate evidence exists.
6. No Chunk 14A lexical observation, name match, identity inference, geographic inference, or causal strengthening contributes semantic evidence.
7. First import, exact-state second import, injected rollback, and deterministic repair have exact zero-failure/zero-duplicate results and preserve all earlier data.
8. Readiness 1.4.0 reports exact independent relationship coverage while all previous capabilities remain ready and semantically unchanged.
9. Coverage/list/detail APIs are read-only, bounded, filterable, structured on failure, and honest when unprovisioned.
10. The customer page exposes typed endpoints, source-native/controlled semantics, review/certainty/uncertainty/dispute/scope, evidence/provenance/hashes, visible boundaries, URL history, and all honest states with no fallback records.
11. HistoryRoot entry points appear only after an API query finds a qualifying assertion.
12. Frontend/backend tests, relevant prior regressions, focused verifier, root verifier, `git diff --check`, and browser desktop/mobile/API-offline/recovery/accessibility checks pass.
13. The BibleRoot brief contains every required planning section and exactly 100 rubric points while creating no runtime, image, favicon, color, font, or current-brand replacement.
14. Stage completion supports active and completed/inactive verification with no commit, tag, push, or release ZIP.

## Required verifier

- `VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1`
- `VERIFY-ROOT-REPOSITORY.ps1`

## Manual browser checks

Using live PostgreSQL/API data, inspect `cross-root-relationships.html` at 1280x720 and 390x844. Verify initial results, resource/family/causal filters, assertion deep link, browser back/forward, evidence expansion, canonical links, narrow HistoryRoot entry point, long-ID overflow, keyboard focus, shared Root switcher/user menu, zero console errors, API-unavailable state, Retry recovery, and visible semantic/identity/causal boundaries. Record example IDs, hashes, URLs, and screenshots in the browser-evidence document.

## Live API checks

On local development PostgreSQL and API port 3000, provision twice and inspect runtime readiness 1.4.0 plus all three relationship endpoints. Validate total coverage, resource/family/causal filters, exact detail evidence, 404 unknown resource/assertion, 400 invalid filters/paging, no mutation route, and honest awaiting-data behavior in an unprovisioned test transaction. No secret value is printed or recorded.

## Required output

Migration/schema, deterministic corpus and documentation, builder/importer, readiness/API/store/client, customer page and HistoryRoot entry point, backend/frontend tests, architecture/runbook/browser evidence, planning-only BibleRoot brief, focused verifier, completed-stage record, ignored desktop/mobile screenshots, exact identities/counts/import summaries/API evidence/regression results, final changed paths/status/index/lock/process/port/non-goal evidence.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-08-01T19:39:09.9545388-05:00
- Verification skipped: False

### Verifier results

- VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1 -> exit 0
- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0

### Changed files

- `assets/css/cross-root-relationships.css`
- `assets/js/cross-root-api.js`
- `assets/js/cross-root-relationships.js`
- `assets/js/historyroot-record.js`
- `backend/data/cross-root-source-backed-relationships-v1/BUILD-NOTES.md`
- `backend/data/cross-root-source-backed-relationships-v1/COVERAGE.md`
- `backend/data/cross-root-source-backed-relationships-v1/dataset-manifest.json`
- `backend/data/cross-root-source-backed-relationships-v1/hashes.json`
- `backend/data/cross-root-source-backed-relationships-v1/input-fingerprints.json`
- `backend/data/cross-root-source-backed-relationships-v1/relationship-assertions.json`
- `backend/data/cross-root-source-backed-relationships-v1/relationship-evidence.json`
- `backend/data/cross-root-source-backed-relationships-v1/RELATIONSHIP-RULES.md`
- `backend/db/migrations/019_create_cross_root_source_backed_relationships.sql`
- `backend/package.json`
- `backend/src/cross-root/source-backed-relationships.ts`
- `backend/src/lib/local-development-database.ts`
- `backend/src/routes/cross-root.ts`
- `backend/src/scripts/development-runtime.ts`
- `backend/src/scripts/import-cross-root-source-backed-relationships.ts`
- `backend/src/scripts/prepare-cross-root-source-backed-relationships.ts`
- `backend/src/services/cross-root-relationship-store.ts`
- `backend/src/services/development-runtime-readiness.ts`
- `backend/test/cross-root-source-backed-relationships.test.ts`
- `backend/test/local-development-runtime.test.ts`
- `cross-root-relationships.html`
- `docs/architecture/CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-ARCHITECTURE.md`
- `docs/brand/BIBLEROOT-LOGO-DESIGN-BRIEF-V1.md`
- `docs/build/CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-BROWSER-EVIDENCE.md`
- `docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md`
- `docs/stages/completed/20260801-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS-V1.md`
- `history-record-v1.html`
- `ROOT-MANIFEST.json`
- `VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Implemented governed Chunk 14B source-backed HistoryRoot relationship assertions, live readiness/API/UI/browser evidence, and the planning-only BibleRoot visual identity brief. Manual browser checks resolved.
