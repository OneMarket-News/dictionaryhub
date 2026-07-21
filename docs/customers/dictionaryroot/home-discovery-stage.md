# DictionaryRoot Home and Discovery Experience v1

## Purpose

DictionaryRoot now has complete exact-sense search, Concept, Knowledge Sphere, Sources, and History experiences. This stage turns those capabilities into a customer-facing entry point that explains the product immediately and guides users into connected exploration.

## Source-of-truth rule

This stage was built from the clean Git archive created after Complete-Sense Search and Lexical Coverage v1. Existing SourceRoot API contracts, complete-lemma ranking, bounded graph behavior, branding, source attribution, revision history, and URL context are preserved.

## Installed experience

`index.html` is the DictionaryRoot customer home page. It provides:

- a prominent live exact-meaning search;
- exact senses before related matches;
- complete live lexical coverage statistics;
- direct paths into Concept, Knowledge Sphere, Sources, and History;
- a live “one word, many ideas” demonstration using `value`;
- recent searches stored only in the current browser;
- an explanation of complete lexical search versus bounded graph visualization;
- shareable `?q=` home URLs and browser Back/Forward support;
- desktop, tablet, and mobile layouts;
- loading and API-offline states without fallback knowledge or coverage counts.

## Shared navigation changes

The shared navigation now includes **Home** as a first-class active page. The DictionaryRoot brand mark links to `index.html`. Context-aware links continue to carry meaning, node, source, and revision information between the four knowledge experiences.

## Live data

The home page reads:

- `/health` through the existing SourceRoot service;
- `/api/v1/dictionaryroot/lexicon/status` for live synset, lemma, relationship, source, release, and license information;
- `/api/v1/search` through the existing DictionaryRoot API client for exact and related meanings.

The displayed knowledge records and coverage counts are never substituted with static frontend fallback data.

## Acceptance

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\VERIFY-DICTIONARYROOT-HOME-DISCOVERY.ps1
```

Then manually verify desktop and mobile layout, exact-sense selection, experience links, Back/Forward behavior, shareable `?q=` URLs, recent searches, and SourceRoot-offline states.
