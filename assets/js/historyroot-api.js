(function historyRootApiFactory(global) {
  "use strict";

  const DEFAULT_MANIFEST = {
    customerId: "historyroot",
    customerName: "HistoryRoot",
    domain: "HistoryRoot",
    apiBaseUrl: "http://localhost:3000/api/v1",
    bundleId: "historyroot-plymouth-knowledge-dataset-v1",
    dataset: {
      id: "historyroot-plymouth-knowledge-dataset-v1",
      name: "Plymouth and Regional Context",
      version: "1.0.0",
      coreStartYear: 1616,
      coreEndYear: 1691,
      transitionEndYear: 1692,
      disclaimer:
        "A machine-assisted pilot dataset awaiting further historical, editorial, and tribal review."
    },
    defaults: {
      pageSize: 24,
      searchTerm: "Plymouth",
      graphCenterId: "historyroot-plymouth-place-patuxet-plymouth"
    },
    featuredRecordIds: [],
    graph: {
      initialNodeLimit: 18,
      maximumNodeLimit: 30
    }
  };

  const COLLECTION_PATHS = {
    entities: "entities",
    temporalAssertions: "temporal-assertions",
    accounts: "accounts",
    claims: "claims",
    evidence: "evidence",
    interpretations: "interpretations",
    perspectives: "perspectives",
    causalLinks: "causes-consequences",
    relationships: "relationships",
    culturalMemories: "cultural-memories"
  };

  class HistoryRootApiError extends Error {
    constructor(message, details) {
      super(message);
      this.name = "HistoryRootApiError";
      this.details = details || {};
    }
  }

  function trimSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function resolveLocalApiBaseUrl(value) {
    const configured = trimSlash(value);
    try {
      if (!global.location || !global.location.hostname) return configured;
      const parsed = new URL(configured, global.location.href);
      const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
      if (
        global.location.protocol === "http:" &&
        loopback.has(global.location.hostname) &&
        loopback.has(parsed.hostname)
      ) {
        parsed.hostname = global.location.hostname;
      }
      return trimSlash(parsed.toString());
    } catch (_) {
      return configured;
    }
  }

  function buildQuery(params) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((entry) => query.append(key, String(entry)));
        return;
      }
      query.set(key, String(value));
    });
    const serialized = query.toString();
    return serialized ? `?${serialized}` : "";
  }

  function itemsFrom(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    const keys = [
      "items",
      "results",
      "entities",
      "temporalAssertions",
      "accounts",
      "claims",
      "evidence",
      "interpretations",
      "perspectives",
      "causesConsequences",
      "relationships",
      "culturalMemories",
      "sources",
      "bundles"
    ];
    for (const key of keys) {
      if (Array.isArray(payload[key])) return payload[key];
    }
    return [];
  }

  function totalFrom(payload) {
    if (!payload) return 0;
    const value = [payload.total, payload.count, payload.totalItems].find(
      (candidate) => Number.isFinite(Number(candidate))
    );
    return value === undefined ? itemsFrom(payload).length : Number(value);
  }

  function totalPagesFrom(payload, limit) {
    const direct = Number(payload && payload.totalPages);
    if (Number.isFinite(direct) && direct >= 0) return direct;
    const total = totalFrom(payload);
    return total === 0 ? 0 : Math.ceil(total / limit);
  }

  async function loadManifest(path) {
    const manifestPath = path || "config/customers/historyroot.json";
    try {
      const response = await fetch(manifestPath, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const loaded = await response.json();
      const manifest = Object.assign({}, DEFAULT_MANIFEST, loaded, {
        dataset: Object.assign({}, DEFAULT_MANIFEST.dataset, loaded.dataset || {}),
        defaults: Object.assign({}, DEFAULT_MANIFEST.defaults, loaded.defaults || {}),
        graph: Object.assign({}, DEFAULT_MANIFEST.graph, loaded.graph || {})
      });
      manifest.apiBaseUrl = resolveLocalApiBaseUrl(manifest.apiBaseUrl);
      return manifest;
    } catch (_) {
      const manifest = Object.assign({}, DEFAULT_MANIFEST, {
        dataset: Object.assign({}, DEFAULT_MANIFEST.dataset),
        defaults: Object.assign({}, DEFAULT_MANIFEST.defaults),
        graph: Object.assign({}, DEFAULT_MANIFEST.graph),
        featuredRecordIds: []
      });
      manifest.apiBaseUrl = resolveLocalApiBaseUrl(manifest.apiBaseUrl);
      return manifest;
    }
  }

  async function mapWithConcurrency(values, limit, mapper) {
    const output = new Array(values.length);
    let cursor = 0;
    const workerCount = Math.max(1, Math.min(limit, values.length));
    async function worker() {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        output[index] = await mapper(values[index], index);
      }
    }
    await Promise.all(Array.from({ length: workerCount }, worker));
    return output;
  }

  class HistoryRootApiClient {
    constructor(manifest, options) {
      this.manifest = Object.assign({}, DEFAULT_MANIFEST, manifest || {});
      this.baseUrl = trimSlash(this.manifest.apiBaseUrl);
      this.serviceOrigin = this.baseUrl.replace(/\/api\/v1$/i, "");
      this.timeoutMs = Number((options && options.timeoutMs) || 12000);
      this.onDiagnostic = options && options.onDiagnostic;
      this.cache = new Map();
    }

    async request(path, options) {
      const settings = Object.assign(
        { method: "GET", cache: true, timeoutMs: this.timeoutMs },
        options || {}
      );
      const url = /^https?:\/\//i.test(path)
        ? path
        : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
      const cacheKey = `${settings.method}:${url}`;
      if (settings.method === "GET" && settings.cache && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const requestPromise = (async () => {
        try {
          if (!global.SourceRootApiLayer) {
            throw new Error("The shared SourceRoot API layer is unavailable.");
          }
          const sharedOptions = {
            method: settings.method,
            cache: "no-store",
            credentials: "include",
            headers: Object.assign({ Accept: "application/json" }, settings.headers || {}),
            body: settings.body,
            signal: settings.signal,
            timeoutMs: settings.timeoutMs,
            onDiagnostic: this.onDiagnostic
          };
          if (Object.prototype.hasOwnProperty.call(settings, "json")) {
            sharedOptions.json = settings.json;
          }
          const result = await global.SourceRootApiLayer.request(url, sharedOptions);
          return result.data;
        } catch (error) {
          if (error instanceof HistoryRootApiError) throw error;
          if (error && error.category === "invalid_response") {
            throw new HistoryRootApiError(
              "The knowledge service returned a malformed response.",
              {
                code: "MALFORMED_RESPONSE",
                status: error.status,
                url
              }
            );
          }
          if (error && error.category === "timeout") {
            throw new HistoryRootApiError(
              "The knowledge service took too long to respond.",
              { code: "TIMEOUT", url }
            );
          }
          if (error && error.category === "aborted") {
            throw new HistoryRootApiError(
              "The knowledge service request was cancelled.",
              { code: "ABORTED", url }
            );
          }
          if (error && [
            "api_error",
            "unauthorized",
            "forbidden",
            "not_found",
            "conflict",
            "rate_limited",
            "server_error"
          ].includes(error.category)) {
            throw new HistoryRootApiError(
              error.message,
              {
                code: error.code || "REQUEST_FAILED",
                status: error.status,
                payload: error.payload,
                category: error.category,
                requestId: error.requestId,
                responseRequestId: error.responseRequestId,
                url
              }
            );
          }
          throw new HistoryRootApiError(
            "HistoryRoot could not reach the SourceRoot knowledge service.",
            {
              code: "OFFLINE",
              category: error && error.category ? error.category : "network_error",
              requestId: error && error.requestId,
              responseRequestId: error && error.responseRequestId,
              url
            }
          );
        }
      })();

      if (settings.method === "GET" && settings.cache) {
        this.cache.set(cacheKey, requestPromise);
        requestPromise.catch(() => this.cache.delete(cacheKey));
      }
      return requestPromise;
    }

    clearCache() {
      this.cache.clear();
    }

    createAbortController() {
      return new AbortController();
    }

    health() {
      return this.request(`${this.serviceOrigin}/health`, { cache: false });
    }

    bundleStatus() {
      return this.request(
        `/import${buildQuery({
          page: 1,
          limit: 1,
          bundleId: this.manifest.bundleId
        })}`,
        { cache: false }
      );
    }

    async datasetAvailable() {
      const payload = await this.bundleStatus();
      return {
        available:
          totalFrom(payload) > 0 &&
          itemsFrom(payload).some(
            (bundle) => bundle.bundleId === this.manifest.bundleId
          ),
        bundle: itemsFrom(payload)[0] || null
      };
    }

    context(collection, params) {
      const path = COLLECTION_PATHS[collection] || collection;
      return this.request(
        `/context/${path}${buildQuery(
          Object.assign(
            {
              page: 1,
              limit: 25,
              bundleId: this.manifest.bundleId,
              domain: this.manifest.domain
            },
            params || {}
          )
        )}`
      );
    }

    async contextAll(collection, params, options) {
      const settings = Object.assign(
        { limit: 100, maxPages: 10, concurrency: 3 },
        options || {}
      );
      const first = await this.context(
        collection,
        Object.assign({}, params || {}, { page: 1, limit: settings.limit })
      );
      const totalPages = Math.min(
        totalPagesFrom(first, settings.limit),
        settings.maxPages
      );
      const pages = Array.from(
        { length: Math.max(0, totalPages - 1) },
        (_, index) => index + 2
      );
      const remaining = await mapWithConcurrency(
        pages,
        settings.concurrency,
        (page) =>
          this.context(
            collection,
            Object.assign({}, params || {}, {
              page,
              limit: settings.limit
            })
          )
      );
      return {
        items: itemsFrom(first).concat(
          remaining.flatMap((payload) => itemsFrom(payload))
        ),
        total: totalFrom(first),
        complete: totalPages >= totalPagesFrom(first, settings.limit)
      };
    }

    record(recordId) {
      return this.request(
        `/context/records/${encodeURIComponent(recordId)}`
      );
    }

    contextRecordReview(recordId, params, options) {
      return this.request(
        `/context/review/records/${encodeURIComponent(recordId)}${buildQuery(
          params || {}
        )}`,
        Object.assign({ cache: false }, options || {})
      );
    }

    contextClaimReview(claimId, params, options) {
      return this.request(
        `/context/review/claims/${encodeURIComponent(claimId)}${buildQuery(
          params || {}
        )}`,
        Object.assign({ cache: false }, options || {})
      );
    }

    search(query, params) {
      return this.request(
        `/search${buildQuery(
          Object.assign(
            {
              q: query,
              bundleId: this.manifest.bundleId,
              domain: this.manifest.domain,
              page: 1,
              limit: 100
            },
            params || {}
          )
        )}`,
        { cache: false }
      );
    }

    source(sourceId) {
      return this.request(`/sources/${encodeURIComponent(sourceId)}`);
    }

    sources(params) {
      return this.request(
        `/sources${buildQuery(
          Object.assign(
            {
              page: 1,
              limit: 100,
              bundleId: this.manifest.bundleId
            },
            params || {}
          )
        )}`
      );
    }

    async sourceLinkedRecords(sourceId) {
      const collections = [
        "entities",
        "claims",
        "evidence",
        "interpretations",
        "relationships",
        "culturalMemories"
      ];
      const results = await Promise.all(
        collections.map((collection) =>
          this.contextAll(collection, { sourceId })
        )
      );
      return collections.reduce((output, collection, index) => {
        output[collection] = results[index].items;
        return output;
      }, {});
    }

    async recordsByIds(recordIds) {
      const ids = Array.from(new Set((recordIds || []).filter(Boolean)));
      const records = await mapWithConcurrency(ids, 6, async (recordId) => {
        try {
          return await this.record(recordId);
        } catch (_) {
          return null;
        }
      });
      return records.filter(Boolean);
    }
  }

  global.HistoryRootApi = {
    DEFAULT_MANIFEST,
    COLLECTION_PATHS,
    HistoryRootApiClient,
    HistoryRootApiError,
    loadManifest,
    resolveLocalApiBaseUrl,
    buildQuery,
    itemsFrom,
    totalFrom,
    totalPagesFrom,
    mapWithConcurrency
  };
})(window);
