export function adaptImportBundleNodes(nodes = []) {
  return nodes.map(node => ({
    id: node.id,
    originalId: node.originalId || node.id,
    title: node.title || node.label || node.id,
    type: node.type || "Import Bundle Node",
    domain: node.domain || "Import Bundle",
    summary: node.summary || "",
    description: node.description || "",
    sourceIds: node.sourceIds || [],
    revisions: node.revisions || [],
    raw: node
  }));
}

export function adaptImportBundleAssertions(assertions = []) {
  return assertions.map(assertion => ({
    id: assertion.id,
    nodeId: assertion.nodeId,
    assertionType: assertion.assertionType || assertion.type || "assertion",
    label: assertion.label || assertion.assertionType || assertion.type || "Assertion",
    summary: assertion.summary || "",
    body: assertion.body || assertion.description || assertion.summary || "",
    sourceIds: assertion.sourceIds || [],
    credibilityTier: assertion.credibilityTier || "medium",
    confidence: assertion.confidence || "moderate",
    verificationStatus: assertion.verificationStatus || "working",
    reviewStatus: assertion.reviewStatus || "needs-review",
    supportLevel: assertion.supportLevel || "working",
    interpretationLevel: assertion.interpretationLevel || "medium",
    status: assertion.status || "import-bundle-preview",
    domain: assertion.domain || "Import Bundle",
    raw: assertion
  }));
}

export function adaptImportBundleEdges(edges = []) {
  return edges.map(edge => ({
    id: edge.id,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    relationshipType: edge.relationshipType || edge.type || "RELATED_TO",
    label: edge.label || edge.relationshipType || edge.type || "related to",
    summary: edge.summary || edge.explanation || "",
    sourceIds: edge.sourceIds || [],
    credibilityTier: edge.credibilityTier || "medium",
    confidence: edge.confidence || "moderate",
    verificationStatus: edge.verificationStatus || "working",
    reviewStatus: edge.reviewStatus || "needs-review",
    supportLevel: edge.supportLevel || "working",
    relationshipStrength: edge.relationshipStrength || "contextual",
    interpretationLevel: edge.interpretationLevel || "medium",
    domain: edge.domain || "Import Bundle",
    raw: edge
  }));
}

export function adaptImportBundleSources(sources = []) {
  return sources.map(source => ({
    id: source.id,
    name: source.name || source.title || source.id,
    type: source.type || "Import Bundle Source",
    domain: source.domain || "Import Bundle",
    qualityTier: source.qualityTier || source.tier || "Working Source",
    credibilityTier: source.credibilityTier || "",
    verificationStatus: source.verificationStatus || "",
    sourceClass: source.sourceClass || "",
    publisher: source.publisher || "",
    license: source.license || "",
    licenseStatus: source.licenseStatus || "",
    reviewStatus: source.reviewStatus || "",
    lastReviewed: source.lastReviewed || "",
    url: source.url || "",
    notes: source.notes || source.description || "",
    raw: source
  }));
}