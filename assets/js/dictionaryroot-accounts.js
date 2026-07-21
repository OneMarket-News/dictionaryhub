(function dictionaryRootAccounts(global) {
  "use strict";

  const state = { manifest: null, client: null, providers: null, actors: [], context: null };
  const elements = {};

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function label(value) { return String(value || "").replace(/_/g, " "); }
  function badge(text, tone) { return `<span class="dr-accounts-badge" data-tone="${escapeHtml(tone || "")}">${escapeHtml(text)}</span>`; }
  function hasPermission(permission) { return Boolean(state.context && Array.isArray(state.context.permissions) && state.context.permissions.includes(permission)); }

  async function ensureClient() {
    if (state.client) return state.client;
    state.manifest = await global.DictionaryRootApi.loadManifest();
    state.client = new global.DictionaryRootApi.DictionaryRootApiClient(state.manifest);
    return state.client;
  }

  function setService(message, tone) {
    elements.service.textContent = message;
    elements.service.dataset.tone = tone || "";
  }

  function renderCurrent() {
    const context = state.context;
    elements.logout.disabled = !context;
    if (!context) {
      elements.current.innerHTML = '<div class="dr-live-empty"><strong>No active identity.</strong>Choose a local development identity to test permissions.</div>';
      return;
    }
    const actor = context.actor;
    const actorTone = actor.actorType === "human" ? "human" : actor.actorType === "autonomous_agent" ? "agent" : "";
    const permissionBadges = (context.permissions || []).map((permission) => badge(permission, /approve|promote|manage/.test(permission) ? "sensitive" : "")).join("");
    const delegation = context.delegation
      ? `<div class="dr-accounts-meta"><div><span>Delegated by</span><strong>${escapeHtml(context.delegation.principalDisplayName)}</strong></div><div><span>Human approval</span><strong>${context.delegation.humanApprovalRequired ? "Required" : "Not required"}</strong></div></div>`
      : "";
    elements.current.innerHTML = `<article class="dr-accounts-current-card">
      <div><h3>${escapeHtml(actor.displayName)}</h3><div class="dr-accounts-badges">${badge(label(actor.actorType), actorTone)}${badge(label(actor.verificationLevel), actorTone)}${(context.roles || []).map((role) => badge(label(role), "")).join("")}</div></div>
      <div class="dr-accounts-meta"><div><span>Actor ID</span><strong>${escapeHtml(actor.actorId)}</strong></div><div><span>Provider</span><strong>${escapeHtml(context.issuedBy)}</strong></div><div><span>Session expires</span><strong>${escapeHtml(new Date(context.expiresAt).toLocaleString())}</strong></div><div><span>Account status</span><strong>${escapeHtml(actor.accountStatus)}</strong></div></div>
      ${delegation}
      <div><span class="dr-accounts-kicker">Effective permissions</span><div class="dr-accounts-badges">${permissionBadges || badge("No permissions", "")}</div></div>
    </article>`;
  }

  function renderDevelopmentActors() {
    if (!state.actors.length) {
      elements.devActors.innerHTML = '<div class="dr-live-empty"><strong>Development sign-in is unavailable.</strong>Use a configured external provider.</div>';
      return;
    }
    elements.devActors.innerHTML = state.actors.map((actor) => {
      const type = label(actor.actorType);
      const policy = actor.actorType === "autonomous_agent" ? "Can recommend; cannot approve or promote" : label(actor.verificationLevel);
      return `<button class="dr-accounts-actor-button" type="button" data-actor-id="${escapeHtml(actor.actorId)}"><strong>${escapeHtml(actor.displayName)}</strong><span>${escapeHtml(type)} · ${escapeHtml(policy)}</span></button>`;
    }).join("");
  }

  function renderProviders(data) {
    const providers = data && Array.isArray(data.providers) ? data.providers : [];
    elements.providers.innerHTML = providers.map((provider) => `<article class="dr-accounts-provider" data-enabled="${Boolean(provider.enabled)}"><strong>${escapeHtml(provider.displayName)}</strong><p>${escapeHtml(label(provider.providerType))} · interface ${escapeHtml(provider.interfaceVersion)} · ${provider.enabled ? "enabled" : "adapter ready"}</p></article>`).join("") || '<div class="dr-live-empty"><strong>No identity providers are registered.</strong></div>';
  }

  function renderRoles(roles) {
    elements.roles.innerHTML = roles.map((role) => `<article class="dr-accounts-role"><header><h3>${escapeHtml(role.displayName)}</h3><p>${escapeHtml(role.description)}</p></header><ul>${role.permissions.map((permission) => `<li data-sensitive="${Boolean(permission.sensitive)}" title="${escapeHtml(permission.description)}">${escapeHtml(permission.permissionKey)}</li>`).join("")}</ul></article>`).join("");
  }

  function renderActors(actors) {
    elements.actorRegistry.innerHTML = actors.map((actor) => `<article class="dr-accounts-registry-card"><strong>${escapeHtml(actor.displayName)}</strong><div class="dr-accounts-badges">${badge(label(actor.actorType), actor.actorType === "human" ? "human" : actor.actorType === "autonomous_agent" ? "agent" : "")}${badge(label(actor.verificationLevel), "")}${(actor.roles || []).map((role) => badge(label(role), "")).join("")}</div><p>${escapeHtml(actor.actorId)} · ${escapeHtml(actor.accountStatus)} · ${escapeHtml(actor.providerId)}</p></article>`).join("");
  }

  function renderDelegations(delegations) {
    elements.delegationRegistry.innerHTML = delegations.length ? delegations.map((delegation) => `<article class="dr-accounts-registry-card"><strong>${escapeHtml(delegation.delegateDisplayName)}</strong><p>Acts for ${escapeHtml(delegation.principalDisplayName)} · ${escapeHtml(delegation.status)} · human approval ${delegation.humanApprovalRequired ? "required" : "not required"}</p><div class="dr-accounts-badges">${(delegation.permissionScope || []).map((permission) => badge(permission, "")).join("")}</div></article>`).join("") : '<div class="dr-live-empty"><strong>No active delegations.</strong></div>';
  }

  async function loadPublic() {
    const client = await ensureClient();
    const [providerResult, actorResult] = await Promise.all([client.authProviders(), client.developmentActors()]);
    state.providers = providerResult.data;
    state.actors = actorResult.data.actors || [];
    renderProviders(state.providers);
    renderDevelopmentActors();
  }

  async function loadSession() {
    const stored = global.DictionaryRootApi.getStoredAuthSession();
    if (!stored || !stored.token) {
      state.context = null;
      renderCurrent();
      return;
    }
    try {
      const client = await ensureClient();
      const result = await client.authMe();
      state.context = result.data;
    } catch (_) {
      global.DictionaryRootApi.setStoredAuthSession(null);
      state.context = null;
    }
    renderCurrent();
  }

  async function loadProtectedRegistries() {
    if (!hasPermission("identity.read")) {
      elements.roles.innerHTML = '<div class="dr-live-empty"><strong>Administrator access required.</strong>The current session still shows its own effective permissions above.</div>';
      elements.actorRegistry.innerHTML = '<div class="dr-live-empty"><strong>Administrator access required.</strong></div>';
      elements.delegationRegistry.innerHTML = '<div class="dr-live-empty"><strong>Administrator access required.</strong></div>';
      return;
    }
    const client = await ensureClient();
    const [roles, actors, delegations] = await Promise.all([client.identityRoles(), client.identityActors(), client.identityDelegations()]);
    renderRoles(roles.data.roles || []);
    renderActors(actors.data.actors || []);
    renderDelegations(delegations.data.delegations || []);
  }

  async function refresh() {
    try {
      await Promise.all([loadPublic(), loadSession()]);
      await loadProtectedRegistries();
      setService("SourceRoot identity online", "online");
    } catch (error) {
      setService("Identity service offline", "offline");
      elements.providers.innerHTML = `<div class="dr-live-empty"><strong>Identity registry is unavailable.</strong>${escapeHtml(error.message || "Start SourceRoot and retry.")}</div>`;
    }
  }

  async function signIn(actorId) {
    const client = await ensureClient();
    elements.devActors.setAttribute("aria-busy", "true");
    try {
      const result = await client.createDevelopmentSession(actorId);
      state.context = result.data.context;
      renderCurrent();
      await loadProtectedRegistries();
    } catch (error) {
      global.alert(error.message || "Development sign-in failed.");
    } finally {
      elements.devActors.removeAttribute("aria-busy");
    }
  }

  async function logout() {
    const client = await ensureClient();
    try { await client.logout(); } catch (_) { global.DictionaryRootApi.setStoredAuthSession(null); }
    state.context = null;
    renderCurrent();
    await loadProtectedRegistries();
  }

  function bind() {
    elements.devActors.addEventListener("click", (event) => {
      const button = event.target.closest("[data-actor-id]");
      if (button) signIn(button.dataset.actorId);
    });
    elements.logout.addEventListener("click", logout);
    global.addEventListener("dictionaryroot:authchange", () => loadSession().then(loadProtectedRegistries));
  }

  function cache() {
    const id = (value) => document.getElementById(value);
    elements.service = id("dictionaryrootAccountsServiceState");
    elements.current = id("dictionaryrootAccountsCurrent");
    elements.logout = id("dictionaryrootAccountsLogout");
    elements.devActors = id("dictionaryrootDevelopmentActors");
    elements.providers = id("dictionaryrootIdentityProviders");
    elements.roles = id("dictionaryrootRoleMatrix");
    elements.actorRegistry = id("dictionaryrootActorRegistry");
    elements.delegationRegistry = id("dictionaryrootDelegationRegistry");
  }

  async function init() { cache(); bind(); await refresh(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
