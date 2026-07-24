# HistoryRoot Customer Experience v1

HistoryRoot Customer Experience v1 is the first coherent public historical
research surface built on the SourceRoot contextual knowledge foundation. It
uses the live `historyroot-plymouth-knowledge-dataset-v1` bundle and does not
ship a static historical-record fallback.

The pilot is machine-assisted and awaits further historical, editorial, and
tribal review. Its core chronological scope is 1616–1691, with separately
identified background context, a 1692 governmental transition, and selected
cultural-memory afterlives.

## Public pages

| Experience | File | Purpose |
| --- | --- | --- |
| Home | `historyroot.html` | Dataset status, live totals, featured canonical records, and entry-point search |
| Explore | `history-explore-v1.html` | Canonical/alias search, record-type filters, date filters, uncertainty filtering, and progressive results |
| Timeline | `history-timeline-v1.html` | Chronology that distinguishes exact, approximate, ranged, disputed, before/after, and multiple-proposed dates |
| Record detail | `history-record-v1.html?id={stable-id}` | Adaptive detail for entity and contextual record types |
| Sources | `history-sources-v1.html?source={source-id}` | Source register, classification, access status, locators, limitations, rights, and linked records |
| Knowledge graph | `history-graph-v1.html?id={stable-id}` | Bounded, focused, keyboard-accessible relationship neighborhood |

Every page receives the shared HistoryRoot product navigation at runtime:
Home, Explore, Timeline, Sources, and Knowledge Graph. A quieter family link
returns to DictionaryRoot. The HistoryRoot palette and information
architecture are distinct, while spacing, typography, focus treatment, and
the Root family mark preserve product-family continuity.

## Frontend architecture

- `config/customers/historyroot.json` contains connection configuration,
  reviewed scope metadata, graph limits, and curated stable IDs only.
- `assets/js/historyroot-api.js` owns SourceRoot requests, pagination,
  timeouts, malformed-response handling, caching, and dataset-availability
  checks.
- `assets/js/historyroot-shared.js` owns safe DOM construction, navigation,
  status surfaces, canonical/alias helpers, URL helpers, temporal labels,
  source labels, and record cards.
- One page controller per experience owns only that page’s state and rendering.
- `assets/css/historyroot.css` is the shared responsive HistoryRoot visual
  system.

API content is written with `textContent` or text nodes. Customer-facing
scripts do not use `innerHTML`. External URLs are accepted only when they parse
as HTTP or HTTPS and open with `noopener noreferrer`.

## Live-data behavior

The UI checks the imported bundle registry before showing records. If
SourceRoot is unavailable, times out, returns malformed JSON, or does not have
the Plymouth bundle imported, the UI displays an accessible status surface and
a retry action. It never substitutes historical records from a local JSON
file.

Home and list pages use bounded pagination and progressive disclosure. The
focused graph is capped by configuration. Record detail composes the existing
domain-neutral contextual APIs rather than downloading an unbounded graph.

Search results are hydrated through the canonical record API and deduplicated
by stable ID. An alternate-name query still shows the canonical record and
identifies the matched alias. Filter and focus state is encoded in the URL;
Explore, Timeline, Sources, and Knowledge Graph respond to browser
back/forward navigation.

## Historical presentation rules

- Background, the 1616–1691 core, the 1692 transition, and cultural-memory
  afterlives remain separate scopes.
- Timeline ordering uses only dates represented in temporal assertions. The
  UI does not convert approximate or disputed dates into invented exact dates.
- Claims keep evidence, locators, evidence limitations, strength, and
  confidence together.
- Historical accounts and interpretations remain attributed.
- Perspective links include their stance and qualification where available.
- Causes and consequences display confidence and uncertainty; graph edges are
  navigation aids rather than claims of equal certainty.
- Cultural memory is separated from event chronology.
- Empty record sections are omitted.

Document and work records expose work/original/witness relationships as a
small transmission network. For the Mayflower Compact, the displayed statement
that the signed original is lost, the distinction between that original and
the conceptual text, and the three early textual witnesses all come from live
entity metadata and relationships. No page hard-codes that historical
assertion.

## Source API read completeness

The existing `sources` table already retained imported source payloads in
`raw_data`, but the read service returned only its normalized common columns.
HistoryRoot requires the existing source-register fields `citation`,
`accessStatus`, `accessDate`, `locatorsInspected`, `limitations`, and
`supportsDetailedClaims`.

The domain-neutral source read mapping now merges stored `raw_data` before
normalized columns, preserving normalized identifiers while returning those
existing governed fields. No schema or migration change is required.

The contextual record read mapping similarly returns existing
`context_record_perspectives` links. This exposes stored `perspectiveId`,
`stance`, and `notes` to any SourceRoot customer without adding
HistoryRoot-specific API behavior.

## Verification

Run from the repository root:

```powershell
npm.cmd --prefix .\backend run typecheck
npm.cmd --prefix .\backend test
npm.cmd --prefix .\backend run historyroot:plymouth:validate
node .\verification\historyroot-customer-experience.test.mjs
node .\VERIFY-HISTORYROOT-RESPONSIVE.mjs
powershell -ExecutionPolicy Bypass -File .\VERIFY-HISTORYROOT-CUSTOMER-EXPERIENCE-V1.ps1
```

The targeted static/DOM test covers page structure, initialization order,
live-only behavior, alias and URL helpers, uncertainty, record adaptation,
source safety, witness handling, graph bounds, accessibility hooks, and
responsive hooks. The responsive browser verifier checks all six pages at
desktop, tablet, and mobile widths for initialization, a single H1, visible
main content, status regions, and horizontal overflow.

For a live browser review, use the test database:

```powershell
Set-Location .\backend
node.exe --env-file=.env.test --import tsx src/scripts/import-historyroot-plymouth.ts
npm.cmd start
```

Serve the repository root over HTTP, review the six public pages against
`http://localhost:3000/api/v1`, then remove only the allow-listed Plymouth
bundle:

```powershell
Set-Location .\backend
node.exe --env-file=.env.test --import tsx src/scripts/remove-historyroot-plymouth.ts
```

The removal utility is bundle-scoped and preserves unrelated imported data.

## Pilot boundaries

This release is a customer-experience foundation, not a claim of completed
historical review. Source classifications and limitations are intentionally
visible. The graph is focused rather than exhaustive, search is text-based,
and no editorial authoring tools are included. The committed public experience
does not expose database credentials, environment values, stack traces, local
paths, or internal-only review files.
