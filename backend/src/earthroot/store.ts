/**
 * EarthRoot persistence (Chunk 15A).
 *
 * Writes are transactional and validate before they touch the database, so an
 * invalid assertion never reaches storage. The database independently enforces
 * MOST of the same rules through typed foreign keys, predicate CHECK
 * constraints, and deferred evidence triggers.
 *
 * ONE EXCEPTION, STATED PLAINLY. Object-side predicate typing is NOT fully
 * enforced at the SQL boundary: ck_earthroot_predicate_typing evaluates to NULL
 * (and a NULL CHECK passes) when object_entity_type is NULL, and the composite
 * object foreign key is MATCH SIMPLE, so it is satisfied vacuously when
 * object_resource_id is NULL. For that class of rule this module and the domain
 * validator are the ONLY guard, not defence in depth. Subject-side typing IS
 * database-enforced. Closing the object-side gap needs a future governed
 * migration; migration 020 is frozen for the 15A audit.
 *
 * This module reads and writes EarthRoot tables only. It does not read, write,
 * or reinterpret any Chunk 14A or 14B row.
 */

import type { PoolClient } from "pg";

import { getPool } from "../lib/database.js";
import { EARTHROOT_CONTRACT_VERSION } from "./contract.js";
import {
  buildResourceTypeIndex,
  validateEarthRootAssertion,
  validateEarthRootResource,
  type EarthRootAssertion,
  type EarthRootResource,
  type EarthRootViolation,
} from "./domain.js";

export class EarthRootStoreError extends Error {
  readonly violations: readonly EarthRootViolation[];
  constructor(
    message: string,
    violations: readonly EarthRootViolation[] = [],
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "EarthRootStoreError";
    this.violations = violations;
  }
}

/** Fails closed when no database is configured; never invents a connection. */
function requireDatabase() {
  const pool = getPool();
  if (!pool) {
    throw new EarthRootStoreError("DATABASE_URL is not configured.");
  }
  return pool;
}

export interface EarthRootDataset {
  readonly datasetId: string;
  readonly version: string;
  readonly title: string;
  readonly status: "fixture" | "accepted";
  readonly fixtureOnly: boolean;
}

export interface EarthRootBundle {
  readonly dataset: EarthRootDataset;
  readonly resources: readonly EarthRootResource[];
  readonly assertions: readonly EarthRootAssertion[];
}

/**
 * Validates a whole bundle before any write is attempted. Returns every
 * violation rather than the first, so a caller sees the complete picture.
 */
export function validateEarthRootBundle(
  bundle: EarthRootBundle,
): readonly EarthRootViolation[] {
  const violations: EarthRootViolation[] = [];

  if (bundle.dataset.status === "accepted" && bundle.dataset.fixtureOnly) {
    violations.push({
      rule: "dataset-fixture-coherent",
      message:
        "A dataset cannot claim accepted status while remaining fixture-only.",
    });
  }

  for (const resource of bundle.resources) {
    violations.push(...validateEarthRootResource(resource));
  }

  const context = { resourceTypes: buildResourceTypeIndex(bundle.resources) };
  for (const assertion of bundle.assertions) {
    violations.push(...validateEarthRootAssertion(assertion, context));
  }

  // Every row must belong to the dataset the bundle declares. Without this the
  // bundle is certified valid here and then rejected by the foreign key at
  // COMMIT, and removeDataset would clean only the declared dataset and leave
  // the strays behind on a re-save.
  for (const resource of bundle.resources) {
    if (resource.datasetId !== bundle.dataset.datasetId) {
      violations.push({
        rule: "bundle-resource-dataset-coherent",
        message: `resource ${resource.resourceId} declares dataset ${resource.datasetId} but the bundle is ${bundle.dataset.datasetId}.`,
      });
    }
  }
  for (const assertion of bundle.assertions) {
    if (assertion.datasetId !== bundle.dataset.datasetId) {
      violations.push({
        rule: "bundle-assertion-dataset-coherent",
        message: `assertion ${assertion.assertionId} declares dataset ${assertion.datasetId} but the bundle is ${bundle.dataset.datasetId}.`,
      });
    }
  }

  // The uniqueness scopes checked below are read from migration 020 rather than
  // assumed. They are the scopes a bundle can violate; 020 also declares
  // uq_earthroot_assertion_order, uq_earthroot_assertion_dataset and
  // uq_earthroot_resource_typed, which the store satisfies by construction and
  // which are therefore not restated here. This is a subset, not the whole set.
  // Scopes below mirror migration 020, read from the
  // migration rather than assumed:
  //   earthroot_resources.resource_id            PRIMARY KEY   -> global
  //   UNIQUE (dataset_id, canonical_public_id)                 -> per dataset
  //   earthroot_assertions.assertion_id          PRIMARY KEY   -> global
  //   earthroot_assertion_evidence.evidence_id   PRIMARY KEY   -> global
  //   uq_earthroot_evidence_order (assertion_id, evidence_order) -> per assertion
  // Basic domain validation must not be left to a raw PostgreSQL unique
  // violation surfacing from deep inside a transaction.
  const duplicate = (rule: string, what: string, value: string) =>
    violations.push({ rule, message: `${what} ${value} appears more than once in this bundle.` });

  const resourceIds = new Set<string>();
  for (const resource of bundle.resources) {
    if (resourceIds.has(resource.resourceId)) {
      duplicate("resource-id-unique", "resourceId", resource.resourceId);
    }
    resourceIds.add(resource.resourceId);
  }

  const assertionIds = new Set<string>();
  const evidenceIds = new Set<string>();
  for (const assertion of bundle.assertions) {
    if (assertionIds.has(assertion.assertionId)) {
      duplicate("assertion-id-unique", "assertionId", assertion.assertionId);
    }
    assertionIds.add(assertion.assertionId);

    const orders = new Set<number>();
    for (const evidence of assertion.evidence) {
      if (evidenceIds.has(evidence.evidenceId)) {
        duplicate("evidence-id-unique", "evidenceId", evidence.evidenceId);
      }
      evidenceIds.add(evidence.evidenceId);

      if (orders.has(evidence.evidenceOrder)) {
        violations.push({
          rule: "evidence-order-unique-per-assertion",
          message: `assertion ${assertion.assertionId} reuses evidenceOrder ${evidence.evidenceOrder}; the database requires it unique within an assertion.`,
        });
      }
      orders.add(evidence.evidenceOrder);
    }
  }

  const seen = new Set<string>();
  for (const resource of bundle.resources) {
    const key = `${resource.datasetId}::${resource.canonicalPublicId}`;
    if (seen.has(key)) {
      violations.push({
        rule: "canonical-public-id-unique",
        message: `canonicalPublicId ${resource.canonicalPublicId} appears twice in dataset ${resource.datasetId}.`,
      });
    }
    seen.add(key);
  }

  return violations;
}

/** Removes one EarthRoot dataset and its children in dependency order. */
async function removeDataset(
  client: PoolClient,
  datasetId: string,
): Promise<void> {
  await client.query(
    "DELETE FROM earthroot_assertion_evidence WHERE dataset_id = $1",
    [datasetId],
  );
  await client.query("DELETE FROM earthroot_assertions WHERE dataset_id = $1", [
    datasetId,
  ]);
  await client.query("DELETE FROM earthroot_resources WHERE dataset_id = $1", [
    datasetId,
  ]);
  await client.query("DELETE FROM earthroot_datasets WHERE dataset_id = $1", [
    datasetId,
  ]);
}

async function insertBundle(
  client: PoolClient,
  bundle: EarthRootBundle,
): Promise<void> {
  await client.query(
    `INSERT INTO earthroot_datasets
       (dataset_id, version, title, status, fixture_only, contract_version)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      bundle.dataset.datasetId,
      bundle.dataset.version,
      bundle.dataset.title,
      bundle.dataset.status,
      bundle.dataset.fixtureOnly,
      EARTHROOT_CONTRACT_VERSION,
    ],
  );

  for (const resource of bundle.resources) {
    await client.query(
      `INSERT INTO earthroot_resources
         (resource_id, dataset_id, entity_type, canonical_public_id)
       VALUES ($1, $2, $3, $4)`,
      [
        resource.resourceId,
        resource.datasetId,
        resource.entityType,
        resource.canonicalPublicId,
      ],
    );
  }

  const types = buildResourceTypeIndex(bundle.resources);
  let order = 0;
  for (const assertion of bundle.assertions) {
    order += 1;
    await client.query(
      `INSERT INTO earthroot_assertions
         (assertion_id, dataset_id, subject_resource_id, subject_entity_type,
          predicate, object_resource_id, object_entity_type, object_literal,
          name_type, language_tag, script_identifier,
          temporal_mode, valid_from_year, valid_until_year, temporal_description,
          certainty, uncertainty_statement, review_state, dispute_state,
          assertion_status, derivation, assertion_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        assertion.assertionId,
        assertion.datasetId,
        assertion.subjectResourceId,
        types.get(assertion.subjectResourceId) ?? null,
        assertion.predicate,
        assertion.objectResourceId,
        assertion.objectResourceId
          ? (types.get(assertion.objectResourceId) ?? null)
          : null,
        assertion.objectLiteral,
        assertion.nameType,
        assertion.languageTag,
        assertion.script,
        assertion.temporal.mode,
        assertion.temporal.validFromYear,
        assertion.temporal.validUntilYear,
        assertion.temporal.description,
        assertion.certainty,
        assertion.uncertaintyStatement,
        assertion.reviewState,
        assertion.disputeState,
        assertion.assertionStatus,
        assertion.derivation,
        order,
      ],
    );

    for (const evidence of assertion.evidence) {
      await client.query(
        `INSERT INTO earthroot_assertion_evidence
           (evidence_id, assertion_id, dataset_id, source_id, source_locator,
            statement, source_dataset_id, source_dataset_version, evidence_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          evidence.evidenceId,
          assertion.assertionId,
          assertion.datasetId,
          evidence.sourceId,
          evidence.sourceLocator,
          evidence.statement,
          evidence.sourceDatasetId,
          evidence.sourceDatasetVersion,
          evidence.evidenceOrder,
        ],
      );
    }
  }
}

/**
 * Saves an EarthRoot bundle in one transaction. Validation runs first; on any
 * database failure the transaction rolls back and nothing is persisted.
 */
export async function saveEarthRootBundle(
  bundle: EarthRootBundle,
): Promise<void> {
  const violations = validateEarthRootBundle(bundle);
  if (violations.length > 0) {
    throw new EarthRootStoreError(
      "EarthRoot bundle failed validation; nothing was written.",
      violations,
    );
  }

  const pool = requireDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Child rows are removed explicitly in dependency order. The foreign keys
    // are ON DELETE RESTRICT on purpose, so that discarding a resource that
    // still carries sourced assertions fails loudly instead of cascading
    // silently. Re-saving therefore states exactly what it removes rather than
    // relying on a cascade that must not exist.
    await removeDataset(client, bundle.dataset.datasetId);
    await insertBundle(client, bundle);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    // The module boundary promises EarthRootStoreError. Letting a raw pg error
    // through means a caller's instanceof guard misses exactly the integrity
    // failures this store exists to enforce. The cause is preserved rather
    // than swallowed, so the underlying constraint stays diagnosable.
    if (error instanceof EarthRootStoreError) throw error;
    const constraint =
      typeof error === "object" && error !== null && "constraint" in error
        ? String((error as { constraint?: unknown }).constraint ?? "")
        : "";
    throw new EarthRootStoreError(
      "EarthRoot bundle could not be persisted; the transaction rolled back and nothing was written.",
      [
        {
          rule: constraint ? `database-constraint:${constraint}` : "database-error",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
      { cause: error },
    );
  } finally {
    client.release();
  }
}

export interface EarthRootCounts {
  readonly datasets: number;
  readonly places: number;
  readonly polities: number;
  readonly assertions: number;
  readonly evidence: number;
}

export async function getEarthRootCounts(
  datasetId: string,
): Promise<EarthRootCounts> {
  const pool = requireDatabase();
  const result = await pool.query<{
    datasets: number;
    places: number;
    polities: number;
    assertions: number;
    evidence: number;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM earthroot_datasets WHERE dataset_id = $1) AS datasets,
       (SELECT COUNT(*)::int FROM earthroot_resources
          WHERE dataset_id = $1 AND entity_type = 'place') AS places,
       (SELECT COUNT(*)::int FROM earthroot_resources
          WHERE dataset_id = $1 AND entity_type = 'polity') AS polities,
       (SELECT COUNT(*)::int FROM earthroot_assertions WHERE dataset_id = $1) AS assertions,
       (SELECT COUNT(*)::int FROM earthroot_assertion_evidence WHERE dataset_id = $1) AS evidence`,
    [datasetId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new EarthRootStoreError("EarthRoot count query returned no row.");
  }
  return row;
}

/** Removes an EarthRoot dataset. Fixture cleanup only; touches no other Root. */
export async function deleteEarthRootDataset(datasetId: string): Promise<void> {
  const pool = requireDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await removeDataset(client, datasetId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
