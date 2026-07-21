(function dictionaryRootKnowledgeSphere(global) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const relationshipLabels = (global.DictionaryRootBrand && global.DictionaryRootBrand.RELATIONSHIP_LABELS) || {};
  const reducedMotion = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    manifest: null,
    client: null,
    nodes: new Map(),
    edges: new Map(),
    preferredLabels: new Map(),
    conceptCache: new Map(),
    centerId: null,
    selectedId: null,
    selectedEdgeKey: "",
    mode: "map",
    depth: 2,
    edgeMode: "center",
    lens: "domain",
    domainFilter: "all",
    trail: [],
    trailLabels: new Map(),
    rotationX: -0.18,
    rotationY: 0.45,
    autoRotate: !reducedMotion,
    dragging: false,
    lastPointerX: 0,
    lastPointerY: 0,
    detailsCollapsed: false,
    nextOrdinal: 0,
    positions: new Map(),
    nodeElements: new Map(),
    edgeElements: new Map(),
    animationFrame: 0,
    lastAnimationTime: 0,
    centerSourceCount: 0,
    loadToken: 0,
    navigatingHistory: false,
    baseNodeIds: new Set(),
    baseEdgeKeys: new Set(),
    expansionBranches: new Map(),
    expandedNodeIds: new Set(),
    expansionDepth: 1,
    expansionLimit: 72,
    expansionBusy: false
  };

  const elements = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sourceRecordId(source) {
    return String(source && (source.sourceId || source.id) || "").trim();
  }

  function experienceHref(page, nodeId, label, sourceId) {
    if (global.DictionaryRootNavigation) {
      return global.DictionaryRootNavigation.buildHref(page, {
        nodeId: nodeId || "",
        meaning: label || "",
        sourceId: sourceId || ""
      });
    }
    const params = new URLSearchParams();
    if (nodeId) params.set("nodeId", nodeId);
    if (label) params.set(page === "sources-v2.html" ? "meaning" : "q", label);
    if (sourceId) params.set("source", sourceId);
    return `${page}${params.toString() ? `?${params.toString()}` : ""}`;
  }

  function updateHistory(nodeId, label, mode) {
    if (!mode || state.navigatingHistory) return;
    const url = new URL(global.location.href);
    if (nodeId) url.searchParams.set("nodeId", nodeId);
    else url.searchParams.delete("nodeId");
    if (label) url.searchParams.set("q", label);
    else url.searchParams.delete("q");
    url.searchParams.set("mode", state.mode);
    url.searchParams.set("depth", String(state.depth));
    url.searchParams.set("expandDepth", String(state.expansionDepth));
    url.searchParams.set("maxNodes", String(state.expansionLimit));
    if (state.expandedNodeIds.size) url.searchParams.set("expand", Array.from(state.expandedNodeIds).join(","));
    else url.searchParams.delete("expand");
    if (mode === "replace") global.history.replaceState({}, "", url);
    else global.history.pushState({}, "", url);
  }

  function normalizeRelationship(value) {
    return String(value || "RELATED_TO").toUpperCase().replace(/[\s-]+/g, "_");
  }

  function friendlyRelationship(type, fallback) {
    const normalized = normalizeRelationship(type);
    return relationshipLabels[normalized]
      || fallback
      || normalized.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function edgeKey(edge) {
    return edge.edgeId || `${edge.fromNodeId}|${normalizeRelationship(edge.relationshipType)}|${edge.toNodeId}`;
  }

  function relationDescriptor(edge, nodeId) {
    const incoming = edge.toNodeId === nodeId;
    return {
      edge,
      incoming,
      neighborId: incoming ? edge.fromNodeId : edge.toNodeId,
      label: friendlyRelationship(edge.relationshipType, edge.label)
    };
  }

  function metadataFrom(record) {
    return record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  }

  function posFrom(record) {
    const metadata = metadataFrom(record);
    return metadata.partOfSpeech || metadata.pos || record.objectType || record.nodeType || "concept";
  }

  function lemmaList(record) {
    const metadata = metadataFrom(record);
    return Array.isArray(metadata.lemmas)
      ? metadata.lemmas.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
  }

  function displayLabel(itemOrNode) {
    const node = itemOrNode && itemOrNode.node ? itemOrNode.node : itemOrNode;
    if (!node) return "Untitled concept";
    const preferred = state.preferredLabels.get(node.nodeId);
    if (preferred) return preferred;
    const lemmas = lemmaList(node);
    if (lemmas.length && lemmas[0].length <= 44) return lemmas[0];
    return node.title || "Untitled concept";
  }

  function setStatus(message, status) {
    elements.status.textContent = message || "";
    elements.status.dataset.state = status || "";
  }

  function broadDomain(record) {
    const metadata = metadataFrom(record);
    const raw = String(
      metadata.domain
      || metadata.lexicographerFile
      || metadata.lexname
      || metadata.lexicalFile
      || metadata.semanticDomain
      || ""
    ).toLowerCase();

    if (/(cognition|knowledge|belief)/.test(raw)) return "Knowledge";
    if (/(communication|language)/.test(raw)) return "Language";
    if (/(quantity|number|measure|mathematics)/.test(raw)) return "Mathematics";
    if (/(artifact|technology|device|tool)/.test(raw)) return "Technology";
    if (/(animal|plant|body|substance|food|object|phenomenon|weather)/.test(raw)) return "Nature";
    if (/(person|group|social|law|economy|commerce)/.test(raw)) return "Society";
    if (/(feeling|emotion|motive|psychology)/.test(raw)) return "Experience";
    if (/(time|location|place|world)/.test(raw)) return "World";
    if (/(act|event|process)/.test(raw)) return "Action";
    if (/(state|attribute)/.test(raw)) return "State";
    if (/(relation)/.test(raw)) return "Relation";

    const pos = String(posFrom(record)).toLowerCase();
    if (pos.startsWith("v") || pos.includes("verb")) return "Action";
    if (pos.startsWith("a") || pos.includes("adjective") || pos.includes("adverb")) return "Attribute";
    return "Lexical";
  }

  function graphMembership(record) {
    const metadata = metadataFrom(record);
    return metadata.graphCoverage === false || record.status === "lexicon-only" ? "dynamic" : "core";
  }

  function expansionConfig() {
    return Object.assign({
      defaultDepth: 1,
      maximumDepth: 2,
      maximumVisibleNodes: 72,
      maximumBranches: 8
    }, state.manifest && state.manifest.dynamicExpansion || {});
  }

  function expansionIdsFromUrl(params) {
    return String(params.get("expand") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, Number(expansionConfig().maximumBranches || 8));
  }

  function hashNumber(value) {
    let hash = 0;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  }

  function domainVisual(domain) {
    const hue = hashNumber(domain) % 360;
    return {
      border: `hsl(${hue} 78% 68%)`,
      background: `hsla(${hue} 64% 26% / 0.94)`,
      soft: `hsla(${hue} 72% 64% / 0.18)`,
      text: "#f8fbff"
    };
  }

  function addNode(node, depth, parentId, options) {
    if (!node || !node.nodeId) return null;
    const config = Object.assign({ loadOrigin: "base", expansionRoot: "", membership: "" }, options || {});
    if (state.nodes.has(node.nodeId)) {
      const existing = state.nodes.get(node.nodeId);
      existing.depth = Math.min(existing.depth, Number(depth) || 0);
      if (existing.loadOrigin !== "base" && config.loadOrigin === "base") existing.loadOrigin = "base";
      if (!existing.expansionRoot && config.expansionRoot) existing.expansionRoot = config.expansionRoot;
      return existing;
    }

    const item = {
      node,
      depth: Number(depth) || 0,
      parentId: parentId || null,
      ordinal: state.nextOrdinal,
      domain: broadDomain(node),
      membership: config.membership || graphMembership(node),
      loadOrigin: config.loadOrigin,
      expansionRoot: config.expansionRoot || ""
    };
    state.nextOrdinal += 1;
    state.nodes.set(node.nodeId, item);
    return item;
  }

  function addEdge(edge) {
    if (!edge || !edge.fromNodeId || !edge.toNodeId) return;
    const key = edgeKey(edge);
    if (!state.edges.has(key)) state.edges.set(key, edge);
  }

  function degreeFor(nodeId) {
    let count = 0;
    for (const edge of state.edges.values()) {
      if (edge.fromNodeId === nodeId || edge.toNodeId === nodeId) count += 1;
    }
    return count;
  }

  function maximumDegree() {
    let maximum = 1;
    for (const nodeId of state.nodes.keys()) maximum = Math.max(maximum, degreeFor(nodeId));
    return maximum;
  }

  function maximumNodesForDepth(depth) {
    if (Number(depth) === 1) return 26;
    if (Number(depth) === 2) return 44;
    return 58;
  }

  function expansionLimit(currentDepth) {
    if (currentDepth === 0) return state.depth === 1 ? 25 : 22;
    if (currentDepth === 1) return state.depth === 2 ? 5 : 6;
    return 3;
  }

  function visibleItems() {
    return Array.from(state.nodes.values()).filter((item) => (
      item.node.nodeId === state.centerId
      || state.domainFilter === "all"
      || item.domain === state.domainFilter
    ));
  }

  function visibleNodeIds() {
    return new Set(visibleItems().map((item) => item.node.nodeId));
  }

  function edgeStrength(edge) {
    let score = 1;
    if (edge.fromNodeId === state.centerId || edge.toNodeId === state.centerId) score += 2;

    const from = state.nodes.get(edge.fromNodeId);
    const to = state.nodes.get(edge.toNodeId);
    if (from && to && from.domain === to.domain) score += 0.75;

    const type = normalizeRelationship(edge.relationshipType);
    if (/(SUPPORTED|VERIFIED|EVIDENCE|CAUSE|ENTAIL)/.test(type)) score += 1;
    if (/(DOMAIN|PART_OF|MEMBER|SUBSTANCE)/.test(type)) score += 0.5;

    score += Math.min(1, (degreeFor(edge.fromNodeId) + degreeFor(edge.toNodeId)) / 30);
    return Math.round(Math.min(5, score) * 10) / 10;
  }

  function neighborhoodEdges() {
    const visible = visibleNodeIds();
    return Array.from(state.edges.values()).filter((edge) => (
      visible.has(edge.fromNodeId) && visible.has(edge.toNodeId)
    ));
  }

  function filteredEdges() {
    return neighborhoodEdges().filter((edge) => {
      if (state.edgeMode === "center") {
        return edge.fromNodeId === state.centerId || edge.toNodeId === state.centerId;
      }
      if (state.edgeMode === "selected") {
        return edge.fromNodeId === state.selectedId || edge.toNodeId === state.selectedId;
      }
      return true;
    });
  }

  async function buildNeighborhood(centerId, token) {
    const maximum = Math.min(
      Number(state.manifest.graph.maximumNodeLimit || 150),
      maximumNodesForDepth(state.depth)
    );

    let frontier = [{ nodeId: centerId, depth: 0 }];
    const expanded = new Set();

    while (frontier.length && state.nodes.size < maximum) {
      const currentDepth = frontier[0].depth;
      const batch = frontier.filter((entry) => entry.depth === currentDepth);
      frontier = frontier.filter((entry) => entry.depth !== currentDepth);

      if (currentDepth >= state.depth) continue;

      const edgePayloads = await DictionaryRootApi.mapWithConcurrency(batch, 5, async (entry) => {
        if (token !== state.loadToken || expanded.has(entry.nodeId)) return null;
        expanded.add(entry.nodeId);
        try {
          const result = await state.client.nodeEdges(entry.nodeId);
          return { entry, edges: DictionaryRootApi.edgeItems(result.data) };
        } catch (_) {
          return { entry, edges: [] };
        }
      });

      if (token !== state.loadToken) return;

      const candidates = [];
      const seenCandidateIds = new Set();

      edgePayloads.filter(Boolean).forEach(({ entry, edges }) => {
        const relations = edges
          .map((edge) => relationDescriptor(edge, entry.nodeId))
          .filter((relation) => relation.neighborId)
          .sort((left, right) => {
            const leftDirect = left.edge.fromNodeId === state.centerId || left.edge.toNodeId === state.centerId ? 1 : 0;
            const rightDirect = right.edge.fromNodeId === state.centerId || right.edge.toNodeId === state.centerId ? 1 : 0;
            return rightDirect - leftDirect || left.label.localeCompare(right.label);
          })
          .slice(0, expansionLimit(entry.depth));

        relations.forEach((relation) => {
          addEdge(relation.edge);
          if (state.nodes.has(relation.neighborId) || seenCandidateIds.has(relation.neighborId)) return;
          if (state.nodes.size + candidates.length >= maximum) return;
          seenCandidateIds.add(relation.neighborId);
          candidates.push({
            nodeId: relation.neighborId,
            depth: entry.depth + 1,
            parentId: entry.nodeId
          });
        });
      });

      const loaded = await state.client.nodesByIds(candidates.map((entry) => entry.nodeId), { concurrency: 6 });
      if (token !== state.loadToken) return;

      const candidateMap = new Map(candidates.map((entry) => [entry.nodeId, entry]));
      loaded.forEach((node) => {
        const candidate = candidateMap.get(node.nodeId);
        if (!candidate) return;
        addNode(node, candidate.depth, candidate.parentId);
        frontier.push({ nodeId: node.nodeId, depth: candidate.depth });
      });
    }
  }

  function rotatePoint(x, y, z) {
    const cosY = Math.cos(state.rotationY);
    const sinY = Math.sin(state.rotationY);
    const cosX = Math.cos(state.rotationX);
    const sinX = Math.sin(state.rotationX);

    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    return { x: x1, y: y2, z: z2 };
  }

  function spherePositions(items) {
    const positions = new Map();
    const center = state.nodes.get(state.centerId);
    if (!center) return positions;

    positions.set(state.centerId, {
      x: 50,
      y: 50,
      z: 1,
      depth: 0,
      scale: 1.2,
      opacity: 1,
      zIndex: 999
    });

    const others = items
      .filter((item) => item.node.nodeId !== state.centerId)
      .sort((left, right) => (
        left.depth - right.depth
        || degreeFor(right.node.nodeId) - degreeFor(left.node.nodeId)
        || left.ordinal - right.ordinal
      ));

    const raw = [];
    const count = Math.max(1, others.length);

    others.forEach((item, index) => {
      const t = (index + 0.5) / count;
      let y = 1 - 2 * t;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = index * GOLDEN_ANGLE;

      let x = Math.cos(theta) * radius;
      let z = Math.sin(theta) * radius;

      if (item.depth === 1) z += 0.28;
      if (item.depth === 2) z += 0.02;
      if (item.depth >= 3) z -= 0.18;

      const length = Math.sqrt(x * x + y * y + z * z) || 1;
      x /= length;
      y /= length;
      z /= length;

      const rotated = rotatePoint(x, y, z);
      const perspective = 1.14 / (1.78 - rotated.z);

      raw.push({
        item,
        rx: rotated.x * perspective,
        ry: rotated.y * perspective,
        rz: rotated.z,
        scale: perspective,
        opacity: 0.38 + ((rotated.z + 1) / 2) * 0.62
      });
    });

    let maxX = 1;
    let maxY = 1;
    raw.forEach((point) => {
      maxX = Math.max(maxX, Math.abs(point.rx));
      maxY = Math.max(maxY, Math.abs(point.ry));
    });

    const fit = Math.min(46 / maxX, 46 / maxY, 46);
    raw.forEach((point) => {
      positions.set(point.item.node.nodeId, {
        x: Math.max(4.5, Math.min(95.5, 50 + point.rx * fit)),
        y: Math.max(5.5, Math.min(94.5, 50 + point.ry * fit)),
        z: point.rz,
        depth: point.item.depth,
        scale: point.scale,
        opacity: point.opacity,
        zIndex: Math.round(300 + point.rz * 120)
      });
    });

    return positions;
  }

  function readablePositions(items) {
    const positions = new Map();
    positions.set(state.centerId, {
      x: 50,
      y: 50,
      z: 1,
      depth: 0,
      scale: 1,
      opacity: 1,
      zIndex: 999
    });

    const rings = new Map();
    items.forEach((item) => {
      if (item.node.nodeId === state.centerId) return;
      const depth = Math.max(1, item.depth);
      if (!rings.has(depth)) rings.set(depth, []);
      rings.get(depth).push(item);
    });

    rings.forEach((ringItems, depth) => {
      ringItems.sort((left, right) => (
        left.domain.localeCompare(right.domain)
        || degreeFor(right.node.nodeId) - degreeFor(left.node.nodeId)
        || left.ordinal - right.ordinal
      ));

      let radiusX = 28;
      let radiusY = 31;
      if (state.depth === 2) {
        radiusX = depth === 1 ? 27 : 43;
        radiusY = depth === 1 ? 30 : 42;
      }
      if (state.depth === 3) {
        radiusX = depth === 1 ? 23 : depth === 2 ? 36 : 46;
        radiusY = depth === 1 ? 25 : depth === 2 ? 36 : 44;
      }

      ringItems.forEach((item, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(1, ringItems.length) - Math.PI / 2 + depth * 0.22;
        positions.set(item.node.nodeId, {
          x: 50 + Math.cos(angle) * radiusX,
          y: 50 + Math.sin(angle) * radiusY,
          z: 0.8 - depth * 0.1,
          depth,
          scale: 1,
          opacity: 1,
          zIndex: 300 - depth
        });
      });
    });

    return positions;
  }

  function calculatePositions() {
    const items = visibleItems();
    return state.mode === "map" ? spherePositions(items) : readablePositions(items);
  }

  function nodeSize(item, position) {
    if (item.node.nodeId === state.centerId) return { width: 176, height: 106 };

    const maximum = maximumDegree();
    const importance = degreeFor(item.node.nodeId) / maximum;
    let width = item.depth === 1 ? 128 : item.depth === 2 ? 112 : 98;

    if (state.lens === "importance") width += Math.round(importance * 38);
    if (state.lens === "strength") width += Math.min(22, degreeFor(item.node.nodeId) * 2);

    if (state.mode === "map" && position) {
      width *= 0.82 + position.scale * 0.28;
    }

    width = Math.max(92, Math.min(164, Math.round(width)));
    return { width, height: Math.max(52, Math.round(width * 0.62)) };
  }

  function nodeVisual(item) {
    const domain = domainVisual(item.domain);
    const importance = degreeFor(item.node.nodeId) / maximumDegree();

    if (item.node.nodeId === state.centerId) {
      return {
        border: "#a5f3fc",
        background: "linear-gradient(145deg, #0f4f7e, #0b3157)",
        soft: "rgba(103, 232, 249, 0.28)",
        text: "#ffffff"
      };
    }

    if (item.node.nodeId === state.selectedId) {
      return {
        border: "#ddd6fe",
        background: "linear-gradient(145deg, #4c4b9b, #2f3271)",
        soft: "rgba(196, 181, 253, 0.3)",
        text: "#ffffff"
      };
    }

    if (state.lens === "importance") {
      if (importance > 0.65) {
        return { border: "#a5f3fc", background: "#0f4f7e", soft: "rgba(103,232,249,.24)", text: "#fff" };
      }
      if (importance > 0.35) {
        return { border: "#93c5fd", background: "#173e67", soft: "rgba(147,197,253,.18)", text: "#fff" };
      }
      return { border: "#64748b", background: "#152538", soft: "rgba(148,163,184,.12)", text: "#e8eef8" };
    }

    if (state.lens === "strength") {
      const degree = degreeFor(item.node.nodeId);
      return {
        border: degree >= 4 ? "#67e8f9" : degree >= 2 ? "#60a5fa" : "#64748b",
        background: degree >= 4 ? "#0f4f67" : "#162b42",
        soft: degree >= 4 ? "rgba(103,232,249,.22)" : "rgba(96,165,250,.12)",
        text: "#fff"
      };
    }

    return domain;
  }

  function edgeVisual(edge) {
    const strength = edgeStrength(edge);
    const selected = edgeKey(edge) === state.selectedEdgeKey;
    const connected = edge.fromNodeId === state.selectedId || edge.toNodeId === state.selectedId;

    if (selected) return { color: "#fef08a", width: 1.25, opacity: 1 };
    if (state.lens === "strength") {
      return {
        color: strength >= 4 ? "#67e8f9" : strength >= 3 ? "#60a5fa" : "#6b86a8",
        width: 0.24 + strength * 0.18,
        opacity: strength >= 4 ? 0.98 : strength >= 3 ? 0.82 : 0.48
      };
    }
    if (state.lens === "importance") {
      const direct = edge.fromNodeId === state.centerId || edge.toNodeId === state.centerId;
      return {
        color: direct ? "#67e8f9" : "#5e7898",
        width: direct ? 0.9 : 0.42,
        opacity: direct ? 0.92 : 0.42
      };
    }
    return {
      color: connected ? "#a5f3fc" : "#4c86b6",
      width: connected ? 0.85 : 0.48,
      opacity: connected ? 0.95 : 0.62
    };
  }

  function createNodeElement(item) {
    const node = item.node;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dr-sphere-node";
    button.dataset.nodeId = node.nodeId;
    button.setAttribute("aria-label", `${displayLabel(item)}, ${posFrom(node)}, ${item.membership === "core" ? "curated core" : "loaded on demand"}. Click to inspect. Double-click to center.`);
    button.dataset.membership = item.membership;
    button.innerHTML = `<span class="dr-sphere-node-label">${escapeHtml(displayLabel(item))}</span><span class="dr-sphere-node-pos">${escapeHtml(posFrom(node))}</span><span class="dr-sphere-node-membership">${item.membership === "core" ? "Core" : "Dynamic"}</span>`;
    return button;
  }

  function createEdgeElements(edge) {
    const line = document.createElementNS(NS, "line");
    line.classList.add("dr-sphere-edge");
    line.dataset.edgeKey = edgeKey(edge);

    const hit = document.createElementNS(NS, "line");
    hit.classList.add("dr-sphere-edge-hit");
    hit.dataset.edgeKey = edgeKey(edge);

    const title = document.createElementNS(NS, "title");
    title.textContent = friendlyRelationship(edge.relationshipType, edge.label);
    hit.appendChild(title);

    elements.edgeLayer.appendChild(line);
    elements.edgeLayer.appendChild(hit);
    return { line, hit, edge };
  }

  function renderGraphStructure() {
    elements.nodeLayer.innerHTML = "";
    elements.edgeLayer.innerHTML = "";
    state.nodeElements.clear();
    state.edgeElements.clear();

    const items = visibleItems();
    items.forEach((item) => {
      const element = createNodeElement(item);
      elements.nodeLayer.appendChild(element);
      state.nodeElements.set(item.node.nodeId, { element, item });
    });

    filteredEdges().forEach((edge) => {
      state.edgeElements.set(edgeKey(edge), createEdgeElements(edge));
    });

    updateProjectedGeometry();
    updateGraphMeta();
  }

  function updateProjectedGeometry() {
    state.positions = calculatePositions();

    state.nodeElements.forEach(({ element, item }, nodeId) => {
      const position = state.positions.get(nodeId);
      if (!position) {
        element.hidden = true;
        return;
      }

      element.hidden = false;
      const size = nodeSize(item, position);
      const visual = nodeVisual(item);

      element.style.left = `${position.x}%`;
      element.style.top = `${position.y}%`;
      element.style.width = `${size.width}px`;
      element.style.minHeight = `${size.height}px`;
      element.style.zIndex = String(position.zIndex);
      element.style.opacity = String(nodeId === state.centerId ? 1 : position.opacity);
      element.style.setProperty("--sphere-node-border", visual.border);
      element.style.setProperty("--sphere-node-bg", visual.background);
      element.style.setProperty("--sphere-node-soft", visual.soft);
      element.style.setProperty("--sphere-node-text", visual.text);
      element.dataset.center = String(nodeId === state.centerId);
      element.dataset.selected = String(nodeId === state.selectedId);
      element.dataset.depth = String(item.depth);
    });

    state.edgeElements.forEach(({ line, hit, edge }) => {
      const from = state.positions.get(edge.fromNodeId);
      const to = state.positions.get(edge.toNodeId);
      if (!from || !to) {
        line.setAttribute("visibility", "hidden");
        hit.setAttribute("visibility", "hidden");
        return;
      }

      line.setAttribute("visibility", "visible");
      hit.setAttribute("visibility", "visible");
      [line, hit].forEach((element) => {
        element.setAttribute("x1", String(from.x));
        element.setAttribute("y1", String(from.y));
        element.setAttribute("x2", String(to.x));
        element.setAttribute("y2", String(to.y));
      });

      const visual = edgeVisual(edge);
      const averageZ = (from.z + to.z) / 2;
      const depthOpacity = state.mode === "map" ? 0.46 + ((averageZ + 1) / 2) * 0.54 : 1;
      line.style.stroke = visual.color;
      line.style.strokeWidth = String(visual.width);
      line.style.opacity = String(visual.opacity * depthOpacity);
    });

    elements.stage.classList.toggle("map-mode", state.mode === "map");
    elements.stage.classList.toggle("readable-mode", state.mode === "readable");
    // Preserve the original sphere/flat classes so the committed visual system remains compatible.
    elements.stage.classList.toggle("sphere-mode", state.mode === "map");
    elements.stage.classList.toggle("flat-mode", state.mode === "readable");
    elements.stageHint.textContent = state.mode === "map"
      ? "Drag to rotate · Click to inspect · Expand selected to reveal more"
      : "Readable cards · Click to inspect · Expand selected to reveal more";
    updateModeControls();
  }

  function updateGraphMeta() {
    const center = state.nodes.get(state.centerId);
    const visible = visibleItems();
    const neighborhood = neighborhoodEdges();
    const displayed = filteredEdges();
    const centerConnections = neighborhood.filter((edge) => (
      edge.fromNodeId === state.centerId || edge.toNodeId === state.centerId
    )).length;
    const domains = new Set(visible.map((item) => item.domain));
    const coreCount = visible.filter((item) => item.membership === "core").length;
    const dynamicCount = visible.length - coreCount;

    elements.title.textContent = center ? `${displayLabel(center)} Knowledge Sphere` : "Knowledge Sphere";
    elements.meta.textContent = `${state.depth}-hop base · ${state.expansionBranches.size} expanded branch${state.expansionBranches.size === 1 ? "" : "es"} · ${state.mode} mode · ${state.lens} lens`;
    elements.count.textContent = `${visible.length} concepts · ${neighborhood.length} neighborhood · ${displayed.length} displayed`;
    elements.statConcepts.textContent = String(visible.length);
    elements.statNeighborhoodEdges.textContent = String(neighborhood.length);
    elements.statEdges.textContent = String(displayed.length);
    elements.statCenterEdges.textContent = String(centerConnections);
    elements.statDomains.textContent = String(domains.size);
    elements.statSources.textContent = String(state.centerSourceCount);
    elements.statCoreNodes.textContent = String(coreCount);
    elements.statDynamicNodes.textContent = String(dynamicCount);
    elements.statBranches.textContent = String(state.expansionBranches.size);
    renderDomainLegend(visible);
    updateExpansionControls();
  }

  function renderDomainLegend(items) {
    const counts = new Map();
    items.forEach((item) => counts.set(item.domain, (counts.get(item.domain) || 0) + 1));

    elements.domainLegend.innerHTML = "";
    if (!counts.size) {
      elements.domainLegend.innerHTML = '<span class="dr-live-canonical">No visible domains.</span>';
      return;
    }

    Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .forEach(([domain, count]) => {
        const visual = domainVisual(domain);
        const item = document.createElement("span");
        item.innerHTML = `<i style="--domain-dot:${escapeHtml(visual.border)}"></i>${escapeHtml(domain)} <strong>${count}</strong>`;
        elements.domainLegend.appendChild(item);
      });
  }

  function updateDomainFilter() {
    const current = state.domainFilter;
    const domains = Array.from(new Set(Array.from(state.nodes.values()).map((item) => item.domain))).sort();
    elements.domainFilter.innerHTML = '<option value="all">All domains</option>';
    domains.forEach((domain) => {
      const option = document.createElement("option");
      option.value = domain;
      option.textContent = domain;
      elements.domainFilter.appendChild(option);
    });
    state.domainFilter = domains.includes(current) ? current : "all";
    elements.domainFilter.value = state.domainFilter;
  }

  function renderBreadcrumb() {
    elements.breadcrumbTrail.innerHTML = "";
    state.trail.forEach((nodeId, index) => {
      const item = state.nodes.get(nodeId);
      const label = item ? displayLabel(item) : state.trailLabels.get(nodeId) || state.preferredLabels.get(nodeId) || "Concept";

      if (index > 0) {
        const arrow = document.createElement("span");
        arrow.className = "dr-sphere-breadcrumb-arrow";
        arrow.textContent = ">";
        elements.breadcrumbTrail.appendChild(arrow);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "dr-sphere-breadcrumb-node";
      button.dataset.trailIndex = String(index);
      button.dataset.nodeId = nodeId;
      button.textContent = label;
      button.classList.toggle("active", nodeId === state.centerId);
      elements.breadcrumbTrail.appendChild(button);
    });
  }

  function addToTrail(nodeId, reset) {
    if (reset) state.trail = [];
    const item = state.nodes.get(nodeId);
    state.trailLabels.set(nodeId, item ? displayLabel(item) : state.preferredLabels.get(nodeId) || "Concept");

    const existingIndex = state.trail.indexOf(nodeId);
    if (existingIndex >= 0) {
      state.trail = state.trail.slice(0, existingIndex + 1);
    } else {
      state.trail.push(nodeId);
    }
    renderBreadcrumb();
  }

  function setExpansionStatus(message, status) {
    if (!elements.expansionStatus) return;
    elements.expansionStatus.textContent = message || "";
    elements.expansionStatus.dataset.state = status || "";
  }

  function captureBaseNeighborhood() {
    state.baseNodeIds = new Set(state.nodes.keys());
    state.baseEdgeKeys = new Set(state.edges.keys());
    state.expansionBranches.clear();
    state.expandedNodeIds.clear();
  }

  function updateExpansionControls() {
    if (!elements.expandSelected) return;
    const selected = state.selectedId && state.nodes.has(state.selectedId);
    const expanded = selected && state.expandedNodeIds.has(state.selectedId);
    const atLimit = state.nodes.size >= state.expansionLimit;
    elements.expandSelected.disabled = state.expansionBusy || !selected || expanded || atLimit;
    elements.collapseSelected.disabled = state.expansionBusy || !expanded;
    elements.resetExpansions.disabled = state.expansionBusy || state.expansionBranches.size === 0;
    elements.expansionDepth.value = String(state.expansionDepth);
    elements.expansionLimit.value = String(state.expansionLimit);
  }

  function keepSetsForExpansions() {
    const nodeIds = new Set(state.baseNodeIds);
    const edgeKeys = new Set(state.baseEdgeKeys);
    state.expansionBranches.forEach((branch) => {
      branch.nodeIds.forEach((nodeId) => nodeIds.add(nodeId));
      branch.edgeKeys.forEach((key) => edgeKeys.add(key));
    });
    return { nodeIds, edgeKeys };
  }

  function pruneCollapsedExpansionData() {
    const keep = keepSetsForExpansions();
    Array.from(state.nodes.keys()).forEach((nodeId) => {
      if (!keep.nodeIds.has(nodeId)) {
        state.nodes.delete(nodeId);
        state.positions.delete(nodeId);
        state.conceptCache.delete(nodeId);
      }
    });
    Array.from(state.edges.keys()).forEach((key) => {
      const edge = state.edges.get(key);
      if (!keep.edgeKeys.has(key) || !edge || !state.nodes.has(edge.fromNodeId) || !state.nodes.has(edge.toNodeId)) {
        state.edges.delete(key);
      }
    });
    if (!state.nodes.has(state.selectedId)) state.selectedId = state.centerId;
    updateDomainFilter();
    renderGraphStructure();
  }

  async function expandBranch(nodeId, options) {
    const config = Object.assign({ history: "push", quiet: false }, options || {});
    if (!nodeId || state.expansionBusy || state.expandedNodeIds.has(nodeId)) return;
    const maximumBranches = Number(expansionConfig().maximumBranches || 8);
    if (state.expansionBranches.size >= maximumBranches) {
      setExpansionStatus(`The expansion limit of ${maximumBranches} branches has been reached. Collapse a branch before adding another.`, "error");
      return;
    }

    const available = Math.max(0, state.expansionLimit - state.nodes.size);
    if (available < 1) {
      setExpansionStatus(`The visible node budget of ${state.expansionLimit} has been reached. Collapse a branch or raise the budget.`, "error");
      return;
    }

    const centerAtStart = state.centerId;
    const loadTokenAtStart = state.loadToken;
    state.expansionBusy = true;
    updateExpansionControls();
    if (!config.quiet) setExpansionStatus(`Expanding ${state.expansionDepth} hop${state.expansionDepth === 1 ? "" : "s"} from the selected meaning...`, "loading");

    try {
      const requestLimit = Math.max(2, Math.min(100, available + 1));
      const response = await state.client.dynamicNeighborhood(nodeId, {
        depth: state.expansionDepth,
        limit: requestLimit
      });
      if (centerAtStart !== state.centerId || loadTokenAtStart !== state.loadToken) return;
      const payload = response.data || {};
      const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.nodes) ? payload.nodes : [];
      const branchNodeIds = new Set();
      const branchEdgeKeys = new Set();
      const rootItem = state.nodes.get(nodeId);
      const rootDepth = rootItem ? rootItem.depth : 0;

      items.forEach((record) => {
        const node = record && record.node ? record.node : record;
        if (!node || !node.nodeId) return;
        const distance = Number(record.distance || 0);
        addNode(node, Math.min(state.depth + state.expansionDepth + 1, rootDepth + distance), nodeId, {
          loadOrigin: "dynamic",
          expansionRoot: nodeId,
          membership: record.graphMembership || graphMembership(node)
        });
        branchNodeIds.add(node.nodeId);
      });

      (Array.isArray(payload.edges) ? payload.edges : []).forEach((edge) => {
        if (!edge || !state.nodes.has(edge.fromNodeId) || !state.nodes.has(edge.toNodeId)) return;
        addEdge(edge);
        branchEdgeKeys.add(edgeKey(edge));
      });

      if (!branchNodeIds.size) {
        setExpansionStatus("No additional relationships were available for this meaning.", "");
        return;
      }

      state.expansionBranches.set(nodeId, {
        nodeIds: branchNodeIds,
        edgeKeys: branchEdgeKeys,
        truncated: Boolean(payload.truncated)
      });
      state.expandedNodeIds.add(nodeId);
      updateDomainFilter();
      renderGraphStructure();
      if (config.history) updateHistory(state.centerId, displayLabel(state.nodes.get(state.centerId)), config.history);

      const addedCount = Array.from(branchNodeIds).filter((id) => !state.baseNodeIds.has(id)).length;
      const rootLabel = state.nodes.has(nodeId) ? displayLabel(state.nodes.get(nodeId)) : "selected meaning";
      setExpansionStatus(
        `Expanded “${rootLabel}” with ${addedCount} on-demand node${addedCount === 1 ? "" : "s"}${payload.truncated ? " within the current budget" : ""}.`,
        "success"
      );
    } catch (error) {
      setExpansionStatus(error.message || "The selected branch could not be expanded.", "error");
    } finally {
      state.expansionBusy = false;
      updateExpansionControls();
    }
  }

  function collapseBranch(nodeId, historyMode) {
    if (!nodeId || !state.expansionBranches.has(nodeId)) return;
    state.expansionBranches.delete(nodeId);
    state.expandedNodeIds.delete(nodeId);
    pruneCollapsedExpansionData();
    if (historyMode) updateHistory(state.centerId, displayLabel(state.nodes.get(state.centerId)), historyMode);
    setExpansionStatus("The selected dynamic branch was collapsed.", "success");
  }

  function clearExpansions(historyMode) {
    state.expansionBranches.clear();
    state.expandedNodeIds.clear();
    pruneCollapsedExpansionData();
    if (historyMode) updateHistory(state.centerId, displayLabel(state.nodes.get(state.centerId)), historyMode);
    setExpansionStatus("All on-demand branches were cleared. The base sphere remains unchanged.", "success");
  }

  async function restoreExpansions(nodeIds) {
    for (const nodeId of nodeIds || []) {
      if (state.expansionBranches.size >= Number(expansionConfig().maximumBranches || 8)) break;
      await expandBranch(nodeId, { history: null, quiet: true });
    }
    if ((nodeIds || []).length) setExpansionStatus("Restored the shared dynamic expansion state from the URL.", "success");
  }

  function relationshipNameForEdge(edge) {
    return friendlyRelationship(edge.relationshipType, edge.label);
  }

  function groupedRelations(edges, nodeId) {
    const groups = new Map();

    (edges || []).map((edge) => relationDescriptor(edge, nodeId)).forEach((relation) => {
      if (!relation.neighborId) return;
      if (!groups.has(relation.neighborId)) {
        groups.set(relation.neighborId, {
          neighborId: relation.neighborId,
          labels: [],
          edges: []
        });
      }

      const group = groups.get(relation.neighborId);
      if (!group.labels.includes(relation.label)) group.labels.push(relation.label);
      group.edges.push(relation.edge);
    });

    return Array.from(groups.values()).sort((left, right) => {
      const leftNode = state.nodes.get(left.neighborId);
      const rightNode = state.nodes.get(right.neighborId);
      return displayLabel(leftNode || { nodeId: left.neighborId, title: left.neighborId })
        .localeCompare(displayLabel(rightNode || { nodeId: right.neighborId, title: right.neighborId }));
    });
  }

  async function conceptFor(nodeId) {
    if (state.conceptCache.has(nodeId)) return state.conceptCache.get(nodeId);
    const concept = await state.client.concept(nodeId);
    state.conceptCache.set(nodeId, concept);
    return concept;
  }

  function edgeDetailHtml() {
    if (!state.selectedEdgeKey || !state.edges.has(state.selectedEdgeKey)) return "";
    const edge = state.edges.get(state.selectedEdgeKey);
    const from = state.nodes.get(edge.fromNodeId);
    const to = state.nodes.get(edge.toNodeId);
    return `<section class="dr-live-section">
      <h3>Selected relationship</h3>
      <div class="dr-sphere-edge-detail">
        <strong>${escapeHtml(from ? displayLabel(from) : edge.fromNodeId)} → ${escapeHtml(to ? displayLabel(to) : edge.toNodeId)}</strong>
        <span>${escapeHtml(relationshipNameForEdge(edge))} · strength ${edgeStrength(edge)}</span>
        <p>${escapeHtml(edge.summary || edge.description || "This semantic relationship is stored as a SourceRoot edge.")}</p>
      </div>
    </section>`;
  }

  async function showDetails(nodeId) {
    const item = state.nodes.get(nodeId);
    if (!item) return;

    state.selectedId = nodeId;
    state.selectedEdgeKey = "";
    renderGraphStructure();
    elements.details.innerHTML = '<div class="dr-live-empty"><strong>Loading concept details...</strong>Retrieving definitions, examples, sources, and relationships.</div>';

    try {
      const concept = await conceptFor(nodeId);
      const definition = (concept.assertions || []).find((entry) => entry.assertionType === "definition");
      const usage = (concept.assertions || []).find((entry) => entry.assertionType === "usage-example");
      const examples = usage && (usage.body || usage.summary)
        ? String(usage.body || usage.summary).split(/\r?\n|\s*\|\s*/).filter(Boolean)
        : [];

      const preferred = displayLabel(item);
      const canonical = preferred.toLocaleLowerCase() !== String(concept.node.title || "").toLocaleLowerCase()
        ? concept.node.title
        : "";

      const relations = groupedRelations(concept.edges || [], nodeId).slice(0, 16);

      const relationshipHtml = relations.length
        ? relations.map((relation) => {
          const neighbor = state.nodes.get(relation.neighborId);
          const label = neighbor ? displayLabel(neighbor) : relation.neighborId;
          const shownLabels = relation.labels.slice(0, 3);
          const remaining = Math.max(0, relation.labels.length - shownLabels.length);
          const relationshipSummary = `${shownLabels.join(" · ")}${remaining ? ` · +${remaining} more` : ""}`;
          return `<button type="button" class="dr-sphere-related-button" data-related-node="${escapeHtml(relation.neighborId)}">
            <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(relationshipSummary)}</small></span>
            <em>Center</em>
          </button>`;
        }).join("")
        : "<p>No connected concepts were found.</p>";

      const sourceHtml = concept.sources && concept.sources.length
        ? concept.sources.map((source) => {
          const id = sourceRecordId(source);
          const sourceHref = experienceHref("sources-v2.html", nodeId, preferred, id);
          return `<div class="dr-live-source-card"><strong>${escapeHtml(source.name || source.title || id || "Recorded source")}</strong><span>${escapeHtml(source.license || "License unavailable")}</span><a class="dr-concept-text-link" href="${escapeHtml(sourceHref)}">Inspect source record</a></div>`;
        }).join("")
        : "<p>Source identifiers remain attached to this concept.</p>";

      elements.details.innerHTML = `<section class="dr-live-section">
        <div class="dr-live-chip-row">
          <span class="dr-live-chip" data-tone="accent">${escapeHtml(posFrom(concept.node))}</span>
          <span class="dr-live-chip" data-tone="good">Source-backed</span>
          <span class="dr-live-chip" data-membership="${escapeHtml(item.membership)}">${item.membership === "core" ? "Curated core" : "Loaded on demand"}</span>
          <span class="dr-live-chip">${escapeHtml(item.domain)}</span>
        </div>
        <h2 class="dr-live-concept-title dr-sphere-selected-title">${escapeHtml(preferred)}</h2>
        ${canonical ? `<p class="dr-live-canonical">Open English WordNet groups this sense under <strong>${escapeHtml(canonical)}</strong>.</p>` : ""}
        <p class="dr-live-definition dr-sphere-definition">${escapeHtml((definition && (definition.body || definition.summary)) || concept.node.summary || "No definition is available.")}</p>
        <div class="dr-live-actions">
          <button class="dr-live-button" type="button" data-expand-selected>${state.expandedNodeIds.has(nodeId) ? "Branch expanded" : `Expand ${state.expansionDepth} hop${state.expansionDepth === 1 ? "" : "s"}`}</button>
          ${state.expandedNodeIds.has(nodeId) ? '<button class="dr-live-button-secondary" type="button" data-collapse-selected>Collapse branch</button>' : ""}
          <button class="dr-live-button-secondary" type="button" data-center-selected>Make center</button>
          <a class="dr-live-button-secondary dr-sphere-link-button" href="${escapeHtml(experienceHref("concept-v2.html", nodeId, preferred, sourceRecordId((concept.sources || [])[0])))}">Full concept page</a>
        </div>
      </section>
      ${edgeDetailHtml()}
      <section class="dr-live-section">
        <h3>Usage examples</h3>
        ${examples.length ? `<ul class="dr-live-example-list">${examples.map((example) => `<li>${escapeHtml(example)}</li>`).join("")}</ul>` : "<p>No usage examples are available for this meaning.</p>"}
      </section>
      <section class="dr-live-section">
        <h3>Connected concepts</h3>
        <div class="dr-sphere-related-list">${relationshipHtml}</div>
      </section>
      <section class="dr-live-section">
        <h3>Provenance</h3>
        ${sourceHtml}
      </section>
      <details class="dr-live-advanced">
        <summary>Advanced SourceRoot details</summary>
        <pre>${escapeHtml(JSON.stringify(concept, null, 2))}</pre>
      </details>`;
    } catch (error) {
      elements.details.innerHTML = `<div class="dr-live-empty"><strong>Concept details could not be loaded.</strong>${escapeHtml(error.message || "Check the SourceRoot connection.")}</div>`;
    }
  }

  function showEdgeDetails(key) {
    if (!state.edges.has(key)) return;
    state.selectedEdgeKey = key;
    const edge = state.edges.get(key);
    state.selectedId = edge.toNodeId === state.centerId ? edge.fromNodeId : edge.toNodeId;
    renderGraphStructure();

    const from = state.nodes.get(edge.fromNodeId);
    const to = state.nodes.get(edge.toNodeId);
    elements.details.innerHTML = `<section class="dr-live-section">
      <div class="dr-live-chip-row"><span class="dr-live-chip" data-tone="accent">SourceRoot edge</span><span class="dr-live-chip">Strength ${edgeStrength(edge)}</span></div>
      <h2 class="dr-live-concept-title dr-sphere-selected-title">${escapeHtml(relationshipNameForEdge(edge))}</h2>
      <p class="dr-live-definition dr-sphere-definition">${escapeHtml(edge.summary || edge.description || "This relationship connects two source-backed concepts.")}</p>
      <div class="dr-sphere-edge-detail">
        <strong>${escapeHtml(from ? displayLabel(from) : edge.fromNodeId)} → ${escapeHtml(to ? displayLabel(to) : edge.toNodeId)}</strong>
        <span>${escapeHtml(normalizeRelationship(edge.relationshipType))}</span>
      </div>
      <div class="dr-live-actions">
        <button class="dr-live-button-secondary" type="button" data-inspect-node="${escapeHtml(edge.fromNodeId)}">Inspect first concept</button>
        <button class="dr-live-button-secondary" type="button" data-inspect-node="${escapeHtml(edge.toNodeId)}">Inspect second concept</button>
      </div>
    </section>`;
  }

  async function openCenter(nodeId, preferredLabel, options) {
    const config = Object.assign({ history: "push", resetTrail: false, expandedIds: [] }, options || {});
    const token = state.loadToken + 1;
    state.loadToken = token;

    setStatus("Building the live DictionaryRoot knowledge sphere...", "loading");
    elements.details.innerHTML = '<div class="dr-live-empty"><strong>Loading center concept...</strong>Preparing the source-backed sphere.</div>';

    try {
      const nodeResult = await state.client.node(nodeId);
      if (token !== state.loadToken) return;

      state.nodes.clear();
      state.edges.clear();
      state.preferredLabels.clear();
      state.positions.clear();
      state.nextOrdinal = 0;
      state.selectedEdgeKey = "";
      state.centerSourceCount = 0;
      state.baseNodeIds.clear();
      state.baseEdgeKeys.clear();
      state.expansionBranches.clear();
      state.expandedNodeIds.clear();
      setExpansionStatus("", "");

      state.centerId = nodeId;
      state.selectedId = nodeId;
      if (preferredLabel) state.preferredLabels.set(nodeId, preferredLabel);
      addNode(nodeResult.data, 0, null);

      const activeCenterLabel = displayLabel(state.nodes.get(nodeId));
      elements.input.value = activeCenterLabel;
      elements.results.innerHTML = "";

      renderGraphStructure();
      await buildNeighborhood(nodeId, token);
      if (token !== state.loadToken) return;

      updateDomainFilter();
      renderGraphStructure();
      captureBaseNeighborhood();
      addToTrail(nodeId, Boolean(config.resetTrail));

      if (Array.isArray(config.expandedIds) && config.expandedIds.length) {
        await restoreExpansions(config.expandedIds);
        if (token !== state.loadToken) return;
      }

      const centerConcept = await conceptFor(nodeId);
      if (token !== state.loadToken) return;
      state.centerSourceCount = (centerConcept.sources || []).length;
      updateGraphMeta();
      await showDetails(nodeId);

      const centerLabel = displayLabel(state.nodes.get(nodeId));
      elements.input.value = centerLabel;

      updateHistory(nodeId, centerLabel, config.history);

      setStatus(`Loaded ${state.nodes.size} source-backed meanings around “${centerLabel}”. Expand any selected node to continue on demand.`, "success");
    } catch (error) {
      if (token !== state.loadToken) return;
      setStatus(error.message || "The sphere could not be built.", "error");
      elements.details.innerHTML = '<div class="dr-live-empty"><strong>DictionaryRoot could not build this sphere.</strong>Start the SourceRoot backend and try again.</div>';
    }
  }

  function renderSearchResults(query, payload) {
    const raw = DictionaryRootApi.extractItems(payload).filter((item) => item.resultType === "node" || !item.resultType);
    const ranked = DictionaryRootApi.rankMeaningResults(raw, query);
    const exact = DictionaryRootApi.exactMeaningResults(ranked, query);
    const related = ranked.filter((item) => !exact.includes(item));
    const shown = exact.length
      ? exact.concat(related.slice(0, Math.max(0, 18 - exact.length)))
      : related.slice(0, 18);

    elements.results.innerHTML = "";
    if (!shown.length) {
      elements.results.innerHTML = '<div class="dr-live-empty"><strong>No matching meaning was found.</strong>Try another word.</div>';
      setStatus(`No connected concept matched “${query}”.`, "error");
      return;
    }

    shown.forEach((result) => {
      const preferred = DictionaryRootApi.preferredMeaningLabel(result, query);
      const rank = DictionaryRootApi.meaningMatchRank(result, query);
      const card = document.createElement("article");
      card.className = "dr-live-result-card";
      card.innerHTML = `<div>
        <h3>${escapeHtml(preferred)}</h3>
        ${preferred.toLocaleLowerCase() !== String(result.title || "").toLocaleLowerCase() ? `<span class="dr-live-canonical">WordNet sense also indexed as <strong>${escapeHtml(result.title)}</strong></span>` : ""}
        <p>${escapeHtml(result.summary || "Open this meaning in the live knowledge sphere.")}</p>
        <div class="dr-live-result-meta">
          <span class="dr-live-chip" data-tone="accent">${escapeHtml(posFrom(result))}</span>
          <span class="dr-live-chip" data-tone="good">Source-backed</span>
          <span class="dr-live-chip">${rank <= 1 ? "Exact meaning" : "Related match"}</span>
        </div>
      </div>
      <button class="dr-live-button-secondary" type="button" data-sphere-node="${escapeHtml(result.id)}" data-preferred-label="${escapeHtml(preferred)}">Build sphere</button>`;
      elements.results.appendChild(card);
    });

    setStatus(
      exact.length
        ? `${exact.length} exact sense${exact.length === 1 ? "" : "s"} of “${query}” found. Choose the intended meaning.`
        : "No exact lemma was found. Showing related meanings.",
      exact.length ? "success" : ""
    );
  }

  async function search(query, autoOpen, options) {
    const settings = Object.assign({ history: "push" }, options || {});
    const clean = String(query || "").trim();
    if (!clean) return;

    elements.searchButton.disabled = true;
    elements.searchButton.textContent = "Searching...";
    setStatus(`Searching for “${clean}”...`, "loading");
    elements.results.innerHTML = "";

    try {
      const response = await state.client.searchNodes(clean, { limit: 100 });
      const raw = DictionaryRootApi.extractItems(response.data).filter((item) => item.resultType === "node" || !item.resultType);
      const exact = DictionaryRootApi.exactMeaningResults(raw, clean);

      if (autoOpen && exact.length === 1) {
        await openCenter(exact[0].id, DictionaryRootApi.preferredMeaningLabel(exact[0], clean), { resetTrail: true, history: settings.history });
      } else {
        renderSearchResults(clean, response.data);
        updateHistory(null, clean, settings.history);
      }
    } catch (error) {
      setStatus(error.message || "Search failed.", "error");
      elements.results.innerHTML = '<div class="dr-live-empty"><strong>DictionaryRoot could not reach its knowledge service.</strong>Your data has not been changed.</div>';
    } finally {
      elements.searchButton.disabled = false;
      elements.searchButton.textContent = "Explore sphere";
    }
  }

  function updateModeControls() {
    if (!elements.modeMap || !elements.modeReadable) return;
    const mapActive = state.mode === "map";
    elements.modeMap.setAttribute("aria-pressed", String(mapActive));
    elements.modeReadable.setAttribute("aria-pressed", String(!mapActive));
    elements.modeMap.classList.toggle("is-active", mapActive);
    elements.modeReadable.classList.toggle("is-active", !mapActive);
    if (elements.rotationToggle) elements.rotationToggle.disabled = !mapActive;
    if (elements.resetRotation) elements.resetRotation.disabled = !mapActive;
  }

  function setGraphMode(mode, historyMode) {
    const nextMode = mode === "readable" ? "readable" : "map";
    if (state.mode === nextMode) {
      updateModeControls();
      return;
    }
    state.mode = nextMode;
    renderGraphStructure();
    updateModeControls();
    if (historyMode && !state.navigatingHistory) {
      updateHistory(state.centerId, elements.input.value || "", historyMode);
    }
  }

  function toggleDetails() {
    state.detailsCollapsed = !state.detailsCollapsed;
    elements.layout.dataset.detailsCollapsed = String(state.detailsCollapsed);
    elements.toggleDetails.textContent = state.detailsCollapsed ? "Show details" : "Hide details";
  }

  function updateRotationControl() {
    elements.rotationToggle.setAttribute("aria-pressed", String(state.autoRotate));
    elements.rotationToggle.textContent = state.autoRotate ? "Pause rotation" : "Resume rotation";
  }

  function showTooltip(nodeElement, event) {
    const item = state.nodes.get(nodeElement.dataset.nodeId);
    if (!item) return;

    elements.tooltip.innerHTML = `<strong>${escapeHtml(displayLabel(item))}</strong><span>${escapeHtml(item.node.summary || "Select this concept to inspect its definition and sources.")}</span>`;
    elements.tooltip.hidden = false;
    moveTooltip(event);
  }

  function moveTooltip(event) {
    if (elements.tooltip.hidden) return;
    const rectangle = elements.stage.getBoundingClientRect();
    elements.tooltip.style.left = `${Math.min(rectangle.width - 290, Math.max(12, event.clientX - rectangle.left + 16))}px`;
    elements.tooltip.style.top = `${Math.min(rectangle.height - 120, Math.max(64, event.clientY - rectangle.top + 16))}px`;
  }

  function hideTooltip() {
    elements.tooltip.hidden = true;
  }

  function handleStagePointerDown(event) {
    if (state.mode !== "map") return;
    if (event.target.closest(".dr-sphere-node") || event.target.closest(".dr-sphere-edge-hit")) return;

    state.dragging = true;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    elements.stage.classList.add("is-rotating");
    elements.stage.setPointerCapture(event.pointerId);
  }

  function handleStagePointerMove(event) {
    if (!state.dragging || state.mode !== "map") return;

    const deltaX = event.clientX - state.lastPointerX;
    const deltaY = event.clientY - state.lastPointerY;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    state.rotationY += deltaX * 0.008;
    state.rotationX = Math.max(-1.2, Math.min(1.2, state.rotationX + deltaY * 0.006));
    updateProjectedGeometry();
  }

  function endStageDrag() {
    state.dragging = false;
    elements.stage.classList.remove("is-rotating");
  }

  function animate(timestamp) {
    if (
      state.mode === "map"
      && state.autoRotate
      && !state.dragging
      && state.nodeElements.size
      && timestamp - state.lastAnimationTime >= 34
    ) {
      const delta = state.lastAnimationTime ? Math.min(60, timestamp - state.lastAnimationTime) : 16;
      state.rotationY += delta * 0.000045;
      updateProjectedGeometry();
      state.lastAnimationTime = timestamp;
    } else if (!state.lastAnimationTime) {
      state.lastAnimationTime = timestamp;
    }

    state.animationFrame = global.requestAnimationFrame(animate);
  }

  function bindEvents() {
    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      search(elements.input.value, false, { history: "push" });
    });

    elements.results.addEventListener("click", async (event) => {
      const target = event.target.closest("[data-sphere-node]");
      if (!target) return;
      elements.results.innerHTML = "";
      await openCenter(target.dataset.sphereNode, target.dataset.preferredLabel || "", { resetTrail: true, history: "push" });
    });

    elements.nodeLayer.addEventListener("click", async (event) => {
      const node = event.target.closest(".dr-sphere-node");
      if (!node) return;
      await showDetails(node.dataset.nodeId);
    });

    elements.nodeLayer.addEventListener("dblclick", async (event) => {
      const node = event.target.closest(".dr-sphere-node");
      if (!node) return;
      event.preventDefault();
      const item = state.nodes.get(node.dataset.nodeId);
      await openCenter(node.dataset.nodeId, item ? displayLabel(item) : "", { resetTrail: false, history: "push" });
    });

    elements.nodeLayer.addEventListener("keydown", async (event) => {
      const node = event.target.closest(".dr-sphere-node");
      if (!node) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (event.shiftKey) {
          const item = state.nodes.get(node.dataset.nodeId);
          await openCenter(node.dataset.nodeId, item ? displayLabel(item) : "", { resetTrail: false, history: "push" });
        } else {
          await showDetails(node.dataset.nodeId);
        }
      }
    });

    elements.nodeLayer.addEventListener("pointerover", (event) => {
      const node = event.target.closest(".dr-sphere-node");
      if (node) showTooltip(node, event);
    });
    elements.nodeLayer.addEventListener("pointermove", moveTooltip);
    elements.nodeLayer.addEventListener("pointerout", (event) => {
      if (!event.relatedTarget || !event.relatedTarget.closest || !event.relatedTarget.closest(".dr-sphere-node")) hideTooltip();
    });

    elements.edgeLayer.addEventListener("pointerdown", (event) => {
      const hit = event.target.closest(".dr-sphere-edge-hit");
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      showEdgeDetails(hit.dataset.edgeKey);
    });

    elements.details.addEventListener("click", async (event) => {
      const expandSelected = event.target.closest("[data-expand-selected]");
      if (expandSelected && state.selectedId && !state.expandedNodeIds.has(state.selectedId)) {
        await expandBranch(state.selectedId, { history: "push" });
        await showDetails(state.selectedId);
        return;
      }

      const collapseSelected = event.target.closest("[data-collapse-selected]");
      if (collapseSelected && state.selectedId) {
        const selectedId = state.selectedId;
        collapseBranch(selectedId, "push");
        if (state.nodes.has(selectedId)) await showDetails(selectedId);
        return;
      }

      const centerSelected = event.target.closest("[data-center-selected]");
      if (centerSelected && state.selectedId) {
        const item = state.nodes.get(state.selectedId);
        await openCenter(state.selectedId, item ? displayLabel(item) : "", { resetTrail: false, history: "push" });
        return;
      }

      const related = event.target.closest("[data-related-node]");
      if (related) {
        const item = state.nodes.get(related.dataset.relatedNode);
        await openCenter(related.dataset.relatedNode, item ? displayLabel(item) : "", { resetTrail: false, history: "push" });
        return;
      }

      const inspect = event.target.closest("[data-inspect-node]");
      if (inspect) await showDetails(inspect.dataset.inspectNode);
    });

    elements.expandSelected.addEventListener("click", async () => {
      if (!state.selectedId) return;
      await expandBranch(state.selectedId, { history: "push" });
      if (state.nodes.has(state.selectedId)) await showDetails(state.selectedId);
    });

    elements.collapseSelected.addEventListener("click", async () => {
      if (!state.selectedId) return;
      const selectedId = state.selectedId;
      collapseBranch(selectedId, "push");
      if (state.nodes.has(selectedId)) await showDetails(selectedId);
    });

    elements.resetExpansions.addEventListener("click", async () => {
      clearExpansions("push");
      if (state.centerId) await showDetails(state.centerId);
    });

    elements.expansionDepth.addEventListener("change", () => {
      state.expansionDepth = elements.expansionDepth.value === "2" ? 2 : 1;
      updateExpansionControls();
      if (state.centerId) updateHistory(state.centerId, displayLabel(state.nodes.get(state.centerId)), "replace");
      setExpansionStatus(`Future branches will expand ${state.expansionDepth} hop${state.expansionDepth === 1 ? "" : "s"} at a time.`, "success");
    });

    elements.expansionLimit.addEventListener("change", () => {
      const requested = Number(elements.expansionLimit.value);
      state.expansionLimit = [50, 72, 100].includes(requested) ? requested : 72;
      updateExpansionControls();
      if (state.centerId) updateHistory(state.centerId, displayLabel(state.nodes.get(state.centerId)), "replace");
      setExpansionStatus(`The visible node budget is now ${state.expansionLimit}.`, "success");
    });

    elements.modeMap.addEventListener("click", () => setGraphMode("map", "push"));
    elements.modeReadable.addEventListener("click", () => setGraphMode("readable", "push"));

    elements.depthSelect.addEventListener("change", async () => {
      state.depth = [1, 2, 3].includes(Number(elements.depthSelect.value)) ? Number(elements.depthSelect.value) : 2;
      if (state.centerId) {
        const item = state.nodes.get(state.centerId);
        await openCenter(state.centerId, item ? displayLabel(item) : "", { resetTrail: false, history: "push", expandedIds: [] });
      }
    });

    elements.edgeSelect.addEventListener("change", () => {
      state.edgeMode = ["center", "selected", "all"].includes(elements.edgeSelect.value) ? elements.edgeSelect.value : "center";
      state.selectedEdgeKey = "";
      renderGraphStructure();
    });

    elements.lensSelect.addEventListener("change", () => {
      state.lens = ["domain", "importance", "strength"].includes(elements.lensSelect.value) ? elements.lensSelect.value : "domain";
      renderGraphStructure();
    });

    elements.domainFilter.addEventListener("change", () => {
      state.domainFilter = elements.domainFilter.value || "all";
      state.selectedEdgeKey = "";
      renderGraphStructure();
    });

    elements.rotationToggle.addEventListener("click", () => {
      state.autoRotate = !state.autoRotate;
      updateRotationControl();
    });

    elements.resetRotation.addEventListener("click", () => {
      state.rotationX = -0.18;
      state.rotationY = 0.45;
      updateProjectedGeometry();
    });

    elements.toggleDetails.addEventListener("click", toggleDetails);

    elements.resetPath.addEventListener("click", async () => {
      const firstId = state.trail[0];
      if (!firstId) return;
      const item = state.nodes.get(firstId);
      state.trail = [];
      await openCenter(firstId, item ? displayLabel(item) : state.trailLabels.get(firstId) || state.preferredLabels.get(firstId) || "", { resetTrail: true, history: "push" });
    });

    elements.breadcrumbTrail.addEventListener("click", async (event) => {
      const button = event.target.closest(".dr-sphere-breadcrumb-node");
      if (!button) return;
      const index = Number(button.dataset.trailIndex);
      state.trail = state.trail.slice(0, index + 1);
      const item = state.nodes.get(button.dataset.nodeId);
      await openCenter(button.dataset.nodeId, item ? displayLabel(item) : state.trailLabels.get(button.dataset.nodeId) || state.preferredLabels.get(button.dataset.nodeId) || "", { resetTrail: false, history: "push" });
    });

    elements.stage.addEventListener("pointerdown", handleStagePointerDown);
    elements.stage.addEventListener("pointermove", handleStagePointerMove);
    elements.stage.addEventListener("pointerup", endStageDrag);
    elements.stage.addEventListener("pointercancel", endStageDrag);
    elements.stage.addEventListener("pointerleave", () => {
      if (!state.dragging) hideTooltip();
    });

    global.addEventListener("popstate", async () => {
      state.navigatingHistory = true;
      try {
        const params = new URLSearchParams(global.location.search);
        const nodeId = params.get("nodeId");
        const query = params.get("q") || state.manifest.defaults.searchTerm || "knowledge";
        state.mode = params.get("mode") === "readable" ? "readable" : "map";
        state.depth = [1, 2, 3].includes(Number(params.get("depth"))) ? Number(params.get("depth")) : state.depth;
        state.expansionDepth = params.get("expandDepth") === "2" ? 2 : 1;
        state.expansionLimit = [50, 72, 100].includes(Number(params.get("maxNodes"))) ? Number(params.get("maxNodes")) : state.expansionLimit;
        const expandedIds = expansionIdsFromUrl(params);
        elements.depthSelect.value = String(state.depth);
        updateModeControls();
        updateExpansionControls();
        elements.input.value = query;
        if (nodeId) {
          await openCenter(nodeId, query, { resetTrail: true, history: null, expandedIds });
        } else {
          await search(query, false, { history: null });
        }
      } finally {
        state.navigatingHistory = false;
      }
    });
  }

  async function init() {
    Object.assign(elements, {
      form: byId("dictionaryrootGraphSearchForm"),
      input: byId("dictionaryrootGraphSearchInput"),
      searchButton: byId("dictionaryrootGraphSearchButton"),
      status: byId("dictionaryrootGraphStatus"),
      results: byId("dictionaryrootGraphResults"),
      layout: byId("dictionaryrootGraphLayout"),
      stage: byId("dictionaryrootGraphStage"),
      edgeLayer: byId("dictionaryrootGraphEdges"),
      nodeLayer: byId("dictionaryrootGraphNodes"),
      tooltip: byId("dictionaryrootGraphTooltip"),
      details: byId("dictionaryrootGraphDetails"),
      title: byId("sphereGraphTitle"),
      meta: byId("sphereGraphMeta"),
      count: byId("dictionaryrootGraphCount"),
      modeMap: byId("graphModeMap"),
      modeReadable: byId("graphModeReadable"),
      depthSelect: byId("sphereDepthSelect"),
      edgeSelect: byId("sphereEdgeSelect"),
      lensSelect: byId("sphereLensSelect"),
      domainFilter: byId("sphereDomainFilter"),
      rotationToggle: byId("sphereRotationToggle"),
      resetRotation: byId("sphereResetRotation"),
      toggleDetails: byId("sphereToggleDetails"),
      breadcrumbTrail: byId("sphereBreadcrumbTrail"),
      resetPath: byId("sphereResetPath"),
      stageHint: byId("sphereStageHint"),
      statConcepts: byId("sphereStatConcepts"),
      statNeighborhoodEdges: byId("sphereStatNeighborhoodEdges"),
      statEdges: byId("sphereStatEdges"),
      statCenterEdges: byId("sphereStatCenterEdges"),
      statDomains: byId("sphereStatDomains"),
      statSources: byId("sphereStatSources"),
      domainLegend: byId("sphereDomainLegend"),
      expansionDepth: byId("sphereExpansionDepth"),
      expansionLimit: byId("sphereExpansionLimit"),
      expandSelected: byId("sphereExpandSelected"),
      collapseSelected: byId("sphereCollapseSelected"),
      resetExpansions: byId("sphereResetExpansions"),
      expansionStatus: byId("sphereExpansionStatus"),
      statCoreNodes: byId("sphereStatCoreNodes"),
      statDynamicNodes: byId("sphereStatDynamicNodes"),
      statBranches: byId("sphereStatBranches")
    });

    state.manifest = await DictionaryRootApi.loadManifest();
    state.client = new DictionaryRootApi.DictionaryRootApiClient(state.manifest);
    state.depth = [1, 2, 3].includes(Number(state.manifest.graph.initialDepth))
      ? Number(state.manifest.graph.initialDepth)
      : 2;
    const dynamicDefaults = expansionConfig();
    state.expansionDepth = Number(dynamicDefaults.defaultDepth) === 2 ? 2 : 1;
    state.expansionLimit = [50, 72, 100].includes(Number(dynamicDefaults.maximumVisibleNodes))
      ? Number(dynamicDefaults.maximumVisibleNodes)
      : 72;
    elements.depthSelect.value = String(state.depth);
    elements.expansionDepth.value = String(state.expansionDepth);
    elements.expansionLimit.value = String(state.expansionLimit);

    bindEvents();
    updateRotationControl();
    state.animationFrame = global.requestAnimationFrame(animate);

    const params = new URLSearchParams(global.location.search);
    const nodeId = params.get("nodeId");
    const query = params.get("q") || state.manifest.defaults.searchTerm || "knowledge";
    state.mode = params.get("mode") === "readable" ? "readable" : "map";
    state.depth = [1, 2, 3].includes(Number(params.get("depth"))) ? Number(params.get("depth")) : state.depth;
    state.expansionDepth = params.get("expandDepth") === "2" ? 2 : state.expansionDepth;
    state.expansionLimit = [50, 72, 100].includes(Number(params.get("maxNodes"))) ? Number(params.get("maxNodes")) : state.expansionLimit;
    const expandedIds = expansionIdsFromUrl(params);
    elements.depthSelect.value = String(state.depth);
    updateModeControls();
    updateExpansionControls();
    elements.input.value = query;

    if (nodeId) {
      await openCenter(nodeId, params.get("q") || "", { resetTrail: true, history: "replace", expandedIds });
    } else {
      await search(query, true, { history: "replace" });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window);
