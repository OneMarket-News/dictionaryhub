# DictionaryRoot Lexical Evidence Architecture Contract

## Boundary

SourceRoot Chunk 10A adds a normalized, additive lexical-evidence model for
DictionaryRoot. It does not generate or claim a production dictionary corpus.
The only admitted dataset is
`dictionaryroot-lexical-evidence-architecture-fixture-v1`, a synthetic,
fixture-only architecture sample containing ten lemmas.

The existing Open English WordNet import, exact-meaning ranking, customer
bundle, SourceRoot registry routes, and HistoryRoot records remain
authoritative and unchanged.

## Normalized records

Migration `013_create_dictionaryroot_lexical_evidence.sql` adds twelve
lexical-evidence tables covering:

- datasets and source identity;
- lemmas, senses, and lemma-to-sense associations;
- source-specific definition claims;
- spelling, historical, inflected, and derived forms;
- separately reviewable etymology proposals and competitor relationships;
- reviewed source comparisons;
- structured source locators; and
- field-level provenance.

Stable text identifiers are public record identities. Foreign keys preserve
record ownership and prevent evidence from silently detaching from its
dataset, source, lemma, sense, or claim. Archive fields preserve additive read
compatibility without introducing a destructive customer workflow.

## Fixture and quality boundary

The deterministic fixture contains 5 sources, 10 lemmas, 16 senses, 22
definition claims, 10 lexical forms, 4 etymology proposals, 4 source
comparisons, 40 locators, and 72 field-provenance records. Its quality review
has zero blockers, orphans, duplicate identities, or unsupported claims.

The fixture exercises polysemy, part-of-speech grouping, historical and
spelling variants, inflected and derived families, technical senses,
source-specific wording, broader and substantially equivalent comparisons,
unresolved comparison, competing etymologies, uncertainty, HistoryRoot terms,
and a future BibleRoot term. These records demonstrate structure only; they
are not lexical authority or researched customer content.

Every origin proposal is qualified. Competing proposals remain separate.
Comparisons preserve reviewer identity and optional algorithmic suggestion
metadata but expose no authoritative similarity or truth score.

## Additive API

The following read-only routes extend the existing DictionaryRoot lexicon
mount:

| Route | Contract |
|---|---|
| `GET /dictionaryroot/lexicon/evidence/search` | Exact/prefix lexical-form search with bounded `page` and `limit`, stable ordering, totals, and explicit empty results |
| `GET /dictionaryroot/lexicon/evidence/lemmas/:lemmaId` | Lemma plus deterministically ordered senses |
| `GET /dictionaryroot/lexicon/evidence/senses/:senseId` | Sense detail with claims, forms, proposals, comparisons, locators, provenance, and sources |
| `GET /dictionaryroot/lexicon/evidence/objects/:subjectId/:resource` | Bounded resource inspection for claims, forms, etymologies, comparisons, locators, or provenance |

Unknown lemma or sense identities return 404. Unsupported resources and
malformed pagination return 400. A valid empty resource query returns
`{"total":0,"items":[]}`.

## Customer behavior

Home discovery combines the existing complete OEWN search with bounded
lexical-evidence results and identifies evidence pagination. Concept renders
senses grouped by part of speech and exposes separate sections for claims,
forms, etymologies, comparisons, locators, and field provenance. Missing
evidence families render explicit empty states.

The client never embeds fixture knowledge or falls back to static lexical
records. Existing URL state, browser history, global navigation, cross-page
links, OEWN attribution, loading/offline handling, and HistoryRoot behavior
remain protected.

## Determinism and import

Generation uses fixed records, insertion order, two-space JSON, LF
termination, and no timestamps or environment-derived values. Two independent
temporary generations must match each other and the three repository
artifacts by length, SHA-256, and exact bytes.

Import is restricted to `sourceroot_test` and the exact fixture identity.
Replacement occurs inside one transaction. Duplicate import produces the same
counts, and a failed replacement rolls back to the accepted fixture.

## Acceptance

Acceptance requires the 17 backend architecture checks, 8 targeted frontend
checks, zero-blocker deterministic artifacts, live desktop and 390-by-844
browser smoke, OEWN and HistoryRoot preservation, the Chunk 10A verifier,
root repository verification, and clean read-only working-tree/index
accounting. A live route failure is a blocker and must not be recorded as a
browser pass.
