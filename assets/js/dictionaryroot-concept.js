(function dictionaryRootConceptExperience(global) {
  "use strict";

  const relationshipLabels = (global.DictionaryRootBrand && global.DictionaryRootBrand.RELATIONSHIP_LABELS) || {};
  const state = {
    manifest: null,
    client: null,
    current: null,
    currentLabel: "",
    lastQuery: "",
    navigatingHistory: false
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
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ""), global.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
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

  function normalizeType(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  }

  function metadataFrom(record) {
    return record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  }

  function partOfSpeechFrom(record) {
    const metadata = metadataFrom(record);
    return metadata.partOfSpeech || metadata.pos || record.objectType || record.nodeType || "concept";
  }

  function lemmasFrom(record) {
    const metadata = metadataFrom(record);
    const lemmas = Array.isArray(metadata.lemmas) ? metadata.lemmas : [];
    return Array.from(new Set(lemmas.map((item) => String(item || "").trim()).filter(Boolean)));
  }

  function assertionText(assertion) {
    return String((assertion && (assertion.body || assertion.summary || assertion.value)) || "").trim();
  }

  function definitionsFrom(concept) {
    const definitions = (concept.assertions || [])
      .filter((item) => normalizeType(item.assertionType) === "DEFINITION")
      .map(assertionText)
      .filter(Boolean);
    const fallback = concept.node && concept.node.summary ? String(concept.node.summary).trim() : "";
    return Array.from(new Set(definitions.length ? definitions : fallback ? [fallback] : []));
  }

  function examplesFrom(concept) {
    const values = [];
    (concept.assertions || []).forEach((item) => {
      const type = normalizeType(item.assertionType);
      if (!["USAGE_EXAMPLE", "EXAMPLE", "USAGE"].includes(type)) return;
      assertionText(item)
        .split(/\r?\n|\s*\|\s*/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => values.push(entry));
    });
    const metadataExamples = metadataFrom(concept.node).examples;
    if (Array.isArray(metadataExamples)) {
      metadataExamples.map((item) => String(item || "").trim()).filter(Boolean).forEach((item) => values.push(item));
    }
    return Array.from(new Set(values));
  }

  function friendlyRelationship(type, fallback) {
    const normalized = normalizeType(type);
    return relationshipLabels[normalized]
      || fallback
      || String(type || "Related concept").replace(/_/g, " ").toLowerCase();
  }

  function relationshipFamily(types) {
    const normalized = (types || []).map(normalizeType);
    if (normalized.some((type) => type.includes("HYPERNYM"))) return "Broader meanings";
    if (normalized.some((type) => type.includes("HYPONYM"))) return "More specific meanings";
    if (normalized.some((type) => type.includes("ANTONYM") || type.includes("CONTRAST"))) return "Opposites and contrasts";
    if (normalized.some((type) => type.includes("MERONYM") || type.includes("HOLONYM") || type.includes("PART_OF"))) return "Parts, members, and wholes";
    return "Similar and related meanings";
  }

  function setStatus(message, status) {
    elements.status.textContent = message || "";
    elements.status.dataset.state = status || "";
  }

  function setSearchBusy(busy) {
    elements.searchButton.disabled = busy;
    elements.searchButton.textContent = busy ? "Searching..." : "Find meanings";
  }

  function setConceptLoading(message) {
    elements.detail.innerHTML = `
      <div class="dr-concept-loading">
        <div><strong>Loading this meaning...</strong>${escapeHtml(message || "Retrieving the node, assertions, relationships, and sources from SourceRoot.")}</div>
      </div>`;
    elements.summary.innerHTML = `
      <div class="dr-live-empty">
        <strong>Retrieving source-backed records...</strong>
        DictionaryRoot is resolving this exact meaning through SourceRoot.
      </div>`;
  }

  function canonicalNote(record, preferred) {
    const canonical = String(record.title || "");
    return canonical && canonical.toLocaleLowerCase() !== String(preferred || "").toLocaleLowerCase()
      ? `<span class="dr-live-canonical">Open English WordNet also indexes this sense as <strong>${escapeHtml(canonical)}</strong>.</span>`
      : "";
  }

  function updateHistory(params, mode) {
    if (state.navigatingHistory) return;
    const url = new URL(global.location.href);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    });
    if (mode === "replace") global.history.replaceState({}, "", url);
    else global.history.pushState({}, "", url);
  }

  function renderSearchResults(query, payload) {
    const raw = DictionaryRootApi.extractItems(payload)
      .filter((item) => item.resultType === "node" || !item.resultType);
    const ranked = DictionaryRootApi.rankMeaningResults(raw, query);
    const exact = DictionaryRootApi.exactMeaningResults(ranked, query);
    const related = ranked.filter((item) => !exact.includes(item));
    const shown = exact.length
      ? exact.concat(related.slice(0, Math.max(0, 24 - exact.length)))
      : related.slice(0, 24);

    elements.results.innerHTML = "";
    elements.sensePanel.hidden = false;
    elements.senseCount.textContent = `${shown.length} meaning${shown.length === 1 ? "" : "s"}`;

    if (!shown.length) {
      elements.results.innerHTML = `
        <div class="dr-live-empty">
          <strong>No matching meaning was found.</strong>
          Check the spelling or try a related word.
        </div>`;
      setStatus(`DictionaryRoot could not find “${query}” in the connected customer dataset.`, "error");
      return;
    }

    shown.forEach((result) => {
      const rank = DictionaryRootApi.meaningMatchRank(result, query);
      const preferred = DictionaryRootApi.preferredMeaningLabel(result, query);
      const card = document.createElement("article");
      card.className = "dr-concept-sense-card";
      card.dataset.exact = rank <= 1 ? "true" : "false";
      card.innerHTML = `
        <div>
          <h3>${escapeHtml(preferred)}</h3>
          ${canonicalNote(result, preferred)}
          <p>${escapeHtml(result.summary || "Open this meaning to inspect its source-backed definition and semantic neighborhood.")}</p>
          <div class="dr-live-chip-row">
            <span class="dr-live-chip" data-tone="accent">${escapeHtml(partOfSpeechFrom(result))}</span>
            <span class="dr-live-chip" data-tone="good">Source-backed</span>
            <span class="dr-live-chip">${rank <= 1 ? "Exact sense" : "Related match"}</span>
          </div>
        </div>
        <div class="dr-live-actions">
          <button class="dr-live-button-secondary" type="button" data-open-node="${escapeHtml(result.id)}" data-preferred-label="${escapeHtml(preferred)}">Open meaning</button>
        </div>`;
      elements.results.appendChild(card);
    });

    if (exact.length > 1) {
      setStatus(`${exact.length} exact senses of “${query}” found. Choose the intended meaning.`, "success");
    } else if (exact.length === 1) {
      setStatus(`One exact meaning of “${query}” found. Related matches follow.`, "success");
    } else {
      setStatus(`No exact lemma was found. Showing ${shown.length} related meaning${shown.length === 1 ? "" : "s"}.`, "");
    }
  }

  async function search(query, options) {
    const settings = Object.assign({ history: "push", scroll: false }, options || {});
    const clean = String(query || "").trim();
    if (!clean) {
      setStatus("Enter a word to explore.", "error");
      return;
    }

    state.lastQuery = clean;
    elements.input.value = clean;
    setSearchBusy(true);
    setStatus(`Searching DictionaryRoot for “${clean}”...`, "loading");
    elements.results.innerHTML = "";
    elements.sensePanel.hidden = false;

    try {
      const response = await state.client.searchNodes(clean, { limit: 100 });
      renderSearchResults(clean, response.data);
      if (settings.history) updateHistory({ q: clean, nodeId: null }, settings.history);
      if (settings.scroll) elements.sensePanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      elements.results.innerHTML = `
        <div class="dr-live-empty">
          <strong>DictionaryRoot could not reach its knowledge service.</strong>
          Your data has not been changed. Start the SourceRoot backend, then try again.
        </div>`;
      elements.sensePanel.hidden = false;
      setStatus(error.message || "Search failed.", "error");
    } finally {
      setSearchBusy(false);
    }
  }

  function relationDescriptor(edge, nodeId) {
    const incoming = String(edge.toNodeId || "") === String(nodeId || "");
    const neighborId = incoming ? edge.fromNodeId : edge.toNodeId;
    return {
      edge,
      incoming,
      neighborId,
      type: normalizeType(edge.relationshipType || edge.type),
      label: friendlyRelationship(edge.relationshipType || edge.type, edge.label)
    };
  }

  function groupedRelations(concept) {
    const nodeId = concept.node.nodeId;
    const relationMap = new Map();

    (concept.edges || []).map((edge) => relationDescriptor(edge, nodeId)).forEach((relation) => {
      if (!relation.neighborId) return;
      if (!relationMap.has(relation.neighborId)) {
        relationMap.set(relation.neighborId, {
          neighborId: relation.neighborId,
          types: new Set(),
          labels: new Set(),
          directions: new Set(),
          edgeCount: 0
        });
      }
      const grouped = relationMap.get(relation.neighborId);
      grouped.types.add(relation.type || "RELATED_TO");
      grouped.labels.add(relation.label || "Related concept");
      grouped.directions.add(relation.incoming ? "Incoming" : "Outgoing");
      grouped.edgeCount += 1;
    });

    return Array.from(relationMap.values()).map((item) => ({
      neighborId: item.neighborId,
      types: Array.from(item.types),
      labels: Array.from(item.labels),
      directions: Array.from(item.directions),
      edgeCount: item.edgeCount,
      family: relationshipFamily(Array.from(item.types))
    }));
  }

  function renderDefinitionSection(definitions) {
    if (definitions.length <= 1) return "";
    return `
      <section class="dr-concept-content-section">
        <h2>Recorded definitions</h2>
        <p class="dr-concept-section-intro">Every definition below is stored as a separate SourceRoot assertion for this exact meaning.</p>
        <ol class="dr-concept-definition-list">
          ${definitions.map((definition) => `<li class="dr-concept-definition-item"><p>${escapeHtml(definition)}</p></li>`).join("")}
        </ol>
      </section>`;
  }

  function renderLanguageSection(node, lemmas) {
    if (!lemmas.length) return "";
    return `
      <section class="dr-concept-content-section">
        <h2>Words attached to this sense</h2>
        <p class="dr-concept-section-intro">These lexical forms point to the same underlying WordNet sense record.</p>
        <div class="dr-concept-lemma-row">
          ${lemmas.map((lemma) => `<span class="dr-concept-lemma">${escapeHtml(lemma)}</span>`).join("")}
        </div>
      </section>`;
  }

  function renderExamplesSection(examples) {
    return `
      <section class="dr-concept-content-section">
        <h2>Usage examples</h2>
        ${examples.length
          ? `<ul class="dr-concept-example-list">${examples.map((example) => `<li class="dr-concept-example-item"><p>${escapeHtml(example)}</p></li>`).join("")}</ul>`
          : '<p class="dr-concept-section-intro">No usage examples are currently available from the connected lexical source.</p>'}
      </section>`;
  }

  function renderRelationshipSections(relations, neighborMap) {
    if (!relations.length) {
      return `
        <section class="dr-concept-content-section">
          <h2>Connected meanings</h2>
          <p class="dr-concept-section-intro">No semantic relationships were returned for this meaning.</p>
        </section>`;
    }

    const familyOrder = [
      "Broader meanings",
      "More specific meanings",
      "Opposites and contrasts",
      "Parts, members, and wholes",
      "Similar and related meanings"
    ];
    const groups = new Map(familyOrder.map((name) => [name, []]));
    relations.forEach((relation) => {
      if (!groups.has(relation.family)) groups.set(relation.family, []);
      groups.get(relation.family).push(relation);
    });

    const content = familyOrder
      .filter((family) => (groups.get(family) || []).length)
      .map((family) => {
        const items = groups.get(family).slice().sort((left, right) => {
          const leftNode = neighborMap.get(left.neighborId);
          const rightNode = neighborMap.get(right.neighborId);
          return String(leftNode && leftNode.title || left.neighborId)
            .localeCompare(String(rightNode && rightNode.title || right.neighborId));
        });
        return `
          <section class="dr-concept-relationship-group">
            <div class="dr-concept-relationship-group-header">
              <h3>${escapeHtml(family)}</h3>
              <span class="dr-live-chip">${items.length}</span>
            </div>
            <div class="dr-concept-relationship-grid">
              ${items.map((item) => {
                const neighbor = neighborMap.get(item.neighborId);
                const name = neighbor ? neighbor.title : item.neighborId;
                const summary = neighbor && neighbor.summary ? neighbor.summary : "Open this connected meaning to inspect its definition and provenance.";
                return `
                  <article class="dr-concept-relationship-card">
                    <h4>${escapeHtml(name)}</h4>
                    <p>${escapeHtml(summary)}</p>
                    <div class="dr-concept-relationship-types">
                      ${item.labels.map((label) => `<span class="dr-live-chip" data-tone="accent">${escapeHtml(label)}</span>`).join("")}
                      ${item.directions.map((direction) => `<span class="dr-live-chip">${escapeHtml(direction)}</span>`).join("")}
                    </div>
                    <div class="dr-live-actions">
                      <button class="dr-live-button-secondary" type="button" data-open-node="${escapeHtml(item.neighborId)}" data-preferred-label="${escapeHtml(name)}">Open meaning</button>
                      <a class="dr-live-button-secondary" href="${escapeHtml(experienceHref("graph-v2.html", item.neighborId, name))}">Open sphere</a>
                    </div>
                  </article>`;
              }).join("")}
            </div>
          </section>`;
      }).join("");

    return `
      <section class="dr-concept-content-section">
        <h2>Connected meanings</h2>
        <p class="dr-concept-section-intro">Relationships are grouped for readability while preserving the underlying SourceRoot edge types.</p>
        <div class="dr-concept-relationship-groups">${content}</div>
      </section>`;
  }

  function renderSourcesSection(concept) {
    const sourceIds = Array.from(new Set(
      (concept.node && Array.isArray(concept.node.sourceIds) ? concept.node.sourceIds : [])
        .concat((concept.assertions || []).flatMap((item) => Array.isArray(item.sourceIds) ? item.sourceIds : []))
    ));

    const sources = concept.sources || [];
    const cards = sources.length
      ? sources.map((source) => {
        const href = safeExternalUrl(source.url);
        const id = sourceRecordId(source);
        const registryHref = experienceHref("sources-v2.html", concept.node && concept.node.nodeId, state.currentLabel || concept.node.title, id);
        return `
          <article class="dr-concept-source-item">
            <strong>${escapeHtml(source.name || source.title || "Recorded lexical source")}</strong>
            <span>${escapeHtml(source.publisher || "Lexical data publisher")}</span>
            <span>${escapeHtml(source.license || "License information is recorded in SourceRoot")}</span>
            <a class="dr-concept-text-link" href="${escapeHtml(registryHref)}">Inspect source record</a>
            ${href ? `<a class="dr-concept-text-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Visit source website</a>` : ""}
          </article>`;
      }).join("")
      : `
        <article class="dr-concept-source-item">
          <strong>Recorded source identifiers</strong>
          <span>${sourceIds.length ? escapeHtml(sourceIds.join(", ")) : "Source details are temporarily unavailable."}</span>
        </article>`;

    return `
      <section class="dr-concept-content-section">
        <h2>Sources and provenance</h2>
        <p class="dr-concept-section-intro">DictionaryRoot keeps the meaning connected to the lexical records that support it.</p>
        <div class="dr-concept-source-grid">${cards}</div>
      </section>`;
  }

  function renderSummary(concept, displayTitle, relationCount, uniqueRelationCount, durationMs) {
    const node = concept.node;
    const sourceIds = Array.from(new Set(
      (Array.isArray(node.sourceIds) ? node.sourceIds : [])
        .concat((concept.assertions || []).flatMap((item) => Array.isArray(item.sourceIds) ? item.sourceIds : []))
    ));
    elements.summary.innerHTML = `
      <h3 class="dr-concept-summary-title">${escapeHtml(displayTitle)}</h3>
      <p class="dr-concept-summary-id">${escapeHtml(node.nodeId)}</p>
      <div class="dr-live-chip-row">
        <span class="dr-live-chip" data-tone="accent">${escapeHtml(partOfSpeechFrom(node))}</span>
        <span class="dr-live-chip" data-tone="good">Source-backed</span>
      </div>
      <div class="dr-concept-summary-grid">
        <div><strong>${(concept.assertions || []).length}</strong><span>Assertions</span></div>
        <div><strong>${relationCount}</strong><span>Relationship records</span></div>
        <div><strong>${uniqueRelationCount}</strong><span>Connected meanings</span></div>
        <div><strong>${Math.max(sourceIds.length, (concept.sources || []).length)}</strong><span>Sources</span></div>
      </div>
      <div class="dr-concept-sidebar-actions">
        <a class="dr-live-button" href="${escapeHtml(experienceHref("graph-v2.html", node.nodeId, displayTitle, sourceIds[0]))}">Explore in knowledge sphere</a>
        <a class="dr-live-button-secondary" href="${escapeHtml(experienceHref("history-v2.html", node.nodeId, displayTitle, sourceIds[0]))}">Review knowledge history</a>
        <button class="dr-live-button-secondary" type="button" data-copy-link>Copy concept link</button>
        <button class="dr-live-button-secondary" type="button" data-return-search>Return to meaning choices</button>
      </div>
      <p class="dr-concept-canonical">Loaded through the SourceRoot customer API${Number.isFinite(durationMs) ? ` in approximately ${Math.round(durationMs)} ms` : ""}.</p>`;
  }

  async function renderConcept(concept, preferredLabel) {
    const node = concept.node;
    const displayTitle = String(preferredLabel || node.title || "Untitled meaning");
    const canonical = displayTitle.toLocaleLowerCase() !== String(node.title || "").toLocaleLowerCase()
      ? node.title
      : "";
    const definitions = definitionsFrom(concept);
    const primaryDefinition = definitions[0] || "No definition is currently available for this meaning.";
    const examples = examplesFrom(concept);
    const lemmas = lemmasFrom(node);
    const relations = groupedRelations(concept);
    const neighborIds = relations.slice(0, 60).map((item) => item.neighborId);
    const neighbors = await state.client.nodesByIds(neighborIds, { concurrency: 8 });
    const neighborMap = new Map(neighbors.map((item) => [item.nodeId, item]));
    const sourceIds = Array.from(new Set(
      (Array.isArray(node.sourceIds) ? node.sourceIds : [])
        .concat((concept.assertions || []).flatMap((item) => Array.isArray(item.sourceIds) ? item.sourceIds : []))
    ));

    elements.detail.innerHTML = `
      <header class="dr-concept-record-hero">
        <div class="dr-concept-record-topline">
          <div class="dr-live-chip-row">
            <span class="dr-live-chip" data-tone="accent">${escapeHtml(partOfSpeechFrom(node))}</span>
            <span class="dr-live-chip" data-tone="good">Source-backed meaning</span>
            <span class="dr-live-chip">${relations.length} connected meanings</span>
          </div>
          <div class="dr-live-actions">
            <a class="dr-live-button-secondary" href="${escapeHtml(experienceHref("graph-v2.html", node.nodeId, displayTitle, sourceIds[0]))}">Open sphere</a>
            <a class="dr-live-button-secondary" href="${escapeHtml(experienceHref("history-v2.html", node.nodeId, displayTitle, sourceIds[0]))}">View history</a>
          </div>
        </div>
        <h2 class="dr-concept-record-title">${escapeHtml(displayTitle)}</h2>
        ${canonical ? `<p class="dr-concept-canonical">Open English WordNet groups this exact sense under <strong>${escapeHtml(canonical)}</strong>.</p>` : ""}
        <p class="dr-concept-definition-label">Definition</p>
        <p class="dr-concept-primary-definition">${escapeHtml(primaryDefinition)}</p>
      </header>

      <section class="dr-concept-metric-grid" aria-label="Meaning record summary">
        <div class="dr-concept-metric"><strong>${definitions.length}</strong><span>Recorded definition${definitions.length === 1 ? "" : "s"}</span></div>
        <div class="dr-concept-metric"><strong>${(concept.assertions || []).length}</strong><span>Total assertions</span></div>
        <div class="dr-concept-metric"><strong>${(concept.edges || []).length}</strong><span>Relationship records</span></div>
        <div class="dr-concept-metric"><strong>${Math.max(sourceIds.length, (concept.sources || []).length)}</strong><span>Linked sources</span></div>
      </section>

      <div class="dr-concept-content">
        ${renderLanguageSection(node, lemmas)}
        ${renderDefinitionSection(definitions)}
        ${renderExamplesSection(examples)}
        ${renderRelationshipSections(relations, neighborMap)}
        ${renderSourcesSection(concept)}
        <details class="dr-live-advanced">
          <summary>Advanced SourceRoot record</summary>
          <pre>${escapeHtml(JSON.stringify(concept, null, 2))}</pre>
        </details>
      </div>`;

    renderSummary(concept, displayTitle, (concept.edges || []).length, relations.length, concept.durationMs);
    document.title = `${displayTitle} — DictionaryRoot`;
  }

  async function openNode(nodeId, preferredLabel, options) {
    const settings = Object.assign({ history: "push", scroll: true }, options || {});
    if (!nodeId) return;

    setConceptLoading("Retrieving the concept, assertions, relationships, and source records.");
    setStatus("Loading source-backed concept details...", "loading");

    try {
      const concept = await state.client.concept(nodeId);
      state.current = concept;
      state.currentLabel = String(preferredLabel || concept.node.title || "");
      elements.input.value = state.currentLabel;
      await renderConcept(concept, state.currentLabel);
      setStatus(`Loaded “${state.currentLabel}” from PostgreSQL through the SourceRoot API.`, "success");
      if (settings.history) updateHistory({ nodeId, q: state.currentLabel }, settings.history);
      if (settings.scroll) elements.detail.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      elements.detail.innerHTML = `
        <div class="dr-live-empty">
          <strong>This meaning could not be loaded.</strong>
          Check the SourceRoot connection and try again.
        </div>`;
      elements.summary.innerHTML = `
        <div class="dr-live-empty">
          <strong>Concept unavailable.</strong>
          No customer records were changed.
        </div>`;
      setStatus(error.message || "Concept load failed.", "error");
    }
  }

  function bindEvents() {
    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      search(elements.input.value, { history: "push", scroll: true });
    });

    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-open-node]");
      if (open) {
        await openNode(open.dataset.openNode, open.dataset.preferredLabel || "", { history: "push", scroll: true });
        return;
      }

      const copy = event.target.closest("[data-copy-link]");
      if (copy) {
        try {
          await navigator.clipboard.writeText(global.location.href);
          const original = copy.textContent;
          copy.textContent = "Link copied";
          setTimeout(() => { copy.textContent = original; }, 1800);
        } catch (_) {
          setStatus("Copy was unavailable. Use the address bar to copy this link.", "error");
        }
        return;
      }

      const returnSearch = event.target.closest("[data-return-search]");
      if (returnSearch) {
        if (elements.sensePanel.hidden && state.lastQuery) {
          await search(state.lastQuery, { history: null, scroll: false });
        }
        elements.sensePanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    global.addEventListener("popstate", async () => {
      state.navigatingHistory = true;
      try {
        const params = new URLSearchParams(global.location.search);
        const nodeId = params.get("nodeId");
        const query = params.get("q") || state.manifest.defaults.searchTerm || "knowledge";
        if (nodeId) await openNode(nodeId, query, { history: null, scroll: false });
        else await search(query, { history: null, scroll: false });
      } finally {
        state.navigatingHistory = false;
      }
    });
  }

  async function init() {
    Object.assign(elements, {
      form: byId("dictionaryrootSearchForm"),
      input: byId("dictionaryrootSearchInput"),
      searchButton: byId("dictionaryrootSearchButton"),
      status: byId("dictionaryrootSearchStatus"),
      results: byId("dictionaryrootSearchResults"),
      sensePanel: byId("dictionaryrootSenseChooser"),
      senseCount: byId("dictionaryrootSenseCount"),
      detail: byId("dictionaryrootConceptDetail"),
      summary: byId("dictionaryrootConceptSummary")
    });

    state.manifest = await DictionaryRootApi.loadManifest();
    state.client = new DictionaryRootApi.DictionaryRootApiClient(state.manifest);
    bindEvents();

    const params = new URLSearchParams(global.location.search);
    const nodeId = params.get("nodeId");
    const query = params.get("q") || state.manifest.defaults.searchTerm || "knowledge";
    elements.input.value = query;

    if (nodeId) {
      await openNode(nodeId, query, { history: "replace", scroll: false });
    } else {
      await search(query, { history: "replace", scroll: false });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window);
