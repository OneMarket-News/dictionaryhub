(function dictionaryRootAuthFactory(global) {
  "use strict";

  const state = {
    manifest: null,
    apiBaseUrl: "http://localhost:3000/api/v1",
    config: null,
    session: null,
    initialized: false,
    initialization: null
  };

  function trimSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  async function ensureManifest() {
    if (state.manifest) return state.manifest;
    const manifestApi =
      global.HistoryRootApi && global.HistoryRootApi.loadManifest
        ? global.HistoryRootApi
        : global.DictionaryRootApi;
    if (manifestApi && manifestApi.loadManifest) {
      state.manifest = await manifestApi.loadManifest();
      state.apiBaseUrl = trimSlash(state.manifest.apiBaseUrl || state.apiBaseUrl);
    }
    return state.manifest;
  }

  async function request(path, options) {
    await ensureManifest();
    const settings = Object.assign({ method: "GET", cache: "no-store", credentials: "include" }, options || {});
    settings.headers = Object.assign({ Accept: "application/json" }, (options && options.headers) || {});
    const method = String(settings.method || "GET").toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && state.session && state.session.csrfToken) {
      settings.headers["X-CSRF-Token"] = state.session.csrfToken;
    }
    if (settings.body && typeof settings.body !== "string" && !(settings.body instanceof FormData)) {
      settings.headers["Content-Type"] = "application/json";
      settings.body = JSON.stringify(settings.body);
    }
    const url = /^https?:\/\//i.test(path) ? path : `${state.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const response = await fetch(url, settings);
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch (_) { payload = { message: text }; }
    }
    if (!response.ok) {
      const error = new Error(payload && payload.message ? payload.message : `Request failed with HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function emit() {
    global.dispatchEvent(new CustomEvent("dictionaryroot:auth-change", { detail: state.session }));
  }

  async function refreshSession() {
    try {
      state.session = await request("/auth/session");
    } catch (error) {
      state.session = { authenticated: false, user: null, identities: [], roles: [], permissions: [], systemPermissions: [], organizations: [], csrfToken: null };
    }
    emit();
    return state.session;
  }

  async function refreshConfig() {
    try {
      state.config = await request("/auth/config");
    } catch (error) {
      state.config = { providers: {}, unavailable: true, message: error.message };
    }
    return state.config;
  }

  async function initialize() {
    if (state.initialization) return state.initialization;
    state.initialization = (async function () {
      await ensureManifest();
      await Promise.all([refreshConfig(), refreshSession()]);
      state.initialized = true;
      return { config: state.config, session: state.session };
    })();
    return state.initialization;
  }

  function providerStartUrl(provider, options) {
    const settings = Object.assign({ intent: "signin", returnTo: "/account-v1.html" }, options || {});
    const params = new URLSearchParams({ intent: settings.intent, returnTo: settings.returnTo });
    return `${state.apiBaseUrl}/auth/${encodeURIComponent(provider)}/start?${params.toString()}`;
  }

  async function startProvider(provider, options) {
    const settings = Object.assign({ intent: "signin", returnTo: "/account-v1.html" }, options || {});
    if (settings.intent !== "link") {
      global.location.assign(providerStartUrl(provider, settings));
      return null;
    }
    const result = await request(`/auth/${encodeURIComponent(provider)}/start`, {
      method: "POST",
      body: { returnTo: settings.returnTo }
    });
    if (!result || !result.authorizationUrl) throw new Error("The provider did not return an authorization URL.");
    global.location.assign(result.authorizationUrl);
    return result;
  }

  async function startEmail(email, options) {
    const settings = Object.assign({ intent: "signin", returnTo: "/account-v1.html" }, options || {});
    return request("/auth/email/start", { method: "POST", body: { email, intent: settings.intent, returnTo: settings.returnTo } });
  }

  async function developmentSignIn(email, displayName, returnTo) {
    const result = await request("/auth/development/sign-in", { method: "POST", body: { email, displayName, returnTo: returnTo || "/account-v1.html" } });
    await refreshSession();
    return result;
  }

  async function signOut() {
    const result = await request("/auth/sign-out", { method: "POST", body: {} });
    await refreshSession();
    return result;
  }

  async function updateProfile(displayName, publicHandle) {
    const result = await request("/account/profile", { method: "PATCH", body: { displayName, publicHandle: publicHandle || null } });
    await refreshSession();
    return result;
  }

  async function unlinkIdentity(identityId) {
    await request(`/auth/identities/${encodeURIComponent(identityId)}`, { method: "DELETE" });
    return refreshSession();
  }

  const api = {
    state,
    request,
    initialize,
    refreshSession,
    refreshConfig,
    providerStartUrl,
    startProvider,
    startEmail,
    developmentSignIn,
    signOut,
    updateProfile,
    unlinkIdentity,
    get config() { return state.config; },
    get session() { return state.session; },
    get csrfToken() { return state.session && state.session.csrfToken; },
    hasPermission(permission) {
      const permissions = state.session && Array.isArray(state.session.permissions) ? state.session.permissions : [];
      return permissions.includes(permission) || permissions.includes("system.admin");
    },
    hasSystemPermission(permission) {
      const permissions = state.session && Array.isArray(state.session.systemPermissions) ? state.session.systemPermissions : [];
      return permissions.includes(permission) || permissions.includes("system.admin");
    },
    hasOrganizationPermission(organizationId, permission) {
      if (api.hasSystemPermission(permission)) return true;
      if (!organizationId || !state.session || !Array.isArray(state.session.organizations)) return false;
      const organization = state.session.organizations.find(item => item.organizationId === organizationId && item.membershipStatus === "active");
      return Boolean(organization && Array.isArray(organization.permissions) && organization.permissions.includes(permission));
    },
    authorizedOrganizations(permission) {
      if (!state.session || !Array.isArray(state.session.organizations)) return [];
      return state.session.organizations.filter(item => item.membershipStatus === "active" && api.hasOrganizationPermission(item.organizationId, permission));
    }
  };

  global.DictionaryRootAuth = api;
  initialize().catch(function (error) {
    console.warn("DictionaryRoot account service is unavailable:", error);
  });
})(window);
