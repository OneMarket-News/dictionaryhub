import "dotenv/config";

import { readFile } from "node:fs/promises";

import { closeDatabase } from "../lib/database.js";
import { saveImportedBundle } from "../services/import-store.js";
import { validateBundle } from "../services/validator.js";
import type { SourceRootBundle } from "../types.js";

const bundleUrl = new URL(
  "../../data/historyroot-corpus-expansion-quality-v1/historyroot-corpus-expansion-quality-v1.bundle.json",
  import.meta.url,
);

async function run(): Promise<void> {
  const databaseName = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).pathname.replace(/^\//, "")
    : "";
  if (databaseName !== "sourceroot_test") {
    throw new Error(
      `Refusing corpus import into "${databaseName || "unconfigured"}"; expected sourceroot_test.`,
    );
  }
  const bundle = JSON.parse(
    await readFile(bundleUrl, "utf8"),
  ) as SourceRootBundle;
  const validation = validateBundle(bundle);
  if (!validation.canImport || validation.summary.errors !== 0
    || validation.summary.warnings !== 0) {
    throw new Error(
      `Expanded bundle validation failed: ${validation.summary.errors} error(s), ${validation.summary.warnings} warning(s).`,
    );
  }
  await saveImportedBundle(bundle);
  console.log(
    `Imported ${bundle.bundleId} version ${bundle.version} into sourceroot_test through the existing replacement-safe importer.`,
  );
}

run()
  .catch((error: unknown) => {
    console.error("HistoryRoot corpus expansion import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
