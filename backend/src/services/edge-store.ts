import { getPool } from "../lib/database.js";

export interface NormalizedEdge {
  edgeId: string;
  bundleId: string;
  fromNodeId: string;
  toNodeId: string;
  relationshipType: string | null;
  label: string | null;
  summary: string | null;
  domain: string | null;
  credibilityTier: string | null;
  confidence: string | null;
  verificationStatus: string | null;
  reviewStatus: string | null;
  supportLevel: string | null;
  relationshipStrength: string | null;
  interpretationLevel: string | null;
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NodeEdgesResult {
  incoming: NormalizedEdge[];
  outgoing: NormalizedEdge[];
}

export interface ListEdgesOptions {
  page: number;
  limit: number;
  bundleId?: string;
  fromNodeId?: string;
  toNodeId?: string;
  domain?: string;
  relationshipType?: string;
  reviewStatus?: string;
  verificationStatus?: string;
  supportLevel?: string;
  relationshipStrength?: string;
  interpretationLevel?: string;
}

export interface ListEdgesResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  edges: NormalizedEdge[];
}

interface EdgeRow {
  edge_id: string;
  bundle_id: string;
  from_node_id: string;
  to_node_id: string;
  relationship_type: string | null;
  label: string | null;
  summary: string | null;
  domain: string | null;
  credibility_tier: string | null;
  confidence: string | null;
  verification_status: string | null;
  review_status: string | null;
  support_level: string | null;
  relationship_strength: string | null;
  interpretation_level: string | null;
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

function mapEdgeRow(row: EdgeRow): NormalizedEdge {
  return {
    edgeId: row.edge_id,
    bundleId: row.bundle_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    relationshipType: row.relationship_type,
    label: row.label,
    summary: row.summary,
    domain: row.domain,
    credibilityTier: row.credibility_tier,
    confidence: row.confidence,
    verificationStatus: row.verification_status,
    reviewStatus: row.review_status,
    supportLevel: row.support_level,
    relationshipStrength: row.relationship_strength,
    interpretationLevel: row.interpretation_level,
    sourceIds: row.source_ids ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const edgeSelect = `
  SELECT
    e.edge_id,
    e.bundle_id,
    e.from_node_id,
    e.to_node_id,
    e.relationship_type,
    e.label,
    e.summary,
    e.domain,
    e.credibility_tier,
    e.confidence,
    e.verification_status,
    e.review_status,
    e.support_level,
    e.relationship_strength,
    e.interpretation_level,
    e.created_at,
    e.updated_at,
    COALESCE(
      (
        SELECT ARRAY_AGG(
          es.source_id
          ORDER BY es.source_id
        )
        FROM edge_sources es
        WHERE es.edge_id = e.edge_id
      ),
      ARRAY[]::TEXT[]
    ) AS source_ids
  FROM edges e
`;

export async function getEdgeById(
  edgeId: string,
): Promise<NormalizedEdge | undefined> {
  const database = requireDatabase();

  const result = await database.query<EdgeRow>(
    `
      ${edgeSelect}
      WHERE e.edge_id = $1;
    `,
    [edgeId],
  );

  const row = result.rows[0];

  return row ? mapEdgeRow(row) : undefined;
}

export async function getEdgesByNodeId(
  nodeId: string,
): Promise<NodeEdgesResult> {
  const database = requireDatabase();

  const result = await database.query<EdgeRow>(
    `
      ${edgeSelect}
      WHERE e.from_node_id = $1
         OR e.to_node_id = $1
      ORDER BY e.edge_id ASC;
    `,
    [nodeId],
  );

  const edges = result.rows.map(mapEdgeRow);

  return {
    incoming: edges.filter(
      (edge) => edge.toNodeId === nodeId,
    ),
    outgoing: edges.filter(
      (edge) => edge.fromNodeId === nodeId,
    ),
  };
}

export async function listEdges(
  options: ListEdgesOptions,
): Promise<ListEdgesResult> {
  const database = requireDatabase();

  const conditions: string[] = [];
  const filterValues: string[] = [];

  if (options.bundleId) {
    filterValues.push(options.bundleId);
    conditions.push(
      `e.bundle_id = $${filterValues.length}`,
    );
  }

  if (options.fromNodeId) {
    filterValues.push(options.fromNodeId);
    conditions.push(
      `e.from_node_id = $${filterValues.length}`,
    );
  }

  if (options.toNodeId) {
    filterValues.push(options.toNodeId);
    conditions.push(
      `e.to_node_id = $${filterValues.length}`,
    );
  }

  if (options.domain) {
    filterValues.push(options.domain);
    conditions.push(
      `e.domain = $${filterValues.length}`,
    );
  }

  if (options.relationshipType) {
    filterValues.push(options.relationshipType);
    conditions.push(
      `e.relationship_type = $${filterValues.length}`,
    );
  }

  if (options.reviewStatus) {
    filterValues.push(options.reviewStatus);
    conditions.push(
      `e.review_status = $${filterValues.length}`,
    );
  }

  if (options.verificationStatus) {
    filterValues.push(options.verificationStatus);
    conditions.push(
      `e.verification_status = $${filterValues.length}`,
    );
  }

  if (options.supportLevel) {
    filterValues.push(options.supportLevel);
    conditions.push(
      `e.support_level = $${filterValues.length}`,
    );
  }

  if (options.relationshipStrength) {
    filterValues.push(options.relationshipStrength);
    conditions.push(
      `e.relationship_strength = $${filterValues.length}`,
    );
  }

  if (options.interpretationLevel) {
    filterValues.push(options.interpretationLevel);
    conditions.push(
      `e.interpretation_level = $${filterValues.length}`,
    );
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const offset =
    (options.page - 1) * options.limit;

  const limitParameter =
    filterValues.length + 1;

  const offsetParameter =
    filterValues.length + 2;

  const [countResult, edgesResult] =
    await Promise.all([
      database.query<{ count: string }>(
        `
          SELECT COUNT(*) AS count
          FROM edges e
          ${whereClause};
        `,
        filterValues,
      ),
      database.query<EdgeRow>(
        `
          ${edgeSelect}
          ${whereClause}
          ORDER BY
            COALESCE(e.label, '') ASC,
            e.edge_id ASC
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

  const total = Number(
    countResult.rows[0]?.count ?? 0,
  );

  return {
    page: options.page,
    limit: options.limit,
    total,
    totalPages:
      total === 0
        ? 0
        : Math.ceil(
            total / options.limit,
          ),
    edges: edgesResult.rows.map(mapEdgeRow),
  };
}