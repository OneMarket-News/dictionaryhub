# SourceRoot local development

## Startup

From `backend/`:

1. Start local PostgreSQL.
2. Apply migrations with `npm.cmd run db:migrate`.
3. Provision released data with `npm.cmd run dev:provision`.
4. Start the API with `npm.cmd run dev`.
5. Serve the repository frontend on port 5500 (or the existing documented local port).
6. Inspect readiness with `npm.cmd run dev:status`.

`dev:provision` imports DictionaryRoot Core Lexical Corpus v1.0.0,
BibleRoot Foundation v1.0.0, BibleRoot Original Language Foundation v1.0.0,
and BibleRoot Translation Comparison v1.0.0. It validates repository hashes
first, imports only missing or partial targets, skips exact targets, and
verifies that HistoryRoot is unchanged. Repeated successful runs do not
duplicate rows.

## Safety refusals

Provisioning refuses non-development mode, non-PostgreSQL URLs, remote hosts,
database names other than `sourceroot`, a non-loopback connected server,
missing migrations 013 through 016, migration 017, altered dataset files, and
altered source hashes. It does not edit `.env`, print credentials, run during
normal startup, or target production/staging. Test-era import commands remain
restricted to `sourceroot_test`; do not spoof a database name to use them.

## Diagnosing readiness

`npm.cmd run dev:status` performs the same target and migration checks but is
read-only. It reports exact counts and the status `ready` or `awaiting-data` for
each Root. The frontend reads `GET /api/v1/runtime-readiness`; it does not infer
readiness from a static `Active` label.

For BibleRoot, verify:

- `/api/v1/bibleroot/editions`
- `/api/v1/bibleroot/books`
- `/api/v1/bibleroot/passages?reference=Genesis%201`
- `/api/v1/bibleroot/passages?reference=Psalm%2023`
- `/api/v1/bibleroot/passages?reference=John%201`
- `/api/v1/bibleroot/passages?reference=Ecclesiastes%203`
- `/api/v1/bibleroot/original-language/editions`
- `/api/v1/bibleroot/original-language/passages?reference=Genesis%201`
- `/api/v1/bibleroot/original-language/passages?reference=John%201`
- `/api/v1/bibleroot/translations`
- `/api/v1/bibleroot/comparison?reference=Genesis%201&editions=br-edition-kjv-pg10-2024,br-edition-asv-1901-ebible-20260611`

Translation Comparison readiness is separate from Foundation and Original
Language readiness. Before comparison provisioning,
`translationComparisonReady` is false while the earlier feature fields may
remain true. After provisioning, expect one comparison dataset, three new
editions, three source artifacts, three rights records, and 330 new verse
texts. Across KJV and the three new editions the UI exposes 440 positions over
110 canonical verses.

Open `bibleroot-compare.html` from the frontend server and verify Genesis 1,
Psalm 23, Ecclesiastes 3, and John 1. Check the source-and-rights dialog, the
mechanical highlight toggle and disclaimer, Original Language passage links,
desktop 1280×720 layout, mobile 390×844 stacking, horizontal overflow, and the
browser console. No verse text is embedded as an offline fallback.

For DictionaryRoot, inspect
`/api/v1/dictionaryroot/lexicon/evidence/coverage`; a ready corpus reports
`productionDatasetAvailable: true`.

## Reset boundary

There is no general-purpose development reset command in this checkpoint.
That omission is deliberate: deleting corpus data is destructive and could
cross product boundaries. If a target dataset is partial or invalid,
`dev:provision` transactionally replaces only that released dataset. Use the
existing separately governed removal workflow only where one is explicitly
documented; never delete HistoryRoot, auth, governance, or user data as a
shortcut.

Exact hashes are required because source identity, rights, provenance, stable
IDs, normalized text, and mapping evidence are part of the released product
contract. Semantically similar bytes are not interchangeable evidence.
