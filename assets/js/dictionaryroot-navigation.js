(function dictionaryRootUnifiedNavigation(global) {
  "use strict";

  const DEFAULT_BRAND = {
    productName: "DictionaryRoot",
    tagline: "Explore how meaning connects.",
    poweredBy: "SourceRoot",
    logoPath: "assets/brand/dictionaryroot-mark.svg"
  };

  const NAV_ITEMS = [
    { key: "home", label: "Home", href: "index.html" },
    { key: "concept", label: "Concept", href: "concept-v2.html" },
    { key: "graph", label: "Knowledge Sphere", href: "graph-v2.html" },
    { key: "sources", label: "Sources", href: "sources-v2.html" },
    { key: "history", label: "History", href: "history-v2.html" },
    { key: "coverage", label: "Coverage", href: "coverage-v2.html" },
    { key: "editorial", label: "Editorial", href: "editorial-v2.html" },
    { key: "workflow", label: "Workflow", href: "workflow-v1.html" },
    { key: "account", label: "Account", href: "account-v1.html" }
  ];

  const PAGE_KEYS = {
    "index.html": "home",
    "concept-v2.html": "concept",
    "graph-v2.html": "graph",
    "sources-v2.html": "sources",
    "history-v2.html": "history",
    "coverage-v2.html": "coverage",
    "editorial-v2.html": "editorial",
    "workflow-v1.html": "workflow",
    "account-v1.html": "account",
    "admin-v1.html": "admin"
  };

  const state = {
    brand: Object.assign({}, DEFAULT_BRAND),
    manifest: null,
    client: null,
    requestToken: 0,
    observer: null,
    initialized: false
  };

  const elements = {};

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function currentFile(url) {
    const source = url || global.location;
    const pathname = source.pathname || "";
    return pathname.split("/").pop().toLowerCase() || "index.html";
  }

  function currentPageKey(url) {
    return PAGE_KEYS[currentFile(url)] || "";
  }

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function firstSourceId(record) {
    const values = [];
    if (record && Array.isArray(record.sourceIds)) values.push.apply(values, record.sourceIds);
    if (record && record.sourceId) values.push(record.sourceId);
    return clean(values.find(Boolean));
  }

  function readContext(urlValue) {
    const url = urlValue instanceof URL ? urlValue : new URL(urlValue || global.location.href, global.location.href);
    const params = url.searchParams;
    const page = currentPageKey(url);
    const sourceSearch = page === "sources" ? clean(params.get("q")) : "";
    const coverageSearch = page === "coverage" ? clean(params.get("q")) : "";
    const editorialSearch = page === "editorial" ? clean(params.get("q")) : "";
    const meaning = clean(params.get("meaning")) || (page !== "sources" && page !== "coverage" && page !== "editorial" ? clean(params.get("q")) : "");
    return {
      page,
      meaning,
      nodeId: clean(params.get("nodeId")) || clean(params.get("id")) || clean(params.get("center")),
      sourceId: clean(params.get("source")),
      sourceSearch,
      coverageSearch,
      editorialSearch,
      editorialStatus: clean(params.get("reviewStatus")),
      editorialCategory: clean(params.get("category")),
      editorialPartOfSpeech: clean(params.get("pos")),
      editorialSort: clean(params.get("editorialSort")),
      coverageFilter: clean(params.get("coverage")),
      coverageSource: clean(params.get("sourceCoverage")),
      coverageHistory: clean(params.get("historyCoverage")),
      coverageReview: clean(params.get("review")),
      coveragePartOfSpeech: clean(params.get("pos")),
      coverageSort: clean(params.get("coverageSort")),
      sourceType: clean(params.get("type")),
      sort: clean(params.get("sort")),
      density: clean(params.get("density")),
      revisionId: clean(params.get("revision")),
      historyStatus: clean(params.get("status"))
    };
  }

  function setOrDelete(params, key, value) {
    const normalized = clean(value);
    if (normalized) params.set(key, normalized);
    else params.delete(key);
  }

  function buildHref(targetFile, overrides) {
    const file = clean(targetFile).split("/").pop() || "concept-v2.html";
    const targetPage = PAGE_KEYS[file.toLowerCase()] || "";
    const context = Object.assign({}, readContext(), overrides || {});
    const params = new URLSearchParams();
    const activeMeaning = context.meaning || context.coverageSearch || context.editorialSearch;

    if (targetPage === "home") {
      setOrDelete(params, "q", activeMeaning);
    } else if (targetPage === "concept" || targetPage === "graph") {
      setOrDelete(params, "q", activeMeaning);
      setOrDelete(params, "nodeId", context.nodeId);
      setOrDelete(params, "source", context.sourceId);
    } else if (targetPage === "history") {
      setOrDelete(params, "q", activeMeaning);
      setOrDelete(params, "nodeId", context.nodeId);
      setOrDelete(params, "source", context.sourceId);
      setOrDelete(params, "revision", context.revisionId);
      setOrDelete(params, "status", context.historyStatus && context.historyStatus !== "all" ? context.historyStatus : "");
    } else if (targetPage === "sources") {
      setOrDelete(params, "source", context.sourceId);
      setOrDelete(params, "meaning", activeMeaning);
      setOrDelete(params, "nodeId", context.nodeId);
      if (context.preserveSourceFilters) {
        setOrDelete(params, "q", context.sourceSearch);
        setOrDelete(params, "type", context.sourceType && context.sourceType !== "all" ? context.sourceType : "");
        setOrDelete(params, "sort", context.sort && context.sort !== "usage" ? context.sort : "");
        setOrDelete(params, "density", context.density && context.density !== "comfortable" ? context.density : "");
      }
    } else if (targetPage === "coverage") {
      setOrDelete(params, "q", context.coverageSearch || context.editorialSearch || context.meaning);
      setOrDelete(params, "nodeId", context.nodeId);
      if (context.preserveCoverageFilters) {
        setOrDelete(params, "coverage", context.coverageFilter && context.coverageFilter !== "all" ? context.coverageFilter : "");
        setOrDelete(params, "sourceCoverage", context.coverageSource && context.coverageSource !== "all" ? context.coverageSource : "");
        setOrDelete(params, "historyCoverage", context.coverageHistory && context.coverageHistory !== "all" ? context.coverageHistory : "");
        setOrDelete(params, "review", context.coverageReview && context.coverageReview !== "all" ? context.coverageReview : "");
        setOrDelete(params, "pos", context.coveragePartOfSpeech && context.coveragePartOfSpeech !== "all" ? context.coveragePartOfSpeech : "");
        setOrDelete(params, "coverageSort", context.coverageSort && context.coverageSort !== "gaps" ? context.coverageSort : "");
      }
    } else if (targetPage === "editorial") {
      setOrDelete(params, "q", context.editorialSearch || context.coverageSearch || context.meaning);
      setOrDelete(params, "nodeId", context.nodeId);
      if (context.preserveEditorialFilters) {
        setOrDelete(params, "reviewStatus", context.editorialStatus && context.editorialStatus !== "all" ? context.editorialStatus : "");
        setOrDelete(params, "category", context.editorialCategory && context.editorialCategory !== "needs-review" ? context.editorialCategory : "");
        setOrDelete(params, "pos", context.editorialPartOfSpeech && context.editorialPartOfSpeech !== "all" ? context.editorialPartOfSpeech : "");
        setOrDelete(params, "editorialSort", context.editorialSort && context.editorialSort !== "priority" ? context.editorialSort : "");
      }
    } else if (targetPage === "workflow") {
      setOrDelete(params, "targetId", context.nodeId);
      setOrDelete(params, "q", activeMeaning);
    }

    const query = params.toString();
    return `${file}${query ? `?${query}` : ""}`;
  }

  function buildNavHref(item) {
    const active = currentPageKey() === item.key;
    if (active) {
      const file = currentFile();
      return `${file}${global.location.search || ""}${global.location.hash || ""}`;
    }
    return buildHref(item.href, {
      preserveSourceFilters: item.key === "sources",
      preserveCoverageFilters: item.key === "coverage",
      preserveEditorialFilters: item.key === "editorial"
    });
  }

  function brandMarkup(brand) {
    return `<a class="dictionaryroot-brand-lockup" href="${escapeHtml(buildHref("index.html"))}" aria-label="${escapeHtml(brand.productName)} home">
      <img src="${escapeHtml(brand.logoPath)}" alt="" width="42" height="42">
      <span class="dictionaryroot-brand-copy">
        <span class="dictionaryroot-brand-name">${escapeHtml(brand.productName)}</span>
        <span class="dictionaryroot-brand-tagline">${escapeHtml(brand.tagline)}</span>
      </span>
    </a>`;
  }

  function navMarkup() {
    const page = currentPageKey();
    return NAV_ITEMS.map((item) => {
      const active = page === item.key;
      return `<a href="${escapeHtml(buildNavHref(item))}" data-dr-nav-page="${escapeHtml(item.key)}"${active ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`;
    }).join("");
  }

  function contextMarkup() {
    const context = readContext();
    const label = context.meaning || context.coverageSearch || context.editorialSearch || context.sourceId;
    return `<span class="dictionaryroot-unified-context" data-dr-context${label ? "" : " hidden"}><span>Context</span><strong title="${escapeHtml(label)}">${escapeHtml(label)}</strong></span>`;
  }

  function createHeader(brand) {
    let header = document.querySelector(".dictionaryroot-product-bar");
    if (!header) {
      header = document.createElement("header");
      document.body.insertBefore(header, document.body.firstChild);
    }

    header.className = "dictionaryroot-product-bar dictionaryroot-unified-header";
    header.dataset.drUnifiedNavigation = "v1";
    header.dataset.menuOpen = "false";
    header.innerHTML = `<div class="dictionaryroot-product-bar-inner">
      <div class="dictionaryroot-unified-brand-area">${brandMarkup(brand)}</div>
      <div class="dictionaryroot-global-search" data-dr-global-search>
        <form class="dictionaryroot-global-search-form" role="search" aria-label="Search exact DictionaryRoot meanings">
          <label class="dictionaryroot-global-search-label" for="dictionaryrootGlobalSearchInput">Search exact meanings</label>
          <input id="dictionaryrootGlobalSearchInput" class="dictionaryroot-global-search-input" type="search" name="global-q" autocomplete="off" spellcheck="false" placeholder="Search exact meanings across DictionaryRoot">
          <button class="dictionaryroot-global-search-button" type="submit">Search</button>
        </form>
        <section class="dictionaryroot-global-search-panel" aria-label="Global exact-meaning results" hidden>
          <div class="dictionaryroot-global-search-panel-header">
            <div><strong>Exact-meaning search</strong><span class="dictionaryroot-global-search-status" role="status" aria-live="polite"></span></div>
            <button class="dictionaryroot-global-search-close" type="button" aria-label="Close global search results">×</button>
          </div>
          <div class="dictionaryroot-global-search-results"></div>
        </section>
      </div>
      <div class="dictionaryroot-unified-nav-wrap">
        <nav class="dictionaryroot-product-nav" aria-label="DictionaryRoot experiences">${navMarkup()}</nav>
        ${contextMarkup()}
        <a class="dictionaryroot-account-chip" href="account-v1.html" data-dr-account-chip><span class="dictionaryroot-account-dot" aria-hidden="true"></span><span data-dr-account-label>Sign in</span></a>
        <span class="dictionaryroot-powered-by">Powered by <strong>${escapeHtml(brand.poweredBy)}</strong></span>
        <button class="dictionaryroot-mobile-menu-button" type="button" aria-expanded="false" aria-controls="dictionaryrootUnifiedNavigation">Menu</button>
      </div>
    </div>`;

    const nav = header.querySelector(".dictionaryroot-product-nav");
    nav.id = "dictionaryrootUnifiedNavigation";
    return header;
  }

  function cacheElements(header) {
    elements.header = header;
    elements.form = header.querySelector(".dictionaryroot-global-search-form");
    elements.input = header.querySelector(".dictionaryroot-global-search-input");
    elements.button = header.querySelector(".dictionaryroot-global-search-button");
    elements.panel = header.querySelector(".dictionaryroot-global-search-panel");
    elements.status = header.querySelector(".dictionaryroot-global-search-status");
    elements.results = header.querySelector(".dictionaryroot-global-search-results");
    elements.close = header.querySelector(".dictionaryroot-global-search-close");
    elements.menuButton = header.querySelector(".dictionaryroot-mobile-menu-button");
    elements.nav = header.querySelector(".dictionaryroot-product-nav");
    elements.context = header.querySelector("[data-dr-context]");
    elements.accountChip = header.querySelector("[data-dr-account-chip]");
    elements.accountLabel = header.querySelector("[data-dr-account-label]");
  }

  function updateAccountChip(detail) {
    if (!elements.accountChip || !elements.accountLabel) return;
    const auth = detail || (global.DictionaryRootAuth && global.DictionaryRootAuth.session);
    const signedIn = Boolean(auth && auth.authenticated && auth.user);
    elements.accountChip.dataset.signedIn = signedIn ? "true" : "false";
    elements.accountLabel.textContent = signedIn ? (auth.user.displayName || auth.user.primaryEmail || "Account") : "Sign in";
    elements.accountChip.title = signedIn ? "Open your DictionaryRoot account" : "Sign in to DictionaryRoot";
  }

  function showPanel() {
    elements.panel.hidden = false;
  }

  function closePanel(options) {
    elements.panel.hidden = true;
    if (options && options.focus) elements.input.focus();
  }

  function setStatus(message, tone) {
    elements.status.textContent = message || "";
    elements.status.dataset.state = tone || "";
  }

  function setBusy(busy) {
    elements.button.disabled = Boolean(busy);
    elements.button.textContent = busy ? "Searching…" : "Search";
    elements.input.setAttribute("aria-busy", busy ? "true" : "false");
  }

  async function ensureClient() {
    if (state.client) return state.client;
    if (!global.DictionaryRootApi) throw new Error("DictionaryRoot API client is not loaded.");
    state.manifest = await global.DictionaryRootApi.loadManifest();
    state.client = new global.DictionaryRootApi.DictionaryRootApiClient(state.manifest);
    return state.client;
  }

  function partOfSpeech(record) {
    const metadata = record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
    return clean(metadata.partOfSpeech || metadata.pos || record.objectType || record.nodeType) || "concept";
  }

  function resultActions(record, query, label) {
    const context = readContext();
    const nodeId = clean(record && (record.id || record.nodeId));
    const sourceId = firstSourceId(record) || context.sourceId;
    const conceptHref = buildHref("concept-v2.html", { meaning: label || query, nodeId, sourceId });
    const graphHref = buildHref("graph-v2.html", { meaning: label || query, nodeId, sourceId });
    const sourceHref = buildHref("sources-v2.html", { meaning: label || query, nodeId, sourceId });
    const historyHref = buildHref("history-v2.html", { meaning: label || query, nodeId, sourceId, revisionId: "" });
    const editorialHref = buildHref("editorial-v2.html", { meaning: label || query, nodeId, sourceId });
    const primary = context.page === "graph" ? "graph" : context.page === "history" ? "history" : "concept";

    return `<div class="dictionaryroot-global-result-actions">
      <a href="${escapeHtml(conceptHref)}"${primary === "concept" ? ' data-primary="true"' : ""}>Open concept</a>
      <a href="${escapeHtml(graphHref)}"${primary === "graph" ? ' data-primary="true"' : ""}>Open sphere</a>
      <a href="${escapeHtml(sourceHref)}">Trace sources</a>
      <a href="${escapeHtml(historyHref)}"${primary === "history" ? ' data-primary="true"' : ""}>View history</a>
      <a href="${escapeHtml(editorialHref)}">Review meaning</a>
    </div>`;
  }

  function renderResults(query, payload) {
    const raw = global.DictionaryRootApi.extractItems(payload)
      .filter((item) => item && (item.resultType === "node" || !item.resultType));
    const ranked = global.DictionaryRootApi.rankMeaningResults(raw, query);
    const exact = global.DictionaryRootApi.exactMeaningResults(ranked, query);
    const related = ranked.filter((item) => !exact.includes(item));
    const relatedLimit = Math.max(0, 12 - exact.length);
    const shown = exact.length ? exact.concat(related.slice(0, relatedLimit)) : related.slice(0, 12);
    const coverage = payload && payload.coverage && typeof payload.coverage === "object" ? payload.coverage : null;

    elements.results.innerHTML = "";
    if (!shown.length) {
      elements.results.innerHTML = `<div class="dictionaryroot-global-search-empty"><strong>No matching meaning was found.</strong><br>Check the spelling or search for a related word.</div>`;
      setStatus(`No connected meaning matched “${query}”.`, "error");
      return;
    }

    elements.results.innerHTML = shown.map((record) => {
      const label = global.DictionaryRootApi.preferredMeaningLabel(record, query);
      const rank = global.DictionaryRootApi.meaningMatchRank(record, query);
      const isExact = rank <= 1;
      const summary = clean(record.summary || record.description || record.body) || "Open this source-backed meaning to inspect its definition and semantic context.";
      const nodeId = clean(record.id || record.nodeId);
      const metadata = record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
      const completeLexicon = metadata.lexicalCoverage === "complete-lemma";
      const graphCoverage = metadata.graphCoverage === true;
      return `<article class="dictionaryroot-global-result" data-exact="${isExact ? "true" : "false"}">
        <h2>${escapeHtml(label)}</h2>
        <p>${escapeHtml(summary)}</p>
        <div class="dictionaryroot-global-result-meta">
          <span data-tone="exact">${isExact ? "Exact meaning" : "Related match"}</span>
          <span>${escapeHtml(partOfSpeech(record))}</span>
          ${completeLexicon ? `<span data-tone="coverage">${graphCoverage ? "Complete lexicon · pilot graph" : "Complete lexicon · on-demand graph"}</span>` : ""}
          ${nodeId ? `<span>${escapeHtml(nodeId)}</span>` : ""}
        </div>
        ${resultActions(record, query, label)}
      </article>`;
    }).join("");

    if (coverage && coverage.available && Number(coverage.exactSenseCount) > 1) {
      const posSummary = Object.entries(coverage.partOfSpeechCounts || {})
        .filter((entry) => Number(entry[1]) > 0)
        .map((entry) => `${entry[1]} ${entry[0]}`)
        .join(", ");
      setStatus(`${coverage.exactSenseCount} complete exact senses of “${query}” found${posSummary ? `: ${posSummary}` : ""}.`, "success");
    } else if (exact.length > 1) {
      setStatus(`${exact.length} exact senses of “${query}” found. Choose the intended meaning.`, "success");
    } else if (exact.length === 1) {
      setStatus(`One exact meaning of “${query}” found. Related matches follow.`, "success");
    } else {
      setStatus(`No exact lemma was found. Showing ${shown.length} related meaning${shown.length === 1 ? "" : "s"}.`, "");
    }
  }

  async function search(query) {
    const term = clean(query);
    if (!term) {
      showPanel();
      elements.results.innerHTML = '<div class="dictionaryroot-global-search-empty">Enter a word to search the live SourceRoot meaning index.</div>';
      setStatus("Enter a word to search.", "error");
      return;
    }

    const token = ++state.requestToken;
    showPanel();
    setBusy(true);
    setStatus(`Searching DictionaryRoot for “${term}”…`, "loading");
    elements.results.innerHTML = '<div class="dictionaryroot-global-search-empty">Retrieving exact and related meanings from SourceRoot…</div>';

    try {
      const client = await ensureClient();
      const response = await client.searchNodes(term, { limit: 100 });
      if (token !== state.requestToken) return;
      renderResults(term, response.data);
    } catch (error) {
      if (token !== state.requestToken) return;
      elements.results.innerHTML = '<div class="dictionaryroot-global-search-empty"><strong>The live meaning search is unavailable.</strong><br>Start the SourceRoot backend and retry. No fallback data was used.</div>';
      setStatus(error && error.message ? error.message : "Global search failed.", "error");
    } finally {
      if (token === state.requestToken) setBusy(false);
    }
  }

  function mergeContextIntoLink(anchor) {
    if (!anchor || anchor.closest(".dictionaryroot-unified-header")) return;
    const raw = anchor.dataset.drOriginalHref || anchor.getAttribute("href") || "";
    if (!anchor.dataset.drOriginalHref && raw) anchor.dataset.drOriginalHref = raw;
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;

    let url;
    try {
      url = new URL(raw, global.location.href);
    } catch (_) {
      return;
    }

    if (url.origin !== global.location.origin) return;
    const file = currentFile(url);
    if (!PAGE_KEYS[file]) return;

    const existingContext = readContext(url);
    const currentContext = readContext();
    const merged = {
      meaning: existingContext.meaning || currentContext.meaning,
      nodeId: existingContext.nodeId || currentContext.nodeId,
      sourceId: existingContext.sourceId || currentContext.sourceId,
      sourceSearch: existingContext.sourceSearch,
      sourceType: existingContext.sourceType,
      sort: existingContext.sort,
      density: existingContext.density,
      revisionId: existingContext.revisionId || currentContext.revisionId,
      historyStatus: existingContext.historyStatus || currentContext.historyStatus,
      preserveSourceFilters: file === "sources-v2.html" && currentContext.page === "sources"
    };

    anchor.setAttribute("href", buildHref(file, merged));
    anchor.dataset.drContextReady = "true";
  }

  function refreshContextLinks(root) {
    const scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches("a[href]")) mergeContextIntoLink(scope);
    scope.querySelectorAll("a[href]").forEach(mergeContextIntoLink);
  }

  function installLinkObserver() {
    if (state.observer || !global.MutationObserver) return;
    state.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) refreshContextLinks(node);
      }));
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  function installHistoryEvents() {
    if (global.history.__dictionaryRootNavigationWrapped) return;
    ["pushState", "replaceState"].forEach((method) => {
      const original = global.history[method];
      global.history[method] = function dictionaryRootHistoryUpdate() {
        const result = original.apply(this, arguments);
        global.dispatchEvent(new CustomEvent("dictionaryroot:urlchange", { detail: { method } }));
        return result;
      };
    });
    global.history.__dictionaryRootNavigationWrapped = true;
  }

  function syncFromUrl() {
    const context = readContext();
    if (context.meaning && document.activeElement !== elements.input) elements.input.value = context.meaning;
    refreshHeaderState();
    refreshContextLinks(document);
  }

  function closeMenu() {
    elements.header.dataset.menuOpen = "false";
    elements.menuButton.setAttribute("aria-expanded", "false");
  }

  function bindEvents() {
    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      search(elements.input.value);
    });

    elements.close.addEventListener("click", () => closePanel({ focus: true }));

    elements.menuButton.addEventListener("click", () => {
      const open = elements.header.dataset.menuOpen !== "true";
      elements.header.dataset.menuOpen = open ? "true" : "false";
      elements.menuButton.setAttribute("aria-expanded", open ? "true" : "false");
    });

    elements.nav.addEventListener("click", closeMenu);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closePanel();
        closeMenu();
      }
    });

    document.addEventListener("pointerdown", (event) => {
      if (!elements.header.contains(event.target)) {
        closePanel();
        closeMenu();
      }
    });

    global.addEventListener("popstate", syncFromUrl);
    global.addEventListener("dictionaryroot:urlchange", syncFromUrl);
  }

  function refreshHeaderState() {
    if (!elements.header) return;
    const page = currentPageKey();
    const context = readContext();
    const contextLabel = context.meaning || context.sourceId;
    if (elements.context) {
      elements.context.hidden = !contextLabel;
      const strong = elements.context.querySelector("strong");
      if (strong) {
        strong.textContent = contextLabel;
        strong.title = contextLabel;
      }
    }
    const brandLink = elements.header.querySelector(".dictionaryroot-brand-lockup");
    if (brandLink) brandLink.setAttribute("href", buildHref("index.html"));
    elements.nav.querySelectorAll("[data-dr-nav-page]").forEach((anchor) => {
      const active = anchor.dataset.drNavPage === page;
      if (active) anchor.setAttribute("aria-current", "page");
      else anchor.removeAttribute("aria-current");
      const item = NAV_ITEMS.find((candidate) => candidate.key === anchor.dataset.drNavPage);
      if (item) anchor.href = buildNavHref(item);
    });
  }

  function updateBrand(brand) {
    state.brand = Object.assign({}, DEFAULT_BRAND, brand || {});
    if (!state.initialized) return;
    const brandArea = elements.header.querySelector(".dictionaryroot-unified-brand-area");
    if (brandArea) brandArea.innerHTML = brandMarkup(state.brand);
    const powered = elements.header.querySelector(".dictionaryroot-powered-by strong");
    if (powered) powered.textContent = state.brand.poweredBy;
    refreshContextLinks(elements.header);
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    const header = createHeader(state.brand);
    cacheElements(header);
    const context = readContext();
    if (context.meaning || context.editorialSearch || context.coverageSearch) elements.input.value = context.meaning || context.editorialSearch || context.coverageSearch;
    updateAccountChip();
    global.addEventListener("dictionaryroot:auth-change", (event) => updateAccountChip(event.detail));
    installHistoryEvents();
    bindEvents();
    refreshContextLinks(document);
    installLinkObserver();
    document.dispatchEvent(new CustomEvent("dictionaryroot:navigation-ready", {
      detail: { page: currentPageKey(), context }
    }));
  }

  document.addEventListener("dictionaryroot:brand-ready", (event) => {
    updateBrand(event.detail && event.detail.brand);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  global.DictionaryRootNavigation = {
    readContext,
    buildHref,
    refreshContextLinks,
    search,
    currentPageKey
  };
})(window);
