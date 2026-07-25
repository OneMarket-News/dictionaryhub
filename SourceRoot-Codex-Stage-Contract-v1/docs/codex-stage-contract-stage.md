# SourceRoot Chunk 0 — Codex Stage Contract and Baseline Harness v1

## Stage Identity

- Stage name: SourceRoot Chunk 0 — Codex Stage Contract and Baseline Harness
- Stage version: v1
- Package name: `SourceRoot-Codex-Stage-Contract-v1`
- Created: 2026-07-24

## Stage Objective

Create the permanent build contract, factual current-state record, agent-safety baseline, stage-package standard, baseline manifest, safe installer, and nondestructive verification harness that later SourceRoot Codex stages will reference.

## Why Chunk 0 Exists

Chunk 0 prevents later stages from rediscovering the repository from scratch, selecting an old backup as an implementation source, simplifying working systems, changing unrelated behavior, or reporting runtime verification that was not performed.

## Repository Inspected

```text
C:\Users\Josh\Documents\GitHub\dictionaryhub
```

Inspection baseline:

- Branch: `release/historyroot-alpha-integration-v1`
- Commit: `83d6eba225df1d0bfbd4c0a377a2ff3c9ac57fd8`
- Backend: Express/TypeScript/PostgreSQL under `backend/`
- Frontend: static HTML at repository root with shared assets under `assets/`

The repository was clean before Chunk 0 changes. It contains pre-existing contextual knowledge, authentication/governance, BibleRoot/HistoryRoot, and deployment-readiness material beyond the roadmap wording supplied for this stage. Chunk 0 preserves and records that material without implementing or accepting it as new work.

## Files Added

- `docs/build/CODEX-STAGE-CONTRACT.md`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/STAGE-PACKAGE-STANDARD.md`
- `docs/build/AGENT-SAFETY-BASELINE.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `VERIFY-SOURCEROOT-BASELINE.ps1`
- `VERIFY-DICTIONARYROOT-BASELINE.ps1`
- `VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1`
- `INSTALL-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1`
- `docs/build/codex-stage-contract-stage.md`

## Files Replaced

No pre-existing repository file was replaced during implementation. Installer testing backs up and replaces the ten Chunk 0 files with identical package payload copies.

## Files Intentionally Untouched

- All `backend/src/` runtime code.
- All `backend/db/migrations/` SQL.
- All `backend/test/` tests and fixtures.
- All customer HTML pages.
- All shared and customer JavaScript, CSS, SVG, and configuration.
- All data and provenance records.
- All pre-existing installers, operational scripts, verifiers, documentation, and backups.

## Baseline Findings

- The backend uses Node.js 22+, Express 5, TypeScript, `pg`, and Zod.
- The database layer has 11 migration files, including two distinct filenames numbered `005`.
- Core SourceRoot validation, import, registry, search, and provenance implementation is present.
- DictionaryRoot Home, Knowledge Sphere, Concept, and Source experiences use shared branding, navigation, unified search, exact-meaning compatibility, live API clients, URL state, and failure/empty/loading states.
- The repository contains later-scope contextual, identity, governance, and HistoryRoot implementation despite the supplied roadmap classification. The discrepancy is documented rather than altered.

## Migrations Added

None.

## APIs Added or Changed

None.

## Frontend Behavior Added or Changed

None.

## Verifiers Created

### SourceRoot Baseline

`VERIFY-SOURCEROOT-BASELINE.ps1` checks the actual backend entry points, core route mounts, registries, validation/import/search markers, migrations, tests, PowerShell parsing, SourceRoot engine JavaScript syntax, and TypeScript typecheck when dependencies are installed. It never starts the backend or connects to PostgreSQL.

### DictionaryRoot Baseline

`VERIFY-DICTIONARYROOT-BASELINE.ps1` checks the four core customer experiences, shared navigation/search, branding, API client, loading/empty/offline markers, URL behavior, context links, unique HTML IDs, script initialization order, deprecated fallback absence, and JavaScript syntax. It does not use a browser or live API.

### Stage Contract

`VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1` checks all Chunk 0 deliverables, required headings and contract rules, JSON validity and basic secret scanning, script parsing, stage documentation, next-stage identity, package allow-listing, absence of future implementation payloads, and both nested baseline verifiers.

## Installer Behavior

`INSTALL-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1`:

- Defaults to the requested repository path and accepts `-RepositoryPath`.
- Confirms SourceRoot or DictionaryRoot markers.
- Validates all ten payload files before target changes.
- Creates `backups/sourceroot-codex-stage-contract-v1-YYYYMMDD-HHMMSS-fff/`.
- Backs up every existing target while preserving relative paths.
- Records additions, replacements, original and installed SHA-256 hashes, and rollback instructions.
- Copies complete files and verifies installed hashes.
- Runs the stage verifier.
- Returns nonzero on installation or verification failure.
- Makes no browser, live API, or database verification claim.

## Backup Location

Successful installer-test backup:

```text
C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-codex-stage-contract-v1-20260724-214942-469
```

An earlier installer test created and retained:

```text
C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-codex-stage-contract-v1-20260724-214914-239
```

That first test copied the payload but failed before verification because Windows PowerShell 5.1 rejected direct JSON serialization of a generic list. The installer was changed to enumerate the lists explicitly and the complete installer flow then passed.

## Tests Executed

- `npm.cmd --prefix backend run typecheck`
- `npm.cmd --prefix backend run db:migrate:test`
- `npm.cmd --prefix backend test`
- `powershell -ExecutionPolicy Bypass -File .\VERIFY-SOURCEROOT-BASELINE.ps1`
- `powershell -ExecutionPolicy Bypass -File .\VERIFY-DICTIONARYROOT-BASELINE.ps1`
- `powershell -ExecutionPolicy Bypass -File .\VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1`
- Stage verifier with `-PackagePath .\SourceRoot-Codex-Stage-Contract-v1`
- Packaged installer against the current repository
- PowerShell parser checks for the complete non-backup script set
- `node --check` for five SourceRoot engine scripts and fourteen DictionaryRoot scripts
- JSON parsing for the baseline and package manifests
- Obvious secret-assignment scanning for the baseline manifest
- Package payload allow-list and future-implementation-file checks
- `SourceRoot-Codex-Stage-Contract-v1.zip` archive layout validation

## Tests Passed

- Backend TypeScript typecheck passed.
- All 11 migrations were already applied to the explicitly test-scoped `sourceroot_test` database.
- Full backend suite: 134 passed, 0 failed, 0 skipped.
- SourceRoot baseline: 15 passed, 0 failed, 0 warnings.
- DictionaryRoot baseline: 23 passed, 0 failed, 0 warnings.
- Package-aware stage verifier: 25 passed, 0 failed, 0 warnings.
- Final installer: 10 complete files backed up and replaced, installed hashes matched, and nested stage verification passed.
- Baseline and package manifests parsed successfully.
- Final package payload contained exactly the ten allowed Chunk 0 repository files.
- The ZIP contained 15 complete files under the single `SourceRoot-Codex-Stage-Contract-v1/` top-level folder.

## Tests Failed

No final acceptance check failed.

Two intermediate attempts failed and were resolved:

- The first sandboxed test-database migration attempt could not read the Windows user profile through Node (`uv_os_get_passwd`); the same committed command succeeded outside the sandbox against `sourceroot_test`.
- The first installer attempt failed while serializing generic lists in Windows PowerShell 5.1. The backup was retained, list enumeration was made PowerShell 5.1-compatible, and the complete installer retest passed.

## Tests Skipped or Not Executed

- No browser was opened. Responsive layout, accessibility interaction, and visual behavior were not tested in a browser.
- No independently running backend was started or called over a live network API. Supertest exercised the Express application in the backend suite, but that is not claimed as live API verification.
- No development, staging, or production database was used. Database checks were limited to `sourceroot_test`.
- No production security, privacy, accessibility, load, performance, backup/restore drill, or deployment test was performed.

## Known Limitations

1. Static checks do not establish browser layout or interaction behavior.
2. Static checks do not establish live API or PostgreSQL behavior.
3. The roadmap status and repository implementation state differ; Chunk 0 records both.
4. A simple manifest secret scan detects obvious assignments but is not a credential-scanning audit.
5. The baseline verifier does not run every historical stage verifier because some encode stage-specific historical expectations.
6. No independent production security, privacy, accessibility, performance, or disaster-recovery audit is part of Chunk 0.

## Explicit Exclusions

Chunk 0 does not implement:

- Phase 10 API standardization, pagination, or error formats.
- Contextual entities, context APIs, or proposal databases.
- Operational AI agents.
- Dataset research, adapters, or Tier 1 synchronization.
- BibleRoot or HistoryRoot.
- Trust, conflict, or corrections engines.
- Authentication, organizations, user permissions, or multi-tenancy.
- Production hosting, billing, white labeling, customer dashboards, or commercial automation.

Some excluded areas already have pre-existing repository files. They are protected current state, not Chunk 0 deliverables.

## Rollback Procedure

1. Open the timestamped backup created by the installer.
2. Read `installation-record.json`.
3. Restore every file listed under `replacedFiles` from the backup to the same repository-relative path.
4. Remove only paths listed under `addedFiles` if a complete rollback is required.
5. Do not remove unrelated files or use an older package as a replacement source.
6. Run the repository verification appropriate to the restored state.

Because all ten Chunk 0 repository files were new before this stage, a complete rollback removes only those explicitly recorded additions. An installer test performed after implementation will classify them as replaced because they already exist at test time.

## Next Stage

SourceRoot Chunk 1 — Registry and API Contract Standardization
