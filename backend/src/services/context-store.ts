import {
  type ContextRecordKind,
  type NormalizedContextRecord,
} from "../contextual-types.js";
import { getPool } from "../lib/database.js";
import type { SortDirection } from "../lib/query-params.js";
import {
  getContextExtensionDetail,
} from "./context-version-store.js";

export interface ListContextRecordsOptions {
  page: number;
  limit: number;
  offset?: number;
  sort?: "label" | "createdAt" | "updatedAt" | "recordId";
  direction?: SortDirection;
  recordKind: ContextRecordKind;
  bundleId?: string;
  domain?: string;
  status?: string;
  sourceId?: string;
  entityType?: string;
  relationshipType?: string;
  temporalKind?: string;
  timeRole?: string;
  dateFrom?: string;
  dateTo?: string;
  validAt?: string;
  validFrom?: string;
  validTo?: string;
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

export interface ListEntityAliasesOptions {
  entityId: string;
  page: number;
  limit: number;
  offset?: number;
  sort?: "text" | "createdAt" | "updatedAt" | "aliasId";
  direction?: SortDirection;
  aliasType?: string;
  languageTag?: string;
  status?: string;
  sourceId?: string;
}

export interface ListEntityIdentifiersOptions {
  entityId: string;
  page: number;
  limit: number;
  offset?: number;
  sort?: "scheme" | "value" | "createdAt" | "updatedAt" | "identifierId";
  direction?: SortDirection;
  scheme?: string;
  status?: string;
  sourceId?: string;
}

export interface ListContextChildrenResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: Record<string, unknown>[];
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
  aliases: Record<string, unknown>[] | null;
  external_identifiers: Record<string, unknown>[] | null;
  identity_links: Record<string, unknown>[] | null;
  field_provenance: Record<string, unknown>[] | null;
  temporal_context: Record<string, unknown>[] | null;
  proposed_date_details: Record<string, unknown>[] | null;
  relationship_temporal_links: Record<string, unknown>[] | null;
  relationship_validity_sources: string[] | null;
  time_role: string | null;
  structured_date: Record<string, unknown> | null;
  chronology_start_year: number | null;
  chronology_end_year: number | null;
  review_status: string | null;
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
  const record: NormalizedContextRecord = {
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
    aliases: row.aliases ?? [],
    externalIdentifiers: row.external_identifiers ?? [],
    identityLinks: row.identity_links ?? [],
    fieldProvenance: row.field_provenance ?? [],
    temporalContext: row.temporal_context ?? [],
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };

  if (row.record_kind === "temporal_assertion") {
    record.timeRole = row.time_role ?? "unspecified";
    record.structuredDate = row.structured_date;
    record.chronology = {
      sortable:
        row.chronology_start_year !== null
        && row.chronology_end_year !== null,
      startYear: row.chronology_start_year,
      endYear: row.chronology_end_year,
      basis:
        row.chronology_start_year !== null
        && row.chronology_end_year !== null
          ? "stated-year-era-precision"
          : "label-only-or-unconverted",
    };
    record.proposedDateDetails =
      row.proposed_date_details ?? [];
  }

  if (row.record_kind === "relationship") {
    const rawValidity =
      record.validity
      && typeof record.validity === "object"
      && !Array.isArray(record.validity)
        ? record.validity as Record<string, unknown>
        : {};
    record.reviewStatus = row.review_status;
    record.temporalLinks =
      row.relationship_temporal_links ?? [];
    record.validitySources =
      row.relationship_validity_sources ?? [];
    record.validity = {
      ...rawValidity,
      temporalLinks: row.relationship_temporal_links ?? [],
      sourceIds: row.relationship_validity_sources ?? [],
    };
  }

  return record;
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
    temporal.time_role,
    temporal.structured_date,
    temporal.chronology_start_year,
    temporal.chronology_end_year,
    relationship.review_status,
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
    ,
    COALESCE(
      (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', alias.alias_id,
            'entityId', alias.entity_context_id,
            'text', alias.alias_text,
            'aliasType', alias.alias_type,
            'languageTag', alias.language_tag,
            'scriptIdentifier', alias.script_identifier,
            'notes', alias.notes,
            'uncertainty', alias.uncertainty,
            'status', alias.status,
            'temporalAssertionId', alias.temporal_context_id,
            'sourceIds',
              COALESCE(
                (
                  SELECT JSONB_AGG(alias_source.source_id ORDER BY alias_source.source_id)
                  FROM context_entity_alias_sources alias_source
                  WHERE alias_source.alias_id = alias.alias_id
                ),
                '[]'::JSONB
              ),
            'createdAt', alias.created_at,
            'updatedAt', alias.updated_at
          )
          ORDER BY alias.alias_text, alias.alias_id
        )
        FROM context_entity_aliases alias
        WHERE alias.entity_context_id = cr.context_id
      ),
      '[]'::JSONB
    ) AS aliases,
    COALESCE(
      (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', identifier.identifier_id,
            'entityId', identifier.entity_context_id,
            'scheme', identifier.identifier_scheme,
            'value', identifier.identifier_value,
            'normalizedValue', identifier.normalized_value,
            'uri', identifier.identifier_uri,
            'label', identifier.label,
            'status', identifier.status,
            'notes', identifier.notes,
            'uncertainty', identifier.uncertainty,
            'sourceIds',
              COALESCE(
                (
                  SELECT JSONB_AGG(identifier_source.source_id ORDER BY identifier_source.source_id)
                  FROM context_entity_identifier_sources identifier_source
                  WHERE identifier_source.identifier_id = identifier.identifier_id
                ),
                '[]'::JSONB
              ),
            'createdAt', identifier.created_at,
            'updatedAt', identifier.updated_at
          )
          ORDER BY identifier.identifier_scheme, identifier.identifier_value, identifier.identifier_id
        )
        FROM context_entity_identifiers identifier
        WHERE identifier.entity_context_id = cr.context_id
      ),
      '[]'::JSONB
    ) AS external_identifiers,
    COALESCE(
      (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', identity_record.context_id,
            'fromId', identity.from_context_id,
            'toId', identity.to_context_id,
            'relationshipType', identity.relationship_type,
            'explanation', identity.explanation,
            'confidence', identity.confidence,
            'uncertainty', identity.uncertainty,
            'reviewStatus', identity.review_status,
            'sourceIds',
              COALESCE(
                (
                  SELECT JSONB_AGG(identity_source.source_id ORDER BY identity_source.source_id)
                  FROM context_record_sources identity_source
                  WHERE identity_source.context_id = identity.context_id
                ),
                '[]'::JSONB
              )
          )
          ORDER BY identity.relationship_type, identity_record.context_id
        )
        FROM context_relationships identity
        JOIN context_records identity_record
          ON identity_record.context_id = identity.context_id
        WHERE (
          identity.from_context_id = cr.context_id
          OR identity.to_context_id = cr.context_id
        )
          AND identity.relationship_type IN (
            'possible_same_as',
            'asserted_same_as',
            'distinct_from',
            'derived_from',
            'successor_of',
            'predecessor_of'
          )
          AND identity_record.status <> 'governance-withdrawn'
      ),
      '[]'::JSONB
    ) AS identity_links,
    COALESCE(
      (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', provenance.provenance_id,
            'targetId', provenance.context_id,
            'fieldPath', provenance.field_path,
            'subrecordType', provenance.subrecord_type,
            'subrecordId', provenance.subrecord_id,
            'sourceId', provenance.source_id,
            'supportType', provenance.support_type,
            'note', provenance.note,
            'confidence', provenance.confidence,
            'uncertainty', provenance.uncertainty,
            'createdAt', provenance.created_at
          )
          ORDER BY provenance.field_path, provenance.provenance_id
        )
        FROM context_field_provenance provenance
        WHERE provenance.context_id = cr.context_id
      ),
      '[]'::JSONB
    ) AS field_provenance,
    COALESCE(
      (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', subject_time.context_id,
            'temporalKind', subject_time.temporal_kind,
            'timeRole', subject_time.time_role,
            'dateLabel', subject_time.date_label,
            'structuredDate', subject_time.structured_date,
            'chronology',
              JSONB_BUILD_OBJECT(
                'sortable',
                  subject_time.chronology_start_year IS NOT NULL
                  AND subject_time.chronology_end_year IS NOT NULL,
                'startYear', subject_time.chronology_start_year,
                'endYear', subject_time.chronology_end_year
              )
          )
          ORDER BY subject_time.time_role, subject_time.context_id
        )
        FROM context_temporal_assertions subject_time
        WHERE subject_time.subject_context_id = cr.context_id
      ),
      '[]'::JSONB
    ) AS temporal_context,
    COALESCE(
      (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', proposal.proposal_id,
            'date', proposal.proposed_date,
            'label', proposal.date_label,
            'structuredDate', proposal.structured_date,
            'precision', proposal.precision,
            'uncertainty', proposal.uncertainty,
            'note', proposal.note,
            'chronology',
              JSONB_BUILD_OBJECT(
                'sortable',
                  proposal.chronology_start_year IS NOT NULL
                  AND proposal.chronology_end_year IS NOT NULL,
                'startYear', proposal.chronology_start_year,
                'endYear', proposal.chronology_end_year
              ),
            'sourceIds',
              COALESCE(
                (
                  SELECT JSONB_AGG(proposal_source.source_id ORDER BY proposal_source.source_id)
                  FROM context_temporal_proposal_sources proposal_source
                  WHERE proposal_source.proposal_id = proposal.proposal_id
                ),
                '[]'::JSONB
              )
          )
          ORDER BY proposal.proposal_id
        )
        FROM context_temporal_proposals proposal
        WHERE proposal.temporal_context_id = cr.context_id
      ),
      '[]'::JSONB
    ) AS proposed_date_details,
    COALESCE(
      (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'temporalAssertionId', validity.temporal_context_id,
            'linkType', validity.link_type,
            'note', validity.note,
            'sourceIds',
              COALESCE(
                (
                  SELECT JSONB_AGG(validity_source.source_id ORDER BY validity_source.source_id)
                  FROM context_relationship_temporal_sources validity_source
                  WHERE validity_source.relationship_context_id = validity.relationship_context_id
                    AND validity_source.temporal_context_id = validity.temporal_context_id
                    AND validity_source.link_type = validity.link_type
                ),
                '[]'::JSONB
              )
          )
          ORDER BY validity.link_type, validity.temporal_context_id
        )
        FROM context_relationship_temporal_links validity
        WHERE validity.relationship_context_id = cr.context_id
      ),
      '[]'::JSONB
    ) AS relationship_temporal_links,
    COALESCE(
      (
        SELECT ARRAY_AGG(validity_source.source_id ORDER BY validity_source.source_id)
        FROM context_relationship_validity_sources validity_source
        WHERE validity_source.relationship_context_id = cr.context_id
      ),
      ARRAY[]::TEXT[]
    ) AS relationship_validity_sources
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
        AND ($2::TEXT IS NULL OR cr.record_kind = $2)
        AND cr.status <> 'governance-withdrawn';
    `,
    [contextId, recordKind ?? null],
  );
  const row = result.rows[0];
  if (!row) {
    return undefined;
  }
  const record = mapContextRecord(row);
  if (row.record_kind === "claim" || row.record_kind === "evidence") {
    Object.assign(
      record,
      await getContextExtensionDetail(row.record_kind, contextId),
    );
  }
  return record;
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
  addEquals("temporal.time_role", options.timeRole);
  addEquals("claim.account_context_id", options.accountId);
  addEquals("evidence.claim_context_id", options.claimId);
  addEquals("evidence.evidence_type", options.evidenceType);
  addEquals("causal.causal_kind", options.causalKind);
  addEquals("relationship.from_context_id", options.fromId);
  addEquals("relationship.to_context_id", options.toId);
  conditions.push("cr.status <> 'governance-withdrawn'");

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

  if (options.validAt !== undefined) {
    values.push(options.validAt);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM context_relationship_temporal_links validity_link
        JOIN context_temporal_assertions validity_time
          ON validity_time.context_id = validity_link.temporal_context_id
        WHERE validity_link.relationship_context_id = cr.context_id
          AND validity_link.link_type = 'valid_during'
          AND COALESCE(
            validity_time.start_date,
            validity_time.exact_date
          ) <= $${values.length}::DATE
          AND COALESCE(
            validity_time.end_date,
            validity_time.exact_date
          ) >= $${values.length}::DATE
      )
    `);
  }

  if (options.validFrom !== undefined) {
    values.push(options.validFrom);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM context_relationship_temporal_links validity_link
        JOIN context_temporal_assertions validity_time
          ON validity_time.context_id = validity_link.temporal_context_id
        WHERE validity_link.relationship_context_id = cr.context_id
          AND validity_link.link_type = 'valid_during'
          AND COALESCE(
            validity_time.end_date,
            validity_time.exact_date
          ) >= $${values.length}::DATE
      )
    `);
  }

  if (options.validTo !== undefined) {
    values.push(options.validTo);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM context_relationship_temporal_links validity_link
        JOIN context_temporal_assertions validity_time
          ON validity_time.context_id = validity_link.temporal_context_id
        WHERE validity_link.relationship_context_id = cr.context_id
          AND validity_link.link_type = 'valid_during'
          AND COALESCE(
            validity_time.start_date,
            validity_time.exact_date
          ) <= $${values.length}::DATE
      )
    `);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  const offset =
    options.offset ?? (options.page - 1) * options.limit;
  const sortColumns = {
    label: "cr.label",
    createdAt: "cr.created_at",
    updatedAt: "cr.updated_at",
    recordId: "cr.context_id",
  } as const;
  const sortColumn = sortColumns[options.sort ?? "label"];
  const direction = options.direction === "desc" ? "DESC" : "ASC";
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
        ORDER BY ${sortColumn} ${direction}, cr.context_id ASC
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

export async function listEntityAliases(
  options: ListEntityAliasesOptions,
): Promise<ListContextChildrenResult> {
  const database = requireDatabase();
  const conditions = ["alias.entity_context_id = $1"];
  const values: Array<string | number> = [options.entityId];
  const addEquals = (column: string, value: string | undefined) => {
    if (value === undefined) return;
    values.push(value);
    conditions.push(`${column} = $${values.length}`);
  };

  addEquals("alias.alias_type", options.aliasType);
  addEquals("alias.language_tag", options.languageTag);
  addEquals("alias.status", options.status);
  if (options.sourceId !== undefined) {
    values.push(options.sourceId);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM context_entity_alias_sources source_filter
        WHERE source_filter.alias_id = alias.alias_id
          AND source_filter.source_id = $${values.length}
      )
    `);
  }

  const sortColumns = {
    text: "alias.alias_text",
    createdAt: "alias.created_at",
    updatedAt: "alias.updated_at",
    aliasId: "alias.alias_id",
  } as const;
  const sortColumn = sortColumns[options.sort ?? "text"];
  const direction = options.direction === "desc" ? "DESC" : "ASC";
  const offset =
    options.offset ?? (options.page - 1) * options.limit;
  const where = `WHERE ${conditions.join(" AND ")}`;
  const countResult = await database.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM context_entity_aliases alias
      ${where};
    `,
    values,
  );
  const recordsResult = await database.query<{
    item: Record<string, unknown>;
  }>(
    `
      SELECT JSONB_BUILD_OBJECT(
        'id', alias.alias_id,
        'entityId', alias.entity_context_id,
        'text', alias.alias_text,
        'aliasType', alias.alias_type,
        'languageTag', alias.language_tag,
        'scriptIdentifier', alias.script_identifier,
        'notes', alias.notes,
        'uncertainty', alias.uncertainty,
        'status', alias.status,
        'temporalAssertionId', alias.temporal_context_id,
        'sourceIds',
          COALESCE(
            (
              SELECT JSONB_AGG(source.source_id ORDER BY source.source_id)
              FROM context_entity_alias_sources source
              WHERE source.alias_id = alias.alias_id
            ),
            '[]'::JSONB
          ),
        'createdAt', alias.created_at,
        'updatedAt', alias.updated_at
      ) AS item
      FROM context_entity_aliases alias
      ${where}
      ORDER BY ${sortColumn} ${direction}, alias.alias_id ASC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2};
    `,
    [...values, options.limit, offset],
  );
  const total = Number(countResult.rows[0]?.count ?? 0);
  return {
    page: options.page,
    limit: options.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
    items: recordsResult.rows.map((row) => row.item),
  };
}

export async function listEntityIdentifiers(
  options: ListEntityIdentifiersOptions,
): Promise<ListContextChildrenResult> {
  const database = requireDatabase();
  const conditions = ["identifier.entity_context_id = $1"];
  const values: Array<string | number> = [options.entityId];
  const addEquals = (column: string, value: string | undefined) => {
    if (value === undefined) return;
    values.push(value);
    conditions.push(`${column} = $${values.length}`);
  };

  addEquals("identifier.identifier_scheme", options.scheme);
  addEquals("identifier.status", options.status);
  if (options.sourceId !== undefined) {
    values.push(options.sourceId);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM context_entity_identifier_sources source_filter
        WHERE source_filter.identifier_id = identifier.identifier_id
          AND source_filter.source_id = $${values.length}
      )
    `);
  }

  const sortColumns = {
    scheme: "identifier.identifier_scheme",
    value: "identifier.identifier_value",
    createdAt: "identifier.created_at",
    updatedAt: "identifier.updated_at",
    identifierId: "identifier.identifier_id",
  } as const;
  const sortColumn = sortColumns[options.sort ?? "scheme"];
  const direction = options.direction === "desc" ? "DESC" : "ASC";
  const offset =
    options.offset ?? (options.page - 1) * options.limit;
  const where = `WHERE ${conditions.join(" AND ")}`;
  const countResult = await database.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM context_entity_identifiers identifier
      ${where};
    `,
    values,
  );
  const recordsResult = await database.query<{
    item: Record<string, unknown>;
  }>(
    `
      SELECT JSONB_BUILD_OBJECT(
        'id', identifier.identifier_id,
        'entityId', identifier.entity_context_id,
        'scheme', identifier.identifier_scheme,
        'value', identifier.identifier_value,
        'normalizedValue', identifier.normalized_value,
        'uri', identifier.identifier_uri,
        'label', identifier.label,
        'status', identifier.status,
        'notes', identifier.notes,
        'uncertainty', identifier.uncertainty,
        'sourceIds',
          COALESCE(
            (
              SELECT JSONB_AGG(source.source_id ORDER BY source.source_id)
              FROM context_entity_identifier_sources source
              WHERE source.identifier_id = identifier.identifier_id
            ),
            '[]'::JSONB
          ),
        'createdAt', identifier.created_at,
        'updatedAt', identifier.updated_at
      ) AS item
      FROM context_entity_identifiers identifier
      ${where}
      ORDER BY ${sortColumn} ${direction}, identifier.identifier_id ASC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2};
    `,
    [...values, options.limit, offset],
  );
  const total = Number(countResult.rows[0]?.count ?? 0);
  return {
    page: options.page,
    limit: options.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
    items: recordsResult.rows.map((row) => row.item),
  };
}
