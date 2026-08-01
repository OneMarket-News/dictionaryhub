# BibleRoot Original-Language Foundation State

## Implemented

- Migration 016; migration 017 absent.
- Two original-language editions, four exact raw artifacts, six exact source
  documents, 12 component-rights records, 111 source segments, 1,592 tokens,
  1,592 lemmas, 2,420 morphology records, and 111 explicit mappings.
- Normalized dataset SHA-256:
  `474D7338BD57A8AD8C725B32E9BAA6B540ED4F327A3AAB6D0B009D773303F779`.
- Transactional/idempotent `sourceroot_test` importer with Chunk 12 and
  unrelated-bundle fingerprint enforcement.
- Read-only edition and original-language passage APIs.
- Subordinate responsive passage panel with Hebrew RTL, Greek LTR, verbatim
  analysis, mappings, provenance, rights, loading/offline/unavailable states,
  and no static language fallback.

## Data counts

| Chapter | Tokens |
|---|---:|
| Genesis 1 (Hebrew) | 434 |
| Psalm 23 (Hebrew, including explicit superscription segment) | 57 |
| Ecclesiastes 3 (Hebrew) | 273 |
| John 1 (Greek) | 828 |

Seven Greek tokens have ambiguous functional/form-oriented morphology pairs.
The bounded pinned data has zero missing analyses; the parser, schema, API, UI,
and tests retain the explicit `not_yet_analyzed` state.

## Known boundaries

No additional chapters/translations, transliteration, glosses, English
alignment, commentary, theology, variants, authentication, writes, or unified
search provider are present. Chunk 13B may add separately sourced lexical
resources; Chunk 13C may add separately governed comparison/interpretation
features. Neither boundary is implemented or inferred here.

The frozen Chunk 12 test asserting that migration 015's table list is the entire
future `bibleroot_%` schema is obsolete after migration 016. That historical
test remains unchanged; all other 27 Chunk 12 component tests pass when run
with the obsolete assertion excluded.
