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
    graph: { initialDepth: 1, initialNodeLimit: 40, maximumNodeLimit: 150 }
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
        graph: Object.assign({}, DEFAULT_MANIFEST.graph, loaded.graph || {})
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


  function normalizeMeaningTerm(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function lemmasFrom(record) {
    const metadata = record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
    const lemmas = Array.isArray(metadata.lemmas) ? metadata.lemmas : [];
    return lemmas.map((item) => String(item || "").trim()).filter(Boolean);
  }

  function meaningMatchRank(record, query) {
    const target = normalizeMeaningTerm(query);
    const title = normalizeMeaningTerm(record && record.title);
    const lemmas = lemmasFrom(record).map(normalizeMeaningTerm);
    const summary = normalizeMeaningTerm(record && record.summary);
    if (!target) return 99;
    if (title === target) return 0;
    if (lemmas.includes(target)) return 1;
    if (title.startsWith(target)) return 2;
    if (lemmas.some((lemma) => lemma.startsWith(target))) return 3;
    if (title.includes(target)) return 4;
    if (lemmas.some((lemma) => lemma.includes(target))) return 5;
    if (summary.includes(target)) return 6;
    return 10;
  }

  function rankMeaningResults(records, query) {
    return (records || []).map((record, index) => ({ record, index, rank: meaningMatchRank(record, query) }))
      .sort((left, right) => left.rank - right.rank
        || String(left.record.title || "").localeCompare(String(right.record.title || ""))
        || left.index - right.index)
      .map((item) => item.record);
  }

  function exactMeaningResults(records, query) {
    return rankMeaningResults(records, query).filter((record) => meaningMatchRank(record, query) <= 1);
  }

  function preferredMeaningLabel(record, query) {
    const target = normalizeMeaningTerm(query);
    if (!target) return String(record && record.title || "Untitled concept");
    const exactLemma = lemmasFrom(record).find((lemma) => normalizeMeaningTerm(lemma) === target);
    return exactLemma || String(record && record.title || query);
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
      return this.search(query, Object.assign({ type: "node", limit: 100 }, normalizeParams(params)));
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

    source(sourceId) {
      return this.request(`/sources/${encodeURIComponent(sourceId)}`);
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
    buildQuery,
    mapWithConcurrency,
    normalizeMeaningTerm,
    lemmasFrom,
    meaningMatchRank,
    rankMeaningResults,
    exactMeaningResults,
    preferredMeaningLabel
  };
})(window);
