# SourceRoot Shared Grammar and Root Integration Contracts v1

Chunk 14C. Contract-only, migration-free, Root-preserving, non-merging,
provenance-first.

This document describes a **named, versioned SourceRoot network grammar laid
over existing released structures**. It reinterprets no released persistence,
changes no released dataset, and adds no migration. Migration 020 is explicitly
deferred and remains absent.

---

## 1. Why this stage exists

Three Roots are operational. More are planned. Until now there has been no
shared, versioned vocabulary for one Root to describe its objects to another,
and no contract stating what a cross-Root connection does and does not mean.

Without that grammar, the cheapest way to connect Roots is also the most
dangerous one: match on labels, match on coordinates, match on lexical overlap,
and quietly call the results "the same thing". This stage exists to make that
path structurally unavailable before EarthRoot and the Root adapters arrive.

The deliverable is the grammar, not an implementation. No Root exposes the
SourceRoot network contract yet.

---

## 2. Identity model: three layers that must stay separate

### LAYER 1 — Root-owned resource

A resource belongs to **exactly one Root**. It is never silently merged,
rewritten, deduplicated, or reassigned by another Root.

`cross_root_resources` (migration 018) is the current persistence seed for this
layer. Its `uq_cross_root_resource_canonical` constraint scopes resource
identity to a dataset, which is why addressing is dataset-qualified (§4).

### LAYER 2 — Identity assertion

An explicit, evidence-backed assertion connecting two separate Root-owned
resources. **It remains an assertion.** Its required properties:

| Property | Contract guarantee |
| --- | --- |
| Evidence | Required; at least one item, each with a statement and a follow-able source locator |
| Derivation | Exposed; `directly_sourced` or `human_proposed` only |
| Review state | Exposed; `unreviewed`, `accepted_after_review`, `disputed`, `rejected` |
| Certainty | Exposed; `asserted_by_source`, `uncertain`, `contested` |
| Dispute state | Exposed; `not_disputed`, `disputed` |
| Temporal scope | Exposed, including `not_asserted` |
| Transitivity | `non_transitive`, always, with no setting that changes it |
| Symmetry | `asymmetric` unless the assertion explicitly declares symmetry |
| Withdrawal | Sets status to `withdrawn` with a reason; deletes nothing |

An accepted assertion **connects** two resources. It does not merge them.

#### Identity counterpart traversal eligibility

`directIdentityCounterparts` represents **reviewed direct identity**, not
candidate identity. It re-validates every assertion itself and never trusts a
caller-supplied object that merely has the right shape.

An assertion may yield an identity counterpart only if **all** hold:

| Requirement | Eligible value |
| --- | --- |
| Passes the complete assertion validator | no violations |
| Address format version | supported, per `SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS` |
| Predicate | `asserted_same_as` |
| Review state | `accepted_after_review` |
| Assertion status | `active` |
| Dispute state | `not_disputed` |
| Evidence | ≥1 entry, every kind accepted, every entry traceable |
| Transitivity | `non_transitive` |

#### Evidence must be traceable

Evidence that cannot be traced to a specific record in a specific released
dataset version is not evidence; it is an unfalsifiable claim. Every field in
`REQUIRED_IDENTITY_EVIDENCE_FIELDS` must be present **and meaningful** —
missing, non-string, and whitespace-only values are all refused:

| Field | Rule |
| --- | --- |
| `evidenceId` | string, non-empty after trim |
| `kind` | an accepted evidence kind |
| `statement` | string, non-empty after trim |
| `sourceLocator` | string, non-empty after trim |
| `sourceDatasetId` | string, non-empty after trim |
| `sourceDatasetVersion` | string, non-empty after trim, **and** satisfies the SourceRoot contract v1 dataset-version rule |

#### Address format version

`addressFormatVersion` is validated directly: missing, non-string, blank,
malformed, and unsupported values are each refused with their own rule, and
nothing is coerced. Malformed and unsupported are reported separately because a
consumer needs to know which it is.

The supported set lives in `addressing.ts` and is derived from
`SOURCEROOT_ADDRESS_FORMAT_VERSION`. It is the **sole** source of truth; no
version literal is duplicated anywhere else.

Not eligible: `possible_same_as`, `distinct_from`, `related_but_distinct`,
`unreviewed`, disputed review or dispute state, withdrawn or inactive
assertions, invalid vocabulary values, missing evidence, rejected evidence
kinds, and malformed temporal state.

A `possible_same_as` assertion **remains a legitimate assertion** and may later
be surfaced through a separate candidate or relation API. It is not an identity
counterpart.

`explainIdentityCounterparts` reports why each assertion was refused, so a
review surface can show a human the reasons instead of dropping them silently.

### LAYER 3 — Governed shared identity

Future governance grammar only.

A governed shared identity is **not** an automatically derived transitive
cluster. It must eventually be an explicit, versioned, human-governed,
reversible object whose membership is itself explicitly reviewed.

Accepted A↔B and B↔C assertions **must never** automatically create A↔C
membership.

This stage defines the provisional shape and nothing else:
`createGovernedSharedIdentity()` throws, and
`resolveGovernedSharedIdentity()` returns `null` for every input. Nothing is
persisted, inferred, or exposed.

---

## 3. Rejection boundaries

None of the following may ever establish an identity assertion:

- name-only match
- alias-only match
- lexical overlap
- Chunk 14A lexical evidence
- coordinate-only match
- temporal overlap alone
- embedding similarity
- fuzzy matching
- model confidence
- transitive closure

These are enforced as a rejected evidence vocabulary in
`backend/src/sourceroot/identity-assertions.ts` and are covered by semantic
tests S1, S2, S3, S12, and S13. **A failure in those tests is a stop
condition**, not a bug to be worked around.

### Database boundary

Migration 019 is **IDENTITY-ASSERTION-COMPATIBLE**. It is **not** a complete
persisted identity governance system: its `predicate` column is unconstrained
`TEXT` and it has no identity relationship family.

Its `ck_cross_root_relationship_identity_self_guard` constraint does mention
`same_as`, `asserted_same_as`, and `possible_same_as`, but only to forbid such a
predicate pointing a resource at itself. It does **not** constrain the predicate
vocabulary, and it grants no identity governance.

Database-level predicate control is therefore **not yet implemented**; the
vocabulary is enforced at the contract layer only. Identity assertions are
non-transitive at the contract layer, and nothing in the schema enforces that
either. Migration 019 is not modified by this stage.

---

## 4. Addressing

Address format version **1.0.0**, versioned independently from the SourceRoot
contract version and from every Root contract version.

```
sourceroot:<rootId>/<objectType>/<canonicalPublicId>@<datasetId>:<datasetVersion>
```

Rules:

- Dataset qualification is **required**; a missing dataset or version is
  rejected. No dataset-independent identity is invented in v1.
- Every variable component is percent-encoded (uppercase hex, unreserved set
  `A–Z a–z 0–9 - . _ ~`), so `/`, `@`, and `:` can never appear literally
  inside a component.
- Parsing is strict. Lowercase escapes, truncated escapes, over-encoded
  unreserved characters, and invalid UTF-8 are all rejected. This makes
  `format(parse(text)) === text` an **exact** round trip, not merely a lossless
  one.
- Dataset versions must be SemVer-compatible.
- **An address is a locator, never an identity claim.** Two addresses that
  share a label, a canonical public ID, or any other surface similarity are
  still two distinct Root-owned resources.

---

## 5. Object-type maturity and the shared object grammar

The grammar DEFINES both the shared knowledge-graph concepts and the domain
object types:

**Shared:** `entity`, `source`, `claim`, `evidence`, `relationship`,
`revision`, `dataset`, `provenance-record`, `temporal-assertion`, `time-span`,
`identity-assertion`.

**Domain:** `lexical-entry`, `lexical-sense`, `historical-record`,
`scripture-passage`, `place`, `person`, `polity`, `event`, `language`,
`script`.

Nothing here is PROVIDED merely because a database structure exists.

Three maturity concepts, kept explicitly distinct:

| State | Meaning |
| --- | --- |
| **DEFINED** | The SourceRoot grammar defines the type |
| **IMPLEMENTED** | A Root or runtime can represent or adapt it from released structures |
| **PROVIDED** | A Root currently exposes it through the SourceRoot network contract |

A database table existing somewhere does **not** make a network object
PROVIDED.

Invariants: `provided ⇒ implemented`; availability `supported ⇒ provided`; a
planned Root implements and provides nothing.

`Place` is the worked example: DEFINED here, `implemented = false` and
`provided = false` for every current Root.

**An unsupported object type is not an empty result.** Empty means the Root
answered the question and found nothing. Unsupported means it never answered.
Availability states are `supported`, `unsupported`, `unavailable`,
`awaiting-data`.

### Persistence-to-network type mappings

Released persistence uses its own names; the network grammar uses public ones.
That translation is legitimate, but it is **explicit** so no future adapter can
quietly invent its own:

| Released persistence `resource_type` | Root | Network object type |
| --- | --- | --- |
| `lemma` | DictionaryRoot | `lexical-entry` |
| `accepted-contextual-record` | HistoryRoot | `historical-record` |
| `edition-verse-text` | BibleRoot | `scripture-passage` |

The mapping is one-to-one and reversible
(`networkObjectTypeForPersistenceType`, `persistenceTypeForNetworkObjectType`).
**Future adapters must use it.** Released persistence names are never renamed,
migration 018 is not modified, and no released record is changed.

---

## 6. Root registry

Authoritative **going forward**. It does not rewrite existing hardcoded Root
lists; those remain compatibility debt, enumerated in
`ROOT_REGISTRY_CONVERGENCE_PATH`, for a later governed migration.

Operational: DictionaryRoot, HistoryRoot, BibleRoot.
Planned: EarthRoot, TimeRoot, PersonRoot, LanguageRoot.

Each entry exposes rootId, display name, lifecycle, network runtime state,
SourceRoot contract version, Root contract version, address format version,
canonical locations, datasets, the object-type maturity matrix, and capability,
query, and provenance declarations.

### Truthfulness

No Root exposes the SourceRoot network contract in v1, so every Root reports
`networkRuntimeState: "not-implemented"` and **every network capability is
false**. This is enforced: a Root whose runtime state is not `available` cannot
declare any capability true. Spatial and mutation support are additionally
forbidden outright.

Planned Roots can never report ready, can never declare a Root contract
version, and can never declare datasets.

Cross-Root datasets (14A, 14B) are listed separately from Root-owned datasets
so Layer 1 ownership stays unambiguous.

---

## 7. Response envelope

Extends the existing api-contract / collection-contract philosophy — same
pagination shape, same applied-filter and applied-sort reporting, same
`semanticConclusion: null` discipline. No second API style is introduced.

Envelope fields: `sourcerootContractVersion`, `rootContractVersions`,
`addressFormatVersion`, `status`, `requestedRoots`, `respondingRoots`,
`unavailableRoots`, `rootGroups`, `items`, `pagination`, `appliedFilters`,
`appliedSort`, `semanticConclusion`.

Each item carries address, rootId, objectType, canonicalPublicId, datasetId,
datasetVersion, canonical URL, provenance summary, temporal summary,
uncertainty summary, review summary, `rootPayload`, and
`semanticConclusion: null`.

**Partial results are first class.** Status is `ok`, `partial`, or
`unavailable`. Every requested Root that did not answer appears in
`unavailableRoots` with a mandatory reason. One Root failing never silently
disappears.

### Governed Root identity and contract version

Every Root identifier that can influence accounting or status is validated at
runtime against the Root registry, which is the **sole authority**. The
response envelope keeps no Root list and no version table of its own.

Validated paths: `requestedRoots`, responding Root identities, unavailable Root
identities, result-item `rootId`, and every key of `rootContractVersions`.

Matching is **exact**. This contract defines no trimming or case folding, so
`" DictionaryRoot"`, `"DictionaryRoot "`, and `"dictionaryroot"` are all
rejected rather than repaired — silently fixing a near-match would mean
guessing which Root a caller meant.

A Root may be a **responding** Root only if the registry grants it a Root
contract version. That is derived from registry state, not invented:
`plannedRoot` sets `rootContractVersion: null`, so a planned Root can be
requested and truthfully accounted unavailable, but can never respond.

> **Why `rootContractVersion` and not `networkRuntimeState`.** In contract v1
> every Root reports `not-implemented` because no adapter exists yet. Gating
> responding on `networkRuntimeState === "available"` would make the envelope
> unusable by the very adapters it is being defined for. The contract-version
> test is the registry's own statement of which Roots participate in the
> integration contract at all, so it is the honest gate. Registry membership
> alone is explicitly *not* enough.

A responding Root's contract version must be **exactly** the version the
registry declares for that Root. Missing, null, non-string, blank, malformed,
and syntactically valid but unsupported (`"2.0.0"` when the registry says
`"1.0.0"`) are all refused. Claiming any version for a planned Root is
`unexpected`.

The version syntax rule lives once, in `addressing.ts` as
`checkVersionSyntax`; dataset versions, address-format versions, and Root
contract versions all defer to it.

### Response accounting invariant

Every requested Root is accounted for **exactly once**, as RESPONDING or as
UNAVAILABLE. Never neither. Never both.

`buildSourceRootResponseEnvelope` validates this before it produces anything,
and rejects: a requested Root that is neither responding nor unavailable, a
Root in both sets, duplicate entries in any set, an unavailable Root with a
blank reason, a responding or unavailable Root that was never requested, an
item whose `rootId` is not a responding Root, a missing Root contract version,
and impossible pagination. Root groups are derived inside the builder, never
supplied by a caller, so a group cannot exist for an unaccounted Root.

Status is **derived from validated accounting** and cannot be supplied by a
caller.

### rootPayload boundary

`rootPayload` may carry **Root-public contract data only**. Private database
rows, internal table shape, implementation-only columns, and private service
objects are excluded, so a future consumer such as EarthRoot cannot become
coupled to another Root's internals through the back door.

Enforced by key denylist, private-prefix rejection, JSON-only value types, max
depth 4, and max 32 keys.

**A generic denylist is a floor, not an authorization boundary.** It cannot
anticipate what a future adapter will invent, and it fails open on any key
nobody thought to forbid. It is sufficient for this stage only because no Root
adapter currently emits a production `rootPayload`.

**BEFORE-ADAPTERS requirement.** Before Chunks 17A–17C emit real Root payloads,
each adapter must define an **adapter-owned public schema**, not rely on this
denylist:

- explicit adapter-owned public schema
- allowlisted fields only
- finite numeric validation
- size limits
- no storage-row passthrough
- no private implementation fields
- no secret-bearing fields

---

## 8. Temporal contract

**Reuses the released SourceRoot temporal vocabulary directly.** No parallel
ontology is introduced and no alias is defined, because an alias needs a
mapping and a mapping is a place for meaning to be lost.

| Field | Kind | Source |
| --- | --- | --- |
| `mode` | closed | released `temporalKinds` + `not_asserted` |
| `timeRole` | closed | released `temporalRoles`, verbatim |
| `precision` | **open** source-native string | released corpora |
| `calendarSystem` | **open** source-native string | released corpora |

Modes: `exact`, `approximate`, `range`, `before`, `after`, `disputed`,
`unknown`, `multiple_proposed`, plus `not_asserted`. The last is the only value
this contract adds, and it exists so the network can say "the source asserted
nothing" rather than staying silent.

Time roles are the released set verbatim: `event_time`, `validity_time`,
`publication_time`, `observation_time`, `recording_time`,
`relationship_validity`, `identity_name_validity`, `source_creation_time`,
`unspecified`.

### Why precision and calendar are open

Closing them would reject released data. The released HistoryRoot corpora carry
calendar values such as `historical-chronology`, `English Old Style (Julian)`,
`source-reported chronology`, and `relative source chronology`, and precision
values such as `approximate-range`, `competing-year`, and
`bounded approximate start` alongside the enumerated
`historicalDatePrecisions`. Both fields are therefore required to be non-empty
source-native strings and are never coerced into an enum.

Query operators (`at`, `overlaps`, `before`, `after`, `during`) are a separate
axis from persisted temporal semantics: an operator is a question, not a claim
about a record.

**A missing temporal scope is never rendered as timeless truth.**
`not_asserted` is described explicitly as "not asserted by the source", with an
explicit statement that this is not a claim of timelessness. A `not_asserted`
scope may not carry chronology ranges, because that would assert what it claims
not to.

### Creation validation versus response rendering

These are deliberately different and must not be confused:

- **Creating or processing an identity assertion fails closed.** An unknown
  value in a closed vocabulary is rejected.
- **Rendering an unknown response value preserves it.**
  `resolveVocabularyValue` reports it as unknown and never coerces, drops, or
  defaults it, so a future compatible provider stays readable.

Calendar system, precision, uncertainty statement, time role, chronology
ranges, and dispute state are all preserved. **TimeRoot is not implemented.**

---

## 9. Spatial contract

**Vocabulary only.** Operators `at_place`, `within`, `contains`, `intersects`,
`near` are named so later adapters have a shared word for them.

Not implemented: geometry, coordinates, geocoding, spatial database, bounding
boxes, map projection, map UI. `evaluateSpatialQuery()` throws so any
accidental dependency fails loudly.

Every Root reports `spatialQuery: false`. EarthRoot will implement spatial
semantics in a later chunk.

---

## 10. Versioning

Three independent, SemVer-compatible axes:

1. SourceRoot shared contract — **1.0.0**
2. Address format — **1.0.0**
3. Root-specific contract — declared per Root (`1.0.0` operational, `null`
   planned)

Rules:

- Vocabularies are append-only inside a major version.
- A released enum value's meaning is never redefined.
- Unknown enum values are preserved verbatim and reported as unknown; never
  coerced, never dropped (`resolveVocabularyValue`).
- Released 14A and 14B semantics are frozen regardless of future contract
  versions.
- Development runtime readiness **stays at 1.4.0**. This stage adds no new
  readiness capability and does not touch
  `backend/src/services/development-runtime-readiness.ts`.

---

## 11. Migration policy

Migration 020 **must remain absent**. Migrations 018 and 019 are unmodified and
byte-verified.

Future schema triggers discovered and deliberately **not** solved here:

| Trigger | Location | Consequence |
| --- | --- | --- |
| Hardcoded Root CHECK | 018 `cross_root_resources.root_id` | A new Root cannot own a cross-Root resource without a migration |
| Hardcoded resource types | 018 `ck_cross_root_resource_type` | Root-to-type pairing is fixed in schema |
| No identity relationship family | 019 `relationship_family` CHECK | Identity assertions have no persisted governed kind |
| Unconstrained predicate TEXT | 019 `predicate` | No database-level predicate control |
| Dataset-scoped resource uniqueness | 018 `uq_cross_root_resource_canonical` | Exactly why address v1 is dataset-qualified |

---

## 12. Jerusalem contract fixture

A **synthetic contract fixture**, in `backend/test/fixtures/`, deliberately
outside production source. It imports no released dataset and uses the
prerelease version `0.0.0-contract-fixture` so it can never be mistaken for
released data.

The released Plymouth, Wampanoag, and BibleRoot bounded corpora do **not**
provide the December Jerusalem demonstration, and this fixture does not pretend
otherwise. Real Jerusalem content belongs to **Chunk 18A**.

Four resources — DictionaryRoot lexical entry, HistoryRoot historical record,
BibleRoot scripture passage, and a future EarthRoot place — share the label
"Jerusalem", share a lexical token, and in two cases share identical coordinate
text. The fixture proves:

1. Four resources remain four resources.
2. Matching labels create zero identity assertions.
3. Lexical overlap creates zero identity assertions.
4. Coordinate equality creates zero identity assertions.
5. Identity assertions require explicit evidence.
6. Two accepted assertions (History↔Bible, Bible↔Earth) produce **no**
   History↔Earth connection.
7. Temporal scope stays visible, including `not_asserted` on the EarthRoot
   place.
8. No governed shared identity is created automatically.

---

## 13. Independent audit and corrections

An independent Codex audit reviewed this stage before commit and returned
**REQUIRES CORRECTION**. It found the implementation broadly sound,
migration-free, contract-only, and release-baseline safe, but proved **two
runtime bypasses** that static review and the original tests had missed. Both
are recorded here rather than quietly fixed, because they are evidence that the
governed process worked: the contract was correct on paper and wrong in code,
and only adversarial runtime attack found the gap.

### BLOCKER 1 — identity traversal did not enforce the contract

**Root cause.** `validateIdentityAssertion` correctly rejected prohibited
evidence, but `directIdentityCounterparts` never called it. Traversal applied
its own narrow ad-hoc filter (`status !== "active"` and two excluded
predicates) and otherwise trusted any object with the right shape. The
validator was a function callers were expected to remember, not a gate.

**Proved bypasses.** Assertions carrying `name_only_match` evidence, unreviewed
assertions, `possible_same_as`, and evidence-free or malformed assertions all
yielded identity counterparts.

**Correction.** Traversal now runs the complete validator plus an explicit
eligibility policy on every assertion, and never trusts caller shape. See
§2 "Identity counterpart traversal eligibility". Covered by adversarial runtime
tests that attack the function directly.

### BLOCKER 2 — a requested Root could silently disappear

**Root cause.** Status was derived from `respondingRoots` and
`unavailableRoots` alone; `requestedRoots` was recorded but never reconciled
against them. A Root that was requested, did not respond, and was not reported
unavailable simply vanished, and the envelope reported `ok`.

**Proved bypass.** Requesting DictionaryRoot and HistoryRoot while only
DictionaryRoot responded and nothing was reported unavailable returned
`status: "ok"` with HistoryRoot absent.

**Correction.** The response accounting invariant is now enforced before an
envelope is produced, and status is derived from validated accounting. See
§7 "Response accounting invariant".

### BLOCKER 3 — identity evidence was not traceable (found by targeted re-audit)

A targeted re-audit confirmed BLOCKER 1 and 2 were fixed, then proved a third
defect of the same family: **a required property existed syntactically but was
semantically empty.**

**Root cause.** Evidence validation checked `kind`, `statement`, and
`sourceLocator`, but never `evidenceId`, `sourceDatasetId`, or
`sourceDatasetVersion`. An otherwise-valid reviewed `asserted_same_as`
assertion carrying accepted-kind evidence with all three blank produced zero
violations, passed eligibility, and returned exactly one direct counterpart.
The assertion's `addressFormatVersion` was likewise never validated at all.

**Correction.** Evidence provenance is now validated field by field from an
explicit `REQUIRED_IDENTITY_EVIDENCE_FIELDS` table — missing, non-string, and
whitespace-only all refused — with `sourceDatasetVersion` additionally checked
against the contract v1 dataset-version rule. `addressFormatVersion` is
validated against the single supported set in `addressing.ts`.

The fix is deliberately structural rather than three targeted patches, because
the defect was a *class*: presence being mistaken for meaning. `statement` and
`sourceLocator` are now enforced through the same table, and the attack tests
cover every required field, not only the three the audit named.

### BLOCKER 4 — Root identity and contract version were not runtime-enforced (found by final replay)

The final independent replay confirmed BLOCKER 1–3 fixed, then proved the same
defect class once more, now in the response contract.

**Root cause.** `isSourceRootRootId` existed and was correct, but
`response-envelope.ts` never called it: Root identifiers flowed through the
accounting sets as bare strings. Root contract versions were checked with
`hasOwnProperty` only — presence, never value. The TypeScript `SourceRootRootId`
union gave a false sense of safety; at runtime these arrive as `unknown`.

**Proved bypasses.** A responding DictionaryRoot was accepted with contract
version `null`, `42`, `""`, whitespace, `"latest"`, and an unsupported
`"2.0.0"`. Invented, blank, and whitespace-only Root IDs participated in
requested/responding accounting.

**Correction.** `checkRootId`, `checkRespondingRoot`, `checkRootContractVersion`,
and `supportedRootContractVersion` were added to the registry — beside the data
they consult — and wired into `validateResponseAccounting` across every path
where a Root identifier or version can influence accounting or status. See
"Governed Root identity and contract version" in §7.

**Same-class sweep.** Container shape is now validated before use, so a bare
string is never iterated as a sequence of characters and a `null` entry in
`unavailableRoots` or `items` produces a violation rather than a `TypeError`.
Accounting validation was also moved ahead of payload inspection so a malformed
container cannot crash before it is reported.

**The recurring lesson,** now proved four times across three independent
audits: *a TypeScript declaration is a compile-time convenience, not a runtime
trust boundary.* Each blocker has been the same shape — a contract that was
correct on paper and unenforced in code.

### BLOCKER 5 — the result item was not a runtime contract (found by commit-gate replay)

**Root cause.** `SourceRootResultItem` declared thirteen required fields, but
`buildSourceRootResponseEnvelope` validated only `rootId` (through accounting)
and `rootPayload`. An item as thin as `{ rootId: "DictionaryRoot",
rootPayload: {} }` was emitted with `status: "ok"` — no address, object type,
canonical identity, dataset identity or version, provenance, temporal state,
uncertainty, review state, or semantic conclusion.

**Correction.** `validateResultItem` enforces the complete public contract and
the builder runs it on every item before constructing an envelope, so no caller
has to remember it. Nothing is manufactured, defaulted, fabricated, inferred,
or repaired; invalid items fail closed with structured violations.

Existing authorities are reused rather than duplicated: `checkRootId`
(registry), `tryParseSourceRootAddress` and `checkVersionSyntax` (addressing),
`isSourceRootObjectType` (object types), `SOURCEROOT_TEMPORAL_MODES` (query
vocabulary), and the released four-state review vocabulary.

**Cross-field coherence.** The address *is* the serialization of `rootId`,
`objectType`, `canonicalPublicId`, `datasetId`, and `datasetVersion`, so any
disagreement means the item describes two different resources and is refused.
`temporalSummary.asserted` must agree with `mode` per `isTemporalScopeAsserted`,
so an unasserted scope can never be reported as an assertion.

**Where vocabularies were deliberately NOT closed.** Contract v1 defines no
closed vocabulary for `provenanceSummary.derivation` or
`uncertaintySummary.certainty`, and none for the relationship between
`reviewSummary.reviewed` and `reviewState`. Those are validated for type and
non-emptiness only. Borrowing the identity-specific derivation vocabulary would
have wrongly rejected released values such as `textually_observed`, and
inventing a review coherence rule would be inventing contract. The review
*states* themselves are closed because migration 018 `review_status`, migration
019 `review_state`, and identity assertions all use exactly the same four
values — that is genuinely shared released vocabulary.

### Other corrections in the same pass

- Temporal vocabulary aligned to released SourceRoot semantics (§8); the
  earlier parallel ontology (`occurred`, `attributed`, `valid_from`,
  `valid_until`, closed calendar and precision enums) is gone.
- Identity assertion validation closed over review state, certainty, dispute
  state, status, symmetry, and temporal scope.
- Shared object grammar expanded to cover the required network concepts (§5).
- Persistence-to-network mappings made explicit (§5).
- `rootPayload` documented as a floor, not an authorization boundary (§7).
- Verifier scope discovery made deterministic and repository-local (§14).
- Router `/contracts/roots` response shape clarified so the paginated
  collection and the full registry cannot be confused.

---

## 14. Governed scope discovery

Stage scope discovery must be **deterministic and repository-local**.

The audit found that a user-global Git excludes file
(`~/.config/git/ignore`) hid `.claude/settings.local.json` from governed scope
verification. A user-global rule that no reviewer of this repository can see
must never be able to remove a file from governance.

The focused verifier now neutralizes `core.excludesFile` and honors only the
repository `.gitignore` and the clone-local `.git/info/exclude`. It fails if
any repository file is visible to repository-local discovery but hidden from
the ambient view, so anything intentionally local must be declared somewhere a
reviewer can read. Unrelated global configuration is never read or printed.

`.claude/settings.local.json` is clone-local Claude configuration. It is **not**
added to the tracked stage allowlist and must never be committed; its
local-only nature is declared in clone-local Git metadata instead of in
repository product code.

`verification/sourceroot-shared-grammar.test.cjs` is an **intended** stage
artifact that the repository `.gitignore` hides, because `verification/` is
ignored wholesale. The verifier asserts explicitly that it exists, is inside
the allowlist, and is recognised as ignored. It requires a deliberate force-add
at commit time if that matches established SourceRoot release practice; no
tooling in this stage stages it.

---

## 15. Open findings carried forward

### BEFORE-ADAPTERS

- **Adapter payload schemas.** The generic `rootPayload` denylist is not an
  authorization boundary. Chunks 17A–17C must each define an adapter-owned
  public schema before emitting real payloads (§7).
- **Address `datasetVersion` SemVer constraint.** Address format v1 requires a
  SemVer-compatible dataset version. Every currently released dataset complies.
  This is kept deliberately narrow for v1 and flagged for review before
  adapters, rather than broadened speculatively now. The same rule now also
  governs `sourceDatasetVersion` on identity evidence, so any relaxation must
  be reviewed against both.
- **Temporal calendar and precision size bounds.** Both are open source-native
  strings with no length bound. Bounds belong with the adapter contracts, not
  here.
- **`chronologyRanges` member-shape validation.** The array is validated as an
  array; individual member shape is not. Deferred to adapters.
- **Uncertainty and value size constraints.** `uncertaintyStatement` and other
  free-text fields carry no size limit. Deferred to adapters.

### BEFORE-15A

- **Database regression test lifecycle.** The released 14A and 14B persisted
  baselines are correct, but the older 14A/14B suites carry setup and cleanup
  assumptions that no longer hold against the fully provisioned current schema:
  14A cleanup cannot delete resources referenced by 14B evidence, and 14B setup
  cannot replace BibleRoot foundation rows referenced by commentary anchors.
  These are test-lifecycle issues in untouched code, not defects in released
  implementation. Released 14A/14B implementation must **not** be modified to
  satisfy stale lifecycle assumptions. A separate bounded maintenance stage can
  fix the regression lifecycle after 14C release and before 15A.
- **Lifecycle tooling line endings.** `NEW-ROOT-STAGE.ps1`,
  `SET-ACTIVE-ROOT-STAGE.ps1`, and `COMPLETE-ROOT-STAGE.ps1` rewrite
  `ROOT-MANIFEST.json` with CRLF, but that file is committed as LF. Each stage
  must renormalize it to keep `git diff --check` clean. Maintenance item; not
  fixed here.

---

## 16. Explicit non-goals

Migration 020, EarthRoot, map/globe UI, geometry, coordinates, Jerusalem
production data, TimeRoot/PersonRoot/LanguageRoot applications, automatic
entity resolution, fuzzy identity matching, embeddings, similarity scoring,
transitive identity closure, lexical-to-semantic promotion, branding or logo
work, microservices, repository-wide restructuring, dependency upgrades,
mutation APIs, review UI, and the Chunk 17A–17C Root adapters.
