# DictionaryRoot Dynamic Sphere Expansion v1

## Purpose

Dynamic Sphere Expansion keeps DictionaryRoot's complete lexical coverage available without attempting to render all 107,519 meanings in one browser graph.

The existing curated 10,000-meaning graph remains the stable core. Any lexical-only meaning can be opened as the sphere center, and users can load bounded one-hop or two-hop neighborhoods when they choose to expand a node.

## Customer behavior

- Any exact Open English WordNet meaning can open in `graph-v2.html`.
- The first sphere remains bounded by the existing graph depth and limits.
- The selected node can be expanded one or two hops at a time.
- Core nodes and on-demand lexical nodes are visually distinct.
- Duplicate nodes and edges are suppressed.
- Expanded branches can be collapsed individually or cleared together.
- Expanded branch IDs, expansion depth, visible-node budget, center, mode, and base depth are represented in the URL.
- Browser Back and Forward restore the expansion state.
- Concept, Sources, History, and Coverage links continue to use the existing shared navigation context.
- SourceRoot-offline states remain honest and do not use fallback graph records.

## API

`GET /api/v1/dictionaryroot/lexicon/neighborhood/:nodeId`

Query parameters:

- `depth`: `1` or `2`
- `limit`: integer from `2` through `100`

The endpoint returns a bounded set of node records, graph-membership labels, distances from the requested root, and connecting SourceRoot edges. It does not modify the curated graph or persist browser expansion state.

## Graph membership

- `core`: the meaning already exists in the curated SourceRoot graph tables.
- `dynamic`: the meaning is resolved from complete lexical coverage and loaded only for the current exploration.

Dynamic does not mean unsupported. Dynamic meanings still use source-backed Open English WordNet definitions, assertions, and lexical relationships.

## Performance boundaries

- Default expansion depth: 1 hop
- Maximum supported expansion depth: 2 hops
- Default visible-node budget: 72
- Maximum endpoint node limit: 100
- Default maximum active branches: 8
- Per-node relationship fanout is bounded by the backend neighborhood service

## Files

- `graph-v2.html`
- `assets/css/dictionaryroot-dynamic-sphere.css`
- `assets/js/dictionaryroot-api.js`
- `assets/js/dictionaryroot-graph.js`
- `backend/src/routes/lexicon.ts`
- `backend/src/services/dynamic-neighborhood.ts`
- `config/customers/dictionaryroot.json`
- `VERIFY-DICTIONARYROOT-DYNAMIC-SPHERE-EXPANSION.ps1`
- `VERIFY-DICTIONARYROOT-UNIFIED-NAVIGATION-SEARCH.ps1` (updated compatibility hashes)
- `INSTALL-DICTIONARYROOT-DYNAMIC-SPHERE-EXPANSION.ps1`

## Acceptance

Automated verification checks file presence, frontend controls, URL state, graph membership, bounded expansion code, JavaScript syntax, TypeScript typecheck, SourceRoot health, a live lexical-only neighborhood, core/dynamic labels, duplicate suppression, and existing exact-sense compatibility.

Manual browser verification remains required for interaction quality, mobile layout, branch collapse behavior, Back and Forward restoration, and SourceRoot-offline states.
