import { getPool } from "../lib/database.js";
import type { PaginationQuery } from "../lib/query-params.js";
import { getContextRecordBaseById } from "./context-store.js";

type JsonRecord = Record<string, unknown>;

const PUBLIC_RECORD_CONDITION =
  "record.status <> 'governance-withdrawn'";
const PUBLIC_VERSION_CONDITION =
  "version.version_status <> 'draft'";

export interface ContextRecordReviewOptions {
  pagination: PaginationQuery;
  query?: string;
  status?: string;
}

export interface ContextClaimReviewOptions {
  requestedVersionId?: string;
  versions: PaginationQuery;
  evidence: PaginationQuery;
  relations: PaginationQuery;
  provenance: PaginationQuery;
}

interface ReviewClaimRow {
  item: JsonRecord;
}

interface ReviewCountRow {
  count: string;
}

interface ClaimIdentityRow {
  item: JsonRecord;
  subject_context_id: string;
  account_context_id: string;
}

interface SourceRow {
  item: JsonRecord;
}

function requireDatabase() {
  const database = getPool();
  if (!database) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return database;
}

function paginationMetadata(
  pagination: PaginationQuery,
  total: number,
  returned: number,
) {
  const totalPages =
    total === 0 ? 0 : Math.ceil(total / pagination.limit);
  return {
    page: pagination.page,
    limit: pagination.limit,
    offset: pagination.offset,
    returned,
    total,
    totalPages,
    hasMore: pagination.offset + returned < total,
    totalSemantics: "exact" as const,
  };
}

function groupItems(
  items: JsonRecord[],
  key: string,
  missingKey: string,
): Record<string, JsonRecord[]> {
  const groups: Record<string, JsonRecord[]> = {};
  for (const item of items) {
    const raw = item[key];
    const group =
      typeof raw === "string" && raw.trim() ? raw : missingKey;
    (groups[group] ??= []).push(item);
  }
  return groups;
}

function groupProvenance(
  items: JsonRecord[],
): Record<string, JsonRecord[]> {
  return groupItems(items, "fieldPath", "field_not_recorded");
}

export async function getContextRecordReview(
  recordId: string,
  options: ContextRecordReviewOptions,
) {
  const database = requireDatabase();
  const record = await getContextRecordBaseById(recordId);
  if (!record) {
    return undefined;
  }

  const conditions = [
    "claim.subject_context_id = $1",
    "record.status <> 'governance-withdrawn'",
  ];
  const values: Array<string | number> = [recordId];
  if (options.query) {
    values.push(`%${options.query}%`);
    conditions.push(`(
      record.context_id ILIKE $${values.length}
      OR record.label ILIKE $${values.length}
      OR claim.statement ILIKE $${values.length}
      OR claim.claim_type ILIKE $${values.length}
    )`);
  }
  if (options.status) {
    values.push(options.status);
    conditions.push(`record.status = $${values.length}`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const [countResult, claimsResult] = await Promise.all([
    database.query<ReviewCountRow>(
      `
        SELECT COUNT(*) AS count
        FROM context_claims claim
        JOIN context_records record
          ON record.context_id = claim.context_id
        ${where};
      `,
      values,
    ),
    database.query<ReviewClaimRow>(
      `
        SELECT JSONB_BUILD_OBJECT(
          'id', record.context_id,
          'recordKind', record.record_kind,
          'label', record.label,
          'status', record.status,
          'claimType', claim.claim_type,
          'statement', claim.statement,
          'confidence', claim.confidence,
          'uncertainty', claim.uncertainty,
          'subjectId', claim.subject_context_id,
          'accountId', claim.account_context_id,
          'currentVersionId', current_version.version_id,
          'attributionRoles',
            COALESCE(
              (
                SELECT JSONB_AGG(
                  DISTINCT attribution.attribution_role
                  ORDER BY attribution.attribution_role
                )
                FROM context_claim_attributions attribution
                WHERE attribution.claim_context_id = claim.context_id
              ),
              '[]'::JSONB
            ),
          'counts', JSONB_BUILD_OBJECT(
            'versions',
              (
                SELECT COUNT(*)
                FROM context_claim_versions version
                WHERE version.claim_context_id = claim.context_id
                  AND version.version_status <> 'draft'
              ),
            'evidence',
              (
                SELECT COUNT(*)
                FROM (
                  SELECT link.link_id
                  FROM context_evidence_claim_links link
                  JOIN context_records evidence_record
                    ON evidence_record.context_id = link.evidence_context_id
                  WHERE link.claim_context_id = claim.context_id
                    AND evidence_record.status <> 'governance-withdrawn'
                  UNION ALL
                  SELECT evidence.context_id
                  FROM context_evidence evidence
                  JOIN context_records evidence_record
                    ON evidence_record.context_id = evidence.context_id
                  WHERE evidence.claim_context_id = claim.context_id
                    AND evidence_record.status <> 'governance-withdrawn'
                    AND NOT EXISTS (
                      SELECT 1
                      FROM context_evidence_claim_links explicit_link
                      WHERE explicit_link.claim_context_id = claim.context_id
                        AND explicit_link.evidence_context_id = evidence.context_id
                    )
                ) evidence_item
              ),
            'relationships',
              (
                SELECT COUNT(*)
                FROM context_claim_relations relation
                JOIN context_records related_record
                  ON related_record.context_id = CASE
                    WHEN relation.from_claim_context_id = claim.context_id
                      THEN relation.to_claim_context_id
                    ELSE relation.from_claim_context_id
                  END
                WHERE (
                  relation.from_claim_context_id = claim.context_id
                  OR relation.to_claim_context_id = claim.context_id
                )
                  AND related_record.status <> 'governance-withdrawn'
              ),
            'attributions',
              (
                SELECT COUNT(*)
                FROM context_claim_attributions attribution
                WHERE attribution.claim_context_id = claim.context_id
              )
          ),
          'createdAt', record.created_at,
          'updatedAt', record.updated_at
        ) AS item
        FROM context_claims claim
        JOIN context_records record
          ON record.context_id = claim.context_id
        LEFT JOIN context_claim_current_versions current_version
          ON current_version.claim_context_id = claim.context_id
        ${where}
        ORDER BY LOWER(record.label), record.context_id
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2};
      `,
      [
        ...values,
        options.pagination.limit,
        options.pagination.offset,
      ],
    ),
  ]);
  const total = Number(countResult.rows[0]?.count ?? 0);
  const claims = claimsResult.rows.map((row) => row.item);
  return {
    record,
    claims,
    items: claims,
    ...paginationMetadata(
      options.pagination,
      total,
      claims.length,
    ),
  };
}

async function loadClaimIdentity(claimId: string) {
  const database = requireDatabase();
  const result = await database.query<ClaimIdentityRow>(
    `
      SELECT
        claim.subject_context_id,
        claim.account_context_id,
        JSONB_BUILD_OBJECT(
          'id', record.context_id,
          'recordKind', record.record_kind,
          'bundleId', record.bundle_id,
          'domain', record.domain,
          'label', record.label,
          'summary', record.summary,
          'status', record.status,
          'sourceIds',
            COALESCE(
              (
                SELECT JSONB_AGG(source.source_id ORDER BY source.source_id)
                FROM context_record_sources source
                WHERE source.context_id = record.context_id
              ),
              '[]'::JSONB
            ),
          'accountId', claim.account_context_id,
          'subjectId', claim.subject_context_id,
          'objectId', claim.object_context_id,
          'claimType', claim.claim_type,
          'statement', claim.statement,
          'confidence', claim.confidence,
          'uncertainty', claim.uncertainty,
          'fieldProvenanceCount',
            (
              SELECT COUNT(*)
              FROM context_field_provenance provenance
              WHERE provenance.context_id = claim.context_id
            ),
          'createdAt', record.created_at,
          'updatedAt', record.updated_at
        ) AS item
      FROM context_claims claim
      JOIN context_records record
        ON record.context_id = claim.context_id
      WHERE claim.context_id = $1
        AND ${PUBLIC_RECORD_CONDITION};
    `,
    [claimId],
  );
  return result.rows[0];
}

async function loadClaimVersions(
  claimId: string,
  pagination: PaginationQuery,
) {
  const database = requireDatabase();
  const [countResult, rowsResult] = await Promise.all([
    database.query<ReviewCountRow>(
      `
        SELECT COUNT(*) AS count
        FROM context_claim_versions version
        WHERE version.claim_context_id = $1
          AND ${PUBLIC_VERSION_CONDITION};
      `,
      [claimId],
    ),
    database.query<ReviewClaimRow>(
      `
        SELECT JSONB_BUILD_OBJECT(
          'id', version.version_id,
          'claimId', version.claim_context_id,
          'ordinal', version.version_ordinal,
          'priorVersionId', version.prior_version_id,
          'successorVersionIds',
            COALESCE(
              (
                SELECT JSONB_AGG(
                  successor.version_id
                  ORDER BY successor.version_ordinal NULLS LAST,
                    successor.created_at,
                    successor.version_id
                )
                FROM context_claim_versions successor
                WHERE successor.claim_context_id = version.claim_context_id
                  AND successor.prior_version_id = version.version_id
                  AND successor.version_status <> 'draft'
              ),
              '[]'::JSONB
            ),
          'statement', version.statement,
          'claimType', version.claim_type,
          'subjectId', version.subject_context_id,
          'objectId', version.object_context_id,
          'confidence', version.confidence,
          'uncertainty', version.uncertainty,
          'status', version.version_status,
          'changeType', version.change_type,
          'changeReason', version.change_reason,
          'attributionSnapshot', version.attribution_snapshot,
          'attributionIds', TO_JSONB(version.attribution_ids),
          'sourceIds', TO_JSONB(version.source_ids),
          'assertedTemporalAssertionId',
            version.asserted_temporal_context_id,
          'contentHash', version.content_hash,
          'origin', version.origin,
          'governance', JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
            'proposalId', version.governance_proposal_id,
            'publicationId', version.governance_publication_id,
            'revisionId', version.governance_revision_id
          )),
          'createdAt', version.created_at,
          'current', current_version.version_id IS NOT NULL
        ) AS item
        FROM context_claim_versions version
        LEFT JOIN context_claim_current_versions current_version
          ON current_version.claim_context_id = version.claim_context_id
          AND current_version.version_id = version.version_id
        WHERE version.claim_context_id = $1
          AND ${PUBLIC_VERSION_CONDITION}
        ORDER BY
          version.version_ordinal NULLS LAST,
          version.created_at,
          version.version_id
        LIMIT $2 OFFSET $3;
      `,
      [claimId, pagination.limit, pagination.offset],
    ),
  ]);
  const total = Number(countResult.rows[0]?.count ?? 0);
  const items = rowsResult.rows.map((row) => row.item);
  return {
    items,
    pagination: paginationMetadata(
      pagination,
      total,
      items.length,
    ),
  };
}

async function loadRequestedClaimVersion(
  claimId: string,
  versionId: string,
) {
  const database = requireDatabase();
  const result = await database.query<ReviewClaimRow>(
    `
      SELECT JSONB_BUILD_OBJECT(
        'id', version.version_id,
        'claimId', version.claim_context_id,
        'ordinal', version.version_ordinal,
        'priorVersionId', version.prior_version_id,
        'successorVersionIds',
          COALESCE(
            (
              SELECT JSONB_AGG(
                successor.version_id
                ORDER BY successor.version_ordinal NULLS LAST,
                  successor.created_at,
                  successor.version_id
              )
              FROM context_claim_versions successor
              WHERE successor.claim_context_id = version.claim_context_id
                AND successor.prior_version_id = version.version_id
                AND successor.version_status <> 'draft'
            ),
            '[]'::JSONB
          ),
        'statement', version.statement,
        'claimType', version.claim_type,
        'subjectId', version.subject_context_id,
        'objectId', version.object_context_id,
        'confidence', version.confidence,
        'uncertainty', version.uncertainty,
        'status', version.version_status,
        'changeType', version.change_type,
        'changeReason', version.change_reason,
        'attributionSnapshot', version.attribution_snapshot,
        'attributionIds', TO_JSONB(version.attribution_ids),
        'sourceIds', TO_JSONB(version.source_ids),
        'assertedTemporalAssertionId',
          version.asserted_temporal_context_id,
        'contentHash', version.content_hash,
        'origin', version.origin,
        'governance', JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
          'proposalId', version.governance_proposal_id,
          'publicationId', version.governance_publication_id,
          'revisionId', version.governance_revision_id
        )),
        'createdAt', version.created_at,
        'current', current_version.version_id IS NOT NULL
      ) AS item
      FROM context_claim_versions version
      LEFT JOIN context_claim_current_versions current_version
        ON current_version.claim_context_id = version.claim_context_id
        AND current_version.version_id = version.version_id
      WHERE version.claim_context_id = $1
        AND version.version_id = $2
        AND ${PUBLIC_VERSION_CONDITION};
    `,
    [claimId, versionId],
  );
  return result.rows[0]?.item;
}

async function loadAttributions(claimId: string) {
  const database = requireDatabase();
  const maximum = 50;
  const [countResult, rowsResult] = await Promise.all([
    database.query<ReviewCountRow>(
      `
        SELECT COUNT(*) AS count
        FROM context_claim_attributions attribution
        WHERE attribution.claim_context_id = $1;
      `,
      [claimId],
    ),
    database.query<ReviewClaimRow>(
      `
        SELECT JSONB_BUILD_OBJECT(
          'id', attribution.attribution_id,
          'claimId', attribution.claim_context_id,
          'attributionRole', attribution.attribution_role,
          'actorEntityId', attribution.actor_entity_context_id,
          'actor',
            CASE
              WHEN actor_record.context_id IS NULL THEN NULL
              ELSE JSONB_BUILD_OBJECT(
                'id', actor_record.context_id,
                'label', actor_record.label,
                'entityType', actor.entity_type,
                'name', actor.canonical_name
              )
            END,
          'accountId', attribution.account_context_id,
          'account',
            CASE
              WHEN account_record.context_id IS NULL THEN NULL
              ELSE JSONB_BUILD_OBJECT(
                'id', account_record.context_id,
                'label', account_record.label,
                'accountType', account.account_type,
                'publicationLabel', account.publication_label
              )
            END,
          'temporalAssertionId', attribution.temporal_context_id,
          'temporal',
            CASE
              WHEN temporal_record.context_id IS NULL THEN NULL
              ELSE JSONB_BUILD_OBJECT(
                'id', temporal_record.context_id,
                'label', temporal_record.label,
                'dateLabel', temporal.date_label,
                'timeRole', temporal.time_role,
                'structuredDate', temporal.structured_date
              )
            END,
          'note', attribution.note,
          'confidence', attribution.confidence,
          'uncertainty', attribution.uncertainty,
          'sourceIds',
            COALESCE(
              (
                SELECT JSONB_AGG(source.source_id ORDER BY source.source_id)
                FROM context_claim_attribution_sources source
                WHERE source.attribution_id = attribution.attribution_id
              ),
              '[]'::JSONB
            ),
          'createdAt', attribution.created_at,
          'updatedAt', attribution.updated_at
        ) AS item
        FROM context_claim_attributions attribution
        LEFT JOIN context_records actor_record
          ON actor_record.context_id = attribution.actor_entity_context_id
          AND actor_record.status <> 'governance-withdrawn'
        LEFT JOIN context_entities actor
          ON actor.context_id = actor_record.context_id
        LEFT JOIN context_records account_record
          ON account_record.context_id = attribution.account_context_id
          AND account_record.status <> 'governance-withdrawn'
        LEFT JOIN context_accounts account
          ON account.context_id = account_record.context_id
        LEFT JOIN context_records temporal_record
          ON temporal_record.context_id = attribution.temporal_context_id
          AND temporal_record.status <> 'governance-withdrawn'
        LEFT JOIN context_temporal_assertions temporal
          ON temporal.context_id = temporal_record.context_id
        WHERE attribution.claim_context_id = $1
        ORDER BY attribution.attribution_role, attribution.attribution_id
        LIMIT $2;
      `,
      [claimId, maximum],
    ),
  ]);
  const total = Number(countResult.rows[0]?.count ?? 0);
  const items = rowsResult.rows.map((row) => row.item);
  return {
    items,
    groups: groupItems(
      items,
      "attributionRole",
      "role_not_recorded",
    ),
    pagination: {
      page: 1,
      limit: maximum,
      offset: 0,
      returned: items.length,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / maximum),
      hasMore: items.length < total,
      totalSemantics: "exact" as const,
    },
  };
}

async function loadEvidenceReview(
  claimId: string,
  pagination: PaginationQuery,
) {
  const database = requireDatabase();
  const evidenceCte = `
    WITH evidence_entries AS (
      SELECT
        link.link_id AS entry_id,
        link.evidence_context_id,
        link.claim_version_id,
        link.support_role,
        link.scope_path,
        link.explanation AS link_explanation,
        link.relevance,
        link.confidence AS link_confidence,
        link.uncertainty AS link_uncertainty,
        TRUE AS normalized_link_supplied,
        link.created_at,
        COALESCE(
          (
            SELECT ARRAY_AGG(source.source_id ORDER BY source.source_id)
            FROM context_evidence_claim_link_sources source
            WHERE source.link_id = link.link_id
          ),
          ARRAY[]::TEXT[]
        ) AS link_source_ids
      FROM context_evidence_claim_links link
      JOIN context_records evidence_record
        ON evidence_record.context_id = link.evidence_context_id
      WHERE link.claim_context_id = $1
        AND evidence_record.status <> 'governance-withdrawn'

      UNION ALL

      SELECT
        'legacy:' || evidence.context_id AS entry_id,
        evidence.context_id AS evidence_context_id,
        NULL::TEXT AS claim_version_id,
        NULL::TEXT AS support_role,
        NULL::TEXT AS scope_path,
        NULL::TEXT AS link_explanation,
        NULL::TEXT AS relevance,
        NULL::TEXT AS link_confidence,
        NULL::TEXT AS link_uncertainty,
        FALSE AS normalized_link_supplied,
        evidence_record.created_at,
        ARRAY[]::TEXT[] AS link_source_ids
      FROM context_evidence evidence
      JOIN context_records evidence_record
        ON evidence_record.context_id = evidence.context_id
      WHERE evidence.claim_context_id = $1
        AND evidence_record.status <> 'governance-withdrawn'
        AND NOT EXISTS (
          SELECT 1
          FROM context_evidence_claim_links explicit_link
          WHERE explicit_link.claim_context_id = $1
            AND explicit_link.evidence_context_id = evidence.context_id
        )
    )
  `;
  const [countResult, rowsResult] = await Promise.all([
    database.query<ReviewCountRow>(
      `
        ${evidenceCte}
        SELECT COUNT(*) AS count FROM evidence_entries;
      `,
      [claimId],
    ),
    database.query<ReviewClaimRow>(
      `
        ${evidenceCte}
        SELECT JSONB_BUILD_OBJECT(
          'id', entry.entry_id,
          'normalizedLinkSupplied', entry.normalized_link_supplied,
          'claimVersionId', entry.claim_version_id,
          'supportRole', entry.support_role,
          'scopePath', entry.scope_path,
          'linkExplanation', entry.link_explanation,
          'relevance', entry.relevance,
          'linkConfidence', entry.link_confidence,
          'linkUncertainty', entry.link_uncertainty,
          'linkSourceIds', TO_JSONB(entry.link_source_ids),
          'evidence', JSONB_BUILD_OBJECT(
            'id', evidence_record.context_id,
            'label', evidence_record.label,
            'status', evidence_record.status,
            'evidenceType', evidence.evidence_type,
            'legacyClaimId', evidence.claim_context_id,
            'sourceId', evidence.source_id,
            'accountId', evidence.account_context_id,
            'evidenceRecordId', evidence.evidence_context_id,
            'explanation', evidence.explanation,
            'strength', evidence.strength,
            'confidence', evidence.confidence,
            'uncertainty', evidence.uncertainty,
            'sourceIds',
              COALESCE(
                (
                  SELECT JSONB_AGG(source.source_id ORDER BY source.source_id)
                  FROM context_record_sources source
                  WHERE source.context_id = evidence.context_id
                ),
                '[]'::JSONB
              ),
            'currentVersion',
              (
                SELECT JSONB_BUILD_OBJECT(
                  'id', version.version_id,
                  'ordinal', version.version_ordinal,
                  'priorVersionId', version.prior_version_id,
                  'evidenceType', version.evidence_type,
                  'explanation', version.explanation,
                  'strength', version.strength,
                  'confidence', version.confidence,
                  'uncertainty', version.uncertainty,
                  'sourceId', version.source_id,
                  'accountId', version.account_context_id,
                  'evidenceRecordId', version.evidence_record_context_id,
                  'evidentiaryBasis', version.evidentiary_basis,
                  'sourceLocator', version.source_locator,
                  'sourceIds', TO_JSONB(version.source_ids),
                  'supportRole', version.support_role,
                  'status', version.version_status,
                  'changeType', version.change_type,
                  'changeReason', version.change_reason,
                  'contentHash', version.content_hash,
                  'origin', version.origin,
                  'governance', JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
                    'proposalId', version.governance_proposal_id,
                    'publicationId', version.governance_publication_id,
                    'revisionId', version.governance_revision_id
                  )),
                  'createdAt', version.created_at,
                  'current', TRUE
                )
                FROM context_evidence_current_versions pointer
                JOIN context_evidence_versions version
                  ON version.evidence_context_id =
                    pointer.evidence_context_id
                  AND version.version_id = pointer.version_id
                WHERE pointer.evidence_context_id = evidence.context_id
                  AND version.version_status <> 'draft'
              ),
            'versionCount',
              (
                SELECT COUNT(*)
                FROM context_evidence_versions version
                WHERE version.evidence_context_id = evidence.context_id
                  AND version.version_status <> 'draft'
              )
          ),
          'sourceLocators',
            COALESCE(
              (
                SELECT JSONB_AGG(locator_item.item ORDER BY locator_item.locator_type, locator_item.locator_id)
                FROM (
                  SELECT
                    locator.locator_type,
                    locator.locator_id,
                    JSONB_BUILD_OBJECT(
                      'id', locator.locator_id,
                      'evidenceId', locator.evidence_context_id,
                      'sourceId', locator.source_id,
                      'locatorType', locator.locator_type,
                      'locatorLabel', locator.locator_label,
                      'locator', locator.locator_data,
                      'excerpt', locator.excerpt,
                      'note', locator.note,
                      'createdAt', locator.created_at,
                      'updatedAt', locator.updated_at
                    ) AS item
                  FROM context_source_locators locator
                  WHERE locator.evidence_context_id = evidence.context_id
                  ORDER BY locator.locator_type, locator.locator_id
                  LIMIT 20
                ) locator_item
              ),
              '[]'::JSONB
            ),
          'sourceLocatorCount',
            (
              SELECT COUNT(*)
              FROM context_source_locators locator
              WHERE locator.evidence_context_id = evidence.context_id
            ),
          'fieldProvenance',
            COALESCE(
              (
                SELECT JSONB_AGG(provenance_item.item ORDER BY provenance_item.field_path, provenance_item.provenance_id)
                FROM (
                  SELECT
                    provenance.field_path,
                    provenance.provenance_id,
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
                    ) AS item
                  FROM context_field_provenance provenance
                  WHERE provenance.context_id = evidence.context_id
                  ORDER BY provenance.field_path, provenance.provenance_id
                  LIMIT 20
                ) provenance_item
              ),
              '[]'::JSONB
            ),
          'fieldProvenanceCount',
            (
              SELECT COUNT(*)
              FROM context_field_provenance provenance
              WHERE provenance.context_id = evidence.context_id
            )
        ) AS item
        FROM evidence_entries entry
        JOIN context_evidence evidence
          ON evidence.context_id = entry.evidence_context_id
        JOIN context_records evidence_record
          ON evidence_record.context_id = evidence.context_id
        ORDER BY
          entry.support_role NULLS LAST,
          entry.evidence_context_id,
          entry.entry_id
        LIMIT $2 OFFSET $3;
      `,
      [claimId, pagination.limit, pagination.offset],
    ),
  ]);
  const total = Number(countResult.rows[0]?.count ?? 0);
  const items = rowsResult.rows.map((row) => row.item);
  return {
    items,
    groups: groupItems(items, "supportRole", "legacy_unclassified"),
    pagination: paginationMetadata(
      pagination,
      total,
      items.length,
    ),
  };
}

async function loadRelatedClaims(
  claimId: string,
  pagination: PaginationQuery,
) {
  const database = requireDatabase();
  const conditions = `
    WHERE (
      relation.from_claim_context_id = $1
      OR relation.to_claim_context_id = $1
    )
      AND related_record.status <> 'governance-withdrawn'
  `;
  const [countResult, rowsResult] = await Promise.all([
    database.query<ReviewCountRow>(
      `
        SELECT COUNT(*) AS count
        FROM context_claim_relations relation
        JOIN context_records related_record
          ON related_record.context_id = CASE
            WHEN relation.from_claim_context_id = $1
              THEN relation.to_claim_context_id
            ELSE relation.from_claim_context_id
          END
        ${conditions};
      `,
      [claimId],
    ),
    database.query<ReviewClaimRow>(
      `
        SELECT JSONB_BUILD_OBJECT(
          'id', relation.relation_id,
          'fromClaimId', relation.from_claim_context_id,
          'toClaimId', relation.to_claim_context_id,
          'direction', CASE
            WHEN relation.from_claim_context_id = $1 THEN 'outgoing'
            ELSE 'incoming'
          END,
          'relationType', relation.relation_type,
          'explanation', relation.explanation,
          'confidence', relation.confidence,
          'uncertainty', relation.uncertainty,
          'reviewStatus', relation.review_status,
          'temporalAssertionId', relation.temporal_context_id,
          'sourceIds',
            COALESCE(
              (
                SELECT JSONB_AGG(source.source_id ORDER BY source.source_id)
                FROM context_claim_relation_sources source
                WHERE source.relation_id = relation.relation_id
              ),
              '[]'::JSONB
            ),
          'relatedClaim', JSONB_BUILD_OBJECT(
            'id', related_record.context_id,
            'label', related_record.label,
            'status', related_record.status,
            'claimType', related_claim.claim_type,
            'statement', related_claim.statement,
            'subjectId', related_claim.subject_context_id,
            'accountId', related_claim.account_context_id,
            'confidence', related_claim.confidence,
            'uncertainty', related_claim.uncertainty,
            'currentVersionId', related_pointer.version_id,
            'currentVersion',
              CASE
                WHEN related_version.version_id IS NULL THEN NULL
                ELSE JSONB_BUILD_OBJECT(
                  'id', related_version.version_id,
                  'statement', related_version.statement,
                  'status', related_version.version_status,
                  'contentHash', related_version.content_hash
                )
              END
          ),
          'createdAt', relation.created_at,
          'updatedAt', relation.updated_at
        ) AS item
        FROM context_claim_relations relation
        JOIN context_records related_record
          ON related_record.context_id = CASE
            WHEN relation.from_claim_context_id = $1
              THEN relation.to_claim_context_id
            ELSE relation.from_claim_context_id
          END
        JOIN context_claims related_claim
          ON related_claim.context_id = related_record.context_id
        LEFT JOIN context_claim_current_versions related_pointer
          ON related_pointer.claim_context_id = related_claim.context_id
        LEFT JOIN context_claim_versions related_version
          ON related_version.claim_context_id = related_pointer.claim_context_id
          AND related_version.version_id = related_pointer.version_id
          AND related_version.version_status <> 'draft'
        ${conditions}
        ORDER BY
          relation.relation_type,
          related_record.context_id,
          relation.relation_id
        LIMIT $2 OFFSET $3;
      `,
      [claimId, pagination.limit, pagination.offset],
    ),
  ]);
  const total = Number(countResult.rows[0]?.count ?? 0);
  const items = rowsResult.rows.map((row) => row.item);
  return {
    items,
    groups: groupItems(items, "relationType", "unclassified"),
    pagination: paginationMetadata(
      pagination,
      total,
      items.length,
    ),
  };
}

async function loadFieldProvenance(
  claimId: string,
  pagination: PaginationQuery,
) {
  const database = requireDatabase();
  const [countResult, rowsResult] = await Promise.all([
    database.query<ReviewCountRow>(
      `
        SELECT COUNT(*) AS count
        FROM context_field_provenance provenance
        WHERE provenance.context_id = $1;
      `,
      [claimId],
    ),
    database.query<ReviewClaimRow>(
      `
        SELECT JSONB_BUILD_OBJECT(
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
        ) AS item
        FROM context_field_provenance provenance
        WHERE provenance.context_id = $1
        ORDER BY provenance.field_path, provenance.provenance_id
        LIMIT $2 OFFSET $3;
      `,
      [claimId, pagination.limit, pagination.offset],
    ),
  ]);
  const total = Number(countResult.rows[0]?.count ?? 0);
  const items = rowsResult.rows.map((row) => row.item);
  return {
    items,
    groups: groupProvenance(items),
    pagination: paginationMetadata(
      pagination,
      total,
      items.length,
    ),
  };
}

async function loadReportingAccount(accountId: string) {
  const database = requireDatabase();
  const result = await database.query<ReviewClaimRow>(
    `
      SELECT JSONB_BUILD_OBJECT(
        'id', record.context_id,
        'label', record.label,
        'status', record.status,
        'subjectId', account.subject_context_id,
        'authorEntityId', account.author_context_id,
        'author',
          CASE
            WHEN author_record.context_id IS NULL THEN NULL
            ELSE JSONB_BUILD_OBJECT(
              'id', author_record.context_id,
              'label', author_record.label,
              'name', author.canonical_name,
              'entityType', author.entity_type
            )
          END,
        'sourceId', account.source_id,
        'accountType', account.account_type,
        'content', account.content,
        'publicationLabel', account.publication_label,
        'sourceIds',
          COALESCE(
            (
              SELECT JSONB_AGG(source.source_id ORDER BY source.source_id)
              FROM context_record_sources source
              WHERE source.context_id = record.context_id
            ),
            '[]'::JSONB
          )
      ) AS item
      FROM context_accounts account
      JOIN context_records record
        ON record.context_id = account.context_id
      LEFT JOIN context_records author_record
        ON author_record.context_id = account.author_context_id
        AND author_record.status <> 'governance-withdrawn'
      LEFT JOIN context_entities author
        ON author.context_id = author_record.context_id
      WHERE account.context_id = $1
        AND ${PUBLIC_RECORD_CONDITION};
    `,
    [accountId],
  );
  return result.rows[0]?.item ?? null;
}

async function loadReviewSources(claimId: string) {
  const database = requireDatabase();
  const maximum = 200;
  const sourceIdsCte = `
    WITH source_ids AS (
      SELECT source.source_id
      FROM context_record_sources source
      WHERE source.context_id = $1
      UNION
      SELECT UNNEST(version.source_ids)
      FROM context_claim_versions version
      WHERE version.claim_context_id = $1
        AND version.version_status <> 'draft'
      UNION
      SELECT source.source_id
      FROM context_claim_attributions attribution
      JOIN context_claim_attribution_sources source
        ON source.attribution_id = attribution.attribution_id
      WHERE attribution.claim_context_id = $1
      UNION
      SELECT source.source_id
      FROM context_claim_relations relation
      JOIN context_claim_relation_sources source
        ON source.relation_id = relation.relation_id
      WHERE relation.from_claim_context_id = $1
        OR relation.to_claim_context_id = $1
      UNION
      SELECT source.source_id
      FROM context_evidence_claim_links link
      JOIN context_evidence_claim_link_sources source
        ON source.link_id = link.link_id
      WHERE link.claim_context_id = $1
      UNION
      SELECT evidence.source_id
      FROM context_evidence evidence
      WHERE evidence.claim_context_id = $1
        AND evidence.source_id IS NOT NULL
      UNION
      SELECT evidence.source_id
      FROM context_evidence_claim_links link
      JOIN context_evidence evidence
        ON evidence.context_id = link.evidence_context_id
      WHERE link.claim_context_id = $1
        AND evidence.source_id IS NOT NULL
      UNION
      SELECT UNNEST(version.source_ids)
      FROM context_evidence_claim_links link
      JOIN context_evidence_versions version
        ON version.evidence_context_id = link.evidence_context_id
      WHERE link.claim_context_id = $1
        AND version.version_status <> 'draft'
      UNION
      SELECT source.source_id
      FROM context_claims claim
      JOIN context_record_sources source
        ON source.context_id = claim.account_context_id
      WHERE claim.context_id = $1
      UNION
      SELECT locator.source_id
      FROM context_source_locators locator
      JOIN context_evidence evidence
        ON evidence.context_id = locator.evidence_context_id
      WHERE evidence.claim_context_id = $1
        OR EXISTS (
          SELECT 1
          FROM context_evidence_claim_links link
          WHERE link.claim_context_id = $1
            AND link.evidence_context_id = evidence.context_id
        )
    )
  `;
  const [allCount, publicCount, rowsResult] = await Promise.all([
    database.query<ReviewCountRow>(
      `${sourceIdsCte} SELECT COUNT(*) AS count FROM source_ids;`,
      [claimId],
    ),
    database.query<ReviewCountRow>(
      `
        ${sourceIdsCte}
        SELECT COUNT(*) AS count
        FROM source_ids ids
        JOIN sources source ON source.source_id = ids.source_id
        WHERE COALESCE(
          source.raw_data ->> 'governanceVisibility',
          'public'
        ) = 'public';
      `,
      [claimId],
    ),
    database.query<SourceRow>(
      `
        ${sourceIdsCte}
        SELECT JSONB_BUILD_OBJECT(
          'sourceId', source.source_id,
          'bundleId', source.bundle_id,
          'name', source.name,
          'sourceType', source.source_type,
          'domain', source.domain,
          'publisher', source.publisher,
          'qualityTier', source.quality_tier,
          'credibilityTier', source.credibility_tier,
          'verificationStatus', source.verification_status,
          'sourceClass', source.source_class,
          'license', source.license,
          'licenseStatus', source.license_status,
          'reviewStatus', source.review_status,
          'lastReviewed', source.last_reviewed,
          'url', source.url,
          'notes', source.notes
        ) AS item
        FROM source_ids ids
        JOIN sources source ON source.source_id = ids.source_id
        WHERE COALESCE(
          source.raw_data ->> 'governanceVisibility',
          'public'
        ) = 'public'
        ORDER BY source.name, source.source_id
        LIMIT $2;
      `,
      [claimId, maximum],
    ),
  ]);
  const totalReferenced = Number(allCount.rows[0]?.count ?? 0);
  const totalPublic = Number(publicCount.rows[0]?.count ?? 0);
  const items = rowsResult.rows.map((row) => row.item);
  return {
    items,
    summary: {
      totalReferenced,
      totalPublic,
      returned: items.length,
      hasMore: items.length < totalPublic,
      hiddenOrUnavailable: Math.max(0, totalReferenced - totalPublic),
      limit: maximum,
    },
  };
}

export async function getContextClaimReview(
  claimId: string,
  options: ContextClaimReviewOptions,
) {
  const identity = await loadClaimIdentity(claimId);
  if (!identity) {
    return undefined;
  }

  const [
    record,
    reportingAccount,
    versions,
    attributions,
    evidence,
    relations,
    provenance,
    sources,
  ] = await Promise.all([
    getContextRecordBaseById(identity.subject_context_id),
    loadReportingAccount(identity.account_context_id),
    loadClaimVersions(claimId, options.versions),
    loadAttributions(claimId),
    loadEvidenceReview(claimId, options.evidence),
    loadRelatedClaims(claimId, options.relations),
    loadFieldProvenance(claimId, options.provenance),
    loadReviewSources(claimId),
  ]);

  const currentVersion =
    versions.items.find((item) => item.current === true)
    ?? (await loadRequestedClaimVersionForCurrent(claimId));
  const selectedVersion = options.requestedVersionId
    ? await loadRequestedClaimVersion(
        claimId,
        options.requestedVersionId,
      )
    : currentVersion;
  const hasVersionHistory = versions.pagination.total > 0;
  const selectedIsCurrent =
    Boolean(selectedVersion)
    && selectedVersion?.id === currentVersion?.id;
  const displayState = !hasVersionHistory
    ? "legacy-current"
    : !currentVersion && !options.requestedVersionId
      ? "current-pointer-missing"
      : selectedIsCurrent
      ? "current"
      : "historical";

  return {
    record: record ?? null,
    claim: identity.item,
    reportingAccount,
    currentStatement: identity.item.statement,
    currentVersion: currentVersion ?? null,
    currentVersionId: currentVersion?.id ?? null,
    requestedVersionId: options.requestedVersionId ?? null,
    requestedVersionFound:
      !options.requestedVersionId || Boolean(selectedVersion),
    selectedVersion: selectedVersion ?? null,
    selectedStatement:
      selectedVersion?.statement ?? identity.item.statement,
    displayState,
    hasVersionHistory,
    versions,
    attributions,
    evidence,
    relatedClaims: relations,
    provenance,
    sources,
    counts: {
      versions: versions.pagination.total,
      attributions: attributions.pagination.total,
      evidence: evidence.pagination.total,
      relationships: relations.pagination.total,
      provenance: provenance.pagination.total,
      sources: sources.summary.totalPublic,
    },
    diagnostics: {
      currentPointerMissing:
        hasVersionHistory && !currentVersion,
      parentRecordUnavailable: !record,
      reportingAccountUnavailable: !reportingAccount,
      hiddenOrUnavailableSources:
        sources.summary.hiddenOrUnavailable,
      partial:
        !record
        || !reportingAccount
        || sources.summary.hiddenOrUnavailable > 0,
    },
  };
}

async function loadRequestedClaimVersionForCurrent(claimId: string) {
  const database = requireDatabase();
  const result = await database.query<{ version_id: string }>(
    `
      SELECT pointer.version_id
      FROM context_claim_current_versions pointer
      JOIN context_claim_versions version
        ON version.claim_context_id = pointer.claim_context_id
        AND version.version_id = pointer.version_id
      WHERE pointer.claim_context_id = $1
        AND version.version_status <> 'draft';
    `,
    [claimId],
  );
  const versionId = result.rows[0]?.version_id;
  return versionId
    ? loadRequestedClaimVersion(claimId, versionId)
    : undefined;
}
