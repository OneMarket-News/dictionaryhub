# SourceRoot Contextual Knowledge Foundation v1

## Purpose

The contextual knowledge foundation adds reusable, domain-neutral records for people, communities, places, events, accounts, claims, evidence, interpretations, perspectives, temporal uncertainty, causality, relationships, and later cultural memory.

HistoryRoot is the first consumer. The same structures are intended for later BibleRoot, NewsRoot, and customer-created Roots without changing the database model or API namespace.

This is a backend foundation. It does not add customer-facing HistoryRoot pages or a researched historical package.

## Universal record model

Every contextual object that can be independently retrieved has a globally stable `id` and a row in `context_records`. The registry records:

- owning import bundle;
- record kind;
- domain;
- label and summary;
- status;
- JSONB metadata and the validated import representation;
- creation and update timestamps.

Subtype tables preserve domain distinctions while the registry supplies common ownership, filtering, search, and stable-ID behavior. Contextual IDs occupy their own namespace and do not replace SourceRoot node, assertion, edge, source, or revision IDs.

The supported record kinds are:

- `entity`
- `temporal_assertion`
- `account`
- `claim`
- `evidence`
- `interpretation`
- `perspective`
- `causal_link`
- `relationship`
- `cultural_memory`

## Entity types

`context_entities` supports:

- `person`
- `group`
- `organization`
- `cultural_community`
- `place`
- `event`
- `document`
- `work`
- `political_jurisdiction`

Entity records include a canonical name, optional alternate names, and an optional description. The list describes structural identity, not a HistoryRoot-specific taxonomy.

## Temporal model

`context_temporal_assertions` relates a temporal assertion to any contextual record. A historical object is not required to have a precise modern date.

Supported temporal kinds are:

- `exact`
- `approximate`
- `range`
- `before`
- `after`
- `disputed`
- `unknown`
- `multiple_proposed`

The model includes optional exact, start, end, before, and after ISO date anchors; multiple proposed date objects; a required human-readable date label; calendar system; date precision; start and end uncertainty; and explanatory notes.

ISO anchors support database filtering when an ISO representation is meaningful. `dateLabel`, proposal labels, calendar system, precision, and notes retain the human and scholarly representation. Unknown dates require no ISO value. Disputed and multiple-proposed dates require at least two proposals, and each proposal may use a date, a human label, or both.

Date-range API filters use interval-overlap semantics for records with usable database date anchors. Records represented only by non-ISO proposals or an unknown date are retrieved by stable ID or `temporalKind`, not forced into a false date range.

## Event, account, claim, evidence, and interpretation separation

The schema deliberately preserves these boundaries:

- An event is an `event` entity.
- `context_accounts` describes an account *of* a subject and may identify an author entity and SourceRoot source.
- `context_claims` extracts a statement from one account and identifies its subject and optional object.
- `context_evidence` supports or counters one claim. Its `evidenceType` is `evidence` or `counterevidence`, and it points to a source, account, contextual record, or a combination.
- `context_interpretations` expresses an interpretation of a subject and may cite an account or source.
- `publishedConclusion` distinguishes an interpretation marked as a published conclusion from an unpublished interpretation. It does not collapse the interpretation into a claim.
- `context_cultural_memories` stores a later memory or retelling separately from an original event and its contemporary accounts.

`context_record_perspectives` can attach one or more perspectives to an account, claim, interpretation, relationship, cultural memory, or other contextual record without copying the record.

## Database structures

Migration `009_create_contextual_knowledge_foundation.sql` adds:

- `context_records`
- `context_entities`
- `context_temporal_assertions`
- `context_accounts`
- `context_claims`
- `context_evidence`
- `context_interpretations`
- `context_perspectives`
- `context_record_perspectives`
- `context_causal_links`
- `context_relationships`
- `context_cultural_memories`
- `context_record_sources`

All owned records reference `imported_bundles` and are removed through cascade behavior when that bundle is deleted. Subtype and link tables use foreign keys to protect account, claim, evidence, perspective, causal, and relationship references. Cross-record foreign keys are deferrable so a transaction can load mutually related records safely.

Indexes cover bundle ownership, record kind, domain and status, entity type, temporal kinds and date anchors, source links, causal endpoints, and relationship type and endpoints.

`context_relationships` is intentionally extensible. Initial reusable relationship types include:

- `event_participation`
- `parent_event`
- `parallel_event`
- `place_name_change`
- `jurisdiction_change`
- `source_agreement`
- `source_contradiction`

Additional Root-specific relationship vocabulary can be introduced without adding domain-specific columns.

## API routes

Read APIs are registered beneath `/api/v1/context`:

| Route | Record kind |
| --- | --- |
| `/entities` | Contextual entities |
| `/temporal-assertions` | Temporal assertions |
| `/accounts` | Historical or other contextual accounts |
| `/claims` | Claims extracted from accounts |
| `/evidence` | Evidence and counterevidence |
| `/interpretations` | Interpretations and published-conclusion flags |
| `/perspectives` | Perspectives |
| `/causes-consequences` | Cause and consequence links |
| `/relationships` | Reusable contextual relationships |
| `/cultural-memories` | Later cultural-memory records |
| `/records/:contextId` | Universal stable-ID lookup |

Every collection also supports `/:contextId`, default pagination, `page`, `limit`, `bundleId`, `domain`, `status`, and `sourceId`.

Meaningful additional filters include:

- entities: `entityType`;
- temporal assertions: `temporalKind`, `dateFrom`, `dateTo`, and `subjectId`;
- claims and interpretations: `accountId` and `subjectId`;
- evidence: `claimId` and `evidenceType`;
- causes/consequences: `causalKind`;
- relationships: `relationshipType`, `fromId`, and `toId`;
- records with perspectives: `perspectiveId`.

Responses follow existing SourceRoot pagination and error conventions. Unknown stable IDs return `CONTEXT_RECORD_NOT_FOUND`.

## Import format

Existing SourceRoot bundles remain valid without a `context` property. When supplied, `context` is a strict, Zod-validated object with optional arrays:

```json
{
  "bundleId": "customer-root-example-v1",
  "bundleType": "sourceroot-import-bundle",
  "version": "1.0",
  "domain": "CustomerRoot",
  "nodes": [],
  "assertions": [],
  "edges": [],
  "sources": [],
  "revisions": [],
  "context": {
    "entities": [],
    "temporalAssertions": [],
    "accounts": [],
    "claims": [],
    "evidence": [],
    "interpretations": [],
    "perspectives": [],
    "recordPerspectives": [],
    "causalLinks": [],
    "relationships": [],
    "culturalMemories": []
  }
}
```

Each independent record uses the common `id`, `label`, optional `summary`, optional `domain`, optional `status`, optional `sourceIds`, and optional `metadata` fields plus subtype fields.

Validation checks:

- Zod shape, required values, enums, and date-kind requirements;
- stable-ID uniqueness across all contextual arrays;
- contextual subject and endpoint references;
- subtype references such as account, claim, entity, and perspective IDs;
- references to sources owned by the bundle;
- distinct causal and relationship endpoints.

Import remains under the existing SourceRoot import authorization middleware. Core and contextual records are written in the same PostgreSQL transaction. A failure rolls back the imported bundle, core records, and contextual records together. Re-import deletes and replaces only records owned by that bundle.

The technical fixture is `backend/test/fixtures/contextual-historyroot-valid.json`. Its people, group, place, events, documents, accounts, and sources are invented and exist only to verify the framework.

## Search behavior

SourceRoot registry search includes:

- `context-entity`
- `context-account`
- `context-claim`
- `context-interpretation`
- `context-relationship`

Results support existing query, pagination, bundle, domain, and type filtering. Searchable text includes stable ID, labels, summaries, normalized subtype content, relationship information, and validated raw contextual data.

DictionaryRoot exact-lemma search is unchanged. Complete lexical senses are still fetched by `searchDictionaryRootExactSenses`, kept ahead of registry results, deduplicated by ID, and reported with `exactSensePolicy: "complete-lemma"`. Contextual search records only extend the registry branch.

## Governance compatibility

This chunk introduces no independent contextual write endpoint. Mutations occur only through the existing authorized bundle import workflow, retaining import-token, authenticated permission, CSRF, transaction, and audit boundaries already used by SourceRoot and DictionaryRoot.

The common `status`, source links, confidence, uncertainty, metadata, timestamps, and bundle ownership fields are compatible with later editorial overlays and governance workflows. This chunk does not silently treat confidence as approval or an interpretation as a published conclusion.

## HistoryRoot usage

HistoryRoot can model participants, communities, places, events, uncertain chronology, accounts, extracted claims, supporting and contradicting evidence, interpretations, perspectives, causal proposals, event hierarchy, parallel events, jurisdiction change, place-name change, source disagreement, and later memory with the universal structures.

The included fixture is a framework test, not customer data. A researched HistoryRoot package belongs in a later chunk and must use attributable sources and review policy.

## Future BibleRoot reuse

BibleRoot can use person, group, place, event, document, and work entities; multiple calendar systems and disputed dates; textual accounts and claims; source agreement or contradiction; interpretive perspectives; and later reception or cultural-memory records. BibleRoot-specific vocabulary should be expressed through relationship values and metadata rather than schema forks.

## Future NewsRoot reuse

NewsRoot can use organizations, political jurisdictions, people, events, documents, exact or evolving timelines, published accounts, extracted claims, evidence, counterevidence, corrections, perspectives, confidence, and later consequence links. A future chunk should add time-sensitive update and supersession policy without changing the event/account/claim separation.

## Known limitations

- Context is imported as full bundle-owned snapshots; partial contextual patch imports are not supported.
- Relationship vocabulary is open text. A governed vocabulary registry and aliases are deferred.
- Non-Gregorian and pre-modern dates retain labels and calendar metadata but are not converted automatically.
- Date filters use available ISO anchors and do not infer ranges from text-only disputed proposals.
- Contextual records have read APIs only; editorial create/update APIs are deferred.
- Search uses PostgreSQL text matching rather than contextual full-text ranking or semantic retrieval.
- Cross-bundle contextual references are rejected by import validation in v1.
- The contextual model is not yet reflected in customer-facing pages.

## Chunk 2 handoff requirements

Chunk 2 should:

1. define governed contextual relationship and status vocabularies without narrowing customer extensibility;
2. add editorial proposal, review, publication, and revision integration for contextual record kinds;
3. add richer source-comparison and claim graph queries;
4. define calendar conversion and text-only chronology indexing policy;
5. add full-text or semantic contextual ranking while preserving DictionaryRoot exact-sense precedence;
6. define cross-bundle reference and package-composition policy;
7. design reviewed HistoryRoot presentation APIs before adding customer-facing pages;
8. prepare a separately reviewed, sourced HistoryRoot package rather than expanding the technical fixture;
9. document BibleRoot and NewsRoot adapter mappings against the same import contract;
10. preserve transactional replacement, bundle deletion, governance, authentication, and regression coverage.
