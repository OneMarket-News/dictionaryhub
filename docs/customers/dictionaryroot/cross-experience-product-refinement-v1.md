# DictionaryRoot Cross-Experience Product Refinement v1

## Source of truth

This stage was built directly from the supplied `dictionaryroot-current-product-refinement-source(1).zip`. The supplied tree is treated as the exact latest committed source of truth. This stage layers targeted presentation and interaction refinements over that tree; it does not rebuild the product from an earlier stage.

## Scope

The stage refines the six active DictionaryRoot customer experiences:

- `index.html` — DictionaryRoot Home
- `graph-v2.html` — Knowledge Sphere
- `concept-v2.html` — Concept Experience
- `coverage-v2.html` — Coverage and Data Quality
- `editorial-v2.html` — Editorial Review
- `history-v2.html` — Revision History

The following existing behavior remains in place:

- unified customer navigation and global search
- live SourceRoot API client and customer configuration
- Concept, Coverage, History, and Sphere URL state
- dynamic Sphere expansion and bounded node controls
- source records, attribution, and SourceRoot context links
- current review workflows and identity provenance fields
- deployment-level roles and permissions
- loading, empty, error, and API-offline states
- complete lexical coverage and exact-meaning compatibility

No backend route, database schema, seed data, role rule, permission rule, or SourceRoot record was changed for this refinement.

## Product refinements

### Richer live homepage coverage

The homepage coverage panel now uses the existing live `/dictionaryroot/lexicon/dashboard` response. It displays eight operational measures:

- meanings
- unique lemmas
- semantic relationships
- graph-covered meanings
- lexical-only meanings
- source-backed meanings
- reviewed graph meanings
- meanings with concept-specific revision history

Each diagnostic measure links into the appropriate filtered Coverage workspace. The panel has no static or fallback coverage data. When SourceRoot is unavailable, the existing honest offline state remains visible.

Dataset-lineage records are reported separately from concept-specific revision coverage. A bundle import or dataset revision is not presented as a revision of every meaning.

### Wider Concept and History workspaces

Concept and History pages use a wider responsive work surface, up to 1,880 pixels, while retaining their existing cards, controls, data loading, and context links. Their two-column workspaces collapse to one column at narrower widths.

### Improved small-text readability

A shared refinement stylesheet raises undersized metadata, status, filter, relationship, and helper text to practical minimum sizes and line heights. Keyboard focus rings are also more visible across links, buttons, forms, and the native details control.

### Collapsible advanced Sphere controls

The primary Sphere controls remain immediately available. Lens, domain, dynamic expansion depth, visible-node budget, branch collapse, and dynamic-node reset controls now live in a native collapsed `details` surface. All existing control IDs and JavaScript bindings are preserved.

### Clickable Coverage metrics

Coverage summary metrics are now actual buttons rather than decorative counts. Selecting one updates the existing Coverage filter model, writes the same URL state already supported by the page, and reloads the live results. The labels distinguish complete meanings, graph coverage, lexical-only coverage, source support, reviewed graph meanings, and concept-specific history.

### Honest revision indicators

History now distinguishes three separate concepts:

1. the current live state, which is explicitly not called a revision;
2. concept-specific revision records;
3. dataset-lineage records associated with imports or bundle history.

Coverage and homepage history indicators count concept-specific revision coverage only. Dataset-lineage counts remain separate.

### Editorial identity and Accounts surfaces

Editorial messaging now describes the reviewer field as identity provenance. Entering a reviewer name does not claim to create or authenticate an account. The page states that configured deployment accounts, roles, and permissions remain authoritative.

Identity-related surfaces use a pale blue-gray treatment to separate account/provenance context from the dark operational review workspace without changing review behavior.

## Files added or replaced

- `index.html`
- `concept-v2.html`
- `graph-v2.html`
- `coverage-v2.html`
- `editorial-v2.html`
- `history-v2.html`
- `assets/css/dictionaryroot-product-refinement.css`
- `assets/js/dictionaryroot-home.js`
- `assets/js/dictionaryroot-coverage.js`
- `assets/js/dictionaryroot-history.js`
- `VERIFY-DICTIONARYROOT-CROSS-EXPERIENCE-PRODUCT-REFINEMENT.ps1`
- `VERIFY-DICTIONARYROOT-RESPONSIVE.mjs`
- `docs/customers/dictionaryroot/cross-experience-product-refinement-v1.md`

All other files in the complete ZIP are retained from the supplied source tree.

## Installation

Extract the ZIP to a folder outside the live repository, then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
powershell -ExecutionPolicy Bypass -File .\INSTALL-DICTIONARYROOT-CROSS-EXPERIENCE-PRODUCT-REFINEMENT.ps1 -RepositoryPath (Get-Location).Path
```

The installer creates a timestamped backup under:

```text
.\backups\dictionaryroot-cross-experience-product-refinement-v1-YYYYMMDD-HHMMSS
```

It preserves relative paths and writes `INSTALL-MANIFEST.txt` inside that backup.

## Verification

Run the full source and responsive verifier:

```powershell
powershell -ExecutionPolicy Bypass -File .\VERIFY-DICTIONARYROOT-CROSS-EXPERIENCE-PRODUCT-REFINEMENT.ps1 -RepositoryPath (Get-Location).Path
```

To require a successfully launched Edge, Chrome, or Chromium browser rather than allowing a browser-unavailable warning:

```powershell
powershell -ExecutionPolicy Bypass -File .\VERIFY-DICTIONARYROOT-CROSS-EXPERIENCE-PRODUCT-REFINEMENT.ps1 -RepositoryPath (Get-Location).Path -RequireBrowser
```

To run only source and syntax checks:

```powershell
powershell -ExecutionPolicy Bypass -File .\VERIFY-DICTIONARYROOT-CROSS-EXPERIENCE-PRODUCT-REFINEMENT.ps1 -RepositoryPath (Get-Location).Path -SkipBrowser
```

The browser verifier tests all six experiences at:

- desktop: 1440 × 1000
- tablet: 1024 × 900
- mobile: 390 × 844

It checks that main content and unified navigation initialize, no horizontal page overflow appears, the Sphere advanced controls begin collapsed, eight homepage coverage links exist, and the Editorial identity surface is present. Screenshots are written to `verification/responsive` unless `--no-screenshots` is passed directly to the Node verifier.

## Rollback

The installer never deletes the backup. To roll back, copy the backed-up files from the timestamped backup folder to their matching paths in the repository. Files marked `NEW` in `INSTALL-MANIFEST.txt` did not exist before this stage and can be removed during a complete rollback.
