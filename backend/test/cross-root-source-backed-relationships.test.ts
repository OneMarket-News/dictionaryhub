import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { promisify } from "node:util";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  CROSS_ROOT_RELATIONSHIP_ALGORITHM_VERSION,
  CROSS_ROOT_RELATIONSHIP_DATA_DIRECTORY,
  sha256,
  validateSourceBackedRelationshipDataset,
  type SourceBackedRelationshipDataset,
} from "../src/cross-root/source-backed-relationships.js";
import { getPool } from "../src/lib/database.js";
import { getDevelopmentRuntimeReadiness } from "../src/services/development-runtime-readiness.js";
import { validateDictionaryRootCoreCorpus } from "../src/scripts/development-runtime.js";
import { importBibleRootFoundation } from "../src/scripts/import-bibleroot-foundation.js";
import { importBibleRootTranslationComparison } from "../src/scripts/import-bibleroot-translation-comparison.js";
import {
  importSourceBackedRelationships,
  type SourceBackedRelationshipImportSummary,
} from "../src/scripts/import-cross-root-source-backed-relationships.js";
import { prepareSourceBackedRelationships } from "../src/scripts/prepare-cross-root-source-backed-relationships.js";
import { validateBibleRootFoundation } from "../src/bibleroot/foundation.js";
import { validateTranslationComparisonDataset } from "../src/bibleroot/translation-comparison.js";
import { saveDictionaryRootCoreLexicalCorpus } from "../src/services/lexical-evidence-store.js";
import { closeTestDatabase } from "./helpers/database.js";

const execFileAsync=promisify(execFile);
const app=createApp();
let dataset:SourceBackedRelationshipDataset;
let first:SourceBackedRelationshipImportSummary;
let second:SourceBackedRelationshipImportSummary;
let lexicalBefore="";
let lexicalAfter="";

function database(){const pool=getPool();if(!pool)throw new Error("Relationship tests require DATABASE_URL.");return pool;}
async function lexicalFingerprint(){
  const result=await database().query<{fingerprint:string}>(`
    SELECT md5(jsonb_build_object(
      'datasets',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.dataset_id) FROM cross_root_datasets x),
      'resources',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.resource_id) FROM cross_root_resources x),
      'links',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.link_id) FROM cross_root_links x),
      'evidence',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.evidence_id) FROM cross_root_link_evidence x)
    )::text) AS fingerprint;
  `); return result.rows[0]!.fingerprint;
}

before(async()=>{
  await execFileAsync(process.execPath,["--import","./scripts/register-tsx.mjs","src/scripts/import-historyroot-wampanoag-regional-corpus.ts"],{cwd:new URL("../",import.meta.url)});
  await saveDictionaryRootCoreLexicalCorpus(await validateDictionaryRootCoreCorpus());
  await importBibleRootFoundation({dataset:await validateBibleRootFoundation()});
  await importBibleRootTranslationComparison({dataset:await validateTranslationComparisonDataset()});
  await execFileAsync(process.execPath,["--import","./scripts/register-tsx.mjs","src/scripts/import-cross-root-lexical-evidence.ts"],{cwd:new URL("../",import.meta.url)});
  dataset=await validateSourceBackedRelationshipDataset();
  await database().query("DELETE FROM imported_bundles WHERE bundle_id=$1",[dataset.manifest.datasetId]);
  lexicalBefore=await lexicalFingerprint();
  first=await importSourceBackedRelationships({dataset});
  second=await importSourceBackedRelationships({dataset});
  lexicalAfter=await lexicalFingerprint();
});

after(async()=>{if(dataset)await database().query("DELETE FROM imported_bundles WHERE bundle_id=$1",[dataset.manifest.datasetId]);await closeTestDatabase();});

test("1. exact fingerprints, hashes, identities, and corpus counts validate",()=>{
  assert.equal(dataset.manifest.datasetId,"sourceroot-cross-root-source-backed-relationships-v1");
  assert.equal(dataset.manifest.version,"1.0.0");
  assert.equal(dataset.manifest.preparationAlgorithmVersion,CROSS_ROOT_RELATIONSHIP_ALGORITHM_VERSION);
  assert.equal(dataset.inputFingerprints.length,4);
  assert.deepEqual({assertions:dataset.assertions.length,evidence:dataset.evidence.length,resourceReuse:dataset.manifest.expectedCounts.resourceReuse,resourceAdditions:dataset.manifest.expectedCounts.resourceAdditions},{assertions:143,evidence:178,resourceReuse:280,resourceAdditions:0});
});

test("2. preparation is offline and byte-identical on repeat",async()=>{
  const source=await readFile(new URL("../src/scripts/prepare-cross-root-source-backed-relationships.ts",import.meta.url),"utf8");
  assert.doesNotMatch(source,/fetch\(|axios|undici|Invoke-WebRequest/iu);
  const files=["dataset-manifest.json","input-fingerprints.json","relationship-assertions.json","relationship-evidence.json","hashes.json"];
  await prepareSourceBackedRelationships();
  const one=await Promise.all(files.map(async(name)=>sha256(await readFile(new URL(name,`file:///${CROSS_ROOT_RELATIONSHIP_DATA_DIRECTORY.replaceAll("\\","/")}/`)))));
  await prepareSourceBackedRelationships();
  const two=await Promise.all(files.map(async(name)=>sha256(await readFile(new URL(name,`file:///${CROSS_ROOT_RELATIONSHIP_DATA_DIRECTORY.replaceAll("\\","/")}/`)))));
  assert.deepEqual(two,one);
});

test("3. all resources are reused once by identity and no resource is added",async()=>{
  const ids=new Set([...dataset.assertions.flatMap((item)=>[item.subjectResourceId,item.objectResourceId]),...dataset.evidence.map((item)=>item.sourceResourceId)]);
  assert.equal(ids.size,280);
  const result=await database().query<{count:string}>("SELECT COUNT(*) AS count FROM cross_root_resources WHERE resource_id=ANY($1::text[])",[[...ids]]);
  assert.equal(Number(result.rows[0]!.count),280);
  assert.equal(dataset.manifest.expectedCounts.resourceAdditions,0);
});

test("4. controlled families preserve every source-native predicate and honest review mapping",()=>{
  assert.equal(dataset.assertions.filter((item)=>!item.sourceNativeRelationshipType).length,0);
  assert.deepEqual(dataset.manifest.expectedCounts.reviewStateCounts,{unreviewed:143});
  assert.deepEqual(dataset.manifest.expectedCounts.derivationCounts,{directly_sourced:143});
  assert.equal(dataset.assertions.filter((item)=>item.reviewState==="accepted_after_review").length,0);
  assert.equal(dataset.assertions.filter((item)=>/draft|reject|private|withdrawn/iu.test(String(item.metadata.sourceStatus))).length,0);
});

test("5. lexical links, name-only identity, cross-Root inference, and EarthRoot remain absent",()=>{
  const material=JSON.stringify({assertions:dataset.assertions,evidence:dataset.evidence});
  assert.doesNotMatch(material,/exact_lexical_occurrence|sameMeaning|semanticSimilarity|EarthRoot|latitude|longitude|polygon|geocod|embedding/iu);
  assert.equal(dataset.assertions.filter((item)=>item.subjectRootId!==item.objectRootId).length,0);
  assert.equal(dataset.assertions.filter((item)=>/same_as|identity/iu.test(item.predicate)).length,0);
});

test("6. causal assertions remain separate and preserve uncertainty without upgrading wording",()=>{
  assert.equal(dataset.assertions.filter((item)=>item.isCausal).length,22);
  assert.equal(dataset.assertions.filter((item)=>item.isCausal&&item.relationshipFamily!=="causation").length,0);
  assert.equal(dataset.assertions.filter((item)=>!item.isCausal&&item.causalRole!==null).length,0);
  assert.equal(dataset.assertions.filter((item)=>!item.uncertaintyStatement).length,0);
  assert.equal(dataset.assertions.filter((item)=>item.disputeState==="disputed").length,0);
  assert.ok(dataset.assertions.some((item)=>item.causalRole==="contributing_factor"));
  assert.ok(dataset.assertions.some((item)=>item.causalRole==="condition"));
});

test("7. evidence reconstructs exact UTF-16 source fields and retains provenance",()=>{
  const assertions=new Map(dataset.assertions.map((item)=>[item.assertionId,item]));
  const counts=new Map<string,number>();
  for(const item of dataset.evidence){
    assert.equal(item.observedExcerpt.slice(item.startOffset,item.endOffset),item.observedExcerpt);
    assert.equal(sha256(item.observedExcerpt),item.sourceFieldHash);
    assert.ok(item.sourceId&&item.sourceDatasetId&&item.sourceDatasetVersion&&item.sourceRecordHash&&item.evidenceHash);
    assert.equal(item.sourceRecordType,assertions.get(item.assertionId)!.sourceRecordType);
    counts.set(item.assertionId,(counts.get(item.assertionId)??0)+1);
  }
  assert.equal(counts.size,143);
});

test("8. importer is exact, idempotent, and preserves all Chunk 14A rows",()=>{
  assert.deepEqual(first.records,{imported:323,updated:0,skipped:0,failed:0});
  assert.deepEqual(second.records,{imported:0,updated:0,skipped:323,failed:0});
  assert.equal(lexicalAfter,lexicalBefore);
});

test("9. simulated failure rolls back and deterministic repair succeeds",async()=>{
  const removed=dataset.evidence[0]!;
  await database().query("DELETE FROM cross_root_relationship_evidence WHERE evidence_id=$1",[removed.evidenceId]);
  const before=Number((await database().query<{count:string}>("SELECT COUNT(*) AS count FROM cross_root_relationship_evidence WHERE dataset_id=$1",[dataset.manifest.datasetId])).rows[0]!.count);
  await assert.rejects(importSourceBackedRelationships({dataset,simulateFailureAfterDatasetDelete:true}),/Simulated source-backed relationship rollback/);
  const afterFailure=Number((await database().query<{count:string}>("SELECT COUNT(*) AS count FROM cross_root_relationship_evidence WHERE dataset_id=$1",[dataset.manifest.datasetId])).rows[0]!.count);
  assert.equal(afterFailure,before);
  assert.equal((await importSourceBackedRelationships({dataset})).action,"updated");
});

test("10. migration 019 rejects invalid causal shape, review state, orphan evidence, and evidence-free assertions",async()=>{
  const assertion=dataset.assertions[0]!;
  await assert.rejects(database().query(`INSERT INTO cross_root_relationship_evidence(evidence_id,dataset_id,assertion_id,source_root_id,source_resource_id,source_record_type,source_field,evidence_mode,observed_excerpt,start_offset,end_offset,source_id,source_record_hash,source_field_hash,evidence_hash,source_dataset_id,source_dataset_version,evidence_order) VALUES('orphan',$1,'missing','HistoryRoot',$2,'relationship','explanation','utf16_offsets','x',0,1,'source',$3,$3,$3,'history','1',1)`,[dataset.manifest.datasetId,assertion.subjectResourceId,"A".repeat(64)]));
  const client=await database().connect();
  try{
    await client.query("BEGIN");
    await assert.rejects(client.query(`INSERT INTO cross_root_relationship_assertions(assertion_id,dataset_id,subject_resource_id,subject_root_id,predicate,object_resource_id,object_root_id,directionality,source_native_relationship_type,relationship_family,derivation_kind,review_state,assertion_status,certainty,dispute_state,temporal_scope,is_causal,source_record_id,source_record_type,source_dataset_id,source_dataset_version,deterministic_identity_hash,content_hash,provenance_order) VALUES('invalid-review',$1,$2,'HistoryRoot','associated_with',$3,'HistoryRoot','directional','associated_with','association','directly_sourced','approved','active','unknown','not_disputed','{}',false,'invalid-review-source','relationship','history','1',$4,$4,9999)`,[dataset.manifest.datasetId,assertion.subjectResourceId,assertion.objectResourceId,"A".repeat(64)]));
    await client.query("ROLLBACK");
    await client.query("BEGIN");
    await client.query(`INSERT INTO cross_root_relationship_assertions(assertion_id,dataset_id,subject_resource_id,subject_root_id,predicate,object_resource_id,object_root_id,directionality,source_native_relationship_type,relationship_family,derivation_kind,review_state,assertion_status,certainty,dispute_state,temporal_scope,is_causal,source_record_id,source_record_type,source_dataset_id,source_dataset_version,deterministic_identity_hash,content_hash,provenance_order) VALUES('no-evidence',$1,$2,'HistoryRoot','associated_with',$3,'HistoryRoot','directional','associated_with','association','directly_sourced','unreviewed','active','unknown','not_disputed','{}',false,'no-evidence-source','relationship','history','1',$4,$4,9999)`,[dataset.manifest.datasetId,assertion.subjectResourceId,assertion.objectResourceId,"B".repeat(64)]);
    await assert.rejects(client.query("COMMIT"),/requires evidence/i);
    await client.query("ROLLBACK");
  }finally{client.release();}
});

test("11. API coverage, filters, detail, and structured invalid states are source-backed",async()=>{
  const coverage=await request(app).get("/api/v1/cross-root/relationships/coverage").expect(200);
  assert.equal(coverage.body.ready,true);assert.equal(coverage.body.assertionCount,143);assert.equal(coverage.body.evidenceCount,178);
  const example=dataset.assertions.find((item)=>item.isCausal)!;
  const filtered=await request(app).get("/api/v1/cross-root/relationships").query({resourceId:example.subjectCanonicalPublicId,causal:true,relationshipFamily:"causation",pageSize:100}).expect(200);
  assert.ok(filtered.body.items.some((item:{assertionId:string})=>item.assertionId===example.assertionId));
  assert.ok(filtered.body.items.every((item:{evidence:unknown[]})=>item.evidence.length>0));
  const detail=await request(app).get(`/api/v1/cross-root/relationships/${example.assertionId}`).expect(200);
  assert.equal(detail.body.relationship.sourceRecordId,example.sourceRecordId);
  assert.equal(detail.body.relationship.evidence.length,dataset.evidence.filter((item)=>item.assertionId===example.assertionId).length);
  const noQualifying=await request(app).get("/api/v1/cross-root/relationships").query({resourceId:"br-text-kjv-pg10-gen-001-001"}).expect(200);
  assert.equal(noQualifying.body.ready,true);assert.equal(noQualifying.body.page.total,0);assert.deepEqual(noQualifying.body.items,[]);
  assert.equal((await request(app).get("/api/v1/cross-root/relationships").query({relationshipFamily:"invented"}).expect(400)).body.code,"RELATIONSHIP_FAMILY_INVALID");
  assert.equal((await request(app).get("/api/v1/cross-root/relationships").query({causal:"maybe"}).expect(400)).body.code,"RELATIONSHIP_FILTER_INVALID");
  assert.equal((await request(app).get("/api/v1/cross-root/relationships").query({resourceId:"missing"}).expect(404)).body.code,"RELATIONSHIP_RESOURCE_NOT_FOUND");
  assert.equal((await request(app).get("/api/v1/cross-root/relationships/missing").expect(404)).body.code,"RELATIONSHIP_ASSERTION_NOT_FOUND");
});

test("12. unprovisioned state is honest and readiness 1.4.0 preserves prior capability semantics",async()=>{
  const readiness=await getDevelopmentRuntimeReadiness();
  assert.equal(readiness.contractVersion,"1.4.0");assert.equal(readiness.crossRootRelationships.ready,true);
  assert.equal(readiness.crossRootLinks.ready,true);assert.equal(readiness.crossRootLinks.counts.resources,1568);
  assert.equal(readiness.roots.DictionaryRoot.ready,true);assert.equal(readiness.roots.HistoryRoot.ready,true);assert.equal(readiness.roots.BibleRoot.ready,true);
  await database().query("DELETE FROM imported_bundles WHERE bundle_id=$1",[dataset.manifest.datasetId]);
  const empty=await request(app).get("/api/v1/cross-root/relationships/coverage").expect(200);
  assert.equal(empty.body.ready,false);assert.match(empty.body.message,/No fallback relationships/);
  const list=await request(app).get("/api/v1/cross-root/relationships").expect(200);
  assert.equal(list.body.ready,false);assert.deepEqual(list.body.items,[]);
  await importSourceBackedRelationships({dataset});
});
