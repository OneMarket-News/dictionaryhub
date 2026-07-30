# SourceRoot Shared User Menu State

## Problem and permanent header model

Root-local navigation previously mixed public discovery with account and
workspace destinations. The permanent SourceRoot-family model is:

`[Root identity] [public local navigation] [Sign in] [Switch Roots]`

The patch changes orientation and information architecture only. Evidence,
provenance, datasets, search results, lexical meaning, historical
interpretation, editorial records, workflow records, and account data are
unchanged.

## Public navigation boundary

DictionaryRoot public local navigation now contains Home, Concept, Knowledge
Sphere, Sources, History, and Coverage. Editorial, Workflow, and Account are
not rendered as local tabs. HistoryRoot retains Home, Explore, Timeline,
Sources, and Knowledge Graph. SourceRoot and unified search retain their
existing public search and discovery controls.

Page-content discovery links are not workspace tabs and remain available. For
example, DictionaryRoot home can still introduce Editorial as a customer
experience without placing Editorial in the persistent public tab row.

## Shared component and registry

`assets/js/sourceroot-user-menu.js` owns the only user-menu registry and
component. `assets/css/sourceroot-user-menu.css` owns its visual, responsive,
focus, and viewport behavior.

Each registry entry records:

- stable `id`
- `label`
- `canonicalUrl`
- `destinationType`
- `availabilityStatus`
- descriptive `authenticationRequirement`
- `authenticationEnforcedByComponent: false`
- `currentFiles`
- `description`
- optional `icon`
- numeric `order`
- semantic `group`

The entries are:

| Stable ID | Label | Canonical destination | Group |
| --- | --- | --- | --- |
| `SourceRootSignIn` | Sign in to SourceRoot | `account-v1.html` | Source Root account |
| `SourceRootEditorial` | Editorial | `editorial-v2.html` | Workspace |
| `SourceRootWorkflow` | Workflow | `workflow-v1.html` | Workspace |
| `SourceRootAccount` | Account | `account-v1.html` | Workspace |

The Sign in entry preserves the former DictionaryRoot Sign in control’s
destination. Editorial, Workflow, and Account preserve their existing
canonical pages and behavior.

## Signed-out behavior and authentication limitation

The current trigger is always labeled `Sign in`. The component records
`authState: "signed-out"` and does not invent a user, avatar, initials,
username, Sign out action, session, permission, or protected route.

This frontend disclosure does not enforce authentication. Existing pages and
backend operations retain their current public-read and protected-write
boundaries. Authentication metadata is descriptive and
`authenticationEnforcedByComponent` remains false.

A future real authentication adapter can extend the one shared initializer
with authenticated presentation, display identity, account configuration,
role-aware item selection, and a real sign-out action. Those states are not
rendered or activated by this checkpoint, and future Roots will not need to
rebuild their headers when that adapter is added.

## Experience integration

- SourceRoot home includes the shared stylesheet, script, and one mount beside
  the existing Root switcher.
- Unified search includes the same assets and mount without changing query,
  Root-filter, pagination, partial-availability, refresh, or browser-history
  state.
- DictionaryRoot’s common navigation initializer loads one shared user menu
  for every DictionaryRoot page and leaves workspace pages in page mapping and
  breadcrumbs without rendering them as public tabs.
- HistoryRoot’s common shared initializer loads the same component for home,
  explore, timeline, sources, graph, record, and context-review pages.

## Interaction with Switch Roots

The user menu and Root switcher remain separate registries and components.
They coordinate through `sourceroot:navigation-menu-open`. Opening either
dispatches its mount as the owner; the other component closes without taking
focus. Outside click closes an open disclosure. Escape closes the active
disclosure and returns focus to its trigger.

Both components use buttons with `aria-expanded` and `aria-controls`, semantic
navigation regions, and ordinary links. Enter and Space open the user menu.
Current Editorial, Workflow, and Account links receive `aria-current="page"`
and a visible `Current` label. Initialization is idempotent through a
`WeakMap`, and generated IDs are checked against the document before use.

There are no ARIA menu roles, hover-only behavior, focus traps, or duplicated
page-specific workspace arrays.

## Mobile and accessibility boundary

At 390 by 844, Sign in remains immediately before Switch Roots on all four
experiences. Both panels remain inside the viewport, links compute to a
62-pixel minimum height, local mobile-menu behavior remains present, IDs are
unique, and horizontal overflow is zero.

The tested boundary covers semantic controls and landmarks, accessible names,
expanded/control relationships, current-page indication, visible focus,
pointer and keyboard disclosure, outside dismissal, Escape focus return,
ordinary Tab-order links, reduced motion, and viewport containment. This is
not a claim of full accessibility certification.

## Future Root onboarding

A future Root needs:

1. `assets/css/sourceroot-user-menu.css`
2. `assets/js/sourceroot-user-menu.js`
3. one `[data-sourceroot-user-menu]` mount or `SourceRootUserMenu.init(...)`
   call
4. the shared page-context/current-file contract

It must not copy workspace destinations, event handlers, authentication
placeholders, or a Root-specific registry.

## Tested pages and accepted limitations

Live browser coverage included SourceRoot home, unified search with `bank`,
DictionaryRoot home, Concept, Editorial, Workflow, Account, HistoryRoot home,
and a HistoryRoot record. Static preservation contracts cover the remaining
shared pages and contextual-discovery language.

Accepted limitations:

- No authentication or authorization behavior was added.
- Sign in and Account currently share `account-v1.html`, matching the existing
  Sign in destination.
- Page-content Editorial discovery remains intentionally separate from the
  persistent public tab row.
- Normal Tab behavior is supplied by native buttons and links without a focus
  trap; the browser accessibility tree exposed all controls in document order.

## Preservation and frozen checkpoint note

The frozen historical Root-switcher verifier remains unchanged. Its accepted
preflight result was 25 substantive passes, 0 warnings, and exactly 2
superseded assertions: the former starting commit and former active-stage
requirement. Current preservation is established by the Root-switcher release
tag, shared assets, 28-of-28 focused contract result, current four-experience
integration, and live dropdown coordination.

No backend, database, migration, corpus, dataset, installer, package, or ZIP
file was changed.
