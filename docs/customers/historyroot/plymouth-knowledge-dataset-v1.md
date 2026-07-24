# HistoryRoot Plymouth Knowledge Dataset v1

## Status

> A machine-assisted pilot dataset awaiting further historical, editorial, and tribal review.

This package is a reviewable HistoryRoot pilot, not a finished historical authority. Automated checks establish structural integrity, provenance coverage, safe import behavior, and explicit uncertainty. They do not prove historical accuracy.

## Scope

The core chronology covers 1616 through 1691. Limited background from approximately 1605 through 1615 is included only where it is needed to explain kidnappings, travel, and pre-settlement context. The 1692 inauguration of the Province of Massachusetts Bay is retained as a transition boundary so it is not collapsed into the 1691 charter date. Selected later records address public memory rather than extending the core event chronology.

The package centers Indigenous continuity and agency alongside English colonial records. It includes Wampanoag, Pokanoket, Patuxet, Nauset, Massachusett, Narragansett, and English colonial actors; Ousamequin/Massasoit, Tisquantum/Squanto, Wamsutta, Metacom, Weetamoo, and Awashonks; the epidemic and its diagnostic uncertainty; settlement and the first winter; the Mayflower Compact and its surviving textual witnesses; the 1621 diplomatic agreement and harvest gathering; Wessagusset, Merrymount, land and power, Metacom's War, enslavement, jurisdictional transition, and later cultural memory.

## Package

The source-controlled package is in `data/historyroot/plymouth-v1/`:

- `historyroot-plymouth-v1.bundle.json` — importable SourceRoot bundle
- `manifest.json` — scope, targets, counts, disclaimer, and schema decision
- `source-register.json` — source access, citation, inspected locators, limitations, and use status
- `claim-evidence-matrix.json` — claim-to-evidence audit map
- `open-questions-and-gaps.md` — unresolved research and review needs
- `historical-review-guide.md` — review order and safeguards

The generator is `backend/src/scripts/generate-historyroot-plymouth.ts`. Generated files should be regenerated from that script, not edited independently.

## Dataset totals

| Area | Count |
| --- | ---: |
| People | 25 |
| Groups and cultural communities | 10 |
| Places | 22 |
| Events | 45 |
| Documents and works | 10 |
| Political jurisdictions | 3 |
| Sources | 20 |
| Temporal assertions | 45 |
| Historical accounts | 18 |
| Claims | 49 |
| Evidence records | 49 |
| Interpretations | 12 |
| Perspectives | 10 |
| Perspective links | 18 |
| Causal links | 18 |
| Relationships | 71 |
| Cultural-memory records | 6 |
| Contextual records | 393 |

## Source policy

The source register uses five access statuses:

- `accessed-and-inspected`
- `metadata-verified-not-inspected`
- `bibliographic-only`
- `inaccessible`
- `rejected`

Only `accessed-and-inspected` sources may support detailed claims. Metadata-only and bibliographic records may establish document identity, explain gaps, or identify future work, but they cannot silently support substantive claims. Every used source records a citation, access status, limitation, and—when inspected—the locator or section reviewed.

The source mix includes primary texts and official or institutional material from the [Library of Congress](https://www.loc.gov/item/03008746/), [University of Maryland Early Americas Digital Archive](https://eada.lib.umd.edu/text-entries/of-plimoth-plantation/), [Project Gutenberg](https://www.gutenberg.org/ebooks/13715), [National Museum of the American Indian](https://americanindian.si.edu/nk360/informational/rethinking-thanksgiving), [Mashpee Wampanoag Tribe](https://mashpeewampanoagtribe-nsn.gov/history), [Wampanoag Tribe of Gay Head (Aquinnah)](https://wampanoagtribe-nsn.gov/wampanoag-history), [National Park Service](https://www.nps.gov/articles/000/king-philip-s-war.htm), [Massachusetts Archives](https://www.sec.state.ma.us/divisions/archives/collections/charters.htm), and [United American Indians of New England](https://www.uaine.org/).

## Representation decisions

- Migration 009 already provides the domain-neutral contextual model, so this dataset adds no schema migration.
- Names and aliases are preserved without treating English labels as neutral defaults. Stable IDs remain separate from display names.
- Every event has a temporal assertion. Exact, approximate, range, disputed, multiple-proposed, and transition dates remain distinguishable.
- The original signed Mayflower Compact is represented as lost. Mourt's Relation (1622), Purchas his Pilgrimes (1625), and Bradford's manuscript are separate textual witnesses.
- Claims, evidence, accounts, interpretations, perspectives, causal links, relationships, and cultural-memory records remain distinct.
- Causal links are explicitly qualified, sourced, and marked non-deterministic.
- No territorial polygons or precise coordinates are supplied.

## Commands

Run from `backend/`:

```powershell
npm.cmd run historyroot:plymouth:generate
npm.cmd run historyroot:plymouth:validate
npm.cmd run historyroot:plymouth:import
npm.cmd run historyroot:plymouth:verify
npm.cmd run historyroot:plymouth:remove
```

The import is transactional and replaces only normalized records owned by `historyroot-plymouth-knowledge-dataset-v1`. Removal uses an exact internal allow-list; the public integration-test deletion endpoint continues to reject production dataset IDs.

## API and search checks

After import, stable contextual records are available through `/api/v1/context/*` and `/api/v1/search`. Verification covers:

- Plymouth and Patuxet
- Wampanoag
- Ousamequin and Massasoit
- Tisquantum and Squanto
- Mayflower Compact
- Metacom and King Philip's War

Contextual alias matches are ranked explicitly. DictionaryRoot's complete exact-sense policy remains ahead of contextual results.

## Required human review

Before treating the pilot as publication-ready:

1. Obtain tribal review of names, community descriptions, diplomatic framing, continuity, warfare, captivity, enslavement, and public memory.
2. Have subject specialists check every locator, transcription-dependent claim, date, and uncertainty statement.
3. Collate Compact textual variants rather than inferring them from witness identity.
4. Review land transactions and jurisdictional claims with deed-level and legal expertise.
5. Reassess the epidemic section as scholarship develops; the dataset does not adopt a definitive diagnosis.
6. Treat the 1621 gathering as a thinly documented diplomatic event, not a fully reconstructed modern Thanksgiving tableau.
