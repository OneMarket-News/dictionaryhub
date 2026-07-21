import type { NormalizedEdge } from "./edge-store.js";
import { getEdgesByNodeId } from "./edge-store.js";
import {
  getDictionaryRootLexicalEdgesByNodeId,
} from "./lexical-store.js";
import type { NormalizedNode } from "./node-store.js";
import { getNodeById } from "./node-store.js";

export type DictionaryRootGraphMembership = "core" | "dynamic";

export interface DictionaryRootDynamicNeighborhoodOptions {
  depth: 1 | 2;
  limit: number;
}

export interface DictionaryRootDynamicNeighborhoodNode {
  node: NormalizedNode;
  distance: number;
  graphMembership: DictionaryRootGraphMembership;
}

export interface DictionaryRootDynamicNeighborhoodResult {
  rootNodeId: string;
  depth: 1 | 2;
  limit: number;
  totalNodes: number;
  totalEdges: number;
  truncated: boolean;
  items: DictionaryRootDynamicNeighborhoodNode[];
  nodes: DictionaryRootDynamicNeighborhoodNode[];
  edges: NormalizedEdge[];
}

function graphMembership(node: NormalizedNode): DictionaryRootGraphMembership {
  const metadata = node.metadata || {};
  if (metadata.graphCoverage === false || node.status === "lexicon-only") {
    return "dynamic";
  }
  return "core";
}

function edgeKey(edge: NormalizedEdge): string {
  return edge.edgeId || `${edge.fromNodeId}|${edge.relationshipType || "RELATED_TO"}|${edge.toNodeId}`;
}

async function nodeEdges(nodeId: string): Promise<NormalizedEdge[]> {
  const [graphEdges, lexicalEdges] = await Promise.all([
    getEdgesByNodeId(nodeId),
    getDictionaryRootLexicalEdgesByNodeId(nodeId),
  ]);
  const combined = new Map<string, NormalizedEdge>();
  graphEdges.incoming
    .concat(graphEdges.outgoing, lexicalEdges.incoming, lexicalEdges.outgoing)
    .forEach((edge) => combined.set(edgeKey(edge), edge));
  return Array.from(combined.values());
}

export async function getDictionaryRootDynamicNeighborhood(
  rootNodeId: string,
  options: DictionaryRootDynamicNeighborhoodOptions,
): Promise<DictionaryRootDynamicNeighborhoodResult | undefined> {
  const root = await getNodeById(rootNodeId);
  if (!root) return undefined;

  const depth = options.depth === 2 ? 2 : 1;
  const limit = Math.max(2, Math.min(100, Math.floor(options.limit || 40)));
  const records = new Map<string, DictionaryRootDynamicNeighborhoodNode>();
  const edges = new Map<string, NormalizedEdge>();
  const queue: Array<{ nodeId: string; distance: number }> = [
    { nodeId: rootNodeId, distance: 0 },
  ];
  const expanded = new Set<string>();
  let truncated = false;

  records.set(rootNodeId, {
    node: root,
    distance: 0,
    graphMembership: graphMembership(root),
  });

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.distance >= depth || expanded.has(current.nodeId)) continue;
    expanded.add(current.nodeId);

    const neighborhoodEdges = (await nodeEdges(current.nodeId))
      .slice()
      .sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)));

    const neighborLimit = current.distance === 0 ? 28 : 14;
    let acceptedForCurrent = 0;

    for (const edge of neighborhoodEdges) {
      const neighborId = edge.fromNodeId === current.nodeId
        ? edge.toNodeId
        : edge.toNodeId === current.nodeId
          ? edge.fromNodeId
          : "";
      if (!neighborId) continue;

      if (!records.has(neighborId)) {
        if (records.size >= limit || acceptedForCurrent >= neighborLimit) {
          truncated = true;
          continue;
        }
        const neighbor = await getNodeById(neighborId);
        if (!neighbor) continue;
        const distance = current.distance + 1;
        records.set(neighborId, {
          node: neighbor,
          distance,
          graphMembership: graphMembership(neighbor),
        });
        queue.push({ nodeId: neighborId, distance });
        acceptedForCurrent += 1;
      }

      if (records.has(edge.fromNodeId) && records.has(edge.toNodeId)) {
        edges.set(edgeKey(edge), edge);
      }
    }
  }

  const items = Array.from(records.values()).sort((left, right) => (
    left.distance - right.distance
    || left.node.title.localeCompare(right.node.title)
    || left.node.nodeId.localeCompare(right.node.nodeId)
  ));
  const edgeItems = Array.from(edges.values()).sort((left, right) => (
    edgeKey(left).localeCompare(edgeKey(right))
  ));

  return {
    rootNodeId,
    depth,
    limit,
    totalNodes: items.length,
    totalEdges: edgeItems.length,
    truncated,
    items,
    nodes: items,
    edges: edgeItems,
  };
}
