# BibleRoot Commentary and Interpretation Provenance v1 architecture

## Boundary

Commentary is attributed historical source content. Interpretation statements
are source-authored. SourceRoot stores, organizes, and renders provenance; it
does not endorse, reconcile, rank, summarize, recommend, or determine
theological accuracy. Shared placement does not establish agreement. Missing
coverage is not evidence against a view, and inclusion is not a quality rank.

## Existing-schema diagnosis and migration decision

Migration 015 owns the BibleRoot canon, books, chapters, canonical verses,
source publications, immutable source artifacts, Bible editions, verse text,
and phrase occurrences. Migration 016 adds artifact-level rights components,
Original Language editions, source-native verses and tokens, analyses, and
explicit canonical mappings. Chunk 13B adds no comparison-row table: it joins
edition verse text through the existing canonical verse identity at read time.

Those structures cannot faithfully store a named commentary work, its complete
source section, a section's verse/range/chapter scope, an exact compressed-source
locator, or deterministic statements with offsets into the full section.
Treating commentary as Bible text would erase the primary-text boundary.
Treating it as generic contextual assertions would turn source-authored
interpretation into a SourceRoot assertion and would not enforce BibleRoot
canonical start/end integrity. Migration
`017_create_bibleroot_commentary_provenance.sql` is therefore required. No
migration 018 is used.

Migration 017 reuses `imported_bundles`, `sources`,
`bibleroot_source_publications`, `bibleroot_source_artifacts`,
`bibleroot_source_artifact_rights_components`, and
`bibleroot_canonical_verses`. It adds four narrow tables:

- works bind title/attribution and edition identity to publication, artifact,
  rights, dataset, and stable display order;
- sections retain exact normalized display text, the exact decoded OSIS slice,
  locator, hashes, and stable order;
- section anchors retain verse, range, chapter, source-heading-range, or
  unresolved scope with explicit mapping state and note;
- statements retain exact source substrings, deterministic order, UTF-16
  character offsets, content hashes, and inherited provenance.

Comments about manuscripts or translation choices remain source commentary.
They are not promoted to Original Language mapping or word alignment.

## Source selection and limitations

Accepted:

- Matthew Henry, *Matthew Henry's Complete Commentary on the Whole Bible*,
  CrossWire MHC module 2.2 dated 2022-08-29, prepared from the CCEL text.
- Robert Jamieson, A. R. Fausset, and David Brown, *Commentary Critical and
  Explanatory on the Whole Bible* (1871), CrossWire JFB module 3.0 dated
  2021-02-15, sourced from CCEL.

Each CrossWire module page and internal `.conf` declares public-domain
distribution. CrossWire states no territorial limitation; the metadata warns
downstream users to assess jurisdiction. This is a recorded provider statement,
not a new SourceRoot legal conclusion.

John Gill was rejected. No inspected candidate established both a clean
machine-readable transcription identity and unambiguous redistribution terms
from an accepted provider. A commercial platform or unattributed conversion was
not scraped or substituted. The two accepted works are not described as
comprehensive, balanced, representative, or authoritative.

## Immutable acquisition and deterministic preparation

Acquisition is a separate, explicit network operation. Normal preparation,
import, tests, provisioning, API use, frontend use, and verification are
offline. Raw archives and captured evidence pages are `-text` protected and
pinned by byte length, SHA-256, and no-filter Git blob.

Both archives use CrossWire KJV-versified zCom4 book blocks. Preparation reads
the local ZIP central directory, validates module configuration, decompresses
book blocks, finds the archive's exact chapter marker, and reads the next known
canonical verse-index positions. Consecutive positions with the same block,
offset, and byte length are one source section with a range anchor. A range
covering the whole selected chapter is a chapter anchor. Zero-length entries
are coverage gaps. No range is narrowed and no gap is filled.

The exact decoded OSIS slice is `sourceMarkup`. Display text removes mechanical
containers, decodes XML entities, preserves headings/wording/order, and is
hashed. Mechanical sentence boundaries are navigation aids only. Every
statement is an exact substring with validated start/end offsets and hash; the
full section remains authoritative. Repeated preparation is byte-identical.

## Corpus

The bounded corpus is Genesis 1 (31 canonical verses), Psalm 23 (6),
Ecclesiastes 3 (22), and John 1 (51), totaling 110. Prepared counts are two
works, 96 sections, 3,450 statements, 96 anchors, two artifacts, two rights
records, and 14 gap ranges. Exact work/passage counts live in
`dataset-manifest.json`.

## Import, readiness, and API

Validation completes before the transaction. The importer is restricted to
`sourceroot_test` unless it receives the unforgeable authorized local-
development token. It deletes/replaces only its bundle, inserts all records in
one transaction, skips an exact existing corpus, and rolls back a simulated
failure. Prior Root fingerprints remain unchanged.

`dev:provision` validates and provisions commentary after Foundation, Original
Language, and Translation Comparison. Readiness contract 1.2.0 adds only
`commentaryProvenanceReady` and commentary counts/dataset identity. It does not
redefine `ready`, `foundationReady`, `originalLanguageReady`, or
`translationComparisonReady`.

`GET /api/v1/bibleroot/commentaries` exposes DB-backed accepted work metadata,
artifacts, rights, and bounded coverage. `GET /api/v1/bibleroot/commentary`
accepts one supported chapter and bounded work IDs, returning ordered sections,
exact statements, provenance, rights, gaps, canonical anchors, and cross-layer
links. Unsupported/duplicate/unknown/oversized requests are structured 4xx;
unprovisioned commentary is an honest 503. Neither endpoint has a fallback,
summary, ranking, agreement inference, doctrine label, or word alignment.

## Customer experience

`bibleroot-commentary.html` loads all text from the API. It defaults to both
accepted works, renders source columns on desktop and stacked cards on mobile,
keeps exact section text readable, lazily exposes statement offsets/hashes, and
provides work/section provenance dialogs. Links preserve the canonical passage
across Bible text, Translation Comparison, and Original Language. Loading,
awaiting, invalid, API-offline, Retry, and coverage-gap states are explicit.
Native controls, live regions, dialog semantics, focusable actions, external-
source labeling, visible focus from shared styles, and reduced-motion behavior
preserve accessibility.

## Extension points and prohibitions

Future public-domain works may reuse the model after separate artifact and
rights review. Full-Bible scale may require pagination but must retain exact
sections and statement offsets. Unresolved anchors are supported but not
silently forced into a verse. Doctrine/truth/orthodoxy tables, source rankings,
agreement/disagreement inference, generated commentary, generated summaries,
belief recommendations, semantic equivalence, translation alignment, and
morphology judgments remain prohibited.
