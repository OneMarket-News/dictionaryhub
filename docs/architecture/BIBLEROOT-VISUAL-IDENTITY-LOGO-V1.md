# BibleRoot Logo Concept Research v1 architecture

Status: completed research and planning checkpoint within the broader future
stage **BibleRoot Visual Identity and Logo v1**. No candidate is approved or
installed, and final selection is deferred.

## Purpose and boundary

This checkpoint preserves four project-authored vector candidates and an offline
local comparison experience. It does not alter `bibleroot.html`, any other BibleRoot
production page, shared navigation, current colors, the borrowed DictionaryRoot
favicon, application icons, APIs, databases, datasets, readiness, or migrations.

The checked-out release at `52bef9bf42beb9433e28a600ba1f91f537b21a77`
is the source of truth. `docs/brand/BIBLEROOT-LOGO-DESIGN-BRIEF-V1.md` controls
the design objectives, exclusions, color territories, typography questions,
100-point rubric, and human-selection requirement.

## Read-only brand audit

### Shared family traits

- the `NameRoot` naming structure and explicit SourceRoot parent relationship
- restrained product accents on dark, neutral, or paper-like surfaces
- simple 42px header footprints with compact wordmark/tagline structures
- editorial headings paired with highly readable system-interface typography
- evidence, source, provenance, review, and verification as visible concepts
- shared Root switcher and user menu with semantic controls and visible focus
- responsive header behavior, skip links, live regions, and reduced-motion rules

### Current inconsistencies

- SourceRoot uses a plain text heading and Arial while the customer Roots use
  different header and typography systems.
- DictionaryRoot has a dedicated gradient node/root SVG; HistoryRoot reuses it
  with warm filtering rather than a distinct symbol.
- BibleRoot uses a temporary bordered `BR` square but all four production pages
  borrow the DictionaryRoot mark as their favicon.
- Wordmark suffix treatment is not systematized: names are generally one weight
  and one color even though their product accents differ.
- Header heights, symbol corner geometry, and tagline visibility vary by Root.

### BibleRoot inheritance and differentiation

BibleRoot should inherit the 42px compact footprint, `NameRoot` construction,
calm evidence-first hierarchy, shared navigation controls, simple geometry,
accessible focus, and dark/light adaptability. It should remain distinct through
a manuscript/citation/source silhouette, editorial warmth, and a flat palette
rather than the DictionaryRoot network gradient or HistoryRoot's historical
amber treatment.

The existing dark evergreen, paper, restrained gold, Georgia editorial face,
and system sans face already give BibleRoot a credible study-oriented character.
They are audit evidence only; the final palette and typography remain undecided.

### Temporary production branding and technical constraints

The `BR` square and borrowed DictionaryRoot favicon are candidates for later
replacement only after selection, refinement, conflict research, and approval.
They remain byte-identical in this round. Final SVGs must be local, deterministic,
script-free, external-reference-free, font-free, and sharp at 16 through 64px.
Header integration must preserve current script order, unique IDs, mobile scroll
behavior, Root switcher/user menu operation, skip links, and light/dark contrast.

## Candidate asset system

The four standalone symbols live under `assets/brand/bibleroot-concepts/`.
They use a `0 0 64 64` viewBox, flat `currentColor`, round caps/joins, no IDs,
and no text, gradients, filters, fonts, scripts, raster content, or external
references. HTML/CSS supplies every color and wordmark demonstration.

| Concept | Construction | Distinguishing behavior |
| --- | --- | --- |
| A — Rooted Manuscript | paired manuscript contour, textual strokes, central spine becoming three roots | strongest literal text/root connection; most vulnerable to familiar book/root territory |
| B — Verse Network | four verse lines joined by a sparse right-edge provenance path | modern evidence-system behavior without a generic radial node web |
| C — Source Seal | bold circular custody ring, internal source sheet, lower archival tails | strongest compact/print behavior; greatest publisher or institutional-seal risk |
| D — Citation Root | paired citation brackets feeding a locator stem and angular roots | most distinctive citation/source silhouette; needs optical tuning at the bracket-to-stem transition |

## Review application

`bibleroot-logo-review.html` is an offline design-review tool. Its dedicated
CSS supplies size, color, mode, wordmark, mobile-header, desktop-header, and
family comparison contexts. Its JavaScript contains only project-authored
concept metadata, initial rubric scores, rendering, and non-persistent local
score calculation. It has no fetch, storage, cookie, service worker, form
submission, database, API, remote font, analytics, or production-install path.

Native number inputs accept 0–5 scores. Weighted results are calculated as
`weight × score / 5`, announced through a polite live region, and reset when the
page reloads. Textarea notes remain in the current DOM only. Initial scores are
documented evidence, not approval. Human evaluation supersedes the abstract
ranking as the current planning signal: B is the non-binding lead, A is the
familiar control, C remains research only, and D is rejected as the primary
direction.

## Verification architecture

`VERIFY-BIBLEROOT-VISUAL-IDENTITY-LOGO.ps1` validates the exact released
baseline, active and completed/inactive checkpoint states, protected Git
identities, migration 019, migration 020 absence, immutable production assets,
SVG safety, review markers, rubric total, deferred human decision, Git hygiene,
and required regressions.
`verification/bibleroot-visual-identity-logo.test.cjs` parses the local assets,
checks all required comparison states, and exercises score calculation markers.
Browser acceptance remains separate and covers 1280x720 and 390x844.

## Deferred future stage

The broader **BibleRoot Visual Identity and Logo v1** stage may resume only
after the larger platform substantially establishes:

- SourceRoot Shared Grammar and Root Integration Contracts;
- the EarthRoot browser shell;
- multi-Root navigation and search;
- map, timeline, graph, entity, and source experiences; and
- SourceRoot family brand architecture.

Only then may a later governed stage:

1. refine the selected geometry and perform optical corrections;
2. choose the final palette and typography/suffix treatment;
3. perform SVG optimization and generate approved PNG, favicon, and application
   icon exports;
4. perform basic public-market conflict screening, while stating that it is not
   trademark or legal clearance;
5. integrate controlled light/dark and responsive production variants;
6. run visual regression, accessibility, navigation, API/data preservation, and
   all root verification;
7. obtain explicit human approval and close the governed release stage.

This research checkpoint does not choose a winner and does not authorize any
production branding change.
