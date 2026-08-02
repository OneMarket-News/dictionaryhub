# Cross-Root source-backed entity and historical relationships

## Diagnosis and decision

The read-only diagnosis inspected migrations 009-012 and 018, the released HistoryRoot 1.3.0 entities, aliases, relationships, causal links, claims, evidence, interpretations, perspectives, governance/publication, revisions and audits, the three released Root resource classes, Chunk 14A registry/links/evidence, runtime readiness, APIs, the canonical HistoryRoot experience, and shared Root navigation/branding.

HistoryRoot's contextual tables preserve source-native records, claims, evidence, uncertainty, governance, and revision history, but are HistoryRoot-local and are not an addressable cross-Root assertion API. Migration 018 provides reusable resources and exact lexical observations; its link rows intentionally cannot express semantic predicate families, causal separation, assertion review state, assertion content identity, or a mandatory many-evidence contract. Retrofitting semantic meaning into those rows would violate Chunk 14A. Migration 019 is therefore justified as a narrow, independent assertion/evidence layer referencing the existing registry. Migration 018 is unchanged and migration 020 is absent.

## Model

`cross_root_relationship_datasets` records the prepared dataset, algorithm, exact inputs, source identity, and expected coverage. `cross_root_relationship_assertions` records typed subject and object resources, predicate/direction, inverse display, source-native type, controlled family, derivation, review/assertion state, certainty/uncertainty/dispute, temporal/geographic scope, explicit causal flag/role, source record, hashes, and provenance order. `cross_root_relationship_evidence` records exact source excerpts, fields and UTF-16 offsets, source associations, citations/locators/URLs, hashes, uncertainty/dispute notes, and evidence order.

Database constraints control families, derivation, review and assertion states; separate causal from ordinary records; prohibit self-relations and duplicate deterministic identities; preserve dataset/resource foreign keys; and enforce evidence existence at transaction completion. Application validation additionally proves exact input/output hashes, source excerpt reconstruction, source record membership, review mapping, resource reuse, and the absence of lexical or inferred semantic material.

## Released projection

The offline `released-historyroot-relationship-projection-v1` algorithm reads the released HistoryRoot 1.3.0 bundle plus only Chunk 14A's resource-registry identity files. It projects all 121 qualifying public relationship records and 22 qualifying causal links, yielding 143 assertions and 178 evidence records. It reuses 280 resources and adds zero. Every assertion is HistoryRoot-to-HistoryRoot, `directly_sourced`, `unreviewed`, uncertain, and source-backed. Exact family/predicate counts and exclusions are in the dataset manifest.

The importer validates committed fingerprints, prepared hashes, source records, registry endpoints, source associations, review/derivation vocabulary, offsets, deterministic IDs, and prior dataset integrity. It transactionally replaces only this dataset when repair is required; an exact state is skipped. Simulated failure rolls back all new relationship rows. Chunk 14A resource, link, and evidence rows are never changed.

## Semantic boundaries

- SourceRoot records what a released source or accepted record asserts; it does not declare universal truth.
- Exact lexical overlap is not semantic evidence, and matching names are not identity proof.
- Association and temporal sequence are not causation. Causal records retain exact wording, role, uncertainty, and evidence.
- Review, publication, certainty, and dispute are separate dimensions. Existence does not imply `accepted_after_review`.
- No DictionaryRoot-to-HistoryRoot, DictionaryRoot-to-BibleRoot, BibleRoot-to-HistoryRoot, person/place identity, inferred geography, or EarthRoot assertion is created.
- Future EarthRoot relationships can use the shared tables without schema redesign, but each will require its own source-backed geographic evidence, historical/modern naming, temporal scope, uncertainty, dispute, and review state.

## API and customer surface

Read-only routes are `GET /api/v1/cross-root/relationships/coverage`, `GET /api/v1/cross-root/relationships`, and `GET /api/v1/cross-root/relationships/:assertionId`. The list supports bounded `resourceId`, `subjectId`, `objectId`, `relationshipFamily`, `predicate`, `reviewState`, `derivation`, `disputed`, `causal`, `root`, `page`, and `pageSize` filters. Structured validation/not-found errors preserve the existing API contract; no mutation route exists.

`cross-root-relationships.html` renders only live API data and exposes typed endpoints, native predicate, controlled family, derivation/review/certainty/uncertainty/dispute, scopes, exact evidence, provenance identifiers, source links, hashes, and dataset versions. It has honest loading, awaiting-data, empty, invalid, unavailable, retry, recovery, URL-history, mobile, keyboard, focus, and reduced-motion behavior. HistoryRoot record pages expose a narrow API-gated entry point only when a qualifying assertion exists. No static fallback relationship knowledge is embedded.

Readiness contract 1.4.0 adds independent `crossRootRelationships` coverage while leaving `crossRootLinks` and all earlier Root capabilities semantically unchanged.

## Explicit non-goals

No external acquisition, inferred extraction, broad ontology, identity merge, semantic interpretation of lexical links, EarthRoot, coordinates, polygons, maps, geocoding, embeddings, similarity scoring, commentary import, Original Language import, translation-difference classification, mutation workflow, release artifact, or production BibleRoot branding is part of this stage.
