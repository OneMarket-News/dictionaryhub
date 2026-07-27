import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ContextRecordBase } from "../contextual-types.js";
import type { SourceRootBundle } from "../types.js";
import { validateBundle } from "../services/validator.js";

export const FOUNDATIONAL_CORPUS_ID =
  "historyroot-foundational-corpus-v1";
export const FOUNDATIONAL_CORPUS_BUNDLE_ID =
  "historyroot-plymouth-knowledge-dataset-v1";

const currentFile = fileURLToPath(import.meta.url);
export const FOUNDATIONAL_CORPUS_DIRECTORY = path.resolve(
  path.dirname(currentFile),
  "../../data/historyroot-foundational-corpus-v1",
);
export const FOUNDATIONAL_CORPUS_BUNDLE_PATH = path.join(
  FOUNDATIONAL_CORPUS_DIRECTORY,
  `${FOUNDATIONAL_CORPUS_ID}.bundle.json`,
);
export const FOUNDATIONAL_CORPUS_INVENTORY_PATH = path.join(
  FOUNDATIONAL_CORPUS_DIRECTORY,
  "corpus-inventory.json",
);
export const FOUNDATIONAL_CORPUS_SOURCE_REGISTER_PATH = path.join(
  FOUNDATIONAL_CORPUS_DIRECTORY,
  "source-register.json",
);

export interface FoundationalCorpusRecordMapping {
  requestedId: string;
  canonicalId: string;
  entityType: string;
  identityDecision: string;
}

export interface FoundationalCorpusOmittedRecord {
  requestedId: string;
  status: "omitted";
  reason: string;
}

export interface FoundationalCorpusInventory {
  corpusId: string;
  bundleId: string;
  version: string;
  generatedOn: string;
  requiredRecords: FoundationalCorpusRecordMapping[];
  optionalRecords: FoundationalCorpusOmittedRecord[];
  sourceIds: string[];
  accountIds: string[];
  claimIds: string[];
  relationshipIds: string[];
  historicalNameIds: string[];
  dateExpressionIds: string[];
  locatorIds: string[];
  evidenceLinkIds: string[];
  claimRelationIds: string[];
  counts: {
    requiredRecords: number;
    optionalRecords: number;
    sources: number;
    accounts: number;
    claims: number;
    relationships: number;
    historicalNames: number;
    dateExpressions: number;
    locators: number;
    evidenceLinks: number;
    evidenceLinksByRole: Record<string, number>;
    fieldProvenance: number;
    claimRelations: number;
    claimVersions: number;
    evidenceVersions: number;
  };
  [key: string]: unknown;
}

export interface FoundationalCorpusSourceRegister {
  corpusId: string;
  reviewedOn: string;
  policy: string;
  rightsRule: string;
  sources: Array<Record<string, unknown> & {
    id: string;
  }>;
}

export interface FoundationalCorpusReport {
  corpusId: string;
  bundleId: string;
  ready: boolean;
  failures: string[];
  counts: FoundationalCorpusInventory["counts"];
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function loadFoundationalCorpusBundle():
Promise<SourceRootBundle> {
  return readJson<SourceRootBundle>(FOUNDATIONAL_CORPUS_BUNDLE_PATH);
}

export async function loadFoundationalCorpusInventory():
Promise<FoundationalCorpusInventory> {
  return readJson<FoundationalCorpusInventory>(
    FOUNDATIONAL_CORPUS_INVENTORY_PATH,
  );
}

export async function loadFoundationalCorpusSourceRegister():
Promise<FoundationalCorpusSourceRegister> {
  return readJson<FoundationalCorpusSourceRegister>(
    FOUNDATIONAL_CORPUS_SOURCE_REGISTER_PATH,
  );
}

function allContextRecords(bundle: SourceRootBundle): ContextRecordBase[] {
  const context = bundle.context;
  if (!context) {
    return [];
  }
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

export async function validateFoundationalCorpus():
Promise<FoundationalCorpusReport> {
  const [bundle, inventory, sourceRegister] = await Promise.all([
    loadFoundationalCorpusBundle(),
    loadFoundationalCorpusInventory(),
    loadFoundationalCorpusSourceRegister(),
  ]);
  const failures: string[] = [];
  const validation = validateBundle(bundle);
  const context = bundle.context;
  const recordIds = new Set(allContextRecords(bundle).map(
    (record) => record.id,
  ));
  const sourceIds = new Set(
    (bundle.sources ?? [])
      .filter(
        (source): source is Record<string, unknown> =>
          typeof source === "object"
          && source !== null
          && !Array.isArray(source),
      )
      .map((source) => String(source.id ?? "")),
  );

  if (!validation.canImport || validation.summary.errors !== 0) {
    failures.push(
      `Accepted bundle schema reported ${validation.summary.errors} error(s).`,
    );
  }
  if (validation.summary.warnings !== 0) {
    failures.push(
      `Accepted bundle schema reported ${validation.summary.warnings} warning(s).`,
    );
  }
  if (bundle.bundleId !== FOUNDATIONAL_CORPUS_BUNDLE_ID) {
    failures.push("Replacement bundle identity is incorrect.");
  }
  if (inventory.corpusId !== FOUNDATIONAL_CORPUS_ID) {
    failures.push("Corpus inventory identity is incorrect.");
  }
  if (sourceRegister.corpusId !== FOUNDATIONAL_CORPUS_ID) {
    failures.push("Source register identity is incorrect.");
  }
  if (inventory.requiredRecords.length !== 8) {
    failures.push("The required eight-record network is incomplete.");
  }
  for (const record of inventory.requiredRecords) {
    if (!recordIds.has(record.canonicalId)) {
      failures.push(
        `Required canonical record is missing: ${record.canonicalId}`,
      );
    }
  }
  for (const sourceId of inventory.sourceIds) {
    if (!sourceIds.has(sourceId)) {
      failures.push(`Selected source is missing: ${sourceId}`);
    }
  }
  if (
    sourceRegister.sources.length !== inventory.counts.sources
    || inventory.sourceIds.length !== inventory.counts.sources
  ) {
    failures.push("Source-register counts do not match the inventory.");
  }
  if (
    (context?.claims ?? []).filter(
      (claim) => inventory.claimIds.includes(claim.id),
    ).length !== inventory.counts.claims
  ) {
    failures.push("Selected-claim counts do not match the inventory.");
  }
  if (
    (context?.sourceLocators ?? []).length
      !== inventory.counts.locators
  ) {
    failures.push("Locator counts do not match the inventory.");
  }
  if (
    (context?.evidenceClaimLinks ?? []).length
      !== inventory.counts.evidenceLinks
  ) {
    failures.push("Evidence-link counts do not match the inventory.");
  }
  if (
    (context?.claimVersions ?? []).length !== 0
    || (context?.evidenceVersions ?? []).length !== 0
  ) {
    failures.push("Artificial version history is present.");
  }

  return {
    corpusId: inventory.corpusId,
    bundleId: inventory.bundleId,
    ready: failures.length === 0,
    failures,
    counts: inventory.counts,
  };
}
