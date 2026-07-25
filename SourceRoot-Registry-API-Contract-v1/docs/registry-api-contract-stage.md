# SourceRoot Registry and API Contract Standardization Stage

## Stage Identity

- Stage: SourceRoot Chunk 1 — Registry and API Contract Standardization
- Version: v1
- Package: `SourceRoot-Registry-API-Contract-v1`
- Build date: 2026-07-24
- Target repository: `C:\Users\Josh\Documents\GitHub\dictionaryhub`
- Required previous stage: SourceRoot Chunk 0 — Codex Stage Contract and Baseline Harness v1

## Objective

Define and install an additive, backward-compatible contract for the repository's current public registry collections: shared collection metadata, pagination and offsets, filters, sorting, safe errors, registry terminology, and explicit compatibility/deprecation rules.

## Starting State

- Branch: `release/historyroot-alpha-integration-v1`
- Commit: `f4055edf5dcd945d8dcb696586e4a80cecba46c7`
- Initial Git status: one pre-existing untracked artifact, `SourceRoot-Codex-Stage-Contract-v1.zip`
- Source of truth: current repository files, not a prior archive or backup

## Pre-Change Baseline Results

| Check | Result |
|---|---|
| SourceRoot baseline | PASS — 15 passed, 0 failed, 0 warnings |
| DictionaryRoot baseline | PASS — 23 passed, 0 failed, 0 warnings |
| Chunk 0 contract verifier | PASS — 22 passed, 0 failed, 1 expected package-path warning |
| Backend TypeScript typecheck | PASS |
| Test database scope | PASS — configured database name is explicitly test-scoped: `sourceroot_test` |
| Test migrations | PASS — all 11 committed migrations already applied |
| Existing backend suite | PASS — 134 passed, 0 failed, 0 skipped |

## Route Inventory

The complete route-contract matrix is in `docs/build/REGISTRY-API-CONTRACT.md`. The inventory covered health/readiness, validation, import, nodes, assertions, edges, sources, revisions, bundle aliases, search, all ten context collections, DictionaryRoot lexicon/editorial, governance/workflow, moderation, administration, authentication, account, and their single-record or mutation variants. It also traced DictionaryRoot, HistoryRoot, governance, editorial, coverage, Sources, account, and admin browser consumers.

## Contract Decisions

- Preserve `page`/`limit` and add `offset` on standardized public registries.
- Reject explicit `page` plus explicit `offset` as ambiguous.
- Preserve exact total queries already present; label totals `exact`.
- Preserve every route-specific legacy collection key and add or retain `items`.
- Add `returned`, `hasMore`, `pagination`, `appliedFilters`, `appliedSort`, `registry`, and `contractVersion`.
- Ignore unknown query names for compatibility but report them in `registry.ignoredQueryParameters`.
- Reject invalid recognized pagination, filter enum, sort, direction, and date values.
- Use static sort allow-lists and immutable-ID ascending tie-breakers.
- Keep search relevance and DictionaryRoot complete-lemma semantics unchanged; search offset remains deferred.
- Apply the existing client-sent `sourceId` parameter to assertion and edge association tables.
- Standardize central errors and integrated registry not-found errors additively while retaining `error` and existing messages.

## Compatibility Decisions

No frontend runtime file was changed. Existing DictionaryRoot and HistoryRoot clients already read `items` or their legacy fallback keys. Existing response fields, routes, methods, status codes, search ranking, lexical enrichment, authorization, CSRF, workflow transitions, moderation policy, and visibility policy remain.

An intermediate full-suite run caught one changed invalid-search-type message. The legacy message was restored before final verification.

## Shared Utilities Added or Refined

- `backend/src/lib/api-contract.ts`: collection envelope construction, API error construction, request-ID attachment, contract constants, and safe validation detail allow-listing.
- `backend/src/lib/query-params.ts`: non-negative offsets, trusted limit clamping, sort/direction validation, normalized applied filters, unsupported-query reporting, and additive query error metadata.

## Routes Changed

- Central application error handling.
- Nodes, assertions, edges, sources, revisions, imported-bundle metadata, search, and all context collections.
- Bundle-scoped nodes, assertions, edges, sources, and revisions.
- Single-record not-found behavior for the integrated public registries and context lookups.

## Routes Intentionally Unchanged

- Health and deployment readiness.
- Validation and import mutation behavior.
- Node relationship aggregate shapes.
- DictionaryRoot neighborhood, status, coverage, dashboard, lemma queue, editorial summary/queue/review/promotion.
- Governance/workflow, moderation, admin, authentication, and account domain contracts.

These were inspected. Specialized collections keep their domain envelopes in v1; they share the enhanced pagination parser where already used.

## Files Added

- `backend/src/lib/api-contract.ts`
- `backend/test/registry-api-contract.test.ts`
- `docs/build/REGISTRY-API-CONTRACT.md`
- `docs/build/registry-api-contract-stage.md`
- `VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1`
- `INSTALL-SOURCEROOT-REGISTRY-API-CONTRACT.ps1`

## Files Replaced

- `backend/package.json`
- `backend/src/app.ts`
- `backend/src/lib/query-params.ts`
- `backend/src/routes/assertions.ts`
- `backend/src/routes/bundles.ts`
- `backend/src/routes/context.ts`
- `backend/src/routes/edges.ts`
- `backend/src/routes/import.ts`
- `backend/src/routes/nodes.ts`
- `backend/src/routes/revisions.ts`
- `backend/src/routes/search.ts`
- `backend/src/routes/sources.ts`
- `backend/src/services/assertion-store.ts`
- `backend/src/services/context-store.ts`
- `backend/src/services/edge-store.ts`
- `backend/src/services/import-store.ts`
- `backend/src/services/node-store.ts`
- `backend/src/services/revision-store.ts`
- `backend/src/services/source-store.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`

## Files Intentionally Untouched

- All database migrations and schema files.
- `backend/package-lock.json` because no dependency changed.
- All frontend HTML, CSS, JavaScript clients, branding, navigation, URL state, and offline/empty/loading behavior.
- Authentication, account, governance, moderation, editorial, and admin implementation.
- Source data, manifests, customer configuration, and prior installers/verifiers.
- The pre-existing untracked Chunk 0 ZIP.

## Migrations

No migration was added, renamed, edited, or executed against a non-test database.

## APIs Changed

Public registry collection responses gained additive contract metadata. Standardized registries gained offset and validated sort/direction support. Assertions and edges gained an effective `sourceId` association filter. Search gained the `items` alias while preserving `results`. Central and integrated registry errors gained additive `code`, `status`, `category`, and safe contextual fields.

## Frontend Behavior Changed

None. No frontend runtime file changed, and existing client compatibility is covered by the focused and full regression suites.

## Tests Added

`backend/test/registry-api-contract.test.ts` contains 11 focused tests covering pagination defaults and boundaries, offsets, empty pages, exact totals, filters, unknown filters, case behavior, multiple filters, applied metadata, sorting and directions, invalid sorts, stable ties, source associations, legacy keys, search aliasing, context/bundle compatibility, not-found compatibility, and safe error output.

## Tests Executed

- Backend TypeScript typecheck.
- Focused registry contract suite.
- Complete backend suite.
- Test-database migration runner.
- SourceRoot baseline verifier.
- DictionaryRoot baseline verifier.
- Chunk 0 contract verifier.
- Chunk 1 stage verifier.
- Installer verification against the repository.

## Tests Passed

- Focused Registry API Contract suite: 11 passed.
- Complete backend suite: 145 passed.
- SourceRoot baseline: 15 passed.
- DictionaryRoot baseline: 23 passed.
- Chunk 0 contract verifier: 22 passed with one expected warning when no Chunk 0 package path is supplied.
- Chunk 1 stage verifier: 34 passed, 0 failed, 0 warnings.
- Installer: completed and invoked the complete stage verifier successfully.

## Tests Failed

Final required checks: 0. One intermediate compatibility failure was detected and fixed before final verification.

## Tests Skipped

Final backend suite: 0. Browser and independent live API checks were not performed and are classified separately rather than reported as skipped backend tests.

## Database Checks

Only `backend/.env.test` was used. Its database name is explicitly test-scoped (`sourceroot_test`). All 11 migrations were already applied. Focused and full in-process API tests used that test database.

## Browser Checks

Not performed. This backend contract stage made no frontend runtime change.

## Independent Live API Checks

Not performed. Supertest exercised the Express application in process; no separately running backend was called.

## Known Limitations

1. Search explicit offset is deferred because DictionaryRoot complete-lemma enrichment has page-one semantics.
2. Specialized lexical, editorial, workflow, and admin collections retain their existing envelopes and do not yet accept the public registry offset/direction contract.
3. Unknown public-registry query names are reported and ignored rather than rejected to preserve current clients.
4. String equality filters remain case-sensitive; this stage does not introduce domain-specific case folding.
5. Universal archive, deprecation, supersession, correction, and retraction fields require future schema and governance design.
6. No browser, independent live API, production performance, or production security audit was performed.

## Deferred Exceptions

See `docs/build/REGISTRY-API-CONTRACT.md`. Deferred work is limited to safely versioning specialized protected collection envelopes and schema-backed lifecycle relationships; no placeholder implementation was added.

## Explicit Exclusions

No new observability, correlation-ID expansion, observer agents, contextual schema, extraction agents, dataset adapters, synchronization, trust engine, authentication/organization features, deployment, billing, tenancy, white labeling, dashboards, or commercial agent operations were implemented.

## Installer Behavior

The installer validates repository and Chunk 0 markers, validates the package manifest and payload, creates a unique timestamped path-preserving backup for every replaced file, records added/replaced/untouched files, copies complete files, verifies installed hashes, and runs the stage verifier. It returns nonzero on failure and makes no browser or independent-live-API claim.

## Backup Location

Successful installer-test backup:

```text
C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-registry-api-contract-v1-20260724-223920-106
```

## Rollback Procedure

1. Read `<backup>/installation-record.json`.
2. Copy each path in `replacedFiles` from the backup to the same repository-relative destination.
3. Remove only paths in `addedFiles` that the installation record says did not exist before installation.
4. Rerun the three Chunk 0 baseline verifiers and the complete backend suite against the test database.
5. Do not restore from the stage ZIP or delete unrelated files.

## ZIP SHA-256

The authoritative final archive SHA-256 is calculated after archive assembly and is reported with the delivered ZIP. It cannot be self-embedded in a file inside that same archive without changing the archive digest.

## Next Dependency

SourceRoot Chunk 2 — Shared Frontend API Layer, Logging, and Observability
