import {
  type ContextRecordKind,
  type NormalizedContextRecord,
} from "../contextual-types.js";
import { getPool } from "../lib/database.js";

export interface ListContextRecordsOptions {
  page: number;
  limit: number;
  recordKind: ContextRecordKind;
  bundleId?: string;
  domain?: string;
  status?: string;
  sourceId?: string;
  entityType?: string;
  relationshipType?: string;
  temporalKind?: string;
  dateFrom?: string;
  dateTo?: string;
  subjectId?: string;
  accountId?: string;
  claimId?: string;
  evidenceType?: string;
  causalKind?: string;
  perspectiveId?: string;
  fromId?: string;
  toId?: string;
}

export interface ListContextRecordsResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: NormalizedContextRecord[];
}

interface ContextRecordRow {
  context_id: string;
  record_kind: ContextRecordKind;
  bundle_id: string;
  domain: string;
  label: string;
  summary: string | null;
  status: string;
  metadata: Record<string, unknown>;
  raw_data: Record<string, unknown>;
  source_ids: string[] | null;
  perspective_links: Array<{
    perspectiveId: string;
    stance: string | null;
    notes: string | null;
  }> | null;
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

function mapContextRecord(
  row: ContextRecordRow,
): NormalizedContextRecord {
  return {
    ...row.raw_data,
    id: row.context_id,
    recordKind: row.record_kind,
    bundleId: row.bundle_id,
    domain: row.domain,
    label: row.label,
    summary: row.summary,
    status: row.status,
    sourceIds: row.source_ids ?? [],
    perspectiveLinks: row.perspective_links ?? [],
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const contextRecordSelect = `
  SELECT
    cr.context_id,
    cr.record_kind,
    cr.bundle_id,
    cr.domain,
    cr.label,
    cr.summary,
    cr.status,
    cr.metadata,
    cr.raw_data,
    cr.created_at,
    cr.updated_at,
    COALESCE(
      (
        SELECT ARRAY_AGG(
          context_source.source_id
          ORDER BY context_source.source_id
        )
        FROM context_record_sources context_source
        WHERE context_source.context_id = cr.context_id
      ),
      ARRAY[]::TEXT[]
    ) AS source_ids,
    COALESCE(
      (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'perspectiveId',
            context_perspective.perspective_context_id,
            'stance',
            context_perspective.stance,
            'notes',
            context_perspective.notes
          )
          ORDER BY context_perspective.perspective_context_id
        )
        FROM context_record_perspectives context_perspective
        WHERE context_perspective.record_context_id = cr.context_id
      ),
      '[]'::JSONB
    ) AS perspective_links
  FROM context_records cr
  LEFT JOIN context_entities entity
    ON entity.context_id = cr.context_id
  LEFT JOIN context_temporal_assertions temporal
    ON temporal.context_id = cr.context_id
  LEFT JOIN context_accounts account
    ON account.context_id = cr.context_id
  LEFT JOIN context_claims claim
    ON claim.context_id = cr.context_id
  LEFT JOIN context_evidence evidence
    ON evidence.context_id = cr.context_id
  LEFT JOIN context_interpretations interpretation
    ON interpretation.context_id = cr.context_id
  LEFT JOIN context_causal_links causal
    ON causal.context_id = cr.context_id
  LEFT JOIN context_relationships relationship
    ON relationship.context_id = cr.context_id
  LEFT JOIN context_cultural_memories memory
    ON memory.context_id = cr.context_id
`;

export async function getContextRecordById(
  contextId: string,
  recordKind?: ContextRecordKind,
): Promise<NormalizedContextRecord | undefined> {
  const database = requireDatabase();
  const result = await database.query<ContextRecordRow>(
    `
      ${contextRecordSelect}
      WHERE cr.context_id = $1
        AND ($2::TEXT IS NULL OR cr.record_kind = $2);
    `,
    [contextId, recordKind ?? null],
  );
  const row = result.rows[0];
  return row ? mapContextRecord(row) : undefined;
}

export async function listContextRecords(
  options: ListContextRecordsOptions,
): Promise<ListContextRecordsResult> {
  const database = requireDatabase();
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  const addEquals = (
    column: string,
    value: string | undefined,
  ) => {
    if (value === undefined) {
      return;
    }
    values.push(value);
    conditions.push(`${column} = $${values.length}`);
  };

  addEquals("cr.record_kind", options.recordKind);
  addEquals("cr.bundle_id", options.bundleId);
  addEquals("cr.domain", options.domain);
  addEquals("cr.status", options.status);
  addEquals("entity.entity_type", options.entityType);
  addEquals(
    "relationship.relationship_type",
    options.relationshipType,
  );
  addEquals("temporal.temporal_kind", options.temporalKind);
  addEquals("claim.account_context_id", options.accountId);
  addEquals("evidence.claim_context_id", options.claimId);
  addEquals("evidence.evidence_type", options.evidenceType);
  addEquals("causal.causal_kind", options.causalKind);
  addEquals("relationship.from_context_id", options.fromId);
  addEquals("relationship.to_context_id", options.toId);

  if (options.sourceId !== undefined) {
    values.push(options.sourceId);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM context_record_sources filter_source
        WHERE filter_source.context_id = cr.context_id
          AND filter_source.source_id = $${values.length}
      )
    `);
  }

  if (options.subjectId !== undefined) {
    values.push(options.subjectId);
    conditions.push(`
      $${values.length} IN (
        temporal.subject_context_id,
        account.subject_context_id,
        claim.subject_context_id,
        interpretation.subject_context_id,
        memory.subject_context_id
      )
    `);
  }

  if (options.perspectiveId !== undefined) {
    values.push(options.perspectiveId);
    conditions.push(`
      (
        memory.perspective_context_id = $${values.length}
        OR EXISTS (
          SELECT 1
          FROM context_record_perspectives filter_perspective
          WHERE filter_perspective.record_context_id = cr.context_id
            AND filter_perspective.perspective_context_id = $${values.length}
        )
      )
    `);
  }

  if (options.dateFrom !== undefined) {
    values.push(options.dateFrom);
    conditions.push(`
      COALESCE(
        temporal.end_date,
        temporal.exact_date,
        temporal.start_date,
        temporal.before_date,
        temporal.after_date
      ) >= $${values.length}::DATE
    `);
  }

  if (options.dateTo !== undefined) {
    values.push(options.dateTo);
    conditions.push(`
      COALESCE(
        temporal.start_date,
        temporal.exact_date,
        temporal.end_date,
        temporal.before_date,
        temporal.after_date
      ) <= $${values.length}::DATE
    `);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  const offset = (options.page - 1) * options.limit;
  const limitParameter = values.length + 1;
  const offsetParameter = values.length + 2;

  const [countResult, recordsResult] = await Promise.all([
    database.query<{ count: string }>(
      `
        SELECT COUNT(*) AS count
        FROM context_records cr
        LEFT JOIN context_entities entity
          ON entity.context_id = cr.context_id
        LEFT JOIN context_temporal_assertions temporal
          ON temporal.context_id = cr.context_id
        LEFT JOIN context_accounts account
          ON account.context_id = cr.context_id
        LEFT JOIN context_claims claim
          ON claim.context_id = cr.context_id
        LEFT JOIN context_evidence evidence
          ON evidence.context_id = cr.context_id
        LEFT JOIN context_interpretations interpretation
          ON interpretation.context_id = cr.context_id
        LEFT JOIN context_causal_links causal
          ON causal.context_id = cr.context_id
        LEFT JOIN context_relationships relationship
          ON relationship.context_id = cr.context_id
        LEFT JOIN context_cultural_memories memory
          ON memory.context_id = cr.context_id
        ${whereClause};
      `,
      values,
    ),
    database.query<ContextRecordRow>(
      `
        ${contextRecordSelect}
        ${whereClause}
        ORDER BY cr.label ASC, cr.context_id ASC
        LIMIT $${limitParameter}
        OFFSET $${offsetParameter};
      `,
      [...values, options.limit, offset],
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
    items: recordsResult.rows.map(mapContextRecord),
  };
}
