# SourceRoot Chunk 5 — Context API and Review Experience v1

## Stage identity

- Package: `SourceRoot-Context-API-Review-Experience-v1`
- Installer: `INSTALL-SOURCEROOT-CONTEXT-API-REVIEW-EXPERIENCE.ps1`
- Verifier: `VERIFY-SOURCEROOT-CONTEXT-API-REVIEW-EXPERIENCE.ps1`
- Migration: none
- Focused backend suite: `backend/test/context-api-review-experience.test.ts`
- Frontend suite: `verification/context-review-experience.test.cjs`
- Contract: `docs/build/CONTEXT-API-REVIEW-EXPERIENCE-CONTRACT.md`

## Starting checkpoint

- Repository: `C:\Users\Josh\Documents\GitHub\dictionaryhub`
- Branch: `release/historyroot-alpha-integration-v1`
- Full commit: `d4d7f7f49afe808fb9bf554c579800e254a67b99`
- Required prior tag: `sourceroot-contextual-assertions-evidence-versioning-v1`
- Tag target: `d4d7f7f49afe808fb9bf554c579800e254a67b99`
- Starting worktree: clean
- Prior ZIP: `C:\Users\Josh\Documents\SourceRoot-Releases\SourceRoot-Contextual-Assertions-Evidence-Versioning-v1.zip`
- Prior ZIP SHA-256: `2485ec694dfc9cfe02d7291d9f0ec133658fc9057d8953c79e2d3618440c5b8b`
- Test database proven before database commands: `sourceroot_test`

No Git history operation was performed.

## Inventory findings

- The accepted schema through migrations 001–012 already contains the required claims, accounts, attributions, relationships, evidence links, locators, immutable versions/current pointers, source associations, and field provenance.
- Core SourceRoot assertions and contextual claims are separate accepted models.
- A source association is provenance, not evidentiary support.
- Legacy `evidenceType` cannot be converted into a normalized evidence role.
- The current logical claim projection and immutable claim versions are distinct.
- Existing Registry Contract, request-ID, shared API transport, HistoryRoot navigation, URL, DOM-safety, and responsive patterns can be reused.
- The accepted roadmap names this Chunk 5 dependency but does not precisely name the following dependency. The next dependency therefore remains to be named.

## Architecture decision

The stage adds two read-only composed GET routes over existing normalized tables and a static HistoryRoot review page that uses the shared SourceRoot request transport through the HistoryRoot API wrapper. It does not add a table, migration, write route, parallel domain model, frontend framework, or governance workflow.

The API performs bounded set-based queries. It returns visible current and historical claim state, explicit roles, exact locators, related claims, public sources, and partial-data diagnostics. Search gains additive stable review identities and deep links.

The frontend uses safe DOM creation, validated HTTP(S) external links, abortable requests, a monotonic navigation run guard, and URL push/replace/popstate behavior.

## Files added

- `assets/css/historyroot-context-review.css`
- `assets/js/historyroot-context-review.js`
- `backend/src/services/context-review-store.ts`
- `backend/test/context-api-review-experience.test.ts`
- `docs/build/CONTEXT-API-REVIEW-EXPERIENCE-CONTRACT.md`
- `docs/build/context-api-review-experience-stage.md`
- `history-context-review-v1.html`
- `INSTALL-SOURCEROOT-CONTEXT-API-REVIEW-EXPERIENCE.ps1`
- `verification/context-review-experience.test.cjs`
- `VERIFY-SOURCEROOT-CONTEXT-API-REVIEW-EXPERIENCE.ps1`

## Files replaced

- `assets/js/historyroot-api.js`
- `assets/js/historyroot-record.js`
- `assets/js/historyroot-shared.js`
- `backend/package.json`
- `backend/src/routes/context.ts`
- `backend/src/services/context-store.ts`
- `backend/src/services/search-store.ts`
- `docs/build/CURRENT-SOURCEROOT-STATE.md`
- `docs/build/SOURCEROOT-BASELINE-MANIFEST.json`
- `history-record-v1.html`

## API behavior

- `GET /api/v1/context/review/records/:recordId` returns the visible record and deterministic, filterable, paginated claim summaries.
- `GET /api/v1/context/review/claims/:claimId` returns bounded current/historical version state, reporting account, attributions, evidence, relationships, provenance, sources, counts, and diagnostics.
- `version` selects a visible immutable historical claim version.
- Each variable-length section has independent page/limit parameters capped at 50.
- Withdrawn records, draft versions, and nonpublic source payloads are excluded.
- Errors use stable validation/not-found codes, Registry Contract version `1.0`, and propagated request IDs.
- Search metadata additively identifies the stable claim, matched historical version, parent record, current version, match state, and review URL.
- Both review routes are GET-only and perform no writes.

## Frontend behavior

`history-context-review-v1.html` provides a record header, filterable claim selector, primary current/historical comparison, reporting account and attribution review, distinct provenance and evidence areas, explicit evidence-role groups and locators, related-claim groups, immutable version timeline, field provenance, partial-data diagnostics, and accessible state handling.

The existing HistoryRoot record page shows “Review context” only when the record has visible contextual claims. It carries record, deterministic first-claim, and `from=record` state. Search result links may deep-link to the logical claim or the exact matched historical version.

## Testing

Controlled pre-implementation baseline:

- TypeScript: PASS
- Test migration through 012: PASS
- Chunk 4 focused: 19/19
- Chunk 3 focused: 13/13
- Contextual foundation: 15/15
- Registry Contract: 11/11
- Governance: 12/12
- Observability: 10/10
- Full backend: 187/187
- SourceRoot baseline: 15 pass, 0 fail, 0 warning
- DictionaryRoot baseline: 23 pass, 0 fail, 0 warning
- Existing frontend observability harness: 10/10

Focused implementation results:

- Backend Context API review: 24/24
- Frontend review verification: 15/15
- TypeScript after implementation: PASS

Authoritative release verification:

- Test-scoped migration through 012: PASS; no migration 013 exists
- Backend Context API review: 24/24
- Chunk 4 assertions/evidence/versioning: 19/19
- Chunk 3 identity/time: 13/13
- Contextual foundation: 15/15
- Registry Contract: 11/11
- HistoryRoot governance: 12/12
- Observability: 10/10
- HistoryRoot Plymouth: PASS
- Complete backend: 211/211, preserving the accepted 187/187 baseline
- Focused frontend review: 15/15
- Existing frontend observability: 10/10
- HistoryRoot customer experience: 13/13
- SourceRoot baseline: 15 pass, 0 fail, 0 warning
- DictionaryRoot baseline: 23 pass, 0 fail, 0 warning
- Exact immutable Chunk 0-4 replay through the unchanged Chunk 4 verifier: PASS
- Final package-aware verifier: 45 pass, 0 fail, 0 warning, 0 informational
- Final installer-launched verifier: 45 pass, 0 fail, 0 warning, 0 informational

The controlled installer test created:

- Backup: `C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-context-api-review-experience-v1-20260726-145703-231`
- Installation record: `C:\Users\Josh\Documents\GitHub\dictionaryhub\backups\sourceroot-context-api-review-experience-v1-20260726-145703-231\installation-record.json`

The package manifest records SHA-256 for every one of the 20 payload files. The final ZIP SHA-256 is recorded externally after the immutable ZIP is assembled, avoiding a self-referential archive hash.

The broader pre-existing `historyroot-alpha-integration.test.mjs` inventory is not a Chunk 5 acceptance gate: at the accepted starting checkpoint it rejects developer-specific paths already embedded in unchanged historical verifiers and rejects the harmless identifier `body` in accepted request logging. This stage does not weaken that test, alter old verifiers, or modify unrelated logging to manufacture a pass. The relevant 13-case HistoryRoot customer baseline and the new 15-case review integration suite both pass.

## Manual browser status

PASS in the Codex in-app browser against a local static server and an independently running backend configured from `backend/.env.test` on `sourceroot_test`.

Verified:

- a real HistoryRoot Plymouth record conditionally exposed the review entry point and preserved `record`, `claim`, and `from=record`;
- record/claim/version deep links loaded and refreshed;
- current, historical, legacy, missing-history, attribution, provenance, supporting evidence, locator, correction, retraction, supersession, and related-claim presentations;
- returning from a historical version removed the `version` parameter and selected the current version;
- claim switching updated URL and `aria-current` state;
- mobile 390×844, tablet 800×900, and desktop 1280×900 layouts had no horizontal overflow;
- the mobile/tablet layout collapsed to one column and the desktop layout restored its sticky two-column selector;
- no editorial action controls appeared;
- stopping the test backend produced the explicit offline state with no fallback claim; restarting it and choosing “Try again” recovered the live review; and
- a visual contrast issue caused by inherited dark-theme heading colors was found, fixed, and rechecked with computed foreground/background colors and a fresh screenshot.

The live API smoke also returned the propagated request ID and the expected legacy/current review counts. This verifies the local development path, not a production deployment or cross-browser certification.

## Known limitations

- The review page is a read-only inspection experience and intentionally has no editorial controls.
- Claim sections are independently bounded; clients must follow the returned pagination metadata for complete large histories.
- Public source projection is capped at 200 and reports exact public/referenced/returned counts.
- Per-evidence locator and field-provenance previews are capped at 20 and report exact counts.
- A record-only URL selects the first visible claim by the API's deterministic ordering.
- A requested version that is missing or no longer visible is explicitly reported before the current claim is shown.
- No external source is retrieved or validated.
- Static and Node verification do not by themselves prove visual layout in every browser.
- This stage does not claim production readiness.

## Release artifacts

- Package folder: `SourceRoot-Context-API-Review-Experience-v1`
- ZIP: `SourceRoot-Context-API-Review-Experience-v1.zip`
- Payload: 10 added and 10 replaced complete repository files
- Manifest: `manifest/stage-manifest.json`
- Payload hashes: one SHA-256 per manifest-declared file
- ZIP structure: one top-level package folder with forward-slash entries and no unsafe, duplicate, missing, extra, absolute, or backslash entries
- Final ZIP SHA-256: recorded externally after final assembly

## Next dependency

The accepted roadmap inspected for this stage does not precisely name or scope the dependency after Chunk 5. The next dependency remains to be named.
