# SourceRoot Contextual Assertions, Evidence, and Versioning Contract

## Contract identity

- Stage: SourceRoot Chunk 4 — Contextual Assertions, Evidence, and Versioning v1
- Contract version: 1.0
- Migration: `012_refine_contextual_assertions_evidence_versioning.sql`
- Registry API contract: 1.0
- Compatibility base: SourceRoot Chunk 3 — Contextual Identity and Time Refinement v1

## Semantic boundaries

SourceRoot keeps the following concepts distinct:

1. A core SourceRoot `assertion` is a node-linked registry object in the core knowledge model.
2. A contextual `claim` is one of the existing ten contextual record kinds. It records a statement attributed to a historical account and remains a contextual claim; it is not renamed or converted into a core assertion.
3. An account contains or reports a claim. Account authorship does not by itself identify the claim's assertor.
4. Claim provenance establishes that a claim or attribution was recorded. It does not prove the claim true.
5. Evidence is an explicitly supplied basis offered in support of, opposition to, qualification of, or context for a claim.
6. Counterevidence remains the legacy `counterevidence` evidence type. The system does not silently project it to a normalized support role.
7. An interpretation is a separate contextual record expressing a conclusion or reading. It is not a claim, evidence record, or truth result.

No operation in this contract calculates truth probability, credibility, consensus, a winning claim, a canonical claim, or a resolved conclusion. Text similarity, embeddings, AI, and heuristics do not create claim relationships or evidence meanings.

## Compatibility

The existing contextual record registry and all ten record kinds remain unchanged. Existing claim fields, including required `accountId`, and existing evidence fields, including `claimId` and `evidenceType`, remain valid and readable.

All new bundle collections are optional:

- `claimAttributions`
- `claimRelations`
- `claimVersions`
- `evidenceClaimLinks`
- `evidenceVersions`
- `sourceLocators`

A legacy bundle with none of these collections validates and imports without fabricated attribution children, evidence links, or version history. Legacy evidence and counterevidence are not silently assigned `supports` or `disputes`.

## Claim attribution

`claimAttributions` provides normalized, caller-identified attribution records. Supported core roles are:

- `asserted_by`
- `attributed_to`
- `reported_by`
- `recorded_by`
- `issued_by`

The bounded `custom:<token>` extension form is also supported.

An attribution has a stable ID and claim ID, an actor entity and/or account, an optional temporal assertion, source IDs, note, confidence, uncertainty, and lifecycle timestamps on read. Source references are explicit. The importer does not infer the actor from the account author, infer time from database timestamps, or infer publication time from labels.

## Claim relationships

`claimRelations` stores explicit reviewable links:

- `contradicts`
- `qualifies`
- `refines`
- `restates`
- `supersedes`
- `corrects`
- `retracts`
- `derived_from`

The bounded `custom:<token>` extension form is supported.

Each relation retains direction, endpoints, explanation, source IDs, confidence, uncertainty, review status, optional temporal assertion, and read timestamps. Self-links are invalid. A contradiction is symmetric only for duplicate detection; reverse duplicates are rejected. Other meanings remain directional. Relations do not change claim status, delete claims, or resolve competition.

## Evidence-to-claim links

`evidenceClaimLinks` lets one evidence record explicitly address multiple claims or one immutable claim version. Supported roles are:

- `supports`
- `disputes`
- `qualifies`
- `contextualizes`
- `corroborates`
- `contradicts`
- `neutral_or_background`

The bounded `custom:<token>` extension form is supported.

Each link retains a stable ID, evidence ID, claim ID, optional claim-version ID, support role, bounded dotted scope path, explanation, relevance, confidence, uncertainty, sources, and read timestamps. The database and import validator enforce claim-version ownership. Association with a claim or source never creates a support role automatically.

## Source locators

`sourceLocators` stores bounded user/import-supplied location information for evidence without requiring the source work itself. Core locator kinds include pages, volumes, chapters, sections, paragraphs, passages, archive references, document identifiers, URL fragments, timestamps, time ranges, database records, and citations.

The exact `locatorLabel` is preserved. Structured locator data is a bounded scalar object. Optional excerpts are limited to 4,000 characters and are explicitly user/import supplied. SourceRoot does not retrieve source contents, fabricate page numbers, fabricate quotations, or require full copyrighted source text.

## Immutable claim versions

A claim keeps one stable logical `claimId`. `claimVersions` stores immutable snapshots with:

- stable version ID;
- parent claim ID;
- optional positive ordinal;
- optional predecessor in the same claim;
- statement, claim type, subject, and optional object;
- confidence and uncertainty;
- bounded lifecycle status;
- change type and reason;
- attribution snapshot and/or attribution IDs;
- source IDs;
- optional asserted-time temporal assertion;
- deterministic SHA-256 content hash;
- origin;
- creation timestamp; and
- explicit current pointer projection.

The content hash uses recursively key-sorted normalized JSON. Set-like source and attribution ID arrays are deduplicated and sorted. The mutable `current` projection and generated database timestamp are not used as imported content when they were not supplied.

Duplicate version IDs with identical normalized content are idempotent. Reuse with different content is a conflict. Predecessors must belong to the same logical claim, cycles are invalid, and supplied ordinals are unique per claim. Gaps remain gaps; no versions are invented. A versioned parent must supply exactly one `current: true`. Legacy claims need no version rows.

Database triggers reject update or deletion of version rows. Current-version pointers are separate and constrained to a version owned by the same parent.

## Immutable evidence versions

`evidenceVersions` applies the same append-only contract to evidence. A version preserves evidence type, explanation, strength, confidence, uncertainty, explicit basis references, optional locator snapshot, source IDs, optional support role, lifecycle status, change details, deterministic hash, origin, and current projection.

A changed explanation, basis, locator, source, role, correction, or retraction creates a new version; it does not overwrite the earlier row. Legacy evidence needs no version history.

## Correction, supersession, retraction, and current state

Correction and retraction are version events, not deletion. Explicit `corrects`, `supersedes`, and `retracts` claim relations may record logical lineage between claims, but do not mutate either endpoint automatically.

Exactly one current pointer exists for each parent that has imported or governed versions. Noncurrent and retracted history remains visible through collection APIs and historical search. The logical current contextual record retains all legacy fields independently of its optional version history.

## Existing revisions and governance

The existing generic `revisions` registry remains the cross-registry audit ledger. Existing governance publications retain prior and published snapshots, proposal correlation, conflict detection, authorization, CSRF, organization scope, separation of duties, publication state, rollback state, and audit events.

The generic revision ledger is insufficient by itself for immutable per-claim/per-evidence lineage because it is bundle-owned, cascade-deletable, has no parent-specific ordinal constraint, and has no constrained current pointer. Chunk 4 therefore uses a documented combination:

- existing revisions and governance publications for workflow/audit correlation; and
- normalized immutable claim/evidence version tables for historical content lineage.

No second governance workflow is introduced.

Governed claim and evidence publication materializes the complete target snapshot and appends an accepted version in the same transaction. Version rows can retain proposal, publication, and revision correlation. Rollback retains the published version, restores the selected prior snapshot, appends a rollback/restoration version when a prior contextual snapshot exists, and also records the existing append-only rollback revision event. Rollback of a newly created record retains the publication version and the generic rollback event while making the new target nonpublic.

Attribution, claim-relation, evidence-link, and locator children are included in governed snapshots and replaced transactionally with the governed current projection.

## Import and replacement retention

Import remains transactional. Schema/reference failure blocks persistence. Any late database conflict rolls back the entire graph, including current contextual records.

Current normalized children remain import-owned and are rebuilt during bundle replacement. Immutable version tables deliberately do not have foreign keys to `imported_bundles`, `context_claims`, `context_evidence`, or current source rows. They retain the originating bundle ID, logical parent ID, source IDs, and normalized snapshots as durable values. Consequently, replacement or an ordinary allow-listed bundle removal cannot cascade away accepted history. Current pointers also remain independent of import-owned parents.

Identical reimport uses the version content hash and stable ID to avoid duplicate history. Changed content under an existing version ID fails with `CONTEXT_VERSION_ID_CONFLICT`.

The integration-test deletion helper is the only application path that explicitly enables version-row cleanup. It requires the established `sourceroot-integration-test-` bundle prefix, sets a transaction-local cleanup marker, removes dependent evidence links and current pointers, and then removes only versions owned by that test bundle. The production immutability trigger remains unchanged.

## Read API

Existing `/api/v1/context` routes and legacy response keys remain compatible.

Claim detail adds:

- `currentVersion`
- `versions`
- `versionSummary`
- `attributions`
- `evidenceLinks`
- `evidenceSummary`
- `claimRelations`
- `sourceLocators`

Evidence detail adds:

- `currentVersion`
- `versions`
- `versionSummary`
- `claimLinks`
- `sourceLocators`

Existing `fieldProvenance`, `temporalContext`, legacy claim fields, and legacy evidence fields remain present.

Read-only Registry API Contract 1.0 collections are:

- `GET /api/v1/context/claim-versions`
- `GET /api/v1/context/evidence-versions`
- `GET /api/v1/context/claim-evidence-links`
- `GET /api/v1/context/claim-relationships`
- `GET /api/v1/context/claim-attributions`

Each returns its route-specific collection key plus `items`, exact totals, returned count, `hasMore`, pagination, supported filters, applied sort, immutable-ID tie-breaker, ignored unknown query metadata, and `X-Request-ID`. Filters include the relevant subset of `claimId`, `evidenceId`, `versionId`, `relationType`, `supportRole`, `status`, `sourceId`, `current`, and `actorEntityId`. No public contextual write route is added.

## Search

Search remains deterministic and additive. Current contextual evidence is searchable as `context-evidence`. Immutable claim-version statements are searchable as `context-claim-version`.

A historical result uses the version ID as its result ID and identifies `claimId`, `versionId`, status, origin, content hash, and `current` in metadata. It does not replace or collapse the logical current claim. Claim search text also includes explicitly supplied attribution actor labels and explicit claim relation labels. Search performs no semantic contradiction detection, authority lookup, embeddings, or external retrieval.

## Field-level provenance

The bounded path allow-list adds claim statement, attribution, claim relation, versions, evidence links, evidence explanation/basis/role/locator, change reason, and version status roots.

New subrecord targets are:

- `claim_attribution`
- `claim_relation`
- `claim_version`
- `evidence_claim_link`
- `source_locator`
- `evidence_version`

Paths remain bounded dotted data paths without wildcards, brackets, queries, or executable expressions. Record-level source links remain complementary.

## Level 1 observers

The Data Quality and Provenance Observer adds deterministic findings for unsourced claims and attributions, broken attribution references, missing evidence basis or required locator, broken evidence links, contradictory explicit support roles, unsourced claim relations and contradictions, lifecycle status without lineage, duplicate version IDs, predecessor cycles, missing/multiple current versions, content-hash mismatch, and broken version provenance.

The Platform Operations Observer classifies contextual version conflicts and governed version failures.

Both observers remain authority Level 1, deterministic, read-only, nonpersistent, and unexposed by routes. They have no database, network, filesystem, shell, retry, restart, proposal, approval, publication, rollback, mutation, or deletion authority.

## Migration

Migration 012 is additive. It adds evidence uncertainty, normalized child tables and source-link tables, immutable version tables, same-parent predecessor/current constraints, deterministic indexes, and immutability triggers. Migrations 001–011 are unchanged.

The migration does not backfill or fabricate claim/evidence versions.

## Examples

An account may contain claim `claim-a`. Attribution `attribution-a` can say that entity `person-a` was `reported_by` account `account-a` at temporal assertion `time-a`, supported by source `source-a`. This proves who reported the claim; it does not prove the statement true.

Evidence `evidence-a` may explicitly `supports` `claim-a` version `claim-a-v2` at locator label `p. 14`. The same evidence can explicitly `contextualizes` another claim. Neither role is inferred from legacy `evidenceType`.

Claim version `claim-a-v1` may remain `corrected` and noncurrent while `claim-a-v2` is current. A later governed retraction appends `claim-a-v3`; it does not remove `v1` or `v2`.

## Known limits

- Version references in one import bundle must resolve inside that bundle; incremental cross-bundle lineage is governed through current database state rather than inferred by validation.
- Detail projections return up to 10,000 child/history rows; complete large histories remain available through paginated collections.
- No independent live API server or browser behavior is required by this backend-only stage.
- No truth, trust, evidence-ranking, consensus, source-credibility, or canonical-claim engine exists.
- No copyrighted source retrieval, authority dereferencing, calendar conversion, or external validation is performed.
- Production readiness is not claimed.
