# DictionaryRoot Hybrid Map + Unified Navigation Recovery v1

## Purpose

This recovery stage restores the DictionaryRoot Hybrid Map contract on top of Unified Navigation and Search v1. It does not replace the live SourceRoot API client, exact-meaning ranking, customer branding, Concept Experience, or Source Experience.

## Restored behavior

- Map Mode is the default rotating radial knowledge map.
- Readable Mode is a stable, non-rotating card layout using the same live nodes and relationships.
- The selected concept panel can still be hidden to enlarge the graph.
- Mode changes are stored in the URL as `mode=map` or `mode=readable`.
- Browser Back and Forward restore the selected graph mode, search meaning, and center node.
- Shared DictionaryRoot navigation and global exact-meaning search remain loaded before the graph experience.
- Concept and source links continue to preserve `nodeId`, meaning, and source context.
- No fallback graph data or `data/nodes.json` dependency is introduced.

## Files replaced

- `graph-v2.html`
- `assets/js/dictionaryroot-graph.js`

## File added

- `assets/css/dictionaryroot-hybrid-map.css`

## Acceptance sequence

1. Run `VERIFY-DICTIONARYROOT-HYBRID-MAP-UNIFIED-NAVIGATION-RECOVERY.ps1`.
2. Run the existing `VERIFY-DICTIONARYROOT-HYBRID-MAP.ps1` while SourceRoot is running.
3. Run the existing `VERIFY-DICTIONARYROOT-UNIFIED-NAVIGATION-SEARCH.ps1` while SourceRoot is running.
4. In a browser, confirm Map Mode rotates and can be dragged.
5. Switch to Readable Mode and confirm the graph becomes stable and the URL contains `mode=readable`.
6. Use Back and Forward to confirm mode, center node, and query are restored.

The installer only copies files and creates a timestamped backup. It does not claim that verification passed.
