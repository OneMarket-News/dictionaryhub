import "dotenv/config";

import {
  loadFoundationalCorpusBundle,
  validateFoundationalCorpus,
} from "../historyroot/foundational-corpus.js";
import { closeDatabase } from "../lib/database.js";
import { saveImportedBundle } from "../services/import-store.js";

async function run(): Promise<void> {
  const databaseName = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).pathname.replace(/^\//, "")
    : "";
  if (databaseName !== "sourceroot_test") {
    throw new Error(
      `Refusing corpus import into "${databaseName || "unconfigured"}"; expected sourceroot_test.`,
    );
  }

  const report = await validateFoundationalCorpus();
  if (!report.ready) {
    throw new Error(
      `Corpus validation failed: ${report.failures.join("; ")}`,
    );
  }

  const bundle = await loadFoundationalCorpusBundle();
  await saveImportedBundle(bundle);
  console.log(
    `Imported ${report.corpusId} through replacement-safe bundle ${report.bundleId}: ${report.counts.requiredRecords} required records, ${report.counts.claims} selected claims, ${report.counts.sources} selected sources, and ${report.counts.relationships} selected relationships.`,
  );
}

run()
  .catch((error: unknown) => {
    console.error("HistoryRoot foundational corpus import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
