# BibleRoot Original-Language Browser Evidence

## Session

- Date: 2026-08-01
- Frontend: `http://127.0.0.1:8010`
- Backend: live SourceRoot API on port 3000 using `sourceroot_test`
- Desktop viewport: 1280 x 720 (1265 CSS-pixel client width with scrollbar)
- Mobile viewport: 390 x 844 (375 CSS-pixel client width with scrollbar)
- Browser: Codex in-app Chromium session
- Static or cached fallback corpus: none

The browser session was started after migration 016 and the deterministic
13A importer had completed. Counts below came from the rendered DOM, not from
the JSON preparation files.

## Populated passage results

| Passage | Viewport | Direction | Source segments | Tokens | Native source IDs | Ambiguous badges | Mapping summary | Overflow / clipped controls / token overflow | Console warnings or errors |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | ---: |
| Genesis 1 | Desktop | RTL | 31 | 434 | 434 | 0 | 31 one-to-one | 0 / 0 / 0 | 0 |
| Psalm 23 | Desktop | RTL | 7 | 57 | 57 | 0 | 6 one-to-one; 1 omitted-or-untranslated title | 0 / 0 / 0 | 0 |
| Ecclesiastes 3 | Desktop | RTL | 22 | 273 | 273 | 0 | 22 one-to-one | 0 / 0 / 0 | 0 |
| John 1 | Desktop | LTR | 51 | 828 | 0 | 7 | 51 one-to-one | 0 / 0 / 0 | 0 |
| Genesis 1 | Mobile | RTL | 31 | 434 | 434 | 0 | 31 one-to-one | 0 / 0 / 0 | 0 |
| Psalm 23 | Mobile | RTL | 7 | 57 | 57 | 0 | 6 one-to-one; 1 omitted-or-untranslated title | 0 / 0 / 0 | 0 |

For all four chapters, the panel displayed source surface forms, lemma values,
morphology values, source-to-KJV mapping status, the pinned artifact filename,
byte length, SHA-256, attribution, and component-specific rights. The three
Hebrew panels each rendered six rights-component rows across their three OSHB
artifacts; the Greek panel rendered six distinct Nestle 1904 component rows.

The provenance view for Genesis 1:1 rendered seven Hebrew tokens, the single
source verse and six rights-component rows with no viewport overflow or
console output. BibleRoot home retained five passage links, the protected
heading/title, shared navigation, zero horizontal overflow, and zero clipped
controls.

## State and navigation checks

- Loading was directly observed on John 1 before data arrived: both the KJV
  passage and original-language panel reported `loading`, and the token count
  was zero until the live response rendered.
- With the backend stopped, a reload rendered the protected API-offline state,
  a retry control, and an explicit no-fallback message. The original-language
  panel remained hidden. The backend was restarted before the remaining checks.
- `Genesis 2` rendered the bounded `unavailable` state on mobile, hid the
  original-language panel, and produced no overflow or console output.
- `Genesis` rendered the malformed-reference guidance, hid the original-language
  panel, and produced no overflow or console output.
- The account control appeared once, opened, and exposed Sign in/workspace
  entries. The Root switcher appeared once and exposed SourceRoot,
  DictionaryRoot, and HistoryRoot.
- Submitting John 1 pushed the URL and rendered 828 tokens. Browser Back
  restored Genesis 1 and 434 tokens; Forward and Refresh restored John 1 and
  828 tokens. No console warning or error was recorded during the sequence.

Console errors: 0.
Console warnings: 0.
Unresolved browser checks: 0.

## Fresh screenshots

- `verification/bibleroot-original-language-genesis-1-desktop.png`
- `verification/bibleroot-original-language-psalm-23-desktop.png`
- `verification/bibleroot-original-language-ecclesiastes-3-desktop.png`
- `verification/bibleroot-original-language-john-1-desktop.png`
- `verification/bibleroot-original-language-genesis-1-mobile.png`
- `verification/bibleroot-original-language-psalm-23-mobile.png`
- `verification/bibleroot-original-language-unavailable-mobile.png`
- `verification/bibleroot-original-language-provenance-desktop.png`

The temporary viewport override was reset and all verification tabs were
finalized after the acceptance pass.
