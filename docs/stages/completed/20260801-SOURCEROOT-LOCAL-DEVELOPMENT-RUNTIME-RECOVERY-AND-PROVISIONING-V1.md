# SourceRoot Local Development Runtime Recovery and Provisioning v1

## Stage identity

- Name: SourceRoot Local Development Runtime Recovery and Provisioning v1
- Slug: SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING-V1
- Status: active
- Started: 2026-08-01

## Objective

Restore the accepted BibleRoot source artifact, safely provision released DictionaryRoot and BibleRoot datasets into the explicit local development database, and expose honest runtime readiness without weakening historical test-only import guards.

## Business value

One explicit command can restore the released customer datasets to a known
local development database without weakening test or production boundaries.
Customer pages and shared navigation can distinguish ready data from an
unreachable API instead of presenting contradictory status.

## Current source of truth

The checked-out repository at
`d98f38a07116a24f028cb290abb99036905b160b` on
`release/historyroot-alpha-integration-v1` is canonical. Its parent is
`8afb1bae19dc93e18e89351958defcf960e8c7c6`, and
`sourceroot-immutable-source-artifact-preservation-rules-v1` points at HEAD.
Released repository datasets and their manifests are the only provisioning
inputs. No backup, archive, package, or other checkout is an implementation
source.

## Allowed files

- `assets/js/sourceroot-root-switcher.js`
- `backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt`
- `backend/package.json`
- `backend/src/lib/local-development-database.ts`
- `backend/src/routes/health.ts`
- `backend/src/scripts/development-runtime.ts`
- `backend/src/scripts/import-bibleroot-foundation.ts`
- `backend/src/scripts/import-bibleroot-original-language-foundation.ts`
- `backend/src/services/development-runtime-readiness.ts`
- `backend/test/local-development-runtime.test.ts`
- `docs/architecture/SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING-V1.md`
- `docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260801-SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING-V1.md`
- `ROOT-MANIFEST.json`
- `verification/sourceroot-local-development-runtime.test.cjs`
- `verification/sourceroot-shared-root-switcher.test.cjs`
- `VERIFY-SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- migrations 013 through 016 and the existing `sourceroot` development schema
- DictionaryRoot Core Lexical Corpus v1.0.0
- BibleRoot Foundation v1.0.0 and Original Language Foundation v1.0.0
- the committed immutable-source `.gitattributes` policy
- existing test-only importers, live API clients, and shared Root switcher

## Required behavior

- Recover the accepted Gutenberg bytes exactly and change no other protected source.
- Add explicit `dev:provision` and read-only `dev:status` commands.
- Require development mode, a loopback PostgreSQL server, database
  `sourceroot`, migrations 013 through 016, and migration 017 absence.
- Validate every released dataset identity before mutation; import or skip
  idempotently and preserve HistoryRoot exactly.
- Keep historical CLI defaults restricted to `sourceroot_test`.
- Expose one read-only runtime-readiness contract and derive shared Root status
  from it without hiding destinations or fabricating product data.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. Migration
016, all Chunk 13A raw and source-document identities, normalized corpora,
HistoryRoot, authentication, governance, static-fallback prohibitions, API
error secrecy, responsive layout, accessibility, and script initialization
order are stage-specific protections.

## Non-goals

- migration 017 or any schema change
- BibleRoot Translation Comparison
- `.env`, credentials, production databases, remote databases, or automatic startup provisioning
- corpus generation, HistoryRoot reimport, auth/governance changes, ZIPs, packages, or Git history

## Dependencies

Node.js, npm, Windows PowerShell 5.1, Git, local PostgreSQL, `.env` for explicit
development acceptance, `.env.test` for automated database tests, and browser
automation at frontend ports 5500 or 8010.

## Risks

Primary risks are targeting an unsafe database, accepting altered evidence,
partial replacement, duplicate records, HistoryRoot drift, stale servers, and
misleading readiness. Authorization is issued only after independent URL and
connected-server checks. Dataset imports are transactional; already exact
datasets are skipped. Recovery is permitted only for the proven CRLF byte
identity.

The historical DictionaryRoot Core Lexical Corpus test 15 freezes migration
015 absence, and the historical BibleRoot Foundation test 12 freezes the table
family before migration 016. Both assertions are incompatible with the current
released migration boundary and remain unchanged. Their applicable behavioral,
idempotency, preservation, and API cases are required; current migration 016
and Original Language coverage are verified independently.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. The Gutenberg artifact is exactly 4,436,268 bytes with accepted SHA-256,
   identical filtered/no-filter blobs, and `text` unset.
2. The two development commands enforce the local safety contract and never
   run during normal startup.
3. Two consecutive provisions produce exact released counts; the second skips
   all three datasets and HistoryRoot has the same fingerprint.
4. Required DictionaryRoot and BibleRoot APIs return released data, including
   all four KJV chapters and both original-language directions.
5. Root statuses are honest before provisioning, ready afterward, accessible,
   responsive, and free of console errors or unexpected warnings.
6. Focused backend/frontend suites, typecheck, active/inactive focused and Root
   verifiers, and `git diff --check` pass.
7. Migration 016 and the other ten protected sources remain exact; migration
   017, ZIPs, Translation Comparison, staging, commits, and new tags remain absent.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING.ps1`

## Manual browser checks

With backend port 3000 and frontend port 5500, inspect `sourceroot.html`,
`index.html`, `historyroot.html`, `bibleroot.html`, and
`bibleroot-passage.html` at 1280x720 and 390x844. Verify the switcher readiness
labels, DictionaryRoot coverage, four released KJV passages, Hebrew RTL, Greek
LTR, navigation, zero horizontal overflow, and zero console errors or
unexpected warnings. Capture current evidence outside protected historical
screenshot paths.

## Live API checks

Against local `sourceroot` only, run migrations, provision twice, and probe
runtime readiness, DictionaryRoot evidence coverage, BibleRoot editions,
books, Genesis 1, Psalm 23, John 1, Ecclesiastes 3, original-language editions,
Genesis 1, and John 1. All return HTTP 200 and released identities/counts.
`dev:status` is read-only and does not disclose the configured URL or credentials.

## Required output

The exact repaired blob, guarded orchestration and status commands, readiness
service/API, shared status integration, focused tests, architecture contract,
runbook, focused verifier, active/inactive verification evidence, browser/API
acceptance evidence, completed stage record, final path list, and clean index.

## Acceptance evidence

- Pre-repair artifact: 4,336,671 bytes, 99,597 LF-only terminators, SHA-256
  `6DDEB05FC18E988AB569549603410FECF1A40604D826187C278B3B948A92C0E4`.
- Accepted artifact: 4,436,268 bytes, SHA-256
  `0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986`,
  Git blob `0ddceccdd1569bb5f5992aa33e33aa8aa99eee6e`, identical with and without
  filters and in an isolated temporary index.
- Pre-provision readiness: DictionaryRoot and BibleRoot `awaiting-data` with
  zero released rows; HistoryRoot `ready`.
- First provision: DictionaryRoot imported 7,945 reported records, BibleRoot
  Foundation 199, Original Language 5,832; zero updated/skipped/failed.
- Second provision: the same 7,945/199/5,832 records were skipped; zero
  imported/updated/failed.
- HistoryRoot fingerprint remained
  `4333D5FA1BE960F9BA8000C284A72DD4C4702DFCACAC970A7CBECB7E3A7B7D5E`.
- Live API: all required endpoints returned HTTP 200; DictionaryRoot reported
  500 lemmas and 1,014 senses; BibleRoot reported 1 edition, 66 books, chapter
  sizes 31/6/51/22, two original-language editions, Hebrew RTL, and Greek LTR.
- Browser: SourceRoot, DictionaryRoot, HistoryRoot, BibleRoot home, and all
  four passage pages passed at 1280x720 and 390x844 with honest ready states,
  no unavailable/awaiting-corpus mislabel, no horizontal overflow, and zero
  console warnings or errors.
- Active focused verifier: 32 checks, 0 warnings, 0 failures.
- Active Root verifier: 51 checks, 0 warnings, 0 failures.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-08-01T12:13:45.6393605-05:00
- Verification skipped: False

### Verifier results

- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0
- VERIFY-SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING.ps1 -> exit 0

### Changed files

- `assets/js/sourceroot-root-switcher.js`
- `backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt`
- `backend/package.json`
- `backend/src/lib/local-development-database.ts`
- `backend/src/routes/health.ts`
- `backend/src/scripts/development-runtime.ts`
- `backend/src/scripts/import-bibleroot-foundation.ts`
- `backend/src/scripts/import-bibleroot-original-language-foundation.ts`
- `backend/src/services/development-runtime-readiness.ts`
- `backend/test/local-development-runtime.test.ts`
- `docs/architecture/SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING-V1.md`
- `docs/runbooks/SOURCEROOT-LOCAL-DEVELOPMENT.md`
- `docs/stages/completed/20260801-SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING-V1.md`
- `ROOT-MANIFEST.json`
- `verification/sourceroot-shared-root-switcher.test.cjs`
- `VERIFY-SOURCEROOT-LOCAL-DEVELOPMENT-RUNTIME-RECOVERY-AND-PROVISIONING.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Restored the exact accepted Gutenberg bytes; added guarded, idempotent local development provisioning and read-only readiness; provisioned released DictionaryRoot and BibleRoot datasets twice with HistoryRoot preserved; completed live API and desktop/mobile browser acceptance with zero console issues; no migration 017, ZIP, Translation Comparison, Git index, commit, tag, or remote operation.
