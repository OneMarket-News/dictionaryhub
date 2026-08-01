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

export class BibleRootOriginalLanguageUnavailableError extends Error {
  readonly code = "original-language-unavailable";

  constructor(message: string) {
    super(message);
    this.name = "BibleRootOriginalLanguageUnavailableError";
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

interface OriginalEditionRow {
  original_edition_id: string;
  language_code: string;
  display_title: string;
  abbreviation: string;
  version_identity: string;
  immutable_source_ref: string;
  description: string;
  publication_id: string;
  publication_title: string;
  provider: string;
  stable_identifier: string;
}

interface OriginalArtifactRow {
  original_edition_id: string;
  artifact_id: string;
  filename: string;
  byte_length: string;
  sha256: string;
  source_url: string;
  retrieval_timestamp: Date | string;
  rights_status: string;
  rights_statement: string;
  territorial_limitation: string;
  source_id: string;
}

interface RightsComponentRow {
  artifact_id: string;
  component_id: string;
  component_type: string;
  rights_status: string;
  license_name: string | null;
  license_url: string | null;
  rights_statement: string;
  attribution: string;
  territorial_limitation: string;
  evidence_document: string;
}

async function originalEditionDetails(editionId?: string) {
  const editionResult = await database().query<OriginalEditionRow>(`
    SELECT e.original_edition_id, e.language_code, e.display_title,
      e.abbreviation, e.version_identity, e.immutable_source_ref,
      e.description, p.publication_id, p.title AS publication_title,
      p.provider, p.stable_identifier
    FROM bibleroot_original_language_editions e
    JOIN bibleroot_source_publications p ON p.publication_id = e.publication_id
    WHERE ($1::text IS NULL OR e.original_edition_id = $1)
    ORDER BY e.language_code DESC, e.original_edition_id;
  `, [editionId ?? null]);
  const editionIds = editionResult.rows.map((row) => row.original_edition_id);
  if (editionId && editionIds.length === 0) {
    throw new BibleRootOriginalLanguageUnavailableError(
      `Original-language edition is unavailable: ${editionId}.`,
    );
  }
  if (editionIds.length === 0) return [];
  const artifactResult = await database().query<OriginalArtifactRow>(`
    SELECT ea.original_edition_id, a.artifact_id, a.filename, a.byte_length,
      a.sha256, a.source_url, a.retrieval_timestamp, a.rights_status,
      a.rights_statement, a.territorial_limitation, a.source_id
    FROM bibleroot_original_language_edition_artifacts ea
    JOIN bibleroot_source_artifacts a ON a.artifact_id = ea.artifact_id
    WHERE ea.original_edition_id = ANY($1::text[])
    ORDER BY ea.original_edition_id, a.filename;
  `, [editionIds]);
  const artifactIds = artifactResult.rows.map((row) => row.artifact_id);
  const rightsResult = await database().query<RightsComponentRow>(`
    SELECT artifact_id, component_id, component_type, rights_status,
      license_name, license_url, rights_statement, attribution,
      territorial_limitation, evidence_document
    FROM bibleroot_source_artifact_rights_components
    WHERE artifact_id = ANY($1::text[])
    ORDER BY artifact_id, component_type;
  `, [artifactIds]);
  return editionResult.rows.map((row) => ({
    editionId: row.original_edition_id,
    language: row.language_code,
    displayTitle: row.display_title,
    abbreviation: row.abbreviation,
    versionIdentity: row.version_identity,
    immutableSourceRef: row.immutable_source_ref,
    description: row.description,
    publication: {
      publicationId: row.publication_id,
      title: row.publication_title,
      provider: row.provider,
      stableIdentifier: row.stable_identifier,
    },
    artifacts: artifactResult.rows
      .filter((artifact) => artifact.original_edition_id === row.original_edition_id)
      .map((artifact) => ({
        artifactId: artifact.artifact_id,
        sourceId: artifact.source_id,
        filename: artifact.filename,
        byteLength: Number(artifact.byte_length),
        sha256: artifact.sha256,
        sourceUrl: artifact.source_url,
        retrievedAt: instantValue(artifact.retrieval_timestamp),
        rightsStatus: artifact.rights_status,
        rightsStatement: artifact.rights_statement,
        territorialLimitation: artifact.territorial_limitation,
        rightsComponents: rightsResult.rows
          .filter((component) => component.artifact_id === artifact.artifact_id)
          .map((component) => ({
            componentId: component.component_id,
            componentType: component.component_type,
            rightsStatus: component.rights_status,
            licenseName: component.license_name,
            licenseUrl: component.license_url,
            rightsStatement: component.rights_statement,
            attribution: component.attribution,
            territorialLimitation: component.territorial_limitation,
            evidenceDocument: component.evidence_document,
          })),
      })),
  }));
}

export async function listBibleRootOriginalLanguageEditions() {
  const items = await originalEditionDetails();
  return {
    items,
    total: items.length,
    availabilityBoundary:
      "Only Genesis 1, Psalm 23, Ecclesiastes 3, and John 1 are populated; original-language records are not a unified-search provider in this stage.",
  };
}

interface OriginalTokenRow {
  source_verse_id: string;
  original_edition_id: string;
  artifact_id: string;
  source_book: string;
  source_chapter: number;
  source_verse_identifier: string;
  source_native_citation: string;
  source_native_versification: string;
  surface_text: string;
  sourceroot_identity: string;
  mapping_id: string;
  target_canonical_reference_id: string | null;
  mapping_type: string;
  factual_explanation: string;
  evidence_source: string;
  review_status: string;
  token_id: string;
  source_native_token_id: string | null;
  sequence_position: number;
  surface_form: string;
  verbatim_lemma: string | null;
  source_native_lemma_identifier: string | null;
  lemma_analysis_status: string;
  morphology_id: string;
  morphology_ordinal: number;
  verbatim_morphology_code: string | null;
  morphology_system: string;
  morphology_analysis_status: string;
}

const originalBookByCanonicalCode: Record<string, string> = {
  gen: "Gen",
  ps: "Ps",
  eccl: "Eccl",
  john: "John",
};

export async function getBibleRootOriginalLanguagePassage(
  reference: string,
  editionId?: string,
) {
  const dataset = await foundation();
  const parsed = parseBibleRootReference(reference, dataset);
  const sourceBook = originalBookByCanonicalCode[parsed.book.machineCode];
  if (!sourceBook) {
    throw new BibleRootOriginalLanguageUnavailableError(
      `${parsed.normalizedReference} has no original-language data in this bounded foundation.`,
    );
  }
  const expectedLanguage = sourceBook === "John" ? "grc" : "he";
  const editions = await originalEditionDetails(editionId);
  const matchingEdition = editions.find((edition) => edition.language === expectedLanguage);
  if (!matchingEdition) {
    throw new BibleRootOriginalLanguageUnavailableError(
      `${parsed.normalizedReference} is not available in ${editionId ?? "the requested original-language edition"}.`,
    );
  }
  const includeSuperscription =
    sourceBook === "Ps" && parsed.chapterNumber === 23 && parsed.startVerse === 1;
  const result = await database().query<OriginalTokenRow>(`
    SELECT v.source_verse_id, v.original_edition_id, v.artifact_id,
      v.source_book, v.source_chapter, v.source_verse_identifier,
      v.source_native_citation, v.source_native_versification, v.surface_text,
      v.sourceroot_identity, m.mapping_id, m.target_canonical_reference_id,
      m.mapping_type, m.factual_explanation, m.evidence_source,
      m.review_status, t.token_id, t.source_native_token_id,
      t.sequence_position, t.surface_form, l.verbatim_lemma,
      l.source_native_lemma_identifier,
      l.analysis_status AS lemma_analysis_status, tm.morphology_id,
      tm.morphology_ordinal, tm.verbatim_morphology_code,
      tm.morphology_system, tm.analysis_status AS morphology_analysis_status
    FROM bibleroot_original_language_verses v
    JOIN bibleroot_original_language_verse_mappings m
      ON m.source_verse_id = v.source_verse_id
    JOIN bibleroot_original_language_tokens t
      ON t.source_verse_id = v.source_verse_id
    JOIN bibleroot_original_language_token_lemmas l ON l.token_id = t.token_id
    JOIN bibleroot_original_language_token_morphologies tm ON tm.token_id = t.token_id
    WHERE v.original_edition_id = $1
      AND v.source_book = $2
      AND v.source_chapter = $3
      AND (
        m.target_canonical_reference_id = ANY($4::text[])
        OR ($5::boolean AND m.mapping_type = 'omitted_or_untranslated')
      )
    ORDER BY
      CASE WHEN v.source_verse_identifier = 'title' THEN 0
        ELSE v.source_verse_identifier::integer END,
      t.sequence_position, tm.morphology_ordinal;
  `, [
    matchingEdition.editionId,
    sourceBook,
    parsed.chapterNumber,
    parsed.canonicalReferenceIds,
    includeSuperscription,
  ]);
  if (result.rows.length === 0) {
    throw new BibleRootOriginalLanguageUnavailableError(
      `${parsed.normalizedReference} has no original-language data in this bounded foundation.`,
    );
  }
  const verseMap = new Map<string, {
    sourceVerseId: string;
    sourceBook: string;
    sourceChapter: number;
    sourceVerseIdentifier: string;
    sourceNativeCitation: string;
    sourceNativeVersification: string;
    surfaceText: string;
    sourcerootIdentity: string;
    artifactId: string;
    mapping: unknown;
    tokens: Array<{
      tokenId: string;
      sourceNativeTokenId: string | null;
      sequencePosition: number;
      surfaceForm: string;
      lemma: unknown;
      morphologies: unknown[];
    }>;
  }>();
  const tokenMap = new Map<string, {
    tokenId: string;
    sourceNativeTokenId: string | null;
    sequencePosition: number;
    surfaceForm: string;
    lemma: unknown;
    morphologies: unknown[];
  }>();
  for (const row of result.rows) {
    let verse = verseMap.get(row.source_verse_id);
    if (!verse) {
      verse = {
        sourceVerseId: row.source_verse_id,
        sourceBook: row.source_book,
        sourceChapter: row.source_chapter,
        sourceVerseIdentifier: row.source_verse_identifier,
        sourceNativeCitation: row.source_native_citation,
        sourceNativeVersification: row.source_native_versification,
        surfaceText: row.surface_text,
        sourcerootIdentity: row.sourceroot_identity,
        artifactId: row.artifact_id,
        mapping: {
          mappingId: row.mapping_id,
          targetCanonicalReferenceId: row.target_canonical_reference_id,
          mappingType: row.mapping_type,
          factualExplanation: row.factual_explanation,
          evidenceSource: row.evidence_source,
          reviewStatus: row.review_status,
        },
        tokens: [],
      };
      verseMap.set(row.source_verse_id, verse);
    }
    let token = tokenMap.get(row.token_id);
    if (!token) {
      token = {
        tokenId: row.token_id,
        sourceNativeTokenId: row.source_native_token_id,
        sequencePosition: row.sequence_position,
        surfaceForm: row.surface_form,
        lemma: {
          verbatim: row.verbatim_lemma,
          sourceNativeIdentifier: row.source_native_lemma_identifier,
          analysisStatus: row.lemma_analysis_status,
        },
        morphologies: [],
      };
      tokenMap.set(row.token_id, token);
      verse.tokens.push(token);
    }
    token.morphologies.push({
      morphologyId: row.morphology_id,
      ordinal: row.morphology_ordinal,
      verbatimCode: row.verbatim_morphology_code,
      morphologySystem: row.morphology_system,
      analysisStatus: row.morphology_analysis_status,
    });
  }
  return {
    availability: "populated",
    normalizedReference: parsed.normalizedReference,
    targetCanonicalReferenceIds: parsed.canonicalReferenceIds,
    edition: matchingEdition,
    direction: expectedLanguage === "he" ? "rtl" : "ltr",
    verses: [...verseMap.values()],
    boundaries: {
      translation: "The KJV remains the primary verified passage; no word-level alignment is asserted.",
      interpretation: "No transliteration, lexical gloss, commentary, theology, or SourceRoot inference is supplied.",
      search: "Original-language data is not a unified-search provider in this stage.",
    },
  };
}
