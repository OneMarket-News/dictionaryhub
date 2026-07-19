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

export interface ListNodesOptions {
  page: number;
  limit: number;
  bundleId?: string;
  domain?: string;
  nodeType?: string;
  status?: string;
}

export interface ListNodesResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: NormalizedNode[];
  nodes: NormalizedNode[];
}

interface NodeRow {
  node_id: string;
  bundle_id: string;
  title: string;
  node_type: string | null;
  domain: string | null;
  summary: string | null;
  status: string | null;
  metadata: Record<string, unknown>;
  source_ids: string[] | null;
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

function mapNodeRow(row: NodeRow): NormalizedNode {
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

export async function getNodeById(
  nodeId: string,
): Promise<NormalizedNode | undefined> {
  const database = requireDatabase();

  const result = await database.query<NodeRow>(
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

  return mapNodeRow(row);
}

export async function listNodes(
  options: ListNodesOptions,
): Promise<ListNodesResult> {
  const database = requireDatabase();

  const conditions: string[] = [];
  const filterValues: string[] = [];

  if (options.bundleId) {
    filterValues.push(options.bundleId);
    conditions.push(`n.bundle_id = $${filterValues.length}`);
  }

  if (options.domain) {
    filterValues.push(options.domain);
    conditions.push(`n.domain = $${filterValues.length}`);
  }

  if (options.nodeType) {
    filterValues.push(options.nodeType);
    conditions.push(`n.node_type = $${filterValues.length}`);
  }

  if (options.status) {
    filterValues.push(options.status);
    conditions.push(`n.status = $${filterValues.length}`);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const offset = (options.page - 1) * options.limit;

  const limitParameter = filterValues.length + 1;
  const offsetParameter = filterValues.length + 2;

  const [countResult, nodesResult] = await Promise.all([
    database.query<{ count: string }>(
      `
        SELECT COUNT(*) AS count
        FROM nodes n
        ${whereClause};
      `,
      filterValues,
    ),
    database.query<NodeRow>(
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
            (
              SELECT ARRAY_AGG(
                ns.source_id
                ORDER BY ns.source_id
              )
              FROM node_sources ns
              WHERE ns.node_id = n.node_id
            ),
            ARRAY[]::TEXT[]
          ) AS source_ids
        FROM nodes n
        ${whereClause}
        ORDER BY
          n.title ASC,
          n.node_id ASC
        LIMIT $${limitParameter}
        OFFSET $${offsetParameter};
      `,
      [
        ...filterValues,
        options.limit,
        offset,
      ],
    ),
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);

  return {
    page: options.page,
    limit: options.limit,
    total,
    totalPages:
      total === 0
        ? 0
        : Math.ceil(total / options.limit),
    items: nodesResult.rows.map(mapNodeRow),
    nodes: nodesResult.rows.map(mapNodeRow),
  };
}