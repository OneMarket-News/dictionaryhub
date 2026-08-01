# BibleRoot Commentary Provenance browser evidence

Acceptance was completed on 2026-08-01 in the Codex in-app browser against the
governed local development database. The frontend was served by the existing
workspace server at `http://localhost:5500`; the SourceRoot API was started for
this check at `http://localhost:3000` and stopped afterward.

## Provisioned state

- Migration `017_create_bibleroot_commentary_provenance.sql` applied once.
- First `dev:provision` imported 3,653 commentary records; the second skipped
  the same 3,653 records with no updates or failures.
- Readiness contract `1.2.0` reported `commentaryProvenanceReady: true` while
  preserving Foundation, Original Language, and Translation Comparison
  readiness.

## Customer-flow evidence

- Loaded Genesis 1, Psalm 23, Ecclesiastes 3, and John 1 with both accepted
  works selected. Every result rendered two attributed work cards.
- URL state followed each selection and retained both stable work IDs.
- Genesis 1 displayed the nine recorded JFB coverage-gap ranges and explicitly
  stated that no fallback or inferred commentary was added.
- Expanded the 182-statement Matthew Henry John 1 section and confirmed all
  182 source statements remained navigable with stable statement IDs, offsets,
  and hashes.
- Opened and closed work and section provenance dialogs. The dialogs exposed
  the named work, edition, provider, artifact, checksum status, source anchor,
  public-domain declaration, attribution, and territorial caution.
- Verified Bible text, Translation Comparison, and Original Language links
  preserve the selected canonical reference.
- Keyboard focus remained visible on the passage selector (`outline-style:
  auto`, one-pixel outline).

## Responsive and console evidence

- Desktop override: 1280 by 720; two columns rendered with no document-level
  horizontal overflow.
- Mobile override: 390 by 844 (375-pixel layout viewport after scrollbar);
  two work cards remained present with no document-level horizontal overflow.
- Browser console warnings/errors after the complete ready/offline/recovery
  flow: none.
- Desktop screenshot: `verification/bibleroot-commentary-desktop.png`.
- Mobile screenshot: `verification/bibleroot-commentary-mobile.png`.

## Genuine unavailable state

The owned API process was stopped and port 3000 was confirmed unavailable.
Reloading the page produced `BibleRoot API unavailable`, the instruction to
start SourceRoot and retry, and zero commentary articles. The page explicitly
said no sample or fallback commentary was shown. Retrying while offline stayed
in that honest state; after restarting the API, Retry restored Psalm 23 with
both attributed work cards and the exact dataset/version identity.

The temporary viewport override was reset, the browser tab created for this
acceptance run was closed, and the owned API process was stopped. No manual
browser checks remain unresolved.
