# SourceRoot Before-15A Maintenance v1

## Stage identity

- Name: SourceRoot Before-15A Maintenance v1
- Slug: SOURCEROOT-BEFORE-15A-MAINTENANCE-V1
- Status: active
- Started: 2026-08-08

## Objective

Repair release-aware behavior in the 14A, 14B, and 14C focused verifiers; repair the 14A and 14B database test setup and cleanup lifecycle so they reuse rather than destroy prerequisites that later released work legitimately references; enforce UTF-8 without BOM and LF line endings for future mutable lifecycle artifacts through .gitattributes and the three stage lifecycle writers; and make stage completion idempotent so exactly one completion record heading is produced. Tooling and test maintenance only: no product semantics, contracts, migrations, or released data change.

## Business value

Before this stage the three focused Cross-Root verifiers could only pass during
the development window of their own chunk. They asserted that HEAD was still
their pre-commit baseline and that no later release tag existed, so committing
the very work they guarded turned them permanently red. Verifiers that cannot
survive their own release stop being evidence and start being noise, and the
next chunk inherits a red repository it cannot distinguish from real breakage.

The same class of defect existed in the database test lifecycle: suites that
TRUNCATE shared tables ran in an order that destroyed the canonical Cross-Root
baseline later suites depend on, so results varied with run order rather than
with correctness.

This stage restores all four verifiers to durable, deterministic, repeatable
evidence before Chunk 15A begins, and does so without touching product code,
contracts, migrations, schema, importers, or released data.

## Current source of truth

The checked-out repository is canonical. The released 14A, 14B, and 14C commits
and their release tags are the historical source of truth for what each release
actually was; the current working tree is the source of truth for what must
still hold today. No backup, generated package, or completed stage record was
used as an implementation source.

## Allowed files

- `.gitattributes`
- `backend/test/bibleroot-commentary-provenance.test.ts`
- `backend/test/cross-root-lexical-evidence.test.ts`
- `backend/test/cross-root-source-backed-relationships.test.ts`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260809-SOURCEROOT-BEFORE-15A-MAINTENANCE-V1.md`
- `ROOT-MANIFEST.json`
- `tools/COMPLETE-ROOT-STAGE.ps1`
- `tools/NEW-ROOT-STAGE.ps1`
- `tools/SET-ACTIVE-ROOT-STAGE.ps1`
- `VERIFY-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE.ps1`
- `VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1`
- `VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- The three focused verifiers listed above, plus `tools/VERIFY-ROOT-REPOSITORY.ps1`
  (read-only; not modified by this stage).
- `ROOT-MANIFEST.json` active-stage declaration and known-verifier registry.
- The released 14A/14B/14C commits, their release tags, and their recorded
  parents, read through Git.
- The committed canonical Cross-Root datasets under
  `backend/data/cross-root-link-foundation-v1/` and
  `backend/data/cross-root-source-backed-relationships-v1/`.
- The committed DictionaryRoot core corpus under
  `backend/data/dictionaryroot-core-lexical-corpus-v1/`, including
  `hashes.json` and `prepared-source-accounting.json`.
- An authorized `sourceroot_test` environment, supplied at run time and never
  copied into this checkout.

## Required behavior

### 1. Release-aware verifiers

Each focused verifier now separates two things that were previously conflated:

- **HISTORICAL RELEASE FACTS** — what the release actually was. These are read
  at the released commit and tree (tag resolution, exact recorded parent,
  ancestry, the release's own file inventory, byte lengths, SHA-256 digests,
  and no-filter Git blob identities). They never change.
- **DURABLE SEMANTIC INVARIANTS** — what must still hold today. These are read
  against the current working tree and the current database.

The previous assertions that HEAD equalled a pre-commit baseline, and that no
later release tag existed, were true only during that chunk's development
window. They are replaced by ancestry and tag-resolution assertions that stay
true after the release and after every later release.

### 2. Allowlist containment, not equality

A stage allowlist is a **permission superset**, not a manifest of what a release
had to change. The correct assertion is therefore containment — the release
inventory must be a subset of the allowlist — not set equality. The 14A verifier
previously asserted equality and failed on a legitimate release that used fewer
files than it was permitted to use.

### 3. Deterministic database lifecycle

`resetTestDatabase()` TRUNCATEs shared tables and is called by fourteen test
files. Gate ordering, not luck, therefore decides whether the current
Cross-Root suites see canonical data. The 14A and 14B verifiers now:

1. Prove the target database identity before any mutation.
2. Run every reset-owning legacy regression FIRST.
3. Perform one explicit final reset.
4. Provision canonical state in strict dependency order (HistoryRoot regional
   corpus, DictionaryRoot core lexical corpus, BibleRoot Foundation, Original
   Language, Translation Comparison, Commentary Provenance, Cross-Root 14A
   lexical evidence, Cross-Root 14B source-backed relationships).
5. Only then run the current Cross-Root semantic suites.
6. Assert a final postcondition: `sourceroot_test` is left FULLY PROVISIONED at
   the canonical 14A/14B baseline and readiness contract version 1.4.0 — not
   empty, and not partially restored.

### 4. Test-only corrections in the 14A and 14B suites

Following an independent Codex arbitration whose verdict was TEST-ONLY
CORRECTION, the two Cross-Root suites were corrected without changing any
importer, schema, or service:

- **14A test 4** is now conditional on `datasetWasProvisioned`, so it asserts
  provisioning outcomes only when this run actually performed the provisioning.
- **14A test 5** was rewritten as a transactional rollback rather than a
  destructive delete, so the suite no longer removes canonical evidence rows
  that later released work legitimately references.
- **14A test 5b** is new: it proves the `ON DELETE RESTRICT` foreign-key
  behavior directly. PostgreSQL raises SQLSTATE **23001 `restrict_violation`**
  for a RESTRICT violation, not 23503 `foreign_key_violation`; the test asserts
  23001, which is the truth of the released schema, with a comment recording
  why.
- Both suites now validate and reuse prerequisites instead of recreating them.
- Readiness expectations are bound to the typed
  `DevelopmentRuntimeReadiness["contractVersion"]` value `"1.4.0"` rather than
  to a stale literal.

### 5. LF convention for mutable lifecycle artifacts

`.gitattributes` gains three narrow rules:

```
ROOT-MANIFEST.json text eol=lf
docs/stages/active/CURRENT-STAGE.md text eol=lf
docs/stages/templates/ROOT-STAGE-TEMPLATE.md text eol=lf
```

These deliberately EXCLUDE `docs/stages/completed/**`, so the already-released
14C completion record and every other historical stage record keep their exact
committed bytes and are never renormalized.

The three lifecycle writers (`NEW-ROOT-STAGE.ps1`, `SET-ACTIVE-ROOT-STAGE.ps1`,
`COMPLETE-ROOT-STAGE.ps1`) normalize before writing:

```powershell
$Normalized = $Content -replace "`r`n", "`n" -replace "`r", "`n"
```

so PowerShell tooling can no longer reintroduce CRLF drift into
`ROOT-MANIFEST.json`.

### 6. Completion idempotence

`COMPLETE-ROOT-STAGE.ps1` truncates at the LAST `## Completion record` heading
before appending, so re-running completion produces exactly one completion
record rather than an accumulating stack of them.

### 7. Verifier environment portability

Both database verifiers accept an optional `-TestEnvFile` and an optional
`-DictionaryPilotFile`, with matching `SOURCEROOT_TEST_ENV_FILE` and
`SOURCEROOT_DICTIONARY_PILOT_FILE` environment overrides. Precedence is
parameter, then environment override, then checkout-local default.

With no override the behavior is byte-for-byte what it was: `backend/.env.test`
and `npm run <script>`. With an override the SAME command text is read from
`package.json` and executed directly with only the `--env-file` argument
substituted, and `node_modules/.bin` is prepended to PATH exactly as npm does,
so which suite runs and what it asserts are unchanged. `package.json` is never
modified. No machine-specific path is stored in either verifier, and the
resolved path, its contents, and `DATABASE_URL` are never printed.

## Protected behavior

`ROOT-PROTECTED-FUNCTIONALITY.md` applies in full. Stage-specific protections:

- **No product or runtime change.** Nothing under `backend/src/`,
  `backend/db/migrations/`, `backend/data/`, or `package.json` was modified.
  `git status` shows no source file in the changeset.
- **The Chunk 10B migration-boundary guard remains intact.**
  `backend/src/scripts/import-dictionaryroot-core-lexical-corpus.ts` requires
  `migration_015_count = 0` and therefore refuses to run on any database
  carrying migration 015+, which `sourceroot_test` necessarily does because
  14A/14B depend on it. That guard was NOT modified, weakened, suppressed, or
  bypassed. Both verifiers instead provision through
  `validateDictionaryRootCoreCorpus()` + `saveDictionaryRootCoreLexicalCorpus()`,
  which was classified read-only before adoption and proven to be the released
  provisioning composition rather than a lower-level internal:
  1. It is what the release CLI itself calls
     (`import-dictionaryroot-core-lexical-corpus.ts` line 60).
  2. It is what `provisionDevelopmentRuntime()` calls, and what three released
     test suites call directly.
  3. It reads the same canonical prepared dataset
     (`backend/data/dictionaryroot-core-lexical-corpus-v1/corpus.json`) with
     strictly stronger validation: hash-manifest identity, per-artifact byte
     length and SHA-256, dataset identity, bundle identity, version, status,
     `fixtureOnly`, and the exact release counts
     `[17, 500, 1014, 1145, 722, 722]`.
  4. It is transactional and idempotent: BEGIN, delete prior core/fixture
     datasets under `ON DELETE CASCADE`, insert, COMMIT, with ROLLBACK on any
     error.
  5. The only CLI check it does not reproduce is the migration-015 release
     boundary. Every data-integrity check is preserved or strengthened, and the
     CLI's `sourceroot_test` requirement is enforced independently by
     `Assert-TestDatabaseIdentity` before any mutation occurs.
  6. Using it required zero product, importer, schema, or source changes.
  `provisionDevelopmentRuntime()` itself is deliberately NOT used: it requires
  `NODE_ENV=development` and database name `sourceroot`, so it cannot and must
  not target `sourceroot_test`.
- **Released 14C bytes are frozen.** The 14C verifier still asserts that the
  released contract surface is byte-identical to the release, and the
  `.gitattributes` rules exclude `docs/stages/completed/**` so no historical
  record is renormalized.
- **Released assertion wording is preserved.** The 14C static suite pins the
  verifier message string `Intended ignored stage artifact exists on disk`.
  The wording was kept and only the assertion semantics were corrected, so the
  released static suite did not have to be reopened.
- **`tools/VERIFY-ROOT-REPOSITORY.ps1` is unmodified.**
- **Global Git configuration is unmodified.**

## Non-goals

- Any change to importers, migrations, schema, foreign-key behavior, product or
  runtime code, `backend/data`, or `package.json`.
- Weakening, relaxing, or deleting any assertion in order to make a verifier
  pass.
- Merging Roots, introducing shared identity, or any Chunk 15A work.
- Creating `.env.test` inside this checkout, or committing any absolute,
  machine-specific path.
- Downloading or regenerating the DictionaryRoot OEWN pilot artifact from the
  network.
- Modifying the primary repository or Josh-Brain.

## Dependencies

- Windows PowerShell 5.1 with `Set-StrictMode -Version Latest`.
- Node.js with the repository's `scripts/register-tsx.mjs` loader.
- PostgreSQL, reachable only as an explicitly proven `sourceroot_test`.
- Git, with the 14A, 14B, and 14C release tags present.
- Completed stages 14A, 14B, and 14C.

## Risks

- **Wrong database.** Mitigated by `Assert-TestDatabaseIdentity`, which proves
  `current_database() = sourceroot_test` through the repository's own database
  stack before any migration, reset, or provisioning. The environment filename
  is never treated as proof, and the verifier exits before mutating anything if
  identity cannot be proven.
- **Order-dependent test results.** Mitigated by the explicit lifecycle and the
  final canonical postcondition.
- **CRLF drift reintroduced by tooling.** Mitigated by writer-side
  normalization plus the narrow `.gitattributes` rules.
- **Credential leakage.** Mitigated by never copying, printing, or committing
  the environment file, its contents, or `DATABASE_URL`.
- **Pilot artifact residue.** The pilot artifact is Git-ignored and absent from
  isolated clones. A supplied copy is accepted only after its byte length and
  full SHA-256 match the committed accounting; any copy the verifier
  materializes is removed afterwards; a pre-existing local artifact is never
  touched; nothing is downloaded.

## Incident record

Two `sourceroot_test` incidents occurred during this stage and were both fully
resolved before completion.

1. **Environment STOP.** Work halted at the declared STOP condition when no
   authorized test environment could be proven from this checkout. Nothing was
   invented, copied, or guessed. The orchestrator then explicitly authorized
   READ-ONLY use of the primary repository's existing `.env.test`, and the
   portability mechanism in section 7 above exists so that authorization never
   requires copying credentials into this clone.
2. **Single-row deletion.** The pre-correction 14A test 5 destructively deleted
   one canonical evidence row
   (`cr-evidence-a024391dba8ea77c04a8e9f8dfe61223`). A controlled restoration
   was separately authorized and performed: database identity proven, then
   prechecks confirming exactly one missing row and zero unexpected extra rows
   against the committed canonical dataset file, then a single transaction
   containing one INSERT taken verbatim from the committed dataset, then a full
   canonical recount BEFORE COMMIT, committing only when every 14A and 14B count
   matched exactly. No value was invented. Test 5 was then rewritten as a
   transactional rollback so the deletion cannot recur.

A third finding was a derivation error of mine, not a database defect: the 14B
"uncertain 143" figure derives from `uncertainty_statement IS NOT NULL`, not
from `certainty = 'uncertain'`. The postcondition query uses the correct
derivation.

## Acceptance criteria

1. `VERIFY-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE.ps1`
   reports 0 failures.
2. `VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1`
   reports 0 failures.
3. `VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1`
   reports 0 failures.
4. `tools/VERIFY-ROOT-REPOSITORY.ps1` reports 0 failures, including the
   active-stage changed-file scope check.
5. Both database verifiers leave `sourceroot_test` fully provisioned at the
   canonical 14A/14B baseline and readiness 1.4.0, asserted as an explicit
   final postcondition.
6. Backend typecheck passes.
7. The released 14C suites are unchanged and still pass: 115 backend contract
   tests and 44 static semantic-safety tests.
8. The 14A and 14B static suites pass at 10 tests each; the 14A backend suite
   passes at 9 and the 14B backend suite at 12.
9. Every modified PowerShell file parses under Windows PowerShell 5.1.
10. `git diff --check` reports no whitespace error, the Git index is empty, and
    no file outside the 13-file allowlist is modified.
11. No file under `backend/src/`, `backend/db/migrations/`, `backend/data/`, or
    `package.json` appears in the changeset.

## Required verifier

- `VERIFY-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE.ps1`
- `VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1`
- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1`

## Manual browser checks

Not applicable. This stage changes only verifiers, stage lifecycle tooling,
test files, and `.gitattributes`. No page, script, style, asset, or runtime
behavior is touched, so there is no rendered surface whose change could be
observed in a browser. Frontend static suites are still executed by the
verifiers as deterministic checks.

## Live API checks

Not applicable. No route, handler, contract, or response shape is modified. The
API surface exercised by the released suites is executed through those suites
against `sourceroot_test`, not against any live or deployed environment.

## Required output

- The three corrected focused verifiers, each reporting 0 failures.
- The corrected `backend/test/cross-root-lexical-evidence.test.ts` (9/9),
  `backend/test/cross-root-source-backed-relationships.test.ts` (12/12), and
  `backend/test/bibleroot-commentary-provenance.test.ts` (readiness expectation
  corrected from a stale `1.3.0` literal to the typed `1.4.0` value).
- The three normalizing, idempotent stage lifecycle writers.
- The narrow `.gitattributes` LF rules.
- `ROOT-MANIFEST.json` recording the 13-file allowlist, in LF.
- This stage record and the completion record produced by
  `COMPLETE-ROOT-STAGE.ps1`.

## Completion record

- Completion date: 2026-08-09T08:41:09.1636619-05:00
- Verification skipped: False

### Verifier results

- VERIFY-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE.ps1 -> exit 0
- VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1 -> exit 0
- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0
- VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1 -> exit 0

### Changed files

- `.gitattributes`
- `backend/test/bibleroot-commentary-provenance.test.ts`
- `backend/test/cross-root-lexical-evidence.test.ts`
- `backend/test/cross-root-source-backed-relationships.test.ts`
- `docs/stages/completed/20260809-SOURCEROOT-BEFORE-15A-MAINTENANCE-V1.md`
- `ROOT-MANIFEST.json`
- `tools/COMPLETE-ROOT-STAGE.ps1`
- `tools/NEW-ROOT-STAGE.ps1`
- `tools/SET-ACTIVE-ROOT-STAGE.ps1`
- `VERIFY-CROSS-ROOT-LINK-FOUNDATION-DETERMINISTIC-LEXICAL-EVIDENCE.ps1`
- `VERIFY-CROSS-ROOT-SOURCE-BACKED-ENTITY-HISTORICAL-RELATIONSHIPS.ps1`
- `VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1`

### Unresolved manual checks

- None reported

### Completion notes

None.
