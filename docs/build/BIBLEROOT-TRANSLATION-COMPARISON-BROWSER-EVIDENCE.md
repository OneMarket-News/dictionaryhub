# BibleRoot Translation Comparison v1 browser evidence

Acceptance was performed on 2026-08-01 against the provisioned local
SourceRoot API (`127.0.0.1:3000`) and local frontend (`127.0.0.1:5500`).

## Live API and passage coverage

- `GET /api/v1/bibleroot/translations` returned ready state, dataset
  `bibleroot-translation-comparison-v1` version `1.0.0`, and KJV, ASV, WEB,
  and YLT in stable order.
- Genesis 1 returned 31 canonical rows, Psalm 23 returned 6, Ecclesiastes 3
  returned 22, and John 1 returned 51. Every row contained all four requested
  edition records and an available Original Language link.
- An unsupported Romans 8 request returned structured HTTP 404.
- The response contained deterministic textual comparison fields and the
  required disclaimer. It contained no semantic score, theology, translator
  intent, translation-quality, or commentary field.

## Desktop: 1280 x 720

- Browser inner viewport: 1280 x 720; document client width: 1265; document
  scroll width: 1265. There was no horizontal overflow.
- All four edition columns were visible in synchronized 294.5 px grid columns.
- Mechanical highlighting was enabled and 1,874 mechanically different token
  spans were visible across Genesis 1.
- The non-interpretive disclaimer, source-and-rights controls, dataset version,
  canonical verse labels, exact display text, and Original Language links were
  visible.
- The KJV source-and-rights dialog exposed publication, provider, original
  artifact filename and URL, retrieval time, byte length, SHA-256, rights
  statement, territorial limitation, dataset identity, normalized checksum,
  and normalization notes.
- Browser console errors: 0. Unexpected browser warnings: 0.

Evidence: `verification/bibleroot-translation-comparison-desktop.png`

## Mobile: 390 x 844

- Browser inner viewport: 390 x 844; document client width: 375; document
  scroll width: 375. There was no horizontal overflow.
- Four selected editions collapsed to one 353 px grid column; each first-row
  edition cell shared x=11 and width=353.
- The disclaimer, 31 Genesis 1 canonical rows, source-and-rights controls,
  and Original Language links remained available.
- The focused Update comparison button had a visible native focus outline.
- Reduced-motion behavior is implemented with `prefers-reduced-motion` and is
  covered by the focused frontend verifier.

Evidence: `verification/bibleroot-translation-comparison-mobile.png`

## Failure-state evidence

After the live checks, the API process was deliberately stopped while the
frontend remained available. Reloading the page produced the genuine
`BibleRoot API unavailable` state with the message `No sample or fallback
verse text is shown. Start the SourceRoot API and retry.` and a visible Retry
button. The API was then restarted solely to finish screenshot capture.

The distinct awaiting-data, unsupported-reference, loading, and empty-state
paths are covered by the focused backend and frontend tests without inserting
fallback product data.
