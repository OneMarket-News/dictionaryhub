# DictionaryRoot - SourceRoot Customer #001

DictionaryRoot is the first full customer application connected to the SourceRoot knowledge engine.

## Product promise

Explore how meaning connects through source-backed definitions, distinct word senses, semantic relationships, and an expandable knowledge graph.

## Live architecture

```text
Open English WordNet
        -> DictionaryRoot adapter
        -> SourceRoot validation and PostgreSQL import
        -> SourceRoot API
        -> DictionaryRoot customer API client
        -> Live search, concept explorer, sources, and graph
```

## Customer configuration

- Manifest: `config/customers/dictionaryroot.json`
- Brand: `config/dictionaryroot-brand.json`
- API client: `assets/js/dictionaryroot-api.js`
- Concept customer controller: `assets/js/dictionaryroot-concept.js`
- Graph customer controller: `assets/js/dictionaryroot-graph.js`
- Shared experience layer: `assets/js/dictionaryroot-brand.js`
- Shared styles: `assets/css/dictionaryroot-brand.css`
- Live experience styles: `assets/css/dictionaryroot-live.css`
- Connection diagnostics: `dictionaryroot-connection.html`

## Current live customer capabilities

- Customer-filtered search against the stable DictionaryRoot bundle.
- Separate results for distinct word senses.
- Live node, assertion, edge, and source retrieval.
- Customer-friendly definitions and relationship labels.
- Expandable graph with browser safety limits.
- Advanced SourceRoot records kept available without dominating the customer experience.

## Customer acceptance

Run `VERIFY-DICTIONARYROOT-LIVE-CONNECTION.ps1`, then complete the browser acceptance checklist under `docs/customers/dictionaryroot/acceptance-checklist.md`.
