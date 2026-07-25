(function sourceRootApiLayerFactory(root, factory) {
  "use strict";

  const api = factory(root);
  root.SourceRootApiLayer = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function createSourceRootApiLayer(global) {
    "use strict";

    const REQUEST_ID_HEADER = "X-Request-ID";
    const DEFAULT_TIMEOUT_MS = 12000;
    const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
    const ERROR_CATEGORIES = Object.freeze([
      "network_error",
      "timeout",
      "aborted",
      "offline",
      "invalid_response",
      "api_error",
      "unauthorized",
      "forbidden",
      "not_found",
      "conflict",
      "rate_limited",
      "server_error"
    ]);

    class SourceRootApiError extends Error {
      constructor(message, details) {
        super(message);
        this.name = "SourceRootApiError";
        this.category = details.category;
        this.code = details.code || null;
        this.status = details.status || null;
        this.url = details.url;
        this.payload = details.payload === undefined ? null : details.payload;
        this.requestId = details.requestId || null;
        this.responseRequestId = details.responseRequestId || null;
      }
    }

    function now() {
      if (global.performance && typeof global.performance.now === "function") {
        return global.performance.now();
      }
      return Date.now();
    }

    function trimSlash(value) {
      return String(value || "").replace(/\/+$/, "");
    }

    function isSafeRequestId(value) {
      return SAFE_REQUEST_ID.test(String(value || ""));
    }

    function generateRequestId() {
      if (global.crypto && typeof global.crypto.randomUUID === "function") {
        return global.crypto.randomUUID();
      }
      if (global.crypto && typeof global.crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        global.crypto.getRandomValues(bytes);
        return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
      }
      return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    }

    function buildQuery(params) {
      const query = new URLSearchParams();
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        if (Array.isArray(value)) {
          value.forEach((entry) => query.append(key, String(entry)));
        } else {
          query.set(key, String(value));
        }
      });
      return query.toString();
    }

    function appendQuery(url, params) {
      const serialized = buildQuery(params);
      if (!serialized) return url;
      return `${url}${url.includes("?") ? "&" : "?"}${serialized}`;
    }

    function resolveUrl(path, baseUrl) {
      const value = String(path || "");
      if (/^https?:\/\//i.test(value)) return value;
      const base = trimSlash(baseUrl);
      if (base) return `${base}${value.startsWith("/") ? value : `/${value}`}`;
      return value;
    }

    function headerValue(headers, name) {
      if (!headers) return "";
      if (typeof headers.get === "function") return headers.get(name) || "";
      const expected = name.toLowerCase();
      const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === expected);
      return key ? String(headers[key] || "") : "";
    }

    function assignHeader(headers, name, value) {
      const expected = name.toLowerCase();
      const existing = Object.keys(headers).find((candidate) => candidate.toLowerCase() === expected);
      if (existing) delete headers[existing];
      headers[name] = value;
    }

    function categoryForStatus(status) {
      if (status === 401) return "unauthorized";
      if (status === 403) return "forbidden";
      if (status === 404) return "not_found";
      if (status === 409) return "conflict";
      if (status === 429) return "rate_limited";
      if (status >= 500) return "server_error";
      return "api_error";
    }

    function normalizedPath(url) {
      try {
        const parsed = new URL(url, global.location && global.location.href ? global.location.href : "http://localhost");
        return parsed.pathname
          .split("/")
          .map((segment) => (
            segment.length > 64 || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment)
              ? ":id"
              : segment
          ))
          .join("/");
      } catch (_) {
        return String(url || "").split("?")[0].slice(0, 256);
      }
    }

    function emitDiagnostic(callback, event) {
      if (typeof callback !== "function") return;
      try {
        callback(Object.freeze(event));
      } catch (_) {
        // Diagnostics must never change request behavior.
      }
    }

    function diagnosticBase(eventType, context) {
      return {
        eventType,
        correlationId: context.requestId,
        responseCorrelationId: context.responseRequestId || null,
        method: context.method,
        path: normalizedPath(context.url),
        statusCode: context.status || null,
        durationMs: Math.round((now() - context.startedAt) * 10) / 10,
        errorCategory: context.category || null
      };
    }

    async function parseResponse(response, context, allowTextResponse) {
      if (response.status === 204 || response.status === 205) return null;
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (_) {
        if (allowTextResponse) return { message: text };
        throw new SourceRootApiError(
          "The service returned a malformed JSON response.",
          {
            category: "invalid_response",
            status: response.status,
            url: context.url,
            requestId: context.requestId,
            responseRequestId: context.responseRequestId
          }
        );
      }
    }

    async function request(path, options) {
      const settings = Object.assign(
        {
          method: "GET",
          timeoutMs: DEFAULT_TIMEOUT_MS,
          credentials: "include",
          cache: "no-store",
          navigator: global.navigator
        },
        options || {}
      );
      const method = String(settings.method || "GET").toUpperCase();
      const url = appendQuery(resolveUrl(path, settings.baseUrl), settings.query);
      const headers = Object.assign({ Accept: "application/json" }, settings.headers || {});
      const requestedId = settings.requestId || headerValue(headers, REQUEST_ID_HEADER);
      const requestId = isSafeRequestId(requestedId) ? String(requestedId) : generateRequestId();
      assignHeader(headers, REQUEST_ID_HEADER, requestId);

      let body = settings.body;
      if (Object.prototype.hasOwnProperty.call(settings, "json")) {
        body = JSON.stringify(settings.json);
        assignHeader(headers, "Content-Type", "application/json");
      }

      const controller = new AbortController();
      let timedOut = false;
      let callerAborted = false;
      const timeoutMs = Math.max(1, Number(settings.timeoutMs) || DEFAULT_TIMEOUT_MS);
      const callerSignal = settings.signal;
      const abortFromCaller = () => {
        callerAborted = true;
        controller.abort();
      };
      if (callerSignal) {
        if (callerSignal.aborted) abortFromCaller();
        else callerSignal.addEventListener("abort", abortFromCaller, { once: true });
      }
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      const context = {
        method,
        url,
        requestId,
        responseRequestId: null,
        status: null,
        category: null,
        startedAt: now()
      };

      try {
        if (settings.navigator && settings.navigator.onLine === false) {
          throw new SourceRootApiError(
            "The browser is offline.",
            { category: "offline", url, requestId }
          );
        }

        const fetchImplementation = settings.fetch || global.fetch;
        if (typeof fetchImplementation !== "function") {
          throw new SourceRootApiError(
            "No browser request implementation is available.",
            { category: "network_error", url, requestId }
          );
        }

        const response = await fetchImplementation(url, {
          method,
          cache: settings.cache,
          credentials: settings.credentials,
          headers,
          body,
          signal: controller.signal
        });
        context.status = response.status;
        context.responseRequestId = headerValue(response.headers, REQUEST_ID_HEADER) || requestId;

        const payload = await parseResponse(response, context, Boolean(settings.allowTextResponse));
        if (!response.ok) {
          const category = categoryForStatus(response.status);
          const errorCode = payload && (
            (typeof payload.error === "string" && payload.error) ||
            payload.code ||
            (payload.error && payload.error.code)
          );
          throw new SourceRootApiError(
            payload && payload.message
              ? payload.message
              : `Request failed with HTTP ${response.status}.`,
            {
              category,
              code: errorCode,
              status: response.status,
              url,
              payload,
              requestId,
              responseRequestId: context.responseRequestId
            }
          );
        }

        emitDiagnostic(
          settings.onDiagnostic,
          diagnosticBase("frontend_request_completed", context)
        );
        return {
          data: payload,
          response,
          durationMs: Math.round((now() - context.startedAt) * 10) / 10,
          requestId,
          responseRequestId: context.responseRequestId
        };
      } catch (error) {
        let normalized = error;
        if (!(normalized instanceof SourceRootApiError)) {
          const isAbort = normalized && normalized.name === "AbortError";
          const offline = settings.navigator && settings.navigator.onLine === false;
          const category = timedOut
            ? "timeout"
            : callerAborted || isAbort
              ? "aborted"
              : offline
                ? "offline"
                : "network_error";
          const message = category === "timeout"
            ? "The request timed out."
            : category === "aborted"
              ? "The request was cancelled."
              : category === "offline"
                ? "The browser is offline."
                : "The service could not be reached.";
          normalized = new SourceRootApiError(message, {
            category,
            url,
            requestId,
            responseRequestId: context.responseRequestId
          });
        }

        context.category = normalized.category;
        context.status = normalized.status || context.status;
        context.responseRequestId = normalized.responseRequestId || context.responseRequestId;
        const eventType = normalized.category === "timeout"
          ? "frontend_timeout"
          : normalized.category === "network_error" || normalized.category === "offline"
            ? "frontend_network_failure"
            : normalized.category === "aborted"
              ? "frontend_request_aborted"
              : "frontend_request_failed";
        emitDiagnostic(settings.onDiagnostic, diagnosticBase(eventType, context));
        throw normalized;
      } finally {
        clearTimeout(timer);
        if (callerSignal) callerSignal.removeEventListener("abort", abortFromCaller);
      }
    }

    return Object.freeze({
      REQUEST_ID_HEADER,
      DEFAULT_TIMEOUT_MS,
      ERROR_CATEGORIES,
      SourceRootApiError,
      isSafeRequestId,
      generateRequestId,
      buildQuery,
      resolveUrl,
      categoryForStatus,
      request
    });
  }
);
