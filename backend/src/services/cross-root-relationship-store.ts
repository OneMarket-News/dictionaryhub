import {
  CROSS_ROOT_RELATIONSHIP_ALGORITHM_VERSION,
  CROSS_ROOT_RELATIONSHIP_DATASET_ID,
  CROSS_ROOT_RELATIONSHIP_DATASET_VERSION,
  RELATIONSHIP_FAMILIES,
} from "../cross-root/source-backed-relationships.js";
import { getPool } from "../lib/database.js";

export class CrossRootRelationshipQueryError extends Error {
  constructor(public readonly code:string, message:string, public readonly status=400) { super(message); }
}

export interface RelationshipQuery {
  resourceId?:string; subjectId?:string; objectId?:string; relationshipFamily?:string;
  predicate?:string; reviewState?:string; derivation?:string; disputed?:boolean;
  causal?:boolean; root?:string; page:number; pageSize:number;
}

interface ResourceRow {
  resource_id:string; root_id:string; resource_type:string; canonical_public_id:string;
  display_label:string; canonical_local_url:string; source_dataset_id:string;
  source_dataset_version:string; resource_content_hash:string; deterministic_identity_hash:string;
}
interface AssertionRow {
  assertion_id:string; predicate:string; directionality:string; inverse_display_label:string | null;
  source_native_relationship_type:string; relationship_family:string; derivation_kind:string;
  review_state:string; assertion_status:string; certainty:string; uncertainty_statement:string | null;
  dispute_state:string; temporal_scope:Record<string, unknown>; geographic_scope_description:string | null;
  is_causal:boolean; causal_role:string | null; source_record_id:string; source_record_type:string;
  source_dataset_id:string; source_dataset_version:string; deterministic_identity_hash:string;
  content_hash:string; provenance_order:number; metadata:Record<string, unknown>;
  subject:ResourceRow; object:ResourceRow; evidence:unknown;
}

function database() {
  const pool=getPool(); if(!pool) throw new Error("DATABASE_URL is not configured."); return pool;
}
function mapResource(row:ResourceRow) {
  return { resourceId:row.resource_id, rootId:row.root_id, resourceType:row.resource_type,
    canonicalPublicId:row.canonical_public_id, displayLabel:row.display_label,
    canonicalLocalUrl:row.canonical_local_url, sourceDatasetId:row.source_dataset_id,
    sourceDatasetVersion:row.source_dataset_version, resourceContentHash:row.resource_content_hash,
    deterministicIdentityHash:row.deterministic_identity_hash };
}
function mapAssertion(row:AssertionRow) {
  return { assertionId:row.assertion_id, subject:mapResource(row.subject), predicate:row.predicate,
    object:mapResource(row.object), directionality:row.directionality,
    inverseDisplayLabel:row.inverse_display_label, sourceNativeRelationshipType:row.source_native_relationship_type,
    relationshipFamily:row.relationship_family, derivation:row.derivation_kind, reviewState:row.review_state,
    assertionStatus:row.assertion_status, certainty:row.certainty, uncertainty:row.uncertainty_statement,
    disputeState:row.dispute_state, temporalScope:row.temporal_scope,
    geographicScopeDescription:row.geographic_scope_description, causal:row.is_causal,
    causalRole:row.causal_role, sourceRecordId:row.source_record_id,
    sourceRecordType:row.source_record_type, sourceDatasetId:row.source_dataset_id,
    sourceDatasetVersion:row.source_dataset_version, deterministicIdentityHash:row.deterministic_identity_hash,
    contentHash:row.content_hash, provenanceOrder:row.provenance_order, metadata:row.metadata,
    evidence:row.evidence,
    notice:"This source-backed relationship records what the cited released record asserts; it does not create universal identity or prove the relationship beyond that evidence." };
}

const SELECT_ASSERTION = `
  SELECT a.*,
    jsonb_build_object('resource_id',s.resource_id,'root_id',s.root_id,'resource_type',s.resource_type,
      'canonical_public_id',s.canonical_public_id,'display_label',s.display_label,'canonical_local_url',s.canonical_local_url,
      'source_dataset_id',s.source_dataset_id,'source_dataset_version',s.source_dataset_version,
      'resource_content_hash',s.resource_content_hash,'deterministic_identity_hash',s.deterministic_identity_hash) AS subject,
    jsonb_build_object('resource_id',o.resource_id,'root_id',o.root_id,'resource_type',o.resource_type,
      'canonical_public_id',o.canonical_public_id,'display_label',o.display_label,'canonical_local_url',o.canonical_local_url,
      'source_dataset_id',o.source_dataset_id,'source_dataset_version',o.source_dataset_version,
      'resource_content_hash',o.resource_content_hash,'deterministic_identity_hash',o.deterministic_identity_hash) AS object,
    COALESCE(jsonb_agg(jsonb_build_object(
      'evidenceId',e.evidence_id,'sourceRootId',e.source_root_id,'sourceResourceId',e.source_resource_id,
      'sourceRecordType',e.source_record_type,'sourceField',e.source_field,'evidenceMode',e.evidence_mode,
      'observedExcerpt',e.observed_excerpt,'startOffset',e.start_offset,'endOffset',e.end_offset,
      'sourceClaimId',e.source_claim_id,'sourceEvidenceId',e.source_evidence_id,'publicationId',e.publication_id,
      'artifactId',e.artifact_id,'sourceId',e.source_id,'citation',e.citation,'sourceLocator',e.source_locator,
      'sourceUrl',e.source_url,'sourceRecordHash',e.source_record_hash,'sourceFieldHash',e.source_field_hash,
      'evidenceHash',e.evidence_hash,'sourceDatasetId',e.source_dataset_id,'sourceDatasetVersion',e.source_dataset_version,
      'evidenceOrder',e.evidence_order,'uncertaintyNote',e.uncertainty_note,'disputeNote',e.dispute_note
    ) ORDER BY e.evidence_order),'[]'::jsonb) AS evidence
  FROM cross_root_relationship_assertions a
  JOIN cross_root_resources s ON s.resource_id=a.subject_resource_id
  JOIN cross_root_resources o ON o.resource_id=a.object_resource_id
  LEFT JOIN cross_root_relationship_evidence e ON e.assertion_id=a.assertion_id`;

export async function getCrossRootRelationshipCoverage() {
  const result=await database().query<{
    dataset_id:string; version:string; preparation_algorithm_version:string; source_dataset_id:string;
    source_dataset_version:string; input_fingerprints:unknown; expected_counts:Record<string, unknown>;
    assertions:number; evidence:number; subjects:number; objects:number;
  }>(`
    SELECT d.*,
      (SELECT COUNT(*)::integer FROM cross_root_relationship_assertions a WHERE a.dataset_id=d.dataset_id) AS assertions,
      (SELECT COUNT(*)::integer FROM cross_root_relationship_evidence e WHERE e.dataset_id=d.dataset_id) AS evidence,
      (SELECT COUNT(DISTINCT subject_resource_id)::integer FROM cross_root_relationship_assertions a WHERE a.dataset_id=d.dataset_id) AS subjects,
      (SELECT COUNT(DISTINCT object_resource_id)::integer FROM cross_root_relationship_assertions a WHERE a.dataset_id=d.dataset_id) AS objects
    FROM cross_root_relationship_datasets d WHERE d.dataset_id=$1;
  `,[CROSS_ROOT_RELATIONSHIP_DATASET_ID]);
  const row=result.rows[0];
  if(!row) return { ready:false,status:"awaiting-data",datasetId:CROSS_ROOT_RELATIONSHIP_DATASET_ID,
    datasetVersion:CROSS_ROOT_RELATIONSHIP_DATASET_VERSION,algorithmVersion:CROSS_ROOT_RELATIONSHIP_ALGORITHM_VERSION,
    message:"Source-backed relationships have not been provisioned. No fallback relationships are available." };
  const expected=row.expected_counts as Record<string, number>;
  const ready=row.assertions===expected.assertions && row.evidence===expected.evidence
    && row.subjects===expected.subjectResources && row.objects===expected.objectResources;
  return { ready,status:ready?"ready":"awaiting-data",datasetId:row.dataset_id,datasetVersion:row.version,
    algorithmVersion:row.preparation_algorithm_version,assertionCount:row.assertions,evidenceCount:row.evidence,
    subjectResourceCount:row.subjects,objectResourceCount:row.objects,resourceReuseCount:expected.resourceReuse,
    resourceAdditionCount:expected.resourceAdditions,relationshipFamilyCounts:expected.relationshipFamilyCounts,
    predicateCounts:expected.predicateCounts,causalAssertionCount:expected.causal,nonCausalAssertionCount:expected.nonCausal,
    directlySourcedCount:(expected.derivationCounts as unknown as Record<string,number>).directly_sourced,
    acceptedCount:(expected.reviewStateCounts as unknown as Record<string,number>).accepted_after_review ?? 0,
    disputedCount:expected.disputed,unreviewedCount:(expected.reviewStateCounts as unknown as Record<string,number>).unreviewed ?? 0,
    uncertainCount:expected.uncertain,sameRootCount:expected.sameRoot,crossRootCount:expected.crossRoot,
    participatingRoots:["HistoryRoot"],sourceDatasetIdentities:[{datasetId:row.source_dataset_id,version:row.source_dataset_version}],
    inputFingerprints:row.input_fingerprints };
}

async function requireResource(canonicalPublicId:string):Promise<void> {
  const found=(await database().query<{ found:number }>(`
    SELECT COUNT(*)::integer AS found FROM cross_root_resources WHERE canonical_public_id=$1;
  `,[canonicalPublicId])).rows[0]?.found ?? 0;
  if(!found) throw new CrossRootRelationshipQueryError("relationship-resource-not-found","The requested registered relationship resource was not found.",404);
}

export async function getCrossRootRelationships(query:RelationshipQuery) {
  const coverage=await getCrossRootRelationshipCoverage();
  if(!coverage.ready) return { ...coverage,items:[],page:{number:query.page,size:query.pageSize,total:0,totalPages:0},filters:{} };
  if(query.relationshipFamily && !RELATIONSHIP_FAMILIES.includes(query.relationshipFamily as never)) {
    throw new CrossRootRelationshipQueryError("relationship-family-invalid",`Unsupported relationship family: ${query.relationshipFamily}.`);
  }
  if(query.reviewState && !new Set(["unreviewed","accepted_after_review","disputed","rejected"]).has(query.reviewState)) {
    throw new CrossRootRelationshipQueryError("relationship-review-state-invalid",`Unsupported review state: ${query.reviewState}.`);
  }
  if(query.derivation && !new Set(["directly_sourced","textually_observed","human_proposed","machine_proposed"]).has(query.derivation)) {
    throw new CrossRootRelationshipQueryError("relationship-derivation-invalid",`Unsupported derivation: ${query.derivation}.`);
  }
  for(const resourceId of [query.resourceId,query.subjectId,query.objectId].filter(Boolean) as string[]) await requireResource(resourceId);
  const conditions=["a.dataset_id=$1"]; const values:unknown[]=[CROSS_ROOT_RELATIONSHIP_DATASET_ID];
  const add=(sql:string,value:unknown)=>{values.push(value);conditions.push(sql.replace("?",`$${values.length}`));};
  if(query.resourceId) {
    values.push(query.resourceId); const subjectIndex=values.length;
    values.push(query.resourceId); const objectIndex=values.length;
    conditions.push(`(s.canonical_public_id=$${subjectIndex} OR o.canonical_public_id=$${objectIndex})`);
  }
  if(query.subjectId) add("s.canonical_public_id=?",query.subjectId);
  if(query.objectId) add("o.canonical_public_id=?",query.objectId);
  if(query.relationshipFamily) add("a.relationship_family=?",query.relationshipFamily);
  if(query.predicate) add("a.predicate=?",query.predicate);
  if(query.reviewState) add("a.review_state=?",query.reviewState);
  if(query.derivation) add("a.derivation_kind=?",query.derivation);
  if(query.disputed !== undefined) add("(a.dispute_state='disputed')=?",query.disputed);
  if(query.causal !== undefined) add("a.is_causal=?",query.causal);
  if(query.root) {
    values.push(query.root); const subjectRootIndex=values.length;
    values.push(query.root); const objectRootIndex=values.length;
    conditions.push(`(a.subject_root_id=$${subjectRootIndex} OR a.object_root_id=$${objectRootIndex})`);
  }
  const count=(await database().query<{ total:number }>(`
    SELECT COUNT(*)::integer AS total FROM cross_root_relationship_assertions a
    JOIN cross_root_resources s ON s.resource_id=a.subject_resource_id
    JOIN cross_root_resources o ON o.resource_id=a.object_resource_id
    WHERE ${conditions.join(" AND ")};
  `,values)).rows[0]!.total;
  values.push(query.pageSize); const limitIndex=values.length;
  values.push((query.page-1)*query.pageSize); const offsetIndex=values.length;
  const rows=(await database().query<AssertionRow>(`${SELECT_ASSERTION}
    WHERE ${conditions.join(" AND ")}
    GROUP BY a.assertion_id,s.resource_id,o.resource_id
    ORDER BY a.provenance_order,a.assertion_id LIMIT $${limitIndex} OFFSET $${offsetIndex};
  `,values)).rows;
  return { ready:true,status:"ready",items:rows.map(mapAssertion),page:{number:query.page,size:query.pageSize,total:count,totalPages:Math.ceil(count/query.pageSize)},
    filters:{resourceId:query.resourceId??null,subjectId:query.subjectId??null,objectId:query.objectId??null,
      relationshipFamily:query.relationshipFamily??null,predicate:query.predicate??null,reviewState:query.reviewState??null,
      derivation:query.derivation??null,disputed:query.disputed??null,causal:query.causal??null,root:query.root??null} };
}

export async function getCrossRootRelationship(assertionId:string) {
  const rows=(await database().query<AssertionRow>(`${SELECT_ASSERTION}
    WHERE a.dataset_id=$1 AND a.assertion_id=$2
    GROUP BY a.assertion_id,s.resource_id,o.resource_id;
  `,[CROSS_ROOT_RELATIONSHIP_DATASET_ID,assertionId])).rows;
  if(!rows[0]) throw new CrossRootRelationshipQueryError("relationship-assertion-not-found","The requested source-backed relationship assertion was not found.",404);
  return { ready:true,status:"ready",relationship:mapAssertion(rows[0]) };
}
