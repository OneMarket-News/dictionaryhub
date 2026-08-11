/**
 * EarthRoot persistence and provenance tests (Chunk 15A).
 *
 * These exercise migration 020 against sourceroot_test. Every test cleans up
 * its own synthetic dataset, and nothing here touches a Chunk 14A or 14B row.
 * The suite refuses to run against any database other than sourceroot_test.
 */

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { closeDatabase, getPool } from "../src/lib/database.js";
import { EARTHROOT_TEMPORAL_NOT_ASSERTED } from "../src/earthroot/contract.js";
import type { EarthRootAssertion, EarthRootResource } from "../src/earthroot/domain.js";
import {
  EarthRootStoreError,
  deleteEarthRootDataset,
  getEarthRootCounts,
  saveEarthRootBundle,
  validateEarthRootBundle,
  type EarthRootBundle,
} from "../src/earthroot/store.js";

const DATASET = "earthroot-synthetic-provenance-fixture-v1";
const VERSION = "0.0.0-contract-fixture";
const PLACE_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const DISTRICT_ID = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const POLITY_A_ID = "cccccccc-3333-4333-8333-cccccccccccc";
const POLITY_B_ID = "dddddddd-4444-4444-8444-dddddddddddd";

const resources: EarthRootResource[] = [
  { resourceId: "p-city", datasetId: DATASET, datasetVersion: VERSION, entityType: "place", canonicalPublicId: PLACE_ID },
  { resourceId: "p-district", datasetId: DATASET, datasetVersion: VERSION, entityType: "place", canonicalPublicId: DISTRICT_ID },
  { resourceId: "g-polity-a", datasetId: DATASET, datasetVersion: VERSION, entityType: "polity", canonicalPublicId: POLITY_A_ID },
  { resourceId: "g-polity-b", datasetId: DATASET, datasetVersion: VERSION, entityType: "polity", canonicalPublicId: POLITY_B_ID },
];

function ev(id: string) {
  return [
    {
      evidenceId: id,
      sourceId: "synthetic-source",
      sourceLocator: "fixture:page-1",
      statement: "Synthetic fixture statement for contract testing only.",
      sourceDatasetId: DATASET,
      sourceDatasetVersion: VERSION,
      evidenceOrder: 1,
    },
  ];
}

const shared = {
  datasetId: DATASET,
  objectResourceId: null as string | null,
  nameType: null as never,
  languageTag: null,
  script: null,
  temporal: EARTHROOT_TEMPORAL_NOT_ASSERTED,
  certainty: "source-bounded",
  uncertaintyStatement: null,
  reviewState: "unreviewed" as const,
  disputeState: "not_disputed" as const,
  assertionStatus: "active" as const,
  derivation: "directly_sourced" as const,
};

const assertions: EarthRootAssertion[] = [
  { ...shared, assertionId: "pa-1", subjectResourceId: "p-city", predicate: "named_as", objectLiteral: "Synthetic City", nameType: "preferred" as never, evidence: ev("pe-1") },
  { ...shared, assertionId: "pa-2", subjectResourceId: "p-city", predicate: "named_as", objectLiteral: "Synthetic Former Name", nameType: "former_name" as never, evidence: ev("pe-2") },
  { ...shared, assertionId: "pa-3", subjectResourceId: "p-city", predicate: "classified_as", objectLiteral: "walled settlement", evidence: ev("pe-3") },
  { ...shared, assertionId: "pa-4", subjectResourceId: "p-district", predicate: "located_within", objectResourceId: "p-city", objectLiteral: null, evidence: ev("pe-4") },
  {
    ...shared,
    assertionId: "pa-5",
    subjectResourceId: "p-city",
    predicate: "governed_by",
    objectResourceId: "g-polity-a",
    objectLiteral: null,
    temporal: { mode: "asserted", validFromYear: -200, validUntilYear: 100, description: "Synthetic earlier control interval." },
    evidence: ev("pe-5"),
  },
  {
    ...shared,
    assertionId: "pa-6",
    subjectResourceId: "p-city",
    predicate: "governed_by",
    objectResourceId: "g-polity-b",
    objectLiteral: null,
    temporal: { mode: "asserted", validFromYear: 101, validUntilYear: 400, description: "Synthetic later control interval." },
    evidence: ev("pe-6"),
  },
];

const bundle: EarthRootBundle = {
  dataset: { datasetId: DATASET, version: VERSION, title: "EarthRoot synthetic provenance fixture", status: "fixture", fixtureOnly: true },
  resources,
  assertions,
};

let databaseAvailable = false;

before(async () => {
  const pool = getPool();
  if (!pool) return;
  const name = (await pool.query<{ d: string }>("SELECT current_database() AS d")).rows[0]?.d;
  // Refuse to mutate anything that is not the governed test database.
  assert.equal(name, "sourceroot_test", "EarthRoot tests must target sourceroot_test");
  databaseAvailable = true;
  await deleteEarthRootDataset(DATASET);
});

after(async () => {
  if (databaseAvailable) await deleteEarthRootDataset(DATASET);
  await closeDatabase();
});

test("1. the synthetic bundle validates before any write", () => {
  assert.deepEqual(validateEarthRootBundle(bundle), []);
});

test("2. migration 020 tables accept the bundle", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  await saveEarthRootBundle(bundle);
  const counts = await getEarthRootCounts(DATASET);
  assert.deepEqual(counts, {
    datasets: 1,
    places: 2,
    polities: 2,
    assertions: 6,
    evidence: 6,
  });
});

test("3. saving is idempotent and does not duplicate", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  await saveEarthRootBundle(bundle);
  const counts = await getEarthRootCounts(DATASET);
  assert.equal(counts.assertions, 6);
  assert.equal(counts.evidence, 6);
});

test("4. two temporally distinct control assertions coexist in storage", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  const rows = await pool.query<{ object_resource_id: string; valid_from_year: number }>(
    `SELECT object_resource_id, valid_from_year
       FROM earthroot_assertions
      WHERE dataset_id = $1 AND predicate = 'governed_by'
      ORDER BY valid_from_year`,
    [DATASET],
  );
  assert.equal(rows.rowCount, 2);
  assert.notEqual(rows.rows[0]!.object_resource_id, rows.rows[1]!.object_resource_id);
  assert.equal(rows.rows[0]!.valid_from_year, -200);
});

test("5. an assertion with no evidence cannot commit", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO earthroot_assertions
         (assertion_id, dataset_id, subject_resource_id, subject_entity_type, predicate,
          object_resource_id, object_entity_type, object_literal, name_type,
          temporal_mode, certainty, review_state, dispute_state, assertion_status,
          derivation, assertion_order)
       VALUES ('pa-unsourced',$1,'p-city','place','classified_as',NULL,NULL,'unsourced claim',NULL,
               'not_asserted','source-bounded','unreviewed','not_disputed','active','directly_sourced',99)`,
      [DATASET],
    );
    await assert.rejects(client.query("COMMIT"), /requires at least one evidence record/iu);
  } finally {
    try { await client.query("ROLLBACK"); } catch { /* already aborted */ }
    client.release();
  }
  const counts = await getEarthRootCounts(DATASET);
  assert.equal(counts.assertions, 6, "the unsourced assertion must not persist");
});

test("5a. deleting the final evidence row of a surviving assertion is BLOCKED", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  const found = (
    await pool.query<{ assertion_id: string }>(
      `SELECT e.assertion_id FROM earthroot_assertion_evidence e
        WHERE e.dataset_id = $1
        GROUP BY e.assertion_id HAVING COUNT(*) = 1 LIMIT 1`,
      [DATASET],
    )
  ).rows[0];
  assert.ok(found, "fixture must contain a single-evidence assertion for this test to mean anything");
  const target = found.assertion_id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM earthroot_assertion_evidence WHERE assertion_id = $1 AND dataset_id = $2`,
      [target, DATASET],
    );
    await assert.rejects(client.query("COMMIT"), /would be left unsourced/iu);
  } finally {
    try { await client.query("ROLLBACK"); } catch { /* already aborted */ }
    client.release();
  }
  const survived = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int n FROM earthroot_assertion_evidence WHERE assertion_id = $1`,
    [target],
  );
  assert.equal(survived.rows[0]!.n, 1, "the blocked deletion must have rolled back");
});

test("5b. re-pointing the final evidence row is BLOCKED too, not just deleting it", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  const rows = await pool.query<{ assertion_id: string; evidence_id: string }>(
    `SELECT e.assertion_id, MIN(e.evidence_id) evidence_id
       FROM earthroot_assertion_evidence e
      WHERE e.dataset_id = $1
      GROUP BY e.assertion_id HAVING COUNT(*) = 1 LIMIT 1`,
    [DATASET],
  );
  const target = rows.rows[0]!;
  const other = (
    await pool.query<{ assertion_id: string }>(
      `SELECT assertion_id FROM earthroot_assertions
        WHERE dataset_id = $1 AND assertion_id <> $2 LIMIT 1`,
      [DATASET, target.assertion_id],
    )
  ).rows[0]!;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // evidence_order moves too, otherwise the (assertion_id, evidence_order)
    // unique key rejects the row first and the guard is never exercised.
    await client.query(
      `UPDATE earthroot_assertion_evidence
          SET assertion_id = $1, evidence_order = 999
        WHERE evidence_id = $2`,
      [other.assertion_id, target.evidence_id],
    );
    await assert.rejects(client.query("COMMIT"), /would be left unsourced/iu);
  } finally {
    try { await client.query("ROLLBACK"); } catch { /* already aborted */ }
    client.release();
  }
});

test("5c. legitimate teardown still succeeds: assertion and its evidence together", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  const before = await getEarthRootCounts(DATASET);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO earthroot_assertions
         (assertion_id, dataset_id, subject_resource_id, subject_entity_type, predicate,
          object_resource_id, object_entity_type, object_literal, name_type,
          temporal_mode, certainty, review_state, dispute_state, assertion_status,
          derivation, assertion_order)
       VALUES ('pa-teardown',$1,'p-city','place','classified_as',NULL,NULL,'teardown claim',NULL,
               'not_asserted','source-bounded','unreviewed','not_disputed','active','directly_sourced',98)`,
      [DATASET],
    );
    await client.query(
      `INSERT INTO earthroot_assertion_evidence
         (evidence_id, assertion_id, dataset_id, source_id, source_locator, statement,
          source_dataset_id, source_dataset_version, evidence_order)
       VALUES ('pe-teardown','pa-teardown',$1,'synthetic-source','fixture:teardown',
               'Synthetic teardown statement.',$1,$2,1)`,
      [DATASET, VERSION],
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  const teardown = await pool.connect();
  try {
    await teardown.query("BEGIN");
    await teardown.query(`DELETE FROM earthroot_assertion_evidence WHERE assertion_id = 'pa-teardown'`);
    await teardown.query(`DELETE FROM earthroot_assertions WHERE assertion_id = 'pa-teardown'`);
    await teardown.query("COMMIT");
  } finally {
    teardown.release();
  }

  const after = await getEarthRootCounts(DATASET);
  assert.deepEqual(after, before, "teardown must leave the fixture exactly as it was");
});

test("5e. TRUNCATE cannot strip evidence and leave assertions unsourced", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  const client = await pool.connect();
  try {
    // The guard carries the most absolute wording in the migration and was
    // previously verified only by regex against the SQL text.
    await client.query("BEGIN");
    await assert.rejects(
      client.query("TRUNCATE earthroot_assertion_evidence"),
      /would leave .* unsourced/iu,
      "truncating evidence while assertions survive must fail",
    );
  } finally {
    try { await client.query("ROLLBACK"); } catch { /* already aborted */ }
    client.release();
  }

  // Legitimate teardown of BOTH tables together still succeeds: no assertion
  // survives to be left unsourced.
  const both = await pool.connect();
  try {
    await both.query("BEGIN");
    await both.query("TRUNCATE earthroot_assertion_evidence, earthroot_assertions");
    await both.query("ROLLBACK");
  } finally {
    both.release();
  }

  const counts = await getEarthRootCounts(DATASET);
  assert.equal(counts.assertions, 6, "every probe rolled back; the fixture is intact");

  // NOTE ON SCOPE: this proves the guard for the role running these tests. It
  // does NOT constrain a PostgreSQL superuser, who can disable or drop the
  // trigger outright. See the N8 deferred activation gate.
});

test("5d. an evidence row cannot name a dataset other than its assertion's", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  const mismatched = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int n
       FROM earthroot_assertion_evidence e
       JOIN earthroot_assertions a ON a.assertion_id = e.assertion_id
      WHERE a.dataset_id <> e.dataset_id`,
  );
  assert.equal(mismatched.rows[0]!.n, 0);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(
      client.query(
        `UPDATE earthroot_assertion_evidence SET dataset_id = 'some-other-dataset'
          WHERE dataset_id = $1`,
        [DATASET],
      ),
      /foreign key|violates/iu,
      "the composite foreign key must make dataset divergence unrepresentable",
    );
  } finally {
    try { await client.query("ROLLBACK"); } catch { /* already aborted */ }
    client.release();
  }
});

test("6. the database rejects a place governing a place", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  await assert.rejects(
    pool.query(
      `INSERT INTO earthroot_assertions
         (assertion_id, dataset_id, subject_resource_id, subject_entity_type, predicate,
          object_resource_id, object_entity_type, object_literal, name_type,
          temporal_mode, certainty, review_state, dispute_state, assertion_status,
          derivation, assertion_order)
       VALUES ('pa-bad-type',$1,'p-city','place','governed_by','p-district','place',NULL,NULL,
               'not_asserted','source-bounded','unreviewed','not_disputed','active','directly_sourced',98)`,
      [DATASET],
    ),
    /ck_earthroot_predicate_typing/iu,
  );
});

test("7. the database rejects not_asserted carrying year bounds", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  await assert.rejects(
    pool.query(
      `INSERT INTO earthroot_assertions
         (assertion_id, dataset_id, subject_resource_id, subject_entity_type, predicate,
          object_resource_id, object_entity_type, object_literal, name_type,
          temporal_mode, valid_from_year, certainty, review_state, dispute_state,
          assertion_status, derivation, assertion_order)
       VALUES ('pa-bad-time',$1,'p-city','place','classified_as',NULL,NULL,'x',NULL,
               'not_asserted',1000,'source-bounded','unreviewed','not_disputed','active','directly_sourced',97)`,
      [DATASET],
    ),
    /ck_earthroot_not_asserted_is_empty/iu,
  );
});

test("8. the database rejects inverted interval bounds", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  await assert.rejects(
    pool.query(
      `INSERT INTO earthroot_assertions
         (assertion_id, dataset_id, subject_resource_id, subject_entity_type, predicate,
          object_resource_id, object_entity_type, object_literal, name_type,
          temporal_mode, valid_from_year, valid_until_year, certainty, review_state,
          dispute_state, assertion_status, derivation, assertion_order)
       VALUES ('pa-inverted',$1,'p-city','place','governed_by','g-polity-a','polity',NULL,NULL,
               'asserted',1200,1100,'source-bounded','unreviewed','not_disputed','active','directly_sourced',96)`,
      [DATASET],
    ),
    /ck_earthroot_temporal_bounds_ordered/iu,
  );
});

test("9. a non-UUID canonicalPublicId is rejected by the database", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  await assert.rejects(
    pool.query(
      `INSERT INTO earthroot_resources (resource_id, dataset_id, entity_type, canonical_public_id)
       VALUES ('p-derived',$1,'place','synthetic-city')`,
      [DATASET],
    ),
    /canonical_public_id/iu,
  );
});

test("10. an unsourced bundle is rejected before any write", () => {
  const unsourced: EarthRootBundle = {
    ...bundle,
    assertions: bundle.assertions.map((a) => ({ ...a, evidence: [] })),
  };
  const violations = validateEarthRootBundle(unsourced);
  assert.ok(violations.some((v) => v.rule === "evidence-required"));
});

test("11. saving an invalid bundle writes nothing", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  await assert.rejects(
    saveEarthRootBundle({
      ...bundle,
      dataset: { ...bundle.dataset, datasetId: "earthroot-invalid-fixture" },
      assertions: bundle.assertions.map((a) => ({ ...a, evidence: [] })),
    }),
    EarthRootStoreError,
  );
  const counts = await getEarthRootCounts("earthroot-invalid-fixture");
  assert.equal(counts.datasets, 0);
});

test("12. released 14A and 14B rows are untouched by EarthRoot work", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  const a = await pool.query<{ r: number; l: number; e: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM cross_root_resources WHERE dataset_id=$1) r,
       (SELECT COUNT(*)::int FROM cross_root_links WHERE dataset_id=$1) l,
       (SELECT COUNT(*)::int FROM cross_root_link_evidence WHERE dataset_id=$1) e`,
    ["sourceroot-cross-root-lexical-evidence-v1"],
  );
  assert.deepEqual(a.rows[0], { r: 1568, l: 2233, e: 2765 });
  const b = await pool.query<{ asr: number; ev: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM cross_root_relationship_assertions WHERE dataset_id=$1) asr,
       (SELECT COUNT(*)::int FROM cross_root_relationship_evidence WHERE dataset_id=$1) ev`,
    ["sourceroot-cross-root-source-backed-relationships-v1"],
  );
  assert.deepEqual(b.rows[0], { asr: 143, ev: 178 });
});

test("13. no EarthRoot row leaked into the cross-Root registry", async (t) => {
  if (!databaseAvailable) return t.skip("no database configured");
  const pool = getPool()!;
  const rows = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int n FROM cross_root_resources WHERE root_id = 'EarthRoot'`,
  );
  assert.equal(rows.rows[0]!.n, 0, "Chunk 15A inserts no EarthRoot cross-Root resource");
});
