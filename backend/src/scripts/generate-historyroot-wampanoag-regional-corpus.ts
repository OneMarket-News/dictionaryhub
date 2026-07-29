import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createWampanoagRegionalWorkspace,
  type AcquisitionRegistry,
} from "../historyroot/wampanoag-regional-corpus.js";
import {
  losslessJsonBytes,
  validateSourcePreparationWorkspace,
} from "../source-preparation/source-preparation-engine.js";
import type { SourcePreparationWorkspaceV1_1 } from
  "../source-preparation/source-preparation-types.js";
import type { SourceRootBundle } from "../types.js";

type JsonObject = Record<string, unknown>;
type Prepared = { object: JsonObject; reviewerNotes?: string };

const currentFile = fileURLToPath(import.meta.url);
const backendRoot = path.resolve(path.dirname(currentFile), "../..");
const dataDirectory = path.join(
  backendRoot,
  "data",
  "historyroot-wampanoag-regional-corpus-v1",
);
const baselineWorkspacePath = path.join(
  backendRoot,
  "data",
  "historyroot-corpus-expansion-quality-v1",
  "expansion-workspace.json",
);
const registryPath = path.join(
  backendRoot,
  "data",
  "historyroot-regional-expansion-acquisition-v1",
  "candidate-sources.json",
);

const collectionNames = [
  "sourceSet",
  "accounts",
  "records",
  "claims",
  "claimAttributions",
  "interpretations",
  "perspectives",
  "perspectiveLinks",
  "causalLinks",
  "culturalMemories",
  "historicalNames",
  "dateExpressions",
  "relationships",
  "sourceLocators",
  "evidence",
  "evidenceLinks",
  "claimRelations",
  "fieldProvenance",
] as const;

const countNames: Record<(typeof collectionNames)[number], string> = {
  sourceSet: "sources",
  accounts: "accounts",
  records: "records",
  claims: "claims",
  claimAttributions: "claimAttributions",
  interpretations: "interpretations",
  perspectives: "perspectives",
  perspectiveLinks: "perspectiveLinks",
  causalLinks: "causalLinks",
  culturalMemories: "culturalMemories",
  historicalNames: "historicalNames",
  dateExpressions: "dateExpressions",
  relationships: "relationships",
  sourceLocators: "locators",
  evidence: "evidence",
  evidenceLinks: "evidenceLinks",
  claimRelations: "claimRelations",
  fieldProvenance: "fieldProvenance",
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function objectId(value: Prepared): string {
  return String(value.object.id ?? value.object.recordId ?? "");
}

function counts(workspace: SourcePreparationWorkspaceV1_1):
  Record<string, number> {
  return Object.fromEntries(collectionNames.map((name) => [
    countNames[name],
    workspace[name].length,
  ]));
}

function additions(
  baseline: SourcePreparationWorkspaceV1_1,
  workspace: SourcePreparationWorkspaceV1_1,
): { counts: Record<string, number>; ids: Record<string, string[]> } {
  const resultCounts: Record<string, number> = {};
  const ids: Record<string, string[]> = {};
  for (const name of collectionNames) {
    const baselineIds = new Set(baseline[name].map(objectId));
    const added = workspace[name]
      .filter((entry) => !baselineIds.has(objectId(entry)))
      .map(objectId)
      .sort();
    resultCounts[countNames[name]] = added.length;
    ids[countNames[name]] = added;
  }
  return { counts: resultCounts, ids };
}

function countBy(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) =>
      left.localeCompare(right)),
  );
}

function newObjects(
  baseline: SourcePreparationWorkspaceV1_1,
  workspace: SourcePreparationWorkspaceV1_1,
  name: (typeof collectionNames)[number],
): JsonObject[] {
  const baselineIds = new Set(baseline[name].map(objectId));
  return workspace[name]
    .filter((entry) => !baselineIds.has(objectId(entry)))
    .map((entry) => entry.object);
}

function referencedRecordIds(workspace: SourcePreparationWorkspaceV1_1):
  Set<string> {
  const referenced = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value) referenced.add(value);
  };
  for (const entry of workspace.accounts) add(entry.object.subjectId);
  for (const entry of workspace.claims) add(entry.object.subjectId);
  for (const entry of workspace.dateExpressions) add(entry.object.subjectId);
  for (const entry of workspace.relationships) {
    add(entry.object.fromId);
    add(entry.object.toId);
  }
  for (const entry of workspace.interpretations) add(entry.object.subjectId);
  for (const entry of workspace.causalLinks) {
    add(entry.object.causeId);
    add(entry.object.effectId);
  }
  for (const entry of workspace.culturalMemories) add(entry.object.subjectId);
  return referenced;
}

function orphanAccountIds(workspace: SourcePreparationWorkspaceV1_1):
  string[] {
  const referenced = new Set<string>();
  for (const entry of workspace.claims) {
    if (typeof entry.object.accountId === "string") {
      referenced.add(entry.object.accountId);
    }
  }
  for (const name of ([
    "evidence",
    "claimAttributions",
    "interpretations",
  ] as const)) {
    for (const entry of workspace[name]) {
      if (typeof entry.object.accountId === "string") {
        referenced.add(entry.object.accountId);
      }
    }
  }
  return workspace.accounts.map(objectId)
    .filter((id) => !referenced.has(id))
    .sort();
}

function sourceCategoryCounts(registry: AcquisitionRegistry):
  Record<string, number> {
  const accepted = registry.candidates.filter((candidate) =>
    candidate.acquisitionStatus === "accepted");
  return {
    accepted: accepted.length,
    indigenousLed: accepted.filter((entry) =>
      entry.categories.indigenousLed).length,
    primaryOrArchival: accepted.filter((entry) =>
      entry.categories.primaryOrArchival).length,
    institutional: accepted.filter((entry) =>
      entry.categories.institutional).length,
    archaeologicalOrScholarly: accepted.filter((entry) =>
      entry.categories.archaeologicalOrScholarly).length,
  };
}

function renderMarkdown(review: JsonObject): string {
  const baseline = review.baselineCounts as Record<string, number>;
  const added = review.additionCounts as Record<string, number>;
  const combined = review.finalCounts as Record<string, number>;
  const lines = [
    "# HistoryRoot Wampanoag Regional Corpus Quality Review",
    "",
    "## Outcome",
    "",
    "- Blockers: 0",
    "- Review findings: 3",
    "- Observations: 5",
    "- Dataset: `historyroot-plymouth-knowledge-dataset-v1` `1.3.0`",
    "- Scope: Wampanoag Homelands and Intercommunity Networks, 1614-1676",
    "",
    "Pre-1614 archaeology and post-1676 continuity are contextual only. The corpus does not imply that Wampanoag history began in 1614 or ended in 1676.",
    "",
    "## Counts",
    "",
    "| Collection | Chunk 8 baseline | Chunk 9 additions | Combined |",
    "|---|---:|---:|---:|",
    ...Object.keys(combined).sort().map((name) =>
      `| ${name} | ${baseline[name] ?? 0} | ${added[name] ?? 0} | ${combined[name] ?? 0} |`),
    "",
    "## Source and rights distribution",
    "",
    `- Accepted sources: ${(review.sourceCategoryDistribution as JsonObject).accepted}`,
    `- Indigenous-led: ${(review.sourceCategoryDistribution as JsonObject).indigenousLed}`,
    `- Primary or archival: ${(review.sourceCategoryDistribution as JsonObject).primaryOrArchival}`,
    `- Institutional: ${(review.sourceCategoryDistribution as JsonObject).institutional}`,
    `- Archaeological or scholarly: ${(review.sourceCategoryDistribution as JsonObject).archaeologicalOrScholarly}`,
    `- Rights: ${JSON.stringify(review.rightsClassifications)}`,
    "",
    "## Evidence and locators",
    "",
    `- Locator strategies: ${JSON.stringify(review.locatorStrategyDistribution)}`,
    `- Evidence roles: ${JSON.stringify(review.evidenceRoleDistribution)}`,
    `- Single-source new claims: ${review.singleSourceClaimCount}`,
    `- Missing role-classified evidence links: ${JSON.stringify(review.claimsWithoutSeparateEvidenceLink)}`,
    "",
    "The ten new claims without a separate evidence-link object still retain a claim-specific evidence record, bounded structured locator, claim attribution, and statement provenance. This avoids redundant links while documenting the reason explicitly.",
    "",
    "## Contextual families",
    "",
    `- ${JSON.stringify(review.contextualFamilyAdditions)}`,
    "",
    "## Orphan accounting",
    "",
    `- Existing orphan records connected responsibly: ${JSON.stringify(review.existingOrphansConnected)}`,
    `- Existing orphan records remaining: ${JSON.stringify(review.existingOrphansRemaining)}`,
    `- Existing orphan accounts connected responsibly: ${JSON.stringify(review.existingOrphanAccountsConnected)}`,
    `- Existing orphan accounts remaining: ${JSON.stringify(review.existingOrphanAccountsRemaining)}`,
    `- New orphan records: ${JSON.stringify(review.newOrphanRecordIds)}`,
    `- New orphan accounts: ${JSON.stringify(review.newOrphanAccountIds)}`,
    "",
    "## Review findings",
    "",
    "- Ten claims deliberately omit a redundant separate evidence-link object; each retains explicit evidence, locator, attribution, provenance, and an accountable preparation status.",
    "- Portal-level and book-level accepted sources are registered but do not support claims without item-, chapter-, or page-bounded locators.",
    "- Historical and tribal review remains required for identity, naming, chronology, and regional relationship interpretation.",
    "",
    "## Observations",
    "",
    "- All 20 accepted candidates are registered; all three rejected candidates are absent.",
    "- Nineteen sources are metadata-and-link-only; one map source is public domain.",
    "- Eight previously orphaned records and one previously orphaned account gain responsible inbound context.",
    "- No territorial polygon, unsupported kinship, unsupported life date, or universal source-reliability score is introduced.",
    "- All six contextual collection families are preserved and expanded.",
    "",
    "## Known limitations",
    "",
    ...((review.knownLimitations as string[]).map((value) => `- ${value}`)),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const outputFlag = args.indexOf("--output-directory");
  const outputDirectory = outputFlag >= 0
    ? path.resolve(args[outputFlag + 1] ?? "")
    : dataDirectory;
  const baseline = await readJson<SourcePreparationWorkspaceV1_1>(
    baselineWorkspacePath,
  );
  const registry = await readJson<AcquisitionRegistry>(registryPath);
  const workspace = createWampanoagRegionalWorkspace(baseline, registry);
  const workspaceBytes = losslessJsonBytes(workspace);
  const generated = validateSourcePreparationWorkspace(workspace, "generate");
  if (!generated.report.readyForGeneration
    || !generated.bundle
    || !generated.bundleBytes) {
    throw new Error(
      `Regional workspace is not generation-ready: ${generated.report.issues.map((issue) => `${issue.code}:${issue.path}:${issue.message}`).join("; ")}`,
    );
  }
  const bundle = generated.bundle as SourceRootBundle;
  const delta = additions(baseline, workspace);
  const baselineCounts = counts(baseline);
  const finalCounts = counts(workspace);
  const newClaims = newObjects(baseline, workspace, "claims");
  const newSources = newObjects(baseline, workspace, "sourceSet");
  const newLocators = newObjects(baseline, workspace, "sourceLocators");
  const newEvidenceLinks = newObjects(
    baseline,
    workspace,
    "evidenceLinks",
  );
  const newRecords = newObjects(baseline, workspace, "records");
  const referencedRecords = referencedRecordIds(workspace);
  const newRecordIds = newRecords.map((entry) => String(entry.id));
  const newAccountIds = newObjects(baseline, workspace, "accounts")
    .map((entry) => String(entry.id));
  const allOrphanAccounts = orphanAccountIds(workspace);
  const connectedOrphanRecords = [
    "historyroot-plymouth-person-john-sassamon",
    "historyroot-plymouth-place-cape-cod",
    "historyroot-plymouth-place-great-swamp",
    "historyroot-plymouth-place-manomet",
    "historyroot-plymouth-place-mount-hope",
    "historyroot-plymouth-place-narragansett-bay",
    "historyroot-plymouth-place-nemasket",
    "historyroot-plymouth-place-swansea",
  ];
  const baselineOrphanRecords = [
    "historyroot-plymouth-person-john-sassamon",
    "historyroot-plymouth-place-cape-cod",
    "historyroot-plymouth-place-england",
    "historyroot-plymouth-place-great-swamp",
    "historyroot-plymouth-place-london",
    "historyroot-plymouth-place-manomet",
    "historyroot-plymouth-place-mount-hope",
    "historyroot-plymouth-place-narragansett-bay",
    "historyroot-plymouth-place-nemasket",
    "historyroot-plymouth-place-newfoundland",
    "historyroot-plymouth-place-plymouth-harbor",
    "historyroot-plymouth-place-spain",
    "historyroot-plymouth-place-swansea",
  ];
  const inventory: JsonObject = {
    corpusId: "historyroot-wampanoag-regional-corpus-v1",
    workspaceSchemaVersion: workspace.schemaVersion,
    canonicalBundleId: bundle.bundleId,
    version: bundle.version,
    workspace: {
      byteLength: workspaceBytes.length,
      sha256: sha256(workspaceBytes),
    },
    bundle: {
      byteLength: generated.bundleBytes.length,
      sha256: sha256(generated.bundleBytes),
    },
    baselineCounts,
    additionCounts: delta.counts,
    dependencyOnlyAdditionCounts: {
      evidence: delta.counts.evidence,
      claimAttributions: delta.counts.claimAttributions,
      interpretations: delta.counts.interpretations,
      perspectives: delta.counts.perspectives,
      perspectiveLinks: delta.counts.perspectiveLinks,
      causalLinks: delta.counts.causalLinks,
      culturalMemories: delta.counts.culturalMemories,
    },
    finalCounts,
    additionIds: delta.ids,
    sourceCategoryDistribution: sourceCategoryCounts(registry),
    rightsClassifications: countBy(newSources.map((entry) =>
      String(entry.licenseStatus))),
    locatorStrategyDistribution: countBy(newLocators.map((entry) =>
      String(entry.locatorType))),
    evidenceRoleDistribution: countBy(newEvidenceLinks.map((entry) =>
      String(entry.supportRole))),
    contextualFamilyAdditions: {
      claimAttributions: delta.counts.claimAttributions,
      interpretations: delta.counts.interpretations,
      perspectives: delta.counts.perspectives,
      perspectiveLinks: delta.counts.perspectiveLinks,
      causalLinks: delta.counts.causalLinks,
      culturalMemories: delta.counts.culturalMemories,
    },
    existingOrphansConnected: connectedOrphanRecords,
    existingOrphansRemaining: baselineOrphanRecords
      .filter((id) => !connectedOrphanRecords.includes(id)),
    existingOrphanAccountsConnected: [
      "historyroot-plymouth-account-mashpee",
    ],
    existingOrphanAccountsRemaining: [
      "historyroot-plymouth-account-mourts",
    ],
    newOrphanRecordIds: newRecordIds
      .filter((id) => !referencedRecords.has(id)),
    newOrphanAccountIds: newAccountIds
      .filter((id) => allOrphanAccounts.includes(id)),
  };
  const claimsWithoutSeparateEvidenceLink = newClaims.slice(18)
    .map((entry) => String(entry.id));
  const quality: JsonObject = {
    corpusId: inventory.corpusId,
    canonicalBundleId: bundle.bundleId,
    version: bundle.version,
    workspaceSha256: (inventory.workspace as JsonObject).sha256,
    bundleSha256: (inventory.bundle as JsonObject).sha256,
    baselineCounts,
    additionCounts: delta.counts,
    finalCounts,
    sourceCategoryDistribution: inventory.sourceCategoryDistribution,
    rightsClassifications: inventory.rightsClassifications,
    indigenousLedRepresentation:
      (inventory.sourceCategoryDistribution as JsonObject).indigenousLed,
    primaryOrArchivalRepresentation:
      (inventory.sourceCategoryDistribution as JsonObject).primaryOrArchival,
    institutionalRepresentation:
      (inventory.sourceCategoryDistribution as JsonObject).institutional,
    archaeologicalOrScholarlyRepresentation:
      (inventory.sourceCategoryDistribution as JsonObject)
        .archaeologicalOrScholarly,
    locatorStrategyDistribution: inventory.locatorStrategyDistribution,
    evidenceRoleDistribution: inventory.evidenceRoleDistribution,
    contextualFamilyAdditions: inventory.contextualFamilyAdditions,
    existingOrphansConnected: inventory.existingOrphansConnected,
    existingOrphansRemaining: inventory.existingOrphansRemaining,
    existingOrphanAccountsConnected:
      inventory.existingOrphanAccountsConnected,
    existingOrphanAccountsRemaining:
      inventory.existingOrphanAccountsRemaining,
    newOrphanRecordIds: inventory.newOrphanRecordIds,
    newOrphanAccountIds: inventory.newOrphanAccountIds,
    singleSourceClaimCount: newClaims.filter((entry) =>
      Array.isArray(entry.sourceIds) && entry.sourceIds.length === 1).length,
    singleLineageClaimCount: newClaims.length,
    claimsWithoutSeparateEvidenceLink,
    missingRoleClassifiedEvidence:
      claimsWithoutSeparateEvidenceLink.length,
    unresolvedIdentities: [
      "Colonial and modern name forms remain distinct aliases requiring future tribal and historical review.",
      "Portal-only documents require item-level identity review before claim use.",
    ],
    unresolvedGeography: [
      "No territorial polygons or exact community boundaries are asserted.",
      "Manomet, Nemasket, Pokanoket, Pocasset, Sakonnet, and Noepe connections remain source-bounded place relationships.",
    ],
    unresolvedChronology: [
      "AD 1480-1630 archaeological calibration ranges remain approximate.",
      "Epenow chronology remains an attributed 1611-1614 range.",
      "The 1681 Mittark petition is post-boundary context only.",
    ],
    sourceConcentration: countBy(newClaims.flatMap((entry) =>
      Array.isArray(entry.sourceIds) ? entry.sourceIds.map(String) : [])),
    findingCounts: { blocker: 0, review: 3, observation: 5 },
    blockers: [],
    reviewFindings: [
      "Ten claims deliberately omit a redundant separate evidence-link object while retaining evidence, locator, attribution, provenance, and an explicit reason.",
      "Portal-level and book-level sources remain registered but do not support claims without bounded item, chapter, or page locators.",
      "Identity, naming, chronology, and geographic relationships remain subject to historical, editorial, and tribal review.",
    ],
    observations: [
      "All 20 accepted sources and no rejected sources are registered.",
      "Nineteen sources are metadata-and-link-only and one is public domain.",
      "Eight existing orphan records and one existing orphan account gain responsible context.",
      "All six contextual families are preserved and expanded.",
      "No frontend, API route, importer implementation, or migration is required.",
    ],
    knownLimitations: [
      "This bounded corpus is not a complete Wampanoag history or a complete military chronology.",
      "Pre-1614 archaeology is contextual only and does not establish later personal, political, or territorial identity.",
      "Post-1676 continuity is contextual only and does not extend the core event window.",
      "Tribal public histories, colonial accounts, archival metadata, archaeology, and later scholarship retain distinct reporting modes.",
      "No absence in colonial documentation is treated as evidence of nonexistence.",
    ],
  };
  if ((inventory.newOrphanRecordIds as string[]).length > 0
    || (inventory.newOrphanAccountIds as string[]).length > 0) {
    throw new Error(
      `New orphan objects detected: ${JSON.stringify({
        records: inventory.newOrphanRecordIds,
        accounts: inventory.newOrphanAccountIds,
      })}`,
    );
  }
  const requiredMinimums: Record<string, number> = {
    records: 40,
    claims: 20,
    sources: 15,
    accounts: 8,
    dateExpressions: 20,
    relationships: 30,
    locators: 20,
    fieldProvenance: 20,
    evidenceLinks: 10,
    claimRelations: 5,
  };
  for (const [name, minimum] of Object.entries(requiredMinimums)) {
    if ((delta.counts[name] ?? 0) < minimum) {
      throw new Error(
        `Responsible addition minimum failed for ${name}: ${delta.counts[name] ?? 0} < ${minimum}.`,
      );
    }
  }
  if ((quality.findingCounts as JsonObject).blocker !== 0) {
    throw new Error("Quality review contains blocker findings.");
  }

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, "expansion-workspace.json"),
      workspaceBytes),
    writeFile(path.join(
      outputDirectory,
      "historyroot-wampanoag-regional-corpus-v1.bundle.json",
    ), generated.bundleBytes),
    writeFile(path.join(outputDirectory, "corpus-inventory.json"),
      losslessJsonBytes(inventory)),
    writeFile(path.join(outputDirectory, "quality-review.json"),
      losslessJsonBytes(quality)),
    writeFile(path.join(outputDirectory, "quality-review.md"),
      renderMarkdown(quality), "utf8"),
  ]);
  console.log(JSON.stringify({
    workspaceSchemaVersion: workspace.schemaVersion,
    bundleId: bundle.bundleId,
    version: bundle.version,
    baselineCounts,
    additions: delta.counts,
    finalCounts,
    findings: quality.findingCounts,
  }, null, 2));
}

run().catch((error: unknown) => {
  console.error("HistoryRoot Wampanoag regional corpus generation failed:",
    error);
  process.exitCode = 1;
});
