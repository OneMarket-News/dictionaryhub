# BibleRoot Foundation v1

## Stage identity

- Name: BibleRoot Foundation v1
- Slug: BIBLEROOT-FOUNDATION-V1
- Status: active
- Started: 2026-07-30

## Objective

Establish the SourceRoot-powered BibleRoot foundation alpha with verified KJV text, stable citations, read-only APIs, provenance, shared navigation, and customer passage experiences.

## Business value

Customers can read a bounded verified KJV alpha, cite exact verses with
stable identifiers, and inspect the source artifact and rights record without
conflating text with later interpretation.

## Current source of truth

The checked-out repository at
`957d58ddaf53522bec19bb1cbe436d6f6b670dbd` is canonical. The only new
external input is Project Gutenberg eBook 10's official UTF-8 plain-text
artifact, acquired from `https://www.gutenberg.org/files/10/10-0.txt`.

## Allowed files

- `assets/css/bibleroot.css`
- `assets/js/bibleroot-api.js`
- `assets/js/bibleroot-home.js`
- `assets/js/bibleroot-passage.js`
- `assets/js/sourceroot-root-switcher.js`
- `backend/data/bibleroot-foundation-v1/canon.json`
- `backend/data/bibleroot-foundation-v1/dataset-manifest.json`
- `backend/data/bibleroot-foundation-v1/edition.json`
- `backend/data/bibleroot-foundation-v1/IMPORT-NOTES.md`
- `backend/data/bibleroot-foundation-v1/phrases.json`
- `backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt`
- `backend/data/bibleroot-foundation-v1/RIGHTS.md`
- `backend/data/bibleroot-foundation-v1/source-metadata.json`
- `backend/data/bibleroot-foundation-v1/verses.json`
- `backend/db/migrations/015_create_bibleroot_foundation.sql`
- `backend/package.json`
- `backend/src/app.ts`
- `backend/src/bibleroot/foundation.ts`
- `backend/src/routes/bibleroot.ts`
- `backend/src/scripts/import-bibleroot-foundation.ts`
- `backend/src/scripts/prepare-bibleroot-foundation.ts`
- `backend/src/services/bibleroot-store.ts`
- `backend/test/bibleroot-foundation.test.ts`
- `bibleroot.html`
- `bibleroot-passage.html`
- `docs/api/BIBLEROOT-FOUNDATION-API.md`
- `docs/architecture/BIBLEROOT-CITATION-IDENTITY-CONTRACT.md`
- `docs/architecture/BIBLEROOT-FOUNDATION-ARCHITECTURE.md`
- `docs/build/BIBLEROOT-FOUNDATION-BROWSER-EVIDENCE.md`
- `docs/build/BIBLEROOT-FOUNDATION-STATE.md`
- `docs/sources/BIBLEROOT-KJV-SOURCE.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260730-BIBLEROOT-FOUNDATION-V1.md`
- `ROOT-MANIFEST.json`
- `sourceroot.html`
- `sourceroot-search.html`
- `verification/bibleroot-foundation.test.cjs`
- `verification/bibleroot-foundation-genesis-1-desktop.png`
- `verification/bibleroot-foundation-home-desktop.png`
- `verification/bibleroot-foundation-john-1-desktop.png`
- `verification/bibleroot-foundation-passage-mobile.png`
- `verification/bibleroot-foundation-provenance-desktop.png`
- `verification/bibleroot-foundation-switch-roots-desktop.png`
- `VERIFY-BIBLEROOT-FOUNDATION.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- Existing migrations 001â€“014 and SourceRoot `imported_bundles`/`sources`.
- Existing Express route/service and `sourceroot_test` conventions.
- Released shared user menu and Root switcher.
- Project Gutenberg eBook 10 catalog, artifact, and license policy.

## Required behavior

- One explicit 66-book canon and one edition identity.
- Four populated chapters totaling 110 exact source verses.
- Stable reference/text/passsage/phrase identities and deterministic parsing.
- Transactional, idempotent `sourceroot_test` importer.
- Read-only `/api/v1/bibleroot` routes.
- Responsive home and passage pages with exact provenance and error states.
- BibleRoot shared-switcher current state and accurate unified-search disclosure.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md`, especially live APIs,
shared navigation, URL/history state, source provenance, accessibility,
responsive behavior, and the prohibition on static fallback knowledge data.

## Non-goals

Authentication, write APIs, commentary authoring, interpretation, original
languages, unified-search indexing, cross-Root semantic claims, full-Bible
text import, modern copyrighted translations, installers, packages, and Git
operations.

## Dependencies

PostgreSQL `sourceroot_test`, Node.js, the backend on port 3000, the frontend
on port 8010, and the two released shared-navigation checkpoints.

## Risks

Source checksum drift, verse-boundary parsing errors, rights overstatement,
unstable IDs, transaction leakage, stale frontend/backend processes,
navigation regressions, and mobile overflow.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Source bytes/hash, normalized hash, 66 books, four chapters, 110 verses,
   nine phrases, and every phrase offset validate exactly.
2. Migration, importer idempotency/rollback, read-only APIs, parser errors,
   frontend contracts, shared navigation, browser evidence, and preservation
   checks pass with zero warnings and zero failures.

## Required verifier

- `VERIFY-BIBLEROOT-FOUNDATION.ps1`
- `VERIFY-ROOT-REPOSITORY.ps1`

## Manual browser checks

At 1280Ã—720 and 390Ã—844, verify home, all four featured links, Genesis and
John passages, stable anchors, provenance, malformed/unavailable states,
refresh/back/forward behavior, both shared menus, zero console errors or
attributable warnings, and zero horizontal overflow.

## Live API checks

Against `sourceroot_test` on port 3000, verify health, editions, books,
chapter/single/range passage, verse, phrase, malformed, unavailable, and
read-only behavior. No other database may be mutated.

## Required output

Migration 015, versioned dataset and raw source, preparation/import tooling,
service/routes/tests, two customer pages and shared integration, six bounded
documents, six current screenshots, the final verifier, and the completed
stage record.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-30T12:16:55.3606768-05:00
- Verification skipped: False

### Verifier results

- VERIFY-BIBLEROOT-FOUNDATION.ps1 -> exit 0
- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0

### Changed files

- `assets/css/bibleroot.css`
- `assets/js/bibleroot-api.js`
- `assets/js/bibleroot-home.js`
- `assets/js/bibleroot-passage.js`
- `assets/js/sourceroot-root-switcher.js`
- `backend/data/bibleroot-foundation-v1/canon.json`
- `backend/data/bibleroot-foundation-v1/dataset-manifest.json`
- `backend/data/bibleroot-foundation-v1/edition.json`
- `backend/data/bibleroot-foundation-v1/IMPORT-NOTES.md`
- `backend/data/bibleroot-foundation-v1/phrases.json`
- `backend/data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt`
- `backend/data/bibleroot-foundation-v1/RIGHTS.md`
- `backend/data/bibleroot-foundation-v1/source-metadata.json`
- `backend/data/bibleroot-foundation-v1/verses.json`
- `backend/db/migrations/015_create_bibleroot_foundation.sql`
- `backend/package.json`
- `backend/src/app.ts`
- `backend/src/bibleroot/foundation.ts`
- `backend/src/routes/bibleroot.ts`
- `backend/src/scripts/import-bibleroot-foundation.ts`
- `backend/src/scripts/prepare-bibleroot-foundation.ts`
- `backend/src/services/bibleroot-store.ts`
- `backend/test/bibleroot-foundation.test.ts`
- `bibleroot.html`
- `bibleroot-passage.html`
- `docs/api/BIBLEROOT-FOUNDATION-API.md`
- `docs/architecture/BIBLEROOT-CITATION-IDENTITY-CONTRACT.md`
- `docs/architecture/BIBLEROOT-FOUNDATION-ARCHITECTURE.md`
- `docs/build/BIBLEROOT-FOUNDATION-BROWSER-EVIDENCE.md`
- `docs/build/BIBLEROOT-FOUNDATION-STATE.md`
- `docs/sources/BIBLEROOT-KJV-SOURCE.md`
- `docs/stages/completed/20260730-BIBLEROOT-FOUNDATION-V1.md`
- `ROOT-MANIFEST.json`
- `sourceroot.html`
- `sourceroot-search.html`
- `VERIFY-BIBLEROOT-FOUNDATION.ps1`

### Unresolved manual checks

- None reported

### Completion notes

BibleRoot foundation alpha completed with verified Project Gutenberg eBook 10 source identity, migration 015, read-only APIs, customer pages, shared navigation, browser evidence, and zero-warning verification.
