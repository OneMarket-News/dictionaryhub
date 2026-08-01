import { CROSS_ROOT_DATASET_ID } from "../cross-root/lexical-evidence.js";
import { getPool } from "../lib/database.js";

export class CrossRootQueryError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
  }
}

const ROOT_TYPES = new Map([
  ["DictionaryRoot", "lemma"],
  ["HistoryRoot", "accepted-contextual-record"],
  ["BibleRoot", "edition-verse-text"],
]);

function database() {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  return pool;
}

export async function getCrossRootCoverage() {
  const result = await database().query<{
    dataset_id: string; version: string; algorithm_version: string; derivation_boundary: string;
    review_boundary: string; input_fingerprints: unknown; expected_counts: Record<string, number>;
    resources: number; links: number; evidence: number;
  }>(`
    SELECT d.dataset_id,d.version,d.algorithm_version,d.derivation_boundary,d.review_boundary,
      d.input_fingerprints,d.expected_counts,
      (SELECT COUNT(*)::integer FROM cross_root_resources r WHERE r.dataset_id=d.dataset_id) AS resources,
      (SELECT COUNT(*)::integer FROM cross_root_links l WHERE l.dataset_id=d.dataset_id) AS links,
      (SELECT COUNT(*)::integer FROM cross_root_link_evidence e WHERE e.dataset_id=d.dataset_id) AS evidence
    FROM cross_root_datasets d WHERE d.dataset_id=$1;
  `, [CROSS_ROOT_DATASET_ID]);
  const row = result.rows[0];
  if (!row) return {
    ready: false,
    status: "awaiting-data",
    datasetId: CROSS_ROOT_DATASET_ID,
    message: "Cross-Root lexical evidence has not been provisioned. No fallback links are available.",
  };
  const ready = row.resources === row.expected_counts.resources
    && row.links === row.expected_counts.links && row.evidence === row.expected_counts.evidence;
  return {
    ready,
    status: ready ? "ready" : "awaiting-data",
    datasetId: row.dataset_id,
    datasetVersion: row.version,
    algorithmVersion: row.algorithm_version,
    derivationBoundary: row.derivation_boundary,
    reviewStateBoundary: row.review_boundary,
    participatingRoots: ["DictionaryRoot", "HistoryRoot", "BibleRoot"],
    participatingResourceTypes: ["lemma", "accepted-contextual-record", "edition-verse-text"],
    counts: row.expected_counts,
    actualCounts: { resources: row.resources, links: row.links, evidence: row.evidence },
    inputFingerprints: row.input_fingerprints,
    semanticConclusion: null,
  };
}

interface ResourceRow {
  resource_id: string; root_id: string; resource_type: string; canonical_public_id: string;
  display_label: string; canonical_local_url: string; source_dataset_id: string;
  source_dataset_version: string; resource_content_hash: string; metadata: Record<string, unknown>;
}

function mapResource(row: ResourceRow) {
  return {
    resourceId: row.resource_id,
    rootId: row.root_id,
    resourceType: row.resource_type,
    canonicalPublicId: row.canonical_public_id,
    displayLabel: row.display_label,
    canonicalLocalUrl: row.canonical_local_url,
    sourceDatasetId: row.source_dataset_id,
    sourceDatasetVersion: row.source_dataset_version,
    resourceContentHash: row.resource_content_hash,
    metadata: row.metadata,
  };
}

export async function getCrossRootLinks(query: {
  root: string; resourceType: string; resourceId: string; targetRoot?: string; limit: number; cursor: number;
}) {
  if (!ROOT_TYPES.has(query.root)) throw new CrossRootQueryError("unsupported-root", `Unsupported Root: ${query.root}.`);
  if (ROOT_TYPES.get(query.root) !== query.resourceType) {
    throw new CrossRootQueryError("unsupported-resource-type", `${query.resourceType} is not supported for ${query.root}.`);
  }
  if (query.targetRoot && !ROOT_TYPES.has(query.targetRoot)) {
    throw new CrossRootQueryError("unsupported-target-root", `Unsupported target Root: ${query.targetRoot}.`);
  }
  const selectedResult = await database().query<ResourceRow>(`
    SELECT resource_id,root_id,resource_type,canonical_public_id,display_label,canonical_local_url,
      source_dataset_id,source_dataset_version,resource_content_hash,metadata
    FROM cross_root_resources
    WHERE dataset_id=$1 AND root_id=$2 AND resource_type=$3 AND canonical_public_id=$4;
  `, [CROSS_ROOT_DATASET_ID, query.root, query.resourceType, query.resourceId]);
  const selected = selectedResult.rows[0];
  if (!selected) throw new CrossRootQueryError("resource-not-found", "The requested registered resource was not found.", 404);
  const links = (await database().query<{
    link_id: string; relationship_type: string; directionality: string; derivation_kind: string;
    review_status: string; algorithm_version: string; display_order: number;
    source: ResourceRow; target: ResourceRow; evidence: unknown;
  }>(`
    SELECT l.link_id,l.relationship_type,l.directionality,l.derivation_kind,l.review_status,l.algorithm_version,l.display_order,
      jsonb_build_object('resource_id',s.resource_id,'root_id',s.root_id,'resource_type',s.resource_type,'canonical_public_id',s.canonical_public_id,'display_label',s.display_label,'canonical_local_url',s.canonical_local_url,'source_dataset_id',s.source_dataset_id,'source_dataset_version',s.source_dataset_version,'resource_content_hash',s.resource_content_hash,'metadata',s.metadata) AS source,
      jsonb_build_object('resource_id',t.resource_id,'root_id',t.root_id,'resource_type',t.resource_type,'canonical_public_id',t.canonical_public_id,'display_label',t.display_label,'canonical_local_url',t.canonical_local_url,'source_dataset_id',t.source_dataset_id,'source_dataset_version',t.source_dataset_version,'resource_content_hash',t.resource_content_hash,'metadata',t.metadata) AS target,
      COALESCE(jsonb_agg(jsonb_build_object(
        'evidenceId',e.evidence_id,'targetField',e.target_field,'surfaceText',e.observed_surface_text,
        'normalizedMatchText',e.normalized_match_text,'startOffset',e.start_offset,'endOffset',e.end_offset,
        'contextExcerpt',e.context_excerpt,'targetContentHash',e.target_content_hash,
        'targetFieldContentHash',e.target_field_content_hash,'sourceDatasetId',e.source_dataset_id,
        'sourceDatasetVersion',e.source_dataset_version,'evidenceOrder',e.evidence_order
      ) ORDER BY e.evidence_order),'[]'::jsonb) AS evidence
    FROM cross_root_links l
    JOIN cross_root_resources s ON s.resource_id=l.source_resource_id
    JOIN cross_root_resources t ON t.resource_id=l.target_resource_id
    LEFT JOIN cross_root_link_evidence e ON e.link_id=l.link_id
    WHERE l.dataset_id=$1 AND (l.source_resource_id=$2 OR l.target_resource_id=$2)
      AND ($3::text IS NULL OR (CASE WHEN l.source_resource_id=$2 THEN t.root_id ELSE s.root_id END)=$3)
      AND l.display_order > $4
    GROUP BY l.link_id,s.resource_id,t.resource_id
    ORDER BY l.display_order LIMIT $5;
  `, [CROSS_ROOT_DATASET_ID, selected.resource_id, query.targetRoot ?? null, query.cursor, query.limit + 1])).rows;
  const hasMore = links.length > query.limit;
  const page = links.slice(0, query.limit);
  return {
    ready: true,
    status: "ready",
    selectedResource: mapResource(selected),
    links: page.map((row) => ({
      linkId: row.link_id,
      relationshipType: row.relationship_type,
      directionality: row.directionality,
      derivationKind: row.derivation_kind,
      reviewStatus: row.review_status,
      algorithmVersion: row.algorithm_version,
      sourceResource: mapResource(row.source),
      targetResource: mapResource(row.target),
      evidence: row.evidence,
      semanticConclusion: null,
    })),
    page: { limit: query.limit, nextCursor: hasMore ? page.at(-1)?.display_order ?? null : null },
    notice: "Exact wording is textual evidence only; it does not establish a shared meaning or dictionary sense.",
  };
}
