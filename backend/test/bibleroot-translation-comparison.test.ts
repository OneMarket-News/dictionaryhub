import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import test, { after, before } from "node:test";
import { promisify } from "node:util";
import request from "supertest";

import { createApp } from "../src/app.js";
import { validateBibleRootFoundation } from "../src/bibleroot/foundation.js";
import { loadOriginalLanguageDataset } from "../src/bibleroot/original-languages.js";
import {
  TRANSLATION_COMPARISON_DATA_DIRECTORY,
  TRANSLATION_COMPARISON_EDITION_IDS,
  mechanicalTextComparison,
  sha256,
  validateTranslationComparisonDataset,
  type TranslationComparisonDataset,
} from "../src/bibleroot/translation-comparison.js";
import { getPool } from "../src/lib/database.js";
import { importBibleRootFoundation } from "../src/scripts/import-bibleroot-foundation.js";
import { importBibleRootOriginalLanguageFoundation } from "../src/scripts/import-bibleroot-original-language-foundation.js";
import {
  importBibleRootTranslationComparison,
  type TranslationComparisonImportSummary,
} from "../src/scripts/import-bibleroot-translation-comparison.js";
import { prepare } from "../src/scripts/prepare-bibleroot-translation-comparison.js";
import { closeTestDatabase } from "./helpers/database.js";

const execFileAsync = promisify(execFile);
const app = createApp();
let dataset: TranslationComparisonDataset;
let firstImport: TranslationComparisonImportSummary;
let secondImport: TranslationComparisonImportSummary;
let protectedBefore = "";
let protectedAfter = "";

function database() {
  const pool = getPool();
  if (!pool) throw new Error("Translation comparison tests require DATABASE_URL.");
  return pool;
}

async function protectedFingerprint(): Promise<string> {
  const result = await database().query<{ fingerprint: string }>(`
    SELECT md5(jsonb_build_object(
      'dictionary', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.bundle_id) FROM (SELECT bundle_id, version FROM imported_bundles WHERE domain = 'DictionaryRoot') x),
      'history', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.bundle_id) FROM (SELECT bundle_id, version FROM imported_bundles WHERE domain = 'HistoryRoot') x),
      'foundation', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.edition_text_id) FROM (SELECT edition_text_id, exact_text FROM bibleroot_verse_texts WHERE dataset_id = 'bibleroot-foundation-v1') x),
      'original', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.source_verse_id) FROM (SELECT source_verse_id, surface_text FROM bibleroot_original_language_verses) x)
    )::text) AS fingerprint;
  `);
  return result.rows[0]?.fingerprint ?? "";
}

before(async () => {
  const foundation = await validateBibleRootFoundation();
  await importBibleRootFoundation({ dataset: foundation });
  const original = await loadOriginalLanguageDataset();
  await importBibleRootOriginalLanguageFoundation({ dataset: original });
  dataset = await validateTranslationComparisonDataset();
  await database().query("DELETE FROM imported_bundles WHERE bundle_id = 'bibleroot-translation-comparison-v1';");
  protectedBefore = await protectedFingerprint();
  firstImport = await importBibleRootTranslationComparison({ dataset });
  secondImport = await importBibleRootTranslationComparison({ dataset });
  protectedAfter = await protectedFingerprint();
});

after(async () => {
  await database().query("DELETE FROM imported_bundles WHERE bundle_id = 'bibleroot-translation-comparison-v1';");
  await closeTestDatabase();
});

test("1. exact raw bytes, checksums, Git no-filter blobs, and rights metadata validate", async () => {
  assert.equal(dataset.sourceMetadata.artifacts.length, 3);
  assert.equal(dataset.rightsMetadata.records.length, 3);
  for (const source of dataset.sourceMetadata.artifacts) {
    const raw = new URL(`../data/bibleroot-translation-comparison-v1/raw/${source.filename}`, import.meta.url);
    assert.equal((await stat(raw)).size, source.byteLength);
    assert.equal(sha256(await readFile(raw)), source.sha256);
    const relative = `backend/data/bibleroot-translation-comparison-v1/raw/${source.filename}`;
    const { stdout } = await execFileAsync("git", ["hash-object", "--no-filters", "--", relative], { cwd: new URL("../../", import.meta.url) });
    assert.equal(stdout.trim(), source.gitBlob);
    const rights = dataset.rightsMetadata.records.find((record) => record.editionId === source.editionId);
    assert.ok(rights?.status.startsWith("public-domain"));
    assert.ok(rights?.territorialLimitation);
    assert.ok(rights?.evidenceDocuments.length);
  }
});

test("2. preparation is deterministic and produces three complete aligned editions", async () => {
  await prepare();
  const first = await Promise.all(["asv.json", "web.json", "ylt.json"].map(async (name) => sha256(await readFile(new URL(`../data/bibleroot-translation-comparison-v1/normalized/${name}`, import.meta.url)))));
  await prepare();
  const second = await Promise.all(["asv.json", "web.json", "ylt.json"].map(async (name) => sha256(await readFile(new URL(`../data/bibleroot-translation-comparison-v1/normalized/${name}`, import.meta.url)))));
  assert.deepEqual(second, first);
  for (const edition of dataset.editions) {
    assert.equal(edition.verses.length, 110);
    assert.equal(new Set(edition.verses.map((verse) => verse.canonicalReferenceId)).size, 110);
    assert.equal(new Set(edition.verses.map((verse) => `${verse.bookCode}:${verse.chapterNumber}`)).size, 4);
    assert.ok(edition.verses.every((verse) => !/\\\+?[a-z]|strong=/i.test(verse.exactText)));
  }
});

test("3. importer creates 330 new verse texts and skips the exact second run", () => {
  assert.equal(firstImport.action, "imported");
  assert.deepEqual(firstImport.records, { imported: 345, updated: 0, skipped: 0, failed: 0 });
  assert.equal(firstImport.verseTexts, 330);
  assert.equal(secondImport.action, "skipped");
  assert.deepEqual(secondImport.records, { imported: 0, updated: 0, skipped: 345, failed: 0 });
});

test("4. importer rollback is transactional and protected Roots remain unchanged", async () => {
  assert.equal(protectedAfter, protectedBefore);
  await database().query(`DELETE FROM bibleroot_verse_texts WHERE edition_text_id = (
    SELECT edition_text_id FROM bibleroot_verse_texts WHERE dataset_id = 'bibleroot-translation-comparison-v1' ORDER BY edition_text_id LIMIT 1
  );`);
  const partialCount = Number((await database().query<{ count: string }>("SELECT COUNT(*) AS count FROM bibleroot_verse_texts WHERE dataset_id = 'bibleroot-translation-comparison-v1';")).rows[0]?.count);
  assert.equal(partialCount, 329);
  await assert.rejects(importBibleRootTranslationComparison({ dataset, simulateFailureAfterDatasetDelete: true }), /transactional rollback/);
  const rollbackCount = Number((await database().query<{ count: string }>("SELECT COUNT(*) AS count FROM bibleroot_verse_texts WHERE dataset_id = 'bibleroot-translation-comparison-v1';")).rows[0]?.count);
  assert.equal(rollbackCount, 329);
  assert.equal((await importBibleRootTranslationComparison({ dataset })).action, "updated");
});

test("5. translation metadata API is deterministic and exposes source and rights evidence", async () => {
  const response = await request(app).get("/api/v1/bibleroot/translations").expect(200);
  assert.equal(response.body.ready, true);
  assert.deepEqual(response.body.items.map((edition: { editionId: string }) => edition.editionId), [...TRANSLATION_COMPARISON_EDITION_IDS]);
  assert.ok(response.body.items.every((edition: { artifact: { sha256: string; filename: string }; rightsStatus: string }) => edition.artifact.sha256 && edition.artifact.filename && edition.rightsStatus));
});

test("6. each accepted passage returns exact ordered comparison positions", async () => {
  const expected = new Map([["Genesis 1", 31], ["Psalm 23", 6], ["Ecclesiastes 3", 22], ["John 1", 51]]);
  for (const [reference, count] of expected) {
    const response = await request(app).get("/api/v1/bibleroot/comparison").query({ reference, editions: TRANSLATION_COMPARISON_EDITION_IDS.join(",") }).expect(200);
    assert.equal(response.body.verses.length, count);
    assert.equal(response.body.editions.length, 4);
    assert.equal(response.body.selectedEditionIds.length, 4);
    assert.ok(response.body.verses.every((verse: { editions: Record<string, { state: string; exactText: string }> }) => Object.values(verse.editions).every((cell) => cell.state === "available" && cell.exactText)));
    assert.match(response.body.comparisonBoundary.disclaimer, /textual differences only/i);
    assert.doesNotMatch(JSON.stringify(response.body), /semanticSimilarity|translationQuality|translatorIntent|wordLevelAlignment/i);
  }
});

test("7. invalid references, editions, duplicates, and limits return structured 4xx errors", async () => {
  assert.equal((await request(app).get("/api/v1/bibleroot/comparison").query({ reference: "Genesis 1:1" }).expect(400)).body.code, "UNSUPPORTED_COMPARISON_REFERENCE");
  assert.equal((await request(app).get("/api/v1/bibleroot/comparison").query({ reference: "Genesis 1", editions: "unknown" }).expect(400)).body.code, "INVALID_COMPARISON_EDITION");
  const kjv = TRANSLATION_COMPARISON_EDITION_IDS[0];
  assert.equal((await request(app).get("/api/v1/bibleroot/comparison").query({ reference: "Genesis 1", editions: `${kjv},${kjv}` }).expect(400)).body.code, "DUPLICATE_COMPARISON_EDITION");
  assert.equal((await request(app).get("/api/v1/bibleroot/comparison").query({ reference: "Genesis 1", editions: [...TRANSLATION_COMPARISON_EDITION_IDS, kjv].join(",") }).expect(400)).body.code, "COMPARISON_EDITION_LIMIT");
});

test("8. unprovisioned state is honest and never returns fallback text", async () => {
  await database().query("DELETE FROM imported_bundles WHERE bundle_id = 'bibleroot-translation-comparison-v1';");
  const metadata = await request(app).get("/api/v1/bibleroot/translations").expect(200);
  assert.equal(metadata.body.ready, false);
  assert.equal(metadata.body.status, "awaiting-data");
  const comparison = await request(app).get("/api/v1/bibleroot/comparison").query({ reference: "Genesis 1" }).expect(503);
  assert.equal(comparison.body.details.readiness, "awaiting-data");
  assert.equal((await importBibleRootTranslationComparison({ dataset })).action, "imported");
});

test("9. difference classification and token spans are deterministic and non-interpretive", () => {
  const comparison = mechanicalTextComparison({ a: "In the beginning.", b: "In the beginning!", c: null });
  assert.equal(comparison.exactEqual, false);
  assert.equal(comparison.punctuationOnly, true);
  assert.deepEqual(comparison.tokens.a?.map((token) => token.text), ["In", "the", "beginning", "."]);
  assert.match(comparison.disclaimer, /do not determine meaning, accuracy, doctrine, or translation quality/i);
});

test("10. direct importer safety, no migration 017, and no commentary corpus are explicit", async () => {
  const importer = await readFile(new URL("../src/scripts/import-bibleroot-translation-comparison.ts", import.meta.url), "utf8");
  assert.match(importer, /restricted to sourceroot_test/);
  assert.match(importer, /assertLocalDevelopmentImportAuthorized/);
  await assert.rejects(stat(new URL("../db/migrations/017_create_bibleroot_translation_comparison.sql", import.meta.url)), /ENOENT/);
  assert.doesNotMatch(JSON.stringify(dataset), /\bNIV\b|\bESV\b|theological conclusion|translation-quality ranking/i);
  assert.equal(TRANSLATION_COMPARISON_DATA_DIRECTORY.endsWith("bibleroot-translation-comparison-v1"), true);
});
