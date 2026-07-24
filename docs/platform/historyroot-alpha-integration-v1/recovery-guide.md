# Recovery guide

## Principles

- Stop and identify the failing layer before changing data.
- Preserve logs, request IDs, migration output, publication IDs, and revision
  IDs.
- Prefer forward repair or governed rollback over destructive database edits.
- Never edit an applied migration or delete audit history.
- Back up before recovery operations.

## Backend will not start

1. Inspect the `startup_failed` JSON log entry.
2. Correct the named static configuration checks.
3. Confirm PostgreSQL reachability from the backend host.
4. Run `/health` and `/api/v1/deployment-readiness` after restart.
5. Do not bypass startup validation by enabling development flags.

## Migration failure

Each migration runs in its own transaction. On failure:

1. Keep application traffic on the prior compatible release.
2. Capture the failed migration name and PostgreSQL error.
3. Confirm the failed migration was not inserted into `schema_migrations`.
4. Restore the pre-migration backup if the database state is uncertain.
5. Correct the unapplied migration through a reviewed commit, or add a new
   forward migration when the original was already applied elsewhere.
6. Rerun `npm.cmd --prefix .\backend run db:migrate`.

Never rename either migration 005.

## Dataset import failure

HistoryRoot import is transactional. A failed import should leave the prior
bundle intact.

```powershell
npm.cmd --prefix .\backend run historyroot:plymouth:validate
npm.cmd --prefix .\backend run historyroot:plymouth:import
```

If validation fails, do not import. Correct the committed dataset and review
the provenance report first.

## Remove and restore HistoryRoot

Removal is allow-listed to the Plymouth bundle:

```powershell
npm.cmd --prefix .\backend run historyroot:plymouth:remove
```

Restore by validating and importing the same reviewed bundle. Confirm that
DictionaryRoot and unrelated bundles were not changed.

## Publication rollback

Use the governance rollback action with an authorized publisher account:

1. Confirm the publication is still the active current publication.
2. Review the retained prior snapshot.
3. Enter a specific rollback reason.
4. Execute rollback.
5. Confirm the new rollback revision, audit event, public record, search result,
   and related pages.

Do not delete the publication, proposal, revision, or audit rows.

## Database restore

1. Put the application into maintenance mode.
2. Verify the backup checksum and encryption key availability.
3. Restore into a separate database first.
4. Run migrations against the restored copy.
5. Run the full backend and dataset verification matrix.
6. Point a staging backend at the restored copy and perform browser smoke tests.
7. Promote only after review and retain the failed database for investigation.

The repository helper scripts derive their default repository location from
their own script directory; no developer-specific path is required.
