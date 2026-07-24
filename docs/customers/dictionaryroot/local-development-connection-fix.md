# DictionaryRoot Local Development Connection Fix v1.0.1

## Diagnosis

The Source Experience read endpoints are public. `GET /api/v1/sources` does not require an authenticated account or a permission, and the frontend authentication client falls back to an anonymous read-only session when no user is signed in.

The local browser failure was caused by origin and hostname handling:

- SourceRoot accepted `localhost:8080` and `127.0.0.1:8080` by default.
- VS Code Live Server was serving DictionaryRoot from port `5500`.
- PowerShell health requests succeeded because they did not include a browser `Origin` header.
- The browser included an origin such as `http://127.0.0.1:5500`, which was rejected by CORS.
- The frontend defaulted to `localhost:3000` even when the page was opened on `127.0.0.1`, which can also interfere with local session cookies.

## Changes

1. In explicit development mode, SourceRoot accepts HTTP loopback origins on any local port.
2. Production and staging continue to require the explicit `CORS_ORIGIN` allowlist.
3. The frontend aligns the API hostname with the page hostname when both are loopback names.
4. Source registry reads remain public for guest users.
5. A targeted CORS regression test covers `localhost:5500`, `127.0.0.1:5500`, and production rejection.

## After installation

Restart the backend:

```powershell
cd "C:\Users\Josh\Documents\GitHub\dictionaryhub\backend"
npm.cmd run dev
```

Open either:

- `http://localhost:5500/sources-v2.html`
- `http://127.0.0.1:5500/sources-v2.html`

Then refresh with `Ctrl+F5`.

## Security boundary

The loopback expansion only applies when `NODE_ENV=development` and `ALLOW_LOCAL_DEVELOPMENT_ORIGINS=true`. Staging and production examples explicitly set it to `false`. Credentialed CORS remains enabled without introducing a wildcard origin.
