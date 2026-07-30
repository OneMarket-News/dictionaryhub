import {
  BIBLEROOT_EDITION_ID,
  BibleRootReferenceError,
  loadBibleRootFoundation,
  parseBibleRootReference,
  type BibleRootFoundationDataset,
} from "../bibleroot/foundation.js";
import { getPool } from "../lib/database.js";

let datasetPromise: Promise<BibleRootFoundationDataset> | undefined;

function foundation(): Promise<BibleRootFoundationDataset> {
  datasetPromise ??= loadBibleRootFoundation();
  return datasetPromise;
}

function database() {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  return pool;
}

export class BibleRootResourceNotFoundError extends Error {
  constructor(
    public readonly code: "edition-not-found" | "verse-not-found" | "phrase-not-found",
    message: string,
  ) {
    super(message);
    this.name = "BibleRootResourceNotFoundError";
  }
}

interface EditionRow {
  edition_id: string;
  display_title: string;
  abbreviation: string;
  language_code: string;
  translation_name: string;
  edition_description: string;
  publisher_or_distributor: string | null;
  publication_or_release_date: Date | string | null;
  rights_status: string;
  territorial_limitation: string;
  dataset_version: string;
  normalized_text_sha256: string;
  provenance_notes: string;
  publication_id: string;
  publication_title: string;
  stable_identifier: string;
  provider: string;
  source_id: string;
  artifact_id: string;
  filename: string;
  byte_length: string;
  artifact_sha256: string;
  source_url: string;
  retrieval_timestamp: Date | string;
  rights_statement: string;
}

function dateValue(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function instantValue(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapEdition(row: EditionRow) {
  return {
    editionId: row.edition_id,
    displayTitle: row.display_title,
    abbreviation: row.abbreviation,
    language: row.language_code,
    translationName: row.translation_name,
    editionDescription: row.edition_description,
    publisherOrDistributor: row.publisher_or_distributor,
    publicationOrReleaseDate: dateValue(row.publication_or_release_date),
    rightsStatus: row.rights_status,
    territorialLimitation: row.territorial_limitation,
    datasetVersion: row.dataset_version,
    normalizedTextSha256: row.normalized_text_sha256,
    provenanceNotes: row.provenance_notes,
    publication: {
      publicationId: row.publication_id,
      title: row.publication_title,
      stableIdentifier: row.stable_identifier,
      provider: row.provider,
    },
    source: {
      sourceId: row.source_id,
    },
    artifact: {
      artifactId: row.artifact_id,
      filename: row.filename,
      byteLength: Number(row.byte_length),
      sha256: row.artifact_sha256,
      sourceUrl: row.source_url,
      retrievedAt: instantValue(row.retrieval_timestamp),
      rightsStatement: row.rights_statement,
    },
  };
}

const editionSelect = `
  SELECT
    e.edition_id,
    e.display_title,
    e.abbreviation,
    e.language_code,
    e.translation_name,
    e.edition_description,
    e.publisher_or_distributor,
    e.publication_or_release_date,
    e.rights_status,
    e.territorial_limitation,
    e.dataset_version,
    e.normalized_text_sha256,
    e.provenance_notes,
    p.publication_id,
    p.title AS publication_title,
    p.stable_identifier,
    p.provider,
    a.source_id,
    a.artifact_id,
    a.filename,
    a.byte_length,
    a.sha256 AS artifact_sha256,
    a.source_url,
    a.retrieval_timestamp,
    a.rights_statement
  FROM bibleroot_editions e
  JOIN bibleroot_source_publications p
    ON p.publication_id = e.publication_id
  JOIN bibleroot_source_artifacts a
    ON a.artifact_id = e.artifact_id
`;

async function requireEdition(editionId: string): Promise<EditionRow> {
  const result = await database().query<EditionRow>(
    `${editionSelect} WHERE e.edition_id = $1;`,
    [editionId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new BibleRootResourceNotFoundError(
      "edition-not-found",
      `BibleRoot edition not found: ${editionId}.`,
    );
  }
  return row;
}

export async function listBibleRootEditions() {
  const result = await database().query<EditionRow>(
    `${editionSelect} ORDER BY e.edition_id ASC;`,
  );
  return {
    items: result.rows.map(mapEdition),
    total: result.rows.length,
  };
}

interface BookRow {
  book_id: string;
  machine_code: string;
  display_name: string;
  aliases: string[];
  broad_collection: string;
  chapter_count: number;
  availability_status: string;
  canonical_order: number;
  canon_id: string;
  canon_display_name: string;
  canon_scope_note: string;
  authority_source_id: string;
}

export async function listBibleRootBooks() {
  const result = await database().query<BookRow>(
    `
      SELECT
        b.book_id,
        b.machine_code,
        b.display_name,
        b.aliases,
        b.broad_collection,
        b.chapter_count,
        b.availability_status,
        cb.canonical_order,
        c.canon_id,
        c.display_name AS canon_display_name,
        c.scope_note AS canon_scope_note,
        b.authority_source_id
      FROM bibleroot_books b
      JOIN bibleroot_canon_books cb ON cb.book_id = b.book_id
      JOIN bibleroot_canons c ON c.canon_id = cb.canon_id
      ORDER BY cb.canonical_order ASC, b.book_id ASC;
    `,
  );
  return {
    items: result.rows.map((row) => ({
      bookId: row.book_id,
      machineCode: row.machine_code,
      displayName: row.display_name,
      aliases: row.aliases,
      broadCollection: row.broad_collection,
      chapterCount: row.chapter_count,
      availabilityStatus: row.availability_status,
      canonicalOrder: row.canonical_order,
      authoritySourceId: row.authority_source_id,
      canon: {
        canonId: row.canon_id,
        displayName: row.canon_display_name,
        scopeNote: row.canon_scope_note,
      },
    })),
    total: result.rows.length,
  };
}

interface VerseRow {
  canonical_reference_id: string;
  edition_text_id: string;
  book_id: string;
  machine_code: string;
  book_name: string;
  chapter_number: number;
  verse_number: number;
  exact_text: string;
  source_observation: string;
}

interface PhraseOccurrenceRow {
  phrase_id: string;
  display_text: string;
  normalized_lookup_text: string;
  provenance_note: string;
  occurrence_id: string;
  edition_text_id: string;
  start_offset: number;
  end_offset: number;
  exact_text: string;
}

async function phraseOccurrencesForTextIds(textIds: string[]) {
  if (textIds.length === 0) return new Map<string, unknown[]>();
  const result = await database().query<PhraseOccurrenceRow>(
    `
      SELECT
        p.phrase_id,
        p.display_text,
        p.normalized_lookup_text,
        p.provenance_note,
        o.occurrence_id,
        o.edition_text_id,
        o.start_offset,
        o.end_offset,
        o.exact_text
      FROM bibleroot_phrase_occurrences o
      JOIN bibleroot_phrases p ON p.phrase_id = o.phrase_id
      WHERE o.edition_text_id = ANY($1::text[])
      ORDER BY o.edition_text_id ASC, o.start_offset ASC, p.phrase_id ASC;
    `,
    [textIds],
  );
  const byTextId = new Map<string, unknown[]>();
  for (const row of result.rows) {
    const collection = byTextId.get(row.edition_text_id) ?? [];
    collection.push({
      phraseId: row.phrase_id,
      displayText: row.display_text,
      normalizedLookupText: row.normalized_lookup_text,
      provenanceNote: row.provenance_note,
      occurrenceId: row.occurrence_id,
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      exactText: row.exact_text,
    });
    byTextId.set(row.edition_text_id, collection);
  }
  return byTextId;
}

function mapVerse(
  row: VerseRow,
  editionAbbreviation: string,
  phrases: unknown[],
) {
  const normalizedReference =
    `${row.book_name} ${row.chapter_number}:${row.verse_number}`;
  return {
    normalizedReference,
    canonicalReferenceId: row.canonical_reference_id,
    editionTextId: row.edition_text_id,
    citation: `${normalizedReference} (${editionAbbreviation})`,
    bookId: row.book_id,
    bookCode: row.machine_code,
    bookName: row.book_name,
    chapterNumber: row.chapter_number,
    verseNumber: row.verse_number,
    exactText: row.exact_text,
    sourceObservation: row.source_observation,
    anchor: row.canonical_reference_id,
    deepLink:
      `bibleroot-passage.html?edition=${encodeURIComponent(BIBLEROOT_EDITION_ID)}`
      + `&reference=${encodeURIComponent(normalizedReference)}`
      + `#${encodeURIComponent(row.canonical_reference_id)}`,
    phraseOccurrences: phrases,
  };
}

export async function getBibleRootPassage(
  reference: string,
  editionId = BIBLEROOT_EDITION_ID,
) {
  const [dataset, editionRow] = await Promise.all([
    foundation(),
    requireEdition(editionId),
  ]);
  const parsed = parseBibleRootReference(reference, dataset);
  const verseResult = await database().query<VerseRow>(
    `
      SELECT
        cv.canonical_reference_id,
        vt.edition_text_id,
        cv.book_id,
        b.machine_code,
        b.display_name AS book_name,
        cv.chapter_number,
        cv.verse_number,
        vt.exact_text,
        vt.source_observation
      FROM bibleroot_canonical_verses cv
      JOIN bibleroot_books b ON b.book_id = cv.book_id
      JOIN bibleroot_verse_texts vt
        ON vt.canonical_reference_id = cv.canonical_reference_id
      WHERE vt.edition_id = $1
        AND cv.canonical_reference_id = ANY($2::text[])
      ORDER BY cv.verse_number ASC, cv.canonical_reference_id ASC;
    `,
    [editionId, parsed.canonicalReferenceIds],
  );
  if (verseResult.rows.length !== parsed.canonicalReferenceIds.length) {
    throw new BibleRootReferenceError(
      "passage-unavailable",
      `${parsed.normalizedReference} is not available in edition ${editionId}.`,
    );
  }
  const phrasesByTextId = await phraseOccurrencesForTextIds(
    verseResult.rows.map((row) => row.edition_text_id),
  );
  const edition = mapEdition(editionRow);
  return {
    passageId: parsed.passageId,
    normalizedReference: parsed.normalizedReference,
    humanCitation: `${parsed.normalizedReference} (${editionRow.abbreviation})`,
    canonicalReferenceIds: parsed.canonicalReferenceIds,
    stableDeepLink:
      `bibleroot-passage.html?edition=${encodeURIComponent(editionId)}`
      + `&reference=${encodeURIComponent(parsed.normalizedReference)}`,
    edition,
    verses: verseResult.rows.map((row) =>
      mapVerse(
        row,
        editionRow.abbreviation,
        phrasesByTextId.get(row.edition_text_id) ?? [],
      )),
    provenance: {
      source: edition.source,
      publication: edition.publication,
      artifact: edition.artifact,
      rightsStatus: edition.rightsStatus,
      territorialLimitation: edition.territorialLimitation,
    },
    contentLayers: {
      biblicalText: "populated",
      canonMetadata: "populated",
      editionMetadata: "populated",
      sourceMetadata: "populated",
      sourceObservation: "populated",
      commentary: "not-populated",
      historicalInterpretation: "not-populated",
      theologicalInterpretation: "not-populated",
      sourceRootInference: "not-populated",
    },
  };
}

export async function getBibleRootVerse(
  verseId: string,
  editionId = BIBLEROOT_EDITION_ID,
) {
  const editionRow = await requireEdition(editionId);
  const result = await database().query<VerseRow>(
    `
      SELECT
        cv.canonical_reference_id,
        vt.edition_text_id,
        cv.book_id,
        b.machine_code,
        b.display_name AS book_name,
        cv.chapter_number,
        cv.verse_number,
        vt.exact_text,
        vt.source_observation
      FROM bibleroot_canonical_verses cv
      JOIN bibleroot_books b ON b.book_id = cv.book_id
      JOIN bibleroot_verse_texts vt
        ON vt.canonical_reference_id = cv.canonical_reference_id
      WHERE vt.edition_id = $1
        AND (
          cv.canonical_reference_id = $2
          OR vt.edition_text_id = $2
        )
      ORDER BY vt.edition_text_id ASC
      LIMIT 1;
    `,
    [editionId, verseId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new BibleRootResourceNotFoundError(
      "verse-not-found",
      `BibleRoot verse not found: ${verseId}.`,
    );
  }
  const phrasesByTextId = await phraseOccurrencesForTextIds([row.edition_text_id]);
  return {
    ...mapVerse(
      row,
      editionRow.abbreviation,
      phrasesByTextId.get(row.edition_text_id) ?? [],
    ),
    edition: mapEdition(editionRow),
  };
}

interface PhraseDetailRow extends PhraseOccurrenceRow {
  canonical_reference_id: string;
  book_name: string;
  chapter_number: number;
  verse_number: number;
}

export async function getBibleRootPhrase(phraseId: string) {
  const result = await database().query<PhraseDetailRow>(
    `
      SELECT
        p.phrase_id,
        p.display_text,
        p.normalized_lookup_text,
        p.provenance_note,
        o.occurrence_id,
        o.edition_text_id,
        o.start_offset,
        o.end_offset,
        o.exact_text,
        cv.canonical_reference_id,
        b.display_name AS book_name,
        cv.chapter_number,
        cv.verse_number
      FROM bibleroot_phrases p
      LEFT JOIN bibleroot_phrase_occurrences o ON o.phrase_id = p.phrase_id
      LEFT JOIN bibleroot_verse_texts vt
        ON vt.edition_text_id = o.edition_text_id
      LEFT JOIN bibleroot_canonical_verses cv
        ON cv.canonical_reference_id = vt.canonical_reference_id
      LEFT JOIN bibleroot_books b ON b.book_id = cv.book_id
      WHERE p.phrase_id = $1
      ORDER BY b.book_id ASC, cv.chapter_number ASC, cv.verse_number ASC,
        o.start_offset ASC;
    `,
    [phraseId],
  );
  const first = result.rows[0];
  if (!first) {
    throw new BibleRootResourceNotFoundError(
      "phrase-not-found",
      `BibleRoot phrase not found: ${phraseId}.`,
    );
  }
  return {
    phraseId: first.phrase_id,
    displayText: first.display_text,
    normalizedLookupText: first.normalized_lookup_text,
    editionId: BIBLEROOT_EDITION_ID,
    provenanceNote: first.provenance_note,
    interpretationStatus: "textual-anchor-only",
    occurrences: result.rows.map((row) => ({
      occurrenceId: row.occurrence_id,
      editionTextId: row.edition_text_id,
      canonicalReferenceId: row.canonical_reference_id,
      normalizedReference:
        `${row.book_name} ${row.chapter_number}:${row.verse_number}`,
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      exactText: row.exact_text,
    })),
  };
}
