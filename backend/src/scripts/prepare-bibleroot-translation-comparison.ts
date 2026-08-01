import { inflateRawSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadBibleRootFoundation } from "../bibleroot/foundation.js";
import {
  TRANSLATION_COMPARISON_DATA_DIRECTORY,
  TRANSLATION_COMPARISON_DATASET_ID,
  TRANSLATION_COMPARISON_DATASET_VERSION,
  TRANSLATION_COMPARISON_EDITION_IDS,
  TRANSLATION_COMPARISON_REFERENCES,
  sha256,
  type NormalizedTranslationEdition,
  type NormalizedTranslationVerse,
  type TranslationRightsMetadata,
  type TranslationSourceMetadata,
} from "../bibleroot/translation-comparison.js";

interface ZipEntry { name: string; bytes: Buffer }

function extractZip(bytes: Buffer): Map<string, ZipEntry> {
  let eocd = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (bytes.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory record is missing.");
  const count = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP central directory.");
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid ZIP local header: ${name}`);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(start, start + compressedSize);
    const extracted = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : undefined;
    if (!extracted || extracted.byteLength !== uncompressedSize) throw new Error(`Unsupported or invalid ZIP entry: ${name}`);
    entries.set(name, { name, bytes: extracted });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function removeUsfmMarkup(input: string): string {
  return input
    .replace(/\\f\s[\s\S]*?\\f\*/g, "")
    .replace(/\\x\s[\s\S]*?\\x\*/g, "")
    .replace(/\\\+?w\s+([^|\\]+?)(?:\|[^\\]*?)?\\\+?w\*/g, "$1")
    .replace(/\\\+?(?:add|bd|bdit|bk|dc|em|it|k|nd|ord|pn|qt|sc|sig|sls|tl|wj)\s+([\s\S]*?)\\\+?\w+\*/g, "$1")
    .replace(/\\\+?[a-z][a-z0-9-]*\*?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseChapter(usfm: string, targetChapter: number): Map<number, string> {
  const verses = new Map<number, string>();
  let chapter = 0;
  let currentVerse: number | undefined;
  for (const rawLine of usfm.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    const chapterMatch = /^\\c\s+(\d+)/.exec(line);
    if (chapterMatch) { chapter = Number(chapterMatch[1]); currentVerse = undefined; continue; }
    const verseMatch = /^\\v\s+(\d+)(?:[-a-z]*)\s*(.*)$/i.exec(line);
    if (verseMatch) {
      currentVerse = chapter === targetChapter ? Number(verseMatch[1]) : undefined;
      if (currentVerse !== undefined) verses.set(currentVerse, removeUsfmMarkup(verseMatch[2] ?? ""));
      continue;
    }
    if (chapter === targetChapter && currentVerse !== undefined && line && !/^\\(?:c|s|ms|mt|toc|id|h)\b/.test(line)) {
      const addition = removeUsfmMarkup(line);
      if (addition) verses.set(currentVerse, `${verses.get(currentVerse) ?? ""} ${addition}`.replace(/\s+/g, " ").trim());
    }
  }
  return verses;
}

function normalizedFilename(editionId: string): string {
  if (editionId.includes("asv")) return "normalized/asv.json";
  if (editionId.includes("webp")) return "normalized/web.json";
  return "normalized/ylt.json";
}

function zipBookEntry(entries: Map<string, ZipEntry>, code: string): ZipEntry {
  const entry = [...entries.values()].find((candidate) => new RegExp(`^[0-9]+-${code}.*\\.usfm$`, "i").test(candidate.name));
  if (!entry) throw new Error(`USFM ZIP does not contain ${code}.`);
  return entry;
}

async function prepare(): Promise<void> {
  const sourceMetadata = JSON.parse(await readFile(path.join(TRANSLATION_COMPARISON_DATA_DIRECTORY, "source-metadata.json"), "utf8")) as TranslationSourceMetadata;
  const rightsMetadata = JSON.parse(await readFile(path.join(TRANSLATION_COMPARISON_DATA_DIRECTORY, "rights-metadata.json"), "utf8")) as TranslationRightsMetadata;
  const foundation = await loadBibleRootFoundation();
  const foundationVerseByKey = new Map(foundation.verses.map((verse) => [`${verse.bookCode}:${verse.chapterNumber}:${verse.verseNumber}`, verse]));
  const targets = [
    { entryCode: "GEN", canonicalCode: "gen", chapter: 1, count: 31 },
    { entryCode: "PSA", canonicalCode: "ps", chapter: 23, count: 6 },
    { entryCode: "ECC", canonicalCode: "eccl", chapter: 3, count: 22 },
    { entryCode: "JHN", canonicalCode: "john", chapter: 1, count: 51 },
  ];
  const normalizedFiles: string[] = [];
  for (const source of sourceMetadata.artifacts) {
    const rawPath = path.join(TRANSLATION_COMPARISON_DATA_DIRECTORY, "raw", source.filename);
    const rawBytes = await readFile(rawPath);
    if (rawBytes.byteLength !== source.byteLength || sha256(rawBytes) !== source.sha256) throw new Error(`Pinned raw artifact mismatch: ${source.filename}`);
    const entries = extractZip(rawBytes);
    const rights = rightsMetadata.records.find((record) => record.editionId === source.editionId);
    if (!rights) throw new Error(`Rights record missing: ${source.editionId}`);
    const verses: NormalizedTranslationVerse[] = [];
    for (const target of targets) {
      const parsed = parseChapter(zipBookEntry(entries, target.entryCode).bytes.toString("utf8"), target.chapter);
      if (parsed.size !== target.count) throw new Error(`${source.editionId} ${target.entryCode} ${target.chapter} produced ${parsed.size}, expected ${target.count}.`);
      for (let verseNumber = 1; verseNumber <= target.count; verseNumber += 1) {
        const foundationVerse = foundationVerseByKey.get(`${target.canonicalCode}:${target.chapter}:${verseNumber}`);
        const exactText = parsed.get(verseNumber);
        if (!foundationVerse || !exactText) throw new Error(`Canonical mapping missing: ${target.entryCode} ${target.chapter}:${verseNumber}.`);
        const editionTextId = `br-text-${source.editionId.replace(/^br-edition-/, "")}-${target.canonicalCode}-${String(target.chapter).padStart(3, "0")}-${String(verseNumber).padStart(3, "0")}`;
        verses.push({
          canonicalReferenceId: foundationVerse.canonicalReferenceId,
          bookId: foundationVerse.bookId,
          bookCode: target.canonicalCode,
          bookName: foundationVerse.bookName,
          chapterNumber: target.chapter,
          verseNumber,
          editionId: source.editionId,
          editionTextId,
          exactText,
          normalizedComparisonText: exactText.normalize("NFKC").replace(/\s+/g, " ").trim(),
          sourceArtifactId: source.artifactId,
          datasetId: TRANSLATION_COMPARISON_DATASET_ID,
          datasetVersion: TRANSLATION_COMPARISON_DATASET_VERSION,
          provenanceRef: source.publicationId,
          rightsRef: rights.rightsId,
          contentHash: sha256(`${foundationVerse.canonicalReferenceId}\t${source.editionId}\t${exactText}`),
        });
      }
    }
    const normalizedTextSha256 = sha256(verses.map((verse) => `${verse.editionTextId}\t${verse.exactText}`).join("\n"));
    const edition: NormalizedTranslationEdition = {
      schemaVersion: "1.0.0",
      datasetId: TRANSLATION_COMPARISON_DATASET_ID,
      datasetVersion: TRANSLATION_COMPARISON_DATASET_VERSION,
      edition: {
        editionId: source.editionId,
        displayTitle: source.title,
        abbreviation: source.abbreviation,
        language: "en",
        translationName: source.translationName,
        editionDescription: source.publicationOrReleaseIdentity,
        publisherOrDistributor: source.provider,
        publicationOrReleaseDate: source.publicationOrReleaseDate,
        publicationOrReleaseIdentity: source.publicationOrReleaseIdentity,
        rightsStatus: rights.status,
        territorialLimitation: rights.territorialLimitation,
        publicationId: source.publicationId,
        artifactId: source.artifactId,
        normalizedTextSha256,
        provenanceNotes: source.normalizationNotes,
      },
      expectedCounts: { books: 4, populatedChapters: 4, verses: 110 },
      verses,
    };
    const filename = normalizedFilename(source.editionId);
    await writeFile(path.join(TRANSLATION_COMPARISON_DATA_DIRECTORY, filename), `${JSON.stringify(edition, null, 2)}\n`, "utf8");
    normalizedFiles.push(filename);
  }

  const identityFiles = [
    ...sourceMetadata.artifacts.map((artifact) => `raw/${artifact.filename}`),
    "source-docs/details-eng-asv.html",
    "source-docs/details-engwebp.html",
    "source-docs/details-engylt.html",
    "source-docs/ebible-public-domain.html",
    "source-metadata.json",
    "rights-metadata.json",
    ...normalizedFiles,
  ];
  const files: Record<string, { byteLength: number; sha256: string; gitBlob?: string }> = {};
  for (const filename of identityFiles) {
    const bytes = await readFile(path.join(TRANSLATION_COMPARISON_DATA_DIRECTORY, filename));
    const source = sourceMetadata.artifacts.find((artifact) => `raw/${artifact.filename}` === filename);
    files[filename] = { byteLength: bytes.byteLength, sha256: sha256(bytes), ...(source ? { gitBlob: source.gitBlob } : {}) };
  }
  const manifest = {
    schemaVersion: "1.0.0",
    datasetId: TRANSLATION_COMPARISON_DATASET_ID,
    version: TRANSLATION_COMPARISON_DATASET_VERSION,
    status: "accepted",
    foundationDatasetId: "bibleroot-foundation-v1",
    editionIds: [...TRANSLATION_COMPARISON_EDITION_IDS],
    newEditionIds: sourceMetadata.artifacts.map((artifact) => artifact.editionId),
    supportedReferences: [...TRANSLATION_COMPARISON_REFERENCES],
    expectedCounts: { editions: 4, newEditions: 3, canonicalVerses: 110, displayPositions: 440, newVerseTexts: 330, sourceArtifacts: 3, rightsRecords: 3 },
    files,
  };
  await writeFile(path.join(TRANSLATION_COMPARISON_DATA_DIRECTORY, "dataset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const hashes = { schemaVersion: "1.0.0", datasetId: TRANSLATION_COMPARISON_DATASET_ID, version: TRANSLATION_COMPARISON_DATASET_VERSION, files };
  await writeFile(path.join(TRANSLATION_COMPARISON_DATA_DIRECTORY, "hashes.json"), `${JSON.stringify(hashes, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ datasetId: TRANSLATION_COMPARISON_DATASET_ID, editions: 3, verses: 330, files: identityFiles.length }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  prepare().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}

export { extractZip, parseChapter, prepare, removeUsfmMarkup };
