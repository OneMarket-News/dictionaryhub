# SourceRoot Registry API Contract

## Contract Identity

- Contract: SourceRoot Registry API Contract
- Version: `1.0`
- Stage: SourceRoot Chunk 1 — Registry and API Contract Standardization v1
- API family: `/api/v1`
- Compatibility policy: additive; existing routes, status codes, collection keys, and record fields remain available

This contract describes the repository as it exists. It does not introduce a second API framework, cursor pagination, a new schema, or a migration.

## Contract Categories

SourceRoot routes fall into five categories:

1. **Registry collection** — a pageable set of public records. The shared collection envelope applies.
2. **Single record** — one record or a route-specific not-found error. No collection envelope applies.
3. **Aggregate or relationship** — a purpose-built projection such as node edges or a dashboard. Its existing shape remains authoritative.
4. **Mutation or validation** — a command result. Its existing success shape remains authoritative; errors follow the common error vocabulary where integrated.
5. **Identity, account, administration, or workflow** — a protected domain contract. It is not reclassified as a public registry merely because it returns an array.

## Collection Response Requirements

Standardized registry collections return their legacy fields plus these additive fields:

```json
{
  "page": 1,
  "limit": 25,
  "total": 42,
  "totalPages": 2,
  "items": [],
  "nodes": [],
  "contractVersion": "1.0",
  "offset": 0,
  "returned": 0,
  "hasMore": true,
  "totalSemantics": "exact",
  "appliedFilters": {},
  "appliedSort": {
    "field": "title",
    "direction": "asc",
    "tieBreaker": "nodeId:asc"
  },
  "pagination": {
    "page": 1,
    "limit": 25,
    "offset": 0,
    "returned": 0,
    "total": 42,
    "totalPages": 2,
    "hasMore": true,
    "totalSemantics": "exact"
  },
  "registry": {
    "resource": "nodes",
    "legacyCollectionKeys": ["nodes"],
    "ignoredQueryParameters": []
  }
}
```

The route-specific legacy key varies:

| Resource | Standard key | Preserved legacy key |
|---|---|---|
| Nodes | `items` | `nodes` |
| Assertions | `items` | `assertions` |
| Edges | `items` | `edges` |
| Sources | `items` | `sources` |
| Revisions | `items` | `revisions` |
| Imported bundle metadata | `items` | `bundles` |
| Search | `items` | `results` |
| Context collections | `items` | `entities`, `temporalAssertions`, `accounts`, `claims`, `evidence`, `interpretations`, `perspectives`, `causesConsequences`, `relationships`, or `culturalMemories` |

`returned` is always `items.length`. `hasMore` is true when `offset + returned < total`. Route-specific metadata belongs under `registry`.

### Total Semantics

- `exact` — the endpoint executes or already executed an exact count using the same visibility and filter conditions as the records query.
- `estimated` — reserved for an endpoint that uses a documented estimate. No v1 standardized route currently uses it.
- `unavailable` — reserved for a collection that cannot determine a safe total. No v1 standardized route currently uses it.

The v1 routes retain their existing exact count queries; the stage adds no new expensive count query.

## Pagination Requirements

- Canonical existing parameters: `page` and `limit`.
- Additive position parameter on standardized registries: `offset`.
- Default page: `1`.
- Default limit: `25`, except an endpoint whose preserved specialized contract documents another default.
- Minimum limit: `1`.
- Maximum public registry limit: `100`.
- `page` must be a positive base-10 integer.
- `offset` must be a non-negative base-10 integer.
- An explicit `offset` cannot be combined with an explicit `page`; the combination is rejected as ambiguous.
- With `offset`, the compatibility `page` value is `floor(offset / limit) + 1`.
- Excessive limits are rejected rather than silently clamped. `clampLimit` exists for trusted defaults and internal callers, not to hide invalid HTTP input.
- An offset beyond the result set returns HTTP 200 with empty `items`, the legacy empty key, exact `total`, `returned: 0`, and `hasMore: false`.
- Every standardized list has a deterministic primary ordering and an ascending immutable-ID tie-breaker.

Search retains page/limit pagination and reports the derived offset. Explicit search `offset` is a documented v1 exception because DictionaryRoot complete-lemma enrichment has page-one semantics.

## Filtering Requirements

- Route-specific filters are trimmed with the shared `getQueryString` and represented in `appliedFilters` only when non-empty.
- Empty or whitespace-only filters behave as absent.
- String equality filters are case-sensitive unless a route already documents otherwise. Search text matching remains case-insensitive.
- Identifiers are opaque strings; the registry layer does not reinterpret them.
- Import date filters retain ISO-8601 parsing. Context date filters retain strict `YYYY-MM-DD` parsing.
- Context enum filters retain their existing allow-lists.
- Existing multi-value domain filters are not added by this stage. Specialized workflow routes retain their existing parsing.
- Unknown query names on public registries are ignored for backward compatibility and listed in `registry.ignoredQueryParameters`. They never become SQL identifiers.
- Unsupported values for a recognized enum, sort, direction, pagination, date, or search-type parameter are rejected.
- Assertions and edges now apply the already client-sent `sourceId` filter through their normalized association tables. Returned totals are exact for that association.

## Sorting Requirements

Canonical parameters are `sort` and `direction`. Directions are `asc` and `desc` (case-insensitive). Sort fields are case-sensitive.

| Resource | Default | Allowed sort fields | Stable tie-breaker |
|---|---|---|---|
| Nodes | `title asc` | `title`, `createdAt`, `updatedAt`, `nodeId` | `nodeId asc` |
| Assertions | `label asc` | `label`, `createdAt`, `updatedAt`, `assertionId` | `assertionId asc` |
| Edges | `label asc` | `label`, `createdAt`, `updatedAt`, `edgeId` | `edgeId asc` |
| Sources | `name asc` | `name`, `createdAt`, `updatedAt`, `sourceId` | `sourceId asc` |
| Revisions | `createdAt desc` | `createdAt`, `updatedAt`, `revisionId` | `revisionId asc` |
| Imported bundles | `createdAt desc` | `createdAt`, `updatedAt`, `bundleId` | `bundleId asc` |
| Context records | `label asc` | `label`, `createdAt`, `updatedAt`, `recordId` | `recordId asc` |
| Search | fixed `relevance asc` | `relevance` | `title asc`, `resultType asc`, `id asc` |

Only allow-listed server-side SQL fragments are used. Query text is never interpolated as a column or direction.

## Error Contract

Integrated errors expose:

```json
{
  "error": "INVALID_LIMIT",
  "code": "INVALID_LIMIT",
  "message": "limit must be an integer between 1 and 100.",
  "status": 400,
  "category": "invalid-pagination",
  "field": "limit",
  "details": {
    "value": "101"
  },
  "requestId": "bounded-request-id"
}
```

`error` is preserved as the legacy machine-readable key. `code` is its standard alias. `message` remains human-readable. `details` is optional and must contain only safe, allow-listed context.

| Category | Typical HTTP status | Current examples |
|---|---:|---|
| `invalid-query` | 400 | missing search query, invalid identifier |
| `invalid-pagination` | 400 | invalid page, limit, or offset |
| `invalid-filter` | 400 | invalid search type, date, or context enum |
| `invalid-sort` | 400 | unsupported sort field or direction |
| `validation-failure` | 400, 413, 422 | malformed JSON, body limit, invalid import |
| `not-found` | 404 | missing record, bundle, or route |
| `conflict` | 409 | existing governed-workflow conflicts |
| `unauthorized` | 401 | existing authentication requirement |
| `forbidden` | 403 | existing permission or CORS denial |
| `internal-error` | 500 | unexpected application failure |

The contract does not expose stack traces, SQL, credentials, environment values, authentication secrets, or unnecessary filesystem paths. Specialized identity/governance validation errors retain their existing protected contract in v1.

## Registry Metadata

Terminology is standardized as follows:

| Term | Meaning |
|---|---|
| Record ID | Stable internal API identity, exposed by a resource-specific key such as `nodeId` or `contextId` |
| External ID | An identity assigned by an upstream source, only when actually stored in record metadata |
| Bundle identity | `bundleId`, identifying the imported dataset boundary |
| Schema version | Version of a stored bundle or record schema when provided by the source; never synthesized |
| Contract version | `contractVersion`, currently `1.0` |
| Created timestamp | `createdAt`, when the normalized row was created |
| Updated timestamp | `updatedAt`, when the normalized row was last updated |
| Imported timestamp | The persisted import creation time when represented by imported-bundle `createdAt`; no separate value is fabricated |
| Retrieved timestamp | Upstream retrieval time only when source metadata contains it |
| Published timestamp | Governance publication time only on an existing publication record |
| Revision timestamp | Revision `createdAt` or `updatedAt`, according to the operation being described |
| Record status | Resource-specific `status` on nodes, revisions, and context records |
| Source status | Existing `reviewStatus`, `verificationStatus`, `licenseStatus`, and visibility metadata; these dimensions are not collapsed |
| Dataset version | Imported bundle `version` |

Nullable fields stay nullable. The stage does not create fake timestamps or infer external identities.

## Archive and Deprecation Conventions

- **Delete** removes a record. It is reserved for narrow, authorized, test-bundle or account workflows already implemented.
- **Archive** makes a record inactive while retaining it. No universal archive column exists in v1.
- **Deprecate** advises consumers to stop using a record or contract while it remains resolvable. No universal deprecation column exists in v1.
- **Supersede** links an older record to a replacement. A universal relationship requires future schema work.
- **Correct** changes an error while preserving provenance through existing governance and revision mechanisms.
- **Retract** withdraws a claim or publication without erasing its historical existence. Existing governance statuses remain authoritative.

Existing statuses include resource-defined values such as node/context/revision status, source review and verification status, proposal workflow status, moderation report status, and `governance-withdrawn` context visibility. They are not interchangeable.

Archive, deprecation, supersession, correction, and retraction terminology is documentation-only where no existing field or workflow supports it. Conflicting or historical records must not be silently deleted. Future schema work must define explicit relationships, actor, reason, and timestamp before universal archive or supersession state is added.

## Route-Contract Matrix

The matrix records every current route family. “Legacy” means its existing success shape is retained.

| Route | Method | Purpose | Existing response shape | Query parameters | Pagination | Filters | Sort | Error behavior | Current frontend consumers | Standardization action | Compatibility behavior | Deferred exception |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/health`, `/api/v1/deployment-readiness` | GET | Health and readiness | Aggregate object | none | none | none | none | route/central errors | API clients and operators | Inspected; unchanged | exact legacy object | Not a registry |
| `/api/v1/validate` | POST | Validate a bundle | Validation result | none | none | body validation | none | legacy validation issues | import tooling/tests | Inspected; unchanged | status and shape preserved | Mutation/validation category |
| `/api/v1/import` | POST | Persist a validated bundle | Import result | none | none | body validation | none | auth/422/central | import tooling | Inspected; unchanged | authorization and result preserved | Mutation category |
| `/api/v1/import` | GET | List imported bundle metadata | `items`, `bundles`, totals | page, limit, offset, sort, direction, bundleId, domain, bundleType, version, createdFrom, createdTo | standard/exact | trimmed equality and ISO dates | allow-listed, stable | standard additive | DictionaryRoot and HistoryRoot bundle checks | Full collection contract | `bundles` retained | none |
| `/api/v1/import/:bundleId` | GET | Retrieve imported bundle | Bundle object | none | none | path ID | none | standard additive 404 | import tooling | Not-found standardized | bundle object unchanged | Not a collection |
| `/api/v1/import/:bundleId` | DELETE | Delete allow-listed test bundle | Deletion result | none | none | path prefix policy | none | legacy auth/403/404 | tests/tools | Inspected; unchanged | security boundary preserved | Mutation category |
| `/api/v1/nodes` | GET | List nodes | `items`, `nodes`, totals | standard + bundleId, domain, nodeType, status | standard/exact | equality | title/timestamps/ID | standard additive | DictionaryRoot API/client/pages, HistoryRoot | Full collection contract | `nodes` and fields retained | none |
| `/api/v1/nodes/:nodeId` | GET | Retrieve node | Node object | none | none | path ID | none | standard additive 404 | DictionaryRoot concept/graph | Not-found standardized | node object unchanged | none |
| `/api/v1/nodes/:nodeId/assertions` | GET | Node assertions | Relationship aggregate | none | none | path ID | assertion ID | standard additive parent 404 | DictionaryRoot concept/graph | Inspected; parent error standardized | aggregate keys retained | Not pageable in v1 |
| `/api/v1/nodes/:nodeId/edges` | GET | Incoming/outgoing edges | Relationship aggregate | none | none | path ID | edge ID | standard additive parent 404 | DictionaryRoot concept/graph | Inspected; parent error standardized | aggregate keys retained | Not pageable in v1 |
| `/api/v1/assertions` | GET | List assertions | `items`, `assertions`, totals | standard + bundleId, nodeId, sourceId, domain, type/status dimensions | standard/exact | equality + source association | label/timestamps/ID | standard additive | DictionaryRoot source/concept clients | Full collection contract; sourceId applied | `assertions` retained | none |
| `/api/v1/assertions/:assertionId` | GET | Retrieve assertion | Assertion object | none | none | path ID | none | standard additive 404 | API consumers | Not-found standardized | object unchanged | none |
| `/api/v1/edges` | GET | List edges | `items`, `edges`, totals | standard + endpoints, sourceId, domain, relationship/status dimensions | standard/exact | equality + source association | label/timestamps/ID | standard additive | DictionaryRoot source/graph clients | Full collection contract; sourceId applied | `edges` retained | none |
| `/api/v1/edges/:edgeId` | GET | Retrieve edge | Edge object | none | none | path ID | none | standard additive 404 | API consumers | Not-found standardized | object unchanged | none |
| `/api/v1/sources` | GET | List public sources | `items`, `sources`, totals | standard + bundleId, domain, sourceType, publisher, reviewStatus, verificationStatus | standard/exact | equality + existing visibility | name/timestamps/ID | standard additive | DictionaryRoot Sources, HistoryRoot | Full collection contract | `sources` retained | none |
| `/api/v1/sources/:sourceId` | GET | Retrieve public source | Source object | none | none | path ID + visibility | none | standard additive 404 | DictionaryRoot Sources, HistoryRoot | Not-found standardized | object unchanged | none |
| `/api/v1/revisions` | GET | List revisions | `items`, `revisions`, totals | standard + bundleId, objectType, objectId, revisionType, status | standard/exact | equality | timestamps/ID | standard additive | History/HistoryRoot/governance views | Full collection contract | `revisions` retained | none |
| `/api/v1/revisions/:revisionId` | GET | Retrieve revision | Revision object | none | none | path ID | none | standard additive 404 | History views | Not-found standardized | object unchanged | none |
| `/api/v1/bundles/:bundleId/{nodes,assertions,edges,sources,revisions}` | GET | Bundle-scoped registry aliases | bundleId + matching legacy collection | matching registry params | standard/exact | bundle forced + route filters | matching registry sort | standard additive | tests/tools | Full collection contract | bundleId and legacy keys retained | none |
| `/api/v1/search` | GET | Cross-registry search | `results`, totals, lexical coverage | q, page, limit, type, bundleId, domain, sort, direction | page/limit, exact | search type/bundle/domain | fixed relevance, stable | standard additive | DictionaryRoot and HistoryRoot search | Collection envelope and `items` alias added | `results`, ranking, lexical policy retained | Explicit offset unsupported in v1 |
| `/api/v1/context/{collection}` | GET | Ten contextual collections | `items`, route legacy key, totals | standard + existing context filters | standard/exact | equality, enum, date, association | label/timestamps/ID | standard additive | HistoryRoot clients | Full collection contract | all ten legacy keys retained | none |
| `/api/v1/context/{collection}/:contextId`, `/records/:contextId` | GET | Typed/universal context lookup | Context record | none | none | path ID/type | none | standard additive 400/404 | HistoryRoot clients | Errors standardized | record unchanged | none |
| `/api/v1/dictionaryroot/lexicon/neighborhood/:nodeId` | GET | Dynamic lexical neighborhood | Aggregate graph | depth, limit, bundleId | bounded custom | bundle | service-defined | legacy | DictionaryRoot graph | Inspected; unchanged | behavior preserved | Aggregate, not registry |
| `/api/v1/dictionaryroot/lexicon/{status,coverage,dashboard}` | GET | Lexical status/coverage aggregates | Aggregate objects | route-specific q/bundleId | none | route-specific | service-defined | legacy | DictionaryRoot coverage/home | Inspected; unchanged | behavior preserved | Aggregate contracts |
| `/api/v1/dictionaryroot/lexicon/lemmas` | GET | Coverage lemma queue | Specialized collection | page, limit, q, coverage, source, history, review, sort, bundleId | page/limit, default 25 | validated enums | gaps/coverage/senses/lemma | legacy + shared pagination error fields | DictionaryRoot Coverage | Inspected; unchanged | exact UI contract preserved | Offset/direction/envelope deferred |
| `/api/v1/dictionaryroot/editorial/summary` | GET | Editorial aggregate | Summary object | bundleId | none | bundle | none | legacy | DictionaryRoot Editorial | Inspected; unchanged | behavior preserved | Aggregate |
| `/api/v1/dictionaryroot/editorial/queue` | GET | Editorial work queue | Specialized collection | page, limit, q, status, category, partOfSpeech, sort, bundleId | page/limit, default 20 | workflow enums/text | priority/updated/lemma | legacy + shared pagination error fields | DictionaryRoot Editorial | Inspected; unchanged | queue/UI semantics preserved | Offset/direction/envelope deferred |
| `/api/v1/dictionaryroot/editorial/reviews/:nodeId[ /promote ]` | GET/PUT/POST | Review detail/save/promotion | Detail or mutation result | bundleId where used | none | body/path | none | protected legacy | DictionaryRoot Editorial | Inspected; unchanged | auth, CSRF, workflow preserved | Non-registry |
| `/api/v1/dictionaryroot/workflow/*`, `/api/v1/governance/*` | GET/POST/PATCH | Proposal lists/details/transitions/publication/rollback | Workflow-specific objects and lists | proposals: page, limit, status, targetType, rootKey, creator, org, q, sort | page/limit, default 20 | scoped workflow filters | activity/submitted | protected legacy + shared pagination error fields | DictionaryRoot Workflow, HistoryRoot Governance | Inspected; unchanged | double mount, auth, state machine preserved | Shared envelope/offset deferred |
| `/api/v1/moderation/reports` | POST | Submit report | Mutation result | none | none | validated body | none | protected legacy | moderation UI/API | Inspected; unchanged | CSRF and result preserved | Mutation |
| `/api/v1/admin/overview` | GET | Admin aggregate | Overview object | none | none | authorization scope | none | protected legacy | Admin UI | Inspected; unchanged | authorization preserved | Aggregate |
| `/api/v1/admin/users`, `/audit`, `/moderation/reports` | GET | Admin collections | Specialized admin lists | route page/limit plus q/status | page/limit; audit max 200 | scoped admin filters | fixed service order | protected legacy + shared pagination error fields | Admin UI | Inspected; unchanged | permission and UI contract preserved | Envelope/offset/sort deferred |
| `/api/v1/admin/roles`, `/organizations`, organization members, moderation locks | GET | Protected reference lists | Named arrays | path/scope where used | none | authorization scope | fixed service order | protected legacy | Admin UI | Inspected; unchanged | named arrays retained | Small protected lists |
| `/api/v1/admin/*` mutations | POST/DELETE | Roles, organizations, invitations, status, reports, locks | Mutation result | narrow scope params | none | validated body/path | none | protected legacy | Admin UI | Inspected; unchanged | CSRF/permissions preserved | Mutation |
| `/api/v1/auth/*` | GET/POST/DELETE | Provider discovery, sign-in, callback, session, identity unlink, sign-out | Auth-specific object or redirect | OAuth/email token and intent | none | auth-specific | none | protected legacy | DictionaryRoot auth client | Inspected; unchanged | cookie/provider policy preserved | Identity contract |
| `/api/v1/account/*` | GET/PATCH/POST/DELETE | Profile, sessions, invitation, export, deletion | Account-specific objects | path/body | sessions are a bounded named array | account-specific | last-seen service order | protected legacy | Account UI | Inspected; unchanged | auth, CSRF, deletion policy preserved | Not public registry |
| Unknown `/api/v1/*` | any | Missing route | Error object | any | none | none | none | standard additive 404 | all clients | Central error standardized | `error`, `message`, requestId retained | none |

## Compatibility Rules

- Existing collection keys and top-level `page`, `limit`, `total`, and `totalPages` remain.
- Existing record field names remain.
- Existing status codes remain unless a central unhandled error already determined the code.
- Existing search ranking and DictionaryRoot complete-lemma behavior remain.
- Existing exact counts remain; no estimate replaces an exact total.
- Existing frontends require no runtime changes. Their item extractors already prefer `items` and fall back to legacy keys.
- Unknown query names remain ignored and are now visible in metadata, avoiding a breaking rejection.
- Authentication, authorization, CSRF, organization scoping, moderation, publication, and rollback policy are unchanged.

## Deferred Exceptions

Specialized DictionaryRoot lexical/editorial queues, governance proposals, and protected admin collections retain domain-specific envelopes and sorting for v1. They now benefit from richer shared pagination errors because they use the common parser, but offset/direction and the public registry envelope are deferred until their authenticated clients and workflow semantics can be versioned together.

Relationship aggregates, dashboards, health, single-record routes, validation, mutations, authentication, and account routes intentionally do not use a collection envelope.

## Verification Expectations

The contract is verified by `backend/test/registry-api-contract.test.ts`, the full backend suite, TypeScript typecheck, the three Chunk 0 verifiers, and `VERIFY-SOURCEROOT-REGISTRY-API-CONTRACT.ps1`. PostgreSQL tests must use the explicitly test-scoped `.env.test` configuration. Static verification, in-process API tests, independent live API checks, and browser checks must be reported separately.
