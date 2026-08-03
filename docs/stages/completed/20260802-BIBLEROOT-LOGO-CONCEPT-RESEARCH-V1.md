# BibleRoot Logo Concept Research v1

## Stage identity

- Name: BibleRoot Logo Concept Research v1
- Slug: BIBLEROOT-LOGO-CONCEPT-RESEARCH-V1
- Status: active
- Started: 2026-08-02

## Objective

Preserve four original BibleRoot logo concepts, the governed comparison
experience, and the human evaluation as a completed research and planning
checkpoint. No concept is approved and final selection and production
integration remain deferred to the broader future stage, **BibleRoot Visual
Identity and Logo v1**.

## Business value

Preserves four independently authored and consistently tested identity
directions for later family-wide comparison. The checkpoint records current
human judgment without converting abstract scoring into approval or changing a
customer experience.

## Current source of truth

The checked-out repository at released HEAD
`52bef9bf42beb9433e28a600ba1f91f537b21a77` is canonical. The controlling
design input is `docs/brand/BIBLEROOT-LOGO-DESIGN-BRIEF-V1.md`. Current
SourceRoot, DictionaryRoot, HistoryRoot, and BibleRoot pages and shared assets
are read-only audit inputs. No backup, generated package, completed stage, or
external artwork is an implementation source.

## Allowed files

- `assets/brand/bibleroot-concepts/bibleroot-concept-a-rooted-manuscript.svg`
- `assets/brand/bibleroot-concepts/bibleroot-concept-b-verse-network.svg`
- `assets/brand/bibleroot-concepts/bibleroot-concept-c-source-seal.svg`
- `assets/brand/bibleroot-concepts/bibleroot-concept-d-citation-root.svg`
- `assets/css/bibleroot-logo-review.css`
- `assets/js/bibleroot-logo-review.js`
- `bibleroot-logo-review.html`
- `docs/architecture/BIBLEROOT-VISUAL-IDENTITY-LOGO-V1.md`
- `docs/brand/BIBLEROOT-LOGO-CONCEPT-REVIEW-V1.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260802-BIBLEROOT-LOGO-CONCEPT-RESEARCH-V1.md`
- `ROOT-MANIFEST.json`
- `verification/bibleroot-logo-concepts-desktop.png`
- `verification/bibleroot-logo-concepts-mobile.png`
- `verification/bibleroot-visual-identity-logo.test.cjs`
- `VERIFY-BIBLEROOT-VISUAL-IDENTITY-LOGO.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- `AGENTS.md`, `ROOT-ARCHITECTURE.md`, `ROOT-PROTECTED-FUNCTIONALITY.md`,
  `ROOT-VERIFICATION.md`, and `ROOT-MANIFEST.json`
- `docs/brand/BIBLEROOT-LOGO-DESIGN-BRIEF-V1.md`
- current SourceRoot, DictionaryRoot, HistoryRoot, and BibleRoot presentation,
  typography, navigation, favicon, icon, and accessibility implementations
- released migration 019 and Chunk 14A/14B identities and regressions

## Required behavior

- Create exactly four original standalone vector symbols: Rooted Manuscript,
  Verse Network, Source Seal, and Citation Root.
- Compare every concept at 16, 24, 32, 48, 64, and 128 pixels; in one color,
  grayscale, light/dark contexts, and all four brief-defined color territories.
- Demonstrate wordmark and navigation treatments with live repository-permitted
  HTML/CSS typography, not embedded SVG text or font files.
- Preserve the exact 100-point rubric, evidence-led initial scores, editable
  local non-persistent score controls, and the recorded human evaluation.
- State that no concept is approved, B is the current non-binding lead, A is
  the familiar control, C remains research but does not advance as the primary
  public identity, and D is rejected as the primary direction.
- Complete this research checkpoint through the normal stage lifecycle without
  selecting or installing a winner.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. In
particular, current BibleRoot pages, branding, favicon, application icons,
palette, navigation, API/data/readiness layers, migration 019, and all
immutable source artifacts remain byte-identical. Migration 020 remains
absent. The review page is local, makes no remote request, stores no data, and
cannot install or automatically select a winner.

## Non-goals

- final logo or palette selection; final typography treatment
- production logo, favicon, application-icon, or page integration
- outlined wordmarks, PNG export packages, social assets, or print masters
- trademark or legal clearance, downloaded assets, or commercial fonts
- database, API, dataset, readiness, runtime-provisioning, or migration work
- Chunk 14C, EarthRoot, cross-Root exploration, commit, tag, push, or release

## Dependencies

- released Chunk 14B commit and tag, clean preflight, and readiness contract 1.4.0
- Windows PowerShell 5.1, Git, Node.js, a local static server, and a browser
- future completion of shared SourceRoot grammar, EarthRoot shell, multi-Root
  navigation/search, core evidence experiences, and family brand architecture

## Risks

- book/root and seal categories can become generic, denominational, publisher-like,
  governmental, AI-like, or cryptocurrency-like
- detail can collapse at favicon scale or reverse poorly in dark mode
- color and typography can imply authority or tradition not supported by SourceRoot
- local originality review is not trademark clearance
- temporary review code must never be mistaken for production fallback branding

## Acceptance criteria

1. The allowed boundary contains exactly 16 paths; the reserved completed-stage
   path remains absent and every changed or ignored artifact is in scope.
2. Exactly four parseable, script-free, text-free, filter-free, gradient-free,
   external-reference-free SVGs use original pure-vector geometry and valid
   `viewBox` values.
3. The review page references all four candidates and exposes every required
   size, mode, palette, wordmark, navigation, family, risk, rubric, and local
   notes comparison without persistence or remote requests.
4. Rubric weights total exactly 100; all four concepts have evidence-led scores,
   the human evaluation is recorded exactly, and no score or lead constitutes
   approval.
5. Desktop 1280x720 and mobile 390x844 browser checks pass with no overflow,
   broken SVG, remote request, console error/warning, focus trap, or hidden focus.
6. The focused verifier, required current-compatible regressions, and root
   verifier pass; `git diff --check` passes; the index is empty and unlocked.
7. The completed research record states that final selection is deferred; the
   manifest becomes inactive and `CURRENT-STAGE.md` is removed through lifecycle
   tooling without a production asset, commit, tag, push, or ZIP.

## Required verifier

- `VERIFY-BIBLEROOT-VISUAL-IDENTITY-LOGO.ps1`
- `VERIFY-ROOT-REPOSITORY.ps1`

## Manual browser checks

Serve `bibleroot-logo-review.html` locally and inspect at 1280x720 and 390x844.
Verify all concepts and size samples, light/dark/monochrome/color comparisons,
wordmark and family rows, keyboard-operable score controls, live totals, local
notes, visible focus, semantic headings, reduced motion, no focus trap, no
horizontal overflow, no broken references, no console errors or warnings, and
no remote requests. Capture the two ignored screenshots declared above.

## Live API checks

Not applicable. This review tool is deliberately offline and must make no API
or remote request. Released API and readiness behavior are regression-only.

## Required output

- four exact candidate SVGs and their byte, SHA-256, and Git no-filter identities
- architecture/audit and concept/evaluation documentation
- the accessible local review page and dedicated CSS/JavaScript
- focused PowerShell and Node contract verification
- ignored desktop/mobile screenshots and recorded browser/console evidence
- exact completed-stage, changed-path, Git/index/lock/process, regression, and
  deferred-selection evidence

## Completion record

Created by `tools/COMPLETE-ROOT-STAGE.ps1` after required active-state
verification. Completion closes only **BibleRoot Logo Concept Research v1**.
The broader **BibleRoot Visual Identity and Logo v1** work remains future work
and no candidate becomes an approved or installed identity.

## Deferred future-stage entry conditions

Resume logo refinement and final selection only after substantial completion of:

- SourceRoot Shared Grammar and Root Integration Contracts
- EarthRoot browser shell
- multi-Root navigation and search
- map, timeline, graph, entity, and source experiences
- SourceRoot family brand architecture

## Completion record

- Completion date: 2026-08-02T20:03:14.7812933-05:00
- Verification skipped: False

### Verifier results

- VERIFY-BIBLEROOT-VISUAL-IDENTITY-LOGO.ps1 -> exit 0
- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0

### Changed files

- `assets/brand/bibleroot-concepts/bibleroot-concept-a-rooted-manuscript.svg`
- `assets/brand/bibleroot-concepts/bibleroot-concept-b-verse-network.svg`
- `assets/brand/bibleroot-concepts/bibleroot-concept-c-source-seal.svg`
- `assets/brand/bibleroot-concepts/bibleroot-concept-d-citation-root.svg`
- `assets/css/bibleroot-logo-review.css`
- `assets/js/bibleroot-logo-review.js`
- `bibleroot-logo-review.html`
- `docs/architecture/BIBLEROOT-VISUAL-IDENTITY-LOGO-V1.md`
- `docs/brand/BIBLEROOT-LOGO-CONCEPT-REVIEW-V1.md`
- `docs/stages/completed/20260802-BIBLEROOT-LOGO-CONCEPT-RESEARCH-V1.md`
- `ROOT-MANIFEST.json`
- `VERIFY-BIBLEROOT-VISUAL-IDENTITY-LOGO.ps1`

### Unresolved manual checks

- Final BibleRoot logo selection and production integration are intentionally deferred until the larger SourceRoot platform, EarthRoot shell, shared Root interfaces, core evidence experiences, and family-wide brand architecture are substantially built.

### Completion notes

Completed BibleRoot Logo Concept Research v1 as a research and planning checkpoint. Preserved all four concepts and review artifacts; recorded B as the non-binding lead, A as the familiar control, C as research not advanced for the primary public identity, and D as rejected for the primary direction. No concept was approved or installed, and BibleRoot Visual Identity and Logo v1 remains a future stage.
