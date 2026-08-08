# SourceRoot Shared Grammar and Root Integration Contracts v1

## Stage identity

- Name: SourceRoot Shared Grammar and Root Integration Contracts v1
- Slug: SOURCEROOT-SHARED-GRAMMAR-ROOT-INTEGRATION-CONTRACTS-V1
- Status: active
- Started: 2026-08-08

## Objective

Establish a named, versioned, contract-only SourceRoot network grammar over existing released structures: dataset-qualified addressing, an authoritative Root registry with a three-state object-type maturity model, a truthful Root integration contract, a partial-result-first response envelope with a bounded rootPayload boundary, a non-transitive identity-assertion vocabulary with explicit rejection boundaries, temporal and spatial-vocabulary contracts, and independent version axes, without any migration, Root merge, EarthRoot implementation, or change to released datasets.

## Business value

Every future Root-to-Root integration, starting with EarthRoot, now has one named, versioned grammar to build against instead of re-deriving conventions per Root. The stage also makes the cheap and dangerous integration path structurally unavailable: matching labels, coordinates, or lexical overlap can never become an identity claim. That protects the platform's core product promise, source-backed knowledge with visible provenance and uncertainty, before any adapter ships.

## Current source of truth

The checked-out repository at branch `agent/claude-14c`, HEAD `1363be2b3e5f8ad44674207915cc84c8d2a15026`, is canonical. Required current inputs are migrations 018 and 019, the released Chunk 14A and 14B dataset manifests, `backend/src/lib/api-contract.ts`, `backend/src/lib/query-params.ts`, `backend/src/services/development-runtime-readiness.ts`, and the existing Root and stage tooling contracts. Backups, generated packages, and completed stages are not implementation sources.

## Allowed files

- `backend/src/app.ts`
- `backend/src/routes/sourceroot-contracts.ts`
- `backend/src/sourceroot/addressing.ts`
- `backend/src/sourceroot/contracts.ts`
- `backend/src/sourceroot/identity-assertions.ts`
- `backend/src/sourceroot/object-types.ts`
- `backend/src/sourceroot/query-vocabulary.ts`
- `backend/src/sourceroot/response-envelope.ts`
- `backend/src/sourceroot/root-registry.ts`
- `backend/test/fixtures/sourceroot-jerusalem-contract-fixture.ts`
- `backend/test/sourceroot-shared-grammar.test.ts`
- `docs/architecture/SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS-V1.md`
- `docs/build/SOURCEROOT-SHARED-GRAMMAR-CONTRACT.md`
- `docs/stages/active/CURRENT-STAGE.md`
- `docs/stages/completed/20260808-SOURCEROOT-SHARED-GRAMMAR-ROOT-INTEGRATION-CONTRACTS-V1.md`
- `ROOT-MANIFEST.json`
- `verification/sourceroot-shared-grammar.test.cjs`
- `VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1`

Only the paths above may be created, modified, moved, or deleted.

## Required inputs

- `backend/db/migrations/018_create_cross_root_link_foundation.sql` (read-only): Root CHECK, resource-type CHECK, dataset-scoped resource uniqueness.
- `backend/db/migrations/019_create_cross_root_source_backed_relationships.sql` (read-only): unconstrained predicate TEXT, relationship-family CHECK, identity self-guard.
- `backend/data/cross-root-link-foundation-v1/dataset-manifest.json` and `backend/data/cross-root-source-backed-relationships-v1/dataset-manifest.json` for the frozen released baselines.
- `backend/src/lib/api-contract.ts` and `backend/src/lib/query-params.ts` for the existing collection-contract philosophy that the envelope extends.
- `backend/src/services/development-runtime-readiness.ts` (read-only) for the 1.4.0 readiness baseline.
- `tools/NEW-ROOT-STAGE.ps1`, `tools/COMPLETE-ROOT-STAGE.ps1`, and `tools/VERIFY-ROOT-REPOSITORY.ps1` for the actual lifecycle contract.

## Required behavior

- Define a dataset-qualified SourceRoot address format with its own independent version, exact round-trip parse and format, canonical component escaping, and rejection of malformed or dataset-unqualified addresses.
- Define the network object-type vocabulary with three distinct maturity concepts (DEFINED, IMPLEMENTED, PROVIDED) and four availability states, where an unsupported type is never equivalent to an empty result.
- Create the authoritative Root registry covering three operational and four planned Roots, with truthfulness invariants that stop a Root claiming a capability it cannot satisfy and stop a planned Root reporting ready.
- Define the Root integration contract that future network consumers can rely on, including query, temporal, spatial, provenance, evidence, uncertainty, identity-assertion, and mutation declarations.
- Define the shared response envelope with all three version axes, first-class partial results, and a bounded rootPayload boundary limited to Root-public contract data.
- Define the identity-assertion vocabulary with required evidence, exposed derivation, review, certainty, dispute, and temporal state, explicit withdrawal, no automatic symmetry, and constant non-transitivity.
- Define the governed shared identity concept as provisional shape only, never persisted, inferred, or exposed.
- Define temporal and spatial query vocabularies without implementing TimeRoot or any spatial semantics.
- Preserve released Chunk 14A and 14B counts, migrations 018 and 019, readiness 1.4.0, and the absence of migration 020.

## Protected behavior

All behavior in `ROOT-PROTECTED-FUNCTIONALITY.md` remains protected. Stage-specific protections are migrations 018 and 019 byte identity, the absence of migration 020, all released Chunk 14A and 14B counts and semantics, development runtime readiness 1.4.0, every existing API route and its contract, the three released Roots and their datasets, the no-static-fallback-data rule, and existing verifier coverage and exit codes. No lexical observation, label match, coordinate match, or similarity score may become identity evidence.

## Non-goals

No migration 020, EarthRoot, map or globe UI, geometry, coordinates, geocoding, Jerusalem production data, TimeRoot, PersonRoot, or LanguageRoot application, automatic entity resolution, fuzzy identity matching, embeddings, similarity scoring, transitive identity closure, lexical-to-semantic promotion, branding or logo work, microservices, repository-wide restructuring, dependency upgrade, mutation API, review UI, Chunk 17A-17C Root adapters, rewriting existing hardcoded Root lists, readiness version bump, commit, tag, push, merge, or rebase.

## Dependencies

Node.js 22+ with the existing backend lockfile installed via `npm ci`, Windows PowerShell 5.1 for verification, and the released Chunk 14A and 14B dataset manifests plus migrations 018 and 019 as read-only inputs. No database, no `.env.test`, and no network access is required: the stage is contract-only and both test suites are database-free.

## Risks

The primary risk is that a convenient shortcut later turns a locator, a label, or a lexical observation into an identity claim; the rejected-evidence vocabulary, the non-transitivity constant, and semantic tests S1, S2, S3, S12, and S13 address it, and a failure there is a stop condition. Secondary risks are an overstated Root registry (addressed by capability invariants tied to runtime state), Root internals leaking through `rootPayload` (addressed by the payload boundary validator), a partial result being presented as complete (addressed by first-class unavailable-Root reporting), a missing temporal scope reading as timeless truth (addressed by explicit not-asserted rendering), and the contract fixture being mistaken for production data (addressed by placing it under `backend/test/fixtures/` with a prerelease dataset version). Rollback is trivial: the stage adds isolated modules plus a two-line mount in `backend/src/app.ts`.

## Acceptance criteria

1. Address format v1 round-trips exactly, escapes every component canonically, rejects malformed addresses with specific codes, and rejects any address lacking dataset qualification or dataset version.
2. The address format version, the SourceRoot contract version, and the per-Root contract version are all present and independently declared.
3. DEFINED, IMPLEMENTED, and PROVIDED are distinct across every Root and object type; nothing is PROVIDED; `place` is DEFINED with implemented and provided false for every Root.
4. An unsupported object type is distinguishable from an empty result at every surface.
5. The Root registry lists three operational and four planned Roots; `validateRootRegistry()` returns no violation; no planned Root can report ready; no Root declares a capability it cannot satisfy; no Root declares spatial or mutation support.
6. The response envelope reports ok, partial, and unavailable states; every requested Root that did not answer is reported with a reason; pagination is validated.
7. `rootPayload` rejects internal keys, private-prefixed keys, functions, excess depth, and excess keys.
8. Identity assertions require explicit evidence with a source locator; every one of the ten rejection boundaries is enforced; accepted A-B and B-C assertions yield no A-C connection; withdrawal preserves provenance.
9. No governed shared identity is persisted, inferred, or exposed; construction throws and resolution returns null.
10. Missing temporal scope is rendered as not asserted and never as timeless truth; spatial support is vocabulary only.
11. Released Chunk 14A counts (1568, 2233, 2765, 1431, 802, 1790, 975) and Chunk 14B counts (143, 178, 101, 76, 22, 121, 143, 0, 143, 143, 143, 0, 280, 0) are unchanged.
12. Migrations 018 and 019 are byte-identical, the migration count remains 20, and migration 020 is absent.
13. Development runtime readiness remains 1.4.0 and its service file is unmodified.
14. The focused backend contract suite, the static semantic-safety suite, backend typecheck, the focused verifier, and the root verifier all pass, with `git diff --check` clean, no staged change, and no commit, tag, or push.

## Required verifier

- `VERIFY-ROOT-REPOSITORY.ps1`
- `VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1`

## Manual browser checks

Not applicable. This stage adds no page, no asset, no navigation, and no customer-visible surface. It changes no HTML, CSS, or frontend JavaScript, so there is nothing for a browser to render or regress.

## Live API checks

Not applicable as a gate. The stage adds read-only contract discovery routes under `/api/v1/sourceroot/contracts` that read no database and expose no Root data; they are covered end-to-end in `backend/test/sourceroot-shared-grammar.test.ts` against a minimal Express application, including pagination validation, 404 handling, address validation, and absence of any mutation route. No live database or `.env.test` is required, and no secret is read or printed.

## Required output

Seven SourceRoot contract modules, one read-only discovery router, the two-line mount in `backend/src/app.ts`, the synthetic Jerusalem contract fixture, the focused backend contract suite, the static semantic-safety suite, the focused verifier, the architecture and consumer-reference documents, the completed-stage record, and a completion report giving exact changed paths, contract and address versions, the Root registry and object-type maturity states, the identity vocabulary and governed-shared-identity boundary, fixture results, test and verifier results, released-baseline and migration preservation evidence, final Git state, and any unavailable database-backed verification with its exact reason.

## Independent audit and pre-commit correction pass

An independent Codex audit reviewed this uncommitted stage and returned
**REQUIRES CORRECTION**. The stage was reopened before commit by restoring the
completed record to `docs/stages/active/CURRENT-STAGE.md` and re-activating it
with the existing `tools/SET-ACTIVE-ROOT-STAGE.ps1`. No lifecycle behavior was
invented, no new architectural chunk was created, and the allowlist is
unchanged at 18 paths.

### BLOCKER 1 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â identity traversal did not enforce the contract

`validateIdentityAssertion` rejected prohibited evidence correctly, but
`directIdentityCounterparts` never called it and applied only a narrow ad-hoc
filter. Assertions carrying `name_only_match` evidence, unreviewed assertions,
`possible_same_as`, and evidence-free or malformed assertions all yielded
identity counterparts. Corrected: traversal now runs the complete validator
plus an explicit eligibility policy on every assertion and never trusts caller
shape.

### BLOCKER 2 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â a requested Root could silently disappear

Status was derived without reconciling `requestedRoots` against the responding
and unavailable sets, so a requested Root that did neither simply vanished and
the envelope reported `ok`. Corrected: the response accounting invariant is
enforced before an envelope is produced, and status is derived from validated
accounting.

### Other corrections

Temporal vocabulary aligned to released SourceRoot semantics with open
source-native calendar and precision; identity validation closed over review
state, certainty, dispute state, status, symmetry, and temporal scope; shared
object grammar expanded; persistence-to-network mappings made explicit;
`rootPayload` documented as a floor rather than an authorization boundary;
verifier scope discovery made deterministic and repository-local; router
`/contracts/roots` paginated and non-paginated views separated.

### Additional acceptance criteria for the correction pass

15. No rejected evidence kind, unreviewed assertion, `possible_same_as`,
    withdrawn assertion, evidence-free assertion, or malformed vocabulary value
    can yield an identity counterpart, proved by runtime attack tests against
    the traversal function itself.
16. Every requested Root is accounted for exactly once as responding or
    unavailable; omission, duplication, overlap, blank reason, stray item
    rootId, unrequested Root, missing Root contract version, and impossible
    pagination are all rejected by the builder.
17. Temporal mode and time role reuse the released vocabulary verbatim;
    calendar system and precision accept released source-native values and are
    never coerced.
18. Persistence-to-network object type mappings are explicit and reversible,
    and released persistence names remain unchanged in migration 018.
19. No repository file is hidden from governed scope verification by a
    user-global Git exclude; `.claude/settings.local.json` stays untracked,
    outside the allowlist, and excluded by repository-local Git metadata.

## Targeted re-audit and final provenance correction

A targeted independent Codex re-audit confirmed that both original runtime
defects are corrected: invalid or rejected identity assertions can no longer
bypass traversal eligibility, and a requested Root can no longer silently
disappear while status reports `ok`. It found one remaining identity blocker
and two pre-commit issues, closed in this final pass.

### BLOCKER 3 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â identity evidence was not traceable

An otherwise-valid reviewed `asserted_same_as` assertion could carry
accepted-kind evidence with blank `evidenceId`, `sourceDatasetId`, and
`sourceDatasetVersion`, produce zero validation violations, pass eligibility,
and yield exactly one direct counterpart. The assertion's
`addressFormatVersion` was never validated at all.

The defect was a class, not three fields: **a required property existing
syntactically while being semantically empty.** The correction is therefore
structural ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â an explicit `REQUIRED_IDENTITY_EVIDENCE_FIELDS` table drives
per-field validation for every required evidence field, refusing missing,
non-string, and whitespace-only values alike, with `sourceDatasetVersion`
additionally checked against the SourceRoot contract v1 dataset-version rule.
`addressFormatVersion` is validated against the single supported set exported
by `addressing.ts`; no version literal is duplicated.

### Completed-record heading

The stage template ships a `## Completion record` placeholder and the
completion tool appends its own, producing two headings. On this reopen both
were removed from the specification so re-completion yields exactly one.

### Additional acceptance criteria

20. Identity evidence is refused when any required field is missing,
    non-string, or whitespace-only, and when `sourceDatasetVersion` is
    malformed under the contract v1 rule.
21. `addressFormatVersion` is refused when missing, non-string, blank,
    malformed, or unsupported, sourced solely from the addressing contract.
22. The positive control still yields exactly one direct counterpart, and
    A-B plus B-C still yields no A-C and no governed shared identity.
23. The completed stage record contains exactly one `## Completion record`
    heading while preserving the full audit and correction history.

## Final replay and response-contract correction

The final independent Codex replay confirmed identity provenance,
`addressFormatVersion`, positive identity, non-transitivity, governed shared
identity refusal, the original Root-disappearance regression, 89/89 backend
tests, 41/41 static tests, focused verifier, typecheck, root verifier,
migration and DB baselines, and completed-stage history all PASS. It found one
remaining blocker in response-envelope runtime validation.

### BLOCKER 4 Ã¢â‚¬â€ Root identity and contract version were not runtime-enforced

`isSourceRootRootId` existed and was correct but the response envelope never
called it, so Root identifiers flowed through accounting as bare strings.
Root contract versions were checked with `hasOwnProperty` only. Independent
attacks accepted a responding DictionaryRoot with contract version `null`,
`42`, `""`, whitespace, `"latest"`, and an unsupported `"2.0.0"`, and admitted
blank, whitespace-only, and invented Root identifiers into accounting.

This is the same defect class as BLOCKER 3: a TypeScript declaration mistaken
for a runtime trust boundary.

**Correction.** `checkRootId`, `checkRespondingRoot`,
`checkRootContractVersion`, and `supportedRootContractVersion` were added to
`root-registry.ts` Ã¢â‚¬â€ the authoritative module, already inside the allowlist Ã¢â‚¬â€
and wired into `validateResponseAccounting` across `requestedRoots`, responding
identities, unavailable identities, result-item `rootId`, and every
`rootContractVersions` key. Matching is exact; no trimming or case folding.
A Root may respond only if the registry grants it a Root contract version,
derived from registry state rather than invented. The version syntax rule now
lives once, as `checkVersionSyntax` in `addressing.ts`.

**Same-class sweep.** Container shape is validated before use, and accounting
validation runs before payload inspection, so a malformed container fails
closed with a violation rather than crashing.

### Additional acceptance criteria

24. Every Root identifier that can influence accounting or status is validated
    against the governed registry; blank, whitespace-only, non-string,
    invented, padded, and case-mutated identifiers are all refused.
25. A responding Root's contract version must be exactly the version the
    registry declares for it; missing, null, non-string, blank, malformed, and
    syntactically valid but unsupported values are all refused.
26. A planned Root may be requested and accounted unavailable but can never be
    a responding Root, and may not claim a contract version.
27. The response envelope owns no second Root list, no version table, and no
    version-syntax pattern.
28. Malformed accounting containers fail closed with a violation rather than a
    runtime crash, and the accounting invariant and status derivation are
    unchanged.

## Commit-gate replay and result-item contract correction

The commit-gate replay confirmed BLOCKERS 1-4 closed, all Root-ID and
Root-version attacks, planned-Root semantics, identity positive control,
non-transitivity, governed shared identity refusal, malformed envelope
containers, status derivation, 100/0 backend, 43/0 static, 60/0 focused
verifier, typecheck, 51/0 root verifier, and immutable baselines. It found one
remaining runtime-contract blocker.

### BLOCKER 5 â€” SourceRootResultItem trust boundary

`buildSourceRootResponseEnvelope` accepted an item equivalent to
`{ rootId: "DictionaryRoot", rootPayload: {} }` and emitted `status: "ok"`.
The interface declared thirteen required fields; the builder validated only
`rootId` via accounting and `rootPayload` via the generic denylist. Address,
object type, canonical identity, dataset identity and version, public locator,
provenance, temporal representation, uncertainty, review state, and semantic
conclusion were all unenforced.

This is the fifth instance of one defect class: a public contract declared in
TypeScript and unenforced at runtime.

**Correction.** `validateResultItem` enforces the complete contract and the
builder runs it on every item before construction. Existing authorities are
reused â€” `checkRootId`, `tryParseSourceRootAddress`, `checkVersionSyntax`,
`isSourceRootObjectType`, `SOURCEROOT_TEMPORAL_MODES`, and the released
four-state review vocabulary. Cross-field coherence is enforced only where the
contract already defines it: the address against the five components it
serializes, and `temporalSummary.asserted` against `mode`. Vocabularies that
contract v1 does not close (`derivation`, `certainty`, and the
`reviewed`/`reviewState` relationship) are validated for type and non-emptiness
only, and that choice is documented rather than silently made.

### Additional acceptance criteria

29. Every required result-item field is enforced at runtime; missing, null,
    wrong-typed, blank, malformed, and unsupported governed values are all
    refused with controlled contract errors and no TypeError.
30. The exact commit-gate reproduction is rejected and can never produce
    `status: "ok"`.
31. An item whose components contradict its SourceRoot address is refused.
32. A fully valid result item passes validation and is emitted unchanged in
    semantic meaning, preserving provenance, temporal, uncertainty, and review
    information.
33. All five blockers remain closed under representative regression attacks.

## Completion record

- Completion date: 2026-08-08T15:44:31.9268209-05:00
- Verification skipped: False

### Verifier results

- VERIFY-ROOT-REPOSITORY.ps1 -> exit 0
- VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1 -> exit 0

### Changed files

- `backend/src/app.ts`
- `backend/src/routes/sourceroot-contracts.ts`
- `backend/src/sourceroot/addressing.ts`
- `backend/src/sourceroot/contracts.ts`
- `backend/src/sourceroot/identity-assertions.ts`
- `backend/src/sourceroot/object-types.ts`
- `backend/src/sourceroot/query-vocabulary.ts`
- `backend/src/sourceroot/response-envelope.ts`
- `backend/src/sourceroot/root-registry.ts`
- `backend/test/fixtures/sourceroot-jerusalem-contract-fixture.ts`
- `backend/test/sourceroot-shared-grammar.test.ts`
- `docs/architecture/SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS-V1.md`
- `docs/build/SOURCEROOT-SHARED-GRAMMAR-CONTRACT.md`
- `docs/stages/completed/20260808-SOURCEROOT-SHARED-GRAMMAR-ROOT-INTEGRATION-CONTRACTS-V1.md`
- `ROOT-MANIFEST.json`
- `VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1`

### Unresolved manual checks

- Database-backed suites remain unrun in this clone: backend/.env.test and backend/.env are absent and DATABASE_URL is unset. No credentials were invented. Independent Codex has verified the persisted 14A and 14B baselines directly.
- BEFORE-15A MAINTENANCE: legacy 14A/14B test setup and cleanup lifecycle is incompatible with the fully provisioned current schema.
- BEFORE-15A MAINTENANCE: stage lifecycle tooling rewrites ROOT-MANIFEST.json with CRLF although it is committed as LF, so each stage must renormalize it.
- BEFORE-ADAPTERS: adapter-specific rootPayload public allowlists and schemas; the generic denylist is a floor, not an authorization boundary.
- BEFORE-ADAPTERS: temporal calendar and precision size bounds.
- BEFORE-ADAPTERS: chronologyRanges member-shape validation.
- BEFORE-ADAPTERS: uncertainty and free-text value size constraints.
- BEFORE-ADAPTERS: strict SemVer policy review across dataset, evidence, Root contract, and result-item dataset versions.
- BEFORE-ADAPTERS: contract v1 defines no closed vocabulary for result-item provenance derivation or uncertainty certainty, and no reviewed/reviewState coherence rule. Closing these needs a governed decision, not a validator change.
- MAINTENANCE: the stage template ships a Completion record placeholder that COMPLETE-ROOT-STAGE.ps1 duplicates; fixed for this stage record only.

### Completion notes

Final result-item contract correction after the commit-gate replay. The replay confirmed BLOCKERS 1-4 closed and found BLOCKER 5: buildSourceRootResponseEnvelope emitted an item as thin as rootId plus rootPayload with status ok, leaving address, object type, canonical identity, dataset identity and version, public locator, provenance, temporal representation, uncertainty, review state, and semantic conclusion unenforced. Corrected by adding validateResultItem, which enforces the complete thirteen-field public contract, and wiring it into the builder so no caller has to remember it. Existing authorities are reused rather than duplicated: checkRootId, tryParseSourceRootAddress, checkVersionSyntax, isSourceRootObjectType, SOURCEROOT_TEMPORAL_MODES, and the released four-state review vocabulary shared by migrations 018 and 019. Cross-field coherence is enforced only where the contract already defines it: the address against the five components it serializes, and temporalSummary.asserted against mode. Vocabularies contract v1 does not close, namely provenance derivation, uncertainty certainty, and the reviewed/reviewState relationship, are validated for type and non-emptiness only and that choice is documented. Nothing is manufactured, defaulted, fabricated, inferred, or repaired. Contract-only and migration-free: migration 020 absent, migrations 018 and 019 byte-identical, backend/data byte-identical, released 14A and 14B baselines unchanged, readiness 1.4.0 preserved. No commit, tag, push, merge, or rebase; Josh-Brain and the primary SourceRoot repository untouched. 14C is corrected and awaiting final independent review; it is not released.
