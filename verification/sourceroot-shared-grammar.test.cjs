/**
 * Chunk 14C static semantic-safety verification.
 *
 * These checks are deliberately independent of the TypeScript runtime: they
 * read the repository as text and JSON so that a regression cannot hide behind
 * a compiled abstraction. They cover the S1-S15 semantic-safety boundaries
 * plus the released-baseline and migration guarantees.
 */

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const readJson = (relative) => JSON.parse(read(relative));

const SOURCEROOT_DIR = "backend/src/sourceroot";
const MODULES = [
  "addressing.ts",
  "object-types.ts",
  "root-registry.ts",
  "identity-assertions.ts",
  "query-vocabulary.ts",
  "response-envelope.ts",
  "contracts.ts",
];

const sources = Object.fromEntries(
  MODULES.map((name) => [name, read(`${SOURCEROOT_DIR}/${name}`)]),
);
const allContractSource = Object.values(sources).join("\n");
const routerSource = read("backend/src/routes/sourceroot-contracts.ts");
const fixtureSource = read(
  "backend/test/fixtures/sourceroot-jerusalem-contract-fixture.ts",
);
const backendTestSource = read("backend/test/sourceroot-shared-grammar.test.ts");
const appSource = read("backend/src/app.ts");

/** Extracts the literal members of a `const NAME = [...] as const;` array. */
function vocabularyMembers(source, constantName) {
  const match = new RegExp(
    `${constantName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`,
  ).exec(source);
  assert.ok(match, `${constantName} must be declared as a literal array`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

const ACCEPTED_KINDS = vocabularyMembers(
  sources["identity-assertions.ts"],
  "ACCEPTED_IDENTITY_EVIDENCE_KINDS",
);
const REJECTED_KINDS = vocabularyMembers(
  sources["identity-assertions.ts"],
  "REJECTED_IDENTITY_EVIDENCE_KINDS",
);

test("1. every contract module exists inside the approved boundary", () => {
  for (const name of MODULES) {
    assert.ok(
      fs.existsSync(path.join(root, SOURCEROOT_DIR, name)),
      `${name} is missing`,
    );
  }
  const actual = fs
    .readdirSync(path.join(root, SOURCEROOT_DIR))
    .filter((name) => name.endsWith(".ts"))
    .sort();
  assert.deepEqual(actual, [...MODULES].sort());
});

test("2. all three version axes are declared and independent", () => {
  assert.match(
    sources["addressing.ts"],
    /SOURCEROOT_ADDRESS_FORMAT_VERSION\s*=\s*"1\.0\.0"/,
  );
  assert.match(
    sources["root-registry.ts"],
    /SOURCEROOT_CONTRACT_VERSION\s*=\s*"1\.0\.0"/,
  );
  assert.match(sources["contracts.ts"], /SOURCEROOT_VERSION_AXES/);
  assert.match(sources["contracts.ts"], /sourcerootContract:/);
  assert.match(sources["contracts.ts"], /addressFormat:/);
  assert.match(sources["contracts.ts"], /rootContract:/);
  assert.match(sources["root-registry.ts"], /rootContractVersion/);
  assert.match(
    sources["addressing.ts"],
    /independent from the SourceRoot (shared )?contract version/i,
  );
});

test("3. address format v1 requires dataset qualification and escapes every component", () => {
  assert.match(
    sources["addressing.ts"],
    /sourceroot:<rootId>\/<objectType>\/<canonicalPublicId>@<datasetId>:<datasetVersion>/,
  );
  assert.match(sources["addressing.ts"], /address-dataset-qualification-missing/);
  assert.match(sources["addressing.ts"], /address-dataset-version-missing/);
  assert.match(sources["addressing.ts"], /encodeAddressComponent/);
  assert.match(sources["addressing.ts"], /decodeAddressComponent/);
  assert.match(sources["addressing.ts"], /address-encoding-not-canonical/);
  assert.match(sources["addressing.ts"], /datasetQualification: "required"/);
  assert.match(
    sources["addressing.ts"],
    /datasetIndependentIdentity: "not-defined-in-v1"/,
  );
  assert.match(
    sources["addressing.ts"],
    /never implies shared identity between Root-owned resources/i,
  );
});

test("S0. the accepted and rejected evidence vocabularies are disjoint", () => {
  assert.equal(ACCEPTED_KINDS.length, 4);
  assert.equal(REJECTED_KINDS.length, 10);
  for (const kind of REJECTED_KINDS) {
    assert.ok(
      !ACCEPTED_KINDS.includes(kind),
      `${kind} must never appear in the accepted vocabulary`,
    );
  }
  for (const kind of ACCEPTED_KINDS) {
    assert.match(
      kind,
      /^(explicit_source_statement|governed_editorial_decision|released_dataset_cross_reference|human_reviewed_documentary_evidence)$/,
      "the accepted vocabulary must stay explicit and human- or source-originated",
    );
  }
});

test("S1. no name-only or alias-only identity path exists", () => {
  for (const kind of ["name_only_match", "alias_only_match"]) {
    assert.ok(REJECTED_KINDS.includes(kind), `${kind} must be rejected`);
    assert.ok(!ACCEPTED_KINDS.includes(kind));
  }
  assert.match(
    sources["identity-assertions.ts"],
    /rule: "rejected-evidence-kind"/,
  );
});

test("S2. no lexical-match identity path exists, including Chunk 14A evidence", () => {
  for (const kind of ["lexical_overlap", "chunk_14a_lexical_evidence"]) {
    assert.ok(REJECTED_KINDS.includes(kind), `${kind} must be rejected`);
    assert.ok(!ACCEPTED_KINDS.includes(kind));
  }
  assert.ok(!ACCEPTED_KINDS.some((kind) => /lexical/.test(kind)));
  assert.match(
    sources["root-registry.ts"],
    /Discovery evidence only; it can never establish identity/,
  );
});

test("S3. no coordinate-only identity path exists", () => {
  assert.ok(REJECTED_KINDS.includes("coordinate_only_match"));
  assert.ok(!ACCEPTED_KINDS.some((kind) => /coordinate|geo|spatial/.test(kind)));
});

test("S4. Root ownership is stated and never merged", () => {
  assert.match(
    sources["identity-assertions.ts"],
    /A resource belongs to exactly one Root/,
  );
  assert.match(
    sources["identity-assertions.ts"],
    /never\s+(?:\*\s+)?silently\s+(?:\*\s+)?merged, rewritten, deduplicated, or reassigned/,
  );
  assert.match(
    sources["identity-assertions.ts"],
    /rootOwnership:\s*\n?\s*"A resource belongs to exactly one Root and is never merged/,
  );
  assert.doesNotMatch(allContractSource, /function\s+merge[A-Z]\w*Resource/);
  assert.doesNotMatch(allContractSource, /deduplicateResources|reassignRoot/);
});

test("S5. provenance is a required part of every result item", () => {
  for (const field of [
    "provenanceSummary",
    "datasetId",
    "datasetVersion",
    "derivation",
    "sourceLocator",
    "evidenceCount",
  ]) {
    assert.match(sources["response-envelope.ts"], new RegExp(field));
  }
  assert.match(sources["identity-assertions.ts"], /sourceLocator: string/);
  // Evidence rules are generated from the required-field table, so assert the
  // table drives every provenance field rather than looking for one literal.
  for (const [field, label] of [
    ["evidenceId", "id"],
    ["statement", "statement"],
    ["sourceLocator", "locator"],
    ["sourceDatasetId", "dataset-id"],
    ["sourceDatasetVersion", "dataset-version"],
  ]) {
    assert.match(
      sources["identity-assertions.ts"],
      new RegExp(`\\["${field}", "${label}"\\]`),
      `${field} must be validated as a required non-empty provenance field`,
    );
  }
  assert.match(
    sources["identity-assertions.ts"],
    /rule: `evidence-\$\{label\}-required`/,
  );
});

test("S6. uncertainty, review, and dispute state are exposed", () => {
  for (const field of [
    "uncertaintySummary",
    "reviewSummary",
    "uncertaintyStatement",
    "disputed",
    "reviewState",
  ]) {
    assert.match(sources["response-envelope.ts"], new RegExp(field));
  }
  assert.match(sources["identity-assertions.ts"], /SOURCEROOT_IDENTITY_CERTAINTIES/);
  assert.match(sources["identity-assertions.ts"], /SOURCEROOT_IDENTITY_DISPUTE_STATES/);
  assert.match(sources["identity-assertions.ts"], /SOURCEROOT_IDENTITY_REVIEW_STATES/);
});

test("S7. released Chunk 14A counts are exact and unchanged", () => {
  const counts = readJson(
    "backend/data/cross-root-link-foundation-v1/dataset-manifest.json",
  ).expectedCounts;
  assert.equal(counts.resources, 1568);
  assert.equal(counts.links, 2233);
  assert.equal(counts.evidence, 2765);
  assert.equal(counts.dictionaryToHistoryLinks, 1431);
  assert.equal(counts.dictionaryToBibleLinks, 802);
  assert.equal(counts.historyOccurrences, 1790);
  assert.equal(counts.bibleOccurrences, 975);

  for (const [key, value] of Object.entries({
    resources: 1568,
    links: 2233,
    evidence: 2765,
    dictionaryToHistoryLinks: 1431,
    dictionaryToBibleLinks: 802,
    historyOccurrences: 1790,
    bibleOccurrences: 975,
  })) {
    assert.match(
      sources["contracts.ts"],
      new RegExp(`${key}:\\s*${value}`),
      `contracts.ts must freeze ${key}`,
    );
  }
});

test("S8. released Chunk 14B counts are exact and unchanged", () => {
  const counts = readJson(
    "backend/data/cross-root-source-backed-relationships-v1/dataset-manifest.json",
  ).expectedCounts;
  assert.equal(counts.assertions, 143);
  assert.equal(counts.evidence, 178);
  assert.equal(counts.subjectResources, 101);
  assert.equal(counts.objectResources, 76);
  assert.equal(counts.causal, 22);
  assert.equal(counts.nonCausal, 121);
  assert.equal(counts.sameRoot, 143);
  assert.equal(counts.crossRoot, 0);
  assert.equal(counts.disputed, 0);
  assert.equal(counts.uncertain, 143);
  assert.equal(counts.resourceReuse, 280);
  assert.equal(counts.resourceAdditions, 0);
  assert.equal(counts.derivationCounts.directly_sourced, 143);
  assert.equal(counts.reviewStateCounts.unreviewed, 143);

  assert.match(sources["contracts.ts"], /assertions:\s*143/);
  assert.match(sources["contracts.ts"], /directlySourced:\s*143/);
  assert.match(sources["contracts.ts"], /crossRoot:\s*0/);
  assert.match(sources["contracts.ts"], /resourceAdditions:\s*0/);
});

test("S9. migration 018 is byte-identical", () => {
  const file = path.join(
    root,
    "backend/db/migrations/018_create_cross_root_link_foundation.sql",
  );
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.byteLength, 5116);
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(),
    "32760D802354738A6A5B051756BAE59849A05353966FF8752E93EBCC16183A75",
  );
});

test("S10. migration 019 is byte-identical and stays unconstrained on predicate", () => {
  const file = path.join(
    root,
    "backend/db/migrations/019_create_cross_root_source_backed_relationships.sql",
  );
  const bytes = fs.readFileSync(file);
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(),
    "10BBD3D8BF187BC12AD1CC59F738578950AEB7066A65A4DB411B54E855E573F2",
  );
  const sql = bytes.toString("utf8");
  // The predicate column is plain TEXT: no vocabulary CHECK constrains it.
  assert.match(sql, /predicate TEXT NOT NULL,/);
  assert.doesNotMatch(sql, /predicate TEXT NOT NULL CHECK/);
  assert.doesNotMatch(sql, /predicate IN \(/);
  // The only identity-shaped constraint is a self-guard, not governance.
  assert.match(sql, /ck_cross_root_relationship_identity_self_guard/);
  assert.match(sql, /predicate NOT IN \('same_as', 'asserted_same_as', 'possible_same_as'\)/);
  assert.match(sql, /OR subject_resource_id <> object_resource_id/);
  // No identity relationship family exists.
  assert.doesNotMatch(sql, /relationship_family[\s\S]{0,400}'identity'/);
  assert.match(
    sources["identity-assertions.ts"],
    /migration019: "identity-assertion-compatible"/,
  );
  assert.match(
    sources["identity-assertions.ts"],
    /persistedIdentityGovernanceSystem: false/,
  );
  assert.match(
    sources["identity-assertions.ts"],
    /identitySelfGuardPresent: true/,
  );
});

test("S10b. migration 020 is absent and the migration set is unchanged", () => {
  const migrations = fs
    .readdirSync(path.join(root, "backend/db/migrations"))
    .filter((name) => name.endsWith(".sql"));
  assert.equal(migrations.length, 20);
  assert.equal(migrations.filter((name) => name.startsWith("020")).length, 0);
  assert.match(sources["contracts.ts"], /migration020: "deferred-absent"/);
});

test("S11. readiness 1.4.0 semantics are preserved and untouched by this stage", () => {
  const readiness = read("backend/src/services/development-runtime-readiness.ts");
  assert.match(readiness, /contractVersion:\s*"1\.4\.0"/);
  assert.doesNotMatch(readiness, /sourceroot\/contracts/);
  assert.doesNotMatch(readiness, /sharedGrammar/i);
  assert.match(
    sources["contracts.ts"],
    /developmentRuntimeReadinessContractVersion: "1\.4\.0"/,
  );
  assert.doesNotMatch(allContractSource, /"1\.5\.0"/);
});

test("S12. non-transitivity is an invariant with no closure path", () => {
  assert.match(
    sources["identity-assertions.ts"],
    /SOURCEROOT_IDENTITY_TRANSITIVITY\s*=\s*"non_transitive"/,
  );
  assert.match(
    sources["identity-assertions.ts"],
    /directIdentityCounterparts/,
  );
  assert.match(
    sources["identity-assertions.ts"],
    /It does NOT return C\./,
  );
  assert.match(
    sources["identity-assertions.ts"],
    /rule: "non-transitivity-is-invariant"/,
  );
  assert.doesNotMatch(
    allContractSource,
    /transitiveClosure|closeTransitively|expandTransitive|unionFind|disjointSet/i,
  );
  assert.match(
    sources["identity-assertions.ts"],
    /never automatically create[\s\S]{0,40}A-C membership/,
  );
});

test("S13. no embedding, similarity, fuzzy, or confidence path exists", () => {
  for (const kind of [
    "embedding_similarity",
    "fuzzy_match",
    "model_confidence",
    "transitive_closure",
    "temporal_overlap_only",
  ]) {
    assert.match(sources["identity-assertions.ts"], new RegExp(kind));
  }
  assert.doesNotMatch(
    allContractSource,
    /cosineSimilarity|levenshtein|jaroWinkler|editDistance|nearestNeighbou?r/i,
  );
  assert.doesNotMatch(allContractSource, /function\s+\w*[Ee]mbedding/);
  assert.doesNotMatch(allContractSource, /similarityScore|confidenceScore/);
  assert.doesNotMatch(routerSource, /similarity|embedding/i);
});

test("S14. temporal honesty is enforced and TimeRoot is not implemented", () => {
  for (const mode of [
    "exact",
    "approximate",
    "range",
    "before",
    "after",
    "disputed",
    "unknown",
    "multiple_proposed",
    "not_asserted",
  ]) {
    assert.match(sources["query-vocabulary.ts"], new RegExp(`"${mode}"`));
  }
  for (const operator of ["at", "overlaps", "before", "after", "during"]) {
    assert.match(sources["query-vocabulary.ts"], new RegExp(`"${operator}"`));
  }
  assert.match(sources["query-vocabulary.ts"], /calendarSystem/);
  assert.match(sources["query-vocabulary.ts"], /precision/);
  assert.match(sources["query-vocabulary.ts"], /uncertaintyStatement/);
  assert.match(sources["query-vocabulary.ts"], /timeRole/);
  assert.match(sources["query-vocabulary.ts"], /chronologyRanges/);
  assert.match(
    sources["query-vocabulary.ts"],
    /not a claim that the record is timeless/,
  );
  assert.match(sources["query-vocabulary.ts"], /timeRootImplemented: false/);
});

test("S15. no fallback domain data and no fixture data in production source", () => {
  for (const [name, source] of Object.entries(sources)) {
    assert.doesNotMatch(source, /fallback[A-Z]/, `${name} carries fallback data`);
    assert.doesNotMatch(source, /Jerusalem/i, `${name} carries fixture data`);
    assert.doesNotMatch(source, /sampleResources|staticResources|seedResources/i);
  }
  assert.doesNotMatch(routerSource, /Jerusalem/i);
  assert.doesNotMatch(routerSource, /fallback[A-Z]/);
  assert.ok(
    !fs.existsSync(path.join(root, SOURCEROOT_DIR, "jerusalem-contract-fixture.ts")),
    "the fixture must not live in production source",
  );
});

test("4. spatial support is vocabulary only across the whole contract", () => {
  assert.match(
    sources["query-vocabulary.ts"],
    /SOURCEROOT_SPATIAL_SUPPORT_STATE\s*=\s*"vocabulary-only"/,
  );
  assert.match(sources["query-vocabulary.ts"], /earthRootImplemented: false/);
  assert.match(
    sources["query-vocabulary.ts"],
    /SourceRootSpatialNotImplementedError/,
  );
  for (const excluded of [
    "geometry",
    "coordinates",
    "geocoding",
    "bounding boxes",
    "map projection",
    "map user interface",
  ]) {
    assert.match(sources["query-vocabulary.ts"], new RegExp(excluded));
  }
  assert.match(
    sources["root-registry.ts"],
    /spatialQuery: false/,
  );
  assert.match(
    sources["root-registry.ts"],
    /rule: "spatial-query-unsupported"|"spatial-query-unsupported"/,
  );
  assert.doesNotMatch(allContractSource, /latitude|longitude|GeoJSON|PostGIS/i);
});

test("5. the object-type maturity model keeps three distinct states", () => {
  assert.match(
    sources["object-types.ts"],
    /SOURCEROOT_OBJECT_TYPE_MATURITIES[\s\S]{0,120}"defined"[\s\S]{0,40}"implemented"[\s\S]{0,40}"provided"/,
  );
  assert.match(
    sources["object-types.ts"],
    /A database table existing somewhere does NOT make a network object PROVIDED/,
  );
  assert.match(
    sources["object-types.ts"],
    /rule: "provided-implies-implemented"/,
  );
  assert.match(
    sources["object-types.ts"],
    /is NOT the same as an empty result/,
  );
  assert.match(sources["object-types.ts"], /isEmptyResultMeaningful/);
  for (const state of ["supported", "unsupported", "unavailable", "awaiting-data"]) {
    assert.match(sources["object-types.ts"], new RegExp(`"${state}"`));
  }
  assert.match(sources["object-types.ts"], /"place"/);
});

test("6. the Root registry lists every operational and planned Root truthfully", () => {
  for (const rootId of ["DictionaryRoot", "HistoryRoot", "BibleRoot"]) {
    assert.match(sources["root-registry.ts"], new RegExp(`"${rootId}"`));
  }
  for (const rootId of ["EarthRoot", "TimeRoot", "PersonRoot", "LanguageRoot"]) {
    assert.match(sources["root-registry.ts"], new RegExp(`"${rootId}"`));
  }
  assert.match(
    sources["root-registry.ts"],
    /"planned-root-cannot-be-ready"/,
  );
  assert.match(
    sources["root-registry.ts"],
    /"capability-requires-available-runtime"/,
  );
  assert.match(
    sources["root-registry.ts"],
    /must not claim a capability it cannot satisfy/i,
  );
  assert.match(sources["root-registry.ts"], /ROOT_REGISTRY_CONVERGENCE_PATH/);
  assert.match(
    sources["root-registry.ts"],
    /authoritative going forward/i,
  );
  for (const debtPath of [
    "backend/db/migrations/018_create_cross_root_link_foundation.sql",
    "backend/src/services/cross-root-store.ts",
    "assets/js/sourceroot-unified-search.js",
  ]) {
    assert.match(sources["root-registry.ts"], new RegExp(debtPath.replace(/[/.]/g, "\\$&")));
  }
});

test("7. the response envelope treats partial results as first class", () => {
  for (const field of [
    "sourcerootContractVersion",
    "rootContractVersions",
    "addressFormatVersion",
    "status",
    "requestedRoots",
    "respondingRoots",
    "unavailableRoots",
    "rootGroups",
    "pagination",
    "appliedFilters",
    "appliedSort",
    "semanticConclusion",
  ]) {
    assert.match(sources["response-envelope.ts"], new RegExp(field));
  }
  assert.match(
    sources["response-envelope.ts"],
    /PARTIAL RESULTS ARE FIRST CLASS/,
  );
  assert.match(
    sources["response-envelope.ts"],
    /never\s+(?:\*\s+)?silently\s+(?:\*\s+)?disappear/i,
  );
  assert.match(sources["response-envelope.ts"], /deriveResultStatus/);
  assert.match(sources["response-envelope.ts"], /"ok"[\s\S]{0,40}"partial"[\s\S]{0,40}"unavailable"/);
});

test("8. the rootPayload boundary excludes Root internals", () => {
  assert.match(
    sources["response-envelope.ts"],
    /ROOT_PAYLOAD_FORBIDDEN_KEYS/,
  );
  for (const key of [
    "databaseRow",
    "tableName",
    "internalId",
    "sql",
    "pool",
    "client",
    "passwordHash",
  ]) {
    assert.match(sources["response-envelope.ts"], new RegExp(`"${key}"`));
  }
  assert.match(sources["response-envelope.ts"], /ROOT-PUBLIC CONTRACT DATA only/);
  assert.match(sources["response-envelope.ts"], /Chunks 17A-17C/);
  assert.match(sources["response-envelope.ts"], /rule: "private-key-prefix"/);
});

test("9. the contract surface is read-only with no mutation route", () => {
  assert.doesNotMatch(routerSource, /Router\(\)[\s\S]*\.(post|put|patch|delete)\(/);
  assert.match(routerSource, /read-only/i);
  assert.match(appSource, /sourceRootContractsRouter/);
  assert.match(
    appSource,
    /app\.use\("\/api\/v1\/sourceroot", sourceRootContractsRouter\)/,
  );
  assert.match(routerSource, /parsePagination/);
  assert.match(sources["contracts.ts"], /mutationSupport: false/);
});

test("10. the Jerusalem fixture is synthetic, bounded, and outside production data", () => {
  assert.match(fixtureSource, /SYNTHETIC CONTRACT FIXTURE - NOT PRODUCTION DATA/);
  assert.match(fixtureSource, /Real Jerusalem content belongs to Chunk 18A/);
  assert.match(fixtureSource, /FIXTURE_IS_PRODUCTION_DATA = false/);
  assert.match(fixtureSource, /0\.0\.0-contract-fixture/);
  assert.ok(
    fixtureSource.includes('rootId: "DictionaryRoot"') &&
      fixtureSource.includes('rootId: "HistoryRoot"') &&
      fixtureSource.includes('rootId: "BibleRoot"') &&
      fixtureSource.includes('rootId: "EarthRoot"'),
    "the fixture must cover all four resources",
  );
  assert.doesNotMatch(fixtureSource, /backend\/data\//);
  assert.doesNotMatch(fixtureSource, /historyroot-plymouth-knowledge-dataset/);
  assert.doesNotMatch(fixtureSource, /bibleroot-foundation-v1/);
  assert.doesNotMatch(fixtureSource, /dictionaryroot-core-lexical-corpus/);

  assert.match(backendTestSource, /S1 no name-only identity merge/);
  assert.match(backendTestSource, /S2 no lexical-match identity merge/);
  assert.match(backendTestSource, /S3 no coordinate-only identity merge/);
  assert.match(
    backendTestSource,
    /S12 accepted assertions never produce transitive closure/,
  );
  assert.match(
    backendTestSource,
    /S13 no embedding, similarity, fuzzy, or confidence path/,
  );
});

test("11. no released dataset, migration, or Root module is modified by this stage", () => {
  for (const name of MODULES) {
    const source = sources[name];
    assert.doesNotMatch(source, /import[\s\S]{0,120}cross-root-store/);
    assert.doesNotMatch(source, /import[\s\S]{0,120}cross-root-relationship-store/);
    assert.doesNotMatch(source, /import[\s\S]{0,120}development-runtime-readiness/);
    assert.doesNotMatch(source, /import[\s\S]{0,160}backend\/data/);
  }
  assert.doesNotMatch(routerSource, /getPool|database\.js|cross-root-store/);
  assert.doesNotMatch(routerSource, /development-runtime-readiness/);
});

test("12. governed shared identity is defined but never produced", () => {
  assert.match(
    sources["identity-assertions.ts"],
    /GOVERNED_SHARED_IDENTITY_STATE\s*=\s*\n?\s*"provisional-contract-shape-only"/,
  );
  assert.match(
    sources["identity-assertions.ts"],
    /createGovernedSharedIdentity\(\): never/,
  );
  assert.match(
    sources["identity-assertions.ts"],
    /resolveGovernedSharedIdentity\([\s\S]{0,200}\): null/,
  );
  assert.match(sources["identity-assertions.ts"], /derivedAutomatically: false/);
  assert.match(
    sources["identity-assertions.ts"],
    /membershipRule: "explicitly-reviewed-per-member"/,
  );
  assert.match(sources["identity-assertions.ts"], /reversible: true/);
});

test("13. deferred schema triggers are documented, not solved", () => {
  for (const trigger of [
    "hardcoded Root CHECK",
    "hardcoded resource types",
    "absence of an identity relationship family",
    "unconstrained predicate TEXT",
    "dataset-scoped resource uniqueness",
  ]) {
    assert.ok(
      sources["contracts.ts"].includes(trigger),
      `${trigger} must be documented`,
    );
  }
  assert.match(sources["contracts.ts"], /DEFERRED_SCHEMA_TRIGGERS/);
  assert.match(sources["contracts.ts"], /Do not solve|not 14C work|deferred/i);
});

/* =======================================================================
 * Post-audit correction checks.
 *
 * An independent Codex audit proved two runtime bypasses in the first
 * implementation. These checks are structural guards; the behavioural proof
 * lives in the adversarial runtime tests.
 * ==================================================================== */

test("C1. identity traversal re-validates and never trusts caller shape", () => {
  const source = sources["identity-assertions.ts"];
  assert.match(source, /export function evaluateIdentityCounterpartEligibility/);
  assert.match(
    source,
    /IDENTITY_COUNTERPART_ELIGIBLE_PREDICATES\s*=\s*\[\s*\n?\s*"asserted_same_as",?\s*\n?\s*\]/,
  );
  assert.match(
    source,
    /IDENTITY_COUNTERPART_ELIGIBLE_REVIEW_STATES\s*=\s*\[\s*\n?\s*"accepted_after_review",?\s*\n?\s*\]/,
  );
  assert.match(
    source,
    /IDENTITY_COUNTERPART_ELIGIBLE_STATUSES\s*=\s*\["active"\]/,
  );
  assert.match(
    source,
    /IDENTITY_COUNTERPART_ELIGIBLE_DISPUTE_STATES\s*=\s*\[\s*\n?\s*"not_disputed",?\s*\n?\s*\]/,
  );

  // Traversal must call the eligibility gate, and the gate must call the
  // complete validator.
  const traversal = /export function directIdentityCounterparts[\s\S]*?\n}/.exec(source);
  assert.ok(traversal, "directIdentityCounterparts must exist");
  assert.match(
    traversal[0],
    /evaluateIdentityCounterpartEligibility\(assertion\)\.eligible/,
  );
  const gate = /export function evaluateIdentityCounterpartEligibility[\s\S]*?\n}/.exec(source);
  assert.ok(gate);
  assert.match(gate[0], /validateIdentityAssertion\(assertion\)/);

  // The pre-audit shortcut must be gone.
  assert.doesNotMatch(
    traversal[0],
    /assertion\.status !== "active"/,
    "traversal must not re-implement a partial ad-hoc filter",
  );
});

test("C2. the identity validator closes every closed vocabulary", () => {
  const source = sources["identity-assertions.ts"];
  for (const rule of [
    "predicate-vocabulary",
    "derivation-must-be-explicit",
    "review-state-vocabulary",
    "certainty-vocabulary",
    "dispute-state-vocabulary",
    "status-vocabulary",
    "symmetry-vocabulary",
    "non-transitivity-is-invariant",
    "evidence-required",
  ]) {
    assert.match(source, new RegExp(`rule: "${rule}"`), `${rule} must be validated`);
  }
  assert.match(source, /validateTemporalScope\(assertion\.temporalScope\)/);
  assert.match(
    source,
    /creationValidation:[\s\S]{0,200}fails closed/i,
    "creation must fail closed, distinctly from forward-compatible rendering",
  );
});

test("C2b. identity evidence provenance is required and traceable", () => {
  const source = sources["identity-assertions.ts"];
  assert.match(source, /REQUIRED_IDENTITY_EVIDENCE_FIELDS/);
  for (const field of [
    "evidenceId",
    "kind",
    "statement",
    "sourceDatasetId",
    "sourceDatasetVersion",
    "sourceLocator",
  ]) {
    assert.match(
      source,
      new RegExp(`REQUIRED_IDENTITY_EVIDENCE_FIELDS[\\s\\S]{0,300}"${field}"`),
      `${field} must be declared required`,
    );
  }
  // Presence alone must not satisfy the contract.
  assert.match(source, /value\.trim\(\)\.length === 0/);
  assert.match(source, /Identity evidence must be traceable/);
  assert.match(source, /checkDatasetVersion\(evidence\.sourceDatasetVersion\)/);
  assert.match(source, /rule: "evidence-dataset-version-malformed"/);
});

test("C2c. addressFormatVersion is validated from a single source of truth", () => {
  const identity = sources["identity-assertions.ts"];
  const addressing = sources["addressing.ts"];

  assert.match(addressing, /SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS/);
  assert.match(addressing, /export function checkAddressFormatVersion/);
  assert.match(addressing, /export function checkDatasetVersion/);
  assert.match(
    addressing,
    /SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS\s*=\s*\[\s*\n?\s*SOURCEROOT_ADDRESS_FORMAT_VERSION,/,
    "the supported set must derive from the single version constant",
  );

  assert.match(identity, /checkAddressFormatVersion\(\s*\n?\s*assertion\.addressFormatVersion,?\s*\n?\s*\)/);
  assert.match(identity, /address-format-version-\$\{addressVersionProblem\}/);

  // No duplicated version literal outside addressing.ts.
  assert.doesNotMatch(
    identity,
    /addressFormatVersion[^\n]*===\s*"\d+\.\d+\.\d+"/,
  );
  const versionLiterals = (identity.match(/"\d+\.\d+\.\d+"/g) || []).filter(
    (literal) => literal !== '"1.4.0"',
  );
  assert.deepEqual(
    versionLiterals,
    [],
    `identity-assertions.ts must not hardcode a version literal, found ${versionLiterals.join(", ")}`,
  );
});

test("C2d. Root identity and contract-version authority live only in the registry", () => {
  const registry = sources["root-registry.ts"];
  const envelope = sources["response-envelope.ts"];

  // The registry owns the validators.
  assert.match(registry, /export function checkRootId/);
  assert.match(registry, /export function checkRespondingRoot/);
  assert.match(registry, /export function checkRootContractVersion/);
  assert.match(registry, /export function supportedRootContractVersion/);
  assert.match(registry, /import \{[\s\S]{0,120}checkVersionSyntax/);

  // The envelope consumes them and owns no Root list or version table.
  assert.match(
    envelope,
    /import \{[\s\S]{0,400}checkRespondingRoot,[\s\S]{0,400}\} from "\.\/root-registry\.js"/,
  );
  assert.doesNotMatch(envelope, /ROOT_IDS\s*=/);
  assert.doesNotMatch(envelope, /SUPPORTED_ROOT_VERSIONS/);
  assert.doesNotMatch(envelope, /OPERATIONAL_ROOT_IDS\s*=/);
  for (const rootId of [
    "DictionaryRoot",
    "HistoryRoot",
    "BibleRoot",
    "EarthRoot",
  ]) {
    assert.doesNotMatch(
      envelope,
      new RegExp(`"${rootId}"`),
      `response-envelope.ts must not hardcode ${rootId}`,
    );
  }
  const envelopeVersionLiterals = envelope.match(/"\d+\.\d+\.\d+"/g) || [];
  assert.deepEqual(
    envelopeVersionLiterals,
    [],
    `response-envelope.ts must not hardcode a version literal, found ${envelopeVersionLiterals.join(", ")}`,
  );

  // The version syntax rule exists in exactly one place.
  assert.match(sources["addressing.ts"], /export function checkVersionSyntax/);
  const patternOwners = MODULES.filter((name) =>
    /0\|\[1-9\]\\d\*/.test(sources[name]),
  );
  assert.deepEqual(
    patternOwners,
    ["addressing.ts"],
    "the version pattern must live only in addressing.ts",
  );
});

test("C2e. governed Root validation is wired into envelope construction", () => {
  const envelope = sources["response-envelope.ts"];
  // Capture the whole function body: up to the next top-level export.
  const accounting =
    /export function validateResponseAccounting[\s\S]*?(?=\nexport )/.exec(
      envelope,
    );
  assert.ok(accounting, "validateResponseAccounting must exist");
  for (const call of [
    "checkRootId",
    "checkRespondingRoot",
    "checkRootContractVersion",
  ]) {
    assert.ok(
      accounting[0].includes(call),
      `${call} must be called during accounting validation`,
    );
  }
  for (const rule of [
    "requested-root-id-",
    "responding-root-",
    "unavailable-root-id-",
    "item-root-id-",
    "contract-version-root-id-",
    "root-contract-version-",
    "unavailable-entry-shape",
    "item-shape",
    "root-contract-versions-shape",
  ]) {
    assert.ok(
      envelope.includes(rule),
      `${rule} must be an enforced violation rule`,
    );
  }
  // Container shape rules are generated per field from one table.
  assert.match(envelope, /fail\(`\$\{field\}-shape`/);
  for (const field of [
    "requestedRoots",
    "respondingRoots",
    "unavailableRoots",
    "items",
  ]) {
    assert.match(
      envelope,
      new RegExp(`\\["${field}", options\\.${field}\\]`),
      `${field} must be shape-checked`,
    );
  }

  // Accounting must run before payload inspection so a malformed container
  // cannot crash ahead of being reported.
  const builder =
    /export function buildSourceRootResponseEnvelope[\s\S]*?(?=\n\/\*\*|\nexport )/.exec(
      envelope,
    );
  assert.ok(builder);
  assert.ok(
    builder[0].indexOf("validateResponseAccounting") <
      builder[0].indexOf("validateRootPayload"),
    "accounting validation must precede payload validation",
  );
});

test("C2f. the result-item contract is enforced by the envelope builder", () => {
  const envelope = sources["response-envelope.ts"];

  assert.match(envelope, /export function validateResultItem/);
  assert.match(envelope, /export class SourceRootResultItemContractError/);
  assert.match(envelope, /REQUIRED_RESULT_ITEM_FIELDS/);

  // Every field of the declared interface must appear in the required list.
  const interfaceBlock =
    /export interface SourceRootResultItem \{([\s\S]*?)\n\}/.exec(envelope);
  assert.ok(interfaceBlock, "SourceRootResultItem must exist");
  const declaredFields = [
    ...interfaceBlock[1].matchAll(/^\s*readonly (\w+)[?]?:/gm),
  ].map((match) => match[1]);
  const requiredBlock =
    /REQUIRED_RESULT_ITEM_FIELDS = \[([\s\S]*?)\] as const/.exec(envelope);
  assert.ok(requiredBlock);
  const requiredFields = [...requiredBlock[1].matchAll(/"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(
    [...declaredFields].sort(),
    [...requiredFields].sort(),
    "every declared result-item field must be in the required-field list",
  );

  // The builder must run it, and callers must not have to remember to.
  const builder =
    /export function buildSourceRootResponseEnvelope[\s\S]*?(?=\n\/\*\*|\nexport )/.exec(
      envelope,
    );
  assert.ok(builder);
  assert.match(builder[0], /validateResultItem\(item, index\)/);
  assert.match(builder[0], /throw new SourceRootResultItemContractError/);
  assert.ok(
    builder[0].indexOf("validateResultItem") <
      builder[0].indexOf("validateRootPayload"),
    "result-item validation must precede payload validation",
  );

  // Existing authorities are reused, not duplicated.
  for (const authority of [
    "checkRootId",
    "checkVersionSyntax",
    "tryParseSourceRootAddress",
    "isSourceRootObjectType",
    "SOURCEROOT_TEMPORAL_MODES",
    "SOURCEROOT_IDENTITY_REVIEW_STATES",
  ]) {
    assert.ok(
      envelope.includes(authority),
      `${authority} must be reused by the result-item validator`,
    );
  }
  assert.doesNotMatch(envelope, /"unreviewed",\s*\n\s*"accepted_after_review"/);

  // Nothing is manufactured, defaulted, fabricated, or inferred.
  assert.match(envelope, /Missing metadata is never manufactured/);
  assert.match(envelope, /Provenance is never defaulted/);
  assert.match(envelope, /Temporal state is never fabricated/);
  assert.match(envelope, /Review state is never inferred/);
});

test("C3. temporal vocabulary reuses released SourceRoot semantics", () => {
  const source = sources["query-vocabulary.ts"];
  // Structural proof of reuse: the vocabulary is imported, not re-declared.
  assert.match(
    source,
    /import \{[\s\S]*?historicalDatePrecisions,[\s\S]*?temporalKinds,[\s\S]*?temporalRoles,[\s\S]*?\} from "\.\.\/contextual-types\.js"/,
  );
  assert.match(source, /SOURCEROOT_TEMPORAL_MODES = \[\s*\n?\s*\.\.\.temporalKinds/);
  assert.match(source, /SOURCEROOT_TIME_ROLES = temporalRoles/);

  // The invented parallel ontology must be gone.
  for (const invented of ["occurred", "attributed", "valid_from", "valid_until"]) {
    assert.doesNotMatch(
      source,
      new RegExp(`"${invented}"`),
      `${invented} was a parallel ontology term and must not return`,
    );
  }
  assert.doesNotMatch(source, /"source_native"/);

  // Calendar and precision must stay open source-native strings.
  assert.match(source, /export type SourceRootTemporalPrecision = string/);
  assert.match(source, /export type SourceRootCalendarSystem = string/);
  assert.match(source, /rule: "calendar-system-required"/);
  assert.match(source, /rule: "temporal-precision-required"/);
  assert.match(source, /openSourceNativeFields/);

  // The released vocabulary source must itself be untouched by this stage.
  const contextualTypes = read("backend/src/contextual-types.ts");
  assert.match(contextualTypes, /"event_time"/);
  assert.match(contextualTypes, /"named_period"/);
  assert.doesNotMatch(contextualTypes, /sourceroot\//);
});

test("C4. the response envelope enforces the accounting invariant", () => {
  const source = sources["response-envelope.ts"];
  assert.match(source, /export function validateResponseAccounting/);
  assert.match(source, /export class SourceRootEnvelopeContractError/);
  for (const rule of [
    "requested-roots-required",
    "duplicate-requested-root",
    "duplicate-responding-root",
    "duplicate-unavailable-root",
    "requested-root-unaccounted",
    "root-both-responding-and-unavailable",
    "responding-root-not-requested",
    "unavailable-root-not-requested",
    "unavailable-reason-required",
    "item-root-not-responding",
    "root-contract-version-missing",
    "pagination-offset",
    "pagination-limit",
    "pagination-page",
    "pagination-total",
    "pagination-returned-exceeds-limit",
    "pagination-returned-exceeds-total",
  ]) {
    assert.ok(source.includes(`"${rule}"`), `${rule} must be enforced`);
  }

  // The builder must run the invariant before producing an envelope.
  const builder = /export function buildSourceRootResponseEnvelope[\s\S]*?\n}/.exec(source);
  assert.ok(builder);
  assert.match(builder[0], /validateResponseAccounting\(/);
  assert.match(builder[0], /throw new SourceRootEnvelopeContractError/);
  assert.match(builder[0], /deriveResultStatus\(/);
  // Groups are derived, never caller-supplied.
  assert.match(builder[0], /const rootGroups: SourceRootRootGroup\[\] = respondingRoots\.map/);
  assert.doesNotMatch(source, /options\.rootGroups/);
});

test("C5. the shared object grammar covers the required network concepts", () => {
  const source = sources["object-types.ts"];
  for (const objectType of [
    "entity",
    "source",
    "claim",
    "evidence",
    "relationship",
    "revision",
    "dataset",
    "provenance-record",
    "temporal-assertion",
    "time-span",
    "identity-assertion",
    "lexical-entry",
    "lexical-sense",
    "historical-record",
    "scripture-passage",
    "place",
    "person",
    "polity",
    "event",
    "language",
    "script",
  ]) {
    assert.ok(
      source.includes(`"${objectType}"`),
      `${objectType} must be DEFINED in the shared grammar`,
    );
    assert.ok(
      source.includes(`objectType: "${objectType}"`),
      `${objectType} must carry a definition entry`,
    );
  }
});

test("C6. persistence-to-network mappings are explicit and released names are intact", () => {
  const source = sources["object-types.ts"];
  assert.match(source, /PERSISTENCE_TO_NETWORK_OBJECT_TYPES/);
  assert.match(source, /export function networkObjectTypeForPersistenceType/);
  assert.match(source, /export function persistenceTypeForNetworkObjectType/);
  for (const [persistence, network] of [
    ["lemma", "lexical-entry"],
    ["accepted-contextual-record", "historical-record"],
    ["edition-verse-text", "scripture-passage"],
  ]) {
    assert.match(
      source,
      new RegExp(
        `persistenceResourceType: "${persistence}"[\\s\\S]{0,160}networkObjectType: "${network}"`,
      ),
      `${persistence} must map explicitly to ${network}`,
    );
  }

  // Released persistence names must remain exactly as migration 018 has them.
  const migration = read(
    "backend/db/migrations/018_create_cross_root_link_foundation.sql",
  );
  for (const persistence of [
    "lemma",
    "accepted-contextual-record",
    "edition-verse-text",
  ]) {
    assert.ok(migration.includes(`'${persistence}'`));
  }
  assert.match(sources["contracts.ts"], /persistenceToNetworkMappings/);
});

test("C7. rootPayload documents that a denylist is not an authorization boundary", () => {
  assert.match(sources["contracts.ts"], /isAuthorizationBoundary: false/);
  assert.match(sources["contracts.ts"], /beforeAdaptersRequirement/);
  assert.match(
    sources["contracts.ts"],
    /adapter-owned public schema with allowlisted fields/,
  );
  const architecture = read(
    "docs/architecture/SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS-V1.md",
  );
  assert.match(architecture, /not an authorization boundary/i);
  assert.match(architecture, /allowlist/i);
});

test("C8. the focused verifier makes scope discovery repository-local", () => {
  const verifier = read(
    "VERIFY-SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS.ps1",
  );
  assert.match(verifier, /core\.excludesFile=/);
  assert.match(verifier, /hidden from governed scope by a user-global Git exclude/);
  assert.match(verifier, /\.claude\/settings\.local\.json/);
  assert.match(verifier, /Clone-local Claude configuration is not tracked/);
  assert.match(verifier, /Intended ignored stage artifact exists on disk/);
  // The verifier must never print unrelated global configuration.
  assert.doesNotMatch(verifier, /Get-Content[^\n]*excludesFile/);
  assert.doesNotMatch(verifier, /config --get core\.excludesFile/);
});

test("14. the architecture and build documents state the contract boundaries", () => {
  const architecture = read(
    "docs/architecture/SOURCEROOT-SHARED-GRAMMAR-AND-ROOT-INTEGRATION-CONTRACTS-V1.md",
  );
  const build = read("docs/build/SOURCEROOT-SHARED-GRAMMAR-CONTRACT.md");
  for (const document of [architecture, build]) {
    assert.match(document, /non[-_]transitiv/i);
    assert.match(document, /migration 020/i);
    assert.match(document, /1\.4\.0/);
  }
  assert.match(architecture, /LAYER 1|Layer 1/);
  assert.match(architecture, /LAYER 2|Layer 2/);
  assert.match(architecture, /LAYER 3|Layer 3/);
  assert.match(architecture, /DEFINED/);
  assert.match(architecture, /IMPLEMENTED/);
  assert.match(architecture, /PROVIDED/);
  assert.match(architecture, /18A/);
  assert.match(build, /sourceroot:<rootId>/);
});
