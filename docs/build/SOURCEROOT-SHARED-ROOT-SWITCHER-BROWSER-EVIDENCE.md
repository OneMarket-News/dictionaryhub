# SourceRoot Shared Root Switcher Browser Evidence

## Service and asset identity

Verified on 2026-07-30 against the current working-tree frontend at
`http://localhost:8010` and backend at `http://127.0.0.1:3000`.
Preflight and final HTTP probes returned 200. Browser checks used the
repository's current cache-busted switcher asset URLs.

The first generated DictionaryRoot header check at the previously used
`127.0.0.1:8010` origin retained its pre-patch navigation script in browser
cache. The static server response itself was current. Repeating the check at
the equivalent fresh `localhost:8010` origin loaded the working-tree bytes,
and final source references now include
`?v=shared-root-switcher-v1` to make this checkpoint explicit. All accepted
screenshots were recaptured after the final JavaScript and CSS changes.

Backend health: PASS (HTTP 200).

Frontend customer pages: PASS (HTTP 200).

## Desktop acceptance

Viewport: `1280x720`.

Desktop result: PASS.

- SourceRoot home rendered one switcher, identified SourceRoot Home as
  current, exposed all four canonical destinations, retained the shared GET
  search form, and rendered no old Root strip.
- Unified search rendered one switcher and identified Search All Roots as
  current. The `community` query retained both Root filters, returned 10 of
  130 live canonical results on page 1, displayed DictionaryRoot and
  HistoryRoot results, and kept pagination available. Next changed the URL to
  page 2, Back restored page 1, and Forward restored page 2 with ten results.
- DictionaryRoot Concept rendered one switcher and all nine current local
  navigation links, retained the
  `SourceRoot / DictionaryRoot / Concept / bank` breadcrumb, returned three
  live exact senses of `bank`, opened a selected meaning, and retained the
  contextual HistoryRoot discovery warning.
- HistoryRoot home rendered one switcher and visible Home, Explore, Timeline,
  Sources, and Knowledge Graph links at 1280px. It retained the
  `SourceRoot / HistoryRoot` breadcrumb and live dataset summary.
- HistoryRoot record detail loaded Ousamequin, retained the
  `SourceRoot / HistoryRoot / Record` breadcrumb, and retained the required
  DictionaryRoot possible-meaning form and modern-definition warning.
- No rendered `sr-root-nav`, old Root switcher strip, DictionaryRoot strip,
  HistoryRoot strip, or redundant HistoryRoot header family pill remained.
- Every open panel was fully inside the viewport. Every inspected document
  had zero duplicate IDs and zero horizontal overflow.

Outside click: PASS.

Escape and focus return: PASS.

Enter and Space: PASS.

The SourceRoot trigger opened with Enter and Space. Escape closed the panel,
updated `aria-expanded` to `false`, and restored focus to the trigger. An
outside click closed it. Pointer click opened the same component on
DictionaryRoot and HistoryRoot.

## Mobile acceptance

Viewport: `390x844`.

Mobile result: PASS.

- SourceRoot home, unified search, DictionaryRoot Concept, and HistoryRoot
  home each rendered exactly one readable `Switch Roots` trigger.
- Open panels remained 8px inside the viewport, current destinations and
  visible `Current` badges remained on screen, and destination rows measured
  at least 62px high.
- Unified search retained the `community` query, live results, filters,
  pagination state, and breadcrumb.
- DictionaryRoot retained its breadcrumb and all nine local navigation links
  through the existing Menu control.
- HistoryRoot retained its breadcrumb and all five local navigation links
  through the existing Menu control.
- A viewport-aware panel position fixed the initial 46px left-edge escape
  found during review. Border-box sizing and explicit mobile width fixed an
  existing 16px DictionaryRoot local-menu overflow observed only while that
  menu was open.
- Final open/closed Root menus and local menus produced zero horizontal
  overflow.

## Screenshots

- `verification/sourceroot-root-switcher-dictionaryroot-desktop-closed.png`
  (74491 bytes)
- `verification/sourceroot-root-switcher-dictionaryroot-desktop-open.png`
  (86361 bytes)
- `verification/sourceroot-root-switcher-historyroot-desktop-closed.png`
  (93300 bytes)
- `verification/sourceroot-root-switcher-historyroot-desktop-open.png`
  (101252 bytes)
- `verification/sourceroot-root-switcher-mobile-open.png`
  (39563 bytes)

## Console, overflow, and quality review

Console errors: 0.

Attributable console warnings: 0.

Horizontal overflow: 0.

Quality blockers: 0.

Review findings: 0 unresolved. The stale-origin asset, mobile switcher
position, HistoryRoot 1280px local-navigation visibility, and DictionaryRoot
mobile local-menu overflow were corrected and rechecked before acceptance.

Observations: the footer-level HistoryRoot/DictionaryRoot/Search product
family links remain intentional footer navigation; the removed redundant
pill was the separate HistoryRoot header pill.

Accepted limitations: this is a bounded interaction and responsive-layout
review, not full accessibility certification. Inert legacy strip selectors
remain in older product stylesheets so this navigation patch does not become
an unrelated CSS cleanup.

## Preservation boundary

Breadcrumbs, local navigation, contextual discovery, current-page indicators,
unified-search state, live API behavior, source identity, provenance, and
non-equivalence disclaimers remained present. The browser loaded no fallback
knowledge data. No backend, database, migration, corpus, package, installer,
accepted release ZIP, authentication, authorization, editorial, ranking, or
result-envelope change was used by this patch.
