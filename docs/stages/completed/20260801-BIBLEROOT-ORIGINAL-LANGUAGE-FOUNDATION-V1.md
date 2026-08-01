# BibleRoot Original Language Foundation v1

## Stage identity

- Name: BibleRoot Original Language Foundation v1
- Slug: BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION-V1
- Status: active
- Started: 2026-08-01

## Objective

Add a read-only, provenance-complete Hebrew and Greek original-language layer for Genesis 1, Psalm 23, Ecclesiastes 3, and John 1 beneath the protected Chunk 12 KJV passage experience.

## Business value

Customers can inspect the exact Hebrew or Greek token sequence for the four
released KJV chapters without conflating source text, morphology, translation,
commentary, or project inference. Every displayed token remains traceable to a
tag-pinned raw artifact and component-specific rights record.

## Current source of truth

The checked-out repository at
`b149b6bb2d39ee78557f7716975a07d1a84fcc06` is canonical. Protected inputs are
migrations 001-015 and the released BibleRoot Foundation v1 dataset and APIs.
New inputs are only tag `v.2.2` of `openscriptures/morphhb` at
`6a5db284c715c18b239422e57bb89684e6a19f00` and tag `rel-1-3` of
`biblicalhumanities/Nestle1904` at
`f2e8fef56eeea892697b5d511a87b8545d6c3dda`.

## Allowed files

- `assets/css/bibleroot.css`
- `assets/js/bibleroot-api.js`
- `assets/js/bibleroot-passage.js`
- `backend/data/bibleroot-original-language-foundation-v1/dataset-manifest.json`
- `backend/data/bibleroot-original-language-foundation-v1/editions.json`
- `backend/data/bibleroot-original-language-foundation-v1/IMPORT-NOTES.md`
- `backend/data/bibleroot-original-language-foundation-v1/mappings.json`
- `backend/data/bibleroot-original-language-foundation-v1/raw/Eccl.xml`
- `backend/data/bibleroot-original-language-foundation-v1/raw/Gen.xml`
- `backend/data/bibleroot-original-language-foundation-v1/raw/Nestle1904.csv`
- `backend/data/bibleroot-original-language-foundation-v1/raw/Ps.xml`
- `backend/data/bibleroot-original-language-foundation-v1/RIGHTS.md`
- `backend/data/bibleroot-original-language-foundation-v1/rights-components.json`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/nestle1904-parsing.txt`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/nestle1904-README.md`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-HebrewMorphologyCodes.html`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-LICENSE.md`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-parsing-README.md`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-README.md`
- `backend/data/bibleroot-original-language-foundation-v1/source-metadata.json`
- `backend/data/bibleroot-original-language-foundation-v1/tokens.json`
- `backend/data/bibleroot-original-language-foundation-v1/verses.json`
- `backend/db/migrations/016_create_bibleroot_original_language_foundation.sql`
- `backend/package.json`
- `backend/src/bibleroot/original-languages.ts`
- `backend/src/routes/bibleroot.ts`
- `backend/src/scripts/import-bibleroot-original-language-foundation.ts`
- `backend/src/scripts/prepare-bibleroot-original-language-foundation.ts`
- `backend/src/services/bibleroot-store.ts`
- `backend/test/bibleroot-original-language-foundation.test.ts`
- `bibleroot-passage.html`
- `docs/api/BIBLEROOT-ORIGINAL-LANGUAGE-API.md`
- `docs/architecture/BIBLEROOT-ORIGINAL-LANGUAGE-ARCHITECTURE.md`
- `docs/architecture/BIBLEROOT-ORIGINAL-LANGUAGE-TOKEN-AND-MAPPING-CONTRACT.md`
- `docs/build/BIBLEROOT-ORIGINAL-LANGUAGE-BROWSER-EVIDENCE.md`
- `docs/build/BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION-STATE.md`
- `docs/sources/BIBLEROOT-ORIGINAL-LANGUAGE-SOURCES-AND-RIGHTS.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260801-BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION-V1.md`
- `ROOT-MANIFEST.json`
- `verification/bibleroot-original-language-ecclesiastes-3-desktop.png`
- `verification/bibleroot-original-language-foundation.test.cjs`
- `verification/bibleroot-original-language-genesis-1-desktop.png`
- `verification/bibleroot-original-language-genesis-1-mobile.png`
- `verification/bibleroot-original-language-john-1-desktop.png`
- `verification/bibleroot-original-language-provenance-desktop.png`
- `verification/bibleroot-original-language-psalm-23-desktop.png`
- `verification/bibleroot-original-language-psalm-23-mobile.png`
- `verification/bibleroot-original-language-unavailable-mobile.png`
- `VERIFY-BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- Existing `sources`, `imported_bundles`, BibleRoot publication/artifact,
  edition, canonical-verse, passage, and phrase records from migration 015.
- Tag-pinned `wlc/Gen.xml`, `wlc/Ps.xml`, and `wlc/Eccl.xml` plus the OSHB
  README, license, parsing README, and morphology-code document.
- Tag-pinned `Nestle1904.csv`, README, and `parsing.txt`.
- Existing `sourceroot_test`, Express, shared-menu, Root-switcher, URL-state,
  and stage-lifecycle conventions.

## Required behavior

- Preserve raw artifacts byte-for-byte and validate length and SHA-256 before
  parsing only Genesis 1, Psalm 23, Ecclesiastes 3, and John 1.
- Preserve source-native Hebrew word IDs, null Greek source-native IDs, exact
  token order/surface/lemma/morphology values, and honest analyzed,
  not-yet-analyzed, and ambiguous states.
- Import transactionally and idempotently into `sourceroot_test`, replacing
  only this stage's bundle while fingerprinting Chunk 12 before and after.
- Expose read-only original-language edition and passage APIs with explicit
  source-to-KJV verse mappings, provenance, rights, and bounded-unavailable
  responses.
- Render an accessible subordinate passage panel with Hebrew RTL, Greek LTR,
  URL/history preservation, honest loading/offline/unavailable/error states,
  and no static fallback language data.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` is protected. Stage-specific
protections include the Chunk 12 raw and normalized hashes, canon and KJV
edition IDs, 66 books, 110 verses, nine phrases, 13 occurrences, existing
BibleRoot routes/navigation/deep links, shared menus, unified search boundary,
and all DictionaryRoot and HistoryRoot fixtures and APIs.

## Non-goals

Additional translations or chapters, transliteration, lexical glosses,
word-level English alignment, commentary, theology, textual variants,
Textus Receptus reconstruction, authentication, write APIs, unified-search
indexing, migration 017, packages, Git history changes, and unrelated refactors.

## Dependencies

Node.js 22+, PostgreSQL `sourceroot_test`, the backend on port 3000, a static
frontend on port 8010, Windows PowerShell 5.1, and the released Chunk 12
BibleRoot Foundation v1.

## Risks

Unicode normalization or re-encoding, incorrect Psalm superscription mapping,
silent token skips, fabricated Greek IDs, rights overstatement, cross-bundle
deletion, Chunk 12 identity drift, stale API processes, horizontal overflow,
and frozen historical verifier lifecycle assertions.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Exact tag commits, raw lengths/hashes, bounded normalized hashes, counts,
   token order, analysis states, mappings, provenance, and rights validate
   deterministically with no malformed token skipped.
2. Migration 016, importer rollback/idempotency/preservation, read-only API,
   frontend contracts, preservation suites, active/inactive repository gates,
   and desktop/mobile browser acceptance pass with zero unresolved checks.

## Required verifier

- `VERIFY-BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION.ps1`
- `VERIFY-ROOT-REPOSITORY.ps1`

## Manual browser checks

At 1280x720 and 390x844, inspect BibleRoot home and the four populated passage
panels, provenance/rights, loading, bounded-unavailable, malformed reference,
shared menus, back/forward, refresh, Hebrew RTL, Greek LTR, token order and
truncation, viewport containment, horizontal overflow, and console output.
Fresh screenshots belong only under the enumerated ignored verification paths.

## Live API checks

Against `sourceroot_test` on port 3000, verify edition listing and original
language passage responses for all four chapters, explicit mappings and rights,
bounded unavailable and malformed states, and 404 for mutation methods. No
other database may be changed.

## Required output

Migration 016; exact raw sources and documentation; deterministic normalized
dataset and preparation/import tooling; store/routes/tests; subordinate passage
panel; architecture/API/source/state/browser documents; fresh screenshots;
focused final verifier; completed-stage record; exact counts, hashes, refs,
preservation fingerprints, suite results, browser results, and clean index
evidence.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-08-01T10:09:57.9026554-05:00
- Verification skipped: False

### Verifier results

- VERIFY-BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION.ps1 -> exit 0
- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0

### Changed files

- `assets/css/bibleroot.css`
- `assets/js/bibleroot-api.js`
- `assets/js/bibleroot-passage.js`
- `backend/data/bibleroot-original-language-foundation-v1/dataset-manifest.json`
- `backend/data/bibleroot-original-language-foundation-v1/editions.json`
- `backend/data/bibleroot-original-language-foundation-v1/IMPORT-NOTES.md`
- `backend/data/bibleroot-original-language-foundation-v1/mappings.json`
- `backend/data/bibleroot-original-language-foundation-v1/raw/Eccl.xml`
- `backend/data/bibleroot-original-language-foundation-v1/raw/Gen.xml`
- `backend/data/bibleroot-original-language-foundation-v1/raw/Nestle1904.csv`
- `backend/data/bibleroot-original-language-foundation-v1/raw/Ps.xml`
- `backend/data/bibleroot-original-language-foundation-v1/RIGHTS.md`
- `backend/data/bibleroot-original-language-foundation-v1/rights-components.json`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/nestle1904-parsing.txt`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/nestle1904-README.md`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-HebrewMorphologyCodes.html`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-LICENSE.md`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-parsing-README.md`
- `backend/data/bibleroot-original-language-foundation-v1/source-docs/oshb-README.md`
- `backend/data/bibleroot-original-language-foundation-v1/source-metadata.json`
- `backend/data/bibleroot-original-language-foundation-v1/tokens.json`
- `backend/data/bibleroot-original-language-foundation-v1/verses.json`
- `backend/db/migrations/016_create_bibleroot_original_language_foundation.sql`
- `backend/package.json`
- `backend/src/bibleroot/original-languages.ts`
- `backend/src/routes/bibleroot.ts`
- `backend/src/scripts/import-bibleroot-original-language-foundation.ts`
- `backend/src/scripts/prepare-bibleroot-original-language-foundation.ts`
- `backend/src/services/bibleroot-store.ts`
- `backend/test/bibleroot-original-language-foundation.test.ts`
- `bibleroot-passage.html`
- `docs/api/BIBLEROOT-ORIGINAL-LANGUAGE-API.md`
- `docs/architecture/BIBLEROOT-ORIGINAL-LANGUAGE-ARCHITECTURE.md`
- `docs/architecture/BIBLEROOT-ORIGINAL-LANGUAGE-TOKEN-AND-MAPPING-CONTRACT.md`
- `docs/build/BIBLEROOT-ORIGINAL-LANGUAGE-BROWSER-EVIDENCE.md`
- `docs/build/BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION-STATE.md`
- `docs/sources/BIBLEROOT-ORIGINAL-LANGUAGE-SOURCES-AND-RIGHTS.md`
- `docs/stages/completed/20260801-BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION-V1.md`
- `ROOT-MANIFEST.json`
- `VERIFY-BIBLEROOT-ORIGINAL-LANGUAGE-FOUNDATION.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Chunk 13A completed with fresh browser evidence and zero unresolved manual checks. The unchanged Chunk 12 full suite retains one frozen schema-family assertion that predates migration 016; all 27 current preservation cases pass and the historical exception is documented separately.
