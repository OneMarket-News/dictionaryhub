export function adaptWikidataNodes(items = []) {
  return items.map(item => ({
    id: `wikidata-${item.id}`,
    originalId: item.id,
    externalId: item.externalId || "",
    externalUri: item.externalUri || "",
    title: item.title || item.label || item.id,
    type: item.type || "Wikidata Item",
    domain: "WikidataRoot",
    summary: item.summary || item.description || "",
    description: item.description || "",
    sourceIds: item.sourceIds || [],
    revisions: item.revisions || [],
    aliases: item.aliases || [],
    statements: item.statements || [],
    raw: item
  }));
}

export function adaptWikidataAssertions(items = []) {
  const assertions = [];

  items.forEach(item => {
    const nodeId = `wikidata-${item.id}`;

    if (item.description) {
      assertions.push({
        id: `wikidata-assertion-${item.id}-description`,
        nodeId,
        assertionType: "wikidata-description",
        label: "Wikidata Description",
        summary: item.description,
        body: item.description,
        sourceIds: item.sourceIds || [],
        confidence: "community-maintained",
        status: "external-dataset-sample",
        domain: "WikidataRoot"
      });
    }

    if (Array.isArray(item.aliases) && item.aliases.length) {
      assertions.push({
        id: `wikidata-assertion-${item.id}-aliases`,
        nodeId,
        assertionType: "aliases",
        label: "Aliases",
        summary: `${item.aliases.length} alias(es) listed`,
        body: item.aliases.map(alias => `• ${alias}`).join("<br>"),
        sourceIds: item.sourceIds || [],
        confidence: "community-maintained",
        status: "external-dataset-sample",
        domain: "WikidataRoot"
      });
    }

    if (Array.isArray(item.statements) && item.statements.length) {
      assertions.push({
        id: `wikidata-assertion-${item.id}-statements`,
        nodeId,
        assertionType: "wikidata-statements",
        label: "Selected Wikidata Statements",
        summary: `${item.statements.length} selected statement(s) modeled`,
        body: item.statements
          .map(statement => `• ${statement.property}: ${statement.value}`)
          .join("<br>"),
        sourceIds: item.sourceIds || [],
        confidence: "community-maintained",
        status: "external-dataset-sample",
        domain: "WikidataRoot"
      });
    }

    if (item.externalId || item.externalUri) {
      assertions.push({
        id: `wikidata-assertion-${item.id}-external-identity`,
        nodeId,
        assertionType: "external-identity",
        label: "External Identity",
        summary: item.externalId || "",
        body: `
          <strong>External ID:</strong> ${item.externalId || "None"}<br>
          <strong>External URI:</strong> ${item.externalUri || "None"}
        `,
        sourceIds: item.sourceIds || [],
        confidence: "high",
        status: "external-dataset-sample",
        domain: "WikidataRoot"
      });
    }
  });

  return assertions;
}

export function adaptWikidataEdges(edges = []) {
  return edges.map(edge => ({
    id: edge.id,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    relationshipType: edge.relationshipType || edge.type || "WIKIDATA_RELATIONSHIP",
    label: edge.label || edge.relationshipType || "relates to",
    summary: edge.summary || edge.explanation || "",
    sourceIds: edge.sourceIds || [],
    domain: edge.domain || "WikidataRoot",
    raw: edge
  }));
}

export function adaptWikidataSources(sources = []) {
  return sources.map(source => ({
    id: source.id,
    name: source.name || source.title || source.id,
    type: source.type || "WikidataRoot Source",
    domain: source.domain || "WikidataRoot",
    qualityTier: source.qualityTier || source.tier || "Working Source",
    credibilityTier: source.credibilityTier || "",
    verificationStatus: source.verificationStatus || "",
    sourceClass: source.sourceClass || "",
    publisher: source.publisher || "",
    license: source.license || "",
    url: source.url || "",
    notes: source.notes || source.description || "",
    raw: source
  }));
}