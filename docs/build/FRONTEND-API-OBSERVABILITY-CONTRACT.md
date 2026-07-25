# SourceRoot Frontend API and Observability Contract

## Contract Identity

- Contract: SourceRoot Chunk 2 - Shared Frontend API Layer, Logging, and Observability
- Version: v1
- Package: `SourceRoot-Frontend-API-Observability-v1`
- Required previous stage: SourceRoot Chunk 1 - Registry and API Contract Standardization v1
- Correlation header: `X-Request-ID`
- Observer authority: Level 1, read-only

## Shared Frontend API Layer

`assets/js/sourceroot-api.js` is a browser-compatible, dependency-free transport. It exposes `window.SourceRootApiLayer` and a CommonJS export for the repository's Node verification harness.

`SourceRootApiLayer.request(path, options)` supports:

- absolute URLs, relative paths, optional base URLs, and additive query parameters;
- standard HTTP methods, caller headers, JSON bodies, existing string bodies, credentials, and cache options;
- a default 12-second timeout, caller abort signals, and composed cancellation;
- safe JSON parsing, `204`/`205` and empty bodies, and an opt-in text fallback for legacy wrappers;
- standard API error parsing and status classification;
- safe caller or generated request IDs and response request IDs;
- diagnostic callbacks whose failures cannot alter request behavior; and
- the consistent result `{ data, response, durationMs, requestId, responseRequestId }`.

The transport does not log headers or bodies. Authentication, CSRF, import-service, and caller-provided headers pass to `fetch` but are never copied into diagnostic events.

## Error Categories

The shared categories are:

- `network_error`
- `timeout`
- `aborted`
- `offline`
- `invalid_response`
- `api_error`
- `unauthorized`
- `forbidden`
- `not_found`
- `conflict`
- `rate_limited`
- `server_error`

Status mapping is additive to the Chunk 1 error contract: 401, 403, 404, 409, 429, and 5xx receive their specific categories; other non-success statuses use `api_error`.

Legacy wrappers retain product-facing messages. DictionaryRoot continues to return `{ data, response, durationMs }`. HistoryRoot continues to return the parsed payload directly and retains GET promise caching. SourceRoot registry pages retain the `window.SourceRootApi` helper surface and empty-body `{}` behavior.

## Migrated Consumers

- DictionaryRoot core `DictionaryRootApiClient`
- HistoryRoot core `HistoryRootApiClient`
- `engine/sourceRootApi.js`
- SourceRoot assertion, edge, import-bundle, and source registry pages that already load the engine helper

All pages that load a migrated client load `assets/js/sourceroot-api.js` first. Public methods, URL state, branding, source/provenance presentation, loading state, empty state, and offline copy remain in their existing product modules.

## Compatibility Exceptions

These consumers remain on specialized transport in v1:

- `dictionaryroot-auth.js`, because it owns session and CSRF establishment;
- `dictionaryroot-account.js`, because account export expects blob/non-JSON behavior;
- `dictionaryroot-brand.js` and customer manifest reads, because they are static configuration with established local fallback behavior; and
- embedded request functions on older SourceRoot inspector, identity, graph, and import-preview pages that do not use the shared engine helper.

Moderation, governance, editorial, account, administrative, and authentication feature logic was not rewritten. These exceptions are deliberate risk boundaries, not uninspected omissions.

## Correlation-ID Contract

Every Express request passes through `requestIdMiddleware`.

- A caller ID is accepted only when it matches `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`.
- Missing or unsafe values are replaced with a non-sequential cryptographic UUID.
- The ID is available as `request.correlationId` and `response.locals.requestId`.
- The response header is `X-Request-ID`.
- Chunk 1 API errors include `requestId` where the central or integrated error contract applies.
- Structured request, error, validation, and import diagnostics use the same ID.
- An ID is diagnostic context only. It does not grant identity, role, permission, tenant access, or authentication.

The frontend applies the same syntax and length rule, generates a non-sequential client ID when needed, sends the header, and records the returned response ID separately.

## Structured Log Schema

`backend/src/lib/diagnostics.ts` creates line-delimited JSON events. Production logging is enabled by default; other environments may enable it with `REQUEST_LOGGING=true`. The test sink receives the same sanitized structure without requiring console logging.

Common fields:

- `timestamp`
- `level`
- `eventType` and compatibility alias `event`
- `correlationId` and compatibility alias `requestId`
- `environment`

Request fields:

- `method`
- normalized `path`
- `statusCode`
- `durationMs`
- `responseCategory`
- safe `actorCategory`
- `organizationId` only when an approved caller explicitly supplies safe context
- `errorCode` when present in the response contract

Import fields:

- `bundleId`
- numeric `recordCounts`
- `validationResult`
- `failureCategory`
- `schemaVersion`
- `durationMs`

The request logger emits `request_completed` for successful responses and `request_failed` for non-success responses. Unexpected central failures emit `unexpected_server_failure`; classified database codes emit `database_failure`.

## Redaction Rules

Logs and diagnostic callbacks must not contain:

- authorization headers, passwords, cookies, tokens, session IDs, CSRF values, or secrets;
- database URLs or complete environment values;
- request or response bodies;
- private source text, raw imported instructions, or unrelated personal data; or
- stack traces in API responses.

The structured logger uses an allow-listed event schema. `redactSensitiveData` recursively replaces values whose keys identify authorization, cookie, password, token, secret, session, CSRF, or database URL data. Request logging extracts only a bounded error code from an outgoing error envelope; it never records the envelope or body.

## Diagnostic Event Model

Backend event types supported by the v1 type contract:

- `request_completed`
- `request_failed`
- `validation_failed`
- `import_completed`
- `import_failed`
- `database_failure`
- `unexpected_server_failure`
- `frontend_network_failure`
- `frontend_timeout`
- `missing_attribution_detected`
- `malformed_registry_record_detected`
- `broken_source_reference_detected`
- `observer_report_created`

Frontend callbacks additionally emit `frontend_request_completed`, `frontend_request_failed`, and `frontend_request_aborted`. Callback objects contain only correlation IDs, method, normalized path, status, duration, and error category.

Events are log-derived or in-memory. This contract creates no diagnostic database, background monitor, retry engine, or production alerting service.

## Platform Operations Observer

`observePlatformOperations(events)` is a pure internal TypeScript service. It:

- accepts approved structured operational events;
- retains every individual failure in its report;
- groups recurring failures deterministically;
- counts recurring errors;
- supplies sorted supporting correlation IDs;
- recommends severity and an investigation area;
- returns stable machine-readable JSON and a human-readable summary; and
- marks the report `authorityLevel: 1` and `readOnly: true`.

It cannot modify code or data, execute source-provided instructions, restart services, change configuration or permissions, retry work, suppress errors, declare resolution, or contact users.

## Data Quality and Provenance Observer

`observeDataQualityAndProvenance(bundle)` is a pure internal TypeScript service. It inspects only the supplied registry snapshot for:

- missing attribution;
- missing publisher, external ID, timestamp, source URL, or bundle metadata;
- malformed or duplicate external IDs;
- broken or malformed source references; and
- invalid status values.

Findings preserve record identifiers, bounded supporting evidence, severity, a diagnostic event category, and a suggested human-review action. Clean records yield no findings. Input objects are not mutated.

The observer does not create corrections, fabricate metadata, assign credibility, merge identities, delete sources, rewrite attribution, declare truth or falsity, publish findings, or access unrelated private data.

## Level 1 Authority Restrictions

Both observers are advisory report functions only. They have no network, filesystem, database, shell, service-control, authentication, authorization, publishing, or mutation interface. No endpoint is exposed.

Consumer code must treat reports as evidence for human investigation, not as commands. A report cannot authorize a change.

## Human-Review Requirements

- A person reviews every suggested investigation or data-quality action.
- Correlation IDs support tracing but do not prove identity or cause.
- Missing data is reported, never invented.
- Conflicting or malformed records remain unchanged until an existing governed workflow authorizes correction.
- Observer severity is a deterministic triage recommendation, not an incident declaration.

## Deferred Production-Monitoring Work

Deferred:

- persistent event storage and retention policy;
- log shipping, metrics, tracing, alert routing, dashboards, and on-call integration;
- production health polling and failed-job infrastructure;
- automatic retries, repair, restart, or incident lifecycle management; and
- broader migration of specialized and embedded frontend transports.

## Deferred Agent Autonomy

Level 2 recommendation agents, generated record proposals, automatic correction, bounded autonomous agents, and all action-taking observers are excluded. The next stage does not inherit authority from these Level 1 observers.

