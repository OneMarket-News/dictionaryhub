# DictionaryRoot Repository Architecture

This document describes the checked-out repository as observed on
2026-07-27. It is intentionally concise and does not replace source
inspection for a specific stage.

## Observed repository facts

### Platform relationship

DictionaryRoot is the customer-facing lexical product. SourceRoot is the
shared platform layer that provides live API access, source identity,
assertions, relationships, provenance, revisions, and governed records.
The browser loads `assets/js/sourceroot-api.js` before
`assets/js/dictionaryroot-api.js`; page code calls the DictionaryRoot client,
which delegates requests to the shared SourceRoot request layer.

`config/customers/dictionaryroot.json` supplies the development API URL,
bundle identity, feature settings, graph limits, and identity configuration.
`assets/js/dictionaryroot-api.js` contains configuration defaults for
manifest-load failure, but it does not contain fallback product, concept,
source, or graph records.

### Canonical customer pages

| Experience | Page | Page-specific JavaScript |
|---|---|---|
| Home | `index.html` | `assets/js/dictionaryroot-home.js` |
| Knowledge Sphere | `graph-v2.html` | `assets/js/dictionaryroot-graph.js` |
| Concept | `concept-v2.html` | `assets/js/dictionaryroot-concept.js` |
| Sources | `sources-v2.html` | `assets/js/dictionaryroot-sources.js` |

History, coverage, editorial, workflow, account, and administration pages
also participate in the shared navigation, but the four pages above are the
canonical experiences for this foundation manifest.

### Shared navigation and branding

`assets/js/dictionaryroot-navigation.js` owns the unified navigation,
global meaning search, contextual cross-page URLs, mobile menu, active-page
state, and account chip. It wraps browser history updates and reacts to
`popstate`, URL-change, and authentication events.

Brand identity comes from:

- `config/dictionaryroot-brand.json`
- `config/customers/dictionaryroot.json`
- `assets/brand/dictionaryroot-mark.svg`
- `assets/js/dictionaryroot-brand.js`
- `assets/css/dictionaryroot-brand.css`

The branding script also adds accessibility affordances such as the skip
link and missing labels.

### API-client layer

- `assets/js/sourceroot-api.js` provides request IDs, timeout and abort
  handling, normalized SourceRoot errors, and offline/network categories.
- `assets/js/dictionaryroot-api.js` loads customer configuration and exposes
  search, exact-match ranking, pagination, source-linked records, concept
  aggregation, and graph-facing helpers.
- `assets/js/dictionaryroot-auth.js` supplies the shared browser identity
  boundary used by navigation and governed experiences.

The live API remains authoritative. Empty or offline UI is rendered when
records cannot be retrieved; no static knowledge-record fallback is present
in the canonical runtime files.

### Styles

`dictionaryroot-brand.css`, `dictionaryroot-navigation.css`, and
`dictionaryroot-live.css` form the common visual layer. Home, hybrid-map,
dynamic-sphere, product-refinement, and governance styles extend that layer
for specific experiences or capabilities.

### Initialization order

Each canonical page declares deferred scripts in this order:

1. shared SourceRoot API layer
2. DictionaryRoot API client
3. authentication
4. branding
5. navigation
6. page-specific implementation

The order is a protected public integration boundary.

### URL state and cross-page relationships

Canonical scripts use `URLSearchParams`, `pushState`, `replaceState`, and
`popstate`. Navigation carries meaning, node, source, revision, filter, and
view context where appropriate. Concept results link to the Knowledge Sphere,
sources, and history. Source records link back to concepts and related
provenance. The Knowledge Sphere loads a center concept and expands
relationships on demand.

### Loading, empty, and offline states

The canonical HTML provides initial loading containers. Page JavaScript
replaces them with live results, explicit empty states, or API-unavailable
messages and retry behavior. These states are customer behavior, not sample
data.

### Installer and verifier patterns

Root installers are explicit PowerShell entry points. Recent installers
validate prerequisites, repository/package boundaries, prior-release
identity, database safety where applicable, file hashes, backups, installed
bytes, and rollback records before invoking a stage verifier.

Root verifiers use deterministic `[PASS]`, `[FAIL]`, `[WARN]`, and `[INFO]`
results with counters and nonzero failure exits. Coverage ranges from static
markers and JavaScript syntax to backend tests, database integration, and
immutable release replay. The new root verifier inventories these scripts;
it runs them only when explicitly requested.

### Stage-development pattern

When active, `ROOT-MANIFEST.json` names one stage, its specification, allowed
files, preflight changes, and required verifiers. `docs/stages/active/`
contains the current specification; completed specifications move to
`docs/stages/completed/`. Tools under `tools/` create, select, complete,
export context for, and verify stages without changing Git history.

## Architecture inferred from file relationships

- The browser pages are intended to be served from one origin while the
  local SourceRoot API runs at the configured API base URL.
- Shared navigation is the cross-experience context contract; changing its
  query mapping can affect pages beyond the four canonical entries.
- Exact-meaning ranking is centralized in `dictionaryroot-api.js` and reused
  by home, navigation, Concept, and Knowledge Sphere code.
- The Source Experience performs bounded pagination and client-side
  correlation when the API does not return a single exact source bundle.

These are strong inferences from current callers, not promises of an
undocumented external service.

## Items requiring confirmation before related changes

- Confirm live backend routes and response shapes before changing API calls.
- Confirm database and authentication configuration without copying secrets
  into context artifacts.
- Run browser checks before changing layout, navigation, URL state,
  accessibility, or responsive styles.
- Run live API checks before claiming network, pagination, ranking, graph,
  source-link, or offline behavior.
- Inspect the stage-specific installer and verifier before changing their
  prerequisite or rollback contracts.
- Inspect page-specific JavaScript before changing shared markup IDs or
  initialization order.

No production hosting topology, undocumented API, or external identity
provider is asserted by this document.
