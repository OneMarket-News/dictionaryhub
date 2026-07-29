import { readFile } from "node:fs/promises";

import {
  DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID,
  type DictionaryRootLexicalEvidenceFixture,
} from "../dictionaryroot/lexical-evidence-types.js";
import { closeDatabase, getPool } from "../lib/database.js";
import {
  getLexicalEvidenceFixtureCounts,
  saveDictionaryRootLexicalEvidenceFixture,
} from "../services/lexical-evidence-store.js";

const fixtureUrl = new URL(
  "../../data/dictionaryroot-lexical-evidence-architecture-fixture-v1/fixture.json",
  import.meta.url,
);

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  const databaseName = new URL(databaseUrl).pathname.replace(/^\/+/u, "");
  if (databaseName !== "sourceroot_test") {
    throw new Error(`Refusing fixture import into "${databaseName || "unconfigured"}".`);
  }
  if (!getPool()) throw new Error("Database pool is unavailable.");
  const fixture = JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  ) as DictionaryRootLexicalEvidenceFixture;
  if (fixture.dataset.datasetId !== DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID) {
    throw new Error("Unexpected fixture identity.");
  }
  await saveDictionaryRootLexicalEvidenceFixture(fixture);
  console.log(JSON.stringify(await getLexicalEvidenceFixtureCounts(), null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await closeDatabase();
});
