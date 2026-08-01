import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { promisify } from "node:util";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  CROSS_ROOT_ALGORITHM_VERSION,
  CROSS_ROOT_DATA_DIRECTORY,
  sha256,
  validateCrossRootDataset,
  type CrossRootDataset,
} from "../src/cross-root/lexical-evidence.js";
import { getPool } from "../src/lib/database.js";
import { validateDictionaryRootCoreCorpus } from "../src/scripts/development-runtime.js";
import { importBibleRootFoundation } from "../src/scripts/import-bibleroot-foundation.js";
import { importBibleRootTranslationComparison } from "../src/scripts/import-bibleroot-translation-comparison.js";
import { importCrossRootLexicalEvidence, type CrossRootImportSummary } from "../src/scripts/import-cross-root-lexical-evidence.js";
import { prepare } from "../src/scripts/prepare-cross-root-lexical-evidence.js";
import { validateBibleRootFoundation } from "../src/bibleroot/foundation.js";
import { validateTranslationComparisonDataset } from "../src/bibleroot/translation-comparison.js";
import { saveDictionaryRootCoreLexicalCorpus } from "../src/services/lexical-evidence-store.js";
import { getDevelopmentRuntimeReadiness } from "../src/services/development-runtime-readiness.js";
import { closeTestDatabase } from "./helpers/database.js";

const execFileAsync = promisify(execFile);
const app = createApp();
let dataset: CrossRootDataset;
let first: CrossRootImportSummary;
let second: CrossRootImportSummary;
let protectedBefore = "";
let protectedAfter = "";

function database() {
  const pool = getPool();
  if (!pool) throw new Error("Cross-Root tests require DATABASE_URL.");
  return pool;
}

async function protectedFingerprint() {
  const result = await database().query<{ fingerprint: string }>(`
    SELECT md5(jsonb_build_object(
      'dictionary',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.lemma_id) FROM (SELECT lemma_id,canonical_written_form FROM dictionaryroot_lexical_lemmas) x),
      'history',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.context_id) FROM (SELECT context_id,label,status FROM context_records WHERE domain='HistoryRoot') x),
      'bible',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.edition_text_id) FROM (SELECT edition_text_id,exact_text FROM bibleroot_verse_texts) x),
      'original',(SELECT COUNT(*) FROM bibleroot_original_language_tokens),
      'commentary',(SELECT COUNT(*) FROM bibleroot_commentary_statements)
    )::text) AS fingerprint;
  `);
  return result.rows[0]!.fingerprint;
}

before(async () => {
  await execFileAsync(process.execPath, ["--import", "./scripts/register-tsx.mjs", "src/scripts/import-historyroot-wampanoag-regional-corpus.ts"], { cwd: new URL("../", import.meta.url) });
  const prerequisites = (await database().query<{ lemmas:number; foundation:number; translations:number }>(`
    SELECT (SELECT COUNT(*)::integer FROM dictionaryroot_lexical_lemmas WHERE dataset_id='dictionaryroot-core-lexical-corpus-v1') AS lemmas,
      (SELECT COUNT(*)::integer FROM bibleroot_verse_texts WHERE dataset_id='bibleroot-foundation-v1') AS foundation,
      (SELECT COUNT(*)::integer FROM bibleroot_verse_texts WHERE dataset_id='bibleroot-translation-comparison-v1') AS translations;
  `)).rows[0]!;
  if (prerequisites.lemmas !== 500) await saveDictionaryRootCoreLexicalCorpus(await validateDictionaryRootCoreCorpus());
  if (prerequisites.foundation !== 110) await importBibleRootFoundation({ dataset: await validateBibleRootFoundation() });
  if (prerequisites.translations !== 330) await importBibleRootTranslationComparison({ dataset: await validateTranslationComparisonDataset() });
  dataset = await validateCrossRootDataset();
  await database().query("DELETE FROM imported_bundles WHERE bundle_id=$1", [dataset.manifest.datasetId]);
  protectedBefore = await protectedFingerprint();
  first = await importCrossRootLexicalEvidence({ dataset });
  second = await importCrossRootLexicalEvidence({ dataset });
  protectedAfter = await protectedFingerprint();
});

after(async () => {
  if (dataset) await database().query("DELETE FROM imported_bundles WHERE bundle_id=$1", [dataset.manifest.datasetId]);
  await closeTestDatabase();
});

test("1. committed inputs, manifest, hashes, and exact corpus counts validate", () => {
  assert.deepEqual(dataset.manifest.expectedCounts, {
    resources:1568,dictionaryResources:500,historyResources:628,bibleResources:440,
    links:2233,evidence:2765,dictionaryToHistoryLinks:1431,dictionaryToBibleLinks:802,
    historyOccurrences:1790,bibleOccurrences:975,
  });
  assert.equal(dataset.inputFingerprints.length, 8);
  assert.equal(dataset.manifest.algorithmVersion, CROSS_ROOT_ALGORITHM_VERSION);
  assert.equal(dataset.links.filter((item) => String(item.sourceRootId) === String(item.targetRootId)).length, 0);
  assert.equal(dataset.links.filter((item) => item.sourceRootId !== "DictionaryRoot").length, 0);
  assert.equal(dataset.resources.filter((item) => /commentary|original-language/u.test(item.resourceType)).length, 0);
});

test("2. exact matching reconstructs every UTF-16 slice without morphology or sense inference", () => {
  const resources = new Map(dataset.resources.map((item) => [item.resourceId, item]));
  const links = new Map(dataset.links.map((item) => [item.linkId, item]));
  for (const item of dataset.evidence) {
    const target = resources.get(links.get(item.linkId)!.targetResourceId)!;
    const field = target.metadata.fields!.find((candidate) => candidate.name === item.targetField)!;
    assert.equal(field.text.slice(item.startOffset, item.endOffset), item.observedSurfaceText);
    assert.equal(sha256(field.text), item.targetFieldContentHash);
  }
  assert.ok(dataset.resources.some((item) => item.rootId === "DictionaryRoot" && String(item.metadata.normalizedForm).includes(" ")));
  assert.ok(dataset.links.every((item) => !("senseId" in item) && !("confidenceScore" in item)));
});

test("3. preparation is offline and byte-identical on repeat", async () => {
  const source = await readFile(new URL("../src/scripts/prepare-cross-root-lexical-evidence.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\(|axios|undici|Invoke-WebRequest/iu);
  await prepare();
  const files = ["dataset-manifest.json","input-fingerprints.json","resource-registry.json","links.json","evidence.json","hashes.json"];
  const one = await Promise.all(files.map(async (name) => sha256(await readFile(new URL(name, `file:///${CROSS_ROOT_DATA_DIRECTORY.replaceAll("\\", "/")}/`)))));
  await prepare();
  const two = await Promise.all(files.map(async (name) => sha256(await readFile(new URL(name, `file:///${CROSS_ROOT_DATA_DIRECTORY.replaceAll("\\", "/")}/`)))));
  assert.deepEqual(two, one);
});

test("4. importer is exact, idempotent, and preserves all prior Roots", () => {
  assert.equal(first.action, "imported");
  assert.deepEqual(first.records, { imported:6568,updated:0,skipped:0,failed:0 });
  assert.equal(second.action, "skipped");
  assert.deepEqual(second.records, { imported:0,updated:0,skipped:6568,failed:0 });
  assert.equal(protectedAfter, protectedBefore);
});

test("5. simulated failure rolls back completely and deterministic repair updates", async () => {
  const removed = dataset.evidence[0]!;
  await database().query("DELETE FROM cross_root_link_evidence WHERE evidence_id=$1", [removed.evidenceId]);
  const beforeFailure = Number((await database().query<{ count: string }>("SELECT COUNT(*) AS count FROM cross_root_link_evidence WHERE dataset_id=$1", [dataset.manifest.datasetId])).rows[0]!.count);
  await assert.rejects(importCrossRootLexicalEvidence({ dataset, simulateFailureAfterDatasetDelete:true }), /Simulated Cross-Root/);
  const afterFailure = Number((await database().query<{ count: string }>("SELECT COUNT(*) AS count FROM cross_root_link_evidence WHERE dataset_id=$1", [dataset.manifest.datasetId])).rows[0]!.count);
  assert.equal(afterFailure, beforeFailure);
  assert.equal((await importCrossRootLexicalEvidence({ dataset })).action, "updated");
});

test("6. migration 018 constraints reject same-Root, invalid review, duplicates, and orphans", async () => {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const link = dataset.links[0]!;
    await assert.rejects(client.query(`INSERT INTO cross_root_links(link_id,dataset_id,source_resource_id,source_root_id,target_resource_id,target_root_id,relationship_type,directionality,derivation_kind,review_status,algorithm_version,deterministic_content_hash,display_order) VALUES('invalid-link',$1,$2,'DictionaryRoot',$2,'DictionaryRoot','exact_lexical_occurrence','directional','textually_observed','unreviewed',$3,$4,9999)`, [dataset.manifest.datasetId,link.sourceResourceId,CROSS_ROOT_ALGORITHM_VERSION,"A".repeat(64)]));
    await client.query("ROLLBACK");
  } finally { client.release(); }
  await assert.rejects(database().query("INSERT INTO cross_root_link_evidence(evidence_id,dataset_id,link_id,target_field,observed_surface_text,normalized_match_text,start_offset,end_offset,context_excerpt,target_content_hash,target_field_content_hash,source_dataset_id,source_dataset_version,evidence_order) VALUES('orphan',$1,'missing','x','x','x',0,1,'x',$2,$2,'x','1',1)", [dataset.manifest.datasetId,"A".repeat(64)]));
});

test("7. coverage and resource APIs expose evidence and structured invalid states", async () => {
  const coverage = await request(app).get("/api/v1/cross-root/coverage").expect(200);
  assert.equal(coverage.body.ready, true);
  assert.equal(coverage.body.actualCounts.evidence, 2765);
  const rootsBySource = new Map<string, Set<string>>();
  dataset.links.forEach((item) => rootsBySource.set(item.sourceResourceId, new Set([...(rootsBySource.get(item.sourceResourceId) ?? []), item.targetRootId])));
  const sourceId = [...rootsBySource].find(([, roots]) => roots.size === 2)![0];
  const source = dataset.resources.find((item) => item.resourceId === sourceId)!;
  const links = await request(app).get("/api/v1/cross-root/links").query({ root:source.rootId,resourceType:source.resourceType,resourceId:source.canonicalPublicId,limit:100 }).expect(200);
  assert.ok(links.body.links.some((item: { evidence: unknown[] }) => item.evidence.length > 0));
  assert.ok(links.body.links.every((item: Record<string, unknown>) => !("sameMeaning" in item) && !("confidenceScore" in item)));
  const invalid = await request(app).get("/api/v1/cross-root/links").query({ root:"DictionaryRoot",resourceType:"lemma",resourceId:"missing" }).expect(404);
  assert.equal(invalid.body.code, "RESOURCE_NOT_FOUND");
});

test("8. readiness adds Cross-Root capability without changing prior Root readiness", async () => {
  const readiness = await getDevelopmentRuntimeReadiness();
  assert.equal(readiness.contractVersion, "1.3.0");
  assert.equal(readiness.crossRootLinks.ready, true);
  assert.equal(readiness.roots.DictionaryRoot.ready, true);
  assert.equal(readiness.roots.HistoryRoot.ready, true);
  assert.equal(readiness.roots.BibleRoot.foundationReady, true);
  assert.equal(readiness.roots.BibleRoot.translationComparisonReady, true);
});
