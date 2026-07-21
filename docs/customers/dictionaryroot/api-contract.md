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
