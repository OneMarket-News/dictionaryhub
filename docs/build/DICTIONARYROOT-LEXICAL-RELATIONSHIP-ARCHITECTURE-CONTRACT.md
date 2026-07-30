# DictionaryRoot Lexical Relationship Architecture Contract

## Identity and boundary

SourceRoot DictionaryRoot Lexical Relationship Architecture v1 is the
canonical sense-to-sense relationship layer added by migration
`014_create_dictionaryroot_lexical_relationships.sql`. It extends migration
013 and the fixture named `DictionaryRoot Lexical Evidence Architecture
Fixture v1`. It does not create DictionaryRoot Core Lexical Corpus v1,
migration 015, generic knowledge nodes, write APIs, or production corpus data.

## Normalized model

The model has three independent structures:

1. `dictionaryroot_lexical_relationship_types` governs type labels,
   directionality, inverse semantics, and self-link policy.
2. `dictionaryroot_lexical_relationships` owns one canonical relationship
   identity, both sense endpoints, review and relationship status,
   qualification, uncertainty, chronology/domain context, and version data.
3. `dictionaryroot_lexical_relationship_evidence` preserves one or more
   independently addressable supports with source identity, provenance
   identity, evidence role, permitted wording or labeled normalization,
   review and uncertainty, version/edition context, and structured locator
   fields.

Multiple evidence rows never require duplicate canonical relationship rows.
Dataset ownership cascades replacement safely. Composite foreign keys prevent
cross-dataset endpoints and sources. Self-links are rejected.

## Relationship vocabulary and direction

The governed vocabulary supports substantially equivalent, antonym, broader,
narrower, related, derivationally related, historical predecessor/successor,
technical specialization, generalization, translation-related, disputed, and
unresolved relationships.

Symmetric endpoints must be stored in ascending immutable sense-ID order.
That rule rejects inverse duplicates deterministically. Directional rows
preserve source-to-target meaning; inverse type metadata describes the
opposite reading without manufacturing a second row.

## Import contract

Only the exact fixture-only dataset may use the fixture importer, and only
against `sourceroot_test`. Replacement deletes the owned dataset inside one
transaction; cascades remove old relationships and evidence. All normalized
objects, relationships, and evidence are then recreated from deterministic
IDs. Any constraint or insert failure rolls the entire replacement back.
Duplicate reimport produces the same counts and identities. HistoryRoot and
the legacy DictionaryRoot lexicon tables are outside the write path.

## Canonical graph adapter

`lexical-evidence-graph.ts` reads migrations 013 and 014 directly. It derives
typed nodes and stable edges for lemma/sense, lemma/form, sense/claim,
claim/source, structured locator, field provenance, etymology proposals and
competitors, source comparisons, and
sense/relationship/relationship-evidence/sense paths. Nothing derived is
persisted as a generic SourceRoot node.

Traversal accepts depth 1 or 2 and a limit from 2 through 100. Dataset reads
have an internal per-object cap, breadth-first distances and output are
deterministically ordered, and truncation is explicit. Node and edge IDs are
stable; review status, uncertainty, dataset identity, source identity, and
object type remain visible where relevant.

## Read API

- `GET /dictionaryroot/lexicon/evidence/graph/seeds`
- `GET /dictionaryroot/lexicon/evidence/graph/neighborhood/:seedId`
- `GET /dictionaryroot/lexicon/evidence/relationships/:relationshipId`
- `GET /dictionaryroot/lexicon/evidence/relationships/:relationshipId/evidence`

Seed and evidence lists are paginated. Missing list data returns an explicit
zero-item response. Missing detail or graph seeds return typed 404 responses.
Invalid bounds return 400. No route writes or supplies fallback records.

## Customer contract

Knowledge Sphere combines its existing node search with lexical graph seed
lookup. A lexical seed loads the canonical adapter, preserving distinct bank
noun and verb senses. Forms, claims, sources, locators, provenance,
etymologies, comparisons, relationships, and relationship evidence retain
their own object types. Island proposals remain separate; logos uncertainty
remains explicit. Existing map/readable modes, URL state, browser history,
keyboard behavior, responsive layout, and generic SourceRoot graph behavior
remain protected.

