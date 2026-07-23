# DictionaryRoot deployment readiness

## Environment progression

Use separate databases, secrets, domains, OAuth clients, email senders, and storage for:

1. Local development
2. Staging
3. Production

Never point staging at the production database.

## Build and migrate

```bash
cd backend
npm ci
npm run typecheck
npm test
npm run build
npm run db:migrate
npm run start:compiled
```

Migrations must run once against the target database before the new application receives traffic.

## Health and readiness

- `/health` reports backend and database state plus a redacted readiness summary.
- `/api/v1/deployment-readiness` reports configuration checks without exposing secret values.

A 200 health response does not mean legal review, backups, provider approval, or pilot acceptance is complete.

## Docker

`backend/Dockerfile` produces a compiled Node 22 image. `docker-compose.local.yml` starts PostgreSQL, the backend, and the static frontend for local integration work.

## Backups

Use `backend/scripts/backup-postgres.sh` with `DATABASE_URL`. Schedule it through the hosting platform, copy backups off-site, encrypt them, set retention, and perform periodic restores using `restore-postgres.sh` against a non-production database.

## Production gate

Do not invite public users until all failing deployment-readiness checks are cleared, Google/Apple/email callbacks are tested on staging, migrations and rollback are rehearsed, account export/deletion is tested, and a small invitation-only pilot completes task-based testing.
