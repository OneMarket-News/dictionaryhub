import "dotenv/config";

import { pathToFileURL } from "node:url";
import type { PoolClient } from "pg";

import {
  CROSS_ROOT_DATASET_ID,
  deterministicHash,
  sha256,
  validateCrossRootDataset,
  type CrossRootDataset,
  type CrossRootResource,
} from "../cross-root/lexical-evidence.js";
import { closeDatabase, getPool } from "../lib/database.js";
import {
  assertLocalDevelopmentImportAuthorized,
  type LocalDevelopmentDatabaseAuthorization,
} from "../lib/local-development-database.js";

export interface ImportCrossRootOptions {
  dataset?: CrossRootDataset;
  developmentAuthorization?: LocalDevelopmentDatabaseAuthorization;
  simulateFailureAfterDatasetDelete?: boolean;
}

export interface CrossRootImportSummary {
  datasetId: string;
  version: string;
  action: "imported" | "updated" | "skipped";
  records: { imported: number; updated: number; skipped: number; failed: number };
  resources: number;
  links: number;
  evidence: number;
}

function stringsIn(value: unknown): string {
  return JSON.stringify(value);
}

async function validateActualRootResources(client: PoolClient, resources: CrossRootResource[]): Promise<void> {
  const dictionary = resources.filter((item) => item.rootId === "DictionaryRoot");
  const dictionaryRows = (await client.query<{
    lemma_id: string; canonical_written_form: string; dataset_id: string; status: string; archived_at: Date | null;
  }>(`
    SELECT lemma_id, canonical_written_form, dataset_id, status, archived_at
    FROM dictionaryroot_lexical_lemmas WHERE lemma_id = ANY($1::text[]);
  `, [dictionary.map((item) => item.canonicalPublicId)])).rows;
  const dictionaryById = new Map(dictionaryRows.map((row) => [row.lemma_id, row]));
  for (const resource of dictionary) {
    const row = dictionaryById.get(resource.canonicalPublicId);
    if (
      !row
      || row.dataset_id !== resource.sourceDatasetId
      || row.archived_at !== null
      || sha256(row.canonical_written_form) !== resource.resourceContentHash
    ) throw new Error(`DictionaryRoot resource validation failed: ${resource.canonicalPublicId}`);
  }

  const history = resources.filter((item) => item.rootId === "HistoryRoot");
  const historyRows = (await client.query<{
    context_id: string; bundle_id: string; status: string; label: string; summary: string | null; raw_data: unknown;
  }>(`
    SELECT context_id, bundle_id, status, label, summary, raw_data
    FROM context_records
    WHERE domain = 'HistoryRoot' AND context_id = ANY($1::text[]);
  `, [history.map((item) => item.canonicalPublicId)])).rows;
  const aliasRows = (await client.query<{ entity_context_id: string; alias_text: string }>(`
    SELECT entity_context_id, alias_text FROM context_entity_aliases
    WHERE entity_context_id = ANY($1::text[]);
  `, [history.map((item) => item.canonicalPublicId)])).rows;
  const aliases = new Map<string, string[]>();
  for (const row of aliasRows) aliases.set(row.entity_context_id, [...(aliases.get(row.entity_context_id) ?? []), row.alias_text]);
  const historyById = new Map(historyRows.map((row) => [row.context_id, row]));
  for (const resource of history) {
    const row = historyById.get(resource.canonicalPublicId);
    const fields = resource.metadata.fields ?? [];
    const actualMaterial = row ? stringsIn({ label: row.label, summary: row.summary, rawData: row.raw_data, aliases: aliases.get(row.context_id) ?? [] }) : "";
    const missingFields = fields.filter((field) => !actualMaterial.includes(JSON.stringify(field.text).slice(1, -1)));
    if (!row) throw new Error(`HistoryRoot resource is absent: ${resource.canonicalPublicId}`);
    if (row.bundle_id !== resource.sourceDatasetId) throw new Error(`HistoryRoot dataset mismatch: ${resource.canonicalPublicId}`);
    if (row.status !== resource.metadata.status) throw new Error(`HistoryRoot release status mismatch: ${resource.canonicalPublicId}`);
    if (deterministicHash(fields) !== resource.resourceContentHash) throw new Error(`HistoryRoot content hash mismatch: ${resource.canonicalPublicId}`);
    if (missingFields.length > 0) throw new Error(`HistoryRoot canonical fields are absent for ${resource.canonicalPublicId}: ${missingFields.map((field) => field.name).join(", ")}`);
  }

  const bible = resources.filter((item) => item.rootId === "BibleRoot");
  const bibleRows = (await client.query<{ edition_text_id: string; dataset_id: string; exact_text: string }>(`
    SELECT edition_text_id, dataset_id, exact_text FROM bibleroot_verse_texts
    WHERE edition_text_id = ANY($1::text[]);
  `, [bible.map((item) => item.canonicalPublicId)])).rows;
  const bibleById = new Map(bibleRows.map((row) => [row.edition_text_id, row]));
  for (const resource of bible) {
    const row = bibleById.get(resource.canonicalPublicId);
    if (!row || row.dataset_id !== resource.sourceDatasetId || sha256(row.exact_text) !== resource.resourceContentHash) {
      throw new Error(`BibleRoot resource validation failed: ${resource.canonicalPublicId}`);
    }
  }
}

function result(dataset: CrossRootDataset, action: CrossRootImportSummary["action"]): CrossRootImportSummary {
  const total = 2 + dataset.resources.length + dataset.links.length + dataset.evidence.length;
  return {
    datasetId: dataset.manifest.datasetId,
    version: dataset.manifest.version,
    action,
    records: {
      imported: action === "imported" ? total : 0,
      updated: action === "updated" ? total : 0,
      skipped: action === "skipped" ? total : 0,
      failed: 0,
    },
    resources: dataset.resources.length,
    links: dataset.links.length,
    evidence: dataset.evidence.length,
  };
}

async function currentCounts(client: PoolClient, version: string) {
  return (await client.query<{ bundle: number; dataset: number; resources: number; links: number; evidence: number }>(`
    SELECT
      (SELECT COUNT(*)::integer FROM imported_bundles WHERE bundle_id=$1 AND version=$2) AS bundle,
      (SELECT COUNT(*)::integer FROM cross_root_datasets WHERE dataset_id=$1 AND version=$2) AS dataset,
      (SELECT COUNT(*)::integer FROM cross_root_resources WHERE dataset_id=$1) AS resources,
      (SELECT COUNT(*)::integer FROM cross_root_links WHERE dataset_id=$1) AS links,
      (SELECT COUNT(*)::integer FROM cross_root_link_evidence WHERE dataset_id=$1) AS evidence;
  `, [CROSS_ROOT_DATASET_ID, version])).rows[0]!;
}

export async function importCrossRootLexicalEvidence(options: ImportCrossRootOptions = {}): Promise<CrossRootImportSummary> {
  const dataset = await validateCrossRootDataset(options.dataset);
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    const databaseName = (await client.query<{ database_name: string }>("SELECT current_database() AS database_name;")).rows[0]?.database_name;
    if (databaseName !== "sourceroot_test" && !options.developmentAuthorization) {
      throw new Error(`Cross-Root import is restricted to sourceroot_test; received ${databaseName ?? "unknown"}.`);
    }
    if (databaseName !== "sourceroot_test") assertLocalDevelopmentImportAuthorized(options.developmentAuthorization, databaseName);
    await validateActualRootResources(client, dataset.resources);

    await client.query("BEGIN");
    try {
      const existing = await currentCounts(client, dataset.manifest.version);
      const exact = JSON.stringify(Object.values(existing)) === JSON.stringify([
        1, 1, dataset.resources.length, dataset.links.length, dataset.evidence.length,
      ]);
      if (exact) {
        await client.query("COMMIT");
        return result(dataset, "skipped");
      }
      const action = Object.values(existing).some((value) => value > 0) ? "updated" : "imported";
      await client.query("DELETE FROM imported_bundles WHERE bundle_id=$1;", [CROSS_ROOT_DATASET_ID]);
      if (options.simulateFailureAfterDatasetDelete) throw new Error("Simulated Cross-Root transactional rollback.");
      await client.query(`
        INSERT INTO imported_bundles(bundle_id,bundle_type,version,domain,bundle)
        VALUES($1,'cross-root-lexical-evidence',$2,'SourceRoot',$3::jsonb);
      `, [CROSS_ROOT_DATASET_ID, dataset.manifest.version, JSON.stringify(dataset.manifest)]);
      await client.query(`
        INSERT INTO cross_root_datasets(dataset_id,version,algorithm_version,derivation_boundary,review_boundary,input_fingerprints,expected_counts)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb);
      `, [CROSS_ROOT_DATASET_ID, dataset.manifest.version, dataset.manifest.algorithmVersion, dataset.manifest.derivationBoundary, dataset.manifest.reviewBoundary, JSON.stringify(dataset.inputFingerprints), JSON.stringify(dataset.manifest.expectedCounts)]);
      await client.query(`
        INSERT INTO cross_root_resources(resource_id,dataset_id,root_id,resource_type,canonical_public_id,display_label,canonical_local_url,source_dataset_id,source_dataset_version,resource_content_hash,deterministic_identity_hash,metadata,display_order)
        SELECT resource_id,$1,root_id,resource_type,canonical_public_id,display_label,canonical_local_url,source_dataset_id,source_dataset_version,resource_content_hash,deterministic_identity_hash,metadata,display_order
        FROM jsonb_to_recordset($2::jsonb) AS x(resource_id text,root_id text,resource_type text,canonical_public_id text,display_label text,canonical_local_url text,source_dataset_id text,source_dataset_version text,resource_content_hash text,deterministic_identity_hash text,metadata jsonb,display_order integer);
      `, [CROSS_ROOT_DATASET_ID, JSON.stringify(dataset.resources.map((item) => ({ resource_id: item.resourceId, root_id: item.rootId, resource_type: item.resourceType, canonical_public_id: item.canonicalPublicId, display_label: item.displayLabel, canonical_local_url: item.canonicalLocalUrl, source_dataset_id: item.sourceDatasetId, source_dataset_version: item.sourceDatasetVersion, resource_content_hash: item.resourceContentHash, deterministic_identity_hash: item.deterministicIdentityHash, metadata: item.metadata, display_order: item.displayOrder })))]);
      await client.query(`
        INSERT INTO cross_root_links(link_id,dataset_id,source_resource_id,source_root_id,target_resource_id,target_root_id,relationship_type,directionality,derivation_kind,review_status,algorithm_version,deterministic_content_hash,display_order)
        SELECT link_id,$1,source_resource_id,source_root_id,target_resource_id,target_root_id,relationship_type,directionality,derivation_kind,review_status,algorithm_version,deterministic_content_hash,display_order
        FROM jsonb_to_recordset($2::jsonb) AS x(link_id text,source_resource_id text,source_root_id text,target_resource_id text,target_root_id text,relationship_type text,directionality text,derivation_kind text,review_status text,algorithm_version text,deterministic_content_hash text,display_order integer);
      `, [CROSS_ROOT_DATASET_ID, JSON.stringify(dataset.links.map((item) => ({ link_id: item.linkId, source_resource_id: item.sourceResourceId, source_root_id: item.sourceRootId, target_resource_id: item.targetResourceId, target_root_id: item.targetRootId, relationship_type: item.relationshipType, directionality: item.directionality, derivation_kind: item.derivationKind, review_status: item.reviewStatus, algorithm_version: item.algorithmVersion, deterministic_content_hash: item.deterministicContentHash, display_order: item.displayOrder })))]);
      await client.query(`
        INSERT INTO cross_root_link_evidence(evidence_id,dataset_id,link_id,target_field,observed_surface_text,normalized_match_text,start_offset,end_offset,context_excerpt,target_content_hash,target_field_content_hash,source_dataset_id,source_dataset_version,evidence_order)
        SELECT evidence_id,$1,link_id,target_field,observed_surface_text,normalized_match_text,start_offset,end_offset,context_excerpt,target_content_hash,target_field_content_hash,source_dataset_id,source_dataset_version,evidence_order
        FROM jsonb_to_recordset($2::jsonb) AS x(evidence_id text,link_id text,target_field text,observed_surface_text text,normalized_match_text text,start_offset integer,end_offset integer,context_excerpt text,target_content_hash text,target_field_content_hash text,source_dataset_id text,source_dataset_version text,evidence_order integer);
      `, [CROSS_ROOT_DATASET_ID, JSON.stringify(dataset.evidence.map((item) => ({ evidence_id: item.evidenceId, link_id: item.linkId, target_field: item.targetField, observed_surface_text: item.observedSurfaceText, normalized_match_text: item.normalizedMatchText, start_offset: item.startOffset, end_offset: item.endOffset, context_excerpt: item.contextExcerpt, target_content_hash: item.targetContentHash, target_field_content_hash: item.targetFieldContentHash, source_dataset_id: item.sourceDatasetId, source_dataset_version: item.sourceDatasetVersion, evidence_order: item.evidenceOrder })))]);
      await client.query("COMMIT");
      return result(dataset, action);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  importCrossRootLexicalEvidence().then((value) => console.log(JSON.stringify(value, null, 2)))
    .catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
    .finally(closeDatabase);
}
