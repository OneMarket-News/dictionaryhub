# SourceRoot Backend Starter

First working SourceRoot backend service.

## Implemented

- `GET /health`
- `POST /api/v1/validate`
- TypeScript server
- Express 5 API
- optional PostgreSQL health probe
- port of the current browser validator
- request IDs
- JSON body-size limit
- CORS configuration
- graceful shutdown
- fixture and endpoint tests

## Setup

```bash
npm install
cp .env.example .env
npm test
npm run dev
```

Open:

```text
http://localhost:3000/health
```

Validate HistoryRoot from a second terminal:

```bash
curl -X POST http://localhost:3000/api/v1/validate \
  -H "Content-Type: application/json" \
  --data-binary @test/fixtures/historyroot-valid.json
```

Expected result:

```text
status: ready
errors: 0
warnings: 0
```

## PostgreSQL

The first milestone does not require a database. When `DATABASE_URL` is set,
`GET /health` performs a real `SELECT 1` database check. The next milestone can
apply the SQL blueprint and persist validation events and bundles.

## Validation response behavior

A structurally valid HTTP request always receives `200`, even when the bundle is
blocked. The body contains `status`, `canImport`, `errors`, and `warnings`.
Malformed request JSON receives `400`.
