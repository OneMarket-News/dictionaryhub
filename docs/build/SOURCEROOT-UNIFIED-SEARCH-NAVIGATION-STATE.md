# SourceRoot Unified Search and Navigation State

## Current checkpoint

Chunk 11 begins from accepted commit
`49a75dff63c7f7d3fc3f1c7277cabb5b9ebc0b0e`, DictionaryRoot dataset
`dictionaryroot-core-lexical-corpus-v1` `1.0.0`, and HistoryRoot dataset
`historyroot-plymouth-knowledge-dataset-v1` `1.3.0`.

Unified discovery is read-only. Canonical records remain in their current
Root models and open in their current customer pages.

## Customer navigation

The SourceRoot home, unified search page, shared DictionaryRoot header, and
shared HistoryRoot header expose:

- SourceRoot home
- Search all Roots
- DictionaryRoot
- HistoryRoot
- an active-Root/current-page indication

DictionaryRoot keeps its existing experience navigation, branding, global
exact-meaning search, context preservation, and account state. HistoryRoot
keeps its existing Home, Explore, Timeline, Sources, Knowledge Graph, and
detail navigation.

At narrow viewports, Root links remain ordinary keyboard/touch links in a
bounded horizontally scrollable product list. Core navigation does not depend
on hover.

## Breadcrumbs

Shared scripts add canonical breadcrumbs after the existing product header:

- `SourceRoot > Search`
- `SourceRoot > DictionaryRoot > {page} > {term}`
- `SourceRoot > HistoryRoot > {page} > {query}`

Breadcrumbs describe navigation location only. They do not assert a content
hierarchy between lexical and historical objects.

## URL query state

`sourceroot-search.html` stores:

- `q`
- `roots`
- `resultTypes`
- `page`

The form, filters, reset control, previous/next controls, reload, and browser
back/forward all use the URL as the state source. A popstate event restores
controls and reruns the same live request. Result rendering does not replace
the search controls, preventing focus loss during refresh.

## Result presentation

Results stay in deterministic global order and are clearly labeled with:

- owning Root
- canonical result type
- match classification
- dataset ID/version
- evidence/source availability
- canonical Root-specific link
- query-overlap disclaimer

DictionaryRoot and HistoryRoot summaries are never combined into a synthetic
answer or consensus.

## Contextual cross-Root discovery

DictionaryRoot Concept adds “Explore this term in HistoryRoot.” It opens live
unified search filtered to HistoryRoot and states that a matching term does
not prove that the selected lexical sense was intended historically.

HistoryRoot Record adds a user-controlled “Compare possible meanings in
DictionaryRoot” form. It requires the customer to choose a word, filters the
live unified search to DictionaryRoot lexical senses, and states that a modern
definition does not establish historical intent. No automatic sense is
selected.

Both paths are query-derived and non-authoritative. Chunk 11 creates no
cross-Root table, generic node, semantic edge, or inferred claim.

## Availability

The page distinguishes:

- both Roots available
- one Root available
- both Roots unavailable
- valid empty query result
- incompatible Root/result-type filters

Partial results remain usable and identify the failed Root. No failure state
uses static fallback content.

## Accessibility boundary

Implemented and tested boundaries include semantic header/nav/main/footer
landmarks, a skip link, labeled search and filter controls, fieldset/legend
grouping, live result/status regions, visible focus, current Root/page state,
meaningful links, responsive reflow, reduced-motion handling, and
keyboard/touch-accessible controls.

This is a focused product check, not a full accessibility certification.

## Mobile behavior

At 390×844:

- search input/button stack
- filters move above results
- count cards use two columns
- Root links remain horizontally scrollable
- result metadata wraps
- breadcrumbs wrap at word boundaries
- pagination remains tappable
- no content depends on hover

Browser evidence and overflow/console results are recorded separately in
`SOURCEROOT-UNIFIED-SEARCH-BROWSER-EVIDENCE.md`.
