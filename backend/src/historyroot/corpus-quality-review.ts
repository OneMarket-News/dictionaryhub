import { createHash } from "node:crypto";

import type { SourcePreparationWorkspaceV1_1 } from "../source-preparation/source-preparation-types.js";
import type { SourceRootBundle } from "../types.js";
import { validateBundle } from "../services/validator.js";

export type FindingLevel = "blocker" | "review" | "observation";

export interface QualityFinding {
  findingId: string;
  ruleId: string;
  level: FindingLevel;
  objectIds: string[];
  explanation: string;
  recommendedHumanAction?: string;
}

type JsonObject = Record<string, unknown>;

export interface ExpansionInventory {
  corpusId: string;
  workspaceSchemaVersion: "1.1.0";
  workspaceSha256: string;
  bundle: {
    bundleId: string;
    version: string;
    byteLength: number;
    sha256: string;
  };
  ids: Record<string, string[]>;
  counts: Record<string, number>;
  preparationStatusCounts: Record<string, number>;
  rightsClassificationCounts: Record<string, number>;
  evidenceRoleCounts: Record<string, number>;
  selectedChunk6Counts: Record<string, number>;
  deltaFromSelectedChunk6: Record<string, number>;
  newlyPromotedObjectIds: Record<string, string[]>;
  dependencyOnlyObjectIds: string[];
  omittedCandidates: Array<{ id: string; reason: string }>;
}

export interface QualityReview {
  corpusId: string;
  workspaceSha256: string;
  bundleSha256: string;
  reviewedObjectCounts: Record<string, number>;
  deltaFromSelectedChunk6: Record<string, number>;
  newlyPromotedCounts: Record<string, number>;
  dependencyOnlyCount: number;
  omittedCandidateCount: number;
  rightsSummary: Record<string, number>;
  preparationStatusSummary: Record<string, number>;
  sourceAccountDiversity: {
    sources: number;
    reportingAccounts: number;
  };
  locatorCoverage: {
    claims: number;
    claimsWithStructuredLocator: number;
    claimsMissingStructuredLocator: string[];
  };
  provenanceCoverage: {
    records: number;
    recordsWithFieldProvenance: number;
    claims: number;
    claimsWithFieldProvenance: number;
  };
  evidenceRoleDistribution: Record<string, number>;
  contextualCollectionCoverage: Record<string, number>;
  sourceLineageConcentration: Array<{
    sourceId: string;
    claimCount: number;
  }>;
  orphanCounts: {
    records: number;
    sources: number;
    accounts: number;
  };
  duplicateCandidateCounts: {
    canonicalIds: number;
    normalizedClaimStatements: number;
  };
  versionHistoryReview: {
    claimVersions: number;
    evidenceVersions: number;
    artificialVersions: number;
  };
  findingCounts: Record<FindingLevel, number>;
  findings: QualityFinding[];
  knownLimitations: string[];
  futureResearchCategories: string[];
}

const collectionMap = {
  sources: "sources",
  accounts: "accounts",
  records: "entities",
  claims: "claims",
  claimAttributions: "claimAttributions",
  interpretations: "interpretations",
  perspectives: "perspectives",
  perspectiveLinks: "recordPerspectives",
  causalLinks: "causalLinks",
  culturalMemories: "culturalMemories",
  historicalNames: "aliases",
  dateExpressions: "temporalAssertions",
  relationships: "relationships",
  locators: "sourceLocators",
  evidence: "evidence",
  evidenceLinks: "evidenceClaimLinks",
  claimRelations: "claimRelations",
  fieldProvenance: "fieldProvenance",
} as const;

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function sortedIds(value: unknown): string[] {
  return objects(value)
    .map((item) => String(item.id ?? ""))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function countValues(values: string[]): Record<string, number> {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [
      value,
      values.filter((candidate) => candidate === value).length,
    ]),
  );
}

function allPrepared(workspace: SourcePreparationWorkspaceV1_1) {
  return [
    ...workspace.sourceSet,
    ...workspace.accounts,
    ...workspace.records,
    ...workspace.claims,
    ...workspace.historicalNames,
    ...workspace.dateExpressions,
    ...workspace.relationships,
    ...workspace.sourceLocators,
    ...workspace.evidence,
    ...workspace.evidenceLinks,
    ...workspace.claimRelations,
    ...workspace.fieldProvenance,
    ...workspace.claimAttributions,
    ...workspace.interpretations,
    ...workspace.perspectives,
    ...workspace.perspectiveLinks,
    ...workspace.causalLinks,
    ...workspace.culturalMemories,
  ];
}

function contextCollection(
  bundle: SourceRootBundle,
  name: (typeof collectionMap)[keyof typeof collectionMap],
): JsonObject[] {
  if (name === "sources") {
    return objects(bundle.sources);
  }
  return objects((bundle.context as unknown as JsonObject | undefined)?.[name]);
}

function duplicateIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
    .sort();
}

function normalizeStatement(value: unknown): string {
  return String(value ?? "").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function buildExpansionInventory(input: {
  workspace: SourcePreparationWorkspaceV1_1;
  workspaceBytes: Buffer;
  bundle: SourceRootBundle;
  bundleBytes: Buffer;
  baselineInventory: JsonObject;
}): ExpansionInventory {
  const { workspace, workspaceBytes, bundle, bundleBytes, baselineInventory } =
    input;
  const ids: Record<string, string[]> = Object.fromEntries(
    Object.entries(collectionMap).map(([inventoryName, bundleName]) => [
      inventoryName,
      inventoryName === "perspectiveLinks"
        ? contextCollection(bundle, bundleName)
          .map((item) =>
            `${String(item.recordId ?? "")}->${String(item.perspectiveId ?? "")}`)
          .filter((value) => value !== "->")
          .sort()
        : sortedIds(contextCollection(bundle, bundleName)),
    ]),
  );
  const baselineCounts = baselineInventory.counts as JsonObject;
  const selectedChunk6Counts: Record<string, number> = {
    records: Number(baselineCounts.requiredRecords ?? 0),
    sources: Number(baselineCounts.sources ?? 0),
    accounts: Number(baselineCounts.accounts ?? 0),
    claims: Number(baselineCounts.claims ?? 0),
    relationships: Number(baselineCounts.relationships ?? 0),
    historicalNames: Number(baselineCounts.historicalNames ?? 0),
    dateExpressions: Number(baselineCounts.dateExpressions ?? 0),
    locators: Number(baselineCounts.locators ?? 0),
    evidenceLinks: Number(baselineCounts.evidenceLinks ?? 0),
    claimRelations: Number(baselineCounts.claimRelations ?? 0),
    fieldProvenance: Number(baselineCounts.fieldProvenance ?? 0),
  };
  const counts = Object.fromEntries(
    Object.entries(ids).map(([name, values]) => [name, values.length]),
  );
  const deltaFromSelectedChunk6 = Object.fromEntries(
    Object.entries(selectedChunk6Counts).map(([name, count]) => [
      name,
      Number(counts[name] ?? 0) - count,
    ]),
  );
  const prepared = allPrepared(workspace);
  const newlyPromotedObjectIds: Record<string, string[]> = Object.fromEntries(
    Object.entries(collectionMap).map(([name]) => [
      name,
      prepared
        .filter((item) =>
          item.preparationStatus === "approved"
          && item.reviewerNotes?.startsWith("Newly promoted"))
        .map((item) =>
          name === "perspectiveLinks"
            ? `${String(item.object.recordId ?? "")}->${String(item.object.perspectiveId ?? "")}`
            : "preparationId" in item
            ? String(item.preparationId)
            : String(item.object.id ?? ""))
        .filter((id) => ids[name]?.includes(id))
        .sort(),
    ]),
  );
  const dependencyOnlyObjectIds: string[] = prepared
    .filter((item) =>
      item.preparationStatus === "approved"
      && item.reviewerNotes?.startsWith("Dependency-only"))
    .map((item) =>
      "preparationId" in item
        ? String(item.preparationId)
        : String(item.object.id ?? ""))
    .filter(Boolean)
    .sort();

  return {
    corpusId: "historyroot-corpus-expansion-quality-v1",
    workspaceSchemaVersion: "1.1.0",
    workspaceSha256: sha256(workspaceBytes),
    bundle: {
      bundleId: String(bundle.bundleId),
      version: String(bundle.version),
      byteLength: bundleBytes.length,
      sha256: sha256(bundleBytes),
    },
    ids,
    counts,
    preparationStatusCounts: countValues(
      prepared.map((item) => item.preparationStatus),
    ),
    rightsClassificationCounts: countValues(
      workspace.sourceSet.map((source) => source.rightsReview.classification),
    ),
    evidenceRoleCounts: countValues(
      contextCollection(bundle, "evidenceClaimLinks").map((link) =>
        String(link.supportRole ?? "missing")),
    ),
    selectedChunk6Counts,
    deltaFromSelectedChunk6,
    newlyPromotedObjectIds,
    dependencyOnlyObjectIds,
    omittedCandidates: prepared
      .filter((item) => item.preparationStatus === "omitted")
      .map((item) => ({
        id: "preparationId" in item
          ? String(item.preparationId)
          : String(item.object.id ?? ""),
        reason: item.omissionReason ?? "",
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function finding(
  ruleId: string,
  level: FindingLevel,
  objectIds: string[],
  explanation: string,
  recommendedHumanAction?: string,
): QualityFinding {
  const key = `${ruleId}\n${[...objectIds].sort().join("\n")}\n${explanation}`;
  const suffix = createHash("sha256").update(key).digest("hex").slice(0, 12);
  return {
    findingId: `${ruleId.toLocaleLowerCase("en-US")}-${suffix}`,
    ruleId,
    level,
    objectIds: [...objectIds].sort(),
    explanation,
    ...(recommendedHumanAction ? { recommendedHumanAction } : {}),
  };
}

export function buildQualityReview(input: {
  workspace: SourcePreparationWorkspaceV1_1;
  bundle: SourceRootBundle;
  inventory: ExpansionInventory;
}): QualityReview {
  const { workspace, bundle, inventory } = input;
  const context = (bundle.context ?? {}) as unknown as JsonObject;
  const records = objects(context.entities);
  const claims = objects(context.claims);
  const sources = objects(bundle.sources);
  const accounts = objects(context.accounts);
  const locators = objects(context.sourceLocators);
  const provenance = objects(context.fieldProvenance);
  const evidenceLinks = objects(context.evidenceClaimLinks);
  const findings: QualityFinding[] = [];
  const bundleValidation = validateBundle(bundle);

  for (const issue of bundleValidation.errors) {
    findings.push(finding(
      `STRUCTURE-${issue.code}`,
      "blocker",
      [String(issue.objectId ?? "")].filter(Boolean),
      issue.message,
      "Correct the accepted-local-material dependency or structure before release.",
    ));
  }
  for (const issue of bundleValidation.warnings) {
    findings.push(finding(
      `STRUCTURE-WARNING-${issue.code}`,
      "blocker",
      [String(issue.objectId ?? "")].filter(Boolean),
      issue.message,
      "Resolve the bundle-schema warning before release.",
    ));
  }

  const allIds = Object.values(collectionMap).flatMap((name) =>
    sortedIds(contextCollection(bundle, name)));
  const duplicateCanonicalIds = duplicateIds(allIds);
  if (duplicateCanonicalIds.length > 0) {
    findings.push(finding(
      "DUPLICATE-CANONICAL-ID",
      "blocker",
      duplicateCanonicalIds,
      "Canonical IDs are duplicated across generated collections.",
      "Preserve one accepted canonical object for each ID.",
    ));
  }

  const normalizedClaims = claims.map((claim) => ({
    id: String(claim.id ?? ""),
    normalized: normalizeStatement(claim.statement),
  })).filter((claim) => claim.normalized);
  const claimsByStatement = new Map<
    string,
    Array<{ id: string; normalized: string }>
  >();
  normalizedClaims.forEach((claim) => {
    claimsByStatement.set(claim.normalized, [
      ...(claimsByStatement.get(claim.normalized) ?? []),
      claim,
    ]);
  });
  const duplicateClaimGroups = [...claimsByStatement.values()]
    .filter((group) => group.length > 1);
  if (duplicateClaimGroups.length > 0) {
    findings.push(finding(
      "DUPLICATE-CLAIM-CANDIDATE",
      "review",
      duplicateClaimGroups.flatMap((group) =>
        (group ?? []).map((claim) => claim.id)),
      "Two or more accepted claims have identical normalized statements.",
      "Review whether the distinct accepted attributions justify retaining each claim.",
    ));
  }

  const recordIds = new Set(records.map((item) => String(item.id ?? "")));
  const sourceIds = new Set(sources.map((item) => String(item.id ?? "")));
  const accountIds = new Set(accounts.map((item) => String(item.id ?? "")));
  const referencedRecords = new Set<string>();
  const referencedSources = new Set<string>();
  const referencedAccounts = new Set<string>();
  const walkReferences = (value: unknown, field = ""): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => walkReferences(item, field));
      return;
    }
    if (!value || typeof value !== "object") {
      if (typeof value !== "string") return;
      if (["subjectId", "objectId", "fromId", "toId", "entityId", "recordId",
        "causeId", "effectId", "actorEntityId"].includes(field)
        && recordIds.has(value)) referencedRecords.add(value);
      if (["sourceId", "sourceIds"].includes(field) && sourceIds.has(value)) {
        referencedSources.add(value);
      }
      if (field === "accountId" && accountIds.has(value)) {
        referencedAccounts.add(value);
      }
      return;
    }
    Object.entries(value as JsonObject).forEach(([key, nested]) =>
      walkReferences(nested, key));
  };
  Object.values(context).forEach((value) => walkReferences(value));

  const orphanRecords = [...recordIds].filter((id) =>
    !referencedRecords.has(id));
  const orphanSources = [...sourceIds].filter((id) =>
    !referencedSources.has(id));
  const orphanAccounts = [...accountIds].filter((id) =>
    !referencedAccounts.has(id));
  for (const [ruleId, ids, label] of [
    ["ORPHAN-RECORD", orphanRecords, "records"],
    ["ORPHAN-SOURCE", orphanSources, "sources"],
    ["ORPHAN-ACCOUNT", orphanAccounts, "reporting accounts"],
  ] as const) {
    if (ids.length > 0) {
      findings.push(finding(
        ruleId,
        "review",
        ids,
        `${ids.length} accepted ${label} have no inbound reviewed corpus reference.`,
        "Retain as a disclosed accepted-local-material limitation or omit in a future reviewed selection.",
      ));
    }
  }

  const locatorClaimIds = new Set(locators.map((locator) => {
    const evidenceId = String(locator.evidenceId ?? "");
    const evidence = objects(context.evidence).find((candidate) =>
      String(candidate.id ?? "") === evidenceId);
    return String(evidence?.claimId ?? "");
  }).filter(Boolean));
  const missingLocatorClaimIds = claims.map((claim) => String(claim.id ?? ""))
    .filter((id) => !locatorClaimIds.has(id));
  if (missingLocatorClaimIds.length > 0) {
    findings.push(finding(
      "MISSING-STRUCTURED-LOCATOR",
      "blocker",
      missingLocatorClaimIds,
      "One or more reviewed claims lack an exact or bounded structured source locator.",
      "Promote only accepted locator material; do not invent a locator.",
    ));
  }

  const claimProvenanceIds = new Set(provenance
    .filter((item) => String(item.fieldPath ?? "") === "statement")
    .map((item) => String(item.targetId ?? "")));
  const missingClaimProvenance = claims.map((claim) => String(claim.id ?? ""))
    .filter((id) => !claimProvenanceIds.has(id));
  if (missingClaimProvenance.length > 0) {
    findings.push(finding(
      "MISSING-CLAIM-PROVENANCE",
      "blocker",
      missingClaimProvenance,
      "One or more reviewed claim statements lack field provenance.",
      "Add only provenance paths already present in accepted local material.",
    ));
  }

  const prepared = allPrepared(workspace);
  const unapproved = prepared.filter((item) =>
    !["approved", "omitted"].includes(item.preparationStatus));
  if (unapproved.length > 0) {
    findings.push(finding(
      "UNAPPROVED-OBJECT-LEAKAGE",
      "blocker",
      unapproved.map((item) =>
        "preparationId" in item
          ? String(item.preparationId)
          : String(item.object.id ?? "")),
      "Draft or needs-review objects remain in the release workspace.",
      "Approve or explicitly omit every candidate before generation.",
    ));
  }
  const incompatibleRights = workspace.sourceSet.filter((source) =>
    source.contentUse.containsCopiedExcerpt
    && ["restricted", "unknown", "metadata_and_link_only"].includes(
      source.rightsReview.classification,
    ));
  if (incompatibleRights.length > 0) {
    findings.push(finding(
      "RIGHTS-USE-CONFLICT",
      "blocker",
      incompatibleRights.map((source) => String(source.object.id ?? "")),
      "Copied excerpts conflict with the reviewed rights classification.",
      "Remove the copied excerpt or supply an accepted affirmative rights basis.",
    ));
  }

  const minimumDeltas: Record<string, number> = {
    records: 5,
    claims: 10,
    sources: 3,
    locators: 5,
    fieldProvenance: 5,
  };
  Object.entries(minimumDeltas).forEach(([name, minimum]) => {
    if (Number(inventory.deltaFromSelectedChunk6[name] ?? 0) < minimum) {
      findings.push(finding(
        `MATERIAL-DELTA-${name.toUpperCase()}`,
        "blocker",
        [],
        `${name} expansion is below the mandatory delta of ${minimum}.`,
        "Acquire additional accepted source material rather than reducing the minimum.",
      ));
    }
  });

  const contextualCollectionCoverage = {
    claimAttributions: objects(context.claimAttributions).length,
    interpretations: objects(context.interpretations).length,
    perspectives: objects(context.perspectives).length,
    perspectiveLinks: objects(context.recordPerspectives).length,
    causalLinks: objects(context.causalLinks).length,
    culturalMemories: objects(context.culturalMemories).length,
  };
  const requiredContextualCounts = {
    claimAttributions: 25,
    interpretations: 12,
    perspectives: 10,
    perspectiveLinks: 18,
    causalLinks: 18,
    culturalMemories: 6,
  };
  Object.entries(requiredContextualCounts).forEach(([name, minimum]) => {
    if (Number(contextualCollectionCoverage[
      name as keyof typeof contextualCollectionCoverage
    ]) < minimum) {
      findings.push(finding(
        `CONTEXTUAL-COLLECTION-${name.toUpperCase()}`,
        "blocker",
        [],
        `${name} fell below the accepted v1.1 compatibility count ${minimum}.`,
        "Restore the accepted collection and every dependency.",
      ));
    }
  });

  const sourceClaimCounts = new Map<string, number>();
  claims.forEach((claim) => {
    const claimSources = Array.isArray(claim.sourceIds)
      ? claim.sourceIds.map(String)
      : [];
    [...new Set(claimSources)].forEach((id) =>
      sourceClaimCounts.set(id, (sourceClaimCounts.get(id) ?? 0) + 1));
  });
  const sourceLineageConcentration = [...sourceClaimCounts.entries()]
    .map(([sourceId, claimCount]) => ({ sourceId, claimCount }))
    .sort((left, right) =>
      right.claimCount - left.claimCount
      || left.sourceId.localeCompare(right.sourceId));
  const concentrated = sourceLineageConcentration.filter((item) =>
    item.claimCount >= Math.ceil(claims.length / 4));
  if (concentrated.length > 0) {
    findings.push(finding(
      "SOURCE-LINEAGE-CONCENTRATION",
      "review",
      concentrated.map((item) => item.sourceId),
      "One or more accepted sources report at least one quarter of reviewed claims; this is a concentration observation, not a credibility judgment.",
      "Prioritize genuinely independent accepted source lineages in future research.",
    ));
  }

  const claimsWithExplicitEvidence = new Set(
    evidenceLinks.map((link) => String(link.claimId ?? "")),
  );
  const provenanceOnlyClaims = claims.map((claim) => String(claim.id ?? ""))
    .filter((id) => !claimsWithExplicitEvidence.has(id));
  if (provenanceOnlyClaims.length > 0) {
    findings.push(finding(
      "NO-SEPARATE-EVIDENCE-LINK",
      "review",
      provenanceOnlyClaims,
      "These claims retain accepted reporting provenance and locators but have no separate role-classified evidence link.",
      "Review qualifying, disputing, or supporting evidence without converting provenance into proof.",
    ));
  }

  const singleLineageClaims = claims
    .filter((claim) =>
      Array.isArray(claim.sourceIds) && claim.sourceIds.length === 1)
    .map((claim) => String(claim.id ?? ""));
  if (singleLineageClaims.length > 0) {
    findings.push(finding(
      "SINGLE-REPORTING-LINEAGE",
      "review",
      singleLineageClaims,
      "These accepted claims currently have one reporting source lineage; no truth judgment is implied.",
      "Seek independent source categories during broader regional expansion.",
    ));
  }

  const claimVersions = objects(context.claimVersions).length;
  const evidenceVersions = objects(context.evidenceVersions).length;
  if (claimVersions > 0 || evidenceVersions > 0) {
    findings.push(finding(
      "ARTIFICIAL-VERSION-HISTORY",
      "blocker",
      [
        ...sortedIds(context.claimVersions),
        ...sortedIds(context.evidenceVersions),
      ],
      "Chunk 8 may not fabricate claim or evidence version history.",
      "Remove every unaccepted version object.",
    ));
  }

  const qualifyingCount = evidenceLinks.filter((link) =>
    ["qualifies", "disputes", "contradicts"].includes(
      String(link.supportRole ?? ""),
    )).length;
  findings.push(finding(
    "EVIDENCE-ROLE-SEPARATION",
    "observation",
    [],
    `${qualifyingCount} accepted evidence links retain qualifying, disputing, or contradicting roles distinct from support.`,
  ));
  findings.push(finding(
    "OMISSION-DOCUMENTATION",
    "observation",
    inventory.omittedCandidates.map((item) => item.id),
    inventory.omittedCandidates.length === 0
      ? "Every accepted v1.1 candidate was selected; there are no deliberately omitted candidates."
      : "Every deliberately omitted candidate has a deterministic reason.",
  ));

  findings.sort((left, right) =>
    left.level.localeCompare(right.level)
    || left.ruleId.localeCompare(right.ruleId)
    || left.findingId.localeCompare(right.findingId));
  const findingCounts = {
    blocker: findings.filter((item) => item.level === "blocker").length,
    review: findings.filter((item) => item.level === "review").length,
    observation: findings.filter((item) =>
      item.level === "observation").length,
  };
  const provenanceTargets = new Set(
    provenance.map((item) => String(item.targetId ?? "")),
  );

  return {
    corpusId: inventory.corpusId,
    workspaceSha256: inventory.workspaceSha256,
    bundleSha256: inventory.bundle.sha256,
    reviewedObjectCounts: inventory.counts,
    deltaFromSelectedChunk6: inventory.deltaFromSelectedChunk6,
    newlyPromotedCounts: Object.fromEntries(
      Object.entries(inventory.newlyPromotedObjectIds).map(([name, ids]) => [
        name,
        ids.length,
      ]),
    ),
    dependencyOnlyCount: inventory.dependencyOnlyObjectIds.length,
    omittedCandidateCount: inventory.omittedCandidates.length,
    rightsSummary: inventory.rightsClassificationCounts,
    preparationStatusSummary: inventory.preparationStatusCounts,
    sourceAccountDiversity: {
      sources: sources.length,
      reportingAccounts: accounts.length,
    },
    locatorCoverage: {
      claims: claims.length,
      claimsWithStructuredLocator: locatorClaimIds.size,
      claimsMissingStructuredLocator: missingLocatorClaimIds,
    },
    provenanceCoverage: {
      records: records.length,
      recordsWithFieldProvenance: records.filter((record) =>
        provenanceTargets.has(String(record.id ?? ""))).length,
      claims: claims.length,
      claimsWithFieldProvenance: claims.filter((claim) =>
        provenanceTargets.has(String(claim.id ?? ""))).length,
    },
    evidenceRoleDistribution: inventory.evidenceRoleCounts,
    contextualCollectionCoverage,
    sourceLineageConcentration,
    orphanCounts: {
      records: orphanRecords.length,
      sources: orphanSources.length,
      accounts: orphanAccounts.length,
    },
    duplicateCandidateCounts: {
      canonicalIds: duplicateCanonicalIds.length,
      normalizedClaimStatements: duplicateClaimGroups.length,
    },
    versionHistoryReview: {
      claimVersions,
      evidenceVersions,
      artificialVersions: claimVersions + evidenceVersions,
    },
    findingCounts,
    findings,
    knownLimitations: [
      "The corpus remains bounded to already accepted local Patuxet, Plymouth, Pokanoket, and later regional material.",
      "Reporting-source concentration and single-lineage claims remain disclosed review needs rather than credibility or truth judgments.",
      "Newly structured locator and provenance records preserve accepted strings and source paths; no external locator validation occurred.",
      "No legal or rights certification was performed.",
    ],
    futureResearchCategories: [
      "Independent Indigenous-authored and tribal-institutional source lineages",
      "Additional archival editions with exact page, folio, or line locators",
      "Broader regional corpus expansion and product adoption",
    ],
  };
}

export function renderQualityReviewMarkdown(review: QualityReview): string {
  const lines = [
    "# HistoryRoot Corpus Expansion and Quality Review v1",
    "",
    `- Corpus: \`${review.corpusId}\``,
    `- Workspace SHA-256: \`${review.workspaceSha256}\``,
    `- Bundle SHA-256: \`${review.bundleSha256}\``,
    `- Blockers: ${review.findingCounts.blocker}`,
    `- Review findings: ${review.findingCounts.review}`,
    `- Observations: ${review.findingCounts.observation}`,
    "",
    "This report evaluates deterministic structure, provenance, rights-use compatibility, and review coverage. It does not assign a truth, credibility, confidence, reliability, or composite quality score.",
    "",
    "## Reviewed counts",
    "",
    "| Collection | Count | Delta from selected Chunk 6 |",
    "|---|---:|---:|",
    ...Object.keys(review.reviewedObjectCounts).sort().map((name) =>
      `| ${name} | ${review.reviewedObjectCounts[name]} | ${review.deltaFromSelectedChunk6[name] ?? "—"} |`),
    "",
    "## Rights classifications",
    "",
    ...Object.entries(review.rightsSummary).sort().map(([name, count]) =>
      `- ${name}: ${count}`),
    "",
    "## Evidence roles",
    "",
    ...Object.entries(review.evidenceRoleDistribution).sort()
      .map(([name, count]) => `- ${name}: ${count}`),
    "",
    "## Contextual collection coverage",
    "",
    ...Object.entries(review.contextualCollectionCoverage).sort()
      .map(([name, count]) => `- ${name}: ${count}`),
    "",
    "## Findings",
    "",
    ...review.findings.flatMap((item) => [
      `### ${item.findingId}`,
      "",
      `- Rule: \`${item.ruleId}\``,
      `- Level: ${item.level}`,
      `- Objects: ${item.objectIds.length > 0 ? item.objectIds.map((id) => `\`${id}\``).join(", ") : "None"}`,
      "",
      item.explanation,
      ...(item.recommendedHumanAction
        ? ["", `Recommended human action: ${item.recommendedHumanAction}`]
        : []),
      "",
    ]),
    "## Known limitations",
    "",
    ...review.knownLimitations.map((item) => `- ${item}`),
    "",
    "## Future research categories",
    "",
    ...review.futureResearchCategories.map((item) => `- ${item}`),
    "",
  ];
  return lines.join("\n");
}
