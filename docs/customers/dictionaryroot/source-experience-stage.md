# DictionaryRoot Source Experience v1

## Purpose

DictionaryRoot Source Experience v1 is the customer-facing source library for DictionaryRoot Customer #001. It replaces the earlier static Sources prototype with a live provenance experience backed by the SourceRoot API and the configured DictionaryRoot bundle.

The page is designed to answer four questions:

1. What source supports this knowledge?
2. Which assertion or relationship uses that source?
3. Which exact Open English WordNet meaning is connected to the record?
4. Where can the user open that meaning in DictionaryRoot or the Knowledge Sphere?

## Customer-facing source experience

The new `sources-v2.html` experience provides:

- DictionaryRoot branding and the existing customer navigation layer.
- “Powered by SourceRoot” through `dictionaryroot-brand.js`.
- A full-width source library matching the Concept Experience and Knowledge Sphere.
- Live source search across source name, ID, type, publisher, license, notes, attribution, URL, and loaded concepts.
- Source-type filtering, usage/name/type sorting, and comfortable or compact card density.
- A selected-source detail panel with natural page scrolling and a sticky desktop layout.
- Source metadata, licensing, attribution, review, verification, revision, and URL fields when recorded.
- Supported assertion records and source-supported relationship records when available.
- Exact linked SourceRoot nodes displayed as DictionaryRoot concepts.
- Direct navigation to `concept-v2.html?id=<node-id>` and `graph-v2.html?center=<node-id>`.
- Selected-source URL state, filter URL state, and Browser Back/Forward support.
- Loading, empty, source-detail error, and API-offline states.
- Responsive widescreen, tablet, and mobile layouts.

No static source records are included. The page does not load `data/nodes.json`, and it contains no Stanford or Merriam-Webster demonstration records.

## API endpoints used

The page uses the existing DictionaryRoot API client and SourceRoot endpoints:

- `GET /health`
- `GET /api/v1/sources?bundleId=<bundle-id>`
- `GET /api/v1/sources/:sourceId`
- `GET /api/v1/assertions?bundleId=<bundle-id>&page=<page>&limit=<limit>&sourceId=<source-id>`
- `GET /api/v1/edges?bundleId=<bundle-id>&page=<page>&limit=<limit>&sourceId=<source-id>`
- `GET /api/v1/nodes/:nodeId`

The client sends `sourceId` on assertion and edge registry requests so the page can use server-side filtering when that filter is available. The currently uploaded backend accepts the request but does not yet apply `sourceId` as a registry filter. The client therefore verifies records through their returned `sourceIds` arrays.

No backend files are changed by this package.

## Provenance flow

The visible provenance path is:

```text
Source
→ assertion or relationship
→ exact WordNet meaning / SourceRoot node
→ DictionaryRoot concept
```

The selected source panel keeps the SourceRoot IDs visible so the user can distinguish exact lexical meanings rather than treating a word label as a single undifferentiated concept.

## API-client composition

`assets/js/dictionaryroot-api.js` receives the smallest required customer-facing additions:

- `listAll(resource, params, options)` for paginated registry retrieval.
- `sources(params, options)` for the complete configured source registry.
- `listSourceLinkedRecords(resource, sourceId, options)` for source association retrieval through existing registries.
- `sourceExperience(sourceId, options)` for source metadata, assertions, relationships, and linked nodes.
- `extractTotalPages()` and `recordUsesSource()` helpers.

Existing search, node, assertion, edge, concept, and graph methods remain intact.

## Files changed

This stage installs or replaces:

- `sources-v2.html`
- `assets/css/dictionaryroot-live.css`
- `assets/js/dictionaryroot-api.js`
- `assets/js/dictionaryroot-sources.js`
- `docs/customers/dictionaryroot/source-experience-stage.md`
- `VERIFY-DICTIONARYROOT-SOURCE-EXPERIENCE.ps1`

The installer does not replace:

- `graph-v2.html`
- `assets/js/dictionaryroot-graph.js`
- `concept-v2.html`
- `assets/js/dictionaryroot-concept.js`
- `assets/js/dictionaryroot-brand.js`
- `config/customers/dictionaryroot.json`

## Current OEWN source limitations

The current Open English WordNet import may contain one recorded lexical source for the entire DictionaryRoot bundle.

When the configured bundle has exactly one source and the loaded registry sample confirms that every returned assertion or edge references that source, the API client uses the registry total as the exact source-supported count. This avoids downloading hundreds of registry pages for the current 10,000-node dataset.

When a bundle contains multiple sources and the backend does not apply `sourceId` filtering, the page performs a bounded registry scan and marks incomplete counts with a plus sign. It never invents a total or substitutes static records.

## Acceptance criteria

The stage is accepted when local verification confirms:

- Every required file exists.
- JavaScript syntax checks pass.
- DictionaryRoot branding and SourceRoot attribution are present.
- Live source retrieval is present.
- Source-linked assertion and linked-node retrieval are present.
- Correct Concept Experience and Knowledge Sphere links are present.
- Static `data/nodes.json` and demonstration source data are absent.
- Old `concept.html` and `graph.html` links are absent.
- Existing Concept Experience and Knowledge Sphere files remain intact.
- SourceRoot health succeeds.
- At least one source is returned.
- The recorded OEWN source can be loaded.
- At least one assertion connected to that source can be loaded.
- At least one linked SourceRoot node can be loaded.

## Verification command

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Josh\Documents\GitHub\dictionaryhub\VERIFY-DICTIONARYROOT-SOURCE-EXPERIENCE.ps1"
```

The SourceRoot backend must be running before live verification:

```powershell
npm.cmd --prefix "C:\Users\Josh\Documents\GitHub\dictionaryhub\backend" run dev
```

## Future multi-source scaling considerations

The frontend is ready to display many sources and already sends the intended `sourceId` query parameter. The preferred future backend optimization is to add indexed `sourceId` filtering to the existing node, assertion, and edge registries by joining:

- `node_sources`
- `assertion_sources`
- `edge_sources`

That change would make per-source counts and record retrieval exact in one paginated request without changing the Source Experience interface. Future source imports can also add richer attribution, version, revision, publisher, license-status, and review metadata without requiring hardcoded customer data.
