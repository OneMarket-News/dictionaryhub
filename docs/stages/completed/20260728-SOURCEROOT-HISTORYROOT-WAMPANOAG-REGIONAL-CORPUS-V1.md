# SourceRoot Chunk 9 â€” HistoryRoot Wampanoag Regional Corpus v1

## Stage boundary

- Slug: `SOURCEROOT-HISTORYROOT-WAMPANOAG-REGIONAL-CORPUS-V1`
- Status: active
- Starting commit: `7890995eafdb031230439c6f97750274273711ab`
- Branch: `release/historyroot-alpha-integration-v1`
- Remote: `origin/release/historyroot-alpha-integration-v1` at the starting
  commit
- Test database: `sourceroot_test`
- Migration ceiling: `012`; migration `013` absent
- Canonical bundle ID: `historyroot-plymouth-knowledge-dataset-v1`
- Version transition: `1.2.0` to `1.3.0`
- Preflight changed files: none
- Preflight staged files: none

## Accepted acquisition baseline

- Candidate registry SHA-256:
  `7651FB9363AEF1A0431DA76347F881F0B5EC0E5CC8A99F45B2376BCAAC755947`
- Feasibility report SHA-256:
  `9143C907A27E299B69391937CCEACC17AFD751EE01AA3B9F65CA98E800659D2B`
- Candidates: 20 accepted; 3 rejected
- Categories: 8 Indigenous-led; 7 primary/archival; 14 institutional;
  12 archaeological/scholarly
- Starting root verifier: 51 passes, 0 warnings, 0 failures

## Previous accepted release

- Tag: `sourceroot-historyroot-corpus-expansion-quality-v1`
- Commit: `fefbe6fdded9c53fe27996cbaeb7980bca248f4c`
- External ZIP SHA-256:
  `B159BAD009FF65C500BE6B57889619E576A1C2729E4469C101E494A4D318784F`

## Work record

### Implementation and acquisition

- Canonical bundle ID remains
  `historyroot-plymouth-knowledge-dataset-v1`; version advances from `1.2.0`
  to `1.3.0`.
- All 20 accepted acquisition-gate sources and no rejected sources are
  registered.
- Nineteen sources are metadata-and-link-only; the Library of Congress
  Hubbard map is public domain within its registered object boundary.

### Final corpus accounting

- Baseline: 116 records, 49 claims, 20 sources, and 18 accounts.
- Additions: 54 records, 28 claims, 20 sources, 14 accounts, 32 date
  expressions, 48 relationships, 28 locators, 32 field-provenance records,
  18 evidence links, and 8 claim relations.
- Final: 170 records, 77 claims, 40 sources, and 32 accounts.
- Contextual additions: 28 claim attributions, 11 interpretations,
  8 perspectives, 8 perspective links, 4 causal links, and 4 cultural
  memories.
- Quality: 0 blockers, 3 review findings, and 5 observations.
- Orphans: 0 new record or account orphans; 8 existing record orphans and
  1 existing account orphan gained responsible context.

### Determinism and validation

- Two independent clean generations matched each other and the repository
  for all five artifacts by byte length, SHA-256, and exact bytes.
- Workspace SHA-256:
  `87901F6D5BC672FC2BC2ACC2559296EF8AC5BA5634E2954FDC3D265A063C3A4C`.
- Bundle SHA-256:
  `E3BFEBD9D98353BB9F05893E2865C838DF04E322F18E0F4E68CE124B32665B02`.
- Inventory SHA-256:
  `CEDB0E5073819899EEAA027A036076C16CA72F324619A2F0D11AA58D3B9A84C8`.
- Quality JSON SHA-256:
  `B552061303688F472C0B50E65A0139CFDE9D87E7D77A0CC43208AD16E80617D5`.
- Quality Markdown SHA-256:
  `D8D53AE7784A68CFE5FCBFD0313B9A670E801335DF22F9C91697D6A32F5C3140`.

### Previously completed acceptance work

- Focused tests, imports and duplicate-safe reimport, full backend regression,
  product baselines, and immutable prior-release replay were completed before
  the resumed release pass and were not repeated.

### Browser smoke

- Backend `http://127.0.0.1:3000/health`: HTTP 200 with `status: ok`.
- Frontend `http://127.0.0.1:4173/history-explore-v1.html`: HTTP 200.
- Desktop 1280-by-720: live `Wampanoag` search returned 52 records, 24 cards
  rendered initially, no horizontal overflow, and no console errors.
- Mobile 390-by-844: the same live result count and initial cards rendered,
  no horizontal overflow or console errors occurred, and the responsive menu
  opened and closed correctly.

### Installer compatibility correction

The first packaged installer run completed independent regeneration,
replacement-safe import, duplicate-safe reimport, and all 21 verifier checks,
then exposed a Windows PowerShell 5.1 collection-conversion error while
serializing the installation record. The installer-only conversion was made
PowerShell 5.1-safe. The complete rerun passed and wrote the governed backup
and installation record.

### Release acceptance

- Focused tests and import/reimport: PASS (completed before the resumed release
  pass and not independently repeated)
- Full backend regression: PASS
- Product baselines: PASS (completed before the resumed release pass and not
  repeated)
- Browser smoke: PASS
- Determinism: PASS
- Quality accounting: PASS
- Immutable release replay: PASS
- Installer: PASS
- Final package verification: PASS
- Final Chunk 9 verifier: PASS (22 passes, 0 warnings, 0 failures)
- Root repository verifier: PASS (51 passes, 0 warnings, 0 failures)
- Release movement: PASS

### Package and installation evidence

- Package:
  `C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-HistoryRoot-Wampanoag-Regional-Corpus-v1.zip`
- Package bytes: 260277
- Package SHA-256:
  `D4E11DD28EECC46BEFA76E3E4805BB8CDB6F8C8EE57FA07C72BEB898DF409D29`
- Package contents: one top-level package directory, 19 manifest-declared
  payloads, 20 files including the manifest, no undeclared files, and no hash
  or length mismatches.
- Successful backup:
  `backups/sourceroot-historyroot-wampanoag-regional-corpus-v1-20260728-215238-865`.
- Successful installation record:
  `backups/sourceroot-historyroot-wampanoag-regional-corpus-v1-20260728-215238-865/installation-record.json`.
- The pre-correction backup retained from the first installer attempt is
  `backups/sourceroot-historyroot-wampanoag-regional-corpus-v1-20260728-215150-465`.

### Warnings and manual checks

- The 3 review findings and 5 observations remain disclosed review work; none
  is a blocker.
- The first installer attempt exposed only the corrected installation-record
  serialization defect after its generation, import/reimport, and verifier
  checks had passed.
- No unresolved manual acceptance check remains.

## Completion record

- Completion date: 2026-07-28T21:56:34.0091187-05:00
- Verification skipped: True

### Verifier results

- SKIPPED explicitly with -SkipVerification

### Changed files

- `backend/data/historyroot-wampanoag-regional-corpus-v1/corpus-inventory.json`
- `backend/data/historyroot-wampanoag-regional-corpus-v1/expansion-workspace.json`
- `backend/data/historyroot-wampanoag-regional-corpus-v1/historyroot-wampanoag-regional-corpus-v1.bundle.json`
- `backend/data/historyroot-wampanoag-regional-corpus-v1/quality-review.json`
- `backend/data/historyroot-wampanoag-regional-corpus-v1/quality-review.md`
- `backend/package.json`
- `backend/src/historyroot/wampanoag-regional-corpus.ts`
- `backend/src/scripts/generate-historyroot-wampanoag-regional-corpus.ts`
- `backend/src/scripts/import-historyroot-wampanoag-regional-corpus.ts`
- `backend/test/historyroot-wampanoag-regional-corpus.test.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/HISTORYROOT-WAMPANOAG-REGIONAL-CORPUS-CONTRACT.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `docs/stages/completed/20260728-SOURCEROOT-HISTORYROOT-WAMPANOAG-REGIONAL-CORPUS-V1.md`
- `INSTALL-SOURCEROOT-HISTORYROOT-WAMPANOAG-REGIONAL-CORPUS.ps1`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-HISTORYROOT-WAMPANOAG-REGIONAL-CORPUS.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Required verification was completed immediately before root-stage completion: the final Chunk 9 verifier passed 22 checks with 0 warnings and 0 failures, and VERIFY-ROOT-REPOSITORY.ps1 passed 51 checks with 0 warnings and 0 failures. The completion tool rerun was explicitly skipped to honor the instruction not to repeat completed tests, generations, regressions, or baselines. Browser smoke, installer verification, package verification, and release movement also passed.
