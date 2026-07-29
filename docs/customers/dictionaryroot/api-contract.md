# DictionaryRoot API Contract

## Connection

DictionaryRoot reads its API base URL and stable bundle ID from `config/customers/dictionaryroot.json`.

Default local API base URL:

```text
http://localhost:3000/api/v1
```

Stable customer bundle ID:

```text
dictionaryroot-oewn-2025-pilot-500
```

The number in the stable bundle ID is historical identity and does not represent the current imported scale.

## Required operations

| Customer need | SourceRoot operation |
|---|---|
| Confirm service | `GET /health` |
| Confirm bundle | `GET /imported-bundles/:bundleId` |
| Search meanings | `GET /search` |
| List concepts | `GET /nodes` |
| Read concept | `GET /nodes/:nodeId` |
| Read definitions | `GET /nodes/:nodeId/assertions` |
| Read relationships | `GET /nodes/:nodeId/edges` |
| Read source | `GET /sources/:sourceId` |
| List revision history | `GET /revisions?bundleId=...&objectType=...&objectId=...` |
| Read a revision | `GET /revisions/:revisionId` |

## Customer filtering

DictionaryRoot requests should include the stable bundle ID whenever supported. Search should also include the DictionaryRoot domain. This prevents unrelated SourceRoot demo or future customer records from appearing in the DictionaryRoot product.

## Error contract

Technical errors remain available for diagnostics, but customer pages translate them into:

- DictionaryRoot could not reach its knowledge service.
- Dictionary data is temporarily unavailable.
- No matching meaning was found.
- This meaning has no connected concepts yet.
- Source details are temporarily unavailable.

No customer-facing error should imply that data was changed unless a write operation actually occurred.


## Revision history contract

Revision list and detail responses include normalized revision identity fields plus `rawData`, the original imported revision object. DictionaryRoot uses `rawData` only when it contains an explicit historical snapshot or before/after change record. It never invents a previous state. When a concept has no concept-specific revisions, the customer experience shows the current live snapshot and the bundle import lineage with an honest empty state.

## Complete lexical coverage

DictionaryRoot exact-lemma search is backed by a separate complete Open English WordNet index. The bounded customer bundle continues to define the initially materialized graph sample, but it no longer limits exact-sense discovery.

| Customer need | SourceRoot operation |
|---|---|
| Complete lexicon status | `GET /dictionaryroot/lexicon/status?bundleId=...` |
| Lemma coverage diagnostics | `GET /dictionaryroot/lexicon/coverage?q=...&bundleId=...` |
| Search all exact senses | `GET /search?q=...&type=node&bundleId=...&domain=DictionaryRoot` |

For a DictionaryRoot node search, the response may include:

- `exactSensePolicy: "complete-lemma"`
- `coverage.exactSenseCount`
- `coverage.graphSenseCount`
- `coverage.lexicalOnlySenseCount`
- `coverage.partOfSpeechCounts`

All exact lexical senses are returned on the first page before related registry matches. A selected lexical-only node remains resolvable through the existing node, assertion, and edge routes, so customer URLs do not require a second concept contract.

## Lexical evidence inspection

Chunk 10A adds read-only inspection without changing the existing OEWN
contract:

| Customer need | SourceRoot operation |
|---|---|
| Search fixture lexical evidence | `GET /dictionaryroot/lexicon/evidence/search?q=...&page=...&limit=...` |
| Read a normalized lemma | `GET /dictionaryroot/lexicon/evidence/lemmas/:lemmaId` |
| Read all evidence for a sense | `GET /dictionaryroot/lexicon/evidence/senses/:senseId` |
| Inspect one evidence family | `GET /dictionaryroot/lexicon/evidence/objects/:subjectId/:resource` |

The evidence search is bounded to 100 records per page and the customer client
loads at most 20 pages. Result order is exact lemma first, then normalized
form, part of speech, and immutable sense ID. Sense detail keeps
source-specific claims, lexical forms, proposals, reviewed comparisons,
locators, and field provenance separate.

These routes currently expose only the bounded synthetic architecture fixture.
They do not replace the complete OEWN index or authorize a production corpus.
A customer page must show live empty or unavailable states rather than embed
fixture records as fallback data.
