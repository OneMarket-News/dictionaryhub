# SourceRoot Repeatable Source Preparation Workflow v1.1 Stage Record

## Starting checkpoint

- Branch: `release/historyroot-alpha-integration-v1`
- Starting commit: `7eef6b27f5c97a3e0de82a457ca06c828f9fe3df`
- Remote tracking commit:
  `7eef6b27f5c97a3e0de82a457ca06c828f9fe3df`
- Starting tag: `sourceroot-repeatable-source-preparation-workflow-v1`
- Tag peeled commit:
  `7eef6b27f5c97a3e0de82a457ca06c828f9fe3df`
- Accepted Chunk 7 ZIP:
  `C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-Repeatable-Source-Preparation-Workflow-v1.zip`
- Chunk 7 ZIP SHA-256:
  `018E8463542EE33A20CB24545B4D64E1BC0F8E9C1701E55EFE01D20AA15C39DC`
- Database: `sourceroot_test`
- Migration ceiling: 012; migration 013 absent
- Starting worktree: clean
- Starting root verifier: 51 pass, 0 warnings, 0 failures
- Starting `git diff --check`: PASS
- Starting TypeScript: PASS
- Starting Chunk 7 suite: 40/40
- Starting Chunk 6 suite: 30/30

## Defect and correction

The Chunk 8 feasibility review established adequate accepted local material,
then stopped because Chunk 7 could not prepare six accepted contextual
collections. Schema `1.1.0` now exposes those collections directly, validates
their dependencies, preserves naturally ID-less perspective links with a
preparation-only wrapper ID, and uses accepted-order deterministic
serialization. Schema `1.0.0` is unchanged.

## Root stage

- Name: SourceRoot Repeatable Source Preparation Workflow v1.1 — Lossless
  Context Collection Support
- Slug: `SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1`
- Active-stage root verifier: 51 pass, 0 warnings, 0 failures
- Unauthorized files: 0

## Deterministic evidence

- Original golden workspace length: 32,711 bytes
- Original golden workspace SHA-256:
  `116D4D490D86FDCDA352575ED3DDE439A052BF0EE566118343AF74DD9F5142BD`
- Original golden generated-bundle SHA-256:
  `F47D4F1F5CBC123DCAEC1B07D5A6B051D3C306F488DFA81DCC353C5E7DCC8428`
- Workspace compatibility: schema `1.0.0` and `1.1.0` both accepted
- Lossless workspace length: 628,478 bytes
- Lossless workspace SHA-256:
  `806BFD14348D570FDF8B7EB84820D1E722155FDDD8A9B2913B808B6AD60B21E3`
- Accepted Chunk 6 bundle SHA-256:
  `D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F`
- First generation: 493,760 bytes,
  `D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F`
- Second generation: 493,760 bytes,
  `D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F`
- Repeated-generation byte equality: PASS
- Accepted-bundle byte equality: PASS

## Preserved collection counts

- Claim attributions: 25
- Interpretations: 12
- Perspectives: 10
- Perspective links: 18
- Causal links: 18
- Cultural memories: 6

## Development verification

- TypeScript: PASS
- Dependency validation: PASS
- Accepted bundle schema: ready, 0 errors, 0 warnings
- Existing importer: PASS
- Replacement-safe preservation: PASS
- Duplicate-safe reimport: PASS
- Search preservation: PASS
- Context Review preservation: PASS
- Existing Chunk 7 suite: 40/40
- Maintenance-focused suite: 50/50
- Chunk 6 suite: 30/30
- Bounded maintenance verifier: 14 pass, 0 warnings, 0 failures

## Files

Added:

- `backend/data/source-preparation-workflow-v1/lossless-context-workspace.json`
- `backend/test/source-preparation-lossless-context.test.ts`
- `docs/build/LOSSLESS-CONTEXT-COLLECTION-SUPPORT-CONTRACT.md`
- `docs/build/lossless-context-collection-support-stage.md`
- `INSTALL-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1`
- `VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.ps1`

Replaced:

- `backend/package.json`
- `backend/src/source-preparation/source-preparation-types.ts`
- `backend/src/source-preparation/source-preparation-schema.ts`
- `backend/src/source-preparation/source-preparation-engine.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `ROOT-MANIFEST.json`

Normal active/completed root-stage records are lifecycle-managed.

## Final acceptance

- Root stage completion: PASS through `tools/COMPLETE-ROOT-STAGE.ps1`
- Completed stage record:
  `docs/stages/completed/20260728-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1-1.md`
- Inactive root verifier: 51 pass, 0 warnings, 0 failures; inactive-stage
  scope skip explicitly confirmed
- Complete backend total: 331/331
- SourceRoot baseline: 15 pass, 0 warnings, 0 failures
- DictionaryRoot baseline: 23 pass, 0 warnings, 0 failures
- Named regressions: Context Review backend 24/24; Context Review frontend
  15/15; frontend observability 10/10; HistoryRoot Plymouth 18/18;
  HistoryRoot customer 13/13
- Immutable Chunk 0–7 replay: PASS. All eight accepted ZIP hashes matched;
  exact Chunk 0–5 isolated replay returned 1 pass, 0 warnings, 0 failures;
  the accepted underlying Chunk 6 and Chunk 7 suites returned 30/30 and
  40/40 because their historical checkpoint wrappers intentionally reject
  later-stage branch state. The first combined run reached the replay gate
  but its host command timed out; only the incomplete replay gate was
  retried.
- Installer: PASS, one execution
- Final verifier: 21 pass, 0 warnings, 0 failures
- Backup path:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-repeatable-source-preparation-workflow-v1-1-20260728-083711-301`
- Installation-record path:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-repeatable-source-preparation-workflow-v1-1-20260728-083711-301\installation-record.json`
- Package path:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub\SourceRoot-Repeatable-Source-Preparation-Workflow-v1.1`
- ZIP path:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub\SourceRoot-Repeatable-Source-Preparation-Workflow-v1.1.zip`
- ZIP size and SHA-256: recorded after final archive closure

## Boundaries

No frontend file, accepted customer data, importer, route, or migration was
changed. No external research, AI extraction, OCR, scraping, truth scoring,
or legal determination occurred. No Git mutation occurred.

No browser certification is claimed because this maintenance release changes
neither customer-facing files nor the accepted customer data state.

## Next dependency

HistoryRoot corpus expansion and quality review.
