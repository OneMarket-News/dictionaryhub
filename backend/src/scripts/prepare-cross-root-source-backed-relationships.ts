import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CROSS_ROOT_RELATIONSHIP_ALGORITHM_VERSION,
  CROSS_ROOT_RELATIONSHIP_DATA_DIRECTORY,
  CROSS_ROOT_RELATIONSHIP_DATASET_ID,
  CROSS_ROOT_RELATIONSHIP_DATASET_VERSION,
  deterministicHash,
  gitBlob,
  sha256,
  type CausalRole,
  type RelationshipFamily,
  type RelationshipInputFingerprint,
  type RelationshipManifest,
  type SourceBackedRelationshipAssertion,
  type SourceBackedRelationshipEvidence,
} from "../cross-root/source-backed-relationships.js";

const BACKEND_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REPOSITORY_ROOT = path.resolve(BACKEND_ROOT, "..");
const HISTORY_FILE = "backend/data/historyroot-wampanoag-regional-corpus-v1/historyroot-wampanoag-regional-corpus-v1.bundle.json";
const REGISTRY_FILE = "backend/data/cross-root-link-foundation-v1/resource-registry.json";
const REGISTRY_MANIFEST_FILE = "backend/data/cross-root-link-foundation-v1/dataset-manifest.json";
const REGISTRY_HASHES_FILE = "backend/data/cross-root-link-foundation-v1/hashes.json";

interface HistorySource {
  id: string; citation?: string; url?: string; locatorsInspected?: string[];
}
interface HistoryRelationship {
  id: string; fromId: string; toId: string; relationshipType: string; relationshipRole?: string;
  explanation: string; confidence: string; uncertainty?: string; reviewStatus?: string; status: string;
  sourceIds: string[]; metadata?: Record<string, unknown>;
}
interface HistoryCausalLink {
  id: string; causeId: string; effectId: string; causalKind: "cause" | "consequence";
  explanation: string; confidence: string; uncertainty?: string; status: string;
  sourceIds: string[]; metadata?: Record<string, unknown>;
}
interface HistoryBundle {
  bundleId: string; version: string; domain: string; sources: HistorySource[];
  context: { relationships: HistoryRelationship[]; causalLinks: HistoryCausalLink[] };
}
interface RegistryResource {
  resourceId: string; rootId: string; resourceType: string; canonicalPublicId: string;
  sourceDatasetId: string; sourceDatasetVersion: string; resourceContentHash: string;
}

const FAMILY_BY_PREDICATE: Record<string, RelationshipFamily> = {
  affected:"conflict", associated_with:"association", author_of:"authorship", catalogs:"source_reference",
  community_within:"membership", concerns:"association", contextualized_by:"association", contextualizes:"association",
  contributor_to:"contribution", created_document:"authorship", criticized:"conflict", documents:"source_reference",
  embodied_work:"source_reference", established:"governance", established_at:"location", followed_by:"temporal_succession",
  governor_at_transition:"governance", homeland_at:"location", incorporated_into:"membership", initiated:"participation",
  interpreter_at:"participation", introduced:"contribution", issued_in:"issuance", kidnapped:"conflict", killed_in:"conflict",
  leader_in:"governance", leader_of:"governance", led:"participation", located_on:"location", located_within:"location",
  major_event_of:"association", member_of:"membership", negotiated_during:"participation", occurred_at:"location",
  opening_event_of:"temporal_succession", parallel_mediator:"association", parent_of:"kinship", part_of:"membership",
  participant_in:"participation", preceded:"temporal_succession", published_work:"authorship", regional_context:"association",
  reported:"source_reference", reported_in:"source_reference", settled_at:"location", sibling_of:"kinship",
  sponsor_of:"contribution", subject_of:"source_reference", targeted_in:"conflict", textual_witness_of:"source_reference",
  transported_with:"contribution",
};
const SYMMETRIC = new Set(["associated_with", "sibling_of"]);
const INVERSES: Record<string, string> = {
  author_of:"authored by", community_within:"contains community", created_document:"created by",
  established_at:"site of establishment", followed_by:"preceded by", homeland_at:"homeland of",
  issued_in:"place of issuance", leader_of:"led by", located_on:"location of", located_within:"contains",
  member_of:"has member", occurred_at:"site of event", parent_of:"child of", part_of:"contains",
  participant_in:"has participant", preceded:"followed by", settled_at:"settled by", subject_of:"has subject",
};

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
async function readJson<T>(relative: string): Promise<T> {
  return JSON.parse(await readFile(path.join(REPOSITORY_ROOT, relative), "utf8")) as T;
}
function stableId(prefix: string, material: unknown): string {
  return `${prefix}-${deterministicHash(material).slice(0, 32).toLowerCase()}`;
}
async function fingerprint(relative: string, datasetId: string, datasetVersion: string, purpose: string): Promise<RelationshipInputFingerprint> {
  const bytes = await readFile(path.join(REPOSITORY_ROOT, relative));
  return { filename:relative, datasetId, datasetVersion, byteLength:bytes.byteLength, sha256:sha256(bytes), gitBlob:gitBlob(bytes), purpose };
}
function causalRole(record: HistoryCausalLink): CausalRole {
  const wording = `${record.explanation} ${record.uncertainty ?? ""}`.toLowerCase();
  const attribution = String(record.metadata?.attributedTo ?? "").toLowerCase();
  if (/contribut/u.test(wording)) return "contributing_factor";
  if (/respond|response/u.test(wording)) return "response";
  if (record.causalKind === "consequence") return "consequence";
  if (/context|condition|framework|basis|enabl/u.test(wording)) return "condition";
  if (/interpret/u.test(attribution) || /interpret/u.test(wording)) return "interpretation";
  return "direct_cause";
}
function reviewState(record: HistoryRelationship | HistoryCausalLink): "unreviewed" | "disputed" {
  const explicit = "reviewStatus" in record ? record.reviewStatus : undefined;
  return explicit === "disputed" || record.status === "disputed" ? "disputed" : "unreviewed";
}

export async function prepareSourceBackedRelationships(): Promise<RelationshipManifest["expectedCounts"]> {
  const [history, registry] = await Promise.all([
    readJson<HistoryBundle>(HISTORY_FILE), readJson<RegistryResource[]>(REGISTRY_FILE),
  ]);
  if (history.bundleId !== "historyroot-plymouth-knowledge-dataset-v1" || history.version !== "1.3.0" || history.domain !== "HistoryRoot") {
    throw new Error("HistoryRoot input is not the released public 1.3.0 bundle.");
  }
  const resources = new Map(registry.filter((item) => item.rootId === "HistoryRoot").map((item) => [item.canonicalPublicId, item]));
  const sources = new Map(history.sources.map((item) => [item.id, item]));
  const assertions: SourceBackedRelationshipAssertion[] = [];
  const evidence: SourceBackedRelationshipEvidence[] = [];
  const excludedRecordCounts = { draft:0, rejected:0, private:0, missingEndpoint:0, missingProvenance:0, unsupportedPredicate:0 };

  const records: Array<{ kind:"relationship" | "causal_link"; record:HistoryRelationship | HistoryCausalLink }> = [
    ...history.context.relationships.map((record) => ({ kind:"relationship" as const, record })),
    ...history.context.causalLinks.map((record) => ({ kind:"causal_link" as const, record })),
  ].sort((left, right) => left.record.id.localeCompare(right.record.id));
  for (const entry of records) {
    const status = entry.record.status.toLowerCase();
    if (/draft/u.test(status)) { excludedRecordCounts.draft += 1; continue; }
    if (/reject|withdrawn/u.test(status)) { excludedRecordCounts.rejected += 1; continue; }
    if (/private/u.test(status)) { excludedRecordCounts.private += 1; continue; }
    const causal = entry.kind === "causal_link";
    const relationship = entry.record as HistoryRelationship;
    const causalLink = entry.record as HistoryCausalLink;
    const subjectPublicId = causal ? causalLink.causeId : relationship.fromId;
    const objectPublicId = causal ? causalLink.effectId : relationship.toId;
    const subject = resources.get(subjectPublicId);
    const object = resources.get(objectPublicId);
    const sourceRecord = resources.get(entry.record.id);
    if (!subject || !object || !sourceRecord || subjectPublicId === objectPublicId) { excludedRecordCounts.missingEndpoint += 1; continue; }
    if (!entry.record.sourceIds.length || entry.record.sourceIds.some((sourceId) => !sources.has(sourceId))) { excludedRecordCounts.missingProvenance += 1; continue; }
    const predicate = causal ? "causes_or_contributes_to" : relationship.relationshipType;
    const family = causal ? "causation" : FAMILY_BY_PREDICATE[predicate];
    if (!family) { excludedRecordCounts.unsupportedPredicate += 1; continue; }
    const identityMaterial = { datasetId:CROSS_ROOT_RELATIONSHIP_DATASET_ID, sourceRecordId:entry.record.id, subjectResourceId:subject.resourceId, predicate, objectResourceId:object.resourceId };
    const assertionId = stableId("cr-assertion", identityMaterial);
    const base = {
      assertionId, subjectResourceId:subject.resourceId, subjectRootId:"HistoryRoot" as const,
      subjectCanonicalPublicId:subjectPublicId, predicate, objectResourceId:object.resourceId,
      objectRootId:"HistoryRoot" as const, objectCanonicalPublicId:objectPublicId,
      directionality:(causal || !SYMMETRIC.has(predicate) ? "directional" : "symmetric") as "directional" | "symmetric",
      inverseDisplayLabel:causal ? "is effect of" : INVERSES[predicate] ?? null,
      sourceNativeRelationshipType:causal ? causalLink.causalKind : relationship.relationshipType,
      relationshipFamily:family, derivationKind:"directly_sourced" as const,
      reviewState:reviewState(entry.record), assertionStatus:"active" as const,
      certainty:entry.record.confidence, uncertaintyStatement:entry.record.uncertainty ?? null,
      disputeState:(reviewState(entry.record) === "disputed" ? "disputed" : "not_disputed") as "not_disputed" | "disputed",
      temporalScope:{ mode:"not_asserted" as const }, geographicScopeDescription:null,
      isCausal:causal, causalRole:causal ? causalRole(causalLink) : null,
      sourceRecordId:entry.record.id, sourceRecordType:entry.kind,
      sourceDatasetId:history.bundleId, sourceDatasetVersion:history.version,
      deterministicIdentityHash:deterministicHash(identityMaterial), provenanceOrder:assertions.length + 1,
      metadata:{ sourceStatus:entry.record.status, sourceReviewStatus:("reviewStatus" in entry.record ? entry.record.reviewStatus ?? null : null), sourceMetadata:entry.record.metadata ?? {} },
    };
    const assertion: SourceBackedRelationshipAssertion = { ...base, contentHash:deterministicHash(base) };
    assertions.push(assertion);
    entry.record.sourceIds.forEach((sourceId, index) => {
      const source = sources.get(sourceId)!;
      const evidenceBase = {
        assertionId, sourceRootId:"HistoryRoot" as const, sourceResourceId:sourceRecord.resourceId,
        sourceRecordType:entry.kind, sourceField:"explanation" as const, evidenceMode:"utf16_offsets" as const,
        observedExcerpt:entry.record.explanation, startOffset:0 as const, endOffset:entry.record.explanation.length,
        sourceClaimId:null, sourceEvidenceId:null, publicationId:null, artifactId:null, sourceId,
        citation:source.citation ?? null, sourceLocator:source.locatorsInspected?.join(" | ") ?? null,
        sourceUrl:source.url ?? null, sourceRecordHash:deterministicHash(entry.record),
        sourceFieldHash:sha256(entry.record.explanation), sourceDatasetId:history.bundleId,
        sourceDatasetVersion:history.version, evidenceOrder:index + 1,
        uncertaintyNote:entry.record.uncertainty ?? null,
        disputeNote:reviewState(entry.record) === "disputed" ? entry.record.uncertainty ?? "Source record is disputed." : null,
      };
      const evidenceHash = deterministicHash(evidenceBase);
      evidence.push({ evidenceId:stableId("cr-relationship-evidence", evidenceHash), ...evidenceBase, evidenceHash });
    });
  }

  const countsBy = (values: string[]) => Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]));
  const subjectIds = [...new Set(assertions.map((item) => item.subjectResourceId))];
  const objectIds = [...new Set(assertions.map((item) => item.objectResourceId))];
  const reusedIds = new Set([...subjectIds, ...objectIds, ...evidence.map((item) => item.sourceResourceId)]);
  const expectedCounts: RelationshipManifest["expectedCounts"] = {
    assertions:assertions.length, evidence:evidence.length, subjectResources:subjectIds.length,
    objectResources:objectIds.length, resourceReuse:reusedIds.size, resourceAdditions:0,
    causal:assertions.filter((item) => item.isCausal).length,
    nonCausal:assertions.filter((item) => !item.isCausal).length,
    sameRoot:assertions.filter((item) => item.subjectRootId === item.objectRootId).length,
    crossRoot:assertions.filter((item) => item.subjectRootId !== item.objectRootId).length,
    disputed:assertions.filter((item) => item.disputeState === "disputed").length,
    uncertain:assertions.filter((item) => Boolean(item.uncertaintyStatement)).length,
    derivationCounts:countsBy(assertions.map((item) => item.derivationKind)),
    reviewStateCounts:countsBy(assertions.map((item) => item.reviewState)),
    relationshipFamilyCounts:countsBy(assertions.map((item) => item.relationshipFamily)),
    predicateCounts:countsBy(assertions.map((item) => item.predicate)), excludedRecordCounts,
    excludedCategoryCounts:{ lexicalObservations:2233, dictionarySenses:1014, biblePassages:440, crossRootSemanticAssertions:0, earthRootRecords:0, commentaryRecords:3450, originalLanguageTokens:1592 },
  };
  const manifest: RelationshipManifest = {
    schemaVersion:"1.0.0", datasetId:CROSS_ROOT_RELATIONSHIP_DATASET_ID,
    version:CROSS_ROOT_RELATIONSHIP_DATASET_VERSION,
    title:"Cross-Root Source-Backed Entity and Historical Relationships v1",
    preparationAlgorithmVersion:CROSS_ROOT_RELATIONSHIP_ALGORITHM_VERSION,
    sourceDatasetIdentities:[{ datasetId:history.bundleId, version:history.version, rootId:"HistoryRoot" }],
    participatingRoots:["HistoryRoot"], resourceTypes:["accepted-contextual-record"],
    relationshipFamilies:Object.keys(expectedCounts.relationshipFamilyCounts).sort(),
    semanticBoundary:"Released source assertions only. Exact lexical overlap, matching labels, identity inference, geographic inference, and causal strengthening are prohibited.",
    reviewMapping:{ "pilot-review-required":"unreviewed", "corpus-review-ready":"unreviewed", disputed:"disputed", rejected:"excluded" },
    expectedCounts,
    excludedCategories:["Chunk 14A exact lexical observations", "draft, rejected, private, moderation, and audit records", "name-only identity inference", "unsupported cross-Root assertions", "EarthRoot, coordinates, maps, and geocoding", "BibleRoot commentary and Original Language", "machine similarity and embeddings"],
  };
  const inputFingerprints = await Promise.all([
    fingerprint(HISTORY_FILE, history.bundleId, history.version, "Released relationship, causal, source, and provenance records"),
    fingerprint(REGISTRY_FILE, "sourceroot-cross-root-lexical-evidence-v1", "1.0.0", "Reuse canonical registered resources only"),
    fingerprint(REGISTRY_MANIFEST_FILE, "sourceroot-cross-root-lexical-evidence-v1", "1.0.0", "Validate Chunk 14A registry identity without consuming lexical links"),
    fingerprint(REGISTRY_HASHES_FILE, "sourceroot-cross-root-lexical-evidence-v1", "1.0.0", "Validate committed registry hash contract"),
  ]);
  await mkdir(CROSS_ROOT_RELATIONSHIP_DATA_DIRECTORY, { recursive:true });
  const outputs = new Map<string, string>([
    ["dataset-manifest.json", json(manifest)], ["input-fingerprints.json", json(inputFingerprints)],
    ["relationship-assertions.json", json(assertions)], ["relationship-evidence.json", json(evidence)],
  ]);
  for (const [filename, content] of outputs) await writeFile(path.join(CROSS_ROOT_RELATIONSHIP_DATA_DIRECTORY, filename), content, "utf8");
  const hashes = { datasetId:CROSS_ROOT_RELATIONSHIP_DATASET_ID, version:CROSS_ROOT_RELATIONSHIP_DATASET_VERSION,
    files:[...outputs].map(([filename, content]) => ({ filename, byteLength:Buffer.byteLength(content), sha256:sha256(content) })) };
  await writeFile(path.join(CROSS_ROOT_RELATIONSHIP_DATA_DIRECTORY, "hashes.json"), json(hashes), "utf8");
  console.log(JSON.stringify({ datasetId:manifest.datasetId, version:manifest.version, algorithmVersion:manifest.preparationAlgorithmVersion, ...expectedCounts }, null, 2));
  return expectedCounts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  prepareSourceBackedRelationships().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error); process.exitCode = 1;
  });
}
