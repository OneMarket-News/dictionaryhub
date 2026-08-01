# BibleRoot Original-Language Foundation Architecture

## Boundary

Chunk 13A adds a read-only source-language layer beneath the existing KJV
passage. The checked-in raw artifacts are immutable inputs; normalized JSON is
deterministically regenerated, imported into `sourceroot_test`, and served from
PostgreSQL. The browser contains no fallback scripture or language records.

## Schema inspection and reuse

Migration 015 already provides `sources`, `imported_bundles`,
`bibleroot_source_publications`, `bibleroot_source_artifacts`, the KJV edition,
and canonical verse identities. Migration 016 reuses all of them.

Eight structures are necessary:

1. `bibleroot_source_artifact_rights_components` represents independent text
   and analysis rights on one physical OSHB XML. The prior artifact row has only
   one rights statement and cannot express this matrix.
2. `bibleroot_original_language_editions` separates Hebrew and Greek edition
   identity from the English translation edition.
3. `bibleroot_original_language_edition_artifacts` lets one Hebrew edition cite
   its three exact book artifacts.
4. `bibleroot_original_language_verses` preserves source citation,
   versification, artifact, surface sequence, and stable SourceRoot identity.
5. `bibleroot_original_language_tokens` separates SourceRoot token IDs from
   nullable source-native IDs and preserves position and surface form.
6. `bibleroot_original_language_token_lemmas` preserves verbatim source lemmas
   and their analysis state without definitions or glosses.
7. `bibleroot_original_language_token_morphologies` permits Hebrew and Greek
   morphology systems—and two Greek tag fields—without a false unified grammar.
8. `bibleroot_original_language_verse_mappings` records explicit mapping rows,
   nullable targets, mapping type, evidence, explanation, and review state.

The mapping target is a validated stable ID, not a cross-bundle foreign key.
This preserves migration 015's released delete/recreate importer lifecycle
while the Chunk 13A importer verifies all 110 target IDs before commit.

## Data flow

Raw byte/hash validation → bounded parser → normalized JSON/hash → transactional
bundle replacement → Chunk 12/unrelated fingerprints → read-only API →
subordinate customer panel.

No normalization is applied to Hebrew surface text. Greek source-native token
IDs remain null because the CSV supplies none.
