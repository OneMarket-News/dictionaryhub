import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CROSS_ROOT_RELATIONSHIP_DATASET_ID = "sourceroot-cross-root-source-backed-relationships-v1";
export const CROSS_ROOT_RELATIONSHIP_DATASET_VERSION = "1.0.0";
export const CROSS_ROOT_RELATIONSHIP_ALGORITHM_VERSION = "released-historyroot-relationship-projection-v1";
export const CROSS_ROOT_RELATIONSHIP_DATA_DIRECTORY = fileURLToPath(
  new URL("../../data/cross-root-source-backed-relationships-v1/", import.meta.url),
);
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export const RELATIONSHIP_FAMILIES = [
  "association", "authorship", "causation", "conflict", "contribution",
  "governance", "issuance", "kinship", "location", "membership",
  "participation", "source_reference", "temporal_succession",
] as const;
export type RelationshipFamily = typeof RELATIONSHIP_FAMILIES[number];
export type ReviewState = "unreviewed" | "accepted_after_review" | "disputed" | "rejected";
export type CausalRole = "direct_cause" | "contributing_factor" | "condition" | "response" | "interpretation" | "consequence";

export interface RelationshipInputFingerprint {
  filename: string;
  datasetId: string;
  datasetVersion: string;
  byteLength: number;
  sha256: string;
  gitBlob: string;
  purpose: string;
}

export interface SourceBackedRelationshipAssertion {
  assertionId: string;
  subjectResourceId: string;
  subjectRootId: "HistoryRoot";
  subjectCanonicalPublicId: string;
  predicate: string;
  objectResourceId: string;
  objectRootId: "HistoryRoot";
  objectCanonicalPublicId: string;
  directionality: "directional" | "symmetric";
  inverseDisplayLabel: string | null;
  sourceNativeRelationshipType: string;
  relationshipFamily: RelationshipFamily;
  derivationKind: "directly_sourced";
  reviewState: ReviewState;
  assertionStatus: "active";
  certainty: string;
  uncertaintyStatement: string | null;
  disputeState: "not_disputed" | "disputed";
  temporalScope: { mode: "not_asserted" };
  geographicScopeDescription: null;
  isCausal: boolean;
  causalRole: CausalRole | null;
  sourceRecordId: string;
  sourceRecordType: "relationship" | "causal_link";
  sourceDatasetId: string;
  sourceDatasetVersion: string;
  deterministicIdentityHash: string;
  contentHash: string;
  provenanceOrder: number;
  metadata: Record<string, unknown>;
}

export interface SourceBackedRelationshipEvidence {
  evidenceId: string;
  assertionId: string;
  sourceRootId: "HistoryRoot";
  sourceResourceId: string;
  sourceRecordType: "relationship" | "causal_link";
  sourceField: "explanation";
  evidenceMode: "utf16_offsets";
  observedExcerpt: string;
  startOffset: 0;
  endOffset: number;
  sourceClaimId: null;
  sourceEvidenceId: null;
  publicationId: null;
  artifactId: null;
  sourceId: string;
  citation: string | null;
  sourceLocator: string | null;
  sourceUrl: string | null;
  sourceRecordHash: string;
  sourceFieldHash: string;
  evidenceHash: string;
  sourceDatasetId: string;
  sourceDatasetVersion: string;
  evidenceOrder: number;
  uncertaintyNote: string | null;
  disputeNote: string | null;
}

export interface RelationshipCounts {
  assertions: number;
  evidence: number;
  subjectResources: number;
  objectResources: number;
  resourceReuse: number;
  resourceAdditions: number;
  causal: number;
  nonCausal: number;
  sameRoot: number;
  crossRoot: number;
  disputed: number;
  uncertain: number;
  derivationCounts: Record<string, number>;
  reviewStateCounts: Record<string, number>;
  relationshipFamilyCounts: Record<string, number>;
  predicateCounts: Record<string, number>;
  excludedRecordCounts: Record<string, number>;
  excludedCategoryCounts: Record<string, number>;
}

export interface RelationshipManifest {
  schemaVersion: "1.0.0";
  datasetId: string;
  version: string;
  title: string;
  preparationAlgorithmVersion: string;
  sourceDatasetIdentities: Array<{ datasetId: string; version: string; rootId: string }>;
  participatingRoots: string[];
  resourceTypes: string[];
  relationshipFamilies: string[];
  semanticBoundary: string;
  reviewMapping: Record<string, string>;
  expectedCounts: RelationshipCounts;
  excludedCategories: string[];
}

interface HashManifest {
  datasetId: string;
  version: string;
  files: Array<{ filename: string; byteLength: number; sha256: string }>;
}

export interface SourceBackedRelationshipDataset {
  manifest: RelationshipManifest;
  inputFingerprints: RelationshipInputFingerprint[];
  assertions: SourceBackedRelationshipAssertion[];
  evidence: SourceBackedRelationshipEvidence[];
  hashes: HashManifest;
}

export function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

export function gitBlob(value: Uint8Array): string {
  const header = Buffer.from(`blob ${value.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(value).digest("hex");
}

export function deterministicHash(value: unknown): string {
  return sha256(JSON.stringify(value));
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(path.join(CROSS_ROOT_RELATIONSHIP_DATA_DIRECTORY, filename), "utf8")) as T;
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}.`);
}

export async function validateSourceBackedRelationshipDataset(
  candidate?: SourceBackedRelationshipDataset,
): Promise<SourceBackedRelationshipDataset> {
  const dataset = candidate ?? {
    manifest: await readJson<RelationshipManifest>("dataset-manifest.json"),
    inputFingerprints: await readJson<RelationshipInputFingerprint[]>("input-fingerprints.json"),
    assertions: await readJson<SourceBackedRelationshipAssertion[]>("relationship-assertions.json"),
    evidence: await readJson<SourceBackedRelationshipEvidence[]>("relationship-evidence.json"),
    hashes: await readJson<HashManifest>("hashes.json"),
  };
  if (
    dataset.manifest.datasetId !== CROSS_ROOT_RELATIONSHIP_DATASET_ID
    || dataset.manifest.version !== CROSS_ROOT_RELATIONSHIP_DATASET_VERSION
    || dataset.manifest.preparationAlgorithmVersion !== CROSS_ROOT_RELATIONSHIP_ALGORITHM_VERSION
    || dataset.hashes.datasetId !== CROSS_ROOT_RELATIONSHIP_DATASET_ID
    || dataset.hashes.version !== CROSS_ROOT_RELATIONSHIP_DATASET_VERSION
  ) throw new Error("Source-backed relationship dataset identity is invalid.");
  for (const file of dataset.hashes.files) {
    const bytes = await readFile(path.join(CROSS_ROOT_RELATIONSHIP_DATA_DIRECTORY, file.filename));
    if (bytes.byteLength !== file.byteLength || sha256(bytes) !== file.sha256) {
      throw new Error(`Prepared relationship checksum mismatch: ${file.filename}`);
    }
  }
  for (const input of dataset.inputFingerprints) {
    const bytes = await readFile(path.join(REPOSITORY_ROOT, input.filename));
    if (bytes.byteLength !== input.byteLength || sha256(bytes) !== input.sha256 || gitBlob(bytes) !== input.gitBlob) {
      throw new Error(`Relationship input fingerprint mismatch: ${input.filename}`);
    }
  }
  assertUnique(dataset.assertions.map((item) => item.assertionId), "relationship assertion ID");
  assertUnique(dataset.assertions.map((item) => item.deterministicIdentityHash), "relationship identity hash");
  assertUnique(dataset.assertions.map((item) => item.sourceRecordId), "relationship source record");
  assertUnique(dataset.evidence.map((item) => item.evidenceId), "relationship evidence ID");
  assertUnique(dataset.evidence.map((item) => item.evidenceHash), "relationship evidence hash");
  const assertions = new Map(dataset.assertions.map((item) => [item.assertionId, item]));
  const evidenceCounts = new Map<string, number>();
  for (const assertion of dataset.assertions) {
    if (
      assertion.subjectResourceId === assertion.objectResourceId
      || assertion.derivationKind !== "directly_sourced"
      || assertion.reviewState === "accepted_after_review"
      || assertion.reviewState === "rejected"
      || !RELATIONSHIP_FAMILIES.includes(assertion.relationshipFamily)
      || assertion.subjectRootId !== "HistoryRoot"
      || assertion.objectRootId !== "HistoryRoot"
    ) throw new Error(`Relationship assertion boundary is invalid: ${assertion.assertionId}`);
    if (assertion.isCausal !== (assertion.relationshipFamily === "causation" && assertion.causalRole !== null)) {
      throw new Error(`Causal separation is invalid: ${assertion.assertionId}`);
    }
    if (/exact_lexical_occurrence|sameMeaning|semanticSimilarity|embedding|confidenceScore/u.test(JSON.stringify(assertion))) {
      throw new Error(`Lexical or inferred semantic material is prohibited: ${assertion.assertionId}`);
    }
  }
  for (const item of dataset.evidence) {
    const assertion = assertions.get(item.assertionId);
    if (!assertion) throw new Error(`Orphan relationship evidence: ${item.evidenceId}`);
    if (
      item.evidenceMode !== "utf16_offsets"
      || item.startOffset !== 0
      || item.endOffset !== item.observedExcerpt.length
      || sha256(item.observedExcerpt) !== item.sourceFieldHash
      || !item.sourceDatasetId
      || !item.sourceDatasetVersion
      || item.sourceRecordType !== assertion.sourceRecordType
    ) throw new Error(`Relationship evidence boundary is invalid: ${item.evidenceId}`);
    evidenceCounts.set(item.assertionId, (evidenceCounts.get(item.assertionId) ?? 0) + 1);
  }
  if (dataset.assertions.some((item) => !evidenceCounts.has(item.assertionId))) {
    throw new Error("Every relationship assertion requires evidence.");
  }
  const counts = dataset.manifest.expectedCounts;
  if (
    dataset.assertions.length !== counts.assertions
    || dataset.evidence.length !== counts.evidence
    || dataset.assertions.filter((item) => item.isCausal).length !== counts.causal
    || dataset.assertions.filter((item) => !item.isCausal).length !== counts.nonCausal
    || dataset.assertions.filter((item) => item.subjectRootId !== item.objectRootId).length !== counts.crossRoot
  ) throw new Error("Relationship manifest count mismatch.");
  return dataset;
}
