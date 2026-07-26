# Current SourceRoot State

## Record Identity

- Baseline record: SourceRoot Chunk 0 — Codex Stage Contract and Baseline Harness v1
- Current-state record: SourceRoot Chunk 3 - Contextual Identity and Time Refinement v1
- Previous installed stage: SourceRoot Chunk 2 - Shared Frontend API Layer, Logging, and Observability v1
- Earlier installed stage: SourceRoot Chunk 1 - Registry and API Contract Standardization v1
- Current-state update date: 2026-07-26
- Repository inspected: `C:\Users\Josh\Documents\GitHub\dictionaryhub`
- Branch at inspection: `release/historyroot-alpha-integration-v1`
- Starting commit for the installed stage: `ef8cd09f6ef97458f1751612a86c2f4314885775`
- Starting tag for the installed stage: `sourceroot-frontend-api-observability-v1`

The repository at the branch and starting commit above was inspected directly, then SourceRoot Chunk 3 was installed and verified from complete repository files. Immutable Chunk 0-2 checks used the exact ZIP bytes in `C:\Users\Josh\Documents\SourceRoot-Releases`; no immutable package hash was reconstructed from Git.

## Repository Structure

| Area | Actual location |
|---|---|
| Backend | `backend/` |
| Backend entry points | `backend/src/server.ts`, `backend/src/app.ts` |
| Backend routes | `backend/src/routes/` |
| Backend services | `backend/src/services/` |
| Database access and configuration | `backend/src/lib/database.ts`, `backend/src/lib/runtime-config.ts`, `backend/.env.example` |
| Migrations | `backend/db/migrations/` |
| Backend tests | `backend/test/` |
| Frontend | Static HTML files at the repository root |
| Shared frontend JavaScript | `assets/js/` |
| Shared frontend CSS | `assets/css/` and legacy root `style.css` |
| Shared brand assets | `assets/brand/` |
| Customer configuration | `config/customers/` |
| DictionaryRoot brand configuration | `config/dictionaryroot-brand.json` |
| Source and demonstration data | `data/` |
| Documentation | `docs/` and `backend/docs/` |
| Installers and operational scripts | Root `*.ps1` files and `backend/scripts/` |
| Verifiers | Root `VERIFY-*.ps1`, root `VERIFY-*.mjs`, and `verification/` output |
| Backups | `backups/<stage-name>-<timestamp>/`, normally preserving repository-relative paths |

The existing `backups/` directory contains timestamped DictionaryRoot stage backups. Current installer documentation and the governed-platform installer use backups for restoration; backups are not implementation sources.

## Technical Stack

### Languages and Formats

- TypeScript for the backend and backend tests.
- JavaScript for browser clients, shared UI behavior, legacy SourceRoot engines, and Node-based verifiers.
- HTML and CSS for the static customer and registry experiences.
- SQL for PostgreSQL migrations.
- PowerShell for Windows installation, build, backup, restore, and verification.
- Shell scripts for PostgreSQL backup and restore inside `backend/scripts/`.
- JSON, YAML, and Markdown for configuration, data, API descriptions, and documentation.

### Backend

- Node.js `>=22.0.0`.
- Express `5.2.1`.
- PostgreSQL through `pg` `8.22.0`.
- Zod `4.4.3` for structured validation used by current backend features.
- CORS and dotenv packages.
- TypeScript `7.0.2`, `tsx`, Node's built-in test runner, and Supertest.

`backend/package-lock.json` is the committed npm lock file. npm is the package manager.

### Frontend

The customer frontend is static, multi-page HTML. It has no committed bundler step. Pages load shared CSS and browser-global JavaScript with ordered `defer` scripts. `assets/js/sourceroot-api.js` is the shared request transport used by the DictionaryRoot and HistoryRoot core clients and by the SourceRoot registry engine. Product wrappers preserve their existing public APIs, messages, caching, URL state, loading, empty, and offline behavior.

### Build and Runtime

- `npm run typecheck` and `npm run build` compile/check the TypeScript backend.
- `npm test` uses Node's test runner through `tsx`.
- `docker-compose.local.yml` defines PostgreSQL 16 Alpine, Node 22 backend, and Python 3.12 static-file frontend services.
- Direct local frontend hosting can use any static web server; the Docker composition uses `python -m http.server 8080`.
- PowerShell 5.1-compatible scripts are used for the Windows workflows in the repository.

## Current Backend Capabilities

### Application Mounts and Health

`backend/src/app.ts` mounts:

- `GET /health`
- `GET /api/v1/deployment-readiness`
- `/api/v1/validate`
- `/api/v1/import`
- `/api/v1/search`
- `/api/v1/bundles`
- `/api/v1/nodes`
- `/api/v1/assertions`
- `/api/v1/edges`
- `/api/v1/sources`
- `/api/v1/revisions`
- `/api/v1/context`
- `/api/v1/dictionaryroot/lexicon`
- `/api/v1/dictionaryroot/editorial`
- `/api/v1/dictionaryroot/workflow`
- `/api/v1/governance` as a second mount for the workflow router
- `/api/v1/auth`
- `/api/v1/account`
- `/api/v1/admin`
- `/api/v1/moderation`

The health handler reports service, product-stage, version, database reachability, and deployment-readiness information. A configured but unreachable database produces degraded health. Staging and production startup fail closed when required configuration or database checks fail.

### Registry and Import Routes

- Nodes: list, retrieve, node assertions, and incoming/outgoing node edges.
- Assertions: list and retrieve.
- Edges: list and retrieve.
- Sources: list and retrieve.
- Revisions: list and retrieve.
- Bundles: bundle-scoped nodes, assertions, edges, sources, and revisions.
- Imports: validate and persist a bundle, list imported-bundle metadata, retrieve a bundle, and narrowly delete allow-listed integration-test bundles.
- Validation: `POST /api/v1/validate` performs nondestructive bundle validation.

Registry list endpoints use shared pagination and query parsing. Current stores support applicable bundle, domain, type, source association, record, and date filters; the exact accepted filter set varies by route.

SourceRoot Chunk 1 installs the shared Registry API Contract `1.0` on public registry collections. Nodes, assertions, edges, sources, revisions, imported-bundle metadata, bundle-scoped aliases, search, and all ten context collections preserve their legacy collection keys while exposing `items`, exact total semantics, returned count, `hasMore`, pagination metadata, applied filters, allow-listed sort metadata, ignored unknown query names, and route-specific registry metadata. Standardized registries accept validated `sort` and `direction`; all except search accept additive non-negative `offset`. Assertions and edges apply `sourceId` through their normalized association tables.

The permanent contract and complete route matrix are in `docs/build/REGISTRY-API-CONTRACT.md`. Specialized lexical, editorial, governance/workflow, and admin collections retain their protected domain envelopes in v1.

Production import is protected by an authenticated permission or a configured service token. A development-only unauthenticated option exists and is ignored in production.

### Search and Context Routes

`GET /api/v1/search` searches normalized nodes, assertions, edges, sources, revisions, and the contextual result types enumerated in `backend/src/routes/search.ts`.

The current repository already contains contextual knowledge implementation:

- Entities.
- Temporal assertions.
- Accounts.
- Claims.
- Evidence and counterevidence.
- Interpretations.
- Perspectives.
- Causes and consequences.
- Relationships.
- Cultural memories.
- Universal contextual record lookup.

These are read through `/api/v1/context`. Their presence is an important discrepancy from the Chunk 0 prompt's exclusion of future contextual implementation. Chunk 0 does not add, remove, or redesign them.

SourceRoot Chunk 3 refines this foundation additively:

- normalized, source-aware entity aliases while preserving legacy `alternateNames`;
- normalized external entity identifiers without network dereferencing or entity merging;
- semantic temporal roles and structured historical/partial dates with explicit BCE/CE, calendar, precision, approximation, uncertainty, and conversion state;
- proposed-date source links, relationship temporal links and validity sources, and bounded modern-date validity filters;
- field-level provenance that complements record-level source associations;
- reviewable identity relations represented as contextual relationships, including possible sameness and explicit distinctness;
- deterministic identity metadata search that keeps every entity ID distinct; and
- governed snapshot publication and rollback that preserve all refined child data.

Entity detail now includes `aliases`, `externalIdentifiers`, `identityLinks`, and `fieldProvenance`. Read-only alias and identifier collections are available below `/api/v1/context/entities/:contextId/`. Temporal and relationship detail responses expose the additive semantic and validity fields while retaining every legacy response key.

### DictionaryRoot, Identity, and Governance Routes

The backend also currently contains:

- DictionaryRoot lexical neighborhood, status, coverage, dashboard, and lemma routes.
- DictionaryRoot editorial summary, queue, review, and promotion routes.
- Authentication discovery, email, Google, Apple, development sign-in, session, sign-out, and linked-identity routes.
- Account profile, session, invitation, export, and deletion-request routes.
- Governance proposal, comment, transition, publication, and rollback routes.
- Administrative user, role, organization, invitation, moderation, and audit routes.

These working capabilities are preserved as current repository state. Chunk 0 makes no claim that they are production-ready.

### Database Tables and Migrations

There are 12 migration files in the installed stage:

1. `001_create_imported_bundles.sql`
2. `002_create_knowledge_tables.sql`
3. `003_create_dictionaryroot_lexicon.sql`
4. `004_create_dictionaryroot_editorial_reviews.sql`
5. `005_create_auth_identity_governance.sql`
6. `005_create_dictionaryroot_identity_access.sql`
7. `006_create_governed_editorial_workflow.sql`
8. `007_create_moderation_operations.sql`
9. `008_strengthen_session_identity.sql`
10. `009_create_contextual_knowledge_foundation.sql`
11. `010_extend_contextual_governance.sql`
12. `011_refine_contextual_identity_time.sql`

The schema includes:

- Core provenance tables: `imported_bundles`, `sources`, `nodes`, `assertions`, `edges`, `revisions`, `node_sources`, `assertion_sources`, and `edge_sources`.
- DictionaryRoot lexical and editorial tables.
- Two current identity/access table families: `dictionaryroot_*` and `dr_*`.
- Governed workflow, publication, moderation, and audit tables.
- Contextual record, entity, temporal, account, claim, evidence, interpretation, perspective, causal, relationship, cultural-memory, and source-link tables.
- Contextual alias and alias-source, external-identifier and identifier-source, temporal-proposal and proposal-source, relationship-temporal and validity-source, and field-provenance tables added by migration 011.

There are two distinct migration filenames with numeric prefix `005`. The migration runner applies filename order and records filenames, so both are distinguishable, but the duplicated number is a maintenance limitation and must not be “fixed” by renaming an applied migration.

### Validation and Error Behavior

`backend/src/services/validator.ts` validates the SourceRoot bundle envelope and normalized nodes, assertions, edges, sources, revisions, references, trust values, allowed values, duplicates, and required fields. Current contextual schemas and import validation add contextual checks.

Invalid imports return HTTP 422 with a validation result; validation-only requests return their result without persistence. Invalid pagination, dates, filters, sorts, and searches return stable 400 responses at their route. Integrated errors preserve the legacy `error` and `message` fields while adding `code`, HTTP `status`, a category, an optional field, safe details, and a request ID. Missing records retain route-specific 404 codes and messages. The application handles malformed JSON as 400, oversized bodies as 413, unknown routes as 404, and unexpected errors as 500 without returning stack traces.

Every request receives a bounded safe correlation ID through `X-Request-ID`; unsafe or missing caller values receive non-sequential UUIDs. The ID is available in request and response context and is included in structured request, error, validation, and import diagnostics. Structured events are line-delimited JSON with an allow-listed schema. Authorization, cookies, passwords, tokens, sessions, CSRF values, request bodies, private source text, and client-facing stack traces are excluded.

Two internal Level 1 observers are present under `backend/src/observers/`. The Platform Operations Observer groups approved diagnostic failures and preserves supporting correlation IDs, including narrow contextual-refinement failure categories. The Data Quality and Provenance Observer reports missing attribution and metadata, malformed identifiers, broken source relationships, unsourced aliases or identifiers, cross-entity identifier reuse, incomplete temporal precision, relationship-validity issues, missing field provenance targets, identity-evidence gaps, contradictory identity assertions, and unsupported calendar conversion. Both remain deterministic, read-only functions without endpoints, persistence, network, shell, database, retry, restart, publishing, or record-mutation authority.

## Current Frontend Experiences

### DictionaryRoot Home

- Page: `index.html`
- Page script: `assets/js/dictionaryroot-home.js`
- Purpose: live exact-meaning search, service and coverage summary, experience entry points, live “value” demonstration, recent browser-local searches, and URL `?q=` state.
- States present: loading, no-result/empty, and API-offline messaging without static knowledge fallback.

### Knowledge Sphere

- Page: `graph-v2.html`
- Page script: `assets/js/dictionaryroot-graph.js`
- Supporting styles: `dictionaryroot-live.css`, `dictionaryroot-hybrid-map.css`, `dictionaryroot-dynamic-sphere.css`, and product/governance styles.
- Purpose: exact-sense selection, live node/assertion/source/edge retrieval, bounded and dynamic neighborhood exploration, map/readable modes, path context, and Concept/Source links.
- URL and browser state: query/node/source context, `pushState`, `replaceState`, and `popstate`.
- States present: loading, empty/no match, detail error, and API-offline behavior.

### Concept Experience

- Page: `concept-v2.html`
- Page script: `assets/js/dictionaryroot-concept.js`
- Purpose: exact-sense choice, definition-first concept details, assertions, relationships, connected meanings, provenance, advanced record disclosure, and Sphere/Source links.
- URL and browser state: query/node/source context, `pushState`, `replaceState`, and `popstate`.
- States present: loading, empty/no match, concept error, and API-offline behavior.

### Source Experience

- Page: `sources-v2.html`
- Page script: `assets/js/dictionaryroot-sources.js`
- Purpose: live source registry, filters and sorting, source detail, linked assertions/edges/nodes, and Concept/Sphere context links.
- URL and browser state: `source`, `meaning`, `nodeId`, source filter `q`, type, sort, density, and `popstate`.
- States present: explicit source loading, empty, detail-error, and API-offline elements.

### Additional Current DictionaryRoot Pages

The current repository also contains customer pages for coverage (`coverage-v2.html`), editorial review (`editorial-v2.html`), revision history (`history-v2.html`), workflow (`workflow-v1.html`), account (`account-v1.html` and redirect/compatibility page `accounts-v2.html`), and administration (`admin-v1.html`). Legacy or prototype pages such as `dictionaryroot.html`, `concept.html`, `graph.html`, `sources.html`, and `explore.html` remain present and are intentionally untouched.

### Shared Components, API Client, and Branding

- API client: `assets/js/dictionaryroot-api.js`
- Shared request transport: `assets/js/sourceroot-api.js`
- HistoryRoot API client: `assets/js/historyroot-api.js`
- Authentication client: `assets/js/dictionaryroot-auth.js`
- Customer branding: `assets/js/dictionaryroot-brand.js`, `assets/css/dictionaryroot-brand.css`, `assets/brand/dictionaryroot-mark.svg`, `config/dictionaryroot-brand.json`
- Shared navigation and unified search: `assets/js/dictionaryroot-navigation.js`, `assets/css/dictionaryroot-navigation.css`
- Primary customer manifest: `config/customers/dictionaryroot.json`

The shared navigation includes Home, Concept, Knowledge Sphere, Sources, Coverage, Editorial, History, Accounts, Workflow, and Admin according to current script configuration. It preserves active-page state, responsive menu behavior, exact-meaning ranking helpers, live search, and cross-experience context.

On the four core pages, scripts load in this order: shared request transport, API client, authentication, branding, shared navigation, and the page-specific experience. No core page or its core script contains the deprecated `data/nodes.json` fallback reference.

## Current Verification Coverage

### Backend Tests

The repository has 16 `backend/test/*.test.ts` files. The installed full suite contains 168 passing tests: all original 155 tests plus 13 focused Chunk 3 tests. It includes 11 focused Registry API Contract tests and 10 focused correlation/logging/observer tests, covering:

- HTTP health, validation, malformed JSON, and payload limits.
- Bundle schema and validation.
- Import persistence, replacement, rollback, registries, filtering, pagination, search, and restricted integration-test deletion.
- DictionaryRoot OEWN parsing, deterministic pilot selection, and exact lemma coverage.
- Lexical normalization.
- Local development CORS and platform hardening.
- Contextual knowledge validation, normalization, routes, filters, search, rollback, replacement, and deletion.
- HistoryRoot Plymouth dataset quality and integration.
- Authentication/governance public surfaces.
- Governed HistoryRoot proposal, review, publication, conflict, audit, and rollback behavior.
- Registry contract pagination boundaries, offsets, exact totals, filter metadata, unknown filters, case behavior, sorting and stable ties, legacy collection keys, source associations, compatible not-found errors, and safe internal errors.
- Safe and generated correlation IDs, response/error/log propagation, structured success and failure logs, redaction, validation diagnostics, deterministic observer grouping, data-quality findings, clean records, and input non-mutation.
- Contextual alias and external-identifier persistence, semantic and historical time including BCE/CE and unconverted calendars, proposal provenance, relationship validity, field provenance, identity ambiguity without merge, search compatibility, transaction rollback, governed snapshots, and observer refinement.

The frontend Node harness contains 10 passing cases for GET/query/JSON/empty responses, API and malformed-response errors, network/offline/timeout/abort classification, correlation propagation, DictionaryRoot and HistoryRoot return compatibility, legacy method presence, HTML load order, and SourceRoot registry wrapper delegation.

Most persistence and governance integration tests require a configured PostgreSQL test database and reset it by truncating test tables. They must never be pointed at a non-test database.

### PowerShell and JavaScript Verifiers

Before Chunk 0, the repository contained 34 root `VERIFY-*` scripts. They cover DictionaryRoot customer foundation, live connection, home, Concept, Sphere, Sources, navigation, coverage, editorial, history, governance, responsiveness, HistoryRoot, and contextual knowledge. The machine-readable baseline manifest now also lists the Chunk 0, Chunk 1, Chunk 2, and Chunk 3 stage verifiers.

Several PowerShell verifiers provide static file and marker checks plus optional or required live API calls. The `.mjs` responsive verifiers locate a Chromium-family browser, host pages locally, inspect responsive behavior, and can create screenshots. `VERIFY-DICTIONARYROOT-TYPESCRIPT-SYNTAX.mjs` performs TypeScript parse checks when TypeScript is installed.

### Installer Checks

The Chunk 3 installer validates repository and prior-contract markers, proves the database name is exactly `sourceroot_test`, validates package identity and every payload hash, creates a timestamped path-preserving backup, records pre-existing added destinations, copies complete files, verifies installed hashes, writes rollback data, and runs the complete stage verifier. Its successful installer-test backup is `backups/sourceroot-contextual-identity-time-refinement-v1-20260726-095336-578/`.

### Dependency Classification

| Check type | Current examples | Dependency |
|---|---|---|
| Static | Required files, markers, JSON, PowerShell parse, `node --check`, TypeScript typecheck | Repository plus installed runtime for language checks |
| Backend without PostgreSQL | Selected HTTP/validation and configuration tests | Node dependencies |
| PostgreSQL | Schema, imports, registries, contextual/governance integration tests | Explicit test database and migrations |
| Live API | Live-connection and customer endpoint checks | Running backend and normally PostgreSQL data |
| Browser | Responsive `.mjs` verifiers and manual interaction | Chromium-family browser; some scenarios also need live API |

## Current Known Limitations

1. Roadmap wording and implementation state are not aligned: the prompt classifies Phase 10 as next, while the current repository already contains contextual, authentication, governance, moderation, and HistoryRoot implementation.
2. The two migration files numbered `005` create ordering and maintenance ambiguity. Applied migration filenames must not be renamed.
3. Static frontend pages have no committed bundler or component test framework; DOM behavior and layout require browser verification.
4. Many meaningful backend checks require a separately configured PostgreSQL test database. Static verification does not prove persistence behavior.
5. The customer manifest defaults to a localhost API base URL and a specific DictionaryRoot OEWN bundle. Deployment configuration is environment-specific.
6. Search retains page/limit pagination without explicit offset because DictionaryRoot complete-lemma enrichment has page-one semantics.
7. The repository contains legacy/prototype pages alongside current `*-v2.html` experiences; file presence alone does not identify the preferred customer route.
8. No independent production security, privacy, accessibility, performance, disaster-recovery, or operational-readiness audit was performed for this baseline.
9. Chunk 0 does not validate every pre-existing verifier's historical expectations; some stage verifiers may intentionally encode the state of the stage that created them.
10. Structured diagnostics are log-derived and in-memory only; no production log shipping, tracing, alerting, retention service, or operations dashboard is installed.
11. Specialized authentication/account transports and older SourceRoot pages with embedded request code are intentionally deferred.
12. Label-only named periods, BCE partial values, proposed-only values, and unconverted calendars are not eligible for deterministic active-at filtering.
13. Identity relations preserve evidence and conflict but do not establish canonical or legal identity, and no automatic merge path exists.
14. Calendar conversion, authority dereferencing, and external identifier validation are not performed.

## Prompt-to-Repository Discrepancy

The requested Chunk 0 exclusions prohibit implementing contextual entities, authentication, production deployment, BibleRoot, HistoryRoot, and operational AI agents. The repository already contains some contextual, authentication/governance, BibleRoot/HistoryRoot, and deployment-readiness material. These files predate Chunk 0 in the inspected commit. Chunk 0 preserves and records them; it does not claim they were newly implemented, accepted by this stage, or production-ready.

## Current Roadmap Position

```text
Core Phases 1–9: completed according to the project roadmap
Phase 10: next implementation phase
Current Codex package: Chunk 3 - Contextual Identity and Time Refinement v1
Next Codex package after acceptance: SourceRoot Chunk 4 — Contextual Assertions, Evidence, and Versioning
```

This roadmap status is a project-management classification, not an independent production-security audit. It also does not erase the factual discrepancy that later-scope implementation files are already present in the current repository.

## Next Dependency

SourceRoot Chunk 4 — Contextual Assertions, Evidence, and Versioning
