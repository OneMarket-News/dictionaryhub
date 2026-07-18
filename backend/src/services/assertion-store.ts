import { getPool } from "../lib/database.js";

export interface NormalizedAssertion {
  assertionId: string;
  bundleId: string;
  nodeId: string;
  assertionType: string | null;
  label: string | null;
  summary: string | null;
  body: string | null;
  domain: string | null;
  credibilityTier: string | null;
  confidence: string | null;
  verificationStatus: string | null;
  reviewStatus: string | null;
  supportLevel: string | null;
  interpretationLevel: string | null;
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface AssertionRow {
  assertion_id: string;
  bundle_id: string;
  node_id: string;
  assertion_type: string | null;
  label: string | null;
  summary: string | null;
  body: string | null;
  domain: string | null;
  credibility_tier: string | null;
  confidence: string | null;
  verification_status: string | null;
  review_status: string | null;
  support_level: string | null;
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

function mapAssertionRow(row: AssertionRow): NormalizedAssertion {
  return {
    assertionId: row.assertion_id,
    bundleId: row.bundle_id,
    nodeId: row.node_id,
    assertionType: row.assertion_type,
    label: row.label,
    summary: row.summary,
    body: row.body,
    domain: row.domain,
    credibilityTier: row.credibility_tier,
    confidence: row.confidence,
    verificationStatus: row.verification_status,
    reviewStatus: row.review_status,
    supportLevel: row.support_level,
    interpretationLevel: row.interpretation_level,
    sourceIds: row.source_ids ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getAssertionById(
  assertionId: string,
): Promise<NormalizedAssertion | undefined> {
  const database = requireDatabase();

  const result = await database.query<AssertionRow>(
    `
      SELECT
        a.assertion_id,
        a.bundle_id,
        a.node_id,
        a.assertion_type,
        a.label,
        a.summary,
        a.body,
        a.domain,
        a.credibility_tier,
        a.confidence,
        a.verification_status,
        a.review_status,
        a.support_level,
        a.interpretation_level,
        a.created_at,
        a.updated_at,
        COALESCE(
          ARRAY_AGG(ats.source_id ORDER BY ats.source_id)
            FILTER (WHERE ats.source_id IS NOT NULL),
          ARRAY[]::TEXT[]
        ) AS source_ids
      FROM assertions a
      LEFT JOIN assertion_sources ats
        ON ats.assertion_id = a.assertion_id
      WHERE a.assertion_id = $1
      GROUP BY
        a.assertion_id,
        a.bundle_id,
        a.node_id,
        a.assertion_type,
        a.label,
        a.summary,
        a.body,
        a.domain,
        a.credibility_tier,
        a.confidence,
        a.verification_status,
        a.review_status,
        a.support_level,
        a.interpretation_level,
        a.created_at,
        a.updated_at;
    `,
    [assertionId],
  );

  const row = result.rows[0];

  return row ? mapAssertionRow(row) : undefined;
}

export async function getAssertionsByNodeId(
  nodeId: string,
): Promise<NormalizedAssertion[]> {
  const database = requireDatabase();

  const result = await database.query<AssertionRow>(
    `
      SELECT
        a.assertion_id,
        a.bundle_id,
        a.node_id,
        a.assertion_type,
        a.label,
        a.summary,
        a.body,
        a.domain,
        a.credibility_tier,
        a.confidence,
        a.verification_status,
        a.review_status,
        a.support_level,
        a.interpretation_level,
        a.created_at,
        a.updated_at,
        COALESCE(
          ARRAY_AGG(ats.source_id ORDER BY ats.source_id)
            FILTER (WHERE ats.source_id IS NOT NULL),
          ARRAY[]::TEXT[]
        ) AS source_ids
      FROM assertions a
      LEFT JOIN assertion_sources ats
        ON ats.assertion_id = a.assertion_id
      WHERE a.node_id = $1
      GROUP BY
        a.assertion_id,
        a.bundle_id,
        a.node_id,
        a.assertion_type,
        a.label,
        a.summary,
        a.body,
        a.domain,
        a.credibility_tier,
        a.confidence,
        a.verification_status,
        a.review_status,
        a.support_level,
        a.interpretation_level,
        a.created_at,
        a.updated_at
      ORDER BY a.assertion_id;
    `,
    [nodeId],
  );

  return result.rows.map(mapAssertionRow);
}