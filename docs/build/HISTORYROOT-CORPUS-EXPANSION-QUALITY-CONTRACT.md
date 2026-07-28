# HistoryRoot Corpus Expansion and Quality Review Contract

## Purpose and accepted checkpoint

SourceRoot Chunk 8 promotes a materially expanded reviewed HistoryRoot corpus
from already accepted local repository material and subjects it to a
deterministic structural, editorial, evidential, rights-use, and procedural
review. The accepted starting checkpoint is commit
`95b90865abf21cefefc5c608d778327737e997ac`, maintenance tag
`sourceroot-repeatable-source-preparation-workflow-v1.1`, and its immutable
release ZIP SHA-256
`4EC0688F43D8EC94579167AB60F84FF499790B41C26FCF4C92E93F328C2778B1`.

Chunk 6 supplied the accepted replacement-safe corpus and its selected
foundational inventory. Chunk 7 supplied the repeatable preparation workflow.
The v1.1 maintenance release added lossless support for claim attributions,
interpretations, perspectives, perspective links, causal links, and cultural
memories. The prior Chunk 8 attempt stopped correctly when schema 1.0.0 could
not preserve those families; Chunk 8 does not redesign that maintenance
release.

## Feasibility and accepted-local-material boundary

Implementation is permitted only when accepted material beyond the selected
Chunk 6 inventory provides at least five records, ten claims, three sources or
accounts, five exact or bounded locators, five provenance records, and one
additional contextual object. Chunk 8 may add deterministic structural
records directly required to preserve accepted claim, account, source,
evidence, and locator fields. It may not add an externally researched fact,
unregistered source, invented locator, unsupported conclusion, AI extraction,
OCR, scraping, or network-research code.

The accepted feasibility inventory found 108 additional records, 24 claims,
10 sources, 10 accounts, 34 date expressions, 48 relationships, and 24
accepted bounded claim/evidence locator strings. All accepted candidates were
selected; no candidate was deliberately omitted.

## Workspace and approval

The expansion workspace uses preparation schema `1.1.0` and the unchanged
v1.1 validator and generator. Every non-omitted object must be `approved` and
carry deterministic approval metadata. Draft and `needs_review` objects block
generation. An omitted object must retain a stable ID and nonempty reason.
Dependencies must resolve to approved objects. The workspace distinguishes
previously selected, newly promoted, and dependency-only objects through
reviewer notes.

The workspace must contain no runtime timestamp, random ID, machine path,
unsupported preparation extension, copied modern prose inconsistent with its
rights review, composite score, or fabricated claim/evidence version.

## Material expansion and deterministic generation

Compared with the selected Chunk 6 inventory, the generated inventory must
add at least five records, ten claims, three sources or accounts, five
structured locators, five field-provenance records, and one additional
contextual object. The approved result contains 116 records, 49 claims, 20
sources, 18 reporting accounts, 49 structured locators, 15 historical names,
46 date expressions, and 84 field-provenance records.

The accepted v1.1 generator is the only bundle generator. Stable collection
and object order, stable JSON formatting, fixed release metadata, and exact
accepted IDs are mandatory. Two clean-directory generations must have equal
length, equal SHA-256, and exact bytes; committed output must equal an
independent regeneration. Preparation-only metadata may not leak into the
bundle.

## Inventory contract

The deterministic inventory records workspace and bundle identities, sizes
and hashes; IDs and counts for every generated collection; preparation
statuses; rights classifications; evidence roles; exact selected-Chunk-6
deltas; newly promoted IDs; dependency-only IDs; and omitted candidate IDs
with reasons. It contains no generated current timestamp.

## Quality-review contract

The review engine analyzes the approved workspace, generated bundle, and
selected Chunk 6 inventory. It evaluates registration, source/edition
identity, rights basis and use, reporting and claim attribution, reference
resolution, locator coverage, evidence roles, provenance, historical names,
uncertain dates, relationships, all six contextual families, duplicates,
orphans, source-lineage concentration, single-lineage claims, missing separate
evidence, version history, approval leakage, public visibility, and
bundle/workspace/inventory consistency.

Finding levels are `blocker`, `review`, and `observation`. They are workflow
states, not historical truth judgments. Finding IDs, rule IDs, involved
object IDs, explanations, and recommended human actions are deterministic.
Blockers prevent release. Review findings disclose real limitations and
future research needs. Observations record nonblocking characteristics.
Release requires zero blockers and explicit documentation of every review
finding.

No truth, reliability, credibility, confidence, composite quality,
contributor, source, or historical-conclusion score may be generated.

## Rights, attribution, locators, evidence, and provenance

Every source requires a rights classification, supplied basis where required,
compatible content-use mode, attribution requirements, and source identity
review. Modern institutional sources remain metadata-and-link-only unless an
accepted affirmative rights basis says otherwise. This stage is not legal or
rights certification.

Reporting accounts and claim attributions identify who made, recorded, or
reported a claim; they do not prove it. Structured locators preserve accepted
local strings exactly and remain distinguishable from general references.
Evidence roles stay explicit, including supporting, qualifying,
contextualizing, disputing, and neutral roles. Field provenance identifies
the source path for a field and is not silently converted into evidence.

## Contextual collections and versioning

At minimum the accepted v1.1 counts remain: 25 claim attributions, 12
interpretations, 10 perspectives, 18 perspective links, 18 causal links, and
6 cultural memories. Every endpoint and dependency must resolve. Causal
direction and cultural-memory relationships must remain exact.

Accepted canonical IDs and historical content remain stable. Chunk 8 creates
no claim or evidence version, no predecessor, no artificial ordinal, and no
fabricated history. Bundle release versioning does not imply a historical
content version.

## Existing importer, database, and customer reads

The unchanged SourceRoot importer remains authoritative. The small Chunk 8
import entry point delegates directly to `saveImportedBundle` and contains no
persistence logic. Import is allowed only into exactly `sourceroot_test`.
Blank, development, production, `sourceroot`, and unknown database names are
refused.

The bundle keeps the accepted replacement bundle ID so reimport remains
duplicate-safe and replacement-safe. It must preserve unrelated registry
content and all six contextual families. Newly promoted records and claims
must resolve through search, at least three newly promoted claims through
Context Review, and existing Chunk 6 and DictionaryRoot reads must remain
available.

## Customer-visible behavior and exclusions

Chunk 8 changes accepted customer-visible HistoryRoot data only. It changes no
frontend source, API route, importer implementation, source-preparation
implementation, or database migration. Existing desktop and narrow-mobile
HistoryRoot and Context Review pages must render the expanded data without
console errors. No frontend redesign, contributor workflow, universal source
ranking, truth engine, production ingestion system, or production-readiness
claim is included.

## Known limitations and verification

The corpus remains regionally bounded and contains source-lineage
concentration, single-lineage claims, accepted orphan records/accounts, and
claims whose provenance is not a separate role-classified evidence link.
These are disclosed review findings, not truth judgments.

Verification requires typecheck, the focused 73-test suite, deterministic
generation and review comparisons, bundle-schema validation, duplicate-safe
replacement import, search and Context Review checks, Chunk 7 40/40, v1.1
50/50, Chunk 6 30/30, the complete backend and product baselines, immutable
release replay, installer acceptance, browser data smoke, root verification,
and `git diff --check`, all with zero verifier warnings and failures.

The next dependency is broader regional corpus expansion and product
adoption.
