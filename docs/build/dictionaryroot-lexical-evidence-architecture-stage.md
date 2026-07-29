# SourceRoot Chunk 10A — DictionaryRoot Lexical Evidence Architecture

## Implemented scope

Chunk 10A adds migration 013, normalized lexical-evidence types and storage,
a bounded deterministic fixture, replacement-safe test import, additive read
routes, DictionaryRoot API helpers, combined Home discovery, and detailed
Concept inspection. It does not generate the production corpus.

The committed fixture quality accounting is:

- 5 sources
- 10 lemmas
- 16 senses
- 22 source-specific definition claims
- 10 lexical forms
- 4 etymology proposals
- 4 reviewed or unresolved source comparisons
- 40 locators
- 72 field-provenance records
- 0 blockers, orphans, duplicate identities, or unsupported claims

## Completed automated evidence

- TypeScript typecheck: PASS
- migration 013 applied to `sourceroot_test`
- fixture generation and two replacement-safe imports: PASS
- backend architecture suite: 17/17 PASS
- targeted frontend suite: 8/8 PASS
- direct `sourceroot_test` read for `bank`: 3 deterministic senses

These completed checks were not repeated during the resumed browser/final
accounting pass unless explicitly required by a later verifier.

## Browser evidence

Environment inspected on 2026-07-29:

- frontend: `http://127.0.0.1:8010`
- backend: `http://127.0.0.1:3000`
- desktop: 1280 by 720
- mobile: 390 by 844

Observed passes:

- the existing OEWN `value` concept loaded from PostgreSQL through SourceRoot,
  retained source attribution and provenance links, had no horizontal
  overflow at desktop, and produced no console warnings or errors;
- HistoryRoot remained live at 390 by 844, retained its product identity,
  navigation, live dataset counts, uncertainty language, and customer
  content, had no horizontal overflow, and produced no console warnings or
  errors;
- the fixture concept failure state remained bounded at 390 by 844 and
  produced no horizontal overflow or console warnings/errors.

After the manually managed backend was corrected to use `backend/.env.test`,
the live fixture smoke passed:

- Home returned all three `bank` senses and handled the test environment's
  absent OEWN corpus with explicit no-fallback coverage states;
- Concept grouped two noun senses and one verb sense;
- bank detail displayed two source-specific claims and locators, two lexical
  forms, eight field-provenance records, and a reviewed source comparison;
- island detail kept two competing proposals separate, including qualified,
  uncertain, reviewed-fixture, and unresolved states;
- logos detail displayed explicit semantic-range uncertainty and an unresolved
  source comparison;
- desktop 1280 by 720 and mobile 390 by 844 had no horizontal overflow; and
- browser console inspection returned no page warnings or errors.

No service was started, stopped, restarted, replaced, detached, or moved to
another port by this stage.

## Closure

All automated, deterministic, documentation, quality-accounting, and manual
browser acceptance is complete. Final closure consists of the Git-backed root
verifier, read-only diff/index accounting, root-stage completion, and the
inactive root verifier.

No Git mutation or service-management action occurred.
