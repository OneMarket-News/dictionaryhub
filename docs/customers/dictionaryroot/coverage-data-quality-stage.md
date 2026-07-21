# DictionaryRoot Coverage and Data Quality Dashboard v1

## Stage goal

Make DictionaryRoot's coverage visible without confusing complete lexical availability with bounded graph integration.

The dashboard uses live SourceRoot database queries. It does not contain fallback counts, static quality records, or inferred historical snapshots.

## Customer experience

`coverage-v2.html` provides:

- live system-wide lexical, graph, source, assertion-review, and revision totals
- coverage layers with percentages calculated from live counts
- part-of-speech coverage for noun, verb, adjective, and adverb senses
- a quality queue for lexical-only meanings, assertion gaps, review gaps, source gaps, and missing concept-specific revisions
- a searchable, filterable, paginated lemma registry
- direct context links to Concept, Knowledge Sphere, Sources, and History
- URL state and browser Back/Forward behavior
- desktop, tablet, and mobile layouts
- explicit loading, empty, and SourceRoot-offline states

The shared DictionaryRoot navigation now includes **Coverage**, and Home includes a fifth product entry point.

## Coverage definitions

### Complete lexical meaning

A row in `dictionaryroot_lexicon_synsets`. These meanings remain available to exact search and on-demand concept routes.

### Graph-covered meaning

A lexical meaning whose `node_id` also exists in the persisted `nodes` registry. This is the bounded graph layer used by the pilot bundle.

### Lexical-only meaning

A complete lexical meaning without a persisted graph node. It is not a missing definition. DictionaryRoot still resolves it on demand from Open English WordNet.

### Source-backed meaning

A lexical meaning whose `source_id` resolves to a record in the SourceRoot `sources` registry.

### Unsupported meaning

A lexical meaning whose source identity does not resolve to a SourceRoot source record. The dashboard reports this honestly rather than assuming source support.

### Assertion-backed meaning

A graph-covered meaning with at least one persisted assertion.

### Reviewed meaning

A graph-covered meaning with at least one assertion whose `review_status` is `reviewed`.

### Concept-specific revision coverage

A meaning with a SourceRoot revision where `object_type = node` and `object_id` matches that meaning's node ID.

Dataset/import-bundle revisions are displayed separately. They do not count as concept-specific historical snapshots.

## Live API additions

### Dashboard summary

```text
GET /api/v1/dictionaryroot/lexicon/dashboard?bundleId={bundleId}
```

Returns dataset identity, complete totals, graph and lexical-only counts, source support, persisted assertions, reviewed graph meanings, concept-specific revision coverage, dataset revision count, and part-of-speech breakdowns.

### Lemma coverage registry

```text
GET /api/v1/dictionaryroot/lexicon/lemmas
```

Supported parameters:

- `bundleId`
- `q`
- `partOfSpeech`
- `coverage=all|complete|incomplete|partial|lexical-only`
- `source=all|source-backed|unsupported`
- `history=all|with-history|no-history`
- `review=all|reviewed|needs-review`
- `sort=gaps|coverage|senses|lemma`
- `page`
- `limit` (maximum 100)

Each row returns exact-sense counts, graph counts, source support, persisted assertion and review counts, concept revision counts, part-of-speech counts, and representative node IDs for cross-experience links.

## Files

### New

- `coverage-v2.html`
- `assets/css/dictionaryroot-coverage.css`
- `assets/js/dictionaryroot-coverage.js`
- `docs/customers/dictionaryroot/coverage-data-quality-stage.md`
- `VERIFY-DICTIONARYROOT-COVERAGE-DATA-QUALITY.ps1`

### Updated

- `index.html`
- `assets/css/dictionaryroot-home.css`
- `assets/js/dictionaryroot-brand.js`
- `assets/js/dictionaryroot-navigation.js`
- `config/dictionaryroot-brand.json`
- `backend/src/routes/lexicon.ts`
- `backend/src/services/lexical-store.ts`

## Compatibility boundaries

This stage does not:

- change the complete lexical import format
- replace the existing exact-meaning search contract
- expand the bounded Knowledge Sphere bundle automatically
- invent assertions, sources, reviews, or revisions
- add frontend fallback data
- alter existing Concept, Sphere, Sources, or History route contracts

## Acceptance checks

1. Run the stage verifier with SourceRoot running.
2. Confirm the summary identity matches the imported Open English WordNet dataset.
3. Confirm graph-covered plus lexical-only equals complete meanings.
4. Confirm source-backed plus unsupported equals complete meanings.
5. Confirm concept revision coverage plus its gap equals complete meanings.
6. Filter to lexical-only and open a result in Concept, Sphere, Sources, and History.
7. Search `value`, `bank`, and `light` in the lemma explorer.
8. Use Back/Forward through filter and pagination changes.
9. Check 390 × 844 and 320 × 568 layouts.
10. Stop SourceRoot and confirm no counts or records are substituted.
