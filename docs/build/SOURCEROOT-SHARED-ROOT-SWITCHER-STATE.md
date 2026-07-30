# SourceRoot Shared Root Switcher State

## Problem

Chunk 11 made cross-Root destinations visible, but it rendered them as
horizontal strips inside SourceRoot, DictionaryRoot, and HistoryRoot headers.
Those strips competed with local product navigation, required horizontal
scrolling at constrained widths, and HistoryRoot also retained a redundant
DictionaryRoot pill.

## Shared architecture

`assets/js/sourceroot-root-switcher.js` is the only menu implementation and
the only Root destination registry. It exposes
`window.SourceRootRootSwitcher.init({ mount, currentId })`, performs
idempotent initialization through a `WeakMap`, and safely returns `null` when
no mount exists. SourceRoot pages load it directly. The existing shared
DictionaryRoot and HistoryRoot navigation initializers load it once and pass
their generated mount.

`assets/css/sourceroot-root-switcher.css` supplies the shared dark-family
visual treatment, visible focus, bounded desktop and mobile positioning,
tappable links, current badge, and reduced-motion handling. Generated-header
consumers receive the stylesheet through the component's guarded stylesheet
loader.

## Registry contract

Every registry entry contains:

- stable `id`
- `displayName`
- stable `canonicalUrl`
- `available` status
- `destinationType` (`utility` or `root`)
- semantic `group`
- optional `description`
- optional `icon`
- stable numeric `order`

The accepted entries are SourceRoot Home (`SourceRoot`), Search All Roots
(`SourceRootSearch`, a SourceRoot utility), DictionaryRoot
(`DictionaryRoot`), and HistoryRoot (`HistoryRoot`). No future Root is
presented as available.

To onboard a future implemented Root, add one available entry with those
fields to the shared registry. Every existing page will render it without
page-specific navigation edits. An unavailable future entry may remain in
code only when `available` is false, because rendering filters on that field.

## Current destination behavior

The integration supplies an explicit stable ID and the component also exposes
path-based detection. The current link receives `aria-current="page"` and a
visible `Current` badge. The trigger's accessible name includes the current
experience. Selecting the already-current destination closes the menu without
causing a reload loop.

## Product integration

- SourceRoot home retains the shared GET search entry and identifies
  SourceRoot Home as current.
- Unified search retains query, Root and result-type filters, pagination,
  result counts, partial availability, and browser-history code; only its
  header strip becomes the shared mount.
- DictionaryRoot retains its common brand, exact-meaning search, local
  navigation, context chip, account state, mobile menu, and canonical
  breadcrumb. Its shared navigation initializer mounts one DictionaryRoot
  switcher.
- HistoryRoot retains its common brand, Home/Explore/Timeline/Sources/
  Knowledge Graph navigation, mobile menu, and canonical breadcrumb. Its
  shared initializer mounts one HistoryRoot switcher and no longer constructs
  the redundant DictionaryRoot pill.

## Keyboard and dismissal behavior

The semantic button opens by click and by explicit Enter or Space handling.
`aria-expanded` always mirrors panel visibility and `aria-controls` references
a collision-checked menu ID. Normal Tab order reaches standard destination
links without a focus trap. A document click outside closes the panel. Escape
closes it and restores focus to the trigger. Destination selection closes it.

## Responsive and accessibility boundary

The component provides a button trigger, named navigation landmark,
meaningful standard links, visible focus, non-color current text, bounded
viewport positioning, and reduced-motion handling. Mobile uses a fixed panel
inset from both viewport edges and 62-pixel destination rows. This is a
focused interaction and layout check, not a full accessibility certification.

## Removed legacy navigation

The SourceRoot `sr-root-nav`, unified-search `sr-root-switcher`,
DictionaryRoot `sr-dr-root-switcher`, HistoryRoot `sr-hr-root-switcher`, and
HistoryRoot `historyroot-family-link` are no longer rendered. Their former CSS
selectors remain inert in older shared styles to avoid an unrelated stylesheet
cleanup.

## Preserved discovery and hierarchy

Breadcrumbs remain separate and unchanged. DictionaryRoot's “Search this term
in HistoryRoot” action and sense-intent warning remain in the Concept
experience. HistoryRoot's “Compare possible meanings in DictionaryRoot”
action and warning about modern definitions remain in record detail. Neither
contextual-discovery path moved into the switcher.

## Data boundary and accepted limitation

The component performs no API request and owns no backend or database state.
No backend, migration, corpus, accepted release ZIP, package, installer,
authentication, authorization, editorial, ranking, or result-envelope file is
changed. The generated-header integrations use a small guarded script loader
because current customer HTML pages intentionally share navigation through
JavaScript rather than repeating asset tags on every page.
