(function dictionaryRootCoverageExperience(global) {
  "use strict";

  const DEFAULT_FILTERS = {
    q: "",
    pos: "all",
    coverage: "all",
    sourceCoverage: "all",
    historyCoverage: "all",
    review: "all",
    coverageSort: "gaps",
    page: 1
  };

  const state = {
    manifest: null,
    client: null,
    dashboard: null,
    filters: Object.assign({}, DEFAULT_FILTERS),
    requestToken: 0,
    navigatingHistory: false
  };
  const elements = {};

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat().format(number) : "—";
  }

  function formatPercent(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toFixed(number % 1 ? 1 : 0)}%` : "—";
  }

  function formatDate(value) {
    if (!value) return "Update time unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return clean(value);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function percentage(numerator, denominator) {
    const total = Number(denominator);
    const value = Number(numerator);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, (value / total) * 100));
  }

  async function ensureClient() {
    if (state.client) return state.client;
    if (!global.DictionaryRootApi) throw new Error("DictionaryRoot API client is not loaded.");
    state.manifest = await global.DictionaryRootApi.loadManifest();
    state.client = new global.DictionaryRootApi.DictionaryRootApiClient(state.manifest);
    return state.client;
  }

  function setServiceState(label, value) {
    elements.serviceState.textContent = label;
    elements.serviceState.dataset.state = value;
  }

  function setStatus(message, tone) {
    elements.status.textContent = message || "";
    elements.status.dataset.state = tone || "";
  }

  function navHref(file, lemma, nodeId) {
    if (global.DictionaryRootNavigation && typeof global.DictionaryRootNavigation.buildHref === "function") {
      return global.DictionaryRootNavigation.buildHref(file, {
        meaning: lemma,
        nodeId: nodeId || "",
        preserveSourceFilters: false,
        preserveCoverageFilters: false
      });
    }
    const params = new URLSearchParams();
    if (file === "sources-v2.html") params.set("meaning", lemma);
    else params.set("q", lemma);
    if (nodeId) params.set("nodeId", nodeId);
    return `${file}?${params.toString()}`;
  }

  function metric(label, value, note, tone, attributes) {
    const actionable = Boolean(attributes);
    const tag = actionable ? "button" : "article";
    return `<${tag} class="dr-coverage-metric" data-tone="${escapeHtml(tone || "")}"${actionable ? ` type="button" ${attributes}` : ""}>
      <strong>${escapeHtml(formatNumber(value))}</strong>
      <span>${escapeHtml(label)}</span>
      <small>${escapeHtml(note)}</small>
      ${actionable ? '<em>Filter lemma explorer →</em>' : ''}
    </${tag}>`;
  }

  function renderMetrics(data) {
    elements.metrics.innerHTML = [
      metric("Complete meanings", data.synsetCount, `${formatNumber(data.lemmaCount)} unique lemmas in the live lexical index.`, "accent", 'data-coverage-filter="all"'),
      metric("Graph-covered meanings", data.graphCoveredSenseCount, `${formatPercent(data.graphCoveragePercent)} of all exact meanings are in the bounded graph.`, "good", 'data-coverage-filter="complete"'),
      metric("Lexical-only meanings", data.lexicalOnlySenseCount, "Searchable through complete lexical coverage and loaded into the Sphere on demand.", "warn", 'data-coverage-filter="lexical-only"'),
      metric("Source-backed meanings", data.sourceBackedSenseCount, `${formatPercent(data.sourceCoveragePercent)} resolve to a SourceRoot source identity.`, "good", 'data-source-filter="source-backed"'),
      metric("Reviewed graph meanings", data.reviewedSenseCount, `${formatNumber(data.reviewRequiredSenseCount)} graph meanings still need a reviewed assertion.`, data.reviewRequiredSenseCount ? "warn" : "good", 'data-review-filter="reviewed"'),
      metric("Meanings with concept history", data.conceptRevisionCoveredSenseCount, `${formatNumber(data.datasetRevisionCount)} dataset-lineage record${Number(data.datasetRevisionCount) === 1 ? "" : "s"} exist separately and are not counted as concept history.`, "accent", 'data-history-filter="with-history"')
    ].join("");
  }

  function bar(label, value, total, note) {
    const percent = percentage(value, total);
    return `<div class="dr-coverage-bar-row">
      <div class="dr-coverage-bar-label"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(formatNumber(value))} / ${escapeHtml(formatNumber(total))} · ${escapeHtml(formatPercent(percent))}</span></div>
      <div class="dr-coverage-track" aria-label="${escapeHtml(label)} ${escapeHtml(formatPercent(percent))}"><span style="width:${percent.toFixed(1)}%"></span></div>
      <p class="dr-coverage-bar-note">${escapeHtml(note)}</p>
    </div>`;
  }

  function renderBars(data) {
    elements.bars.innerHTML = [
      bar("Lexical index", data.synsetCount, data.synsetCount, "Every imported Open English WordNet meaning remains available to exact search."),
      bar("Bounded graph integration", data.graphCoveredSenseCount, data.synsetCount, "Graph-covered meanings are persisted in the pilot bundle; lexical-only meanings resolve on demand."),
      bar("Source registry coverage", data.sourceBackedSenseCount, data.synsetCount, "A source-backed meaning has a matching SourceRoot source identity, not merely a label in the interface."),
      bar("Reviewed graph assertions", data.reviewedSenseCount, data.graphCoveredSenseCount, "Review coverage is measured only against meanings already persisted in the graph."),
      bar("Concept-specific revision history", data.conceptRevisionCoveredSenseCount, data.synsetCount, "Dataset revisions are counted separately and do not pretend to be a concept-specific historical snapshot.")
    ].join("");
  }

  function queueCard(value, label, note, attributes) {
    const actionable = Boolean(attributes);
    const tag = actionable ? "button" : "article";
    return `<${tag} class="dr-coverage-queue-card"${actionable ? ` type="button" ${attributes}` : ""}>
      <strong>${escapeHtml(formatNumber(value))}</strong>
      <span>${escapeHtml(label)}</span>
      <small>${escapeHtml(note)}</small>
    </${tag}>`;
  }

  function renderQueue(data) {
    elements.queue.innerHTML = [
      queueCard(data.lexicalOnlySenseCount, "Lexical-only meanings", "Available in complete search but not yet integrated into the bounded graph.", 'data-coverage-filter="lexical-only"'),
      queueCard(data.assertionGapSenseCount, "Graph assertion gaps", "Graph meanings without a persisted assertion record.", 'data-review-filter="needs-review"'),
      queueCard(data.reviewRequiredSenseCount, "Needs graph review", "Graph meanings without at least one reviewed assertion.", 'data-review-filter="needs-review"'),
      queueCard(data.unsupportedSenseCount, "Source registry gaps", "Meanings whose lexical source ID does not resolve to a SourceRoot source record.", 'data-source-filter="unsupported"'),
      queueCard(data.conceptRevisionGapSenseCount, "No concept revision", "Meanings without a node-specific revision record. Dataset history remains separate.", 'data-history-filter="no-history"'),
      queueCard(data.datasetRevisionCount, "Dataset revisions", "Import-level history recorded for the current DictionaryRoot bundle.", "")
    ].join("");
  }

  function renderPartOfSpeech(data) {
    const rows = Array.isArray(data.partOfSpeech) ? data.partOfSpeech : [];
    if (!rows.length) {
      elements.pos.innerHTML = '<div class="dr-live-empty"><strong>No part-of-speech coverage was returned.</strong>The live lexical registry may not be imported.</div>';
      return;
    }
    elements.pos.innerHTML = `<table class="dr-coverage-pos-table">
      <thead><tr><th>Part of speech</th><th>Meanings</th><th>Graph</th><th>Lexical-only</th><th>Source-backed</th><th>Reviewed</th><th>Concept revisions</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td><strong>${escapeHtml(row.partOfSpeech)}</strong></td>
        <td>${escapeHtml(formatNumber(row.senseCount))}</td>
        <td>${escapeHtml(formatNumber(row.graphCoveredSenseCount))}</td>
        <td>${escapeHtml(formatNumber(row.lexicalOnlySenseCount))}</td>
        <td>${escapeHtml(formatNumber(row.sourceBackedSenseCount))}</td>
        <td>${escapeHtml(formatNumber(row.reviewedSenseCount))}</td>
        <td>${escapeHtml(formatNumber(row.conceptRevisionCoveredSenseCount))}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  }

  function renderDashboardOffline(message) {
    const offline = `<div class="dr-coverage-offline"><strong>Coverage diagnostics are offline.</strong>${escapeHtml(message || "Start SourceRoot and retry. No fallback coverage data was used.")}</div>`;
    elements.metrics.innerHTML = offline;
    elements.bars.innerHTML = offline;
    elements.queue.innerHTML = offline;
    elements.pos.innerHTML = offline;
    setServiceState("SourceRoot offline", "error");
    elements.dataset.textContent = "Live dataset unavailable";
    elements.updated.textContent = "No fallback counts are displayed or substituted.";
  }

  async function loadLegacyDashboard() {
    try {
      const client = await ensureClient();
      setServiceState("Loading live coverage", "loading");
      const response = await client.request(`/dictionaryroot/lexicon/dashboard${global.DictionaryRootApi.buildQuery({ bundleId: state.manifest.bundleId })}`);
      const data = response.data || {};
      if (!data.available) {
        renderDashboardOffline("The complete lexical index has not been imported for this bundle.");
        return;
      }
      state.dashboard = data;
      renderMetrics(data);
      renderBars(data);
      renderQueue(data);
      renderPartOfSpeech(data);
      setServiceState("SourceRoot connected", "connected");
      elements.dataset.textContent = `${data.sourceName || "Open English WordNet"} ${data.sourceVersion || ""}`.trim();
      elements.updated.textContent = `Coverage calculated from the live registry · updated ${formatDate(data.updatedAt || data.importedAt)}`;
    } catch (error) {
      renderDashboardOffline(error && error.message ? error.message : "DictionaryRoot could not reach SourceRoot.");
    }
  }

  function renderCoverageUnavailable(message) {
    const unavailable = `<div class="dr-coverage-offline"><strong>Coverage endpoint unavailable.</strong>${escapeHtml(message || "SourceRoot is healthy, but production lexical coverage could not be calculated.")}</div>`;
    elements.metrics.innerHTML = unavailable;
    elements.bars.innerHTML = unavailable;
    elements.queue.innerHTML = unavailable;
    elements.pos.innerHTML = unavailable;
    setServiceState("Coverage unavailable", "error");
    elements.dataset.textContent = "SourceRoot connected";
    elements.updated.textContent = "No fallback or substituted metrics are displayed.";
  }

  function renderAwaitingCorpus(data) {
    const awaiting = `<div class="dr-live-empty"><strong>Awaiting production lexical corpus.</strong>${escapeHtml(data.message || "SourceRoot is healthy; no production dataset is installed.")}</div>`;
    elements.metrics.innerHTML = awaiting;
    elements.bars.innerHTML = awaiting;
    elements.queue.innerHTML = awaiting;
    elements.pos.innerHTML = awaiting;
    setServiceState("SourceRoot connected", "connected");
    elements.dataset.textContent = "No production lexical dataset installed";
    elements.updated.textContent = "Coverage endpoint responded successfully; no fallback counts are displayed.";
  }

  function renderProductionMetrics(data) {
    elements.metrics.innerHTML = [
      metric("Canonical lemmas", data.lemmaCount, `${formatNumber(data.definitionClaimCount)} source-attributed claims.`, "accent"),
      metric("Lexical senses", data.senseCount, `${formatNumber(data.historicalOrObsoleteSenseCount)} historical or obsolete.`, "good"),
      metric("Accepted sources", data.sourceCount, `${formatPercent(data.publicDomainSharePercent)} public-domain share.`, "good"),
      metric("Lexical relationships", data.lexicalRelationshipCount, `${formatNumber(data.relationshipEvidenceCount)} inspectable evidence records.`, "accent"),
      metric("Forms", data.formCount, `${formatPercent(data.formCoveragePercent)} form coverage.`, "good"),
      metric("Etymologies & comparisons", Number(data.etymologyCount) + Number(data.sourceComparisonCount), `${formatNumber(data.uncertaintyBearingStructureCount)} uncertainty-bearing structures remain explicit.`, "warn")
    ].join("");
    elements.bars.innerHTML = [
      bar("Multi-source senses", data.multiSourceSenseCount, data.senseCount, "Multiple source statements remain separate."),
      bar("Forms", data.formCount, data.lemmaCount, "Historical, alternate, inflected, or derived forms."),
      bar("Etymology", data.etymologyCount, data.lemmaCount, "Qualified language-origin structures."),
      bar("Relationships", data.lexicalRelationshipCount, data.senseCount, "Canonical migration 014 sense relationships."),
      bar("Comparisons", data.sourceComparisonCount, data.senseCount, "Reviewed or explicitly unresolved source comparisons.")
    ].join("");
    elements.queue.innerHTML = [
      queueCard(data.unresolvedSenseBoundaryCount, "Unresolved sense boundaries", "Preserved for review; never converted into certainty."),
      queueCard(data.unresolvedChronologyCount, "Unresolved chronology", "No invented first-use dates are supplied."),
      queueCard(data.unresolvedOriginCount, "Unresolved origins", "Competing or incomplete origin work remains visible."),
      queueCard(data.singleSourceSenseCount, "Single-source senses", "Source concentration remains explicit."),
      queueCard(data.singleLineageSenseCount, "Single-lineage senses", "Related editions do not masquerade as independent corroboration."),
      queueCard(data.missingComparisonCount, "Missing comparisons", "Senses without a reviewed comparison structure.")
    ].join("");
    const distribution = data.partOfSpeechDistribution || {};
    elements.pos.innerHTML = `<table class="dr-coverage-pos-table">
      <thead><tr><th>Part of speech</th><th>Production senses</th></tr></thead>
      <tbody>${Object.entries(distribution).map(([partOfSpeech, count]) => `<tr><td><strong>${escapeHtml(partOfSpeech)}</strong></td><td>${escapeHtml(formatNumber(count))}</td></tr>`).join("")}</tbody>
    </table>`;
  }

  async function loadDashboard() {
    let client;
    try {
      client = await ensureClient();
      setServiceState("Loading live coverage", "loading");
      const response = await client.lexicalEvidenceCoverage();
      const data = response.data || {};
      if (!data.productionDatasetAvailable) {
        renderAwaitingCorpus(data);
        return;
      }
      state.dashboard = data;
      renderProductionMetrics(data);
      setServiceState("SourceRoot connected", "connected");
      elements.dataset.textContent = `${data.datasetId} ${data.datasetVersion}`;
      elements.updated.textContent = "Coverage calculated directly from canonical migrations 013 and 014.";
    } catch (error) {
      try {
        if (client) {
          await client.health();
          renderCoverageUnavailable(error && error.message ? error.message : "The production coverage calculation failed.");
          return;
        }
      } catch (_) {
        // Health also failed, so the backend-unavailable state is accurate.
      }
      renderDashboardOffline(error && error.message ? error.message : "DictionaryRoot could not reach SourceRoot.");
    }
  }

  function readFiltersFromUrl() {
    const params = new URL(global.location.href).searchParams;
    const page = Number(params.get("page") || 1);
    return {
      q: clean(params.get("q")),
      pos: clean(params.get("pos")) || "all",
      coverage: clean(params.get("coverage")) || "all",
      sourceCoverage: clean(params.get("sourceCoverage")) || "all",
      historyCoverage: clean(params.get("historyCoverage")) || "all",
      review: clean(params.get("review")) || "all",
      coverageSort: clean(params.get("coverageSort")) || "gaps",
      page: Number.isInteger(page) && page > 0 ? page : 1
    };
  }

  function writeFiltersToControls() {
    elements.search.value = state.filters.q;
    elements.posFilter.value = state.filters.pos;
    elements.graphFilter.value = state.filters.coverage;
    elements.sourceFilter.value = state.filters.sourceCoverage;
    elements.historyFilter.value = state.filters.historyCoverage;
    elements.reviewFilter.value = state.filters.review;
    elements.sort.value = state.filters.coverageSort;
  }

  function readFiltersFromControls() {
    return {
      q: clean(elements.search.value),
      pos: elements.posFilter.value || "all",
      coverage: elements.graphFilter.value || "all",
      sourceCoverage: elements.sourceFilter.value || "all",
      historyCoverage: elements.historyFilter.value || "all",
      review: elements.reviewFilter.value || "all",
      coverageSort: elements.sort.value || "gaps",
      page: 1
    };
  }

  function updateUrl(mode) {
    const url = new URL(global.location.href);
    const params = url.searchParams;
    const values = state.filters;
    const entries = {
      q: values.q,
      pos: values.pos === "all" ? "" : values.pos,
      coverage: values.coverage === "all" ? "" : values.coverage,
      sourceCoverage: values.sourceCoverage === "all" ? "" : values.sourceCoverage,
      historyCoverage: values.historyCoverage === "all" ? "" : values.historyCoverage,
      review: values.review === "all" ? "" : values.review,
      coverageSort: values.coverageSort === "gaps" ? "" : values.coverageSort,
      page: values.page > 1 ? String(values.page) : ""
    };
    Object.keys(entries).forEach((key) => {
      if (entries[key]) params.set(key, entries[key]);
      else params.delete(key);
    });
    global.history[mode === "replace" ? "replaceState" : "pushState"]({}, "", url);
    document.dispatchEvent(new CustomEvent("dictionaryroot:urlchange"));
  }

  function posChips(counts) {
    return Object.entries(counts || {})
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([label, count]) => `<span class="dr-live-chip">${escapeHtml(label)} · ${escapeHtml(formatNumber(count))}</span>`)
      .join("");
  }

  function resultCard(item) {
    const nodeId = item.lexicalOnlyNodeId || item.graphNodeId || item.representativeNodeId;
    const graphTone = Number(item.lexicalOnlySenseCount) === 0 ? "good" : "";
    const sourceTone = Number(item.unsupportedSenseCount) === 0 ? "good" : "";
    return `<article class="dr-coverage-result">
      <div>
        <h3>${escapeHtml(item.lemma)}</h3>
        <div class="dr-coverage-result-meta">
          ${posChips(item.partOfSpeechCounts)}
          <span class="dr-live-chip" data-tone="${graphTone}">${Number(item.lexicalOnlySenseCount) === 0 ? "Graph complete" : `${formatNumber(item.lexicalOnlySenseCount)} lexical-only`}</span>
          <span class="dr-live-chip" data-tone="${sourceTone}">${Number(item.unsupportedSenseCount) === 0 ? "Source-backed" : `${formatNumber(item.unsupportedSenseCount)} source gap${Number(item.unsupportedSenseCount) === 1 ? "" : "s"}`}</span>
        </div>
      </div>
      <div class="dr-coverage-result-counts">
        <div class="dr-coverage-mini-stat"><strong>${escapeHtml(formatNumber(item.exactSenseCount))}</strong><span>exact senses</span></div>
        <div class="dr-coverage-mini-stat"><strong>${escapeHtml(formatNumber(item.graphSenseCount))}</strong><span>graph senses</span></div>
        <div class="dr-coverage-mini-stat"><strong>${escapeHtml(formatPercent(item.graphCoveragePercent))}</strong><span>graph coverage</span></div>
        <div class="dr-coverage-mini-stat"><strong>${escapeHtml(formatNumber(item.conceptRevisionSenseCount))}</strong><span>senses with concept history</span></div>
      </div>
      <div class="dr-coverage-result-actions">
        <a href="${escapeHtml(navHref("concept-v2.html", item.lemma, nodeId))}">Concept</a>
        <a href="${escapeHtml(navHref("graph-v2.html", item.lemma, nodeId))}">Sphere</a>
        <a href="${escapeHtml(navHref("sources-v2.html", item.lemma, nodeId))}">Sources</a>
        <a href="${escapeHtml(navHref("history-v2.html", item.lemma, nodeId))}">History</a>
        <a href="${escapeHtml(navHref("editorial-v2.html", item.lemma, nodeId))}">Review</a>
      </div>
    </article>`;
  }

  function renderResults(payload) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    elements.resultCount.textContent = `${formatNumber(payload.total)} lemma${Number(payload.total) === 1 ? "" : "s"}`;
    elements.pageLabel.textContent = payload.totalPages
      ? `Page ${formatNumber(payload.page)} of ${formatNumber(payload.totalPages)}`
      : "No pages";
    elements.previous.disabled = payload.page <= 1;
    elements.next.disabled = payload.totalPages === 0 || payload.page >= payload.totalPages;
    if (!items.length) {
      elements.results.innerHTML = '<div class="dr-live-empty"><strong>No lemmas match these live filters.</strong>Change a coverage filter or search term. No fallback results were used.</div>';
      return;
    }
    elements.results.innerHTML = items.map(resultCard).join("");
  }

  function renderResultsOffline(message) {
    elements.resultCount.textContent = "Unavailable";
    elements.results.innerHTML = `<div class="dr-coverage-offline"><strong>Lemma coverage is offline.</strong>${escapeHtml(message || "Start SourceRoot and retry. No fallback records were used.")}</div>`;
    elements.pageLabel.textContent = "Page unavailable";
    elements.previous.disabled = true;
    elements.next.disabled = true;
  }

  async function loadLemmaCoverage(options) {
    const settings = Object.assign({ history: null, scroll: false }, options || {});
    const token = ++state.requestToken;
    writeFiltersToControls();
    setStatus("Loading live lemma coverage…", "loading");
    elements.results.innerHTML = '<div class="dr-live-empty"><strong>Calculating coverage by lemma…</strong>The database is comparing complete lexical senses with graph, source, review, and revision records.</div>';
    try {
      const client = await ensureClient();
      const response = await client.request(`/dictionaryroot/lexicon/lemmas${global.DictionaryRootApi.buildQuery({
        bundleId: state.manifest.bundleId,
        q: state.filters.q,
        partOfSpeech: state.filters.pos === "all" ? "" : state.filters.pos,
        coverage: state.filters.coverage,
        source: state.filters.sourceCoverage,
        history: state.filters.historyCoverage,
        review: state.filters.review,
        sort: state.filters.coverageSort,
        page: state.filters.page,
        limit: 25
      })}`);
      if (token !== state.requestToken) return;
      if (!response.data || response.data.available !== true) {
        renderResultsOffline("The complete lexical index is not available for this bundle.");
        setStatus("Complete lexical coverage is unavailable.", "error");
        return;
      }
      renderResults(response.data);
      setStatus(`Loaded ${formatNumber(response.data.items.length)} live row${response.data.items.length === 1 ? "" : "s"}. No fallback records were used.`, "success");
      if (settings.history) updateUrl(settings.history);
      if (settings.scroll) elements.explorer.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (token !== state.requestToken) return;
      renderResultsOffline(error && error.message ? error.message : "DictionaryRoot could not reach SourceRoot.");
      setStatus(error && error.message ? error.message : "Coverage query failed.", "error");
      if (settings.history) updateUrl(settings.history);
    }
  }

  function applyQuickFilter(button) {
    state.filters = Object.assign({}, state.filters, {
      coverage: button.dataset.coverageFilter || state.filters.coverage,
      sourceCoverage: button.dataset.sourceFilter || state.filters.sourceCoverage,
      historyCoverage: button.dataset.historyFilter || state.filters.historyCoverage,
      review: button.dataset.reviewFilter || state.filters.review,
      page: 1
    });
    loadLemmaCoverage({ history: "push", scroll: true });
  }

  function bindEvents() {
    elements.refresh.addEventListener("click", () => {
      loadDashboard();
      loadLemmaCoverage({ history: null, scroll: false });
    });

    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      state.filters = readFiltersFromControls();
      loadLemmaCoverage({ history: "push", scroll: true });
    });

    elements.previous.addEventListener("click", () => {
      if (state.filters.page <= 1) return;
      state.filters.page -= 1;
      loadLemmaCoverage({ history: "push", scroll: true });
    });

    elements.next.addEventListener("click", () => {
      state.filters.page += 1;
      loadLemmaCoverage({ history: "push", scroll: true });
    });

    const handleQuickFilter = (event) => {
      const button = event.target.closest("button[data-coverage-filter], button[data-source-filter], button[data-history-filter], button[data-review-filter]");
      if (button) applyQuickFilter(button);
    };
    elements.metrics.addEventListener("click", handleQuickFilter);
    elements.queue.addEventListener("click", handleQuickFilter);

    global.addEventListener("popstate", () => {
      state.navigatingHistory = true;
      state.filters = readFiltersFromUrl();
      loadLemmaCoverage({ history: null, scroll: false }).finally(() => {
        state.navigatingHistory = false;
      });
    });
  }

  function cacheElements() {
    const byId = (id) => document.getElementById(id);
    elements.serviceState = byId("dictionaryrootCoverageServiceState");
    elements.dataset = byId("dictionaryrootCoverageDataset");
    elements.updated = byId("dictionaryrootCoverageUpdated");
    elements.refresh = byId("dictionaryrootCoverageRefresh");
    elements.metrics = byId("dictionaryrootCoverageMetrics");
    elements.bars = byId("dictionaryrootCoverageBars");
    elements.queue = byId("dictionaryrootCoverageQueue");
    elements.pos = byId("dictionaryrootCoveragePos");
    elements.explorer = document.querySelector(".dr-coverage-explorer");
    elements.form = byId("dictionaryrootCoverageFilterForm");
    elements.search = byId("dictionaryrootCoverageSearch");
    elements.posFilter = byId("dictionaryrootCoveragePosFilter");
    elements.graphFilter = byId("dictionaryrootCoverageGraphFilter");
    elements.sourceFilter = byId("dictionaryrootCoverageSourceFilter");
    elements.reviewFilter = byId("dictionaryrootCoverageReviewFilter");
    elements.historyFilter = byId("dictionaryrootCoverageHistoryFilter");
    elements.sort = byId("dictionaryrootCoverageSort");
    elements.status = byId("dictionaryrootCoverageStatus");
    elements.resultCount = byId("dictionaryrootCoverageResultCount");
    elements.results = byId("dictionaryrootCoverageResults");
    elements.previous = byId("dictionaryrootCoveragePrevious");
    elements.next = byId("dictionaryrootCoverageNext");
    elements.pageLabel = byId("dictionaryrootCoveragePageLabel");
  }

  async function init() {
    cacheElements();
    state.filters = readFiltersFromUrl();
    writeFiltersToControls();
    bindEvents();
    await Promise.all([
      loadDashboard(),
      loadLemmaCoverage({ history: "replace", scroll: false })
    ]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
