# SourceRoot Shared User Menu Navigation Polish v1

## Stage identity

- Name: SourceRoot Shared User Menu Navigation Polish v1
- Slug: SOURCEROOT-SHARED-USER-MENU-NAVIGATION-POLISH-V1
- Status: active
- Started: 2026-07-30

## Objective

Create one reusable signed-out SourceRoot-family user and workspace disclosure, preserve canonical destinations and authentication boundaries, and integrate it across SourceRoot, unified search, DictionaryRoot, and HistoryRoot without backend or data changes.

## Business value

Customers can distinguish public Root discovery from account and workspace
functions in every SourceRoot-family header. One registry and disclosure
implementation reduces per-Root navigation drift and gives future Roots a
stable onboarding contract.

## Current source of truth

The checked-out repository at
`8d889e9abc0f9fbb28415b011b0435ab720cee26` is canonical. Current SourceRoot,
DictionaryRoot, and HistoryRoot scripts, styles, pages, and live services are
the implementation inputs. Backups, packages, and completed-stage output are
not implementation sources.

## Allowed files

- `assets/css/sourceroot-user-menu.css`
- `assets/js/dictionaryroot-navigation.js`
- `assets/js/historyroot-shared.js`
- `assets/js/sourceroot-root-switcher.js`
- `assets/js/sourceroot-user-menu.js`
- `docs/build/SOURCEROOT-SHARED-USER-MENU-BROWSER-EVIDENCE.md`
- `docs/build/SOURCEROOT-SHARED-USER-MENU-STATE.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260730-SOURCEROOT-SHARED-USER-MENU-NAVIGATION-POLISH-V1.md`
- `ROOT-MANIFEST.json`
- `sourceroot.html`
- `sourceroot-search.html`
- `verification/sourceroot-shared-user-menu.test.cjs`
- `verification/sourceroot-user-menu-dictionaryroot-desktop-closed.png`
- `verification/sourceroot-user-menu-dictionaryroot-desktop-open.png`
- `verification/sourceroot-user-menu-historyroot-desktop-open.png`
- `verification/sourceroot-user-menu-mobile-open.png`
- `verification/sourceroot-user-menu-sourceroot-desktop-open.png`
- `VERIFY-SOURCEROOT-SHARED-USER-MENU-NAVIGATION-POLISH.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- `ROOT-PROTECTED-FUNCTIONALITY.md`
- the current shared Root-switcher component and focused contract test
- current SourceRoot home and unified-search headers
- current DictionaryRoot and HistoryRoot shared navigation initializers
- current canonical account and workspace destinations
- frontend at `http://127.0.0.1:8010` and backend health at
  `http://127.0.0.1:3000/health`

## Required behavior

- Add one signed-out `Sign in` disclosure shared by all four experiences.
- Keep only public customer experiences in Root-local navigation.
- Preserve `account-v1.html`, `editorial-v2.html`, and `workflow-v1.html`.
- Coordinate the user menu and Root switcher so only one is open.
- Support pointer, Enter, Space, outside-click, Escape, focus return, normal
  Tab navigation, current-page indication, unique IDs, and idempotent setup.
- Keep the registry and component independent of backend and authentication
  enforcement.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. This
stage specifically preserves live API integration, authentication and
authorization boundaries, public navigation, global search, breadcrumbs,
two-way contextual discovery, query/history state, shared Root switching,
responsive behavior, accessibility, unique IDs, and initialization order.

## Non-goals

- authentication, session, identity-provider, permission, or sign-out work
- backend, database, migration, corpus, dataset, installer, or package changes
- BibleRoot implementation or broad header/mobile redesign
- changes to the frozen Root-switcher checkpoint verifier
- Git staging, commits, tags, pushes, branches, or history changes

## Dependencies

The completed Shared Root Switcher Navigation Polish v1 release, Node.js,
Windows PowerShell 5.1, the current static frontend service, and the current
SourceRoot backend health endpoint.

## Risks

Primary risks are duplicated listeners or IDs, stale dynamic assets, menu
overlap, lost keyboard focus, mobile overflow, accidental removal of public
navigation or contextual discovery, and implying authentication enforcement
that this component does not provide.

## Acceptance criteria

1. One shared registry contains stable Sign in, Editorial, Workflow, and
   Account entries with canonical destinations and non-enforcement metadata.
2. SourceRoot home, unified search, DictionaryRoot, and HistoryRoot initialize
   the shared component immediately before the preserved Root switcher.
3. DictionaryRoot public navigation contains Home, Concept, Knowledge Sphere,
   Sources, History, and Coverage but not workspace entries.
4. Menu disclosure, coordination, keyboard, dismissal, focus, idempotency,
   current-page, unique-ID, responsive, and accessibility contracts pass.
5. Focused user-menu, Root-switcher, Chunk 11, DictionaryRoot, HistoryRoot,
   unified-search, syntax, active root, and final patch checks pass.
6. Desktop and mobile browser checks have zero attributable console errors or
   warnings and zero horizontal overflow, with five current screenshots.
7. No backend, migration, corpus, dataset, package, ZIP, index, or Git-history
   mutation occurs.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-SHARED-USER-MENU-NAVIGATION-POLISH.ps1`

## Manual browser checks

At 1280 by 720 check SourceRoot home, unified search with live query state,
DictionaryRoot public and workspace pages, and HistoryRoot public and record
pages. At a mobile viewport check one Root page. Exercise click, Enter, Space,
outside click, Escape/focus return, Tab, link selection, and coordination with
Switch Roots. Record current-asset identity, console output, viewport overflow,
and the five allowed screenshots.

## Live API checks

Require HTTP 200 from `http://127.0.0.1:3000/health` and current working-tree
pages at `http://127.0.0.1:8010`. Preserve unified-search live results and
partial/offline behavior without database writes.

## Required output

Shared JavaScript and CSS, bounded four-experience integration, focused
contract test, patch verifier, state document, browser-evidence document, five
screenshots, verifier totals, quality review classifications, artifact and Git
boundaries, and the completed-stage record.

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-30T11:21:27.6839237-05:00
- Verification skipped: True

### Verifier results

- SKIPPED explicitly with -SkipVerification

### Changed files

- `assets/css/sourceroot-user-menu.css`
- `assets/js/dictionaryroot-navigation.js`
- `assets/js/historyroot-shared.js`
- `assets/js/sourceroot-root-switcher.js`
- `assets/js/sourceroot-user-menu.js`
- `docs/build/SOURCEROOT-SHARED-USER-MENU-BROWSER-EVIDENCE.md`
- `docs/build/SOURCEROOT-SHARED-USER-MENU-STATE.md`
- `docs/stages/completed/20260730-SOURCEROOT-SHARED-USER-MENU-NAVIGATION-POLISH-V1.md`
- `ROOT-MANIFEST.json`
- `sourceroot.html`
- `sourceroot-search.html`
- `VERIFY-SOURCEROOT-SHARED-USER-MENU-NAVIGATION-POLISH.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Required verifiers were run immediately before completion: VERIFY-SOURCEROOT-SHARED-USER-MENU-NAVIGATION-POLISH.ps1 passed 32/0/0; VERIFY-ROOT-REPOSITORY.ps1 passed 51/0/0. Focused user-menu 42/42, Root-switcher 28/28, Chunk 11 12/12, DictionaryRoot 8/8, and HistoryRoot 15/15 passed. Desktop/mobile browser acceptance passed with five screenshots, zero console errors, zero attributable warnings, zero horizontal overflow, zero quality blockers, and zero unresolved review findings.
