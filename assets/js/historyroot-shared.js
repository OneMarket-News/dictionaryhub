(function historyRootSharedFactory(global) {
  "use strict";

  const PAGE_MAP = {
    "historyroot.html": "home",
    "history-explore-v1.html": "explore",
    "history-timeline-v1.html": "timeline",
    "history-record-v1.html": "record",
    "history-context-review-v1.html": "context-review",
    "history-sources-v1.html": "sources",
    "history-graph-v1.html": "graph"
  };

  const NAV_ITEMS = [
    { key: "home", label: "Home", href: "historyroot.html" },
    { key: "explore", label: "Explore", href: "history-explore-v1.html" },
    { key: "timeline", label: "Timeline", href: "history-timeline-v1.html" },
    { key: "sources", label: "Sources", href: "history-sources-v1.html" },
    { key: "graph", label: "Knowledge Graph", href: "history-graph-v1.html" }
  ];

  const PAGE_LABELS = {
    home: "Home",
    explore: "Search and explore",
    timeline: "Timeline",
    record: "Record",
    "context-review": "Context review",
    sources: "Sources",
    graph: "Knowledge Graph"
  };

  const TYPE_LABELS = {
    person: "Person",
    group: "Group",
    organization: "Organization",
    cultural_community: "Community",
    place: "Place",
    event: "Event",
    document: "Document",
    work: "Work",
    political_jurisdiction: "Political jurisdiction",
    entity: "Entity",
    temporal_assertion: "Chronology",
    account: "Historical account",
    claim: "Historical claim",
    evidence: "Evidence",
    interpretation: "Interpretation",
    perspective: "Perspective",
    causal_link: "Cause or consequence",
    relationship: "Relationship",
    cultural_memory: "Cultural memory",
    source: "Source"
  };

  const SOURCE_CLASS_LABELS = {
    "primary-account-later-edition": "Primary account · later edition",
    "primary-contemporary-account-later-edition":
      "Contemporary account · later edition",
    "primary-legal-document": "Primary legal document",
    "primary-manuscript-metadata": "Primary manuscript metadata",
    "primary-records-series-register": "Primary records register",
    "primary-retrospective-account": "Retrospective primary account",
    "primary-retrospective-war-narrative":
      "Retrospective war narrative",
    "modern-scholarly-analysis": "Modern scholarship",
    "tribal-institutional-perspective": "Tribal institution",
    "indigenous-organizational-perspective": "Indigenous organization",
    "indigenous-centered-institutional-analysis":
      "Indigenous-centered institutional analysis",
    "indigenous-centered-institutional-synthesis":
      "Indigenous-centered institutional synthesis",
    "government-archival-synthesis": "Government archive",
    "government-institutional-analysis": "Government analysis",
    "government-institutional-synthesis": "Government synthesis",
    "museum-memory-study": "Museum memory study",
    "museum-multiperspectival-synthesis":
      "Museum multiperspectival synthesis"
  };

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function currentFile() {
    const value = global.location.pathname.split("/").pop();
    return (value || "historyroot.html").toLocaleLowerCase();
  }

  function currentPage() {
    return PAGE_MAP[currentFile()] || "";
  }

  function element(tagName, options) {
    const settings = options || {};
    const node = document.createElement(tagName);
    if (settings.className) node.className = settings.className;
    if (settings.id) node.id = settings.id;
    if (settings.text !== undefined) node.textContent = clean(settings.text);
    if (settings.hidden) node.hidden = true;
    if (settings.attributes) {
      Object.entries(settings.attributes).forEach(([name, value]) => {
        if (value !== undefined && value !== null && value !== false) {
          node.setAttribute(name, value === true ? "" : String(value));
        }
      });
    }
    return node;
  }

  function append(parent) {
    Array.prototype.slice.call(arguments, 1).forEach((child) => {
      if (child === undefined || child === null || child === false) return;
      parent.appendChild(
        child instanceof Node
          ? child
          : document.createTextNode(String(child))
      );
    });
    return parent;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(clean(value));
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
    } catch (_) {
      return "";
    }
  }

  function externalLink(url, label) {
    const safeUrl = safeExternalUrl(url);
    if (!safeUrl) return null;
    return element("a", {
      className: "hr-external-link",
      text: label || "Open source",
      attributes: {
        href: safeUrl,
        target: "_blank",
        rel: "noopener noreferrer"
      }
    });
  }

  function humanize(value) {
    const normalized = clean(value).replace(/[_-]+/g, " ");
    return normalized
      ? normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1)
      : "";
  }

  function typeOf(record) {
    return clean(
      record &&
        (record.entityType ||
          record.recordKind ||
          record.resultType ||
          record.objectType ||
          record.type)
    )
      .replace(/^context-/, "")
      .toLocaleLowerCase();
  }

  function typeLabel(recordOrType) {
    const value =
      typeof recordOrType === "string"
        ? recordOrType
        : typeOf(recordOrType);
    return TYPE_LABELS[value] || humanize(value) || "Historical record";
  }

  function recordTitle(record) {
    return clean(
      record &&
        (record.name ||
          record.title ||
          record.label ||
          record.perspectiveName ||
          record.id)
    ) || "Untitled historical record";
  }

  function recordSummary(record) {
    return clean(
      record &&
        (record.description ||
          record.summary ||
          record.statement ||
          record.interpretation ||
          record.narrative ||
          record.content ||
          record.explanation ||
          record.notes)
    );
  }

  function aliasesOf(record) {
    const metadata =
      record && record.metadata && typeof record.metadata === "object"
        ? record.metadata
        : {};
    const values = []
      .concat(Array.isArray(record && record.alternateNames) ? record.alternateNames : [])
      .concat(Array.isArray(metadata.alternateNames) ? metadata.alternateNames : [])
      .concat(Array.isArray(record && record.aliases) ? record.aliases : []);
    const seen = new Set();
    return values
      .map((value) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return clean(value.text || value.name || value.label);
        }
        return clean(value);
      })
      .filter((value) => {
        const key = value.toLocaleLowerCase();
        if (!value || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function matchedAlias(record, query) {
    const normalized = clean(query).toLocaleLowerCase();
    if (!normalized) return "";
    return (
      aliasesOf(record).find(
        (alias) => alias.toLocaleLowerCase() === normalized
      ) || ""
    );
  }

  function dedupeRecords(records) {
    const unique = new Map();
    (records || []).forEach((record) => {
      const id = clean(record && (record.id || record.sourceId));
      if (id && !unique.has(id)) unique.set(id, record);
    });
    return Array.from(unique.values());
  }

  function recordHref(recordOrId, options) {
    const suppliedReviewHref =
      typeof recordOrId === "object" &&
      recordOrId &&
      recordOrId.metadata &&
      clean(recordOrId.metadata.reviewUrl);
    if (
      /^history-context-review-v1\.html\?[A-Za-z0-9%._~!$&'()*+,;=:@/?-]+$/.test(
        suppliedReviewHref
      )
    ) {
      return suppliedReviewHref;
    }
    const id =
      typeof recordOrId === "string"
        ? recordOrId
        : clean(recordOrId && recordOrId.id);
    const query = new URLSearchParams();
    if (id) query.set("id", id);
    if (options && options.from) query.set("from", options.from);
    return `history-record-v1.html?${query.toString()}`;
  }

  function contextReviewHref(recordId, claimId, versionId, from) {
    const query = new URLSearchParams();
    if (recordId) query.set("record", clean(recordId));
    if (claimId) query.set("claim", clean(claimId));
    if (versionId) query.set("version", clean(versionId));
    if (from) query.set("from", clean(from));
    return `history-context-review-v1.html?${query.toString()}`;
  }

  function sourceHref(sourceId) {
    const query = new URLSearchParams();
    if (sourceId) query.set("source", sourceId);
    return `history-sources-v1.html?${query.toString()}`;
  }

  function graphHref(recordId) {
    const query = new URLSearchParams();
    if (recordId) query.set("id", recordId);
    return `history-graph-v1.html?${query.toString()}`;
  }

  function timelineHref(recordId) {
    const query = new URLSearchParams();
    if (recordId) query.set("event", recordId);
    return `history-timeline-v1.html?${query.toString()}`;
  }

  function chip(label, tone, title) {
    return element("span", {
      className: "hr-chip",
      text: label,
      attributes: {
        "data-tone": tone || "neutral",
        title: title || ""
      }
    });
  }

  function statusLabel(value) {
    const status = clean(value);
    const labels = {
      "pilot-review-required": "Pilot · review required",
      "needs-review": "Needs review",
      "accessed-and-inspected": "Accessed and inspected",
      "metadata-verified-not-inspected":
        "Metadata verified · text not inspected",
      "bibliographic-only": "Bibliographic record only",
      rejected: "Not used"
    };
    return labels[status] || humanize(status);
  }

  function toneForRecord(record) {
    const type = typeOf(record);
    if (type === "claim") return "claim";
    if (type === "evidence") return "evidence";
    if (type === "interpretation") return "interpretation";
    if (type === "perspective") return "perspective";
    if (type === "causal_link") return "causal";
    if (type === "cultural_memory") return "memory";
    if (type === "source") return "source";
    return "entity";
  }

  function temporalYear(temporal) {
    const candidates = [
      temporal && temporal.exactDate,
      temporal && temporal.startDate,
      temporal && temporal.endDate,
      temporal && temporal.beforeDate,
      temporal && temporal.afterDate,
      temporal &&
        Array.isArray(temporal.proposedDates) &&
        temporal.proposedDates[0] &&
        temporal.proposedDates[0].date
    ];
    const match = candidates.map(clean).find((value) => /^\d{4}/.test(value));
    return match ? Number(match.slice(0, 4)) : null;
  }

  function temporalSortValue(temporal) {
    const year = temporalYear(temporal);
    if (year === null) return Number.POSITIVE_INFINITY;
    const exact = clean(
      temporal.exactDate ||
        temporal.startDate ||
        temporal.endDate ||
        temporal.beforeDate ||
        temporal.afterDate
    );
    if (/^\d{4}-\d{2}-\d{2}$/.test(exact)) {
      return Number(exact.replaceAll("-", ""));
    }
    return year * 10000;
  }

  function temporalPrecisionLabel(temporal) {
    if (!temporal) return "";
    const kind = clean(temporal.temporalKind);
    const explicit = clean(temporal.datePrecision);
    if (kind === "exact") return explicit ? `Exact · ${humanize(explicit)}` : "Exact date";
    if (kind === "range") return "Date range";
    if (kind === "approximate") return "Approximate date";
    if (kind === "disputed") return "Disputed chronology";
    if (kind === "multiple_proposed") return "Multiple proposed dates";
    if (kind === "before") return "Before date";
    if (kind === "after") return "After date";
    return humanize(kind) || explicit;
  }

  function temporalUncertainty(temporal) {
    return [
      temporal && temporal.startUncertainty,
      temporal && temporal.endUncertainty,
      temporal && temporal.dateNotes,
      temporal && Array.isArray(temporal.proposedDates)
        ? temporal.proposedDates
            .map((date) => clean(date.uncertainty))
            .filter(Boolean)
            .join(" ")
        : ""
    ]
      .map(clean)
      .filter(Boolean)
      .join(" ");
  }

  function scopeLabel(record) {
    const coverage = clean(record && record.metadata && record.metadata.coveragePeriod);
    const labels = {
      "background-1605-1615": "Background context",
      "background-to-core-bridge": "Background → core",
      "core-1616-1691": "Core period",
      "1692-transition": "1692 transition",
      "cultural-memory-afterlife": "Cultural-memory afterlife"
    };
    return labels[coverage] || "";
  }

  function sourceClassLabel(source) {
    const value = clean(source && source.sourceClass);
    return SOURCE_CLASS_LABELS[value] || humanize(value) || "Source";
  }

  function sourceIdsOf(record) {
    const ids = []
      .concat(Array.isArray(record && record.sourceIds) ? record.sourceIds : [])
      .concat(record && record.sourceId ? [record.sourceId] : []);
    return Array.from(new Set(ids.map(clean).filter(Boolean)));
  }

  function recordCard(record, options) {
    const settings = options || {};
    const article = element("article", {
      className: "hr-record-card",
      attributes: {
        "data-record-id": clean(record && record.id),
        "data-record-type": typeOf(record),
        "data-tone": toneForRecord(record)
      }
    });
    const heading = element("div", { className: "hr-record-card-heading" });
    const title = element("h3");
    const link = element("a", {
      text: recordTitle(record),
      attributes: { href: settings.href || recordHref(record, settings) }
    });
    append(title, link);
    append(
      heading,
      title,
      chip(typeLabel(record), toneForRecord(record))
    );
    append(article, heading);

    const alias = settings.query ? matchedAlias(record, settings.query) : "";
    if (alias) {
      append(
        article,
        element("p", {
          className: "hr-alias-match",
          text: `Matched alias: ${alias}`
        })
      );
    }

    const summary = recordSummary(record);
    if (summary) {
      append(
        article,
        element("p", { className: "hr-record-summary", text: summary })
      );
    }

    const footer = element("div", { className: "hr-record-card-meta" });
    const scope = scopeLabel(record);
    if (scope) append(footer, chip(scope, "scope"));
    if (record.dateLabel) append(footer, chip(record.dateLabel, "time"));
    if (record.confidence) {
      append(
        footer,
        chip(`Confidence: ${humanize(record.confidence)}`, "confidence")
      );
    }
    const sourceCount = sourceIdsOf(record).length;
    if (sourceCount) {
      append(
        footer,
        chip(
          `${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`,
          "source"
        )
      );
    }
    if (footer.childNodes.length) append(article, footer);
    return article;
  }

  function statePanel(kind, title, message, retryHandler) {
    const panel = element("section", {
      className: "hr-state-panel",
      attributes: {
        "data-state": kind,
        role: kind === "loading" ? "status" : "alert",
        "aria-live": kind === "loading" ? "polite" : "assertive"
      }
    });
    append(
      panel,
      element("span", {
        className: "hr-state-marker",
        text: kind === "loading" ? "Loading" : humanize(kind)
      }),
      element("h2", { text: title }),
      element("p", { text: message })
    );
    if (typeof retryHandler === "function") {
      const button = element("button", {
        className: "hr-button",
        text: "Try again",
        attributes: { type: "button" }
      });
      button.addEventListener("click", retryHandler);
      append(panel, button);
    }
    return panel;
  }

  function renderState(container, kind, title, message, retryHandler) {
    if (!container) return null;
    clear(container);
    const panel = statePanel(kind, title, message, retryHandler);
    append(container, panel);
    container.hidden = false;
    return panel;
  }

  function hideState(container) {
    if (!container) return;
    clear(container);
    container.hidden = true;
  }

  function createNavigation(manifest) {
    const header = element("header", {
      className:
        "dictionaryroot-product-bar historyroot-product-bar historyroot-unified-header",
      attributes: {
        "data-menu-open": "false",
        "data-historyroot-navigation": "v1"
      }
    });
    const inner = element("div", {
      className: "dictionaryroot-product-bar-inner historyroot-product-bar-inner"
    });
    const brand = element("a", {
      className: "dictionaryroot-brand-lockup historyroot-brand-lockup",
      attributes: {
        href: "historyroot.html",
        "aria-label": "HistoryRoot home"
      }
    });
    const logo = element("img", {
      attributes: {
        src: "assets/brand/dictionaryroot-mark.svg",
        alt: "",
        width: "42",
        height: "42"
      }
    });
    const brandCopy = element("span", {
      className: "dictionaryroot-brand-copy"
    });
    append(
      brandCopy,
      element("span", {
        className: "dictionaryroot-brand-name",
        text: manifest.customerName || "HistoryRoot"
      }),
      element("span", {
        className: "dictionaryroot-brand-tagline",
        text: "History, evidence, and memory in context."
      })
    );
    append(brand, logo, brandCopy);

    const navWrap = element("div", { className: "historyroot-nav-wrap" });
    const rootSwitcher = element("nav", {
      className: "sr-hr-root-switcher",
      attributes: { "aria-label": "SourceRoot products" }
    });
    [
      ["SourceRoot", "sourceroot.html"],
      ["Search all Roots", "sourceroot-search.html"],
      ["DictionaryRoot", "index.html"],
      ["HistoryRoot", "historyroot.html", "page"]
    ].forEach((item) => {
      append(
        rootSwitcher,
        element("a", {
          text: item[0],
          attributes: Object.assign(
            { href: item[1] },
            item[2] ? { "aria-current": item[2], "data-active-root": "HistoryRoot" } : {}
          )
        })
      );
    });
    const nav = element("nav", {
      className: "historyroot-nav",
      id: "historyrootNavigation",
      attributes: { "aria-label": "HistoryRoot experiences" }
    });
    const page = currentPage();
    NAV_ITEMS.forEach((item) => {
      append(
        nav,
        element("a", {
          text: item.label,
          attributes: Object.assign(
            { href: item.href, "data-historyroot-page": item.key },
            page === item.key ? { "aria-current": "page" } : {}
          )
        })
      );
    });
    const familyLink = element("a", {
      className: "historyroot-family-link",
      text: "DictionaryRoot",
      attributes: {
        href: "index.html",
        title: "Open DictionaryRoot"
      }
    });
    const menuButton = element("button", {
      className: "historyroot-menu-button",
      id: "historyrootMenuButton",
      text: "Menu",
      attributes: {
        type: "button",
        "aria-expanded": "false",
        "aria-controls": "historyrootNavigation"
      }
    });
    menuButton.addEventListener("click", () => {
      const open = header.dataset.menuOpen !== "true";
      header.dataset.menuOpen = String(open);
      menuButton.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", () => {
      header.dataset.menuOpen = "false";
      menuButton.setAttribute("aria-expanded", "false");
    });
    append(navWrap, rootSwitcher, nav, familyLink, menuButton);
    append(inner, brand, navWrap);
    append(header, inner);
    return header;
  }

  function injectBreadcrumb(header) {
    const existing = document.querySelector(".sr-historyroot-breadcrumbs");
    if (existing) return existing;
    const breadcrumb = element("nav", {
      className: "sr-hr-breadcrumbs sr-historyroot-breadcrumbs",
      attributes: { "aria-label": "Breadcrumb" }
    });
    const list = element("ol");
    const sourceRoot = element("li");
    append(sourceRoot, element("a", {
      text: "SourceRoot",
      attributes: { href: "sourceroot.html" }
    }));
    const historyRoot = element("li");
    append(historyRoot, element("a", {
      text: "HistoryRoot",
      attributes: { href: "historyroot.html" }
    }));
    append(list, sourceRoot, historyRoot);
    const page = currentPage();
    if (page && page !== "home") {
      const pageItem = element("li", {
        text: PAGE_LABELS[page] || humanize(page),
        attributes: { "aria-current": "page" }
      });
      append(list, pageItem);
    }
    const query = clean(new URLSearchParams(global.location.search).get("q"));
    if (query) {
      const current = list.querySelector('[aria-current="page"]');
      if (current) current.removeAttribute("aria-current");
      append(list, element("li", {
        text: query,
        attributes: { "aria-current": "page" }
      }));
    }
    append(breadcrumb, list);
    header.insertAdjacentElement("afterend", breadcrumb);
    return breadcrumb;
  }

  function injectSkipLink() {
    if (document.querySelector(".dictionaryroot-skip-link")) return;
    const main = document.querySelector("main");
    if (!main) return;
    if (!main.id) main.id = "main-content";
    const link = element("a", {
      className: "dictionaryroot-skip-link",
      text: "Skip to content",
      attributes: { href: `#${main.id}` }
    });
    document.body.insertBefore(link, document.body.firstChild);
  }

  function injectFooter(manifest) {
    if (document.querySelector(".historyroot-footer")) return;
    const footer = element("footer", { className: "historyroot-footer" });
    const inner = element("div", { className: "historyroot-footer-inner" });
    append(
      inner,
      element("p", {
        text:
          (manifest.dataset && manifest.dataset.disclaimer) ||
          HistoryRootApi.DEFAULT_MANIFEST.dataset.disclaimer
      })
    );
    const links = element("nav", {
      attributes: { "aria-label": "Root product family" }
    });
    append(
      links,
      element("a", {
        text: "HistoryRoot",
        attributes: { href: "historyroot.html" }
      }),
      element("a", {
        text: "DictionaryRoot",
        attributes: { href: "index.html" }
      }),
      element("a", {
        text: "Search all Roots",
        attributes: { href: "sourceroot-search.html" }
      }),
      element("span", { text: "Powered by SourceRoot" })
    );
    append(inner, links);
    append(footer, inner);
    document.body.appendChild(footer);
  }

  function updateUrl(values, options) {
    const url = new URL(global.location.href);
    Object.entries(values || {}).forEach(([key, value]) => {
      const normalized = clean(value);
      if (!normalized || normalized === "all" || normalized === "false") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, normalized);
      }
    });
    global.history[(options && options.replace) ? "replaceState" : "pushState"](
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  function textMatches(record, query) {
    const normalized = clean(query).toLocaleLowerCase();
    if (!normalized) return true;
    return [
      recordTitle(record),
      recordSummary(record),
      aliasesOf(record).join(" "),
      record && record.id,
      record && record.publisher,
      record && record.sourceClass,
      record && record.citation,
      record && record.limitations
    ]
      .map(clean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized);
  }

  function displayError(error) {
    const code = clean(error && error.details && error.details.code);
    if (code === "TIMEOUT") {
      return {
        kind: "timeout",
        title: "The request timed out",
        message:
          "SourceRoot did not respond in time. The dataset may still be available."
      };
    }
    if (
      code === "MALFORMED_RESPONSE" ||
      code === "CONTEXT_RECORD_NOT_FOUND"
    ) {
      return {
        kind: "error",
        title: "The response could not be used",
        message: clean(error && error.message)
      };
    }
    return {
      kind: "offline",
      title: "HistoryRoot is temporarily offline",
      message:
        "The customer experience could not reach the live SourceRoot API. No fallback historical records are displayed."
    };
  }

  async function requireDataset(client) {
    const status = await client.datasetAvailable();
    if (!status.available) {
      throw new HistoryRootApi.HistoryRootApiError(
        "The Plymouth pilot dataset is not imported.",
        { code: "DATASET_NOT_IMPORTED" }
      );
    }
    return status;
  }

  function displayDatasetError(error) {
    const code = clean(error && error.details && error.details.code);
    if (code === "DATASET_NOT_IMPORTED") {
      return {
        kind: "dataset-missing",
        title: "The Plymouth dataset is not available",
        message:
          "SourceRoot is online, but this HistoryRoot pilot has not been imported. No historical fallback data is shown."
      };
    }
    return displayError(error);
  }

  async function initialize() {
    const manifest = await HistoryRootApi.loadManifest();
    const client = new HistoryRootApi.HistoryRootApiClient(manifest);
    document.body.classList.add(
      "dictionaryroot-customer-page",
      "historyroot-customer-page"
    );
    injectSkipLink();
    const header = createNavigation(manifest);
    document.body.insertBefore(header, document.body.firstChild);
    injectBreadcrumb(header);
    injectFooter(manifest);
    document.dispatchEvent(
      new CustomEvent("historyroot:ready", {
        detail: { manifest, client, page: currentPage() }
      })
    );
    return { manifest, client };
  }

  global.HistoryRootShared = {
    PAGE_MAP,
    NAV_ITEMS,
    TYPE_LABELS,
    SOURCE_CLASS_LABELS,
    clean,
    currentFile,
    currentPage,
    element,
    append,
    clear,
    safeExternalUrl,
    externalLink,
    humanize,
    typeOf,
    typeLabel,
    recordTitle,
    recordSummary,
    aliasesOf,
    matchedAlias,
    dedupeRecords,
    recordHref,
    contextReviewHref,
    sourceHref,
    graphHref,
    timelineHref,
    chip,
    statusLabel,
    toneForRecord,
    temporalYear,
    temporalSortValue,
    temporalPrecisionLabel,
    temporalUncertainty,
    scopeLabel,
    sourceClassLabel,
    sourceIdsOf,
    recordCard,
    statePanel,
    renderState,
    hideState,
    updateUrl,
    textMatches,
    displayError,
    requireDataset,
    displayDatasetError,
    initialize
  };
})(window);
