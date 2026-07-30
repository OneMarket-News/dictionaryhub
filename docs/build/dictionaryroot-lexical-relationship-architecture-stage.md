# DictionaryRoot Lexical Relationship Architecture Stage Evidence

## Starting gate

- Repository: `C:\Users\Josh\Documents\GitHub\dictionaryhub`
- Starting commit and local/remote branch identity:
  `4ee8f392ab676eb8f47b3af1bcd9680b9ffea60d`
- Branch: `release/historyroot-alpha-integration-v1`
- Working tree and index: clean
- Root stage: inactive before stage creation
- Database: exactly `sourceroot_test`
- Starting migration boundary: 001-013 applied; migration 013 exact;
  migrations 014 and 015 absent
- HistoryRoot: `historyroot-plymouth-knowledge-dataset-v1` 1.3.0
- Fixture baseline: 1 dataset, 5 sources, 10 lemmas, 16 senses, 22 claims,
  10 forms, 4 proposals, 2 competitor links, 4 comparisons, 40 locators,
  and 72 provenance records
- Legacy lexicon datasets/synsets/relations: 0/0/0
- Starting root verifier: 51 passes, 0 warnings, 0 failures
- DictionaryRoot baseline: 23 passes, 0 warnings, 0 failures
- Chunk 10A verifier: 10 passes, 0 failures

## Implemented checkpoint

Migration 014 adds 13 governed types, 12 canonical fixture relationships, and
13 separately addressable evidence rows. Six fixture relationships are
symmetric and six directional. The substantially-equivalent fixture
relationship has two evidence sources but one canonical identity.

Migration 014 is applied to `sourceroot_test`; migration 015 remains absent.
The fixture replacement importer reports 12 relationships and 13 evidence
rows after duplicate-safe reimport. A deliberately duplicated relationship
fails and rolls back to those accepted counts.

The lexical graph adapter derives stable typed nodes/edges directly from
migrations 013 and 014. Bank seed lookup returns three immutable sense IDs
across noun and verb. Depth-two graph tests retain forms and canonical
relationship nodes without duplicate IDs. Island returns two separate
etymology proposals; logos graph records retain uncertainty.

## Deterministic artifacts

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `fixture.json` | 92390 | `db8f3eb4ca079663764598aed954417f2658dc9781863c007517ee4d4c1e4799` |
| `inventory.json` | 664 | `1008e0d0dc358e380d95121a3b76970dce82ecf63338b1d0b362eb80e631fad1` |
| `quality-review.json` | 2728 | `af71f491f0efcbaa12e4a28f3e896948ae02087aad6925fd8cebc7a57999c7ca` |

The Chunk 10A test generates all three artifacts in two independent temporary
directories and requires equal lengths, hashes, bytes, repository equality,
stable ordering, and a normalized final newline.

## Automated evidence

- Typecheck: pass
- Fresh disposable database migrations 001-014: 15 ledger rows; first 001,
  last 014; 13 relationship types; temporary database removed
- Focused relationship backend: 15/15
- Chunk 10A backend architecture: 17/17
- Targeted Knowledge Sphere frontend: 8/8
- DictionaryRoot baseline: 23/23, 0 warnings
- SourceRoot baseline: 15/15, 0 warnings
- Chunk 10A bounded verifier: 10/10
- Relationship bounded verifier: 16/16, 0 warnings, 0 failures
- Active root verifier: 51 passes, 0 warnings, 0 failures
- Quality blockers: 0
- HistoryRoot version after import: 1.3.0
- Legacy lexicon datasets/synsets/relations after import: 0/0/0

## Browser evidence

The user-managed backend and frontend returned HTTP 200 before smoke. No
service was started, stopped, restarted, or otherwise managed by this stage.

At 1280 by 720, `bank` returned three distinct exact senses: two nouns and one
verb. The finance sphere rendered 8 unique nodes and 7 unique displayed
edges, including a lexical form and two canonical relationship nodes.
Relationship selection exposed normalized support, source identity, and
provenance. Document width equaled client width; console errors and
attributable warnings were zero.

At 390 by 844, bank retained 8 unique nodes and 7 unique edges with no
horizontal overflow. Island at depth two rendered both `iegland` and `isle`
as separate etymology-proposal nodes. Logos retained separate senses,
unresolved comparison state, translation-related evidence, and visibly
rendered `Uncertainty: Semantic range varies by context and period.` The final
logos graph contained 16 unique nodes and 4 unique displayed edges. Document
width equaled client width; console errors and attributable warnings were
zero.

Browser smoke initially found that logos uncertainty existed in graph
metadata but was not visible in the selected-concept panel. The targeted
Knowledge Sphere renderer was corrected to show uncertainty and qualification
when present. The affected desktop and mobile states were rechecked directly;
both remained overflow-free and console-clean.

## Completion readiness

- Browser desktop: pass
- Browser 390 by 844: pass
- Console errors: 0
- Attributable console warnings: 0
- Duplicate graph node IDs: 0
- Duplicate graph edge IDs: 0
- Horizontal overflow: 0
- Unresolved manual checks: none
