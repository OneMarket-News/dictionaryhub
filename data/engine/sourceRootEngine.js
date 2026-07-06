export function combineNodes(...nodeGroups) {
  return nodeGroups.flat();
}

export function searchNodes(nodes, searchTerm) {
  const term = searchTerm.toLowerCase();

  return nodes.filter(node =>
    node.title.toLowerCase().includes(term) ||
    node.type.toLowerCase().includes(term) ||
    node.domain.toLowerCase().includes(term) ||
    node.summary.toLowerCase().includes(term)
  );
}