# SourceRoot Registry API Contract v1

## Identity and Prerequisite

This is `SourceRoot-Registry-API-Contract-v1`. It requires SourceRoot Chunk 0 — Codex Stage Contract and Baseline Harness v1.

## Target Repository

Default target:

```text
C:\Users\Josh\Documents\GitHub\dictionaryhub
```

## Install

From this package directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL-SOURCEROOT-REGISTRY-API-CONTRACT.ps1
```

To use another repository path:

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL-SOURCEROOT-REGISTRY-API-CONTRACT.ps1 -RepositoryPath "C:\path\to\dictionaryhub"
```

## Verify

```powershell
powershell -ExecutionPolicy Bypass -File .\VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1 -RepositoryPath "C:\Users\Josh\Documents\GitHub\dictionaryhub" -PackagePath .
```

## Backup

Before copying, the installer backs up every payload destination that already exists. Backups preserve repository-relative paths under:

```text
<repository>\backups\sourceroot-registry-api-contract-v1-YYYYMMDD-HHMMSS-fff\
```

`installation-record.json` distinguishes logical added files, pre-existing added destinations, replaced files, backed-up files, and intentionally untouched areas.

## Check Classification

- Static: required files, contract sections, shared utility and route markers, TypeScript typecheck, relevant JavaScript syntax, PowerShell parse, manifest, payload hashes, ZIP structure, and obvious-secret scan.
- PostgreSQL test database: migration status is checked before the stage gate; focused and full backend tests use only `backend/.env.test` after its database name is proven test-scoped.
- In-process API: Supertest invokes the Express app without a separate server.
- Independent live API: not performed by this stage verifier.
- Browser: not performed by this stage verifier.

## Rollback

Read the backup's `installation-record.json`. Restore every `replacedFiles` path from the same backup-relative path. For `addedFiles`, remove a file only when it is absent from `addedFilesPreExisting`; otherwise restore its backup. Rerun the three Chunk 0 baseline verifiers and the full backend suite against the test database. Never delete unrelated files or use a prior ZIP as the implementation source.
