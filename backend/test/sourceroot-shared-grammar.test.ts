/**
 * Chunk 14C - SourceRoot Shared Grammar and Root Integration Contracts v1.
 *
 * These tests are database-free by design: this stage is contract-only, so
 * every assertion here can run without `.env.test` or a provisioned
 * PostgreSQL instance.
 *
 * Sections S1-S15 are the load-bearing semantic-safety tests. S1, S2, S3, S12,
 * and S13 are stop conditions: a failure there means the platform has started
 * doing automatic entity resolution and must not ship.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import express from "express";
import request from "supertest";

import {
  ACCEPTED_IDENTITY_EVIDENCE_KINDS,
  DEFERRED_SCHEMA_TRIGGERS,
  FROZEN_RELEASED_BASELINES,
  GovernedSharedIdentityNotImplementedError,
  OPERATIONAL_ROOT_IDS,
  PLANNED_ROOT_IDS,
  REJECTED_IDENTITY_EVIDENCE_KINDS,
  PERSISTENCE_TO_NETWORK_OBJECT_TYPES,
  REQUIRED_IDENTITY_EVIDENCE_FIELDS,
  ROOT_PAYLOAD_FORBIDDEN_KEYS,
  SOURCEROOT_ADDRESS_FORMAT_VERSION,
  SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS,
  checkDatasetVersion,
  checkRespondingRoot,
  checkRootContractVersion,
  checkRootId,
  isAcceptedIdentityEvidenceKind,
  supportedRootContractVersion,
  SOURCEROOT_CONTRACT_VERSION,
  SOURCEROOT_IDENTITY_PREDICATES,
  SOURCEROOT_IDENTITY_TRANSITIVITY,
  SOURCEROOT_MIGRATION_POLICY,
  SOURCEROOT_OBJECT_TYPES,
  SOURCEROOT_OBJECT_TYPE_DEFINITIONS,
  SOURCEROOT_ROOT_IDS,
  SOURCEROOT_SPATIAL_SUPPORT_STATE,
  SOURCEROOT_TEMPORAL_MODES,
  SOURCEROOT_VERSION_AXES,
  SourceRootAddressError,
  SourceRootSpatialNotImplementedError,
  TEMPORAL_SCOPE_NOT_ASSERTED,
  addressesAreEqual,
  buildObjectTypeMaturityMatrix,
  buildRootIntegrationContract,
  createGovernedSharedIdentity,
  createSourceRootAddress,
  deriveResultStatus,
  describeSourceRootContract,
  describeTemporalScope,
  directIdentityCounterparts,
  encodeAddressComponent,
  evaluateIdentityCounterpartEligibility,
  evaluateSpatialQuery,
  explainIdentityCounterparts,
  networkObjectTypeForPersistenceType,
  persistenceTypeForNetworkObjectType,
  REQUIRED_RESULT_ITEM_FIELDS,
  SourceRootEnvelopeContractError,
  SourceRootResultItemContractError,
  validateResultItem,
  type SourceRootIdentityAssertion,
  formatSourceRootAddress,
  getRootRegistryEntry,
  isEmptyResultMeaningful,
  isRootReady,
  isValidIdentityAssertion,
  listRootRegistry,
  parseSourceRootAddress,
  resolveGovernedSharedIdentity,
  resolveVocabularyValue,
  rootUnavailable,
  tryParseSourceRootAddress,
  validateIdentityAssertion,
  validateRootPayload,
  validateRootRegistry,
  withdrawIdentityAssertion,
  buildSourceRootResponseEnvelope,
  RootPayloadBoundaryError,
} from "../src/sourceroot/contracts.js";
import { validateRootRegistryEntry } from "../src/sourceroot/root-registry.js";
import { sourceRootContractsRouter } from "../src/routes/sourceroot-contracts.js";
import {
  FIXTURE_DATASET_ID,
  FIXTURE_DATASET_VERSION,
  FIXTURE_EVIDENCE_FREE_ASSERTION,
  FIXTURE_IDENTITY_ASSERTIONS,
  FIXTURE_IS_PRODUCTION_DATA,
  FIXTURE_KIND,
  FIXTURE_REJECTED_ASSERTION,
  FIXTURE_RESOURCES,
  JERUSALEM_CONTRACT_FIXTURE,
  REJECTED_EVIDENCE_CANDIDATES,
  fixtureResource,
} from "./fixtures/sourceroot-jerusalem-contract-fixture.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..");
const repositoryRoot = path.resolve(backendRoot, "..");

const readJson = (relative: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(repositoryRoot, relative), "utf8"));

function contractApp() {
  const app = express();
  app.use((_request, response, next) => {
    response.locals.requestId = "test-request-id";
    next();
  });
  app.use("/api/v1/sourceroot", sourceRootContractsRouter);
  return app;
}

/* =======================================================================
 * Addressing
 * ==================================================================== */

test("address formatter and parser round-trip exactly", () => {
  const input = {
    rootId: "HistoryRoot",
    objectType: "historical-record",
    canonicalPublicId: "hist-record-0001",
    datasetId: "historyroot-plymouth-knowledge-dataset-v1",
    datasetVersion: "1.3.0",
  };
  const serialized = formatSourceRootAddress(input);
  assert.equal(
    serialized,
    "sourceroot:HistoryRoot/historical-record/hist-record-0001@historyroot-plymouth-knowledge-dataset-v1:1.3.0",
  );
  const parsed = parseSourceRootAddress(serialized);
  assert.equal(formatSourceRootAddress(parsed), serialized);
  assert.equal(parsed.rootId, input.rootId);
  assert.equal(parsed.objectType, input.objectType);
  assert.equal(parsed.canonicalPublicId, input.canonicalPublicId);
  assert.equal(parsed.datasetId, input.datasetId);
  assert.equal(parsed.datasetVersion, input.datasetVersion);
  assert.equal(parsed.addressFormatVersion, SOURCEROOT_ADDRESS_FORMAT_VERSION);
});

test("every delimiter and reserved character in a component is escaped and round-trips", () => {
  const hostile = [
    "a/b",
    "a@b",
    "a:b",
    "a%b",
    "a b",
    "aéb",
    "地図",
    "a#b?c&d",
    "sourceroot:evil/x/y@z:1.0.0",
  ];
  for (const value of hostile) {
    const serialized = formatSourceRootAddress({
      rootId: "DictionaryRoot",
      objectType: "lexical-entry",
      canonicalPublicId: value,
      datasetId: "dictionaryroot-core-lexical-corpus-v1",
      datasetVersion: "1.0.0",
    });
    const body = serialized.slice("sourceroot:".length);
    const segments = (body.split("@")[0] as string).split("/");
    assert.equal(segments.length, 3, `component split stayed unambiguous for ${value}`);
    for (const delimiter of ["/", "@", ":"]) {
      assert.ok(
        !(segments[2] as string).includes(delimiter),
        `${delimiter} must be escaped inside a component`,
      );
    }
    const parsed = parseSourceRootAddress(serialized);
    assert.equal(parsed.canonicalPublicId, value);
    assert.equal(formatSourceRootAddress(parsed), serialized);
  }
});

test("component escaping is canonical and uppercase", () => {
  assert.equal(encodeAddressComponent("a/b"), "a%2Fb");
  assert.equal(encodeAddressComponent("a b"), "a%20b");
  assert.equal(encodeAddressComponent("café"), "caf%C3%A9");
  assert.equal(encodeAddressComponent("a-b_c.d~e"), "a-b_c.d~e");
});

test("non-canonical encodings are rejected so the round trip is exact, not merely lossless", () => {
  const lowercaseEscape =
    "sourceroot:DictionaryRoot/lexical-entry/a%2fb@dictionaryroot-core-lexical-corpus-v1:1.0.0";
  const overEncoded =
    "sourceroot:DictionaryRoot/lexical-entry/%61b@dictionaryroot-core-lexical-corpus-v1:1.0.0";
  for (const candidate of [lowercaseEscape, overEncoded]) {
    const result = tryParseSourceRootAddress(candidate);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.code, /address-encoding/);
    }
  }
});

test("malformed addresses are rejected with specific codes", () => {
  const cases: readonly [unknown, string][] = [
    ["", "address-empty"],
    [undefined, "address-empty"],
    [null, "address-empty"],
    [42, "address-empty"],
    ["http://example.test/x", "address-scheme-invalid"],
    ["sourceroot:HistoryRoot/historical-record@ds:1.0.0", "address-structure-invalid"],
    [
      "sourceroot:HistoryRoot/historical-record/x/y@ds:1.0.0",
      "address-structure-invalid",
    ],
    [
      "sourceroot:HistoryRoot/historical-record/x@ds:1.0.0@ds2:1.0.0",
      "address-structure-invalid",
    ],
    [
      "sourceroot:HistoryRoot/historical-record/x@ds:1.0.0:2.0.0",
      "address-structure-invalid",
    ],
    ["sourceroot:HistoryRoot/historical-record/x@:1.0.0", "address-dataset-qualification-missing"],
    ["sourceroot:/historical-record/x@ds:1.0.0", "address-component-empty"],
    ["sourceroot://historical-record/x@ds:1.0.0", "address-structure-invalid"],
    [
      "sourceroot:HistoryRoot/historical-record/x@ds:not-a-version",
      "address-dataset-version-invalid",
    ],
    [
      "sourceroot:HistoryRoot/historical-record/x@ds:1.0.0%2",
      "address-encoding-invalid",
    ],
  ];
  for (const [candidate, expectedCode] of cases) {
    const result = tryParseSourceRootAddress(candidate);
    assert.equal(result.ok, false, `expected rejection for ${String(candidate)}`);
    if (!result.ok) {
      assert.equal(result.code, expectedCode, `for ${String(candidate)}`);
    }
  }
});

test("missing dataset qualification is rejected in address format v1", () => {
  const missingDataset = tryParseSourceRootAddress(
    "sourceroot:HistoryRoot/historical-record/hist-record-0001",
  );
  assert.equal(missingDataset.ok, false);
  if (!missingDataset.ok) {
    assert.equal(missingDataset.code, "address-dataset-qualification-missing");
  }

  const missingVersion = tryParseSourceRootAddress(
    "sourceroot:HistoryRoot/historical-record/hist-record-0001@historyroot-plymouth-knowledge-dataset-v1",
  );
  assert.equal(missingVersion.ok, false);
  if (!missingVersion.ok) {
    assert.equal(missingVersion.code, "address-dataset-version-missing");
  }

  assert.throws(
    () =>
      formatSourceRootAddress({
        rootId: "HistoryRoot",
        objectType: "historical-record",
        canonicalPublicId: "hist-record-0001",
        datasetId: "",
        datasetVersion: "1.3.0",
      }),
    SourceRootAddressError,
  );
});

test("the address version axis is independent from the SourceRoot contract version", () => {
  assert.equal(SOURCEROOT_VERSION_AXES.addressFormat, SOURCEROOT_ADDRESS_FORMAT_VERSION);
  assert.equal(
    SOURCEROOT_VERSION_AXES.sourcerootContract,
    SOURCEROOT_CONTRACT_VERSION,
  );
  assert.equal(typeof SOURCEROOT_VERSION_AXES.rootContract, "string");
  const contract = describeSourceRootContract();
  assert.ok(contract.sourcerootContractVersion);
  assert.ok(contract.addressFormatVersion);
  for (const entry of listRootRegistry()) {
    assert.ok(entry.sourcerootContractVersion);
    assert.ok(entry.addressFormatVersion);
    assert.ok(
      entry.rootContractVersion !== undefined,
      "every Root declares a Root contract version axis, even when null",
    );
  }
});

/* =======================================================================
 * S1 / S2 / S3 - no name, lexical, or coordinate identity merge
 * ==================================================================== */

test("S1 no name-only identity merge", () => {
  const labels = FIXTURE_RESOURCES.map((item) => item.displayLabel);
  assert.equal(new Set(labels).size, 1, "all four fixture labels are identical");

  const addresses = FIXTURE_RESOURCES.map((item) =>
    formatSourceRootAddress(item.address),
  );
  assert.equal(new Set(addresses).size, 4, "identical labels merge nothing");

  assert.ok(
    (REJECTED_IDENTITY_EVIDENCE_KINDS as readonly string[]).includes(
      "name_only_match",
    ),
  );
  assert.ok(
    (REJECTED_IDENTITY_EVIDENCE_KINDS as readonly string[]).includes(
      "alias_only_match",
    ),
  );

  const violations = validateIdentityAssertion(FIXTURE_REJECTED_ASSERTION);
  assert.ok(violations.some((item) => item.rule === "rejected-evidence-kind"));
  assert.equal(isValidIdentityAssertion(FIXTURE_REJECTED_ASSERTION), false);
});

test("S2 no lexical-match identity merge, including Chunk 14A evidence", () => {
  const tokens = FIXTURE_RESOURCES.map(
    (item) => item.nonIdentitySignals.lexicalOverlapToken,
  );
  assert.equal(new Set(tokens).size, 1, "all four share a lexical token");

  for (const kind of ["lexical_overlap", "chunk_14a_lexical_evidence"]) {
    assert.ok((REJECTED_IDENTITY_EVIDENCE_KINDS as readonly string[]).includes(kind));
    const candidate = REJECTED_EVIDENCE_CANDIDATES.find(
      (item) => item.kind === kind,
    );
    assert.ok(candidate);
    const violations = validateIdentityAssertion({
      ...FIXTURE_REJECTED_ASSERTION,
      evidence: [candidate],
    });
    assert.ok(violations.some((item) => item.rule === "rejected-evidence-kind"));
  }
});

test("S3 no coordinate-only identity merge", () => {
  const history = fixtureResource("HistoryRoot");
  const earth = fixtureResource("EarthRoot");
  assert.equal(
    history.nonIdentitySignals.coordinateText,
    earth.nonIdentitySignals.coordinateText,
  );
  assert.notEqual(
    formatSourceRootAddress(history.address),
    formatSourceRootAddress(earth.address),
  );
  assert.equal(addressesAreEqual(history.address, earth.address), false);

  const candidate = REJECTED_EVIDENCE_CANDIDATES.find(
    (item) => item.kind === "coordinate_only_match",
  );
  assert.ok(candidate);
  const violations = validateIdentityAssertion({
    ...FIXTURE_REJECTED_ASSERTION,
    evidence: [candidate],
  });
  assert.ok(violations.some((item) => item.rule === "rejected-evidence-kind"));
});

/* =======================================================================
 * S4 / S5 / S6 - ownership, provenance, uncertainty
 * ==================================================================== */

test("S4 Root ownership is preserved", () => {
  const owners = FIXTURE_RESOURCES.map((item) => item.rootId);
  assert.deepEqual(owners, [
    "DictionaryRoot",
    "HistoryRoot",
    "BibleRoot",
    "EarthRoot",
  ]);
  assert.equal(new Set(owners).size, 4, "each resource belongs to exactly one Root");

  for (const item of FIXTURE_RESOURCES) {
    assert.equal(item.address.rootId, item.rootId);
  }

  const contract = describeSourceRootContract();
  assert.match(contract.identityModel.layer1, /exactly one Root/);
  assert.match(contract.identityModel.layer1, /never silently merged/);
  assert.match(contract.identityAssertions.assertionSemantics, /does not merge them/);
});

test("S5 provenance is preserved on every result item", () => {
  const envelope = buildSourceRootResponseEnvelope({
    requestedRoots: ["HistoryRoot"],
    respondingRoots: ["HistoryRoot"],
    unavailableRoots: [],
    rootContractVersions: { HistoryRoot: "1.0.0" },
    items: [
      {
        address: formatSourceRootAddress(fixtureResource("HistoryRoot").address),
        rootId: "HistoryRoot",
        objectType: "historical-record",
        canonicalPublicId: "fixture-record-jerusalem-siege",
        datasetId: FIXTURE_DATASET_ID,
        datasetVersion: FIXTURE_DATASET_VERSION,
        canonicalUrl: null,
        provenanceSummary: {
          datasetId: FIXTURE_DATASET_ID,
          datasetVersion: FIXTURE_DATASET_VERSION,
          derivation: "directly_sourced",
          sourceLocator: "fixture://record",
          evidenceCount: 1,
        },
        temporalSummary: {
          mode: "approximate",
          asserted: true,
          description: describeTemporalScope(
            fixtureResource("HistoryRoot").temporalScope,
          ),
        },
        uncertaintySummary: {
          certainty: "uncertain",
          uncertaintyStatement: "The source records the year approximately.",
          disputed: false,
        },
        reviewSummary: { reviewState: "unreviewed", reviewed: false },
        rootPayload: { recordTitle: "Fixture historical record" },
        semanticConclusion: null,
      },
    ],
    pagination: { page: 1, limit: 25, offset: 0 },
    total: 1,
    appliedFilters: { rootId: "HistoryRoot" },
    sortField: "canonicalPublicId",
    sortDirection: "asc",
    tieBreaker: "address",
  });

  const item = envelope.items[0];
  assert.ok(item);
  assert.equal(item.provenanceSummary.datasetId, FIXTURE_DATASET_ID);
  assert.equal(item.provenanceSummary.datasetVersion, FIXTURE_DATASET_VERSION);
  assert.ok(item.provenanceSummary.sourceLocator);
  assert.equal(item.semanticConclusion, null);
  assert.equal(envelope.semanticConclusion, null);
});

test("S6 uncertainty, review state, and dispute state stay exposed", () => {
  for (const assertion of FIXTURE_IDENTITY_ASSERTIONS) {
    assert.ok(assertion.certainty);
    assert.ok(assertion.reviewState);
    assert.ok(assertion.disputeState);
    assert.ok(assertion.temporalScope);
    assert.equal(assertion.transitivity, SOURCEROOT_IDENTITY_TRANSITIVITY);
  }
  const bible = fixtureResource("BibleRoot");
  assert.equal(bible.temporalScope.disputed, true);
  assert.ok(bible.temporalScope.uncertaintyStatement);

  const contract = describeSourceRootContract();
  assert.ok(contract.identityAssertions.certainties.length > 0);
  assert.ok(contract.identityAssertions.disputeStates.length > 0);
});

/* =======================================================================
 * S7 / S8 - released baselines unchanged
 * ==================================================================== */

test("S7 released Chunk 14A counts are unchanged", () => {
  const manifest = readJson(
    "backend/data/cross-root-link-foundation-v1/dataset-manifest.json",
  );
  const counts = manifest.expectedCounts as Record<string, number>;
  assert.equal(counts.resources, 1568);
  assert.equal(counts.links, 2233);
  assert.equal(counts.evidence, 2765);
  assert.equal(counts.dictionaryToHistoryLinks, 1431);
  assert.equal(counts.dictionaryToBibleLinks, 802);
  assert.equal(counts.historyOccurrences, 1790);
  assert.equal(counts.bibleOccurrences, 975);

  const frozen = FROZEN_RELEASED_BASELINES.chunk14A;
  assert.equal(frozen.resources, counts.resources);
  assert.equal(frozen.links, counts.links);
  assert.equal(frozen.evidence, counts.evidence);
  assert.equal(frozen.dictionaryToHistoryLinks, counts.dictionaryToHistoryLinks);
  assert.equal(frozen.dictionaryToBibleLinks, counts.dictionaryToBibleLinks);
  assert.equal(frozen.historyOccurrences, counts.historyOccurrences);
  assert.equal(frozen.bibleOccurrences, counts.bibleOccurrences);
});

test("S8 released Chunk 14B counts are unchanged", () => {
  const manifest = readJson(
    "backend/data/cross-root-source-backed-relationships-v1/dataset-manifest.json",
  );
  const counts = manifest.expectedCounts as Record<string, unknown>;
  const frozen = FROZEN_RELEASED_BASELINES.chunk14B;
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
  assert.equal(
    (counts.derivationCounts as Record<string, number>).directly_sourced,
    143,
  );
  assert.equal(
    (counts.reviewStateCounts as Record<string, number>).unreviewed,
    143,
  );

  assert.equal(frozen.assertions, 143);
  assert.equal(frozen.evidence, 178);
  assert.equal(frozen.subjectResources, 101);
  assert.equal(frozen.objectResources, 76);
  assert.equal(frozen.causal, 22);
  assert.equal(frozen.nonCausal, 121);
  assert.equal(frozen.sameRoot, 143);
  assert.equal(frozen.crossRoot, 0);
  assert.equal(frozen.directlySourced, 143);
  assert.equal(frozen.unreviewed, 143);
  assert.equal(frozen.uncertain, 143);
  assert.equal(frozen.disputed, 0);
  assert.equal(frozen.resourceReuse, 280);
  assert.equal(frozen.resourceAdditions, 0);
});

/* =======================================================================
 * S9 / S10 - migrations unchanged, and migration 020 absent
 * ==================================================================== */

const MIGRATION_DIRECTORY = path.join(backendRoot, "db", "migrations");

function migrationSha256(filename: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(MIGRATION_DIRECTORY, filename)))
    .digest("hex")
    .toUpperCase();
}

test("S9 migration 018 is byte-identical", () => {
  const filename = "018_create_cross_root_link_foundation.sql";
  assert.equal(
    migrationSha256(filename),
    "32760D802354738A6A5B051756BAE59849A05353966FF8752E93EBCC16183A75",
  );
  assert.equal(
    readFileSync(path.join(MIGRATION_DIRECTORY, filename)).byteLength,
    5116,
  );
});

test("S10 migration 019 is byte-identical", () => {
  const filename = "019_create_cross_root_source_backed_relationships.sql";
  assert.equal(
    migrationSha256(filename),
    "10BBD3D8BF187BC12AD1CC59F738578950AEB7066A65A4DB411B54E855E573F2",
  );
});

/**
 * The exact migration chain as released at Chunk 14C.
 *
 * This is a HISTORICAL fact and is pinned as such. The previous version of this
 * test asserted `files.length === 20` against the LIVE directory, which is a
 * different and false claim: it said no governed stage may ever add a
 * migration. Chunk 15A added migration 020 under an authorized allowlist and
 * the test failed, which was a defect in the test, not in 15A.
 */
const MIGRATIONS_RELEASED_AT_14C: readonly string[] = [
  "001_create_imported_bundles.sql",
  "002_create_knowledge_tables.sql",
  "003_create_dictionaryroot_lexicon.sql",
  "004_create_dictionaryroot_editorial_reviews.sql",
  "005_create_auth_identity_governance.sql",
  "005_create_dictionaryroot_identity_access.sql",
  "006_create_governed_editorial_workflow.sql",
  "007_create_moderation_operations.sql",
  "008_strengthen_session_identity.sql",
  "009_create_contextual_knowledge_foundation.sql",
  "010_extend_contextual_governance.sql",
  "011_refine_contextual_identity_time.sql",
  "012_refine_contextual_assertions_evidence_versioning.sql",
  "013_create_dictionaryroot_lexical_evidence.sql",
  "014_create_dictionaryroot_lexical_relationships.sql",
  "015_create_bibleroot_foundation.sql",
  "016_create_bibleroot_original_language_foundation.sql",
  "017_create_bibleroot_commentary_provenance.sql",
  "018_create_cross_root_link_foundation.sql",
  "019_create_cross_root_source_backed_relationships.sql",
];

test("released migrations survive unchanged while the governed chain may grow", () => {
  const files = readdirSync(MIGRATION_DIRECTORY)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  // HISTORICAL: the release shipped exactly these twenty.
  assert.equal(MIGRATIONS_RELEASED_AT_14C.length, 20);

  // DURABLE: none of them may be removed or renamed.
  for (const released of MIGRATIONS_RELEASED_AT_14C) {
    assert.ok(
      files.includes(released),
      `migration released at 14C is missing: ${released}`,
    );
  }

  // DURABLE: the chain may grow but never shrink.
  assert.ok(
    files.length >= MIGRATIONS_RELEASED_AT_14C.length,
    `migration chain shrank to ${files.length}`,
  );

  // DURABLE: additions may only APPEND. An addition sorting at or below the
  // released high-water mark would be a renumbering of released history, which
  // is how a rewritten old migration could hide behind a new filename.
  const highestReleased = [...MIGRATIONS_RELEASED_AT_14C].sort().at(-1)!;
  for (const name of files) {
    if (MIGRATIONS_RELEASED_AT_14C.includes(name)) continue;
    assert.ok(
      name > highestReleased,
      `migration ${name} does not append after the released chain`,
    );
  }

  // The released policy constants are themselves frozen contract text. They
  // record the position AT THE 14C RELEASE, when 020 was deliberately deferred.
  // Migration 020 has since been added under governed stage 15A, so this
  // asserts that the released declaration has not drifted - NOT that 020 is
  // absent today. Restating the constant needs its own governed 14C stage.
  assert.equal(SOURCEROOT_MIGRATION_POLICY.migration020, "deferred-absent");
  assert.equal(SOURCEROOT_MIGRATION_POLICY.migration018, "frozen-unchanged");
  assert.equal(
    SOURCEROOT_MIGRATION_POLICY.migration019,
    "identity-assertion-compatible-unchanged",
  );
});

test("future schema triggers are documented rather than solved", () => {
  const triggers = DEFERRED_SCHEMA_TRIGGERS.map((item) => item.trigger);
  for (const expected of [
    "hardcoded Root CHECK",
    "hardcoded resource types",
    "absence of an identity relationship family",
    "unconstrained predicate TEXT",
    "dataset-scoped resource uniqueness",
  ]) {
    assert.ok(
      triggers.some((trigger) => trigger.includes(expected)),
      `${expected} must be documented as a future migration consideration`,
    );
  }
});

/* =======================================================================
 * S11 - readiness 1.4.0 semantics preserved
 * ==================================================================== */

test("S11 development runtime readiness stays at 1.4.0 and is untouched", () => {
  const readiness = readFileSync(
    path.join(backendRoot, "src", "services", "development-runtime-readiness.ts"),
    "utf8",
  );
  assert.match(readiness, /contractVersion:\s*"1\.4\.0"/);
  assert.doesNotMatch(readiness, /sourceroot\/contracts/);
  assert.doesNotMatch(readiness, /sourcerootSharedGrammar/);
  assert.equal(
    FROZEN_RELEASED_BASELINES.developmentRuntimeReadinessContractVersion,
    "1.4.0",
  );
});

/* =======================================================================
 * S12 - non-transitivity (STOP CONDITION)
 * ==================================================================== */

test("S12 accepted assertions never produce transitive closure", () => {
  const history = fixtureResource("HistoryRoot").address;
  const bible = fixtureResource("BibleRoot").address;
  const earth = fixtureResource("EarthRoot").address;

  for (const assertion of FIXTURE_IDENTITY_ASSERTIONS) {
    assert.equal(assertion.reviewState, "accepted_after_review");
    assert.deepEqual(validateIdentityAssertion(assertion), []);
  }

  const fromHistory = directIdentityCounterparts(
    history,
    FIXTURE_IDENTITY_ASSERTIONS,
  ).map(formatSourceRootAddress);
  assert.deepEqual(fromHistory, [formatSourceRootAddress(bible)]);
  assert.ok(
    !fromHistory.includes(formatSourceRootAddress(earth)),
    "A-B and B-C must never yield A-C",
  );

  const fromEarth = directIdentityCounterparts(
    earth,
    FIXTURE_IDENTITY_ASSERTIONS,
  ).map(formatSourceRootAddress);
  assert.deepEqual(fromEarth, [formatSourceRootAddress(bible)]);

  assert.equal(SOURCEROOT_IDENTITY_TRANSITIVITY, "non_transitive");
  const transitiveViolations = validateIdentityAssertion({
    ...FIXTURE_IDENTITY_ASSERTIONS[0]!,
    transitivity: "transitive" as unknown as "non_transitive",
  });
  assert.ok(
    transitiveViolations.some(
      (item) => item.rule === "non-transitivity-is-invariant",
    ),
  );
});

test("symmetry is never assumed", () => {
  const asymmetric = FIXTURE_IDENTITY_ASSERTIONS.map((assertion) => ({
    ...assertion,
    symmetry: "asymmetric" as const,
  }));
  const bible = fixtureResource("BibleRoot").address;
  const reverse = directIdentityCounterparts(bible, [asymmetric[0]!]).map(
    formatSourceRootAddress,
  );
  assert.deepEqual(reverse, [], "reverse traversal requires explicit symmetry");
});

/* =======================================================================
 * S13 - no embedding or similarity path (STOP CONDITION)
 * ==================================================================== */

test("S13 no embedding, similarity, fuzzy, or confidence path can establish identity", () => {
  for (const kind of [
    "embedding_similarity",
    "fuzzy_match",
    "model_confidence",
    "transitive_closure",
    "temporal_overlap_only",
  ]) {
    assert.ok(
      (REJECTED_IDENTITY_EVIDENCE_KINDS as readonly string[]).includes(kind),
      `${kind} must be a rejected evidence kind`,
    );
    const candidate = REJECTED_EVIDENCE_CANDIDATES.find(
      (item) => item.kind === kind,
    );
    assert.ok(candidate);
    const violations = validateIdentityAssertion({
      ...FIXTURE_REJECTED_ASSERTION,
      evidence: [candidate],
    });
    assert.ok(violations.some((item) => item.rule === "rejected-evidence-kind"));
  }

  for (const kind of ACCEPTED_IDENTITY_EVIDENCE_KINDS) {
    assert.ok(
      !(REJECTED_IDENTITY_EVIDENCE_KINDS as readonly string[]).includes(kind),
      "accepted and rejected evidence vocabularies must not overlap",
    );
  }

  const sources = [
    "addressing.ts",
    "object-types.ts",
    "root-registry.ts",
    "identity-assertions.ts",
    "query-vocabulary.ts",
    "response-envelope.ts",
    "contracts.ts",
  ].map((name) =>
    readFileSync(path.join(backendRoot, "src", "sourceroot", name), "utf8"),
  );
  for (const source of sources) {
    assert.doesNotMatch(source, /cosineSimilarity|levenshtein|jaroWinkler/i);
    assert.doesNotMatch(source, /function\s+\w*[Ee]mbedding/);
    assert.doesNotMatch(source, /transitiveClosure|closeTransitively/);
  }
});

test("identity assertions require explicit evidence with a locator", () => {
  const noEvidence = validateIdentityAssertion(FIXTURE_EVIDENCE_FREE_ASSERTION);
  assert.ok(noEvidence.some((item) => item.rule === "evidence-required"));

  const noLocator = validateIdentityAssertion({
    ...FIXTURE_IDENTITY_ASSERTIONS[0]!,
    evidence: [
      { ...FIXTURE_IDENTITY_ASSERTIONS[0]!.evidence[0]!, sourceLocator: "  " },
    ],
  });
  assert.ok(noLocator.some((item) => item.rule === "evidence-locator-required"));

  const machineDerived = validateIdentityAssertion({
    ...FIXTURE_IDENTITY_ASSERTIONS[0]!,
    derivation: "machine_proposed" as unknown as "human_proposed",
  });
  assert.ok(
    machineDerived.some((item) => item.rule === "derivation-must-be-explicit"),
  );
});

test("an assertion is withdrawable without deleting historical provenance", () => {
  const original = FIXTURE_IDENTITY_ASSERTIONS[0]!;
  const withdrawn = withdrawIdentityAssertion(original, "Reviewer retracted it.");
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal(withdrawn.withdrawnReason, "Reviewer retracted it.");
  assert.deepEqual(withdrawn.evidence, original.evidence);
  assert.equal(withdrawn.assertionId, original.assertionId);
  assert.deepEqual(validateIdentityAssertion(withdrawn), []);

  const counterparts = directIdentityCounterparts(withdrawn.subject, [withdrawn]);
  assert.deepEqual(counterparts, [], "a withdrawn assertion connects nothing");

  assert.throws(() => withdrawIdentityAssertion(original, "   "));
});

test("the identity predicate vocabulary is exactly the contract vocabulary", () => {
  assert.deepEqual([...SOURCEROOT_IDENTITY_PREDICATES], [
    "asserted_same_as",
    "possible_same_as",
    "distinct_from",
    "related_but_distinct",
  ]);
  const unknownPredicate = validateIdentityAssertion({
    ...FIXTURE_IDENTITY_ASSERTIONS[0]!,
    predicate: "same_as" as unknown as "asserted_same_as",
  });
  assert.ok(unknownPredicate.some((item) => item.rule === "predicate-vocabulary"));
});

/* =======================================================================
 * S14 - temporal honesty
 * ==================================================================== */

test("S14 missing temporal scope is never rendered as timeless truth", () => {
  const description = describeTemporalScope(TEMPORAL_SCOPE_NOT_ASSERTED);
  assert.match(description, /not asserted/i);
  assert.match(description, /not a claim that the record is timeless/i);
  assert.doesNotMatch(description, /\balways true\b/i);
  assert.doesNotMatch(description, /\btimeless truth\b/i);

  const earth = fixtureResource("EarthRoot");
  assert.equal(earth.temporalScope.mode, "not_asserted");
  assert.match(describeTemporalScope(earth.temporalScope), /not asserted/i);

  for (const mode of SOURCEROOT_TEMPORAL_MODES) {
    const text = describeTemporalScope({
      ...TEMPORAL_SCOPE_NOT_ASSERTED,
      mode,
    });
    assert.ok(text.length > 0);
    assert.doesNotMatch(text, /timeless truth/i);
  }

  assert.ok(
    (SOURCEROOT_TEMPORAL_MODES as readonly string[]).includes("multiple_proposed"),
  );
  assert.ok((SOURCEROOT_TEMPORAL_MODES as readonly string[]).includes("disputed"));

  const query = describeSourceRootContract().query;
  assert.deepEqual([...query.temporal.operators], [
    "at",
    "overlaps",
    "before",
    "after",
    "during",
  ]);
  assert.equal(query.temporal.timeRootImplemented, false);
});

/* =======================================================================
 * S15 - no fallback domain data
 * ==================================================================== */

test("S15 the contract modules carry no fallback domain data", () => {
  const sourceDirectory = path.join(backendRoot, "src", "sourceroot");
  for (const name of readdirSync(sourceDirectory)) {
    const source = readFileSync(path.join(sourceDirectory, name), "utf8");
    assert.doesNotMatch(source, /fallback[A-Z]/);
    assert.doesNotMatch(source, /sampleResources|staticResources|seedResources/i);
    assert.doesNotMatch(source, /Jerusalem/i, `${name} must not carry fixture data`);
  }
  const routerSource = readFileSync(
    path.join(backendRoot, "src", "routes", "sourceroot-contracts.ts"),
    "utf8",
  );
  assert.doesNotMatch(routerSource, /Jerusalem/i);
  assert.doesNotMatch(routerSource, /fixture/i);
});

test("the Jerusalem fixture is declared synthetic and lives outside production source", () => {
  assert.equal(FIXTURE_KIND, "synthetic-contract-fixture");
  assert.equal(FIXTURE_IS_PRODUCTION_DATA, false);
  assert.equal(JERUSALEM_CONTRACT_FIXTURE.productionOwnerChunk, "18A");
  assert.match(JERUSALEM_CONTRACT_FIXTURE.note, /Not accepted production data/i);
  assert.match(FIXTURE_DATASET_VERSION, /-contract-fixture$/);
  assert.match(FIXTURE_DATASET_ID, /contract-fixture/);
  assert.equal(
    existsSync(
      path.join(backendRoot, "src", "sourceroot", "jerusalem-contract-fixture.ts"),
    ),
    false,
  );
});

/* =======================================================================
 * Object-type maturity
 * ==================================================================== */

test("DEFINED, IMPLEMENTED, and PROVIDED are not conflated", () => {
  const matrix = buildObjectTypeMaturityMatrix();
  assert.equal(matrix.length, SOURCEROOT_ROOT_IDS.length);

  for (const rootRow of matrix) {
    assert.equal(rootRow.objectTypes.length, SOURCEROOT_OBJECT_TYPES.length);
    for (const provision of rootRow.objectTypes) {
      assert.equal(provision.defined, true, "every vocabulary member is DEFINED");
      assert.equal(provision.provided, false, "nothing is PROVIDED in contract v1");
      if (provision.provided) {
        assert.equal(provision.implemented, true);
      }
    }
  }

  const dictionary = matrix.find((row) => row.rootId === "DictionaryRoot");
  assert.ok(dictionary);
  const lexicalEntry = dictionary.objectTypes.find(
    (item) => item.objectType === "lexical-entry",
  );
  assert.ok(lexicalEntry);
  assert.equal(lexicalEntry.implemented, true);
  assert.equal(lexicalEntry.provided, false);

  const place = dictionary.objectTypes.find((item) => item.objectType === "place");
  assert.ok(place);
  assert.equal(place.defined, true);
  assert.equal(place.implemented, false);
  assert.equal(place.provided, false);

  for (const rootRow of matrix) {
    const rootPlace = rootRow.objectTypes.find(
      (item) => item.objectType === "place",
    );
    assert.ok(rootPlace);
    assert.equal(rootPlace.implemented, false, `${rootRow.rootId} does not implement Place`);
    assert.equal(rootPlace.provided, false);
  }
});

test("an unsupported object type is not an empty result", () => {
  assert.equal(isEmptyResultMeaningful("supported"), true);
  assert.equal(isEmptyResultMeaningful("unsupported"), false);
  assert.equal(isEmptyResultMeaningful("unavailable"), false);
  assert.equal(isEmptyResultMeaningful("awaiting-data"), false);

  const contract = describeSourceRootContract();
  assert.match(
    contract.objectTypes.unsupportedVersusEmpty,
    /not an empty result/i,
  );
  for (const rootContract of contract.rootIntegrationContracts) {
    assert.equal(rootContract.unsupportedIsNotEmpty, true);
    assert.deepEqual([...rootContract.availabilityStates], [
      "supported",
      "unsupported",
      "unavailable",
      "awaiting-data",
    ]);
  }
});

/* =======================================================================
 * Root registry truthfulness
 * ==================================================================== */

test("the Root registry is internally consistent", () => {
  assert.deepEqual(validateRootRegistry(), []);
  assert.deepEqual([...OPERATIONAL_ROOT_IDS], [
    "DictionaryRoot",
    "HistoryRoot",
    "BibleRoot",
  ]);
  assert.deepEqual([...PLANNED_ROOT_IDS], [
    "EarthRoot",
    "TimeRoot",
    "PersonRoot",
    "LanguageRoot",
  ]);
  assert.equal(listRootRegistry().length, 7);
});

test("planned Roots can never report ready or provided capabilities", () => {
  for (const rootId of PLANNED_ROOT_IDS) {
    const entry = getRootRegistryEntry(rootId);
    assert.ok(entry);
    assert.equal(entry.lifecycle, "planned");
    assert.equal(isRootReady(entry), false);
    assert.equal(entry.rootContractVersion, null);
    assert.equal(entry.datasets.length, 0);
    for (const capability of Object.values(entry.capabilities)) {
      assert.equal(capability, false);
    }
    for (const provision of entry.objectTypes) {
      assert.equal(provision.implemented, false);
      assert.equal(provision.provided, false);
    }
  }

  const forcedReady = {
    ...getRootRegistryEntry("EarthRoot")!,
    networkRuntimeState: "available" as const,
  };
  const violations = [...validateRootRegistry()];
  assert.deepEqual(violations, []);
  const forcedViolations = validateRootRegistryEntry(forcedReady);
  assert.ok(
    forcedViolations.some(
      (item) => item.rule === "planned-root-cannot-be-ready",
    ),
  );
});

test("a Root cannot claim a capability it cannot satisfy", () => {
  for (const entry of listRootRegistry()) {
    if (isRootReady(entry)) continue;
    for (const [capability, declared] of Object.entries(entry.capabilities)) {
      assert.equal(
        declared,
        false,
        `${entry.rootId} must not declare ${capability} while its network runtime state is ${entry.networkRuntimeState}`,
      );
    }
  }

  const overclaiming = validateRootRegistryEntry({
    ...getRootRegistryEntry("HistoryRoot")!,
    capabilities: {
      ...getRootRegistryEntry("HistoryRoot")!.capabilities,
      temporalQuery: true,
    },
  });
  assert.ok(
    overclaiming.some(
      (item) => item.rule === "capability-requires-available-runtime",
    ),
  );

  const spatialClaim = validateRootRegistryEntry({
    ...getRootRegistryEntry("HistoryRoot")!,
    networkRuntimeState: "available",
    capabilities: {
      ...getRootRegistryEntry("HistoryRoot")!.capabilities,
      spatialQuery: true,
    },
  });
  assert.ok(
    spatialClaim.some((item) => item.rule === "spatial-query-unsupported"),
  );

  const mutationClaim = validateRootRegistryEntry({
    ...getRootRegistryEntry("HistoryRoot")!,
    networkRuntimeState: "available",
    capabilities: {
      ...getRootRegistryEntry("HistoryRoot")!.capabilities,
      mutation: true,
    },
  });
  assert.ok(mutationClaim.some((item) => item.rule === "mutation-unsupported"));
});

test("every Root integration contract exposes the required concepts", () => {
  for (const rootId of SOURCEROOT_ROOT_IDS) {
    const contract = buildRootIntegrationContract(rootId);
    assert.ok(contract, `${rootId} must have an integration contract`);
    assert.equal(contract.rootId, rootId);
    assert.equal(contract.sourcerootContractVersion, SOURCEROOT_CONTRACT_VERSION);
    assert.equal(contract.addressFormatVersion, SOURCEROOT_ADDRESS_FORMAT_VERSION);
    assert.ok("rootContractVersion" in contract);
    assert.ok("lifecycle" in contract);
    assert.ok("networkRuntimeState" in contract);
    assert.ok(Array.isArray(contract.datasets));
    assert.ok(Array.isArray(contract.objectTypes));
    assert.ok("capabilities" in contract);
    assert.equal(contract.queryCapabilities.spatial, false);
    assert.equal(contract.mutationSupport, false);
    assert.equal(contract.identityAssertionSupport.transitivity, "non_transitive");
    assert.ok(contract.provenanceCapabilities);
    assert.equal(contract.queryCapabilities.maxPageSize, 100);
  }
  assert.equal(buildRootIntegrationContract("MysteryRoot"), undefined);
});

test("spatial support is vocabulary-only across every Root", () => {
  assert.equal(SOURCEROOT_SPATIAL_SUPPORT_STATE, "vocabulary-only");
  for (const entry of listRootRegistry()) {
    assert.equal(entry.capabilities.spatialQuery, false);
  }
  assert.throws(() => evaluateSpatialQuery(), SourceRootSpatialNotImplementedError);
  const spatial = describeSourceRootContract().query.spatial;
  assert.equal(spatial.earthRootImplemented, false);
  for (const excluded of [
    "geometry",
    "coordinates",
    "geocoding",
    "bounding boxes",
    "map projection",
    "map user interface",
  ]) {
    assert.ok((spatial.implementationBoundary as readonly string[]).includes(excluded));
  }
});

/* =======================================================================
 * Governed shared identity boundary (Layer 3)
 * ==================================================================== */

test("no governed shared identity is created, inferred, or exposed", () => {
  for (const resource of FIXTURE_RESOURCES) {
    assert.equal(
      resolveGovernedSharedIdentity(resource.address, FIXTURE_IDENTITY_ASSERTIONS),
      null,
    );
  }
  assert.throws(
    () => createGovernedSharedIdentity(),
    GovernedSharedIdentityNotImplementedError,
  );

  const boundary = describeSourceRootContract().identityAssertions
    .governedSharedIdentity;
  assert.equal(boundary.persisted, false);
  assert.equal(boundary.inferred, false);
  assert.equal(boundary.exposed, false);
  assert.equal(boundary.automaticTransitiveMembership, false);
  assert.match(boundary.note, /never automatically create/i);
  assert.equal(boundary.state, "provisional-contract-shape-only");
});

test("migration 019 is described as compatible, not as a governance system", () => {
  const boundary = describeSourceRootContract().identityAssertions
    .databaseBoundary;
  assert.equal(boundary.migration019, "identity-assertion-compatible");
  assert.equal(boundary.persistedIdentityGovernanceSystem, false);
  assert.equal(boundary.predicateColumnConstrained, false);
  assert.match(boundary.note, /NOT yet implemented/);
});

/* =======================================================================
 * Response envelope
 * ==================================================================== */

test("envelope status distinguishes ok, partial, and unavailable", () => {
  assert.equal(deriveResultStatus(["HistoryRoot"], []), "ok");
  assert.equal(
    deriveResultStatus(
      ["HistoryRoot"],
      [rootUnavailable("BibleRoot", "unavailable", "Root did not answer.")],
    ),
    "partial",
  );
  assert.equal(
    deriveResultStatus(
      [],
      [rootUnavailable("BibleRoot", "unavailable", "Root did not answer.")],
    ),
    "unavailable",
  );
  assert.throws(() => rootUnavailable("BibleRoot", "unavailable", "  "));
});

test("a failing Root is reported, never silently dropped", () => {
  const envelope = buildSourceRootResponseEnvelope({
    requestedRoots: ["DictionaryRoot", "HistoryRoot", "BibleRoot"],
    respondingRoots: ["DictionaryRoot"],
    unavailableRoots: [
      rootUnavailable("HistoryRoot", "unavailable", "The Root did not respond."),
      rootUnavailable(
        "BibleRoot",
        "unsupported",
        "The Root does not support this object type. This is not an empty result.",
      ),
    ],
    rootContractVersions: {
      DictionaryRoot: "1.0.0",
      HistoryRoot: "1.0.0",
      BibleRoot: "1.0.0",
    },
    items: [],
    pagination: { page: 1, limit: 25, offset: 0 },
    total: 0,
    appliedFilters: {},
    sortField: "rootId",
    sortDirection: "asc",
    tieBreaker: "address",
  });

  assert.equal(envelope.status, "partial");
  assert.equal(envelope.requestedRoots.length, 3);
  assert.equal(envelope.unavailableRoots.length, 2);
  assert.deepEqual(
    envelope.rootGroups.map((group) => group.rootId).sort(),
    ["BibleRoot", "DictionaryRoot", "HistoryRoot"],
  );
  const unsupported = envelope.unavailableRoots.find(
    (item) => item.rootId === "BibleRoot",
  );
  assert.ok(unsupported);
  assert.equal(unsupported.state, "unsupported");
  assert.match(unsupported.reason, /not an empty result/i);

  assert.ok(envelope.sourcerootContractVersion);
  assert.ok(envelope.addressFormatVersion);
  assert.ok(envelope.rootContractVersions.DictionaryRoot);
  assert.equal(envelope.pagination.totalSemantics, "exact");
  assert.equal(envelope.semanticConclusion, null);
});

test("rootPayload carries Root-public contract data only", () => {
  assert.deepEqual(validateRootPayload({ passageReference: "Fixture 1:1" }), []);
  assert.deepEqual(
    validateRootPayload({ nested: { label: "ok", items: [1, "two", true, null] } }),
    [],
  );

  for (const forbidden of ROOT_PAYLOAD_FORBIDDEN_KEYS) {
    const violations = validateRootPayload({ [forbidden]: "leak" });
    assert.ok(
      violations.some((item) => item.rule === "forbidden-internal-key"),
      `${forbidden} must be rejected`,
    );
  }

  assert.ok(
    validateRootPayload({ _private: 1 }).some(
      (item) => item.rule === "private-key-prefix",
    ),
  );
  assert.ok(
    validateRootPayload({ service: () => undefined }).some(
      (item) => item.rule === "payload-value-type",
    ),
  );
  assert.ok(
    validateRootPayload({ a: { b: { c: { d: { e: 1 } } } } }).some(
      (item) => item.rule === "payload-max-depth",
    ),
  );
  assert.ok(
    validateRootPayload("not an object").some(
      (item) => item.rule === "payload-must-be-plain-object",
    ),
  );

  assert.throws(
    () =>
      buildSourceRootResponseEnvelope({
        requestedRoots: ["HistoryRoot"],
        respondingRoots: ["HistoryRoot"],
        unavailableRoots: [],
        rootContractVersions: { HistoryRoot: "1.0.0" },
        items: [
          {
            ...validResultItem(),
            rootPayload: { databaseRow: { id: 1 } },
          } as never,
        ],
        pagination: { page: 1, limit: 25, offset: 0 },
        total: 1,
        appliedFilters: {},
        sortField: "rootId",
        sortDirection: "asc",
        tieBreaker: "address",
      }),
    RootPayloadBoundaryError,
  );
});

/* =======================================================================
 * Versioning
 * ==================================================================== */

test("unknown vocabulary values are tolerated honestly rather than coerced", () => {
  const known = resolveVocabularyValue("exact", SOURCEROOT_TEMPORAL_MODES);
  assert.equal(known.known, true);
  assert.equal(known.value, "exact");

  const unknown = resolveVocabularyValue(
    "seasonally_bounded",
    SOURCEROOT_TEMPORAL_MODES,
  );
  assert.equal(unknown.known, false);
  assert.equal(unknown.value, "seasonally_bounded");
  if (!unknown.known) {
    assert.equal(unknown.handling, "preserved-as-unknown");
    assert.match(unknown.note, /not coerced/i);
  }
});

test("released semantics are frozen and readiness is not bumped", () => {
  const contract = describeSourceRootContract();
  assert.ok(
    contract.versioningRules.some((rule) => /append-only/i.test(rule)),
  );
  assert.ok(
    contract.versioningRules.some((rule) => /never redefined/i.test(rule)),
  );
  assert.ok(
    contract.versioningRules.some((rule) => /frozen/i.test(rule)),
  );
  assert.ok(
    contract.versioningRules.some((rule) => /1\.4\.0/.test(rule)),
  );
  assert.equal(contract.scope.contractOnly, true);
  assert.equal(contract.scope.migrationFree, true);
  assert.equal(contract.scope.rootPreserving, true);
  assert.equal(contract.scope.nonMerging, true);
  assert.equal(contract.scope.provenanceFirst, true);
});

/* =======================================================================
 * Discovery routes
 * ==================================================================== */

test("contract discovery routes expose every version axis", async () => {
  const response = await request(contractApp())
    .get("/api/v1/sourceroot/contracts")
    .expect(200);
  assert.equal(response.body.sourcerootContractVersion, SOURCEROOT_CONTRACT_VERSION);
  assert.equal(response.body.addressFormatVersion, SOURCEROOT_ADDRESS_FORMAT_VERSION);
  assert.ok(response.body.versionAxes);
  assert.equal(response.body.semanticConclusion, null);
  assert.deepEqual(response.body.registryViolations, []);
});

test("the Root registry route validates pagination", async () => {
  const app = contractApp();
  const ok = await request(app)
    .get("/api/v1/sourceroot/contracts/roots?page=1&limit=3")
    .expect(200);
  assert.equal(ok.body.rootIntegrationContracts.length, 3);
  assert.equal(ok.body.pagination.total, 7);
  assert.equal(ok.body.pagination.hasMore, true);
  assert.equal(ok.body.pagination.totalSemantics, "exact");

  for (const query of ["page=0", "page=-1", "limit=0", "limit=101", "limit=abc"]) {
    const bad = await request(app)
      .get(`/api/v1/sourceroot/contracts/roots?${query}`)
      .expect(400);
    assert.match(bad.body.category, /invalid-pagination/);
  }
});

test("the Root route returns 404 for an unregistered Root", async () => {
  const app = contractApp();
  const found = await request(app)
    .get("/api/v1/sourceroot/contracts/roots/EarthRoot")
    .expect(200);
  assert.equal(found.body.rootIntegrationContract.lifecycle, "planned");
  assert.equal(found.body.rootIntegrationContract.networkRuntimeState, "not-implemented");

  const missing = await request(app)
    .get("/api/v1/sourceroot/contracts/roots/MysteryRoot")
    .expect(404);
  assert.equal(missing.body.code, "SOURCEROOT_ROOT_NOT_REGISTERED");
});

test("the address route validates supplied addresses without implying identity", async () => {
  const app = contractApp();
  const described = await request(app)
    .get("/api/v1/sourceroot/contracts/address")
    .expect(200);
  assert.equal(described.body.datasetQualification, "required");
  assert.match(described.body.identitySemantics, /never implies shared identity/i);

  const valid = formatSourceRootAddress({
    rootId: "BibleRoot",
    objectType: "scripture-passage",
    canonicalPublicId: "verse-0001",
    datasetId: "bibleroot-foundation-v1",
    datasetVersion: "1.0.0",
  });
  const parsed = await request(app)
    .get(`/api/v1/sourceroot/contracts/address?address=${encodeURIComponent(valid)}`)
    .expect(200);
  assert.equal(parsed.body.valid, true);
  assert.equal(parsed.body.address.rootId, "BibleRoot");
  assert.match(parsed.body.identitySemantics, /never implies shared identity/i);

  const rejected = await request(app)
    .get(
      "/api/v1/sourceroot/contracts/address?address=" +
        encodeURIComponent("sourceroot:BibleRoot/scripture-passage/verse-0001"),
    )
    .expect(400);
  assert.equal(rejected.body.code, "SOURCEROOT_ADDRESS_INVALID");
  assert.equal(
    rejected.body.details.code,
    "address-dataset-qualification-missing",
  );
});

test("the contract surface is read-only", async () => {
  const app = contractApp();
  for (const method of ["post", "put", "patch", "delete"] as const) {
    const response = await request(app)[method]("/api/v1/sourceroot/contracts");
    assert.ok(
      response.status === 404 || response.status === 405,
      `${method} must not be handled by the contract router`,
    );
  }
});

test("object-type and identity-assertion routes expose the maturity and rejection boundaries", async () => {
  const app = contractApp();
  const objectTypes = await request(app)
    .get("/api/v1/sourceroot/contracts/object-types")
    .expect(200);
  assert.equal(objectTypes.body.matrix.length, 7);
  assert.match(objectTypes.body.maturityRule, /DEFINED, IMPLEMENTED, and PROVIDED are distinct/);

  const identity = await request(app)
    .get("/api/v1/sourceroot/contracts/identity-assertions")
    .expect(200);
  assert.deepEqual(identity.body.predicates, [...SOURCEROOT_IDENTITY_PREDICATES]);
  assert.deepEqual(
    identity.body.rejectedEvidenceKinds,
    [...REJECTED_IDENTITY_EVIDENCE_KINDS],
  );
  assert.equal(identity.body.transitivity, "non_transitive");
  assert.equal(identity.body.governedSharedIdentity.persisted, false);
});

test("the SourceRoot contract router is mounted in the application", () => {
  const appSource = readFileSync(path.join(backendRoot, "src", "app.ts"), "utf8");
  assert.match(appSource, /sourceRootContractsRouter/);
  assert.match(
    appSource,
    /app\.use\("\/api\/v1\/sourceroot", sourceRootContractsRouter\)/,
  );
});

/* =======================================================================
 * Fixture-level Jerusalem contract test
 * ==================================================================== */

test("Jerusalem contract fixture: four resources remain four resources", () => {
  assert.equal(FIXTURE_RESOURCES.length, 4);
  const addresses = FIXTURE_RESOURCES.map((item) =>
    formatSourceRootAddress(item.address),
  );
  assert.equal(new Set(addresses).size, 4);

  const roots = FIXTURE_RESOURCES.map((item) => item.rootId);
  assert.ok(roots.includes("DictionaryRoot"));
  assert.ok(roots.includes("HistoryRoot"));
  assert.ok(roots.includes("BibleRoot"));
  assert.ok(roots.includes("EarthRoot"));

  const earthEntry = getRootRegistryEntry("EarthRoot");
  assert.ok(earthEntry);
  assert.equal(earthEntry.lifecycle, "planned");
  assert.equal(isRootReady(earthEntry), false);

  for (const item of FIXTURE_RESOURCES) {
    const parsed = parseSourceRootAddress(formatSourceRootAddress(item.address));
    assert.equal(parsed.datasetId, FIXTURE_DATASET_ID);
    assert.equal(parsed.datasetVersion, FIXTURE_DATASET_VERSION);
  }
});

test("Jerusalem contract fixture: every non-identity signal creates zero assertions", () => {
  assert.equal(REJECTED_EVIDENCE_CANDIDATES.length, 10);
  for (const candidate of REJECTED_EVIDENCE_CANDIDATES) {
    const violations = validateIdentityAssertion({
      ...FIXTURE_REJECTED_ASSERTION,
      evidence: [candidate],
    });
    assert.ok(
      violations.some((item) => item.rule === "rejected-evidence-kind"),
      `${candidate.kind} must create zero identity assertions`,
    );
  }
  assert.equal(
    REJECTED_EVIDENCE_CANDIDATES.filter((candidate) =>
      isValidIdentityAssertion({
        ...FIXTURE_REJECTED_ASSERTION,
        evidence: [candidate],
      }),
    ).length,
    0,
  );
});

test("Jerusalem contract fixture: address creation is deterministic", () => {
  const first = createSourceRootAddress({
    rootId: "EarthRoot",
    objectType: "place",
    canonicalPublicId: "fixture-place-jerusalem",
    datasetId: FIXTURE_DATASET_ID,
    datasetVersion: FIXTURE_DATASET_VERSION,
  });
  assert.equal(
    formatSourceRootAddress(first),
    formatSourceRootAddress(fixtureResource("EarthRoot").address),
  );
});

/* =======================================================================
 * ADVERSARIAL IDENTITY TRAVERSAL TESTS
 *
 * An independent audit proved that an earlier traversal accepted merely
 * shape-compatible caller objects. These tests attack the traversal function
 * directly rather than asserting on constants, so a regression cannot pass by
 * leaving the right words in the source.
 * ==================================================================== */

const HISTORY_ADDRESS = fixtureResource("HistoryRoot").address;
const BIBLE_ADDRESS = fixtureResource("BibleRoot").address;
const EARTH_ADDRESS = fixtureResource("EarthRoot").address;

/** A fully valid, traversal-eligible assertion. The baseline to mutate from. */
function eligibleAssertion(
  overrides: Partial<SourceRootIdentityAssertion> = {},
): SourceRootIdentityAssertion {
  const base = FIXTURE_IDENTITY_ASSERTIONS[0]!;
  return { ...base, ...overrides } as SourceRootIdentityAssertion;
}

function attackWithEvidenceKind(kind: string): SourceRootIdentityAssertion {
  return eligibleAssertion({
    evidence: [
      {
        evidenceId: `attack-${kind}`,
        kind: kind as never,
        statement: "An attacker supplied this as though it proved identity.",
        sourceDatasetId: FIXTURE_DATASET_ID,
        sourceDatasetVersion: FIXTURE_DATASET_VERSION,
        sourceLocator: "fixture://attack",
      },
    ],
  });
}

test("ADVERSARIAL: the eligible baseline really does traverse", () => {
  const assertion = eligibleAssertion();
  assert.deepEqual(validateIdentityAssertion(assertion), []);
  assert.equal(
    evaluateIdentityCounterpartEligibility(assertion).eligible,
    true,
  );
  const counterparts = directIdentityCounterparts(HISTORY_ADDRESS, [assertion]).map(
    formatSourceRootAddress,
  );
  assert.deepEqual(counterparts, [formatSourceRootAddress(BIBLE_ADDRESS)]);
});

test("ADVERSARIAL: no rejected evidence kind can traverse", () => {
  for (const kind of REJECTED_IDENTITY_EVIDENCE_KINDS) {
    const attack = attackWithEvidenceKind(kind);

    assert.ok(
      validateIdentityAssertion(attack).length > 0,
      `${kind} must fail validation`,
    );

    const eligibility = evaluateIdentityCounterpartEligibility(attack);
    assert.equal(eligibility.eligible, false, `${kind} must be ineligible`);
    assert.ok(eligibility.reasons.length > 0);

    assert.deepEqual(
      directIdentityCounterparts(HISTORY_ADDRESS, [attack]),
      [],
      `${kind} must yield zero identity counterparts`,
    );
  }
  assert.equal(REJECTED_IDENTITY_EVIDENCE_KINDS.length, 10);
});

test("ADVERSARIAL: an unreviewed asserted_same_as cannot traverse", () => {
  const attack = eligibleAssertion({ reviewState: "unreviewed" });
  assert.deepEqual(validateIdentityAssertion(attack), []);
  const eligibility = evaluateIdentityCounterpartEligibility(attack);
  assert.equal(eligibility.eligible, false);
  assert.ok(
    eligibility.reasons.some((reason) =>
      reason.startsWith("review-state-not-eligible"),
    ),
  );
  assert.deepEqual(directIdentityCounterparts(HISTORY_ADDRESS, [attack]), []);
});

test("ADVERSARIAL: possible_same_as cannot become an identity counterpart", () => {
  const attack = eligibleAssertion({ predicate: "possible_same_as" });
  assert.deepEqual(
    validateIdentityAssertion(attack),
    [],
    "it remains a legitimate assertion",
  );
  const eligibility = evaluateIdentityCounterpartEligibility(attack);
  assert.equal(eligibility.eligible, false);
  assert.ok(
    eligibility.reasons.some((reason) =>
      reason.startsWith("predicate-not-eligible"),
    ),
  );
  assert.deepEqual(directIdentityCounterparts(HISTORY_ADDRESS, [attack]), []);
});

test("ADVERSARIAL: distinct_from and related_but_distinct cannot traverse", () => {
  for (const predicate of ["distinct_from", "related_but_distinct"] as const) {
    const attack = eligibleAssertion({ predicate });
    assert.equal(
      evaluateIdentityCounterpartEligibility(attack).eligible,
      false,
      `${predicate} must be ineligible`,
    );
    assert.deepEqual(directIdentityCounterparts(HISTORY_ADDRESS, [attack]), []);
  }
});

test("ADVERSARIAL: a withdrawn assertion cannot traverse", () => {
  const attack = withdrawIdentityAssertion(
    eligibleAssertion(),
    "Reviewer retracted it.",
  );
  assert.deepEqual(validateIdentityAssertion(attack), []);
  const eligibility = evaluateIdentityCounterpartEligibility(attack);
  assert.equal(eligibility.eligible, false);
  assert.ok(
    eligibility.reasons.some((reason) => reason.startsWith("status-not-eligible")),
  );
  assert.deepEqual(directIdentityCounterparts(HISTORY_ADDRESS, [attack]), []);
});

test("ADVERSARIAL: an evidence-free assertion cannot traverse", () => {
  const attack = eligibleAssertion({ evidence: [] });
  assert.ok(
    validateIdentityAssertion(attack).some(
      (violation) => violation.rule === "evidence-required",
    ),
  );
  assert.equal(evaluateIdentityCounterpartEligibility(attack).eligible, false);
  assert.deepEqual(directIdentityCounterparts(HISTORY_ADDRESS, [attack]), []);
});

test("ADVERSARIAL: a disputed assertion cannot traverse", () => {
  const attack = eligibleAssertion({ disputeState: "disputed" });
  assert.deepEqual(validateIdentityAssertion(attack), []);
  const eligibility = evaluateIdentityCounterpartEligibility(attack);
  assert.equal(eligibility.eligible, false);
  assert.ok(
    eligibility.reasons.some((reason) =>
      reason.startsWith("dispute-state-not-eligible"),
    ),
  );
  assert.deepEqual(directIdentityCounterparts(HISTORY_ADDRESS, [attack]), []);

  const disputedReview = eligibleAssertion({
    reviewState: "disputed",
    disputeState: "disputed",
  });
  assert.deepEqual(
    directIdentityCounterparts(HISTORY_ADDRESS, [disputedReview]),
    [],
  );
});

test("ADVERSARIAL: malformed closed-vocabulary values fail closed", () => {
  const malformed: readonly [string, Partial<SourceRootIdentityAssertion>, string][] = [
    ["reviewState", { reviewState: "approved" as never }, "review-state-vocabulary"],
    ["certainty", { certainty: "pretty_sure" as never }, "certainty-vocabulary"],
    ["disputeState", { disputeState: "maybe" as never }, "dispute-state-vocabulary"],
    ["status", { status: "archived" as never }, "status-vocabulary"],
    ["symmetry", { symmetry: "bidirectional" as never }, "symmetry-vocabulary"],
    ["predicate", { predicate: "same_as" as never }, "predicate-vocabulary"],
    ["derivation", { derivation: "machine_proposed" as never }, "derivation-must-be-explicit"],
    [
      "transitivity",
      { transitivity: "transitive" as never },
      "non-transitivity-is-invariant",
    ],
  ];

  for (const [field, override, expectedRule] of malformed) {
    const attack = eligibleAssertion(override);
    const violations = validateIdentityAssertion(attack);
    assert.ok(
      violations.some((violation) => violation.rule === expectedRule),
      `${field} must fail closed with ${expectedRule}`,
    );
    assert.equal(
      evaluateIdentityCounterpartEligibility(attack).eligible,
      false,
      `${field} must be ineligible`,
    );
    assert.deepEqual(
      directIdentityCounterparts(HISTORY_ADDRESS, [attack]),
      [],
      `${field} must yield zero counterparts`,
    );
  }
});

test("ADVERSARIAL: malformed temporal scope fails closed", () => {
  const badMode = eligibleAssertion({
    temporalScope: { ...TEMPORAL_SCOPE_NOT_ASSERTED, mode: "sometime" as never },
  });
  assert.ok(
    validateIdentityAssertion(badMode).some((violation) =>
      violation.rule.startsWith("temporal-scope:"),
    ),
  );
  assert.deepEqual(directIdentityCounterparts(HISTORY_ADDRESS, [badMode]), []);

  const badRole = eligibleAssertion({
    temporalScope: { ...TEMPORAL_SCOPE_NOT_ASSERTED, timeRole: "occurred" as never },
  });
  assert.ok(
    validateIdentityAssertion(badRole).some(
      (violation) => violation.rule === "temporal-scope:temporal-role-vocabulary",
    ),
    "an invented time role must be rejected, not silently accepted",
  );
  assert.deepEqual(directIdentityCounterparts(HISTORY_ADDRESS, [badRole]), []);

  const blankCalendar = eligibleAssertion({
    temporalScope: { ...TEMPORAL_SCOPE_NOT_ASSERTED, calendarSystem: "  " },
  });
  assert.ok(
    validateIdentityAssertion(blankCalendar).some(
      (violation) => violation.rule === "temporal-scope:calendar-system-required",
    ),
  );

  const notAssertedWithRange = eligibleAssertion({
    temporalScope: {
      ...TEMPORAL_SCOPE_NOT_ASSERTED,
      chronologyRanges: [{ earliest: "1620", latest: "1621", label: null }],
    },
  });
  assert.ok(
    validateIdentityAssertion(notAssertedWithRange).some(
      (violation) =>
        violation.rule === "temporal-scope:not-asserted-carries-no-range",
    ),
  );
});

test("ADVERSARIAL: released source-native calendars and precisions are accepted", () => {
  for (const [calendarSystem, precision] of [
    ["historical-chronology", "approximate-range"],
    ["English Old Style (Julian)", "competing-year"],
    ["relative source chronology", "bounded approximate start"],
    ["source-reported seasonal chronology", "named_period"],
  ] as const) {
    const assertion = eligibleAssertion({
      temporalScope: {
        mode: "approximate",
        calendarSystem,
        precision,
        timeRole: "event_time",
        uncertaintyStatement: null,
        chronologyRanges: [],
        disputed: false,
      },
    });
    assert.deepEqual(
      validateIdentityAssertion(assertion),
      [],
      `${calendarSystem} / ${precision} is released data and must not be rejected`,
    );
  }
});

test("ADVERSARIAL: transitive closure remains impossible with fully valid assertions", () => {
  const historyBible = FIXTURE_IDENTITY_ASSERTIONS[0]!;
  const bibleEarth = FIXTURE_IDENTITY_ASSERTIONS[1]!;
  for (const assertion of [historyBible, bibleEarth]) {
    assert.deepEqual(validateIdentityAssertion(assertion), []);
    assert.equal(
      evaluateIdentityCounterpartEligibility(assertion).eligible,
      true,
    );
  }

  const fromHistory = directIdentityCounterparts(HISTORY_ADDRESS, [
    historyBible,
    bibleEarth,
  ]).map(formatSourceRootAddress);
  assert.deepEqual(fromHistory, [formatSourceRootAddress(BIBLE_ADDRESS)]);
  assert.ok(!fromHistory.includes(formatSourceRootAddress(EARTH_ADDRESS)));

  // Feeding the result back in must not be something the contract does for
  // you, and doing it by hand still yields only one further hop.
  const secondHop = directIdentityCounterparts(BIBLE_ADDRESS, [
    historyBible,
    bibleEarth,
  ]).map(formatSourceRootAddress);
  assert.deepEqual(secondHop.sort(), [
    formatSourceRootAddress(EARTH_ADDRESS),
    formatSourceRootAddress(HISTORY_ADDRESS),
  ].sort());
});

test("ADVERSARIAL: traversal explains every refusal instead of dropping silently", () => {
  const attacks = [
    attackWithEvidenceKind("name_only_match"),
    eligibleAssertion({ reviewState: "unreviewed" }),
    eligibleAssertion({ predicate: "possible_same_as" }),
  ];
  const explained = explainIdentityCounterparts(HISTORY_ADDRESS, attacks);
  assert.equal(explained.length, 3);
  for (const entry of explained) {
    assert.equal(entry.eligible, false);
    assert.ok(entry.reasons.length > 0);
    assert.equal(entry.counterpart, null);
  }
});

/* =======================================================================
 * ADVERSARIAL RESPONSE ENVELOPE TESTS
 * ==================================================================== */

function envelopeOptions(
  overrides: Record<string, unknown> = {},
): Parameters<typeof buildSourceRootResponseEnvelope>[0] {
  return {
    requestedRoots: ["DictionaryRoot"],
    respondingRoots: ["DictionaryRoot"],
    unavailableRoots: [],
    rootContractVersions: { DictionaryRoot: "1.0.0" },
    items: [],
    pagination: { page: 1, limit: 25, offset: 0 },
    total: 0,
    appliedFilters: {},
    sortField: "rootId",
    sortDirection: "asc",
    tieBreaker: "address",
    ...overrides,
  } as Parameters<typeof buildSourceRootResponseEnvelope>[0];
}

/**
 * A completely valid HistoryRoot result item, derived from the fixture address
 * so every component and the address agree by construction. Attacks mutate one
 * field of this at a time.
 */
function validResultItem(): Record<string, unknown> {
  const address = fixtureResource("HistoryRoot").address;
  return {
    address: formatSourceRootAddress(address),
    rootId: address.rootId,
    objectType: address.objectType,
    canonicalPublicId: address.canonicalPublicId,
    datasetId: address.datasetId,
    datasetVersion: address.datasetVersion,
    canonicalUrl: "history-record-v1.html?id=fixture-record-jerusalem-siege",
    provenanceSummary: {
      datasetId: address.datasetId,
      datasetVersion: address.datasetVersion,
      derivation: "directly_sourced",
      sourceLocator: "fixture://record",
      evidenceCount: 1,
    },
    temporalSummary: {
      mode: "approximate",
      asserted: true,
      description: describeTemporalScope(
        fixtureResource("HistoryRoot").temporalScope,
      ),
    },
    uncertaintySummary: {
      certainty: "uncertain",
      uncertaintyStatement: "The source records the year approximately.",
      disputed: false,
    },
    reviewSummary: { reviewState: "unreviewed", reviewed: false },
    rootPayload: { recordTitle: "Fixture historical record" },
    semanticConclusion: null,
  };
}

/** Envelope options carrying exactly one valid HistoryRoot item. */
function envelopeWithItem(
  item: Record<string, unknown>,
): Parameters<typeof buildSourceRootResponseEnvelope>[0] {
  return envelopeOptions({
    requestedRoots: ["HistoryRoot"],
    respondingRoots: ["HistoryRoot"],
    rootContractVersions: { HistoryRoot: "1.0.0" },
    items: [item],
    total: 1,
  });
}

function expectItemViolation(
  item: Record<string, unknown>,
  expectedRulePart: string,
  label: string,
) {
  assert.throws(
    () => buildSourceRootResponseEnvelope(envelopeWithItem(item)),
    (error: unknown) => {
      // Root identity is owned by the accounting invariant, which runs first,
      // so either controlled contract error is a correct refusal.
      assert.ok(
        error instanceof SourceRootResultItemContractError ||
          error instanceof SourceRootEnvelopeContractError,
        `${label}: expected a controlled contract error, got ${String(error)}`,
      );
      assert.ok(
        error.violations.some((violation) =>
          violation.rule.includes(expectedRulePart),
        ),
        `${label}: expected a rule containing "${expectedRulePart}", got ${error.violations
          .map((violation) => violation.rule)
          .join(", ")}`,
      );
      return true;
    },
    label,
  );
}

function expectEnvelopeViolation(
  overrides: Record<string, unknown>,
  expectedRule: string,
) {
  assert.throws(
    () => buildSourceRootResponseEnvelope(envelopeOptions(overrides)),
    (error: unknown) => {
      assert.ok(error instanceof SourceRootEnvelopeContractError);
      assert.ok(
        error.violations.some((violation) => violation.rule === expectedRule),
        `expected violation ${expectedRule}, got ${error.violations
          .map((violation) => violation.rule)
          .join(", ")}`,
      );
      return true;
    },
  );
}

test("ADVERSARIAL: a requested Root can never silently disappear", () => {
  // This is the exact attack the independent audit proved: HistoryRoot is
  // requested, does not respond, and is not reported unavailable.
  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    },
    "requested-root-unaccounted",
  );
});

test("ADVERSARIAL: a Root cannot be both responding and unavailable", () => {
  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [
        rootUnavailable("DictionaryRoot", "unavailable", "It also failed."),
      ],
    },
    "root-both-responding-and-unavailable",
  );
});

test("ADVERSARIAL: duplicate Root accounting is rejected", () => {
  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot"],
      respondingRoots: ["DictionaryRoot", "DictionaryRoot"],
    },
    "duplicate-responding-root",
  );

  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [
        rootUnavailable("HistoryRoot", "unavailable", "Down."),
        rootUnavailable("HistoryRoot", "unavailable", "Down again."),
      ],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    },
    "duplicate-unavailable-root",
  );
});

test("ADVERSARIAL: an unavailable Root with a blank reason is rejected", () => {
  assert.throws(() => rootUnavailable("HistoryRoot", "unavailable", "   "));

  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [
        { rootId: "HistoryRoot", state: "unavailable", reason: "  " },
      ],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    },
    "unavailable-reason-required",
  );
});

test("ADVERSARIAL: an unrequested Root cannot appear in the answer", () => {
  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot"],
      respondingRoots: ["DictionaryRoot", "BibleRoot"],
      rootContractVersions: { DictionaryRoot: "1.0.0", BibleRoot: "1.0.0" },
    },
    "responding-root-not-requested",
  );

  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [
        rootUnavailable("BibleRoot", "unavailable", "Never asked for."),
      ],
    },
    "unavailable-root-not-requested",
  );
});

test("ADVERSARIAL: an item whose rootId is not a responding Root is rejected", () => {
  const strayItem = {
    address: formatSourceRootAddress(HISTORY_ADDRESS),
    rootId: "HistoryRoot",
    objectType: "historical-record",
    canonicalPublicId: "stray",
    datasetId: FIXTURE_DATASET_ID,
    datasetVersion: FIXTURE_DATASET_VERSION,
    canonicalUrl: null,
    provenanceSummary: {
      datasetId: FIXTURE_DATASET_ID,
      datasetVersion: FIXTURE_DATASET_VERSION,
      derivation: "directly_sourced",
      sourceLocator: null,
      evidenceCount: 0,
    },
    temporalSummary: { mode: "not_asserted", asserted: false, description: "x" },
    uncertaintySummary: {
      certainty: "uncertain",
      uncertaintyStatement: null,
      disputed: false,
    },
    reviewSummary: { reviewState: "unreviewed", reviewed: false },
    rootPayload: {},
    semanticConclusion: null,
  };

  expectEnvelopeViolation(
    { items: [strayItem], total: 1 },
    "item-root-not-responding",
  );
});

test("ADVERSARIAL: a missing Root contract version is rejected", () => {
  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [rootUnavailable("HistoryRoot", "unavailable", "Down.")],
      rootContractVersions: { DictionaryRoot: "1.0.0" },
    },
    "root-contract-version-missing",
  );
});

test("ADVERSARIAL: impossible pagination is rejected by the builder itself", () => {
  expectEnvelopeViolation(
    { pagination: { page: 1, limit: 25, offset: -1 } },
    "pagination-offset",
  );
  expectEnvelopeViolation(
    { pagination: { page: 1, limit: 0, offset: 0 } },
    "pagination-limit",
  );
  expectEnvelopeViolation(
    { pagination: { page: 1, limit: 5000, offset: 0 } },
    "pagination-limit",
  );
  expectEnvelopeViolation(
    { pagination: { page: 0, limit: 25, offset: 0 } },
    "pagination-page",
  );
  expectEnvelopeViolation({ total: -1 }, "pagination-total");
});

test("ADVERSARIAL: an empty requested-Root set is rejected", () => {
  expectEnvelopeViolation(
    {
      requestedRoots: [],
      respondingRoots: [],
      rootContractVersions: {},
    },
    "requested-roots-required",
  );
});

test("ADVERSARIAL: ok, partial, and unavailable are derived from validated accounting", () => {
  const ok = buildSourceRootResponseEnvelope(
    envelopeOptions({
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot", "HistoryRoot"],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    }),
  );
  assert.equal(ok.status, "ok");
  assert.equal(ok.unavailableRoots.length, 0);

  const partial = buildSourceRootResponseEnvelope(
    envelopeOptions({
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [
        rootUnavailable("HistoryRoot", "unavailable", "The Root did not respond."),
      ],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    }),
  );
  assert.equal(partial.status, "partial");
  assert.equal(partial.unavailableRoots.length, 1);
  assert.equal(partial.rootGroups.length, 2);

  const unavailable = buildSourceRootResponseEnvelope(
    envelopeOptions({
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: [],
      unavailableRoots: [
        rootUnavailable("DictionaryRoot", "unavailable", "Down."),
        rootUnavailable("HistoryRoot", "unsupported", "Object type unsupported."),
      ],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    }),
  );
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.rootGroups.length, 2);
  assert.ok(unavailable.rootGroups.every((group) => group.returned === 0));
});

test("ADVERSARIAL: root groups exist only for accounted Roots", () => {
  const envelope = buildSourceRootResponseEnvelope(
    envelopeOptions({
      requestedRoots: ["DictionaryRoot", "HistoryRoot", "BibleRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [
        rootUnavailable("HistoryRoot", "unavailable", "Down."),
        rootUnavailable("BibleRoot", "awaiting-data", "Not provisioned."),
      ],
      rootContractVersions: {
        DictionaryRoot: "1.0.0",
        HistoryRoot: "1.0.0",
        BibleRoot: "1.0.0",
      },
    }),
  );
  const groupRoots = envelope.rootGroups.map((group) => group.rootId).sort();
  assert.deepEqual(groupRoots, ["BibleRoot", "DictionaryRoot", "HistoryRoot"]);
  for (const group of envelope.rootGroups) {
    assert.ok(envelope.requestedRoots.includes(group.rootId));
  }
});

/* =======================================================================
 * Expanded object grammar and persistence mappings
 * ==================================================================== */

test("the shared object grammar defines the required network object types", () => {
  for (const required of [
    "entity",
    "source",
    "claim",
    "evidence",
    "relationship",
    "revision",
    "dataset",
    "provenance-record",
    "temporal-assertion",
    "lexical-entry",
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
      (SOURCEROOT_OBJECT_TYPES as readonly string[]).includes(required),
      `${required} must be DEFINED in the shared grammar`,
    );
    const definition = SOURCEROOT_OBJECT_TYPE_DEFINITIONS.find(
      (item) => item.objectType === required,
    );
    assert.ok(definition, `${required} must carry a definition`);
    assert.ok(definition.description.length > 0);
  }

  // Every defined type must appear in every Root's matrix, and none of them
  // may be PROVIDED just because a database structure exists.
  for (const rootRow of buildObjectTypeMaturityMatrix()) {
    assert.equal(rootRow.objectTypes.length, SOURCEROOT_OBJECT_TYPES.length);
    for (const provision of rootRow.objectTypes) {
      assert.equal(provision.defined, true);
      assert.equal(provision.provided, false);
    }
  }
});

/**
 * The persistence-to-network mappings as released at Chunk 14C.
 *
 * The released architecture explicitly permits later governed stages to ADD
 * object types and mappings, so the previous `length === 3` assertion encoded a
 * rule the contract does not have and that the same release contradicts. It is
 * replaced by the invariants the contract genuinely requires: the historical
 * mappings survive with their released meaning, every mapping stays explicit
 * and reversible, and no addition may introduce ambiguity. Replacing 3 with 5
 * would only have moved the same defect one stage further out.
 */
const MAPPINGS_RELEASED_AT_14C: readonly [string, string, string][] = [
  ["lemma", "DictionaryRoot", "lexical-entry"],
  ["accepted-contextual-record", "HistoryRoot", "historical-record"],
  ["edition-verse-text", "BibleRoot", "scripture-passage"],
];

test("persistence-to-network object type mappings are explicit and reversible", () => {
  // DURABLE: every historical mapping survives, with its released Root and its
  // released network type. Removing one, or repointing it at a different Root
  // or network type, is a silent weakening of a released contract.
  for (const [persistence, rootId, network] of MAPPINGS_RELEASED_AT_14C) {
    assert.equal(networkObjectTypeForPersistenceType(persistence), network);
    assert.equal(persistenceTypeForNetworkObjectType(network), persistence);
    const mapping = PERSISTENCE_TO_NETWORK_OBJECT_TYPES.find(
      (item) => item.persistenceResourceType === persistence,
    );
    assert.ok(mapping, `released mapping is missing: ${persistence}`);
    assert.equal(mapping.rootId, rootId);
    assert.equal(mapping.networkObjectType, network);
  }

  // DURABLE: the set may grow under a governed stage but never shrink.
  assert.ok(
    PERSISTENCE_TO_NETWORK_OBJECT_TYPES.length >=
      MAPPINGS_RELEASED_AT_14C.length,
    "the released mapping set may never shrink",
  );

  // DURABLE: every mapping - released or added - stays explicit, resolves in
  // BOTH directions, and names a DEFINED shared-grammar object type. A mapping
  // to an undefined type would be an invented vocabulary.
  for (const mapping of PERSISTENCE_TO_NETWORK_OBJECT_TYPES) {
    assert.ok(mapping.persistenceResourceType.length > 0);
    assert.ok(mapping.rootId.length > 0);
    assert.ok(
      (SOURCEROOT_OBJECT_TYPES as readonly string[]).includes(
        mapping.networkObjectType,
      ),
      `${mapping.networkObjectType} must be a DEFINED shared-grammar object type`,
    );
    assert.equal(
      networkObjectTypeForPersistenceType(mapping.persistenceResourceType),
      mapping.networkObjectType,
    );
    assert.equal(
      persistenceTypeForNetworkObjectType(mapping.networkObjectType),
      mapping.persistenceResourceType,
    );
  }

  // DURABLE: the mapping stays ONE-TO-ONE in both directions. The reverse
  // lookup returns the first match, so a duplicate on either side would make
  // one mapping silently unreachable and the reverse answer arbitrary.
  const persistenceNames = PERSISTENCE_TO_NETWORK_OBJECT_TYPES.map(
    (item) => item.persistenceResourceType,
  );
  const networkNames = PERSISTENCE_TO_NETWORK_OBJECT_TYPES.map(
    (item) => item.networkObjectType,
  );
  assert.equal(
    new Set(persistenceNames).size,
    persistenceNames.length,
    "a persistence type is mapped more than once",
  );
  assert.equal(
    new Set(networkNames).size,
    networkNames.length,
    "a network object type is claimed by more than one persistence type",
  );

  assert.equal(networkObjectTypeForPersistenceType("not-a-type"), undefined);
  assert.equal(persistenceTypeForNetworkObjectType("not-a-type"), undefined);

  // The released persistence names must still exist verbatim in migration 018.
  // Only the RELEASED names are checked here: a governed descendant may persist
  // its resources under a migration of its own, so requiring every mapping to
  // appear in 018 would freeze the schema surface a descendant is allowed to
  // extend.
  const migration = readFileSync(
    path.join(MIGRATION_DIRECTORY, "018_create_cross_root_link_foundation.sql"),
    "utf8",
  );
  for (const [persistence] of MAPPINGS_RELEASED_AT_14C) {
    assert.ok(
      migration.includes(`'${persistence}'`),
      `${persistence} must remain the released persistence name`,
    );
  }
});

test("governed descendant mappings are well-formed where they exist", () => {
  // Chunk 15A adds EarthRoot place and polity. This does not require them to
  // exist - a later stage may legitimately remove its own unreleased addition -
  // but where a governed addition IS present it must be correctly formed, so an
  // addition cannot enter the released surface half-declared.
  for (const [persistence, rootId, network] of [
    ["place", "EarthRoot", "place"],
    ["polity", "EarthRoot", "polity"],
  ] as const) {
    const mapping = PERSISTENCE_TO_NETWORK_OBJECT_TYPES.find(
      (item) => item.persistenceResourceType === persistence,
    );
    if (!mapping) continue;
    assert.equal(mapping.rootId, rootId);
    assert.equal(mapping.networkObjectType, network);
    assert.equal(networkObjectTypeForPersistenceType(persistence), network);
    assert.equal(persistenceTypeForNetworkObjectType(network), persistence);
  }
});

/* =======================================================================
 * IDENTITY EVIDENCE PROVENANCE AND ADDRESS-FORMAT-VERSION ATTACKS
 *
 * A targeted independent re-audit proved that an otherwise-valid reviewed
 * asserted_same_as assertion could carry accepted-kind evidence with a blank
 * evidenceId, sourceDatasetId, and sourceDatasetVersion and still produce
 * exactly one direct counterpart. Evidence that cannot be traced to a specific
 * record in a specific released dataset version is not evidence.
 *
 * Every case below drives the real path:
 *   validateIdentityAssertion
 *     -> evaluateIdentityCounterpartEligibility
 *       -> directIdentityCounterparts
 * ==================================================================== */

/** Asserts the full refusal chain for a tampered assertion. */
function assertRefused(
  assertion: SourceRootIdentityAssertion,
  label: string,
  expectedRule?: string,
) {
  const violations = validateIdentityAssertion(assertion);
  assert.ok(violations.length > 0, `${label}: must produce validation violations`);
  if (expectedRule) {
    assert.ok(
      violations.some((violation) => violation.rule === expectedRule),
      `${label}: expected rule ${expectedRule}, got ${violations
        .map((violation) => violation.rule)
        .join(", ")}`,
    );
  }
  assert.equal(
    evaluateIdentityCounterpartEligibility(assertion).eligible,
    false,
    `${label}: must be ineligible`,
  );
  assert.deepEqual(
    directIdentityCounterparts(HISTORY_ADDRESS, [assertion]),
    [],
    `${label}: must produce zero counterparts`,
  );
}

/** Baseline evidence: a complete, traceable, accepted entry. */
function validEvidence() {
  return { ...FIXTURE_IDENTITY_ASSERTIONS[0]!.evidence[0]! };
}

function assertionWithEvidenceField(field: string, value: unknown) {
  return eligibleAssertion({
    evidence: [{ ...validEvidence(), [field]: value } as never],
  });
}

test("ATTACK: the audit's exact reproduction is refused", () => {
  // Verbatim from the targeted re-audit: an otherwise-valid reviewed
  // asserted_same_as assertion whose accepted-kind evidence carries blank
  // evidenceId, sourceDatasetId, and sourceDatasetVersion. Before this
  // correction it produced no violations, passed eligibility, and returned
  // exactly one counterpart.
  const attack = eligibleAssertion({
    evidence: [
      {
        ...validEvidence(),
        evidenceId: "",
        sourceDatasetId: "",
        sourceDatasetVersion: "",
      },
    ],
  });

  const violations = validateIdentityAssertion(attack);
  for (const rule of [
    "evidence-id-required",
    "evidence-dataset-id-required",
    "evidence-dataset-version-required",
  ]) {
    assert.ok(
      violations.some((violation) => violation.rule === rule),
      `${rule} must be reported`,
    );
  }
  assert.equal(evaluateIdentityCounterpartEligibility(attack).eligible, false);
  assert.deepEqual(directIdentityCounterparts(HISTORY_ADDRESS, [attack]), []);
});

test("ATTACK: blank, whitespace, and non-string evidenceId are all refused", () => {
  assertRefused(
    assertionWithEvidenceField("evidenceId", ""),
    "evidenceId empty",
    "evidence-id-required",
  );
  assertRefused(
    assertionWithEvidenceField("evidenceId", "   "),
    "evidenceId whitespace",
    "evidence-id-required",
  );
  assertRefused(
    assertionWithEvidenceField("evidenceId", 42),
    "evidenceId non-string",
    "evidence-id-required",
  );
  assertRefused(
    assertionWithEvidenceField("evidenceId", undefined),
    "evidenceId missing",
    "evidence-id-required",
  );
});

test("ATTACK: blank, whitespace, and non-string sourceDatasetId are all refused", () => {
  assertRefused(
    assertionWithEvidenceField("sourceDatasetId", ""),
    "sourceDatasetId empty",
    "evidence-dataset-id-required",
  );
  assertRefused(
    assertionWithEvidenceField("sourceDatasetId", "\t\n "),
    "sourceDatasetId whitespace",
    "evidence-dataset-id-required",
  );
  assertRefused(
    assertionWithEvidenceField("sourceDatasetId", { id: "x" }),
    "sourceDatasetId non-string",
    "evidence-dataset-id-required",
  );
  assertRefused(
    assertionWithEvidenceField("sourceDatasetId", null),
    "sourceDatasetId missing",
    "evidence-dataset-id-required",
  );
});

test("ATTACK: blank, whitespace, malformed, and non-string sourceDatasetVersion are all refused", () => {
  assertRefused(
    assertionWithEvidenceField("sourceDatasetVersion", ""),
    "sourceDatasetVersion empty",
    "evidence-dataset-version-required",
  );
  assertRefused(
    assertionWithEvidenceField("sourceDatasetVersion", "  "),
    "sourceDatasetVersion whitespace",
    "evidence-dataset-version-required",
  );
  assertRefused(
    assertionWithEvidenceField("sourceDatasetVersion", 1),
    "sourceDatasetVersion non-string",
    "evidence-dataset-version-required",
  );
  for (const malformed of ["latest", "v1", "1", "1.0", "1.0.0.0", "one.two.three"]) {
    assertRefused(
      assertionWithEvidenceField("sourceDatasetVersion", malformed),
      `sourceDatasetVersion malformed (${malformed})`,
      "evidence-dataset-version-malformed",
    );
  }
});

test("ATTACK: the same empty-but-present defect is closed on every required evidence field", () => {
  // statement and sourceLocator belong to the same defect class and must be
  // refused identically, not just the three fields the audit named.
  for (const [field, rule] of [
    ["statement", "evidence-statement-required"],
    ["sourceLocator", "evidence-locator-required"],
  ] as const) {
    for (const value of ["", "   ", 7, null, undefined]) {
      assertRefused(
        assertionWithEvidenceField(field, value),
        `${field}=${JSON.stringify(value)}`,
        rule,
      );
    }
  }

  // A blank or invented kind must not slip through as "merely not rejected".
  for (const value of ["", "   ", undefined, "invented_kind"]) {
    assertRefused(
      assertionWithEvidenceField("kind", value),
      `kind=${JSON.stringify(value)}`,
      "unknown-evidence-kind",
    );
  }

  // Every field the contract declares required is covered above.
  assert.deepEqual([...REQUIRED_IDENTITY_EVIDENCE_FIELDS].sort(), [
    "evidenceId",
    "kind",
    "sourceDatasetId",
    "sourceDatasetVersion",
    "sourceLocator",
    "statement",
  ]);
});

test("ATTACK: a non-object evidence entry is refused", () => {
  for (const value of [null, "evidence", 5]) {
    assertRefused(
      eligibleAssertion({ evidence: [value as never] }),
      `evidence entry ${JSON.stringify(value)}`,
    );
  }
});

test("ATTACK: missing, blank, malformed, and unsupported addressFormatVersion are all refused", () => {
  assertRefused(
    eligibleAssertion({ addressFormatVersion: undefined as never }),
    "addressFormatVersion missing",
    "address-format-version-missing",
  );
  assertRefused(
    eligibleAssertion({ addressFormatVersion: "" }),
    "addressFormatVersion empty",
    "address-format-version-blank",
  );
  assertRefused(
    eligibleAssertion({ addressFormatVersion: "   " }),
    "addressFormatVersion whitespace",
    "address-format-version-blank",
  );
  assertRefused(
    eligibleAssertion({ addressFormatVersion: 1 as never }),
    "addressFormatVersion non-string",
    "address-format-version-not-a-string",
  );
  for (const malformed of ["v1", "1", "1.0", "latest", "1.0.0.0"]) {
    assertRefused(
      eligibleAssertion({ addressFormatVersion: malformed }),
      `addressFormatVersion malformed (${malformed})`,
      "address-format-version-malformed",
    );
  }
  for (const unsupported of ["2.0.0", "0.9.0", "1.1.0"]) {
    assertRefused(
      eligibleAssertion({ addressFormatVersion: unsupported }),
      `addressFormatVersion unsupported (${unsupported})`,
      "address-format-version-unsupported",
    );
  }
});

test("ATTACK: the supported address format version has one source of truth", () => {
  assert.deepEqual(
    [...SOURCEROOT_SUPPORTED_ADDRESS_FORMAT_VERSIONS],
    [SOURCEROOT_ADDRESS_FORMAT_VERSION],
  );
  const identitySource = readFileSync(
    path.join(backendRoot, "src", "sourceroot", "identity-assertions.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    identitySource,
    /addressFormatVersion[^\n]*===\s*"\d+\.\d+\.\d+"/,
    "the identity module must compare through the addressing contract, not a duplicated literal",
  );
});

test("POSITIVE CONTROL: a complete traceable assertion still yields exactly one counterpart", () => {
  const assertion = FIXTURE_IDENTITY_ASSERTIONS[0]!;

  assert.equal(assertion.addressFormatVersion, SOURCEROOT_ADDRESS_FORMAT_VERSION);
  assert.equal(assertion.predicate, "asserted_same_as");
  assert.equal(assertion.reviewState, "accepted_after_review");
  assert.equal(assertion.status, "active");
  assert.equal(assertion.disputeState, "not_disputed");

  const evidence = assertion.evidence[0]!;
  assert.ok(evidence.evidenceId.trim().length > 0);
  assert.ok(isAcceptedIdentityEvidenceKind(evidence.kind));
  assert.ok(evidence.statement.trim().length > 0);
  assert.ok(evidence.sourceLocator.trim().length > 0);
  assert.ok(evidence.sourceDatasetId.trim().length > 0);
  assert.equal(checkDatasetVersion(evidence.sourceDatasetVersion), null);

  assert.deepEqual(validateIdentityAssertion(assertion), []);
  assert.equal(evaluateIdentityCounterpartEligibility(assertion).eligible, true);
  assert.deepEqual(
    directIdentityCounterparts(HISTORY_ADDRESS, [assertion]).map(
      formatSourceRootAddress,
    ),
    [formatSourceRootAddress(BIBLE_ADDRESS)],
  );
});

/* =======================================================================
 * GOVERNED ROOT IDENTITY AND ROOT CONTRACT VERSION ATTACKS
 *
 * The final independent replay proved the envelope accepted Root identifiers
 * and Root contract versions that merely existed as properties: invented Root
 * IDs, blank Root IDs, and contract versions of null, 42, "", "latest", and an
 * unsupported "2.0.0" all participated in successful accounting.
 *
 * A TypeScript union is not a runtime trust boundary.
 * ==================================================================== */

/** Root identifiers that must never participate in accounting. */
const HOSTILE_ROOT_IDS: readonly unknown[] = [
  null,
  undefined,
  42,
  true,
  {},
  [],
  "",
  "   ",
  "\t\n",
  "InventedRoot",
  " DictionaryRoot",
  "DictionaryRoot ",
  "dictionaryroot",
  "DICTIONARYROOT",
  "DictionaryRoot\n",
];

test("ATTACK: hostile Root identifiers are refused by the governed registry check", () => {
  for (const candidate of HOSTILE_ROOT_IDS) {
    assert.notEqual(
      checkRootId(candidate),
      null,
      `${JSON.stringify(candidate)} must not be a valid governed Root identifier`,
    );
  }
  // Exact governed identity is accepted, and nothing else.
  for (const rootId of SOURCEROOT_ROOT_IDS) {
    assert.equal(checkRootId(rootId), null);
  }
});

test("ATTACK: a hostile requested Root cannot enter accounting", () => {
  for (const candidate of HOSTILE_ROOT_IDS) {
    assert.throws(
      () =>
        buildSourceRootResponseEnvelope(
          envelopeOptions({
            requestedRoots: [candidate],
            respondingRoots: [],
            unavailableRoots: [
              { rootId: candidate, state: "unavailable", reason: "n/a" },
            ],
            rootContractVersions: { [String(candidate)]: "1.0.0" },
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof SourceRootEnvelopeContractError);
        assert.ok(
          error.violations.some((violation) =>
            violation.rule.startsWith("requested-root-id-"),
          ),
          `${JSON.stringify(candidate)} produced ${error.violations
            .map((violation) => violation.rule)
            .join(", ")}`,
        );
        return true;
      },
      `requested Root ${JSON.stringify(candidate)} must be refused`,
    );
  }
});

test("ATTACK: a hostile responding Root cannot enter accounting", () => {
  for (const candidate of HOSTILE_ROOT_IDS) {
    assert.throws(
      () =>
        buildSourceRootResponseEnvelope(
          envelopeOptions({
            requestedRoots: ["DictionaryRoot", candidate],
            respondingRoots: ["DictionaryRoot", candidate],
            rootContractVersions: {
              DictionaryRoot: "1.0.0",
              [String(candidate)]: "1.0.0",
            },
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof SourceRootEnvelopeContractError);
        assert.ok(
          error.violations.some((violation) =>
            violation.rule.startsWith("responding-root-"),
          ),
        );
        return true;
      },
      `responding Root ${JSON.stringify(candidate)} must be refused`,
    );
  }
});

test("ATTACK: a hostile unavailable Root identity cannot enter accounting", () => {
  for (const candidate of HOSTILE_ROOT_IDS) {
    assert.throws(
      () =>
        buildSourceRootResponseEnvelope(
          envelopeOptions({
            requestedRoots: ["DictionaryRoot"],
            respondingRoots: ["DictionaryRoot"],
            unavailableRoots: [
              { rootId: candidate, state: "unavailable", reason: "Down." },
            ],
            rootContractVersions: { DictionaryRoot: "1.0.0" },
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof SourceRootEnvelopeContractError);
        assert.ok(
          error.violations.some((violation) =>
            violation.rule.startsWith("unavailable-root-id-"),
          ),
        );
        return true;
      },
      `unavailable Root ${JSON.stringify(candidate)} must be refused`,
    );
  }
});

test("ATTACK: a hostile result-item rootId cannot enter accounting", () => {
  const baseItem = {
    address: formatSourceRootAddress(HISTORY_ADDRESS),
    objectType: "historical-record",
    canonicalPublicId: "x",
    datasetId: FIXTURE_DATASET_ID,
    datasetVersion: FIXTURE_DATASET_VERSION,
    canonicalUrl: null,
    provenanceSummary: {
      datasetId: FIXTURE_DATASET_ID,
      datasetVersion: FIXTURE_DATASET_VERSION,
      derivation: "directly_sourced",
      sourceLocator: null,
      evidenceCount: 0,
    },
    temporalSummary: { mode: "not_asserted", asserted: false, description: "x" },
    uncertaintySummary: {
      certainty: "uncertain",
      uncertaintyStatement: null,
      disputed: false,
    },
    reviewSummary: { reviewState: "unreviewed", reviewed: false },
    rootPayload: {},
    semanticConclusion: null,
  };

  for (const candidate of HOSTILE_ROOT_IDS) {
    assert.throws(
      () =>
        buildSourceRootResponseEnvelope(
          envelopeOptions({
            items: [{ ...baseItem, rootId: candidate }],
            total: 1,
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof SourceRootEnvelopeContractError);
        assert.ok(
          error.violations.some(
            (violation) =>
              violation.rule.startsWith("item-root-id-") ||
              violation.rule === "item-root-not-responding",
          ),
        );
        return true;
      },
      `item rootId ${JSON.stringify(candidate)} must be refused`,
    );
  }
});

test("ATTACK: a hostile Root contract version map key is refused", () => {
  for (const candidate of ["", "   ", "InventedRoot", "dictionaryroot"]) {
    expectEnvelopeViolation(
      {
        requestedRoots: ["DictionaryRoot"],
        respondingRoots: ["DictionaryRoot"],
        rootContractVersions: { DictionaryRoot: "1.0.0", [candidate]: "1.0.0" },
      },
      `contract-version-root-id-${candidate.trim().length === 0 ? "blank" : "unregistered"}`,
    );
  }
});

test("ATTACK: a responding Root with a malformed or unsupported contract version is refused", () => {
  const cases: readonly [unknown, string][] = [
    [null, "root-contract-version-missing"],
    [undefined, "root-contract-version-missing"],
    [42, "root-contract-version-not-a-string"],
    [false, "root-contract-version-not-a-string"],
    [["1.0.0"], "root-contract-version-not-a-string"],
    [{ version: "1.0.0" }, "root-contract-version-not-a-string"],
    ["", "root-contract-version-blank"],
    ["   ", "root-contract-version-blank"],
    ["latest", "root-contract-version-malformed"],
    ["v1", "root-contract-version-malformed"],
    ["1.0", "root-contract-version-malformed"],
    ["1.0.0.0", "root-contract-version-malformed"],
    // Syntactically valid but not the version the registry grants.
    ["2.0.0", "root-contract-version-unsupported"],
    ["0.9.0", "root-contract-version-unsupported"],
    ["1.1.0", "root-contract-version-unsupported"],
    ["1.0.1", "root-contract-version-unsupported"],
  ];

  for (const [version, expectedRule] of cases) {
    expectEnvelopeViolation(
      {
        requestedRoots: ["DictionaryRoot"],
        respondingRoots: ["DictionaryRoot"],
        rootContractVersions: { DictionaryRoot: version },
      },
      expectedRule,
    );
  }
});

test("POSITIVE CONTROL: an operational Root with its governed version builds a valid envelope", () => {
  const supported = supportedRootContractVersion("DictionaryRoot");
  assert.equal(supported, "1.0.0");
  assert.equal(checkRootContractVersion("DictionaryRoot", supported), null);
  assert.equal(checkRespondingRoot("DictionaryRoot"), null);

  const envelope = buildSourceRootResponseEnvelope(
    envelopeOptions({
      requestedRoots: ["DictionaryRoot"],
      respondingRoots: ["DictionaryRoot"],
      rootContractVersions: { DictionaryRoot: supported },
    }),
  );
  assert.equal(envelope.status, "ok");
  assert.deepEqual(envelope.respondingRoots, ["DictionaryRoot"]);
  assert.equal(envelope.rootContractVersions.DictionaryRoot, "1.0.0");
});

test("PLANNED ROOT CONTROL: requestable and accountable as unavailable, but never responding", () => {
  // Registry evidence: a planned Root is granted no Root contract version.
  for (const rootId of PLANNED_ROOT_IDS) {
    const entry = getRootRegistryEntry(rootId);
    assert.ok(entry);
    assert.equal(entry.lifecycle, "planned");
    assert.equal(entry.rootContractVersion, null);
    assert.equal(supportedRootContractVersion(rootId), null);
    // Registered, so a client may name it...
    assert.equal(checkRootId(rootId), null);
    // ...but it cannot answer.
    assert.equal(checkRespondingRoot(rootId), "cannot-respond");
  }

  // Permitted: requested and truthfully accounted unavailable.
  const envelope = buildSourceRootResponseEnvelope(
    envelopeOptions({
      requestedRoots: ["DictionaryRoot", "EarthRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [
        rootUnavailable(
          "EarthRoot",
          "unsupported",
          "EarthRoot is planned and exposes no SourceRoot network contract.",
        ),
      ],
      rootContractVersions: { DictionaryRoot: "1.0.0", EarthRoot: null },
    }),
  );
  assert.equal(envelope.status, "partial");
  assert.equal(envelope.unavailableRoots[0]?.rootId, "EarthRoot");

  // Refused: a planned Root pretending to respond.
  expectEnvelopeViolation(
    {
      requestedRoots: ["EarthRoot"],
      respondingRoots: ["EarthRoot"],
      rootContractVersions: { EarthRoot: null },
    },
    "responding-root-cannot-respond",
  );

  // Refused: claiming a contract version the registry does not grant it.
  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot", "EarthRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [
        rootUnavailable("EarthRoot", "unsupported", "Planned."),
      ],
      rootContractVersions: { DictionaryRoot: "1.0.0", EarthRoot: "1.0.0" },
    },
    "root-contract-version-unexpected",
  );
});

test("SWEEP: malformed accounting containers fail closed instead of crashing", () => {
  // Same defect class, swept across the fields that can alter Root identity,
  // availability, contract compatibility, or status derivation.
  for (const [field, value, rule] of [
    ["requestedRoots", "DictionaryRoot", "requestedRoots-shape"],
    ["requestedRoots", null, "requestedRoots-shape"],
    ["respondingRoots", "DictionaryRoot", "respondingRoots-shape"],
    ["unavailableRoots", {}, "unavailableRoots-shape"],
    ["items", "not-an-array", "items-shape"],
    ["rootContractVersions", "1.0.0", "root-contract-versions-shape"],
    ["rootContractVersions", null, "root-contract-versions-shape"],
    ["rootContractVersions", [], "root-contract-versions-shape"],
  ] as const) {
    expectEnvelopeViolation({ [field]: value }, rule);
  }

  // A null unavailable entry must be a violation, not a TypeError.
  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [null],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    },
    "unavailable-entry-shape",
  );

  // A null result item likewise.
  expectEnvelopeViolation({ items: [null], total: 1 }, "item-shape");
});

test("REGRESSION: Root identity validation did not weaken the accounting invariant", () => {
  // The original disappearance attack must still be refused.
  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    },
    "requested-root-unaccounted",
  );

  // And all three status derivations still hold with governed identities.
  const ok = buildSourceRootResponseEnvelope(
    envelopeOptions({
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot", "HistoryRoot"],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    }),
  );
  assert.equal(ok.status, "ok");

  const partial = buildSourceRootResponseEnvelope(
    envelopeOptions({
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [rootUnavailable("HistoryRoot", "unavailable", "Down.")],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    }),
  );
  assert.equal(partial.status, "partial");

  const unavailable = buildSourceRootResponseEnvelope(
    envelopeOptions({
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: [],
      unavailableRoots: [
        rootUnavailable("DictionaryRoot", "unavailable", "Down."),
        rootUnavailable("HistoryRoot", "unavailable", "Down."),
      ],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    }),
  );
  assert.equal(unavailable.status, "unavailable");
});

/* =======================================================================
 * SOURCEROOT RESULT ITEM TRUST BOUNDARY ATTACKS
 *
 * The commit-gate replay proved the builder emitted an item as thin as
 * `{ rootId, rootPayload }` and reported status "ok". SourceRootResultItem is
 * a public contract boundary; a TypeScript interface is not a runtime one.
 * ==================================================================== */

test("EXACT CODEX REPRODUCTION: a bare rootId/rootPayload item is rejected", () => {
  const attack = { rootId: "DictionaryRoot", rootPayload: {} };

  assert.throws(
    () =>
      buildSourceRootResponseEnvelope(
        envelopeOptions({
          requestedRoots: ["DictionaryRoot"],
          respondingRoots: ["DictionaryRoot"],
          rootContractVersions: { DictionaryRoot: "1.0.0" },
          items: [attack],
          total: 1,
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof SourceRootResultItemContractError);
      // Every absent required field must be reported, not silently filled in.
      for (const field of REQUIRED_RESULT_ITEM_FIELDS) {
        if (field === "rootId" || field === "rootPayload") continue;
        assert.ok(
          error.violations.some((violation) =>
            violation.rule.includes(`${field}-missing`),
          ),
          `${field} must be reported missing`,
        );
      }
      return true;
    },
    "the bare item must never produce an envelope",
  );

  // And it must never be reachable as a successful response.
  const violations = validateResultItem(attack);
  assert.ok(violations.length > 0);
});

test("POSITIVE CONTROL: a fully valid result item produces a valid envelope", () => {
  const item = validResultItem();
  assert.deepEqual(validateResultItem(item), []);

  const envelope = buildSourceRootResponseEnvelope(envelopeWithItem(item));
  assert.equal(envelope.status, "ok");
  assert.equal(envelope.items.length, 1);

  const emitted = envelope.items[0]!;
  // Semantic meaning is emitted unchanged: nothing manufactured, nothing lost.
  assert.deepEqual(emitted as unknown, item);
  assert.equal(emitted.provenanceSummary.sourceLocator, "fixture://record");
  assert.equal(emitted.provenanceSummary.evidenceCount, 1);
  assert.equal(emitted.temporalSummary.mode, "approximate");
  assert.equal(emitted.temporalSummary.asserted, true);
  assert.equal(emitted.uncertaintySummary.certainty, "uncertain");
  assert.ok(emitted.uncertaintySummary.uncertaintyStatement);
  assert.equal(emitted.reviewSummary.reviewState, "unreviewed");
  assert.equal(emitted.semanticConclusion, null);

  assert.equal(envelope.rootGroups[0]?.rootId, "HistoryRoot");
  assert.equal(envelope.rootGroups[0]?.returned, 1);
});

test("ATTACK: every required top-level field is enforced at runtime", () => {
  for (const field of REQUIRED_RESULT_ITEM_FIELDS) {
    const withoutField = validResultItem();
    delete withoutField[field];
    // rootId is owned by the accounting invariant, which refuses it first.
    const expected = field === "rootId" ? "root-id" : `${field}-missing`;
    expectItemViolation(withoutField, expected, `missing ${field}`);
    // The item validator reports it regardless of which layer refuses first.
    assert.ok(
      validateResultItem(withoutField).some((violation) =>
        violation.rule.includes(`${field}-missing`),
      ),
      `${field} must be reported missing by the item validator`,
    );
  }
  assert.equal(REQUIRED_RESULT_ITEM_FIELDS.length, 13);
});

test("ATTACK: required string fields reject null, wrong type, blank, and whitespace", () => {
  for (const field of [
    "address",
    "objectType",
    "canonicalPublicId",
    "datasetId",
    "datasetVersion",
  ] as const) {
    for (const value of [null, undefined, 42, true, {}, [], "", "   "]) {
      expectItemViolation(
        { ...validResultItem(), [field]: value },
        field,
        `${field}=${JSON.stringify(value)}`,
      );
    }
  }
});

test("ATTACK: the address must be well formed and agree with its components", () => {
  expectItemViolation(
    { ...validResultItem(), address: "not-an-address" },
    "address-address-scheme-invalid",
    "malformed address",
  );
  expectItemViolation(
    {
      ...validResultItem(),
      address: "sourceroot:HistoryRoot/historical-record/x",
    },
    "address-address-dataset-qualification-missing",
    "address without dataset qualification",
  );

  // A rootId contradicting the address is refused by accounting first, and
  // the item validator reports the mismatch too.
  const contradictingRoot = { ...validResultItem(), rootId: "BibleRoot" };
  expectItemViolation(contradictingRoot, "root", "rootId contradicting address");
  assert.ok(
    validateResultItem(contradictingRoot).some((violation) =>
      violation.rule.includes("address-rootId-mismatch"),
    ),
  );

  // Individually valid components that contradict the address.
  for (const [field, value] of [
    ["objectType", "scripture-passage"],
    ["canonicalPublicId", "different-id"],
    ["datasetId", "some-other-dataset"],
    ["datasetVersion", "9.9.9"],
  ] as const) {
    expectItemViolation(
      { ...validResultItem(), [field]: value },
      `address-${field}-mismatch`,
      `${field} contradicting the address`,
    );
  }
});

test("ATTACK: objectType must be a DEFINED SourceRoot object type", () => {
  for (const invented of ["widget", "Historical-Record", "historical_record"]) {
    expectItemViolation(
      {
        ...validResultItem(),
        objectType: invented,
        address: formatSourceRootAddress({
          rootId: "HistoryRoot",
          objectType: invented,
          canonicalPublicId: "fixture-record-jerusalem-siege",
          datasetId: FIXTURE_DATASET_ID,
          datasetVersion: FIXTURE_DATASET_VERSION,
        }),
      },
      "objectType-undefined",
      `objectType ${invented}`,
    );
  }
});

test("ATTACK: datasetVersion must satisfy the shared version rule", () => {
  for (const malformed of ["latest", "v1", "1.0", "1.0.0.0"]) {
    expectItemViolation(
      {
        ...validResultItem(),
        datasetVersion: malformed,
        address: formatSourceRootAddress({
          rootId: "HistoryRoot",
          objectType: "historical-record",
          canonicalPublicId: "fixture-record-jerusalem-siege",
          datasetId: FIXTURE_DATASET_ID,
          datasetVersion: FIXTURE_DATASET_VERSION,
        }),
      },
      "datasetVersion",
      `datasetVersion ${malformed}`,
    );
  }
});

test("ATTACK: canonicalUrl may be null but never blank or the wrong type", () => {
  const withNull = { ...validResultItem(), canonicalUrl: null };
  assert.deepEqual(validateResultItem(withNull), []);

  for (const value of ["", "   ", 42, {}, []]) {
    expectItemViolation(
      { ...validResultItem(), canonicalUrl: value },
      "canonicalUrl",
      `canonicalUrl=${JSON.stringify(value)}`,
    );
  }
});

test("ATTACK: provenance cannot be missing, malformed, or defaulted", () => {
  for (const value of [null, undefined, "provenance", 42, []]) {
    expectItemViolation(
      { ...validResultItem(), provenanceSummary: value },
      "provenanceSummary",
      `provenanceSummary=${JSON.stringify(value)}`,
    );
  }

  const base = validResultItem();
  const provenance = base.provenanceSummary as Record<string, unknown>;
  for (const [field, values] of [
    ["datasetId", [null, "", "   ", 42]],
    ["datasetVersion", [null, "", "   ", "latest", 42]],
    ["derivation", [null, undefined, "", "   ", 42]],
    ["sourceLocator", ["", "   ", 42, {}]],
    ["evidenceCount", [null, undefined, "1", -1, 1.5, Number.NaN]],
  ] as const) {
    for (const value of values) {
      expectItemViolation(
        {
          ...validResultItem(),
          provenanceSummary: { ...provenance, [field]: value },
        },
        `provenanceSummary.${field}`,
        `provenanceSummary.${field}=${String(value)}`,
      );
    }
  }
});

test("ATTACK: temporal summary must use governed vocabulary and stay coherent", () => {
  for (const value of [null, undefined, "temporal", 42, []]) {
    expectItemViolation(
      { ...validResultItem(), temporalSummary: value },
      "temporalSummary",
      `temporalSummary=${JSON.stringify(value)}`,
    );
  }

  const base = validResultItem();
  const temporal = base.temporalSummary as Record<string, unknown>;
  for (const value of [null, "", "   ", 42, "sometime", "APPROXIMATE"]) {
    expectItemViolation(
      { ...validResultItem(), temporalSummary: { ...temporal, mode: value } },
      "temporalSummary.mode",
      `temporal mode ${String(value)}`,
    );
  }
  for (const value of [null, undefined, "true", 1]) {
    expectItemViolation(
      { ...validResultItem(), temporalSummary: { ...temporal, asserted: value } },
      "temporalSummary.asserted",
      `temporal asserted ${String(value)}`,
    );
  }
  for (const value of [null, "", "   ", 42]) {
    expectItemViolation(
      {
        ...validResultItem(),
        temporalSummary: { ...temporal, description: value },
      },
      "temporalSummary.description",
      `temporal description ${String(value)}`,
    );
  }

  // Temporal honesty: an unasserted scope must never be reported as asserted.
  expectItemViolation(
    {
      ...validResultItem(),
      temporalSummary: {
        mode: "not_asserted",
        asserted: true,
        description: "x",
      },
    },
    "temporalSummary.asserted-incoherent",
    "not_asserted claiming asserted",
  );
  expectItemViolation(
    {
      ...validResultItem(),
      temporalSummary: { mode: "exact", asserted: false, description: "x" },
    },
    "temporalSummary.asserted-incoherent",
    "exact claiming not asserted",
  );
});

test("ATTACK: uncertainty summary is enforced", () => {
  for (const value of [null, undefined, "uncertain", 42, []]) {
    expectItemViolation(
      { ...validResultItem(), uncertaintySummary: value },
      "uncertaintySummary",
      `uncertaintySummary=${JSON.stringify(value)}`,
    );
  }
  const base = validResultItem();
  const uncertainty = base.uncertaintySummary as Record<string, unknown>;
  for (const value of [null, undefined, "", "   ", 42]) {
    expectItemViolation(
      {
        ...validResultItem(),
        uncertaintySummary: { ...uncertainty, certainty: value },
      },
      "uncertaintySummary.certainty",
      `certainty ${String(value)}`,
    );
  }
  for (const value of ["", "   ", 42]) {
    expectItemViolation(
      {
        ...validResultItem(),
        uncertaintySummary: { ...uncertainty, uncertaintyStatement: value },
      },
      "uncertaintySummary.uncertaintyStatement",
      `uncertaintyStatement ${String(value)}`,
    );
  }
  for (const value of [null, undefined, "false", 0]) {
    expectItemViolation(
      {
        ...validResultItem(),
        uncertaintySummary: { ...uncertainty, disputed: value },
      },
      "uncertaintySummary.disputed",
      `disputed ${String(value)}`,
    );
  }
});

test("ATTACK: review summary must use released review vocabulary", () => {
  for (const value of [null, undefined, "reviewed", 42, []]) {
    expectItemViolation(
      { ...validResultItem(), reviewSummary: value },
      "reviewSummary",
      `reviewSummary=${JSON.stringify(value)}`,
    );
  }
  const base = validResultItem();
  const review = base.reviewSummary as Record<string, unknown>;
  for (const value of [null, "", "   ", 42, "approved", "Unreviewed"]) {
    expectItemViolation(
      { ...validResultItem(), reviewSummary: { ...review, reviewState: value } },
      "reviewSummary.reviewState",
      `reviewState ${String(value)}`,
    );
  }
  for (const value of [null, undefined, "true", 1]) {
    expectItemViolation(
      { ...validResultItem(), reviewSummary: { ...review, reviewed: value } },
      "reviewSummary.reviewed",
      `reviewed ${String(value)}`,
    );
  }
  // All four released states are accepted.
  for (const state of [
    "unreviewed",
    "accepted_after_review",
    "disputed",
    "rejected",
  ]) {
    assert.deepEqual(
      validateResultItem({
        ...validResultItem(),
        reviewSummary: { reviewState: state, reviewed: state !== "unreviewed" },
      }),
      [],
      `${state} must be accepted`,
    );
  }
});

test("ATTACK: rootPayload and semanticConclusion are enforced", () => {
  for (const value of [null, undefined, "payload", 42, []]) {
    expectItemViolation(
      { ...validResultItem(), rootPayload: value },
      "rootPayload",
      `rootPayload=${JSON.stringify(value)}`,
    );
  }
  for (const value of [undefined, "", "none", 0, false, {}]) {
    expectItemViolation(
      { ...validResultItem(), semanticConclusion: value },
      "semanticConclusion",
      `semanticConclusion=${JSON.stringify(value)}`,
    );
  }
});

test("ATTACK: a non-object result item is refused without a TypeError", () => {
  for (const value of [null, "item", 42, true, []]) {
    assert.throws(
      () =>
        buildSourceRootResponseEnvelope(
          envelopeOptions({
            requestedRoots: ["HistoryRoot"],
            respondingRoots: ["HistoryRoot"],
            rootContractVersions: { HistoryRoot: "1.0.0" },
            items: [value],
            total: 1,
          }),
        ),
      (error: unknown) => {
        assert.ok(
          error instanceof SourceRootEnvelopeContractError ||
            error instanceof SourceRootResultItemContractError,
          `expected a controlled contract error, got ${String(error)}`,
        );
        return true;
      },
      `item ${JSON.stringify(value)}`,
    );
  }
});

test("REGRESSION: all five blockers remain closed", () => {
  // BLOCKER 1 — invalid identity evidence cannot traverse.
  assert.deepEqual(
    directIdentityCounterparts(HISTORY_ADDRESS, [
      attackWithEvidenceKind("name_only_match"),
    ]),
    [],
  );

  // BLOCKER 2 — a requested Root cannot disappear.
  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot", "HistoryRoot"],
      respondingRoots: ["DictionaryRoot"],
      unavailableRoots: [],
      rootContractVersions: { DictionaryRoot: "1.0.0", HistoryRoot: "1.0.0" },
    },
    "requested-root-unaccounted",
  );

  // BLOCKER 3 — blank evidence provenance cannot traverse.
  assert.deepEqual(
    directIdentityCounterparts(HISTORY_ADDRESS, [
      assertionWithEvidenceField("sourceDatasetId", "   "),
    ]),
    [],
  );

  // BLOCKER 4 — invalid Root ID and unsupported contract version cannot respond.
  expectEnvelopeViolation(
    {
      requestedRoots: ["InventedRoot"],
      respondingRoots: ["InventedRoot"],
      rootContractVersions: { InventedRoot: "1.0.0" },
    },
    "requested-root-id-unregistered",
  );
  expectEnvelopeViolation(
    {
      requestedRoots: ["DictionaryRoot"],
      respondingRoots: ["DictionaryRoot"],
      rootContractVersions: { DictionaryRoot: "2.0.0" },
    },
    "root-contract-version-unsupported",
  );

  // BLOCKER 5 — an invalid result item cannot be emitted.
  assert.throws(
    () =>
      buildSourceRootResponseEnvelope(
        envelopeOptions({
          requestedRoots: ["DictionaryRoot"],
          respondingRoots: ["DictionaryRoot"],
          rootContractVersions: { DictionaryRoot: "1.0.0" },
          items: [{ rootId: "DictionaryRoot", rootPayload: {} }],
          total: 1,
        }),
      ),
    SourceRootResultItemContractError,
  );
});

test("NON-TRANSITIVITY CONTROL: A-B and B-C still yield only B from A", () => {
  const chain = FIXTURE_IDENTITY_ASSERTIONS;
  for (const assertion of chain) {
    assert.deepEqual(validateIdentityAssertion(assertion), []);
    assert.equal(evaluateIdentityCounterpartEligibility(assertion).eligible, true);
  }

  const fromHistory = directIdentityCounterparts(HISTORY_ADDRESS, chain).map(
    formatSourceRootAddress,
  );
  assert.deepEqual(fromHistory, [formatSourceRootAddress(BIBLE_ADDRESS)]);
  assert.ok(
    !fromHistory.includes(formatSourceRootAddress(EARTH_ADDRESS)),
    "C must never appear from A",
  );

  // No governed shared identity may be synthesized from the accepted chain.
  for (const resource of FIXTURE_RESOURCES) {
    assert.equal(resolveGovernedSharedIdentity(resource.address, chain), null);
  }
  assert.throws(
    () => createGovernedSharedIdentity(),
    GovernedSharedIdentityNotImplementedError,
  );
});
