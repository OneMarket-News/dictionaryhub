(function dictionaryRootConceptPage(global) {
  "use strict";

  const relationshipLabels = (global.DictionaryRootBrand && global.DictionaryRootBrand.RELATIONSHIP_LABELS) || {};
  const state = { manifest: null, client: null, current: null, lastQuery: "" };
  const elements = {};

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function posFrom(record) {
    const metadata = record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
    return metadata.partOfSpeech || metadata.pos || record.objectType || record.nodeType || "concept";
  }
  function definitionFrom(concept) {
    const definition = (concept.assertions || []).find((item) => item.assertionType === "definition");
    return (definition && (definition.body || definition.summary)) || (concept.node && concept.node.summary) || "No definition is currently available.";
  }
  function examplesFrom(concept) {
    const usage = (concept.assertions || []).find((item) => item.assertionType === "usage-example");
    if (!usage) return [];
    const value = usage.body || usage.summary || "";
    return String(value).split(/\r?\n|\s*\|\s*/).map((item) => item.trim()).filter(Boolean);
  }
  function friendlyRelationship(type, fallback) {
    const normalized = String(type || "").toUpperCase().replace(/[\s-]+/g, "_");
    return relationshipLabels[normalized] || fallback || String(type || "Related concept").replace(/_/g, " ").toLowerCase();
  }
  function setStatus(message, status) {
    elements.status.textContent = message || "";
    elements.status.dataset.state = status || "";
  }
  function setBusy(busy) {
    elements.searchButton.disabled = busy;
    elements.searchButton.textContent = busy ? "Searching..." : "Explore";
  }
  function canonicalNote(record, preferred) {
    const canonical = String(record.title || "");
    return canonical && canonical.toLocaleLowerCase() !== String(preferred || "").toLocaleLowerCase()
      ? `<span class="dr-live-canonical">WordNet sense also indexed as <strong>${escapeHtml(canonical)}</strong></span>`
      : "";
  }

  function renderSearchResults(query, payload) {
    const raw = DictionaryRootApi.extractItems(payload).filter((item) => item.resultType === "node" || !item.resultType);
    const results = DictionaryRootApi.rankMeaningResults(raw, query);
    const exact = DictionaryRootApi.exactMeaningResults(results, query);
    const shown = (exact.length ? exact.concat(results.filter((item) => !exact.includes(item))) : results).slice(0, 24);
    elements.results.innerHTML = "";
    if (!shown.length) {
      elements.results.innerHTML = '<div class="dr-live-empty"><strong>No matching meaning was found.</strong>Check the spelling or try a related word.</div>';
      setStatus(`DictionaryRoot could not find “${query}” in the connected customer dataset.`, "error");
      return;
    }

    shown.forEach((result) => {
      const rank = DictionaryRootApi.meaningMatchRank(result, query);
      const preferred = DictionaryRootApi.preferredMeaningLabel(result, query);
      const card = document.createElement("article");
      card.className = "dr-live-result-card";
      card.dataset.matchRank = String(rank);
      card.innerHTML = `
        <div>
          <h3>${escapeHtml(preferred)}</h3>
          ${canonicalNote(result, preferred)}
          <p>${escapeHtml(result.summary || "Open this meaning to inspect its source-backed definition.")}</p>
          <div class="dr-live-result-meta">
            <span class="dr-live-chip" data-tone="accent">${escapeHtml(posFrom(result))}</span>
            <span class="dr-live-chip" data-tone="good">Source-backed</span>
            ${rank <= 1 ? '<span class="dr-live-chip">Exact meaning</span>' : '<span class="dr-live-chip">Related match</span>'}
          </div>
        </div>
        <div class="dr-live-actions">
          <button class="dr-live-button-secondary" type="button" data-open-node="${escapeHtml(result.id)}" data-preferred-label="${escapeHtml(preferred)}">View meaning</button>
          <a class="dr-live-button-secondary" href="graph-v2.html?nodeId=${encodeURIComponent(result.id)}&q=${encodeURIComponent(preferred)}" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Open graph</a>
        </div>`;
      elements.results.appendChild(card);
    });

    if (exact.length > 1) setStatus(`${exact.length} exact senses of “${query}” found. Choose the intended meaning.`, "success");
    else if (exact.length === 1) setStatus(`One exact meaning of “${query}” found. Related matches follow.`, "success");
    else setStatus(`No exact lemma was found. Showing ${shown.length} related meaning${shown.length === 1 ? "" : "s"}.`, "");
  }

  async function search(query) {
    const clean = String(query || "").trim();
    if (!clean) { setStatus("Enter a word to explore.", "error"); return; }
    state.lastQuery = clean;
    setBusy(true);
    setStatus(`Searching DictionaryRoot for “${clean}”...`, "loading");
    elements.results.innerHTML = "";
    try {
      const response = await state.client.searchNodes(clean, { limit: 100 });
      renderSearchResults(clean, response.data);
      const url = new URL(global.location.href);
      url.searchParams.set("q", clean);
      url.searchParams.delete("nodeId");
      global.history.replaceState({}, "", url);
    } catch (error) {
      elements.results.innerHTML = '<div class="dr-live-empty"><strong>DictionaryRoot could not reach its knowledge service.</strong>Your data has not been changed. Start the SourceRoot backend, then try again.</div>';
      setStatus(error.message || "Search failed.", "error");
    } finally { setBusy(false); }
  }

  function relationDescriptor(edge, nodeId) {
    const incoming = edge.toNodeId === nodeId;
    return { edge, incoming, neighborId: incoming ? edge.fromNodeId : edge.toNodeId, label: friendlyRelationship(edge.relationshipType, edge.label) };
  }

  async function renderConcept(concept, preferredLabel) {
    const node = concept.node;
    const displayTitle = preferredLabel || node.title;
    const canonical = displayTitle.toLocaleLowerCase() !== String(node.title || "").toLocaleLowerCase() ? node.title : "";
    const examples = examplesFrom(concept);
    const relations = (concept.edges || []).map((edge) => relationDescriptor(edge, node.nodeId));
    const neighbors = await state.client.nodesByIds(relations.slice(0, 18).map((item) => item.neighborId), { concurrency: 6 });
    const neighborMap = new Map(neighbors.map((item) => [item.nodeId, item]));
    elements.detail.innerHTML = `
      <section class="dr-live-section">
        <div class="dr-live-chip-row"><span class="dr-live-chip" data-tone="accent">${escapeHtml(posFrom(node))}</span><span class="dr-live-chip" data-tone="good">Source-backed</span><span class="dr-live-chip">${relations.length} relationships</span></div>
        <h2 class="dr-live-concept-title">${escapeHtml(displayTitle)}</h2>
        ${canonical ? `<p class="dr-live-canonical">Open English WordNet groups this word sense under <strong>${escapeHtml(canonical)}</strong>.</p>` : ""}
        <div class="dr-live-pos">${escapeHtml(posFrom(node))}</div>
        <p class="dr-live-definition">${escapeHtml(definitionFrom(concept))}</p>
        <div class="dr-live-actions">
          <a class="dr-live-button" href="graph-v2.html?nodeId=${encodeURIComponent(node.nodeId)}&q=${encodeURIComponent(displayTitle)}" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Explore in knowledge graph</a>
          <button class="dr-live-button-secondary" type="button" data-copy-link>Copy concept link</button>
        </div>
      </section>
      <section class="dr-live-section"><h3>Usage examples</h3>${examples.length ? `<ul class="dr-live-example-list">${examples.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<p>No usage examples are currently available from this source.</p>'}</section>
      <section class="dr-live-section"><h3>Connected meanings</h3>${relations.length ? `<ul class="dr-live-related-list">${relations.slice(0, 18).map((item) => { const neighbor = neighborMap.get(item.neighborId); return `<li class="dr-live-related-item"><strong>${escapeHtml(neighbor ? neighbor.title : item.neighborId)}</strong><span>${escapeHtml(item.label)}${item.incoming ? " into" : " from"} this meaning.</span>${neighbor && neighbor.summary ? `<span>${escapeHtml(neighbor.summary)}</span>` : ""}<div class="dr-live-actions"><button class="dr-live-button-secondary" type="button" data-open-node="${escapeHtml(item.neighborId)}">View meaning</button><a class="dr-live-button-secondary" href="graph-v2.html?nodeId=${encodeURIComponent(item.neighborId)}" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Open graph</a></div></li>`; }).join("")}</ul>` : '<p>No connected concepts were found for this meaning.</p>'}</section>
      <section class="dr-live-section"><h3>Sources and trust</h3>${concept.sources.length ? `<ul class="dr-live-source-list">${concept.sources.map((source) => `<li class="dr-live-source-card"><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.publisher || "Lexical data source")}</span><span>${escapeHtml(source.license || "License information unavailable")}</span>${source.url ? `<span><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--dr-live-cyan);">View source website</a></span>` : ""}</li>`).join("")}</ul>` : '<p>Source details are temporarily unavailable, but the concept remains linked to its recorded source identifiers.</p>'}</section>
      <details class="dr-live-advanced"><summary>Advanced SourceRoot details</summary><pre>${escapeHtml(JSON.stringify(concept, null, 2))}</pre></details>`;
  }

  async function openNode(nodeId, preferredLabel) {
    if (!nodeId) return;
    elements.detail.innerHTML = '<div class="dr-live-empty"><strong>Loading this meaning...</strong>Retrieving the concept, assertions, relationships, and sources.</div>';
    setStatus("Loading source-backed concept details...", "loading");
    try {
      const concept = await state.client.concept(nodeId);
      state.current = concept;
      await renderConcept(concept, preferredLabel);
      setStatus(`Loaded “${preferredLabel || concept.node.title}” from PostgreSQL through the SourceRoot API.`, "success");
      const url = new URL(global.location.href);
      url.searchParams.set("nodeId", nodeId);
      if (preferredLabel) url.searchParams.set("q", preferredLabel); else url.searchParams.delete("q");
      global.history.replaceState({}, "", url);
      elements.detail.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      elements.detail.innerHTML = '<div class="dr-live-empty"><strong>This meaning could not be loaded.</strong>Check the SourceRoot connection and try again.</div>';
      setStatus(error.message || "Concept load failed.", "error");
    }
  }

  function bindEvents() {
    elements.form.addEventListener("submit", (event) => { event.preventDefault(); search(elements.input.value); });
    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-open-node]");
      if (open) { await openNode(open.dataset.openNode, open.dataset.preferredLabel || ""); return; }
      const copy = event.target.closest("[data-copy-link]");
      if (copy) {
        try { await navigator.clipboard.writeText(global.location.href); copy.textContent = "Link copied"; setTimeout(() => { copy.textContent = "Copy concept link"; }, 1800); }
        catch (_) { setStatus("Copy was unavailable. Use the address bar to copy this link.", "error"); }
      }
    });
  }

  async function init() {
    Object.assign(elements, { form: byId("dictionaryrootSearchForm"), input: byId("dictionaryrootSearchInput"), searchButton: byId("dictionaryrootSearchButton"), status: byId("dictionaryrootSearchStatus"), results: byId("dictionaryrootSearchResults"), detail: byId("dictionaryrootConceptDetail") });
    state.manifest = await DictionaryRootApi.loadManifest();
    state.client = new DictionaryRootApi.DictionaryRootApiClient(state.manifest);
    bindEvents();
    const params = new URLSearchParams(global.location.search);
    const nodeId = params.get("nodeId");
    const query = params.get("q") || state.manifest.defaults.searchTerm || "knowledge";
    elements.input.value = query;
    if (nodeId) await openNode(nodeId, params.get("q") || ""); else await search(query);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})(window);
