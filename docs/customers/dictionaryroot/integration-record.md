# DictionaryRoot Integration Record

## Customer

DictionaryRoot is SourceRoot Customer #001 and the reference implementation for future customer onboarding.

## Current dataset milestone

- Imported nodes: 10,000
- Imported assertions: 14,999
- Imported edges: 33,145
- Generated bundle size: 48.34 MB
- Stable bundle ID: `dictionaryroot-oewn-2025-pilot-500`
- Stored domain: `DictionaryRoot`
- Dataset source: Open English WordNet 2025
- License: Creative Commons Attribution 4.0

## Data onboarding completed

- OEWN parser and DictionaryRoot adapter
- SourceRoot bundle generation and validation
- Safe PostgreSQL replacement import
- Registry and search verification
- 10,000-concept performance benchmark
- Local JSON and CSV benchmark reporting

## Customer foundation completed

- Shared DictionaryRoot brand configuration
- Permanent customer manifest
- Shared customer API client
- Shared brand and experience layer
- DictionaryRoot data-status diagnostic page
- Public-page browser titles and navigation
- Customer-friendly relationship labels
- Accessibility and responsive foundation

## Live customer hookup completed in code

- `concept-v2.html` now uses the SourceRoot API instead of static concept records.
- `graph-v2.html` now builds from live SourceRoot nodes and edges.
- Search is restricted by stable bundle identity and the exact stored domain.
- Definitions and examples come from assertions.
- Semantic relationships come from incoming and outgoing edges.
- Source and license details come from SourceRoot source records.
- Graph expansion is one layer per customer action and respects configured node limits.
- Loading, empty, connection, and technical-detail states are customer friendly.

## First-customer lesson discovered

The initial customer manifest used `dictionary` as its domain, but the imported normalized records use `DictionaryRoot`. Customer-filtered search requires the exact stored domain. The contract was corrected before live hookup verification.

## Acceptance still required

The files and customer request path must be verified on Josh's local environment while the SourceRoot backend is running. Browser review should confirm meaning selection, layout, graph expansion, responsive behavior, and source attribution before the stage is committed.

## Next customer milestone

After acceptance, perform a stable-bundle dataset replacement and confirm the same DictionaryRoot frontend reflects the update without code changes.
