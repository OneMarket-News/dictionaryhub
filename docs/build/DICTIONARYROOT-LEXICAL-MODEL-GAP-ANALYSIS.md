# DictionaryRoot Lexical Model Gap Analysis

## Architecture finding

DictionaryRoot directly supports a strong OEWN-shaped core: normalized lemmas,
sense-like synsets, part of speech, one definition per synset, usage examples,
typed semantic relationships, source IDs, exact-lemma search, concept
resolution, and revision history.

It does not directly support the central scaling requirement: multiple
independently sourced statements attached to one reviewed sense while
preserving statement wording, field provenance, bounded locators, competing
etymology, form identity, and a human-auditable comparison decision.

The generic SourceRoot node/assertion/edge metadata can prototype some labels.
It is not a responsible substitute for a normalized production model.

## Exact capability classification

| Capability | Classification | Finding |
|---|---|---|
| Written form | Supportable through existing structures | Lemma arrays/metadata lack first-class form identity |
| Normalized lemma | Supported directly | Indexed `normalized_lemmas` |
| Lexical sense | Supported directly | Synset row and stable node ID |
| Definition claim | Requires schema/migration approval | Current table stores one definition per sense |
| Part of speech | Supported directly | Stored and exposed |
| Lexical category | Supportable through existing structures | Synset type and metadata |
| Usage label | Modest non-migration extension | Metadata possible; no complete-index/UI contract |
| Domain label | Modest non-migration extension | Domain relations exist; normalized claims do not |
| Register | Modest non-migration extension | Source-backed metadata possible |
| Historical status | Requires schema/migration approval | Needs source, period, qualification, provenance |
| Obsolete status | Requires schema/migration approval | A bare boolean would be misleading |
| Technical status | Modest non-migration extension | Domain metadata plus UI activation |
| Inflection | Requires schema/migration approval | Stable form and grammatical-feature identity needed |
| Derivation | Supportable through existing structures | Existing derivational edges |
| Compound | Modest non-migration extension | Deterministic typed relation needed |
| Synonym | Supportable through existing structures | Shared sense membership is preferable to pairwise invention |
| Antonym | Supported directly | Existing typed edge |
| Broader concept | Supported directly | Hypernym/generic edge |
| Narrower concept | Supported directly | Hyponym/generic edge |
| Related concept | Supported directly | Generic edge and `ALSO_SEE` |
| Spelling variant | Requires schema/migration approval | Type, period, dialect, and provenance needed |
| Historical form | Requires schema/migration approval | Context aliases do not connect to lexical senses |
| Language of origin | Requires schema/migration approval | Sourced qualified language claim needed |
| Etymon | Requires schema/migration approval | First-class source form/term identity needed |
| Semantic drift | Requires schema/migration approval | Chronological sense relation plus evidence |
| Disputed etymology | Requires schema/migration approval | Competing proposals must remain distinct |
| Example usage | Supported directly | Stored and exposed as assertions |
| Pronunciation | Modest non-migration extension | Metadata possible; importer/API/UI absent |
| Source attribution | Supported directly | Source IDs on nodes/assertions/edges |
| Source locator | Requires schema/migration approval | Context locators are evidence-scoped, not lexical-claim-scoped |
| Field provenance | Requires schema/migration approval | Context provenance is not linked to lexical fields |
| Version history | Supported directly | Generic revisions and customer history |
| Source comparison | Requires schema/migration approval | No claim-to-claim reviewed comparison structure |

## Recommended normalized model

Preserve separate identities for:

- lexical entry and normalized lemma;
- written, inflected, derived, compound, variant, and historical forms;
- reviewed lexical sense;
- source statement/definition claim;
- part of speech and lexical category;
- usage, dialect, register, technical-domain, historical, and obsolete labels;
- language, etymon, borrowing/cognate relation, and etymology proposal;
- example usage and pronunciation;
- source, edition, bounded locator, and field provenance;
- semantic relationship; and
- claim-to-claim source comparison and reviewer decision.

An etymology proposal must carry certainty/qualification and sources. A
historical or usage label must be a source-backed claim. A source definition
must remain distinct from SourceRoot normalization and project inference.

## Source comparison structure

Each comparison should contain:

`comparison_id`, `sense_id`, `left_claim_id`, `right_claim_id`,
`comparison_type`, `decision_status`, `reviewer_rationale`,
`source_lineage_relation`, and `ruleset_version`.

Allowed deterministic comparison outcomes are:

- equivalent wording;
- broader or narrower definition;
- distinct sense;
- historical versus contemporary;
- general versus technical;
- part-of-speech difference;
- disputed etymology;
- edition/publication-date difference;
- genuine contradiction; and
- editorial-scope difference.

Rules can generate review candidates from exact identity, POS, labels, time,
domain, and inspectible statements. Algorithmic similarity is only a queue
aid. A human decision and rationale are required for acceptance.

## API findings

Already supported:

- exact lemma search and all exact-sense return;
- part-of-speech counts;
- node, assertion, relationship, source, and revision reads;
- graph and coverage aggregates.

Future targeted work:

- list source claims for a sense without flattening wording;
- read forms and grammatical features;
- read etymology proposals and qualifications;
- read bounded locators and field provenance;
- read comparison decisions and lineage;
- paginate/facet dense polysemy and comparison results.

No API route was changed during this gate.

## Frontend findings

| Requirement | Classification |
|---|---|
| Multiple-sense navigation | Already supported |
| Part-of-speech grouping | Already supported |
| Historical/technical labels | Modest frontend enhancement |
| Source comparison | Significant frontend enhancement |
| Etymology display | Significant frontend enhancement |
| Word-family relationships | Data-only activation |
| Variant-form display | Modest frontend enhancement |
| Larger search-result handling | Modest frontend enhancement |
| Provenance coverage indicators | Modest frontend enhancement |
| Quality/uncertainty labels | Modest frontend enhancement |

The current concept page already renders a sense chooser, POS chips,
definitions, words attached to a sense, examples, grouped relationships,
source cards, and history links. New displays should extend these contracts
without replacing URL/history, loading, empty, retry, or accessibility
behavior.

No frontend source was changed during this gate.

## Schema and migration conclusion

Migrations 001–012 remain present and migration 013 remains absent. A future
approved migration is required unless an equally explicit normalized design is
approved. The extension must not overload every distinction into JSON or map
every source definition to an unrelated sense.

The gate therefore returns **CONDITIONAL GO**, not GO. There is no acquisition
blocker, but a schema/API decision is a prerequisite to production
implementation.
