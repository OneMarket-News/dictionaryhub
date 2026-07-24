import type {
  SourceRootBundle,
  ValidationIssue,
  ValidationResult
} from "../types.js";
import {
  countContextualRecords,
  validateContextualBundle,
} from "./contextual-schemas.js";

const allowedValues = {
  credibilityTier: new Set([
    "very-high", "high", "medium", "low", "unknown", "disputed", "prototype"
  ]),
  confidence: new Set([
    "strong", "moderate", "weak", "working", "disputed", "unknown"
  ]),
  verificationStatus: new Set([
    "verified", "reviewed", "source-backed", "community-maintained",
    "official-documentation", "inferred", "interpretive", "symbolic",
    "prototype", "needs-review", "unverified", "disputed", "deprecated"
  ]),
  reviewStatus: new Set([
    "reviewed", "needs-review", "not-reviewed", "deprecated", "disputed", "prototype"
  ]),
  assertionSupportLevel: new Set([
    "direct", "derived", "inferred", "interpretive", "contextual", "unsupported"
  ]),
  relationshipSupportLevel: new Set([
    "direct", "derived", "inferred", "symbolic", "contextual", "unsupported"
  ]),
  relationshipStrength: new Set([
    "core", "strong", "medium", "weak", "contextual", "experimental"
  ]),
  interpretationLevel: new Set([
    "none", "low", "medium", "high", "speculative"
  ])
} as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function records(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function issue(
  code: string,
  objectType: string,
  objectId: string,
  message: string,
  field?: string
): ValidationIssue {
  return field
    ? { code, objectType, objectId, message, field }
    : { code, objectType, objectId, message };
}

export function validateBundle(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!isRecord(input)) {
    errors.push(issue(
      "INVALID_JSON",
      "bundle",
      "unknown",
      "Bundle is not a valid JSON object."
    ));
    return buildResult("unknown", {}, errors, warnings, "invalid-format");
  }

  const bundle = input as SourceRootBundle;
  const bundleId = stringValue(bundle.bundleId) || "unknown";

  if (!stringValue(bundle.bundleId)) {
    errors.push(issue(
      "MISSING_BUNDLE_ID", "bundle", "unknown",
      "Bundle must include a non-empty bundleId.", "bundleId"
    ));
  }
  if (bundle.bundleType !== "sourceroot-import-bundle") {
    errors.push(issue(
      "INVALID_BUNDLE_TYPE", "bundle", bundleId,
      "Bundle type must be sourceroot-import-bundle.", "bundleType"
    ));
  }
  if (!stringValue(bundle.version)) {
    errors.push(issue(
      "MISSING_BUNDLE_VERSION", "bundle", bundleId,
      "Bundle must include a version.", "version"
    ));
  }
  if (!stringValue(bundle.domain)) {
    errors.push(issue(
      "MISSING_BUNDLE_DOMAIN", "bundle", bundleId,
      "Bundle must include a domain.", "domain"
    ));
  }

  for (const arrayName of ["nodes", "assertions", "edges", "sources"] as const) {
    if (!Array.isArray(bundle[arrayName])) {
      errors.push(issue(
        "MISSING_REQUIRED_ARRAY", "bundle", bundleId,
        `Bundle must include a ${arrayName} array.`, arrayName
      ));
    }
  }

  if (!Array.isArray(bundle.revisions)) {
    warnings.push(issue(
      "MISSING_REVISIONS_ARRAY", "bundle", bundleId,
      "Bundle should include a revisions array.", "revisions"
    ));
  }

  const nodes = records(bundle.nodes);
  const assertions = records(bundle.assertions);
  const edges = records(bundle.edges);
  const sources = records(bundle.sources);
  const revisions = records(bundle.revisions);

  checkDuplicates(nodes, "node", "id", "DUPLICATE_NODE_ID", errors);
  checkDuplicates(assertions, "assertion", "id", "DUPLICATE_ASSERTION_ID", errors);
  checkDuplicates(edges, "edge", "id", "DUPLICATE_EDGE_ID", errors);
  checkDuplicates(sources, "source", "id", "DUPLICATE_SOURCE_ID", errors);
  checkDuplicates(revisions, "revision", "revisionId", "DUPLICATE_REVISION_ID", warnings);

  const nodeIds = new Set(nodes.map(item => stringValue(item.id)).filter(Boolean));
  const sourceIds = new Set(sources.map(item => stringValue(item.id)).filter(Boolean));
  const objectIds = new Set([
    stringValue(bundle.bundleId),
    ...nodes.map(item => stringValue(item.id)),
    ...assertions.map(item => stringValue(item.id)),
    ...edges.map(item => stringValue(item.id)),
    ...sources.map(item => stringValue(item.id))
  ].filter(Boolean));

  nodes.forEach(node => validateNode(node, warnings, errors, sourceIds));
  assertions.forEach(assertion => validateAssertion(assertion, warnings, errors, nodeIds, sourceIds));
  edges.forEach(edge => validateEdge(edge, warnings, errors, nodeIds, sourceIds));
  sources.forEach(source => validateSource(source, warnings, errors));
  revisions.forEach(revision => validateRevision(revision, warnings, objectIds));

  if (bundle.context !== undefined) {
    for (
      const contextualIssue
      of validateContextualBundle(bundle.context, sourceIds)
    ) {
      errors.push(issue(
        contextualIssue.code,
        contextualIssue.objectType,
        contextualIssue.objectId,
        contextualIssue.message,
        contextualIssue.field,
      ));
    }
  }

  return buildResult(bundleId, bundle, errors, warnings);
}

function validateNode(
  node: UnknownRecord,
  warnings: ValidationIssue[],
  errors: ValidationIssue[],
  sourceIds: Set<string>
): void {
  const id = stringValue(node.id) || "unknown";
  if (!stringValue(node.id)) errors.push(issue("MISSING_NODE_ID", "node", "unknown", "Every node must include a non-empty id.", "id"));
  if (!stringValue(node.title)) errors.push(issue("MISSING_NODE_TITLE", "node", id, "Every node must include a title.", "title"));
  if (!stringValue(node.type)) warnings.push(issue("MISSING_NODE_TYPE", "node", id, "Node should include a type.", "type"));
  if (!stringValue(node.domain)) warnings.push(issue("MISSING_NODE_DOMAIN", "node", id, "Node should include a domain.", "domain"));
  if (!stringValue(node.summary)) warnings.push(issue("MISSING_NODE_SUMMARY", "node", id, "Node should include a short summary.", "summary"));
  checkSourceReferences(node, "node", id, warnings, errors, sourceIds);
}

function validateAssertion(
  assertion: UnknownRecord,
  warnings: ValidationIssue[],
  errors: ValidationIssue[],
  nodeIds: Set<string>,
  sourceIds: Set<string>
): void {
  const id = stringValue(assertion.id) || "unknown";
  const nodeId = stringValue(assertion.nodeId);
  if (!stringValue(assertion.id)) errors.push(issue("MISSING_ASSERTION_ID", "assertion", "unknown", "Every assertion must include a non-empty id.", "id"));
  if (!nodeId) errors.push(issue("MISSING_ASSERTION_NODE_ID", "assertion", id, "Every assertion must include nodeId.", "nodeId"));
  else if (!nodeIds.has(nodeId)) errors.push(issue("ASSERTION_NODE_NOT_FOUND", "assertion", id, `Assertion points to missing node ${nodeId}.`, "nodeId"));
  if (!stringValue(assertion.assertionType)) errors.push(issue("MISSING_ASSERTION_TYPE", "assertion", id, "Every assertion must include assertionType.", "assertionType"));
  if (!stringValue(assertion.summary) && !stringValue(assertion.body)) errors.push(issue("MISSING_ASSERTION_CONTENT", "assertion", id, "Assertion must include summary or body."));
  if (!Array.isArray(assertion.sourceIds) || stringArray(assertion.sourceIds).length === 0) warnings.push(issue("MISSING_ASSERTION_SOURCE", "assertion", id, "Assertion should include at least one sourceId.", "sourceIds"));
  checkSourceReferences(assertion, "assertion", id, warnings, errors, sourceIds);
  checkRequiredFields(assertion, "assertion", id, ["credibilityTier", "confidence", "verificationStatus", "reviewStatus", "supportLevel", "interpretationLevel"], "MISSING_ASSERTION_CREDIBILITY", warnings);
  validateTrustValues(assertion, "assertion", id, warnings, "assertion");
}

function validateEdge(
  edge: UnknownRecord,
  warnings: ValidationIssue[],
  errors: ValidationIssue[],
  nodeIds: Set<string>,
  sourceIds: Set<string>
): void {
  const id = stringValue(edge.id) || "unknown";
  const from = stringValue(edge.fromNodeId);
  const to = stringValue(edge.toNodeId);
  if (!stringValue(edge.id)) errors.push(issue("MISSING_EDGE_ID", "edge", "unknown", "Every edge must include a non-empty id.", "id"));
  if (!from) errors.push(issue("MISSING_EDGE_FROM_NODE", "edge", id, "Every edge must include fromNodeId.", "fromNodeId"));
  else if (!nodeIds.has(from)) errors.push(issue("EDGE_NODE_NOT_FOUND", "edge", id, `Edge points from missing node ${from}.`, "fromNodeId"));
  if (!to) errors.push(issue("MISSING_EDGE_TO_NODE", "edge", id, "Every edge must include toNodeId.", "toNodeId"));
  else if (!nodeIds.has(to)) errors.push(issue("EDGE_NODE_NOT_FOUND", "edge", id, `Edge points to missing node ${to}.`, "toNodeId"));
  if (!stringValue(edge.relationshipType)) errors.push(issue("MISSING_RELATIONSHIP_TYPE", "edge", id, "Every edge must include relationshipType.", "relationshipType"));
  if (!stringValue(edge.summary)) warnings.push(issue("MISSING_EDGE_SUMMARY", "edge", id, "Edge should include a summary explaining the relationship.", "summary"));
  if (!Array.isArray(edge.sourceIds) || stringArray(edge.sourceIds).length === 0) warnings.push(issue("MISSING_EDGE_SOURCE", "edge", id, "Edge should include at least one sourceId.", "sourceIds"));
  checkSourceReferences(edge, "edge", id, warnings, errors, sourceIds);
  checkRequiredFields(edge, "edge", id, ["credibilityTier", "confidence", "verificationStatus", "reviewStatus", "supportLevel", "relationshipStrength", "interpretationLevel"], "MISSING_RELATIONSHIP_CREDIBILITY", warnings);
  validateTrustValues(edge, "edge", id, warnings, "relationship");
}

function validateSource(
  source: UnknownRecord,
  warnings: ValidationIssue[],
  errors: ValidationIssue[]
): void {
  const id = stringValue(source.id) || "unknown";
  if (!stringValue(source.id)) errors.push(issue("MISSING_SOURCE_ID", "source", "unknown", "Every source must include a non-empty id.", "id"));
  if (!stringValue(source.name)) errors.push(issue("MISSING_SOURCE_NAME", "source", id, "Every source must include a name.", "name"));
  if (!stringValue(source.type)) warnings.push(issue("MISSING_SOURCE_TYPE", "source", id, "Source should include a type.", "type"));
  if (!stringValue(source.domain)) warnings.push(issue("MISSING_SOURCE_DOMAIN", "source", id, "Source should include a domain.", "domain"));
  checkRequiredFields(source, "source", id, ["qualityTier", "credibilityTier", "verificationStatus", "reviewStatus", "licenseStatus"], "MISSING_SOURCE_CREDIBILITY", warnings);
  if (!stringValue(source.licenseStatus)) warnings.push(issue("MISSING_LICENSE_STATUS", "source", id, "Source should include licenseStatus before public use.", "licenseStatus"));
  if (source.licenseStatus === "internal-use-only") warnings.push(issue("SOURCE_INTERNAL_ONLY", "source", id, "Source license status is internal-use-only.", "licenseStatus"));
  validateTrustValues(source, "source", id, warnings, "source");
}

function validateRevision(
  revision: UnknownRecord,
  warnings: ValidationIssue[],
  objectIds: Set<string>
): void {
  const id = stringValue(revision.revisionId) || "unknown";
  const objectId = stringValue(revision.objectId);
  if (!stringValue(revision.revisionId)) warnings.push(issue("MISSING_REVISION_ID", "revision", "unknown", "Revision should include revisionId.", "revisionId"));
  if (!objectId) warnings.push(issue("MISSING_REVISION_OBJECT_ID", "revision", id, "Revision should include objectId.", "objectId"));
  if (!stringValue(revision.objectType)) warnings.push(issue("MISSING_REVISION_OBJECT_TYPE", "revision", id, "Revision should include objectType.", "objectType"));
  if (objectId && !objectIds.has(objectId)) warnings.push(issue("REVISION_TARGET_NOT_FOUND", "revision", id, `Revision target ${objectId} was not found in this bundle.`, "objectId"));
}

function validateTrustValues(
  object: UnknownRecord,
  objectType: string,
  objectId: string,
  warnings: ValidationIssue[],
  supportContext: "assertion" | "relationship" | "source"
): void {
  checkAllowed(object, "credibilityTier", allowedValues.credibilityTier, "INVALID_CREDIBILITY_TIER", objectType, objectId, warnings);
  checkAllowed(object, "confidence", allowedValues.confidence, "INVALID_CONFIDENCE_VALUE", objectType, objectId, warnings);
  checkAllowed(object, "verificationStatus", allowedValues.verificationStatus, "INVALID_VERIFICATION_STATUS", objectType, objectId, warnings);
  checkAllowed(object, "reviewStatus", allowedValues.reviewStatus, "INVALID_REVIEW_STATUS", objectType, objectId, warnings);

  const supportValues = supportContext === "relationship"
    ? allowedValues.relationshipSupportLevel
    : allowedValues.assertionSupportLevel;
  checkAllowed(object, "supportLevel", supportValues, "INVALID_SUPPORT_LEVEL", objectType, objectId, warnings);
  checkAllowed(object, "relationshipStrength", allowedValues.relationshipStrength, "INVALID_RELATIONSHIP_STRENGTH", objectType, objectId, warnings);
  checkAllowed(object, "interpretationLevel", allowedValues.interpretationLevel, "INVALID_INTERPRETATION_LEVEL", objectType, objectId, warnings);
}

function checkAllowed(
  object: UnknownRecord,
  field: string,
  allowed: ReadonlySet<string>,
  code: string,
  objectType: string,
  objectId: string,
  warnings: ValidationIssue[]
): void {
  const value = stringValue(object[field]);
  if (value && !allowed.has(value)) {
    warnings.push(issue(code, objectType, objectId, `Invalid ${field}: ${value}.`, field));
  }
}

function checkSourceReferences(
  object: UnknownRecord,
  objectType: string,
  objectId: string,
  warnings: ValidationIssue[],
  errors: ValidationIssue[],
  sourceIds: Set<string>
): void {
  if (!Array.isArray(object.sourceIds)) return;
  for (const sourceIdRaw of object.sourceIds) {
    const sourceId = stringValue(sourceIdRaw);
    if (!sourceId) {
      warnings.push(issue("EMPTY_SOURCE_ID", objectType, objectId, "Empty sourceId found.", "sourceIds"));
    } else if (!sourceIds.has(sourceId)) {
      errors.push(issue("SOURCE_REFERENCE_NOT_FOUND", objectType, objectId, `Referenced source ${sourceId} was not found in bundle.sources.`, "sourceIds"));
    }
  }
}

function checkRequiredFields(
  object: UnknownRecord,
  objectType: string,
  objectId: string,
  fields: string[],
  code: string,
  warnings: ValidationIssue[]
): void {
  const missing = fields.filter(field => !stringValue(object[field]));
  if (missing.length) {
    warnings.push(issue(code, objectType, objectId, `Missing recommended field(s): ${missing.join(", ")}.`));
  }
}

function checkDuplicates(
  items: UnknownRecord[],
  objectType: string,
  idField: string,
  code: string,
  issues: ValidationIssue[]
): void {
  const seen = new Set<string>();
  for (const item of items) {
    const id = stringValue(item[idField]);
    if (!id) continue;
    if (seen.has(id)) issues.push(issue(code, objectType, id, `Duplicate ${objectType} ID found: ${id}.`, idField));
    seen.add(id);
  }
}

function buildResult(
  bundleId: string,
  bundle: SourceRootBundle,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  forcedStatus?: ValidationResult["status"]
): ValidationResult {
  const summary = {
    nodes: Array.isArray(bundle.nodes) ? bundle.nodes.length : 0,
    assertions: Array.isArray(bundle.assertions) ? bundle.assertions.length : 0,
    edges: Array.isArray(bundle.edges) ? bundle.edges.length : 0,
    sources: Array.isArray(bundle.sources) ? bundle.sources.length : 0,
    revisions: Array.isArray(bundle.revisions) ? bundle.revisions.length : 0,
    ...(bundle.context !== undefined
      ? {
          contextualRecords:
            countContextualRecords(bundle.context),
        }
      : {}),
    errors: errors.length,
    warnings: warnings.length
  };

  const status = forcedStatus ?? (
    errors.length ? "blocked" : warnings.length ? "ready-with-warnings" : "ready"
  );

  return {
    bundleId,
    status,
    canImport: status === "ready" || status === "ready-with-warnings",
    summary,
    errors,
    warnings
  };
}
