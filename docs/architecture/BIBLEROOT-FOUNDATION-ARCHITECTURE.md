# BibleRoot Foundation Architecture

## Scope

BibleRoot Foundation v1 is a bounded SourceRoot customer experience. It adds
one explicit canon, one KJV edition identity, one source publication and
artifact, 66 book metadata records, four populated chapters, 110 exact verse
texts, and nine textual phrase targets.

It does not add commentary, historical or theological interpretation,
original-language analysis, authentication, write APIs, unified-search
indexing, or persisted semantic claims to DictionaryRoot or HistoryRoot.

## Existing SourceRoot primitives

Migration 015 reuses:

- `imported_bundles` for dataset identity and replacement scope;
- `sources` for the shared SourceRoot source registry;
- the existing migration runner, PostgreSQL pool, Express app, and common API
  error envelope.

It does not create a second general-purpose source registry and does not add
Bible records to legacy DictionaryRoot lexicon or generic graph tables.

## BibleRoot tables

Migration `backend/db/migrations/015_create_bibleroot_foundation.sql` creates:

- `bibleroot_canons`
- `bibleroot_books`
- `bibleroot_canon_books`
- `bibleroot_source_publications`
- `bibleroot_source_artifacts`
- `bibleroot_editions`
- `bibleroot_chapters`
- `bibleroot_canonical_verses`
- `bibleroot_verse_texts`
- `bibleroot_phrases`
- `bibleroot_phrase_occurrences`

Every BibleRoot table is tied to `bibleroot-foundation-v1`. Foreign keys,
unique constraints, checks, and lookup indexes protect stable identity,
ordering, provenance linkage, and exact occurrence offsets.

## Structural content layers

| Layer | Foundation state |
| --- | --- |
| Biblical text | Populated |
| Canon identity | Populated |
| Edition identity | Populated |
| Publication/artifact identity | Populated |
| Neutral source observation | Populated |
| Commentary claim | Not populated |
| Historical interpretation | Not populated |
| Theological perspective | Not populated |
| SourceRoot project inference | Not populated |

The API exposes this state explicitly. Phrase occurrences are character spans
in edition text; they are not interpretations.

## Dataset and import flow

1. The official Project Gutenberg UTF-8 artifact is preserved unmodified.
2. The preparation script validates its byte length and SHA-256.
3. Exact book headings isolate the four approved source blocks.
4. Verse markers are parsed; only source line wrapping becomes one space.
5. Counts, verse sequences, stable IDs, and word-bounded phrase spans are
   validated.
6. Generated JSON files receive individual checksums and the ordered selected
   text receives an aggregate hash.
7. The importer refuses every database except `sourceroot_test`.
8. A transaction replaces only the `bibleroot-foundation-v1` bundle and
   inserts shared-source plus Bible-specific records.
9. Any error rolls back the entire replacement. Repeating the import produces
   the same resulting state.

## Customer flow

`bibleroot.html` loads edition/source identity from the live read-only API and
links the four populated chapters. `bibleroot-passage.html` stores reference
and edition in the URL, fetches exact text, renders stable verse anchors,
marks verified phrase spans, exposes provenance, and distinguishes malformed,
unavailable, and backend-offline states without fallback text.

Both pages reuse the released shared user menu and Root switcher. BibleRoot is
registered once in the shared registry and is detected as current on both
customer pages.

## Accepted limitations

- Only Genesis 1, John 1, Psalm 23, and Ecclesiastes 3 contain verse text.
- The explicit 66-book order describes the selected KJV source and is not
  presented as the only Christian canon.
- BibleRoot is not a unified-search provider in this stage.
- Commentary, interpretation, original languages, and full-corpus expansion
  are future layers.
