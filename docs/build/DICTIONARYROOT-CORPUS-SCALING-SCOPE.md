# DictionaryRoot Core Lexical Corpus v1 — Recommended Scope

## Decision

Recommendation: **CONDITIONAL GO**.

The repository can responsibly move beyond its current OEWN pilot to a
reviewed, repeatable corpus of approximately 500 canonical lemmas and 1,000
lexical senses. The source set and acquisition path are adequate. Production
implementation remains conditional on approval of a narrow normalized lexical
extension for source claims, forms, etymology proposals, locators, field
provenance, and source comparisons, plus matching read APIs and targeted
customer-experience work.

This document is a scope recommendation, not corpus data. No production corpus
was generated or imported.

## Current accepted baseline

The canonical repository artifact is
`data/dictionaryroot/dictionaryroot-oewn-2025-pilot-500.json`:

| Measure | Exact repository value |
|---|---:|
| Bundle | `dictionaryroot-oewn-2025-pilot-500` |
| Version | `0.1.0-oewn-2025` |
| Lexical records / senses | 500 |
| Distinct normalized lemmas | 654 |
| Claims | 928 |
| Definition claims | 500 |
| Usage-example claims | 428 |
| Sources | 1 |
| Relationships | 436 |
| Structured locators | 0 |
| Field-provenance records | 0 |
| Historical forms | 0 |
| Etymology structures | 0 |
| Source-comparison structures | 0 |
| Orphan records | 0 |
| Duplicate identities | 0 |
| Search-covered senses | 500 |
| Graph-covered senses | 225 |
| Concept-page-covered senses | 500 |
| Source-page-covered sources | 1 |

The part-of-speech distribution is 320 nouns, 87 verbs, 88 adjectives, and 5
adverbs. The 436 relationships comprise 274 derivational relations, 102
hypernym/hyponym relations, 12 antonyms, 20 topic-domain relations, and 28
other typed relations.

The read-only `sourceroot_test` inspection found no row in
`dictionaryroot_lexicon_datasets`. Repository and database state therefore
differ: the accepted customer bundle exists in the repository, while the
complete lexical index is not currently imported into the test database.
HistoryRoot remains
`historyroot-plymouth-knowledge-dataset-v1` version `1.3.0`.

## Stratified lemma-selection method

Production selection must start from a deterministic candidate ledger. Normalize
Unicode and whitespace, case-fold for selection identity, attach each candidate
to one or more review strata, sort by `(primary_stratum, normalized_lemma,
candidate_source_id)`, and select only after rights, source availability, and
sense-review readiness pass.

The first corpus should deliberately include:

- common high-frequency and function words;
- highly polysemous words;
- concrete and abstract nouns;
- verbs, adjectives, and adverbs;
- word families, derivations, compounds, and inflections;
- borrowed words and variant spellings;
- historical and obsolete senses;
- modern technical and specialized senses;
- disputed or qualified etymologies;
- entries whose sense boundaries or parts of speech differ among sources;
- HistoryRoot-linked civic, evidentiary, identity, and place vocabulary; and
- future BibleRoot cases involving translation choice, metaphor, idiom,
  phrase-level semantics, historical meaning, and semantic range.

Selection cannot be alphabetical, ease-biased, or quota-filled with duplicated
or unsupported content. A difficult case remains in scope when it tests a
necessary lexical distinction.

## Cross-root seed set

The bounded HistoryRoot seed set is:

`account`, `alliance`, `claim`, `colony`, `community`, `evidence`, `homeland`,
`identity`, `memory`, `migration`, `nation`, `settlement`, `source`,
`sovereignty`, `territory`, `translation`, `treaty`, and `tribe`.

Every historical linkage must attach to a source-specific sense and time
context. A modern definition cannot be projected backward onto a document.

BibleRoot is deferred. Chunk 10 should preserve enough identity to later model
original-language terms, translation-sense selection, historical meaning,
metaphor, idiom, phrase semantics, semantic range, and disputed translation.

## Projected production target

| Object | Responsible projection |
|---|---:|
| Canonical lemmas | 500 |
| Lexical senses | 1,000 |
| Source-attributed definition claims | 1,200 |
| Accepted reusable sources | 17 |
| Lexical relationships | 850 |
| Historical, alternate, inflected, or derived forms | 325 |
| Etymology or language-origin structures | 275 |
| Multi-source comparison structures | 225 |
| Structured locators | 1,200 |
| Field-provenance records | 1,400 |
| Historical or obsolete senses | 120 |
| Technical or specialized senses | 125 |
| Qualified, disputed, or uncertain structures | 110 |

These are feasibility projections, not quotas. Unsupported objects must be
omitted rather than fabricated.

## Mandatory-minimum feasibility

The source set can support the required minimum of 300 lemmas, 600 senses, 600
definition claims, 12 usable sources, 400 relationships, 150 forms, 100
etymology structures, 100 comparisons, 600 locators, 600 field-provenance
records, and 50 each of historical, technical, and uncertainty-bearing
structures.

The path is conditional because the current one-definition-per-synset lexical
table cannot preserve multiple source statements, their field-level
provenance, competing etymologies, or reviewed comparison decisions. Those
distinctions must not be collapsed into metadata merely to avoid a migration.

## Deterministic preparation path

1. Pin source edition, download URL or archive identifier, rights evidence,
   acquisition timestamp, and source SHA-256.
2. Preserve raw source bytes unchanged outside the generated corpus artifact.
3. Parse to a source-faithful intermediate ledger with bounded locators.
4. Normalize forms and candidate sense mappings without overwriting source
   wording.
5. Generate deterministic review queues for sense alignment, labels,
   etymology, relationships, and comparison.
6. Require a human decision and rationale for every ambiguous mapping.
7. Generate the reviewed bundle from stable IDs and sorted records.
8. Validate counts, rights, locators, provenance, orphans, duplicates, source
   concentration, and lineage concentration.
9. Import replacement-safely only in the future implementation stage.

## Coverage and quality measures

The production report must deterministically calculate lemma and sense counts,
definitions per lemma, sources per sense, multi-source and part-of-speech
coverage, historical and technical coverage, etymology, morphology,
relationship, locator, and field-provenance coverage, source concentration,
license distribution, open-reuse share, orphan and duplicate counts, unlinked
forms, unsupported labels and etymologies, single-source and single-lineage
senses, unresolved sense/POS/chronology/origin decisions, and missing
comparisons.

## Conditions before production implementation

- Approve normalized claim, form, etymology, locator, provenance, and
  comparison structures.
- Approve matching API contracts and targeted frontend behavior.
- Approve isolation and attribution rules for CC BY-SA/GFDL material.
- Pin every historical volume/item and complete page-image/OCR review.
- Treat editorial lineages as dependencies: OEWN/Princeton and
  Wiktionary/DBnary are not independent corroboration.
