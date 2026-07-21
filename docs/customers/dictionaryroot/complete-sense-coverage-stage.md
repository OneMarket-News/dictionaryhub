# DictionaryRoot Complete-Sense Search and Lexical Coverage v1

## Purpose

DictionaryRoot previously searched only the bounded concept bundle used to prove the customer experiences and Knowledge Sphere. That graph sample could contain one meaning of a lemma while omitting other valid senses. For example, a search for `value` could return color-lightness meanings while omitting monetary worth.

This stage separates two concerns:

- **Lexical coverage:** every Open English WordNet synset for an exact lemma is indexed and searchable.
- **Graph rendering:** the browser still loads only a bounded neighborhood around the selected concept.

The result is complete exact-sense discovery without loading the entire dictionary into a browser graph.

## Architecture

### Complete lexical index

Migration `003_create_dictionaryroot_lexicon.sql` adds:

- `dictionaryroot_lexicon_datasets`
- `dictionaryroot_lexicon_synsets`
- `dictionaryroot_lexicon_relations`

The complete Open English WordNet release is imported directly into PostgreSQL with batched inserts. The existing stable customer bundle ID remains unchanged.

### Search behavior

`GET /api/v1/search` continues to be the public search contract. For DictionaryRoot node searches, SourceRoot now:

1. Finds every exact synset whose normalized lemma equals the query.
2. Returns all exact senses before related registry matches.
3. Deduplicates concepts already present in the bounded graph bundle.
4. Adds coverage metadata with exact-sense counts, graph counts, lexical-only counts, and parts of speech.

The response identifies the policy as `complete-lemma` when the lexical index is available.

### On-demand concepts

A complete lexical sense does not need to be copied into the bounded graph bundle before it can be opened. The existing node routes now fall back to the lexicon for:

- concept detail
- definition and usage assertions
- incoming and outgoing WordNet relationships

This keeps Concept, Knowledge Sphere, Sources, History, navigation, and deep links functional for lexical-only senses.

### Coverage diagnostics

- `GET /api/v1/dictionaryroot/lexicon/status`
- `GET /api/v1/dictionaryroot/lexicon/coverage?q=value`

These endpoints make it possible to distinguish a complete lexical index from the smaller set of nodes currently materialized in the pilot graph bundle.

## Installation workflow

1. Install the replacement files.
2. Stop SourceRoot.
3. Run `BUILD-IMPORT-DICTIONARYROOT-LEXICON.ps1`.
4. Restart SourceRoot with `npm.cmd run dev`.
5. Run the complete-sense verifier and prior compatibility verifiers.
6. Complete browser checks before committing.

The build/import script downloads or reuses the cached official Open English WordNet WNDB release, applies migrations, and imports the complete index.

## Honest states

If migrations or the lexical import have not been run, existing bounded-registry search remains available. The coverage response reports `available: false`; the product does not claim complete senses until the complete index is present.

No fallback dictionary data is embedded in the frontend.

## Acceptance checks

- `value` returns all exact senses available in Open English WordNet.
- At least one exact `value` sense expresses monetary worth or amount.
- Exact results include noun/verb part-of-speech labels when present.
- The exact result count matches the coverage endpoint.
- A lexical-only sense opens in Concept and Knowledge Sphere.
- Browser Back/Forward and cross-experience URL context remain intact.
- Existing Unified Navigation, Hybrid Map, Source, and History verifiers still pass.
