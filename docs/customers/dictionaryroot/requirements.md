# DictionaryRoot Customer Requirements

## Customer identity

- Customer: DictionaryRoot
- Customer ID: `dictionaryroot`
- Product type: Dictionary knowledge platform
- SourceRoot bundle: `dictionaryroot-oewn-2025-pilot-500`
- Dataset: Open English WordNet 2025
- Environment: Local development

## Customer outcomes

DictionaryRoot must let a visitor:

1. Search for a written term.
2. Distinguish multiple meanings of the same written term.
3. Open a selected concept and read its source-backed definition.
4. Explore semantic relationships in a local knowledge graph.
5. Inspect source attribution without needing to understand SourceRoot internals.
6. Receive understandable loading, empty, and error states.
7. Continue working after a stable-bundle dataset replacement without frontend rewrites.

## Product boundaries

SourceRoot owns validation, import, storage, registries, provenance, search, and API responses.

DictionaryRoot owns product branding, visitor navigation, word-sense selection, concept presentation, graph interaction, and customer-facing language.

## Completion criteria

The first-customer hookup is complete after live search, concept display, graph exploration, provenance display, connection diagnostics, acceptance testing, and a replacement-dataset test all pass.
