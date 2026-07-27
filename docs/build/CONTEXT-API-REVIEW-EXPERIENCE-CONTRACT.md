# SourceRoot Context API and Review Experience Contract

## Contract identity

- Stage: SourceRoot Chunk 5 — Context API and Review Experience v1
- Contract version: v1
- Registry API Contract: `1.0`
- Target customer experience: HistoryRoot
- Data authority: existing normalized SourceRoot contextual tables
- Write behavior: none

## Scope

This contract defines a composed, read-only projection for reviewing contextual claims and a HistoryRoot page that consumes it. The projection gathers accepted claim wording, immutable version lineage, reporting context, explicit attribution, evidence roles, locators, related claims, source provenance, and field provenance without adding a parallel domain model.

The review page is a human inspection surface. It is not an editor, moderation dashboard, truth engine, claim-ranking system, or conflict resolver.

## Semantic distinctions

- A core SourceRoot assertion remains a node-linked registry object. A contextual claim remains an existing contextual record connected to a subject and reporting account.
- A reporting account contains or reports a claim. Its author is not automatically the claim's assertor.
- Attribution states who is explicitly associated with a claim and in what supplied role. Missing attribution is not inferred.
- A source association proves provenance or reporting context only. It does not automatically support the factual content of a claim.
- Evidence supports, disputes, qualifies, contextualizes, corroborates, contradicts, or supplies neutral background only when an explicit normalized link says so.
- Legacy evidence associations retain an unclassified legacy state. `evidenceType` is not converted into a normalized support role.
- Interpretation remains a separate contextual reading or conclusion. The review projection does not turn it into a truth result.
- The logical claim row is the mutable current projection. An immutable claim version is a historical content record. Corrected, retracted, superseded, and restored history remains present.
- Claim-scoped confidence, link-scoped confidence, evidence confidence, source quality, and provenance support type remain separate values.

## API routes and projections

### Record review

`GET /api/v1/context/review/records/:recordId`

Accepted query parameters:

- `page`: positive integer, default `1`
- `limit`: integer `1`–`100`, default `25`
- `q`: optional visible-claim label, statement, type, or ID filter
- `status`: optional exact contextual record status

The response preserves Registry API Contract `1.0` collection fields and includes:

- `record`: the visible contextual subject record
- `claims` and `items`: deterministic summaries of visible claims for that subject
- exact pagination totals and `hasMore`
- each claim's stable ID, wording, type, status, confidence, uncertainty, current-version ID, explicit attribution roles, and bounded section counts
- response request ID and registry metadata

Claims order by case-insensitive label, then stable claim ID.

### Claim review

`GET /api/v1/context/review/claims/:claimId`

Accepted query parameters:

- `version`: optional immutable claim-version ID
- `versionsPage`, `evidencePage`, `relationsPage`, `provenancePage`: positive integers
- `versionsLimit`, `evidenceLimit`, `relationsLimit`, `provenanceLimit`: integers `1`–`50`, default `25`

The response includes:

- the visible parent record and logical claim
- the reporting account when visible
- current-version ID and safe current-version fields
- requested/selected version and an explicit display state
- bounded immutable version lineage
- bounded explicit attribution records grouped by supplied role
- bounded evidence links grouped by explicit support role
- bounded related claims grouped by relationship type
- bounded field provenance grouped by field path
- a bounded set of public referenced sources
- exact section counts, pagination, partial-data diagnostics, Registry Contract version, and request ID

Evidence entries include their stable link identity, targeted claim-version ID, explicit role, scope, relevance, scoped confidence/uncertainty, the visible evidence record, its safe current version, up to 20 exact source locators, exact locator count, up to 20 field-provenance records, and exact provenance count.

### Search integration

Existing search response shapes remain compatible. Additive contextual metadata provides:

- logical claim: `claimId`, `parentRecordId`, current statement, current-version ID, current match state, and a review URL
- historical claim version: stable claim ID, matched-version ID, parent record ID, current-version ID, current statement, historical matched statement, historical match state, and a version-specific review URL

Draft claim versions are excluded from public search.

## Visibility and governance rules

- Context records with status `governance-withdrawn` are not returned as primary or related public review records.
- Claim and evidence versions with status `draft` are excluded from the review projection and public search.
- Sources are returned only when `raw_data.governanceVisibility` is public or absent.
- Hidden or unavailable child records do not cause visible primary claim data to disappear. The response reports a partial-data diagnostic without exposing the hidden payload.
- Governance proposal bodies, moderation-only data, unpublished draft versions, and private source details are not projected.
- The routes are GET-only. No POST, PUT, PATCH, or DELETE review route exists.
- Review requests do not write database state.

## Pagination and ordering

All variable-length review collections are bounded. Totals have exact semantics.

- Record claims: label ascending, stable claim ID ascending
- Versions: ordinal, creation time, stable version ID
- Attributions: role, stable attribution ID
- Evidence: support role, evidence ID, link ID
- Relations: relationship type, related claim ID, relation ID
- Field provenance: field path, provenance ID
- Sources: source name, source ID
- Evidence locators: locator type, locator ID

Unknown query names are reported through Registry Contract metadata. Invalid bounds fail with the standard validation envelope.

## URL state

The HistoryRoot review URL is:

`history-context-review-v1.html?record=<recordId>&claim=<claimId>&version=<versionId>&from=<origin>`

- `record` or `claim` is required.
- `version` requires `claim`.
- IDs use the same bounded identifier syntax as the API.
- Record-only state deterministically selects the first visible claim and replaces the URL.
- Claim-only state resolves the parent record from the API and replaces the URL.
- `version` selects immutable historical wording.
- `from` preserves the HistoryRoot entry context.
- Selection changes use `pushState`; canonicalization uses `replaceState`; `popstate` restores review state.
- A missing or hidden requested version produces an explicit message and current-claim fallback, never fabricated history.

## Review interface

The page provides:

1. Record breadcrumb, title, summary, and status.
2. Filterable, paginated claim selector.
3. Primary claim wording and explicit current, historical, legacy, or missing-pointer state.
4. Current-wording comparison while a historical version is selected.
5. Reporting account and explicit attribution roles.
6. Claim-provenance sources, separated from evidence.
7. Evidence groups with roles, target versions, locators, and scoped confidence.
8. Related-claim groups with directional relationship types.
9. Immutable version timeline with predecessor/successor and governance-safe lineage fields.
10. Field-level provenance.
11. Partial-data and request-ID diagnostics.

No editorial action control is present.

## Current and historical behavior

- `current` means the selected immutable version matches the visible current pointer.
- `historical` means a visible non-current version was explicitly selected.
- `legacy-current` means no immutable version rows exist; the logical claim projection is shown without inventing history.
- `current-pointer-missing` means immutable history exists but no visible current pointer can be resolved; the logical projection is shown with a warning.
- Retraction and supersession are labels and lineage states, not deletion.
- Restored or rolled-back versions do not hide intervening versions.

## Provenance and evidence behavior

Provenance answers where a record or field came from. Evidence answers how an explicitly linked record bears on a claim or claim version. The API and page keep separate headings, groups, confidence values, and empty states for those concepts.

A source referenced by an account, attribution, relationship, version, locator, or field-provenance record may appear in the source projection. Its presence does not create evidence. Only an explicit evidence-claim link creates a normalized evidence role.

## Legacy data behavior

Legacy claims remain reviewable without immutable versions. Legacy evidence attached through `context_evidence.claim_context_id` remains visible when no normalized link supersedes that association, but its role is `legacy_unclassified`. No support, dispute, attribution, current pointer, or version is inferred.

## Accessibility

- The page retains a semantic `main`, breadcrumb `nav`, claim-selector `aside`, headings, sections, labels, buttons, and diagnostics disclosure.
- Loading and selection changes use polite live regions.
- Failure states use the shared accessible state renderer.
- The primary review section can receive programmatic focus after selection.
- Keyboard focus is visibly styled.
- Current/historical/role distinctions include text and are not communicated by color alone.
- Responsive breakpoints support desktop, tablet, and narrow mobile layouts.

## Error handling

- Malformed review IDs: `400 INVALID_CONTEXT_REVIEW_ID`
- Missing visible record: `404 CONTEXT_REVIEW_RECORD_NOT_FOUND`
- Missing visible claim: `404 CONTEXT_REVIEW_CLAIM_NOT_FOUND`
- Missing or hidden version: `404 CONTEXT_REVIEW_VERSION_NOT_FOUND`
- Invalid pagination: accepted Registry validation envelope
- Malformed API response: explicit unexpected-response state
- Permission denial, timeout, abort, offline/network failure, no claims, and missing child data have distinct states
- Request IDs are returned by the API and shown in diagnostics or error detail when available
- A stale or aborted request cannot overwrite a newer selection

## Security

- IDs are bounded and validated before query execution.
- SQL values are parameterized.
- Public projections filter withdrawn records, draft versions, and nonpublic sources.
- Variable-length data is paginated or capped.
- Untrusted content is rendered through DOM `textContent`/text-node helpers; the controller does not use `innerHTML`.
- External links accept only HTTP or HTTPS and use `noopener noreferrer`.
- No external retrieval, scraping, semantic inference, or AI generation occurs.
- No secret, connection string, moderation payload, or raw governance proposal is projected.

## Explicit exclusions

This stage adds no public write operation, editor, governance dashboard, truth score, automatic ranking, automatic conflict resolution, AI summary, semantic inference, embedding, vector search, external retrieval, web scraping, calendar conversion, entity merge, authentication/permission redesign, multitenancy, billing, deployment change, production monitoring system, BibleRoot expansion, broad HistoryRoot/DictionaryRoot redesign, frontend framework, mobile application, or future chunk work.

## Compatibility commitments

This contract preserves Registry API Contract `1.0`, request IDs, existing logging and diagnostics, all ten contextual record kinds, core assertions, contextual claims, Chunk 4 immutable history/current pointers, import idempotency, replacement retention, governance publication/rollback, existing SourceRoot routes, DictionaryRoot customer pages, HistoryRoot graph/timeline/sources/records, account/workflow/editorial/moderation/authentication behavior, shared navigation/branding, `raw_data`, and existing URL state.

## Test evidence

- Focused backend API suite: `backend/test/context-api-review-experience.test.ts` — 24 cases
- Frontend verification: `verification/context-review-experience.test.cjs` — 15 cases
- The authoritative stage verifier also runs typecheck, test migration against `sourceroot_test`, all accepted contextual/Registry/governance/observability suites, the full backend suite, existing frontend verification, SourceRoot/DictionaryRoot/HistoryRoot verification, package byte checks, and immutable Chunk 0–4 replay.
