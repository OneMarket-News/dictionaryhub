# Platform deployment guide

## Build artifact

```powershell
npm.cmd --prefix .\backend ci
npm.cmd --prefix .\backend run typecheck
npm.cmd --prefix .\backend test
npm.cmd --prefix .\backend run build
```

Run the compiled backend with:

```powershell
npm.cmd --prefix .\backend run start:compiled
```

Serve repository HTML, CSS, JavaScript, configuration manifests, and approved
static data from an HTTPS static host. Do not expose `backend/.env`, database
backups, test databases, or source-control metadata.

## Required environment

Start with `backend/config/production.env.example`. Inject secrets through the
deployment platform, not committed files.

Required production controls include:

- persistent `DATABASE_URL`
- HTTPS `FRONTEND_PUBLIC_URL` and `BACKEND_PUBLIC_URL`
- explicit HTTPS `CORS_ORIGIN` values
- `SESSION_COOKIE_SECURE=true`
- supported `SESSION_COOKIE_SAME_SITE`
- `ALLOW_DEVELOPMENT_AUTH=false`
- `EXPOSE_DEVELOPMENT_AUTH_LINK=false`
- `ALLOW_LOCAL_DEVELOPMENT_ORIGINS=false`
- `ALLOW_UNAUTHENTICATED_IMPORT=false`
- `ALLOW_SELF_APPROVAL=false`
- configured email, Google, or Apple identity provider
- bootstrap administrator policy
- long random `IMPORT_SERVICE_TOKEN`
- `REQUEST_LOGGING=true`

Production and staging startup fail before listening when mandatory static
configuration is unsafe or incomplete. Startup also verifies database
reachability.

## Migrations and dataset

Back up the database before deployment. Apply migrations as a distinct release
step:

```powershell
npm.cmd --prefix .\backend run db:migrate
```

Validate and import the HistoryRoot bundle only after migrations succeed:

```powershell
npm.cmd --prefix .\backend run historyroot:plymouth:validate
npm.cmd --prefix .\backend run historyroot:plymouth:import
```

Promote the application only after health, readiness, public reads, governance,
and rollback smoke tests pass.

## Network and security behavior

- CORS accepts only configured origins outside local development.
- Disallowed origins receive a stable 403 response.
- Session cookies are HTTP-only; production requires Secure.
- Mutations require session CSRF or the protected import token path.
- API responses disable framing and MIME sniffing.
- Production responses include HSTS.
- Authentication, account, administration, and governance responses use
  `Cache-Control: no-store`.
- Public errors contain stable codes and request IDs, not stack traces.

## Health, readiness, and logging

- `/health` reports process and database health without returning database
  error text.
- `/api/v1/deployment-readiness` combines static configuration and live
  database reachability.
- Production request logs are one-line JSON containing timestamp, level,
  request ID, method, path, status, and duration.
- Query strings, cookies, authorization values, request bodies, and response
  bodies are deliberately omitted from request logs.

Forward JSON logs to the deployment's protected log service. Alert on startup
failure, readiness failure, repeated 401/403 responses, 5xx rates, slow
requests, migration failure, and backup failure.

## Backup and recovery

Use PostgreSQL-native encrypted backups, off-site retention, and restore drills.
See [Recovery guide](recovery-guide.md). Do not rely on a filesystem copy of
the PostgreSQL data directory while the server is running.
