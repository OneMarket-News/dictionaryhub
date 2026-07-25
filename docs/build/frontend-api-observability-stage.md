# SourceRoot Frontend API and Observability Stage

## Stage Identity

- Stage: SourceRoot Chunk 2 - Shared Frontend API Layer, Logging, and Observability
- Version: v1
- Package: `SourceRoot-Frontend-API-Observability-v1`
- Build date: 2026-07-24
- Target repository: `C:\Users\Josh\Documents\GitHub\dictionaryhub`
- Required previous stage: SourceRoot Chunk 1 - Registry and API Contract Standardization v1

## Objective

Install a backward-compatible shared browser request transport, refine end-to-end correlation and structured diagnostics, and add two deterministic Level 1 read-only observers without changing registry records, authorization, schemas, or product feature behavior.

## Starting State

- Branch: `release/historyroot-alpha-integration-v1`
- Commit: `f2a726f2c4edcb4d6b75c36fcd1cf8578285a00e`
- Initial Git status: two pre-existing untracked ZIPs, `SourceRoot-Codex-Stage-Contract-v1.zip` and `SourceRoot-Registry-API-Contract-v1.zip`
- Chunk 1 contract and package: present

## Pre-Change Verification

| Check | Result |
|---|---|
| SourceRoot baseline | PASS - 15 passed, 0 failed, 0 warnings |
| DictionaryRoot baseline | PASS - 23 passed, 0 failed, 0 warnings |
| Chunk 0 verifier | PASS - 22 passed, 0 failed, 1 expected package-path warning |
| Chunk 1 verifier | PASS - 34 passed, 0 failed, 0 warnings |
| TypeScript typecheck | PASS |
| Test database scope | PASS - `sourceroot_test` |
| Test migrations | PASS - all 11 committed migrations already applied |
| Complete backend suite | PASS - 145 passed, 0 failed, 0 skipped |

## Frontend Consumer Inventory

- DictionaryRoot core requests were centralized in `assets/js/dictionaryroot-api.js`.
- HistoryRoot core requests were centralized in `assets/js/historyroot-api.js`.
- Four SourceRoot registry pages loaded `engine/sourceRootApi.js` but retained duplicate inline JSON fetch wrappers.
- DictionaryRoot authentication and account modules use session/CSRF and blob-specific behavior.
- DictionaryRoot brand and both Root manifest loaders read static local configuration with established fallback behavior.
- Older SourceRoot inspector, identity, light-graph, and import-preview pages contain embedded fetch logic and do not load the shared engine helper.

## Shared-Client Decisions

`assets/js/sourceroot-api.js` supplies base URL and query construction, JSON and empty-response parsing, caller headers and JSON bodies, credentials, timeouts, composed aborts, offline/network classification, request and response IDs, and safe diagnostic callbacks.

DictionaryRoot, HistoryRoot, and the existing SourceRoot registry engine now delegate transport to it. Their public globals, methods, return shapes, caching, error copy, URL state, and rendering logic remain.

## Deferred Consumers

Specialized authentication, account export, moderation, governance, editorial, and administrative transport remains unchanged. Static manifest and brand reads retain their local fallback paths. Embedded older SourceRoot page fetch implementations are deferred pending page-specific regression coverage.

## Correlation-ID Contract

The existing `X-Request-ID` header remains. Safe caller values are accepted up to 128 characters; unsafe or missing values receive UUIDs. The ID is available in request and response context, returned in the response header, included in integrated API errors, and shared by request/error/import diagnostics. It is never authentication.

## Structured-Log Decisions

The stage adds a small internal diagnostic module rather than a logging dependency. JSON events use an allow-listed schema with timestamp, level, event type, correlation ID, environment, and bounded event-specific fields. Request finish events classify the response and capture only a safe error code. Validation/import events include counts and status, not source content.

## Redaction Rules

Authorization, cookies, passwords, tokens, sessions, CSRF values, secrets, database URLs, request bodies, imported instructions, unrelated personal data, and client-facing stack traces are excluded. A recursive redactor is test-covered for approved diagnostic tooling.

## Observer Designs

### Platform Operations Observer

A pure TypeScript function consumes approved event objects, retains individual failures, groups recurring patterns, sorts correlation IDs, recommends severity and an investigation area, and returns stable machine and human reports.

### Data Quality and Provenance Observer

A pure TypeScript function consumes one supplied bundle snapshot and reports missing attribution, publisher/external-ID/URL/timestamp metadata, malformed or duplicate external IDs, broken source relationships, incomplete bundle metadata, and invalid statuses. Findings carry record IDs, evidence, and human-review actions.

## Observer Authority Levels

Both observers are Level 1 and explicitly `readOnly`. They expose no endpoint and have no filesystem, database, network, shell, retry, restart, permission, publishing, or mutation capability.

## Files Added

- `assets/js/sourceroot-api.js`
- `backend/scripts/register-tsx.mjs`
- `backend/src/lib/diagnostics.ts`
- `backend/src/observers/platform-operations-observer.ts`
- `backend/src/observers/data-quality-provenance-observer.ts`
- `backend/test/observability.test.ts`
- `backend/test/observers.test.ts`
- `verification/frontend-api-observability.test.cjs`
- `docs/build/FRONTEND-API-OBSERVABILITY-CONTRACT.md`
- `docs/build/frontend-api-observability-stage.md`
- `VERIFY-SOURCEROOT-FRONTEND-API-OBSERVABILITY.ps1`
- `INSTALL-SOURCEROOT-FRONTEND-API-OBSERVABILITY.ps1`

## Files Replaced

- `backend/package.json`
- `backend/src/app.ts`
- `backend/src/lib/request-id.ts`
- `backend/src/middleware/request-logging.ts`
- `backend/src/routes/import.ts`
- `backend/src/routes/validate.ts`
- `assets/js/dictionaryroot-api.js`
- `assets/js/historyroot-api.js`
- `engine/sourceRootApi.js`
- DictionaryRoot and HistoryRoot HTML entry points that load migrated clients
- Four SourceRoot registry HTML entry points that load the engine helper
- `docs/build/CURRENT-SOURCEROOT-STATE.md` after successful installation
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json` after successful installation

## Files Intentionally Untouched

- All database migrations, schema files, and database data
- `backend/package-lock.json` and dependency versions
- Authentication, account, governance, moderation, editorial, admin, and permission domain behavior
- Root product rendering, branding, navigation, URL-state, loading, empty, offline, source, and provenance logic
- Source datasets and customer configuration
- Prior installers, verifiers, packages, backups, and pre-existing ZIPs

## Database Changes

None. No migration or persistent diagnostic storage was added.

## APIs Changed

No route or response contract was removed. All HTTP responses continue to return `X-Request-ID`; error correlation remains additive. Request/error and validation/import diagnostics are internal log behavior only.

## Frontend Behavior Changed

The migrated clients now share transport classification and correlation. Product-facing method signatures, successful return shapes, established messages, caching, rendering, and state behavior remain backward-compatible.

## Tests Added

- Eight shared transport and compatibility cases plus static load-order and SourceRoot wrapper checks in the frontend Node harness.
- Six correlation, structured logging, redaction, and validation diagnostic backend cases.
- Four deterministic observer cases covering recurring failures, empty input, required quality findings, clean input, evidence, stable output, and non-mutation.

## Tests Executed

Typecheck, JavaScript syntax, focused frontend, focused backend/observer, complete backend, Chunk 1 focused contract, all prior baseline verifiers, stage verifier, installer, payload hash, ZIP structure, PowerShell parse, and obvious-secret checks.

## Tests Passed

- Focused frontend API and compatibility suite: 10 passed.
- Focused correlation, logging, and observer suite: 10 passed.
- Chunk 1 focused Registry API Contract suite: 11 passed.
- Complete backend suite: 155 passed, 0 failed, 0 skipped.
- TypeScript and relevant JavaScript syntax checks: passed.
- SourceRoot, DictionaryRoot, Chunk 0, Chunk 1, stage package, payload hash, ZIP structure, and installer results are enforced by the final stage verifier.

## Tests Failed

No unresolved implementation failure. A managed Windows `os.userInfo()` failure in the TSX loader was handled by a test-only, Windows-only registration shim that uses the already user-scoped temporary directory and does not alter application runtime.

## Tests Skipped

Browser and independent live API checks were not performed. They are classified honestly rather than reported as backend skips.

## Database Checks

Only `backend/.env.test` is eligible. Its database name was explicitly confirmed as `sourceroot_test`. No development, staging, or production database was accessed.

## Browser Checks

Not performed. Browser-compatible scripts were syntax checked and exercised in the existing Node VM verification style; no claim of interactive browser verification is made.

## Independent Live API Checks

Not performed. Supertest invokes the Express application in process; no separately running backend is called.

## Known Limitations

- No persistent monitoring, tracing backend, dashboard, alerting, or retention system exists.
- Observer input is caller-supplied approved data; no production scheduler or polling exists.
- Static manifest/brand reads and specialized auth/account transports are not migrated.
- Older SourceRoot pages with embedded transport remain deferred.
- Actor category is intentionally coarse; organization IDs are omitted unless approved context is explicitly provided.

## Explicit Exclusions

No new contextual model, claim/evidence schema, proposal database, Level 2 agent, automatic repair/retry/restart, record mutation, large import, external research, adapter, synchronization, BibleRoot or HistoryRoot feature, trust/correction/conflict engine, auth/organization feature, deployment, external monitoring service, billing, multi-tenancy, white labeling, customer dashboard, or autonomous agent was added.

## Installer Behavior

The installer validates Chunk 0 and Chunk 1 markers, package identity and hashes, and repository markers. It backs up every existing destination, copies complete files, verifies installed hashes, records added/replaced/untouched paths, and runs the stage verifier. Failure returns nonzero and retains the backup.

## Backup Location

`<repository>\backups\sourceroot-frontend-api-observability-v1-YYYYMMDD-HHMMSS-fff\`

## Rollback Procedure

Open the backup's `installation-record.json`. Restore every `replacedFiles` path from its matching backup-relative path. For `addedFiles`, remove a destination only when it is absent from `addedFilesPreExisting`; otherwise restore its backup copy. Rerun the SourceRoot, DictionaryRoot, Chunk 0, Chunk 1, and Chunk 2 verifiers and the complete test suite against `sourceroot_test`. Never delete unrelated files.

## ZIP SHA-256

The authoritative final archive SHA-256 is calculated after archive assembly and is reported with the delivered ZIP. It cannot be self-embedded in a file inside that same archive without changing the archive digest.

## Next Dependency

`SourceRoot Chunk 3 - Contextual Entity and Time Model`
