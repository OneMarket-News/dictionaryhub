import "dotenv/config";

import {
  PLYMOUTH_BUNDLE_ID,
} from "../historyroot/plymouth-dataset.js";
import { closeDatabase } from "../lib/database.js";
import {
  deleteImportedBundle,
} from "../services/import-store.js";

const ALLOWED_DATASET_BUNDLES = new Set([PLYMOUTH_BUNDLE_ID]);

async function run(): Promise<void> {
  const deleted = await deleteImportedBundle(
    PLYMOUTH_BUNDLE_ID,
    ALLOWED_DATASET_BUNDLES,
  );

  if (deleted.importedBundles === 0) {
    console.log(`${PLYMOUTH_BUNDLE_ID} was not installed.`);
    return;
  }

  console.log(
    `Removed ${PLYMOUTH_BUNDLE_ID}: ${JSON.stringify(deleted)}`,
  );
}

run()
  .catch((error: unknown) => {
    console.error("HistoryRoot Plymouth dataset removal failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
