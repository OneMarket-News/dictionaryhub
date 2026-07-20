# DictionaryRoot Concept Experience v1

## Milestone

DictionaryRoot now presents a live, customer-facing concept experience built on the verified SourceRoot connection.

## Customer journey

1. Search a word.
2. Compare exact and related word senses.
3. Open one precise meaning.
4. Read the primary source-backed definition.
5. Inspect lexical forms and usage examples.
6. Explore grouped semantic relationships.
7. Follow a connected meaning or open it in the Knowledge Sphere.
8. Review source and provenance information.
9. Inspect the advanced SourceRoot record when needed.

## Live data flow

DictionaryRoot concept page
→ DictionaryRoot API client
→ SourceRoot API
→ PostgreSQL
→ Open English WordNet records

## Experience improvements

- Full-width layout aligned with the Knowledge Sphere
- Exact-sense chooser with clear ranking labels
- Definition-first concept hierarchy
- Record summary for assertions, relationships, connected meanings, and sources
- Deduplicated connected meanings with preserved edge labels and directions
- Relationship families for broader, narrower, opposite, part/whole, and related meanings
- Source and provenance cards
- Sticky meaning summary and navigation tools
- Search field and URL synchronization
- Browser back/forward navigation
- Responsive widescreen, tablet, and mobile layouts
- Advanced SourceRoot JSON retained behind a disclosure control

## Scope

This stage changes only the DictionaryRoot concept experience and its shared live stylesheet. It does not change the SourceRoot backend, customer manifest, API client, brand layer, search store, or Knowledge Sphere engine.
