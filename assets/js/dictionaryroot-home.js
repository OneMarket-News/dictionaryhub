(function dictionaryRootHome(global) {
  "use strict";

  const RECENT_KEY = "dictionaryroot.recentSearches.v1";
  const state = {
    manifest: null,
    client: null,
    searchToken: 0,
    valueToken: 0,
    lastQuery: "",
    resultPayload: null,
    resultPage: 1
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
    if (!value) return "update time unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return clean(value);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    }).format(date);
  }

  function metadata(record) {
    return record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  }

  function nodeId(record) {
    return clean(record && (record.id || record.nodeId));
  }

  function firstSourceId(record) {
    const values = [];
    if (record && Array.isArray(record.sourceIds)) values.push.apply(values, record.sourceIds);
    if (record && record.sourceId) values.push(record.sourceId);
    return clean(values.find(Boolean));
  }

  function partOfSpeech(record) {
    const data = metadata(record);
    return clean(data.partOfSpeech || data.pos || record.objectType || record.nodeType) || "concept";
  }

  function summary(record) {
    return clean(record && (record.summary || record.description || record.body)) || "Open this meaning to inspect its source-backed definition and connected context.";
  }

  function navHref(file, overrides) {
    if (global.DictionaryRootNavigation && typeof global.DictionaryRootNavigation.buildHref === "function") {
      return global.DictionaryRootNavigation.buildHref(file, overrides || {});
    }
    const params = new URLSearchParams();
    const options = overrides || {};
    if (options.meaning) params.set(file === "sources-v2.html" ? "meaning" : "q", options.meaning);
    if (options.nodeId) params.set("nodeId", options.nodeId);
    if (options.sourceId) params.set("source", options.sourceId);
    const query = params.toString();
    return `${file}${query ? `?${query}` : ""}`;
  }

  async function ensureClient() {
    if (state.client) return state.client;
    if (!global.DictionaryRootApi) throw new Error("DictionaryRoot API client is not loaded.");
    state.manifest = await global.DictionaryRootApi.loadManifest();
    state.client = new global.DictionaryRootApi.DictionaryRootApiClient(state.manifest);
    return state.client;
  }

  function setSearchStatus(message, tone) {
    elements.status.textContent = message || "";
    elements.status.dataset.state = tone || "";
  }

  function setSearchBusy(busy) {
    elements.button.disabled = Boolean(busy);
    elements.button.textContent = busy ? "Searching…" : "Explore meanings";
    elements.input.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function setServiceState(label, value) {
    elements.serviceState.textContent = label;
    elements.serviceState.dataset.state = value;
  }

  function readRecent() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map(clean).filter(Boolean).slice(0, 8) : [];
    } catch (_) {
      return [];
    }
  }

  function writeRecent(term) {
    const query = clean(term);
    if (!query) return;
    const next = [query].concat(readRecent().filter((item) => item.toLowerCase() !== query.toLowerCase())).slice(0, 8);
    try { global.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch (_) { /* Storage is optional. */ }
    renderRecent();
  }

  function renderRecent() {
    const items = readRecent();
    if (!items.length) {
      elements.recents.innerHTML = "<p>No recent searches yet. Search a word above to begin.</p>";
      return;
    }
    elements.recents.innerHTML = items.map((item) => `<button type="button" data-dr-recent="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("");
  }

  function updateUrl(term, mode) {
    const url = new URL(global.location.href);
    const query = clean(term);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    url.searchParams.delete("nodeId");
    const method = mode === "replace" ? "replaceState" : "pushState";
    global.history[method]({ dictionaryRootHome: true, q: query }, "", url);
  }

  function resultLinks(record, query, label) {
    const id = nodeId(record);
    const sourceId = firstSourceId(record);
    const context = { meaning: label || query, nodeId: id, sourceId };
    if (metadata(record).lexicalEvidence === true) {
      return `<div class="dr-home-result-actions">
        <a href="${escapeHtml(navHref("concept-v2.html", context))}">Inspect lexical evidence</a>
      </div>`;
    }
    return `<div class="dr-home-result-actions">
      <a href="${escapeHtml(navHref("concept-v2.html", context))}">Open concept</a>
      <a href="${escapeHtml(navHref("graph-v2.html", context))}">Open sphere</a>
      <a href="${escapeHtml(navHref("sources-v2.html", context))}">Trace sources</a>
      <a href="${escapeHtml(navHref("history-v2.html", context))}">View history</a>
    </div>`;
  }

  function lexicalEvidenceSearchNodes(payload) {
    return global.DictionaryRootApi.extractItems(payload).map((item) => ({
      resultType: "node",
      id: item.senseId,
      nodeId: item.senseId,
      title: item.canonicalWrittenForm,
      summary: item.definition,
      objectType: "lexical-evidence-sense",
      metadata: {
        exactLemma: item.canonicalWrittenForm,
        lemmas: [item.canonicalWrittenForm],
        partOfSpeech: item.partOfSpeech,
        lexicalCategory: item.lexicalCategory,
        lexicalEvidence: true,
        uncertainty: item.uncertainty,
        domainLabel: item.domainLabel,
        registerLabel: item.registerLabel
      },
      sourceIds: []
    }));
  }

  function renderSearchResults(term, payload, requestedPage) {
    const raw = global.DictionaryRootApi.extractItems(payload)
      .filter((item) => item && (item.resultType === "node" || !item.resultType));
    const ranked = global.DictionaryRootApi.rankMeaningResults(raw, term);
    const exact = global.DictionaryRootApi.exactMeaningResults(ranked, term);
    const related = ranked.filter((item) => !exact.includes(item));
    const ordered = exact.concat(related);
    const pageSize = 12;
    const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
    const page = Math.min(Math.max(1, Number(requestedPage) || 1), totalPages);
    const shown = ordered.slice((page - 1) * pageSize, page * pageSize);
    const coverage = payload && payload.coverage && typeof payload.coverage === "object" ? payload.coverage : null;
    state.resultPayload = payload;
    state.resultPage = page;

    elements.resultsSection.hidden = false;
    elements.resultCount.textContent = `${exact.length} exact · ${related.length} related`;

    if (!shown.length) {
      elements.results.innerHTML = '<div class="dr-home-empty"><strong>No matching meaning was found.</strong><br>Check the spelling or try a related word. No fallback records were used.</div>';
      setSearchStatus(`No connected meaning matched “${term}”.`, "error");
      return;
    }

    elements.results.innerHTML = shown.map((record) => {
      const label = global.DictionaryRootApi.preferredMeaningLabel(record, term);
      const isExact = global.DictionaryRootApi.meaningMatchRank(record, term) <= 1;
      const data = metadata(record);
      const completeLexicon = data.lexicalCoverage === "complete-lemma";
      const graphCoverage = data.graphCoverage === true;
      return `<article class="dr-home-result-card" data-exact="${isExact ? "true" : "false"}">
        <div>
          <h3>${escapeHtml(label)}</h3>
          <p>${escapeHtml(summary(record))}</p>
        </div>
        <div class="dr-home-result-meta">
          <span data-tone="exact">${isExact ? "Exact meaning" : "Related match"}</span>
          <span>${escapeHtml(partOfSpeech(record))}</span>
          ${completeLexicon ? `<span data-tone="lexical">${graphCoverage ? "Pilot graph" : "On-demand graph"}</span>` : ""}
        </div>
        ${resultLinks(record, term, label)}
      </article>`;
    }).join("") + (ordered.length > pageSize ? `
      <nav class="dr-home-result-pagination" aria-label="Meaning result pages">
        <button type="button" class="dr-live-button-secondary" data-dr-result-page="${page - 1}" ${page === 1 ? "disabled" : ""}>Previous</button>
        <span>Page ${page} of ${totalPages} · ${ordered.length} results</span>
        <button type="button" class="dr-live-button-secondary" data-dr-result-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>Next</button>
      </nav>` : "");

    const exactCount = coverage && coverage.available ? Number(coverage.exactSenseCount) : exact.length;
    const parts = coverage && coverage.partOfSpeechCounts ? Object.entries(coverage.partOfSpeechCounts)
      .filter((entry) => Number(entry[1]) > 0)
      .map((entry) => `${entry[1]} ${entry[0]}`)
      .join(", ") : "";
    setSearchStatus(`${exactCount} complete exact sense${exactCount === 1 ? "" : "s"} of “${term}”${parts ? ` across ${parts}` : ""}. Exact meanings appear first.`, "success");
  }

  async function performSearch(term, options) {
    const query = clean(term);
    if (!query) {
      elements.resultsSection.hidden = true;
      elements.results.innerHTML = "";
      setSearchStatus("Enter a word to search the complete live meaning index.", "error");
      if (!options || !options.fromHistory) updateUrl("", "push");
      return;
    }

    const token = ++state.searchToken;
    state.lastQuery = query;
    elements.input.value = query;
    elements.resultsSection.hidden = false;
    elements.results.innerHTML = '<div class="dr-home-empty">Retrieving every exact sense and related match from SourceRoot…</div>';
    setSearchBusy(true);
    setSearchStatus(`Searching DictionaryRoot for “${query}”…`, "loading");

    if (!options || !options.fromHistory) updateUrl(query, options && options.replace ? "replace" : "push");
    writeRecent(query);

    try {
      const client = await ensureClient();
      const [baseline, evidence] = await Promise.all([
        client.searchNodes(query, { limit: 100 }),
        client.lexicalEvidenceSearchAll(query, { limit: 25, maxPages: 20 })
      ]);
      if (token !== state.searchToken) return;
      renderSearchResults(query, {
        items: global.DictionaryRootApi.extractItems(baseline.data)
          .concat(lexicalEvidenceSearchNodes(evidence.data)),
        total: global.DictionaryRootApi.extractTotal(baseline.data)
          + global.DictionaryRootApi.extractTotal(evidence.data),
        coverage: baseline.data && baseline.data.coverage,
        lexicalEvidencePagination: {
          totalPages: evidence.data.totalPages,
          loadedPages: evidence.data.loadedPages,
          complete: evidence.data.complete
        }
      }, 1);
      elements.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (token !== state.searchToken) return;
      elements.results.innerHTML = '<div class="dr-home-empty"><strong>The live meaning service is unavailable.</strong><br>Start SourceRoot and retry. DictionaryRoot did not use fallback data.</div>';
      setSearchStatus(error && error.message ? error.message : "Search failed.", "error");
    } finally {
      if (token === state.searchToken) setSearchBusy(false);
    }
  }

  async function loadCoverage() {
    setServiceState("Checking", "loading");
    try {
      const client = await ensureClient();
      const query = global.DictionaryRootApi.buildQuery({ bundleId: state.manifest.bundleId });
      const response = await client.request(`/dictionaryroot/lexicon/dashboard${query}`);
      const status = response.data || {};
      if (!status.available) {
        setServiceState("Not imported", "offline");
        elements.coverageNote.textContent = "The SourceRoot service responded, but the complete lexical index has not been imported. No fallback counts are displayed.";
        return;
      }
      elements.synsets.textContent = formatNumber(status.synsetCount);
      elements.lemmas.textContent = formatNumber(status.lemmaCount);
      elements.relations.textContent = formatNumber(status.relationCount);
      elements.graphCount.textContent = formatNumber(status.graphCoveredSenseCount);
      elements.lexicalOnlyCount.textContent = formatNumber(status.lexicalOnlySenseCount);
      elements.sourceBackedCount.textContent = formatNumber(status.sourceBackedSenseCount);
      elements.reviewedCount.textContent = formatNumber(status.reviewedSenseCount);
      elements.historyCount.textContent = formatNumber(status.conceptRevisionCoveredSenseCount);
      elements.graphPercent.textContent = `${formatPercent(status.graphCoveragePercent)} of meanings`;
      elements.sourcePercent.textContent = `${formatPercent(status.sourceCoveragePercent)} resolved`;
      elements.reviewNote.textContent = `${formatNumber(status.reviewRequiredSenseCount)} still need review`;
      const datasetLineage = Number(status.datasetRevisionCount) || 0;
      elements.coverageNote.textContent = `${clean(status.sourceName) || "Open English WordNet"} ${clean(status.sourceVersion)} · live registry updated ${formatDate(status.updatedAt || status.importedAt)} · ${formatNumber(datasetLineage)} dataset-lineage record${datasetLineage === 1 ? "" : "s"} kept separate from concept history.`;
      setServiceState("Connected", "connected");
    } catch (error) {
      setServiceState("Offline", "offline");
      elements.coverageNote.textContent = "DictionaryRoot could not reach SourceRoot. No cached or fallback coverage counts were displayed.";
    }
  }

  function themeForDefinition(value) {
    const text = clean(value).toLowerCase();
    if (/money|goods or services|fair equivalent|price|economic|monetary/.test(text)) return "Monetary worth";
    if (/numerical|quantity|magnitude|number/.test(text)) return "Numerical quantity";
    if (/principle|belief|moral|importance|worthwhile/.test(text)) return "Importance or principle";
    if (/lightness|color|colour|dark/.test(text)) return "Color lightness";
    return "Another exact meaning";
  }

  function chooseValueExamples(records) {
    const chosen = [];
    const usedThemes = new Set();
    records.forEach((record) => {
      const theme = themeForDefinition(summary(record));
      if (theme !== "Another exact meaning" && !usedThemes.has(theme)) {
        usedThemes.add(theme);
        chosen.push({ record, theme });
      }
    });
    records.forEach((record) => {
      if (chosen.length >= 4 || chosen.some((entry) => entry.record === record)) return;
      chosen.push({ record, theme: themeForDefinition(summary(record)) });
    });
    return chosen.slice(0, 4);
  }

  async function loadValueDemo() {
    const token = ++state.valueToken;
    try {
      const client = await ensureClient();
      const response = await client.searchNodes("value", { limit: 100 });
      if (token !== state.valueToken) return;
      const ranked = global.DictionaryRootApi.rankMeaningResults(global.DictionaryRootApi.extractItems(response.data), "value");
      const exact = global.DictionaryRootApi.exactMeaningResults(ranked, "value");
      if (!exact.length) {
        elements.valueDemo.innerHTML = '<div class="dr-home-empty"><strong>No exact “value” meanings were returned.</strong><br>The live lexical index may be incomplete.</div>';
        return;
      }
      elements.valueDemo.innerHTML = chooseValueExamples(exact).map((entry) => {
        const record = entry.record;
        const label = global.DictionaryRootApi.preferredMeaningLabel(record, "value");
        return `<article class="dr-home-value-card">
          <strong>${escapeHtml(entry.theme)}</strong>
          <span>${escapeHtml(summary(record))}</span>
          <a href="${escapeHtml(navHref("concept-v2.html", { meaning: label, nodeId: nodeId(record), sourceId: firstSourceId(record) }))}">Open this exact meaning →</a>
        </article>`;
      }).join("");
    } catch (_) {
      if (token !== state.valueToken) return;
      elements.valueDemo.innerHTML = '<div class="dr-home-empty"><strong>Live meaning preview unavailable.</strong><br>Start SourceRoot to load the exact senses of “value.” No fallback definitions were used.</div>';
    }
  }

  function bindEvents() {
    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      performSearch(elements.input.value);
    });

    document.querySelectorAll("[data-dr-example]").forEach((button) => {
      button.addEventListener("click", () => performSearch(button.dataset.drExample));
    });

    elements.exploreValue.addEventListener("click", () => performSearch("value"));

    elements.recents.addEventListener("click", (event) => {
      const button = event.target.closest("[data-dr-recent]");
      if (button) performSearch(button.dataset.drRecent);
    });

    elements.results.addEventListener("click", (event) => {
      const button = event.target.closest("[data-dr-result-page]");
      if (!button || !state.resultPayload) return;
      renderSearchResults(state.lastQuery, state.resultPayload, Number(button.dataset.drResultPage));
      elements.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    global.addEventListener("popstate", () => {
      const query = clean(new URL(global.location.href).searchParams.get("q"));
      if (query) performSearch(query, { fromHistory: true });
      else {
        state.searchToken += 1;
        state.lastQuery = "";
        elements.input.value = "";
        elements.resultsSection.hidden = true;
        setSearchBusy(false);
        setSearchStatus("Search the complete live Open English WordNet index.", "");
      }
    });
  }

  function cacheElements() {
    elements.form = document.getElementById("dictionaryrootHomeSearchForm");
    elements.input = document.getElementById("dictionaryrootHomeSearchInput");
    elements.button = document.getElementById("dictionaryrootHomeSearchButton");
    elements.status = document.getElementById("dictionaryrootHomeSearchStatus");
    elements.resultsSection = document.getElementById("dictionaryrootHomeResultsSection");
    elements.results = document.getElementById("dictionaryrootHomeResults");
    elements.resultCount = document.getElementById("dictionaryrootHomeResultCount");
    elements.serviceState = document.getElementById("dictionaryrootHomeServiceState");
    elements.synsets = document.getElementById("dictionaryrootHomeSynsetCount");
    elements.lemmas = document.getElementById("dictionaryrootHomeLemmaCount");
    elements.relations = document.getElementById("dictionaryrootHomeRelationCount");
    elements.graphCount = document.getElementById("dictionaryrootHomeGraphCount");
    elements.lexicalOnlyCount = document.getElementById("dictionaryrootHomeLexicalOnlyCount");
    elements.sourceBackedCount = document.getElementById("dictionaryrootHomeSourceBackedCount");
    elements.reviewedCount = document.getElementById("dictionaryrootHomeReviewedCount");
    elements.historyCount = document.getElementById("dictionaryrootHomeHistoryCount");
    elements.graphPercent = document.getElementById("dictionaryrootHomeGraphPercent");
    elements.sourcePercent = document.getElementById("dictionaryrootHomeSourcePercent");
    elements.reviewNote = document.getElementById("dictionaryrootHomeReviewNote");
    elements.coverageNote = document.getElementById("dictionaryrootHomeCoverageNote");
    elements.valueDemo = document.getElementById("dictionaryrootHomeValueDemo");
    elements.exploreValue = document.getElementById("dictionaryrootHomeExploreValue");
    elements.recents = document.getElementById("dictionaryrootHomeRecentSearches");
  }

  function init() {
    cacheElements();
    bindEvents();
    renderRecent();
    loadCoverage();
    loadValueDemo();
    const initialQuery = clean(new URL(global.location.href).searchParams.get("q"));
    if (initialQuery) performSearch(initialQuery, { fromHistory: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
