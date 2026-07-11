export const allowedValues = {
  credibilityTier: [
    "very-high",
    "high",
    "medium",
    "low",
    "unknown",
    "disputed",
    "prototype"
  ],
  confidence: [
    "strong",
    "moderate",
    "weak",
    "working",
    "disputed",
    "unknown"
  ],
  verificationStatus: [
    "verified",
    "reviewed",
    "source-backed",
    "community-maintained",
    "official-documentation",
    "inferred",
    "interpretive",
    "symbolic",
    "prototype",
    "needs-review",
    "unverified",
    "disputed",
    "deprecated"
  ],
  reviewStatus: [
    "reviewed",
    "needs-review",
    "not-reviewed",
    "deprecated",
    "disputed",
    "prototype"
  ],
  assertionSupportLevel: [
    "direct",
    "derived",
    "inferred",
    "interpretive",
    "contextual",
    "unsupported"
  ],
  relationshipSupportLevel: [
    "direct",
    "derived",
    "inferred",
    "symbolic",
    "contextual",
    "unsupported"
  ],
  relationshipStrength: [
    "core",
    "strong",
    "medium",
    "weak",
    "contextual",
    "experimental"
  ],
  interpretationLevel: [
    "none",
    "low",
    "medium",
    "high",
    "speculative"
  ]
};

export function validateBundle(bundle) {
  const errors = [];
  const warnings = [];

  if (!bundle || typeof bundle !== "object") {
    errors.push(issue("INVALID_JSON", "bundle", "unknown", "Bundle is not a valid JSON object."));
    return buildResult("unknown", bundle || {}, errors, warnings);
  }

  if (!bundle.bundleId) {
    errors.push(issue("MISSING_BUNDLE_ID", "bundle", "unknown", "Bundle must include a non-empty bundleId."));
  }

  if (bundle.bundleType !== "sourceroot-import-bundle") {
    errors.push(issue("INVALID_BUNDLE_TYPE", "bundle", bundle.bundleId || "unknown", "Bundle type must be sourceroot-import-bundle."));
  }

  if (!bundle.version) {
    errors.push(issue("MISSING_BUNDLE_VERSION", "bundle", bundle.bundleId || "unknown", "Bundle must include a version."));
  }

  if (!bundle.domain) {
    errors.push(issue("MISSING_BUNDLE_DOMAIN", "bundle", bundle.bundleId || "unknown", "Bundle must include a domain."));
  }

  ["nodes", "assertions", "edges", "sources"].forEach(arrayName => {
    if (!Array.isArray(bundle[arrayName])) {
      errors.push(issue("MISSING_REQUIRED_ARRAY", "bundle", bundle.bundleId || "unknown", `Bundle must include a ${arrayName} array.`));
    }
  });

  if (!Array.isArray(bundle.revisions)) {
    warnings.push(issue("MISSING_REVISIONS_ARRAY", "bundle", bundle.bundleId || "unknown", "Bundle should include a revisions array."));
  }

  const nodes = Array.isArray(bundle.nodes) ? bundle.nodes : [];
  const assertions = Array.isArray(bundle.assertions) ? bundle.assertions : [];
  const edges = Array.isArray(bundle.edges) ? bundle.edges : [];
  const sources = Array.isArray(bundle.sources) ? bundle.sources : [];
  const revisions = Array.isArray(bundle.revisions) ? bundle.revisions : [];

  checkDuplicates(nodes, "node", "id", "DUPLICATE_NODE_ID", errors);
  checkDuplicates(assertions, "assertion", "id", "DUPLICATE_ASSERTION_ID", errors);
  checkDuplicates(edges, "edge", "id", "DUPLICATE_EDGE_ID", errors);
  checkDuplicates(sources, "source", "id", "DUPLICATE_SOURCE_ID", errors);
  checkDuplicates(revisions, "revision", "revisionId", "DUPLICATE_REVISION_ID", warnings);

  const nodeIds = new Set(nodes.map(node => node.id).filter(Boolean));
  const sourceIds = new Set(sources.map(source => source.id).filter(Boolean));

  const objectIds = new Set([
    bundle.bundleId,
    ...nodes.map(node => node.id),
    ...assertions.map(assertion => assertion.id),
    ...edges.map(edge => edge.id),
    ...sources.map(source => source.id)
  ].filter(Boolean));

  nodes.forEach(node => validateNode(node, warnings, errors, sourceIds));
  assertions.forEach(assertion => validateAssertion(assertion, warnings, errors, nodeIds, sourceIds));
  edges.forEach(edge => validateEdge(edge, warnings, errors, nodeIds, sourceIds));
  sources.forEach(source => validateSource(source, warnings, errors));
  revisions.forEach(revision => validateRevision(revision, warnings, objectIds));

  return buildResult(bundle.bundleId || "unknown", bundle, errors, warnings);
}

function validateNode(node, warnings, errors, sourceIds) {
  if (!node.id) {
    errors.push(issue("MISSING_NODE_ID", "node", "unknown", "Every node must include a non-empty id."));
  }

  if (!node.title) {
    errors.push(issue("MISSING_NODE_TITLE", "node", node.id || "unknown", "Every node must include a title."));
  }

  if (!node.type) {
    warnings.push(issue("MISSING_NODE_TYPE", "node", node.id || "unknown", "Node should include a type."));
  }

  if (!node.domain) {
    warnings.push(issue("MISSING_NODE_DOMAIN", "node", node.id || "unknown", "Node should include a domain."));
  }

  if (!node.summary) {
    warnings.push(issue("MISSING_NODE_SUMMARY", "node", node.id || "unknown", "Node should include a short summary."));
  }

  checkSourceReferences(node, "node", node.id || "unknown", warnings, errors, sourceIds);
}

function validateAssertion(assertion, warnings, errors, nodeIds, sourceIds) {
  if (!assertion.id) {
    errors.push(issue("MISSING_ASSERTION_ID", "assertion", "unknown", "Every assertion must include a non-empty id."));
  }

  if (!assertion.nodeId) {
    errors.push(issue("MISSING_ASSERTION_NODE_ID", "assertion", assertion.id || "unknown", "Every assertion must include nodeId."));
  } else if (!nodeIds.has(assertion.nodeId)) {
    errors.push(issue("ASSERTION_NODE_NOT_FOUND", "assertion", assertion.id || "unknown", `Assertion points to missing node ${assertion.nodeId}.`));
  }

  if (!assertion.assertionType) {
    errors.push(issue("MISSING_ASSERTION_TYPE", "assertion", assertion.id || "unknown", "Every assertion must include assertionType."));
  }

  if (!assertion.summary && !assertion.body) {
    errors.push(issue("MISSING_ASSERTION_CONTENT", "assertion", assertion.id || "unknown", "Assertion must include summary or body."));
  }

  if (!Array.isArray(assertion.sourceIds) || !assertion.sourceIds.length) {
    warnings.push(issue("MISSING_ASSERTION_SOURCE", "assertion", assertion.id || "unknown", "Assertion should include at least one sourceId."));
  }

  checkSourceReferences(assertion, "assertion", assertion.id || "unknown", warnings, errors, sourceIds);

  checkRequiredFields(
    assertion,
    "assertion",
    assertion.id || "unknown",
    [
      "credibilityTier",
      "confidence",
      "verificationStatus",
      "reviewStatus",
      "supportLevel",
      "interpretationLevel"
    ],
    "MISSING_ASSERTION_CREDIBILITY",
    warnings
  );

  validateTrustValues(assertion, "assertion", assertion.id || "unknown", warnings, "assertion");
}

function validateEdge(edge, warnings, errors, nodeIds, sourceIds) {
  if (!edge.id) {
    errors.push(issue("MISSING_EDGE_ID", "edge", "unknown", "Every edge must include a non-empty id."));
  }

  if (!edge.fromNodeId) {
    errors.push(issue("MISSING_EDGE_FROM_NODE", "edge", edge.id || "unknown", "Every edge must include fromNodeId."));
  } else if (!nodeIds.has(edge.fromNodeId)) {
    errors.push(issue("EDGE_NODE_NOT_FOUND", "edge", edge.id || "unknown", `Edge points from missing node ${edge.fromNodeId}.`));
  }

  if (!edge.toNodeId) {
    errors.push(issue("MISSING_EDGE_TO_NODE", "edge", edge.id || "unknown", "Every edge must include toNodeId."));
  } else if (!nodeIds.has(edge.toNodeId)) {
    errors.push(issue("EDGE_NODE_NOT_FOUND", "edge", edge.id || "unknown", `Edge points to missing node ${edge.toNodeId}.`));
  }

  if (!edge.relationshipType) {
    errors.push(issue("MISSING_RELATIONSHIP_TYPE", "edge", edge.id || "unknown", "Every edge must include relationshipType."));
  }

  if (!edge.summary) {
    warnings.push(issue("MISSING_EDGE_SUMMARY", "edge", edge.id || "unknown", "Edge should include a summary explaining the relationship."));
  }

  if (!Array.isArray(edge.sourceIds) || !edge.sourceIds.length) {
    warnings.push(issue("MISSING_EDGE_SOURCE", "edge", edge.id || "unknown", "Edge should include at least one sourceId."));
  }

  checkSourceReferences(edge, "edge", edge.id || "unknown", warnings, errors, sourceIds);

  checkRequiredFields(
    edge,
    "edge",
    edge.id || "unknown",
    [
      "credibilityTier",
      "confidence",
      "verificationStatus",
      "reviewStatus",
      "supportLevel",
      "relationshipStrength",
      "interpretationLevel"
    ],
    "MISSING_RELATIONSHIP_CREDIBILITY",
    warnings
  );

  validateTrustValues(edge, "edge", edge.id || "unknown", warnings, "relationship");
}

function validateSource(source, warnings, errors) {
  if (!source.id) {
    errors.push(issue("MISSING_SOURCE_ID", "source", "unknown", "Every source must include a non-empty id."));
  }

  if (!source.name) {
    errors.push(issue("MISSING_SOURCE_NAME", "source", source.id || "unknown", "Every source must include a name."));
  }

  if (!source.type) {
    warnings.push(issue("MISSING_SOURCE_TYPE", "source", source.id || "unknown", "Source should include a type."));
  }

  if (!source.domain) {
    warnings.push(issue("MISSING_SOURCE_DOMAIN", "source", source.id || "unknown", "Source should include a domain."));
  }

  checkRequiredFields(
    source,
    "source",
    source.id || "unknown",
    [
      "qualityTier",
      "credibilityTier",
      "verificationStatus",
      "reviewStatus",
      "licenseStatus"
    ],
    "MISSING_SOURCE_CREDIBILITY",
    warnings
  );

  if (!source.licenseStatus) {
    warnings.push(issue("MISSING_LICENSE_STATUS", "source", source.id || "unknown", "Source should include licenseStatus before public use."));
  }

  if (source.licenseStatus === "internal-use-only") {
    warnings.push(issue("SOURCE_INTERNAL_ONLY", "source", source.id || "unknown", "Source license status is internal-use-only."));
  }

  validateTrustValues(source, "source", source.id || "unknown", warnings, "source");
}

function validateRevision(revision, warnings, objectIds) {
  if (!revision.revisionId) {
    warnings.push(issue("MISSING_REVISION_ID", "revision", "unknown", "Revision should include revisionId."));
  }

  if (!revision.objectId) {
    warnings.push(issue("MISSING_REVISION_OBJECT_ID", "revision", revision.revisionId || "unknown", "Revision should include objectId."));
  }

  if (!revision.objectType) {
    warnings.push(issue("MISSING_REVISION_OBJECT_TYPE", "revision", revision.revisionId || "unknown", "Revision should include objectType."));
  }

  if (revision.objectId && !objectIds.has(revision.objectId)) {
    warnings.push(issue("REVISION_TARGET_NOT_FOUND", "revision", revision.revisionId || "unknown", `Revision target ${revision.objectId} was not found in this bundle.`));
  }
}

function validateTrustValues(object, objectType, objectId, warnings, supportContext) {
  if (object.credibilityTier && !allowedValues.credibilityTier.includes(object.credibilityTier)) {
    warnings.push(issue("INVALID_CREDIBILITY_TIER", objectType, objectId, `Invalid credibilityTier: ${object.credibilityTier}.`));
  }

  if (object.confidence && !allowedValues.confidence.includes(object.confidence)) {
    warnings.push(issue("INVALID_CONFIDENCE_VALUE", objectType, objectId, `Invalid confidence: ${object.confidence}.`));
  }

  if (object.verificationStatus && !allowedValues.verificationStatus.includes(object.verificationStatus)) {
    warnings.push(issue("INVALID_VERIFICATION_STATUS", objectType, objectId, `Invalid verificationStatus: ${object.verificationStatus}.`));
  }

  if (object.reviewStatus && !allowedValues.reviewStatus.includes(object.reviewStatus)) {
    warnings.push(issue("INVALID_REVIEW_STATUS", objectType, objectId, `Invalid reviewStatus: ${object.reviewStatus}.`));
  }

  if (object.supportLevel) {
    const supportValues = supportContext === "relationship"
      ? allowedValues.relationshipSupportLevel
      : allowedValues.assertionSupportLevel;

    if (!supportValues.includes(object.supportLevel)) {
      warnings.push(issue("INVALID_SUPPORT_LEVEL", objectType, objectId, `Invalid supportLevel: ${object.supportLevel}.`));
    }
  }

  if (object.relationshipStrength && !allowedValues.relationshipStrength.includes(object.relationshipStrength)) {
    warnings.push(issue("INVALID_RELATIONSHIP_STRENGTH", objectType, objectId, `Invalid relationshipStrength: ${object.relationshipStrength}.`));
  }

  if (object.interpretationLevel && !allowedValues.interpretationLevel.includes(object.interpretationLevel)) {
    warnings.push(issue("INVALID_INTERPRETATION_LEVEL", objectType, objectId, `Invalid interpretationLevel: ${object.interpretationLevel}.`));
  }
}

function checkSourceReferences(object, objectType, objectId, warnings, errors, sourceIds) {
  if (!Array.isArray(object.sourceIds)) {
    return;
  }

  object.sourceIds.forEach(sourceId => {
    if (!sourceId) {
      warnings.push(issue("EMPTY_SOURCE_ID", objectType, objectId, "Empty sourceId found."));
      return;
    }

    if (!sourceIds.has(sourceId)) {
      errors.push(issue("SOURCE_REFERENCE_NOT_FOUND", objectType, objectId, `Referenced source ${sourceId} was not found in bundle.sources.`));
    }
  });
}

function checkRequiredFields(object, objectType, objectId, fields, code, warnings) {
  const missingFields = fields.filter(field => !object[field]);

  if (missingFields.length) {
    warnings.push(issue(code, objectType, objectId, `Missing recommended field(s): ${missingFields.join(", ")}.`));
  }
}

function checkDuplicates(items, objectType, idField, code, issueList) {
  const seen = new Set();

  items.forEach(item => {
    const id = item[idField];

    if (!id) {
      return;
    }

    if (seen.has(id)) {
      issueList.push(issue(code, objectType, id, `Duplicate ${objectType} ID found: ${id}.`));
    }

    seen.add(id);
  });
}

function buildResult(bundleId, bundle, errors, warnings) {
  const summary = {
    nodes: Array.isArray(bundle.nodes) ? bundle.nodes.length : 0,
    assertions: Array.isArray(bundle.assertions) ? bundle.assertions.length : 0,
    edges: Array.isArray(bundle.edges) ? bundle.edges.length : 0,
    sources: Array.isArray(bundle.sources) ? bundle.sources.length : 0,
    revisions: Array.isArray(bundle.revisions) ? bundle.revisions.length : 0,
    errors: errors.length,
    warnings: warnings.length
  };

  let status = "ready";
  let canImport = true;

  if (errors.length) {
    status = "blocked";
    canImport = false;
  } else if (warnings.length) {
    status = "ready-with-warnings";
    canImport = true;
  }

  return {
    bundleId,
    status,
    canImport,
    summary,
    errors,
    warnings
  };
}

function issue(code, objectType, objectId, message) {
  return {
    code,
    objectType,
    objectId,
    message
  };
}