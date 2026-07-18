import { getPool } from "../lib/database.js";

export interface NormalizedRevision {
  revisionId: string;
  bundleId: string;
  objectType: string;
  objectId: string;
  revisionType: string | null;
  summary: string | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RevisionRow {
  revision_id: string;
  bundle_id: string;
  object_type: string;
  object_id: string;
  revision_type: string | null;
  summary: string | null;
  status: string | null;
  created_at: Date;
  updated_at: Date;
}

function requireDatabase() {
  const database = getPool();

  if (!database) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return database;
}

export async function getRevisionById(
  revisionId: string,
): Promise<NormalizedRevision | undefined> {
  const database = requireDatabase();

  const result = await database.query<RevisionRow>(
    `
      SELECT
        revision_id,
        bundle_id,
        object_type,
        object_id,
        revision_type,
        summary,
        status,
        created_at,
        updated_at
      FROM revisions
      WHERE revision_id = $1;
    `,
    [revisionId],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return {
    revisionId: row.revision_id,
    bundleId: row.bundle_id,
    objectType: row.object_type,
    objectId: row.object_id,
    revisionType: row.revision_type,
    summary: row.summary,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}