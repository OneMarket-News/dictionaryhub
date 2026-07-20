# DictionaryRoot Unified Navigation and Search v1

## Stage purpose

This stage unifies the committed DictionaryRoot Concept Experience, Knowledge Sphere, and Source Experience behind one responsive customer navigation shell and one live exact-meaning search surface.

The uploaded `dictionaryroot-current-frontend.zip` was treated as the committed source of truth. Its SHA-256 hash is:

`6261b2a1f982ab3d021788ddae6e27b96a1ee24a57fd4c2b8f2afcaf8470dedd`

The package contains complete files. It does not contain patches or snippets, and the installer is located directly at the extracted ZIP root.

## Preserved committed functionality

The following uploaded files are retained byte-for-byte and are checked by the verifier with committed SHA-256 hashes:

- `assets/css/dictionaryroot-brand.css`
- `assets/css/dictionaryroot-live.css`
- `assets/js/dictionaryroot-api.js`
- `assets/js/dictionaryroot-brand.js`
- `config/customers/dictionaryroot.json`
- `index.html`
- `explore.html`

This preserves the existing customer manifest, SourceRoot API client and source-registry contracts, exact-meaning ranking helpers, branding layer, Knowledge Sphere styling, and existing landing/explore pages.

The Concept, Knowledge Sphere, and Sources experience files remain based on the uploaded versions and are extended only where required for shared context and browser history behavior.

## New shared files

### `assets/brand/dictionaryroot-mark.svg`

Supplies the brand-mark dependency already referenced by the committed HTML and branding layer so the extracted replacement package renders the DictionaryRoot lockup without relying on an unbundled file.


### `assets/js/dictionaryroot-navigation.js`

Provides:

- One shared DictionaryRoot header across all three live experiences.
- Active-page indicators using `aria-current="page"`.
- A global live SourceRoot meaning search.
- Existing `DictionaryRootApi.rankMeaningResults`, `exactMeaningResults`, `meaningMatchRank`, and `preferredMeaningLabel` compatibility.
- Exact senses shown before related matches.
- Direct actions to open the selected meaning in Concept, Knowledge Sphere, or Sources.
- Context-aware link generation.
- Mobile menu behavior.
- URL-change synchronization for `pushState`, `replaceState`, Back, and Forward.
- No static search records and no fallback source data.

### `assets/css/dictionaryroot-navigation.css`

Provides the shared full-width responsive shell, desktop navigation, mobile menu, global search dropdown, result cards, focus states, active indicators, and reduced-motion handling.

## Updated experience files

### `concept-v2.html` and `assets/js/dictionaryroot-concept.js`

- Load the shared navigation assets.
- Preserve existing concept search, exact-sense choice, SourceRoot concept loading, definitions, relationships, and provenance.
- Add source-registry links for loaded source records.
- Preserve the selected node, label, and source when moving to Knowledge Sphere or Sources.
- Retain existing Back/Forward behavior.

### `graph-v2.html` and `assets/js/dictionaryroot-graph.js`

- Load the shared navigation assets.
- Preserve the current rotating sphere engine, depth controls, visual lenses, relationship filtering, source loading, and meaning ranking.
- Add browser history entries for user-selected sphere centers and searches.
- Add a `popstate` handler so Back and Forward rebuild the correct sphere or search-result state.
- Avoid adding history entries for internal redraws such as depth changes.
- Add source-registry links from provenance cards.
- Preserve selected concept/source context when moving to Concept or Sources.

### `sources-v2.html` and `assets/js/dictionaryroot-sources.js`

- Load the shared navigation assets.
- Preserve live SourceRoot source retrieval, filtering, sorting, density controls, assertion scans, relationship scans, linked concepts, loading states, empty states, and offline states.
- Preserve a separate source-library search query in `q`.
- Store incoming semantic context in `meaning` and `nodeId`, preventing the global meaning label from being confused with the source-library filter.
- Carry the selected source, meaning label, and node into Concept and Knowledge Sphere links.
- Retain existing Back/Forward source selection and filter behavior.

## URL contract

### Concept Experience

`concept-v2.html?q=<meaning>&nodeId=<source-root-node-id>&source=<optional-source-id>`

### Knowledge Sphere

`graph-v2.html?q=<meaning>&nodeId=<source-root-node-id>&source=<optional-source-id>`

### Source Experience

`sources-v2.html?source=<source-id>&meaning=<meaning>&nodeId=<source-root-node-id>&q=<optional-source-filter>&type=<optional-type>&sort=<optional-sort>&density=<optional-density>`

The Source Experience intentionally reserves `q` for source-library filtering. Cross-experience semantic context uses `meaning`.

## Installation

1. Extract the ZIP to a temporary folder outside the repository.
2. Open PowerShell in the extracted folder.
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL-DICTIONARYROOT-UNIFIED-NAVIGATION-SEARCH.ps1
```

The default repository is:

`C:\Users\Josh\Documents\GitHub\dictionaryhub`

To use another path:

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL-DICTIONARYROOT-UNIFIED-NAVIGATION-SEARCH.ps1 -RepositoryPath "C:\path\to\dictionaryhub"
```

The installer:

- Refuses to run from the repository root because that would prevent a trustworthy pre-install backup.
- Validates that every package file exists before copying.
- Creates a timestamped backup at `backups\dictionaryroot-unified-navigation-search-v1-YYYYMMDD-HHMMSS`.
- Preserves the original relative path of every backed-up file.
- Writes an installation manifest into the backup folder.
- Copies complete replacement files.
- Does not claim browser or live API verification passed.

## Verification

Start the local SourceRoot backend, then run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\VERIFY-DICTIONARYROOT-UNIFIED-NAVIGATION-SEARCH.ps1
```

Static-only verification is available when the API is intentionally stopped:

```powershell
powershell -ExecutionPolicy Bypass -File .\VERIFY-DICTIONARYROOT-UNIFIED-NAVIGATION-SEARCH.ps1 -SkipApi
```

The verifier checks:

- Required files.
- Committed hashes for unchanged API, branding, manifest, and landing files.
- Shared CSS and JavaScript inclusion on all three experiences.
- Script loading order.
- Exact-meaning search compatibility markers.
- Active-page and mobile-navigation behavior markers.
- Concept, Sphere, and Sources context-link markers.
- Back/Forward handlers on all three experiences.
- Absence of `data/nodes.json` references.
- JavaScript syntax through `node --check` when Node.js is available.
- SourceRoot health, search, sources, and node endpoints unless `-SkipApi` is used.

The verifier exits with code `1` when a required check fails. A zero exit code means the automated checks run on that machine passed; it does not replace the manual browser acceptance checks below.

## Manual acceptance checklist

1. Open `concept-v2.html` and confirm the Concept tab is active.
2. Open `graph-v2.html` and confirm the Knowledge Sphere tab is active.
3. Open `sources-v2.html` and confirm the Sources tab is active.
4. Resize below 900 pixels and confirm the menu button opens and closes the navigation.
5. Use the global header search for a term with multiple senses.
6. Confirm exact senses appear before related matches.
7. Open a result in Concept, Sphere, and Sources and compare the `q`/`meaning`, `nodeId`, and `source` parameters.
8. In Concept, open a source record and confirm Sources selects that source when the ID is available.
9. In Sphere, recenter several times, then use Back and Forward and confirm the sphere rebuilds each center.
10. In Sources, change source, filter, sort, and density, then use Back and Forward.
11. Stop SourceRoot and confirm the global search reports an API failure without static results.
12. Confirm the existing Concept, Sphere, and Source offline/empty/loading states still display.

## Rollback

Use the timestamped backup created by the installer. Copy the contents of the selected backup folder back to the repository while preserving relative paths. The backup contains only files that existed before installation plus `install-manifest.txt`.

## Files delivered

- `INSTALL-DICTIONARYROOT-UNIFIED-NAVIGATION-SEARCH.ps1`
- `VERIFY-DICTIONARYROOT-UNIFIED-NAVIGATION-SEARCH.ps1`
- `concept-v2.html`
- `graph-v2.html`
- `sources-v2.html`
- `index.html`
- `explore.html`
- `assets/brand/dictionaryroot-mark.svg`
- `assets/css/dictionaryroot-brand.css`
- `assets/css/dictionaryroot-live.css`
- `assets/css/dictionaryroot-navigation.css`
- `assets/js/dictionaryroot-api.js`
- `assets/js/dictionaryroot-brand.js`
- `assets/js/dictionaryroot-navigation.js`
- `assets/js/dictionaryroot-concept.js`
- `assets/js/dictionaryroot-graph.js`
- `assets/js/dictionaryroot-sources.js`
- `config/customers/dictionaryroot.json`
- `docs/customers/dictionaryroot/unified-navigation-search-v1.md`
