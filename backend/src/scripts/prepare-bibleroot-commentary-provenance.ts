import { inflateRawSync, unzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadBibleRootFoundation } from "../bibleroot/foundation.js";
import {
  COMMENTARY_DATA_DIRECTORY,
  COMMENTARY_DATASET_ID,
  COMMENTARY_DATASET_VERSION,
  COMMENTARY_REFERENCES,
  COMMENTARY_WORK_IDS,
  gitBlob,
  sha256,
  type CommentaryManifest,
  type CommentaryRightsMetadata,
  type CommentarySourceArtifact,
  type CommentarySourceMetadata,
  type NormalizedCommentarySection,
  type NormalizedCommentaryStatement,
  type NormalizedCommentaryWork,
} from "../bibleroot/commentary-provenance.js";

interface ZipEntry { name: string; bytes: Buffer }

export function extractZip(bytes: Buffer): Map<string, ZipEntry> {
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

function requiredEntry(entries: Map<string, ZipEntry>, name: string): Buffer {
  const entry = entries.get(name);
  if (!entry) throw new Error(`Required commentary archive entry is missing: ${name}`);
  return entry.bytes;
}

function decodeXml(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_match, value: string) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&#([0-9]+);/g, (_match, value: string) => String.fromCodePoint(Number.parseInt(value, 10)))
    .replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", "\"").replaceAll("&apos;", "'");
}

function textFromMarkup(markup: string): string {
  return decodeXml(markup
    .replace(/<title\b[^>]*>/gi, "\n")
    .replace(/<\/title>/gi, "\n")
    .replace(/<div\b[^>]*(?:type="x-p"|type="introduction")[^>]*\/>/gi, "\n")
    .replace(/<lb\b[^>]*\/>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function headingsFromMarkup(markup: string): string[] {
  return [...markup.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
    .map((match) => textFromMarkup(match[1] ?? ""))
    .filter(Boolean);
}

const abbreviation = /(?:\b(?:Mr|Mrs|Ms|Dr|St|Rev|vs|etc|e\.g|i\.e|A|R|J|Ge|Psa|Joh|Eccl)|\bb\. c)\.$/i;

export function segmentStatements(text: string): Array<{ startOffset: number; endOffset: number; exactText: string }> {
  const segments: Array<{ startOffset: number; endOffset: number; exactText: string }> = [];
  let start = 0;
  const add = (rawEnd: number) => {
    let left = start;
    let right = rawEnd;
    while (left < right && /\s/u.test(text[left]!)) left += 1;
    while (right > left && /\s/u.test(text[right - 1]!)) right -= 1;
    if (right > left) segments.push({ startOffset: left, endOffset: right, exactText: text.slice(left, right) });
    start = rawEnd;
  };
  for (let index = 0; index < text.length; index += 1) {
    if (!/[.!?]/u.test(text[index]!)) continue;
    let end = index + 1;
    while (end < text.length && /["'’”)]/u.test(text[end]!)) end += 1;
    if (abbreviation.test(text.slice(Math.max(start, index - 12), index + 1))) continue;
    let next = end;
    while (next < text.length && /\s/u.test(text[next]!)) next += 1;
    if (next >= text.length || /[\p{Lu}\p{N}"“']/u.test(text[next]!)) { add(end); index = end - 1; }
  }
  add(text.length);
  return segments;
}

interface IndexSlice { entryIndex: number; blockNumber: number; uncompressedStart: number; byteLength: number; markup: string }

function readSlices(entries: Map<string, ZipEntry>, artifact: CommentarySourceArtifact, testament: "ot" | "nt"): IndexSlice[] {
  const prefix = artifact.dataDirectory.replace(/\/$/, "");
  const blockIndex = requiredEntry(entries, `${prefix}/${testament}.bzs`);
  const verseIndex = requiredEntry(entries, `${prefix}/${testament}.bzv`);
  const compressedData = requiredEntry(entries, `${prefix}/${testament}.bzz`);
  if (blockIndex.byteLength % 12 !== 0 || verseIndex.byteLength % 12 !== 0) throw new Error(`Invalid zCom4 index width: ${artifact.filename} ${testament}.`);
  const blockCache = new Map<number, Buffer>();
  const block = (blockNumber: number) => {
    const cached = blockCache.get(blockNumber);
    if (cached) return cached;
    const offset = blockNumber * 12;
    if (offset + 12 > blockIndex.byteLength) throw new Error(`zCom4 block index is out of range: ${artifact.filename}.`);
    const compressedStart = blockIndex.readUInt32LE(offset);
    const compressedLength = blockIndex.readUInt32LE(offset + 4);
    const expectedLength = blockIndex.readUInt32LE(offset + 8);
    const decoded = unzipSync(compressedData.subarray(compressedStart, compressedStart + compressedLength));
    if (decoded.byteLength !== expectedLength) throw new Error(`zCom4 block length mismatch: ${artifact.filename}.`);
    blockCache.set(blockNumber, decoded);
    return decoded;
  };
  const slices: IndexSlice[] = [];
  for (let offset = 0; offset < verseIndex.byteLength; offset += 12) {
    const blockNumber = verseIndex.readUInt32LE(offset);
    const uncompressedStart = verseIndex.readUInt32LE(offset + 4);
    const byteLength = verseIndex.readUInt32LE(offset + 8);
    const bytes = byteLength === 0 ? Buffer.alloc(0) : block(blockNumber).subarray(uncompressedStart, uncompressedStart + byteLength);
    if (bytes.byteLength !== byteLength) throw new Error(`zCom4 verse slice length mismatch: ${artifact.filename}.`);
    slices.push({ entryIndex: offset / 12, blockNumber, uncompressedStart, byteLength, markup: bytes.toString("utf8") });
  }
  return slices;
}

const targets = [
  { reference: "Genesis 1", testament: "ot" as const, osisBook: "Gen", bookCode: "gen", chapter: 1, verseCount: 31 },
  { reference: "Psalm 23", testament: "ot" as const, osisBook: "Ps", bookCode: "ps", chapter: 23, verseCount: 6 },
  { reference: "Ecclesiastes 3", testament: "ot" as const, osisBook: "Eccl", bookCode: "eccl", chapter: 3, verseCount: 22 },
  { reference: "John 1", testament: "nt" as const, osisBook: "John", bookCode: "john", chapter: 1, verseCount: 51 },
];

function groupsForTarget(slices: IndexSlice[], osisBook: string, chapter: number, verseCount: number) {
  const chapterPattern = new RegExp(`<chapter\\b[^>]*\\bosisID="${osisBook}\\.${chapter}"`);
  const markerIndex = slices.findIndex((slice) => chapterPattern.test(slice.markup));
  if (markerIndex < 0) throw new Error(`Commentary chapter marker is missing: ${osisBook}.${chapter}.`);
  const verseSlices = slices.slice(markerIndex + 1, markerIndex + 1 + verseCount);
  if (verseSlices.length !== verseCount) throw new Error(`Commentary chapter index is incomplete: ${osisBook}.${chapter}.`);
  const groups: Array<{ startVerse: number; endVerse: number; slice: IndexSlice }> = [];
  verseSlices.forEach((slice, index) => {
    const previous = groups.at(-1);
    if (previous && previous.slice.blockNumber === slice.blockNumber && previous.slice.uncompressedStart === slice.uncompressedStart && previous.slice.byteLength === slice.byteLength) previous.endVerse = index + 1;
    else groups.push({ startVerse: index + 1, endVerse: index + 1, slice });
  });
  return { markerIndex, groups };
}

function gapRanges(verses: number[]): Array<{ start: number; end: number }> {
  const result: Array<{ start: number; end: number }> = [];
  for (const verse of verses) {
    const previous = result.at(-1);
    if (previous && previous.end + 1 === verse) previous.end = verse;
    else result.push({ start: verse, end: verse });
  }
  return result;
}

async function prepare(): Promise<void> {
  const [sourceMetadata, rightsMetadata, foundation] = await Promise.all([
    readFile(path.join(COMMENTARY_DATA_DIRECTORY, "source-metadata.json"), "utf8").then((value) => JSON.parse(value) as CommentarySourceMetadata),
    readFile(path.join(COMMENTARY_DATA_DIRECTORY, "rights-metadata.json"), "utf8").then((value) => JSON.parse(value) as CommentaryRightsMetadata),
    loadBibleRootFoundation(),
  ]);
  const foundationVerseByKey = new Map(foundation.verses.map((verse) => [`${verse.bookCode}:${verse.chapterNumber}:${verse.verseNumber}`, verse]));
  const works: NormalizedCommentaryWork[] = [];

  for (const artifact of sourceMetadata.artifacts) {
    const rawBytes = await readFile(path.join(COMMENTARY_DATA_DIRECTORY, "raw", artifact.filename));
    if (rawBytes.byteLength !== artifact.byteLength || sha256(rawBytes) !== artifact.sha256 || gitBlob(rawBytes) !== artifact.gitBlob) throw new Error(`Pinned commentary artifact mismatch: ${artifact.filename}.`);
    const entries = extractZip(rawBytes);
    const configuration = requiredEntry(entries, artifact.configurationEntry).toString("utf8");
    if (!configuration.includes("ModDrv=zCom4") || !configuration.includes("Versification=KJV") || !configuration.includes("DistributionLicense=Public Domain") || !configuration.includes(`Version=${artifact.moduleVersion}`)) throw new Error(`Commentary module configuration mismatch: ${artifact.filename}.`);
    const rights = rightsMetadata.records.find((record) => record.workId === artifact.workId);
    if (!rights || !rights.statement || !rights.attribution || !rights.territorialLimitation) throw new Error(`Commentary rights record is incomplete: ${artifact.workId}.`);
    const slicesByTestament = { ot: readSlices(entries, artifact, "ot"), nt: readSlices(entries, artifact, "nt") };
    const sections: NormalizedCommentarySection[] = [];
    const coverage: NormalizedCommentaryWork["coverage"] = [];
    let sectionOrder = 0;
    for (const target of targets) {
      const { markerIndex, groups } = groupsForTarget(slicesByTestament[target.testament], target.osisBook, target.chapter, target.verseCount);
      const covered = new Set<number>();
      const gapVerses: number[] = [];
      for (const group of groups) {
        if (group.slice.byteLength === 0) {
          for (let verse = group.startVerse; verse <= group.endVerse; verse += 1) gapVerses.push(verse);
          continue;
        }
        const exactText = textFromMarkup(group.slice.markup);
        if (!exactText) throw new Error(`Commentary source slice produced empty text: ${artifact.workId} ${target.reference}.`);
        for (let verse = group.startVerse; verse <= group.endVerse; verse += 1) covered.add(verse);
        const startVerse = foundationVerseByKey.get(`${target.bookCode}:${target.chapter}:${group.startVerse}`);
        const endVerse = foundationVerseByKey.get(`${target.bookCode}:${target.chapter}:${group.endVerse}`);
        if (!startVerse || !endVerse) throw new Error(`Canonical commentary mapping is missing: ${target.reference}.`);
        sectionOrder += 1;
        const rangeCode = `${target.bookCode}-${String(target.chapter).padStart(3, "0")}-${String(group.startVerse).padStart(3, "0")}-${String(group.endVerse).padStart(3, "0")}`;
        const sectionId = `br-commentary-section-${artifact.workCode}-${rangeCode}`;
        const anchorId = `br-commentary-anchor-${artifact.workCode}-${rangeCode}`;
        const headings = headingsFromMarkup(group.slice.markup);
        const anchorType = group.startVerse === 1 && group.endVerse === target.verseCount ? "chapter" : group.startVerse === group.endVerse ? "canonical-verse" : "canonical-verse-range";
        const normalizedStartReference = `${startVerse.bookName} ${target.chapter}:${group.startVerse}`;
        const normalizedEndReference = `${endVerse.bookName} ${target.chapter}:${group.endVerse}`;
        const sourceLocator = `${artifact.filename}#${artifact.dataDirectory}/${target.testament}.bzv:entry-${group.slice.entryIndex}; block=${group.slice.blockNumber}; uncompressed-offset=${group.slice.uncompressedStart}; byte-length=${group.slice.byteLength}; KJV=${normalizedStartReference}${group.startVerse === group.endVerse ? "" : `-${group.endVerse}`}`;
        const statements: NormalizedCommentaryStatement[] = segmentStatements(exactText).map((statement, index) => ({
          statementId: `br-commentary-statement-${artifact.workCode}-${rangeCode}-${String(index + 1).padStart(4, "0")}`,
          parentSectionId: sectionId,
          anchorId,
          workId: artifact.workId,
          publicationId: artifact.publicationId,
          artifactId: artifact.artifactId,
          rightsRef: rights.rightsId,
          datasetId: COMMENTARY_DATASET_ID,
          datasetVersion: COMMENTARY_DATASET_VERSION,
          statementOrder: index + 1,
          ...statement,
          contentHash: sha256(statement.exactText),
        }));
        sections.push({
          sectionId,
          datasetId: COMMENTARY_DATASET_ID,
          datasetVersion: COMMENTARY_DATASET_VERSION,
          workId: artifact.workId,
          publicationId: artifact.publicationId,
          artifactId: artifact.artifactId,
          rightsRef: rights.rightsId,
          sectionOrder,
          passageReference: target.reference,
          headings,
          heading: headings.at(-1) ?? null,
          exactText,
          sourceMarkup: group.slice.markup,
          sourceLocator,
          sourceTextHash: sha256(exactText),
          sourceMarkupHash: sha256(group.slice.markup),
          anchor: {
            anchorId,
            anchorType,
            canonicalStartReferenceId: startVerse.canonicalReferenceId,
            canonicalEndReferenceId: endVerse.canonicalReferenceId,
            normalizedStartReference,
            normalizedEndReference,
            sourceSuppliedMarker: headings.at(-1) ?? null,
            mappingStatus: group.startVerse === group.endVerse ? "source-module-verse-index" : "source-module-shared-slice",
            mappingNote: group.startVerse === group.endVerse
              ? "The CrossWire KJV verse index maps this exact source slice to the stated verse; no lexical alignment is implied."
              : `The CrossWire KJV verse index maps one identical source slice across ${normalizedStartReference} through ${normalizedEndReference}; the range is retained without narrower attribution.`,
          },
          statements,
        });
      }
      coverage.push({
        reference: target.reference,
        canonicalVerseCount: target.verseCount,
        coveredCanonicalReferenceIds: [...covered].sort((a, b) => a - b).map((verse) => foundationVerseByKey.get(`${target.bookCode}:${target.chapter}:${verse}`)!.canonicalReferenceId),
        gaps: gapRanges(gapVerses).map((gap) => ({
          normalizedStartReference: `${target.reference}:${gap.start}`,
          normalizedEndReference: `${target.reference}:${gap.end}`,
          note: "The accepted source module has a zero-length index entry for this canonical position; no fallback or inferred commentary was added.",
        })),
      });
      if (markerIndex < 0) throw new Error(`Unreachable commentary marker failure: ${target.reference}.`);
    }
    const normalized: NormalizedCommentaryWork = {
      schemaVersion: "1.0.0",
      datasetId: COMMENTARY_DATASET_ID,
      datasetVersion: COMMENTARY_DATASET_VERSION,
      work: artifact,
      expectedCounts: {
        passages: 4,
        sections: sections.length,
        statements: sections.reduce((sum, section) => sum + section.statements.length, 0),
        anchors: sections.length,
        coverageGaps: coverage.reduce((sum, item) => sum + item.gaps.length, 0),
      },
      coverage,
      sections,
    };
    await writeFile(path.join(COMMENTARY_DATA_DIRECTORY, artifact.normalizedFile), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    works.push(normalized);
  }

  for (const document of sourceMetadata.documents) {
    const bytes = await readFile(path.join(COMMENTARY_DATA_DIRECTORY, "source-docs", document.filename));
    if (bytes.byteLength !== document.byteLength || sha256(bytes) !== document.sha256 || gitBlob(bytes) !== document.gitBlob) throw new Error(`Pinned commentary source document mismatch: ${document.filename}.`);
  }
  const identityFiles = [
    ...sourceMetadata.artifacts.map((artifact) => `raw/${artifact.filename}`),
    ...sourceMetadata.documents.map((document) => `source-docs/${document.filename}`),
    "source-metadata.json",
    "rights-metadata.json",
    ...sourceMetadata.artifacts.map((artifact) => artifact.normalizedFile),
  ];
  const files: CommentaryManifest["files"] = {};
  for (const filename of identityFiles) {
    const bytes = await readFile(path.join(COMMENTARY_DATA_DIRECTORY, filename));
    const protectedArtifact = sourceMetadata.artifacts.find((artifact) => `raw/${artifact.filename}` === filename);
    const protectedDocument = sourceMetadata.documents.find((document) => `source-docs/${document.filename}` === filename);
    files[filename] = { byteLength: bytes.byteLength, sha256: sha256(bytes), ...((protectedArtifact || protectedDocument) ? { gitBlob: gitBlob(bytes) } : {}) };
  }
  const countsByWorkAndPassage: CommentaryManifest["countsByWorkAndPassage"] = {};
  for (const work of works) {
    countsByWorkAndPassage[work.work.workId] = {};
    for (const item of work.coverage) {
      const passageSections = work.sections.filter((section) => section.passageReference === item.reference);
      countsByWorkAndPassage[work.work.workId]![item.reference] = {
        sections: passageSections.length,
        statements: passageSections.reduce((sum, section) => sum + section.statements.length, 0),
        coveredVerses: item.coveredCanonicalReferenceIds.length,
        gaps: item.gaps.length,
      };
    }
  }
  const manifest: CommentaryManifest = {
    schemaVersion: "1.0.0",
    datasetId: COMMENTARY_DATASET_ID,
    version: COMMENTARY_DATASET_VERSION,
    status: "accepted",
    foundationDatasetId: "bibleroot-foundation-v1",
    acceptedWorkIds: [...COMMENTARY_WORK_IDS],
    rejectedCandidates: ["John Gill's Exposition of the Entire Bible"],
    supportedReferences: [...COMMENTARY_REFERENCES],
    expectedCounts: {
      works: works.length,
      passages: 4,
      canonicalVerses: 110,
      sourceArtifacts: sourceMetadata.artifacts.length,
      rightsRecords: rightsMetadata.records.length,
      sections: works.reduce((sum, work) => sum + work.expectedCounts.sections, 0),
      statements: works.reduce((sum, work) => sum + work.expectedCounts.statements, 0),
      anchors: works.reduce((sum, work) => sum + work.expectedCounts.anchors, 0),
      coverageGaps: works.reduce((sum, work) => sum + work.expectedCounts.coverageGaps, 0),
    },
    countsByWorkAndPassage,
    files,
  };
  await writeFile(path.join(COMMENTARY_DATA_DIRECTORY, "dataset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(COMMENTARY_DATA_DIRECTORY, "hashes.json"), `${JSON.stringify({ schemaVersion: "1.0.0", datasetId: COMMENTARY_DATASET_ID, version: COMMENTARY_DATASET_VERSION, files }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ datasetId: COMMENTARY_DATASET_ID, ...manifest.expectedCounts, countsByWorkAndPassage }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  prepare().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}

export { prepare, textFromMarkup };
