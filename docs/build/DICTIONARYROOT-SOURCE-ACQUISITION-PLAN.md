# DictionaryRoot Source Acquisition Plan

## Rights-first rule

Public visibility is not permission. A source enters the production preparation
queue only when its edition, responsible publisher, stable acquisition
location, rights basis, permitted use, attribution, restrictions, machine
conditions, and locator strategy are recorded and independently reviewable.

No restricted modern definition, search-result snippet, access-control bypass,
AI-generated definition, unattributed word list, or silently incompatible
license is accepted as lexical evidence.

The canonical machine-readable registry is
`backend/data/dictionaryroot-corpus-scaling-acquisition-v1/candidate-sources.json`.
It contains every required field for each of 22 candidates.

## Candidate result

- Accepted reusable candidates: **17**
- Rejected or reference-only candidates: **5**
- Public-domain accepted candidates: **9**
- Open-license accepted candidates: **8**

Accepted category coverage (overlap is intentional):

| Category | Accepted count | Required |
|---|---:|---:|
| General lexical | 10 | 5 |
| Historical or etymological | 6 | 4 |
| Institutional or technical | 5 | 3 |
| Corpus, morphology, or lexical network | 10 | 3 |
| Multi-source comparison capable | 12 | 3 |

## Accepted source register

| ID | Source | Rights | Primary role |
|---|---|---|---|
| `century-dictionary-1889-1891` | Century Dictionary | Public domain | Historical/technical definitions and comparison |
| `conceptnet-5-8` | ConceptNet 5.8 | CC BY-SA 4.0 | Relationship review candidates |
| `dbnary-english` | DBnary English | Wiktionary share-alike lineage | Structured extraction aid |
| `english-wiktionary` | English Wiktionary | CC BY-SA 4.0/GFDL | Forms, labels, pronunciation, etymology |
| `johnson-dictionary-1755` | Johnson's Dictionary | Public domain | Independent historical comparison |
| `moby-thesaurus-ii` | MOBY Thesaurus II | Public domain dedication | Relationship discovery |
| `nasa-thesaurus-2012` | NASA Thesaurus | U.S. Government work | Aerospace/science terminology |
| `nist-csrc-glossary` | NIST CSRC Glossary | Government work, item review | Cybersecurity definitions |
| `nlm-mesh` | MeSH | NLM reuse terms | Biomedical terminology |
| `oewn-2025` | Open English WordNet 2025 | CC BY 4.0 | Modern sense spine |
| `princeton-wordnet-3-1` | Princeton WordNet 3.1 | WordNet license | Lineage/edition comparison |
| `roget-thesaurus-1911` | Roget's Thesaurus | Public domain | Semantic grouping review |
| `usda-nalt` | NAL Agricultural Thesaurus | CC0 1.0 | Agriculture terminology |
| `usgs-thesaurus` | USGS Thesaurus | U.S. Government work | Earth-science terminology |
| `webster-revised-unabridged-1913` | Webster 1913 | Public domain | Historical general dictionary |
| `weekley-etymological-1921` | Weekley Etymological Dictionary | Public domain | Qualified etymology proposals |
| `wikidata-lexemes` | Wikidata Lexemes | CC0 1.0 | Form identity and alignment |

Primary rights and access evidence includes the official
[OEWN downloads](https://en-word.net/downloads),
[Princeton WordNet license](https://wordnet.princeton.edu/license-and-commercial-use),
[Wiktionary copyright policy](https://en.wiktionary.org/wiki/Wiktionary:Copyrights),
[Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing),
[NASA Thesaurus](https://www.sti.nasa.gov/nasa-thesaurus/),
[NIST glossary](https://csrc.nist.gov/glossary),
[MeSH reuse terms](https://www.nlm.nih.gov/databases/download/terms_and_conditions_mesh.html),
[NALT policy](https://www.nal.usda.gov/web-policies-and-important-links),
and [USGS data licensing](https://www.usgs.gov/data-management/data-licensing).

Historical item evidence is pinned in the registry with Project Gutenberg,
Open Library, Internet Archive, Wikisource, or Library of Congress identifiers.
The future implementation must choose exact volumes and checksum their raw
files before parsing.

## Rejected and reference-only candidates

| ID | Rights class | Reason |
|---|---|---|
| `oed-online` | `restricted_reference_only` | Subscription/copyrighted content; link only |
| `merriam-webster-online` | `restricted_reference_only` | No corpus redistribution license |
| `etymonline` | `restricted_reference_only` | Copyrighted editorial synthesis |
| `unimorph-english` | `rejected_unknown_rights` | English dataset identity/license not pinned |
| `coca` | `rejected_unknown_rights` | Underlying text and bulk reuse rights unresolved |

These sources do not count toward the reusable threshold and cannot supply
production definitions. Restricted references may inform a human research
question without copying their wording into SourceRoot.

## Acquisition and locator rules

- Download versioned bulk files instead of scraping interactive services.
- Record source bytes, SHA-256, media type, retrieval time, and canonical URL.
- For lexical databases, use release plus stable synset/entity IDs.
- For RDF, record graph, subject, predicate, object, statement ID, and dump
  checksum.
- For XML, record file, stable UI/record ID, element path, and checksum.
- For historical scans, record archive ID, edition, volume, printed page,
  column, headword, sense ordinal, and page-image URL.
- For OCR, retain raw line ranges and require comparison with the page image.
- For web-only restricted references, retain only URL, title, publisher, and
  access date.

## License and lineage controls

Share-alike text must be isolated so its obligations are explicit and are not
silently imposed on unrelated source layers. Public-domain transcriptions must
be separated from Project Gutenberg trademarks and modern copyrighted
commentary. U.S. Government sources require item-level checks for incorporated
third-party material.

OEWN and Princeton WordNet are related editions. Wiktionary and DBnary are one
editorial lineage. Counts must report both raw source count and independent
lineage count so multi-source coverage never masquerades as corroboration.

## Quality review

Every acquired object must pass:

1. rights and access review;
2. stable identity and locator validation;
3. source-faithful transcription review;
4. lexical type and part-of-speech review;
5. sense alignment or explicit unresolved status;
6. label, chronology, etymology, and relationship evidence review;
7. independent-lineage and source-concentration review; and
8. deterministic generation and replacement-safe import checks.

An opaque similarity score may prioritize a queue. It cannot make the accepted
sense or source-comparison decision.
