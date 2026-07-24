# Platform installation guide

## Supported topology

The development topology is one PostgreSQL database, one SourceRoot API
process, and one static-file server. DictionaryRoot and HistoryRoot share the
generic SourceRoot API and database while retaining separate manifests and
customer interfaces.

## 1. Clone

```powershell
git clone https://github.com/OneMarket-News/dictionaryhub.git
Set-Location .\dictionaryhub
git switch release/historyroot-alpha-integration-v1
```

Do not copy `node_modules`, `.env`, database dumps, browser profiles, or
sessions from another checkout.

## 2. Configure PostgreSQL

Docker option:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
docker compose -f .\docker-compose.local.yml up -d postgres
```

Native option:

1. Install PostgreSQL 16.
2. Create a database named `sourceroot`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Set `DATABASE_URL` to the local database.

The setup helper performs the environment copy, deterministic npm install, and
migrations:

```powershell
powershell -ExecutionPolicy Bypass -File .\SETUP-DICTIONARYROOT-GOVERNED-PLATFORM.ps1 -UseDocker
```

Omit `-UseDocker` when PostgreSQL is already running.

## 3. Install and migrate

Manual equivalent:

```powershell
npm.cmd --prefix .\backend ci
npm.cmd --prefix .\backend run db:migrate
```

Migrations are transactional, recorded by filename in `schema_migrations`, and
safe to rerun. Never edit an applied migration. The two historical migration
005 files are distinct filenames and intentionally remain ordered legacy
records.

## 4. Validate and import HistoryRoot

```powershell
npm.cmd --prefix .\backend run historyroot:plymouth:validate
npm.cmd --prefix .\backend run historyroot:plymouth:import
```

The import is idempotent for the Plymouth bundle and replaces only records
owned by that bundle.

## 5. Import DictionaryRoot

The repository includes the 500-sense pilot bundle. Start the backend:

```powershell
npm.cmd --prefix .\backend start
```

Then run in another terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\IMPORT-DICTIONARYROOT-PILOT.ps1
```

The development environment permits this local import. Production requires an
authenticated `source.import` user with CSRF protection or the configured
service token.

## 6. Start the frontend

```powershell
py -m http.server 8080
```

The all-in-one launcher is also available:

```powershell
powershell -ExecutionPolicy Bypass -File .\START-DICTIONARYROOT-GOVERNED-PLATFORM.ps1
```

It starts only the backend and static frontend; it does not start PostgreSQL or
import data.

## 7. Confirm installation

1. `GET http://localhost:3000/health` returns `status: ok`.
2. `GET http://localhost:3000/api/v1/deployment-readiness` reports the local
   configuration and database reachability.
3. DictionaryRoot exact search resolves a committed pilot word.
4. HistoryRoot displays the Plymouth dataset.
5. Logged-out HistoryRoot remains public.
6. Governance requires a valid SourceRoot session.

Release engineers can exercise the complete blank-database migration and
HistoryRoot import/replacement/removal lifecycle with:

```powershell
npm.cmd --prefix .\backend run verify:fresh-install
```

The command requires a PostgreSQL administrator connection in `DATABASE_URL`.
It creates and drops only a randomly named `sourceroot_install_*` database.

## Dataset removal

HistoryRoot removal is explicitly allow-listed:

```powershell
npm.cmd --prefix .\backend run historyroot:plymouth:remove
```

The command removes only the Plymouth bundle. It does not remove DictionaryRoot
or unrelated SourceRoot bundles.
