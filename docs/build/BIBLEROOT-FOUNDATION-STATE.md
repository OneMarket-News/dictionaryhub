# BibleRoot Foundation Build State

Status: acceptance-ready foundation alpha

## Implemented

- Migration 015 only; migration 016 is absent.
- SourceRoot-linked canon, book, publication, artifact, edition, chapter,
  canonical verse, edition text, phrase, and occurrence structures.
- Project Gutenberg eBook 10 raw artifact and exact acquisition record.
- Dataset `bibleroot-foundation-v1` version `1.0.0`.
- Canon `br-canon-kjv-66`.
- Edition `br-edition-kjv-pg10-2024`.
- 66 ordered book metadata records.
- Four chapters and 110 exact KJV verses.
- Nine phrase targets and thirteen exact word-bounded occurrences.
- Deterministic preparation, checksum validation, stable-ID validation,
  `sourceroot_test` guard, transactional rollback, and idempotent replacement.
- Read-only editions, books, passages, verses, and phrases APIs.
- Responsive BibleRoot home and passage pages with URL/history state, stable
  anchors, provenance, rights, loading, malformed, unavailable, retry, and
  backend-offline behavior.
- Shared Sign in and Switch Roots integration.
- BibleRoot current-state detection.
- SourceRoot family listing and unified-search indexing disclosure.

## Verification snapshot

- Backend BibleRoot contract: 28 pass, 0 fail.
- Frontend BibleRoot contract: 25 pass, 0 fail.
- Shared user menu: 42 pass, 0 fail.
- Shared Root switcher: 28 pass, 0 fail.
- Chunk 11 unified navigation: 12 pass, 0 fail.
- TypeScript typecheck: pass.
- Browser desktop 1280×720: pass.
- Browser mobile 390×844: pass.
- Browser console errors: 0.
- Attributable browser warnings: 0.
- Horizontal overflow: 0.
- Quality blockers: 0.
- Unresolved review findings: 0.

## Quality review

One phrase-boundary finding was resolved during browser review: the target
“Let there be light” initially matched inside “lights.” Preparation now
requires non-alphanumeric boundaries and the dataset was regenerated,
reimported, and reverified.

One hidden-state CSS finding was resolved during screenshot review: an
explicit flex display kept the loading panel visible after `hidden` was set.
`.br-page [hidden]` now enforces non-rendering, and screenshots were
recaptured.

## Accepted limitations

- Text scope is four chapters, not a complete Bible.
- One explicitly scoped 66-book KJV-source canon is modeled.
- BibleRoot is not indexed by unified search.
- Commentary, historical interpretation, theological perspectives,
  SourceRoot inference, and original-language layers are not populated.
- Rights status is stated for the USA with an outside-USA limitation.

## Preservation

The importer replaces only `bibleroot-foundation-v1`. Backend tests compare a
fingerprint of unrelated bundles and DictionaryRoot/HistoryRoot table counts
before and after repeated import and rollback. Existing live unified search
was browser-verified after the accepted DictionaryRoot and HistoryRoot test
fixtures were restored.
