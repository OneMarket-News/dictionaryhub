(function dictionaryRootGraphPage(global) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const GRAPH_WIDTH = 1200;
  const GRAPH_HEIGHT = 780;
  const relationshipLabels = (global.DictionaryRootBrand && global.DictionaryRootBrand.RELATIONSHIP_LABELS) || {};
  const state = {
    manifest: null, client: null, nodes: new Map(), edges: new Map(), preferredLabels: new Map(),
    rootId: null, selectedId: null, selectedConcept: null, expanded: new Set(), mode: "map",
    scale: 1, panX: 0, panY: 0, dragging: false, dragStart: null, detailsCollapsed: false
  };
  const elements = {};

  function byId(id) { return document.getElementById(id); }
  function svg(name) { return document.createElementNS(NS, name); }
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
  function posFrom(record) { const metadata = record && record.metadata && typeof record.metadata === "object" ? record.metadata : {}; return metadata.partOfSpeech || metadata.pos || record.objectType || record.nodeType || "concept"; }
  function friendlyRelationship(type, fallback) { const normalized = String(type || "").toUpperCase().replace(/[\s-]+/g, "_"); return relationshipLabels[normalized] || fallback || String(type || "Related concept").replace(/_/g, " ").toLowerCase(); }
  function relationshipKey(type) { return String(type || "related").toUpperCase().replace(/[\s-]+/g, "_"); }
  function displayLabel(itemOrNode) { const node = itemOrNode && itemOrNode.node ? itemOrNode.node : itemOrNode; return state.preferredLabels.get(node && node.nodeId) || (node && node.title) || "Untitled concept"; }
  function setStatus(message, status) { elements.status.textContent = message || ""; elements.status.dataset.state = status || ""; }
  function updateTransform() { elements.viewport.setAttribute("transform", `translate(${state.panX} ${state.panY}) scale(${state.scale})`); }

  function nodeGeometry(item) {
    const label = displayLabel(item);
    const root = item.node.nodeId === state.rootId;
    const selected = item.node.nodeId === state.selectedId;
    if (state.mode === "readable") {
      const minimumWidth = root ? 205 : 175;
      const maximumWidth = root ? 280 : 245;
      return { shape: "rect", width: Math.max(minimumWidth, Math.min(maximumWidth, 112 + label.length * 6.6)), height: root ? 98 : selected ? 92 : 84 };
    }
    const rx = root ? 112 : selected ? 94 : Math.max(78, Math.min(102, 68 + label.length * 2.1));
    return { shape: "ellipse", rx, ry: root ? 66 : selected ? 57 : 51, width: rx * 2, height: (root ? 66 : selected ? 57 : 51) * 2 };
  }

  function graphBounds() {
    if (!state.nodes.size) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const item of state.nodes.values()) {
      const size = nodeGeometry(item);
      minX = Math.min(minX, item.x - size.width / 2); maxX = Math.max(maxX, item.x + size.width / 2);
      minY = Math.min(minY, item.y - size.height / 2); maxY = Math.max(maxY, item.y + size.height / 2);
    }
    return { minX, minY, maxX, maxY };
  }

  function fitGraph(options) {
    const bounds = graphBounds();
    if (!bounds) { state.scale = 1; state.panX = 0; state.panY = 0; updateTransform(); return; }
    const config = options || {};
    const paddingX = Number(config.paddingX || 105), paddingY = Number(config.paddingY || 100);
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX), contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const maximumScale = Number(config.maximumScale || (state.nodes.size <= 8 ? 1.42 : 1.12));
    state.scale = Math.max(Number(config.minimumScale || 0.36), Math.min(maximumScale, (GRAPH_WIDTH - paddingX * 2) / contentWidth, (GRAPH_HEIGHT - paddingY * 2) / contentHeight));
    state.panX = GRAPH_WIDTH / 2 - ((bounds.minX + bounds.maxX) / 2) * state.scale;
    state.panY = GRAPH_HEIGHT / 2 - ((bounds.minY + bounds.maxY) / 2) * state.scale;
    updateTransform();
  }

  function relationDescriptor(edge, nodeId) { const incoming = edge.toNodeId === nodeId; return { edge, incoming, neighborId: incoming ? edge.fromNodeId : edge.toNodeId, label: friendlyRelationship(edge.relationshipType, edge.label) }; }
  function edgeKey(edge) { return edge.edgeId || `${edge.fromNodeId}|${edge.relationshipType}|${edge.toNodeId}`; }
  function addNode(node, depth, parentId) { if (state.nodes.has(node.nodeId)) return state.nodes.get(node.nodeId); const item = { node, x: 600, y: 390, depth: depth || 0, parentId: parentId || null }; state.nodes.set(node.nodeId, item); return item; }
  function addEdge(edge) { const key = edgeKey(edge); if (!state.edges.has(key)) state.edges.set(key, edge); }

  function wrapLabel(text, maximumCharacters, maximumLines) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean), lines = [];
    let current = "";
    while (words.length && lines.length < maximumLines) {
      const word = words.shift(), candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maximumCharacters || !current) current = candidate; else { lines.push(current); current = word; }
    }
    if (current && lines.length < maximumLines) lines.push(current);
    if (words.length && lines.length) { const i = lines.length - 1, combined = `${lines[i]} ${words.join(" ")}`; lines[i] = combined.length <= maximumCharacters ? combined : `${combined.slice(0, maximumCharacters - 1).trim()}…`; }
    return lines.length ? lines : ["Untitled concept"];
  }

  function layoutGraph() {
    const root = state.nodes.get(state.rootId);
    if (!root) return;
    root.x = 600; root.y = 390;
    const levels = new Map();
    for (const item of state.nodes.values()) { if (item.node.nodeId === state.rootId) continue; const depth = Math.max(1, item.depth || 1); if (!levels.has(depth)) levels.set(depth, []); levels.get(depth).push(item); }
    for (const [depth, items] of levels.entries()) {
      items.sort((a, b) => displayLabel(a).localeCompare(displayLabel(b)));
      const radius = state.mode === "map" ? 270 + (depth - 1) * 205 : 255 + (depth - 1) * 235;
      const offset = -Math.PI / 2 + (depth % 2 ? 0 : Math.PI / Math.max(4, items.length));
      items.forEach((item, index) => { const angle = offset + (Math.PI * 2 * index) / Math.max(1, items.length); item.x = 600 + Math.cos(angle) * radius; item.y = 390 + Math.sin(angle) * radius; });
    }
  }

  function ellipseEndpoint(from, to, geometry, padding) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const rx = geometry.width / 2 + padding, ry = geometry.height / 2 + padding;
    const divisor = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)) || 1;
    return { x: from.x + dx / divisor, y: from.y + dy / divisor };
  }
  function edgeEndpoints(from, to) {
    const fromPoint = ellipseEndpoint(from, to, nodeGeometry(from), 5);
    const toPoint = ellipseEndpoint(to, from, nodeGeometry(to), 12);
    return { x1: fromPoint.x, y1: fromPoint.y, x2: toPoint.x, y2: toPoint.y };
  }
  function edgePath(from, to, edge) {
    const p = edgeEndpoints(from, to), dx = p.x2 - p.x1, dy = p.y2 - p.y1, distance = Math.max(1, Math.hypot(dx, dy));
    const seed = Array.from(String(edgeKey(edge))).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const bend = state.mode === "map" ? ((seed % 2 ? 1 : -1) * Math.min(34, distance * 0.085)) : 0;
    const cx = (p.x1 + p.x2) / 2 - (dy / distance) * bend, cy = (p.y1 + p.y2) / 2 + (dx / distance) * bend;
    return state.mode === "map" ? `M ${p.x1} ${p.y1} Q ${cx} ${cy} ${p.x2} ${p.y2}` : `M ${p.x1} ${p.y1} L ${p.x2} ${p.y2}`;
  }

  function renderNodeShape(group, item, geometry) {
    if (state.mode === "map") {
      const halo = svg("ellipse"); halo.classList.add("dr-node-halo"); halo.setAttribute("rx", geometry.rx + 13); halo.setAttribute("ry", geometry.ry + 13); group.appendChild(halo);
      const ring = svg("ellipse"); ring.classList.add("dr-node-ring"); ring.setAttribute("rx", geometry.rx + 6); ring.setAttribute("ry", geometry.ry + 6); group.appendChild(ring);
      const card = svg("ellipse"); card.classList.add("dr-node-card"); card.setAttribute("rx", geometry.rx); card.setAttribute("ry", geometry.ry); group.appendChild(card);
    } else {
      const card = svg("rect"); card.classList.add("dr-node-card"); card.setAttribute("x", -geometry.width / 2); card.setAttribute("y", -geometry.height / 2); card.setAttribute("width", geometry.width); card.setAttribute("height", geometry.height); card.setAttribute("rx", "20"); group.appendChild(card);
    }
  }

  function renderGraph() {
    elements.svg.dataset.mode = state.mode;
    elements.edgeLayer.innerHTML = ""; elements.nodeLayer.innerHTML = "";
    for (const edge of state.edges.values()) {
      const from = state.nodes.get(edge.fromNodeId), to = state.nodes.get(edge.toNodeId); if (!from || !to) continue;
      const path = svg("path"); path.setAttribute("d", edgePath(from, to, edge)); path.setAttribute("marker-end", "url(#drArrow)"); path.classList.add("dr-graph-edge");
      const connected = edge.fromNodeId === state.selectedId || edge.toNodeId === state.selectedId;
      path.dataset.selected = String(connected); path.dataset.muted = String(Boolean(state.selectedId) && !connected); path.dataset.relationship = relationshipKey(edge.relationshipType);
      const title = svg("title"); title.textContent = friendlyRelationship(edge.relationshipType, edge.label); path.appendChild(title); elements.edgeLayer.appendChild(path);
    }
    for (const item of state.nodes.values()) {
      const node = item.node, geometry = nodeGeometry(item), labelText = displayLabel(item);
      const group = svg("g"); group.classList.add("dr-graph-node"); group.dataset.nodeId = node.nodeId; group.dataset.root = String(node.nodeId === state.rootId); group.dataset.selected = String(node.nodeId === state.selectedId); group.dataset.depth = String(item.depth || 0);
      group.setAttribute("transform", `translate(${item.x} ${item.y})`); group.setAttribute("role", "button"); group.setAttribute("tabindex", "0"); group.setAttribute("aria-label", `${labelText}, ${posFrom(node)}. Select concept.`);
      renderNodeShape(group, item, geometry);
      const title = svg("title"); title.textContent = `${labelText}: ${node.summary || "Open to inspect this meaning."}`; group.appendChild(title);
      const lines = wrapLabel(labelText, state.mode === "map" ? (node.nodeId === state.rootId ? 19 : 16) : (node.nodeId === state.rootId ? 24 : 20), 2);
      const label = svg("text"); label.classList.add("dr-node-label"); const firstY = lines.length === 1 ? -6 : -16;
      lines.forEach((lineText, index) => { const line = svg("tspan"); line.setAttribute("x", "0"); line.setAttribute("y", String(firstY + index * 19)); line.textContent = lineText; label.appendChild(line); }); group.appendChild(label);
      const pos = svg("text"); pos.classList.add("dr-node-pos"); pos.setAttribute("y", String(geometry.height / 2 - 13)); pos.textContent = String(posFrom(node)).slice(0, 18); group.appendChild(pos);
      elements.nodeLayer.appendChild(group);
    }
    elements.count.textContent = `${state.nodes.size} concepts · ${state.edges.size} relationships`;
  }

  async function loadNeighborhood(nodeId, options) {
    const item = state.nodes.get(nodeId); if (!item) return;
    const config = options || {}, maxVisible = Number(state.manifest.graph.maximumNodeLimit || 150), available = Math.max(0, maxVisible - state.nodes.size);
    if (!available) { setStatus("Graph limit reached. Reset the graph or begin a new exploration.", "error"); return; }
    setStatus(`Finding connected meanings for “${displayLabel(item)}”...`, "loading");
    const edgeResult = await state.client.nodeEdges(nodeId), relations = DictionaryRootApi.edgeItems(edgeResult.data).map((edge) => relationDescriptor(edge, nodeId));
    const desired = Math.min(available, Number(config.limit || state.manifest.graph.neighborsPerExpansion || 18), relations.length), unique = [], seen = new Set();
    for (const relation of relations) { if (state.nodes.has(relation.neighborId) || seen.has(relation.neighborId)) { addEdge(relation.edge); continue; } seen.add(relation.neighborId); unique.push(relation); if (unique.length >= desired) break; }
    const neighbors = await state.client.nodesByIds(unique.map((entry) => entry.neighborId), { concurrency: 6 });
    neighbors.forEach((node) => addNode(node, item.depth + 1, nodeId));
    relations.forEach((relation) => { if (state.nodes.has(relation.edge.fromNodeId) && state.nodes.has(relation.edge.toNodeId)) addEdge(relation.edge); });
    state.expanded.add(nodeId); layoutGraph(); renderGraph(); if (config.fit !== false) fitGraph();
    setStatus(neighbors.length ? `Added ${neighbors.length} connected meaning${neighbors.length === 1 ? "" : "s"} for “${displayLabel(item)}”.` : `No additional connected meanings were available for “${displayLabel(item)}”.`, neighbors.length ? "success" : "");
  }

  async function showDetails(nodeId) {
    const item = state.nodes.get(nodeId); if (!item) return;
    state.selectedId = nodeId; renderGraph(); elements.details.innerHTML = '<div class="dr-live-empty"><strong>Loading concept details...</strong>Retrieving definitions, examples, sources, and relationships.</div>';
    try {
      const concept = await state.client.concept(nodeId); state.selectedConcept = concept;
      const definition = (concept.assertions || []).find((entry) => entry.assertionType === "definition"), usage = (concept.assertions || []).find((entry) => entry.assertionType === "usage-example");
      const examples = usage && (usage.body || usage.summary) ? String(usage.body || usage.summary).split(/\r?\n|\s*\|\s*/).filter(Boolean) : [];
      const relations = concept.edges.map((edge) => relationDescriptor(edge, nodeId));
      const relationshipSummary = relations.slice(0, 12).map((entry) => `<li class="dr-live-related-item"><strong>${escapeHtml(entry.label)}</strong><span>${escapeHtml(entry.edge.summary || entry.neighborId)}</span></li>`).join("");
      const preferred = displayLabel(item), canonical = preferred.toLocaleLowerCase() !== String(concept.node.title || "").toLocaleLowerCase() ? concept.node.title : "";
      elements.details.innerHTML = `<section class="dr-live-section"><div class="dr-live-chip-row"><span class="dr-live-chip" data-tone="accent">${escapeHtml(posFrom(concept.node))}</span><span class="dr-live-chip" data-tone="good">Source-backed</span></div><h2 class="dr-live-concept-title" style="font-size:2.3rem;">${escapeHtml(preferred)}</h2>${canonical ? `<p class="dr-live-canonical">Open English WordNet groups this sense under <strong>${escapeHtml(canonical)}</strong>.</p>` : ""}<p class="dr-live-definition" style="font-size:1rem;">${escapeHtml((definition && (definition.body || definition.summary)) || concept.node.summary || "No definition is available.")}</p><div class="dr-live-actions"><button class="dr-live-button" type="button" data-expand-selected ${state.expanded.has(nodeId) ? "disabled" : ""}>${state.expanded.has(nodeId) ? "Already expanded" : "Expand connections"}</button><button class="dr-live-button-secondary" type="button" data-make-center>Make center</button><a class="dr-live-button-secondary" href="concept-v2.html?nodeId=${encodeURIComponent(nodeId)}&q=${encodeURIComponent(preferred)}" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Full concept page</a></div></section><section class="dr-live-section"><h3>Usage examples</h3>${examples.length ? `<ul class="dr-live-example-list">${examples.map((example) => `<li>${escapeHtml(example)}</li>`).join("")}</ul>` : "<p>No usage examples are available for this meaning.</p>"}</section><section class="dr-live-section"><h3>Relationships</h3>${relationshipSummary ? `<ul class="dr-live-related-list">${relationshipSummary}</ul>` : "<p>No connected concepts were found.</p>"}</section><section class="dr-live-section"><h3>Provenance</h3>${concept.sources.length ? concept.sources.map((source) => `<div class="dr-live-source-card"><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.license || "License unavailable")}</span></div>`).join("") : "<p>Source identifiers remain attached to this concept.</p>"}</section><details class="dr-live-advanced"><summary>Advanced SourceRoot details</summary><pre>${escapeHtml(JSON.stringify(concept, null, 2))}</pre></details>`;
    } catch (error) { elements.details.innerHTML = `<div class="dr-live-empty"><strong>Concept details could not be loaded.</strong>${escapeHtml(error.message || "Check the SourceRoot connection.")}</div>`; }
  }

  async function openCenter(nodeId, preferredLabel) {
    setStatus("Building the DictionaryRoot knowledge map...", "loading"); elements.details.innerHTML = '<div class="dr-live-empty"><strong>Loading center concept...</strong>Preparing the source-backed graph.</div>';
    try {
      const nodeResult = await state.client.node(nodeId); state.nodes.clear(); state.edges.clear(); state.expanded.clear(); state.preferredLabels.clear(); state.rootId = nodeId; state.selectedId = nodeId;
      if (preferredLabel) state.preferredLabels.set(nodeId, preferredLabel);
      addNode(nodeResult.data, 0, null); layoutGraph(); renderGraph(); fitGraph();
      await loadNeighborhood(nodeId, { limit: Number(state.manifest.graph.initialNodeLimit || 28) - 1 }); await showDetails(nodeId);
      const url = new URL(global.location.href); url.searchParams.set("nodeId", nodeId); if (preferredLabel) url.searchParams.set("q", preferredLabel); else url.searchParams.delete("q"); global.history.replaceState({}, "", url);
    } catch (error) { setStatus(error.message || "The graph could not be built.", "error"); elements.details.innerHTML = '<div class="dr-live-empty"><strong>DictionaryRoot could not build this graph.</strong>Start the SourceRoot backend and try again.</div>'; }
  }

  function renderSearchResults(query, payload) {
    const raw = DictionaryRootApi.extractItems(payload).filter((item) => item.resultType === "node" || !item.resultType), results = DictionaryRootApi.rankMeaningResults(raw, query), exact = DictionaryRootApi.exactMeaningResults(results, query);
    const shown = (exact.length ? exact.concat(results.filter((item) => !exact.includes(item))) : results).slice(0, 18); elements.results.innerHTML = "";
    if (!shown.length) { elements.results.innerHTML = '<div class="dr-live-empty"><strong>No matching meaning was found.</strong>Try another word.</div>'; setStatus(`No connected concept matched “${query}”.`, "error"); return; }
    shown.forEach((result) => { const preferred = DictionaryRootApi.preferredMeaningLabel(result, query), rank = DictionaryRootApi.meaningMatchRank(result, query), card = document.createElement("article"); card.className = "dr-live-result-card"; card.innerHTML = `<div><h3>${escapeHtml(preferred)}</h3>${preferred.toLocaleLowerCase() !== String(result.title || "").toLocaleLowerCase() ? `<span class="dr-live-canonical">WordNet sense also indexed as <strong>${escapeHtml(result.title)}</strong></span>` : ""}<p>${escapeHtml(result.summary || "Open this meaning in the knowledge graph.")}</p><div class="dr-live-result-meta"><span class="dr-live-chip" data-tone="accent">${escapeHtml(posFrom(result))}</span><span class="dr-live-chip" data-tone="good">Source-backed</span><span class="dr-live-chip">${rank <= 1 ? "Exact meaning" : "Related match"}</span></div></div><button class="dr-live-button-secondary" type="button" data-graph-node="${escapeHtml(result.id)}" data-preferred-label="${escapeHtml(preferred)}">Build graph</button>`; elements.results.appendChild(card); });
    setStatus(exact.length ? `${exact.length} exact sense${exact.length === 1 ? "" : "s"} of “${query}” found. Choose the intended meaning.` : `No exact lemma was found. Showing related meanings.`, exact.length ? "success" : "");
  }

  async function search(query, autoOpen) {
    const clean = String(query || "").trim(); if (!clean) return;
    elements.searchButton.disabled = true; elements.searchButton.textContent = "Searching..."; setStatus(`Searching for “${clean}”...`, "loading"); elements.results.innerHTML = "";
    try {
      const response = await state.client.searchNodes(clean, { limit: 100 });
      const raw = DictionaryRootApi.extractItems(response.data).filter((item) => item.resultType === "node" || !item.resultType), exact = DictionaryRootApi.exactMeaningResults(raw, clean);
      if (autoOpen && exact.length === 1) await openCenter(exact[0].id, DictionaryRootApi.preferredMeaningLabel(exact[0], clean)); else renderSearchResults(clean, response.data);
    } catch (error) { setStatus(error.message || "Search failed.", "error"); elements.results.innerHTML = '<div class="dr-live-empty"><strong>DictionaryRoot could not reach its knowledge service.</strong>Your data has not been changed.</div>'; }
    finally { elements.searchButton.disabled = false; elements.searchButton.textContent = "Explore graph"; }
  }

  function setMode(mode) {
    state.mode = mode === "readable" ? "readable" : "map";
    elements.modeMap.setAttribute("aria-pressed", String(state.mode === "map")); elements.modeReadable.setAttribute("aria-pressed", String(state.mode === "readable"));
    elements.layout.dataset.mode = state.mode; layoutGraph(); renderGraph(); fitGraph();
  }
  function toggleDetails() {
    state.detailsCollapsed = !state.detailsCollapsed; elements.layout.dataset.detailsCollapsed = String(state.detailsCollapsed); elements.toggleDetails.textContent = state.detailsCollapsed ? "Show details" : "Hide details"; setTimeout(() => fitGraph(), 60);
  }
  function showTooltip(nodeElement, event) {
    const item = state.nodes.get(nodeElement.dataset.nodeId); if (!item) return;
    elements.tooltip.innerHTML = `<strong>${escapeHtml(displayLabel(item))}</strong><span>${escapeHtml(item.node.summary || "Select this concept to inspect its definition and sources.")}</span>`;
    elements.tooltip.hidden = false; moveTooltip(event);
  }
  function moveTooltip(event) {
    if (elements.tooltip.hidden) return; const rect = elements.stage.getBoundingClientRect();
    elements.tooltip.style.left = `${Math.min(rect.width - 290, Math.max(12, event.clientX - rect.left + 16))}px`; elements.tooltip.style.top = `${Math.min(rect.height - 120, Math.max(64, event.clientY - rect.top + 16))}px`;
  }
  function hideTooltip() { elements.tooltip.hidden = true; }

  function bindEvents() {
    elements.form.addEventListener("submit", (event) => { event.preventDefault(); search(elements.input.value, false); });
    document.addEventListener("click", async (event) => {
      const graphNode = event.target.closest("[data-graph-node]"); if (graphNode) { elements.results.innerHTML = ""; await openCenter(graphNode.dataset.graphNode, graphNode.dataset.preferredLabel || ""); return; }
      const svgNode = event.target.closest(".dr-graph-node"); if (svgNode) { await showDetails(svgNode.dataset.nodeId); return; }
      if (event.target.closest("[data-expand-selected]") && state.selectedId) { await loadNeighborhood(state.selectedId); await showDetails(state.selectedId); return; }
      if (event.target.closest("[data-make-center]") && state.selectedId) { await openCenter(state.selectedId, displayLabel(state.nodes.get(state.selectedId))); }
    });
    elements.svg.addEventListener("keydown", async (event) => { const node = event.target.closest(".dr-graph-node"); if (!node) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (event.shiftKey) await loadNeighborhood(node.dataset.nodeId); else await showDetails(node.dataset.nodeId); } });
    elements.nodeLayer.addEventListener("pointerover", (event) => { const node = event.target.closest(".dr-graph-node"); if (node) showTooltip(node, event); }); elements.nodeLayer.addEventListener("pointermove", moveTooltip); elements.nodeLayer.addEventListener("pointerout", (event) => { if (!event.relatedTarget || !event.relatedTarget.closest || !event.relatedTarget.closest(".dr-graph-node")) hideTooltip(); });
    byId("graphZoomIn").addEventListener("click", () => { state.scale = Math.min(3, state.scale + 0.16); updateTransform(); }); byId("graphZoomOut").addEventListener("click", () => { state.scale = Math.max(0.35, state.scale - 0.16); updateTransform(); }); byId("graphResetView").addEventListener("click", () => fitGraph()); byId("graphResetData").addEventListener("click", () => { if (state.rootId) openCenter(state.rootId, displayLabel(state.nodes.get(state.rootId))); });
    elements.modeMap.addEventListener("click", () => setMode("map")); elements.modeReadable.addEventListener("click", () => setMode("readable")); elements.toggleDetails.addEventListener("click", toggleDetails);
    elements.svg.addEventListener("wheel", (event) => { event.preventDefault(); state.scale = Math.max(0.35, Math.min(3, state.scale + (event.deltaY < 0 ? 0.09 : -0.09))); updateTransform(); }, { passive: false });
    elements.svg.addEventListener("pointerdown", (event) => { if (event.target.closest(".dr-graph-node")) return; const rectangle = elements.svg.getBoundingClientRect(); state.dragging = true; state.dragStart = { clientX: event.clientX, clientY: event.clientY, panX: state.panX, panY: state.panY, unitX: GRAPH_WIDTH / Math.max(1, rectangle.width), unitY: GRAPH_HEIGHT / Math.max(1, rectangle.height) }; elements.svg.classList.add("is-panning"); elements.svg.setPointerCapture(event.pointerId); });
    elements.svg.addEventListener("pointermove", (event) => { if (!state.dragging) return; state.panX = state.dragStart.panX + (event.clientX - state.dragStart.clientX) * state.dragStart.unitX; state.panY = state.dragStart.panY + (event.clientY - state.dragStart.clientY) * state.dragStart.unitY; updateTransform(); });
    const endPan = () => { state.dragging = false; elements.svg.classList.remove("is-panning"); }; elements.svg.addEventListener("pointerup", endPan); elements.svg.addEventListener("pointercancel", endPan);
  }

  async function init() {
    Object.assign(elements, { form: byId("dictionaryrootGraphSearchForm"), input: byId("dictionaryrootGraphSearchInput"), searchButton: byId("dictionaryrootGraphSearchButton"), status: byId("dictionaryrootGraphStatus"), results: byId("dictionaryrootGraphResults"), svg: byId("dictionaryrootGraph"), viewport: byId("dictionaryrootGraphViewport"), edgeLayer: byId("dictionaryrootGraphEdges"), nodeLayer: byId("dictionaryrootGraphNodes"), details: byId("dictionaryrootGraphDetails"), count: byId("dictionaryrootGraphCount"), layout: byId("dictionaryrootGraphLayout"), stage: byId("dictionaryrootGraphStage"), tooltip: byId("dictionaryrootGraphTooltip"), modeMap: byId("graphModeMap"), modeReadable: byId("graphModeReadable"), toggleDetails: byId("graphToggleDetails") });
    state.manifest = await DictionaryRootApi.loadManifest(); state.client = new DictionaryRootApi.DictionaryRootApiClient(state.manifest); bindEvents(); setMode("map");
    const params = new URLSearchParams(global.location.search), nodeId = params.get("nodeId"), query = params.get("q") || state.manifest.defaults.searchTerm || "knowledge"; elements.input.value = query;
    if (nodeId) await openCenter(nodeId, params.get("q") || ""); else await search(query, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})(window);
