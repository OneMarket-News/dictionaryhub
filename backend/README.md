# SourceRoot backend for DictionaryRoot

This service provides the existing SourceRoot validation, import, registry, lexical, search, editorial, and revision APIs plus the DictionaryRoot Governed Platform Foundation.

## Governed platform capabilities

- Email magic-link, Google, Apple, and local development authentication adapters
- Multiple linked identities per stable user account
- HTTP-only sessions, CSRF protection, session revocation, export, and account deletion
- System and organization roles with explicit permission keys
- Organization invitations tied to a verified recipient email
- Draft, review, approval, publication, rollback, evidence, comment, and event records
- Moderation reports, account suspension, publication locks, and audit events
- Deployment-readiness endpoint and local Docker composition

## Local setup on Windows

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run db:migrate
npm.cmd start
```

The default development configuration expects PostgreSQL at `localhost:5432`, the frontend at `http://localhost:8080`, and enables the local-only development sign-in adapter.

Open:

```text
http://localhost:3000/health
http://localhost:3000/api/v1/deployment-readiness
http://localhost:8080/account-v1.html
```

## Local setup with Docker

From the repository root:

```bash
docker compose -f docker-compose.local.yml up
```

Create `backend/.env` first. PostgreSQL data and container `node_modules` use named volumes.

## Required production steps

1. Use a persistent managed PostgreSQL database.
2. Apply every migration in `db/migrations`.
3. Configure HTTPS public frontend and backend URLs.
4. Configure explicit CORS origins and secure cookies.
5. Disable development authentication and exposed development links.
6. Configure Resend or another implemented delivery adapter.
7. Configure Google and/or Apple provider credentials and exact callbacks.
8. Set a long random import service token.
9. Configure backup scheduling, off-site retention, monitoring, and restore drills.
10. Run typecheck, tests, verifier, manual browser testing, and the pilot checklist.

## Database migrations

```bash
npm run db:migrate
```

Migrations are recorded in `schema_migrations` and applied in filename order. Never edit an already-applied migration; add a new numbered migration.

## Tests and build

```bash
npm run typecheck
npm test
npm run build
npm run start:compiled
```

## Protected imports

Production `POST /api/v1/import` and integration-test deletion require either:

- an authenticated account with `source.import`, including CSRF; or
- `X-SourceRoot-Import-Token` matching `IMPORT_SERVICE_TOKEN`.

`ALLOW_UNAUTHENTICATED_IMPORT=true` exists only for legacy local development and is ignored in production.

## Documentation

See:

- `../docs/customers/dictionaryroot/governed-platform-foundation-v1.md`
- `../docs/customers/dictionaryroot/authentication-provider-setup.md`
- `../docs/customers/dictionaryroot/security-and-governance.md`
- `../docs/customers/dictionaryroot/deployment-readiness.md`
- `../docs/customers/dictionaryroot/pilot-readiness-checklist.md`
- `docs/openapi-governance.yaml`
