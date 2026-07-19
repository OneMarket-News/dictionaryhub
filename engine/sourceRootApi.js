(function () {
  "use strict";

  const DEFAULT_ORIGIN = "http://localhost:3000";
  const configuredOrigin = localStorage.getItem("sourcerootApiOrigin") || DEFAULT_ORIGIN;
  const origin = configuredOrigin.replace(/\/$/, "");

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });

    let body = {};
    try { body = await response.json(); } catch {}

    if (!response.ok) {
      const error = new Error(body.message || `Request failed with HTTP ${response.status}.`);
      error.status = response.status;
      error.code = body.code;
      error.body = body;
      throw error;
    }

    return body;
  }

  function getItems(response, legacyKey) {
    if (Array.isArray(response?.items)) return response.items;
    if (legacyKey && Array.isArray(response?.[legacyKey])) return response[legacyKey];
    return [];
  }

  function readPositiveInt(name, fallback) {
    const value = Number(new URLSearchParams(location.search).get(name));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  function replaceUrl(params) {
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }

  function paginationMarkup(page, totalPages, limit, total) {
    if (totalPages < 1) totalPages = 1;
    return `
      <button data-page-action="first" type="button" ${page <= 1 ? "disabled" : ""}>First</button>
      <button data-page-action="previous" type="button" ${page <= 1 ? "disabled" : ""}>Previous</button>
      <label>Page <input data-page-input type="number" min="1" max="${totalPages}" value="${page}" aria-label="Page number"></label>
      <span>of ${totalPages} · ${total} total</span>
      <label>Show <select data-limit-select aria-label="Items per page">
        ${[9,10,12,25,50,100].map(v => `<option value="${v}" ${v===limit?"selected":""}>${v}</option>`).join("")}
      </select></label>
      <button data-page-action="next" type="button" ${page >= totalPages ? "disabled" : ""}>Next</button>
      <button data-page-action="last" type="button" ${page >= totalPages ? "disabled" : ""}>Last</button>`;
  }

  function bindPagination(container, state, reload) {
    container.querySelectorAll("[data-page-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.pageAction;
        if (action === "first") state.page = 1;
        if (action === "previous") state.page = Math.max(1, state.page - 1);
        if (action === "next") state.page = Math.min(state.totalPages, state.page + 1);
        if (action === "last") state.page = state.totalPages;
        reload();
      });
    });
    const input = container.querySelector("[data-page-input]");
    if (input) input.addEventListener("change", () => {
      state.page = Math.min(state.totalPages, Math.max(1, Number(input.value) || 1));
      reload();
    });
    const select = container.querySelector("[data-limit-select]");
    if (select) select.addEventListener("change", () => {
      state.limit = Number(select.value);
      state.page = 1;
      reload();
    });
  }

  window.SourceRootApi = {
    origin,
    base: `${origin}/api/v1`,
    healthUrl: `${origin}/health`,
    fetchJson,
    getItems,
    readPositiveInt,
    replaceUrl,
    paginationMarkup,
    bindPagination,
  };
})();
