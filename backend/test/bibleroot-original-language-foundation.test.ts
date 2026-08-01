import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  NESTLE1904_EDITION_ID,
  ORIGINAL_LANGUAGE_DATA_DIRECTORY,
  OSHB_EDITION_ID,
  loadOriginalLanguageDataset,
  parseNestleJohn1,
  prepareOriginalLanguageDataset,
  type OriginalLanguageDataset,
} from "../src/bibleroot/original-languages.js";
import { getPool } from "../src/lib/database.js";
import {
  captureChunk12Fingerprint,
  importBibleRootOriginalLanguageFoundation,
} from "../src/scripts/import-bibleroot-original-language-foundation.js";
import { closeTestDatabase } from "./helpers/database.js";

const app = createApp();
let dataset: OriginalLanguageDataset;
let firstImport: Awaited<ReturnType<typeof importBibleRootOriginalLanguageFoundation>>;
let secondImport: Awaited<ReturnType<typeof importBibleRootOriginalLanguageFoundation>>;
let firstState = "";
let secondState = "";
let rollbackState = "";
let unrelatedBefore = "";
let unrelatedAfter = "";
let chunk12Before = "";
let chunk12After = "";

function database() {
  const pool = getPool();
  if (!pool) throw new Error("Original-language tests require DATABASE_URL.");
  return pool;
}

async function originalState(): Promise<string> {
  const result = await database().query<{ state: string }>(`
    SELECT md5(jsonb_build_object(
      'editions', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.original_edition_id)
        FROM (SELECT original_edition_id, language_code, version_identity,
          immutable_source_ref FROM bibleroot_original_language_editions) x),
      'verses', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.source_verse_id)
        FROM (SELECT source_verse_id, source_native_citation, surface_text
          FROM bibleroot_original_language_verses) x),
      'tokens', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.token_id)
        FROM (SELECT token_id, source_native_token_id, source_verse_id,
          sequence_position, surface_form FROM bibleroot_original_language_tokens) x),
      'mappings', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.mapping_id)
        FROM (SELECT mapping_id, source_verse_id, target_canonical_reference_id,
          mapping_type FROM bibleroot_original_language_verse_mappings) x)
    )::text) AS state;
  `);
  return result.rows[0]?.state ?? "";
}

async function unrelatedState(): Promise<string> {
  const result = await database().query<{ state: string }>(`
    SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.bundle_id), '[]'::jsonb)::text) AS state
    FROM (
      SELECT bundle_id, bundle_type, version, domain, bundle
      FROM imported_bundles
      WHERE bundle_id NOT IN (
        'br-dataset-original-language-foundation-v1',
        'bibleroot-foundation-v1'
      )
    ) x;
  `);
  return result.rows[0]?.state ?? "";
}

before(async () => {
  dataset = await loadOriginalLanguageDataset();
  unrelatedBefore = await unrelatedState();
  const client = await database().connect();
  try {
    chunk12Before = JSON.stringify(await captureChunk12Fingerprint(client));
  } finally {
    client.release();
  }
  firstImport = await importBibleRootOriginalLanguageFoundation({ dataset });
  firstState = await originalState();
  secondImport = await importBibleRootOriginalLanguageFoundation({ dataset });
  secondState = await originalState();
  await assert.rejects(
    importBibleRootOriginalLanguageFoundation({
      dataset,
      simulateFailureAfterDatasetDelete: true,
    }),
    /Simulated original-language transactional rollback/,
  );
  rollbackState = await originalState();
  unrelatedAfter = await unrelatedState();
  const afterClient = await database().connect();
  try {
    chunk12After = JSON.stringify(await captureChunk12Fingerprint(afterClient));
  } finally {
    afterClient.release();
  }
});

after(async () => {
  await closeTestDatabase();
});

test("1. exact tag-pinned source and documentation hashes validate", async () => {
  assert.deepEqual(dataset.sourceMetadata.sources.map((source) => source.commitSha), [
    "6a5db284c715c18b239422e57bb89684e6a19f00",
    "f2e8fef56eeea892697b5d511a87b8545d6c3dda",
  ]);
  assert.deepEqual(dataset.sourceMetadata.artifacts.map((artifact) => [artifact.rawFilename, artifact.byteLength, artifact.sha256]), [
    ["Gen.xml", 1881356, "87B6221B89CCD308A96B287EFB4520397912A16FE0F8CE4F788A3B4C09D8F2A4"],
    ["Ps.xml", 1949574, "6B4BC0EAFFF4787FC5DD10F5F3D4F753B132C71DC3D681818D8E73D95E74A6DB"],
    ["Eccl.xml", 288538, "28599B243D236813C5F4407CE477E9DF1019CBBEA88BA39AD4A95F1AEC8CECCF"],
    ["Nestle1904.csv", 9098651, "F239AA40669138EED4BDA0BD4BDC7B2071687CAC26752FA5A1FD468F7FD0ABF0"],
  ]);
  assert.equal(dataset.sourceMetadata.documents.length, 6);
  assert.equal((await prepareOriginalLanguageDataset()).manifest.normalizedDatasetSha256, dataset.manifest.normalizedDatasetSha256);
});

test("2. bounded chapters produce exact edition, verse, and token counts", () => {
  assert.equal(dataset.editions.length, 2);
  assert.equal(dataset.verses.length, 111);
  assert.equal(dataset.tokens.length, 1592);
  assert.deepEqual(dataset.manifest.expectedCounts.tokensByChapter, {
    "he:Gen.1": 434,
    "he:Ps.23": 57,
    "he:Eccl.3": 273,
    "grc:John.1": 828,
  });
});

test("3. OSHB source-native word IDs are preserved verbatim", () => {
  const hebrew = dataset.tokens.filter((token) => token.editionId === OSHB_EDITION_ID);
  assert.equal(hebrew.length, 764);
  assert.ok(hebrew.every((token) => token.sourceNativeTokenId));
  assert.equal(hebrew[0]?.sourceNativeTokenId, "01xeN");
  assert.equal(hebrew[0]?.surfaceForm, "בְּ/רֵאשִׁ֖ית");
});

test("4. Nestle1904 source-native token IDs remain null", () => {
  const greek = dataset.tokens.filter((token) => token.editionId === NESTLE1904_EDITION_ID);
  assert.equal(greek.length, 828);
  assert.ok(greek.every((token) => token.sourceNativeTokenId === null));
  assert.equal(greek[0]?.surfaceForm, "Ἐν");
});

test("5. token positions are contiguous within every source verse", () => {
  for (const verse of dataset.verses) {
    const positions = dataset.tokens
      .filter((token) => token.sourceVerseId === verse.sourceVerseId)
      .map((token) => token.sequencePosition);
    assert.deepEqual(positions, Array.from({ length: positions.length }, (_, index) => index + 1));
  }
});

test("6. lemmas and morphology codes are verbatim", () => {
  const hebrew = dataset.tokens[0]!;
  assert.equal(hebrew.lemma.verbatim, "b/7225");
  assert.equal(hebrew.morphologies[0]?.verbatimCode, "HR/Ncfsa");
  const greek = dataset.tokens.find((token) => token.editionId === NESTLE1904_EDITION_ID)!;
  assert.equal(greek.lemma.verbatim, "ἐν");
  assert.deepEqual(greek.morphologies.map((morphology) => morphology.verbatimCode), ["PREP", "PREP"]);
});

test("7. missing morphology is represented honestly when supplied by a malformed-analysis fixture", async () => {
  const csv = await readFile(path.join(ORIGINAL_LANGUAGE_DATA_DIRECTORY, "raw/Nestle1904.csv"), "utf8");
  const withMissing = csv.replace(
    "John 1:1\tἘν\tPREP\tPREP\t",
    "John 1:1\tἘν\t\t\t",
  );
  const parsed = parseNestleJohn1(withMissing);
  assert.equal(parsed.tokens[0]?.morphologies[0]?.analysisStatus, "not_yet_analyzed");
  assert.equal(parsed.tokens[0]?.morphologies[0]?.verbatimCode, null);
});

test("8. seven source-supplied differing Greek morphology pairs are ambiguous", () => {
  const ambiguous = dataset.tokens.filter((token) =>
    token.morphologies[0]?.analysisStatus === "ambiguous");
  assert.equal(ambiguous.length, 7);
  assert.ok(ambiguous.every((token) => token.morphologies.length === 2));
});

test("9. malformed Greek rows fail closed without changing imported data", async () => {
  const before = await originalState();
  const csv = await readFile(path.join(ORIGINAL_LANGUAGE_DATA_DIRECTORY, "raw/Nestle1904.csv"), "utf8");
  const firstJohn = csv.split(/\r?\n/).find((line) => line.startsWith("John 1:"))!;
  assert.equal(firstJohn.endsWith("\t"), true);
  assert.throws(
    () => parseNestleJohn1(csv.replace(firstJohn, firstJohn.slice(0, -1))),
    /Malformed Nestle1904/,
  );
  assert.equal(await originalState(), before);
});

test("10. Psalm 23 superscription is an explicit source segment and mapping", () => {
  const title = dataset.verses.find((verse) => verse.sourceVerseIdentifier === "title")!;
  const mapping = dataset.mappings.find((candidate) => candidate.sourceVerseId === title.sourceVerseId)!;
  assert.match(title.sourceNativeCitation, /superscription/);
  assert.equal(mapping.mappingType, "omitted_or_untranslated");
  assert.equal(mapping.targetCanonicalReferenceId, null);
  assert.match(mapping.explanation, /following text segment maps explicitly/);
});

test("11. every non-title source verse has an explicit one-to-one KJV mapping", () => {
  const mapped = dataset.mappings.filter((mapping) => mapping.mappingType === "one_to_one");
  assert.equal(mapped.length, 110);
  assert.ok(mapped.every((mapping) => mapping.targetCanonicalReferenceId?.startsWith("br-ref-")));
});

test("12. migration 016 installs only the required original-language tables", async () => {
  const result = await database().query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'bibleroot_original_language_%'
    ORDER BY table_name;
  `);
  assert.deepEqual(result.rows.map((row) => row.table_name), [
    "bibleroot_original_language_edition_artifacts",
    "bibleroot_original_language_editions",
    "bibleroot_original_language_token_lemmas",
    "bibleroot_original_language_token_morphologies",
    "bibleroot_original_language_tokens",
    "bibleroot_original_language_verse_mappings",
    "bibleroot_original_language_verses",
  ]);
});

test("13. first transactional import returns exact deterministic counts", () => {
  assert.equal(firstImport.tokens, 1592);
  assert.equal(firstImport.sourceVerses, 111);
  assert.equal(firstImport.normalizedDatasetSha256, "474D7338BD57A8AD8C725B32E9BAA6B540ED4F327A3AAB6D0B009D773303F779");
});

test("14. repeated import is idempotent", () => {
  assert.deepEqual(secondImport, firstImport);
  assert.equal(secondState, firstState);
});

test("15. simulated mid-transaction failure rolls back completely", () => {
  assert.equal(rollbackState, secondState);
});

test("16. DictionaryRoot and HistoryRoot bundle fixtures are preserved", () => {
  assert.equal(unrelatedAfter, unrelatedBefore);
});

test("17. Chunk 12 fingerprint is identical before and after import", () => {
  assert.equal(chunk12After, chunk12Before);
  const fingerprint = JSON.parse(chunk12After);
  assert.equal(fingerprint.rawArtifactByteLength, 4436268);
  assert.equal(fingerprint.verses, 110);
  assert.equal(fingerprint.phraseOccurrences, 13);
});

test("18. database contains exact source, rights, token, and mapping counts", async () => {
  const result = await database().query<{ artifacts: string; rights: string; tokens: string; morphologies: string; mappings: string }>(`
    SELECT
      (SELECT COUNT(*) FROM bibleroot_source_artifacts WHERE dataset_id = 'br-dataset-original-language-foundation-v1') AS artifacts,
      (SELECT COUNT(*) FROM bibleroot_source_artifact_rights_components) AS rights,
      (SELECT COUNT(*) FROM bibleroot_original_language_tokens) AS tokens,
      (SELECT COUNT(*) FROM bibleroot_original_language_token_morphologies) AS morphologies,
      (SELECT COUNT(*) FROM bibleroot_original_language_verse_mappings) AS mappings;
  `);
  assert.deepEqual(result.rows[0], { artifacts: "4", rights: "12", tokens: "1592", morphologies: "2420", mappings: "111" });
});

test("19. edition API exposes immutable refs, artifacts, rights, and attribution", async () => {
  const response = await request(app).get("/api/v1/bibleroot/original-language/editions").expect(200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.items[0].artifacts[0].sha256.length, 64);
  assert.ok(response.body.items.flatMap((edition: { artifacts: Array<{ rightsComponents: unknown[] }> }) => edition.artifacts).every((artifact: { rightsComponents: unknown[] }) => artifact.rightsComponents.length > 0));
  assert.match(JSON.stringify(response.body), /Original work of the Open Scriptures Hebrew Bible available at/);
});

for (const [number, reference, direction, verseCount, tokenCount] of [
  [20, "Genesis 1", "rtl", 31, 434],
  [21, "Psalm 23", "rtl", 7, 57],
  [22, "Ecclesiastes 3", "rtl", 22, 273],
  [23, "John 1", "ltr", 51, 828],
] as const) {
  test(`${number}. ${reference} API returns ordered source verses and tokens`, async () => {
    const response = await request(app)
      .get("/api/v1/bibleroot/original-language/passages")
      .query({ reference })
      .expect(200);
    assert.equal(response.body.direction, direction);
    assert.equal(response.body.verses.length, verseCount);
    assert.equal(response.body.verses.reduce((sum: number, verse: { tokens: unknown[] }) => sum + verse.tokens.length, 0), tokenCount);
    for (const verse of response.body.verses) {
      assert.deepEqual(verse.tokens.map((token: { sequencePosition: number }) => token.sequencePosition), Array.from({ length: verse.tokens.length }, (_value, index) => index + 1));
    }
  });
}

test("24. API preserves Hebrew IDs and null Greek source-native IDs", async () => {
  const hebrew = await request(app).get("/api/v1/bibleroot/original-language/passages").query({ reference: "Genesis 1:1" }).expect(200);
  assert.equal(hebrew.body.verses[0].tokens[0].sourceNativeTokenId, "01xeN");
  const greek = await request(app).get("/api/v1/bibleroot/original-language/passages").query({ reference: "John 1:1" }).expect(200);
  assert.ok(greek.body.verses[0].tokens.every((token: { sourceNativeTokenId: null }) => token.sourceNativeTokenId === null));
});

test("25. Psalm API explains the nontrivial superscription mapping", async () => {
  const response = await request(app).get("/api/v1/bibleroot/original-language/passages").query({ reference: "Psalm 23:1" }).expect(200);
  assert.equal(response.body.verses[0].mapping.mappingType, "omitted_or_untranslated");
  assert.match(response.body.verses[0].mapping.factualExplanation, /superscription/);
  assert.equal(response.body.verses[1].mapping.targetCanonicalReferenceId, "br-ref-ps-023-001");
});

test("26. malformed and bounded-unavailable API states use the shared contract", async () => {
  const malformed = await request(app).get("/api/v1/bibleroot/original-language/passages").query({ reference: "Genesis" }).expect(400);
  assert.equal(malformed.body.code, "MALFORMED_REFERENCE");
  const unavailable = await request(app).get("/api/v1/bibleroot/original-language/passages").query({ reference: "Genesis 1", edition: NESTLE1904_EDITION_ID }).expect(404);
  assert.equal(unavailable.body.code, "ORIGINAL_LANGUAGE_UNAVAILABLE");
});

test("27. original-language route family is read-only", async () => {
  await request(app).post("/api/v1/bibleroot/original-language/passages").send({}).expect(404);
  await request(app).put("/api/v1/bibleroot/original-language/editions").send({}).expect(404);
  await request(app).delete("/api/v1/bibleroot/original-language/editions").expect(404);
});

test("28. API reports no translation, gloss, alignment, commentary, or inference", async () => {
  const response = await request(app).get("/api/v1/bibleroot/original-language/passages").query({ reference: "John 1:1" }).expect(200);
  assert.match(response.body.boundaries.translation, /no word-level alignment/i);
  assert.match(response.body.boundaries.interpretation, /No transliteration, lexical gloss, commentary, theology, or SourceRoot inference/);
  assert.doesNotMatch(JSON.stringify(response.body), /Textus Receptus|witness comparison/);
});
