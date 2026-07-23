(function dictionaryRootWorkflowPage(global) {
  "use strict";
  const state = { session: null, page: 1, limit: 20, totalPages: 0, selected: null };
  const elements = {};

  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
  function clean(value) { return String(value == null ? "" : value).trim(); }
  function formatDate(value) { if (!value) return "—"; try { return new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)); } catch (_) { return value; } }
  function pretty(value) { return JSON.stringify(value || {}, null, 2); }
  function has(permission) { return global.DictionaryRootAuth.hasPermission(permission); }
  function hasForOrganization(organizationId, permission) { return global.DictionaryRootAuth.hasOrganizationPermission(organizationId, permission); }
  function hasForProposal(proposal, permission) { return Boolean(proposal && hasForOrganization(proposal.organizationId, permission)); }
  function setMessage(message, tone) { elements.message.hidden = !message; elements.message.textContent = message || ""; elements.message.dataset.state = tone || ""; }
  function statusLabel(status) { return String(status || "").replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase()); }
  function statusTone(status) { return status === "published" || status === "approved" ? "success" : status === "rejected" || status === "superseded" ? "danger" : ["submitted","under_review","changes_requested"].includes(status) ? "warning" : ""; }

  async function loadSummary() {
    if (!state.session || !state.session.authenticated) { elements.metrics.innerHTML = ""; return; }
    try {
      const summary = await global.DictionaryRootAuth.request("/dictionaryroot/workflow/summary");
      const metrics = [
        [summary.total,"Visible proposals"],[summary.draft,"Draft"],[summary.submitted + summary.under_review,"In review"],[summary.changes_requested,"Changes requested"],[summary.approved,"Approved"],[summary.published,"Published"],[summary.rejected,"Rejected"]
      ];
      elements.metrics.innerHTML = metrics.map(([value,label]) => `<div class="dr-metric-card"><strong>${Number(value||0).toLocaleString()}</strong><span>${escapeHtml(label)}</span></div>`).join("");
    } catch (error) { elements.metrics.innerHTML = `<div class="dr-governance-message" data-state="error">${escapeHtml(error.message)}</div>`; }
  }

  function updateUrl(proposalId, mode) {
    const url = new URL(global.location.href);
    if (proposalId) url.searchParams.set("proposal", proposalId); else url.searchParams.delete("proposal");
    global.history[mode || "replaceState"]({}, "", url);
  }

  async function loadQueue(selectId) {
    if (!state.session || !state.session.authenticated) return;
    elements.queueStatus.textContent = "Loading live proposals…";
    try {
      const params = new URLSearchParams({ page:String(state.page), limit:String(state.limit), status:elements.status.value, targetType:elements.targetTypeFilter.value });
      if (clean(elements.search.value)) params.set("q", clean(elements.search.value));
      const payload = await global.DictionaryRootAuth.request(`/dictionaryroot/workflow/proposals?${params.toString()}`);
      state.totalPages = payload.totalPages || 0;
      elements.page.textContent = `Page ${payload.page}${payload.totalPages ? ` of ${payload.totalPages}` : ""}`;
      elements.previous.disabled = payload.page <= 1;
      elements.next.disabled = !payload.totalPages || payload.page >= payload.totalPages;
      elements.queueStatus.textContent = `${payload.total.toLocaleString()} visible proposal${payload.total === 1 ? "" : "s"}.`;
      elements.queue.innerHTML = payload.items.length ? payload.items.map(item => `<button class="dr-list-card" type="button" data-proposal-id="${escapeHtml(item.proposalId)}" data-selected="${state.selected && state.selected.proposal.proposalId === item.proposalId}">
        <div class="dr-governance-actions" style="justify-content:space-between"><h3>#${item.proposalNumber} ${escapeHtml(item.title)}</h3><span class="dr-governance-chip" data-tone="${statusTone(item.status)}">${escapeHtml(statusLabel(item.status))}</span></div>
        <p>${escapeHtml(item.targetType)} · ${escapeHtml(item.targetId)}${item.organizationId ? ` · organization ${escapeHtml(item.organizationId)}` : " · system scope"}</p><p>${escapeHtml(item.summary || "No summary")}</p><div class="dr-chip-row"><span class="dr-governance-chip">${escapeHtml(item.creatorName || "Unknown creator")}</span><span class="dr-governance-chip">Updated ${escapeHtml(formatDate(item.updatedAt))}</span></div>
      </button>`).join("") : '<div class="dr-governance-message">No proposals match these filters.</div>';
      const desired = selectId || new URL(global.location.href).searchParams.get("proposal");
      if (desired && payload.items.some(item => item.proposalId === desired)) await selectProposal(desired, false);
    } catch (error) {
      elements.queue.innerHTML = `<div class="dr-governance-message" data-state="error">${escapeHtml(error.message)}</div>`;
      elements.queueStatus.textContent = "Workflow queue unavailable.";
    }
  }

  function actionButton(label, action, variant) { return `<button class="dr-governance-button" ${variant ? `data-variant="${variant}"` : ""} type="button" data-workflow-action="${action}">${escapeHtml(label)}</button>`; }

  function renderActions(detail) {
    const proposal = detail.proposal;
    const owner = state.session.user && proposal.createdByUserId === state.session.user.userId;
    const buttons = [];
    if ((proposal.status === "draft" || proposal.status === "changes_requested") && owner && hasForProposal(proposal, "revision.submit")) {
      buttons.push(actionButton("Edit draft","edit","secondary"), actionButton("Submit for review","submit"), actionButton("Withdraw","withdraw","danger"));
    }
    if (proposal.status === "submitted" && hasForProposal(proposal, "revision.review")) buttons.push(actionButton("Start review","start-review","secondary"));
    if (["submitted","under_review"].includes(proposal.status) && hasForProposal(proposal, "revision.review")) {
      buttons.push(actionButton("Request changes","request-changes","warning"), actionButton("Approve","approve"), actionButton("Reject","reject","danger"));
    }
    if (proposal.status === "approved" && hasForProposal(proposal, "revision.publish")) buttons.push(actionButton("Publish governed revision","publish"));
    if (proposal.status === "published" && hasForProposal(proposal, "revision.publish") && detail.publications[0] && !detail.publications[0].rolledBackAt) buttons.push(actionButton("Roll back publication","rollback","danger"));
    elements.detailActions.innerHTML = buttons.join("") || '<span class="dr-governance-help">No workflow actions are available for your role and this proposal state.</span>';
  }

  function renderDetail(detail) {
    state.selected = detail;
    const p = detail.proposal;
    elements.empty.hidden = true;
    elements.detail.hidden = false;
    elements.detailTitle.textContent = `#${p.proposalNumber} ${p.title}`;
    elements.detailMeta.textContent = `${p.targetType} · ${p.targetId} · ${p.organizationId ? `organization ${p.organizationId}` : "system scope"} · created by ${p.creatorName || "unknown"} · version ${p.versionNumber} · updated ${formatDate(p.updatedAt)}`;
    elements.detailStatus.textContent = statusLabel(p.status);
    elements.detailStatus.dataset.tone = statusTone(p.status);
    elements.detailSummary.textContent = p.summary || "No proposal summary was provided.";
    elements.base.textContent = pretty(p.baseSnapshot);
    elements.patch.textContent = pretty(p.proposedPatch);
    elements.disclosure.textContent = p.interpretationDisclosure || "No interpretation disclosure was recorded.";
    elements.rationale.textContent = p.editorialRationale || "No editorial rationale was recorded.";
    elements.evidence.innerHTML = detail.evidence.length ? detail.evidence.map(item => `<article class="dr-list-card"><h3>${escapeHtml(item.sourceId)}</h3><p>${escapeHtml(item.role)}${item.assertionId ? ` · assertion ${escapeHtml(item.assertionId)}` : ""}</p><p>${escapeHtml(item.note || "No evidence note")}</p></article>`).join("") : '<div class="dr-governance-message" data-state="warning">No SourceRoot evidence was attached to this proposal.</div>';
    elements.comments.innerHTML = detail.comments.length ? detail.comments.map(item => `<article class="dr-list-card"><div class="dr-governance-actions" style="justify-content:space-between"><h3>${escapeHtml(item.authorName || "Unknown")}</h3><span class="dr-governance-chip">${escapeHtml(item.commentType.replace(/_/g," "))}</span></div><p>${escapeHtml(item.body)}</p><p>${escapeHtml(formatDate(item.createdAt))}</p></article>`).join("") : '<div class="dr-governance-message">No discussion has been recorded.</div>';
    const publicationCards = detail.publications.map(item => `<article class="dr-list-card"><h3>Publication ${escapeHtml(item.revisionId)}</h3><p>${escapeHtml(item.note || "No publication note")}</p><div class="dr-chip-row"><span class="dr-governance-chip" data-tone="${item.rolledBackAt ? "danger" : "success"}">${item.rolledBackAt ? "Rolled back" : "Active publication"}</span><span class="dr-governance-chip">${escapeHtml(formatDate(item.createdAt))}</span></div>${item.rollbackReason ? `<p>Rollback: ${escapeHtml(item.rollbackReason)}</p>` : ""}</article>`).join("");
    const events = detail.events.slice().reverse().map(item => `<article class="dr-list-card"><h3>${escapeHtml(item.eventType.replace(/\./g," "))}</h3><p>${escapeHtml(item.actorName || "System")} · ${escapeHtml(formatDate(item.createdAt))}</p>${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}</article>`).join("");
    elements.events.innerHTML = publicationCards + events || '<div class="dr-governance-message">No events recorded.</div>';
    renderActions(detail);
    document.querySelectorAll("[data-proposal-id]").forEach(el => el.dataset.selected = String(el.dataset.proposalId === p.proposalId));
  }

  async function selectProposal(proposalId, push) {
    try {
      const detail = await global.DictionaryRootAuth.request(`/dictionaryroot/workflow/proposals/${encodeURIComponent(proposalId)}`);
      renderDetail(detail);
      updateUrl(proposalId, push === false ? "replaceState" : "pushState");
    } catch (error) { setMessage(error.message, "error"); }
  }

  function fillForm(proposal) {
    elements.formTitle.textContent = proposal ? `Edit proposal #${proposal.proposalNumber}` : "Create proposal";
    elements.proposalForm.dataset.editing = proposal ? proposal.proposalId : "";
    elements.proposalOrganization.value = proposal ? (proposal.organizationId || "") : elements.proposalOrganization.value;
    elements.proposalOrganization.disabled = Boolean(proposal);
    elements.proposalTargetType.value = proposal ? proposal.targetType : "meaning";
    elements.proposalTargetId.value = proposal ? proposal.targetId : (new URL(global.location.href).searchParams.get("targetId") || "");
    elements.proposalTargetType.disabled = Boolean(proposal);
    elements.proposalTargetId.disabled = Boolean(proposal);
    elements.proposalTitle.value = proposal ? proposal.title : "";
    elements.proposalSummary.value = proposal ? proposal.summary : "";
    elements.proposalBase.value = pretty(proposal ? proposal.baseSnapshot : {});
    elements.proposalPatch.value = pretty(proposal ? proposal.proposedPatch : {});
    elements.proposalRationale.value = proposal ? proposal.editorialRationale : "";
    elements.proposalDisclosure.value = proposal ? proposal.interpretationDisclosure : "";
    elements.proposalSources.value = "";
    elements.dialog.showModal();
  }

  function parseJson(text, label) {
    try { const value = JSON.parse(text || "{}"); if (!value || Array.isArray(value) || typeof value !== "object") throw new Error(); return value; }
    catch (_) { throw new Error(`${label} must be a valid JSON object.`); }
  }

  async function saveProposal(event) {
    event.preventDefault();
    try {
      const editing = elements.proposalForm.dataset.editing;
      const payload = {
        title: clean(elements.proposalTitle.value), summary: clean(elements.proposalSummary.value),
        proposedPatch: parseJson(elements.proposalPatch.value, "Proposed overlay"),
        editorialRationale: clean(elements.proposalRationale.value), interpretationDisclosure: clean(elements.proposalDisclosure.value)
      };
      let detail;
      if (editing) {
        detail = await global.DictionaryRootAuth.request(`/dictionaryroot/workflow/proposals/${encodeURIComponent(editing)}`, { method:"PATCH", body:payload });
      } else {
        payload.organizationId = elements.proposalOrganization.value || null;
        payload.targetType = elements.proposalTargetType.value;
        payload.targetId = clean(elements.proposalTargetId.value);
        payload.baseSnapshot = parseJson(elements.proposalBase.value, "Base snapshot");
        payload.evidence = elements.proposalSources.value.split(/\r?\n/).map(clean).filter(Boolean).map(sourceId => ({ sourceId, role:"supporting" }));
        detail = await global.DictionaryRootAuth.request("/dictionaryroot/workflow/proposals", { method:"POST", body:payload });
      }
      elements.dialog.close();
      setMessage(editing ? "Draft proposal updated." : "Draft proposal created.", "success");
      await Promise.all([loadSummary(), loadQueue(detail.proposal.proposalId)]);
      renderDetail(detail);
    } catch (error) { setMessage(error.message, "error"); }
  }

  async function performAction(action) {
    if (!state.selected) return;
    const p = state.selected.proposal;
    if (action === "edit") { fillForm(p); return; }
    let endpoint = action;
    let body = { note:"" };
    if (action === "request-changes") body.note = global.prompt("Describe the required changes:", "") || "";
    else if (["approve","reject","submit","withdraw","start-review","publish"].includes(action)) body.note = global.prompt(`Optional note for ${action.replace(/-/g," ")}:`, "") || "";
    else if (action === "rollback") {
      const reason = global.prompt("A rollback reason is required:", "");
      if (!reason) return;
      endpoint = `/dictionaryroot/workflow/publications/${encodeURIComponent(state.selected.publications[0].publicationId)}/rollback`;
      body = { reason };
    }
    try {
      const path = action === "rollback" ? endpoint : `/dictionaryroot/workflow/proposals/${encodeURIComponent(p.proposalId)}/${endpoint}`;
      const detail = await global.DictionaryRootAuth.request(path, { method:"POST", body });
      renderDetail(detail);
      await Promise.all([loadSummary(), loadQueue(p.proposalId)]);
      setMessage(`Workflow action completed: ${action.replace(/-/g," ")}.`, "success");
    } catch (error) { setMessage(error.message, "error"); }
  }

  function bind() {
    elements.refresh.addEventListener("click", () => Promise.all([loadSummary(), loadQueue()]));
    elements.newButton.addEventListener("click", () => fillForm(null));
    elements.closeDialog.addEventListener("click", () => elements.dialog.close());
    elements.proposalForm.addEventListener("submit", saveProposal);
    elements.filters.addEventListener("submit", event => { event.preventDefault(); state.page=1; loadQueue(); });
    elements.queue.addEventListener("click", event => { const card=event.target.closest("[data-proposal-id]"); if(card) selectProposal(card.dataset.proposalId,true); });
    elements.detailActions.addEventListener("click", event => { const button=event.target.closest("[data-workflow-action]"); if(button) performAction(button.dataset.workflowAction); });
    elements.commentForm.addEventListener("submit", async event => { event.preventDefault(); if(!state.selected) return; try { const detail=await global.DictionaryRootAuth.request(`/dictionaryroot/workflow/proposals/${encodeURIComponent(state.selected.proposal.proposalId)}/comments`,{method:"POST",body:{body:clean(elements.comment.value),type:"discussion"}}); elements.comment.value=""; renderDetail(detail); setMessage("Comment added.","success"); } catch(error){setMessage(error.message,"error");} });
    elements.previous.addEventListener("click",()=>{if(state.page>1){state.page--;loadQueue();}});
    elements.next.addEventListener("click",()=>{if(state.page<state.totalPages){state.page++;loadQueue();}});
    global.addEventListener("popstate",()=>{const id=new URL(global.location.href).searchParams.get("proposal");if(id)selectProposal(id,false);});
  }

  function cache() {
    const id=value=>document.getElementById(value);
    elements.identity=id("dictionaryrootWorkflowIdentity"); elements.identityDetail=id("dictionaryrootWorkflowIdentityDetail"); elements.message=id("dictionaryrootWorkflowMessage");
    elements.metrics=id("dictionaryrootWorkflowMetrics"); elements.refresh=id("dictionaryrootWorkflowRefresh"); elements.newButton=id("dictionaryrootWorkflowNew"); elements.signedOut=id("dictionaryrootWorkflowSignedOut"); elements.workspace=id("dictionaryrootWorkflowWorkspace");
    elements.filters=id("dictionaryrootWorkflowFilters"); elements.search=id("dictionaryrootWorkflowSearch"); elements.status=id("dictionaryrootWorkflowStatus"); elements.targetTypeFilter=id("dictionaryrootWorkflowTargetTypeFilter"); elements.queueStatus=id("dictionaryrootWorkflowQueueStatus"); elements.queue=id("dictionaryrootWorkflowQueue"); elements.previous=id("dictionaryrootWorkflowPrevious"); elements.next=id("dictionaryrootWorkflowNext"); elements.page=id("dictionaryrootWorkflowPage");
    elements.empty=id("dictionaryrootWorkflowEmpty"); elements.detail=id("dictionaryrootWorkflowDetail"); elements.detailTitle=id("dictionaryrootWorkflowDetailTitle"); elements.detailMeta=id("dictionaryrootWorkflowDetailMeta"); elements.detailStatus=id("dictionaryrootWorkflowDetailStatus"); elements.detailSummary=id("dictionaryrootWorkflowDetailSummary"); elements.detailActions=id("dictionaryrootWorkflowDetailActions"); elements.base=id("dictionaryrootWorkflowBase"); elements.patch=id("dictionaryrootWorkflowPatch"); elements.evidence=id("dictionaryrootWorkflowEvidence"); elements.disclosure=id("dictionaryrootWorkflowDisclosure"); elements.rationale=id("dictionaryrootWorkflowRationale"); elements.comments=id("dictionaryrootWorkflowComments"); elements.commentForm=id("dictionaryrootWorkflowCommentForm"); elements.comment=id("dictionaryrootWorkflowComment"); elements.events=id("dictionaryrootWorkflowEvents");
    elements.dialog=id("dictionaryrootWorkflowDialog"); elements.proposalForm=id("dictionaryrootWorkflowProposalForm"); elements.formTitle=id("dictionaryrootWorkflowFormTitle"); elements.closeDialog=id("dictionaryrootWorkflowCloseDialog"); elements.proposalOrganization=id("dictionaryrootProposalOrganization"); elements.proposalTargetType=id("dictionaryrootProposalTargetType"); elements.proposalTargetId=id("dictionaryrootProposalTargetId"); elements.proposalTitle=id("dictionaryrootProposalTitle"); elements.proposalSummary=id("dictionaryrootProposalSummary"); elements.proposalBase=id("dictionaryrootProposalBase"); elements.proposalPatch=id("dictionaryrootProposalPatch"); elements.proposalRationale=id("dictionaryrootProposalRationale"); elements.proposalDisclosure=id("dictionaryrootProposalDisclosure"); elements.proposalSources=id("dictionaryrootProposalSources");
  }

  async function init() {
    cache(); bind();
    const ready=await global.DictionaryRootAuth.initialize(); state.session=ready.session;
    const signedIn=Boolean(state.session&&state.session.authenticated);
    const createOrganizations = signedIn ? global.DictionaryRootAuth.authorizedOrganizations("revision.create") : [];
    const systemCreate = signedIn && global.DictionaryRootAuth.hasSystemPermission("revision.create");
    elements.proposalOrganization.innerHTML = [
      ...(systemCreate ? ['<option value="">System scope</option>'] : []),
      ...createOrganizations.map(item => `<option value="${escapeHtml(item.organizationId)}">${escapeHtml(item.organizationName)} (${escapeHtml(item.organizationSlug)})</option>`)
    ].join("");
    elements.signedOut.hidden=signedIn; elements.workspace.hidden=!signedIn; elements.newButton.disabled=!signedIn||(!systemCreate&&!createOrganizations.length);
    elements.identity.textContent=signedIn?(state.session.user.displayName||state.session.user.primaryEmail):"Not signed in";
    elements.identityDetail.textContent=signedIn?`${state.session.roles.join(", ")||"registered"} · ${state.session.permissions.length} effective permissions`:"Sign in to create or review proposals.";
    if(signedIn){await Promise.all([loadSummary(),loadQueue()]);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})(window);
