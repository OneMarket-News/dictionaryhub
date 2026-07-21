import { getPool } from "../lib/database.js";

export interface NormalizedRevision {
  revisionId: string;
  bundleId: string;
  objectType: string;
  objectId: string;
  revisionType: string | null;
  summary: string | null;
  status: string | null;
  rawData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ListRevisionsOptions {
  page: number;
  limit: number;
  bundleId?: string;
  objectType?: string;
  objectId?: string;
  revisionType?: string;
  status?: string;
}

export interface ListRevisionsResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: NormalizedRevision[];
  revisions: NormalizedRevision[];
}

interface RevisionRow {
  revision_id: string;
  bundle_id: string;
  object_type: string;
  object_id: string;
  revision_type: string | null;
  summary: string | null;
  status: string | null;
  raw_data: Record<string, unknown> | null;
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

function mapRevisionRow(
  row: RevisionRow,
): NormalizedRevision {
  return {
    revisionId: row.revision_id,
    bundleId: row.bundle_id,
    objectType: row.object_type,
    objectId: row.object_id,
    revisionType: row.revision_type,
    summary: row.summary,
    status: row.status,
    rawData: row.raw_data || {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
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
        raw_data,
        created_at,
        updated_at
      FROM revisions
      WHERE revision_id = $1;
    `,
    [revisionId],
  );

  const row = result.rows[0];

  return row
    ? mapRevisionRow(row)
    : undefined;
}

export async function listRevisions(
  options: ListRevisionsOptions,
): Promise<ListRevisionsResult> {
  const database = requireDatabase();

  const conditions: string[] = [];
  const filterValues: string[] = [];

  if (options.bundleId) {
    filterValues.push(options.bundleId);
    conditions.push(
      `bundle_id = $${filterValues.length}`,
    );
  }

  if (options.objectType) {
    filterValues.push(options.objectType);
    conditions.push(
      `object_type = $${filterValues.length}`,
    );
  }

  if (options.objectId) {
    filterValues.push(options.objectId);
    conditions.push(
      `object_id = $${filterValues.length}`,
    );
  }

  if (options.revisionType) {
    filterValues.push(options.revisionType);
    conditions.push(
      `revision_type = $${filterValues.length}`,
    );
  }

  if (options.status) {
    filterValues.push(options.status);
    conditions.push(
      `status = $${filterValues.length}`,
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

  const [countResult, revisionsResult] =
    await Promise.all([
      database.query<{ count: string }>(
        `
          SELECT COUNT(*) AS count
          FROM revisions
          ${whereClause};
        `,
        filterValues,
      ),
      database.query<RevisionRow>(
        `
          SELECT
            revision_id,
            bundle_id,
            object_type,
            object_id,
            revision_type,
            summary,
            status,
            raw_data,
            created_at,
            updated_at
          FROM revisions
          ${whereClause}
          ORDER BY
            created_at DESC,
            revision_id ASC
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
    items: revisionsResult.rows.map(
        mapRevisionRow,
      ),
    revisions: revisionsResult.rows.map(
        mapRevisionRow,
      ),
  };
}