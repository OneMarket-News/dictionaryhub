import type { PoolClient } from "pg";

import { getPool } from "../lib/database.js";
import type { SortDirection } from "../lib/query-params.js";
import type { SourceRootBundle } from "../types.js";
import {
  deleteContextRecords,
  insertContextualBundle,
} from "./context-import-store.js";
import {
  deleteContextVersionsForIntegrationTest,
} from "./context-version-store.js";

export interface ImportedBundleMetadata {
  bundleId: string;
  bundleType: string | null;
  version: string | null;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListImportedBundlesOptions {
  page: number;
  limit: number;
  offset?: number;
  sort?: "createdAt" | "updatedAt" | "bundleId";
  direction?: SortDirection;
  bundleId?: string;
  domain?: string;
  bundleType?: string;
  version?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface ListImportedBundlesResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: ImportedBundleMetadata[];
  bundles: ImportedBundleMetadata[];
}

export interface DeletedImportedBundleCounts {
  importedBundles: number;
  nodes: number;
  assertions: number;
  edges: number;
  sources: number;
  revisions: number;
  nodeSources: number;
  assertionSources: number;
  edgeSources: number;
}

export interface DetailedDeletedImportedBundleCounts
  extends DeletedImportedBundleCounts {
  contextualRecords: number;
  contextPerspectiveLinks: number;
  contextSourceLinks: number;
}

const INTEGRATION_TEST_PREFIX = "sourceroot-integration-test-";

type UnknownRecord = Record<string, unknown>;

function requireDatabase() {
  const database = getPool();

  if (!database) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return database;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecords(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}

function getString(
  record: UnknownRecord,
  field: string,
): string | null {
  const value = record[field];

  return typeof value === "string" ? value : null;
}

function requireString(
  record: UnknownRecord,
  field: string,
  objectType: string,
): string {
  const value = getString(record, field);

  if (!value) {
    throw new Error(
      `${objectType} is missing required string field "${field}".`,
    );
  }

  return value;
}

function getStringArray(
  record: UnknownRecord,
  field: string,
): string[] {
  const value = record[field];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string",
  );
}

function getJsonValue(
  record: UnknownRecord,
  field: string,
  fallback: unknown,
): unknown {
  return record[field] ?? fallback;
}

async function deleteExistingNormalizedRecords(
  client: PoolClient,
  bundleId: string,
): Promise<void> {
  /*
   * Deleting contextual records first releases their source references.
   * Deleting nodes cascades to assertions, edges, and their source links.
   * Deleting sources cascades to remaining source-link records.
   */
  await deleteContextRecords(client, bundleId);

  await client.query(
    `
      DELETE FROM revisions
      WHERE bundle_id = $1;
    `,
    [bundleId],
  );

  await client.query(
    `
      DELETE FROM nodes
      WHERE bundle_id = $1;
    `,
    [bundleId],
  );

  await client.query(
    `
      DELETE FROM sources
      WHERE bundle_id = $1;
    `,
    [bundleId],
  );
}

async function insertSources(
  client: PoolClient,
  bundleId: string,
  sources: UnknownRecord[],
): Promise<void> {
  for (const source of sources) {
    const sourceId = requireString(source, "id", "Source");

    await client.query(
      `
        INSERT INTO sources (
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
          raw_data
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17::jsonb
        );
      `,
      [
        sourceId,
        bundleId,
        requireString(source, "name", `Source ${sourceId}`),
        getString(source, "type"),
        getString(source, "domain"),
        getString(source, "publisher"),
        getString(source, "qualityTier"),
        getString(source, "credibilityTier"),
        getString(source, "verificationStatus"),
        getString(source, "sourceClass"),
        getString(source, "license"),
        getString(source, "licenseStatus"),
        getString(source, "reviewStatus"),
        getString(source, "lastReviewed"),
        getString(source, "url"),
        getString(source, "notes"),
        JSON.stringify(source),
      ],
    );
  }
}

async function insertNodes(
  client: PoolClient,
  bundleId: string,
  nodes: UnknownRecord[],
): Promise<void> {
  for (const node of nodes) {
    const nodeId = requireString(node, "id", "Node");

    await client.query(
      `
        INSERT INTO nodes (
          node_id,
          bundle_id,
          title,
          node_type,
          domain,
          summary,
          status,
          metadata,
          raw_data
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb,
          $9::jsonb
        );
      `,
      [
        nodeId,
        bundleId,
        requireString(node, "title", `Node ${nodeId}`),
        getString(node, "type"),
        getString(node, "domain"),
        getString(node, "summary"),
        getString(node, "status"),
        JSON.stringify(getJsonValue(node, "metadata", {})),
        JSON.stringify(node),
      ],
    );

    for (const sourceId of getStringArray(node, "sourceIds")) {
      await client.query(
        `
          INSERT INTO node_sources (
            node_id,
            source_id,
            bundle_id
          )
          VALUES ($1, $2, $3);
        `,
        [nodeId, sourceId, bundleId],
      );
    }
  }
}

async function insertAssertions(
  client: PoolClient,
  bundleId: string,
  assertions: UnknownRecord[],
): Promise<void> {
  for (const assertion of assertions) {
    const assertionId = requireString(
      assertion,
      "id",
      "Assertion",
    );

    await client.query(
      `
        INSERT INTO assertions (
          assertion_id,
          bundle_id,
          node_id,
          assertion_type,
          label,
          summary,
          body,
          domain,
          credibility_tier,
          confidence,
          verification_status,
          review_status,
          support_level,
          interpretation_level,
          raw_data
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15::jsonb
        );
      `,
      [
        assertionId,
        bundleId,
        requireString(
          assertion,
          "nodeId",
          `Assertion ${assertionId}`,
        ),
        getString(assertion, "assertionType"),
        getString(assertion, "label"),
        getString(assertion, "summary"),
        getString(assertion, "body"),
        getString(assertion, "domain"),
        getString(assertion, "credibilityTier"),
        getString(assertion, "confidence"),
        getString(assertion, "verificationStatus"),
        getString(assertion, "reviewStatus"),
        getString(assertion, "supportLevel"),
        getString(assertion, "interpretationLevel"),
        JSON.stringify(assertion),
      ],
    );

    for (const sourceId of getStringArray(assertion, "sourceIds")) {
      await client.query(
        `
          INSERT INTO assertion_sources (
            assertion_id,
            source_id,
            bundle_id
          )
          VALUES ($1, $2, $3);
        `,
        [assertionId, sourceId, bundleId],
      );
    }
  }
}

async function insertEdges(
  client: PoolClient,
  bundleId: string,
  edges: UnknownRecord[],
): Promise<void> {
  for (const edge of edges) {
    const edgeId = requireString(edge, "id", "Edge");

    await client.query(
      `
        INSERT INTO edges (
          edge_id,
          bundle_id,
          from_node_id,
          to_node_id,
          relationship_type,
          label,
          summary,
          domain,
          credibility_tier,
          confidence,
          verification_status,
          review_status,
          support_level,
          relationship_strength,
          interpretation_level,
          raw_data
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16::jsonb
        );
      `,
      [
        edgeId,
        bundleId,
        requireString(edge, "fromNodeId", `Edge ${edgeId}`),
        requireString(edge, "toNodeId", `Edge ${edgeId}`),
        getString(edge, "relationshipType"),
        getString(edge, "label"),
        getString(edge, "summary"),
        getString(edge, "domain"),
        getString(edge, "credibilityTier"),
        getString(edge, "confidence"),
        getString(edge, "verificationStatus"),
        getString(edge, "reviewStatus"),
        getString(edge, "supportLevel"),
        getString(edge, "relationshipStrength"),
        getString(edge, "interpretationLevel"),
        JSON.stringify(edge),
      ],
    );

    for (const sourceId of getStringArray(edge, "sourceIds")) {
      await client.query(
        `
          INSERT INTO edge_sources (
            edge_id,
            source_id,
            bundle_id
          )
          VALUES ($1, $2, $3);
        `,
        [edgeId, sourceId, bundleId],
      );
    }
  }
}

async function insertRevisions(
  client: PoolClient,
  bundleId: string,
  revisions: UnknownRecord[],
): Promise<void> {
  for (const revision of revisions) {
    const revisionId = requireString(
      revision,
      "revisionId",
      "Revision",
    );

    await client.query(
      `
        INSERT INTO revisions (
          revision_id,
          bundle_id,
          object_type,
          object_id,
          revision_type,
          summary,
          status,
          raw_data
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb
        );
      `,
      [
        revisionId,
        bundleId,
        requireString(
          revision,
          "objectType",
          `Revision ${revisionId}`,
        ),
        requireString(
          revision,
          "objectId",
          `Revision ${revisionId}`,
        ),
        getString(revision, "revisionType"),
        getString(revision, "summary"),
        getString(revision, "status"),
        JSON.stringify(revision),
      ],
    );
  }
}

export async function saveImportedBundle(
  bundle: SourceRootBundle,
): Promise<void> {
  if (!bundle.bundleId) {
    throw new Error("Cannot store a bundle without a bundleId.");
  }

  const database = requireDatabase();
  const client = await database.connect();

  const bundleId = bundle.bundleId;

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO imported_bundles (
          bundle_id,
          bundle_type,
          version,
          domain,
          bundle
        )
        VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT (bundle_id)
        DO UPDATE SET
          bundle_type = EXCLUDED.bundle_type,
          version = EXCLUDED.version,
          domain = EXCLUDED.domain,
          bundle = EXCLUDED.bundle,
          updated_at = CURRENT_TIMESTAMP;
      `,
      [
        bundleId,
        bundle.bundleType ?? null,
        bundle.version ?? null,
        bundle.domain ?? null,
        JSON.stringify(bundle),
      ],
    );

    await deleteExistingNormalizedRecords(client, bundleId);

    const sources = getRecords(bundle.sources);
    const nodes = getRecords(bundle.nodes);
    const assertions = getRecords(bundle.assertions);
    const edges = getRecords(bundle.edges);
    const revisions = getRecords(bundle.revisions);

    /*
     * Insert order matters because the foreign keys require:
     *
     * sources → nodes → assertions/edges
     */
    await insertSources(client, bundleId, sources);
    await insertNodes(client, bundleId, nodes);
    await insertAssertions(client, bundleId, assertions);
    await insertEdges(client, bundleId, edges);
    await insertRevisions(client, bundleId, revisions);
    await insertContextualBundle(
      client,
      bundleId,
      bundle.domain,
      bundle.context,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getImportedBundle(
  bundleId: string,
): Promise<SourceRootBundle | undefined> {
  const database = requireDatabase();

  const result = await database.query<{
    bundle: SourceRootBundle;
  }>(
    `
      SELECT bundle
      FROM imported_bundles
      WHERE bundle_id = $1;
    `,
    [bundleId],
  );

  return result.rows[0]?.bundle;
}

export async function getImportedBundleCount(): Promise<number> {
  const database = requireDatabase();

  const result = await database.query<{
    count: string;
  }>(
    `
      SELECT COUNT(*) AS count
      FROM imported_bundles;
    `,
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function listImportedBundles(
  options: ListImportedBundlesOptions,
): Promise<ListImportedBundlesResult> {
  const database = requireDatabase();
  const conditions: string[] = [];
  const filterValues: string[] = [];

  const addFilter = (column: string, value: string | undefined) => {
    if (value === undefined) {
      return;
    }

    filterValues.push(value);
    conditions.push(`${column} = $${filterValues.length}`);
  };

  addFilter("bundle_id", options.bundleId);
  addFilter("domain", options.domain);
  addFilter("bundle_type", options.bundleType);
  addFilter("version", options.version);

  if (options.createdFrom !== undefined) {
    filterValues.push(options.createdFrom);
    conditions.push(`created_at >= $${filterValues.length}::timestamptz`);
  }

  if (options.createdTo !== undefined) {
    filterValues.push(options.createdTo);
    conditions.push(`created_at <= $${filterValues.length}::timestamptz`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset =
    options.offset ?? (options.page - 1) * options.limit;
  const sortColumns = {
    createdAt: "created_at",
    updatedAt: "updated_at",
    bundleId: "bundle_id",
  } as const;
  const sortColumn = sortColumns[options.sort ?? "createdAt"];
  const direction = options.direction === "asc" ? "ASC" : "DESC";
  const limitParameter = filterValues.length + 1;
  const offsetParameter = filterValues.length + 2;

  const [countResult, bundlesResult] = await Promise.all([
    database.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM imported_bundles ${whereClause};`,
      filterValues,
    ),
    database.query<{
      bundle_id: string;
      bundle_type: string | null;
      version: string | null;
      domain: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT bundle_id, bundle_type, version, domain, created_at, updated_at
        FROM imported_bundles
        ${whereClause}
        ORDER BY ${sortColumn} ${direction}, bundle_id ASC
        LIMIT $${limitParameter}
        OFFSET $${offsetParameter};
      `,
      [...filterValues, options.limit, offset],
    ),
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);
  const items = bundlesResult.rows.map((row) => ({
    bundleId: row.bundle_id,
    bundleType: row.bundle_type,
    version: row.version,
    domain: row.domain,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));

  return {
    page: options.page,
    limit: options.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
    items,
    bundles: items,
  };
}

async function deleteImportedBundleTransaction(
  bundleId: string,
  deleteImmutableContextVersions = false,
): Promise<DetailedDeletedImportedBundleCounts> {
  const database = requireDatabase();
  const client = await database.connect();

  try {
    await client.query("BEGIN");

    const bundleResult = await client.query<{
      bundle_id: string;
    }>(
      `
        SELECT bundle_id
        FROM imported_bundles
        WHERE bundle_id = $1
        FOR UPDATE;
      `,
      [bundleId],
    );

    if (!bundleResult.rows[0]) {
      await client.query("ROLLBACK");

      return {
        importedBundles: 0,
        nodes: 0,
        assertions: 0,
        edges: 0,
        sources: 0,
        revisions: 0,
        nodeSources: 0,
        assertionSources: 0,
        edgeSources: 0,
        contextualRecords: 0,
        contextPerspectiveLinks: 0,
        contextSourceLinks: 0,
      };
    }

    const countResult = await client.query<{
      imported_bundles: string;
      nodes: string;
      assertions: string;
      edges: string;
      sources: string;
      revisions: string;
      node_sources: string;
      assertion_sources: string;
      edge_sources: string;
      contextual_records: string;
      context_perspective_links: string;
      context_source_links: string;
    }>(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM imported_bundles
            WHERE bundle_id = $1
          ) AS imported_bundles,
          (
            SELECT COUNT(*)
            FROM nodes
            WHERE bundle_id = $1
          ) AS nodes,
          (
            SELECT COUNT(*)
            FROM assertions
            WHERE bundle_id = $1
          ) AS assertions,
          (
            SELECT COUNT(*)
            FROM edges
            WHERE bundle_id = $1
          ) AS edges,
          (
            SELECT COUNT(*)
            FROM sources
            WHERE bundle_id = $1
          ) AS sources,
          (
            SELECT COUNT(*)
            FROM revisions
            WHERE bundle_id = $1
          ) AS revisions,
          (
            SELECT COUNT(*)
            FROM node_sources
            WHERE bundle_id = $1
          ) AS node_sources,
          (
            SELECT COUNT(*)
            FROM assertion_sources
            WHERE bundle_id = $1
          ) AS assertion_sources,
          (
            SELECT COUNT(*)
            FROM edge_sources
            WHERE bundle_id = $1
          ) AS edge_sources,
          (
            SELECT COUNT(*)
            FROM context_records
            WHERE bundle_id = $1
          ) AS contextual_records,
          (
            SELECT COUNT(*)
            FROM context_record_perspectives crp
            JOIN context_records cr
              ON cr.context_id = crp.record_context_id
            WHERE cr.bundle_id = $1
          ) AS context_perspective_links,
          (
            SELECT COUNT(*)
            FROM context_record_sources
            WHERE bundle_id = $1
          ) AS context_source_links;
      `,
      [bundleId],
    );

    const row = countResult.rows[0];

    if (deleteImmutableContextVersions) {
      await deleteContextVersionsForIntegrationTest(client, bundleId);
    }

    /*
     * This helper removes revisions, nodes, assertions, edges, sources,
     * and source-link rows through the schema's cascade relationships.
     */
    await deleteExistingNormalizedRecords(client, bundleId);

    const deletedBundleResult = await client.query(
      `
        DELETE FROM imported_bundles
        WHERE bundle_id = $1;
      `,
      [bundleId],
    );

    if (deletedBundleResult.rowCount !== 1) {
      throw new Error(
        `Expected to delete one imported bundle for "${bundleId}", but deleted ${deletedBundleResult.rowCount ?? 0}.`,
      );
    }

    await client.query("COMMIT");

    return {
      importedBundles: Number(row?.imported_bundles ?? 0),
      nodes: Number(row?.nodes ?? 0),
      assertions: Number(row?.assertions ?? 0),
      edges: Number(row?.edges ?? 0),
      sources: Number(row?.sources ?? 0),
      revisions: Number(row?.revisions ?? 0),
      nodeSources: Number(row?.node_sources ?? 0),
      assertionSources: Number(row?.assertion_sources ?? 0),
      edgeSources: Number(row?.edge_sources ?? 0),
      contextualRecords: Number(row?.contextual_records ?? 0),
      contextPerspectiveLinks: Number(
        row?.context_perspective_links ?? 0,
      ),
      contextSourceLinks: Number(row?.context_source_links ?? 0),
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function deleteImportedBundle(
  bundleId: string,
  allowedBundleIds: ReadonlySet<string>,
): Promise<DetailedDeletedImportedBundleCounts> {
  if (!allowedBundleIds.has(bundleId)) {
    throw new Error(
      `Refusing to delete bundle "${bundleId}". It is not in the caller's explicit allow-list.`,
    );
  }

  return deleteImportedBundleTransaction(bundleId);
}

export async function deleteImportedTestBundle(
  bundleId: string,
): Promise<DeletedImportedBundleCounts> {
  if (!bundleId.startsWith(INTEGRATION_TEST_PREFIX)) {
    throw new Error(
      `Refusing to delete bundle "${bundleId}". Only bundle IDs beginning with "${INTEGRATION_TEST_PREFIX}" may be deleted.`,
    );
  }

  const {
    contextualRecords: _contextualRecords,
    contextPerspectiveLinks: _contextPerspectiveLinks,
    contextSourceLinks: _contextSourceLinks,
    ...publicCounts
  } = await deleteImportedBundleTransaction(bundleId, true);

  return publicCounts;
}
