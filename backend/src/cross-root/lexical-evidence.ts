import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CROSS_ROOT_DATASET_ID = "sourceroot-cross-root-lexical-evidence-v1";
export const CROSS_ROOT_DATASET_VERSION = "1.0.0";
export const CROSS_ROOT_ALGORITHM_VERSION = "exact-lexical-observation-js-utf16-v1";
export const CROSS_ROOT_DATA_DIRECTORY = fileURLToPath(
  new URL("../../data/cross-root-link-foundation-v1/", import.meta.url),
);
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export type CrossRootId = "DictionaryRoot" | "HistoryRoot" | "BibleRoot";
export type CrossRootResourceType = "lemma" | "accepted-contextual-record" | "edition-verse-text";

export interface CrossRootInputFingerprint {
  filename: string;
  datasetId: string;
  datasetVersion: string;
  byteLength: number;
  sha256: string;
  gitBlob: string;
}

export interface CrossRootResourceField {
  name: string;
  text: string;
}

export interface CrossRootResource {
  resourceId: string;
  rootId: CrossRootId;
  resourceType: CrossRootResourceType;
  canonicalPublicId: string;
  displayLabel: string;
  canonicalLocalUrl: string;
  sourceDatasetId: string;
  sourceDatasetVersion: string;
  resourceContentHash: string;
  deterministicIdentityHash: string;
  displayOrder: number;
  metadata: Record<string, unknown> & { fields?: CrossRootResourceField[] };
}

export interface CrossRootLink {
  linkId: string;
  sourceResourceId: string;
  sourceRootId: "DictionaryRoot";
  targetResourceId: string;
  targetRootId: "HistoryRoot" | "BibleRoot";
  relationshipType: "exact_lexical_occurrence";
  directionality: "directional";
  derivationKind: "textually_observed";
  reviewStatus: "unreviewed";
  algorithmVersion: string;
  deterministicContentHash: string;
  displayOrder: number;
}

export interface CrossRootEvidence {
  evidenceId: string;
  linkId: string;
  targetField: string;
  observedSurfaceText: string;
  normalizedMatchText: string;
  startOffset: number;
  endOffset: number;
  contextExcerpt: string;
  targetContentHash: string;
  targetFieldContentHash: string;
  sourceDatasetId: string;
  sourceDatasetVersion: string;
  evidenceOrder: number;
}

export interface CrossRootManifest {
  schemaVersion: "1.0.0";
  datasetId: string;
  version: string;
  title: string;
  algorithmVersion: string;
  derivationBoundary: string;
  reviewBoundary: string;
  participatingRoots: CrossRootId[];
  participatingResourceTypes: CrossRootResourceType[];
  inputDatasetIdentities: Array<{ datasetId: string; version: string; rootId: CrossRootId }>;
  expectedCounts: {
    resources: number;
    dictionaryResources: number;
    historyResources: number;
    bibleResources: number;
    links: number;
    evidence: number;
    dictionaryToHistoryLinks: number;
    dictionaryToBibleLinks: number;
    historyOccurrences: number;
    bibleOccurrences: number;
  };
  excludedLayers: string[];
}

interface HashManifest {
  datasetId: string;
  version: string;
  files: Array<{ filename: string; byteLength: number; sha256: string }>;
}

export interface CrossRootDataset {
  manifest: CrossRootManifest;
  inputFingerprints: CrossRootInputFingerprint[];
  resources: CrossRootResource[];
  links: CrossRootLink[];
  evidence: CrossRootEvidence[];
  hashes: HashManifest;
}

export function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

export function gitBlob(value: Uint8Array): string {
  const header = Buffer.from(`blob ${value.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(value).digest("hex");
}

export function normalizedLexicalText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").trim().replace(/\s+/gu, " ");
}

export function deterministicHash(value: unknown): string {
  return sha256(JSON.stringify(value));
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(path.join(CROSS_ROOT_DATA_DIRECTORY, filename), "utf8")) as T;
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}.`);
}

function expectedCountVector(dataset: CrossRootDataset): number[] {
  const counts = dataset.manifest.expectedCounts;
  const linkTargets = new Map(dataset.links.map((link) => [link.linkId, link.targetRootId]));
  return [
    dataset.resources.length,
    dataset.resources.filter((item) => item.rootId === "DictionaryRoot").length,
    dataset.resources.filter((item) => item.rootId === "HistoryRoot").length,
    dataset.resources.filter((item) => item.rootId === "BibleRoot").length,
    dataset.links.length,
    dataset.evidence.length,
    dataset.links.filter((item) => item.targetRootId === "HistoryRoot").length,
    dataset.links.filter((item) => item.targetRootId === "BibleRoot").length,
    dataset.evidence.filter((item) => linkTargets.get(item.linkId) === "HistoryRoot").length,
    dataset.evidence.filter((item) => linkTargets.get(item.linkId) === "BibleRoot").length,
    counts.resources,
    counts.dictionaryResources,
    counts.historyResources,
    counts.bibleResources,
    counts.links,
    counts.evidence,
    counts.dictionaryToHistoryLinks,
    counts.dictionaryToBibleLinks,
    counts.historyOccurrences,
    counts.bibleOccurrences,
  ];
}

export async function validateCrossRootDataset(candidate?: CrossRootDataset): Promise<CrossRootDataset> {
  const dataset = candidate ?? {
    manifest: await readJson<CrossRootManifest>("dataset-manifest.json"),
    inputFingerprints: await readJson<CrossRootInputFingerprint[]>("input-fingerprints.json"),
    resources: await readJson<CrossRootResource[]>("resource-registry.json"),
    links: await readJson<CrossRootLink[]>("links.json"),
    evidence: await readJson<CrossRootEvidence[]>("evidence.json"),
    hashes: await readJson<HashManifest>("hashes.json"),
  };
  if (
    dataset.manifest.datasetId !== CROSS_ROOT_DATASET_ID
    || dataset.manifest.version !== CROSS_ROOT_DATASET_VERSION
    || dataset.manifest.algorithmVersion !== CROSS_ROOT_ALGORITHM_VERSION
    || dataset.hashes.datasetId !== CROSS_ROOT_DATASET_ID
    || dataset.hashes.version !== CROSS_ROOT_DATASET_VERSION
  ) throw new Error("Cross-Root dataset identity is invalid.");

  for (const file of dataset.hashes.files) {
    const bytes = await readFile(path.join(CROSS_ROOT_DATA_DIRECTORY, file.filename));
    if (bytes.byteLength !== file.byteLength || sha256(bytes) !== file.sha256) {
      throw new Error(`Cross-Root prepared file checksum mismatch: ${file.filename}`);
    }
  }
  for (const input of dataset.inputFingerprints) {
    const bytes = await readFile(path.join(REPOSITORY_ROOT, input.filename));
    if (
      bytes.byteLength !== input.byteLength
      || sha256(bytes) !== input.sha256
      || gitBlob(bytes) !== input.gitBlob
    ) throw new Error(`Cross-Root input fingerprint mismatch: ${input.filename}`);
  }
  const vector = expectedCountVector(dataset);
  if (JSON.stringify(vector.slice(0, 10)) !== JSON.stringify(vector.slice(10))) {
    throw new Error("Cross-Root manifest count mismatch.");
  }
  assertUnique(dataset.resources.map((item) => item.resourceId), "Cross-Root resource ID");
  assertUnique(dataset.links.map((item) => item.linkId), "Cross-Root link ID");
  assertUnique(dataset.evidence.map((item) => item.evidenceId), "Cross-Root evidence ID");
  const resources = new Map(dataset.resources.map((item) => [item.resourceId, item]));
  const links = new Map(dataset.links.map((item) => [item.linkId, item]));
  for (const resource of dataset.resources) {
    const expectedType = resource.rootId === "DictionaryRoot" ? "lemma"
      : resource.rootId === "HistoryRoot" ? "accepted-contextual-record" : "edition-verse-text";
    if (resource.resourceType !== expectedType || !/^[A-F0-9]{64}$/u.test(resource.resourceContentHash)) {
      throw new Error(`Cross-Root resource type or hash is invalid: ${resource.resourceId}`);
    }
  }
  for (const link of dataset.links) {
    const source = resources.get(link.sourceResourceId);
    const target = resources.get(link.targetResourceId);
    if (!source || !target || source.rootId !== "DictionaryRoot" || target.rootId !== link.targetRootId) {
      throw new Error(`Cross-Root link resources are invalid: ${link.linkId}`);
    }
    if (
      link.relationshipType !== "exact_lexical_occurrence"
      || link.derivationKind !== "textually_observed"
      || link.reviewStatus !== "unreviewed"
      || link.algorithmVersion !== CROSS_ROOT_ALGORITHM_VERSION
    ) throw new Error(`Cross-Root 14A boundary is invalid: ${link.linkId}`);
  }
  const offsetKeys = new Set<string>();
  for (const item of dataset.evidence) {
    const link = links.get(item.linkId);
    const target = link ? resources.get(link.targetResourceId) : undefined;
    const field = (target?.metadata.fields ?? []).find((entry) => entry.name === item.targetField);
    if (!link || !target || !field) throw new Error(`Cross-Root evidence parent is invalid: ${item.evidenceId}`);
    const observed = field.text.slice(item.startOffset, item.endOffset);
    if (
      observed !== item.observedSurfaceText
      || normalizedLexicalText(observed) !== item.normalizedMatchText
      || item.targetContentHash !== target.resourceContentHash
      || item.targetFieldContentHash !== sha256(field.text)
    ) throw new Error(`Cross-Root evidence offsets or hashes are invalid: ${item.evidenceId}`);
    const key = `${item.linkId}|${item.targetField}|${item.startOffset}|${item.endOffset}`;
    if (offsetKeys.has(key)) throw new Error(`Duplicate Cross-Root evidence offset: ${key}`);
    offsetKeys.add(key);
  }
  return dataset;
}
