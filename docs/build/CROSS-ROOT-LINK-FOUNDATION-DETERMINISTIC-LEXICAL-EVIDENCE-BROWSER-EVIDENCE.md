# Cross-Root Link Foundation browser evidence

Date: 2026-08-01
Frontend: pre-existing local server on port 5500 (PID 1916, left running)
API: temporary local process on port 3000, stopped after acceptance

## Live API and evidence

- `/api/v1/cross-root/coverage` returned ready with 1,568 resources, 2,233 links, and 2,765 evidence rows.
- DictionaryRoot lemma `lex-lemma-core-bring` returned 11 links on the first page: 10 BibleRoot and one HistoryRoot.
- The HistoryRoot occurrence reconstructed surface `bring`, field `statement`, UTF-16 offsets 64–69, exact context excerpt, target/field SHA-256 values, evidence ID, algorithm `exact-lexical-observation-js-utf16-v1`, and HistoryRoot dataset 1.3.0.
- The BibleRoot example retained surface `bring`, edition dataset/version, exact-text field, offsets, content hashes, and canonical passage URL.
- `lex-lemma-core-accent` produced the registered no-links state with zero fallback links and no Retry control.
- `missing-resource` produced structured `RESOURCE_NOT_FOUND`, the invalid-resource state, zero links, and no Retry control.

## Boundaries and canonical navigation

The lexical-boundary disclaimer and separate human-review notice were visible. Every card displayed Textually observed, Unreviewed, link/evidence IDs, algorithm, dataset versions, and canonical navigation. Narrow live entry points were verified from:

- DictionaryRoot lexical sense `lex-sense-core-verb-00141396` to lemma `lex-lemma-core-bring`.
- HistoryRoot record `historyroot-plymouth-claim-ousamequin-strategy`.
- All 31 visible KJV Genesis 1 edition-text records in BibleRoot passage view.

## Failure and recovery

The temporary API process was deliberately stopped. The page reached genuine `error` state, displayed Cross-Root API unavailable and Retry, kept results hidden, rendered zero links, and stated that no fallback links were shown. After restarting the API, Retry restored ready state with both BibleRoot and HistoryRoot groups and 11 live links.

## Responsive and accessibility evidence

- Desktop: 1280×720, no horizontal overflow. The screenshot shows the HistoryRoot evidence card, exact excerpt and offsets, canonical link, and visible focus outline on the native evidence summary.
- Mobile: 390×844, stacked boundary/lookup/status cards, retained Root/type/public ID and ready state, no horizontal overflow.
- Native label/select/input/button/details/summary controls, skip link, semantic headings, polite live status, reduced-motion CSS, and focus-visible styling were present. Keyboard focus reached and remained on the native evidence summary; panel activation and content visibility were verified.
- Browser console: zero errors and zero unexpected warnings before failure, during handled unavailability, and after recovery.

Artifacts:

- `verification/cross-root-links-desktop.png`
- `verification/cross-root-links-mobile.png`
