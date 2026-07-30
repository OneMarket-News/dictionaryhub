# SourceRoot Shared Root Switcher Navigation Polish v1

## Stage identity

- Name: SourceRoot Shared Root Switcher Navigation Polish v1
- Slug: SOURCEROOT-SHARED-ROOT-SWITCHER-NAVIGATION-POLISH-V1
- Status: active
- Started: 2026-07-30

## Objective

Replace cross-Root horizontal strips and redundant Root pills with one reusable, accessible Switch Roots dropdown while preserving each Root local navigation, breadcrumbs, live data behavior, and contextual discovery.

## Business value

Customers can move among SourceRoot, shared search, DictionaryRoot, and
HistoryRoot from one consistent control without confusing Root switching
with a product's local navigation. Future active destinations require one
registry entry rather than page-by-page navigation edits.

## Current source of truth

The checked-out repository at commit
`a467f854e158949240f01ff52c77bf66331197f5` on
`release/historyroot-alpha-integration-v1` is canonical. Current shared
navigation assets and the live customer pages on frontend port 8010 are the
only implementation inputs. Backups, packages, completed stages, and corpus
artifacts are not implementation sources.

## Allowed files

- `assets/css/sourceroot-root-switcher.css`
- `assets/js/dictionaryroot-navigation.js`
- `assets/js/historyroot-shared.js`
- `assets/js/sourceroot-root-switcher.js`
- `docs/build/SOURCEROOT-SHARED-ROOT-SWITCHER-BROWSER-EVIDENCE.md`
- `docs/build/SOURCEROOT-SHARED-ROOT-SWITCHER-STATE.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260730-SOURCEROOT-SHARED-ROOT-SWITCHER-NAVIGATION-POLISH-V1.md`
- `ROOT-MANIFEST.json`
- `sourceroot.html`
- `sourceroot-search.html`
- `verification/sourceroot-root-switcher-dictionaryroot-desktop-closed.png`
- `verification/sourceroot-root-switcher-dictionaryroot-desktop-open.png`
- `verification/sourceroot-root-switcher-historyroot-desktop-closed.png`
- `verification/sourceroot-root-switcher-historyroot-desktop-open.png`
- `verification/sourceroot-root-switcher-mobile-open.png`
- `verification/sourceroot-shared-root-switcher.test.cjs`
- `VERIFY-SOURCEROOT-SHARED-ROOT-SWITCHER-NAVIGATION-POLISH.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- `ROOT-PROTECTED-FUNCTIONALITY.md`
- `sourceroot.html` and `sourceroot-search.html`
- `assets/js/dictionaryroot-navigation.js`
- `assets/js/historyroot-shared.js`
- current navigation CSS for layout inspection only
- Chunk 11 frontend contract and current browser evidence for preservation

## Required behavior

One shared frontend registry and component render a button labeled
`Switch Roots`, group SourceRoot utilities separately from canonical Roots,
identify the current experience visibly and with `aria-current`, and support
click, Enter, Space, outside-click, and Escape behavior. Escape restores
focus. Initialization is idempotent. SourceRoot, unified search,
DictionaryRoot, and HistoryRoot use the component while retaining their local
navigation and breadcrumbs.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. This
stage additionally preserves unified-search URL state and result behavior,
DictionaryRoot and HistoryRoot local navigation, canonical breadcrumbs,
two-way contextual discovery and non-equivalence disclaimers, responsive
mobile menus, live API integration, and unique element IDs.

## Non-goals

- backend routes, services, result envelopes, or search ranking
- database writes or migration changes
- corpus, release ZIP, package, or installer changes
- authentication, accounts, permissions, or editorial APIs
- BibleRoot or another future Root implementation
- global mobile-navigation redesign
- Git staging, commits, tags, branches, pushes, or history changes

## Dependencies

- current static frontend on port 8010
- current backend health and live customer APIs on port 3000
- Node.js for focused frontend contract tests
- Windows PowerShell 5.1-compatible verifier execution
- in-app browser automation for desktop and mobile acceptance

## Risks

- A shared loader race could render no switcher on generated headers.
- Header width changes could hide local navigation or create overflow.
- Stale browser assets could invalidate visual evidence.
- Incorrect keyboard handling could double-toggle or lose focus.
- Page-specific markup could accidentally reintroduce duplicate controls.
- Rollback is limited to the explicit stage files; no data rollback exists.

## Acceptance criteria

Every criterion must be objectively testable whenever possible. Separate
manual evidence from deterministic checks.

1. Exactly one shared active-destination registry defines the four accepted destinations and their stable metadata.
2. Exactly one `Switch Roots` control renders on every in-scope Root page.
3. The control meets the pointer, keyboard, current-state, outside-click, Escape, focus-return, and idempotent-initialization contracts.
4. Old horizontal cross-Root strips and redundant HistoryRoot family pills are not rendered.
5. Local navigation, breadcrumbs, contextual discovery, unified-search state, and live customer behavior remain functional.
6. Desktop 1280x720 and mobile 390x844 browser evidence records zero attributable console errors, warnings, or horizontal overflow.
7. The focused frontend test, patch verifier, and active root verifier pass with zero warnings and failures.
8. Backend, migrations, corpora, accepted release ZIPs, repository ZIP count, and Git index remain unchanged.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-SHARED-ROOT-SWITCHER-NAVIGATION-POLISH.ps1`

## Manual browser checks

At 1280x720, verify SourceRoot home, unified search, DictionaryRoot Concept,
and HistoryRoot home/record navigation. At 390x844, verify all four product
families. Check open/closed state, all four destinations, visible current
state, Enter, Space, Escape, focus return, outside click, local navigation,
breadcrumbs, contextual discovery, query/history preservation, viewport
containment, console output, and horizontal overflow. Capture the five
explicit screenshot paths in the allowed-file list.

## Live API checks

Probe `http://127.0.0.1:3000/health` for HTTP 200 and current customer pages
on `http://127.0.0.1:8010`. Run a bounded live unified search and confirm
DictionaryRoot and HistoryRoot results remain canonical. No database mutation
or broad backend suite is authorized.

## Required output

- shared registry/component JavaScript and shared CSS
- four bounded integration edits
- focused frontend contract test and final patch verifier
- current-state and browser-evidence documents
- five current-working-tree screenshots
- zero-blocker quality review
- completed-stage lifecycle record and inactive-root verification evidence

## Completion record

Added by `COMPLETE-ROOT-STAGE.ps1` after required verification succeeds.

## Completion record

- Completion date: 2026-07-30T10:38:34.4881004-05:00
- Verification skipped: False

### Verifier results

- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0
- VERIFY-SOURCEROOT-SHARED-ROOT-SWITCHER-NAVIGATION-POLISH.ps1 -> exit 0

### Changed files

- `assets/css/sourceroot-root-switcher.css`
- `assets/js/dictionaryroot-navigation.js`
- `assets/js/historyroot-shared.js`
- `assets/js/sourceroot-root-switcher.js`
- `docs/build/SOURCEROOT-SHARED-ROOT-SWITCHER-BROWSER-EVIDENCE.md`
- `docs/build/SOURCEROOT-SHARED-ROOT-SWITCHER-STATE.md`
- `docs/stages/completed/20260730-SOURCEROOT-SHARED-ROOT-SWITCHER-NAVIGATION-POLISH-V1.md`
- `ROOT-MANIFEST.json`
- `sourceroot.html`
- `sourceroot-search.html`
- `VERIFY-SOURCEROOT-SHARED-ROOT-SWITCHER-NAVIGATION-POLISH.ps1`

### Unresolved manual checks

- None reported

### Completion notes

Shared Root registry and accessible Switch Roots component implemented across SourceRoot, unified search, DictionaryRoot, and HistoryRoot. Focused contract 28/28; final patch verifier 27/0/0; active root verifier 51/0/0; desktop and mobile browser acceptance passed with zero console errors, attributable warnings, horizontal overflow, or quality blockers. No backend, migration, corpus, package, ZIP, or Git mutation.
