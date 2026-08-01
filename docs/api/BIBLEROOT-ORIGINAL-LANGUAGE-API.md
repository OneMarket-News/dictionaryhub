# BibleRoot Original-Language Read API

Base path: `/api/v1/bibleroot/original-language`

## `GET /editions`

Returns the two available source editions, immutable Git refs, publications,
exact artifacts, SHA-256 values, retrieval identity, and component-specific
rights/attribution. It also discloses the bounded corpus and unified-search
boundary.

## `GET /passages?reference=...&edition=...`

`reference` uses the existing BibleRoot parser. `edition` is optional; Hebrew
is selected for Genesis 1, Psalm 23, and Ecclesiastes 3, and Greek for John 1.
The response contains:

- `availability`, normalized KJV passage reference, and target canonical IDs;
- source edition/provenance/rights and display direction;
- ordered source verses and tokens;
- SourceRoot and nullable source-native token IDs;
- verbatim lemma and morphology fields with analysis status;
- explicit verse mappings, including the Psalm 23 superscription;
- translation, interpretation, and search boundaries.

Missing `reference` is `400 REFERENCE_REQUIRED`. Malformed references reuse the
existing `400` contract. A valid but unsupported language/edition combination
is `404 ORIGINAL_LANGUAGE_UNAVAILABLE`. There are no write routes; mutation
methods return `404`.
