# DictionaryRoot Revision and Knowledge History Experience v1

## Stage purpose

This stage adds a live, customer-facing history experience without inventing historical data. DictionaryRoot can now show a concept's current SourceRoot state, concept-specific revision records, dataset import lineage, revision status, source attribution, and stable revision URLs.

## Installed experience

- `history-v2.html`
- `assets/css/dictionaryroot-history.css`
- `assets/js/dictionaryroot-history.js`

The History experience is included in the shared responsive navigation and in global exact-meaning search actions. Concept pages link directly to the selected meaning's history.

## Live data contract

The page uses only live SourceRoot operations:

- `GET /search?type=node`
- `GET /nodes/:nodeId`
- `GET /nodes/:nodeId/assertions`
- `GET /nodes/:nodeId/edges`
- `GET /sources/:sourceId`
- `GET /revisions?objectType=node&objectId=:nodeId`
- `GET /revisions?objectType=import-bundle&objectId=:bundleId`
- `GET /revisions/:revisionId`

The revision API now returns `rawData`, the imported revision object. Historical comparison activates only when that record explicitly contains `before`, `after`, `snapshot`, `object`, or equivalent snapshot data.

## Honest first-import behavior

The current Open English WordNet pilot contains a bundle import revision but may not contain separate historical versions for each concept. In that case the page displays:

1. the current live concept snapshot;
2. an honest empty state for concept-specific revisions;
3. the recorded dataset import lineage;
4. no fabricated previous definition or assertion set.

## URL state

- `q`: selected meaning label
- `nodeId`: selected SourceRoot concept
- `revision`: selected revision record
- `status`: optional timeline status filter
- `source`: preserved source context when present

Search, concept selection, revision selection, and status filtering use browser history. Back and Forward restore the selected state.

## Revision statuses

The interface recognizes and styles:

- current
- corrected
- disputed
- superseded
- other recorded statuses

## Comparison behavior

When a revision includes a historical snapshot, DictionaryRoot compares it to the current live concept and reports added, removed, and changed assertions, relationships, sources, and core fields. When no snapshot exists, the page states that field-level comparison cannot be calculated.

## Compatibility preserved

- Unified DictionaryRoot navigation and global exact-meaning search
- Concept Experience
- Knowledge Sphere Map and Readable modes
- Source Experience
- SourceRoot API and stable bundle identity
- Exact-meaning ranking compatibility
- Context-preserving links
- Browser Back/Forward
- API-offline states without fallback records

## Manual acceptance

1. Open `history-v2.html` and search `bank` or another multi-sense word.
2. Select two exact senses and confirm the current state changes.
3. Open History from Concept and global search; confirm `q` and `nodeId` remain in the URL.
4. Select a revision and confirm `revision` appears in the URL.
5. Use Back and Forward through searches, selected concepts, revisions, and status filters.
6. Confirm mobile navigation and the history layout at 390 × 844 and 320 × 568.
7. Stop SourceRoot, refresh, and confirm offline states appear with no fallback history.
8. Restart SourceRoot after the offline check.
