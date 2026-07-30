# BibleRoot Citation and Identity Contract

## Principles

Public identifiers are deterministic, lowercase, URL-safe, reversible, and
never derived from database row numbers. Canonical reference identity is
independent of edition text. Edition text identity resolves to one edition
and source artifact.

## Grammar

Tokens use lowercase ASCII letters and digits. Chapter and verse numeric
tokens are three digits.

| Identity | Grammar | Example |
| --- | --- | --- |
| Canon | `br-canon-{slug}` | `br-canon-kjv-66` |
| Book | `br-book-{book-code}` | `br-book-gen` |
| Chapter | `br-chapter-{book-code}-{ccc}` | `br-chapter-gen-001` |
| Canonical verse | `br-ref-{book-code}-{ccc}-{vvv}` | `br-ref-gen-001-001` |
| Edition text | `br-text-kjv-pg10-{book-code}-{ccc}-{vvv}` | `br-text-kjv-pg10-gen-001-001` |
| Whole passage | `br-passage-{book-code}-{ccc}` | `br-passage-gen-001` |
| Single-verse passage | `br-passage-{book-code}-{ccc}-{vvv}` | `br-passage-ps-023-004` |
| Range passage | `br-passage-{book-code}-{ccc}-{start}-{end}` | `br-passage-john-001-001-005` |
| Phrase | `br-phrase-{normalized-slug}` | `br-phrase-in-the-beginning` |
| Phrase occurrence | `br-occurrence-{phrase-slug}-{book-code}-{ccc}-{vvv}-{offset}` | `br-occurrence-in-the-beginning-gen-001-001-000` |
| Edition | `br-edition-{translation}-{source}-{version}` | `br-edition-kjv-pg10-2024` |
| Publication | `br-publication-{provider-item}` | `br-publication-project-gutenberg-ebook-10` |
| Artifact | `br-artifact-{provider-item-format-hash-prefix}` | `br-artifact-pg10-10-0-txt-sha256-0f1a83cb` |

The shared SourceRoot source ID is
`bibleroot-source-project-gutenberg-ebook-10`.

## Customer citations and deep links

Human citations combine the normalized reference and edition abbreviation:

- `Genesis 1:1 (KJV)`
- `John 1:1-5 (KJV)`
- `Psalm 23 (KJV)`

Stable passage link:

`bibleroot-passage.html?edition=br-edition-kjv-pg10-2024&reference=Genesis%201`

Stable verse anchor:

`#br-ref-gen-001-001`

## Reference parsing

The deterministic parser accepts full names, documented aliases, and machine
codes for:

- whole chapters;
- one verse;
- a contiguous same-chapter range.

Examples:

- `Genesis 1`
- `Genesis 1:1`
- `Gen 1:1`
- `gen 1:1`
- `John 1:1-5`
- `Psalm 23`
- `Ps 23:4`
- `Ecclesiastes 3:1-8`

Aliases normalize to the book display name. The parser never fuzzy-guesses.
It returns separate errors for malformed syntax, unknown book, invalid
chapter, invalid verse, reversed range, and a valid but unavailable chapter.

## Stability boundary

Adding an edition does not change `br-ref-*`. Adding a canon does not rewrite
book or verse identity. A new edition receives new `br-text-*` records while
resolving to the same canonical references.
