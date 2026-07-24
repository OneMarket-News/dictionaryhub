# Developer quick start

## Prerequisites

- Git
- Node.js 22 or newer
- npm
- PostgreSQL 16, or Docker Desktop
- Python 3 for the repository's static development server

## Clone and initialize

```powershell
git clone https://github.com/OneMarket-News/dictionaryhub.git
Set-Location .\dictionaryhub
git switch release/historyroot-alpha-integration-v1
powershell -ExecutionPolicy Bypass -File .\SETUP-DICTIONARYROOT-GOVERNED-PLATFORM.ps1 -UseDocker
```

Without Docker, create a PostgreSQL database named `sourceroot`, copy
`backend/.env.example` to `backend/.env`, update `DATABASE_URL`, and run:

```powershell
npm.cmd --prefix .\backend ci
npm.cmd --prefix .\backend run db:migrate
```

## Load the product data

HistoryRoot imports directly through the transaction-safe import service:

```powershell
npm.cmd --prefix .\backend run historyroot:plymouth:validate
npm.cmd --prefix .\backend run historyroot:plymouth:import
```

Start the backend before importing the committed DictionaryRoot pilot through
the protected development import route:

```powershell
npm.cmd --prefix .\backend start
```

In another terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\IMPORT-DICTIONARYROOT-PILOT.ps1
py -m http.server 8080
```

Use `python -m http.server 8080` if the Windows `py` launcher is unavailable.

## Open the products

- DictionaryRoot: `http://localhost:8080/index.html`
- HistoryRoot: `http://localhost:8080/historyroot.html`
- Governed HistoryRoot: `http://localhost:8080/history-governance-v1.html`
- Account: `http://localhost:8080/account-v1.html`
- API health: `http://localhost:3000/health`
- Deployment readiness: `http://localhost:3000/api/v1/deployment-readiness`

Local development authentication is enabled only by the development example.
Never use it in staging or production.

## Verify

```powershell
npm.cmd --prefix .\backend run typecheck
npm.cmd --prefix .\backend test
npm.cmd --prefix .\backend run historyroot:plymouth:validate
powershell -ExecutionPolicy Bypass -File .\VERIFY-HISTORYROOT-ALPHA-INTEGRATION-V1.ps1
```
