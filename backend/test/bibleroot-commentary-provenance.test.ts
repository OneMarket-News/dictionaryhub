import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import test, { after, before } from "node:test";
import { promisify } from "node:util";
import request from "supertest";

import { createApp } from "../src/app.js";
import { validateBibleRootFoundation } from "../src/bibleroot/foundation.js";
import { loadOriginalLanguageDataset } from "../src/bibleroot/original-languages.js";
import { validateTranslationComparisonDataset } from "../src/bibleroot/translation-comparison.js";
import {
  COMMENTARY_DATA_DIRECTORY,
  COMMENTARY_REFERENCES,
  COMMENTARY_WORK_IDS,
  gitBlob,
  sha256,
  validateCommentaryDataset,
  type CommentaryDataset,
} from "../src/bibleroot/commentary-provenance.js";
import { getPool } from "../src/lib/database.js";
import { importBibleRootFoundation } from "../src/scripts/import-bibleroot-foundation.js";
import { importBibleRootOriginalLanguageFoundation } from "../src/scripts/import-bibleroot-original-language-foundation.js";
import { importBibleRootTranslationComparison } from "../src/scripts/import-bibleroot-translation-comparison.js";
import {
  importBibleRootCommentaryProvenance,
  type CommentaryImportSummary,
} from "../src/scripts/import-bibleroot-commentary-provenance.js";
import { prepare } from "../src/scripts/prepare-bibleroot-commentary-provenance.js";
import {
  getDevelopmentRuntimeReadiness,
  type DevelopmentRuntimeReadiness,
} from "../src/services/development-runtime-readiness.js";
import { closeTestDatabase } from "./helpers/database.js";

const execFileAsync = promisify(execFile);
const app = createApp();
let dataset: CommentaryDataset;
let firstImport: CommentaryImportSummary;
let secondImport: CommentaryImportSummary;
let preservedBefore = "";
let preservedAfter = "";

function database() {
  const pool = getPool();
  if (!pool) throw new Error("Commentary provenance tests require DATABASE_URL.");
  return pool;
}

async function prepareWithWindowsRetry(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await prepare();
      return;
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || !/UNKNOWN: unknown error, open/u.test(error.message) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 125 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function protectedFingerprint() {
  const result = await database().query<{ fingerprint: string }>(`
    SELECT md5(jsonb_build_object(
      'dictionary', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.bundle_id) FROM (SELECT bundle_id, version FROM imported_bundles WHERE domain = 'DictionaryRoot') x),
      'history', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.bundle_id) FROM (SELECT bundle_id, version FROM imported_bundles WHERE domain = 'HistoryRoot') x),
      'foundation', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.edition_text_id) FROM (SELECT edition_text_id, exact_text FROM bibleroot_verse_texts WHERE dataset_id = 'bibleroot-foundation-v1') x),
      'translations', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.edition_text_id) FROM (SELECT edition_text_id, exact_text FROM bibleroot_verse_texts WHERE dataset_id = 'bibleroot-translation-comparison-v1') x),
      'original', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.source_verse_id) FROM (SELECT source_verse_id, surface_text FROM bibleroot_original_language_verses) x),
      'gutenberg', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.artifact_id) FROM (SELECT artifact_id, byte_length, sha256 FROM bibleroot_source_artifacts WHERE dataset_id = 'bibleroot-foundation-v1') x)
    )::text) AS fingerprint;
  `);
  return result.rows[0]?.fingerprint ?? "";
}

before(async () => {
  await database().query("DELETE FROM imported_bundles WHERE bundle_id = 'bibleroot-commentary-interpretation-provenance-v1';");
  const foundation = await validateBibleRootFoundation();
  await importBibleRootFoundation({ dataset: foundation });
  const original = await loadOriginalLanguageDataset();
  await importBibleRootOriginalLanguageFoundation({ dataset: original });
  const translations = await validateTranslationComparisonDataset();
  await importBibleRootTranslationComparison({ dataset: translations });
  dataset = await validateCommentaryDataset();
  await database().query("DELETE FROM imported_bundles WHERE bundle_id = 'bibleroot-commentary-interpretation-provenance-v1';");
  preservedBefore = await protectedFingerprint();
  firstImport = await importBibleRootCommentaryProvenance({ dataset });
  secondImport = await importBibleRootCommentaryProvenance({ dataset });
  preservedAfter = await protectedFingerprint();
});

after(async () => {
  await database().query("DELETE FROM imported_bundles WHERE bundle_id = 'bibleroot-commentary-interpretation-provenance-v1';");
  await database().query("DELETE FROM imported_bundles WHERE bundle_id = 'bibleroot-translation-comparison-v1';");
  await closeTestDatabase();
});

test("1. migration 017 commentary structures remain exact after the independent migration 018", async () => {
  const result = await database().query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'bibleroot_commentary_%'
    ORDER BY table_name;
  `);
  assert.deepEqual(result.rows.map((row) => row.table_name), [
    "bibleroot_commentary_section_anchors",
    "bibleroot_commentary_sections",
    "bibleroot_commentary_statements",
    "bibleroot_commentary_works",
  ]);
  await assert.doesNotReject(stat(new URL("../db/migrations/018_create_cross_root_link_foundation.sql", import.meta.url)));
  await assert.rejects(stat(new URL("../db/migrations/019_create_cross_root_link_foundation.sql", import.meta.url)), /ENOENT/);
});

test("2. exact raw and source-document identities, no-filter blobs, and rights validate", async () => {
  assert.equal(dataset.sourceMetadata.artifacts.length, 2);
  assert.equal(dataset.sourceMetadata.documents.length, 3);
  for (const source of dataset.sourceMetadata.artifacts) {
    const bytes = await readFile(new URL(`../data/bibleroot-commentary-interpretation-provenance-v1/raw/${source.filename}`, import.meta.url));
    assert.equal(bytes.byteLength, source.byteLength);
    assert.equal(sha256(bytes), source.sha256);
    assert.equal(gitBlob(bytes), source.gitBlob);
    const relative = `backend/data/bibleroot-commentary-interpretation-provenance-v1/raw/${source.filename}`;
    const { stdout } = await execFileAsync("git", ["hash-object", "--no-filters", "--", relative], { cwd: new URL("../../", import.meta.url) });
    assert.equal(stdout.trim(), source.gitBlob);
  }
  for (const document of dataset.sourceMetadata.documents) {
    const bytes = await readFile(new URL(`../data/bibleroot-commentary-interpretation-provenance-v1/source-docs/${document.filename}`, import.meta.url));
    assert.equal(bytes.byteLength, document.byteLength);
    assert.equal(sha256(bytes), document.sha256);
    assert.equal(gitBlob(bytes), document.gitBlob);
  }
  assert.ok(dataset.rightsMetadata.records.every((record) => record.status === "public-domain-declared-by-provider" && record.territorialLimitation && record.evidenceDocuments.length === 2));
});

test("3. preparation is offline and byte-deterministic", async () => {
  const preparer = await readFile(new URL("../src/scripts/prepare-bibleroot-commentary-provenance.ts", import.meta.url), "utf8");
  assert.doesNotMatch(preparer, /fetch\(|https?:\/\/|Invoke-WebRequest|axios|undici/i);
  await prepareWithWindowsRetry();
  const first = await Promise.all(["mhc.json", "jfb.json"].map(async (name) => sha256(await readFile(new URL(`../data/bibleroot-commentary-interpretation-provenance-v1/normalized/${name}`, import.meta.url)))));
  await prepareWithWindowsRetry();
  const second = await Promise.all(["mhc.json", "jfb.json"].map(async (name) => sha256(await readFile(new URL(`../data/bibleroot-commentary-interpretation-provenance-v1/normalized/${name}`, import.meta.url)))));
  assert.deepEqual(second, first);
  assert.equal(COMMENTARY_DATA_DIRECTORY.endsWith("bibleroot-commentary-interpretation-provenance-v1"), true);
});

test("4. corpus counts, IDs, statement offsets, hashes, and source boundaries are exact", () => {
  assert.deepEqual(dataset.manifest.expectedCounts, { works: 2, passages: 4, canonicalVerses: 110, sourceArtifacts: 2, rightsRecords: 2, sections: 96, statements: 3450, anchors: 96, coverageGaps: 14 });
  assert.deepEqual(dataset.manifest.acceptedWorkIds, [...COMMENTARY_WORK_IDS]);
  assert.deepEqual(dataset.manifest.supportedReferences, [...COMMENTARY_REFERENCES]);
  assert.deepEqual(dataset.manifest.rejectedCandidates, ["John Gill's Exposition of the Entire Bible"]);
  const sections = dataset.works.flatMap((work) => work.sections);
  const statements = sections.flatMap((section) => section.statements);
  assert.equal(new Set(sections.map((section) => section.sectionId)).size, 96);
  assert.equal(new Set(statements.map((statement) => statement.statementId)).size, 3450);
  assert.ok(sections.every((section) => section.sourceMarkup && section.exactText && section.sourceLocator.includes(".bzv:entry-") && section.sourceTextHash === sha256(section.exactText)));
  assert.ok(statements.every((statement) => {
    const section = sections.find((candidate) => candidate.sectionId === statement.parentSectionId)!;
    return section.exactText.slice(statement.startOffset, statement.endOffset) === statement.exactText && statement.contentHash === sha256(statement.exactText);
  }));
  assert.doesNotMatch(JSON.stringify(dataset), /generatedSummary|truthRanking|agreementScore|doctrineClassification|wordAlignment/i);
});

test("5. verse, range, and chapter anchors preserve scope and gaps remain explicit", () => {
  const sections = dataset.works.flatMap((work) => work.sections);
  assert.ok(sections.some((section) => section.anchor.anchorType === "canonical-verse"));
  assert.ok(sections.some((section) => section.anchor.anchorType === "canonical-verse-range"));
  const psalm = sections.find((section) => section.workId === COMMENTARY_WORK_IDS[0] && section.passageReference === "Psalm 23");
  assert.equal(psalm?.anchor.anchorType, "chapter");
  assert.equal(psalm?.anchor.normalizedStartReference, "Psalm 23:1");
  assert.equal(psalm?.anchor.normalizedEndReference, "Psalm 23:6");
  assert.match(psalm?.anchor.mappingNote ?? "", /retained without narrower attribution/);
  const jfb = dataset.works.find((work) => work.work.workId === COMMENTARY_WORK_IDS[1])!;
  assert.equal(jfb.coverage.reduce((sum, item) => sum + item.gaps.length, 0), 14);
  assert.ok(jfb.coverage.flatMap((item) => item.gaps).every((gap) => /no fallback or inferred commentary/i.test(gap.note)));
});

test("6. first import, exact second-run skip, rollback, and protected datasets are correct", async () => {
  assert.equal(firstImport.action, "imported");
  assert.deepEqual(firstImport.records, { imported: 3653, updated: 0, skipped: 0, failed: 0 });
  assert.equal(secondImport.action, "skipped");
  assert.deepEqual(secondImport.records, { imported: 0, updated: 0, skipped: 3653, failed: 0 });
  assert.equal(preservedAfter, preservedBefore);
  await database().query("DELETE FROM bibleroot_commentary_statements WHERE statement_id = (SELECT statement_id FROM bibleroot_commentary_statements ORDER BY statement_id LIMIT 1);");
  assert.equal(Number((await database().query<{ count: string }>("SELECT COUNT(*) AS count FROM bibleroot_commentary_statements WHERE dataset_id = 'bibleroot-commentary-interpretation-provenance-v1';")).rows[0]?.count), 3449);
  await assert.rejects(importBibleRootCommentaryProvenance({ dataset, simulateFailureAfterDatasetDelete: true }), /transactional rollback/);
  assert.equal(Number((await database().query<{ count: string }>("SELECT COUNT(*) AS count FROM bibleroot_commentary_statements WHERE dataset_id = 'bibleroot-commentary-interpretation-provenance-v1';")).rows[0]?.count), 3449);
  assert.equal((await importBibleRootCommentaryProvenance({ dataset })).action, "updated");
  assert.equal(await protectedFingerprint(), preservedBefore);
});

test("7. metadata API returns deterministic source, artifact, rights, and coverage records", async () => {
  const response = await request(app).get("/api/v1/bibleroot/commentaries").expect(200);
  assert.equal(response.body.ready, true);
  assert.deepEqual(response.body.items.map((item: { workId: string }) => item.workId), [...COMMENTARY_WORK_IDS]);
  assert.ok(response.body.items.every((item: { artifact: { filename: string; sha256: string; byteLength: number }; rights: { status: string; territorialLimitation: string }; selectedPassageCoverage: unknown[] }) => item.artifact.filename && item.artifact.sha256 && item.artifact.byteLength && item.rights.status && item.rights.territorialLimitation && item.selectedPassageCoverage.length === 4));
  assert.match(response.body.disclaimer, /does not endorse, reconcile, rank/i);
  assert.match(response.body.sharedPlacementNotice, /does not mean the sources agree/i);
});

test("8. all four commentary passage APIs return exact sections and source statements", async () => {
  for (const reference of COMMENTARY_REFERENCES) {
    const response = await request(app).get("/api/v1/bibleroot/commentary").query({ reference, works: COMMENTARY_WORK_IDS.join(",") }).expect(200);
    assert.equal(response.body.normalizedReference, reference);
    assert.deepEqual(response.body.selectedWorkIds, [...COMMENTARY_WORK_IDS]);
    assert.equal(response.body.works.length, 2);
    assert.ok(response.body.works.every((work: { sections: Array<{ exactText: string; statements: Array<{ exactText: string; startOffset: number; endOffset: number }>; sourceLocator: string; provenance: object }>; artifact: object; rights: object }) => work.sections.length > 0 && work.sections.every((section) => section.exactText && section.statements.length > 0 && section.sourceLocator && section.provenance) && work.artifact && work.rights));
    assert.ok(response.body.links.passage && response.body.links.translationComparison && response.body.links.originalLanguage);
    assert.equal(response.body.interpretationBoundary.generatedSummary, false);
    assert.equal(response.body.interpretationBoundary.inferredAgreement, false);
    assert.equal(response.body.interpretationBoundary.wordAlignment, false);
    assert.doesNotMatch(JSON.stringify(response.body), /rankingField|agreementField|doctrineField|wordLevelAlignment/i);
  }
});

test("9. invalid references, work IDs, duplicates, and limits return structured 4xx", async () => {
  assert.equal((await request(app).get("/api/v1/bibleroot/commentary").query({ reference: "Genesis 1:1" }).expect(400)).body.code, "UNSUPPORTED_COMMENTARY_REFERENCE");
  assert.equal((await request(app).get("/api/v1/bibleroot/commentary").query({ reference: "Genesis 1", works: "unknown" }).expect(400)).body.code, "INVALID_COMMENTARY_WORK");
  const work = COMMENTARY_WORK_IDS[0];
  assert.equal((await request(app).get("/api/v1/bibleroot/commentary").query({ reference: "Genesis 1", works: `${work},${work}` }).expect(400)).body.code, "DUPLICATE_COMMENTARY_WORK");
  assert.equal((await request(app).get("/api/v1/bibleroot/commentary").query({ reference: "Genesis 1", works: `${COMMENTARY_WORK_IDS.join(",")},x,y` }).expect(400)).body.code, "COMMENTARY_WORK_LIMIT");
});

test("10. awaiting-data is honest and contains no fallback commentary", async () => {
  await database().query("DELETE FROM imported_bundles WHERE bundle_id = 'bibleroot-commentary-interpretation-provenance-v1';");
  const metadata = await request(app).get("/api/v1/bibleroot/commentaries").expect(200);
  assert.equal(metadata.body.ready, false);
  assert.equal(metadata.body.status, "awaiting-data");
  assert.deepEqual(metadata.body.items, []);
  const response = await request(app).get("/api/v1/bibleroot/commentary").query({ reference: "Genesis 1" }).expect(503);
  assert.equal(response.body.details.readiness, "awaiting-data");
  assert.doesNotMatch(JSON.stringify(response.body), /Matthew Henry|Jamieson|commentary section/i);
  assert.equal((await importBibleRootCommentaryProvenance({ dataset })).action, "imported");
});

test("11. readiness adds commentaryProvenanceReady without redefining prior BibleRoot fields", async () => {
  const readiness = await getDevelopmentRuntimeReadiness();
  // This validates CURRENT provisioned readiness, not historical release
  // state, so it must track the live contract. Binding the expectation to the
  // service's own declared literal type means a future readiness revision
  // fails typecheck here immediately rather than leaving a stale literal to
  // be discovered at runtime much later.
  const expectedContractVersion: DevelopmentRuntimeReadiness["contractVersion"] = "1.4.0";
  assert.equal(readiness.contractVersion, expectedContractVersion);
  assert.equal(readiness.roots.BibleRoot.ready, true);
  assert.equal(readiness.roots.BibleRoot.foundationReady, true);
  assert.equal(readiness.roots.BibleRoot.originalLanguageReady, true);
  assert.equal(readiness.roots.BibleRoot.translationComparisonReady, true);
  assert.equal(readiness.roots.BibleRoot.commentaryProvenanceReady, true);
  assert.equal(readiness.roots.BibleRoot.counts.commentaryWorks, 2);
  assert.equal(readiness.roots.BibleRoot.counts.commentaryStatements, 3450);
});

test("12. importer safety and non-interpretive boundaries remain explicit", async () => {
  const importer = await readFile(new URL("../src/scripts/import-bibleroot-commentary-provenance.ts", import.meta.url), "utf8");
  assert.match(importer, /restricted to sourceroot_test/);
  assert.match(importer, /assertLocalDevelopmentImportAuthorized/);
  assert.doesNotMatch(importer, /fetch\(|https?:\/\//i);
  const keys = new Set<string>();
  const inspectKeys = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      inspectKeys(child);
    }
  };
  inspectKeys(dataset);
  assert.ok(["generatedCommentary", "truthScore", "orthodoxy", "heresy", "sentiment", "denominationRanking", "semanticEquivalence"].every((key) => !keys.has(key)));
});
