# SourceRoot HistoryRoot Foundational Corpus Contract

## Contract identity

- Stage: SourceRoot Chunk 6 — HistoryRoot Foundational Corpus v1
- Corpus ID: `historyroot-foundational-corpus-v1`
- Replacement-safe bundle ID: `historyroot-plymouth-knowledge-dataset-v1`
- Corpus version: `1.0.0`
- Bundle version: `1.1.0`
- Customer: HistoryRoot
- Primary period: 1602–1625
- Geographic and social boundary: Patuxet–Plymouth–Pokanoket Contact Network
- Database scope for automated import and verification: `sourceroot_test`

This contract governs a small source-complete review network. It does not
claim to be a comprehensive history, a production-certified dataset, a tribal
publication, or an automatic historical conclusion.

## Corpus boundary

The principal corpus concerns contact, displacement, settlement, diplomacy,
and attributed accounts connecting Patuxet, the Plymouth settlement,
Pokanoket, Ousamequin, Tisquantum, and the recorded 1621 agreement.

Earlier or later material is included only when it establishes identity,
historical naming, source lineage, chronology, retrospective authorship,
interpretation, or a qualification of an earlier account. The retained
Plymouth demonstration bundle includes later records, but only the IDs listed
in `corpus-inventory.json` belong to the foundational subset.

## Required principal records and stable IDs

Seven required subjects already had accepted Plymouth identities. Those IDs
remain canonical. Planning IDs do not replace them.

| Requested semantic ID | Canonical imported ID | Accepted kind | Decision |
|---|---|---|---|
| `ctx-place-patuxet` | `historyroot-plymouth-place-patuxet-plymouth` | `place` | Preserve the accepted ID and narrow the formerly combined record to Patuxet. |
| `ctx-place-plymouth-settlement` | `ctx-place-plymouth-settlement` | `place` | Add a distinct settlement record because the accepted data collapsed it into Patuxet. |
| `ctx-community-patuxet` | `historyroot-plymouth-group-patuxet` | `group` | Preserve the accepted ID. |
| `ctx-community-pokanoket` | `historyroot-plymouth-group-pokanoket` | `group` | Preserve the accepted ID. |
| `ctx-community-plymouth-colonists` | `historyroot-plymouth-group-plymouth-colonists` | `group` | Preserve the accepted ID. |
| `ctx-person-ousamequin` | `historyroot-plymouth-person-ousamequin` | `person` | Preserve the accepted ID. |
| `ctx-person-tisquantum` | `historyroot-plymouth-person-tisquantum` | `person` | Preserve the accepted ID. |
| `ctx-event-plymouth-pokanoket-agreement-1621` | `historyroot-plymouth-event-peace-agreement` | `event` | Preserve the accepted ID. |

The preserved Patuxet place ID is intentionally narrower than its legacy
label. Its metadata records the correction and the distinct settlement ID.
Patuxet place, Patuxet community, Plymouth settlement, and Plymouth colonists
are four separate records. No identity merge or land-title conclusion follows
from their relationships.

## Optional records

No optional record was promoted into the principal eight-record network.
Accepted Samoset, Samoset-arrival, epidemic, and settlement-event records
remain in the compatible full bundle. Their omission from the principal list
avoids inflating the corpus and does not delete or hide them.

## Foundational subset and retained compatibility data

The foundational subset contains:

- 8 required principal records
- 25 selected claims
- 10 selected registered sources
- 8 selected reporting accounts
- 25 selected relationships
- 15 normalized historical-name records
- 12 selected date expressions
- 25 exact or bounded source locators
- 25 normalized evidence-to-claim links
- 8 qualifying claim relationships
- 60 field-provenance records
- 0 optional principal records
- 0 imported claim versions
- 0 imported evidence versions

The complete replacement bundle retains the accepted Plymouth demonstration
network and therefore contains 20 total registered sources and 49 total
claims. Corpus counts always refer to the inventory subset unless the text
explicitly says “complete replacement bundle.”

## Source classes and source register

The subset uses ten already-inspected sources:

1. A public-domain 1865 Library of Congress edition of *Mourt’s Relation*
2. The University of Maryland Early Americas Digital Archive edition of
   Bradford’s *Of Plymouth Plantation*
3. A public-domain Project Gutenberg edition of Winslow’s *Good Newes from
   New England*
4. A Library of Congress Mayflower Compact exhibit
5. A Law Library of Congress Compact analysis
6. The Smithsonian National Museum of the American Indian NK360 timeline
7. The NMAI “Treaty and Harvest Celebration” teaching resource
8. The official Mashpee Wampanoag Tribe culture timeline
9. The CDC *Emerging Infectious Diseases* retrospective epidemic hypothesis
10. The Plimoth Patuxet Museums “You Are The Historian” Unit 4

Each source record states its publisher or repository, source class, citation,
URL, access status, inspected locators, rights treatment, and limitations.
Primary and near-contemporary English accounts are not treated as neutral
facts. Tribal institutional accounts, federal institutional interpretation,
museum material, retrospective medical hypotheses, and seventeenth-century
accounts remain distinguishable.

## Source and rights rules

- Modern institutional pages are linked and paraphrased.
- Modern prose is not copied into the repository.
- A modern source is not called public domain merely because it is publicly
  accessible or government-adjacent.
- Public-domain status is retained only for the inspected editions whose
  register records that status.
- Short source-identifying passage text may appear in locator data only when
  needed to identify a passage; it is not stored as a substitute for the
  source.
- Complete scans, PDFs, books, page captures, and archive image sets are not
  committed.
- No new Wôpanâak translation is requested or generated.
- Publicly published forms such as `Pahtuksut` remain exactly attributed.

## Historical-name policy

Historical names are normalized alias subrecords, not unqualified strings.
Each has:

- a stable alias ID
- the canonical entity ID
- an explicit alias type
- source IDs
- a note describing editorial or historical context
- field provenance for `aliases.text`
- temporal applicability when the corpus can support it
- explicit uncertainty for the colonial title/name form `Massasoit`

Canonical personal names remain `Ousamequin` and `Tisquantum`. Familiar
colonial forms do not overwrite them.

## Date and uncertainty policy

The corpus preserves source-facing labels, seasonal ranges, year-level
precision, and Old Style calendar labels. Selected dates include structured
historical-date objects. Old Style dates have
`conversionStatus: "unconverted"`; no silent calendar conversion occurs.

The distinct Plymouth settlement place has an approximate establishment start
in winter 1620–1621 and no asserted end date. The 1625 corpus boundary is not
misrepresented as the end of the settlement.

## Claims, accounts, attribution, provenance, and evidence

These structures answer different questions:

- A claim is the exact scoped statement under review.
- An account identifies the reporting context.
- A claim attribution identifies who or what account reported, recorded, or
  is explicitly associated with the statement.
- Field provenance identifies the source path for a field.
- An evidence link states an explicit scoped role: `supports`, `qualifies`,
  `contextualizes`, or `neutral_or_background` in this corpus.
- A source locator identifies the bounded source location used by an evidence
  record.
- A claim relationship keeps qualifying statements separate from the claim
  they qualify.

Source provenance alone is not converted into supporting evidence. A source
can support the narrow claim that Bradford or Winslow reported something
without proving that the event occurred exactly as described. The corpus does
not infer an Indigenous perspective from a colonial account.

## Locator policy

The corpus uses only locators already identified during source inspection:

- printed page ranges
- EADA line ranges
- named timeline or teaching-resource sections
- numbered institutional exhibit paragraphs where retained by the accepted
  source register
- bounded passage beginnings when page or paragraph numbering is not stable

No search-result snippet becomes a locator. No page number is invented.
Modernized or later editions remain identified as editions rather than exact
transcriptions of a lost or earlier artifact.

## Versioning policy

No claim or evidence version is imported merely to exercise version features.
The foundational bundle has zero claim versions and zero evidence versions.
The Context Review projection therefore honestly presents these imported
claims as current logical records without fabricated immutable history.

Existing immutable history owned by other bundles remains untouched during
replacement-safe reimport. A future real correction, retraction, supersession,
or governed editorial refinement must use the accepted immutable-version
workflow.

## Replacement-safe import behavior

The accepted Plymouth bundle used global contextual IDs. A second bundle with
duplicate required identities would conflict, while cross-bundle references
would weaken the accepted replacement model. Chunk 6 therefore explicitly
supersedes the Plymouth bundle bytes under the same bundle ID:
`historyroot-plymouth-knowledge-dataset-v1`.

The deterministic importer:

1. proves the configured database name is exactly `sourceroot_test`
2. validates the complete successor bundle and its inventory
3. calls the single accepted `saveImportedBundle` path
4. replaces only rows owned by the accepted Plymouth bundle ID
5. preserves unrelated bundles and immutable version rows
6. creates no duplicate canonical identity

The original Plymouth bundle file remains in the repository as the legacy
source material for deterministic generation. The accepted Plymouth loader
and importer resolve to the successor bundle. The Plymouth manifest and
integration expectations record the successor totals.

## Known limitations

- The source set is intentionally small.
- The complete successor bundle still carries pilot-review language and
  retained later-period demonstration records.
- Tribal review is not replaced by institutional sourcing.
- A tribal institutional history is not assumed to express every community
  member’s perspective.
- Colonial accounts dominate the surviving documentary record for several
  events.
- Epidemic diagnosis remains uncertain.
- Place boundaries and coordinates are not asserted.
- The agreement survives through English-language records; the corpus does
  not claim a surviving contemporary Wampanoag written instrument.
- No cross-browser, production, comprehensive historical, accessibility,
  performance, privacy, or security certification is made.

## Explicit exclusions

This stage adds no migration, table, API route, customer page, authentication
flow, governance workflow, public write route, second importer, parallel
contextual model, truth score, reliability percentage, combined-confidence
score, automatic conflict resolver, AI-generated conclusion, or customer-side
fallback corpus.

## Exact verification requirements

Acceptance requires:

- database scope exactly `sourceroot_test`
- migrations 001–012 byte-identical and no migration 013
- focused corpus suite 30/30
- accepted Chunk 5 backend and frontend review suites
- accepted Chunk 4, Chunk 3, contextual-foundation, Registry, governance, and
  observability suites
- HistoryRoot customer and Plymouth suites
- the actual complete backend total
- SourceRoot and DictionaryRoot baselines at zero failures and warnings
- immutable Chunk 0–5 release replay
- package manifest, payload hash, installed-byte, path, and ZIP checks
- `git diff --check`
- an honest browser smoke test against the real local backend and static
  HistoryRoot pages
- final verifier result of zero failures and zero warnings

The next dependency is described generically as “Corpus expansion and
repeatable source-preparation workflow.”
