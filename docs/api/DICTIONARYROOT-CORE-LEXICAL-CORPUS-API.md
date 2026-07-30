# DictionaryRoot Core Lexical Corpus API

Dataset: `dictionaryroot-core-lexical-corpus-v1`  
Version: `1.0.0`

All routes are read-only beneath
`/api/v1/dictionaryroot/lexicon/evidence`. They read migrations 013 and 014
directly and never manufacture fallback records.

## Search and detail

- `GET /search?q=bank&page=1&limit=25` returns deterministic exact/prefix
  production senses, exact result totals, part of speech, the first
  source-attributed claim, review state, and dataset identity.
- `GET /lemmas/:lemmaId` returns a lemma and its ordered senses.
- `GET /senses/:senseId` returns claims, forms, etymology proposals, source
  comparisons, locators, field provenance, sources, relationships, evidence
  counts, dataset version, and record versions.
- `GET /objects/:subjectId/:resource` reads `claims`, `forms`, `etymologies`,
  `comparisons`, `locators`, or `provenance`.

## Knowledge Sphere

- `GET /graph/seeds?q=bank&limit=10`
- `GET /graph/neighborhood/:seedId?depth=2&limit=100`
- `GET /relationships/:relationshipId`
- `GET /relationships/:relationshipId/evidence`

The graph adapter derives typed objects and stable edges. It stores no generic
duplicate lexical nodes.

## Coverage

`GET /coverage` always returns HTTP 200 when the endpoint can calculate its
state:

- `awaiting_production_corpus` when SourceRoot is healthy but no accepted
  production lexical dataset exists;
- `production_metrics_available` with canonical migration 013/014 counts and
  quality metrics after installation.

The frontend separately reports backend unavailability, endpoint
unavailability, awaiting-corpus state, calculation failure, and available
metrics.

## Sources

`GET /sources` returns the accepted production source registry with dataset
identity, rights class, license basis, institution, version/edition, stable
URL, lineage, and exact supported lemma, sense, claim, relationship,
relationship-evidence, locator, provenance, and comparison counts. Restricted
modern source text is never returned.

