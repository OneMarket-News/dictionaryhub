import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  BIBLEROOT_EDITION_ID,
  BibleRootReferenceError,
  loadBibleRootFoundation,
  parseBibleRootReference,
  validateBibleRootFoundation,
  type BibleRootFoundationDataset,
} from "../src/bibleroot/foundation.js";
import { getPool } from "../src/lib/database.js";
import {
  importBibleRootFoundation,
  type BibleRootImportSummary,
} from "../src/scripts/import-bibleroot-foundation.js";
import {
  closeTestDatabase,
} from "./helpers/database.js";

const app = createApp();
let dataset: BibleRootFoundationDataset;
let firstImport: BibleRootImportSummary;
let secondImport: BibleRootImportSummary;
let firstState = "";
let secondState = "";
let rollbackState = "";
let preservationBefore = "";
let preservationAfter = "";

function database() {
  const pool = getPool();
  if (!pool) throw new Error("BibleRoot tests require DATABASE_URL.");
  return pool;
}

async function stateFingerprint(): Promise<string> {
  const result = await database().query<{ state: string }>(`
    SELECT md5(jsonb_build_object(
      'books', (SELECT jsonb_agg(to_jsonb(row_value) ORDER BY row_value.book_id)
        FROM (SELECT book_id, machine_code, display_name, chapter_count,
          availability_status FROM bibleroot_books) row_value),
      'verses', (SELECT jsonb_agg(to_jsonb(row_value) ORDER BY row_value.edition_text_id)
        FROM (SELECT edition_text_id, canonical_reference_id, exact_text
          FROM bibleroot_verse_texts) row_value),
      'phrases', (SELECT jsonb_agg(to_jsonb(row_value) ORDER BY row_value.occurrence_id)
        FROM (SELECT occurrence_id, phrase_id, edition_text_id, start_offset,
          end_offset, exact_text FROM bibleroot_phrase_occurrences) row_value)
    )::text) AS state;
  `);
  return result.rows[0]?.state ?? "";
}

async function unrelatedFingerprint(): Promise<string> {
  const result = await database().query<{ state: string }>(`
    SELECT md5(jsonb_build_object(
      'bundles', (SELECT jsonb_agg(to_jsonb(row_value) ORDER BY row_value.bundle_id)
        FROM (SELECT bundle_id, bundle_type, version, domain
          FROM imported_bundles
          WHERE bundle_id <> 'bibleroot-foundation-v1') row_value),
      'dictionaryDatasets', (SELECT COUNT(*) FROM dictionaryroot_lexicon_datasets),
      'dictionaryEvidence', (SELECT COUNT(*) FROM dictionaryroot_lexical_evidence_datasets),
      'contextRecords', (SELECT COUNT(*) FROM context_records),
      'contextClaims', (SELECT COUNT(*) FROM context_claims),
      'contextEvidence', (SELECT COUNT(*) FROM context_evidence)
    )::text) AS state;
  `);
  return result.rows[0]?.state ?? "";
}

before(async () => {
  dataset = await validateBibleRootFoundation();
  preservationBefore = await unrelatedFingerprint();
  await database().query(
    "DELETE FROM imported_bundles WHERE bundle_id = 'bibleroot-foundation-v1';",
  );
  firstImport = await importBibleRootFoundation({ dataset });
  firstState = await stateFingerprint();
  secondImport = await importBibleRootFoundation({ dataset });
  secondState = await stateFingerprint();
  await assert.rejects(
    importBibleRootFoundation({
      dataset,
      simulateFailureAfterDatasetDelete: true,
    }),
    /Simulated BibleRoot transactional rollback/,
  );
  rollbackState = await stateFingerprint();
  preservationAfter = await unrelatedFingerprint();
});

after(async () => {
  await closeTestDatabase();
});

test("1. dataset manifest, files, and source checksums validate", async () => {
  assert.equal((await validateBibleRootFoundation(dataset)).manifest.status, "foundation-alpha");
});

test("2. raw Project Gutenberg artifact identity is exact", () => {
  assert.equal(dataset.sourceMetadata.source.byteLength, 4436268);
  assert.equal(
    dataset.sourceMetadata.source.sha256,
    "0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986",
  );
});

test("3. normalized selected-text hash is exact", () => {
  assert.equal(
    dataset.edition.normalizedTextSha256,
    "BD71CDBB98C44A9DBEC0A2B6D59E83CB93290FB04CFA1BAC5022E4F8B88818FF",
  );
});

test("4. explicit canon has all 66 ordered books", () => {
  assert.equal(dataset.canon.books.length, 66);
  assert.deepEqual(
    dataset.canon.books.map((book) => book.canonicalOrder),
    Array.from({ length: 66 }, (_, index) => index + 1),
  );
});

test("5. canon identity is scoped rather than universalized", () => {
  assert.equal(dataset.canon.canonId, "br-canon-kjv-66");
  assert.match(dataset.canon.scopeNote, /does not imply.*only/i);
});

test("6. edition, publication, source, and artifact identities are separate", () => {
  const identities = new Set([
    dataset.edition.editionId,
    dataset.edition.publicationId,
    dataset.sourceMetadata.source.sourceId,
    dataset.edition.artifactId,
  ]);
  assert.equal(identities.size, 4);
  assert.doesNotMatch(dataset.edition.displayTitle, /\b1611\b|\b1769\b/);
});

test("7. the four selected chapters contain exactly 110 sequential verses", () => {
  assert.equal(dataset.verses.length, 110);
  const expected = new Map([
    ["gen:1", 31],
    ["john:1", 51],
    ["ps:23", 6],
    ["eccl:3", 22],
  ]);
  for (const [key, count] of expected) {
    const [code, chapter] = key.split(":");
    const verses = dataset.verses.filter(
      (verse) => verse.bookCode === code
        && verse.chapterNumber === Number(chapter),
    );
    assert.equal(verses.length, count);
    assert.deepEqual(
      verses.map((verse) => verse.verseNumber),
      Array.from({ length: count }, (_, index) => index + 1),
    );
  }
});

test("8. stable canonical and edition-text IDs are deterministic", () => {
  const genesis = dataset.verses[0];
  assert.equal(genesis?.canonicalReferenceId, "br-ref-gen-001-001");
  assert.equal(genesis?.editionTextId, "br-text-kjv-pg10-gen-001-001");
  assert.equal(genesis?.citation, "Genesis 1:1 (KJV)");
});

test("9. nine phrase targets produce 13 exact source occurrences", () => {
  assert.equal(dataset.phrases.length, 9);
  assert.equal(
    dataset.phrases.reduce((sum, phrase) => sum + phrase.occurrences.length, 0),
    13,
  );
  const verses = new Map(dataset.verses.map((verse) => [verse.editionTextId, verse]));
  for (const phrase of dataset.phrases) {
    for (const occurrence of phrase.occurrences) {
      const verse = verses.get(occurrence.editionTextId);
      assert.equal(
        verse?.exactText.slice(occurrence.startOffset, occurrence.endOffset),
        phrase.displayText,
      );
    }
  }
});

test("10. reference parser accepts names, aliases, and machine codes", () => {
  assert.equal(
    parseBibleRootReference("Genesis 1", dataset).normalizedReference,
    "Genesis 1",
  );
  assert.equal(
    parseBibleRootReference("Gen 1:1", dataset).normalizedReference,
    "Genesis 1:1",
  );
  assert.equal(
    parseBibleRootReference("john 1:1-5", dataset).passageId,
    "br-passage-john-001-001-005",
  );
  assert.equal(
    parseBibleRootReference("ps 23:4", dataset).normalizedReference,
    "Psalm 23:4",
  );
});

test("11. parser distinguishes malformed, unknown, invalid, reversed, and unavailable", () => {
  const cases = [
    ["Genesis", "malformed-reference"],
    ["Unknown 1", "unknown-book"],
    ["Genesis 51", "invalid-chapter"],
    ["Genesis 1:32", "invalid-verse"],
    ["John 1:5-1", "reversed-range"],
    ["Genesis 2", "passage-unavailable"],
  ] as const;
  for (const [reference, code] of cases) {
    assert.throws(
      () => parseBibleRootReference(reference, dataset),
      (error) =>
        error instanceof BibleRootReferenceError && error.code === code,
    );
  }
});

test("12. migration 015 installed the complete BibleRoot table family", async () => {
  const migration015Tables = [
    "bibleroot_books",
    "bibleroot_canon_books",
    "bibleroot_canonical_verses",
    "bibleroot_canons",
    "bibleroot_chapters",
    "bibleroot_editions",
    "bibleroot_phrase_occurrences",
    "bibleroot_phrases",
    "bibleroot_source_artifacts",
    "bibleroot_source_publications",
    "bibleroot_verse_texts",
  ];
  const result = await database().query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    ORDER BY table_name;
  `, [migration015Tables]);
  assert.deepEqual(result.rows.map((row) => row.table_name), migration015Tables);
});

test("13. database foreign keys reject disconnected provenance", async () => {
  await assert.rejects(
    database().query(`
      INSERT INTO bibleroot_source_publications(
        publication_id, dataset_id, source_id, title, provider,
        stable_identifier, description
      ) VALUES (
        'br-publication-invalid', 'bibleroot-foundation-v1',
        'missing-source', 'Invalid', 'Invalid', 'invalid', 'Invalid'
      );
    `),
    /foreign key/i,
  );
});

test("14. database uniqueness rejects duplicate canonical book order", async () => {
  await assert.rejects(
    database().query(`
      INSERT INTO bibleroot_canon_books(canon_id, book_id, canonical_order)
      VALUES ('br-canon-kjv-66', 'br-book-exod', 1);
    `),
    /duplicate key|unique/i,
  );
});

test("15. duplicate public IDs are rejected before import", async () => {
  const duplicate = structuredClone(dataset);
  duplicate.verses[1]!.canonicalReferenceId =
    duplicate.verses[0]!.canonicalReferenceId;
  await assert.rejects(
    validateBibleRootFoundation(duplicate),
    /Duplicate public ID|Normalized text SHA-256 mismatch/,
  );
});

test("16. first importer run produces the exact summary", () => {
  assert.deepEqual(firstImport, {
    datasetId: "bibleroot-foundation-v1",
    version: "1.0.0",
    canonId: "br-canon-kjv-66",
    editionId: BIBLEROOT_EDITION_ID,
    books: 66,
    populatedChapters: 4,
    verses: 110,
    phrases: 9,
    phraseOccurrences: 13,
  });
});

test("17. second importer run is idempotent", () => {
  assert.deepEqual(secondImport, firstImport);
  assert.equal(secondState, firstState);
});

test("18. simulated failure rolls back the entire dataset replacement", () => {
  assert.equal(rollbackState, secondState);
});

test("19. DictionaryRoot and HistoryRoot database state remains unchanged", () => {
  assert.equal(preservationAfter, preservationBefore);
});

test("20. edition and book APIs return deterministic provenance-aware data", async () => {
  const editions = await request(app)
    .get("/api/v1/bibleroot/editions")
    .expect(200);
  assert.equal(editions.body.total, 1);
  assert.equal(editions.body.items[0].artifact.sha256, dataset.sourceMetadata.source.sha256);

  const books = await request(app)
    .get("/api/v1/bibleroot/books")
    .expect(200);
  assert.equal(books.body.total, 66);
  assert.equal(books.body.items[0].displayName, "Genesis");
  assert.equal(books.body.items[65].displayName, "Revelation");
});

test("21. chapter passage API returns exact ordered verses and phrase anchors", async () => {
  const response = await request(app)
    .get("/api/v1/bibleroot/passages")
    .query({ edition: BIBLEROOT_EDITION_ID, reference: "Genesis 1" })
    .expect(200);
  assert.equal(response.body.normalizedReference, "Genesis 1");
  assert.equal(response.body.verses.length, 31);
  assert.deepEqual(
    response.body.verses.map((verse: { verseNumber: number }) => verse.verseNumber),
    Array.from({ length: 31 }, (_, index) => index + 1),
  );
  assert.equal(response.body.verses[0].exactText, dataset.verses[0]?.exactText);
  assert.equal(response.body.contentLayers.commentary, "not-populated");
  assert.ok(response.body.verses[0].phraseOccurrences.length > 0);
});

test("22. single-verse and range passage APIs normalize citations", async () => {
  const single = await request(app)
    .get("/api/v1/bibleroot/passages")
    .query({ reference: "Ps 23:4" })
    .expect(200);
  assert.equal(single.body.humanCitation, "Psalm 23:4 (KJV)");
  assert.equal(single.body.verses.length, 1);

  const range = await request(app)
    .get("/api/v1/bibleroot/passages")
    .query({ reference: "John 1:1-5" })
    .expect(200);
  assert.equal(range.body.verses.length, 5);
  assert.equal(range.body.passageId, "br-passage-john-001-001-005");
});

test("23. verse API accepts canonical-reference and edition-text IDs", async () => {
  for (const id of [
    "br-ref-gen-001-001",
    "br-text-kjv-pg10-gen-001-001",
  ]) {
    const response = await request(app)
      .get(`/api/v1/bibleroot/verses/${id}`)
      .expect(200);
    assert.equal(response.body.canonicalReferenceId, "br-ref-gen-001-001");
    assert.equal(response.body.citation, "Genesis 1:1 (KJV)");
  }
});

test("24. phrase API exposes exact occurrences without interpretation", async () => {
  const response = await request(app)
    .get("/api/v1/bibleroot/phrases/br-phrase-in-the-beginning")
    .expect(200);
  assert.equal(response.body.interpretationStatus, "textual-anchor-only");
  assert.equal(response.body.occurrences.length, 2);
  assert.ok(response.body.occurrences.every(
    (occurrence: { exactText: string }) =>
      occurrence.exactText === "In the beginning",
  ));
});

test("25. malformed, unavailable, and missing API requests are transparent", async () => {
  const missing = await request(app)
    .get("/api/v1/bibleroot/passages")
    .expect(400);
  assert.equal(missing.body.code, "REFERENCE_REQUIRED");

  const malformed = await request(app)
    .get("/api/v1/bibleroot/passages")
    .query({ reference: "Genesis" })
    .expect(400);
  assert.equal(malformed.body.code, "MALFORMED_REFERENCE");

  const unavailable = await request(app)
    .get("/api/v1/bibleroot/passages")
    .query({ reference: "Genesis 2" })
    .expect(404);
  assert.equal(unavailable.body.code, "PASSAGE_UNAVAILABLE");

  await request(app)
    .get("/api/v1/bibleroot/verses/br-ref-gen-999-999")
    .expect(404);
});

test("26. BibleRoot route family is read-only", async () => {
  await request(app)
    .post("/api/v1/bibleroot/passages")
    .send({})
    .expect(404);
  await request(app)
    .put("/api/v1/bibleroot/verses/br-ref-gen-001-001")
    .send({})
    .expect(404);
});

test("27. database contains exact imported counts and source linkage", async () => {
  const result = await database().query<{
    books: string;
    chapters: string;
    verses: string;
    phrases: string;
    occurrences: string;
    linked: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM bibleroot_books) AS books,
      (SELECT COUNT(*) FROM bibleroot_chapters) AS chapters,
      (SELECT COUNT(*) FROM bibleroot_verse_texts) AS verses,
      (SELECT COUNT(*) FROM bibleroot_phrases) AS phrases,
      (SELECT COUNT(*) FROM bibleroot_phrase_occurrences) AS occurrences,
      (SELECT COUNT(*) FROM bibleroot_source_artifacts a
        JOIN sources s ON s.source_id = a.source_id
        JOIN imported_bundles b ON b.bundle_id = a.dataset_id
        WHERE b.bundle_id = 'bibleroot-foundation-v1') AS linked;
  `);
  assert.deepEqual(result.rows[0], {
    books: "66",
    chapters: "4",
    verses: "110",
    phrases: "9",
    occurrences: "13",
    linked: "1",
  });
});

test("28. no unsupported commentary or interpretation is imported", async () => {
  const result = await database().query<{ count: string }>(`
    SELECT COUNT(*) AS count
    FROM assertions
    WHERE bundle_id = 'bibleroot-foundation-v1';
  `);
  assert.equal(result.rows[0]?.count, "0");
  assert.doesNotMatch(JSON.stringify(dataset), /\bNIV\b|\bESV\b|\bNLT\b|\bNKJV\b/);
});
