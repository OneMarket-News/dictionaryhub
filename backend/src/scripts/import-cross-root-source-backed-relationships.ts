import "dotenv/config";

import { pathToFileURL } from "node:url";
import type { PoolClient } from "pg";

import {
  CROSS_ROOT_RELATIONSHIP_DATASET_ID,
  validateSourceBackedRelationshipDataset,
  type SourceBackedRelationshipDataset,
} from "../cross-root/source-backed-relationships.js";
import { closeDatabase, getPool } from "../lib/database.js";
import {
  assertLocalDevelopmentImportAuthorized,
  type LocalDevelopmentDatabaseAuthorization,
} from "../lib/local-development-database.js";

export interface ImportSourceBackedRelationshipOptions {
  dataset?: SourceBackedRelationshipDataset;
  developmentAuthorization?: LocalDevelopmentDatabaseAuthorization;
  simulateFailureAfterDatasetDelete?: boolean;
}

export interface SourceBackedRelationshipImportSummary {
  datasetId: string;
  version: string;
  action: "imported" | "updated" | "skipped";
  records: { imported: number; updated: number; skipped: number; failed: number };
  resourceReuse: number;
  resourceAdditions: number;
  assertions: number;
  evidence: number;
}

function summary(
  dataset: SourceBackedRelationshipDataset,
  action: SourceBackedRelationshipImportSummary["action"],
): SourceBackedRelationshipImportSummary {
  const total = 2 + dataset.assertions.length + dataset.evidence.length;
  return {
    datasetId:dataset.manifest.datasetId, version:dataset.manifest.version, action,
    records:{ imported:action === "imported" ? total : 0, updated:action === "updated" ? total : 0, skipped:action === "skipped" ? total : 0, failed:0 },
    resourceReuse:dataset.manifest.expectedCounts.resourceReuse,
    resourceAdditions:dataset.manifest.expectedCounts.resourceAdditions,
    assertions:dataset.assertions.length, evidence:dataset.evidence.length,
  };
}

async function validateReleasedResources(client: PoolClient, dataset: SourceBackedRelationshipDataset): Promise<void> {
  const required = new Map<string, string>();
  for (const assertion of dataset.assertions) {
    required.set(assertion.subjectResourceId, assertion.subjectCanonicalPublicId);
    required.set(assertion.objectResourceId, assertion.objectCanonicalPublicId);
  }
  for (const item of dataset.evidence) {
    const assertion = dataset.assertions.find((candidate) => candidate.assertionId === item.assertionId)!;
    required.set(item.sourceResourceId, assertion.sourceRecordId);
  }
  const resources = (await client.query<{
    resource_id:string; canonical_public_id:string; root_id:string; resource_type:string;
    source_dataset_id:string; source_dataset_version:string;
  }>(`
    SELECT resource_id,canonical_public_id,root_id,resource_type,source_dataset_id,source_dataset_version
    FROM cross_root_resources WHERE resource_id = ANY($1::text[]);
  `, [[...required.keys()]])).rows;
  if (resources.length !== required.size) throw new Error("A required registered relationship resource is missing.");
  for (const resource of resources) {
    if (
      resource.canonical_public_id !== required.get(resource.resource_id)
      || resource.root_id !== "HistoryRoot"
      || resource.resource_type !== "accepted-contextual-record"
      || resource.source_dataset_id !== "historyroot-plymouth-knowledge-dataset-v1"
      || resource.source_dataset_version !== "1.3.0"
    ) throw new Error(`Registered relationship resource is invalid: ${resource.resource_id}`);
  }
  const sourceRecords = (await client.query<{
    context_id:string; status:string; raw_data:Record<string, unknown>; source_ids:string[];
  }>(`
    SELECT cr.context_id,cr.status,cr.raw_data,
      COALESCE(array_agg(crs.source_id ORDER BY crs.source_id) FILTER (WHERE crs.source_id IS NOT NULL),ARRAY[]::text[]) AS source_ids
    FROM context_records cr
    LEFT JOIN context_record_sources crs ON crs.context_id=cr.context_id
    WHERE cr.domain='HistoryRoot' AND cr.context_id = ANY($1::text[])
    GROUP BY cr.context_id;
  `, [dataset.assertions.map((item) => item.sourceRecordId)])).rows;
  if (sourceRecords.length !== dataset.assertions.length) throw new Error("A released source relationship record is missing.");
  const assertions = new Map(dataset.assertions.map((item) => [item.sourceRecordId, item]));
  const evidenceByRecord = new Map<string, string[]>();
  for (const item of dataset.evidence) {
    const sourceRecordId = dataset.assertions.find((candidate) => candidate.assertionId === item.assertionId)!.sourceRecordId;
    evidenceByRecord.set(sourceRecordId, [...(evidenceByRecord.get(sourceRecordId) ?? []), item.sourceId]);
  }
  for (const record of sourceRecords) {
    const assertion = assertions.get(record.context_id)!;
    if (/draft|reject|private|withdrawn/iu.test(record.status)) throw new Error(`Nonpublic relationship record rejected: ${record.context_id}`);
    if (record.raw_data.explanation !== dataset.evidence.find((item) => item.assertionId === assertion.assertionId)!.observedExcerpt) {
      throw new Error(`Source relationship wording mismatch: ${record.context_id}`);
    }
    const actual = [...new Set(record.source_ids)].sort();
    const expected = [...new Set(evidenceByRecord.get(record.context_id) ?? [])].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Source relationship provenance mismatch: ${record.context_id}`);
  }
}

async function currentState(client: PoolClient, dataset: SourceBackedRelationshipDataset) {
  const counts = (await client.query<{ bundle:number; dataset:number; assertions:number; evidence:number }>(`
    SELECT
      (SELECT COUNT(*)::integer FROM imported_bundles WHERE bundle_id=$1 AND version=$2) AS bundle,
      (SELECT COUNT(*)::integer FROM cross_root_relationship_datasets WHERE dataset_id=$1 AND version=$2) AS dataset,
      (SELECT COUNT(*)::integer FROM cross_root_relationship_assertions WHERE dataset_id=$1) AS assertions,
      (SELECT COUNT(*)::integer FROM cross_root_relationship_evidence WHERE dataset_id=$1) AS evidence;
  `, [dataset.manifest.datasetId, dataset.manifest.version])).rows[0]!;
  const assertionRows = (await client.query<{ assertion_id:string; content_hash:string }>(`
    SELECT assertion_id,content_hash FROM cross_root_relationship_assertions WHERE dataset_id=$1 ORDER BY assertion_id;
  `, [dataset.manifest.datasetId])).rows;
  const evidenceRows = (await client.query<{ evidence_id:string; evidence_hash:string }>(`
    SELECT evidence_id,evidence_hash FROM cross_root_relationship_evidence WHERE dataset_id=$1 ORDER BY evidence_id;
  `, [dataset.manifest.datasetId])).rows;
  const expectedAssertions = dataset.assertions.map((item) => ({ assertion_id:item.assertionId, content_hash:item.contentHash })).sort((a,b) => a.assertion_id.localeCompare(b.assertion_id));
  const expectedEvidence = dataset.evidence.map((item) => ({ evidence_id:item.evidenceId, evidence_hash:item.evidenceHash })).sort((a,b) => a.evidence_id.localeCompare(b.evidence_id));
  return { counts, exact:JSON.stringify(Object.values(counts)) === JSON.stringify([1,1,dataset.assertions.length,dataset.evidence.length])
    && JSON.stringify(assertionRows) === JSON.stringify(expectedAssertions)
    && JSON.stringify(evidenceRows) === JSON.stringify(expectedEvidence) };
}

export async function importSourceBackedRelationships(
  options: ImportSourceBackedRelationshipOptions = {},
): Promise<SourceBackedRelationshipImportSummary> {
  const dataset = await validateSourceBackedRelationshipDataset(options.dataset);
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    const databaseName = (await client.query<{ database_name:string }>("SELECT current_database() AS database_name;")).rows[0]?.database_name;
    if (databaseName !== "sourceroot_test" && !options.developmentAuthorization) {
      throw new Error(`Source-backed relationship import is restricted to sourceroot_test; received ${databaseName ?? "unknown"}.`);
    }
    if (databaseName !== "sourceroot_test") assertLocalDevelopmentImportAuthorized(options.developmentAuthorization, databaseName);
    await validateReleasedResources(client, dataset);
    await client.query("BEGIN");
    try {
      const before = await currentState(client, dataset);
      if (before.exact) { await client.query("COMMIT"); return summary(dataset, "skipped"); }
      const action = Object.values(before.counts).some((value) => value > 0) ? "updated" : "imported";
      await client.query("DELETE FROM imported_bundles WHERE bundle_id=$1;", [CROSS_ROOT_RELATIONSHIP_DATASET_ID]);
      if (options.simulateFailureAfterDatasetDelete) throw new Error("Simulated source-backed relationship rollback.");
      await client.query(`
        INSERT INTO imported_bundles(bundle_id,bundle_type,version,domain,bundle)
        VALUES($1,'cross-root-source-backed-relationships',$2,'SourceRoot',$3::jsonb);
      `, [dataset.manifest.datasetId, dataset.manifest.version, JSON.stringify(dataset.manifest)]);
      await client.query(`
        INSERT INTO cross_root_relationship_datasets(dataset_id,version,preparation_algorithm_version,source_dataset_id,source_dataset_version,input_fingerprints,expected_counts)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb);
      `, [dataset.manifest.datasetId,dataset.manifest.version,dataset.manifest.preparationAlgorithmVersion,
        dataset.manifest.sourceDatasetIdentities[0]!.datasetId,dataset.manifest.sourceDatasetIdentities[0]!.version,
        JSON.stringify(dataset.inputFingerprints),JSON.stringify(dataset.manifest.expectedCounts)]);
      await client.query(`
        INSERT INTO cross_root_relationship_assertions(
          assertion_id,dataset_id,subject_resource_id,subject_root_id,predicate,object_resource_id,object_root_id,
          directionality,inverse_display_label,source_native_relationship_type,relationship_family,derivation_kind,
          review_state,assertion_status,certainty,uncertainty_statement,dispute_state,temporal_scope,
          geographic_scope_description,is_causal,causal_role,source_record_id,source_record_type,source_dataset_id,
          source_dataset_version,deterministic_identity_hash,content_hash,provenance_order,metadata
        ) SELECT assertion_id,$1,subject_resource_id,subject_root_id,predicate,object_resource_id,object_root_id,
          directionality,inverse_display_label,source_native_relationship_type,relationship_family,derivation_kind,
          review_state,assertion_status,certainty,uncertainty_statement,dispute_state,temporal_scope,
          geographic_scope_description,is_causal,causal_role,source_record_id,source_record_type,source_dataset_id,
          source_dataset_version,deterministic_identity_hash,content_hash,provenance_order,metadata
        FROM jsonb_to_recordset($2::jsonb) AS x(
          assertion_id text,subject_resource_id text,subject_root_id text,predicate text,object_resource_id text,object_root_id text,
          directionality text,inverse_display_label text,source_native_relationship_type text,relationship_family text,
          derivation_kind text,review_state text,assertion_status text,certainty text,uncertainty_statement text,
          dispute_state text,temporal_scope jsonb,geographic_scope_description text,is_causal boolean,causal_role text,
          source_record_id text,source_record_type text,source_dataset_id text,source_dataset_version text,
          deterministic_identity_hash text,content_hash text,provenance_order integer,metadata jsonb
        );
      `, [dataset.manifest.datasetId, JSON.stringify(dataset.assertions.map((item) => Object.fromEntries(Object.entries(item).map(([key,value]) => [key.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`),value]))))]);
      await client.query(`
        INSERT INTO cross_root_relationship_evidence(
          evidence_id,dataset_id,assertion_id,source_root_id,source_resource_id,source_record_type,source_field,
          evidence_mode,observed_excerpt,start_offset,end_offset,source_claim_id,source_evidence_id,publication_id,
          artifact_id,source_id,citation,source_locator,source_url,source_record_hash,source_field_hash,evidence_hash,
          source_dataset_id,source_dataset_version,evidence_order,uncertainty_note,dispute_note
        ) SELECT evidence_id,$1,assertion_id,source_root_id,source_resource_id,source_record_type,source_field,
          evidence_mode,observed_excerpt,start_offset,end_offset,source_claim_id,source_evidence_id,publication_id,
          artifact_id,source_id,citation,source_locator,source_url,source_record_hash,source_field_hash,evidence_hash,
          source_dataset_id,source_dataset_version,evidence_order,uncertainty_note,dispute_note
        FROM jsonb_to_recordset($2::jsonb) AS x(
          evidence_id text,assertion_id text,source_root_id text,source_resource_id text,source_record_type text,source_field text,
          evidence_mode text,observed_excerpt text,start_offset integer,end_offset integer,source_claim_id text,
          source_evidence_id text,publication_id text,artifact_id text,source_id text,citation text,source_locator text,
          source_url text,source_record_hash text,source_field_hash text,evidence_hash text,source_dataset_id text,
          source_dataset_version text,evidence_order integer,uncertainty_note text,dispute_note text
        );
      `, [dataset.manifest.datasetId, JSON.stringify(dataset.evidence.map((item) => Object.fromEntries(Object.entries(item).map(([key,value]) => [key.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`),value]))))]);
      await client.query("COMMIT");
      return summary(dataset, action);
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    }
  } finally { client.release(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  importSourceBackedRelationships().then((value) => console.log(JSON.stringify(value, null, 2)))
    .catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
    .finally(closeDatabase);
}
