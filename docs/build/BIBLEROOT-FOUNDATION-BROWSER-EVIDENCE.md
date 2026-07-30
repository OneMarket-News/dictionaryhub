# BibleRoot Foundation Browser Evidence

Date: 2026-07-30  
Frontend: `http://127.0.0.1:8010`  
Backend: `http://127.0.0.1:3000` using `sourceroot_test`

## Desktop — 1280 × 720

- Home HTTP 200; live edition record visible.
- Sign in precedes Switch Roots.
- BibleRoot is marked current.
- Four featured passages are present.
- Genesis 1: 31 ordered verses.
- John 1: 51 ordered verses.
- Psalm 23: 6 ordered verses.
- Ecclesiastes 3: 22 ordered verses.
- Genesis 1:1 stable anchor: `br-ref-gen-001-001`.
- Genesis 1:1 text matches the verified dataset.
- Exact phrase marks render; Genesis 1:14 has no false “Let there be light”
  substring anchor.
- Publication, artifact filename/bytes, raw SHA-256, normalized SHA-256,
  rights, and territorial limitation are visible.
- Malformed reference state is transparent.
- Valid unavailable reference state is transparent.
- Form navigation updates URL state.
- Back returns from Psalm 23 to John 1; forward returns to Psalm 23.
- Root and user menus close each other.
- Escape closes and returns focus.
- Outside click closes the Root switcher.
- BibleRoot appears from DictionaryRoot, HistoryRoot, and SourceRoot while
  each existing Root retains its current marker.
- Unified search returns live HistoryRoot results for `Plymouth` and live
  DictionaryRoot results for `bank`.
- Unified search states that BibleRoot text is not yet indexed.
- Console errors: 0.
- Attributable console warnings: 0.
- Horizontal overflow: 0.

## Mobile — 390 × 844

- Home and passage layouts are usable.
- 31 Genesis verses render.
- Verse number and text columns do not overlap.
- Long verse text wraps without element overflow.
- Reference input and breadcrumbs remain visible.
- Four featured links are at least 150 px tall.
- Sign in and Switch Roots are visible.
- BibleRoot is current.
- Root-switcher bounds: left 8, right 367, top 61, bottom 488.203125.
- User-menu bounds: left 8, right 367, top 61, bottom 413.515625.
- Both dropdowns are inside the 390 × 844 viewport.
- Console errors: 0.
- Attributable console warnings: 0.
- Horizontal overflow: 0.

## Screenshots

- `verification/bibleroot-foundation-home-desktop.png`
- `verification/bibleroot-foundation-genesis-1-desktop.png`
- `verification/bibleroot-foundation-john-1-desktop.png`
- `verification/bibleroot-foundation-switch-roots-desktop.png`
- `verification/bibleroot-foundation-provenance-desktop.png`
- `verification/bibleroot-foundation-passage-mobile.png`

All screenshots were captured from the current working tree and were visually
reviewed. Earlier loading-state captures were replaced after the hidden-state
CSS correction.
