(function dictionaryRootApiFactory(global) {
  "use strict";

  const DEFAULT_MANIFEST = {
    customerId: "dictionaryroot",
    customerName: "DictionaryRoot",
    domain: "DictionaryRoot",
    environment: "development",
    apiBaseUrl: "http://localhost:3000/api/v1",
    bundleId: "dictionaryroot-oewn-2025-pilot-500",
    defaults: { searchTerm: "knowledge", pageSize: 25 },
    graph: { initialDepth: 1, initialNodeLimit: 40, maximumNodeLimit: 150, neighborsPerExpansion: 18 },
    dynamicExpansion: { defaultDepth: 1, maximumDepth: 2, maximumVisibleNodes: 72, maximumBranches: 8 }
  };

  class DictionaryRootApiError extends Error {
    constructor(message, details) {
      super(message);
      this.name = "DictionaryRootApiError";
      this.details = details || {};
    }
  }

  function trimSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function normalizeParams(params) {
    const normalized = Object.assign({}, params || {});
    if (normalized.pageSize !== undefined && normalized.limit === undefined) {
      normalized.limit = normalized.pageSize;
    }
    delete normalized.pageSize;
    return normalized;
  }

  function buildQuery(params) {
    const query = new URLSearchParams();
    Object.entries(normalizeParams(params)).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((entry) => query.append(key, String(entry)));
      } else {
        query.set(key, String(value));
      }
    });
    const output = query.toString();
    return output ? `?${output}` : "";
  }

  async function loadManifest(path) {
    const manifestPath = path || "config/customers/dictionaryroot.json";
    try {
      const response = await fetch(manifestPath, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const loaded = await response.json();
      return Object.assign({}, DEFAULT_MANIFEST, loaded, {
        defaults: Object.assign({}, DEFAULT_MANIFEST.defaults, loaded.defaults || {}),
        graph: Object.assign({}, DEFAULT_MANIFEST.graph, loaded.graph || {}),
        dynamicExpansion: Object.assign({}, DEFAULT_MANIFEST.dynamicExpansion, loaded.dynamicExpansion || {})
      });
    } catch (error) {
      console.warn("DictionaryRoot manifest fallback active:", error);
      return Object.assign({}, DEFAULT_MANIFEST);
    }
  }

  function extractItems(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    const candidates = ["items", "results", "nodes", "assertions", "edges", "sources", "revisions", "bundles"];
    for (const key of candidates) {
      if (Array.isArray(payload[key])) return payload[key];
    }
    return [];
  }

  function extractTotal(payload) {
    if (!payload) return 0;
    const direct = [payload.total, payload.totalItems, payload.count];
    const pagination = payload.pagination || payload.meta || {};
    const nested = [pagination.total, pagination.totalItems, pagination.count];
    const value = direct.concat(nested).find((entry) => Number.isFinite(Number(entry)));
    if (value !== undefined) return Number(value);
    return extractItems(payload).length;
  }

  function edgeItems(payload) {
    if (!payload) return [];
    const incoming = Array.isArray(payload.incoming) ? payload.incoming : [];
    const outgoing = Array.isArray(payload.outgoing) ? payload.outgoing : [];
    if (incoming.length || outgoing.length) return incoming.concat(outgoing);
    return extractItems(payload);
  }

  function normalizeMeaningText(value) {
    const original = String(value == null ? "" : value);
    const normalized = typeof original.normalize === "function" ? original.normalize("NFKC") : original;
    return normalized
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase();
  }

  function displayMeaningLabel(value) {
    return String(value == null ? "" : value)
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function meaningLabels(record) {
    const metadata = record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
    const labels = [];

    function add(value) {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach(add);
        return;
      }
      const label = displayMeaningLabel(value);
      if (!label) return;
      const key = normalizeMeaningText(label);
      if (!labels.some((entry) => entry.key === key)) labels.push({ key, label });
    }

    add(record && record.title);
    add(record && record.name);
    add(record && record.label);
    add(record && record.lemma);
    add(record && record.preferredLemma);
    add(record && record.lemmas);
    add(record && record.aliases);
    add(record && record.synonyms);
    add(metadata.preferredLabel);
    add(metadata.preferredLemma);
    add(metadata.lemma);
    add(metadata.lemmas);
    add(metadata.aliases);
    add(metadata.synonyms);
    add(metadata.words);

    return labels;
  }

  function containsMeaningPhrase(value, query) {
    const haystack = ` ${normalizeMeaningText(value)} `;
    const needle = ` ${normalizeMeaningText(query)} `;
    return needle.trim().length > 0 && haystack.includes(needle);
  }

  function preferredMeaningLabel(record, query) {
    const labels = meaningLabels(record);
    const normalizedQuery = normalizeMeaningText(query);
    if (normalizedQuery) {
      const exact = labels.find((entry) => entry.key === normalizedQuery);
      if (exact) return exact.label;
    }

    const canonical = displayMeaningLabel(
      record && (record.title || record.name || record.label || record.lemma || record.preferredLemma)
    );
    if (canonical) return canonical;
    if (labels.length) return labels[0].label;
    return displayMeaningLabel(record && (record.id || record.nodeId)) || "Untitled meaning";
  }

  function meaningMatchRank(record, query) {
    const normalizedQuery = normalizeMeaningText(query);
    if (!normalizedQuery) return 50;

    const labels = meaningLabels(record);
    const title = normalizeMeaningText(record && (record.title || record.name || record.label));
    if (title === normalizedQuery) return 0;
    if (labels.some((entry) => entry.key === normalizedQuery)) return 1;

    if (title.startsWith(`${normalizedQuery} `)) return 2;
    if (labels.some((entry) => entry.key.startsWith(`${normalizedQuery} `))) return 3;

    if (containsMeaningPhrase(title, normalizedQuery)) return 4;
    if (labels.some((entry) => containsMeaningPhrase(entry.key, normalizedQuery))) return 5;

    if (title.includes(normalizedQuery)) return 6;
    if (labels.some((entry) => entry.key.includes(normalizedQuery))) return 7;

    const descriptiveText = [
      record && record.summary,
      record && record.body,
      record && record.description,
      record && record.notes
    ].filter(Boolean).join(" ");
    if (containsMeaningPhrase(descriptiveText, normalizedQuery)) return 8;
    if (normalizeMeaningText(descriptiveText).includes(normalizedQuery)) return 9;

    const identifier = normalizeMeaningText(record && (record.id || record.nodeId));
    if (identifier.includes(normalizedQuery)) return 10;
    return 99;
  }

  function exactMeaningResults(items, query) {
    return (Array.isArray(items) ? items : extractItems(items))
      .filter((item) => meaningMatchRank(item, query) <= 1);
  }

  function rankMeaningResults(items, query) {
    return (Array.isArray(items) ? items.slice() : extractItems(items).slice())
      .map((item, index) => ({ item, index, rank: meaningMatchRank(item, query) }))
      .sort((left, right) => {
        if (left.rank !== right.rank) return left.rank - right.rank;
        const leftLabel = preferredMeaningLabel(left.item, query);
        const rightLabel = preferredMeaningLabel(right.item, query);
        const labelOrder = leftLabel.localeCompare(rightLabel, undefined, { sensitivity: "base" });
        if (labelOrder !== 0) return labelOrder;
        const leftId = String(left.item && (left.item.id || left.item.nodeId) || "");
        const rightId = String(right.item && (right.item.id || right.item.nodeId) || "");
        const idOrder = leftId.localeCompare(rightId, undefined, { sensitivity: "base" });
        return idOrder !== 0 ? idOrder : left.index - right.index;
      })
      .map((entry) => entry.item);
  }


  function extractTotalPages(payload, limit) {
    if (!payload) return 0;
    const direct = [payload.totalPages, payload.pageCount];
    const pagination = payload.pagination || payload.meta || {};
    const nested = [pagination.totalPages, pagination.pageCount];
    const value = direct.concat(nested).find((entry) => Number.isFinite(Number(entry)));
    if (value !== undefined) return Number(value);
    const pageLimit = Number(payload.limit || pagination.limit || limit || extractItems(payload).length || 1);
    const total = extractTotal(payload);
    return total === 0 ? 0 : Math.ceil(total / Math.max(1, pageLimit));
  }

  function recordUsesSource(record, sourceId) {
    const expected = String(sourceId || "");
    return Boolean(record && Array.isArray(record.sourceIds) && record.sourceIds.some((entry) => String(entry) === expected));
  }

  async function mapWithConcurrency(items, limit, mapper) {
    const output = new Array(items.length);
    let index = 0;
    const workerCount = Math.max(1, Math.min(Number(limit) || 6, items.length || 1));
    async function worker() {
      while (index < items.length) {
        const current = index;
        index += 1;
        output[current] = await mapper(items[current], current);
      }
    }
    await Promise.all(Array.from({ length: workerCount }, worker));
    return output;
  }

  class DictionaryRootApiClient {
    constructor(manifest, options) {
      this.manifest = Object.assign({}, DEFAULT_MANIFEST, manifest || {});
      this.baseUrl = trimSlash(this.manifest.apiBaseUrl);
      this.serviceOrigin = this.baseUrl.replace(/\/api\/v1$/i, "");
      this.timeoutMs = Number((options && options.timeoutMs) || 12000);
    }

    async request(path, options) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const started = performance.now();
      const url = /^https?:\/\//i.test(path)
        ? path
        : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

      try {
        const response = await fetch(url, Object.assign({
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal
        }, options || {}));

        const text = await response.text();
        let payload = null;
        if (text) {
          try { payload = JSON.parse(text); } catch (_) { payload = { message: text }; }
        }

        if (!response.ok) {
          throw new DictionaryRootApiError(
            payload && payload.message ? payload.message : `Request failed with HTTP ${response.status}`,
            { status: response.status, url, payload }
          );
        }

        return {
          data: payload,
          response,
          durationMs: Math.round((performance.now() - started) * 10) / 10
        };
      } catch (error) {
        if (error && error.name === "AbortError") {
          throw new DictionaryRootApiError("The knowledge service took too long to respond.", { url, timeoutMs: this.timeoutMs });
        }
        if (error instanceof DictionaryRootApiError) throw error;
        throw new DictionaryRootApiError("DictionaryRoot could not reach its knowledge service.", { url, cause: error });
      } finally {
        clearTimeout(timer);
      }
    }

    health() {
      return this.request(`${this.serviceOrigin}/health`);
    }

    importedBundle() {
      return this.request(`/import${buildQuery({ page: 1, limit: 1, bundleId: this.manifest.bundleId })}`);
    }

    list(resource, params) {
      const query = Object.assign({ page: 1, limit: 25, bundleId: this.manifest.bundleId }, normalizeParams(params));
      return this.request(`/${resource}${buildQuery(query)}`);
    }

    search(query, params) {
      return this.request(`/search${buildQuery(Object.assign({
        q: query,
        bundleId: this.manifest.bundleId,
        domain: this.manifest.domain,
        page: 1,
        limit: 20
      }, normalizeParams(params)))}`);
    }

    searchNodes(query, params) {
      return this.search(query, Object.assign({ type: "node" }, normalizeParams(params)));
    }

    node(nodeId) {
      return this.request(`/nodes/${encodeURIComponent(nodeId)}`);
    }

    nodeAssertions(nodeId) {
      return this.request(`/nodes/${encodeURIComponent(nodeId)}/assertions`);
    }

    nodeEdges(nodeId) {
      return this.request(`/nodes/${encodeURIComponent(nodeId)}/edges`);
    }

    dynamicNeighborhood(nodeId, params) {
      return this.request(`/dictionaryroot/lexicon/neighborhood/${encodeURIComponent(nodeId)}${buildQuery(Object.assign({
        depth: 1,
        limit: 40,
        bundleId: this.manifest.bundleId
      }, normalizeParams(params)))}`);
    }

    source(sourceId) {
      return this.request(`/sources/${encodeURIComponent(sourceId)}`);
    }


    async listAll(resource, params, options) {
      const settings = Object.assign({ limit: 100, concurrency: 4, maxPages: 500 }, options || {});
      const firstResult = await this.list(resource, Object.assign({}, params || {}, { page: 1, limit: settings.limit }));
      const firstItems = extractItems(firstResult.data);
      const totalPages = Math.min(extractTotalPages(firstResult.data, settings.limit), settings.maxPages);
      if (totalPages <= 1) {
        return {
          items: firstItems,
          total: extractTotal(firstResult.data),
          totalPages: extractTotalPages(firstResult.data, settings.limit),
          complete: true,
          durationMs: firstResult.durationMs
        };
      }

      const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
      const pageResults = await mapWithConcurrency(remainingPages, settings.concurrency, async (page) =>
        this.list(resource, Object.assign({}, params || {}, { page, limit: settings.limit }))
      );
      const items = firstItems.concat(pageResults.flatMap((result) => extractItems(result.data)));
      const actualTotalPages = extractTotalPages(firstResult.data, settings.limit);
      return {
        items,
        total: extractTotal(firstResult.data),
        totalPages: actualTotalPages,
        complete: totalPages >= actualTotalPages,
        durationMs: firstResult.durationMs + pageResults.reduce((sum, result) => sum + Number(result.durationMs || 0), 0)
      };
    }

    sources(params, options) {
      return this.listAll("sources", params, options);
    }

    async listSourceLinkedRecords(resource, sourceId, options) {
      const settings = Object.assign({
        limit: 100,
        concurrency: 4,
        maxPages: 12,
        maxItems: 80,
        singleSourceBundle: false
      }, options || {});
      const firstResult = await this.list(resource, { page: 1, limit: settings.limit, sourceId });
      const firstPageItems = extractItems(firstResult.data);
      const firstMatches = firstPageItems.filter((record) => recordUsesSource(record, sourceId));
      const registryTotal = extractTotal(firstResult.data);
      const registryTotalPages = extractTotalPages(firstResult.data, settings.limit);
      const allFirstPageRecordsMatch = firstPageItems.length > 0 && firstMatches.length === firstPageItems.length;

      if (settings.singleSourceBundle && allFirstPageRecordsMatch) {
        return {
          items: firstMatches.slice(0, settings.maxItems),
          total: registryTotal,
          totalIsExact: true,
          complete: registryTotal <= firstMatches.length,
          scannedPages: 1,
          registryTotal,
          registryTotalPages,
          durationMs: firstResult.durationMs,
          strategy: "single-source-bundle"
        };
      }

      const pagesToScan = Math.max(1, Math.min(registryTotalPages || 1, settings.maxPages));
      const remainingPages = Array.from({ length: Math.max(0, pagesToScan - 1) }, (_, index) => index + 2);
      const pageResults = await mapWithConcurrency(remainingPages, settings.concurrency, async (page) =>
        this.list(resource, { page, limit: settings.limit, sourceId })
      );
      const scannedItems = firstPageItems.concat(pageResults.flatMap((result) => extractItems(result.data)));
      const matches = scannedItems.filter((record) => recordUsesSource(record, sourceId));
      const complete = pagesToScan >= registryTotalPages;
      return {
        items: matches.slice(0, settings.maxItems),
        total: complete ? matches.length : null,
        totalIsExact: complete,
        complete,
        scannedPages: pagesToScan,
        registryTotal,
        registryTotalPages,
        durationMs: firstResult.durationMs + pageResults.reduce((sum, result) => sum + Number(result.durationMs || 0), 0),
        strategy: complete ? "complete-registry-scan" : "bounded-registry-scan"
      };
    }

    async sourceExperience(sourceId, options) {
      const settings = Object.assign({
        singleSourceBundle: false,
        maxAssertionItems: 80,
        maxEdgeItems: 60,
        maxNodeItems: 80,
        maxPages: 12
      }, options || {});
      const sourceResult = await this.source(sourceId);
      const [assertionResult, edgeResult] = await Promise.all([
        this.listSourceLinkedRecords("assertions", sourceId, {
          singleSourceBundle: settings.singleSourceBundle,
          maxItems: settings.maxAssertionItems,
          maxPages: settings.maxPages
        }),
        this.listSourceLinkedRecords("edges", sourceId, {
          singleSourceBundle: settings.singleSourceBundle,
          maxItems: settings.maxEdgeItems,
          maxPages: settings.maxPages
        })
      ]);

      const nodeIds = Array.from(new Set(
        assertionResult.items.map((item) => item.nodeId)
          .concat(edgeResult.items.flatMap((item) => [item.fromNodeId, item.toNodeId]))
          .filter(Boolean)
      )).slice(0, settings.maxNodeItems);
      const nodes = await this.nodesByIds(nodeIds, { concurrency: 6 });

      return {
        source: sourceResult.data,
        assertions: assertionResult.items,
        assertionTotal: assertionResult.total,
        assertionTotalIsExact: assertionResult.totalIsExact,
        assertionScan: assertionResult,
        edges: edgeResult.items,
        edgeTotal: edgeResult.total,
        edgeTotalIsExact: edgeResult.totalIsExact,
        edgeScan: edgeResult,
        nodes,
        durationMs: Number(sourceResult.durationMs || 0) + Number(assertionResult.durationMs || 0) + Number(edgeResult.durationMs || 0)
      };
    }

    async concept(nodeId) {
      const [nodeResult, assertionsResult, edgesResult] = await Promise.all([
        this.node(nodeId),
        this.nodeAssertions(nodeId),
        this.nodeEdges(nodeId)
      ]);
      const node = nodeResult.data;
      const assertions = extractItems(assertionsResult.data);
      const edges = edgeItems(edgesResult.data);
      const sourceIds = Array.from(new Set(
        (node && Array.isArray(node.sourceIds) ? node.sourceIds : [])
          .concat(assertions.flatMap((item) => Array.isArray(item.sourceIds) ? item.sourceIds : []))
      ));
      const sources = (await mapWithConcurrency(sourceIds, 4, async (sourceId) => {
        try { return (await this.source(sourceId)).data; } catch (_) { return null; }
      })).filter(Boolean);
      return {
        node,
        assertions,
        edges,
        incoming: edgesResult.data && Array.isArray(edgesResult.data.incoming) ? edgesResult.data.incoming : [],
        outgoing: edgesResult.data && Array.isArray(edgesResult.data.outgoing) ? edgesResult.data.outgoing : [],
        sources,
        durationMs: nodeResult.durationMs + assertionsResult.durationMs + edgesResult.durationMs
      };
    }

    async nodesByIds(nodeIds, options) {
      const uniqueIds = Array.from(new Set((nodeIds || []).filter(Boolean)));
      const concurrency = Number((options && options.concurrency) || 6);
      const results = await mapWithConcurrency(uniqueIds, concurrency, async (nodeId) => {
        try { return (await this.node(nodeId)).data; } catch (_) { return null; }
      });
      return results.filter(Boolean);
    }
  }

  global.DictionaryRootApi = {
    DEFAULT_MANIFEST,
    DictionaryRootApiClient,
    DictionaryRootApiError,
    loadManifest,
    extractItems,
    extractTotal,
    edgeItems,
    normalizeMeaningText,
    preferredMeaningLabel,
    meaningMatchRank,
    exactMeaningResults,
    rankMeaningResults,
    extractTotalPages,
    recordUsesSource,
    buildQuery,
    mapWithConcurrency
  };
})(window);
