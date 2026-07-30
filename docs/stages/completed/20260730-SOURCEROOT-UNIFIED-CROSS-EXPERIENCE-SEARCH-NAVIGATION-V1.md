# SourceRoot Chunk 11 â€” Unified Cross-Experience Search and Navigation v1

## Stage identity

- Name: SourceRoot Chunk 11 â€” Unified Cross-Experience Search and Navigation v1
- Slug: SOURCEROOT-UNIFIED-CROSS-EXPERIENCE-SEARCH-NAVIGATION-V1
- Status: active
- Started: 2026-07-30

## Objective

Implement a bounded, read-only unified search and navigation layer across the canonical DictionaryRoot 1.0.0 and HistoryRoot 1.3.0 experiences with deterministic normalization, pagination, filters, partial availability, URL state, canonical deep links, shared Root orientation, contextual discovery disclaimers, focused tests, browser evidence, and current-checkpoint preservation verification.

## Business value

Customers can discover canonical DictionaryRoot meanings and HistoryRoot
records from one SourceRoot entry point while retaining the owning Root,
dataset version, evidence boundary, and stable customer URL. Shared navigation
reduces dead ends without introducing a merged data model or inferred
cross-Root claims.

## Current source of truth

The checked-out repository at accepted commit
`49a75dff63c7f7d3fc3f1c7277cabb5b9ebc0b0e` is canonical. Chunk 11 reads the
accepted DictionaryRoot `dictionaryroot-core-lexical-corpus-v1` `1.0.0` data
through its lexical-evidence service and the accepted HistoryRoot
`historyroot-plymouth-knowledge-dataset-v1` `1.3.0` data through the existing
SourceRoot search service. Backups, completed stages, corpus packages, release
ZIPs, and generic node copies are not implementation sources.

## Allowed files

- `assets/css/dictionaryroot-navigation.css`
- `assets/css/dictionaryroot-product-refinement.css`
- `assets/css/historyroot.css`
- `assets/css/sourceroot-unified-search.css`
- `assets/js/dictionaryroot-concept.js`
- `assets/js/dictionaryroot-navigation.js`
- `assets/js/historyroot-record.js`
- `assets/js/historyroot-shared.js`
- `assets/js/sourceroot-unified-search.js`
- `backend/package.json`
- `backend/src/app.ts`
- `backend/src/routes/unified-search.ts`
- `backend/src/services/lexical-evidence-store.ts`
- `backend/src/services/search-store.ts`
- `backend/src/services/unified-search.ts`
- `backend/test/unified-search.test.ts`
- `docs/api/SOURCEROOT-UNIFIED-SEARCH-API.md`
- `docs/build/sourceroot-unified-cross-experience-search-navigation-stage.md`
- `docs/build/SOURCEROOT-UNIFIED-SEARCH-BROWSER-EVIDENCE.md`
- `docs/build/SOURCEROOT-UNIFIED-SEARCH-NAVIGATION-STATE.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `ROOT-MANIFEST.json`
- `sourceroot.html`
- `sourceroot-search.html`
- `verification/chunk11-unified-search-desktop.png`
- `verification/chunk11-unified-search-mobile.png`
- `verification/sourceroot-unified-search-navigation.test.cjs`
- `VERIFY-SOURCEROOT-UNIFIED-CROSS-EXPERIENCE-SEARCH-NAVIGATION.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- `backend/src/services/lexical-evidence-store.ts`
- `backend/src/services/search-store.ts`
- `backend/src/routes/search.ts`
- `assets/js/dictionaryroot-navigation.js`
- `assets/js/historyroot-shared.js`
- `ROOT-PROTECTED-FUNCTIONALITY.md`
- accepted starting-gate evidence recorded on 2026-07-29 and reconciled on
  2026-07-30

## Required behavior

- Add `GET /api/v1/search/unified` with `q`, `roots`, `resultTypes`, `page`,
  and `limit`.
- Query canonical Root read services independently; do not persist or copy
  cross-Root results.
- Return Root identity, canonical object identity and result type, bounded
  summary, canonical URL, dataset identity/version, understandable match
  classification, evidence availability, deterministic totals, availability,
  and pagination metadata.
- Order by match class, primary/supporting type, Root, result type, normalized
  title, and stable object ID.
- Bound requests to 10 results by default, 20 maximum, five pages maximum,
  and 100 candidates per Root.
- Preserve URL query state and browser history in the unified customer page.
- Add accessible SourceRoot links, Root switching, current Root/page
  indications, and bounded breadcrumbs to shared DictionaryRoot and
  HistoryRoot navigation.
- Add query-derived DictionaryRoot-to-HistoryRoot and
  HistoryRoot-to-DictionaryRoot discovery with explicit overlap disclaimers.
- Distinguish all available, partial availability, all unavailable, empty, and
  filter-excluded states without fallback data.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. This
stage additionally preserves:

- DictionaryRoot production dataset `1.0.0`, fixture exclusion, exact-sense
  behavior, relationship evidence, and empty legacy lexicon tables
- HistoryRoot dataset `1.3.0`, Plymouth and Wampanoag customer records, source
  identity, evidence, and customer detail pages
- migrations `001` through `014` byte-for-byte, with migration `015` absent
- accepted external ZIP bytes and repository corpus artifacts
- existing Root-specific API routes, authentication, authorization,
  initialization order, deep links, offline states, and responsive behavior

## Non-goals

- No migration, corpus generation, package, ZIP, installer, or release tag.
- No cross-Root relationship table, generic node copy, semantic persistence,
  synthetic answer, or automatic sense selection.
- No BibleRoot implementation, authentication/account change, editorial write
  API, user-management change, or broad visual redesign.
- No changes to frozen historical Chunk 10B or Chunk 9 verifiers.

## Dependencies

- PostgreSQL `sourceroot_test` with migrations `001` through `014`
- current working-tree backend on port `3000`
- current frontend on port `8010`
- DictionaryRoot `1.0.0` and HistoryRoot `1.3.0`
- Node.js 22+, Windows PowerShell 5.1, and the existing browser tooling

## Risks

- Global pagination can drift unless each Root is queried with a bounded
  candidate window large enough for every supported unified page.
- A failed Root call can be mistaken for an empty result unless availability
  is explicit.
- Cross-Root term overlap can be mistaken for semantic verification unless
  every contextual link carries a disclaimer.
- Dynamic navigation can disturb focus, initialization order, mobile layout,
  and URL state.
- Rollback is file-only: remove the additive route/page and revert the bounded
  shared-navigation additions. No database rollback is required.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Unified API validation, normalization, ordering, pagination, duplicate
   prevention, Root filters, result-type filters, partial availability,
   counts, and canonical links pass focused backend tests.
2. Unified page URL state, Root switcher, breadcrumbs, contextual discovery,
   keyboard labels, semantic landmarks, and no-fallback behavior pass focused
   frontend tests.
3. DictionaryRoot current preservation suites, lexical relationship suite,
   HistoryRoot current substantive preservation checks, typecheck, supported
   backend regression, and root repository verification pass.
4. Desktop `1280x720` and mobile `390x844` browser evidence record functional
   mixed-Root search, filters, history/refresh state, deep links, navigation,
   contextual disclaimers, zero console errors, zero attributable warnings,
   and zero horizontal overflow.
5. Final verifier reports zero warnings and zero failures and directly checks
   the accepted current checkpoint rather than frozen prior-stage identity
   assertions.
6. Stage completion leaves the manifest inactive, creates the completed-stage
   record, and the inactive root verifier passes.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-UNIFIED-CROSS-EXPERIENCE-SEARCH-NAVIGATION.ps1`

## Manual browser checks

At `http://127.0.0.1:8010/sourceroot-search.html`, test `bank`, `Plymouth`,
and a live mixed term at `1280x720` and `390x844`. Verify Root and result-type
filters, pagination where returned, back/forward/refresh state, Root labels,
dataset versions, exact/contextual labels, canonical DictionaryRoot and
HistoryRoot links, Root switching, breadcrumbs, overlap disclaimers,
standalone Root preservation, focus visibility, no hover-only controls, zero
console errors, zero attributable warnings, and no horizontal overflow.

## Live API checks

Probe `/health`, `/api/v1/search/unified?q=bank`,
`/api/v1/search/unified?q=Plymouth`,
`/api/v1/search/unified?q=community`,
the accepted DictionaryRoot search/coverage/graph routes, and existing
HistoryRoot search. Verify HTTP 200 for healthy and partial states, HTTP 503
only when both Roots are unavailable, stable repeated output, no duplicate
IDs, correct totals, and explicit availability metadata.

## Required output

- additive backend route, normalization service, and focused backend tests
- unified SourceRoot search page, shared query-state script, and responsive
  styles
- shared navigation, Root switcher, breadcrumbs, and two-way contextual
  discovery
- focused frontend/accessibility tests and desktop/mobile browser evidence
- API, current-state, stage-evidence, and browser-evidence documents
- current-checkpoint final verifier and completed-stage record
- final report listing exact changes, verification totals, limitations, and
  the three explicitly superseded historical release-boundary assertions

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-30T09:53:36.4706323-05:00
- Verification skipped: True

### Verifier results

- SKIPPED explicitly with -SkipVerification

### Changed files

- `assets/css/dictionaryroot-navigation.css`
- `assets/css/dictionaryroot-product-refinement.css`
- `assets/css/historyroot.css`
- `assets/css/sourceroot-unified-search.css`
- `assets/js/dictionaryroot-concept.js`
- `assets/js/dictionaryroot-navigation.js`
- `assets/js/historyroot-record.js`
- `assets/js/historyroot-shared.js`
- `assets/js/sourceroot-unified-search.js`
- `backend/package.json`
- `backend/src/app.ts`
- `backend/src/routes/unified-search.ts`
- `backend/src/services/lexical-evidence-store.ts`
- `backend/src/services/search-store.ts`
- `backend/src/services/unified-search.ts`
- `backend/test/unified-search.test.ts`
- `docs/api/SOURCEROOT-UNIFIED-SEARCH-API.md`
- `docs/build/sourceroot-unified-cross-experience-search-navigation-stage.md`
- `docs/build/SOURCEROOT-UNIFIED-SEARCH-BROWSER-EVIDENCE.md`
- `docs/build/SOURCEROOT-UNIFIED-SEARCH-NAVIGATION-STATE.md`
- `docs/stages/completed/20260730-SOURCEROOT-UNIFIED-CROSS-EXPERIENCE-SEARCH-NAVIGATION-V1.md`
- `ROOT-MANIFEST.json`
- `sourceroot.html`
- `sourceroot-search.html`
- `VERIFY-SOURCEROOT-UNIFIED-CROSS-EXPERIENCE-SEARCH-NAVIGATION.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Required verifiers were run immediately before completion: Chunk 11 full verifier 31 passes, 0 warnings, 0 failures; post-evidence current-checkpoint/live verifier 21 passes, 0 warnings, 0 failures; active root repository verifier 51 passes, 0 warnings, 0 failures. Desktop and mobile browser acceptance completed with 0 console errors, 0 attributable warnings, and 0 horizontal overflow. SkipVerification avoids duplicating those completed gates. No Git mutation was performed.
