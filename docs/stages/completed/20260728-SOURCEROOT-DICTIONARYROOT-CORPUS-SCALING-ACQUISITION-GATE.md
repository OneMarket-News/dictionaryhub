# SourceRoot Chunk 10 — DictionaryRoot Corpus Scaling Acquisition Gate

## Stage identity

- Name: SourceRoot Chunk 10 — DictionaryRoot Corpus Scaling Acquisition Gate
- Slug: SOURCEROOT-DICTIONARYROOT-CORPUS-SCALING-ACQUISITION-GATE
- Status: active
- Started: 2026-07-28

## Objective

Determine acquisition rights, lexical-model fit, bounded corpus scope,
deterministic feasibility, and implementation readiness for a scaled
DictionaryRoot corpus without generating or importing production corpus data.

## Business value

Establish a rights-safe, source-verifiable, deterministic plan for growing
DictionaryRoot beyond its current OEWN pilot while making architecture gaps
and review obligations explicit before production implementation.

## Current source of truth

The checked-out repository at commit
`01eab17573f5eb9a6e957093496c500cf67a07db` is canonical. The current
DictionaryRoot OEWN pilot, SourceRoot schema and services, customer
experiences, accepted HistoryRoot 1.3.0 state, and public primary-source
rights documentation are read-only inputs. Backups, generated packages, and
completed stages are not implementation sources.

## Allowed files

- `backend/data/dictionaryroot-corpus-scaling-acquisition-v1/candidate-sources.json`
- `backend/data/dictionaryroot-corpus-scaling-acquisition-v1/feasibility-report.json`
- `backend/src/dictionaryroot/corpus-scaling-acquisition.ts`
- `backend/src/scripts/generate-dictionaryroot-corpus-scaling-acquisition.ts`
- `backend/test/dictionaryroot-corpus-scaling-acquisition.test.ts`
- `docs/build/DICTIONARYROOT-CORPUS-SCALING-SCOPE.md`
- `docs/build/DICTIONARYROOT-LEXICAL-MODEL-GAP-ANALYSIS.md`
- `docs/build/DICTIONARYROOT-SOURCE-ACQUISITION-PLAN.md`
- `docs/build/dictionaryroot-corpus-scaling-acquisition-stage.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-CORPUS-SCALING-ACQUISITION-GATE.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- `ROOT-MANIFEST.json`, `ROOT-PROTECTED-FUNCTIONALITY.md`, and root tooling
- `data/dictionaryroot/dictionaryroot-oewn-2025-pilot-500.json`
- DictionaryRoot lexical schema, generator, importer, stores, routes, tests,
  customer pages, and baseline verifier (read only)
- accepted HistoryRoot 1.3.0 repository/database evidence (read only)
- primary rights, version, download, and locator documentation for each
  candidate source

## Required behavior

- Record accepted and rejected candidate sources with explicit rights classes,
  identifiers, access conditions, attribution, locator strategy, and rationale.
- Report the exact repository and database baseline.
- Classify lexical-model, API, frontend, and migration gaps without changing
  those protected implementations.
- Generate candidate and feasibility JSON deterministically with stable order,
  normalized final newlines, and byte-identical regeneration.
- Recommend GO only if all stated source, rights, modeling, quality, and
  mandatory-minimum conditions are satisfied.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. This
stage also preserves the live SourceRoot API, OEWN pilot, HistoryRoot 1.3.0
dataset, migrations 001â€“012, `sourceroot_test`, frontend and API routes,
importer implementations, Git history, and the prohibition on static fallback
product data.

## Non-goals

- Production corpus generation or import
- Database mutation or migration 013
- Frontend, API-route, or importer changes
- Authentication, account, or unrelated HistoryRoot work
- Packages, installers, ZIPs, commits, branches, tags, pulls, or pushes
- Reproduction or scraping of restricted modern dictionary definitions

## Dependencies

- Node.js 22 or newer and the existing backend toolchain
- Windows PowerShell 5.1-compatible verification
- Read-only `sourceroot_test` access for baseline inspection
- Public primary-source web documentation for acquisition and rights evidence
- Accepted Chunk 9 commit, tag, ZIP, and HistoryRoot 1.3.0 state

## Risks

- Ambiguous or incompatible rights can invalidate an otherwise useful source.
- Existing synset storage cannot directly express every requested lexical,
  etymological, comparison, locator, or field-provenance distinction.
- Source concentration or shared editorial lineage can create false
  multi-source confidence.
- Unstable machine access or unbounded locators can prevent deterministic
  acquisition.
- Stage output is planning evidence only and must not be mistaken for a
  production corpus.

## Acceptance criteria

1. All mandatory starting-gate identities and boundaries pass.
2. At least 15 distinct reusable accepted sources meet category thresholds.
3. Every candidate records explicit rights, access, attribution, locator,
   strengths, limitations, coverage, role, status, and rationale fields.
4. Baseline and gap analyses cover every requested capability and metric
   without modifying protected implementation files.
5. Projection and mandatory-minimum feasibility are deterministic and do not
   depend on restricted definition reproduction or invented lexical certainty.
6. Independent two-directory generation is byte-identical and equals the
   repository artifacts.
7. Typecheck, focused tests, DictionaryRoot baseline, final gate verifier, root
   verifier, and `git diff --check` pass with required warning/failure counts.
8. The index is empty and no database, production corpus, frontend, API route,
   importer, migration, package, ZIP, or Git-history mutation occurs.

## Required verifier

- `VERIFY-DICTIONARYROOT-BASELINE.ps1`
- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-CORPUS-SCALING-ACQUISITION-GATE.ps1`

## Manual browser checks

Not applicable: this gate cannot modify frontend source or product data.
Existing frontend support is assessed by static inspection and the accepted
DictionaryRoot baseline verifier.

## Live API checks

No live API mutation or implementation is permitted. Read-only repository and
`sourceroot_test` baseline inspection is required; API display gaps are
classified from existing route, service, and customer-experience contracts.

## Required output

The ten gate deliverables, deterministic hashes and byte lengths,
test/verifier totals, baseline counts, source distributions, gap
classifications, risks and unresolved questions, a final recommendation, and
explicit negative confirmations for every prohibited mutation.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-28T22:42:14.6924688-05:00
- Verification skipped: False

### Verifier results

- VERIFY-DICTIONARYROOT-BASELINE.ps1 -> exit 0
- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0
- VERIFY-SOURCEROOT-DICTIONARYROOT-CORPUS-SCALING-ACQUISITION-GATE.ps1 -> exit 0

### Changed files

- `backend/data/dictionaryroot-corpus-scaling-acquisition-v1/candidate-sources.json`
- `backend/data/dictionaryroot-corpus-scaling-acquisition-v1/feasibility-report.json`
- `backend/src/dictionaryroot/corpus-scaling-acquisition.ts`
- `backend/src/scripts/generate-dictionaryroot-corpus-scaling-acquisition.ts`
- `backend/test/dictionaryroot-corpus-scaling-acquisition.test.ts`
- `docs/build/dictionaryroot-corpus-scaling-acquisition-stage.md`
- `docs/build/DICTIONARYROOT-CORPUS-SCALING-SCOPE.md`
- `docs/build/DICTIONARYROOT-LEXICAL-MODEL-GAP-ANALYSIS.md`
- `docs/build/DICTIONARYROOT-SOURCE-ACQUISITION-PLAN.md`
- `docs/stages/completed/20260728-SOURCEROOT-DICTIONARYROOT-CORPUS-SCALING-ACQUISITION-GATE.md`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-DICTIONARYROOT-CORPUS-SCALING-ACQUISITION-GATE.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Chunk 10 acquisition gate completed with CONDITIONAL GO: 17 accepted reusable sources, 5 rejected/reference-only candidates, zero blockers, and production implementation conditioned on approved lexical claim/form/etymology/locator/provenance/comparison schema and matching API/frontend contracts. No production corpus, database mutation, migration, package, ZIP, or Git-history operation occurred.
