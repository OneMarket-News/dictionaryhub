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

export async function getEdgeById(
  edgeId: string,
): Promise<NormalizedEdge | undefined> {
  const database = requireDatabase();

  const result = await database.query<EdgeRow>(
    `
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
          ARRAY_AGG(es.source_id ORDER BY es.source_id)
            FILTER (WHERE es.source_id IS NOT NULL),
          ARRAY[]::TEXT[]
        ) AS source_ids
      FROM edges e
      LEFT JOIN edge_sources es
        ON es.edge_id = e.edge_id
      WHERE e.edge_id = $1
      GROUP BY
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
        e.updated_at;
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
          ARRAY_AGG(es.source_id ORDER BY es.source_id)
            FILTER (WHERE es.source_id IS NOT NULL),
          ARRAY[]::TEXT[]
        ) AS source_ids
      FROM edges e
      LEFT JOIN edge_sources es
        ON es.edge_id = e.edge_id
      WHERE e.from_node_id = $1
         OR e.to_node_id = $1
      GROUP BY
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
        e.updated_at
      ORDER BY e.edge_id;
    `,
    [nodeId],
  );

  const edges = result.rows.map(mapEdgeRow);

  return {
    incoming: edges.filter((edge) => edge.toNodeId === nodeId),
    outgoing: edges.filter((edge) => edge.fromNodeId === nodeId),
  };
}