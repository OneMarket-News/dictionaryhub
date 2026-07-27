# SourceRoot Chunk 6 — HistoryRoot Foundational Corpus v1 Stage Record

## Stage identity

- Stage: SourceRoot Chunk 6 — HistoryRoot Foundational Corpus v1
- Package: `SourceRoot-HistoryRoot-Foundational-Corpus-v1`
- Corpus ID: `historyroot-foundational-corpus-v1`
- Replacement-safe bundle ID:
  `historyroot-plymouth-knowledge-dataset-v1`
- Scope: controlled data and integration; no migration or new product surface

## Starting checkpoint

- Repository: `C:\Users\Josh\Documents\GitHub\dictionaryhub`
- Branch: `release/historyroot-alpha-integration-v1`
- Starting commit: `5549dff82fca447d8267d31b111bdca2cb4eeebd`
- Required annotated tag:
  `sourceroot-context-api-review-experience-v1`
- Tag peeled commit:
  `5549dff82fca447d8267d31b111bdca2cb4eeebd`
- Accepted Chunk 5 ZIP:
  `C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-Context-API-Review-Experience-v1.zip`
- Accepted Chunk 5 ZIP SHA-256:
  `7f951e563a97682f43d92972487e85a99e44c794a866784b302ff2d838e8cd1c`
- Test database: `sourceroot_test`
- Migration ceiling: 012
- Migration 013: absent
- Starting worktree: clean

## Mandatory starting baseline

- Complete backend: 211/211
- Chunk 5 backend review: 24/24
- Chunk 5 frontend review: 15/15
- HistoryRoot customer experience: 13/13
- HistoryRoot Plymouth integration: 18/18
- SourceRoot baseline: 15 pass, 0 fail, 0 warnings
- DictionaryRoot baseline: 23 pass, 0 fail, 0 warnings

No repository edit occurred before every checkpoint and baseline item passed.

## Inventory findings

The accepted Plymouth bundle already owned canonical equivalents for seven
required subjects. The accepted place record combined Patuxet and Plymouth,
which did not satisfy the required semantic distinction.

## Identity decision

Chunk 6 therefore:

- preserves the seven accepted canonical IDs
- preserves the accepted combined place ID but narrows it to Patuxet
- adds `ctx-place-plymouth-settlement` as a distinct place
- keeps the Patuxet place, Patuxet community, Plymouth settlement, and
  Plymouth colonists separate
- explicitly supersedes the accepted Plymouth bundle bytes under the existing
  bundle ID
- uses the existing `saveImportedBundle` path

No migration, second importer, new route, or new record kind was required.

## Corpus summary

- Required principal records: 8
- Optional principal records: 0
- Selected claims: 25
- Selected registered sources: 10
- Selected reporting accounts: 8
- Selected relationships: 25
- Historical-name records: 15
- Selected date expressions: 12
- Exact or bounded locators: 25
- Evidence links: 25
  - `supports`: 16
  - `qualifies`: 6
  - `contextualizes`: 2
  - `neutral_or_background`: 1
- Claim relations: 8
- Field-provenance records: 60
- Imported claim versions: 0
- Imported evidence versions: 0

The complete successor bundle retains 20 registered sources, 49 claims, and
the rest of the accepted Plymouth demonstration network.

## Optional records omitted

- Samoset: accepted compatible record retained; not needed as a principal
  record.
- Samoset arrival: accepted compatible event retained; not needed as a
  principal record.
- 1616–1619 epidemic: accepted compatible event retained with diagnostic
  uncertainty; not promoted as a principal record.
- English settlement at Patuxet: accepted compatible event retained; the new
  distinct settlement place resolved the required identity gap.

## Source register

Ten existing source registrations were rechecked. EADA, Project Gutenberg,
NMAI, the Mashpee Wampanoag Tribe, CDC, Library of Congress institutional
pages, and Plimoth Patuxet pages resolved. The Library of Congress item page
for the accepted Mourt’s Relation catalog object denied automated retrieval;
the previously accepted catalog identity and inspected locator record were
retained without inventing a new locator.

No modern source prose, complete scans, PDFs, page captures, or image sets
were added.

## Files added

- `backend/data/historyroot-foundational-corpus-v1/corpus-inventory.json`
- `backend/data/historyroot-foundational-corpus-v1/historyroot-foundational-corpus-v1.bundle.json`
- `backend/data/historyroot-foundational-corpus-v1/source-register.json`
- `backend/src/historyroot/foundational-corpus.ts`
- `backend/src/scripts/generate-historyroot-foundational-corpus.ts`
- `backend/src/scripts/import-historyroot-foundational-corpus.ts`
- `backend/test/historyroot-foundational-corpus.test.ts`
- `docs/build/HISTORYROOT-FOUNDATIONAL-CORPUS-CONTRACT.md`
- `docs/build/historyroot-foundational-corpus-stage.md`
- `INSTALL-SOURCEROOT-HISTORYROOT-FOUNDATIONAL-CORPUS.ps1`
- `VERIFY-SOURCEROOT-HISTORYROOT-FOUNDATIONAL-CORPUS.ps1`

The package folder and ZIP are generated at the repository root for
inspection and are not release-directory artifacts.

## Files replaced

- `assets/js/historyroot-shared.js`
- `backend/package.json`
- `backend/src/historyroot/plymouth-dataset.ts`
- `backend/test/historyroot-plymouth.test.ts`
- `data/historyroot/plymouth-v1/manifest.json`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `verification/historyroot-customer-experience.test.mjs`

## Testing

- TypeScript: PASS
- Generic SourceRoot schema: ready, 0 errors, 0 warnings
- Foundational corpus focused suite: 30/30
- Updated compatible Plymouth integration: 18/18
- Frontend observability regression: 10/10
- HistoryRoot customer regression: 13/13
- Complete backend: 241/241
- SourceRoot baseline: 15 pass, 0 fail, 0 warnings
- DictionaryRoot baseline: 23 pass, 0 fail, 0 warnings
- Immutable Chunk 0–5 replay: PASS
  - exact Chunk 0–3 summary: 39 pass, 0 fail, 0 warnings
  - exact Chunk 0–4 summary: 45 pass, 0 fail, 0 warnings
  - exact Chunk 0–5 summary: 45 pass, 0 fail, 0 warnings
  - Chunk 6 replay wrapper: 1 pass, 0 fail, 0 warnings
- Installer: PASS
- Final verifier: PASS with zero failures and zero warnings
- `git diff --check`: PASS

## Manual browser status

PASS in the Codex in-app browser against the live `sourceroot_test` import.
The smoke run confirmed:

- Patuxet renders as the narrowed accepted place identity
- `ctx-place-plymouth-settlement` renders as a separate place
- the selected harvest claim review shows attribution, sources, its bounded
  locator, an explicit `supports` link, incoming `qualifies` relations, field
  provenance, and no fabricated version history
- Ousamequin renders the historical names `Massasoit`, `Massasoyt`, and
  `Massassowat`
- no browser console error or warning was observed

Paths exercised:

- `history-explore-v1.html?q=Patuxet`
- `history-record-v1.html?id=historyroot-plymouth-place-patuxet-plymouth`
- `history-record-v1.html?id=ctx-place-plymouth-settlement`
- `history-context-review-v1.html?record=historyroot-plymouth-event-harvest-gathering&claim=historyroot-plymouth-claim-harvest-three-days`
- `history-record-v1.html?id=historyroot-plymouth-person-ousamequin`
- `history-record-v1.html?id=historyroot-plymouth-person-tisquantum`
- `history-record-v1.html?id=historyroot-plymouth-event-peace-agreement`

The smoke run also exposed and corrected structured alias rendering in
`assets/js/historyroot-shared.js`; the customer regression now exercises that
case.

## Release artifacts

- Package folder:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub\SourceRoot-HistoryRoot-Foundational-Corpus-v1`
- ZIP:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub\SourceRoot-HistoryRoot-Foundational-Corpus-v1.zip`
- ZIP SHA-256 and byte size: reported in the final release handoff after
  archive closure. A ZIP cannot contain its own final cryptographic hash
  without changing that hash.
- Installer backup:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-historyroot-foundational-corpus-v1-20260727-final`
- Installation record:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-historyroot-foundational-corpus-v1-20260727-final\installation-record.json`

## Known limitations

- This is a small review corpus, not a comprehensive historical dataset.
- The full replacement bundle retains later-period pilot material for
  compatibility.
- Tribal review is still required.
- Colonial sources do not provide Indigenous perspectives.
- Epidemic diagnosis and several dates remain explicitly uncertain.
- No production or cross-browser certification is claimed.
- The immutable replay uses a minimal isolated compatibility shim: the
  temporary repository has each prior stage's expected starting commit as
  Git metadata while exact final payload bytes remain in its working tree,
  and migrations 001–012 are copied byte-for-byte from the accepted Windows
  worktree to avoid `git archive` line-ending normalization. No prior ZIP,
  payload, verifier, or repository migration is changed.

## Migration and Git confirmation

No migration was added or modified. No commit, tag, push, pull, merge, rebase,
checkout, branch creation, staging, reset, or other history-changing Git
operation was performed.

## Next dependency

Corpus expansion and repeatable source-preparation workflow.
