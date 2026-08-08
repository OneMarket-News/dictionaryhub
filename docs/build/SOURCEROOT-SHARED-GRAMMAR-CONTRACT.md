# SourceRoot Shared Grammar Contract — consumer reference

Practical reference for anyone building against the SourceRoot network grammar,
including the future EarthRoot and the Chunk 17A–17C Root adapters.

Architecture rationale lives in
`docs/architecture/SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS-V1.md`.

---

## Versions

| Axis | Value | Notes |
| --- | --- | --- |
| SourceRoot shared contract | `1.0.0` | |
| Address format | `1.0.0` | Independent of the contract version |
| Root contract | per Root | `1.0.0` operational, `null` planned |
| Development runtime readiness | `1.4.0` | Unchanged by this stage |

All axes are SemVer-compatible and move independently. Vocabularies are
append-only within a major version; a released enum value's meaning is never
redefined.

---

## Modules

| Module | Purpose |
| --- | --- |
| `backend/src/sourceroot/addressing.ts` | Address format v1: format, parse, escape, validate |
| `backend/src/sourceroot/object-types.ts` | Object-type vocabulary and DEFINED / IMPLEMENTED / PROVIDED maturity |
| `backend/src/sourceroot/root-registry.ts` | Authoritative Root registry and truthfulness invariants |
| `backend/src/sourceroot/identity-assertions.ts` | Identity vocabulary, evidence rules, non-transitivity, Layer 3 boundary |
| `backend/src/sourceroot/query-vocabulary.ts` | Temporal, spatial, filter, sort, pagination, unknown-value tolerance |
| `backend/src/sourceroot/response-envelope.ts` | Shared envelope and the `rootPayload` boundary |
| `backend/src/sourceroot/contracts.ts` | Entry point: version axes, Root integration contract, frozen baselines |

Import everything from `contracts.js`; it re-exports the whole surface.

---

## Addressing

```
sourceroot:<rootId>/<objectType>/<canonicalPublicId>@<datasetId>:<datasetVersion>
```

Example:

```
sourceroot:HistoryRoot/historical-record/hist-record-0001@historyroot-plymouth-knowledge-dataset-v1:1.3.0
```

```ts
import {
  formatSourceRootAddress,
  parseSourceRootAddress,
  tryParseSourceRootAddress,
} from "../sourceroot/contracts.js";

const address = formatSourceRootAddress({
  rootId: "BibleRoot",
  objectType: "scripture-passage",
  canonicalPublicId: "verse-0001",
  datasetId: "bibleroot-foundation-v1",
  datasetVersion: "1.0.0",
});

const result = tryParseSourceRootAddress(address);
if (!result.ok) {
  // result.code, result.message, result.component
}
```

Rejection codes: `address-empty`, `address-too-long`,
`address-scheme-invalid`, `address-structure-invalid`,
`address-dataset-qualification-missing`, `address-dataset-version-missing`,
`address-component-empty`, `address-component-too-long`,
`address-encoding-invalid`, `address-encoding-not-canonical`,
`address-dataset-version-invalid`.

Dataset qualification is required. Round trips are exact. **An address never
implies shared identity.**

---

## Object types

**Shared grammar:** `entity`, `source`, `claim`, `evidence`, `relationship`,
`revision`, `dataset`, `provenance-record`, `temporal-assertion`, `time-span`,
`identity-assertion`.

**Domain:** `lexical-entry`, `lexical-sense`, `historical-record`,
`scripture-passage`, `place`, `person`, `polity`, `event`, `language`,
`script`.

### Persistence-to-network mappings

Adapters must use these; do not invent your own.

| Released persistence type | Root | Network object type |
| --- | --- | --- |
| `lemma` | DictionaryRoot | `lexical-entry` |
| `accepted-contextual-record` | HistoryRoot | `historical-record` |
| `edition-verse-text` | BibleRoot | `scripture-passage` |

```ts
networkObjectTypeForPersistenceType("lemma");        // "lexical-entry"
persistenceTypeForNetworkObjectType("lexical-entry"); // "lemma"
```

Read all three maturity axes; never collapse them:

```ts
const provision = entry.objectTypes.find((p) => p.objectType === "place");
provision.defined;     // true — the grammar defines it
provision.implemented; // false — no Root can represent it yet
provision.provided;    // false — nothing is exposed over the network contract
```

Before rendering "no results", check availability:

```ts
if (!isEmptyResultMeaningful(provision.availability)) {
  // unsupported / unavailable / awaiting-data — NOT an empty result
}
```

---

## Root registry

```ts
listRootRegistry();                       // all seven Roots
getRootRegistryEntry("EarthRoot");        // planned, not ready
buildRootIntegrationContract("BibleRoot");
validateRootRegistry();                   // [] when the registry is truthful
```

In contract v1 every Root reports `networkRuntimeState: "not-implemented"` and
every capability is `false`. A Root that is not `available` cannot declare a
capability true; spatial and mutation support are forbidden outright; planned
Roots can never report ready.

---

## Identity assertions

Predicates: `asserted_same_as`, `possible_same_as`, `distinct_from`,
`related_but_distinct`.

Accepted evidence: `explicit_source_statement`,
`governed_editorial_decision`, `released_dataset_cross_reference`,
`human_reviewed_documentary_evidence`.

**Never accepted:** `name_only_match`, `alias_only_match`, `lexical_overlap`,
`chunk_14a_lexical_evidence`, `coordinate_only_match`,
`temporal_overlap_only`, `embedding_similarity`, `fuzzy_match`,
`model_confidence`, `transitive_closure`.

```ts
const violations = validateIdentityAssertion(assertion);
if (violations.length > 0) { /* show a reviewer all of them */ }
```

### Counterpart traversal eligibility

`directIdentityCounterparts` represents **reviewed direct identity**. It
re-validates every assertion and never trusts caller shape. An assertion yields
a counterpart only if it passes the full validator **and**:

| Field | Eligible value |
| --- | --- |
| predicate | `asserted_same_as` |
| reviewState | `accepted_after_review` |
| status | `active` |
| disputeState | `not_disputed` |
| addressFormatVersion | a supported version (see below) |
| evidence | ≥ 1 entry, all kinds accepted, all traceable |

### Evidence must be traceable

Every required field must be present **and meaningful**. Missing, non-string,
and whitespace-only are all refused.

| Field | Rule |
| --- | --- |
| `evidenceId` | non-empty after trim |
| `kind` | accepted evidence kind |
| `statement` | non-empty after trim |
| `sourceLocator` | non-empty after trim |
| `sourceDatasetId` | non-empty after trim |
| `sourceDatasetVersion` | non-empty after trim **and** SemVer-compatible |

```ts
checkDatasetVersion(value);
// null when valid, else "missing" | "not-a-string" | "blank" | "malformed"

checkAddressFormatVersion(value);
// null when valid, else the above plus "unsupported"
```

`SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS` is the sole source of truth for
which address format versions this build accepts. Never hardcode a version
literal to compare against it.

`possible_same_as`, `distinct_from`, `related_but_distinct`, unreviewed,
disputed, withdrawn, evidence-free, and malformed assertions all yield nothing.
A `possible_same_as` assertion is still a legitimate assertion; it may later be
surfaced through a separate candidate/relation API.

```ts
directIdentityCounterparts(addressA, assertions);
// A↔B and B↔C accepted → returns B for A. Never C.

evaluateIdentityCounterpartEligibility(assertion);
// { eligible: false, reasons: ["review-state-not-eligible:unreviewed"] }

explainIdentityCounterparts(addressA, assertions);
// per-assertion refusal reasons, so nothing is dropped silently
```

Creation fails closed: an unknown value in any closed vocabulary
(predicate, derivation, reviewState, certainty, disputeState, status,
symmetry, temporal mode, timeRole) is rejected rather than coerced.

Withdrawal preserves history:

```ts
withdrawIdentityAssertion(assertion, "Reviewer retracted it.");
// status: "withdrawn"; evidence and provenance intact
```

Layer 3 is unreachable: `createGovernedSharedIdentity()` throws;
`resolveGovernedSharedIdentity()` returns `null`.

Migration 019 is identity-assertion-**compatible**, not a persisted identity
governance system. Predicate control is contract-level only.

---

## Temporal

The released SourceRoot vocabulary is reused directly. There is no alias and no
mapping to get wrong.

| Field | Kind | Values |
| --- | --- | --- |
| `mode` | closed | released `temporalKinds` + `not_asserted` |
| `timeRole` | closed | released `temporalRoles` verbatim |
| `precision` | **open string** | source-native |
| `calendarSystem` | **open string** | source-native |

Operators `at`, `overlaps`, `before`, `after`, `during` are a separate axis: an
operator is a question, not a claim.

Do **not** expect precision or calendar to be enum members. Released corpora
carry `historical-chronology`, `English Old Style (Julian)`,
`approximate-range`, `competing-year`, and more. Both fields must be non-empty
strings and are never coerced.

```ts
describeTemporalScope(TEMPORAL_SCOPE_NOT_ASSERTED);
// "Temporal scope is not asserted by the source. This is not a claim that the
//  record is timeless."

validateTemporalScope(scope); // [] when valid; fails closed on mode/timeRole
```

Never render a missing scope as timeless truth. A `not_asserted` scope may not
carry chronology ranges.

---

## Spatial

Vocabulary only: `at_place`, `within`, `contains`, `intersects`, `near`.

`evaluateSpatialQuery()` throws `SourceRootSpatialNotImplementedError`. No
geometry, coordinates, geocoding, bounding boxes, projection, or map UI exists.
EarthRoot implements spatial semantics in a later chunk.

---

## Response envelope

```ts
buildSourceRootResponseEnvelope({
  requestedRoots, respondingRoots, unavailableRoots,
  rootContractVersions, items, pagination, total,
  appliedFilters, sortField, sortDirection, tieBreaker,
});
```

Status: `ok` (everything answered), `partial` (at least one Root did not),
`unavailable` (none did). Every unavailable Root carries a mandatory reason and
appears in `rootGroups`. Nothing is silently dropped.

### Governed Root identity and contract version

Every Root identifier is validated against the registry at runtime. Matching is
exact — no trimming, no case folding.

```ts
checkRootId(value);
// null | "missing" | "not-a-string" | "blank" | "unregistered"

checkRespondingRoot(value);
// the above, plus "cannot-respond" for a Root the registry grants no
// contract version (i.e. a planned Root)

checkRootContractVersion(rootId, value);
// null | "missing" | "not-a-string" | "blank" | "malformed"
//      | "unsupported" | "unexpected"

supportedRootContractVersion("DictionaryRoot"); // "1.0.0"
supportedRootContractVersion("EarthRoot");      // null
```

A responding Root's version must be **exactly** what the registry declares.
`"2.0.0"` is valid SemVer and still refused when the registry says `"1.0.0"`.

Planned Roots may be requested and accounted unavailable (`rootContractVersions`
value `null`), but can never respond.

Do not build your own Root list or version table — the registry is the sole
authority, and `checkVersionSyntax` in `addressing.ts` owns the version syntax
rule.

### Accounting invariant

**Every requested Root must appear exactly once, as responding or unavailable.
Never neither. Never both.** The builder validates this first and throws
`SourceRootEnvelopeContractError` on any of:

`requestedRoots-shape`, `respondingRoots-shape`, `unavailableRoots-shape`,
`items-shape`, `root-contract-versions-shape`, `unavailable-entry-shape`,
`item-shape`, `requested-root-id-*`, `responding-root-*`,
`unavailable-root-id-*`, `item-root-id-*`, `contract-version-root-id-*`,
`root-contract-version-*`,
`requested-roots-required`, `duplicate-requested-root`,
`duplicate-responding-root`, `duplicate-unavailable-root`,
`requested-root-unaccounted`, `root-both-responding-and-unavailable`,
`responding-root-not-requested`, `unavailable-root-not-requested`,
`unavailable-reason-required`, `unavailable-state-vocabulary`,
`item-root-not-responding`, `root-contract-version-missing`,
`pagination-offset`, `pagination-limit`, `pagination-page`, `pagination-total`,
`pagination-returned-exceeds-limit`, `pagination-returned-exceeds-total`,
`pagination-window-exceeds-total`.

Status is derived from validated accounting; callers cannot supply it. Root
groups are derived inside the builder, so a group cannot exist for an
unaccounted Root.

### Result items are validated

Every item is checked against the full public contract before an envelope is
built; `buildSourceRootResponseEnvelope` throws
`SourceRootResultItemContractError`. You do not call the validator yourself.

All thirteen fields are required: `address`, `rootId`, `objectType`,
`canonicalPublicId`, `datasetId`, `datasetVersion`, `canonicalUrl`,
`provenanceSummary`, `temporalSummary`, `uncertaintySummary`, `reviewSummary`,
`rootPayload`, `semanticConclusion`.

| Field | Rule |
| --- | --- |
| `address` | valid SourceRoot address, and **must agree** with rootId / objectType / canonicalPublicId / datasetId / datasetVersion |
| `objectType` | a DEFINED SourceRoot object type |
| `datasetVersion` | non-blank + shared version rule |
| `canonicalUrl` | `null` when absent — never a blank string |
| `provenanceSummary` | datasetId, datasetVersion (version rule), derivation, sourceLocator (nullable), evidenceCount (non-negative integer) |
| `temporalSummary` | `mode` in the governed vocabulary; `asserted` must equal `mode !== "not_asserted"`; non-blank description |
| `uncertaintySummary` | non-blank certainty, nullable statement, boolean disputed |
| `reviewSummary` | `reviewState` in the released four-state vocabulary; boolean reviewed |
| `semanticConclusion` | exactly `null` |

Nothing is manufactured, defaulted, fabricated, inferred, or repaired. Supply
real metadata or the item is refused.

```ts
validateResultItem(item); // [] when valid, else structured violations
```

### rootPayload

Root-public contract data only. Rejected: the forbidden key list (`row`,
`rows`, `dbRow`, `databaseRow`, `table`, `tableName`, `column`, `columns`,
`primaryKey`, `internalId`, `internal`, `sql`, `query`, `pool`, `client`,
`connection`, `passwordHash`, `sessionToken`, `secret`, `credentials`),
`_`-prefixed keys, functions, depth beyond 4, more than 32 keys.

`buildSourceRootResponseEnvelope` throws `RootPayloadBoundaryError` on
violation.

**This denylist is a floor, not an authorization boundary.** It fails open on
any key nobody thought to forbid. Before Chunks 17A–17C emit real payloads,
each adapter must define an adapter-owned public schema with allowlisted
fields, finite numeric validation, size limits, no storage-row passthrough, no
private implementation fields, and no secret-bearing fields.

---

## Unknown values

```ts
const resolved = resolveVocabularyValue(value, SOURCEROOT_TEMPORAL_MODES);
if (!resolved.known) {
  // resolved.value is preserved verbatim; handling === "preserved-as-unknown"
}
```

Never coerce, never drop, never default.

---

## Discovery routes

All read-only. Mounted at `/api/v1/sourceroot`.

| Route | Returns |
| --- | --- |
| `GET /contracts` | Full contract description and all version axes |
| `GET /contracts/roots` | `rootIntegrationContracts` (paginated) plus `registryMetadata` and `fullRegistry`, both explicitly `paginated: false` |
| `GET /contracts/roots/:rootId` | One Root integration contract, 404 if unregistered |
| `GET /contracts/object-types` | Vocabulary, definitions, and the maturity matrix |
| `GET /contracts/identity-assertions` | Vocabulary, rejection boundaries, Layer 3 boundary |
| `GET /contracts/query` | Temporal, spatial, filter, sort, pagination vocabulary |
| `GET /contracts/address` | Address format; `?address=` validates and echoes components |

Pagination follows the existing repository contract: `page` ≥ 1, `limit` 1–100,
`totalSemantics: "exact"`. There is no mutation route.

---

## Frozen baselines

Chunk 14A: 1568 resources, 2233 links, 2765 evidence, 1431 Dictionary→History,
802 Dictionary→Bible, 1790 History occurrences, 975 Bible occurrences.

Chunk 14B: 143 assertions, 178 evidence, 101 subjects, 76 objects, 22 causal,
121 non-causal, 143 same-Root, 0 cross-Root, 143 directly sourced, 143
unreviewed, 143 uncertain, 0 disputed, 280 resource reuse, 0 additions.

Migrations 018 and 019 are byte-frozen. **Migration 020 must remain absent.**

---

## Running the checks

```bash
cd backend && node --import ./scripts/register-tsx.mjs --test --test-concurrency=1 test/sourceroot-shared-grammar.test.ts
```

```bash
node --test verification/sourceroot-shared-grammar.test.cjs
```

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File ./VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1
```

Both test suites are database-free: this stage is contract-only, so neither
requires `.env.test` or a provisioned PostgreSQL instance.
