import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  buildDictionaryRootLexicalEvidenceFixture,
  buildLexicalEvidenceInventory,
  buildLexicalEvidenceQualityReview,
  serializeDeterministic,
} from "../src/dictionaryroot/lexical-evidence-fixture.js";
import {
  DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID,
  DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_TITLE,
  type DictionaryRootLexicalEvidenceFixture,
} from "../src/dictionaryroot/lexical-evidence-types.js";
import { closeDatabase, getPool } from "../src/lib/database.js";
import {
  getLexicalEvidenceFixtureCounts,
  saveDictionaryRootLexicalEvidenceFixture,
} from "../src/services/lexical-evidence-store.js";
import { generateLexicalEvidenceFixture } from
  "../src/scripts/generate-dictionaryroot-lexical-evidence-fixture.js";

const fixtureRoot = new URL(
  "../data/dictionaryroot-lexical-evidence-architecture-fixture-v1/",
  import.meta.url,
);
const app = createApp();

function database() {
  const pool = getPool();
  if (!pool) throw new Error("Lexical architecture tests require DATABASE_URL.");
  return pool;
}

after(async () => {
  await closeDatabase();
});

test("1. fixture identity is explicit and never claims production corpus status", () => {
  const fixture = buildDictionaryRootLexicalEvidenceFixture();
  assert.equal(fixture.dataset.datasetId,
    DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID);
  assert.equal(fixture.dataset.title,
    DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_TITLE);
  assert.equal(fixture.dataset.fixtureOnly, true);
  assert.doesNotMatch(JSON.stringify(fixture), /Core Lexical Corpus v1/u);
});

test("2. bounded fixture exercises required lexical cases", () => {
  const fixture = buildDictionaryRootLexicalEvidenceFixture();
  const review = buildLexicalEvidenceQualityReview(fixture);
  assert.ok(fixture.lemmas.length >= 8 && fixture.lemmas.length <= 15);
  for (const values of Object.values(review.cases)) assert.ok(values.length > 0);
  assert.equal(review.productionCorpusGenerated, false);
});

test("3. fixture quality has zero blockers, orphans, duplicates, and unsupported claims", () => {
  const review = buildLexicalEvidenceQualityReview(
    buildDictionaryRootLexicalEvidenceFixture(),
  );
  assert.equal(review.blockerCount, 0);
  assert.deepEqual(new Set(Object.values(review.orphanCounts)), new Set([0]));
  assert.deepEqual(
    new Set(Object.values(review.duplicateIdentityCounts)),
    new Set([0]),
  );
  assert.deepEqual(new Set(Object.values(review.unsupportedCounts)), new Set([0]));
});

test("4. committed generated artifacts equal the generator model", async () => {
  const fixture = buildDictionaryRootLexicalEvidenceFixture();
  const expected = {
    "fixture.json": serializeDeterministic(fixture),
    "inventory.json": serializeDeterministic(buildLexicalEvidenceInventory(fixture)),
    "quality-review.json": serializeDeterministic(
      buildLexicalEvidenceQualityReview(fixture),
    ),
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(await readFile(new URL(name, fixtureRoot), "utf8"), value, name);
  }
});

test("5. two independent generations are byte-identical to repository artifacts", async () => {
  const first = await mkdtemp(path.join(tmpdir(), "dr-lexical-first-"));
  const second = await mkdtemp(path.join(tmpdir(), "dr-lexical-second-"));
  try {
    await generateLexicalEvidenceFixture(first);
    await generateLexicalEvidenceFixture(second);
    for (const name of ["fixture.json", "inventory.json", "quality-review.json"]) {
      const [left, right, repository] = await Promise.all([
        readFile(path.join(first, name)),
        readFile(path.join(second, name)),
        readFile(new URL(name, fixtureRoot)),
      ]);
      assert.equal(left.length, right.length);
      assert.equal(left.length, repository.length);
      assert.equal(createHash("sha256").update(left).digest("hex"),
        createHash("sha256").update(right).digest("hex"));
      assert.deepEqual(left, right);
      assert.deepEqual(left, repository);
      assert.equal(left.at(-1), 10);
    }
  } finally {
    await rm(first, { recursive: true, force: true });
    await rm(second, { recursive: true, force: true });
  }
});

test("6. migration 013 builds all normalized tables in an isolated fresh schema", async () => {
  const migration = await readFile(new URL(
    "../db/migrations/013_create_dictionaryroot_lexical_evidence.sql",
    import.meta.url,
  ), "utf8");
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA lexical_evidence_fresh_test");
    await client.query("SET LOCAL search_path TO lexical_evidence_fresh_test");
    await client.query(migration);
    const result = await client.query<{ count: number }>(
      `SELECT COUNT(*)::INTEGER AS count FROM information_schema.tables
       WHERE table_schema='lexical_evidence_fresh_test'
         AND table_name LIKE 'dictionaryroot_lexical%'`,
    );
    assert.equal(result.rows[0]?.count, 12);
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

test("7. migration ledger ends at exact migration 013", async () => {
  const result = await database().query<{ migration_name: string }>(
    `SELECT migration_name FROM schema_migrations
     WHERE migration_name LIKE '013%' OR migration_name LIKE '014%'
     ORDER BY migration_name`,
  );
  assert.deepEqual(result.rows.map((row) => row.migration_name),
    ["013_create_dictionaryroot_lexical_evidence.sql"]);
});

test("8. fixture import and duplicate reimport are replacement-safe", async () => {
  const fixture = buildDictionaryRootLexicalEvidenceFixture();
  await saveDictionaryRootLexicalEvidenceFixture(fixture);
  const first = await getLexicalEvidenceFixtureCounts();
  await saveDictionaryRootLexicalEvidenceFixture(fixture);
  assert.deepEqual(await getLexicalEvidenceFixtureCounts(), first);
  assert.deepEqual(first, {
    datasets: 1,
    lemmas: 10,
    senses: 16,
    definitionClaims: 22,
    forms: 10,
    etymologyProposals: 4,
    sourceComparisons: 4,
    locators: 40,
    fieldProvenance: 72,
  });
});

test("9. failed replacement rolls back to the accepted fixture", async () => {
  const broken = buildDictionaryRootLexicalEvidenceFixture();
  broken.sources.push(structuredClone(broken.sources[0]!));
  await assert.rejects(saveDictionaryRootLexicalEvidenceFixture(broken));
  assert.equal((await getLexicalEvidenceFixtureCounts()).lemmas, 10);
});

test("10. fixture import leaves HistoryRoot and legacy DictionaryRoot data unchanged", async () => {
  const result = await database().query<{
    history_version: string;
    lexical_datasets: number;
  }>(
    `SELECT
      (SELECT version FROM imported_bundles
       WHERE bundle_id='historyroot-plymouth-knowledge-dataset-v1')
       AS history_version,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexicon_datasets)
       AS lexical_datasets`,
  );
  assert.equal(result.rows[0]?.history_version, "1.3.0");
  assert.equal(result.rows[0]?.lexical_datasets, 0);
});

test("11. paginated lexical evidence search is deterministic and bounded", async () => {
  const first = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/search")
    .query({ q: "bank", page: 1, limit: 2 }).expect(200);
  const second = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/search")
    .query({ q: "bank", page: 2, limit: 2 }).expect(200);
  assert.equal(first.body.total, 3);
  assert.equal(first.body.totalPages, 2);
  assert.equal(first.body.items.length, 2);
  assert.equal(second.body.items.length, 1);
  assert.notEqual(first.body.items[0].senseId, second.body.items[0].senseId);
});

test("12. sense detail keeps claims, forms, locators, and provenance inspectable", async () => {
  const response = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/senses/lex-sense-bank-finance")
    .expect(200);
  assert.equal(response.body.claims.length, 2);
  assert.ok(response.body.forms.length >= 1);
  assert.ok(response.body.locators.length >= 2);
  assert.ok(response.body.fieldProvenance.length >= 4);
  assert.notEqual(response.body.claims[0].exactWording,
    response.body.claims[1].exactWording);
});

test("13. competing etymologies and uncertainty remain distinct", async () => {
  const response = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/senses/lex-sense-island-land")
    .expect(200);
  assert.equal(response.body.etymologyProposals.length, 2);
  assert.ok(response.body.etymologyProposals.some((item: Row) =>
    item.confidence === "uncertain"));
  assert.ok(response.body.etymologyProposals.every((item: Row) =>
    Array.isArray(item.competingProposalIds)));
});

type Row = Record<string, unknown>;

test("14. comparisons expose reviewed decisions without an authoritative score", async () => {
  const response = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/senses/lex-sense-bank-river")
    .expect(200);
  assert.equal(response.body.comparisons[0].comparisonType, "broader_definition");
  assert.equal(response.body.comparisons[0].reviewStatus, "reviewed");
  assert.equal(response.body.comparisons[0].similarityScore, undefined);
});

test("15. resource contracts return explicit empty states and stable ordering", async () => {
  const populated = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/objects/lex-sense-bank-finance/claims")
    .expect(200);
  const empty = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/objects/not-present/claims")
    .expect(200);
  assert.equal(populated.body.total, 2);
  assert.deepEqual(populated.body.items.map((item: Row) => item.claimId),
    [...populated.body.items].map((item: Row) => item.claimId).sort());
  assert.deepEqual(empty.body, { total: 0, items: [] });
});

test("16. malformed pagination is rejected", async () => {
  await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/search")
    .query({ q: "bank", page: 0, limit: 500 }).expect(400);
});

test("17. fixture artifact can be parsed as the public typed contract", async () => {
  const parsed = JSON.parse(await readFile(
    new URL("fixture.json", fixtureRoot), "utf8",
  )) as DictionaryRootLexicalEvidenceFixture;
  assert.equal(parsed.schemaVersion, "1.0.0");
  assert.equal(parsed.dataset.fixtureOnly, true);
});
