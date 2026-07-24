import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { getPool } from "../src/lib/database.js";
import { validateBundle } from "../src/services/validator.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

const app = createApp();
const fixtureUrl = new URL(
  "./fixtures/contextual-historyroot-valid.json",
  import.meta.url,
);
const legacyFixtureUrl = new URL(
  "./fixtures/historyroot-valid.json",
  import.meta.url,
);

function requireImportServiceToken(): string {
  const token = process.env.IMPORT_SERVICE_TOKEN;

  if (!token) {
    throw new Error(
      "Contextual tests require IMPORT_SERVICE_TOKEN in .env.test.",
    );
  }

  return token;
}

function authorizedImportRequest() {
  return request(app)
    .post("/api/v1/import")
    .set(
      "x-sourceroot-import-token",
      requireImportServiceToken(),
    );
}

function authorizedDelete(bundleId: string) {
  return request(app)
    .delete(`/api/v1/import/${bundleId}`)
    .set(
      "x-sourceroot-import-token",
      requireImportServiceToken(),
    );
}

async function readFixture(
  url = fixtureUrl,
): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(url, "utf8"),
  ) as Record<string, unknown>;
}

async function importFixture(
  bundle?: Record<string, unknown>,
) {
  return authorizedImportRequest()
    .send(bundle ?? await readFixture())
    .expect("Content-Type", /json/)
    .expect(201);
}

function getContext(
  bundle: Record<string, unknown>,
): Record<string, unknown> {
  const context = bundle.context;

  if (
    typeof context !== "object"
    || context === null
    || Array.isArray(context)
  ) {
    throw new Error("Fixture context object is missing.");
  }

  return context as Record<string, unknown>;
}

function getContextArray(
  bundle: Record<string, unknown>,
  field: string,
): Array<Record<string, unknown>> {
  const value = getContext(bundle)[field];

  if (!Array.isArray(value)) {
    throw new Error(`Fixture context.${field} array is missing.`);
  }

  return value as Array<Record<string, unknown>>;
}

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("contextual Zod validation accepts the technical fixture", async () => {
  const result = validateBundle(await readFixture());

  assert.equal(result.status, "ready");
  assert.equal(result.canImport, true);
  assert.equal(result.summary.contextualRecords, 30);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
});

test("existing bundles remain valid when context is omitted", async () => {
  const result = validateBundle(
    await readFixture(legacyFixtureUrl),
  );

  assert.equal(result.canImport, true);
  assert.equal(result.summary.contextualRecords, undefined);
  assert.equal(result.errors.length, 0);
});

test("invalid contextual structures and references block import", async () => {
  const bundle = await readFixture();
  const temporal = getContextArray(
    bundle,
    "temporalAssertions",
  )[4];
  const claims = getContextArray(bundle, "claims");

  if (!temporal || !claims[0]) {
    throw new Error("Fixture records required by validation test are missing.");
  }

  delete temporal.exactDate;
  claims[0].id = "ctx-person-mara-quill";
  claims[0].subjectId = "ctx-does-not-exist";

  const result = validateBundle(bundle);

  assert.equal(result.canImport, false);
  assert.ok(
    result.errors.some(
      (item) => item.code === "INVALID_CONTEXTUAL_STRUCTURE",
    ),
  );

  temporal.exactDate = "1894-05-11";
  const referenceResult = validateBundle(bundle);

  assert.ok(
    referenceResult.errors.some(
      (item) => item.code === "DUPLICATE_CONTEXT_ID",
    ),
  );
  assert.ok(
    referenceResult.errors.some(
      (item) => item.code === "CONTEXT_SUBJECT_NOT_FOUND",
    ),
  );

  await authorizedImportRequest()
    .send(bundle)
    .expect(422);
});

test("valid contextual import populates every normalized structure", async () => {
  const response = await importFixture();

  assert.equal(response.body.validation.summary.contextualRecords, 30);

  const pool = getPool();

  if (!pool) {
    throw new Error("Test database is not configured.");
  }

  const result = await pool.query<Record<string, string>>(`
    SELECT
      (SELECT COUNT(*) FROM context_records) AS records,
      (SELECT COUNT(*) FROM context_entities) AS entities,
      (SELECT COUNT(*) FROM context_temporal_assertions) AS temporal,
      (SELECT COUNT(*) FROM context_accounts) AS accounts,
      (SELECT COUNT(*) FROM context_claims) AS claims,
      (SELECT COUNT(*) FROM context_evidence) AS evidence,
      (SELECT COUNT(*) FROM context_interpretations) AS interpretations,
      (SELECT COUNT(*) FROM context_perspectives) AS perspectives,
      (SELECT COUNT(*) FROM context_record_perspectives) AS perspective_links,
      (SELECT COUNT(*) FROM context_causal_links) AS causal_links,
      (SELECT COUNT(*) FROM context_relationships) AS relationships,
      (SELECT COUNT(*) FROM context_cultural_memories) AS cultural_memories,
      (SELECT COUNT(*) FROM context_record_sources) AS source_links;
  `);
  const counts = result.rows[0];

  assert.ok(counts);
  assert.equal(Number(counts.records), 30);
  assert.equal(Number(counts.entities), 10);
  assert.equal(Number(counts.temporal), 5);
  assert.equal(Number(counts.accounts), 1);
  assert.equal(Number(counts.claims), 2);
  assert.equal(Number(counts.evidence), 2);
  assert.equal(Number(counts.interpretations), 1);
  assert.equal(Number(counts.perspectives), 2);
  assert.equal(Number(counts.perspective_links), 2);
  assert.equal(Number(counts.causal_links), 2);
  assert.equal(Number(counts.relationships), 4);
  assert.equal(Number(counts.cultural_memories), 1);
  assert.ok(Number(counts.source_links) >= 10);
});

test("contextual import failure rolls back the complete bundle", async () => {
  const originalBundle = await readFixture();
  await importFixture(originalBundle);

  const replacementJson = JSON.stringify(originalBundle)
    .replaceAll(
      "ctx-source-field-log",
      "ctx-rollback-source-field-log",
    )
    .replaceAll(
      "ctx-source-later-summary",
      "ctx-rollback-source-later-summary",
    );
  const conflictingBundle = JSON.parse(
    replacementJson,
  ) as Record<string, unknown>;
  conflictingBundle.bundleId =
    "sourceroot-integration-test-contextual-rollback";

  assert.equal(validateBundle(conflictingBundle).canImport, true);

  await authorizedImportRequest()
    .send(conflictingBundle)
    .expect(500);

  const pool = getPool();

  if (!pool) {
    throw new Error("Test database is not configured.");
  }

  const result = await pool.query<{
    bundles: string;
    sources: string;
    context_records: string;
    conflicting_bundles: string;
    conflicting_sources: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM imported_bundles) AS bundles,
      (SELECT COUNT(*) FROM sources) AS sources,
      (SELECT COUNT(*) FROM context_records) AS context_records,
      (
        SELECT COUNT(*)
        FROM imported_bundles
        WHERE bundle_id =
          'sourceroot-integration-test-contextual-rollback'
      ) AS conflicting_bundles,
      (
        SELECT COUNT(*)
        FROM sources
        WHERE source_id LIKE 'ctx-rollback-source-%'
      ) AS conflicting_sources;
  `);
  const counts = result.rows[0];

  assert.ok(counts);
  assert.equal(Number(counts.bundles), 1);
  assert.equal(Number(counts.sources), 2);
  assert.equal(Number(counts.context_records), 30);
  assert.equal(Number(counts.conflicting_bundles), 0);
  assert.equal(Number(counts.conflicting_sources), 0);
});

test("re-import replaces only contextual records owned by the bundle", async () => {
  const bundle = await readFixture();

  await importFixture(bundle);

  const memories = getContextArray(bundle, "culturalMemories");
  memories.splice(0, memories.length);
  const person = getContextArray(bundle, "entities")[0];

  if (!person) {
    throw new Error("Fixture person is missing.");
  }

  person.label = "Mara Quill (updated)";
  person.name = "Mara Quill (updated)";

  await importFixture(bundle);

  const pool = getPool();

  if (!pool) {
    throw new Error("Test database is not configured.");
  }

  const result = await pool.query<{
    records: string;
    memories: string;
    label: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM context_records) AS records,
      (SELECT COUNT(*) FROM context_cultural_memories) AS memories,
      (
        SELECT label
        FROM context_records
        WHERE context_id = 'ctx-person-mara-quill'
      ) AS label;
  `);
  const values = result.rows[0];

  assert.ok(values);
  assert.equal(Number(values.records), 29);
  assert.equal(Number(values.memories), 0);
  assert.equal(values.label, "Mara Quill (updated)");
});

test("context entity APIs support bundle, domain, type, source, status, and pagination filters", async () => {
  await importFixture();

  const filtered = await request(app)
    .get(
      "/api/v1/context/entities?bundleId=sourceroot-integration-test-contextual-foundation&domain=HistoryRoot&entityType=event&status=fixture&page=1&limit=2",
    )
    .expect(200);

  assert.equal(filtered.body.page, 1);
  assert.equal(filtered.body.limit, 2);
  assert.equal(filtered.body.total, 5);
  assert.equal(filtered.body.items.length, 2);
  assert.ok(
    filtered.body.items.every(
      (item: { entityType: string }) => item.entityType === "event",
    ),
  );

  const secondPage = await request(app)
    .get(
      "/api/v1/context/entities?entityType=event&page=2&limit=2",
    )
    .expect(200);

  assert.equal(secondPage.body.page, 2);
  assert.equal(secondPage.body.items.length, 2);

  const sourceFiltered = await request(app)
    .get(
      "/api/v1/context/entities?sourceId=ctx-source-field-log",
    )
    .expect(200);

  assert.ok(sourceFiltered.body.total >= 1);
  assert.ok(
    sourceFiltered.body.items.every(
      (item: { sourceIds: string[] }) =>
        item.sourceIds.includes("ctx-source-field-log"),
    ),
  );
});

test("stable contextual IDs resolve through typed and universal routes", async () => {
  await importFixture();

  const typed = await request(app)
    .get("/api/v1/context/entities/ctx-person-mara-quill")
    .expect(200);
  const universal = await request(app)
    .get("/api/v1/context/records/ctx-person-mara-quill")
    .expect(200);

  assert.equal(typed.body.id, "ctx-person-mara-quill");
  assert.equal(typed.body.recordKind, "entity");
  assert.equal(universal.body.id, typed.body.id);
  assert.equal(universal.body.bundleId, typed.body.bundleId);

  await request(app)
    .get("/api/v1/context/claims/ctx-person-mara-quill")
    .expect(404);
});

test("temporal APIs preserve approximate, range, disputed, and unknown dates", async () => {
  await importFixture();

  const approximate = await request(app)
    .get(
      "/api/v1/context/temporal-assertions?temporalKind=approximate",
    )
    .expect(200);
  assert.equal(approximate.body.total, 1);
  assert.equal(
    approximate.body.items[0].dateLabel,
    "Around mid-May 1894",
  );
  assert.equal(
    approximate.body.items[0].startUncertainty,
    "Possibly two days earlier",
  );

  const range = await request(app)
    .get(
      "/api/v1/context/temporal-assertions?dateFrom=1892-01-01&dateTo=1893-12-31",
    )
    .expect(200);
  assert.equal(range.body.total, 1);
  assert.equal(range.body.items[0].temporalKind, "range");

  const disputed = await request(app)
    .get(
      "/api/v1/context/temporal-assertions?temporalKind=disputed",
    )
    .expect(200);
  assert.equal(disputed.body.items[0].proposedDates.length, 2);

  const unknown = await request(app)
    .get(
      "/api/v1/context/temporal-assertions?temporalKind=unknown",
    )
    .expect(200);
  assert.equal(unknown.body.total, 1);
  assert.equal(unknown.body.items[0].dateLabel, "Date unknown");
});

test("relationship APIs expose event hierarchy, parallel events, participation, and source contradiction", async () => {
  await importFixture();

  for (
    const [relationshipType, expectedId]
    of [
      ["parent_event", "ctx-relationship-event-hierarchy"],
      ["parallel_event", "ctx-relationship-parallel-events"],
      ["event_participation", "ctx-relationship-participation"],
      [
        "source_contradiction",
        "ctx-relationship-source-contradiction",
      ],
    ]
  ) {
    const response = await request(app)
      .get(
        `/api/v1/context/relationships?relationshipType=${relationshipType}`,
      )
      .expect(200);

    assert.equal(response.body.total, 1);
    assert.equal(response.body.items[0].id, expectedId);
  }
});

test("account, claim, evidence, counterevidence, perspective, interpretation, cause, consequence, and memory APIs remain distinct", async () => {
  await importFixture();

  const expectations = [
    ["/api/v1/context/accounts", "account", 1],
    ["/api/v1/context/claims", "claim", 2],
    [
      "/api/v1/context/evidence?evidenceType=evidence",
      "evidence",
      1,
    ],
    [
      "/api/v1/context/evidence?evidenceType=counterevidence",
      "evidence",
      1,
    ],
    ["/api/v1/context/perspectives", "perspective", 2],
    ["/api/v1/context/interpretations", "interpretation", 1],
    [
      "/api/v1/context/causes-consequences?causalKind=cause",
      "causal_link",
      1,
    ],
    [
      "/api/v1/context/causes-consequences?causalKind=consequence",
      "causal_link",
      1,
    ],
    [
      "/api/v1/context/cultural-memories",
      "cultural_memory",
      1,
    ],
  ] as const;

  for (const [path, recordKind, total] of expectations) {
    const response = await request(app)
      .get(path)
      .expect(200);

    assert.equal(response.body.total, total);
    assert.ok(
      response.body.items.every(
        (item: { recordKind: string }) =>
          item.recordKind === recordKind,
      ),
    );
  }

  const interpretation = await request(app)
    .get(
      "/api/v1/context/interpretations/ctx-interpretation-survey-practice",
    )
    .expect(200);
  assert.equal(interpretation.body.publishedConclusion, false);
});

test("SourceRoot search discovers contextual entities, accounts, claims, interpretations, and relationships", async () => {
  await importFixture();

  const response = await request(app)
    .get(
      "/api/v1/search?q=observation&domain=HistoryRoot&limit=100",
    )
    .expect(200);
  const types = new Set(
    response.body.results.map(
      (item: { resultType: string }) => item.resultType,
    ),
  );

  assert.ok(types.has("context-entity"));
  assert.ok(types.has("context-account"));
  assert.ok(types.has("context-claim"));
  assert.ok(types.has("context-interpretation"));
  assert.ok(types.has("context-relationship"));

  const relationshipOnly = await request(app)
    .get(
      "/api/v1/search?q=parallel&type=context-relationship",
    )
    .expect(200);

  assert.equal(relationshipOnly.body.total, 1);
  assert.equal(
    relationshipOnly.body.results[0].resultType,
    "context-relationship",
  );
});

test("integration-test bundle deletion removes contextual records", async () => {
  const bundle = await readFixture();
  const bundleId = String(bundle.bundleId);

  await importFixture(bundle);
  await authorizedDelete(bundleId)
    .expect(200);

  const pool = getPool();

  if (!pool) {
    throw new Error("Test database is not configured.");
  }

  const result = await pool.query<{
    records: string;
    perspective_links: string;
    source_links: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM context_records) AS records,
      (
        SELECT COUNT(*)
        FROM context_record_perspectives
      ) AS perspective_links,
      (
        SELECT COUNT(*)
        FROM context_record_sources
      ) AS source_links;
  `);
  const counts = result.rows[0];

  assert.ok(counts);
  assert.equal(Number(counts.records), 0);
  assert.equal(Number(counts.perspective_links), 0);
  assert.equal(Number(counts.source_links), 0);
});

test("contextual relationship endpoints enforce foreign-key integrity", async () => {
  await importFixture();

  const pool = getPool();

  if (!pool) {
    throw new Error("Test database is not configured.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO context_records (
          context_id,
          bundle_id,
          record_kind,
          domain,
          label,
          raw_data
        )
        VALUES (
          'ctx-invalid-relationship',
          'sourceroot-integration-test-contextual-foundation',
          'relationship',
          'HistoryRoot',
          'Invalid relationship',
          '{}'::JSONB
        );
      `,
    );

    await client.query(
      `
          INSERT INTO context_relationships (
            context_id,
            from_context_id,
            to_context_id,
            relationship_type
          )
          VALUES (
            'ctx-invalid-relationship',
            'ctx-person-mara-quill',
            'ctx-missing-endpoint',
            'test_relationship'
          );
      `,
    );

    await assert.rejects(
      client.query("SET CONSTRAINTS ALL IMMEDIATE"),
      /foreign key|fk_context_relationships_to/i,
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("DictionaryRoot exact-sense search remains complete and ranked before contextual results", async () => {
  const bundle = await readFixture();
  const person = getContextArray(bundle, "entities")[0];

  if (!person) {
    throw new Error("Fixture person is missing.");
  }

  person.label = "Bank";
  person.name = "Bank";
  await importFixture(bundle);

  const pool = getPool();

  if (!pool) {
    throw new Error("Test database is not configured.");
  }

  await pool.query(`
    INSERT INTO dictionaryroot_lexicon_datasets (
      dataset_id,
      bundle_id,
      source_id,
      source_name,
      source_version,
      source_license,
      synset_count,
      lemma_count,
      relation_count,
      part_of_speech_counts
    )
    VALUES (
      'ctx-exact-regression-dataset',
      'dictionaryroot-exact-regression',
      'ctx-exact-regression-source',
      'Exact regression fixture',
      'test',
      'test fixture',
      2,
      1,
      0,
      '{"noun":2}'::JSONB
    );

    INSERT INTO dictionaryroot_lexicon_synsets (
      node_id,
      dataset_id,
      bundle_id,
      source_id,
      source_version,
      source_synset_key,
      source_offset,
      part_of_speech,
      title,
      definition,
      synset_type,
      lexicographer_file_number,
      lemmas,
      normalized_lemmas,
      examples,
      original_gloss
    )
    VALUES
      (
        'ctx-exact-bank-1',
        'ctx-exact-regression-dataset',
        'dictionaryroot-exact-regression',
        'ctx-exact-regression-source',
        'test',
        'noun:ctx-exact-bank-1',
        '00000001',
        'noun',
        'bank',
        'First exact test sense.',
        'noun',
        1,
        ARRAY['bank'],
        ARRAY['bank'],
        ARRAY[]::TEXT[],
        'First exact test sense.'
      ),
      (
        'ctx-exact-bank-2',
        'ctx-exact-regression-dataset',
        'dictionaryroot-exact-regression',
        'ctx-exact-regression-source',
        'test',
        'noun:ctx-exact-bank-2',
        '00000002',
        'noun',
        'bank',
        'Second exact test sense.',
        'noun',
        1,
        ARRAY['bank'],
        ARRAY['bank'],
        ARRAY[]::TEXT[],
        'Second exact test sense.'
      );
  `);

  const response = await request(app)
    .get("/api/v1/search?q=bank&limit=10")
    .expect(200);

  assert.equal(response.body.exactSensePolicy, "complete-lemma");
  assert.equal(response.body.coverage.exactSenseCount, 2);
  assert.deepEqual(
    response.body.results.slice(0, 2).map(
      (item: { id: string }) => item.id,
    ),
    ["ctx-exact-bank-1", "ctx-exact-bank-2"],
  );
  assert.ok(
    response.body.results.some(
      (item: { resultType: string; id: string }) =>
        item.resultType === "context-entity"
        && item.id === "ctx-person-mara-quill",
    ),
  );
});
