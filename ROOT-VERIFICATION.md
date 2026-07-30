# DictionaryRoot Verification Contract

## Philosophy

Verification must be deterministic where the repository can determine the
answer and explicit where it cannot. A PASS means the named condition was
actually tested in the current run. WARN identifies an incomplete or
unavailable check. FAIL identifies a violated acceptance condition and must
produce a nonzero exit.

Do not convert missing tools, inaccessible services, skipped tests, or
ambiguous dynamic behavior into PASS results.

## Acceptance hierarchy

```text
File validation
-> static structure validation
-> JavaScript validation
-> protected-functionality validation
-> stage verification
-> repository verification
-> browser verification
-> live API verification
```

Passing an earlier layer does not prove a later layer. In particular, static
repository verification does not prove browser or live API behavior.

## Deterministic checks

`VERIFY-ROOT-REPOSITORY.ps1` covers:

- governance-file existence and JSON parsing
- required manifest sections and safe repository-relative paths
- active-stage specification and allowed-file scope
- existence of declared experiences, shared assets, verifiers, and installers
- duplicate static HTML IDs
- local script, stylesheet, and icon references
- references into excluded paths
- protected script initialization order
- Windows PowerShell parsing of the foundation scripts
- JavaScript syntax through `node --check` when Node.js is available
- prohibited runtime fallback patterns
- discovery of existing root verifiers
- pass, warning, failure, and exit-code reporting

It does not start the backend, inspect a database, open a browser, or prove a
live API response.

## Stage verification

Every active stage declares required verifiers. Stage verifiers should test
the smallest complete acceptance surface for that change. New protected
functionality must add or extend deterministic coverage and document any
manual browser or live-service checks.

`COMPLETE-ROOT-STAGE.ps1` runs required verifiers before moving a stage unless
the caller explicitly uses `-SkipVerification`. A skipped check must be
recorded as skipped, never passed.

## Browser verification

Browser testing must cover the pages and behavior changed by the stage,
including:

- rendered layout at relevant viewport sizes
- shared navigation and cross-page links
- URL state, deep links, back, and forward
- keyboard and focus behavior
- loading, empty, retry, and offline states
- console errors and warnings
- visual or interaction regressions named by the active stage

Record the actual pages, parameters, viewport, environment, and observed
result. If no browser was opened, report that the check was not performed.

## Live API verification

Live testing must identify the API base and non-secret environment, confirm
that responses came from SourceRoot, exercise changed routes or query
semantics, and verify failure/offline behavior where relevant. Do not embed
credentials or database URLs in logs or context exports.

If the backend was not running or the API was not called, report that live
integration was not verified.

## Failure reporting

Failures must name the check, affected path or capability, observed condition,
and required correction. Preserve user changes. Do not reset the repository
or automatically rewrite customer files to force verification to pass.

## Changed-file scope and preflight state

The active stage records `allowed_files` and may record
`preflight_changed_files`. The changed-file tool includes tracked, staged,
and untracked non-ignored paths. Repository verification fails for a changed
path that is neither allowed nor recorded as pre-existing.

Pre-existing changes remain visible and are not reset. Later stages should
capture their preflight list before editing so they can distinguish inherited
work from newly unauthorized scope.

## Avoiding false PASS claims

- Treat missing Node.js as WARN for JavaScript syntax.
- Treat dynamic references that cannot be resolved statically as INFO or WARN.
- Do not call a skipped existing verifier successful.
- Preserve and report child-process exit codes.
- Keep manual and automated results separate.
- Add verification when a new capability becomes protected.

## Chunk 10A lexical evidence verification

`VERIFY-SOURCEROOT-DICTIONARYROOT-LEXICAL-EVIDENCE-ARCHITECTURE.ps1`
validates the normalized migration markers, fixture-only identity, exact
quality accounting, additive routes and client helpers, customer evidence
sections, and the architecture contract. It deliberately does not manage a
backend or frontend service.

The focused backend suite separately proves deterministic repository equality,
fresh-schema migration behavior, migration-ledger order, replacement-safe
import and rollback, HistoryRoot/OEWN preservation, pagination, detail
composition, competing etymologies, comparisons, empty resources, and
malformed pagination. The focused frontend suite covers syntax, bounded
pagination, combined live results, part-of-speech grouping, evidence families,
empty states, uncertainty, locators, provenance, responsive styles, and
protected integrations.

Manual browser acceptance must use both 1280-by-720 and 390-by-844 viewports.
It must inspect fixture search and detail content, result handling, horizontal
overflow, console output, an existing OEWN concept, and HistoryRoot. A healthy
`/health` response does not prove the evidence routes are connected to the
database containing migration 013 and the fixture.

## Chunk 10B prerequisite lexical relationship verification

`VERIFY-SOURCEROOT-DICTIONARYROOT-LEXICAL-RELATIONSHIP-ARCHITECTURE.ps1`
checks migration 014, the fixture relationship/evidence counts, canonical
symmetry markers, graph routes and customer integration, typecheck, the
15-check focused backend suite, the 8-check targeted frontend suite, and the
17-check Chunk 10A backend suite.

Database tests cover fresh-schema migration, exact migration ledger,
cross-dataset rejection, self and reverse-symmetric rejection, evidence
support, duplicate-safe replacement, rollback, APIs, graph determinism,
bank/island/logos behavior, HistoryRoot 1.3.0, and empty legacy lexicon
tables. Browser acceptance remains separate and must probe both managed
services before desktop and mobile smoke.
