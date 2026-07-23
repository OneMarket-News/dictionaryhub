(function dictionaryRootAdminPage(global) {
  "use strict";

  const elements = {};
  let roles = [];
  let organizations = [];
  let selectedOrganizationId = "";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character];
    });
  }

  function formatDate(value) {
    if (!value) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    } catch (_) {
      return value;
    }
  }

  function setMessage(message, tone) {
    elements.message.hidden = !message;
    elements.message.textContent = message || "";
    elements.message.dataset.state = tone || "";
  }

  function has(permission) {
    return global.DictionaryRootAuth.hasPermission(permission);
  }

  function hasSystem(permission) {
    return global.DictionaryRootAuth.hasSystemPermission(permission);
  }

  function organizationRoles() {
    return roles.filter(function (role) { return role.scope === "organization"; });
  }

  async function loadOverview() {
    if (!has("audit.read")) {
      elements.metrics.innerHTML = '<div class="dr-governance-message">Governance metrics require audit-read permission.</div>';
      return;
    }
    const data = await global.DictionaryRootAuth.request("/admin/overview");
    const metrics = [
      [data.users.total, data.scope === "system" ? "Total users" : "Users in scope"],
      [data.users.active, "Active users"],
      [data.users.suspended, "Suspended"],
      [data.proposals.waiting, "Awaiting decisions"],
      [data.proposals.published, "Published proposals"],
      [data.openReports, "Open reports"],
      [data.activeSessions, "Active sessions"],
      [data.auditEventsLast24Hours, "Audit events · 24h"],
    ];
    elements.metrics.innerHTML = metrics.map(function (item) {
      return `<div class="dr-metric-card"><strong>${Number(item[0] || 0).toLocaleString()}</strong><span>${escapeHtml(item[1])}</span></div>`;
    }).join("");
  }

  async function loadRoles() {
    if (!has("organization.manage") && !has("user.manage") && !has("system.admin")) {
      roles = [];
      elements.roles.innerHTML = '<div class="dr-governance-message">Role details require organization or user management permission.</div>';
      return;
    }
    const data = await global.DictionaryRootAuth.request("/admin/roles");
    roles = data.roles || [];
    elements.roles.innerHTML = roles.map(function (role) {
      return `<article class="dr-list-card"><h3>${escapeHtml(role.roleName)}</h3><p>${escapeHtml(role.description)}</p><div class="dr-chip-row"><span class="dr-governance-chip">${escapeHtml(role.scope)}</span><span class="dr-governance-chip">${Number(role.permissions.length || 0)} permissions</span></div></article>`;
    }).join("") || '<div class="dr-governance-message">No roles are registered.</div>';
  }

  async function loadUsers() {
    if (!has("user.manage")) {
      elements.users.innerHTML = '<div class="dr-governance-message">System-wide user management permission is required. Organization administrators manage only members inside their authorized organizations below.</div>';
      return;
    }
    const query = elements.userSearch.value.trim();
    const data = await global.DictionaryRootAuth.request(`/admin/users?limit=50${query ? `&q=${encodeURIComponent(query)}` : ""}`);
    const rows = (data.items || []).map(function (user) {
      const roleChips = (user.roles || []).map(function (role) {
        return `<span class="dr-governance-chip">${escapeHtml(role)}</span>`;
      }).join(" ") || "—";
      return `<tr><td><strong>${escapeHtml(user.displayName || "Unnamed")}</strong><br>${escapeHtml(user.primaryEmail || "No email")}</td><td>${escapeHtml(user.accountStatus)}</td><td>${roleChips}</td><td>${escapeHtml(formatDate(user.lastSignedInAt))}</td><td><div class="dr-governance-actions"><button class="dr-governance-button" data-variant="secondary" data-admin-role="${escapeHtml(user.userId)}" type="button">Assign role</button><button class="dr-governance-button" data-variant="${user.accountStatus === "suspended" ? "secondary" : "danger"}" data-admin-status="${escapeHtml(user.userId)}" data-current-status="${escapeHtml(user.accountStatus)}" type="button">${user.accountStatus === "suspended" ? "Restore" : "Suspend"}</button></div></td></tr>`;
    }).join("");
    elements.users.innerHTML = `<table class="dr-governance-table"><thead><tr><th>User</th><th>Status</th><th>Roles</th><th>Last sign-in</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No users found.</td></tr>'}</tbody></table>`;
  }

  async function loadOrganizations() {
    if (!has("organization.manage")) {
      organizations = [];
      elements.organizations.innerHTML = '<div class="dr-governance-message">Organization management permission is required.</div>';
      elements.organizationMembersPanel.hidden = true;
      return;
    }
    const data = await global.DictionaryRootAuth.request("/admin/organizations");
    organizations = data.organizations || [];
    elements.organizations.innerHTML = organizations.map(function (organization) {
      return `<article class="dr-list-card"><h3>${escapeHtml(organization.name)}</h3><p>${escapeHtml(organization.slug)} · ${Number(organization.members || 0)} active members</p><div class="dr-governance-actions"><button class="dr-governance-button" data-variant="secondary" data-view-members="${escapeHtml(organization.organizationId)}" type="button">Manage members</button><button class="dr-governance-button" data-variant="secondary" data-invite-org="${escapeHtml(organization.organizationId)}" type="button">Create invitation</button></div></article>`;
    }).join("") || '<div class="dr-governance-message">No organizations are available in this account’s authorized scope.</div>';
    if (selectedOrganizationId && !organizations.some(function (item) { return item.organizationId === selectedOrganizationId; })) {
      selectedOrganizationId = "";
      elements.organizationMembersPanel.hidden = true;
    }
  }

  async function loadOrganizationMembers(organizationId) {
    selectedOrganizationId = organizationId;
    elements.organizationMembersPanel.hidden = false;
    elements.organizationMembers.innerHTML = '<div class="dr-governance-message">Loading scoped members and roles…</div>';
    const data = await global.DictionaryRootAuth.request(`/admin/organizations/${encodeURIComponent(organizationId)}/members`);
    elements.organizationMembersTitle.textContent = `${data.organizationName || "Organization"} members and roles`;
    const rows = (data.members || []).map(function (member) {
      const roleChips = (member.roles || []).map(function (role) {
        return `<span class="dr-governance-chip">${escapeHtml(role)} <button class="dr-chip-action" type="button" aria-label="Remove ${escapeHtml(role)}" data-remove-org-role="${escapeHtml(role)}" data-member-user="${escapeHtml(member.userId)}">×</button></span>`;
      }).join(" ") || '<span class="dr-governance-chip" data-tone="warning">No organization role</span>';
      return `<tr><td><strong>${escapeHtml(member.displayName || "Unnamed")}</strong><br>${escapeHtml(member.primaryEmail || "No email")}</td><td>${escapeHtml(member.membershipStatus)}<br><small>${escapeHtml(member.accountStatus)}</small></td><td>${roleChips}</td><td>${escapeHtml(formatDate(member.joinedAt))}</td><td><button class="dr-governance-button" data-variant="secondary" type="button" data-assign-org-role="${escapeHtml(member.userId)}">Assign role</button></td></tr>`;
    }).join("");
    elements.organizationMembers.innerHTML = `<table class="dr-governance-table"><thead><tr><th>Member</th><th>Membership</th><th>Organization roles</th><th>Joined</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No members found.</td></tr>'}</tbody></table>`;
  }

  async function loadReports() {
    if (!has("moderation.manage")) {
      elements.reports.innerHTML = '<div class="dr-governance-message">Moderation permission is required.</div>';
      return;
    }
    const data = await global.DictionaryRootAuth.request("/admin/moderation/reports?status=open&limit=25");
    elements.reports.innerHTML = (data.items || []).map(function (report) {
      return `<article class="dr-list-card"><div class="dr-governance-actions" style="justify-content:space-between"><h3>${escapeHtml(report.category)}</h3><span class="dr-governance-chip" data-tone="warning">${escapeHtml(report.status)}</span></div><p>${escapeHtml(report.targetType)} · ${escapeHtml(report.targetId)}</p><p>${escapeHtml(report.details || "No details")}</p><div class="dr-governance-actions"><button class="dr-governance-button" data-report-action="resolved" data-report-id="${escapeHtml(report.reportId)}" type="button">Resolve</button><button class="dr-governance-button" data-variant="secondary" data-report-action="dismissed" data-report-id="${escapeHtml(report.reportId)}" type="button">Dismiss</button></div></article>`;
    }).join("") || '<div class="dr-governance-message">No open moderation reports.</div>';
  }

  async function loadLocks() {
    if (!has("moderation.manage")) {
      elements.locks.innerHTML = '<div class="dr-governance-message">Moderation permission is required.</div>';
      elements.lockForm.querySelector("button").disabled = true;
      return;
    }
    const data = await global.DictionaryRootAuth.request("/admin/moderation/locks");
    elements.locks.innerHTML = (data.locks || []).map(function (lock) {
      return `<article class="dr-list-card"><div class="dr-governance-actions" style="justify-content:space-between"><h3>${escapeHtml(lock.targetType)} · ${escapeHtml(lock.targetId)}</h3><span class="dr-governance-chip" data-tone="warning">Locked</span></div><p>${escapeHtml(lock.reason)}</p><p>By ${escapeHtml(lock.lockedByName || "System")} · ${escapeHtml(formatDate(lock.createdAt))}${lock.expiresAt ? ` · expires ${escapeHtml(formatDate(lock.expiresAt))}` : ""}</p><div class="dr-governance-actions"><button class="dr-governance-button" data-variant="secondary" data-release-lock="${escapeHtml(lock.recordLockId)}" type="button">Release lock</button></div></article>`;
    }).join("") || '<div class="dr-governance-message">No active record locks.</div>';
  }

  async function loadAudit() {
    if (!has("audit.read")) {
      elements.audit.innerHTML = '<div class="dr-governance-message">Audit read permission is required.</div>';
      return;
    }
    const data = await global.DictionaryRootAuth.request("/admin/audit?limit=100");
    const rows = (data.items || []).map(function (item) {
      return `<tr><td>${escapeHtml(formatDate(item.createdAt))}</td><td>${escapeHtml(item.actorName || "System")}</td><td>${escapeHtml(item.action)}${item.organizationId ? `<br><small>${escapeHtml(item.organizationId)}</small>` : ""}</td><td>${escapeHtml(item.targetType)} · ${escapeHtml(item.targetId)}</td><td><span class="dr-governance-chip" data-tone="${item.outcome === "success" ? "success" : "danger"}">${escapeHtml(item.outcome)}</span></td><td>${escapeHtml(item.requestId || "—")}</td></tr>`;
    }).join("");
    elements.audit.innerHTML = `<table class="dr-governance-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Outcome</th><th>Request ID</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No audit events recorded.</td></tr>'}</tbody></table>`;
  }

  async function refresh() {
    setMessage("Refreshing governed administration data…", "");
    try {
      await Promise.all([loadOverview(), loadRoles(), loadUsers(), loadOrganizations(), loadReports(), loadLocks(), loadAudit()]);
      if (selectedOrganizationId) await loadOrganizationMembers(selectedOrganizationId);
      setMessage("Administration data refreshed.", "success");
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  function bindUserActions() {
    elements.users.addEventListener("click", async function (event) {
      const roleButton = event.target.closest("[data-admin-role]");
      const statusButton = event.target.closest("[data-admin-status]");
      try {
        if (roleButton) {
          const options = roles.map(function (role) { return role.roleKey; }).join(", ");
          const roleKey = global.prompt(`Role key (${options}):`, "contributor");
          if (!roleKey) return;
          const role = roles.find(function (item) { return item.roleKey === roleKey; });
          if (!role) throw new Error("Unknown role key.");
          let scopeId = "global";
          if (role.scope === "organization") {
            scopeId = global.prompt("Organization UUID for this scoped role:", "") || "";
            if (!scopeId) return;
          }
          await global.DictionaryRootAuth.request(`/admin/users/${encodeURIComponent(roleButton.dataset.adminRole)}/roles`, { method: "POST", body: { roleKey, scopeType: role.scope, scopeId } });
          setMessage("Role assigned.", "success");
          await loadUsers();
        }
        if (statusButton) {
          const suspended = statusButton.dataset.currentStatus === "suspended";
          const reason = global.prompt(`${suspended ? "Restore" : "Suspend"} this account. Record a reason:`, "");
          if (!reason) return;
          await global.DictionaryRootAuth.request(`/admin/users/${encodeURIComponent(statusButton.dataset.adminStatus)}/status`, { method: "POST", body: { status: suspended ? "active" : "suspended", reason } });
          setMessage(`Account ${suspended ? "restored" : "suspended"}.`, "success");
          await loadUsers();
        }
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  function bindOrganizationActions() {
    elements.organizations.addEventListener("click", async function (event) {
      const viewButton = event.target.closest("[data-view-members]");
      const inviteButton = event.target.closest("[data-invite-org]");
      try {
        if (viewButton) {
          await loadOrganizationMembers(viewButton.dataset.viewMembers);
          return;
        }
        if (!inviteButton) return;
        const email = global.prompt("Invite email:", "");
        if (!email) return;
        const options = organizationRoles().map(function (role) { return role.roleKey; }).join(", ");
        const roleKey = global.prompt(`Organization role key (${options}):`, "contributor");
        if (!roleKey) return;
        const result = await global.DictionaryRootAuth.request(`/admin/organizations/${encodeURIComponent(inviteButton.dataset.inviteOrg)}/invitations`, { method: "POST", body: { email, roleKey } });
        setMessage(result.developmentLink ? `Invitation created. Development delivery link: ${result.developmentLink}` : `Invitation sent using ${result.deliveryMode || "the configured email provider"}.`, "success");
      } catch (error) {
        setMessage(error.message, "error");
      }
    });

    elements.organizationMembers.addEventListener("click", async function (event) {
      const assignButton = event.target.closest("[data-assign-org-role]");
      const removeButton = event.target.closest("[data-remove-org-role]");
      if (!assignButton && !removeButton) return;
      try {
        if (assignButton) {
          const options = organizationRoles().map(function (role) { return role.roleKey; }).join(", ");
          const roleKey = global.prompt(`Organization role key (${options}):`, "contributor");
          if (!roleKey) return;
          if (!organizationRoles().some(function (role) { return role.roleKey === roleKey; })) throw new Error("Choose an organization-scoped role.");
          await global.DictionaryRootAuth.request(`/admin/organizations/${encodeURIComponent(selectedOrganizationId)}/members/${encodeURIComponent(assignButton.dataset.assignOrgRole)}/roles`, { method: "POST", body: { roleKey } });
          setMessage("Organization role assigned.", "success");
        } else {
          if (!global.confirm(`Remove the ${removeButton.dataset.removeOrgRole} role from this member?`)) return;
          await global.DictionaryRootAuth.request(`/admin/organizations/${encodeURIComponent(selectedOrganizationId)}/members/${encodeURIComponent(removeButton.dataset.memberUser)}/roles/${encodeURIComponent(removeButton.dataset.removeOrgRole)}`, { method: "DELETE" });
          setMessage("Organization role removed.", "success");
        }
        await loadOrganizationMembers(selectedOrganizationId);
        await loadOrganizations();
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  function bindModerationActions() {
    elements.reports.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-report-action]");
      if (!button) return;
      try {
        const note = global.prompt("Resolution note:", "") || "";
        await global.DictionaryRootAuth.request(`/admin/moderation/reports/${encodeURIComponent(button.dataset.reportId)}/resolve`, { method: "POST", body: { status: button.dataset.reportAction, note } });
        await loadReports();
        setMessage("Moderation report updated.", "success");
      } catch (error) {
        setMessage(error.message, "error");
      }
    });

    elements.lockForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        await global.DictionaryRootAuth.request("/admin/moderation/locks", { method: "POST", body: { targetType: elements.lockType.value.trim(), targetId: elements.lockTarget.value.trim(), reason: elements.lockReason.value.trim() } });
        elements.lockForm.reset();
        await loadLocks();
        setMessage("Record locked. Governed publication is blocked until release.", "success");
      } catch (error) {
        setMessage(error.message, "error");
      }
    });

    elements.locks.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-release-lock]");
      if (!button || !global.confirm("Release this publication lock?")) return;
      try {
        await global.DictionaryRootAuth.request(`/admin/moderation/locks/${encodeURIComponent(button.dataset.releaseLock)}`, { method: "DELETE" });
        await loadLocks();
        setMessage("Record lock released.", "success");
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  function bind() {
    elements.refresh.addEventListener("click", refresh);
    elements.userSearchForm.addEventListener("submit", function (event) {
      event.preventDefault();
      loadUsers().catch(function (error) { setMessage(error.message, "error"); });
    });
    elements.organizationForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        await global.DictionaryRootAuth.request("/admin/organizations", { method: "POST", body: { name: elements.organizationName.value.trim(), slug: elements.organizationSlug.value.trim() } });
        elements.organizationForm.reset();
        await loadOrganizations();
        setMessage("Organization created.", "success");
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
    bindUserActions();
    bindOrganizationActions();
    bindModerationActions();
  }

  function cache() {
    const id = function (value) { return document.getElementById(value); };
    elements.identity = id("dictionaryrootAdminIdentity");
    elements.identityDetail = id("dictionaryrootAdminIdentityDetail");
    elements.message = id("dictionaryrootAdminMessage");
    elements.denied = id("dictionaryrootAdminDenied");
    elements.workspace = id("dictionaryrootAdminWorkspace");
    elements.refresh = id("dictionaryrootAdminRefresh");
    elements.metrics = id("dictionaryrootAdminMetrics");
    elements.userSearchForm = id("dictionaryrootAdminUserSearchForm");
    elements.userSearch = id("dictionaryrootAdminUserSearch");
    elements.users = id("dictionaryrootAdminUsers");
    elements.roles = id("dictionaryrootAdminRoles");
    elements.organizationForm = id("dictionaryrootAdminOrganizationForm");
    elements.organizationName = id("dictionaryrootAdminOrganizationName");
    elements.organizationSlug = id("dictionaryrootAdminOrganizationSlug");
    elements.organizations = id("dictionaryrootAdminOrganizations");
    elements.organizationMembersPanel = id("dictionaryrootAdminOrganizationMembersPanel");
    elements.organizationMembersTitle = id("dictionaryrootAdminOrganizationMembersTitle");
    elements.organizationMembers = id("dictionaryrootAdminOrganizationMembers");
    elements.reports = id("dictionaryrootAdminReports");
    elements.lockForm = id("dictionaryrootAdminLockForm");
    elements.lockType = id("dictionaryrootAdminLockType");
    elements.lockTarget = id("dictionaryrootAdminLockTarget");
    elements.lockReason = id("dictionaryrootAdminLockReason");
    elements.locks = id("dictionaryrootAdminLocks");
    elements.audit = id("dictionaryrootAdminAudit");
  }

  async function init() {
    cache();
    bind();
    const ready = await global.DictionaryRootAuth.initialize();
    const authenticated = Boolean(ready.session && ready.session.authenticated);
    const allowed = authenticated && ["audit.read", "organization.manage", "user.manage", "moderation.manage", "system.admin"].some(has);
    const systemAdmin = allowed && hasSystem("system.admin");
    elements.denied.hidden = allowed;
    elements.workspace.hidden = !allowed;
    elements.identity.textContent = authenticated ? (ready.session.user.displayName || ready.session.user.primaryEmail) : "Not signed in";
    elements.identityDetail.textContent = allowed
      ? (systemAdmin ? "System-wide administrative permissions confirmed." : "Organization-scoped administrative permissions confirmed.")
      : "Sign in with an authorized account.";
    if (allowed && !hasSystem("organization.manage")) {
      Array.from(elements.organizationForm.elements).forEach(function (control) { control.disabled = true; });
      elements.organizationForm.title = "Only a system administrator can create a new organization. Organization administrators can invite members and manage organization-scoped roles in organizations already in their scope.";
    }
    if (allowed && !has("moderation.manage")) {
      Array.from(elements.lockForm.elements).forEach(function (control) { control.disabled = true; });
    }
    if (allowed) await refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
