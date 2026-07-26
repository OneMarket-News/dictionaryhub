import type { PoolClient } from "pg";

import type {
  ContextClaimVersion,
  ContextEvidenceVersion,
  ContextualBundle,
} from "../contextual-types.js";
import { getPool } from "../lib/database.js";
import type { SortDirection } from "../lib/query-params.js";
import { sha256 } from "../lib/security.js";

type JsonRecord = Record<string, unknown>;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

function sortedUnique(values: string[] | undefined): string[] {
  return [...new Set(values ?? [])].sort((left, right) =>
    left.localeCompare(right)
  );
}

export function normalizedClaimVersionContent(
  version: ContextClaimVersion,
): JsonRecord {
  return stableValue({
    id: version.id,
    claimId: version.claimId,
    ordinal: version.ordinal ?? null,
    priorVersionId: version.priorVersionId ?? null,
    statement: version.statement,
    claimType: version.claimType,
    subjectId: version.subjectId,
    objectId: version.objectId ?? null,
    confidence: version.confidence ?? null,
    uncertainty: version.uncertainty ?? null,
    status: version.status ?? "active",
    changeType: version.changeType,
    changeReason: version.changeReason ?? null,
    attributionSnapshot: version.attributionSnapshot ?? [],
    attributionIds: sortedUnique(version.attributionIds),
    sourceIds: sortedUnique(version.sourceIds),
    assertedTemporalAssertionId:
      version.assertedTemporalAssertionId ?? null,
    origin: version.origin,
    createdAt: version.createdAt ?? null,
  }) as JsonRecord;
}

export function normalizedEvidenceVersionContent(
  version: ContextEvidenceVersion,
): JsonRecord {
  return stableValue({
    id: version.id,
    evidenceId: version.evidenceId,
    ordinal: version.ordinal ?? null,
    priorVersionId: version.priorVersionId ?? null,
    evidenceType: version.evidenceType,
    explanation: version.explanation,
    strength: version.strength ?? null,
    confidence: version.confidence ?? null,
    uncertainty: version.uncertainty ?? null,
    sourceId: version.sourceId ?? null,
    accountId: version.accountId ?? null,
    evidenceRecordId: version.evidenceRecordId ?? null,
    evidentiaryBasis: version.evidentiaryBasis ?? {},
    sourceLocator: version.sourceLocator ?? null,
    sourceIds: sortedUnique(version.sourceIds),
    supportRole: version.supportRole ?? null,
    status: version.status ?? "active",
    changeType: version.changeType,
    changeReason: version.changeReason ?? null,
    origin: version.origin,
    createdAt: version.createdAt ?? null,
  }) as JsonRecord;
}

export function claimVersionContentHash(
  version: ContextClaimVersion,
): string {
  return `sha256:${sha256(
    JSON.stringify(normalizedClaimVersionContent(version)),
  )}`;
}

export function evidenceVersionContentHash(
  version: ContextEvidenceVersion,
): string {
  return `sha256:${sha256(
    JSON.stringify(normalizedEvidenceVersionContent(version)),
  )}`;
}

export class ContextVersionConflictError extends Error {
  readonly code = "CONTEXT_VERSION_ID_CONFLICT";
  readonly statusCode = 409;

  constructor(
    readonly versionId: string,
    readonly expectedHash: string,
    readonly actualHash: string,
  ) {
    super(
      `Context version ${versionId} already exists with different immutable content.`,
    );
  }
}

async function insertClaimVersions(
  client: PoolClient,
  bundleId: string,
  context: ContextualBundle,
): Promise<void> {
  for (const version of context.claimVersions ?? []) {
    const contentHash = claimVersionContentHash(version);
    if (version.contentHash && version.contentHash !== contentHash) {
      throw new ContextVersionConflictError(
        version.id,
        version.contentHash,
        contentHash,
      );
    }
    const inserted = await client.query(
      `
        INSERT INTO context_claim_versions (
          version_id,
          claim_context_id,
          bundle_id,
          version_ordinal,
          prior_version_id,
          statement,
          claim_type,
          subject_context_id,
          object_context_id,
          confidence,
          uncertainty,
          version_status,
          change_type,
          change_reason,
          attribution_snapshot,
          attribution_ids,
          source_ids,
          asserted_temporal_context_id,
          content_hash,
          origin,
          created_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
          $15::JSONB,$16::TEXT[],$17::TEXT[],$18,$19,$20,
          COALESCE($21::TIMESTAMPTZ, CURRENT_TIMESTAMP)
        )
        ON CONFLICT (version_id) DO NOTHING
        RETURNING version_id;
      `,
      [
        version.id,
        version.claimId,
        bundleId,
        version.ordinal ?? null,
        version.priorVersionId ?? null,
        version.statement,
        version.claimType,
        version.subjectId,
        version.objectId ?? null,
        version.confidence ?? null,
        version.uncertainty ?? null,
        version.status ?? "active",
        version.changeType,
        version.changeReason ?? null,
        JSON.stringify(version.attributionSnapshot ?? []),
        sortedUnique(version.attributionIds),
        sortedUnique(version.sourceIds),
        version.assertedTemporalAssertionId ?? null,
        contentHash,
        version.origin,
        version.createdAt ?? null,
      ],
    );
    if (inserted.rowCount === 0) {
      const existing = await client.query<{
        content_hash: string;
      }>(
        `
          SELECT content_hash
          FROM context_claim_versions
          WHERE version_id = $1;
        `,
        [version.id],
      );
      const existingHash = existing.rows[0]?.content_hash ?? "";
      if (existingHash !== contentHash) {
        throw new ContextVersionConflictError(
          version.id,
          existingHash,
          contentHash,
        );
      }
    }
  }

  for (const version of context.claimVersions ?? []) {
    if (version.current !== true) {
      continue;
    }
    await client.query(
      `
        INSERT INTO context_claim_current_versions (
          claim_context_id,
          version_id,
          updated_at
        )
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (claim_context_id) DO UPDATE SET
          version_id = EXCLUDED.version_id,
          updated_at = CURRENT_TIMESTAMP;
      `,
      [version.claimId, version.id],
    );
  }
}

async function insertEvidenceVersions(
  client: PoolClient,
  bundleId: string,
  context: ContextualBundle,
): Promise<void> {
  for (const version of context.evidenceVersions ?? []) {
    const contentHash = evidenceVersionContentHash(version);
    if (version.contentHash && version.contentHash !== contentHash) {
      throw new ContextVersionConflictError(
        version.id,
        version.contentHash,
        contentHash,
      );
    }
    const inserted = await client.query(
      `
        INSERT INTO context_evidence_versions (
          version_id,
          evidence_context_id,
          bundle_id,
          version_ordinal,
          prior_version_id,
          evidence_type,
          explanation,
          strength,
          confidence,
          uncertainty,
          source_id,
          account_context_id,
          evidence_record_context_id,
          evidentiary_basis,
          source_locator,
          source_ids,
          support_role,
          version_status,
          change_type,
          change_reason,
          content_hash,
          origin,
          created_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
          $14::JSONB,$15::JSONB,$16::TEXT[],$17,$18,$19,$20,
          $21,$22,COALESCE($23::TIMESTAMPTZ, CURRENT_TIMESTAMP)
        )
        ON CONFLICT (version_id) DO NOTHING
        RETURNING version_id;
      `,
      [
        version.id,
        version.evidenceId,
        bundleId,
        version.ordinal ?? null,
        version.priorVersionId ?? null,
        version.evidenceType,
        version.explanation,
        version.strength ?? null,
        version.confidence ?? null,
        version.uncertainty ?? null,
        version.sourceId ?? null,
        version.accountId ?? null,
        version.evidenceRecordId ?? null,
        JSON.stringify(version.evidentiaryBasis ?? {}),
        version.sourceLocator
          ? JSON.stringify(version.sourceLocator)
          : null,
        sortedUnique(version.sourceIds),
        version.supportRole ?? null,
        version.status ?? "active",
        version.changeType,
        version.changeReason ?? null,
        contentHash,
        version.origin,
        version.createdAt ?? null,
      ],
    );
    if (inserted.rowCount === 0) {
      const existing = await client.query<{
        content_hash: string;
      }>(
        `
          SELECT content_hash
          FROM context_evidence_versions
          WHERE version_id = $1;
        `,
        [version.id],
      );
      const existingHash = existing.rows[0]?.content_hash ?? "";
      if (existingHash !== contentHash) {
        throw new ContextVersionConflictError(
          version.id,
          existingHash,
          contentHash,
        );
      }
    }
  }

  for (const version of context.evidenceVersions ?? []) {
    if (version.current !== true) {
      continue;
    }
    await client.query(
      `
        INSERT INTO context_evidence_current_versions (
          evidence_context_id,
          version_id,
          updated_at
        )
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (evidence_context_id) DO UPDATE SET
          version_id = EXCLUDED.version_id,
          updated_at = CURRENT_TIMESTAMP;
      `,
      [version.evidenceId, version.id],
    );
  }
}

export async function insertContextualExtensions(
  client: PoolClient,
  bundleId: string,
  context: ContextualBundle,
): Promise<void> {
  for (const attribution of context.claimAttributions ?? []) {
    await client.query(
      `
        INSERT INTO context_claim_attributions (
          attribution_id,
          claim_context_id,
          bundle_id,
          actor_entity_context_id,
          account_context_id,
          temporal_context_id,
          attribution_role,
          note,
          confidence,
          uncertainty
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);
      `,
      [
        attribution.id,
        attribution.claimId,
        bundleId,
        attribution.actorEntityId ?? null,
        attribution.accountId ?? null,
        attribution.temporalAssertionId ?? null,
        attribution.attributionRole,
        attribution.note ?? null,
        attribution.confidence ?? null,
        attribution.uncertainty ?? null,
      ],
    );
    for (const sourceId of sortedUnique(attribution.sourceIds)) {
      await client.query(
        `
          INSERT INTO context_claim_attribution_sources (
            attribution_id,
            source_id,
            bundle_id
          )
          VALUES ($1, $2, $3);
        `,
        [attribution.id, sourceId, bundleId],
      );
    }
  }

  for (const relation of context.claimRelations ?? []) {
    await client.query(
      `
        INSERT INTO context_claim_relations (
          relation_id,
          from_claim_context_id,
          to_claim_context_id,
          bundle_id,
          relation_type,
          explanation,
          confidence,
          uncertainty,
          review_status,
          temporal_context_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);
      `,
      [
        relation.id,
        relation.fromClaimId,
        relation.toClaimId,
        bundleId,
        relation.relationType,
        relation.explanation ?? null,
        relation.confidence ?? null,
        relation.uncertainty ?? null,
        relation.reviewStatus ?? null,
        relation.temporalAssertionId ?? null,
      ],
    );
    for (const sourceId of sortedUnique(relation.sourceIds)) {
      await client.query(
        `
          INSERT INTO context_claim_relation_sources (
            relation_id,
            source_id,
            bundle_id
          )
          VALUES ($1, $2, $3);
        `,
        [relation.id, sourceId, bundleId],
      );
    }
  }

  await insertClaimVersions(client, bundleId, context);

  for (const locator of context.sourceLocators ?? []) {
    await client.query(
      `
        INSERT INTO context_source_locators (
          locator_id,
          evidence_context_id,
          source_id,
          bundle_id,
          locator_type,
          locator_label,
          locator_data,
          excerpt,
          note
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7::JSONB,$8,$9);
      `,
      [
        locator.id,
        locator.evidenceId,
        locator.sourceId,
        bundleId,
        locator.locatorType,
        locator.locatorLabel,
        JSON.stringify(locator.locator ?? {}),
        locator.excerpt ?? null,
        locator.note ?? null,
      ],
    );
  }

  await insertEvidenceVersions(client, bundleId, context);

  for (const link of context.evidenceClaimLinks ?? []) {
    await client.query(
      `
        INSERT INTO context_evidence_claim_links (
          link_id,
          evidence_context_id,
          claim_context_id,
          claim_version_id,
          bundle_id,
          support_role,
          scope_path,
          explanation,
          relevance,
          confidence,
          uncertainty
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);
      `,
      [
        link.id,
        link.evidenceId,
        link.claimId,
        link.claimVersionId ?? null,
        bundleId,
        link.supportRole,
        link.scopePath ?? null,
        link.explanation ?? null,
        link.relevance ?? null,
        link.confidence ?? null,
        link.uncertainty ?? null,
      ],
    );
    for (const sourceId of sortedUnique(link.sourceIds)) {
      await client.query(
        `
          INSERT INTO context_evidence_claim_link_sources (
            link_id,
            source_id,
            bundle_id
          )
          VALUES ($1, $2, $3);
        `,
        [link.id, sourceId, bundleId],
      );
    }
  }
}

export async function deleteContextVersionsForIntegrationTest(
  client: PoolClient,
  bundleId: string,
): Promise<void> {
  await client.query(
    `
      SELECT SET_CONFIG(
        'sourceroot.allow_context_version_test_cleanup',
        'integration-test',
        TRUE
      );
    `,
  );
  await client.query(
    `
      DELETE FROM context_evidence_claim_links
      WHERE bundle_id = $1;
    `,
    [bundleId],
  );
  await client.query(
    `
      DELETE FROM context_claim_current_versions current_version
      USING context_claim_versions version
      WHERE current_version.version_id = version.version_id
        AND version.bundle_id = $1;
    `,
    [bundleId],
  );
  await client.query(
    `
      DELETE FROM context_evidence_current_versions current_version
      USING context_evidence_versions version
      WHERE current_version.version_id = version.version_id
        AND version.bundle_id = $1;
    `,
    [bundleId],
  );
  await client.query(
    "DELETE FROM context_evidence_versions WHERE bundle_id = $1",
    [bundleId],
  );
  await client.query(
    "DELETE FROM context_claim_versions WHERE bundle_id = $1",
    [bundleId],
  );
}

export interface ContextExtensionListOptions {
  page: number;
  limit: number;
  offset?: number;
  sort?: "createdAt" | "updatedAt" | "id" | "ordinal";
  direction?: SortDirection;
  claimId?: string;
  evidenceId?: string;
  versionId?: string;
  relationType?: string;
  supportRole?: string;
  status?: string;
  sourceId?: string;
  current?: string;
  actorEntityId?: string;
}

export interface ContextExtensionListResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: JsonRecord[];
}

export type ContextExtensionCollection =
  | "claimVersions"
  | "evidenceVersions"
  | "evidenceClaimLinks"
  | "claimRelations"
  | "claimAttributions";

interface CollectionDefinition {
  from: string;
  idColumn: string;
  createdColumn: string;
  updatedColumn: string;
  ordinalColumn?: string;
  filters: Record<string, string>;
  projection: string;
}

const collectionDefinitions: Record<
  ContextExtensionCollection,
  CollectionDefinition
> = {
  claimVersions: {
    from:
      "context_claim_versions version LEFT JOIN context_claim_current_versions current_version ON current_version.version_id = version.version_id",
    idColumn: "version.version_id",
    createdColumn: "version.created_at",
    updatedColumn: "version.created_at",
    ordinalColumn: "version.version_ordinal",
    filters: {
      claimId: "version.claim_context_id",
      versionId: "version.version_id",
      status: "version.version_status",
      sourceId: "$SOURCE_ARRAY$",
      current: "$CURRENT$",
    },
    projection: `
      JSONB_BUILD_OBJECT(
        'id', version.version_id,
        'claimId', version.claim_context_id,
        'ordinal', version.version_ordinal,
        'priorVersionId', version.prior_version_id,
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
        'governanceProposalId', version.governance_proposal_id,
        'governancePublicationId', version.governance_publication_id,
        'governanceRevisionId', version.governance_revision_id,
        'createdAt', version.created_at,
        'current', current_version.version_id IS NOT NULL
      )
    `,
  },
  evidenceVersions: {
    from:
      "context_evidence_versions version LEFT JOIN context_evidence_current_versions current_version ON current_version.version_id = version.version_id",
    idColumn: "version.version_id",
    createdColumn: "version.created_at",
    updatedColumn: "version.created_at",
    ordinalColumn: "version.version_ordinal",
    filters: {
      evidenceId: "version.evidence_context_id",
      versionId: "version.version_id",
      status: "version.version_status",
      supportRole: "version.support_role",
      sourceId: "$SOURCE_ARRAY$",
      current: "$CURRENT$",
    },
    projection: `
      JSONB_BUILD_OBJECT(
        'id', version.version_id,
        'evidenceId', version.evidence_context_id,
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
        'governanceProposalId', version.governance_proposal_id,
        'governancePublicationId', version.governance_publication_id,
        'governanceRevisionId', version.governance_revision_id,
        'createdAt', version.created_at,
        'current', current_version.version_id IS NOT NULL
      )
    `,
  },
  evidenceClaimLinks: {
    from: "context_evidence_claim_links link",
    idColumn: "link.link_id",
    createdColumn: "link.created_at",
    updatedColumn: "link.updated_at",
    filters: {
      claimId: "link.claim_context_id",
      evidenceId: "link.evidence_context_id",
      versionId: "link.claim_version_id",
      supportRole: "link.support_role",
      sourceId: "$LINK_SOURCE$",
    },
    projection: `
      JSONB_BUILD_OBJECT(
        'id', link.link_id,
        'evidenceId', link.evidence_context_id,
        'claimId', link.claim_context_id,
        'claimVersionId', link.claim_version_id,
        'supportRole', link.support_role,
        'scopePath', link.scope_path,
        'explanation', link.explanation,
        'relevance', link.relevance,
        'confidence', link.confidence,
        'uncertainty', link.uncertainty,
        'sourceIds',
          COALESCE(
            (
              SELECT JSONB_AGG(source.source_id ORDER BY source.source_id)
              FROM context_evidence_claim_link_sources source
              WHERE source.link_id = link.link_id
            ),
            '[]'::JSONB
          ),
        'createdAt', link.created_at,
        'updatedAt', link.updated_at
      )
    `,
  },
  claimRelations: {
    from: "context_claim_relations relation",
    idColumn: "relation.relation_id",
    createdColumn: "relation.created_at",
    updatedColumn: "relation.updated_at",
    filters: {
      claimId: "$RELATION_CLAIM$",
      relationType: "relation.relation_type",
      sourceId: "$RELATION_SOURCE$",
    },
    projection: `
      JSONB_BUILD_OBJECT(
        'id', relation.relation_id,
        'fromClaimId', relation.from_claim_context_id,
        'toClaimId', relation.to_claim_context_id,
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
        'createdAt', relation.created_at,
        'updatedAt', relation.updated_at
      )
    `,
  },
  claimAttributions: {
    from: "context_claim_attributions attribution",
    idColumn: "attribution.attribution_id",
    createdColumn: "attribution.created_at",
    updatedColumn: "attribution.updated_at",
    filters: {
      claimId: "attribution.claim_context_id",
      actorEntityId: "attribution.actor_entity_context_id",
      sourceId: "$ATTRIBUTION_SOURCE$",
    },
    projection: `
      JSONB_BUILD_OBJECT(
        'id', attribution.attribution_id,
        'claimId', attribution.claim_context_id,
        'actorEntityId', attribution.actor_entity_context_id,
        'accountId', attribution.account_context_id,
        'temporalAssertionId', attribution.temporal_context_id,
        'attributionRole', attribution.attribution_role,
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
      )
    `,
  },
};

export async function listContextExtensions(
  collection: ContextExtensionCollection,
  options: ContextExtensionListOptions,
): Promise<ContextExtensionListResult> {
  const database = getPool();
  if (!database) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const definition = collectionDefinitions[collection];
  const conditions = ["TRUE"];
  const values: Array<string | number | boolean> = [];
  for (const [key, column] of Object.entries(definition.filters)) {
    const value = options[key as keyof ContextExtensionListOptions];
    if (value === undefined) {
      continue;
    }
    values.push(
      column === "$CURRENT$"
        ? String(value).toLowerCase() === "true"
        : value as string,
    );
    const parameter = `$${values.length}`;
    if (column === "$SOURCE_ARRAY$") {
      conditions.push(`${parameter} = ANY(version.source_ids)`);
    } else if (column === "$CURRENT$") {
      conditions.push(
        `(current_version.version_id IS NOT NULL) = ${parameter}::BOOLEAN`,
      );
    } else if (column === "$LINK_SOURCE$") {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM context_evidence_claim_link_sources source
          WHERE source.link_id = link.link_id
            AND source.source_id = ${parameter}
        )`,
      );
    } else if (column === "$RELATION_SOURCE$") {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM context_claim_relation_sources source
          WHERE source.relation_id = relation.relation_id
            AND source.source_id = ${parameter}
        )`,
      );
    } else if (column === "$ATTRIBUTION_SOURCE$") {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM context_claim_attribution_sources source
          WHERE source.attribution_id = attribution.attribution_id
            AND source.source_id = ${parameter}
        )`,
      );
    } else if (column === "$RELATION_CLAIM$") {
      conditions.push(
        `(relation.from_claim_context_id = ${parameter}
          OR relation.to_claim_context_id = ${parameter})`,
      );
    } else {
      conditions.push(`${column} = ${parameter}`);
    }
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const sortColumn = options.sort === "updatedAt"
    ? definition.updatedColumn
    : options.sort === "id"
      ? definition.idColumn
      : options.sort === "ordinal" && definition.ordinalColumn
        ? definition.ordinalColumn
        : definition.createdColumn;
  const direction = options.direction === "desc" ? "DESC" : "ASC";
  const offset = options.offset ?? (options.page - 1) * options.limit;
  const count = await database.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM ${definition.from} ${where};`,
    values,
  );
  const rows = await database.query<{ item: JsonRecord }>(
    `
      SELECT ${definition.projection} AS item
      FROM ${definition.from}
      ${where}
      ORDER BY ${sortColumn} ${direction}, ${definition.idColumn} ASC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2};
    `,
    [...values, options.limit, offset],
  );
  const total = Number(count.rows[0]?.count ?? 0);
  return {
    page: options.page,
    limit: options.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
    items: rows.rows.map((row) => row.item),
  };
}

export async function getContextExtensionDetail(
  recordKind: "claim" | "evidence",
  contextId: string,
): Promise<JsonRecord> {
  const maximumDetailItems = 10_000;
  const common = {
    page: 1,
    limit: maximumDetailItems,
  };
  const database = getPool();
  if (!database) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (recordKind === "claim") {
    const [
      attributions,
      relations,
      versions,
      evidenceLinks,
      evidenceSummary,
      sourceLocators,
    ] = await Promise.all([
      listContextExtensions("claimAttributions", {
        ...common,
        claimId: contextId,
        sort: "createdAt",
      }),
      listContextExtensions("claimRelations", {
        ...common,
        claimId: contextId,
        sort: "createdAt",
      }),
      listContextExtensions("claimVersions", {
        ...common,
        claimId: contextId,
        sort: "ordinal",
      }),
      listContextExtensions("evidenceClaimLinks", {
        ...common,
        claimId: contextId,
        sort: "createdAt",
      }),
      database.query<{ item: JsonRecord }>(
        `
          SELECT JSONB_BUILD_OBJECT(
            'id', evidence.context_id,
            'evidenceType', evidence.evidence_type,
            'explanation', evidence.explanation,
            'strength', evidence.strength,
            'confidence', evidence.confidence,
            'uncertainty', evidence.uncertainty,
            'legacyClaimId', evidence.claim_context_id,
            'normalizedLinkSupplied',
              EXISTS (
                SELECT 1
                FROM context_evidence_claim_links link
                WHERE link.evidence_context_id = evidence.context_id
                  AND link.claim_context_id = $1
              )
          ) AS item
          FROM context_evidence evidence
          WHERE evidence.claim_context_id = $1
            OR EXISTS (
              SELECT 1
              FROM context_evidence_claim_links link
              WHERE link.evidence_context_id = evidence.context_id
                AND link.claim_context_id = $1
            )
          ORDER BY evidence.context_id;
        `,
        [contextId],
      ),
      database.query<{ item: JsonRecord }>(
        `
          SELECT JSONB_BUILD_OBJECT(
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
          JOIN context_evidence evidence
            ON evidence.context_id = locator.evidence_context_id
          WHERE evidence.claim_context_id = $1
            OR EXISTS (
              SELECT 1
              FROM context_evidence_claim_links link
              WHERE link.evidence_context_id = evidence.context_id
                AND link.claim_context_id = $1
            )
          ORDER BY locator.locator_id;
        `,
        [contextId],
      ),
    ]);
    return {
      attributions: attributions.items,
      claimRelations: relations.items,
      versions: versions.items,
      versionSummary: {
        total: versions.total,
        currentVersionId:
          (versions.items.find((item) => item.current === true)?.id)
          ?? null,
      },
      currentVersion:
        versions.items.find((item) => item.current === true) ?? null,
      evidenceLinks: evidenceLinks.items,
      evidenceSummary: evidenceSummary.rows.map((row) => row.item),
      sourceLocators: sourceLocators.rows.map((row) => row.item),
    };
  }

  const [versions, claimLinks, sourceLocators] = await Promise.all([
    listContextExtensions("evidenceVersions", {
      ...common,
      evidenceId: contextId,
      sort: "ordinal",
    }),
    listContextExtensions("evidenceClaimLinks", {
      ...common,
      evidenceId: contextId,
      sort: "createdAt",
    }),
    database.query<{ item: JsonRecord }>(
      `
        SELECT JSONB_BUILD_OBJECT(
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
        WHERE locator.evidence_context_id = $1
        ORDER BY locator.locator_type, locator.locator_id;
      `,
      [contextId],
    ),
  ]);
  return {
    versions: versions.items,
    versionSummary: {
      total: versions.total,
      currentVersionId:
        (versions.items.find((item) => item.current === true)?.id)
        ?? null,
    },
    currentVersion:
      versions.items.find((item) => item.current === true) ?? null,
    claimLinks: claimLinks.items,
    sourceLocators: sourceLocators.rows.map((row) => row.item),
  };
}

export async function appendGovernedContextVersion(
  client: PoolClient,
  input: {
    targetType: string;
    targetId: string;
    bundleId: string;
    snapshot: JsonRecord;
    origin: "governed_publication" | "rollback";
    changeType: string;
    changeReason: string;
    proposalId: string;
    publicationId: string;
    revisionId: string;
  },
): Promise<string | null> {
  if (input.targetType !== "claim" && input.targetType !== "evidence") {
    return null;
  }
  const claimTarget = input.targetType === "claim";
  const versionTable = claimTarget
    ? "context_claim_versions"
    : "context_evidence_versions";
  const currentTable = claimTarget
    ? "context_claim_current_versions"
    : "context_evidence_current_versions";
  const parentColumn = claimTarget
    ? "claim_context_id"
    : "evidence_context_id";
  const previous = await client.query<{
    version_id: string;
    version_ordinal: number | null;
  }>(
    `
      SELECT version.version_id, version.version_ordinal
      FROM ${currentTable} current_version
      JOIN ${versionTable} version
        ON version.version_id = current_version.version_id
      WHERE current_version.${parentColumn} = $1
      FOR UPDATE OF current_version;
    `,
    [input.targetId],
  );
  const previousVersion = previous.rows[0];
  const nextOrdinal = previousVersion?.version_ordinal === null
    || previousVersion?.version_ordinal === undefined
    ? null
    : previousVersion.version_ordinal + 1;
  const versionId =
    `sourceroot-${input.targetType}-version-${input.revisionId}`;

  if (claimTarget) {
    const version: ContextClaimVersion = {
      id: versionId,
      claimId: input.targetId,
      ...(nextOrdinal === null ? {} : { ordinal: nextOrdinal }),
      ...(previousVersion
        ? { priorVersionId: previousVersion.version_id }
        : {}),
      statement: String(input.snapshot.statement ?? ""),
      claimType: String(input.snapshot.claimType ?? ""),
      subjectId: String(input.snapshot.subjectId ?? ""),
      ...(typeof input.snapshot.objectId === "string"
        ? { objectId: input.snapshot.objectId }
        : {}),
      ...(typeof input.snapshot.confidence === "string"
        ? { confidence: input.snapshot.confidence }
        : {}),
      ...(typeof input.snapshot.uncertainty === "string"
        ? { uncertainty: input.snapshot.uncertainty }
        : {}),
      status:
        input.snapshot.status === "retracted"
          ? "retracted"
          : "accepted",
      changeType: input.changeType,
      changeReason: input.changeReason,
      attributionSnapshot: Array.isArray(input.snapshot.attributions)
        ? input.snapshot.attributions as JsonRecord[]
        : [],
      sourceIds: Array.isArray(input.snapshot.sourceIds)
        ? input.snapshot.sourceIds.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      origin: input.origin,
      current: true,
    };
    const hash = claimVersionContentHash(version);
    await client.query(
      `
        INSERT INTO context_claim_versions (
          version_id, claim_context_id, bundle_id, version_ordinal,
          prior_version_id, statement, claim_type, subject_context_id,
          object_context_id, confidence, uncertainty, version_status,
          change_type, change_reason, attribution_snapshot, source_ids,
          content_hash, origin, governance_proposal_id,
          governance_publication_id, governance_revision_id
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
          $15::JSONB,$16::TEXT[],$17,$18,$19::UUID,$20::UUID,$21
        );
      `,
      [
        versionId,
        input.targetId,
        input.bundleId,
        nextOrdinal,
        previousVersion?.version_id ?? null,
        version.statement,
        version.claimType,
        version.subjectId,
        version.objectId ?? null,
        version.confidence ?? null,
        version.uncertainty ?? null,
        version.status,
        input.changeType,
        input.changeReason,
        JSON.stringify(version.attributionSnapshot ?? []),
        sortedUnique(version.sourceIds),
        hash,
        input.origin,
        input.proposalId,
        input.publicationId,
        input.revisionId,
      ],
    );
  } else {
    const version: ContextEvidenceVersion = {
      id: versionId,
      evidenceId: input.targetId,
      ...(nextOrdinal === null ? {} : { ordinal: nextOrdinal }),
      ...(previousVersion
        ? { priorVersionId: previousVersion.version_id }
        : {}),
      evidenceType:
        input.snapshot.evidenceType === "counterevidence"
          ? "counterevidence"
          : "evidence",
      explanation: String(input.snapshot.explanation ?? ""),
      ...(typeof input.snapshot.strength === "string"
        ? { strength: input.snapshot.strength }
        : {}),
      ...(typeof input.snapshot.confidence === "string"
        ? { confidence: input.snapshot.confidence }
        : {}),
      ...(typeof input.snapshot.uncertainty === "string"
        ? { uncertainty: input.snapshot.uncertainty }
        : {}),
      ...(typeof input.snapshot.sourceId === "string"
        ? { sourceId: input.snapshot.sourceId }
        : {}),
      ...(typeof input.snapshot.accountId === "string"
        ? { accountId: input.snapshot.accountId }
        : {}),
      ...(typeof input.snapshot.evidenceRecordId === "string"
        ? { evidenceRecordId: input.snapshot.evidenceRecordId }
        : {}),
      sourceIds: Array.isArray(input.snapshot.sourceIds)
        ? input.snapshot.sourceIds.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      status:
        input.snapshot.status === "retracted"
          ? "retracted"
          : "accepted",
      changeType: input.changeType,
      changeReason: input.changeReason,
      origin: input.origin,
      current: true,
    };
    const hash = evidenceVersionContentHash(version);
    await client.query(
      `
        INSERT INTO context_evidence_versions (
          version_id, evidence_context_id, bundle_id, version_ordinal,
          prior_version_id, evidence_type, explanation, strength,
          confidence, uncertainty, source_id, account_context_id,
          evidence_record_context_id, evidentiary_basis, source_ids,
          version_status, change_type, change_reason, content_hash,
          origin, governance_proposal_id, governance_publication_id,
          governance_revision_id
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'{}'::JSONB,
          $14::TEXT[],$15,$16,$17,$18,$19,$20::UUID,$21::UUID,$22
        );
      `,
      [
        versionId,
        input.targetId,
        input.bundleId,
        nextOrdinal,
        previousVersion?.version_id ?? null,
        version.evidenceType,
        version.explanation,
        version.strength ?? null,
        version.confidence ?? null,
        version.uncertainty ?? null,
        version.sourceId ?? null,
        version.accountId ?? null,
        version.evidenceRecordId ?? null,
        sortedUnique(version.sourceIds),
        version.status,
        input.changeType,
        input.changeReason,
        hash,
        input.origin,
        input.proposalId,
        input.publicationId,
        input.revisionId,
      ],
    );
  }

  await client.query(
    `
      INSERT INTO ${currentTable} (
        ${parentColumn},
        version_id,
        updated_at
      )
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (${parentColumn}) DO UPDATE SET
        version_id = EXCLUDED.version_id,
        updated_at = CURRENT_TIMESTAMP;
    `,
    [input.targetId, versionId],
  );
  return versionId;
}
