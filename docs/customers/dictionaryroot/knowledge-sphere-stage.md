# DictionaryRoot Live Knowledge Sphere v1.1

## Milestone

DictionaryRoot now uses a full-width, source-backed knowledge-sphere experience while retaining the verified SourceRoot Customer #001 connection.

## Live data path

DictionaryRoot `graph-v2.html`
-> `dictionaryroot-api.js`
-> SourceRoot API
-> PostgreSQL
-> Open English WordNet 2025

## v1.1 experience improvements

- Expands the graph customer shell, product header, search, controls, and footer across the available viewport.
- Increases the graph canvas, sphere shell, node sizes, and typography.
- Gives the graph approximately three quarters of the desktop layout and a wider concept-detail column.
- Removes the constrained internal details scrollbar so the page scrolls naturally.
- Separates primary exploration controls from secondary visual filters and sphere actions.
- Synchronizes the search field and URL query with every newly centered meaning.
- Deduplicates connected-concept rows by target meaning while preserving all relationship labels.
- Separates neighborhood relationship count from the relationships currently displayed by the active edge filter.
- Adds a center-connection count for clearer graph interpretation.

## Preserved behavior

- Exact lexical search and meaning selection
- Live SourceRoot nodes, assertions, definitions, sources, and edges
- Rotating sphere and flat radial view
- One-, two-, and three-hop exploration
- Center, selected, and all-edge filters
- Domain, importance, and strength lenses
- Domain filtering
- Concept-path breadcrumbs
- Relationship inspection
- Click to inspect and double-click to recenter
- Motion reduction support
- Responsive layout
- No static `data/nodes.json` fallback

## Files

- `graph-v2.html`
- `assets/css/dictionaryroot-live.css`
- `assets/js/dictionaryroot-graph.js`

## Acceptance check

Search for `knowledge`, select an exact sense, and verify that:

1. The full customer experience uses nearly the entire desktop viewport.
2. The sphere and labels are materially larger and readable.
3. Clicking or centering another meaning updates the search field and `q` URL parameter.
4. Connected concepts appear once per target meaning, even when multiple edge types exist.
5. Graph summary distinguishes neighborhood relationships from displayed relationships.
6. The details panel uses normal page scrolling rather than a small internal scrollbar.
7. Sphere and flat views both render from live SourceRoot data.
8. No request is made for `data/nodes.json`.
