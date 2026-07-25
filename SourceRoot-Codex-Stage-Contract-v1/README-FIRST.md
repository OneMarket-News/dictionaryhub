# SourceRoot Codex Stage Contract v1

This is the complete SourceRoot Chunk 0 package.

## Prerequisite

Use the current committed `dictionaryhub` repository. Do not install this package over an older ZIP, backup, or prototype.

Default target:

```text
C:\Users\Josh\Documents\GitHub\dictionaryhub
```

## Install

From this extracted package directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1
```

For another repository location:

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1 -RepositoryPath "C:\path\to\dictionaryhub"
```

The installer validates the ten-file payload, confirms repository markers, creates a unique timestamped backup under `backups\`, backs up every existing destination file, copies complete files, verifies hashes, and runs the stage verifier.

## Verify

After installation:

```powershell
powershell -ExecutionPolicy Bypass -File .\VERIFY-SOURCEROOT-CODEX-STAGE-CONTRACT.ps1 -RepositoryPath "C:\Users\Josh\Documents\GitHub\dictionaryhub" -PackagePath "."
```

The stage verifier runs both baseline verifiers. Its required checks are static and local syntax/type checks.

It does not:

- Open a browser.
- Start or call a live backend API.
- Connect to PostgreSQL.
- Modify repository or database content.

The repository's full backend test command is a separate PostgreSQL-dependent regression check and must use an explicitly test-scoped database.

## Package Contents

- `payload/`: ten complete repository-relative Chunk 0 files.
- `docs/codex-stage-contract-stage.md`: package-facing stage record.
- `manifest/stage-manifest.json`: structured package manifest.
- Root installer and verifier.

## Rollback

Open the timestamped backup created by the installer and read `installation-record.json`.

1. Restore every path listed in `replacedFiles` from the same relative path in the backup.
2. Remove only paths listed in `addedFiles` when a complete rollback is required.
3. Do not remove unrelated files.
4. Re-run the verification appropriate to the restored repository state.

## Next Dependency

SourceRoot Chunk 1 — Registry and API Contract Standardization
