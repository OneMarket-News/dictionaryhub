# SourceRoot Chunk 7 — Repeatable Source Preparation Workflow v1 Stage Record

## Starting checkpoint

- Branch: `release/historyroot-alpha-integration-v1`
- Immediate starting commit: `a933e45e8304209d25634837b90f7703119d94ff`
- Direct parent: `640c309d8e5900c5d3a7213b1269f58ffe6f3256`
- Accepted Chunk 6 grandparent:
  `276b448f4d41ec340ca120d69ca65007c932a2c0`
- Remote tracking commit: `a933e45e8304209d25634837b90f7703119d94ff`
- Starting worktree: clean
- Ancestry: exact three-commit lineage confirmed
- Chunk 6 annotated tag:
  `sourceroot-historyroot-foundational-corpus-v1`
- Peeled Chunk 6 commit:
  `276b448f4d41ec340ca120d69ca65007c932a2c0`
- Chunk 6 ZIP:
  `C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-HistoryRoot-Foundational-Corpus-v1.zip`
- Chunk 6 ZIP SHA-256:
  `D5F19A90EB697BDDB2D38BF12CDDBBB430029920E5B131762DD88B4ED735DCB9`
- Test database: `sourceroot_test`
- Migration ceiling: 012; migration 013 absent

The first maintenance commit changed only the accepted DictionaryRoot Codex
efficiency foundation and repository-management files. The immediate starting
commit changed only `tools/VERIFY-ROOT-REPOSITORY.ps1` and its completed stage
record. Neither maintenance commit changed backend application/data,
migrations, SourceRoot schemas/APIs, Chunk 6 content, customer files, clients,
branding, or experiences.

The starting root verifier passed 51 checks with 0 warnings and 0 failures.
`git diff --check` passed. No full regression or immutable replay ran during
the starting gate.

## Active root stage

- Name: SourceRoot Chunk 7 — Repeatable Source Preparation Workflow v1
- Slug: `SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1`
- Preflight changed files: 0
- Allowed files: 15 exact paths, with no customer-facing path
- Active verifier result: 51 pass, 0 warnings, 0 failures
- Scope result: 2 initial stage-state changes; 0 unauthorized

## Implementation

- Workspace schema: `1.0.0`
- Modes: `validate`, `preview`, `generate`
- Golden approved counts:
  - sources: 4
  - reporting accounts: 2
  - contextual records: 5
  - claims: 5
  - historical names: 1
  - date expressions: 1
  - relationships: 1
  - locators: 4
  - evidence: 4
  - evidence links: 4 (`supports`: 3; `qualifies`: 1)
  - field provenance: 2
- Rights counts: `public_domain`: 2;
  `metadata_and_link_only`: 2
- Content-use counts: `public_domain_excerpt`: 2;
  `paraphrase_only`: 2
- Preparation status: 33 approved, 0 draft, 0 needs-review, 0 omitted
- First generated SHA-256:
  `F47D4F1F5CBC123DCAEC1B07D5A6B051D3C306F488DFA81DCC353C5E7DCC8428`
- Second generated SHA-256:
  `F47D4F1F5CBC123DCAEC1B07D5A6B051D3C306F488DFA81DCC353C5E7DCC8428`
- Byte equality: PASS
- Accepted bundle schema: ready, 0 errors, 0 warnings
- Focused suite: 40/40
- TypeScript: PASS
- Importer: PASS through existing `saveImportedBundle`
- Duplicate-safe reimport: PASS
- Search integration: PASS
- Context Review integration: PASS
- Test database restoration: accepted Chunk 6 bundle restored

## Files

Added:

- `backend/data/source-preparation-workflow-v1/golden-workspace.json`
- `backend/src/source-preparation/source-preparation-types.ts`
- `backend/src/source-preparation/source-preparation-schema.ts`
- `backend/src/source-preparation/source-preparation-engine.ts`
- `backend/src/scripts/prepare-sourceroot-workspace.ts`
- `backend/test/source-preparation-workflow.test.ts`
- `docs/build/REPEATABLE-SOURCE-PREPARATION-WORKFLOW-CONTRACT.md`
- `docs/build/repeatable-source-preparation-workflow-stage.md`
- `INSTALL-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW.ps1`
- `VERIFY-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW.ps1`

Replaced:

- `backend/package.json`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `ROOT-MANIFEST.json`

Normal active/completed root-stage records are lifecycle-managed.

## Final acceptance evidence

Final current-byte evidence:

- Root stage completion: PASS through `COMPLETE-ROOT-STAGE.ps1`
- Completed root-stage record:
  `docs/stages/completed/20260727-SOURCEROOT-REPEATABLE-SOURCE-PREPARATION-WORKFLOW-V1.md`
- Inactive root verifier: 51 pass, 0 warnings, 0 failures; explicit
  inactive-stage scope skip confirmed
- Complete backend: 281/281
- SourceRoot baseline: 15 pass, 0 failures, 0 warnings
- DictionaryRoot baseline: 23 pass, 0 failures, 0 warnings
- Chunk 5 backend review: 24/24
- Chunk 5 frontend review: 15/15
- Frontend observability: 10/10
- HistoryRoot customer experience: 13/13 exact DOM suite
- HistoryRoot Plymouth integration: 18/18
- Foundational corpus: 30/30
- Immutable Chunk 0-6 replay: PASS, exit 0, 0 failures, 0 warnings
- Installer: PASS
- Final verifier: 16 pass, 0 warnings, 0 failures
- Final backup path:
  `backups/sourceroot-repeatable-source-preparation-workflow-v1-20260727-chunk7-sealed`
- Final installation record:
  `backups/sourceroot-repeatable-source-preparation-workflow-v1-20260727-chunk7-sealed/installation-record.json`
- Package path:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub\SourceRoot-Repeatable-Source-Preparation-Workflow-v1`
- ZIP path:
  `C:\Users\Josh\Documents\GitHub\dictionaryhub\SourceRoot-Repeatable-Source-Preparation-Workflow-v1.zip`

The final ZIP byte size and SHA-256 are reported in the external completion
report after sealing. Embedding an archive's own final hash or size inside a
stage record contained by that archive is self-referential and would change
the values being recorded.

## Known limitations

The workflow validates supplied local review metadata and accepted structures;
it does not research, retrieve, verify factual truth, determine rights,
certify legality, expand the corpus, or provide a contributor/production
workflow. No browser check is required or claimed because no customer-facing
file changes.

No commit, stage, tag, push, pull, checkout, reset, merge, rebase, branch
creation, or other Git mutation is performed.
