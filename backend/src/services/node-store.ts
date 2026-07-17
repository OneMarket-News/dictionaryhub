import { getPool } from "../lib/database.js";

export interface NormalizedNode {
  nodeId: string;
  bundleId: string;
  title: string;
  nodeType: string | null;
  domain: string | null;
  summary: string | null;
  status: string | null;
  metadata: Record<string, unknown>;
  sourceIds: string[];
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

export async function getNodeById(
  nodeId: string,
): Promise<NormalizedNode | undefined> {
  const database = requireDatabase();

  const result = await database.query<{
    node_id: string;
    bundle_id: string;
    title: string;
    node_type: string | null;
    domain: string | null;
    summary: string | null;
    status: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
    source_ids: string[] | null;
  }>(
    `
      SELECT
        n.node_id,
        n.bundle_id,
        n.title,
        n.node_type,
        n.domain,
        n.summary,
        n.status,
        n.metadata,
        n.created_at,
        n.updated_at,
        COALESCE(
          ARRAY_AGG(ns.source_id ORDER BY ns.source_id)
            FILTER (WHERE ns.source_id IS NOT NULL),
          ARRAY[]::TEXT[]
        ) AS source_ids
      FROM nodes n
      LEFT JOIN node_sources ns
        ON ns.node_id = n.node_id
      WHERE n.node_id = $1
      GROUP BY
        n.node_id,
        n.bundle_id,
        n.title,
        n.node_type,
        n.domain,
        n.summary,
        n.status,
        n.metadata,
        n.created_at,
        n.updated_at;
    `,
    [nodeId],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return {
    nodeId: row.node_id,
    bundleId: row.bundle_id,
    title: row.title,
    nodeType: row.node_type,
    domain: row.domain,
    summary: row.summary,
    status: row.status,
    metadata: row.metadata,
    sourceIds: row.source_ids ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}