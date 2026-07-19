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

export interface ListAssertionsOptions {
  page: number;
  limit: number;
  bundleId?: string;
  nodeId?: string;
  domain?: string;
  assertionType?: string;
  reviewStatus?: string;
  verificationStatus?: string;
  supportLevel?: string;
  interpretationLevel?: string;
}

export interface ListAssertionsResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: NormalizedAssertion[];
  assertions: NormalizedAssertion[];
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

function mapAssertionRow(
  row: AssertionRow,
): NormalizedAssertion {
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

const assertionSelect = `
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
      (
        SELECT ARRAY_AGG(
          ats.source_id
          ORDER BY ats.source_id
        )
        FROM assertion_sources ats
        WHERE ats.assertion_id = a.assertion_id
      ),
      ARRAY[]::TEXT[]
    ) AS source_ids
  FROM assertions a
`;

export async function getAssertionById(
  assertionId: string,
): Promise<NormalizedAssertion | undefined> {
  const database = requireDatabase();

  const result = await database.query<AssertionRow>(
    `
      ${assertionSelect}
      WHERE a.assertion_id = $1;
    `,
    [assertionId],
  );

  const row = result.rows[0];

  return row
    ? mapAssertionRow(row)
    : undefined;
}

export async function getAssertionsByNodeId(
  nodeId: string,
): Promise<NormalizedAssertion[]> {
  const database = requireDatabase();

  const result = await database.query<AssertionRow>(
    `
      ${assertionSelect}
      WHERE a.node_id = $1
      ORDER BY a.assertion_id ASC;
    `,
    [nodeId],
  );

  return result.rows.map(mapAssertionRow);
}

export async function listAssertions(
  options: ListAssertionsOptions,
): Promise<ListAssertionsResult> {
  const database = requireDatabase();

  const conditions: string[] = [];
  const filterValues: string[] = [];

  if (options.bundleId) {
    filterValues.push(options.bundleId);
    conditions.push(
      `a.bundle_id = $${filterValues.length}`,
    );
  }

  if (options.nodeId) {
    filterValues.push(options.nodeId);
    conditions.push(
      `a.node_id = $${filterValues.length}`,
    );
  }

  if (options.domain) {
    filterValues.push(options.domain);
    conditions.push(
      `a.domain = $${filterValues.length}`,
    );
  }

  if (options.assertionType) {
    filterValues.push(options.assertionType);
    conditions.push(
      `a.assertion_type = $${filterValues.length}`,
    );
  }

  if (options.reviewStatus) {
    filterValues.push(options.reviewStatus);
    conditions.push(
      `a.review_status = $${filterValues.length}`,
    );
  }

  if (options.verificationStatus) {
    filterValues.push(options.verificationStatus);
    conditions.push(
      `a.verification_status = $${filterValues.length}`,
    );
  }

  if (options.supportLevel) {
    filterValues.push(options.supportLevel);
    conditions.push(
      `a.support_level = $${filterValues.length}`,
    );
  }

  if (options.interpretationLevel) {
    filterValues.push(options.interpretationLevel);
    conditions.push(
      `a.interpretation_level = $${filterValues.length}`,
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

  const [
    countResult,
    assertionsResult,
  ] = await Promise.all([
    database.query<{ count: string }>(
      `
        SELECT COUNT(*) AS count
        FROM assertions a
        ${whereClause};
      `,
      filterValues,
    ),
    database.query<AssertionRow>(
      `
        ${assertionSelect}
        ${whereClause}
        ORDER BY
          COALESCE(a.label, '') ASC,
          a.assertion_id ASC
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
    items: assertionsResult.rows.map(
        mapAssertionRow,
      ),
    assertions: assertionsResult.rows.map(
        mapAssertionRow,
      ),
  };
}