import { getPool } from "../lib/database.js";

export interface NormalizedSource {
  sourceId: string;
  bundleId: string;
  name: string;
  sourceType: string | null;
  domain: string | null;
  publisher: string | null;
  qualityTier: string | null;
  credibilityTier: string | null;
  verificationStatus: string | null;
  sourceClass: string | null;
  license: string | null;
  licenseStatus: string | null;
  reviewStatus: string | null;
  lastReviewed: string | null;
  url: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListSourcesOptions {
  page: number;
  limit: number;
  bundleId?: string;
  domain?: string;
  sourceType?: string;
  publisher?: string;
  reviewStatus?: string;
  verificationStatus?: string;
}

export interface ListSourcesResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sources: NormalizedSource[];
}

interface SourceRow {
  source_id: string;
  bundle_id: string;
  name: string;
  source_type: string | null;
  domain: string | null;
  publisher: string | null;
  quality_tier: string | null;
  credibility_tier: string | null;
  verification_status: string | null;
  source_class: string | null;
  license: string | null;
  license_status: string | null;
  review_status: string | null;
  last_reviewed: Date | string | null;
  url: string | null;
  notes: string | null;
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

function formatLastReviewed(
  value: Date | string | null,
): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function mapSourceRow(row: SourceRow): NormalizedSource {
  return {
    sourceId: row.source_id,
    bundleId: row.bundle_id,
    name: row.name,
    sourceType: row.source_type,
    domain: row.domain,
    publisher: row.publisher,
    qualityTier: row.quality_tier,
    credibilityTier: row.credibility_tier,
    verificationStatus: row.verification_status,
    sourceClass: row.source_class,
    license: row.license,
    licenseStatus: row.license_status,
    reviewStatus: row.review_status,
    lastReviewed: formatLastReviewed(row.last_reviewed),
    url: row.url,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getSourceById(
  sourceId: string,
): Promise<NormalizedSource | undefined> {
  const database = requireDatabase();

  const result = await database.query<SourceRow>(
    `
      SELECT
        source_id,
        bundle_id,
        name,
        source_type,
        domain,
        publisher,
        quality_tier,
        credibility_tier,
        verification_status,
        source_class,
        license,
        license_status,
        review_status,
        last_reviewed,
        url,
        notes,
        created_at,
        updated_at
      FROM sources
      WHERE source_id = $1;
    `,
    [sourceId],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return mapSourceRow(row);
}

export async function listSources(
  options: ListSourcesOptions,
): Promise<ListSourcesResult> {
  const database = requireDatabase();

  const conditions: string[] = [];
  const filterValues: string[] = [];

  if (options.bundleId) {
    filterValues.push(options.bundleId);
    conditions.push(`bundle_id = $${filterValues.length}`);
  }

  if (options.domain) {
    filterValues.push(options.domain);
    conditions.push(`domain = $${filterValues.length}`);
  }

  if (options.sourceType) {
    filterValues.push(options.sourceType);
    conditions.push(`source_type = $${filterValues.length}`);
  }

  if (options.publisher) {
    filterValues.push(options.publisher);
    conditions.push(`publisher = $${filterValues.length}`);
  }

  if (options.reviewStatus) {
    filterValues.push(options.reviewStatus);
    conditions.push(`review_status = $${filterValues.length}`);
  }

  if (options.verificationStatus) {
    filterValues.push(options.verificationStatus);
    conditions.push(
      `verification_status = $${filterValues.length}`,
    );
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const offset = (options.page - 1) * options.limit;
  const limitParameter = filterValues.length + 1;
  const offsetParameter = filterValues.length + 2;

  const [countResult, sourcesResult] = await Promise.all([
    database.query<{ count: string }>(
      `
        SELECT COUNT(*) AS count
        FROM sources
        ${whereClause};
      `,
      filterValues,
    ),
    database.query<SourceRow>(
      `
        SELECT
          source_id,
          bundle_id,
          name,
          source_type,
          domain,
          publisher,
          quality_tier,
          credibility_tier,
          verification_status,
          source_class,
          license,
          license_status,
          review_status,
          last_reviewed,
          url,
          notes,
          created_at,
          updated_at
        FROM sources
        ${whereClause}
        ORDER BY
          name ASC,
          source_id ASC
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
    sources: sourcesResult.rows.map(mapSourceRow),
  };
}