# Cross-Root Link Foundation and Deterministic Lexical Evidence v1

## Problem and semantic boundary

SourceRoot needs addressable connections across DictionaryRoot, HistoryRoot, and BibleRoot without turning shared wording into a claim of shared meaning. Chunk 14A therefore records only a machine-reproducible textual observation. A link does not establish a dictionary sense, identity, historical influence, causation, theological significance, agreement, contradiction, or equivalence. Automated validation is not human semantic review.

## Released-schema diagnosis

DictionaryRoot has stable public lemma and sense IDs, separate definition claims, lexical relationships, relationship evidence, and accepted dataset identity. `lemma_id` and `canonical_written_form` are safe for the registry label and identity. A target occurrence can be compared with a written lemma form, but target context cannot select one of its senses.

HistoryRoot has stable `context_id` records, public labels/summaries, typed canonical fields in released bundles, source/citation provenance, and separate governance structures. The released 1.3.0 bundle distinguishes public corpus records from proposals, moderation, audit, and hidden metadata. Public matching is restricted to the field allowlist documented in the dataset; governance and identifier material is excluded. Its release status `pilot-review-required` concerns the corpus and is not misrepresented as Cross-Root human semantic acceptance.

BibleRoot has canonical reference IDs, canonical verse IDs, and edition-text IDs. KJV belongs to Foundation; ASV, WEB, and YLT belong to Translation Comparison. Exact text retains publication, artifact, rights, and provenance relationships in existing tables. Original Language structures and commentary sections/statements have different interpretive and alignment boundaries, so neither participates in 14A.

Shared imported bundles, sources, publications, artifacts, rights, unified search, readiness, and canonical frontends remain unchanged. Existing contextual relationship tables cannot faithfully retain both Root identities, heterogeneous resource types, direction, derivation, review state, target field, offsets, and occurrence evidence. Migration 018 is therefore required. It adds no fourth Root.

## Migration and resource model

`cross_root_datasets` binds one imported bundle to its algorithm, input fingerprints, semantic boundary, review boundary, and exact counts. `cross_root_resources` is an addressable-resource registry—not an ontology. A row means only that a released record can participate. It stores Root, typed public identity, label, canonical local URL, source dataset/version, content hash, deterministic identity hash, metadata, and order.

`cross_root_links` records a directional DictionaryRoot lemma to a HistoryRoot accepted contextual record or BibleRoot edition verse text. Composite foreign keys and checks require distinct Roots, reject self-links, and enforce deterministic uniqueness. The schema permits future derivations `directly_sourced`, `textually_observed`, `human_proposed`, and `machine_proposed`, and future review states `unreviewed`, `accepted_after_review`, `disputed`, and `rejected`. All 14A rows are exactly `textually_observed`, `unreviewed`, and `exact_lexical_occurrence`.

`cross_root_link_evidence` stores every occurrence: target field, exact surface, normalized form, UTF-16 offsets, excerpt, target resource and field hashes, source dataset/version, and order. Foreign keys reject orphan evidence; a uniqueness constraint rejects duplicate offsets.

Referential integrity across heterogeneous Root tables is fail-closed in the importer: actual DictionaryRoot lemma IDs/forms, HistoryRoot public IDs/bundle/status/fields, and BibleRoot edition-text IDs/exact text are checked before the transaction. The cross-Root family then uses internal foreign keys without coupling heterogeneous source tables to a polymorphic foreign key.

## Deterministic preparation and import

The source-controlled dataset uses eight committed fingerprints and fixed algorithm `exact-lexical-observation-js-utf16-v1`. NFKC, English lowercase folding, whitespace handling, Unicode word boundaries, contiguous phrases, UTF-16 offsets, and exact substring reconstruction are documented in `MATCHING-RULES.md`. Preparation is offline and byte-repeatable.

Import accepts only `sourceroot_test` by default or a verified local `sourceroot` development authorization. Production and remote databases fail closed. Prepared hashes, input fingerprints, types, roots, hashes, offsets, substrings, link boundaries, resources, and exact counts validate before a transactional replacement. An unchanged dataset skips all 6,568 family records. Simulated failure rolls back completely and prior Root datasets remain intact.

## API, frontend, readiness, and future extension

`GET /api/v1/cross-root/coverage` returns dataset/algorithm boundaries, inputs, exact counts, and honest readiness. `GET /api/v1/cross-root/links` requires a typed public identity, uses deterministic ordering and bounded pagination, and returns both resources and every occurrence. Structured 4xx errors contain no stack traces, credentials, or paths. Neither endpoint returns semantic fields or fallback links.

`cross-root-links.html` groups evidence by the other Root, exposes IDs, offsets, hashes, dataset versions, canonical links, and visible textual/review disclaimers. Loading, awaiting-data, no-links, invalid-resource, unavailable, and retry behavior are distinct. DictionaryRoot concept, HistoryRoot record, and BibleRoot passage pages add narrow entry points only when a registered identity is available. Existing search ranking is untouched; overlap counts are not importance.

Readiness contract 1.3.0 adds the top-level `crossRootLinks` capability while preserving all Root and BibleRoot layer fields. Future 14B human proposals/entity work can use typed resources and new derivation/review values without changing the meaning of 14A observations. Future 14C orchestration can consume reviewed links separately. Neither extension is implemented here.
