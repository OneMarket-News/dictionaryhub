import { createHash } from "node:crypto";

import {
  evidenceSupportRoles,
  sourceLocatorTypes,
  type ContextualBundle,
} from "../contextual-types.js";
import { validateBundle } from "../services/validator.js";
import type { SourceRootBundle } from "../types.js";
import {
  findForbiddenPreparationFields,
  sourcePreparationWorkspaceSchema,
} from "./source-preparation-schema.js";
import {
  LOSSLESS_PREPARATION_SCHEMA_VERSION,
  PREPARATION_SCHEMA_VERSION,
  contentUseModes,
  preparationStatuses,
  rightsClassifications,
  type PreparedItem,
  type PreparedLinkItem,
  type PreparationIssue,
  type PreparationMode,
  type PreparationResult,
  type SourcePreparationReport,
  type SourcePreparationWorkspace,
} from "./source-preparation-types.js";

const collections = [
  "sourceSet", "accounts", "records", "claims", "historicalNames",
  "dateExpressions", "relationships", "sourceLocators", "evidence",
  "evidenceLinks", "claimRelations", "fieldProvenance",
] as const;

const losslessCollections = [
  "claimAttributions", "interpretations", "perspectives",
  "perspectiveLinks", "causalLinks", "culturalMemories",
] as const;

type CollectionName =
  | (typeof collections)[number]
  | (typeof losslessCollections)[number];
type PreparationEntry = PreparedItem | PreparedLinkItem;

function identifier(item: PreparationEntry): string {
  return "preparationId" in item
    ? item.preparationId
    : String(item.object.id ?? "");
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map(canonicalValue);
    if (normalized.every((item) =>
      item && typeof item === "object"
      && typeof (item as Record<string, unknown>).id === "string")) {
      normalized.sort((left, right) =>
        String((left as Record<string, unknown>).id).localeCompare(
          String((right as Record<string, unknown>).id),
        ));
    }
    return normalized;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalValue(nested)]),
  );
}

export function canonicalJsonBytes(value: unknown): Buffer {
  return Buffer.from(
    `${JSON.stringify(canonicalValue(value), null, 2)}\n`,
    "utf8",
  );
}

export function losslessJsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function issue(
  code: string,
  category: PreparationIssue["category"],
  path: string,
  message: string,
): PreparationIssue {
  return { code, category, path, message, blocking: true };
}

function approved(
  items: PreparationEntry[],
): Record<string, unknown>[] {
  return items
    .filter((item) => item.preparationStatus === "approved")
    .map((item) => structuredClone(item.object));
}

function buildBundle(
  workspace: SourcePreparationWorkspace,
): SourceRootBundle {
  if (workspace.schemaVersion === LOSSLESS_PREPARATION_SCHEMA_VERSION) {
    const context = {
      entities: approved(workspace.records),
      temporalAssertions: approved(workspace.dateExpressions),
      accounts: approved(workspace.accounts),
      claims: approved(workspace.claims),
      evidence: approved(workspace.evidence),
      interpretations: approved(workspace.interpretations),
      perspectives: approved(workspace.perspectives),
      recordPerspectives: approved(workspace.perspectiveLinks),
      causalLinks: approved(workspace.causalLinks),
      relationships: approved(workspace.relationships),
      culturalMemories: approved(workspace.culturalMemories),
      aliases: approved(workspace.historicalNames),
      claimAttributions: approved(workspace.claimAttributions),
      claimRelations: approved(workspace.claimRelations),
      sourceLocators: approved(workspace.sourceLocators),
      evidenceClaimLinks: approved(workspace.evidenceLinks),
      claimVersions: [],
      evidenceVersions: [],
      fieldProvenance: approved(workspace.fieldProvenance),
    } as unknown as ContextualBundle;
    return {
      bundleId: workspace.reviewMetadata.bundleId,
      bundleType: workspace.bundleFields.bundleType,
      version: workspace.reviewMetadata.version,
      domain: workspace.domain,
      createdAt: workspace.reviewMetadata.createdAt,
      createdBy: workspace.reviewMetadata.createdBy,
      description: workspace.reviewMetadata.description,
      nodes: structuredClone(workspace.bundleFields.nodes),
      assertions: structuredClone(workspace.bundleFields.assertions),
      edges: structuredClone(workspace.bundleFields.edges),
      sources: approved(workspace.sourceSet),
      revisions: structuredClone(workspace.bundleFields.revisions),
      context,
      ...(workspace.bundleFields.extensions === undefined
        ? {}
        : { extensions: structuredClone(workspace.bundleFields.extensions) }),
    };
  }
  const context = {
    entities: approved(workspace.records),
    accounts: approved(workspace.accounts),
    claims: approved(workspace.claims),
    aliases: approved(workspace.historicalNames),
    temporalAssertions: approved(workspace.dateExpressions),
    relationships: approved(workspace.relationships),
    sourceLocators: approved(workspace.sourceLocators),
    evidence: approved(workspace.evidence),
    evidenceClaimLinks: approved(workspace.evidenceLinks),
    claimRelations: approved(workspace.claimRelations),
    fieldProvenance: approved(workspace.fieldProvenance),
    claimVersions: [],
    evidenceVersions: [],
  } as unknown as ContextualBundle;
  return {
    bundleId: workspace.reviewMetadata.bundleId,
    bundleType: "sourceroot-import-bundle",
    version: workspace.reviewMetadata.version,
    domain: workspace.domain,
    createdAt: workspace.reviewMetadata.createdAt,
    createdBy: workspace.reviewMetadata.createdBy,
    description: workspace.reviewMetadata.description,
    nodes: [],
    assertions: [],
    edges: [],
    sources: approved(workspace.sourceSet),
    revisions: [],
    context,
    extensions: {
      sourcePreparation: {
        schemaVersion: PREPARATION_SCHEMA_VERSION,
        workspaceId: workspace.workspaceId,
      },
    },
  };
}

function allItems(workspace: SourcePreparationWorkspace): Array<{
  collection: CollectionName;
  item: PreparationEntry;
}> {
  const base = collections.flatMap((collection) =>
    workspace[collection].map((item) => ({ collection, item })));
  if (workspace.schemaVersion === PREPARATION_SCHEMA_VERSION) {
    return base;
  }
  return [
    ...base,
    ...losslessCollections.flatMap((collection) =>
      workspace[collection].map((item) => ({ collection, item }))),
  ];
}

function countBy(values: string[], keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [
    key,
    values.filter((value) => value === key).length,
  ]));
}

export function validateSourcePreparationWorkspace(
  input: unknown,
  mode: PreparationMode,
): PreparationResult {
  const issues: PreparationIssue[] = [];
  const forbidden = findForbiddenPreparationFields(input);
  for (const path of forbidden) {
    issues.push(issue(
      "UNSUPPORTED_TRUTH_SCORING_FIELD",
      "structure",
      path,
      "Truth scoring, combined confidence, automated conclusions, and automatic conflict resolution are not preparation fields.",
    ));
  }
  const parsed = sourcePreparationWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    for (const schemaIssue of parsed.error.issues) {
      issues.push(issue(
        "INVALID_PREPARATION_STRUCTURE",
        "structure",
        schemaIssue.path.join(".") || "$",
        schemaIssue.message,
      ));
    }
    const report: SourcePreparationReport = {
      schemaVersion: PREPARATION_SCHEMA_VERSION,
      workspaceId: "unknown",
      mode,
      preview: mode === "preview",
      readyForGeneration: false,
      issues,
      counts: {},
      rightsSummary: {},
      contentUseSummary: {},
      statusSummary: {},
      locatorSummary: {},
      evidenceRoleSummary: {},
      omittedItems: [],
      resolvedReferences: { checked: 0, unresolved: 0 },
    };
    return { report };
  }
  const workspace = parsed.data as SourcePreparationWorkspace;
  const entries = allItems(workspace);
  const ids = new Map<string, {
    collection: CollectionName;
    item: PreparationEntry;
  }>();
  for (const entry of entries) {
    const id = identifier(entry.item);
    if (ids.has(id)) {
      issues.push(issue(
        "DUPLICATE_PREPARATION_ID",
        "structure",
        `${entry.collection}.${id}`,
        `Duplicate object ID ${id}.`,
      ));
    } else {
      ids.set(id, entry);
    }
  }
  const canonicalIdentities = new Map<string, string>();
  for (const record of workspace.records) {
    const metadata = record.object.metadata;
    const canonicalId = metadata && typeof metadata === "object"
      ? String(
        (metadata as Record<string, unknown>).canonicalIdentity ?? "",
      ).trim()
      : "";
    if (!canonicalId) continue;
    const prior = canonicalIdentities.get(canonicalId);
    if (prior && prior !== identifier(record)) {
      issues.push(issue(
        "CANONICAL_IDENTITY_COLLISION",
        "structure",
        identifier(record),
        `Canonical identity ${canonicalId} is also supplied by ${prior}.`,
      ));
    } else {
      canonicalIdentities.set(canonicalId, identifier(record));
    }
  }

  for (const source of workspace.sourceSet) {
    const id = identifier(source);
    const classification = source.rightsReview.classification;
    if (
      classification === "public_domain"
      && !source.rightsReview.basis
    ) {
      issues.push(issue("RIGHTS_BASIS_REQUIRED", "rights", id,
        "Public-domain classification requires a supplied basis."));
    }
    if (
      classification === "open_license"
      && !source.rightsReview.licenseIdentifier
    ) {
      issues.push(issue("LICENSE_IDENTIFIER_REQUIRED", "rights", id,
        "Open-license classification requires a license identifier."));
    }
    if (
      classification === "permission_granted"
      && !source.rightsReview.permissionBasis
    ) {
      issues.push(issue("PERMISSION_BASIS_REQUIRED", "rights", id,
        "Permission-granted classification requires a supplied basis."));
    }
    const copied = source.contentUse.containsCopiedExcerpt;
    if (copied && ["unknown", "restricted", "metadata_and_link_only"].includes(
      classification,
    )) {
      issues.push(issue("COPIED_EXCERPT_BLOCKED", "rights", id,
        `Copied excerpts are incompatible with ${classification} rights.`));
    }
    if (
      source.contentUse.mode === "public_domain_excerpt"
      && classification !== "public_domain"
    ) {
      issues.push(issue("INCOMPATIBLE_CONTENT_USE", "rights", id,
        "Public-domain excerpts require public-domain classification."));
    }
    if (
      source.contentUse.mode === "short_quote"
      && !["open_license", "permission_granted", "public_domain"].includes(
        classification,
      )
    ) {
      issues.push(issue("INCOMPATIBLE_CONTENT_USE", "rights", id,
        "Short quotes require an affirmative supplied rights basis."));
    }
  }

  const approvedIds = new Set(
    entries.filter(({ item }) => item.preparationStatus === "approved")
      .map(({ item }) => identifier(item)),
  );
  let referencesChecked = 0;
  const referenceFields = new Set([
    "sourceId", "sourceIds", "accountId", "subjectId", "objectId",
    "fromId", "toId", "entityId", "claimId", "evidenceId",
    "fromClaimId", "toClaimId", "targetId", "evidenceRecordId",
    "temporalAssertionId", "actorEntityId", "recordId", "perspectiveId",
    "causeId", "effectId",
  ]);
  function checkReferences(
    value: unknown,
    owner: string,
    field = "",
  ): void {
    if (Array.isArray(value)) {
      if (referenceFields.has(field)) {
        for (const reference of value) {
          if (typeof reference === "string") {
            referencesChecked++;
            if (!approvedIds.has(reference)) {
              const dependency = ids.get(reference);
              issues.push(issue(
                dependency
                  ? "BLOCKED_PREPARATION_DEPENDENCY"
                  : "UNRESOLVED_PREPARATION_REFERENCE",
                "reference",
                `${owner}.${field}`,
                dependency
                  ? `Approved object depends on ${reference} with status ${dependency.item.preparationStatus}.`
                  : `Reference ${reference} does not resolve.`,
              ));
            }
          }
        }
      } else {
        value.forEach((nested) => checkReferences(nested, owner, field));
      }
      return;
    }
    if (!value || typeof value !== "object") {
      if (
        referenceFields.has(field)
        && typeof value === "string"
        && value.length > 0
      ) {
        referencesChecked++;
        if (!approvedIds.has(value)) {
          const dependency = ids.get(value);
          issues.push(issue(
            dependency
              ? "BLOCKED_PREPARATION_DEPENDENCY"
              : "UNRESOLVED_PREPARATION_REFERENCE",
            "reference",
            `${owner}.${field}`,
            dependency
              ? `Approved object depends on ${value} with status ${dependency.item.preparationStatus}.`
              : `Reference ${value} does not resolve.`,
          ));
        }
      }
      return;
    }
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      checkReferences(nested, owner, key);
    }
  }
  for (const { item } of entries) {
    if (item.preparationStatus === "approved") {
      checkReferences(item.object, identifier(item));
    }
  }

  if (workspace.schemaVersion === LOSSLESS_PREPARATION_SCHEMA_VERSION) {
    const perspectivePairs = new Set<string>();
    for (const link of workspace.perspectiveLinks) {
      if (link.preparationStatus !== "approved") continue;
      const pair = [
        String(link.object.recordId ?? ""),
        String(link.object.perspectiveId ?? ""),
      ].join("\u0000");
      if (perspectivePairs.has(pair)) {
        issues.push(issue(
          "DUPLICATE_PERSPECTIVE_LINK",
          "structure",
          identifier(link),
          "Perspective links must have a unique record and perspective pair.",
        ));
      }
      perspectivePairs.add(pair);
    }
    const unresolvedStatuses = entries.filter(({ item }) =>
      item.preparationStatus === "draft"
      || item.preparationStatus === "needs_review");
    if (mode === "generate" && unresolvedStatuses.length > 0) {
      issues.push(issue(
        "UNAPPROVED_OBJECTS_BLOCK_GENERATION",
        "status",
        identifier(unresolvedStatuses[0]!.item),
        "Schema 1.1.0 generation requires every non-omitted object to be approved.",
      ));
    }
  }

  const locatorTypes = new Set<string>(sourceLocatorTypes);
  for (const locator of workspace.sourceLocators) {
    if (locator.preparationStatus !== "approved") continue;
    const id = identifier(locator);
    const type = String(locator.object.locatorType ?? "");
    const label = String(locator.object.locatorLabel ?? "").trim();
    if (!locatorTypes.has(type) || type.startsWith("custom:")) {
      issues.push(issue("INVALID_LOCATOR_TYPE", "locator", id,
        `Locator type ${type || "<empty>"} is not an accepted bounded type.`));
    }
    if (!label || !locator.object.locator
      || typeof locator.object.locator !== "object") {
      issues.push(issue("MALFORMED_LOCATOR", "locator", id,
        "Locators require a nonempty label and structured locator value."));
    }
    const locatorData = locator.object.locator;
    const locatorEditionId = locatorData
      && typeof locatorData === "object"
      ? String(
        (locatorData as Record<string, unknown>).editionId ?? "",
      ).trim()
      : "";
    const sourceId = String(locator.object.sourceId ?? "");
    const preparedSource = workspace.sourceSet.find(
      (source) => identifier(source) === sourceId,
    );
    if (
      locatorEditionId
      && preparedSource?.sourceIdentityReview.editionId
      !== locatorEditionId
    ) {
      issues.push(issue(
        "LOCATOR_EDITION_MISMATCH",
        "locator",
        id,
        `Locator edition ${locatorEditionId} does not match source edition ${preparedSource?.sourceIdentityReview.editionId ?? "<none>"}.`,
      ));
    }
  }

  const evidenceRoles = new Set<string>(evidenceSupportRoles);
  for (const link of workspace.evidenceLinks) {
    if (link.preparationStatus !== "approved") continue;
    const role = String(link.object.supportRole ?? "");
    if (!evidenceRoles.has(role) || role.startsWith("custom:")) {
      issues.push(issue("INVALID_EVIDENCE_ROLE", "evidence", identifier(link),
        `Evidence role ${role || "<empty>"} is not accepted.`));
    }
  }
  const artificialVersions = entries.filter(({ item }) =>
    /version/i.test(String(item.object.id ?? ""))
    || "priorVersionId" in item.object
    || "ordinal" in item.object);
  if (artificialVersions.length > 0) {
    issues.push(issue(
      "ARTIFICIAL_VERSION_HISTORY",
      "versioning",
      identifier(artificialVersions[0]!.item),
      "Preparation v1 does not accept claim or evidence version objects.",
    ));
  }
  if (
    mode === "generate"
    && (
      workspace.preparationStatus !== "approved"
      || !workspace.approvals.approved
      || !workspace.approvals.approvedBy
      || !workspace.approvals.approvedAt
    )
  ) {
    issues.push(issue("WORKSPACE_APPROVAL_REQUIRED", "status", "approvals",
      "Generation requires an explicitly approved workspace."));
  }

  const bundle = buildBundle(workspace);
  const bundleValidation = validateBundle(bundle);
  for (const validationIssue of bundleValidation.errors) {
    issues.push(issue(
      `BUNDLE_${validationIssue.code}`,
      "structure",
      `${validationIssue.objectType}.${validationIssue.objectId}`,
      validationIssue.message,
    ));
  }
  for (const validationIssue of bundleValidation.warnings) {
    issues.push(issue(
      `BUNDLE_WARNING_${validationIssue.code}`,
      "structure",
      `${validationIssue.objectType}.${validationIssue.objectId}`,
      validationIssue.message,
    ));
  }
  const bundleBytes = workspace.schemaVersion === PREPARATION_SCHEMA_VERSION
    ? canonicalJsonBytes(bundle)
    : losslessJsonBytes(bundle);
  const hash = createHash("sha256").update(bundleBytes).digest("hex");
  const statuses = entries.map(({ item }) => item.preparationStatus);
  const report: SourcePreparationReport = {
    schemaVersion: workspace.schemaVersion,
    workspaceId: workspace.workspaceId,
    mode,
    preview: mode === "preview",
    readyForGeneration: issues.length === 0
      && workspace.preparationStatus === "approved"
      && workspace.approvals.approved,
    proposedContentSha256: `sha256:${hash}`,
    issues,
    acceptedBundleValidation: {
      canImport: bundleValidation.canImport,
      errors: bundleValidation.errors,
      warnings: bundleValidation.warnings,
    },
    counts: Object.fromEntries(
      (workspace.schemaVersion === PREPARATION_SCHEMA_VERSION
        ? [...collections]
        : [...collections, ...losslessCollections]).map((name) => [
      name,
      entries.filter(({ collection, item }) =>
        collection === name
        && item.preparationStatus === "approved").length,
    ])),
    rightsSummary: countBy(
      workspace.sourceSet.map((source) =>
        source.rightsReview.classification),
      rightsClassifications,
    ),
    contentUseSummary: countBy(
      workspace.sourceSet.map((source) => source.contentUse.mode),
      contentUseModes,
    ),
    statusSummary: countBy(statuses, preparationStatuses),
    locatorSummary: countBy(
      workspace.sourceLocators.map((locator) =>
        String(locator.object.locatorType ?? "")),
      sourceLocatorTypes,
    ),
    evidenceRoleSummary: countBy(
      workspace.evidenceLinks.map((link) =>
        String(link.object.supportRole ?? "")),
      evidenceSupportRoles,
    ),
    omittedItems: entries
      .filter(({ item }) => item.preparationStatus === "omitted")
      .map(({ item }) => ({
        id: identifier(item),
        reason: item.omissionReason ?? "",
      })),
    resolvedReferences: {
      checked: referencesChecked,
      unresolved: issues.filter((item) =>
        item.category === "reference").length,
    },
  };
  return {
    report,
    ...(mode === "generate" && report.readyForGeneration
      ? { bundle, bundleBytes }
      : {}),
  };
}
