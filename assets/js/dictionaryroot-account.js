(function dictionaryRootAccountPage(global) {
  "use strict";

  const elements = {};

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character];
    });
  }

  function setMessage(message, state) {
    elements.message.hidden = !message;
    elements.message.textContent = message || "";
    elements.message.dataset.state = state || "";
  }

  function providerLink(element, provider, configured, intent) {
    const resolvedIntent = intent || "signin";
    element.setAttribute("aria-disabled", configured ? "false" : "true");
    element.dataset.authProvider = provider;
    element.dataset.authIntent = resolvedIntent;
    element.href = configured && resolvedIntent === "signin"
      ? global.DictionaryRootAuth.providerStartUrl(provider, { intent: resolvedIntent, returnTo: "/account-v1.html" })
      : "#";
    element.title = configured ? "" : `${provider === "google" ? "Google" : "Apple"} provider credentials are not configured on SourceRoot.`;
  }

  function formatDate(value) {
    if (!value) return "Never";
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
    catch (_) { return value; }
  }

  function renderConfig(config) {
    const providers = config && config.providers ? config.providers : {};
    providerLink(elements.googleSignIn, "google", Boolean(providers.google && providers.google.configured), "signin");
    providerLink(elements.appleSignIn, "apple", Boolean(providers.apple && providers.apple.configured), "signin");
    providerLink(elements.googleLink, "google", Boolean(providers.google && providers.google.configured), "link");
    providerLink(elements.appleLink, "apple", Boolean(providers.apple && providers.apple.configured), "link");
    elements.emailSignInForm.querySelector("button").disabled = !(providers.email && providers.email.configured);
    elements.emailLinkForm.querySelector("button").disabled = !(providers.email && providers.email.configured);
    elements.developmentPanel.hidden = !(providers.development && providers.development.configured);
  }

  function renderRoles(session) {
    elements.roleList.innerHTML = session.roles.length
      ? session.roles.map(function (role) { return `<span class="dr-governance-chip" data-tone="success">${escapeHtml(role.replace(/_/g, " "))}</span>`; }).join("")
      : '<span class="dr-governance-chip">No assigned roles</span>';
    elements.permissionList.innerHTML = session.permissions.length
      ? session.permissions.map(function (permission) { return `<span class="dr-governance-chip">${escapeHtml(permission)}</span>`; }).join("")
      : '<span class="dr-governance-chip" data-tone="warning">No protected-write permissions</span>';
    elements.adminAccess.hidden = !(session.permissions.includes("audit.read") || session.permissions.includes("system.admin"));
  }

  function renderIdentities(session) {
    elements.identityList.innerHTML = session.identities.map(function (identity) {
      const active = identity.identityId === session.activeIdentityId;
      const removable = session.identities.length > 1 && !active;
      return `<article class="dr-list-card">
        <h3>${escapeHtml(identity.provider.charAt(0).toUpperCase() + identity.provider.slice(1))}</h3>
        <p>${escapeHtml(identity.providerEmail || "No provider email disclosed")}</p>
        <div class="dr-chip-row"><span class="dr-governance-chip" data-tone="${identity.emailVerified ? "success" : "warning"}">${identity.emailVerified ? "Verified" : "Unverified"}</span>${active ? '<span class="dr-governance-chip" data-tone="success">Current session identity</span>' : ""}<span class="dr-governance-chip">Last used ${escapeHtml(formatDate(identity.lastSignedInAt))}</span></div>
        ${removable ? `<div class="dr-governance-actions" style="margin-top:.7rem"><button class="dr-governance-button" data-variant="secondary" type="button" data-unlink-identity="${escapeHtml(identity.identityId)}">Remove</button></div>` : ""}
      </article>`;
    }).join("");
  }

  function renderOrganizations(session) {
    elements.organizationList.innerHTML = session.organizations.length ? session.organizations.map(function (organization) {
      return `<article class="dr-list-card"><h3>${escapeHtml(organization.organizationName)}</h3><p>${escapeHtml(organization.organizationSlug)} · ${escapeHtml(organization.membershipStatus)}</p><div class="dr-chip-row">${(organization.roles || []).map(function (role) { return `<span class="dr-governance-chip">${escapeHtml(role.replace(/_/g, " "))}</span>`; }).join("") || '<span class="dr-governance-chip">Member</span>'}</div></article>`;
    }).join("") : '<div class="dr-governance-message">This account does not yet belong to an organization.</div>';
  }

  async function renderSessions(session) {
    try {
      const payload = await global.DictionaryRootAuth.request("/account/sessions");
      const rows = payload.sessions.map(function (item) {
        const current = item.sessionId === payload.currentSessionId;
        return `<tr><td>${current ? '<span class="dr-governance-chip" data-tone="success">Current</span>' : "Other"}</td><td>${escapeHtml(item.userAgent || "Unknown browser")}</td><td>${escapeHtml(item.ipAddress || "Unknown")}</td><td>${escapeHtml(formatDate(item.lastSeenAt))}</td><td>${escapeHtml(formatDate(item.expiresAt))}</td><td>${current ? "—" : `<button class="dr-governance-button" data-variant="secondary" type="button" data-revoke-session="${escapeHtml(item.sessionId)}">Revoke</button>`}</td></tr>`;
      }).join("");
      elements.sessionList.innerHTML = `<table class="dr-governance-table"><thead><tr><th>Session</th><th>Browser</th><th>IP</th><th>Last seen</th><th>Expires</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No active sessions.</td></tr>'}</tbody></table>`;
    } catch (error) {
      elements.sessionList.innerHTML = `<div class="dr-governance-message" data-state="error">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderSession(session) {
    const signedIn = Boolean(session && session.authenticated && session.user);
    elements.signedOut.hidden = signedIn;
    elements.signedIn.hidden = !signedIn;
    elements.statusTitle.textContent = signedIn ? "Signed in" : "Not signed in";
    elements.statusText.textContent = signedIn
      ? `${session.user.displayName || session.user.primaryEmail} is authenticated. Protected actions still require explicit permissions.`
      : "Public reading remains available. Sign in to access account, proposal, review, or administration functions.";
    if (!signedIn) return;
    elements.profileName.value = session.user.displayName || "";
    elements.profileHandle.value = session.user.publicHandle || "";
    elements.profileEmail.value = session.user.primaryEmail || "";
    renderRoles(session);
    renderIdentities(session);
    renderOrganizations(session);
    renderSessions(session);
  }

  async function submitEmail(event, intent) {
    event.preventDefault();
    const input = intent === "link" ? elements.emailLink : elements.emailSignIn;
    setMessage("Requesting a one-time email link…", "");
    try {
      const result = await global.DictionaryRootAuth.startEmail(input.value, { intent, returnTo: "/account-v1.html" });
      setMessage(result.message, "success");
      elements.developmentLink.hidden = !result.developmentLink;
      if (result.developmentLink) elements.developmentLink.innerHTML = `Development delivery mode: <a href="${escapeHtml(result.developmentLink)}">open the one-time sign-in link</a>.`;
      input.value = "";
    } catch (error) { setMessage(error.message, "error"); }
  }

  async function downloadAccountExport() {
    setMessage("Preparing your account export…", "");
    const url = `${global.DictionaryRootAuth.state.apiBaseUrl}/account/export`;
    const response = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) {
      let detail = null;
      try { detail = await response.json(); } catch (_) { detail = null; }
      throw new Error(detail && detail.message ? detail.message : `Account export failed with HTTP ${response.status}.`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const matched = disposition.match(/filename="?([^";]+)"?/i);
    const name = matched ? matched[1] : "dictionaryroot-account-export.json";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    setMessage("Account export downloaded.", "success");
  }

  function bind() {
    document.addEventListener("click", async function (event) {
      const link = event.target.closest("[data-auth-provider][data-auth-intent='link']");
      if (!link) return;
      event.preventDefault();
      if (link.getAttribute("aria-disabled") === "true") return;
      try {
        setMessage(`Opening ${link.dataset.authProvider} account linking…`, "");
        await global.DictionaryRootAuth.startProvider(link.dataset.authProvider, { intent: "link", returnTo: "/account-v1.html" });
      } catch (error) { setMessage(error.message, "error"); }
    });
    elements.emailSignInForm.addEventListener("submit", function (event) { submitEmail(event, "signin"); });
    elements.emailLinkForm.addEventListener("submit", function (event) { submitEmail(event, "link"); });
    elements.developmentForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        setMessage("Creating a local development session…", "");
        await global.DictionaryRootAuth.developmentSignIn(elements.developmentEmail.value, elements.developmentName.value, "/account-v1.html");
        renderSession(global.DictionaryRootAuth.session);
        setMessage("Development account signed in. This adapter must remain disabled outside local development.", "success");
      } catch (error) { setMessage(error.message, "error"); }
    });
    elements.profileForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        await global.DictionaryRootAuth.updateProfile(elements.profileName.value, elements.profileHandle.value);
        renderSession(global.DictionaryRootAuth.session);
        setMessage("Account profile updated.", "success");
      } catch (error) { setMessage(error.message, "error"); }
    });
    elements.signOut.addEventListener("click", async function () {
      try { await global.DictionaryRootAuth.signOut(); renderSession(global.DictionaryRootAuth.session); setMessage("Signed out.", "success"); }
      catch (error) { setMessage(error.message, "error"); }
    });
    elements.identityList.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-unlink-identity]");
      if (!button || !global.confirm("Remove this sign-in method from your account?")) return;
      try { await global.DictionaryRootAuth.unlinkIdentity(button.dataset.unlinkIdentity); renderSession(global.DictionaryRootAuth.session); setMessage("Sign-in method removed.", "success"); }
      catch (error) { setMessage(error.message, "error"); }
    });
    elements.sessionList.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-revoke-session]");
      if (!button) return;
      try { await global.DictionaryRootAuth.request(`/account/sessions/${encodeURIComponent(button.dataset.revokeSession)}`, { method: "DELETE" }); await renderSessions(global.DictionaryRootAuth.session); setMessage("Session revoked.", "success"); }
      catch (error) { setMessage(error.message, "error"); }
    });
    elements.revokeOthers.addEventListener("click", async function () {
      if (!global.confirm("Sign out every other active DictionaryRoot session?")) return;
      try { const result = await global.DictionaryRootAuth.request("/account/sessions/revoke-others", { method: "POST", body: {} }); await renderSessions(global.DictionaryRootAuth.session); setMessage(`${result.revoked} other session${result.revoked === 1 ? "" : "s"} revoked.`, "success"); }
      catch (error) { setMessage(error.message, "error"); }
    });
    elements.invitationForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        const result = await global.DictionaryRootAuth.request("/account/invitations/accept", { method: "POST", body: { token: elements.invitationToken.value.trim() } });
        await global.DictionaryRootAuth.refreshSession();
        renderSession(global.DictionaryRootAuth.session);
        elements.invitationToken.value = "";
        setMessage(`Invitation accepted. Organization role ${result.roleKey.replace(/_/g, " ")} is active.`, "success");
      } catch (error) { setMessage(error.message, "error"); }
    });
    elements.exportAccount.addEventListener("click", function () { downloadAccountExport().catch(function (error) { setMessage(error.message, "error"); }); });
    elements.requestDeletion.addEventListener("click", async function () {
      if (!global.confirm("Record an account deletion request? Download your account export first.")) return;
      try {
        await global.DictionaryRootAuth.request("/account/delete-request", { method: "POST", body: {} });
        elements.deleteAccountForm.hidden = false;
        elements.deleteConfirmation.focus();
        setMessage("Deletion request recorded. Type DELETE only when you are ready to remove linked sign-in methods and revoke all sessions.", "success");
      } catch (error) { setMessage(error.message, "error"); }
    });
    elements.deleteAccountForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (elements.deleteConfirmation.value !== "DELETE") { setMessage("Type DELETE exactly to confirm account deletion.", "error"); return; }
      if (!global.confirm("Permanently disable this account, remove linked identities, and revoke every session? Published provenance records will remain as an anonymized audit trail.")) return;
      try {
        await global.DictionaryRootAuth.request("/account/delete-confirm", { method: "POST", body: { confirmation: "DELETE" } });
        await global.DictionaryRootAuth.refreshSession();
        renderSession(global.DictionaryRootAuth.session);
        setMessage("Account deleted and sessions revoked.", "success");
      } catch (error) { setMessage(error.message, "error"); }
    });
    global.addEventListener("dictionaryroot:auth-change", function (event) { renderSession(event.detail); });
  }

  function cache() {
    const id = function (value) { return document.getElementById(value); };
    elements.statusTitle = id("dictionaryrootAccountStatusTitle");
    elements.statusText = id("dictionaryrootAccountStatusText");
    elements.message = id("dictionaryrootAccountMessage");
    elements.signedOut = id("dictionaryrootSignedOut");
    elements.signedIn = id("dictionaryrootSignedIn");
    elements.googleSignIn = id("dictionaryrootGoogleSignIn");
    elements.appleSignIn = id("dictionaryrootAppleSignIn");
    elements.googleLink = id("dictionaryrootGoogleLink");
    elements.appleLink = id("dictionaryrootAppleLink");
    elements.emailSignInForm = id("dictionaryrootEmailSignInForm");
    elements.emailSignIn = id("dictionaryrootEmailSignIn");
    elements.emailLinkForm = id("dictionaryrootEmailLinkForm");
    elements.emailLink = id("dictionaryrootEmailLink");
    elements.developmentLink = id("dictionaryrootDevelopmentLink");
    elements.developmentPanel = id("dictionaryrootDevelopmentPanel");
    elements.developmentForm = id("dictionaryrootDevelopmentForm");
    elements.developmentEmail = id("dictionaryrootDevelopmentEmail");
    elements.developmentName = id("dictionaryrootDevelopmentName");
    elements.profileForm = id("dictionaryrootProfileForm");
    elements.profileName = id("dictionaryrootProfileName");
    elements.profileHandle = id("dictionaryrootProfileHandle");
    elements.profileEmail = id("dictionaryrootProfileEmail");
    elements.signOut = id("dictionaryrootSignOut");
    elements.roleList = id("dictionaryrootRoleList");
    elements.permissionList = id("dictionaryrootPermissionList");
    elements.adminAccess = id("dictionaryrootAdminAccess");
    elements.identityList = id("dictionaryrootIdentityList");
    elements.organizationList = id("dictionaryrootOrganizationList");
    elements.sessionList = id("dictionaryrootSessionList");
    elements.revokeOthers = id("dictionaryrootRevokeOtherSessions");
    elements.invitationForm = id("dictionaryrootInvitationForm");
    elements.invitationToken = id("dictionaryrootInvitationToken");
    elements.exportAccount = id("dictionaryrootExportAccount");
    elements.requestDeletion = id("dictionaryrootRequestDeletion");
    elements.deleteAccountForm = id("dictionaryrootDeleteAccountForm");
    elements.deleteConfirmation = id("dictionaryrootDeleteConfirmation");
  }

  async function init() {
    cache();
    bind();
    const url = new URL(global.location.href);
    if (url.searchParams.get("authError")) setMessage(url.searchParams.get("authError"), "error");
    else if (url.searchParams.get("auth") === "success") setMessage("Sign-in completed.", "success");
    else if (url.searchParams.get("auth") === "linked") setMessage("Sign-in method linked to this account.", "success");
    const invitationToken = url.searchParams.get("invitation") || "";
    if (invitationToken) elements.invitationToken.value = invitationToken;
    const ready = await global.DictionaryRootAuth.initialize();
    renderConfig(ready.config);
    renderSession(ready.session);
    if (invitationToken) {
      setMessage(ready.session && ready.session.authenticated
        ? "Invitation detected. Confirm acceptance below."
        : "Invitation detected. Sign in using the verified email address that received it, then return to this link.", "success");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
