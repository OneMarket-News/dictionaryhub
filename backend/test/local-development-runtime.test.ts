import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import type { PoolClient } from "pg";

import { validateBibleRootFoundation } from "../src/bibleroot/foundation.js";
import {
  assertLocalDevelopmentImportAuthorized,
  authorizeLocalDevelopmentDatabase,
} from "../src/lib/local-development-database.js";
import { validateDictionaryRootCoreCorpus } from "../src/scripts/development-runtime.js";

const migrationNames = [
  "013_create_dictionaryroot_lexical_evidence.sql",
  "014_create_dictionaryroot_lexical_relationships.sql",
  "015_create_bibleroot_foundation.sql",
  "016_create_bibleroot_original_language_foundation.sql",
  "017_create_bibleroot_commentary_provenance.sql",
  "018_create_cross_root_link_foundation.sql",
];

function fakeClient(overrides: Record<string, unknown> = {}): PoolClient {
  const row = {
    database_name: "sourceroot",
    server_address: "127.0.0.1",
    server_port: 5432,
    migrations: migrationNames,
    migration_018_count: 1,
    ...overrides,
  };
  return {
    query: async () => ({ rows: [row] }),
  } as unknown as PoolClient;
}

test("1. development authorization accepts only the intended local sourceroot target", async () => {
  const result = await authorizeLocalDevelopmentDatabase(fakeClient({ server_address: "127.0.0.1/32" }), {
    nodeEnvironment: "development",
    databaseUrl: "postgresql://local-user:redacted@127.0.0.1:5432/sourceroot",
  });
  assert.deepEqual(
    { environment: result.target.environment, databaseName: result.target.databaseName, host: result.target.host },
    { environment: "development", databaseName: "sourceroot", host: "127.0.0.1" },
  );
  assert.doesNotThrow(() => assertLocalDevelopmentImportAuthorized(
    result.authorization,
    "sourceroot",
  ));
});

test("2. production mode is rejected before any query", async () => {
  await assert.rejects(
    authorizeLocalDevelopmentDatabase(fakeClient(), {
      nodeEnvironment: "production",
      databaseUrl: "postgresql://local-user:redacted@localhost/sourceroot",
    }),
    /NODE_ENV=development/,
  );
});

test("3. unexpected database names are rejected", async () => {
  await assert.rejects(
    authorizeLocalDevelopmentDatabase(fakeClient(), {
      nodeEnvironment: "development",
      databaseUrl: "postgresql://local-user:redacted@localhost/postgres",
    }),
    /database name sourceroot/,
  );
});

test("4. remote URL hosts and non-loopback connected servers are rejected", async () => {
  await assert.rejects(
    authorizeLocalDevelopmentDatabase(fakeClient(), {
      nodeEnvironment: "development",
      databaseUrl: "postgresql://local-user:redacted@database.example/sourceroot",
    }),
    /remote database hosts/,
  );
  await assert.rejects(
    authorizeLocalDevelopmentDatabase(fakeClient({ server_address: "10.0.0.5" }), {
      nodeEnvironment: "development",
      databaseUrl: "postgresql://local-user:redacted@localhost/sourceroot",
    }),
    /loopback address/,
  );
});

test("5. migrations 017 and 018 are required exactly once", async () => {
  await assert.rejects(
    authorizeLocalDevelopmentDatabase(fakeClient({ migrations: migrationNames.slice(0, 4) }), {
      nodeEnvironment: "development",
      databaseUrl: "postgresql://local-user:redacted@localhost/sourceroot",
    }),
    /017_create_bibleroot_commentary_provenance/,
  );
  await assert.rejects(
    authorizeLocalDevelopmentDatabase(fakeClient({ migration_018_count: 0 }), {
      nodeEnvironment: "development",
      databaseUrl: "postgresql://local-user:redacted@localhost/sourceroot",
    }),
    /migration 018/i,
  );
});

test("6. local-development authorization cannot be fabricated", () => {
  assert.throws(
    () => assertLocalDevelopmentImportAuthorized({
      mode: "development",
      databaseName: "sourceroot",
      host: "localhost",
      port: 5432,
    }, "sourceroot"),
    /verified local-development database authorization/,
  );
});

test("7. released DictionaryRoot corpus identities and hashes validate", async () => {
  const corpus = await validateDictionaryRootCoreCorpus();
  assert.equal(corpus.dataset.datasetId, "dictionaryroot-core-lexical-corpus-v1");
  assert.equal(corpus.dataset.version, "1.0.0");
  assert.equal(corpus.lemmas.length, 500);
  assert.equal(corpus.relationships.length, 722);
});

test("8. repaired Gutenberg artifact validates at the accepted exact identity", async () => {
  const dataset = await validateBibleRootFoundation();
  const raw = new URL(
    "../data/bibleroot-foundation-v1/raw/project-gutenberg-ebook-10-10-0.txt",
    import.meta.url,
  );
  assert.equal((await stat(raw)).size, 4436268);
  assert.equal(dataset.sourceMetadata.source.sha256, "0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986");
});

test("9. historical BibleRoot CLIs remain sourceroot_test by default", async () => {
  const foundation = await readFile(new URL(
    "../src/scripts/import-bibleroot-foundation.ts",
    import.meta.url,
  ), "utf8");
  const original = await readFile(new URL(
    "../src/scripts/import-bibleroot-original-language-foundation.ts",
    import.meta.url,
  ), "utf8");
  const commentary = await readFile(new URL(
    "../src/scripts/import-bibleroot-commentary-provenance.ts",
    import.meta.url,
  ), "utf8");
  assert.match(foundation, /restricted to sourceroot_test/);
  assert.match(original, /restricted to sourceroot_test/);
  assert.match(foundation, /assertLocalDevelopmentImportAuthorized/);
  assert.match(original, /assertLocalDevelopmentImportAuthorized/);
  assert.match(commentary, /restricted to sourceroot_test/);
  assert.match(commentary, /assertLocalDevelopmentImportAuthorized/);
});
