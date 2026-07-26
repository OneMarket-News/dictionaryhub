# SourceRoot Contextual Identity and Time Refinement Stage

## Stage Identity

- Stage: SourceRoot Chunk 3 - Contextual Identity and Time Refinement
- Version: v1
- Package: `SourceRoot-Contextual-Identity-Time-Refinement-v1`
- Build date: 2026-07-26
- Target repository: `C:\Users\Josh\Documents\GitHub\dictionaryhub`
- Required previous stage: SourceRoot Chunk 2 - Shared Frontend API Layer, Logging, and Observability v1

## Objective

Refine the existing contextual knowledge foundation additively so sourced aliases, external entity identifiers, semantic and historical time, relationship validity, field-level provenance, and reviewable identity ambiguity can be stored and read without merging entities or resolving historical conflict automatically.

## Starting State

- Branch: `release/historyroot-alpha-integration-v1`
- Commit: `ef8cd09f6ef97458f1751612a86c2f4314885775`
- Tag: `sourceroot-frontend-api-observability-v1`
- Git status: clean
- Test database: `sourceroot_test`

## Pre-Change Results

| Check | Result |
|---|---|
| SourceRoot baseline | PASS - 15 passed, 0 failed, 0 warnings |
| DictionaryRoot baseline | PASS - 23 passed, 0 failed, 0 warnings |
| Chunk 0 verifier | PASS - 22 passed, 0 failed, 1 expected package-path warning |
| Chunk 1 direct verifier | Code and test checks passed; immutable artifact checks failed because four files were superseded by Chunk 2 and the prior ZIP is not committed |
| Chunk 2 direct verifier | Code, frontend, typecheck, observer, focused, and 155-test checks passed; package/ZIP checks failed because prior release packages are not committed |
| TypeScript | PASS |
| Test database scope | PASS - configured database name is exactly `sourceroot_test` |
| Current migrations | PASS - all 11 existing migration filenames already recorded |
| Complete backend suite | PASS - 155 passed, 0 failed, 0 skipped |

The direct prior-stage artifact failures are preserved rather than weakened. Final prior-stage verification uses isolated repositories with exact package payload bytes and documents the isolation method.

## Existing Contextual Inventory

| Area | Existing capability | Gap or risk | Chosen extension |
|---|---|---|---|
| Migrations | Migration 009 creates the contextual registry, ten record subtypes, perspective links, and record-level source links; migration 010 adds contextual governance fields | No normalized identity or field-provenance children; semantic time and relationship validity are absent | Add migration 011 only; do not edit or rename prior migrations |
| TypeScript types | Ten contextual record kinds, nine entity types, eight temporal kinds, legacy `alternateNames`, proposed dates, relationships, and contextual bundle collections | Aliases, identifiers, time roles, structured historical dates, validity links, and field provenance are not first-class | Extend the current types additively; introduce no new contextual record kind |
| Zod schemas | Strict contextual shapes, modern ISO date validation, temporal-shape checks, self-link rejection, and legacy bundle compatibility | JavaScript `Date` is the only detailed date validator; no BCE/partial date or child reference contract | Add bounded structured-date schemas and cross-reference validation while retaining every legacy field |
| Bundle validator | Detects duplicate contextual IDs, broken contextual references, broken source references, and invalid strict shapes | No child IDs/references, symmetric identity duplicate, or safe field-path validation | Extend the existing validator with structural errors and preserve ambiguity as valid data |
| Import persistence | One transaction imports sources, normalized contextual records/subtypes, perspectives, and record-level sources; bundle replacement deletes owned records first | New contextual children would otherwise survive only in `raw_data` | Insert new children inside the same transaction with foreign keys and cascading ownership |
| Context store | Reads normalized registry metadata and overlays `raw_data`; source and perspective links are additive | No detailed identity/time/provenance projections | Add correlated, deterministic child projections and narrow child-list reads |
| Context routes | Ten typed collections plus universal lookup; exact totals, offsets, filters, sorting, safe errors, and request IDs follow Registry API Contract 1.0 | No alias/identifier child endpoints or semantic time/validity filters | Preserve all routes and add two read-only entity child collections plus safe additive filters |
| Search | Searches contextual canonical names, legacy alternate names through raw JSON, and other contextual text without collapsing IDs | No normalized alias or exact identifier search | Join bounded normalized identity text while preserving result identity and ordering |
| Governance | Proposals retain structured snapshots, validate attribution/history concerns, materialize normalized subtypes, publish, and roll back | Publishing a refined snapshot would not materialize new child tables | Extend the existing materialization path; keep states, permissions, snapshots, and approval requirements |
| Publication and rollback | Prior and published snapshots are JSONB, publications are auditable, and rollback rematerializes prior snapshots | Refined normalized children need replacement on publish/rollback | Rebuild only the target record's owned child projections from the preserved snapshot |
| HistoryRoot consumers | Existing pages read legacy context routes and `alternateNames`; tests cover import, search, and stable IDs | Consumers do not understand detailed refinements | Keep frontend files untouched; additive API fields do not break current consumers |
| Context tests | Existing contextual suite covers validation, atomic import, replacement, filters, lookup, temporal kinds, relationships, search, deletion, and FK behavior | No identity/time-refinement cases | Add a separate focused test file and keep the existing suite unchanged |
| Data Quality observer | Pure Level 1 function reports attribution, identifier, source-link, metadata, and status findings | It ignores contextual aliases, identifiers, time, validity, provenance, and identity conflict | Inspect supplied contextual snapshots deterministically without database, network, shell, or mutation |
| Platform Operations observer | Pure Level 1 grouping of structured failures | No special explanation for contextual refinement categories | Recognize the existing validation/import diagnostic events; do not redesign the observer |
| Source association | Record-level `context_record_sources` plus direct subtype source IDs | No field/subrecord source links | Keep record-level links and add complementary normalized source junctions and field provenance |
| Temporal filtering | Strict modern `dateFrom` and `dateTo` filters over SQL `DATE` columns | Cannot honestly filter named periods or unconverted calendars | Add `timeRole` and deterministic validity filters only for normalized sortable bounds; document label-only exclusions |
| `raw_data` compatibility | Full imported record is preserved and overlaid on normalized reads | Normalized child rows can diverge during governance if not rematerialized | Preserve raw input exactly and make normalized child projections replaceable and deterministic |

## Gap Analysis

First-class aliases, external identifiers, proposal-level date evidence, and field provenance need normalized child tables because they have stable IDs and independent source associations. Existing `context_relationships` already has stable IDs, two endpoints, explanations, confidence, uncertainty, raw-data preservation, governance participation, and search/API support, so identity ambiguity remains a controlled relationship semantic instead of a new record kind or merge table.

Historical dates need a structured JSON value plus optional signed chronology bounds. Modern `YYYY-MM-DD` columns remain authoritative for existing filters. Numeric chronology bounds are derived only from stated year/era/precision when no calendar conversion is claimed; named periods and unconverted non-Gregorian calendar values remain label-only.

## Schema Decisions

Migration 011 adds normalized identity/provenance child tables, source junctions, relationship-temporal links, and additive temporal/relationship columns. Foreign keys cascade only with their owning contextual record or imported bundle. Cross-entity identifier reuse remains legal.

## Migration Decisions

No previous migration is renamed, edited, reordered, repaired, or squashed. No legacy alias, source, validity, identifier authority, or identity equivalence is fabricated. Legacy `alternateNames` stays in `context_entities.alternate_names` and `raw_data`; no backfill is required.

## Alias Decisions

Detailed aliases are bundle-level normalized children with caller-supplied stable IDs and an explicit entity ID. Exact spelling and case are stored unchanged. Alias type uses a controlled core vocabulary plus a bounded custom form. Source links and optional temporal assertion qualification are independent. Legacy `alternateNames: string[]` continues unchanged.

## Identifier Decisions

Identifiers preserve scheme and original value exactly, with optional normalized value, URI, label, status, notes, and uncertainty. Exact duplicates on one entity are blocked; the same scheme/value on two entities is retained and reported for review. Import and tests perform no network calls or authority dereferencing.

## Temporal-Role Decisions

Temporal assertions gain a controlled `timeRole` whose default is `unspecified`. Database lifecycle timestamps remain separate and are never exposed as historical event time.

## Historical-Date Decisions

Structured dates retain an original label, precision, era, optional year/month/day or named period, calendar system, approximation, uncertainty, and conversion status. They complement rather than replace existing exact/range/before/after ISO fields.

## BCE and CE Decisions

Numeric years are positive stated years paired with `BCE` or `CE`. Sortable signed bounds use astronomical ordering only as an internal chronology key: `1 BCE` maps to `0`, `2 BCE` to `-1`, and CE years retain their positive value. The API returns the stated era/year and original label; it does not rewrite them into a proleptic Gregorian date.

## Calendar Decisions

No calendar conversion is performed. Values explicitly marked `unconverted` or using a non-Gregorian calendar do not receive sortable chronology bounds. Named periods without an evidenced numeric representation remain label-only.

## Relationship-Validity Decisions

Relationships retain optional validity metadata and link to existing contextual temporal assertions through normalized link rows. Link types distinguish valid-from, valid-until, valid-during, and proposed periods. Sources may support individual links. Existing relationships without validity remain valid.

## Field-Provenance Decisions

Field provenance is complementary to `context_record_sources`. It targets a contextual record plus a bounded dotted field path and optional subrecord type/ID, references a real source, and records optional support type, note, confidence, and uncertainty. Paths are data identifiers only, never executable expressions.

## Identity-Link Decisions

`possible_same_as`, `asserted_same_as`, `distinct_from`, `derived_from`, `successor_of`, and `predecessor_of` use `context_relationships`. Symmetric reverse duplicates are rejected deterministically; directional relations retain direction. No entity ID, foreign key, URL, canonical name, or search result is merged or redirected.

## Compatibility Decisions

All existing bundle fields, contextual record kinds, routes, response keys, status codes, public frontend methods, record-level source links, raw data, and HistoryRoot behavior remain. Refinement fields are additive.

## Files Added

- `backend/db/migrations/011_refine_contextual_identity_time.sql`
- `backend/src/services/contextual-time.ts`
- `backend/test/contextual-identity-time.test.ts`
- `docs/build/CONTEXTUAL-IDENTITY-TIME-CONTRACT.md`
- `docs/build/contextual-identity-time-stage.md`
- `INSTALL-SOURCEROOT-CONTEXTUAL-IDENTITY-TIME.ps1`
- `VERIFY-SOURCEROOT-CONTEXTUAL-IDENTITY-TIME.ps1`

## Files Replaced

- `backend/package.json`
- `backend/src/contextual-types.ts`
- `backend/src/observers/data-quality-provenance-observer.ts`
- `backend/src/observers/platform-operations-observer.ts`
- `backend/src/routes/context.ts`
- `backend/src/routes/import.ts`
- `backend/src/routes/validate.ts`
- `backend/src/services/context-import-store.ts`
- `backend/src/services/context-store.ts`
- `backend/src/services/contextual-governance.ts`
- `backend/src/services/contextual-schemas.ts`
- `backend/src/services/search-store.ts`
- `backend/test/helpers/database.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`

## Files Intentionally Untouched

All frontend HTML, CSS, JavaScript, branding, navigation, URL-state, loading, empty, offline, and display behavior is untouched. Migrations 001-010, `backend/package-lock.json`, dependencies, authentication, accounts, organizations, invitations, moderation, permissions, unrelated registries, source datasets, customer configuration, prior installers, prior verifiers, exact prior packages, and prior backups are untouched.

## Database Changes

Migration 011 adds the normalized alias, external-identifier, temporal-proposal-source, relationship-validity, relationship-temporal-source, and field-provenance tables. It adds semantic time, structured date, chronology bounds, and relationship review status columns. Foreign keys, uniqueness checks, controlled-value checks, path checks, and bounded indexes enforce ownership without inventing facts or merging entities. Existing temporal rows receive only `time_role = 'unspecified'`; no identity, provenance, date, or calendar value is backfilled.

## API Changes

The existing `/api/v1/context` routes and envelopes remain. Entity detail adds `aliases`, `externalIdentifiers`, `identityLinks`, and `fieldProvenance`; temporal detail adds `timeRole`, `structuredDate`, chronology bounds, and proposal detail; relationship detail adds review status, temporal links, validity sources, and normalized validity. New read-only entity child collections are `/api/v1/context/entities/:contextId/aliases` and `/api/v1/context/entities/:contextId/identifiers`. List filters add `timeRole`, `validAt`, `validFrom`, and `validTo`, with modern `valid_during` limits documented. Registry API Contract 1.0 pagination, total, filtering, sorting, immutable-ID tie-breakers, error envelopes, and `X-Request-ID` behavior remain.

## Search Changes

Entity search includes first-class alias text and external identifier scheme/value text. Exact alias and identifier matches receive deterministic ranking while every entity ID remains distinct; no merge, redirect, or canonicalization occurs.

## Governance Changes

The existing proposal, validation, publication, snapshot, audit, authorization, and rollback workflow is preserved. Refined alias, identifier, temporal-proposal, relationship-validity, and field-provenance children are validated, retained in governed snapshots, rematerialized on publication, and restored on rollback. No identity or chronology change is auto-approved.

## Observer Changes

The Data Quality and Provenance Observer remains deterministic, pure, read-only Level 1 analysis and adds findings for missing alias/identifier sources, exact duplicates, cross-entity identifier reuse, incomplete temporal precision, invalid relationship validity, broken provenance targets, missing identity evidence, contradictory identity assertions, and unsupported calendar conversion. The Platform Operations Observer remains Level 1 and only classifies contextual refinement failures more specifically.

## Tests Added

`backend/test/contextual-identity-time.test.ts` adds 13 focused tests covering migration objects/indexes, legacy bundles and `alternateNames`, transactional persistence, Registry API child collections, CE/BCE/named/unconverted/proposed time, relationship validity filters, field provenance, invalid references and duplicates, non-merging search, complete rollback, governed snapshot publication/rollback, and both read-only observers.

## Tests Executed

- `npm.cmd --prefix backend run typecheck`
- `npm.cmd --prefix backend run db:migrate:test`
- `npm.cmd --prefix backend run test:context-refinement`
- `npm.cmd --prefix backend run test:context`
- `npm.cmd --prefix backend run test:registry-contract`
- `npm.cmd --prefix backend run test:observability`
- `npm.cmd --prefix backend run test:governance:historyroot`
- `npm.cmd --prefix backend test`
- SourceRoot, DictionaryRoot, Chunk 0, exact-byte isolated Chunk 2 with nested Chunk 1/0, and Chunk 3 verifiers
- PowerShell parse, relevant JavaScript syntax, secret scan, package/payload/installed hashes, ZIP structure/byte comparison, and `git diff --check`

## Tests Passed

Final installed-state results:

- TypeScript: PASS.
- Migration 011 apply/skip and schema verification: PASS.
- Chunk 3 focused refinement: 13 passed.
- Existing contextual foundation: 15 passed.
- Registry API Contract 1.0: 11 passed.
- Observability: 10 passed.
- Governed HistoryRoot: 12 passed.
- Complete backend: 168 passed, including every original 155 test.
- SourceRoot baseline: 15 passed.
- DictionaryRoot baseline: 23 passed.
- Chunk 0: 22 passed with its expected direct package-path warning.
- Exact isolated Chunk 2: 44 passed, including its nested Chunk 1 and Chunk 0 verification.
- Chunk 3 package-aware verifier: 39 passed, 0 failed, 0 warnings, 7 informational.
- Package payload, installed-file, secret, exclusion, PowerShell, JavaScript, and ZIP byte checks: PASS.

## Tests Failed

Final required checks: 0 failed. Early direct prior-stage checks correctly reported immutable package limitations, and preliminary package-verifier attempts stopped on a mistyped verifier digest and an ignored auxiliary Chunk 2 harness missing from the isolation base. Both verifier defects were corrected without changing a prior verifier or weakening a package hash check. Final verification uses the exact release ZIP bytes at `C:\Users\Josh\Documents\SourceRoot-Releases`, validates their SHA-256 values, overlays exact Chunk 2 payload files into an isolated checkpoint snapshot, copies the ignored workspace harness only as a non-package test input, and runs the unmodified Chunk 2 verifier with its nested prior checks.

## Tests Skipped

Browser and independent live API checks are not required for a backend-only additive stage and are reported separately, not counted as passed.

## Database Checks

Only `backend/.env.test` with database name `sourceroot_test` is authorized. Development, staging, and production databases are excluded.

## Browser Checks

Not performed. This stage changes no frontend file, so no browser pass is claimed.

## Independent Live API Checks

Not performed. Supertest provides in-process API coverage, so no independent live API pass is claimed.

## Installer Behavior

The installer validates repository and Chunk 0-2 markers, requires migrations 009 and 010, proves the configured database is exactly `sourceroot_test`, validates package identity and payload hashes, backs up every pre-existing destination, records logical added files that already existed, copies complete files, verifies installed hashes, writes a complete installation record, runs the Chunk 3 verifier, and returns nonzero on failure.

## Backup Location

Successful installer-test backup:

`C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-contextual-identity-time-refinement-v1-20260726-095336-578`

Its `installation-record.json` records 7 logical additions, 15 replacements, every pre-existing destination, every backed-up path, package and prior-release locations, payload hashes, installed hashes, untouched areas, and rollback instructions.

## Rollback Procedure

Open the timestamped backup's `installation-record.json`. Restore every `replacedFiles` path from its matching backup-relative file. For each `addedFiles` path, remove it only if it is absent from `addedFilesPreExisting`; otherwise restore its backup. Rerun the test migration and all SourceRoot, DictionaryRoot, Chunk 0-3, focused, and complete backend checks against `sourceroot_test`. Never delete unrelated files.

## Known Limitations

- Label-only named periods and unconverted calendars cannot be filtered as deterministic active-at dates.
- Identity relationships preserve assertions and conflicts; they do not establish legal or canonical identity.
- The observer analyzes supplied snapshots and is not a persistent monitoring service.
- No external authority lookup or calendar conversion is performed.

## Explicit Exclusions

Automatic merge, canonical identity or chronology selection, calendar conversion, external lookups, AI-generated data or sources, write APIs, editors, dashboards, adapters, synchronization, new auth/organization features, deployment, billing, tenancy, autonomous agents, and Chunk 4 assertion/evidence/versioning work are excluded.

## ZIP SHA-256

The authoritative final archive SHA-256 is calculated after archive assembly and reported with the delivered ZIP. It cannot be self-embedded in a file inside that same archive without changing the archive digest.

## Next Dependency

SourceRoot Chunk 4 - Contextual Assertions, Evidence, and Versioning
