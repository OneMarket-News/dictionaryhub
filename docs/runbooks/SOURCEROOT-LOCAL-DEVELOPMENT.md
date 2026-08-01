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
BibleRoot Foundation v1.0.0, and BibleRoot Original Language Foundation
v1.0.0. It validates repository hashes first, imports only missing or partial
targets, skips exact targets, and verifies that HistoryRoot is unchanged.
Repeated successful runs do not duplicate rows.

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
