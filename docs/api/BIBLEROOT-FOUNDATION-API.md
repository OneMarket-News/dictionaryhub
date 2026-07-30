# BibleRoot Foundation API

Base path: `/api/v1/bibleroot`

All routes are public read-only GET routes. No POST, PUT, PATCH, or DELETE
route exists for BibleRoot.

## Editions

`GET /api/v1/bibleroot/editions`

Returns deterministic edition records with translation, publication, shared
SourceRoot source, artifact filename/bytes/SHA-256, normalized text SHA-256,
rights status, territorial limitation, and provenance notes.

## Books

`GET /api/v1/bibleroot/books`

Returns 66 records in explicit canon order. Every record includes stable book
and machine codes, aliases, broad collection, chapter count, availability,
authority source, and canon scope.

## Passage

`GET /api/v1/bibleroot/passages?edition={edition-id}&reference={reference}`

The edition defaults to `br-edition-kjv-pg10-2024`. A response includes:

- stable passage ID and normalized reference;
- human citation and stable deep link;
- canonical reference IDs;
- exact ordered verse text and stable verse anchors;
- edition text IDs;
- verified phrase occurrences;
- edition, publication, source, artifact, rights, and hashes;
- explicit content-layer population status.

Examples:

- `reference=Genesis%201`
- `reference=Gen%201%3A1`
- `reference=John%201%3A1-5`
- `reference=Ps%2023%3A4`

## Verse

`GET /api/v1/bibleroot/verses/{canonical-reference-or-edition-text-id}`

Accepts either `br-ref-gen-001-001` or
`br-text-kjv-pg10-gen-001-001`. It returns exact text, human citation,
canonical and edition identity, source observation, phrase occurrences,
stable deep link, and edition provenance.

## Phrase

`GET /api/v1/bibleroot/phrases/{phrase-id}`

Returns the textual target and exact source-linked occurrences. The
`interpretationStatus` is `textual-anchor-only`.

## Errors

| Condition | HTTP | Code |
| --- | ---: | --- |
| Missing reference | 400 | `REFERENCE_REQUIRED` |
| Invalid syntax | 400 | `MALFORMED_REFERENCE` |
| Unknown book | 400 | `UNKNOWN_BOOK` |
| Invalid chapter | 400 | `INVALID_CHAPTER` |
| Invalid verse | 400 | `INVALID_VERSE` |
| Reversed range | 400 | `REVERSED_RANGE` |
| Valid unavailable passage | 404 | `PASSAGE_UNAVAILABLE` |
| Missing edition | 404 | `EDITION_NOT_FOUND` |
| Missing verse | 404 | `VERSE_NOT_FOUND` |
| Missing phrase | 404 | `PHRASE_NOT_FOUND` |

Unknown or write routes use the existing SourceRoot 404 contract.
