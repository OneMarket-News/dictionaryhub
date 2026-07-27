import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ContextEntity,
  ContextRecordBase,
  ContextualBundle,
} from "../contextual-types.js";
import type { SourceRootBundle } from "../types.js";
import { validateBundle } from "../services/validator.js";
import { FOUNDATIONAL_CORPUS_BUNDLE_PATH } from "./foundational-corpus.js";

export const PLYMOUTH_BUNDLE_ID =
  "historyroot-plymouth-knowledge-dataset-v1";
export const PLYMOUTH_DATASET_DISCLAIMER =
  "A machine-assisted pilot dataset awaiting further historical, editorial, and tribal review.";

const currentFile = fileURLToPath(import.meta.url);
export const PLYMOUTH_DATASET_DIRECTORY = path.resolve(
  path.dirname(currentFile),
  "../../../data/historyroot/plymouth-v1",
);
export const PLYMOUTH_BUNDLE_PATH = path.join(
  FOUNDATIONAL_CORPUS_BUNDLE_PATH,
);

const manifestPath = path.join(
  PLYMOUTH_DATASET_DIRECTORY,
  "manifest.json",
);
const sourceRegisterPath = path.join(
  PLYMOUTH_DATASET_DIRECTORY,
  "source-register.json",
);
const matrixPath = path.join(
  PLYMOUTH_DATASET_DIRECTORY,
  "claim-evidence-matrix.json",
);

const allowedAccessStatuses = new Set([
  "accessed-and-inspected",
  "metadata-verified-not-inspected",
  "bibliographic-only",
  "inaccessible",
  "rejected",
]);

type UnknownRecord = Record<string, unknown>;

interface PlymouthManifest {
  datasetId: string;
  bundleId: string;
  disclaimer: string;
  counts: Record<string, number>;
  minimums: Record<string, number>;
  targets: Record<string, [number, number]>;
  sourcePolicy: {
    detailedClaimsRequire: string;
    statuses: string[];
  };
}

interface RegisteredSource {
  id: string;
  accessStatus: string;
  citation?: string | undefined;
  limitations?: string | undefined;
  locatorsInspected?: string[] | undefined;
  supportsDetailedClaims?: boolean | undefined;
}

interface PlymouthSourceRegister {
  datasetId: string;
  policy: string;
  sources: RegisteredSource[];
  consideredButNotUsed: RegisteredSource[];
}

interface ClaimEvidenceRow {
  claimId: string;
  evidenceIds: string[];
  accountId: string;
  sourceIds: string[];
  locator: string;
  limitation: string;
  reviewRequired: boolean;
}

interface ClaimEvidenceMatrix {
  datasetId: string;
  claims: ClaimEvidenceRow[];
}

export type PlymouthCheckLevel = "pass" | "fail" | "warn" | "info";

export interface PlymouthDatasetCheck {
  code: string;
  level: PlymouthCheckLevel;
  message: string;
}

export interface PlymouthDatasetReport {
  bundleId: string;
  ready: boolean;
  counts: Record<string, number>;
  totals: Record<PlymouthCheckLevel, number>;
  checks: PlymouthDatasetCheck[];
}

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object"
    && value !== null
    && !Array.isArray(value)
  );
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function loadPlymouthBundle(): Promise<SourceRootBundle> {
  return readJson<SourceRootBundle>(PLYMOUTH_BUNDLE_PATH);
}

export async function loadPlymouthManifest(): Promise<PlymouthManifest> {
  return readJson<PlymouthManifest>(manifestPath);
}

export async function loadPlymouthSourceRegister():
Promise<PlymouthSourceRegister> {
  return readJson<PlymouthSourceRegister>(sourceRegisterPath);
}

export async function loadPlymouthClaimEvidenceMatrix():
Promise<ClaimEvidenceMatrix> {
  return readJson<ClaimEvidenceMatrix>(matrixPath);
}

function getContext(bundle: SourceRootBundle): ContextualBundle {
  if (!bundle.context) {
    throw new Error("The Plymouth bundle has no contextual payload.");
  }

  return bundle.context;
}

function entityCounts(entities: ContextEntity[]) {
  const count = (types: ContextEntity["entityType"][]) =>
    entities.filter((entity) => types.includes(entity.entityType)).length;

  return {
    people: count(["person"]),
    groups: count(["group", "organization", "cultural_community"]),
    places: count(["place"]),
    events: count(["event"]),
    documentsAndWorks: count(["document", "work"]),
    politicalJurisdictions: count(["political_jurisdiction"]),
  };
}

export function countPlymouthRecords(
  bundle: SourceRootBundle,
): Record<string, number> {
  const context = getContext(bundle);
  const entities = context.entities ?? [];
  const typedEntities = entityCounts(entities);
  const contextualRecords =
    entities.length
    + (context.temporalAssertions?.length ?? 0)
    + (context.accounts?.length ?? 0)
    + (context.claims?.length ?? 0)
    + (context.evidence?.length ?? 0)
    + (context.interpretations?.length ?? 0)
    + (context.perspectives?.length ?? 0)
    + (context.causalLinks?.length ?? 0)
    + (context.relationships?.length ?? 0)
    + (context.culturalMemories?.length ?? 0);

  return {
    ...typedEntities,
    sources: bundle.sources?.length ?? 0,
    temporalAssertions: context.temporalAssertions?.length ?? 0,
    accounts: context.accounts?.length ?? 0,
    claims: context.claims?.length ?? 0,
    evidence: context.evidence?.length ?? 0,
    interpretations: context.interpretations?.length ?? 0,
    perspectives: context.perspectives?.length ?? 0,
    perspectiveLinks: context.recordPerspectives?.length ?? 0,
    causalLinks: context.causalLinks?.length ?? 0,
    relationships: context.relationships?.length ?? 0,
    culturalMemories: context.culturalMemories?.length ?? 0,
    contextualRecords,
  };
}

function allContextRecords(context: ContextualBundle): ContextRecordBase[] {
  return [
    ...(context.entities ?? []),
    ...(context.temporalAssertions ?? []),
    ...(context.accounts ?? []),
    ...(context.claims ?? []),
    ...(context.evidence ?? []),
    ...(context.interpretations ?? []),
    ...(context.perspectives ?? []),
    ...(context.causalLinks ?? []),
    ...(context.relationships ?? []),
    ...(context.culturalMemories ?? []),
  ];
}

function recordIds(bundle: SourceRootBundle): string[] {
  return [
    ...(bundle.sources ?? [])
      .filter(isRecord)
      .map((source) => String(source.id ?? "")),
    ...allContextRecords(getContext(bundle))
      .map((record) => String(record.id ?? "")),
  ];
}

function sourceRecords(bundle: SourceRootBundle): RegisteredSource[] {
  return (bundle.sources ?? []).filter(isRecord).map((source) => ({
    id: String(source.id ?? ""),
    accessStatus: String(source.accessStatus ?? ""),
    citation:
      typeof source.citation === "string" ? source.citation : undefined,
    limitations:
      typeof source.limitations === "string"
        ? source.limitations
        : undefined,
    locatorsInspected: Array.isArray(source.locatorsInspected)
      ? source.locatorsInspected.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined,
    supportsDetailedClaims:
      typeof source.supportsDetailedClaims === "boolean"
        ? source.supportsDetailedClaims
        : undefined,
  }));
}

function containsEntityName(
  entities: ContextEntity[],
  expectedName: string,
): boolean {
  const normalized = expectedName.toLocaleLowerCase();
  return entities.some((entity) =>
    [entity.name, ...(entity.alternateNames ?? [])].some(
      (name) => name.toLocaleLowerCase() === normalized,
    ));
}

function containsForbiddenCoordinateKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenCoordinateKey);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(([key, nested]) =>
    ["latitude", "longitude", "coordinates", "geojson"].includes(
      key.toLocaleLowerCase(),
    ) || containsForbiddenCoordinateKey(nested));
}

function checkTotals(checks: PlymouthDatasetCheck[]) {
  const totals: Record<PlymouthCheckLevel, number> = {
    pass: 0,
    fail: 0,
    warn: 0,
    info: 0,
  };

  for (const check of checks) {
    totals[check.level] += 1;
  }

  return totals;
}

export async function validatePlymouthDataset():
Promise<PlymouthDatasetReport> {
  const [
    bundle,
    manifest,
    sourceRegister,
    matrix,
  ] = await Promise.all([
    loadPlymouthBundle(),
    loadPlymouthManifest(),
    loadPlymouthSourceRegister(),
    loadPlymouthClaimEvidenceMatrix(),
  ]);
  const context = getContext(bundle);
  const counts = countPlymouthRecords(bundle);
  const checks: PlymouthDatasetCheck[] = [];
  const add = (
    condition: boolean,
    code: string,
    passMessage: string,
    failMessage: string,
  ) => {
    checks.push({
      code,
      level: condition ? "pass" : "fail",
      message: condition ? passMessage : failMessage,
    });
  };
  const addInfo = (code: string, message: string) => {
    checks.push({ code, level: "info", message });
  };

  const genericValidation = validateBundle(bundle);
  add(
    genericValidation.canImport
      && genericValidation.summary.errors === 0
      && genericValidation.summary.warnings === 0,
    "GENERIC_VALIDATION",
    "The generic SourceRoot validator reports ready with no warnings.",
    `Generic validation reported ${genericValidation.summary.errors} error(s) and ${genericValidation.summary.warnings} warning(s).`,
  );
  add(
    bundle.bundleId === PLYMOUTH_BUNDLE_ID
      && manifest.bundleId === PLYMOUTH_BUNDLE_ID,
    "BUNDLE_ID",
    "Bundle and manifest use the stable Plymouth dataset ID.",
    "Bundle or manifest has an unexpected dataset ID.",
  );
  const extensionDisclaimer = isRecord(bundle.extensions)
    ? bundle.extensions.disclaimer
    : undefined;
  add(
    manifest.disclaimer === PLYMOUTH_DATASET_DISCLAIMER
      && extensionDisclaimer === PLYMOUTH_DATASET_DISCLAIMER
      && bundle.description?.startsWith(PLYMOUTH_DATASET_DISCLAIMER) === true,
    "DISCLAIMER",
    "The required pilot-review disclaimer is exact and visible.",
    "The required pilot-review disclaimer is missing or altered.",
  );

  const manifestCountsMatch = Object.entries(counts).every(
    ([name, count]) => manifest.counts[name] === count,
  );
  add(
    manifestCountsMatch,
    "MANIFEST_COUNTS",
    "Manifest counts match the generated bundle.",
    "One or more manifest counts differ from the bundle.",
  );

  for (const [name, minimum] of Object.entries(manifest.minimums)) {
    const actual =
      name === "interpretationsOrPerspectives"
        ? (counts.interpretations ?? 0) + (counts.perspectives ?? 0)
        : counts[name] ?? 0;
    add(
      actual >= minimum,
      `MINIMUM_${name.toLocaleUpperCase()}`,
      `${name} meets the minimum (${actual} >= ${minimum}).`,
      `${name} misses the minimum (${actual} < ${minimum}).`,
    );
  }

  for (const [name, [minimum, maximum]] of Object.entries(
    manifest.targets,
  )) {
    const actual = counts[name] ?? 0;
    add(
      actual >= minimum && actual <= maximum,
      `TARGET_${name.toLocaleUpperCase()}`,
      `${name} is within target (${actual}; target ${minimum}-${maximum}).`,
      `${name} is outside target (${actual}; target ${minimum}-${maximum}).`,
    );
  }

  const ids = recordIds(bundle);
  add(
    ids.every(Boolean) && new Set(ids).size === ids.length,
    "STABLE_IDS",
    "All source and contextual IDs are non-empty and unique.",
    "Source or contextual IDs are empty or duplicated.",
  );

  const requiredNames = [
    "Plymouth",
    "Patuxet",
    "Wampanoag",
    "Pokanoket",
    "Nauset",
    "Massachusett",
    "Narragansett",
    "Massasoit",
    "Ousamequin",
    "Squanto",
    "Tisquantum",
    "Wamsutta",
    "Metacom",
    "Weetamoo",
    "Awashonks",
    "Mayflower Compact",
    "King Philip's War",
  ];
  const missingNames = requiredNames.filter(
    (name) => !containsEntityName(context.entities ?? [], name),
  );
  add(
    missingNames.length === 0,
    "REQUIRED_NAMES_AND_ALIASES",
    "Required people, peoples, places, events, and aliases resolve.",
    `Required names or aliases are missing: ${missingNames.join(", ")}.`,
  );

  const eventIds = new Set(
    (context.entities ?? [])
      .filter((entity) => entity.entityType === "event")
      .map((entity) => entity.id),
  );
  const timedEventIds = new Set(
    (context.temporalAssertions ?? [])
      .filter((temporal) => eventIds.has(temporal.subjectId))
      .map((temporal) => temporal.subjectId),
  );
  add(
    eventIds.size === timedEventIds.size,
    "EVENT_TIME_COVERAGE",
    "Every event has an explicit temporal assertion.",
    `${eventIds.size - timedEventIds.size} event(s) lack temporal assertions.`,
  );
  const extensionTransition = isRecord(bundle.extensions)
    && isRecord(bundle.extensions.transitionBoundary)
    ? bundle.extensions.transitionBoundary
    : undefined;
  add(
    extensionTransition?.charterSigned === "1691-10-07"
      && extensionTransition.provinceInaugurated === "1692-05-14",
    "CHARTER_TRANSITION",
    "The 1691 charter and 1692 inauguration remain distinct.",
    "The 1691 charter and 1692 inauguration boundary is missing.",
  );
  const entityById = new Map(
    (context.entities ?? []).map((entity) => [entity.id, entity]),
  );
  add(
    entityById.get(
      "historyroot-plymouth-event-epenow-capture-return",
    )?.metadata?.coveragePeriod === "background-1605-1615"
      && entityById.get(
        "historyroot-plymouth-event-hunt-kidnappings",
      )?.metadata?.coveragePeriod === "background-1605-1615"
      && entityById.get(
        "historyroot-plymouth-event-tisquantum-atlantic-captivity",
      )?.metadata?.coveragePeriod === "background-to-core-bridge"
      && entityById.get(
        "historyroot-plymouth-event-province-inaugurated",
      )?.metadata?.coveragePeriod === "1692-transition"
      && entityById.get(
        "historyroot-plymouth-event-national-day-mourning-1970",
      )?.metadata?.coveragePeriod === "cultural-memory-afterlife",
    "CHRONOLOGICAL_SCOPE_LABELS",
    "Background, bridge, transition, and memory-afterlife events are explicitly labeled.",
    "One or more out-of-core events lacks an explicit scope label.",
  );

  const sourceMap = new Map(
    sourceRecords(bundle).map((source) => [source.id, source]),
  );
  const sourcesComplete = [...sourceMap.values()].every((source) =>
    allowedAccessStatuses.has(source.accessStatus)
    && Boolean(source.citation)
    && Boolean(source.limitations)
    && (
      source.accessStatus !== "accessed-and-inspected"
      || (source.locatorsInspected?.length ?? 0) > 0
    )
    && source.supportsDetailedClaims
      === (source.accessStatus === "accessed-and-inspected"));
  add(
    sourcesComplete,
    "SOURCE_REGISTER_FIELDS",
    "Every used source has access, citation, locator, limitation, and support metadata.",
    "One or more used sources has incomplete or inconsistent source metadata.",
  );
  const registeredSourceIds = new Set(
    sourceRegister.sources.map((source) => source.id),
  );
  add(
    sourceMap.size === registeredSourceIds.size
      && [...sourceMap.keys()].every((id) => registeredSourceIds.has(id)),
    "SOURCE_REGISTER_SYNC",
    "The source register matches every bundle source.",
    "The source register and bundle source list differ.",
  );
  const registerEntries = [
    ...sourceRegister.sources,
    ...sourceRegister.consideredButNotUsed,
  ];
  add(
    registerEntries.every((source) =>
      allowedAccessStatuses.has(source.accessStatus)),
    "SOURCE_ACCESS_VOCABULARY",
    "Every source-register entry uses an approved access status.",
    "A source-register entry uses an unrecognized access status.",
  );
  add(
    manifest.sourcePolicy.detailedClaimsRequire
      === "accessed-and-inspected"
      && sourceRegister.policy.includes("accessed-and-inspected"),
    "SOURCE_GATE_POLICY",
    "The detailed-claim inspection gate is explicit.",
    "The detailed-claim inspection gate is missing or inconsistent.",
  );

  const claims = context.claims ?? [];
  const evidence = context.evidence ?? [];
  const detailedClaimSourcesInspected = claims.every((claim) =>
    (claim.sourceIds?.length ?? 0) > 0
    && (claim.sourceIds ?? []).every(
      (sourceId) =>
        sourceMap.get(sourceId)?.accessStatus
          === "accessed-and-inspected",
    ));
  add(
    detailedClaimSourcesInspected,
    "DETAILED_CLAIM_SOURCE_GATE",
    "Every detailed claim is supported only by inspected sources.",
    "A detailed claim uses an uninspected or missing source.",
  );

  const evidenceByClaim = new Map<string, number>();
  for (const item of evidence) {
    evidenceByClaim.set(
      item.claimId,
      (evidenceByClaim.get(item.claimId) ?? 0) + 1,
    );
  }
  add(
    claims.every((claim) => (evidenceByClaim.get(claim.id) ?? 0) > 0),
    "CLAIM_EVIDENCE_COVERAGE",
    "Every claim has at least one evidence record.",
    "One or more claims has no evidence record.",
  );
  add(
    evidence.every((item) =>
      isRecord(item.metadata)
      && typeof item.metadata.locator === "string"
      && item.metadata.locator.trim().length > 0
      && typeof item.metadata.limitation === "string"
      && item.metadata.limitation.trim().length > 0),
    "EVIDENCE_LOCATORS_AND_LIMITS",
    "Every evidence record has a locator and limitation.",
    "An evidence record lacks a locator or limitation.",
  );
  add(
    matrix.claims.length === claims.length
      && matrix.claims.every((row) =>
        row.evidenceIds.length > 0
        && row.sourceIds.length > 0
        && row.locator.trim().length > 0
        && row.limitation.trim().length > 0
        && row.reviewRequired),
    "CLAIM_EVIDENCE_MATRIX",
    "The claim-evidence matrix covers every claim with review metadata.",
    "The claim-evidence matrix is incomplete.",
  );

  const relationships = context.relationships ?? [];
  const compactWitnessIds = new Set(
    relationships
      .filter((relationship) =>
        relationship.relationshipType === "textual_witness_of"
        && relationship.toId
          === "historyroot-plymouth-work-mayflower-compact-text")
      .map((relationship) => relationship.fromId),
  );
  add(
    compactWitnessIds.has(
      "historyroot-plymouth-document-mourts-1622",
    )
      && compactWitnessIds.has(
        "historyroot-plymouth-document-purchas-1625",
      )
      && compactWitnessIds.has(
        "historyroot-plymouth-document-bradford-manuscript",
      )
      && (context.entities ?? []).some((entity) =>
        entity.id
          === "historyroot-plymouth-document-mayflower-compact-original"
        && entity.metadata?.originalLost === true),
    "COMPACT_TEXTUAL_HISTORY",
    "The lost Compact original and all three early witnesses are modeled.",
    "The Compact original/witness model is incomplete.",
  );

  add(
    (context.recordPerspectives?.length ?? 0) > 0
      && (context.recordPerspectives ?? []).every(
        (link) => link.notes?.trim(),
      ),
    "PERSPECTIVE_ATTRIBUTION",
    "Perspective links are explicit and attributed with notes.",
    "Perspective attribution is absent or under-documented.",
  );
  add(
    (context.causalLinks?.length ?? 0) > 0
      && (context.causalLinks ?? []).every((link) =>
        (link.sourceIds?.length ?? 0) > 0
        && Boolean(link.uncertainty?.trim())
        && isRecord(link.metadata)
        && link.metadata.notDeterministic === true),
    "QUALIFIED_CAUSAL_LINKS",
    "Every causal link is sourced, qualified, and non-deterministic.",
    "A causal link lacks sourcing or qualification.",
  );
  add(
    (context.culturalMemories?.length ?? 0) >= 4
      && (context.culturalMemories ?? []).every((memory) =>
        Boolean(memory.sourceId)
        && Boolean(memory.perspectiveId)),
    "CULTURAL_MEMORY_ATTRIBUTION",
    "Cultural-memory records are sourced and perspective-attributed.",
    "Cultural-memory coverage or attribution is incomplete.",
  );
  add(
    !containsForbiddenCoordinateKey(bundle),
    "NO_INVENTED_COORDINATES",
    "No precise coordinates or geometry were invented.",
    "The bundle contains coordinate or geometry fields requiring review.",
  );

  addInfo(
    "SCHEMA_DECISION",
    "Migration 009 already supplies the required generic contextual model; this dataset adds no schema migration.",
  );
  addInfo(
    "HISTORICAL_ACCURACY_BOUNDARY",
    "Automated validation checks structure, provenance, and review safeguards; it is not proof of historical accuracy.",
  );

  const totals = checkTotals(checks);

  return {
    bundleId: String(bundle.bundleId ?? "unknown"),
    ready: totals.fail === 0,
    counts,
    totals,
    checks,
  };
}
