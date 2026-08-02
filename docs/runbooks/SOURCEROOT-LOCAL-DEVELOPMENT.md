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
BibleRoot Translation Comparison v1.0.0, and BibleRoot Commentary and
Interpretation Provenance v1.0.0. It validates repository hashes
first, imports only missing or partial targets, skips exact targets, and
verifies that HistoryRoot is unchanged. Repeated successful runs do not
duplicate rows.

## Safety refusals

Provisioning refuses non-development mode, non-PostgreSQL URLs, remote hosts,
database names other than `sourceroot`, a non-loopback connected server,
missing migrations 013 through 017, migration 018, altered dataset files, and
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
- `/api/v1/bibleroot/commentaries`
- `/api/v1/bibleroot/commentary?reference=Genesis%201&works=br-commentary-work-mhc-complete,br-commentary-work-jfb`

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

Commentary preparation is explicit and offline after acquisition:

1. `npm.cmd run db:migrate`
2. `npm.cmd run bibleroot:commentary:prepare`
3. `npm.cmd run test:bibleroot:commentary`
4. `npm.cmd run dev:provision`
5. `npm.cmd run dev:status`
6. `npm.cmd run dev`
7. serve the repository frontend on port 5500
8. open `bibleroot-commentary.html` and perform browser verification

Expected commentary counts are two accepted works, 96 sections, 3,450 exact
source statements, 96 anchors, two source artifacts, two rights records, and 14
coverage-gap ranges. `commentaryProvenanceReady` is independent of the prior
BibleRoot fields. Verify both works across Genesis 1, Psalm 23, Ecclesiastes 3,
and John 1; source/rights dialogs; statement offsets; gaps; cross-layer links;
the non-endorsement and shared-placement notices; desktop 1280x720; mobile
390x844; no horizontal overflow; console output; keyboard focus; and genuine
API-offline/Retry behavior. No commentary text is embedded as a fallback.

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
# Cross-Root lexical evidence (Chunk 14A)

After the three released Roots and all BibleRoot layers are available:

1. Run `npm.cmd run db:migrate` from `backend/`.
2. Run `npm.cmd run cross-root:lexical-evidence:prepare` (offline and deterministic).
3. Run `npm.cmd run test:cross-root:lexical-evidence` and `npm.cmd run test:cross-root:frontend`.
4. Run `npm.cmd run dev:provision`; repeat it to confirm 6,568 unchanged records skip with zero duplicates.
5. Run `npm.cmd run dev:status` and confirm readiness contract 1.3.0 and `crossRootLinks.ready: true`.
6. Run `npm.cmd run dev` for the API on port 3000.
7. Serve the repository frontend on port 5500 without replacing an existing server.
8. Open `cross-root-links.html` through a canonical DictionaryRoot, HistoryRoot, or BibleRoot entry point and verify desktop/mobile evidence, unavailable/recovery behavior, focus, and zero console errors.

Production coverage is 1,568 resources, 2,233 links, and 2,765 evidence occurrences. Preparation and automated tests use committed inputs and `.env.test`; they never query the mutable development database. No credentials belong in output or documentation.

# Source-backed relationships (Chunk 14B)

After Chunk 14A has provisioned the shared resource registry:

1. Run `npm.cmd run db:migrate` from `backend/`; migration 019 is required and migration 020 must remain absent.
2. Run `npm.cmd run cross-root:relationships:prepare` twice and confirm byte-identical output.
3. Run `npm.cmd run test:cross-root:relationships` and `npm.cmd run test:cross-root:relationships:frontend`.
4. Run `npm.cmd run dev:provision` twice. The first run imports or repairs only the governed relationship dataset; the second skips its exact 323 records (one dataset, 143 assertions, 178 evidence records).
5. Run `npm.cmd run dev:status` and confirm readiness contract `1.4.0`, all prior capabilities ready, `crossRootLinks.ready: true`, and `crossRootRelationships.ready: true`.
6. Start the API with `npm.cmd run dev`, retain the existing frontend server, and open `cross-root-relationships.html`.

Production relationship coverage is 143 assertions, 178 evidence records, 101 distinct subjects, 76 distinct objects, 280 reused registry resources, zero additions, 22 causal assertions, 121 non-causal assertions, 143 same-Root assertions, and zero cross-Root semantic assertions. All are directly sourced, unreviewed, uncertain HistoryRoot records. The live endpoints are:

- `/api/v1/cross-root/relationships/coverage`
- `/api/v1/cross-root/relationships?page=1&pageSize=25`
- `/api/v1/cross-root/relationships?resourceId={canonicalPublicId}`
- `/api/v1/cross-root/relationships?relationshipFamily=causation&causal=true`
- `/api/v1/cross-root/relationships/{assertionId}`

The page contains no fallback assertions. API absence must produce an unavailable state and Retry control. Exact lexical links remain available through the separate Chunk 14A endpoints and never serve as semantic evidence. Registry reuse is not entity identity; association or sequence is not causation; and the released relationship remains an inspectable assertion rather than universal truth.
