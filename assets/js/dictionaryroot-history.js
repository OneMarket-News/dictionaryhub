(function dictionaryRootHistoryExperience(global) {
  "use strict";

  const state = {
    manifest: null,
    client: null,
    concept: null,
    currentNodeId: "",
    currentLabel: "",
    lastQuery: "",
    revisions: [],
    bundleRevisions: [],
    selectedRevisionId: "",
    statusFilter: "all",
    navigatingHistory: false
  };
  const elements = {};

  function byId(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clean(value) { return String(value == null ? "" : value).trim(); }

  function normalizeType(value) {
    return clean(value).toUpperCase().replace(/[\s-]+/g, "_");
  }

  function metadataFrom(record) {
    return record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  }

  function assertionText(assertion) {
    return clean(assertion && (assertion.body || assertion.summary || assertion.value || assertion.label));
  }

  function definitionsFrom(concept) {
    const definitions = (concept && Array.isArray(concept.assertions) ? concept.assertions : [])
      .filter((item) => normalizeType(item.assertionType) === "DEFINITION")
      .map(assertionText)
      .filter(Boolean);
    const fallback = clean(concept && concept.node && concept.node.summary);
    return Array.from(new Set(definitions.length ? definitions : fallback ? [fallback] : []));
  }

  function partOfSpeech(record) {
    const metadata = metadataFrom(record);
    return clean(metadata.partOfSpeech || metadata.pos || record && (record.objectType || record.nodeType)) || "concept";
  }

  function sourceId(source) { return clean(source && (source.sourceId || source.id)); }

  function statusValue(revision) {
    const value = clean(revision && revision.status).toLowerCase();
    return ["current", "corrected", "disputed", "superseded"].includes(value) ? value : value || "recorded";
  }

  function friendly(value, fallback) {
    const text = clean(value || fallback || "recorded revision").replace(/[_-]+/g, " ");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Recorded revision";
  }

  function formatDate(value) {
    if (!value) return "Date not recorded";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return clean(value);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    }).format(parsed);
  }

  function setStatus(message, status) {
    elements.status.textContent = message || "";
    elements.status.dataset.state = status || "";
  }

  function setSearchBusy(busy) {
    elements.searchButton.disabled = Boolean(busy);
    elements.searchButton.textContent = busy ? "Searching..." : "Find history";
  }

  function experienceHref(page, nodeId, label, source, revisionId) {
    if (global.DictionaryRootNavigation) {
      return global.DictionaryRootNavigation.buildHref(page, {
        nodeId: nodeId || "",
        meaning: label || "",
        sourceId: source || "",
        revisionId: revisionId || ""
      });
    }
    const params = new URLSearchParams();
    if (label) params.set(page === "sources-v2.html" ? "meaning" : "q", label);
    if (nodeId) params.set("nodeId", nodeId);
    if (source) params.set("source", source);
    if (revisionId && page === "history-v2.html") params.set("revision", revisionId);
    return `${page}${params.toString() ? `?${params.toString()}` : ""}`;
  }

  function updateUrl(values, mode) {
    if (state.navigatingHistory) return;
    const url = new URL(global.location.href);
    Object.entries(values || {}).forEach(([key, value]) => {
      const normalized = clean(value);
      if (normalized) url.searchParams.set(key, normalized);
      else url.searchParams.delete(key);
    });
    if (mode === "replace") global.history.replaceState({}, "", url);
    else global.history.pushState({}, "", url);
  }

  function rawData(revision) {
    return revision && revision.rawData && typeof revision.rawData === "object" ? revision.rawData : {};
  }

  function snapshotFromRevision(revision) {
    const raw = rawData(revision);
    const candidates = [raw.after, raw.snapshot, raw.object, raw.record, raw.currentState, raw.current];
    return candidates.find((candidate) => candidate && typeof candidate === "object") || null;
  }

  function listFromSnapshot(snapshot, keys) {
    if (!snapshot || typeof snapshot !== "object") return [];
    for (const key of keys) {
      if (Array.isArray(snapshot[key])) return snapshot[key];
    }
    return [];
  }

  function itemIdentity(item, index) {
    if (item == null) return `item-${index}`;
    if (typeof item !== "object") return String(item);
    return clean(item.assertionId || item.edgeId || item.sourceId || item.nodeId || item.id || item.key || item.label || item.title || item.body || item.summary) || `item-${index}`;
  }

  function itemLabel(item) {
    if (item == null) return "Empty value";
    if (typeof item !== "object") return clean(item);
    return clean(item.title || item.label || item.body || item.summary || item.name || item.assertionId || item.edgeId || item.sourceId || item.nodeId || item.id) || "Recorded item";
  }

  function compareLists(currentItems, historicalItems) {
    const current = new Map((currentItems || []).map((item, index) => [itemIdentity(item, index), item]));
    const historical = new Map((historicalItems || []).map((item, index) => [itemIdentity(item, index), item]));
    const added = [];
    const removed = [];
    const changed = [];

    current.forEach((item, key) => {
      if (!historical.has(key)) added.push(itemLabel(item));
      else if (JSON.stringify(item) !== JSON.stringify(historical.get(key))) changed.push(itemLabel(item));
    });
    historical.forEach((item, key) => {
      if (!current.has(key)) removed.push(itemLabel(item));
    });
    return { added, removed, changed };
  }

  function currentSnapshot() {
    const concept = state.concept || {};
    const node = concept.node || {};
    const sources = concept.sources || [];
    return {
      node,
      assertions: concept.assertions || [],
      edges: concept.edges || [],
      sources,
      sourceIds: Array.from(new Set(
        (Array.isArray(node.sourceIds) ? node.sourceIds : [])
          .concat((concept.assertions || []).flatMap((item) => Array.isArray(item.sourceIds) ? item.sourceIds : []))
      ))
    };
  }

  function statusChip(status) {
    const normalized = clean(status).toLowerCase() || "recorded";
    return `<span class="dr-history-status" data-status="${escapeHtml(normalized)}">${escapeHtml(friendly(normalized))}</span>`;
  }

  function renderSearchResults(query, payload) {
    const raw = DictionaryRootApi.extractItems(payload)
      .filter((item) => item && (item.resultType === "node" || !item.resultType));
    const ranked = DictionaryRootApi.rankMeaningResults(raw, query);
    const exact = DictionaryRootApi.exactMeaningResults(ranked, query);
    const shown = (exact.length ? exact.concat(ranked.filter((item) => !exact.includes(item))) : ranked).slice(0, 20);

    elements.results.innerHTML = "";
    elements.sensePanel.hidden = false;
    elements.senseCount.textContent = `${shown.length} meaning${shown.length === 1 ? "" : "s"}`;

    if (!shown.length) {
      elements.results.innerHTML = '<div class="dr-live-empty"><strong>No matching meaning was found.</strong>Check the spelling or try a related word.</div>';
      setStatus(`DictionaryRoot could not find “${query}” in the live customer dataset.`, "error");
      return;
    }

    elements.results.innerHTML = shown.map((record) => {
      const label = DictionaryRootApi.preferredMeaningLabel(record, query);
      const rank = DictionaryRootApi.meaningMatchRank(record, query);
      return `<article class="dr-history-sense-card" data-exact="${rank <= 1 ? "true" : "false"}">
        <div>
          <h3>${escapeHtml(label)}</h3>
          <p>${escapeHtml(record.summary || "Open this meaning to inspect its current state and recorded revision lineage.")}</p>
          <div class="dr-live-chip-row">
            <span class="dr-live-chip" data-tone="accent">${escapeHtml(partOfSpeech(record))}</span>
            <span class="dr-live-chip">${rank <= 1 ? "Exact sense" : "Related match"}</span>
          </div>
        </div>
        <button class="dr-live-button-secondary" type="button" data-open-history="${escapeHtml(record.id || record.nodeId)}" data-history-label="${escapeHtml(label)}">Open history</button>
      </article>`;
    }).join("");

    if (exact.length > 1) setStatus(`${exact.length} exact senses of “${query}” found. Choose the intended meaning.`, "success");
    else if (exact.length === 1) setStatus(`One exact meaning of “${query}” found.`, "success");
    else setStatus(`Showing ${shown.length} related meanings because no exact lemma was returned.`, "");
  }

  async function search(query, options) {
    const settings = Object.assign({ history: "push", scroll: true }, options || {});
    const term = clean(query);
    if (!term) {
      setStatus("Enter a word to inspect its history.", "error");
      return;
    }

    state.lastQuery = term;
    elements.input.value = term;
    setSearchBusy(true);
    setStatus(`Searching DictionaryRoot for “${term}”...`, "loading");
    elements.sensePanel.hidden = false;
    elements.results.innerHTML = '<div class="dr-live-empty"><strong>Retrieving exact meanings...</strong>Searching the live SourceRoot index.</div>';

    try {
      const response = await state.client.searchNodes(term, { limit: 100 });
      renderSearchResults(term, response.data);
      if (settings.history) updateUrl({ q: term, nodeId: "", revision: "" }, settings.history);
      if (settings.scroll) elements.sensePanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      elements.results.innerHTML = '<div class="dr-live-empty"><strong>The live history search is unavailable.</strong>Start the SourceRoot backend and retry. No fallback data was used.</div>';
      setStatus(error && error.message ? error.message : "History search failed.", "error");
    } finally {
      setSearchBusy(false);
    }
  }

  function renderCurrentSnapshot() {
    const concept = state.concept;
    const node = concept.node;
    const snapshot = currentSnapshot();
    const definitions = definitionsFrom(concept);
    const sourceCount = Math.max(snapshot.sourceIds.length, snapshot.sources.length);
    elements.conceptTitle.textContent = state.currentLabel || node.title || "Selected meaning";
    elements.currentStatus.innerHTML = `${statusChip(node.status || "current")}<span class="dr-live-chip" data-tone="good">Live SourceRoot state</span>`;
    elements.currentSnapshot.innerHTML = `
      <div class="dr-history-current-grid">
        <div><strong>${snapshot.assertions.length}</strong><span>Current assertions</span></div>
        <div><strong>${snapshot.edges.length}</strong><span>Current relationships</span></div>
        <div><strong>${sourceCount}</strong><span>Current sources</span></div>
        <div><strong>${state.revisions.length}</strong><span>Concept revisions</span></div>
      </div>
      <p class="dr-history-current-definition">${escapeHtml(definitions[0] || node.summary || "No current definition was returned for this meaning.")}</p>
      <div class="dr-live-chip-row">
        <span class="dr-live-chip" data-tone="accent">${escapeHtml(partOfSpeech(node))}</span>
        <span class="dr-live-chip">${escapeHtml(node.nodeId)}</span>
      </div>
      <div class="dr-history-current-actions">
        <a class="dr-live-button" href="${escapeHtml(experienceHref("concept-v2.html", node.nodeId, state.currentLabel, snapshot.sourceIds[0]))}">Open current concept</a>
        <a class="dr-live-button-secondary" href="${escapeHtml(experienceHref("graph-v2.html", node.nodeId, state.currentLabel, snapshot.sourceIds[0]))}">Open sphere</a>
        <a class="dr-live-button-secondary" href="${escapeHtml(experienceHref("sources-v2.html", node.nodeId, state.currentLabel, snapshot.sourceIds[0]))}">Trace sources</a>
        <button class="dr-live-button-secondary" type="button" data-copy-history-link>Copy stable history link</button>
      </div>`;
  }

  function filteredRevisions(items) {
    if (state.statusFilter === "all") return items;
    return items.filter((revision) => statusValue(revision) === state.statusFilter);
  }

  function timelineEntry(revision, scope) {
    const status = statusValue(revision);
    const selected = revision.revisionId === state.selectedRevisionId;
    return `<button class="dr-history-entry" type="button" data-revision-id="${escapeHtml(revision.revisionId)}" data-scope="${escapeHtml(scope)}" data-status="${escapeHtml(status)}" aria-current="${selected ? "true" : "false"}">
      <span class="dr-history-entry-marker" aria-hidden="true"></span>
      <span>
        <h3>${escapeHtml(friendly(revision.revisionType, scope === "concept" ? "concept revision" : "dataset revision"))}</h3>
        <p>${escapeHtml(revision.summary || "A SourceRoot revision record exists for this object.")}</p>
        <span class="dr-history-entry-meta">${statusChip(status)}<span class="dr-live-chip">${escapeHtml(formatDate(revision.createdAt))}</span></span>
      </span>
    </button>`;
  }

  function renderTimeline() {
    const conceptItems = filteredRevisions(state.revisions);
    const bundleItems = filteredRevisions(state.bundleRevisions);
    const conceptMarkup = conceptItems.length
      ? conceptItems.map((item) => timelineEntry(item, "concept")).join("")
      : `<div class="dr-live-empty"><strong>No concept-specific revisions are recorded yet.</strong>The current concept remains traceable, but SourceRoot has not stored a prior version for field-level comparison.</div>`;
    const bundleMarkup = bundleItems.length
      ? bundleItems.map((item) => timelineEntry(item, "dataset")).join("")
      : `<div class="dr-live-empty"><strong>No dataset lineage matched this filter.</strong>Choose All statuses to review the import lineage.</div>`;

    elements.timeline.innerHTML = `
      <p class="dr-history-timeline-group-title">Concept history</p>
      ${conceptMarkup}
      <p class="dr-history-timeline-group-title">Dataset lineage</p>
      ${bundleMarkup}`;
  }

  function selectedRevision() {
    return state.revisions.concat(state.bundleRevisions)
      .find((item) => item.revisionId === state.selectedRevisionId) || null;
  }

  function renderRevisionDetail() {
    const revision = selectedRevision();
    if (!revision) {
      elements.revisionDetail.innerHTML = '<div class="dr-live-empty"><strong>No revision selected.</strong>The current live snapshot is shown on the left. Select a recorded timeline entry for revision detail.</div>';
      return;
    }
    const raw = rawData(revision);
    elements.revisionDetail.innerHTML = `
      <h3 class="dr-history-detail-title">${escapeHtml(friendly(revision.revisionType))}</h3>
      <p class="dr-history-detail-id">${escapeHtml(revision.revisionId)}</p>
      <div class="dr-live-chip-row">${statusChip(statusValue(revision))}<span class="dr-live-chip">${escapeHtml(friendly(revision.objectType))}</span></div>
      <p class="dr-history-detail-summary">${escapeHtml(revision.summary || "No revision summary was recorded.")}</p>
      <div class="dr-history-facts">
        <div class="dr-history-fact"><span>Object</span><strong>${escapeHtml(revision.objectId)}</strong></div>
        <div class="dr-history-fact"><span>Created</span><strong>${escapeHtml(formatDate(revision.createdAt))}</strong></div>
        <div class="dr-history-fact"><span>Updated</span><strong>${escapeHtml(formatDate(revision.updatedAt))}</strong></div>
        <div class="dr-history-fact"><span>Bundle</span><strong>${escapeHtml(revision.bundleId)}</strong></div>
      </div>
      <div class="dr-history-revision-actions">
        <a class="dr-live-button-secondary" href="${escapeHtml(experienceHref("history-v2.html", state.currentNodeId, state.currentLabel, "", revision.revisionId))}">Stable revision URL</a>
      </div>
      <div class="dr-history-raw"><details><summary>Advanced revision record</summary><pre>${escapeHtml(JSON.stringify(raw, null, 2))}</pre></details></div>`;
  }

  function summarizeSnapshot(snapshot, label) {
    const assertions = listFromSnapshot(snapshot, ["assertions"]);
    const edges = listFromSnapshot(snapshot, ["edges", "relationships"]);
    const sources = listFromSnapshot(snapshot, ["sources", "sourceIds"]);
    const node = snapshot && (snapshot.node || snapshot.object || snapshot);
    return `<article class="dr-history-comparison-card">
      <h3>${escapeHtml(label)}</h3>
      <p>${escapeHtml(clean(node && (node.summary || node.description || node.body)) || "No summary was recorded in this snapshot.")}</p>
      <div class="dr-history-current-grid">
        <div><strong>${assertions.length}</strong><span>Assertions</span></div>
        <div><strong>${edges.length}</strong><span>Relationships</span></div>
        <div><strong>${sources.length}</strong><span>Sources</span></div>
        <div><strong>${escapeHtml(clean(node && (node.status || snapshot.status)) || "—")}</strong><span>Status</span></div>
      </div>
    </article>`;
  }

  function renderChangeGroup(label, values, type) {
    if (!values.length) return "";
    return `<section class="dr-history-change-group" data-change="${escapeHtml(type)}"><h4>${escapeHtml(label)} (${values.length})</h4><ul>${values.slice(0, 30).map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></section>`;
  }

  function renderComparison() {
    const revision = selectedRevision();
    if (!revision) {
      elements.comparison.innerHTML = '<div class="dr-live-empty"><strong>No recorded revision selected.</strong>The current live state is available, but comparison requires a revision that contains an explicit historical snapshot.</div>';
      return;
    }

    const historical = snapshotFromRevision(revision);
    if (!historical) {
      elements.comparison.innerHTML = `<div class="dr-live-empty"><strong>No before/after snapshot is stored in this revision.</strong>SourceRoot preserves the revision ID, status, summary, dates, and object identity, but DictionaryRoot will not invent a historical state. Future revisions containing <code>before</code>, <code>after</code>, or <code>snapshot</code> data will compare here automatically.</div>`;
      return;
    }

    const current = currentSnapshot();
    const currentNode = current.node || {};
    const historicalNode = historical.node || historical.object || historical;
    const currentComparable = {
      node: currentNode,
      assertions: current.assertions,
      edges: current.edges,
      sources: current.sources.length ? current.sources : current.sourceIds
    };
    const assertionChanges = compareLists(current.assertions, listFromSnapshot(historical, ["assertions"]));
    const edgeChanges = compareLists(current.edges, listFromSnapshot(historical, ["edges", "relationships"]));
    const sourceChanges = compareLists(current.sources.length ? current.sources : current.sourceIds, listFromSnapshot(historical, ["sources", "sourceIds"]));
    const changedFields = [];
    ["title", "summary", "status"].forEach((key) => {
      if (clean(currentNode[key]) !== clean(historicalNode && historicalNode[key])) changedFields.push(`${friendly(key)} changed`);
    });

    const added = assertionChanges.added.concat(edgeChanges.added, sourceChanges.added);
    const removed = assertionChanges.removed.concat(edgeChanges.removed, sourceChanges.removed);
    const changed = changedFields.concat(assertionChanges.changed, edgeChanges.changed, sourceChanges.changed);

    elements.comparison.innerHTML = `
      <div class="dr-history-comparison-grid">
        ${summarizeSnapshot(historical, `Recorded state — ${formatDate(revision.createdAt)}`)}
        ${summarizeSnapshot(currentComparable, "Current live state")}
      </div>
      <div class="dr-history-change-groups">
        ${renderChangeGroup("Added since this revision", added, "added")}
        ${renderChangeGroup("Removed since this revision", removed, "removed")}
        ${renderChangeGroup("Changed since this revision", changed, "changed")}
        ${!added.length && !removed.length && !changed.length ? '<div class="dr-live-empty"><strong>No differences were detected.</strong>The recorded snapshot matches the current fields available for comparison.</div>' : ""}
      </div>`;
  }

  function revisionSourceIds() {
    const ids = [];
    state.revisions.concat(state.bundleRevisions).forEach((revision) => {
      const raw = rawData(revision);
      [raw.sourceId, raw.sourceIds, raw.sources].forEach((value) => {
        if (Array.isArray(value)) value.forEach((entry) => ids.push(typeof entry === "object" ? sourceId(entry) : clean(entry)));
        else if (value) ids.push(typeof value === "object" ? sourceId(value) : clean(value));
      });
    });
    return Array.from(new Set(ids.filter(Boolean)));
  }

  function renderSources() {
    const concept = state.concept || {};
    const sources = concept.sources || [];
    const linkedByRevision = revisionSourceIds();
    const currentCards = sources.length ? sources.map((source) => {
      const id = sourceId(source);
      return `<article class="dr-history-source-card">
        <strong>${escapeHtml(source.name || source.title || "Recorded source")}</strong>
        <span>${escapeHtml(source.publisher || "Publisher not recorded")}</span>
        <span>${escapeHtml(source.license || "License not recorded")}</span>
        <a href="${escapeHtml(experienceHref("sources-v2.html", state.currentNodeId, state.currentLabel, id))}">Inspect source record</a>
      </article>`;
    }).join("") : '<div class="dr-live-empty"><strong>No current source detail was returned.</strong>The concept may still contain source IDs in its assertions.</div>';
    const revisionNote = linkedByRevision.length
      ? `<article class="dr-history-source-card"><strong>Revision-linked source IDs</strong><span>${escapeHtml(linkedByRevision.join(", "))}</span></article>`
      : '<article class="dr-history-source-card"><strong>No separate revision source references</strong><span>The current sources remain traceable, but the recorded revision objects do not add separate source IDs.</span></article>';
    elements.sources.innerHTML = `<div class="dr-history-source-list">${currentCards}${revisionNote}</div>`;
  }

  function selectRevision(revisionId, options) {
    const settings = Object.assign({ history: "push", scroll: false }, options || {});
    state.selectedRevisionId = clean(revisionId);
    renderTimeline();
    renderRevisionDetail();
    renderComparison();
    if (settings.history) updateUrl({ revision: state.selectedRevisionId }, settings.history);
    if (settings.scroll) elements.revisionDetail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadHistory(nodeId, label, options) {
    const settings = Object.assign({ history: "push", scroll: true, revisionId: "" }, options || {});
    if (!nodeId) return;
    state.currentNodeId = clean(nodeId);
    state.currentLabel = clean(label);
    elements.input.value = state.currentLabel;
    setStatus("Loading current knowledge and revision records...", "loading");
    elements.currentSnapshot.innerHTML = '<div class="dr-live-empty"><strong>Loading current live state...</strong>Retrieving the concept, assertions, relationships, sources, and revision registry.</div>';
    elements.timeline.innerHTML = '<div class="dr-live-empty"><strong>Loading revision timeline...</strong>No fallback history is being used.</div>';

    try {
      const [concept, conceptRevisions, bundleRevisions] = await Promise.all([
        state.client.concept(nodeId),
        state.client.listAll("revisions", { objectType: "node", objectId: nodeId }, { limit: 100, maxPages: 20 }),
        state.client.listAll("revisions", { objectType: "import-bundle", objectId: state.manifest.bundleId }, { limit: 100, maxPages: 20 })
      ]);
      state.concept = concept;
      state.currentLabel = clean(label || concept.node.title);
      state.revisions = conceptRevisions.items || [];
      state.bundleRevisions = bundleRevisions.items || [];
      state.selectedRevisionId = clean(settings.revisionId);
      if (state.selectedRevisionId && !selectedRevision()) state.selectedRevisionId = "";

      renderCurrentSnapshot();
      renderTimeline();
      renderRevisionDetail();
      renderComparison();
      renderSources();
      document.title = `${state.currentLabel} history — DictionaryRoot`;
      setStatus(`Loaded current state and ${state.revisions.length + state.bundleRevisions.length} recorded revision${state.revisions.length + state.bundleRevisions.length === 1 ? "" : "s"} from SourceRoot.`, "success");
      if (settings.history) updateUrl({ q: state.currentLabel, nodeId, revision: state.selectedRevisionId, status: state.statusFilter === "all" ? "" : state.statusFilter }, settings.history);
      if (settings.scroll) elements.workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      elements.currentSnapshot.innerHTML = '<div class="dr-live-empty"><strong>DictionaryRoot could not reach its knowledge service.</strong>Start the SourceRoot backend and retry. No current or historical fallback data was used.</div>';
      elements.timeline.innerHTML = '<div class="dr-live-empty"><strong>Revision registry unavailable.</strong>No records were substituted.</div>';
      elements.revisionDetail.innerHTML = '<div class="dr-live-empty"><strong>Revision detail unavailable.</strong>No customer records were changed.</div>';
      elements.comparison.innerHTML = '<div class="dr-live-empty"><strong>Comparison unavailable.</strong>A live current state and recorded historical snapshot are both required.</div>';
      elements.sources.innerHTML = '<div class="dr-live-empty"><strong>Source history unavailable.</strong>No fallback attribution was used.</div>';
      setStatus(error && error.message ? error.message : "History load failed.", "error");
    }
  }

  function bindEvents() {
    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      search(elements.input.value, { history: "push", scroll: true });
    });

    elements.statusFilter.addEventListener("change", () => {
      state.statusFilter = elements.statusFilter.value || "all";
      renderTimeline();
      updateUrl({ status: state.statusFilter === "all" ? "" : state.statusFilter }, "push");
    });

    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-open-history]");
      if (open) {
        await loadHistory(open.dataset.openHistory, open.dataset.historyLabel || "", { history: "push", scroll: true, revisionId: "" });
        return;
      }
      const revision = event.target.closest("[data-revision-id]");
      if (revision) {
        selectRevision(revision.dataset.revisionId, { history: "push", scroll: true });
        return;
      }
      const copy = event.target.closest("[data-copy-history-link]");
      if (copy) {
        try {
          await navigator.clipboard.writeText(global.location.href);
          const original = copy.textContent;
          copy.textContent = "Link copied";
          setTimeout(() => { copy.textContent = original; }, 1600);
        } catch (_) {
          setStatus("Copy was unavailable. Use the address bar to copy this history URL.", "error");
        }
      }
    });

    global.addEventListener("popstate", async () => {
      state.navigatingHistory = true;
      try {
        const params = new URLSearchParams(global.location.search);
        const query = params.get("q") || state.manifest.defaults.searchTerm || "knowledge";
        const nodeId = params.get("nodeId");
        const revisionId = params.get("revision") || "";
        state.statusFilter = params.get("status") || "all";
        elements.statusFilter.value = state.statusFilter;
        if (nodeId) await loadHistory(nodeId, query, { history: null, scroll: false, revisionId });
        else await search(query, { history: null, scroll: false });
      } finally {
        state.navigatingHistory = false;
      }
    });
  }

  async function init() {
    Object.assign(elements, {
      form: byId("dictionaryrootHistorySearchForm"),
      input: byId("dictionaryrootHistorySearchInput"),
      searchButton: byId("dictionaryrootHistorySearchButton"),
      status: byId("dictionaryrootHistoryStatus"),
      sensePanel: byId("dictionaryrootHistorySenseChooser"),
      senseCount: byId("dictionaryrootHistorySenseCount"),
      results: byId("dictionaryrootHistorySearchResults"),
      workspace: byId("dictionaryrootHistoryWorkspace"),
      conceptTitle: byId("dictionaryrootHistoryConceptTitle"),
      currentStatus: byId("dictionaryrootHistoryCurrentStatus"),
      currentSnapshot: byId("dictionaryrootHistoryCurrentSnapshot"),
      statusFilter: byId("dictionaryrootHistoryStatusFilter"),
      timeline: byId("dictionaryrootHistoryTimeline"),
      revisionDetail: byId("dictionaryrootHistoryRevisionDetail"),
      comparison: byId("dictionaryrootHistoryComparison"),
      sources: byId("dictionaryrootHistorySources")
    });

    state.manifest = await DictionaryRootApi.loadManifest();
    state.client = new DictionaryRootApi.DictionaryRootApiClient(state.manifest);
    bindEvents();

    const params = new URLSearchParams(global.location.search);
    const query = params.get("q") || state.manifest.defaults.searchTerm || "knowledge";
    const nodeId = params.get("nodeId");
    const revisionId = params.get("revision") || "";
    state.statusFilter = params.get("status") || "all";
    elements.statusFilter.value = state.statusFilter;
    elements.input.value = query;

    if (nodeId) await loadHistory(nodeId, query, { history: "replace", scroll: false, revisionId });
    else await search(query, { history: "replace", scroll: false });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
