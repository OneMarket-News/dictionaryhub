import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TRANSLATION_COMPARISON_DATASET_ID = "bibleroot-translation-comparison-v1";
export const TRANSLATION_COMPARISON_DATASET_VERSION = "1.0.0";
export const TRANSLATION_COMPARISON_EDITION_IDS = [
  "br-edition-kjv-pg10-2024",
  "br-edition-asv-1901-ebible-20260611",
  "br-edition-webp-2020-ebible-20260724",
  "br-edition-ylt-1898-ebible-20191020",
] as const;
export const TRANSLATION_COMPARISON_REFERENCES = [
  "Genesis 1",
  "Psalm 23",
  "Ecclesiastes 3",
  "John 1",
] as const;

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const TRANSLATION_COMPARISON_DATA_DIRECTORY = path.resolve(
  currentDirectory,
  "../../data/bibleroot-translation-comparison-v1",
);

export interface TranslationSourceArtifact {
  editionId: string;
  sourceId: string;
  publicationId: string;
  artifactId: string;
  title: string;
  abbreviation: string;
  translationName: string;
  publicationOrReleaseIdentity: string;
  publicationOrReleaseDate: string;
  sourceRevisionDate: string;
  provider: string;
  stableIdentifier: string;
  detailsUrl: string;
  sourceUrl: string;
  filename: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  gitBlob: string;
  normalizedFile: string;
  normalizationNotes: string;
}

export interface TranslationSourceMetadata {
  schemaVersion: string;
  datasetId: string;
  datasetVersion: string;
  retrievedAt: string;
  provider: string;
  artifacts: TranslationSourceArtifact[];
}

export interface TranslationRightsRecord {
  editionId: string;
  rightsId: string;
  status: string;
  territorialLimitation: string;
  statement: string;
  evidenceDocuments: string[];
}

export interface TranslationRightsMetadata {
  schemaVersion: string;
  datasetId: string;
  rightsEvidenceUrl: string;
  records: TranslationRightsRecord[];
}

export interface NormalizedTranslationVerse {
  canonicalReferenceId: string;
  bookId: string;
  bookCode: string;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  editionId: string;
  editionTextId: string;
  exactText: string;
  normalizedComparisonText: string;
  sourceArtifactId: string;
  datasetId: string;
  datasetVersion: string;
  provenanceRef: string;
  rightsRef: string;
  contentHash: string;
}

export interface NormalizedTranslationEdition {
  schemaVersion: string;
  datasetId: string;
  datasetVersion: string;
  edition: {
    editionId: string;
    displayTitle: string;
    abbreviation: string;
    language: "en";
    translationName: string;
    editionDescription: string;
    publisherOrDistributor: string;
    publicationOrReleaseDate: string;
    publicationOrReleaseIdentity: string;
    rightsStatus: string;
    territorialLimitation: string;
    publicationId: string;
    artifactId: string;
    normalizedTextSha256: string;
    provenanceNotes: string;
  };
  expectedCounts: { books: 4; populatedChapters: 4; verses: 110 };
  verses: NormalizedTranslationVerse[];
}

export interface TranslationComparisonManifest {
  schemaVersion: string;
  datasetId: string;
  version: string;
  status: "accepted";
  foundationDatasetId: string;
  editionIds: string[];
  newEditionIds: string[];
  supportedReferences: string[];
  expectedCounts: {
    editions: 4;
    newEditions: 3;
    canonicalVerses: 110;
    displayPositions: 440;
    newVerseTexts: 330;
    sourceArtifacts: 3;
    rightsRecords: 3;
  };
  files: Record<string, { byteLength: number; sha256: string; gitBlob?: string }>;
}

export interface TranslationComparisonDataset {
  manifest: TranslationComparisonManifest;
  sourceMetadata: TranslationSourceMetadata;
  rightsMetadata: TranslationRightsMetadata;
  editions: NormalizedTranslationEdition[];
}

export function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(path.join(TRANSLATION_COMPARISON_DATA_DIRECTORY, filename), "utf8")) as T;
}

export async function loadTranslationComparisonDataset(): Promise<TranslationComparisonDataset> {
  const [manifest, sourceMetadata, rightsMetadata] = await Promise.all([
    readJson<TranslationComparisonManifest>("dataset-manifest.json"),
    readJson<TranslationSourceMetadata>("source-metadata.json"),
    readJson<TranslationRightsMetadata>("rights-metadata.json"),
  ]);
  const editions = await Promise.all(
    sourceMetadata.artifacts.map((artifact) => readJson<NormalizedTranslationEdition>(artifact.normalizedFile)),
  );
  return { manifest, sourceMetadata, rightsMetadata, editions };
}

export async function validateTranslationComparisonDataset(
  supplied?: TranslationComparisonDataset,
): Promise<TranslationComparisonDataset> {
  const dataset = supplied ?? await loadTranslationComparisonDataset();
  const { manifest, sourceMetadata, rightsMetadata, editions } = dataset;
  assert(manifest.datasetId === TRANSLATION_COMPARISON_DATASET_ID, "Translation comparison dataset ID mismatch.");
  assert(manifest.version === TRANSLATION_COMPARISON_DATASET_VERSION, "Translation comparison version mismatch.");
  assert(manifest.status === "accepted", "Translation comparison dataset is not accepted.");
  assert(sourceMetadata.datasetId === manifest.datasetId, "Translation source metadata dataset mismatch.");
  assert(rightsMetadata.datasetId === manifest.datasetId, "Translation rights metadata dataset mismatch.");
  assert(sourceMetadata.artifacts.length === 3, "Exactly three new translation source artifacts are required.");
  assert(rightsMetadata.records.length === 3, "Exactly three translation rights records are required.");
  assert(editions.length === 3, "Exactly three normalized new editions are required.");
  assert(JSON.stringify(manifest.editionIds) === JSON.stringify(TRANSLATION_COMPARISON_EDITION_IDS), "Comparison edition order mismatch.");
  assert(JSON.stringify(manifest.supportedReferences) === JSON.stringify(TRANSLATION_COMPARISON_REFERENCES), "Comparison reference order mismatch.");

  for (const [filename, identity] of Object.entries(manifest.files)) {
    const bytes = await readFile(path.join(TRANSLATION_COMPARISON_DATA_DIRECTORY, filename));
    assert(bytes.byteLength === identity.byteLength, `Translation file byte length mismatch: ${filename}`);
    assert(sha256(bytes) === identity.sha256, `Translation file checksum mismatch: ${filename}`);
  }

  const rightsByEdition = new Map(rightsMetadata.records.map((record) => [record.editionId, record]));
  const canonicalIds = new Set<string>();
  for (const edition of editions) {
    const source = sourceMetadata.artifacts.find((artifact) => artifact.editionId === edition.edition.editionId);
    const rights = rightsByEdition.get(edition.edition.editionId);
    assert(source, `Missing source metadata for ${edition.edition.editionId}.`);
    assert(rights, `Missing rights metadata for ${edition.edition.editionId}.`);
    assert(edition.datasetId === manifest.datasetId && edition.datasetVersion === manifest.version, "Normalized edition dataset identity mismatch.");
    assert(edition.verses.length === 110, `Normalized verse count mismatch: ${edition.edition.editionId}.`);
    assert(new Set(edition.verses.map((verse) => verse.canonicalReferenceId)).size === 110, `Duplicate canonical mapping: ${edition.edition.editionId}.`);
    assert(new Set(edition.verses.map((verse) => `${verse.bookCode}:${verse.chapterNumber}`)).size === 4, `Chapter count mismatch: ${edition.edition.editionId}.`);
    const normalizedMaterial = edition.verses.map((verse) => `${verse.editionTextId}\t${verse.exactText}`).join("\n");
    assert(sha256(normalizedMaterial) === edition.edition.normalizedTextSha256, `Normalized text identity mismatch: ${edition.edition.editionId}.`);
    for (const verse of edition.verses) {
      assert(verse.editionId === edition.edition.editionId, "Verse edition mismatch.");
      assert(verse.datasetId === manifest.datasetId && verse.datasetVersion === manifest.version, "Verse dataset mismatch.");
      assert(verse.sourceArtifactId === source.artifactId, "Verse source artifact mismatch.");
      assert(verse.rightsRef === rights.rightsId, "Verse rights reference mismatch.");
      assert(verse.contentHash === sha256(`${verse.canonicalReferenceId}\t${verse.editionId}\t${verse.exactText}`), "Verse content hash mismatch.");
      canonicalIds.add(verse.canonicalReferenceId);
    }
  }
  assert(canonicalIds.size === 110, "New editions do not share exactly 110 canonical verse IDs.");
  return dataset;
}

export function mechanicalTextComparison(texts: Record<string, string | null>) {
  const entries = Object.entries(texts);
  const present = entries.filter((entry): entry is [string, string] => entry[1] !== null);
  const exactEqual = present.length > 0 && present.every(([, text]) => text === present[0]![1]);
  const whitespace = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();
  const letters = (value: string) => whitespace(value).replace(/[^\p{L}\p{N}]+/gu, "").toLocaleLowerCase("en");
  const whitespaceEqual = present.length > 0 && present.every(([, text]) => whitespace(text) === whitespace(present[0]![1]));
  const punctuationOnly = !exactEqual && present.length > 0 && present.every(([, text]) => letters(text) === letters(present[0]![1]));
  const tokenPattern = /[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*|[^\s]/gu;
  return {
    exactEqual,
    whitespaceOnly: !exactEqual && whitespaceEqual,
    punctuationOnly,
    tokens: Object.fromEntries(entries.map(([editionId, text]) => [
      editionId,
      text === null ? [] : (text.match(tokenPattern) ?? []).map((token, index) => ({ index, text: token })),
    ])),
    disclaimer: "Highlights show textual differences only. They do not determine meaning, accuracy, doctrine, or translation quality.",
  };
}
