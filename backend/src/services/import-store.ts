import { getPool } from "../lib/database.js";
import type { SourceRootBundle } from "../types.js";

export interface ImportedBundleMetadata {
  bundleId: string;
  bundleType: string | null;
  version: string | null;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export interface ListImportedBundlesOptions {
  page: number;
  limit: number;
}

export interface ListImportedBundlesResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  bundles: ImportedBundleMetadata[];
}

export async function listImportedBundles(
  options: ListImportedBundlesOptions,
): Promise<ListImportedBundlesResult> {
  const database = requireDatabase();

  const offset = (options.page - 1) * options.limit;

  const [countResult, bundlesResult] = await Promise.all([
    database.query<{
      count: string;
    }>(
      `
        SELECT COUNT(*) AS count
        FROM imported_bundles;
      `,
    ),
    database.query<{
      bundle_id: string;
      bundle_type: string | null;
      version: string | null;
      domain: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT
          bundle_id,
          bundle_type,
          version,
          domain,
          created_at,
          updated_at
        FROM imported_bundles
        ORDER BY created_at DESC
        LIMIT $1
        OFFSET $2;
      `,
      [options.limit, offset],
    ),
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);
  const totalPages =
    total === 0 ? 0 : Math.ceil(total / options.limit);

  return {
    page: options.page,
    limit: options.limit,
    total,
    totalPages,
    bundles: bundlesResult.rows.map((row) => ({
      bundleId: row.bundle_id,
      bundleType: row.bundle_type,
      version: row.version,
      domain: row.domain,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })),
  };
}