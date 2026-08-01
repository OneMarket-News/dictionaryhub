import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COMMENTARY_DATASET_ID = "bibleroot-commentary-interpretation-provenance-v1";
export const COMMENTARY_DATASET_VERSION = "1.0.0";
export const COMMENTARY_REFERENCES = ["Genesis 1", "Psalm 23", "Ecclesiastes 3", "John 1"] as const;
export const COMMENTARY_WORK_IDS = ["br-commentary-work-mhc-complete", "br-commentary-work-jfb"] as const;
export const COMMENTARY_DISCLAIMER = "These are attributed historical interpretations from named sources. SourceRoot organizes their provenance but does not endorse, reconcile, rank, or determine their theological accuracy.";
export const COMMENTARY_PLACEMENT_NOTICE = "Shared passage placement does not mean the sources agree. Absence is not evidence against a view, and corpus inclusion is not a quality ranking.";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const COMMENTARY_DATA_DIRECTORY = path.resolve(currentDirectory, "../../data/bibleroot-commentary-interpretation-provenance-v1");

export interface CommentarySourceArtifact {
  workId: string;
  workCode: string;
  sourceId: string;
  publicationId: string;
  artifactId: string;
  rightsId: string;
  title: string;
  attribution: string;
  workDateIdentity: string;
  editionIdentity: string;
  description: string;
  provider: string;
  stableIdentifier: string;
  moduleVersion: string;
  moduleVersionDate: string;
  detailsUrl: string;
  sourceUrl: string;
  filename: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  gitBlob: string;
  normalizedFile: string;
  configurationEntry: string;
  dataDirectory: string;
  normalizationNotes: string;
}

export interface CommentarySourceDocument {
  filename: string;
  sourceUrl: string;
  byteLength: number;
  sha256: string;
  gitBlob: string;
}

export interface CommentarySourceMetadata {
  schemaVersion: string;
  datasetId: string;
  datasetVersion: string;
  retrievedAt: string;
  provider: string;
  artifacts: CommentarySourceArtifact[];
  documents: CommentarySourceDocument[];
}

export interface CommentaryRightsRecord {
  workId: string;
  rightsId: string;
  componentType: string;
  status: string;
  licenseName: string;
  licenseUrl: string;
  statement: string;
  attribution: string;
  territorialLimitation: string;
  evidenceDocuments: string[];
}

export interface CommentaryRightsMetadata {
  schemaVersion: string;
  datasetId: string;
  records: CommentaryRightsRecord[];
}

export type CommentaryAnchorType = "canonical-verse" | "canonical-verse-range" | "chapter" | "source-heading-range" | "unresolved";

export interface NormalizedCommentaryStatement {
  statementId: string;
  parentSectionId: string;
  anchorId: string;
  workId: string;
  publicationId: string;
  artifactId: string;
  rightsRef: string;
  datasetId: string;
  datasetVersion: string;
  statementOrder: number;
  startOffset: number;
  endOffset: number;
  exactText: string;
  contentHash: string;
}

export interface NormalizedCommentarySection {
  sectionId: string;
  datasetId: string;
  datasetVersion: string;
  workId: string;
  publicationId: string;
  artifactId: string;
  rightsRef: string;
  sectionOrder: number;
  passageReference: string;
  headings: string[];
  heading: string | null;
  exactText: string;
  sourceMarkup: string;
  sourceLocator: string;
  sourceTextHash: string;
  sourceMarkupHash: string;
  anchor: {
    anchorId: string;
    anchorType: CommentaryAnchorType;
    canonicalStartReferenceId: string | null;
    canonicalEndReferenceId: string | null;
    normalizedStartReference: string | null;
    normalizedEndReference: string | null;
    sourceSuppliedMarker: string | null;
    mappingStatus: string;
    mappingNote: string;
  };
  statements: NormalizedCommentaryStatement[];
}

export interface NormalizedCommentaryWork {
  schemaVersion: string;
  datasetId: string;
  datasetVersion: string;
  work: CommentarySourceArtifact;
  expectedCounts: { passages: number; sections: number; statements: number; anchors: number; coverageGaps: number };
  coverage: Array<{
    reference: string;
    canonicalVerseCount: number;
    coveredCanonicalReferenceIds: string[];
    gaps: Array<{ normalizedStartReference: string; normalizedEndReference: string; note: string }>;
  }>;
  sections: NormalizedCommentarySection[];
}

export interface CommentaryManifest {
  schemaVersion: string;
  datasetId: string;
  version: string;
  status: "accepted";
  foundationDatasetId: string;
  acceptedWorkIds: string[];
  rejectedCandidates: string[];
  supportedReferences: string[];
  expectedCounts: {
    works: number;
    passages: number;
    canonicalVerses: number;
    sourceArtifacts: number;
    rightsRecords: number;
    sections: number;
    statements: number;
    anchors: number;
    coverageGaps: number;
  };
  countsByWorkAndPassage: Record<string, Record<string, { sections: number; statements: number; coveredVerses: number; gaps: number }>>;
  files: Record<string, { byteLength: number; sha256: string; gitBlob?: string }>;
}

export interface CommentaryDataset {
  manifest: CommentaryManifest;
  sourceMetadata: CommentarySourceMetadata;
  rightsMetadata: CommentaryRightsMetadata;
  works: NormalizedCommentaryWork[];
}

export function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

export function gitBlob(value: Uint8Array): string {
  const header = Buffer.from(`blob ${value.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(value).digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(path.join(COMMENTARY_DATA_DIRECTORY, filename), "utf8")) as T;
}

export async function loadCommentaryDataset(): Promise<CommentaryDataset> {
  const [manifest, sourceMetadata, rightsMetadata] = await Promise.all([
    readJson<CommentaryManifest>("dataset-manifest.json"),
    readJson<CommentarySourceMetadata>("source-metadata.json"),
    readJson<CommentaryRightsMetadata>("rights-metadata.json"),
  ]);
  const works = await Promise.all(sourceMetadata.artifacts.map((artifact) => readJson<NormalizedCommentaryWork>(artifact.normalizedFile)));
  return { manifest, sourceMetadata, rightsMetadata, works };
}

export async function validateCommentaryDataset(supplied?: CommentaryDataset): Promise<CommentaryDataset> {
  const dataset = supplied ?? await loadCommentaryDataset();
  const { manifest, sourceMetadata, rightsMetadata, works } = dataset;
  assert(manifest.datasetId === COMMENTARY_DATASET_ID && manifest.version === COMMENTARY_DATASET_VERSION, "Commentary dataset identity mismatch.");
  assert(manifest.status === "accepted", "Commentary dataset is not accepted.");
  assert(sourceMetadata.datasetId === manifest.datasetId && sourceMetadata.datasetVersion === manifest.version, "Commentary source metadata identity mismatch.");
  assert(rightsMetadata.datasetId === manifest.datasetId, "Commentary rights metadata identity mismatch.");
  assert(JSON.stringify(manifest.acceptedWorkIds) === JSON.stringify(COMMENTARY_WORK_IDS), "Commentary work order mismatch.");
  assert(JSON.stringify(manifest.supportedReferences) === JSON.stringify(COMMENTARY_REFERENCES), "Commentary reference order mismatch.");
  assert(works.length === 2 && sourceMetadata.artifacts.length === 2 && rightsMetadata.records.length === 2, "Exactly two accepted commentary works are required.");
  assert(manifest.rejectedCandidates.includes("John Gill's Exposition of the Entire Bible"), "Rejected Gill candidate must remain explicit.");

  for (const [filename, identity] of Object.entries(manifest.files)) {
    const bytes = await readFile(path.join(COMMENTARY_DATA_DIRECTORY, filename));
    assert(bytes.byteLength === identity.byteLength, `Commentary file byte length mismatch: ${filename}`);
    assert(sha256(bytes) === identity.sha256, `Commentary file checksum mismatch: ${filename}`);
    if (identity.gitBlob) assert(gitBlob(bytes) === identity.gitBlob, `Commentary no-filter Git blob mismatch: ${filename}`);
  }

  const rightsByWork = new Map(rightsMetadata.records.map((record) => [record.workId, record]));
  const sectionIds = new Set<string>();
  const statementIds = new Set<string>();
  let sectionCount = 0;
  let statementCount = 0;
  let gapCount = 0;
  for (const normalized of works) {
    const source = sourceMetadata.artifacts.find((artifact) => artifact.workId === normalized.work.workId);
    const rights = rightsByWork.get(normalized.work.workId);
    assert(source && rights, `Commentary source or rights record missing: ${normalized.work.workId}.`);
    assert(normalized.datasetId === manifest.datasetId && normalized.datasetVersion === manifest.version, "Normalized commentary identity mismatch.");
    assert(normalized.sections.length === normalized.expectedCounts.sections, `Commentary section count mismatch: ${normalized.work.workId}.`);
    assert(normalized.coverage.length === 4, `Commentary passage coverage mismatch: ${normalized.work.workId}.`);
    assert(new Set(normalized.coverage.map((item) => item.reference)).size === 4, `Duplicate commentary passage coverage: ${normalized.work.workId}.`);
    gapCount += normalized.coverage.reduce((sum, item) => sum + item.gaps.length, 0);
    for (const section of normalized.sections) {
      assert(!sectionIds.has(section.sectionId), `Duplicate commentary section ID: ${section.sectionId}.`);
      sectionIds.add(section.sectionId);
      assert(section.workId === source.workId && section.publicationId === source.publicationId && section.artifactId === source.artifactId, "Commentary section provenance mismatch.");
      assert(section.rightsRef === rights.rightsId, "Commentary section rights mismatch.");
      assert(section.sourceTextHash === sha256(section.exactText) && section.sourceMarkupHash === sha256(section.sourceMarkup), "Commentary section content hash mismatch.");
      assert(section.anchor.anchorType === "unresolved" || (section.anchor.canonicalStartReferenceId && section.anchor.canonicalEndReferenceId), "Resolved commentary anchor lacks canonical identity.");
      let previousEnd = -1;
      for (const statement of section.statements) {
        assert(!statementIds.has(statement.statementId), `Duplicate commentary statement ID: ${statement.statementId}.`);
        statementIds.add(statement.statementId);
        assert(statement.parentSectionId === section.sectionId && statement.anchorId === section.anchor.anchorId, "Commentary statement parent mismatch.");
        assert(statement.startOffset >= 0 && statement.endOffset > statement.startOffset && statement.startOffset >= previousEnd, "Commentary statement offsets are invalid or unstable.");
        assert(section.exactText.slice(statement.startOffset, statement.endOffset) === statement.exactText, "Commentary statement is not an exact section substring.");
        assert(statement.contentHash === sha256(statement.exactText), "Commentary statement hash mismatch.");
        previousEnd = statement.endOffset;
      }
      assert(section.statements.length > 0, `Commentary section has no source statements: ${section.sectionId}.`);
      sectionCount += 1;
      statementCount += section.statements.length;
    }
  }
  assert(sectionCount === manifest.expectedCounts.sections, "Commentary manifest section count mismatch.");
  assert(statementCount === manifest.expectedCounts.statements, "Commentary manifest statement count mismatch.");
  assert(sectionCount === manifest.expectedCounts.anchors, "Commentary anchor count mismatch.");
  assert(gapCount === manifest.expectedCounts.coverageGaps, "Commentary coverage-gap count mismatch.");
  return dataset;
}
