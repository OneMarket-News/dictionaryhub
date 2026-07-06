export function adaptBibleNodes(nodes = []) {
  return nodes.map(node => ({
    id: `bible-${node.id}`,
    originalId: node.id,
    title: node.title || node.phrase || node.id,
    type: node.type || "Bible Node",
    domain: "BibleRoot",
    summary: node.summary || node.plainMeaning || "",
    description: node.description || node.symbolicMeaning || "",
    sourceIds: node.sourceIds || [],
    revisions: node.revisions || [],
    raw: node
  }));
}