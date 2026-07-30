# BibleRoot foundation import notes

The preparation script verifies the raw artifact byte length and SHA-256
before parsing. It identifies the four selected books by exact source
headings, parses numbered verse markers, and joins only source line wrapping
with a single space. No spelling, punctuation, capitalization, pronoun, or
wording modernization is performed.

Only Genesis 1, John 1, Psalm 23, and Ecclesiastes 3 are emitted. The
aggregate normalized-text hash is calculated over deterministically ordered
`editionTextId<TAB>exactText` lines. Phrase offsets are derived from exact
source text and validated again by the importer.

The importer is restricted to a database whose name is `sourceroot_test`. It
runs in a transaction, replaces only `bibleroot-foundation-v1`, and rolls
back completely on any error.
