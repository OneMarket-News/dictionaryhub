(function sourceRootUnifiedSearch(global) {
  "use strict";

  const DEFAULT_ROOTS = ["DictionaryRoot", "HistoryRoot"];
  const MATCH_LABELS = {
    exact: "Exact match",
    "normalized-exact": "Normalized exact",
    "form-match": "Lexical form match",
    "title-match": "Title match",
    "contextual-occurrence": "Contextual occurrence"
  };
  const RESULT_TYPE_LABELS = {
    "lexical-sense": "Lexical sense",
    "context-entity": "Historical entity",
    "context-claim": "Historical claim",
    "context-evidence": "Historical evidence",
    "context-interpretation": "Interpretation",
    "context-relationship": "Historical relationship",
    "context-account": "Historical account",
    "context-claim-version": "Historical claim version",
    source: "Source"
  };

  const elements = {};
  const state = {
    requestToken: 0,
    controller: null,
    lastPayload: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function apiBaseUrl() {
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    if (global.location.protocol === "http:"
      && loopback.has(global.location.hostname)) {
      return `http://${global.location.hostname}:3000/api/v1`;
    }
    return `${global.location.origin}/api/v1`;
  }

  function checkedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
      .map((input) => input.value);
  }

  function parseList(params, name, fallback) {
    const value = clean(params.get(name));
    return value ? value.split(",").map(clean).filter(Boolean) : fallback.slice();
  }

  function readUrlState() {
    const params = new URLSearchParams(global.location.search);
    const page = Number(params.get("page") || "1");
    return {
      q: clean(params.get("q")),
      roots: parseList(params, "roots", DEFAULT_ROOTS),
      resultTypes: parseList(params, "resultTypes", []),
      page: Number.isInteger(page) && page > 0 ? Math.min(page, 5) : 1
    };
  }

  function applyStateToControls(next) {
    elements.input.value = next.q;
    document.querySelectorAll('input[name="roots"]').forEach((input) => {
      input.checked = next.roots.includes(input.value);
    });
    document.querySelectorAll('input[name="resultTypes"]').forEach((input) => {
      input.checked = next.resultTypes.includes(input.value);
    });
  }

  function currentControlState(page) {
    return {
      q: clean(elements.input.value),
      roots: checkedValues("roots"),
      resultTypes: checkedValues("resultTypes"),
      page: page || 1
    };
  }

  function writeUrl(next, mode) {
    const url = new URL(global.location.href);
    url.search = "";
    if (next.q) url.searchParams.set("q", next.q);
    url.searchParams.set("roots", next.roots.join(","));
    if (next.resultTypes.length) {
      url.searchParams.set("resultTypes", next.resultTypes.join(","));
    }
    url.searchParams.set("page", String(next.page));
    global.history[mode === "replace" ? "replaceState" : "pushState"](
      { sourceRootUnifiedSearch: true },
      "",
      `${url.pathname}${url.search}`
    );
  }

  function setBusy(busy) {
    elements.results.setAttribute("aria-busy", busy ? "true" : "false");
    elements.button.disabled = busy;
    elements.button.textContent = busy ? "Searching…" : "Search SourceRoot";
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function node(tag, options) {
    const settings = options || {};
    const value = document.createElement(tag);
    if (settings.className) value.className = settings.className;
    if (settings.text !== undefined) value.textContent = clean(settings.text);
    if (settings.attributes) {
      Object.entries(settings.attributes).forEach(([name, content]) => {
        value.setAttribute(name, String(content));
      });
    }
    return value;
  }

  function append(parent) {
    Array.prototype.slice.call(arguments, 1).forEach((child) => {
      if (child !== null && child !== undefined) parent.appendChild(child);
    });
  }

  function renderState(title, message) {
    clear(elements.results);
    const card = node("article", { className: "sr-state-card" });
    append(
      card,
      node("h3", { text: title }),
      node("p", { text: message })
    );
    append(elements.results, card);
  }

  function countCard(value, label) {
    const card = node("div", { className: "sr-count-card" });
    append(
      card,
      node("strong", { text: String(value) }),
      node("span", { text: label })
    );
    return card;
  }

  function renderCounts(payload) {
    clear(elements.counts);
    const counts = payload.counts;
    append(
      elements.counts,
      countCard(counts.combined, "All results"),
      countCard(counts.DictionaryRoot, "DictionaryRoot"),
      countCard(counts.HistoryRoot, "HistoryRoot"),
      countCard(counts.exact, "Exact or title matches"),
      countCard(counts.relatedOrContextual, "Related or contextual")
    );
    elements.counts.hidden = false;
  }

  function renderAvailability(payload) {
    const availability = payload.availability;
    const unavailable = availability.unavailableRoots || [];
    elements.availability.dataset.state = availability.status;
    if (availability.status === "all-available") {
      elements.availability.textContent =
        "DictionaryRoot and HistoryRoot both responded with live canonical data.";
    } else if (availability.status === "partial-availability") {
      elements.availability.textContent =
        `${unavailable.join(" and ")} is unavailable. Results from the available Root remain live; no fallback data was substituted.`;
    } else if (availability.status === "filters-exclude-all-result-types") {
      elements.availability.textContent =
        "The selected Root and result types do not overlap. Adjust a filter to search an available canonical result type.";
    } else if (availability.status === "all-unavailable") {
      elements.availability.textContent =
        "Both selected Roots are unavailable. No stale or fallback results are displayed.";
    } else {
      elements.availability.textContent =
        "Both selected Roots responded, but no canonical results matched this query.";
    }
    elements.availability.hidden = false;
  }

  function chip(text, attributes) {
    return node("span", {
      className: "sr-chip",
      text,
      attributes: attributes || {}
    });
  }

  function resultCard(item) {
    const card = node("article", {
      className: "sr-result-card",
      attributes: {
        "data-root": item.rootId,
        "data-result-id": item.resultId,
        "data-connection-basis": item.connectionBasis
      }
    });
    const top = node("div", { className: "sr-result-card-top" });
    const exact = ["exact", "normalized-exact", "title-match"]
      .includes(item.matchClassification);
    append(
      top,
      chip(item.rootDisplayName, { "data-root": item.rootId }),
      chip(RESULT_TYPE_LABELS[item.canonicalResultType] || item.canonicalResultType),
      chip(MATCH_LABELS[item.matchClassification] || item.matchClassification, {
        "data-match": exact ? "true" : "false"
      })
    );
    const heading = node("h3", { text: item.title });
    const summary = node("p", {
      text: item.summary || "Open this canonical record to inspect its Root-specific context."
    });
    const meta = node("div", { className: "sr-result-meta" });
    append(
      meta,
      node("span", { text: `${item.datasetId} · v${item.datasetVersion}` }),
      node("span", {
        text: item.sourceEvidenceAvailable
          ? "Source or evidence available"
          : "Inspect the canonical record for evidence context"
      }),
      node("span", { text: item.matchExplanation })
    );
    const disclaimer = node("p", {
      className: "sr-result-disclaimer",
      text: "This result shares the submitted query term; it is not presented as a verified cross-Root relationship."
    });
    const link = node("a", {
      className: "sr-result-link",
      text: `Open in ${item.rootDisplayName}`,
      attributes: { href: item.canonicalUrl }
    });
    append(card, top, heading, summary, meta, disclaimer, link);
    return card;
  }

  function renderResults(payload) {
    clear(elements.results);
    if (!payload.items.length) {
      const filterExcluded =
        payload.availability.status === "filters-exclude-all-result-types";
      renderState(
        filterExcluded ? "No compatible result types" : "No canonical results",
        filterExcluded
          ? "The active filters exclude every result type owned by the selected Root."
          : "Try a different spelling or broaden the selected Roots and result types."
      );
      return;
    }
    payload.items.forEach((item) => append(elements.results, resultCard(item)));
  }

  function renderPagination(payload) {
    elements.pagination.hidden = payload.totalPages <= 1;
    elements.previous.disabled = payload.page <= 1;
    elements.next.disabled = !payload.hasNextPage;
    elements.pageStatus.textContent =
      `Page ${payload.page}${payload.totalPages ? ` of ${payload.totalPages}` : ""}`;
  }

  function renderPayload(payload) {
    state.lastPayload = payload;
    renderAvailability(payload);
    renderCounts(payload);
    renderResults(payload);
    renderPagination(payload);
    const partial = payload.availability.status === "partial-availability"
      ? " Partial availability."
      : "";
    elements.status.textContent =
      `${payload.returned} of ${payload.total} results shown for “${payload.query}”.${partial}`;
    document.title = `${payload.query} · Search all Roots | SourceRoot`;
  }

  async function requestSearch(next) {
    if (!next.q) {
      elements.status.textContent = "Enter a term to begin.";
      elements.counts.hidden = true;
      elements.availability.hidden = true;
      elements.pagination.hidden = true;
      renderState(
        "One query, two accountable Roots",
        "Results remain separate, labeled, versioned, and linked to their canonical customer pages."
      );
      return;
    }
    if (!next.roots.length) {
      elements.status.textContent = "Select at least one Root.";
      elements.counts.hidden = true;
      elements.availability.hidden = true;
      elements.pagination.hidden = true;
      renderState("No Root selected", "Choose DictionaryRoot, HistoryRoot, or both.");
      return;
    }

    const token = ++state.requestToken;
    if (state.controller) state.controller.abort();
    state.controller = new AbortController();
    setBusy(true);
    elements.status.textContent = `Searching live Roots for “${next.q}”…`;
    renderState("Searching canonical services", "No fallback data will be used.");

    const params = new URLSearchParams({
      q: next.q,
      roots: next.roots.join(","),
      page: String(next.page),
      limit: "10"
    });
    if (next.resultTypes.length) {
      params.set("resultTypes", next.resultTypes.join(","));
    }

    try {
      const result = await global.SourceRootApiLayer.request(
        `${apiBaseUrl()}/search/unified?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          signal: state.controller.signal,
          timeoutMs: 12000
        }
      );
      if (token !== state.requestToken) return;
      renderPayload(result.data);
    } catch (error) {
      if (token !== state.requestToken || (error && error.category === "aborted")) return;
      const payload = error && error.payload;
      if (payload && payload.availability) {
        renderPayload(payload);
      } else {
        elements.status.textContent = "Unified search is unavailable.";
        elements.counts.hidden = true;
        elements.pagination.hidden = true;
        elements.availability.hidden = false;
        elements.availability.dataset.state = "all-unavailable";
        elements.availability.textContent =
          "SourceRoot could not reach the unified endpoint. No stale or fallback records are displayed.";
        renderState(
          "The live search service could not be reached",
          "Confirm the current SourceRoot backend is running, then retry this query."
        );
      }
    } finally {
      if (token === state.requestToken) setBusy(false);
    }
  }

  function navigate(next, mode) {
    applyStateToControls(next);
    writeUrl(next, mode || "push");
    requestSearch(next);
  }

  function initialize() {
    elements.form = byId("srUnifiedSearchForm");
    elements.input = byId("srUnifiedSearchInput");
    elements.button = byId("srUnifiedSearchButton");
    elements.status = byId("srSearchStatus");
    elements.availability = byId("srAvailability");
    elements.counts = byId("srCounts");
    elements.results = byId("srUnifiedResults");
    elements.pagination = byId("srPagination");
    elements.previous = byId("srPreviousPage");
    elements.next = byId("srNextPage");
    elements.pageStatus = byId("srPageStatus");
    elements.clearFilters = byId("srClearFilters");

    const initial = readUrlState();
    applyStateToControls(initial);

    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      navigate(currentControlState(1), "push");
    });
    document.querySelectorAll('input[name="roots"], input[name="resultTypes"]')
      .forEach((input) => input.addEventListener("change", () => {
        navigate(currentControlState(1), "push");
      }));
    elements.clearFilters.addEventListener("click", () => {
      navigate({
        q: clean(elements.input.value),
        roots: DEFAULT_ROOTS.slice(),
        resultTypes: [],
        page: 1
      }, "push");
    });
    elements.previous.addEventListener("click", () => {
      const active = readUrlState();
      if (active.page > 1) navigate({ ...active, page: active.page - 1 }, "push");
    });
    elements.next.addEventListener("click", () => {
      const active = readUrlState();
      if (active.page < 5) navigate({ ...active, page: active.page + 1 }, "push");
    });
    global.addEventListener("popstate", () => {
      const active = readUrlState();
      applyStateToControls(active);
      requestSearch(active);
    });

    if (global.location.search) writeUrl(initial, "replace");
    requestSearch(initial);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  global.SourceRootUnifiedSearch = {
    readUrlState,
    requestSearch
  };
})(window);
