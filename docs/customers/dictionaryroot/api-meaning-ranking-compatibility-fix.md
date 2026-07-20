# DictionaryRoot API Meaning-Ranking Compatibility Fix v1

## Purpose

Restore the public meaning-selection helpers required by the DictionaryRoot Knowledge Sphere and Concept Experience without removing the live Source Experience methods added to `dictionaryroot-api.js`.

## Regression

The Source Experience package installed a complete API client for source retrieval, source-linked assertions, source-linked relationships, and linked nodes. That replacement did not include four public helper functions already consumed by `dictionaryroot-graph.js` and `dictionaryroot-concept.js`:

- `preferredMeaningLabel`
- `meaningMatchRank`
- `exactMeaningResults`
- `rankMeaningResults`

The browser therefore reported `DictionaryRootApi.rankMeaningResults is not a function` when search results were rendered.

## Fix

The replacement `dictionaryroot-api.js` keeps all Source Experience API methods and restores the meaning-selection compatibility surface. Ranking now distinguishes:

1. Exact canonical title matches
2. Exact OEWN lemma or synonym matches
3. Prefix and phrase matches
4. Related substring and descriptive-text matches

When a searched word is an exact OEWN lemma but not the canonical first lemma, DictionaryRoot presents the searched lemma while retaining the canonical WordNet title for context.

## Files Changed

- `assets/js/dictionaryroot-api.js`
- `docs/customers/dictionaryroot/api-meaning-ranking-compatibility-fix.md`
- `VERIFY-DICTIONARYROOT-API-MEANING-RANKING-FIX.ps1`

No backend files are changed.

## Verification

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Josh\Documents\GitHub\dictionaryhub\VERIFY-DICTIONARYROOT-API-MEANING-RANKING-FIX.ps1"
```

After verification, open `graph-v2.html` and `concept-v2.html` and press **Ctrl+F5**.
