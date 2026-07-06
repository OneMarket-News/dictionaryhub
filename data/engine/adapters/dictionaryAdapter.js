export function adaptDictionaryConcepts(concepts = []) {
  return concepts.map(concept => ({
    id: `dictionary-${concept.id}`,
    originalId: concept.id,
    title: concept.name || concept.id,
    type: concept.type || "Dictionary Concept",
    domain: "DictionaryHub",
    summary: concept.shortDefinition || concept.plainEnglish || "",
    description: concept.fullDefinition || concept.technicalDefinition || "",
    sourceIds: concept.sourceIds || [],
    revisions: concept.revisions || [],
    raw: concept
  }));
}