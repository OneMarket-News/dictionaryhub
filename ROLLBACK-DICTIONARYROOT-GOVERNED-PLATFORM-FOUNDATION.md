# Roll back DictionaryRoot Governed Platform Foundation v1

The installer creates a timestamped backup under:

```text
backups\dictionaryroot-governed-platform-foundation-v1-YYYYMMDD-HHMMSS
```

## File rollback

1. Stop the frontend and backend.
2. Open the selected backup folder.
3. Copy its backed-up repository files over the repository while preserving relative paths.
4. Review `install-manifest.csv` for files marked `New`. Delete those new stage files from the repository if a complete rollback is required.
5. Rerun the prior stage verifier and restart the prior backend.

The file backup does not include PostgreSQL data.

## Database rollback

The migrations are additive and preserve prior SourceRoot tables. Prefer restoring a database backup taken immediately before migration rather than manually dropping governance tables.

Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\RESTORE-DICTIONARYROOT-DATABASE.ps1 -BackupPath "C:\path\to\dictionaryroot-pre-governance.dump" -Confirm
```

Test restoration against a non-production database first. Published revisions and audit events are historical records; do not selectively delete them from a live database without a reviewed data-governance procedure.
