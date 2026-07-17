import { getPool } from "../lib/database.js";
import type { SourceRootBundle } from "../types.js";

function requireDatabase() {
  const database = getPool();

  if (!database) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return database;
}

export async function saveImportedBundle(
  bundle: SourceRootBundle,
): Promise<void> {
  if (!bundle.bundleId) {
    throw new Error("Cannot store a bundle without a bundleId.");
  }

  const database = requireDatabase();

  await database.query(
    `
      INSERT INTO imported_bundles (
        bundle_id,
        bundle_type,
        version,
        domain,
        bundle
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (bundle_id)
      DO UPDATE SET
        bundle_type = EXCLUDED.bundle_type,
        version = EXCLUDED.version,
        domain = EXCLUDED.domain,
        bundle = EXCLUDED.bundle,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      bundle.bundleId,
      bundle.bundleType ?? null,
      bundle.version ?? null,
      bundle.domain ?? null,
      JSON.stringify(bundle),
    ],
  );
}

export async function getImportedBundle(
  bundleId: string,
): Promise<SourceRootBundle | undefined> {
  const database = requireDatabase();

  const result = await database.query<{
    bundle: SourceRootBundle;
  }>(
    `
      SELECT bundle
      FROM imported_bundles
      WHERE bundle_id = $1
    `,
    [bundleId],
  );

  return result.rows[0]?.bundle;
}

export async function getImportedBundleCount(): Promise<number> {
  const database = requireDatabase();

  const result = await database.query<{
    count: string;
  }>(
    `
      SELECT COUNT(*) AS count
      FROM imported_bundles
    `,
  );

  return Number(result.rows[0]?.count ?? 0);
}