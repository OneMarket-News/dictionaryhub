# DictionaryRoot Core Lexical Corpus v1 state

## Canonical identity

- Dataset ID: `dictionaryroot-core-lexical-corpus-v1`
- Version: `1.0.0`
- Database: `sourceroot_test`
- Schema boundary: migrations 001–014
- Production status: accepted
- Fixture installed in customer boundary: no
- Legacy DictionaryRoot lexicon writes: none
- Generic lexical graph nodes persisted: none

## Exact corpus accounting

| Object | Count |
|---|---:|
| Accepted sources | 17 |
| Canonical lemmas | 500 |
| Lexical senses | 1,014 |
| Definition claims | 1,145 |
| Forms | 325 |
| Etymology proposals | 143 |
| Source comparisons | 131 |
| Structured locators | 1,613 |
| Field-provenance records | 1,613 |
| Lexical relationships | 722 |
| Relationship-evidence records | 722 |
| Historical or obsolete senses | 144 |
| Technical or specialized senses | 52 |
| Uncertainty-bearing structures | 275 |

Quality blockers, orphan counts, duplicate identities, restricted-source
leakage, fixture leakage, and legacy writes are all zero. The unresolved
Webster/OEWN comparisons are deliberately preserved as reviewable uncertainty;
they are not artificial consensus definitions.

## Source method

OEWN 2025 is the modern sense and relationship spine. Webster 1913, Project
Gutenberg eBook 29765, supplies bounded public-domain historical wording and
qualified etymology proposals. Bounded English Wiktionary share-alike
statements preserve the required `homeland` record and a separately sourced
`island` etymology; their wording or paraphrase, lineage, locator, and access
date remain explicit. The `island` proposals remain mutually linked and
unresolved rather than reconciled. The full 17-source accepted registry is
retained for rights and acquisition accounting; sources without prepared
statements contribute no lexical claims.

Selection applies Unicode NFKC and whitespace normalization, mandatory
cross-Root seeds, polysemy, part-of-speech and technical strata, then stable
normalized-lemma and sense-ID ordering. It is not an alphabetical slice.
