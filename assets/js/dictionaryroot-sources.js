(function dictionaryRootSources(global) {
  "use strict";

  const state = {
    manifest: null,
    client: null,
    sources: [],
    filteredSources: [],
    selectedSourceId: "",
    selectedExperience: null,
    search: "",
    sourceType: "all",
    sort: "usage",
    density: "comfortable",
    requestToken: 0,
    loading: false
  };

  const elements = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeType(value) {
    return normalizeText(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  }

  function titleCase(value) {
    return normalizeType(value)
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function clip(value, maximum) {
    const text = normalizeText(value).replace(/\s+/g, " ");
    return text.length > maximum ? `${text.slice(0, Math.max(0, maximum - 1)).trim()}…` : text;
  }

  function numberText(value) {
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : "—";
  }

  function sourceId(source) {
    return normalizeText(source && (source.sourceId || source.id));
  }

  function sourceName(source) {
    return normalizeText(source && (source.name || source.title)) || sourceId(source) || "Unnamed source";
  }

  function sourceType(source) {
    return normalizeText(source && (source.sourceType || source.type || source.sourceClass)) || "Unclassified";
  }

  function sourcePublisher(source) {
    return normalizeText(source && source.publisher) || "Publisher not recorded";
  }

  function sourceDescription(source) {
    return normalizeText(source && (source.notes || source.description || source.summary));
  }

  function sourceAttribution(source) {
    const metadata = source && source.metadata && typeof source.metadata === "object" ? source.metadata : {};
    return normalizeText(source && source.attribution) || normalizeText(metadata.attribution);
  }

  function sourceVersion(source) {
    const metadata = source && source.metadata && typeof source.metadata === "object" ? source.metadata : {};
    return normalizeText(source && (source.version || source.revision || source.lastReviewed))
      || normalizeText(metadata.version || metadata.revision)
      || normalizeText(source && source.updatedAt);
  }

  function safeExternalUrl(value) {
    try {
      const parsed = new URL(normalizeText(value));
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
    } catch (_) {
      return "";
    }
  }

  function directUsage(source, keys) {
    for (const key of keys) {
      const value = source && source[key];
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return null;
  }

  function sourceUsage(source) {
    const experience = source && source.__dictionaryRootExperience;
    const assertions = experience
      ? experience.assertionTotal
      : directUsage(source, ["supportedAssertionCount", "assertionCount", "assertionsCount"]);
    const edges = experience
      ? experience.edgeTotal
      : directUsage(source, ["supportedRelationshipCount", "edgeCount", "relationshipCount"]);
    const concepts = experience
      ? experience.nodes.length
      : directUsage(source, ["linkedConceptCount", "nodeCount", "conceptCount"]);
    return {
      assertions,
      edges,
      concepts,
      loadedAssertions: experience ? experience.assertions.length : 0,
      loadedEdges: experience ? experience.edges.length : 0,
      exactAssertions: Boolean(experience && experience.assertionTotalIsExact),
      exactEdges: Boolean(experience && experience.edgeTotalIsExact)
    };
  }

  function usageSortValue(source) {
    const usage = sourceUsage(source);
    return Number(usage.assertions || 0) + Number(usage.edges || 0) + Number(usage.concepts || 0);
  }

  function conceptHref(nodeId) {
    const encoded = encodeURIComponent(nodeId);
    return `concept-v2.html?id=${encoded}&nodeId=${encoded}`;
  }

  function sphereHref(nodeId) {
    const encoded = encodeURIComponent(nodeId);
    return `graph-v2.html?center=${encoded}&nodeId=${encoded}`;
  }

  function setStatus(message, tone) {
    elements.status.textContent = message;
    elements.status.dataset.state = tone || "";
  }

  function setOffline(error) {
    const message = error && error.message ? error.message : "DictionaryRoot could not reach the SourceRoot API.";
    elements.offline.hidden = false;
    elements.offlineMessage.textContent = `${message} Start the backend with the project command and retry.`;
    elements.heroStatus.textContent = "Offline";
    setStatus("SourceRoot API is offline.", "error");
  }

  function clearOffline() {
    elements.offline.hidden = true;
    elements.heroStatus.textContent = "Live";
  }

  function readUrlState() {
    const params = new URLSearchParams(global.location.search);
    return {
      source: normalizeText(params.get("source")),
      search: normalizeText(params.get("q")),
      sourceType: normalizeText(params.get("type")) || "all",
      sort: normalizeText(params.get("sort")) || "usage",
      density: normalizeText(params.get("density")) || "comfortable"
    };
  }

  function writeUrlState(mode) {
    const params = new URLSearchParams();
    if (state.selectedSourceId) params.set("source", state.selectedSourceId);
    if (state.search) params.set("q", state.search);
    if (state.sourceType && state.sourceType !== "all") params.set("type", state.sourceType);
    if (state.sort !== "usage") params.set("sort", state.sort);
    if (state.density !== "comfortable") params.set("density", state.density);
    const nextUrl = `${global.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${global.location.hash}`;
    if (mode === "push") global.history.pushState({}, "", nextUrl);
    else global.history.replaceState({}, "", nextUrl);
  }

  function syncControlsFromState() {
    elements.search.value = state.search;
    elements.typeFilter.value = Array.from(elements.typeFilter.options).some((option) => option.value === state.sourceType)
      ? state.sourceType
      : "all";
    state.sourceType = elements.typeFilter.value;
    elements.sort.value = ["usage", "name", "type"].includes(state.sort) ? state.sort : "usage";
    state.sort = elements.sort.value;
    elements.density.value = ["comfortable", "compact"].includes(state.density) ? state.density : "comfortable";
    state.density = elements.density.value;
  }

  function buildSourceTypeControls() {
    const types = Array.from(new Set(state.sources.map(sourceType).filter(Boolean))).sort((left, right) => left.localeCompare(right));
    elements.typeFilter.innerHTML = '<option value="all">All source types</option>';
    types.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = titleCase(type);
      elements.typeFilter.appendChild(option);
    });

    elements.typeChips.innerHTML = ["all"].concat(types).slice(0, 14).map((type) => {
      const active = state.sourceType === type;
      return `<button class="dr-source-type-chip" type="button" data-source-type="${escapeHtml(type)}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(type === "all" ? "All sources" : titleCase(type))}</button>`;
    }).join("");
  }

  function searchableSourceText(source) {
    const values = [
      sourceName(source),
      sourceId(source),
      sourceType(source),
      sourcePublisher(source),
      source && source.domain,
      source && source.license,
      source && source.licenseStatus,
      sourceAttribution(source),
      sourceDescription(source),
      source && source.url
    ];
    const experience = source && source.__dictionaryRootExperience;
    if (experience) {
      values.push(...experience.nodes.map((node) => `${node.title || ""} ${node.nodeId || ""}`));
      values.push(...experience.assertions.map((assertion) => `${assertion.label || ""} ${assertion.summary || ""} ${assertion.body || ""}`));
    }
    return values.join(" ").toLowerCase();
  }

  function applyFilters(options) {
    const settings = Object.assign({ history: "replace" }, options || {});
    const query = state.search.toLowerCase();
    state.filteredSources = state.sources.filter((source) => {
      const searchMatches = !query || searchableSourceText(source).includes(query);
      const typeMatches = state.sourceType === "all" || sourceType(source) === state.sourceType;
      return searchMatches && typeMatches;
    });

    state.filteredSources.sort((left, right) => {
      if (state.sort === "usage") {
        const usageDifference = usageSortValue(right) - usageSortValue(left);
        if (usageDifference) return usageDifference;
      }
      if (state.sort === "type") {
        const typeDifference = sourceType(left).localeCompare(sourceType(right));
        if (typeDifference) return typeDifference;
      }
      return sourceName(left).localeCompare(sourceName(right));
    });

    renderTypeChips();
    renderSourceGrid();
    renderStats();
    if (settings.history) writeUrlState(settings.history);
  }

  function renderTypeChips() {
    elements.typeChips.querySelectorAll("[data-source-type]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.sourceType === state.sourceType ? "true" : "false");
    });
  }

  function renderStats() {
    elements.sourceCount.textContent = numberText(state.sources.length);
    elements.visibleSourceCount.textContent = numberText(state.filteredSources.length);
    const selected = state.sources.find((source) => sourceId(source) === state.selectedSourceId);
    const usage = selected ? sourceUsage(selected) : {};
    elements.linkedAssertionCount.textContent = usage.assertions == null
      ? (usage.loadedAssertions ? `${numberText(usage.loadedAssertions)}+` : "—")
      : numberText(usage.assertions);
    elements.linkedConceptCount.textContent = usage.concepts == null ? "—" : numberText(usage.concepts);
    elements.resultCount.textContent = state.loading
      ? "Loading live source records."
      : `Showing ${state.filteredSources.length.toLocaleString()} of ${state.sources.length.toLocaleString()} live source records.`;
  }

  function sourceCard(source) {
    const id = sourceId(source);
    const usage = sourceUsage(source);
    const description = sourceDescription(source) || "SourceRoot metadata is available for this source. Select it to inspect provenance and attribution.";
    const chips = [sourcePublisher(source), source.license, source.domain]
      .map(normalizeText)
      .filter(Boolean)
      .slice(0, state.density === "compact" ? 2 : 3);
    const usageText = usage.assertions != null
      ? `${numberText(usage.assertions)} supported assertions`
      : usage.loadedAssertions
        ? `${numberText(usage.loadedAssertions)}+ assertions loaded`
        : "Usage loads when selected";
    const firstNode = source.__dictionaryRootExperience && source.__dictionaryRootExperience.nodes[0];

    return `
      <article class="dr-source-card" tabindex="0" role="option" aria-selected="${id === state.selectedSourceId ? "true" : "false"}" data-source-id="${escapeHtml(id)}">
        <div class="dr-source-card-top">
          <div>
            <h2>${escapeHtml(sourceName(source))}</h2>
            <span class="dr-source-card-id">${escapeHtml(id)}</span>
          </div>
          <span class="dr-source-badge">${escapeHtml(titleCase(sourceType(source)))}</span>
        </div>
        <p class="dr-source-description">${escapeHtml(clip(description, state.density === "compact" ? 120 : 190))}</p>
        <div class="dr-source-card-chips">${chips.map((chip) => `<span class="dr-source-card-chip">${escapeHtml(chip)}</span>`).join("")}</div>
        <div class="dr-source-card-meta">
          <span>${escapeHtml(usageText)}</span>
          <span>${usage.concepts != null ? `${numberText(usage.concepts)} concepts` : "Live record"}</span>
        </div>
        <div class="dr-source-card-actions">
          <button class="dr-source-action" type="button" data-inspect-source="${escapeHtml(id)}">Inspect source</button>
          ${firstNode ? `<a class="dr-source-text-action" href="${escapeHtml(sphereHref(firstNode.nodeId))}" data-source-nav>Open in Sphere</a>` : ""}
        </div>
      </article>`;
  }

  function renderSourceGrid() {
    elements.grid.dataset.density = state.density;
    elements.grid.setAttribute("aria-busy", state.loading ? "true" : "false");
    if (state.loading) return;
    if (!state.filteredSources.length) {
      elements.grid.innerHTML = "";
      elements.empty.hidden = false;
      return;
    }
    elements.empty.hidden = true;
    elements.grid.innerHTML = state.filteredSources.map(sourceCard).join("");
  }

  function metadataItem(label, value) {
    return `<div class="dr-source-metadata-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(normalizeText(value) || "Not recorded")}</strong></div>`;
  }

  function countDisplay(total, items, exact) {
    if (total != null) return numberText(total);
    if (items && items.length) return `${numberText(items.length)}+`;
    return exact ? "0" : "—";
  }

  function scanNote(scan, label) {
    if (!scan || scan.totalIsExact) return "";
    return `${label} are loaded from ${scan.scannedPages || 1} registry page${scan.scannedPages === 1 ? "" : "s"}; additional matching records may exist.`;
  }

  function assertionText(assertion) {
    return normalizeText(assertion && (assertion.body || assertion.summary || assertion.label)) || "Assertion text is not recorded.";
  }

  function nodeTitle(node, nodeId) {
    return normalizeText(node && (node.title || node.name)) || normalizeText(nodeId) || "Linked concept";
  }

  function renderAssertionList(experience, nodeMap) {
    if (!experience.assertions.length) {
      return '<p class="dr-source-section-empty">No source-linked assertions were returned by the current registry scan.</p>';
    }
    return `<div class="dr-source-record-list">${experience.assertions.slice(0, 24).map((assertion) => {
      const node = nodeMap.get(assertion.nodeId);
      const title = nodeTitle(node, assertion.nodeId);
      return `
        <article class="dr-source-record-item">
          <div class="dr-source-record-heading">
            <strong>${escapeHtml(title)}</strong>
            <span class="dr-source-record-type">${escapeHtml(titleCase(assertion.assertionType || "Assertion"))}</span>
          </div>
          <p>${escapeHtml(clip(assertionText(assertion), 260))}</p>
          <div class="dr-source-record-links">
            <a href="${escapeHtml(conceptHref(assertion.nodeId))}">Open Concept</a>
            <a href="${escapeHtml(sphereHref(assertion.nodeId))}">Open in Sphere</a>
          </div>
        </article>`;
    }).join("")}</div>`;
  }

  function renderConceptList(experience) {
    if (!experience.nodes.length) {
      return '<p class="dr-source-section-empty">No linked concepts were available from the loaded source records.</p>';
    }
    return `<div class="dr-source-concept-list">${experience.nodes.slice().sort((left, right) => nodeTitle(left).localeCompare(nodeTitle(right))).slice(0, 30).map((node) => `
      <article class="dr-source-concept-item">
        <div class="dr-source-concept-heading">
          <strong>${escapeHtml(nodeTitle(node, node.nodeId))}</strong>
          <span class="dr-source-record-type">${escapeHtml(titleCase(node.nodeType || "Meaning"))}</span>
        </div>
        <p>${escapeHtml(clip(node.summary || node.nodeId, 190))}</p>
        <div class="dr-source-concept-links">
          <a href="${escapeHtml(conceptHref(node.nodeId))}">Open Concept</a>
          <a href="${escapeHtml(sphereHref(node.nodeId))}">Open in Sphere</a>
        </div>
      </article>`).join("")}</div>`;
  }

  function renderRelationshipList(experience, nodeMap) {
    if (!experience.edges.length) {
      return '<p class="dr-source-section-empty">No source-linked relationship records were returned by the current registry scan.</p>';
    }
    return `<div class="dr-source-record-list">${experience.edges.slice(0, 16).map((edge) => {
      const fromTitle = nodeTitle(nodeMap.get(edge.fromNodeId), edge.fromNodeId);
      const toTitle = nodeTitle(nodeMap.get(edge.toNodeId), edge.toNodeId);
      return `
        <article class="dr-source-record-item">
          <div class="dr-source-record-heading">
            <strong>${escapeHtml(fromTitle)} → ${escapeHtml(toTitle)}</strong>
            <span class="dr-source-record-type">${escapeHtml(titleCase(edge.relationshipType || "Relationship"))}</span>
          </div>
          <p>${escapeHtml(clip(edge.summary || edge.label || "Source-supported semantic relationship.", 220))}</p>
          <div class="dr-source-record-links">
            <a href="${escapeHtml(conceptHref(edge.fromNodeId))}">Open first concept</a>
            <a href="${escapeHtml(sphereHref(edge.fromNodeId))}">Open relationship area</a>
          </div>
        </article>`;
    }).join("")}</div>`;
  }

  function renderDetails(experience) {
    const source = experience.source;
    const id = sourceId(source);
    const url = safeExternalUrl(source.url);
    const nodeMap = new Map(experience.nodes.map((node) => [node.nodeId, node]));
    const assertionCount = countDisplay(experience.assertionTotal, experience.assertions, experience.assertionTotalIsExact);
    const edgeCount = countDisplay(experience.edgeTotal, experience.edges, experience.edgeTotalIsExact);
    const conceptCount = numberText(experience.nodes.length);
    const assertionNote = scanNote(experience.assertionScan, "Assertion results");
    const edgeNote = scanNote(experience.edgeScan, "Relationship results");
    const provenanceNode = experience.nodes[0];

    elements.details.innerHTML = `
      <header class="dr-source-detail-header">
        <div class="dr-source-detail-heading">
          <div>
            <p class="dr-live-eyebrow">Selected live source</p>
            <h2>${escapeHtml(sourceName(source))}</h2>
            <span class="dr-source-card-id">${escapeHtml(id)}</span>
          </div>
          <span class="dr-source-badge">${escapeHtml(titleCase(sourceType(source)))}</span>
        </div>
        <p class="dr-source-detail-description">${escapeHtml(sourceDescription(source) || "This source record is registered in SourceRoot. Additional descriptive notes have not been recorded.")}</p>
        <div class="dr-source-detail-actions">
          ${url ? `<a class="dr-source-action" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open Source URL</a>` : ""}
          ${provenanceNode ? `<a class="dr-source-action" href="${escapeHtml(conceptHref(provenanceNode.nodeId))}">Open Concept</a><a class="dr-source-action" href="${escapeHtml(sphereHref(provenanceNode.nodeId))}">Open in Sphere</a>` : ""}
        </div>
      </header>

      <section class="dr-source-detail-section">
        <div class="dr-source-section-heading"><h3>Source summary</h3><span>SourceRoot registry metadata</span></div>
        <div class="dr-source-metadata-grid">
          ${metadataItem("Source ID", id)}
          ${metadataItem("Source type", titleCase(sourceType(source)))}
          ${metadataItem("Publisher", source.publisher)}
          ${metadataItem("Domain", source.domain)}
          ${metadataItem("URL", source.url)}
          ${metadataItem("License", source.license)}
          ${metadataItem("License status", source.licenseStatus)}
          ${metadataItem("Attribution", sourceAttribution(source))}
          ${metadataItem("Revision / version", sourceVersion(source))}
          ${metadataItem("Verification", source.verificationStatus)}
          ${metadataItem("Review status", source.reviewStatus)}
        </div>
      </section>

      <section class="dr-source-detail-section">
        <div class="dr-source-section-heading"><h3>Provenance path</h3><span>How evidence reaches DictionaryRoot</span></div>
        <div class="dr-source-provenance-flow" aria-label="Source provenance path">
          <div class="dr-source-provenance-step">Source record</div>
          <div class="dr-source-provenance-step">Assertion or relationship</div>
          <div class="dr-source-provenance-step">Exact WordNet meaning</div>
          <div class="dr-source-provenance-step">DictionaryRoot concept</div>
        </div>
      </section>

      <section class="dr-source-detail-section">
        <div class="dr-source-section-heading"><h3>Usage</h3><span>${escapeHtml(experience.assertionScan.strategy === "single-source-bundle" ? "Exact single-source bundle totals" : "Live registry results")}</span></div>
        <div class="dr-source-usage-grid">
          <div class="dr-source-usage-card"><strong>${escapeHtml(assertionCount)}</strong><span>Supported assertions</span></div>
          <div class="dr-source-usage-card"><strong>${escapeHtml(conceptCount)}</strong><span>Linked concepts loaded</span></div>
          <div class="dr-source-usage-card"><strong>${escapeHtml(edgeCount)}</strong><span>Supported relationships</span></div>
        </div>
      </section>

      <section class="dr-source-detail-section">
        <div class="dr-source-section-heading"><h3>Supported assertions</h3><span>${escapeHtml(`${experience.assertions.length.toLocaleString()} records displayed`)}</span></div>
        ${assertionNote ? `<p class="dr-source-list-note">${escapeHtml(assertionNote)}</p>` : ""}
        ${renderAssertionList(experience, nodeMap)}
      </section>

      <section class="dr-source-detail-section">
        <div class="dr-source-section-heading"><h3>Linked concepts</h3><span>Exact SourceRoot node IDs</span></div>
        ${renderConceptList(experience)}
      </section>

      <section class="dr-source-detail-section">
        <div class="dr-source-section-heading"><h3>Supported relationships</h3><span>${escapeHtml(`${experience.edges.length.toLocaleString()} records displayed`)}</span></div>
        ${edgeNote ? `<p class="dr-source-list-note">${escapeHtml(edgeNote)}</p>` : ""}
        ${renderRelationshipList(experience, nodeMap)}
      </section>`;
  }

  function renderDetailLoading(source) {
    elements.details.innerHTML = `
      <div class="dr-source-details-placeholder">
        <p class="dr-live-eyebrow">Loading live provenance</p>
        <h2>${escapeHtml(sourceName(source))}</h2>
        <p>Retrieving the source record, supported assertions, relationship records, and linked concepts from SourceRoot.</p>
      </div>
      <div class="dr-source-detail-loading" aria-label="Loading source details"><span></span><span></span><span></span></div>`;
  }

  function renderDetailError(source, error) {
    elements.details.innerHTML = `
      <div class="dr-source-details-placeholder">
        <p class="dr-live-eyebrow">Source detail unavailable</p>
        <h2>${escapeHtml(sourceName(source))}</h2>
        <p>${escapeHtml(error && error.message ? error.message : "The selected source could not be loaded.")}</p>
        <button class="dr-live-button" type="button" data-retry-source="${escapeHtml(sourceId(source))}">Retry source details</button>
      </div>`;
  }

  async function selectSource(id, options) {
    const settings = Object.assign({ history: "push", scroll: false, force: false }, options || {});
    const source = state.sources.find((item) => sourceId(item) === id);
    if (!source) return;
    state.selectedSourceId = id;
    state.selectedExperience = source.__dictionaryRootExperience || null;
    renderSourceGrid();
    renderStats();
    if (settings.history) writeUrlState(settings.history);

    if (source.__dictionaryRootExperience && !settings.force) {
      renderDetails(source.__dictionaryRootExperience);
      if (settings.scroll && global.matchMedia("(max-width: 1020px)").matches) elements.details.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const token = ++state.requestToken;
    renderDetailLoading(source);
    setStatus(`Loading provenance for ${sourceName(source)}…`, "loading");
    try {
      const experience = await state.client.sourceExperience(id, {
        singleSourceBundle: state.sources.length === 1,
        maxAssertionItems: 80,
        maxEdgeItems: 60,
        maxNodeItems: 80,
        maxPages: 12
      });
      if (token !== state.requestToken) return;
      source.__dictionaryRootExperience = experience;
      state.selectedExperience = experience;
      renderDetails(experience);
      applyFilters({ history: null });
      setStatus(`Live provenance loaded for ${sourceName(source)}.`, "success");
      if (settings.scroll && global.matchMedia("(max-width: 1020px)").matches) elements.details.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (token !== state.requestToken) return;
      renderDetailError(source, error);
      setStatus(`Source detail could not be loaded for ${sourceName(source)}.`, "error");
    }
  }

  function resetFilters() {
    state.search = "";
    state.sourceType = "all";
    state.sort = "usage";
    state.density = "comfortable";
    syncControlsFromState();
    applyFilters({ history: "push" });
    elements.search.focus();
  }

  async function loadSources(options) {
    const settings = Object.assign({ history: "replace" }, options || {});
    state.loading = true;
    elements.grid.innerHTML = '<div class="dr-source-loading-card"><span></span><span></span><span></span></div><div class="dr-source-loading-card"><span></span><span></span><span></span></div><div class="dr-source-loading-card"><span></span><span></span><span></span></div>';
    elements.grid.setAttribute("aria-busy", "true");
    elements.empty.hidden = true;
    setStatus("Connecting to SourceRoot…", "loading");
    renderStats();

    try {
      await state.client.health();
      const result = await state.client.sources({}, { limit: 100, concurrency: 4, maxPages: 100 });
      state.sources = result.items.filter((source) => sourceId(source));
      state.loading = false;
      clearOffline();
      buildSourceTypeControls();
      syncControlsFromState();
      applyFilters({ history: null });

      if (!state.sources.length) {
        state.selectedSourceId = "";
        elements.details.innerHTML = '<div class="dr-source-details-placeholder"><p class="dr-live-eyebrow">Live source registry</p><h2>No source records are available.</h2><p>The SourceRoot API is online, but the configured DictionaryRoot bundle returned an empty source registry.</p></div>';
        setStatus("SourceRoot is online, but no sources were returned.", "success");
        if (settings.history) writeUrlState(settings.history);
        return;
      }

      const requestedId = state.selectedSourceId;
      const selected = state.sources.find((source) => sourceId(source) === requestedId) || state.sources[0];
      setStatus(`${state.sources.length.toLocaleString()} live source record${state.sources.length === 1 ? "" : "s"} loaded.`, "success");
      await selectSource(sourceId(selected), { history: settings.history, scroll: false });
    } catch (error) {
      state.loading = false;
      state.sources = [];
      state.filteredSources = [];
      elements.grid.innerHTML = "";
      renderStats();
      setOffline(error);
    }
  }

  function handleGridClick(event) {
    if (event.target.closest("[data-source-nav]")) return;
    const inspect = event.target.closest("[data-inspect-source]");
    const card = event.target.closest("[data-source-id]");
    const id = inspect ? inspect.dataset.inspectSource : card && card.dataset.sourceId;
    if (id) selectSource(id, { history: "push", scroll: true });
  }

  function handleGridKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-source-id]");
    if (!card || event.target.closest("a,button")) return;
    event.preventDefault();
    selectSource(card.dataset.sourceId, { history: "push", scroll: true });
  }

  function bindEvents() {
    elements.search.addEventListener("input", () => {
      state.search = elements.search.value.trim();
      applyFilters({ history: "replace" });
    });
    elements.clearSearch.addEventListener("click", () => {
      state.search = "";
      elements.search.value = "";
      applyFilters({ history: "push" });
      elements.search.focus();
    });
    elements.typeFilter.addEventListener("change", () => {
      state.sourceType = elements.typeFilter.value;
      applyFilters({ history: "push" });
    });
    elements.sort.addEventListener("change", () => {
      state.sort = elements.sort.value;
      applyFilters({ history: "push" });
    });
    elements.density.addEventListener("change", () => {
      state.density = elements.density.value;
      applyFilters({ history: "push" });
    });
    elements.typeChips.addEventListener("click", (event) => {
      const button = event.target.closest("[data-source-type]");
      if (!button) return;
      state.sourceType = button.dataset.sourceType;
      elements.typeFilter.value = state.sourceType;
      applyFilters({ history: "push" });
    });
    elements.grid.addEventListener("click", handleGridClick);
    elements.grid.addEventListener("keydown", handleGridKeydown);
    elements.details.addEventListener("click", (event) => {
      const retry = event.target.closest("[data-retry-source]");
      if (retry) selectSource(retry.dataset.retrySource, { history: null, force: true });
    });
    elements.resetFilters.addEventListener("click", resetFilters);
    elements.retrySources.addEventListener("click", () => loadSources({ history: "replace" }));
    global.addEventListener("popstate", async () => {
      const urlState = readUrlState();
      state.search = urlState.search;
      state.sourceType = urlState.sourceType;
      state.sort = urlState.sort;
      state.density = urlState.density;
      syncControlsFromState();
      applyFilters({ history: null });
      const target = state.sources.find((source) => sourceId(source) === urlState.source);
      if (target) await selectSource(sourceId(target), { history: null, scroll: false });
    });
  }

  async function init() {
    elements.search = byId("dictionaryrootSourceSearch");
    elements.clearSearch = byId("dictionaryrootClearSourceSearch");
    elements.typeFilter = byId("dictionaryrootSourceTypeFilter");
    elements.sort = byId("dictionaryrootSourceSort");
    elements.density = byId("dictionaryrootSourceDensity");
    elements.typeChips = byId("dictionaryrootSourceTypeChips");
    elements.status = byId("dictionaryrootSourceStatus");
    elements.resultCount = byId("dictionaryrootSourceResultCount");
    elements.offline = byId("dictionaryrootSourceOffline");
    elements.offlineMessage = byId("dictionaryrootSourceOfflineMessage");
    elements.retrySources = byId("dictionaryrootRetrySources");
    elements.grid = byId("dictionaryrootSourceGrid");
    elements.empty = byId("dictionaryrootSourceEmpty");
    elements.resetFilters = byId("dictionaryrootResetSourceFilters");
    elements.details = byId("dictionaryrootSourceDetails");
    elements.heroStatus = byId("dictionaryrootSourceHeroStatus");
    elements.sourceCount = byId("dictionaryrootSourceCount");
    elements.visibleSourceCount = byId("dictionaryrootVisibleSourceCount");
    elements.linkedAssertionCount = byId("dictionaryrootLinkedAssertionCount");
    elements.linkedConceptCount = byId("dictionaryrootLinkedConceptCount");

    const initial = readUrlState();
    state.selectedSourceId = initial.source;
    state.search = initial.search;
    state.sourceType = initial.sourceType;
    state.sort = initial.sort;
    state.density = initial.density;

    state.manifest = await DictionaryRootApi.loadManifest();
    state.client = new DictionaryRootApi.DictionaryRootApiClient(state.manifest);
    bindEvents();
    await loadSources({ history: "replace" });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window);
