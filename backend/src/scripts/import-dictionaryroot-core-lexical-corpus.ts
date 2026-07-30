import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  CORE_LEXICAL_CORPUS_ID,
  CORE_LEXICAL_CORPUS_VERSION,
} from "../dictionaryroot/core-lexical-corpus.js";
import type {
  DictionaryRootCoreLexicalCorpus,
} from "../dictionaryroot/lexical-evidence-types.js";
import { closeDatabase, getPool } from "../lib/database.js";
import {
  saveDictionaryRootCoreLexicalCorpus,
} from "../services/lexical-evidence-store.js";

async function main(): Promise<void> {
  const corpusPath = path.resolve(process.argv[2]
    ?? path.join(process.cwd(), "data", "dictionaryroot-core-lexical-corpus-v1",
      "corpus.json"));
  const corpus = JSON.parse(
    await readFile(corpusPath, "utf8"),
  ) as DictionaryRootCoreLexicalCorpus;
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const gate = await pool.query<{
    database_name: string;
    migrations: string[];
    migration_015_count: number;
  }>(
    `SELECT current_database() AS database_name,
      ARRAY(
        SELECT migration_name FROM schema_migrations ORDER BY migration_name
      ) AS migrations,
      (
        SELECT COUNT(*)::INTEGER FROM schema_migrations
        WHERE migration_name LIKE '015%'
      ) AS migration_015_count`,
  );
  const row = gate.rows[0];
  if (row?.database_name !== "sourceroot_test") {
    throw new Error(`Production corpus import requires sourceroot_test; received ${row?.database_name ?? "unknown"}.`);
  }
  for (const migration of [
    "013_create_dictionaryroot_lexical_evidence.sql",
    "014_create_dictionaryroot_lexical_relationships.sql",
  ]) {
    if (!row.migrations.includes(migration)) {
      throw new Error(`Required migration is not applied: ${migration}`);
    }
  }
  if (row.migration_015_count !== 0) {
    throw new Error("Migration 015 is outside the Chunk 10B boundary.");
  }
  if (
    corpus.dataset.datasetId !== CORE_LEXICAL_CORPUS_ID
    || corpus.dataset.version !== CORE_LEXICAL_CORPUS_VERSION
  ) {
    throw new Error("Corpus identity or version is invalid.");
  }
  await saveDictionaryRootCoreLexicalCorpus(corpus);
  const result = await pool.query(
    `SELECT dataset_id, version, status, fixture_only
     FROM dictionaryroot_lexical_evidence_datasets
     ORDER BY dataset_id`,
  );
  console.log(JSON.stringify({ corpusPath, datasets: result.rows }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await closeDatabase();
});
