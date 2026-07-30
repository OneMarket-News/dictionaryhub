# SourceRoot Shared User Menu Browser Evidence

## Environment and current assets

- Desktop viewport: 1280 by 720
- Mobile viewport: 390 by 844
- Frontend: `http://localhost:8010`
- Backend health: `http://127.0.0.1:3000/health` returned HTTP 200
- Current asset:
  `assets/js/sourceroot-user-menu.js?v=shared-user-menu-v1`
- Cache strategy: fresh `localhost:8010` URLs with bounded query markers
- Desktop result: PASS
- Mobile result: PASS

The browser observed the working-tree component version, its four-entry
registry output, and the current live backend. No stale Root-switcher
screenshots were reused.

## Desktop matrix

| Experience | Evidence |
| --- | --- |
| SourceRoot home | One Sign in and one Switch Roots trigger; Sign in precedes Switch Roots; four canonical menu entries; pointer, Enter, Space, outside click, Escape/focus return, and two-way menu coordination passed; overflow 0. |
| Unified search | One ordered trigger pair; live `bank` query returned 3 canonical results; DictionaryRoot and HistoryRoot filters stayed checked; page 1 of 1 remained accurate; back and forward restored the query, filters, status, and canonical detail URL; overflow 0. |
| DictionaryRoot | Public tabs were exactly Home, Concept, Knowledge Sphere, Sources, History, and Coverage; one trigger pair; four shared entries; breadcrumbs, live coverage, Concept, and HistoryRoot contextual discovery remained; overflow 0. |
| HistoryRoot | Public tabs were exactly Home, Explore, Timeline, Sources, and Knowledge Graph; one trigger pair; shared entries, breadcrumb, live dataset, record detail, and DictionaryRoot lookup remained; overflow 0. |
| Workspace pages | Editorial, Workflow, and Account received `aria-current="page"`; the trigger remained Sign in; selecting Editorial used `editorial-v2.html` and left the reinitialized menu closed. |

Canonical destinations observed:

- Sign in to SourceRoot: `account-v1.html`
- Editorial: `editorial-v2.html`
- Workflow: `workflow-v1.html`
- Account: `account-v1.html`

## Shared interaction

- Pointer click: PASS
- Enter and Space: PASS
- Outside click: PASS
- Escape and focus return: PASS
- Normal Tab navigation: PASS — native button and anchor semantics remain in
  document order and the component installs no focus trap.
- Opening Sign in closes Switch Roots: PASS
- Opening Switch Roots closes Sign in: PASS
- Trigger state accuracy: PASS
- Link selection closes the disclosure: PASS
- Current-page non-color indication: PASS
- Unique IDs: PASS, duplicate count 0
- Duplicate initialization: PASS, one trigger of each kind per experience
- Console errors: 0
- Attributable console warnings: 0
- Horizontal overflow: 0

## Mobile matrix

All four pages were checked at 390 by 844.

| Experience | Trigger order | User panel | Root panel | Duplicate IDs | Overflow | Console |
| --- | --- | --- | --- | --- | --- | --- |
| SourceRoot home | PASS | inside viewport | inside viewport | 0 | 0 | 0 |
| Unified search | PASS | inside viewport | inside viewport | 0 | 0 | 0 |
| DictionaryRoot | PASS | inside viewport | inside viewport | 0 | 0 | 0 |
| HistoryRoot | PASS | inside viewport | inside viewport | 0 | 0 | 0 |

DictionaryRoot and HistoryRoot retained one local mobile Menu control and their
local navigation containers. Unified-search, DictionaryRoot, and HistoryRoot
breadcrumbs remained present. SourceRoot home has no breadcrumb by existing
design. User-menu links computed to a 62-pixel minimum height. No hover was
required.

## Search and contextual preservation

The `bank` query, both Root filters, result status, page state, refreshable URL,
back navigation, and forward navigation were preserved. Concept displayed
`Explore this term in HistoryRoot` and the required non-equivalence warning.
The Ousamequin HistoryRoot record displayed `Compare possible meanings in
DictionaryRoot` and the required historical-intent warning.

## Screenshots

- `verification/sourceroot-user-menu-dictionaryroot-desktop-closed.png`
- `verification/sourceroot-user-menu-dictionaryroot-desktop-open.png`
- `verification/sourceroot-user-menu-historyroot-desktop-open.png`
- `verification/sourceroot-user-menu-sourceroot-desktop-open.png`
- `verification/sourceroot-user-menu-mobile-open.png`

All five are current-stage, non-empty browser captures.

## Quality review

- Quality blockers: 0
- Unresolved review findings: 0
- Observations: the existing SourceRoot home places the action pair on its own
  header row; the shared order and behavior remain correct.
- Accepted limitations: navigation organization does not implement or claim
  authentication enforcement; Sign in and Account preserve the same existing
  account destination.
