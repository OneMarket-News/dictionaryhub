import assert from "node:assert/strict";
import test, { after } from "node:test";

import { closeDatabase, getPool } from "../src/lib/database.js";

test("normalized knowledge tables exist", async () => {
  const pool = getPool();

  if (!pool) {
    throw new Error(
      "Test database is not configured. Confirm that .env.test contains DATABASE_URL.",
    );
  }

  const expectedTables = [
    "assertion_sources",
    "assertions",
    "context_accounts",
    "context_causal_links",
    "context_claims",
    "context_cultural_memories",
    "context_entities",
    "context_evidence",
    "context_interpretations",
    "context_perspectives",
    "context_record_perspectives",
    "context_record_sources",
    "context_records",
    "context_relationships",
    "context_temporal_assertions",
    "edge_sources",
    "edges",
    "node_sources",
    "nodes",
    "revisions",
    "sources",
  ];

  const result = await pool.query<{
    table_name: string;
  }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name;
    `,
    [expectedTables],
  );

  const actualTables = result.rows.map((row) => row.table_name);

  assert.deepEqual(actualTables, expectedTables);
});

after(async () => {
  await closeDatabase();
});
