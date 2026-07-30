# BibleRoot KJV Source Acquisition and Rights

## Selected source

- Provider: Project Gutenberg
- Catalog: `https://www.gutenberg.org/ebooks/10`
- Stable identifier: Project Gutenberg eBook 10
- Title: *The King James Version of the Bible*
- Official artifact:
  `https://www.gutenberg.org/files/10/10-0.txt`
- Local raw filename:
  `project-gutenberg-ebook-10-10-0.txt`
- Retrieval timestamp: `2026-07-30T16:37:08.5943420Z`
- Byte length: `4436268`
- SHA-256:
  `0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986`

The catalog records release date 1989-08-01, last update 2024-04-06, English
language, and “Public domain in the USA.” Project Gutenberg's license policy
explains that copyright status can differ outside the United States. The
record therefore uses `public-domain-usa` and tells users outside the USA to
check local law.

The exact acquired artifact, including the Project Gutenberg header and
license, is preserved unmodified in
`backend/data/bibleroot-foundation-v1/raw/`.

## Edition identity

BibleRoot identifies the translation as the King James Version but describes
the edition as the text supplied by Project Gutenberg eBook 10. It does not
claim that the electronic artifact is specifically the 1611 or 1769
publication edition.

Translation, publication, SourceRoot source record, downloaded artifact, and
BibleRoot edition each have separate stable identities.

## Normalization

The preparation script:

1. decodes the official artifact as UTF-8;
2. normalizes CRLF/CR line endings to LF for parsing;
3. locates exact source book headings;
4. extracts only Genesis 1, John 1, Psalm 23, and Ecclesiastes 3;
5. joins source-distribution line wrapping with one ASCII space;
6. preserves spelling, punctuation, capitalization, pronouns, and wording;
7. verifies chapter totals and contiguous verse sequences;
8. requires phrase occurrences to be exact and word-bounded.

The aggregate normalized-text material is each ordered edition-text ID, a tab,
and exact verse text, joined by LF. Its SHA-256 is:

`BD71CDBB98C44A9DBEC0A2B6D59E83CB93290FB04CFA1BAC5022E4F8B88818FF`

## Verified totals

- 66 book metadata records
- Genesis 1: 31 verses
- John 1: 51 verses
- Psalm 23: 6 verses
- Ecclesiastes 3: 22 verses
- Total: 110 verses
- Nine phrase targets
- Thirteen exact word-bounded phrase occurrences

No NIV, ESV, NLT, NKJV, modern commentary, proprietary notes, or proprietary
formatting was acquired or imported.
