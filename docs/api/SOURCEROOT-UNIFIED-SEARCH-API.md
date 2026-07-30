# SourceRoot Unified Search API v1

## Route

`GET /api/v1/search/unified`

This additive read route composes the accepted DictionaryRoot
lexical-evidence search service and SourceRoot's existing HistoryRoot search
service. It does not replace `/api/v1/search` or any
`/api/v1/dictionaryroot/lexicon` route, create a shared persistence model, or
write search results.

## Parameters

| Parameter | Required | Default | Contract |
| --- | --- | --- | --- |
| `q` | yes | none | Trimmed term, 1–200 characters |
| `roots` | no | `DictionaryRoot,HistoryRoot` | Comma-separated or repeated Root IDs |
| `resultTypes` | no | all supported types | Comma-separated or repeated canonical result types |
| `page` | no | `1` | Integer 1–5 |
| `limit` | no | `10` | Integer 1–20 |

Supported Root IDs are `DictionaryRoot` and `HistoryRoot`.

Supported result types are:

- `lexical-sense`
- `context-entity`
- `context-claim`
- `context-evidence`
- `context-interpretation`
- `context-relationship`
- `context-account`
- `context-claim-version`
- `source`

Unknown Root or result-type filters return HTTP 400. A valid Root/type
combination with no compatible owning Root returns HTTP 200 with
`filters-exclude-all-result-types`.

## Result envelope

Every `items[]` entry contains:

- `resultId`: `${Root}:${canonicalResultType}:${canonicalObjectId}`
- `rootId` and `rootDisplayName`
- `canonicalObjectId` and `canonicalResultType`
- `title` and a whitespace-normalized summary capped at 280 characters
- Root-specific `canonicalUrl`
- `datasetId` and `datasetVersion`
- `matchClassification` and plain-language `matchExplanation`
- `sourceEvidenceAvailable`
- `connectionBasis: "query-overlap-only"`
- a bounded `rootSpecificMetadata` allowlist

DictionaryRoot results retain lexical sense, lemma, part-of-speech, category,
review, uncertainty, domain, and register identity where available.
HistoryRoot results retain the existing context result type, entity/record
kind, parent record or claim pointer, historical version state, and at most
ten alternate names. Unrestricted internal metadata is not returned.

## Canonical URLs

- DictionaryRoot lexical sense:
  `concept-v2.html?q={term}&nodeId={senseId}`
- HistoryRoot claim/version:
  existing `history-context-review-v1.html` review URL
- Other supported HistoryRoot records:
  `history-record-v1.html?id={contextId}`

Card position never participates in a URL.

## Match classifications

| Classification | Meaning |
| --- | --- |
| `exact` | DictionaryRoot canonical form exactly matches |
| `normalized-exact` | Recorded form/name matches after bounded normalization |
| `form-match` | DictionaryRoot canonical or recorded form begins with the term |
| `title-match` | HistoryRoot title matches the term |
| `contextual-occurrence` | The term occurs in searchable historical context |

No relevance value is presented as factual certainty.

## Deterministic ordering

The public order is:

1. match classification
2. Root (`DictionaryRoot`, then `HistoryRoot`)
3. canonical result type
4. normalized title
5. canonical object ID

The canonical Root queries use compatible leading match ordering. The unified
service requests at most `page × limit`, capped at 100 candidates per Root,
then applies the public comparator and page slice. The maximum unified offset
is therefore 80. Stable IDs are deduplicated before pagination.

## Counts and pagination

`counts` contains exact:

- `combined`
- `DictionaryRoot`
- `HistoryRoot`
- `exact`
- `relatedOrContextual`
- `duplicateResultIds`

The Root services calculate total and exact-match counts without returning an
entire corpus. `returned`, `totalPages`, and `hasNextPage` describe the
bounded unified page. `totalPages` never exceeds five.

## Availability and HTTP behavior

`availability.roots[]` describes every Root as `available`, `unavailable`,
`not-selected`, or `excluded-by-result-type`.

| State | HTTP | Meaning |
| --- | --- | --- |
| `all-available` | 200 | Every queried Root responded |
| `partial-availability` | 200 | At least one Root responded and one failed/timed out |
| `empty` | 200 | All queried Roots responded with zero matches |
| `filters-exclude-all-result-types` | 200 | Valid filters have no owning Root |
| `all-unavailable` | 503 | No queried Root responded |

Each Root has a four-second timeout. One timeout is isolated from the other
Root. No stale response, corpus file, fixture, or fallback record is
substituted.

## Bounds

- maximum query: 200 characters
- default page size: 10
- maximum page size: 20
- maximum page: 5
- maximum candidate window per Root: 100
- maximum summary: 280 characters
- timeout: 4,000 ms per Root

## Backward compatibility

The existing SourceRoot search service retains its public singular `type`
option and route contract. Chunk 11 adds an internal `types[]` option used by
the unified adapter so one canonical HistoryRoot query can return exact
filtered totals. Root-specific routes, data ownership, authentication, and
write behavior are unchanged.
