import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildExpansionInventory,
  buildQualityReview,
  renderQualityReviewMarkdown,
} from "../historyroot/corpus-quality-review.js";
import {
  losslessJsonBytes,
  validateSourcePreparationWorkspace,
} from "../source-preparation/source-preparation-engine.js";
import type {
  PreparedItem,
  SourcePreparationWorkspaceV1_1,
} from "../source-preparation/source-preparation-types.js";

type JsonObject = Record<string, unknown>;

const currentFile = fileURLToPath(import.meta.url);
const backendRoot = path.resolve(path.dirname(currentFile), "../..");
const expansionDirectory = path.join(
  backendRoot,
  "data",
  "historyroot-corpus-expansion-quality-v1",
);
const acceptedWorkspacePath = path.join(
  backendRoot,
  "data",
  "source-preparation-workflow-v1",
  "lossless-context-workspace.json",
);
const baselineInventoryPath = path.join(
  backendRoot,
  "data",
  "historyroot-foundational-corpus-v1",
  "corpus-inventory.json",
);
const workspacePath = path.join(expansionDirectory, "expansion-workspace.json");

const APPROVED_AT = "2026-07-28T12:00:00.000Z";
const APPROVED_BY = "SourceRoot Chunk 8 accepted-local-material review";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function id(item: { object: JsonObject }): string {
  return String(item.object.id ?? "");
}

function approvedItem(
  object: JsonObject,
  reviewerNotes: string,
): PreparedItem {
  return {
    preparationStatus: "approved",
    reviewerNotes,
    approvalRecord: {
      approvedBy: APPROVED_BY,
      approvedAt: APPROVED_AT,
      note: "Deterministically promoted from fields already present in the accepted Chunk 6 replacement-safe bundle.",
    },
    object,
  };
}

function baselineSets(inventory: JsonObject) {
  const requiredRecords = Array.isArray(inventory.requiredRecords)
    ? inventory.requiredRecords as JsonObject[]
    : [];
  return {
    sourceSet: new Set((inventory.sourceIds as string[] | undefined) ?? []),
    accounts: new Set((inventory.accountIds as string[] | undefined) ?? []),
    records: new Set(requiredRecords.map((item) =>
      String(item.canonicalId ?? ""))),
    claims: new Set((inventory.claimIds as string[] | undefined) ?? []),
    historicalNames: new Set(
      (inventory.historicalNameIds as string[] | undefined) ?? [],
    ),
    dateExpressions: new Set(
      (inventory.dateExpressionIds as string[] | undefined) ?? [],
    ),
    relationships: new Set(
      (inventory.relationshipIds as string[] | undefined) ?? [],
    ),
    sourceLocators: new Set(
      (inventory.locatorIds as string[] | undefined) ?? [],
    ),
    evidenceLinks: new Set(
      (inventory.evidenceLinkIds as string[] | undefined) ?? [],
    ),
    claimRelations: new Set(
      (inventory.claimRelationIds as string[] | undefined) ?? [],
    ),
  };
}

export function createExpansionWorkspace(
  accepted: SourcePreparationWorkspaceV1_1,
  baselineInventory: JsonObject,
): SourcePreparationWorkspaceV1_1 {
  const workspace = clone(accepted);
  const baseline = baselineSets(baselineInventory);
  workspace.workspaceId = "historyroot-corpus-expansion-quality-v1";
  workspace.title =
    "SourceRoot Chunk 8 — HistoryRoot Corpus Expansion and Quality Review v1";
  workspace.description =
    "Reviewed expansion of the selected Chunk 6 inventory using only accepted local material and deterministic structural promotion of already recorded locator and provenance fields.";
  workspace.reviewMetadata = {
    bundleId: "historyroot-plymouth-knowledge-dataset-v1",
    version: "1.2.0",
    createdAt: APPROVED_AT,
    createdBy: "SourceRoot HistoryRoot corpus expansion and quality review v1",
    description:
      "Replacement-safe reviewed expansion of accepted HistoryRoot material with deterministic locator, attribution, and field-provenance promotion.",
  };
  workspace.approvals = {
    approved: true,
    approvedBy: APPROVED_BY,
    approvedAt: APPROVED_AT,
    note:
      "All accepted v1.1 candidates were reviewed and selected. Previously selected Chunk 6 objects are retained; accepted objects outside that selected inventory are newly promoted; contextual and evidential objects are retained as dependencies. No accepted candidate is omitted.",
  };
  workspace.bundleFields.extensions = {
    ...(workspace.bundleFields.extensions ?? {}),
    corpusExpansionQuality: {
      corpusId: "historyroot-corpus-expansion-quality-v1",
      reviewedOn: "2026-07-28",
      baselineCorpusId: "historyroot-foundational-corpus-v1",
      acceptedLocalMaterialOnly: true,
      noExternalResearch: true,
      noCompositeScore: true,
      noArtificialVersionHistory: true,
    },
  };

  const principalCollections = [
    "sourceSet",
    "accounts",
    "records",
    "claims",
    "historicalNames",
    "dateExpressions",
    "relationships",
    "sourceLocators",
    "evidenceLinks",
    "claimRelations",
  ] as const;
  for (const name of principalCollections) {
    const selected = baseline[name];
    for (const item of workspace[name]) {
      item.reviewerNotes = selected.has(id(item))
        ? "Previously selected in the Chunk 6 foundational inventory; retained unchanged."
        : "Newly promoted from accepted local material beyond the selected Chunk 6 inventory.";
      item.approvalRecord = {
        approvedBy: APPROVED_BY,
        approvedAt: APPROVED_AT,
        note: "Reviewed without new historical research.",
      };
    }
  }
  for (const name of [
    "evidence",
    "fieldProvenance",
    "claimAttributions",
    "interpretations",
    "perspectives",
    "perspectiveLinks",
    "causalLinks",
    "culturalMemories",
  ] as const) {
    for (const item of workspace[name]) {
      item.reviewerNotes =
        "Dependency-only accepted object retained to preserve attribution, evidence, provenance, or contextual relationships.";
      item.approvalRecord = {
        approvedBy: APPROVED_BY,
        approvedAt: APPROVED_AT,
        note: "Reviewed without new historical research.",
      };
    }
  }

  const selectedClaimIds = baseline.claims;
  const existingAttributionIds = new Set(
    workspace.claimAttributions.map(id),
  );
  const existingLocatorEvidenceIds = new Set(
    workspace.sourceLocators.map((item) =>
      String(item.object.evidenceId ?? "")),
  );
  const existingClaimProvenance = new Set(
    workspace.fieldProvenance
      .filter((item) => String(item.object.fieldPath ?? "") === "statement")
      .map((item) => String(item.object.targetId ?? "")),
  );
  const evidenceByClaimId = new Map(
    workspace.evidence.map((item) => [
      String(item.object.claimId ?? ""),
      item.object,
    ]),
  );

  for (const claimItem of workspace.claims) {
    const claim = claimItem.object;
    const claimId = String(claim.id ?? "");
    if (selectedClaimIds.has(claimId)) continue;
    const suffix = claimId.replace(/^historyroot-plymouth-claim-/, "");
    const sourceIds = Array.isArray(claim.sourceIds)
      ? claim.sourceIds.map(String)
      : [];
    const sourceId = sourceIds[0] ?? "";
    const evidence = evidenceByClaimId.get(claimId);
    if (!evidence || !sourceId) {
      throw new Error(
        `Accepted expansion claim lacks evidence or source dependency: ${claimId}`,
      );
    }
    const attributionId = `ctx-attribution-${suffix}`;
    if (!existingAttributionIds.has(attributionId)) {
      workspace.claimAttributions.push(approvedItem({
        id: attributionId,
        claimId,
        accountId: String(claim.accountId ?? ""),
        attributionRole: "reported_by",
        sourceIds,
        note:
          "Attribution preserves the accepted reporting account and source path; it does not convert provenance into proof.",
      }, "Newly promoted deterministic attribution from the accepted claim reporting path."));
    }
    const evidenceId = String(evidence.id ?? "");
    const acceptedLocator = String(
      (claim.metadata as JsonObject | undefined)?.locator
      ?? (evidence.metadata as JsonObject | undefined)?.locator
      ?? "",
    ).trim();
    if (!acceptedLocator) {
      throw new Error(
        `Accepted expansion claim lacks a bounded locator string: ${claimId}`,
      );
    }
    if (!existingLocatorEvidenceIds.has(evidenceId)) {
      workspace.sourceLocators.push(approvedItem({
        id: `ctx-locator-${suffix}`,
        evidenceId,
        sourceId,
        locatorType: "citation",
        locatorLabel: acceptedLocator,
        locator: {
          acceptedReference: acceptedLocator,
        },
        note:
          "The structured citation preserves the accepted local locator string exactly; no external locator was researched or invented.",
      }, "Newly promoted exact accepted locator string from the accepted claim and evidence metadata."));
    }
    if (!existingClaimProvenance.has(claimId)) {
      workspace.fieldProvenance.push(approvedItem({
        id: `ctx-provenance-claim-${suffix}-statement`,
        targetId: claimId,
        fieldPath: "statement",
        sourceId,
        supportType: "reporting-provenance",
        note:
          "Field provenance preserves the accepted claim source path and is not a truth or evidence score.",
      }, "Newly promoted deterministic field provenance from the accepted claim source path."));
    }
  }
  return workspace;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const initialize = args.includes("--initialize-workspace");
  const outputFlag = args.indexOf("--output-directory");
  const outputDirectory = outputFlag >= 0
    ? path.resolve(args[outputFlag + 1] ?? "")
    : expansionDirectory;
  const baselineInventory = await readJson<JsonObject>(baselineInventoryPath);
  await mkdir(outputDirectory, { recursive: true });

  if (initialize) {
    const accepted = await readJson<SourcePreparationWorkspaceV1_1>(
      acceptedWorkspacePath,
    );
    const workspace = createExpansionWorkspace(
      accepted,
      baselineInventory,
    );
    const bytes = losslessJsonBytes(workspace);
    await mkdir(path.dirname(workspacePath), { recursive: true });
    await writeFile(workspacePath, bytes);
  }

  const workspaceBytes = await readFile(workspacePath);
  const workspace = JSON.parse(
    workspaceBytes.toString("utf8"),
  ) as SourcePreparationWorkspaceV1_1;
  const result = validateSourcePreparationWorkspace(workspace, "generate");
  if (!result.report.readyForGeneration || !result.bundle
    || !result.bundleBytes) {
    throw new Error(
      `Expansion workspace is not generation-ready: ${result.report.issues.map((issue) => `${issue.code}:${issue.path}`).join("; ")}`,
    );
  }
  const inventory = buildExpansionInventory({
    workspace,
    workspaceBytes,
    bundle: result.bundle,
    bundleBytes: result.bundleBytes,
    baselineInventory,
  });
  const quality = buildQualityReview({
    workspace,
    bundle: result.bundle,
    inventory,
  });
  if (quality.findingCounts.blocker > 0) {
    throw new Error(
      `Quality review found ${quality.findingCounts.blocker} blocker(s): ${quality.findings.filter((item) => item.level === "blocker").map((item) => item.ruleId).join(", ")}`,
    );
  }
  await Promise.all([
    writeFile(
      path.join(
        outputDirectory,
        "historyroot-corpus-expansion-quality-v1.bundle.json",
      ),
      result.bundleBytes,
    ),
    writeFile(
      path.join(outputDirectory, "corpus-inventory.json"),
      losslessJsonBytes(inventory),
    ),
    writeFile(
      path.join(outputDirectory, "quality-review.json"),
      losslessJsonBytes(quality),
    ),
    writeFile(
      path.join(outputDirectory, "quality-review.md"),
      renderQualityReviewMarkdown(quality),
      "utf8",
    ),
  ]);
  console.log(JSON.stringify({
    workspaceSchemaVersion: workspace.schemaVersion,
    bundleBytes: result.bundleBytes.length,
    bundleSha256: inventory.bundle.sha256,
    counts: inventory.counts,
    deltas: inventory.deltaFromSelectedChunk6,
    findings: quality.findingCounts,
  }, null, 2));
}

run().catch((error: unknown) => {
  console.error("HistoryRoot corpus expansion generation failed:", error);
  process.exitCode = 1;
});
