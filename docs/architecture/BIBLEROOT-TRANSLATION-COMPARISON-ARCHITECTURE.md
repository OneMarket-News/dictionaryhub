# BibleRoot Translation Comparison v1 architecture

## Boundary

BibleRoot Translation Comparison v1 is a read-only, source-verifiable wording
comparison for Genesis 1, Psalm 23, Ecclesiastes 3, and John 1. The 110
canonical verse identities come from BibleRoot Foundation v1. The feature adds
no commentary, translation-quality ranking, theological conclusion, semantic
score, translator-intent claim, gloss, or word-level original-language
alignment.

## Existing-schema diagnosis and migration decision

Migration 015 already separates the required concepts:

- `bibleroot_editions` stores multiple edition identities and dataset versions.
- `bibleroot_verse_texts` has one edition text per
  `(canonical_reference_id, edition_id)` and therefore supports multiple
  translations without duplicated comparison rows.
- `bibleroot_source_publications` and `bibleroot_source_artifacts` preserve
  publication/artifact identity, exact URL, retrieval time, byte length,
  SHA-256, rights status, territorial limitation, and parsing rules.
- `bibleroot_canonical_verses` supplies stable shared verse identity.

Migration 016 adds component-level artifact rights and maps original-language
source verses to those same canonical verse IDs. Nothing in migrations 015 or
016 limits English verse text to KJV. The existing passage service accepts an
edition ID and joins verse text through canonical identity. The prior frontend
defaulted to KJV but did not impose a database constraint. Consequently,
migration 017 would duplicate existing concepts and is not created.

Comparison is derived at read time by joining selected editions through
canonical verse identity. No redundant comparison table or interpretation
record exists.

## Edition and source selection

The released KJV record remains owned by `bibleroot-foundation-v1`; no KJV
source, edition, or verse row is copied or rewritten. Three additional exact
eBible.org USFM archives were accepted:

| Edition | Edition identity | Exact artifact URL | Rights | Territory note |
|---|---|---|---|---|
| American Standard Version | Standard Edition, 1901; source files 2026-06-11 | `https://ebible.org/Scriptures/eng-asv_usfm.zip` | Public domain | eBible.org status recorded for the U.S.; local law must be checked elsewhere. |
| World English Bible | 2020 stable text, 66-book Protestant edition; source files 2026-07-24 | `https://ebible.org/Scriptures/engwebp_usfm.zip` | Public-domain dedication | No copyright territory restriction asserted; the name remains an eBible.org trademark for faithful copies. |
| Young's Literal Translation | Robert Young, 1898 edition; eBible edition identity 2019-10-20 | `https://ebible.org/Scriptures/engylt_usfm.zip` | Public domain | Work published in 1898; local law must be checked where terms differ. |

The exact identities, retrieval timestamp, byte lengths, SHA-256 values, Git
no-filter blobs, and captured HTML rights/identity pages are in
`source-metadata.json`, `rights-metadata.json`, `hashes.json`, and
`dataset-manifest.json`. Raw and source-doc files are protected by the
repository `.gitattributes` `-text` rules.

## Deterministic preparation and canonical mapping

The preparation command is:

```text
npm.cmd run bibleroot:translations:prepare
```

It validates each raw archive before reading it, extracts only `GEN`, `PSA`,
`ECC`, and `JHN`, selects chapters 1, 23, 3, and 1 respectively, removes USFM
structure, word attributes, footnotes, and cross-references mechanically, and
writes separate normalized JSON. It never normalizes raw data in place.

Each parsed `(book code, chapter, verse)` is looked up in the released
Foundation verse file and receives that record's exact canonical reference ID.
Preparation rejects missing, duplicate, extra, split, merged, or renumbered
positions. Each edition must contain 4 books, 4 populated chapters, and 110
verses. The three new editions therefore create 330 verse texts; together with
the unchanged KJV there are 440 display positions. Content hashes include the
canonical ID, edition ID, and exact display text.

Running preparation twice produces byte-identical normalized files and hashes.
Normal import, test execution after preparation, server startup, and browser
runtime use no network.

## Import and idempotency

The importer validates the full accepted dataset before connecting. Its direct
CLI permits only `sourceroot_test`. Local development provisioning must supply
the unforgeable authorization returned by the existing local-development
database guard. Production mode, unexpected database names, remote hosts, and
unauthorized development imports remain rejected.

Within one transaction, a missing dataset inserts three SourceRoot sources,
three source publications, three artifacts, three component rights records,
three editions, and 330 verse texts. An exact existing dataset is skipped. A
partial dataset is replaced only within the translation-comparison bundle;
rollback restores its prior state on failure. Foundation KJV, Original
Language, DictionaryRoot, HistoryRoot, authentication, and governance data are
not deleted or rewritten.

## Readiness and provisioning

Runtime readiness contract 1.1.0 adds
`BibleRoot.translationComparisonReady`. Its exact expected counts are one
dataset, three new editions, three source artifacts, three rights records, and
330 new verse texts. `foundationReady` and `originalLanguageReady` retain their
prior definitions. Overall BibleRoot readiness is not redefined to depend on
Translation Comparison, so it can honestly report Foundation and Original
Language ready while comparison reports `awaiting-data`.

`dev:provision` validates all four released dataset groups and provisions
Translation Comparison after Foundation and Original Language. Repeated runs
skip an exact comparison dataset and preserve the HistoryRoot fingerprint.

## API

- `GET /api/v1/bibleroot/translations` returns the bounded edition list,
  availability, edition/publication/artifact identities, source URLs,
  checksums, rights, territory, normalization notes, and dataset versions.
- `GET /api/v1/bibleroot/comparison?reference=Genesis%201&editions=<ids>`
  accepts only the four released chapters and up to four distinct accepted
  edition IDs. It returns canonical verse order, exact display text,
  missing-text state, source references, deterministic tokens, the mechanical
  comparison disclaimer, and an Original Language availability link.

Invalid references, editions, duplicates, and limits return structured 4xx
errors. An unprovisioned comparison dataset returns an honest 503
`awaiting-data` response. Both endpoints are read-only and expose no database
credentials, stack traces, or filesystem paths.

## Mechanical comparison

The engine reports exact equality, normalized-whitespace equality,
punctuation-only difference, and deterministic display tokens. The browser
always renders the unmodified exact text. Its optional highlight view compares
token positions mechanically and does not replace the original display text.
Every response/page carries this boundary:

> Highlights show textual differences only. They do not determine meaning,
> accuracy, doctrine, or translation quality.

## Provenance UI and responsive behavior

The dedicated `bibleroot-compare.html` page uses synchronized canonical verse
rows. Desktop uses bounded grid columns; mobile stacks edition cards without a
desktop-width table. Native form controls, live regions, a dialog, visible
source buttons, focusable links, and reduced-motion CSS preserve keyboard and
accessibility behavior. The source dialog distinguishes upstream artifact,
normalized dataset, database edition identity, and displayed verse text, using
precise evidence states rather than an unsupported generic “verified” label.

## Original Language connection and limitations

Each comparison verse reports whether an existing migration-016 mapping reaches
the same canonical verse ID and links to the released passage experience. This
is a passage/identity connection only. No source token is aligned to a
translation token. Full-Bible coverage, additional editions, verse-numbering
exceptions, notes, commentary provenance, interpretation, and alignment are
future separately governed work.
