import "dotenv/config";

import { closeDatabase } from "../lib/database.js";
import {
  loadPlymouthBundle,
  validatePlymouthDataset,
} from "../historyroot/plymouth-dataset.js";
import { saveImportedBundle } from "../services/import-store.js";

async function run(): Promise<void> {
  const report = await validatePlymouthDataset();

  if (!report.ready) {
    throw new Error(
      `Dataset validation failed with ${report.totals.fail} failure(s).`,
    );
  }

  const bundle = await loadPlymouthBundle();
  await saveImportedBundle(bundle);
  console.log(
    `Imported ${report.bundleId} with ${report.counts.contextualRecords} contextual records and ${report.counts.sources} sources.`,
  );
}

run()
  .catch((error: unknown) => {
    console.error("HistoryRoot Plymouth dataset import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
