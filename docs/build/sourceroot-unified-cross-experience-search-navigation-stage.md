# SourceRoot Chunk 11 Stage Evidence

## Scope

Chunk 11 adds unified read/search and navigation only. The active Root stage
authorizes explicit backend, customer-page, shared navigation, focused test,
documentation, browser evidence, and verifier files. It does not authorize a
migration, corpus, package, installer, authentication/account change,
editorial write API, BibleRoot implementation, or Git mutation.

## Starting-gate reconciliation

The mandatory current-checkpoint gates passed. Three frozen historical
release-boundary assertions were explicitly superseded by the user and are
not reported as passes:

1. Chunk 10B verifier expected historical commit `31b73c4f...` instead of
   accepted current commit `49a75dff...`.
2. Chunk 10B verifier required its completed stage to remain active.
3. Chunk 9 HistoryRoot suite rejected later accepted shared-asset changes.

Accepted preservation evidence:

- root repository verifier: 51 passes, 0 warnings, 0 failures
- DictionaryRoot baseline: 23 passes, 0 warnings, 0 failures
- DictionaryRoot current focused backend: 15 passes
- DictionaryRoot current focused frontend: 8 passes
- HistoryRoot substantive preservation: 40 passes
- DictionaryRoot release ZIP: 264507 bytes,
  `E7640A0337F084D1EFFCFDC3B340A3AD7611FBA6E089ED2078B0AFE97EEAD8C0`
- HistoryRoot release ZIP:
  `D4E11DD28EECC46BEFA76E3E4805BB8CDB6F8C8EE57FA07C72BEB898DF409D29`
- fixture distribution: 12 relationships, 13 evidence rows, 7 symmetric,
  5 directional
- legacy lexicon tables: 0 / 0 / 0

The historical verifiers remain unchanged.

## Implemented architecture

`GET /api/v1/search/unified` composes:

- `searchDictionaryRootLexicalEvidence`
- `searchKnowledge` filtered to the accepted HistoryRoot bundle/domain

The existing SourceRoot search store received only a backward-compatible
internal multi-type option and count metadata. The DictionaryRoot lexical
read received exact-count metadata. Neither change writes data or changes a
public legacy parameter.

The unified adapter owns normalization, stable IDs, bounded summaries,
canonical URLs, match explanations, exact Root/classification counts,
deterministic sorting, duplicate prevention, page slicing, timeouts, and
availability state.

## Focused evidence to date

- TypeScript typecheck: pass
- unified backend: 13/13
- unified frontend/static accessibility: 12/12
- changed customer JavaScript syntax: pass
- active Root verifier after stage creation: 51/0/0
- supported backend regression: 21/21
- DictionaryRoot current focused backend: 15/15
- DictionaryRoot current focused frontend: 8/8
- DictionaryRoot lexical relationships backend: 15/15
- DictionaryRoot lexical relationships frontend: 8/8
- HistoryRoot Plymouth: 18/18
- HistoryRoot current bounded substantive checks: 39/39

The broad legacy `npm test` wrapper was inspected separately. It is not a
supported current-checkpoint gate because it combines database-resetting
suites with frozen stage/checkpoint assertions. Its historical failures were
not relabeled as passes. The supported current suites above passed
independently, and the accepted DictionaryRoot and HistoryRoot datasets were
restored and rechecked afterward.

## Browser evidence

- desktop viewport: `1280x720`
- mobile viewport: `390x844`
- live queries: `bank`, `Plymouth`, and mixed term `community`
- Root filters, result-type filters, pagination, Back, Forward, and Refresh:
  pass
- SourceRoot entry, DictionaryRoot/HistoryRoot switchers and breadcrumbs:
  pass
- two-way contextual discovery and non-equivalence disclaimers: pass
- standalone Root detail pages: pass
- console errors: 0
- attributable warnings: 0
- horizontal page overflow: 0
- desktop screenshot:
  `verification/chunk11-unified-search-desktop.png`
- mobile screenshot:
  `verification/chunk11-unified-search-mobile.png`

## Current-checkpoint preservation

The final Chunk 11 verifier directly checks the present repository checkpoint,
not the three frozen historical release-stage assertions. It validates:

- HEAD, branch, and remote at accepted commit
  `49a75dff63c7f7d3fc3f1c7277cabb5b9ebc0b0e`
- active bounded Chunk 11 stage identity before completion
- migrations 001-014 present and byte-identical, with migration 015 absent
- DictionaryRoot corpus identity `dictionaryroot-core-lexical-corpus-v1`
  version `1.0.0`
- HistoryRoot corpus identity
  `historyroot-plymouth-knowledge-dataset-v1` version `1.3.0`
- accepted DictionaryRoot ZIP length and SHA-256
- accepted HistoryRoot ZIP SHA-256
- DictionaryRoot and HistoryRoot corpus paths unchanged from the checkpoint
- fixture distribution unchanged
- `sourceroot_test` dataset versions exact
- fixture-only datasets, three legacy lexicon tables, and generic
  DictionaryRoot nodes all at zero
- supported current focused preservation suites
- the live existing DictionaryRoot coverage and HistoryRoot search APIs

The implementation also contains no persisted cross-Root claim, fallback
product data, automatic lexical sense selection for a historical term,
migration 015, repository ZIP, or write SQL in the unified adapter.

## Final verification

- Chunk 11 verifier: 31 passes, 0 warnings, 0 failures
- active root repository verifier: 51 passes, 0 warnings, 0 failures
- supported backend regression: 21 passed
- HistoryRoot Plymouth preservation: 18 passed
- HistoryRoot current substantive preservation: 39 passed
- DictionaryRoot lexical relationships: 15 backend + 8 frontend passed
- DictionaryRoot current checkpoint: 15 backend + 8 frontend passed
- Chunk 11 focused suites: 13 backend + 12 frontend passed
- final live API probes: health, DictionaryRoot `bank`, HistoryRoot
  `Plymouth`, mixed `community`, existing coverage, and existing HistoryRoot
  search passed
- final database state: `sourceroot_test`, DictionaryRoot `1.0.0`,
  HistoryRoot `1.3.0`, migration 015 absent, fixture exclusion intact,
  legacy tables 0 / 0 / 0, generic DictionaryRoot nodes 0
- unresolved manual browser checks: none
- Git mutations: none

The inactive root verifier result and completed-stage path are recorded after
the completion tool closes the stage.
