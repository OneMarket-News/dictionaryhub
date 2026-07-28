# HistoryRoot Corpus Expansion and Quality Review v1

- Corpus: `historyroot-corpus-expansion-quality-v1`
- Workspace SHA-256: `5670D0D88A1BCBE7C1B2A20FC3FAE4D68F8A77C25A1E54ADAA8AC22BE7A72837`
- Bundle SHA-256: `532AA4030A210F5C4EBEF8A5F2794496C10D2F0A5F72447D2BA778D5D1A55A09`
- Blockers: 0
- Review findings: 5
- Observations: 2

This report evaluates deterministic structure, provenance, rights-use compatibility, and review coverage. It does not assign a truth, credibility, confidence, reliability, or composite quality score.

## Reviewed counts

| Collection | Count | Delta from selected Chunk 6 |
|---|---:|---:|
| accounts | 18 | 10 |
| causalLinks | 18 | — |
| claimAttributions | 49 | — |
| claimRelations | 8 | 0 |
| claims | 49 | 24 |
| culturalMemories | 6 | — |
| dateExpressions | 46 | 34 |
| evidence | 49 | — |
| evidenceLinks | 25 | 0 |
| fieldProvenance | 84 | 24 |
| historicalNames | 15 | 0 |
| interpretations | 12 | — |
| locators | 49 | 24 |
| perspectiveLinks | 18 | — |
| perspectives | 10 | — |
| records | 116 | 108 |
| relationships | 73 | 48 |
| sources | 20 | 10 |

## Rights classifications

- metadata_and_link_only: 20

## Evidence roles

- contextualizes: 2
- neutral_or_background: 1
- qualifies: 6
- supports: 16

## Contextual collection coverage

- causalLinks: 18
- claimAttributions: 49
- culturalMemories: 6
- interpretations: 12
- perspectiveLinks: 18
- perspectives: 10

## Findings

### evidence-role-separation-63179da831c1

- Rule: `EVIDENCE-ROLE-SEPARATION`
- Level: observation
- Objects: None

6 accepted evidence links retain qualifying, disputing, or contradicting roles distinct from support.

### omission-documentation-2b7c28ed8b50

- Rule: `OMISSION-DOCUMENTATION`
- Level: observation
- Objects: None

Every accepted v1.1 candidate was selected; there are no deliberately omitted candidates.

### no-separate-evidence-link-81486b8d422b

- Rule: `NO-SEPARATE-EVIDENCE-LINK`
- Level: review
- Objects: `historyroot-plymouth-claim-awashonks-diplomacy`, `historyroot-plymouth-claim-charter-annexed-plymouth`, `historyroot-plymouth-claim-charter-implementation-1692`, `historyroot-plymouth-claim-compact-memory-development`, `historyroot-plymouth-claim-english-patent-not-native-consent`, `historyroot-plymouth-claim-epenow-escape`, `historyroot-plymouth-claim-great-swamp-escalation`, `historyroot-plymouth-claim-land-pressure`, `historyroot-plymouth-claim-merrymount-contested`, `historyroot-plymouth-claim-merrymount-suppressed`, `historyroot-plymouth-claim-metacom-alliance-building`, `historyroot-plymouth-claim-national-day-mourning-origin`, `historyroot-plymouth-claim-plymouth-records-scope`, `historyroot-plymouth-claim-rock-absent-early-accounts`, `historyroot-plymouth-claim-rock-later-tradition`, `historyroot-plymouth-claim-thanksgiving-later-holiday`, `historyroot-plymouth-claim-wampanoag-continuity`, `historyroot-plymouth-claim-wamsutta-death-suspicion`, `historyroot-plymouth-claim-wamsutta-succession`, `historyroot-plymouth-claim-war-multiple-causes`, `historyroot-plymouth-claim-war-native-enslavement`, `historyroot-plymouth-claim-war-not-simple-binary`, `historyroot-plymouth-claim-war-outbreak-uncertain-command`, `historyroot-plymouth-claim-weetamoo-leadership`

These claims retain accepted reporting provenance and locators but have no separate role-classified evidence link.

Recommended human action: Review qualifying, disputing, or supporting evidence without converting provenance into proof.

### orphan-account-9fa1fd2cdd59

- Rule: `ORPHAN-ACCOUNT`
- Level: review
- Objects: `historyroot-plymouth-account-mashpee`, `historyroot-plymouth-account-mourts`

2 accepted reporting accounts have no inbound reviewed corpus reference.

Recommended human action: Retain as a disclosed accepted-local-material limitation or omit in a future reviewed selection.

### orphan-record-d349dec4e511

- Rule: `ORPHAN-RECORD`
- Level: review
- Objects: `historyroot-plymouth-person-john-sassamon`, `historyroot-plymouth-place-cape-cod`, `historyroot-plymouth-place-england`, `historyroot-plymouth-place-great-swamp`, `historyroot-plymouth-place-london`, `historyroot-plymouth-place-manomet`, `historyroot-plymouth-place-mount-hope`, `historyroot-plymouth-place-narragansett-bay`, `historyroot-plymouth-place-nemasket`, `historyroot-plymouth-place-newfoundland`, `historyroot-plymouth-place-plymouth-harbor`, `historyroot-plymouth-place-spain`, `historyroot-plymouth-place-swansea`

13 accepted records have no inbound reviewed corpus reference.

Recommended human action: Retain as a disclosed accepted-local-material limitation or omit in a future reviewed selection.

### single-reporting-lineage-49fe862d2357

- Rule: `SINGLE-REPORTING-LINEAGE`
- Level: review
- Objects: `historyroot-plymouth-claim-awashonks-diplomacy`, `historyroot-plymouth-claim-charter-implementation-1692`, `historyroot-plymouth-claim-compact-memory-development`, `historyroot-plymouth-claim-compact-signers-scope`, `historyroot-plymouth-claim-compact-three-witnesses`, `historyroot-plymouth-claim-epenow-escape`, `historyroot-plymouth-claim-epidemic-diagnosis-uncertain`, `historyroot-plymouth-claim-first-winter-mortality`, `historyroot-plymouth-claim-great-swamp-escalation`, `historyroot-plymouth-claim-harvest-evidence-limits`, `historyroot-plymouth-claim-hunt-kidnappings`, `historyroot-plymouth-claim-land-pressure`, `historyroot-plymouth-claim-merrymount-contested`, `historyroot-plymouth-claim-merrymount-suppressed`, `historyroot-plymouth-claim-metacom-alliance-building`, `historyroot-plymouth-claim-ousamequin-strategy`, `historyroot-plymouth-claim-plymouth-records-scope`, `historyroot-plymouth-claim-robinson-critique`, `historyroot-plymouth-claim-rock-absent-early-accounts`, `historyroot-plymouth-claim-rock-later-tradition`, `historyroot-plymouth-claim-samoset-contact`, `historyroot-plymouth-claim-thanksgiving-later-holiday`, `historyroot-plymouth-claim-tisquantum-political-agency`, `historyroot-plymouth-claim-tisquantum-travels-return`, `historyroot-plymouth-claim-wampanoag-deep-history`, `historyroot-plymouth-claim-wamsutta-death-suspicion`, `historyroot-plymouth-claim-wamsutta-succession`, `historyroot-plymouth-claim-war-native-enslavement`, `historyroot-plymouth-claim-war-outbreak-uncertain-command`, `historyroot-plymouth-claim-weetamoo-leadership`, `historyroot-plymouth-claim-wessagusset-aftermath-attributed`, `historyroot-plymouth-claim-wessagusset-head-display`, `historyroot-plymouth-claim-wessagusset-killings`

These accepted claims currently have one reporting source lineage; no truth judgment is implied.

Recommended human action: Seek independent source categories during broader regional expansion.

### source-lineage-concentration-7de54c15ebcb

- Rule: `SOURCE-LINEAGE-CONCENTRATION`
- Level: review
- Objects: `historyroot-plymouth-source-nmai-timeline`

One or more accepted sources report at least one quarter of reviewed claims; this is a concentration observation, not a credibility judgment.

Recommended human action: Prioritize genuinely independent accepted source lineages in future research.

## Known limitations

- The corpus remains bounded to already accepted local Patuxet, Plymouth, Pokanoket, and later regional material.
- Reporting-source concentration and single-lineage claims remain disclosed review needs rather than credibility or truth judgments.
- Newly structured locator and provenance records preserve accepted strings and source paths; no external locator validation occurred.
- No legal or rights certification was performed.

## Future research categories

- Independent Indigenous-authored and tribal-institutional source lineages
- Additional archival editions with exact page, folio, or line locators
- Broader regional corpus expansion and product adoption
