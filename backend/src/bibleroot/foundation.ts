import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BIBLEROOT_DATASET_ID = "bibleroot-foundation-v1";
export const BIBLEROOT_DATASET_VERSION = "1.0.0";
export const BIBLEROOT_CANON_ID = "br-canon-kjv-66";
export const BIBLEROOT_EDITION_ID = "br-edition-kjv-pg10-2024";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const BIBLEROOT_DATASET_DIRECTORY = path.resolve(
  currentDirectory,
  "../../data/bibleroot-foundation-v1",
);

export interface BibleRootBook {
  bookId: string;
  machineCode: string;
  displayName: string;
  aliases: string[];
  broadCollection: string;
  chapterCount: number;
  canonicalOrder: number;
  availabilityStatus: "text_available" | "metadata_only";
  authoritySourceId: string;
}

export interface BibleRootCanon {
  canonId: string;
  displayName: string;
  description: string;
  scopeNote: string;
  authoritySourceId: string;
  books: BibleRootBook[];
}

export interface BibleRootEdition {
  editionId: string;
  displayTitle: string;
  abbreviation: string;
  language: string;
  translationName: string;
  editionDescription: string;
  publisherOrDistributor: string;
  publicationOrReleaseDate: string;
  rightsStatus: string;
  territorialLimitation: string;
  publicationId: string;
  artifactId: string;
  datasetVersion: string;
  normalizedTextSha256: string;
  provenanceNotes: string;
}

export interface BibleRootVerse {
  bookId: string;
  bookCode: string;
  bookName: string;
  chapterId: string;
  chapterNumber: number;
  verseNumber: number;
  canonicalReferenceId: string;
  editionTextId: string;
  normalizedReference: string;
  citation: string;
  exactText: string;
}

export interface BibleRootPhraseOccurrence {
  occurrenceId: string;
  editionTextId: string;
  canonicalReferenceId: string;
  startOffset: number;
  endOffset: number;
  exactText: string;
}

export interface BibleRootPhrase {
  phraseId: string;
  displayText: string;
  normalizedLookupText: string;
  editionId: string;
  provenanceNote: string;
  occurrences: BibleRootPhraseOccurrence[];
}

export interface BibleRootSourceMetadata {
  datasetId: string;
  datasetVersion: string;
  source: {
    sourceId: string;
    publicationId: string;
    artifactId: string;
    provider: string;
    title: string;
    stableIdentifier: string;
    catalogUrl: string;
    downloadUrl: string;
    artifactFilename: string;
    mediaType: string;
    retrievedAt: string;
    byteLength: number;
    sha256: string;
    catalogReleaseDate: string;
    catalogLastUpdate: string;
    rightsStatus: string;
    rightsStatement: string;
    territorialLimitation: string;
    parsingRules: string;
  };
  publication: {
    title: string;
    provider: string;
    description: string;
    publicationDate: string;
  };
}

export interface BibleRootManifest {
  schemaVersion: string;
  datasetId: string;
  version: string;
  status: string;
  canonId: string;
  editionId: string;
  sourceId: string;
  publicationId: string;
  artifactId: string;
  expectedCounts: {
    canons: number;
    books: number;
    populatedChapters: number;
    verses: number;
    phrases: number;
    phraseOccurrences: number;
  };
  featuredReferences: string[];
  normalizedTextSha256: string;
  files: Record<string, string>;
}

export interface BibleRootFoundationDataset {
  manifest: BibleRootManifest;
  sourceMetadata: BibleRootSourceMetadata;
  canon: BibleRootCanon;
  edition: BibleRootEdition;
  verses: BibleRootVerse[];
  phrases: BibleRootPhrase[];
}

export type BibleRootReferenceErrorCode =
  | "malformed-reference"
  | "unknown-book"
  | "invalid-chapter"
  | "invalid-verse"
  | "reversed-range"
  | "passage-unavailable";

export class BibleRootReferenceError extends Error {
  constructor(
    public readonly code: BibleRootReferenceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BibleRootReferenceError";
  }
}

export interface ParsedBibleRootReference {
  book: BibleRootBook;
  chapterNumber: number;
  startVerse: number;
  endVerse: number;
  wholeChapter: boolean;
  normalizedReference: string;
  passageId: string;
  canonicalReferenceIds: string[];
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(
    await readFile(path.join(BIBLEROOT_DATASET_DIRECTORY, filename), "utf8"),
  ) as T;
}

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertPublicId(value: string, label: string): void {
  assert(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    `${label} is not a case-normalized URL-safe stable ID: ${value}`,
  );
}

export async function loadBibleRootFoundation():
Promise<BibleRootFoundationDataset> {
  const [manifest, sourceMetadata, canon, edition, verses, phrases] =
    await Promise.all([
      readJson<BibleRootManifest>("dataset-manifest.json"),
      readJson<BibleRootSourceMetadata>("source-metadata.json"),
      readJson<BibleRootCanon>("canon.json"),
      readJson<BibleRootEdition>("edition.json"),
      readJson<BibleRootVerse[]>("verses.json"),
      readJson<BibleRootPhrase[]>("phrases.json"),
    ]);
  return { manifest, sourceMetadata, canon, edition, verses, phrases };
}

export async function validateBibleRootFoundation(
  dataset?: BibleRootFoundationDataset,
): Promise<BibleRootFoundationDataset> {
  const loaded = dataset ?? await loadBibleRootFoundation();
  const {
    manifest,
    sourceMetadata,
    canon,
    edition,
    verses,
    phrases,
  } = loaded;

  assert(manifest.datasetId === BIBLEROOT_DATASET_ID, "Dataset ID mismatch.");
  assert(
    manifest.version === BIBLEROOT_DATASET_VERSION,
    "Dataset version mismatch.",
  );
  assert(canon.canonId === BIBLEROOT_CANON_ID, "Canon ID mismatch.");
  assert(edition.editionId === BIBLEROOT_EDITION_ID, "Edition ID mismatch.");
  assert(sourceMetadata.datasetId === manifest.datasetId, "Source dataset mismatch.");
  assert(sourceMetadata.datasetVersion === manifest.version, "Source version mismatch.");
  assert(manifest.sourceId === sourceMetadata.source.sourceId, "Source ID mismatch.");
  assert(
    manifest.publicationId === sourceMetadata.source.publicationId,
    "Publication ID mismatch.",
  );
  assert(
    manifest.artifactId === sourceMetadata.source.artifactId,
    "Artifact ID mismatch.",
  );
  assert(edition.publicationId === manifest.publicationId, "Edition publication mismatch.");
  assert(edition.artifactId === manifest.artifactId, "Edition artifact mismatch.");

  for (const [filename, expectedHash] of Object.entries(manifest.files)) {
    const bytes = await readFile(path.join(BIBLEROOT_DATASET_DIRECTORY, filename));
    assert(
      sha256(bytes) === expectedHash,
      `Dataset file checksum mismatch: ${filename}`,
    );
  }
  const rawPath = path.join(
    BIBLEROOT_DATASET_DIRECTORY,
    "raw/project-gutenberg-ebook-10-10-0.txt",
  );
  const rawBytes = await readFile(rawPath);
  assert(
    rawBytes.byteLength === sourceMetadata.source.byteLength,
    "Raw source byte length mismatch.",
  );
  assert(
    sha256(rawBytes) === sourceMetadata.source.sha256,
    "Raw source SHA-256 mismatch.",
  );

  assert(canon.books.length === manifest.expectedCounts.books, "Book count mismatch.");
  assert(canon.books.length === 66, "The alpha canon must contain 66 books.");
  assert(
    canon.books.every((book, index) => book.canonicalOrder === index + 1),
    "Canon book order is not contiguous.",
  );
  assert(
    new Set(canon.books.map((book) => book.machineCode)).size === canon.books.length,
    "Duplicate book machine code.",
  );
  assert(
    new Set(canon.books.map((book) => book.canonicalOrder)).size === canon.books.length,
    "Duplicate canon order.",
  );

  const allPublicIds = [
    canon.canonId,
    edition.editionId,
    sourceMetadata.source.sourceId,
    sourceMetadata.source.publicationId,
    sourceMetadata.source.artifactId,
    ...canon.books.map((book) => book.bookId),
    ...verses.flatMap((verse) => [
      verse.chapterId,
      verse.canonicalReferenceId,
      verse.editionTextId,
    ]),
    ...phrases.flatMap((phrase) => [
      phrase.phraseId,
      ...phrase.occurrences.map((occurrence) => occurrence.occurrenceId),
    ]),
  ];
  allPublicIds.forEach((value, index) => assertPublicId(value, `publicId[${index}]`));
  assert(
    new Set(allPublicIds).size === allPublicIds.length
      - (verses.length - manifest.expectedCounts.populatedChapters),
    "Duplicate public ID outside the expected repeated chapter IDs.",
  );

  assert(verses.length === manifest.expectedCounts.verses, "Verse count mismatch.");
  assert(verses.length === 110, "The alpha must contain 110 verses.");
  const chapters = new Map<string, BibleRootVerse[]>();
  for (const verse of verses) {
    const collection = chapters.get(verse.chapterId) ?? [];
    collection.push(verse);
    chapters.set(verse.chapterId, collection);
  }
  assert(
    chapters.size === manifest.expectedCounts.populatedChapters,
    "Populated chapter count mismatch.",
  );
  for (const [chapterId, chapterVerses] of chapters) {
    chapterVerses.sort((left, right) => left.verseNumber - right.verseNumber);
    assert(
      chapterVerses.every((verse, index) => verse.verseNumber === index + 1),
      `Non-contiguous verse sequence: ${chapterId}`,
    );
  }

  const normalizedMaterial = verses
    .map((verse) => `${verse.editionTextId}\t${verse.exactText}`)
    .join("\n");
  const normalizedHash = sha256(normalizedMaterial);
  assert(
    normalizedHash === edition.normalizedTextSha256
      && normalizedHash === manifest.normalizedTextSha256,
    "Normalized text SHA-256 mismatch.",
  );

  assert(phrases.length === manifest.expectedCounts.phrases, "Phrase count mismatch.");
  const verseByTextId = new Map(verses.map((verse) => [verse.editionTextId, verse]));
  let phraseOccurrenceCount = 0;
  for (const phrase of phrases) {
    assert(phrase.editionId === edition.editionId, `Phrase edition mismatch: ${phrase.phraseId}`);
    assert(
      phrase.normalizedLookupText === phrase.displayText.toLowerCase(),
      `Phrase normalization mismatch: ${phrase.phraseId}`,
    );
    for (const occurrence of phrase.occurrences) {
      phraseOccurrenceCount += 1;
      const verse = verseByTextId.get(occurrence.editionTextId);
      assert(verse, `Phrase occurrence verse is missing: ${occurrence.occurrenceId}`);
      assert(
        occurrence.canonicalReferenceId === verse.canonicalReferenceId,
        `Phrase reference mismatch: ${occurrence.occurrenceId}`,
      );
      assert(
        verse.exactText.slice(occurrence.startOffset, occurrence.endOffset)
          === occurrence.exactText
          && occurrence.exactText === phrase.displayText,
        `Phrase offsets are not exact: ${occurrence.occurrenceId}`,
      );
    }
  }
  assert(
    phraseOccurrenceCount === manifest.expectedCounts.phraseOccurrences,
    "Phrase occurrence count mismatch.",
  );

  return loaded;
}

function aliasKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseBibleRootReference(
  reference: string,
  dataset: BibleRootFoundationDataset,
): ParsedBibleRootReference {
  const normalizedInput = reference.trim().replace(/\s+/g, " ");
  const match = /^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(normalizedInput);
  if (!match) {
    throw new BibleRootReferenceError(
      "malformed-reference",
      "Use a reference such as Genesis 1, Gen 1:1, or John 1:1-5.",
    );
  }

  const requestedBook = aliasKey(match[1]!);
  const book = dataset.canon.books.find((candidate) =>
    [candidate.machineCode, candidate.displayName, ...candidate.aliases]
      .some((alias) => aliasKey(alias) === requestedBook));
  if (!book) {
    throw new BibleRootReferenceError(
      "unknown-book",
      `Unknown Bible book or abbreviation: ${match[1]}.`,
    );
  }

  const chapterNumber = Number(match[2]);
  if (
    !Number.isSafeInteger(chapterNumber)
    || chapterNumber < 1
    || chapterNumber > book.chapterCount
  ) {
    throw new BibleRootReferenceError(
      "invalid-chapter",
      `${book.displayName} does not have chapter ${match[2]}.`,
    );
  }

  const chapterVerses = dataset.verses
    .filter((verse) =>
      verse.bookCode === book.machineCode
      && verse.chapterNumber === chapterNumber)
    .sort((left, right) => left.verseNumber - right.verseNumber);
  if (chapterVerses.length === 0) {
    throw new BibleRootReferenceError(
      "passage-unavailable",
      `${book.displayName} ${chapterNumber} is valid but is not available in the foundation alpha.`,
    );
  }

  const wholeChapter = match[3] === undefined;
  const startVerse = wholeChapter ? 1 : Number(match[3]);
  const maximumVerse = chapterVerses.at(-1)?.verseNumber ?? 0;
  const endVerse = wholeChapter
    ? maximumVerse
    : match[4] === undefined
      ? startVerse
      : Number(match[4]);
  if (endVerse < startVerse) {
    throw new BibleRootReferenceError(
      "reversed-range",
      "The ending verse must not precede the starting verse.",
    );
  }
  if (
    !Number.isSafeInteger(startVerse)
    || !Number.isSafeInteger(endVerse)
    || startVerse < 1
    || endVerse > maximumVerse
  ) {
    throw new BibleRootReferenceError(
      "invalid-verse",
      `${book.displayName} ${chapterNumber} does not contain the requested verse.`,
    );
  }

  const normalizedReference = wholeChapter
    ? `${book.displayName} ${chapterNumber}`
    : startVerse === endVerse
      ? `${book.displayName} ${chapterNumber}:${startVerse}`
      : `${book.displayName} ${chapterNumber}:${startVerse}-${endVerse}`;
  const chapterToken = String(chapterNumber).padStart(3, "0");
  const verseToken = String(startVerse).padStart(3, "0");
  const endToken = String(endVerse).padStart(3, "0");
  const passageId = wholeChapter
    ? `br-passage-${book.machineCode}-${chapterToken}`
    : startVerse === endVerse
      ? `br-passage-${book.machineCode}-${chapterToken}-${verseToken}`
      : `br-passage-${book.machineCode}-${chapterToken}-${verseToken}-${endToken}`;

  return {
    book,
    chapterNumber,
    startVerse,
    endVerse,
    wholeChapter,
    normalizedReference,
    passageId,
    canonicalReferenceIds: chapterVerses
      .filter((verse) =>
        verse.verseNumber >= startVerse && verse.verseNumber <= endVerse)
      .map((verse) => verse.canonicalReferenceId),
  };
}
