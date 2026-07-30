import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  buildDictionaryRootLexicalEvidenceFixture,
  buildLexicalEvidenceInventory,
  buildLexicalEvidenceQualityReview,
} from "../src/dictionaryroot/lexical-evidence-fixture.js";
import { closeDatabase, getPool } from "../src/lib/database.js";
import {
  getLexicalEvidenceFixtureCounts,
  saveDictionaryRootLexicalEvidenceFixture,
} from "../src/services/lexical-evidence-store.js";

const app = createApp();

function database() {
  const pool = getPool();
  if (!pool) throw new Error("Relationship architecture tests require DATABASE_URL.");
  return pool;
}

after(async () => {
  await closeDatabase();
});

test("1. migration 014 creates normalized relationship tables in a fresh schema", async () => {
  const [migration013, migration014] = await Promise.all([
    readFile(new URL(
      "../db/migrations/013_create_dictionaryroot_lexical_evidence.sql",
      import.meta.url,
    ), "utf8"),
    readFile(new URL(
      "../db/migrations/014_create_dictionaryroot_lexical_relationships.sql",
      import.meta.url,
    ), "utf8"),
  ]);
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA lexical_relationship_fresh_test");
    await client.query("SET LOCAL search_path TO lexical_relationship_fresh_test");
    await client.query(migration013);
    await client.query(migration014);
    const tables = await client.query<{ count: number }>(
      `SELECT COUNT(*)::INTEGER AS count FROM information_schema.tables
       WHERE table_schema='lexical_relationship_fresh_test'
         AND table_name LIKE 'dictionaryroot_lexical%'`,
    );
    const types = await client.query<{ count: number }>(
      "SELECT COUNT(*)::INTEGER AS count FROM dictionaryroot_lexical_relationship_types",
    );
    assert.equal(tables.rows[0]?.count, 15);
    assert.equal(types.rows[0]?.count, 13);
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

test("2. migration ledger ends at 014 and migration 015 is absent", async () => {
  const result = await database().query<{ migration_name: string }>(
    `SELECT migration_name FROM schema_migrations
     WHERE migration_name LIKE '014%' OR migration_name LIKE '015%'
     ORDER BY migration_name`,
  );
  assert.deepEqual(result.rows.map((row) => row.migration_name),
    ["014_create_dictionaryroot_lexical_relationships.sql"]);
});

test("3. bounded fixture covers canonical types and evidence", () => {
  const fixture = buildDictionaryRootLexicalEvidenceFixture();
  const inventory = buildLexicalEvidenceInventory(fixture);
  const review = buildLexicalEvidenceQualityReview(fixture);
  assert.equal(fixture.relationships.length, 12);
  assert.equal(fixture.relationshipEvidence.length, 13);
  assert.equal(inventory.counts.relationships, 12);
  assert.equal(review.blockerCount, 0);
  for (const type of [
    "broader", "narrower", "substantially_equivalent", "related",
    "derivationally_related", "historical_predecessor",
    "technical_specialization", "generalization", "translation_related",
    "disputed", "unresolved",
  ]) {
    assert.ok(fixture.relationships.some((item) =>
      item.relationshipType === type), type);
  }
});

test("4. symmetric relationships reject reverse ordering and self-links", async () => {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(client.query(
      `INSERT INTO dictionaryroot_lexical_relationships
        (relationship_id, dataset_id, source_sense_id, target_sense_id,
         relationship_type, directionality, relationship_status, review_status)
       VALUES ('test-reverse', $1, 'lex-sense-connection-link',
         'lex-sense-algorithm-procedure', 'related', 'symmetric',
         'asserted', 'reviewed')`,
      ["dictionaryroot-lexical-evidence-architecture-fixture-v1"],
    ));
    await client.query("ROLLBACK");
    await client.query("BEGIN");
    await assert.rejects(client.query(
      `INSERT INTO dictionaryroot_lexical_relationships
        (relationship_id, dataset_id, source_sense_id, target_sense_id,
         relationship_type, directionality, relationship_status, review_status)
       VALUES ('test-self', $1, 'lex-sense-bank-finance',
         'lex-sense-bank-finance', 'related', 'symmetric',
         'asserted', 'reviewed')`,
      ["dictionaryroot-lexical-evidence-architecture-fixture-v1"],
    ));
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
});

test("5. dataset ownership prevents cross-dataset sense endpoints", async () => {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO dictionaryroot_lexical_evidence_datasets
       (dataset_id,bundle_id,title,version,status,rights_summary,fixture_only)
       VALUES ('relationship-other-fixture','relationship-other-fixture',
         'Other fixture','1.0.0','fixture','test',TRUE)`,
    );
    await client.query(
      `INSERT INTO dictionaryroot_lexical_senses
       (sense_id,dataset_id,part_of_speech,lexical_category,status,review_status)
       VALUES ('other-sense','relationship-other-fixture','noun','test',
         'fixture-reviewed','reviewed')`,
    );
    await assert.rejects(client.query(
      `INSERT INTO dictionaryroot_lexical_relationships
       (relationship_id,dataset_id,source_sense_id,target_sense_id,
        relationship_type,directionality,relationship_status,review_status)
       VALUES ('test-cross-dataset',$1,'lex-sense-bank-finance','other-sense',
         'broader','directional','asserted','reviewed')`,
      ["dictionaryroot-lexical-evidence-architecture-fixture-v1"],
    ));
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
});

test("6. every canonical relationship has inspectable structured evidence", async () => {
  const result = await database().query<{ unsupported: number }>(
    `SELECT COUNT(*)::INTEGER AS unsupported
     FROM dictionaryroot_lexical_relationships relationship
     WHERE NOT EXISTS (
       SELECT 1 FROM dictionaryroot_lexical_relationship_evidence evidence
       WHERE evidence.relationship_id=relationship.relationship_id
         AND evidence.provenance_identity <> ''
         AND (evidence.dataset_record_id IS NOT NULL
           OR evidence.stable_fragment IS NOT NULL)
     )`,
  );
  assert.equal(result.rows[0]?.unsupported, 0);
});

test("7. replacement and duplicate reimport preserve exact relationship counts", async () => {
  const fixture = buildDictionaryRootLexicalEvidenceFixture();
  await saveDictionaryRootLexicalEvidenceFixture(fixture);
  const first = await getLexicalEvidenceFixtureCounts();
  await saveDictionaryRootLexicalEvidenceFixture(fixture);
  assert.deepEqual(await getLexicalEvidenceFixtureCounts(), first);
  assert.equal(first.relationships, 12);
  assert.equal(first.relationshipEvidence, 13);
});

test("8. failed relationship replacement rolls back accepted state", async () => {
  const broken = buildDictionaryRootLexicalEvidenceFixture();
  broken.relationships.push(structuredClone(broken.relationships[0]!));
  await assert.rejects(saveDictionaryRootLexicalEvidenceFixture(broken));
  assert.equal((await getLexicalEvidenceFixtureCounts()).relationships, 12);
});

test("9. relationship detail and multi-source evidence remain separate", async () => {
  const relationshipId = "lex-relationship-algorithm-connection-equivalent";
  const detail = await request(app)
    .get(`/api/v1/dictionaryroot/lexicon/evidence/relationships/${relationshipId}`)
    .expect(200);
  const evidence = await request(app)
    .get(`/api/v1/dictionaryroot/lexicon/evidence/relationships/${relationshipId}/evidence`)
    .expect(200);
  assert.equal(detail.body.relationship_type, "substantially_equivalent");
  assert.equal(detail.body.directionality, "symmetric");
  assert.equal(evidence.body.total, 2);
  assert.equal(new Set(evidence.body.items.map((item: Record<string, unknown>) =>
    item.source_id)).size, 2);
});

test("10. bank graph seed lookup exposes all three distinct senses", async () => {
  const response = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/graph/seeds")
    .query({ q: "bank", page: 1, limit: 10 })
    .expect(200);
  assert.equal(response.body.total, 3);
  assert.equal(new Set(response.body.items.map((item: Record<string, unknown>) =>
    item.nodeId)).size, 3);
  assert.deepEqual(new Set(response.body.items.map((item: Record<string, unknown>) =>
    (item.metadata as Record<string, unknown>).partOfSpeech)),
  new Set(["noun", "verb"]));
});

test("11. graph neighborhood is bounded, deterministic, and duplicate-free", async () => {
  const url = "/api/v1/dictionaryroot/lexicon/evidence/graph/neighborhood/lex-sense-bank-finance";
  const [first, second] = await Promise.all([
    request(app).get(url).query({ depth: 2, limit: 100 }).expect(200),
    request(app).get(url).query({ depth: 2, limit: 100 }).expect(200),
  ]);
  assert.deepEqual(first.body, second.body);
  const nodeIds = first.body.items.map((item: Record<string, unknown>) =>
    (item.node as Record<string, unknown>).nodeId);
  const edgeIds = first.body.edges.map((item: Record<string, unknown>) =>
    item.edgeId);
  assert.equal(new Set(nodeIds).size, nodeIds.length);
  assert.equal(new Set(edgeIds).size, edgeIds.length);
  assert.ok(first.body.items.some((item: Record<string, unknown>) =>
    (item.node as Record<string, unknown>).objectType
      === "lexical-evidence-form"));
  assert.ok(first.body.items.some((item: Record<string, unknown>) =>
    (item.node as Record<string, unknown>).objectType
      === "lexical-evidence-relationship"));
});

test("12. island proposals and logos uncertainty stay distinct in graph reads", async () => {
  const [island, logos] = await Promise.all([
    request(app)
      .get("/api/v1/dictionaryroot/lexicon/evidence/graph/neighborhood/lex-sense-island-land")
      .query({ depth: 2, limit: 100 }).expect(200),
    request(app)
      .get("/api/v1/dictionaryroot/lexicon/evidence/graph/neighborhood/lex-sense-logos-word")
      .query({ depth: 2, limit: 100 }).expect(200),
  ]);
  const islandTypes = island.body.items.map((item: Record<string, unknown>) =>
    (item.node as Record<string, unknown>).objectType);
  assert.equal(islandTypes.filter((value: string) =>
    value === "lexical-evidence-etymology-proposal").length, 2);
  assert.ok(logos.body.items.some((item: Record<string, unknown>) => {
    const metadata = (item.node as Record<string, unknown>).metadata as
      Record<string, unknown>;
    return Boolean(metadata.uncertainty);
  }));
});

test("13. invalid graph bounds and absent evidence return explicit states", async () => {
  await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/graph/neighborhood/lex-sense-bank-finance")
    .query({ depth: 3, limit: 500 }).expect(400);
  const empty = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/relationships/not-present/evidence")
    .expect(200);
  assert.deepEqual(empty.body, {
    page: 1, limit: 25, total: 0, totalPages: 0, items: [],
  });
});

test("14. HistoryRoot and legacy lexicon tables remain untouched", async () => {
  const result = await database().query<{
    history_version: string;
    datasets: number;
    synsets: number;
    relations: number;
  }>(
    `SELECT
      (SELECT version FROM imported_bundles
       WHERE bundle_id='historyroot-plymouth-knowledge-dataset-v1')
        AS history_version,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexicon_datasets) AS datasets,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexicon_synsets) AS synsets,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexicon_relations) AS relations`,
  );
  assert.deepEqual(result.rows[0], {
    history_version: "1.3.0", datasets: 0, synsets: 0, relations: 0,
  });
});

test("15. fixture remains explicitly non-production", () => {
  const fixture = buildDictionaryRootLexicalEvidenceFixture();
  assert.equal(fixture.dataset.fixtureOnly, true);
  assert.doesNotMatch(JSON.stringify(fixture), /Core Lexical Corpus v1/u);
});
