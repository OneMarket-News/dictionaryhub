# SourceRoot Unified Search Browser Evidence

## Service identity

Verified on 2026-07-30 against the current working-tree frontend at
`http://localhost:8010` and the current working-tree backend at
`http://127.0.0.1:3000`. The backend was launched with `backend/.env.test`
and an explicit `PORT=3000`, so every live query used PostgreSQL database
`sourceroot_test`. HTTP probes returned 200 before browser acceptance.

The first `127.0.0.1` customer-page inspection retained a pre-change shared
navigation asset in the browser cache. Repeating the check at the equivalent
fresh local origin `localhost` loaded the current file bytes and confirmed
the new Root switchers and breadcrumbs. This was a browser-cache condition,
not a repository or server-content defect.

## Desktop acceptance

Viewport: `1280x720`.

- `bank`, filtered to DictionaryRoot: 3 canonical exact lexical-sense
  results, all linked to `concept-v2.html`, DictionaryRoot dataset
  `dictionaryroot-core-lexical-corpus-v1` version `1.0.0`.
- `Plymouth`, filtered to HistoryRoot: 357 canonical matches, with page-one
  records linked to `history-record-v1.html` or
  `history-context-review-v1.html`, HistoryRoot dataset
  `historyroot-plymouth-knowledge-dataset-v1` version `1.3.0`.
- `community`, both Roots: 130 total canonical results (7 DictionaryRoot,
  123 HistoryRoot), exact/contextual labels visible, both Root identities
  visible, query-overlap disclaimer visible, and zero duplicate result IDs
  in the API evidence.
- Result-type filter: selecting `lexical-sense` produced 7 of 7
  DictionaryRoot results and persisted
  `resultTypes=lexical-sense` in the URL.
- Pagination: Next moved from page 1 to page 2; Back restored page 1;
  Forward restored page 2; Refresh preserved page 2 and its 10 results.
- SourceRoot home search submitted `community` to the unified page and
  returned both Roots.
- DictionaryRoot Concept showed the SourceRoot product switcher,
  `SourceRoot / DictionaryRoot / Concept / community` breadcrumb, and the
  user-directed HistoryRoot search with the sense-intent disclaimer.
- HistoryRoot Record showed the SourceRoot product switcher,
  `SourceRoot / HistoryRoot / Record` breadcrumb, and a required user-input
  DictionaryRoot lookup. Submitting `settlement` produced two filtered
  lexical-sense results; no sense was selected automatically.

Console errors: 0.

Attributable warnings: 0.

Horizontal overflow: 0 pixels.

Screenshot:
`verification/chunk11-unified-search-desktop.png` (447124 bytes).

## Mobile acceptance

Viewport: `390x844`.

- `community` returned 10 visible page-one results from the 130-result
  canonical set.
- Search, filters, pagination, and the mobile Root navigation remained
  visible and operable.
- The Root switcher used its bounded internal horizontal scroller (497-pixel
  content inside a 343-pixel control) without widening the page.
- DictionaryRoot Concept and HistoryRoot Record both retained their Root
  switchers, breadcrumbs, and contextual discovery panels.
- Reduced-motion CSS was present.

Console errors: 0.

Attributable warnings: 0.

Horizontal overflow: 0 pixels.

Screenshot:
`verification/chunk11-unified-search-mobile.png` (260247 bytes).

## Accepted interpretation boundary

The unified result cards and both contextual discovery panels state that
query overlap is not a verified cross-Root relationship. HistoryRoot requires
the customer to enter a term and DictionaryRoot returns possible lexical
senses only. No fallback result, static product corpus, automatic lexical
sense selection, or persisted semantic link was observed.
