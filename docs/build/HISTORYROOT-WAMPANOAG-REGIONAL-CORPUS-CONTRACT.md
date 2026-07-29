# HistoryRoot Wampanoag Regional Corpus Contract

## Identity and boundary

SourceRoot Chunk 9 expands the accepted HistoryRoot corpus under the existing
canonical bundle ID `historyroot-plymouth-knowledge-dataset-v1`. Version
`1.3.0` replaces version `1.2.0` through the unchanged replacement-safe
importer. Continuity of the bundle ID is required because this is a lossless
expansion of the accepted corpus, not a parallel competing dataset.

The corpus is titled *Wampanoag Homelands and Intercommunity Networks,
1614-1676*. Its approved geography is Cape Cod, Noepe, Manomet, Nemasket,
Pokanoket, Mount Hope, Pocasset, and Sakonnet. Narragansett Bay and Great
Swamp appear only through direct regional connections. Archaeology before
1614 and continuity after 1676 are contextual only. Nothing in the corpus
implies that Wampanoag history began in 1614 or ended in 1676.

## Acquisition and rights

The only admitted Chunk 9 sources are the 20 accepted candidates in
`candidate-sources.json` from the completed regional acquisition gate. The
three rejected candidates are prohibited. No newly discovered source may be
imported without a new acquisition decision.

Nineteen accepted sources are metadata-and-link-only. The Library of Congress
Hubbard map is registered within its public-domain object boundary. No
copyrighted full text, access-controlled material, AI summary, long quotation,
or OCR-derived claim is ingested. Portal-only and book-level candidates are
registered, but do not support claims without item-, chapter-, page-, or
stable-heading-bounded locators.

## Lossless construction

The workspace uses preparation schema `1.1.0`, preserves every accepted Chunk
8 object, and adds:

- 54 records, 28 claims, 20 sources, and 14 accounts
- 32 date expressions and 48 relationships
- 28 structured locators and 32 field-provenance records
- 18 explicit-role evidence links and 8 claim relations
- 28 claim attributions, 11 interpretations, 8 perspectives, 8 perspective
  links, 4 causal links, and 4 cultural memories

All additions use deterministic IDs and fixed review metadata. Project-level
synthesis is stored as interpretation, never as a historical fact claim.
Preparation metadata does not leak into the generated bundle.

## Historical modeling

Tribal communities, colonial labels, historical place names, modern
institutional names, persons, homelands, political relationships, geographic
descriptions, and jurisdictional descriptions remain distinguishable. The
corpus creates no territorial polygon, exact boundary, unsupported life date,
kinship, title, ownership claim, quotation, or deterministic causal claim.
Intercommunity links do not imply a centralized hierarchy. Absence from a
colonial document is never modeled as nonexistence.

## Claims, evidence, and locators

Every new claim has a stable ID, bounded statement, account, accepted source,
structured locator, statement provenance, date context, geography context,
evidence record, attribution, and approved preparation status. Eighteen claims
also have separate evidence-link objects using `supports`, `qualifies`,
`contextualizes`, or `neutral_or_background`. The remaining ten deliberately
avoid a redundant link; their evidence, locator, attribution, provenance, and
documented reason remain explicit.

Eight claim relations preserve qualification or material conflict without
automatically resolving truth. Easton and Mather remain distinct mediated
colonial accounts. Tribal public histories, primary documents, archaeology,
institutional guidance, and later scholarship retain distinct reporting
modes.

## Orphan accounting

Responsible regional relationships give inbound context to eight existing
orphan records: John Sassamon, Cape Cod, Great Swamp, Manomet, Mount Hope,
Narragansett Bay, Nemasket, and Swansea. The existing Mashpee reporting
account gains an attributed claim. England, London, Newfoundland, Plymouth
Harbor, and Spain remain record orphans; the Mourt's Relation account remains
an account orphan because no artificial relationship is justified. No new
record or account is orphaned.

## Quality and determinism

Release requires zero blockers. Review findings and observations disclose
source concentration, single-lineage claims, bounded-source omissions,
unresolved identity, geography, chronology, and future review needs without
assigning a universal truth, reliability, confidence, or composite score.

Two independent generations must match each other and the repository for all
five artifacts by byte length, SHA-256, and exact bytes. The bundle must pass
the accepted validator with zero errors and zero warnings.

## Import and protected boundaries

The import command delegates directly to `saveImportedBundle`. Only
`sourceroot_test` is accepted. Reimport must be duplicate-safe and
replacement-safe, preserving existing Plymouth claims and DictionaryRoot
behavior while making regional records and claims visible through the
existing API and Context Review.

Chunk 9 adds no migration, frontend source, API route, importer
implementation, source-preparation implementation, or parallel importer.
Migrations 001-012 remain the complete migration boundary and migration 013
remains absent.

## Packaging and acceptance

The package is backup-first, manifest-hash verified, safe-path checked,
independently regenerating, replacement-safe, duplicate-safe, and
installation-record producing. It accepts explicit package and repository
paths and can run from outside the Git checkout.

Final acceptance requires focused and regression tests, product baselines,
desktop and 390-by-844 browser smoke, deterministic artifacts, import and
reimport, immutable prior-release identities, packaged installation, root
verification, the final Chunk 9 verifier, and `git diff --check`.

