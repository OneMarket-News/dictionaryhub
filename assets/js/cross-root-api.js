(function crossRootApiFactory(global) {
  "use strict";

  const DEFAULT_API_BASE = "http://localhost:3000/api/v1/cross-root";

  function apiBase() {
    const url = new URL(DEFAULT_API_BASE);
    if (global.location && new Set(["localhost", "127.0.0.1", "[::1]"]).has(global.location.hostname)) {
      url.hostname = global.location.hostname;
    }
    return url.toString().replace(/\/$/, "");
  }

  async function get(path, query) {
    if (!global.SourceRootApiLayer) throw new Error("The shared SourceRoot API layer is unavailable.");
    const response = await global.SourceRootApiLayer.request(`${apiBase()}${path}`, {
      query: query || {},
      cache: "no-store"
    });
    return response.data;
  }

  global.CrossRootApi = Object.freeze({
    coverage: () => get("/coverage"),
    links: (query) => get("/links", query)
  });
})(window);
