(function historyRootGovernanceFactory(global) {
  "use strict";

  const ui = global.HistoryRootShared;
  const auth = global.DictionaryRootAuth;
  const page = document.documentElement.dataset.historyGovernancePage || "";

  const TARGET_TYPES = [
    "entity",
    "temporal_assertion",
    "account",
    "claim",
    "evidence",
    "source",
    "relationship",
    "interpretation",
    "perspective",
    "causal_link",
    "cultural_memory"
  ];

  const TYPE_FIELDS = {
    entity: [
      field("label", "Editorial label", "text", true),
      field("name", "Canonical name", "text", true),
      field("alternateNames", "Aliases (one per line)", "array"),
      field("entityType", "Entity classification", "select", true, [
        "person", "group", "organization", "cultural_community", "place",
        "event", "document", "work", "political_jurisdiction"
      ]),
      field("description", "Description", "textarea"),
      field("metadata.namingNote", "Naming context", "textarea"),
      field("sourceIds", "Supporting source IDs (one per line)", "array")
    ],
    temporal_assertion: [
      field("label", "Chronology label", "text", true),
      field("subjectId", "Subject stable ID", "text", true),
      field("temporalKind", "Temporal precision", "select", true, [
        "exact", "approximate", "range", "before", "after", "disputed",
        "unknown", "multiple_proposed"
      ]),
      field("exactDate", "Nominal or exact date", "date"),
      field("startDate", "Start date", "date"),
      field("endDate", "End date", "date"),
      field("dateLabel", "Human-readable date", "text", true),
      field("datePrecision", "Date precision", "text"),
      field("startUncertainty", "Start uncertainty", "textarea"),
      field("endUncertainty", "End uncertainty", "textarea"),
      field("dateNotes", "Chronology notes", "textarea"),
      field("sourceIds", "Evidence source IDs (one per line)", "array")
    ],
    account: [
      field("label", "Account label", "text", true),
      field("subjectId", "Subject stable ID", "text", true),
      field("authorEntityId", "Attributed author stable ID", "text"),
      field("sourceId", "Source stable ID", "text"),
      field("accountType", "Account type", "text", true),
      field("content", "Attributed account", "textarea", true),
      field("publicationLabel", "Publication context", "text")
    ],
    claim: [
      field("label", "Claim label", "text", true),
      field("accountId", "Account stable ID", "text", true),
      field("subjectId", "Subject stable ID", "text", true),
      field("objectId", "Object stable ID", "text"),
      field("claimType", "Claim classification", "text", true),
      field("statement", "Historical claim", "textarea", true),
      field("confidence", "Confidence or dispute status", "text"),
      field("uncertainty", "Uncertainty or qualification", "textarea"),
      field("metadata.locator", "Evidence locator", "textarea"),
      field("metadata.limitation", "Evidence limitation", "textarea"),
      field("sourceIds", "Evidence source IDs (one per line)", "array")
    ],
    evidence: [
      field("label", "Evidence label", "text", true),
      field("claimId", "Claim stable ID", "text", true),
      field("evidenceType", "Evidence role", "select", true, [
        "evidence", "counterevidence"
      ]),
      field("sourceId", "Source stable ID", "text"),
      field("accountId", "Account stable ID", "text"),
      field("evidenceRecordId", "Evidence record stable ID", "text"),
      field("explanation", "How this evidence bears on the claim", "textarea", true),
      field("strength", "Evidence strength", "text"),
      field("confidence", "Confidence", "text"),
      field("metadata.locator", "Source locator", "textarea"),
      field("metadata.limitation", "Evidence limitation", "textarea")
    ],
    source: [
      field("name", "Source name", "text", true),
      field("type", "Source type", "text", true),
      field("publisher", "Publisher or institution", "text"),
      field("sourceClass", "Source classification", "text", true),
      field("url", "Repository URL", "url"),
      field("citation", "Citation", "textarea"),
      field("accessStatus", "Inspection status", "select", true, [
        "accessed-and-inspected", "metadata-verified-not-inspected",
        "not-inspected"
      ]),
      field("locatorsInspected", "Inspected locators (one per line)", "array"),
      field("limitations", "Source limitations", "textarea", true),
      field("supportsDetailedClaims", "Supports detailed claims", "checkbox"),
      field("notes", "Source notes", "textarea")
    ],
    relationship: [
      field("label", "Relationship label", "text", true),
      field("fromId", "From stable ID", "text", true),
      field("toId", "To stable ID", "text", true),
      field("relationshipType", "Relationship type", "text", true),
      field("relationshipRole", "Relationship role", "text"),
      field("explanation", "Historical meaning", "textarea"),
      field("confidence", "Confidence", "text"),
      field("uncertainty", "Uncertainty or qualification", "textarea"),
      field("sourceIds", "Supporting source IDs (one per line)", "array")
    ],
    interpretation: [
      field("label", "Interpretation label", "text", true),
      field("subjectId", "Related record stable ID", "text", true),
      field("accountId", "Related account stable ID", "text"),
      field("sourceId", "Attributed source stable ID", "text"),
      field("interpretation", "Attributed interpretation", "textarea", true),
      field("confidence", "Editorial confidence", "text"),
      field("uncertainty", "Interpretive limits", "textarea"),
      field("publishedConclusion", "Published conclusion", "checkbox"),
      field("perspectiveLinks", "Perspective IDs (one per line)", "perspectives")
    ],
    perspective: [
      field("label", "Perspective label", "text", true),
      field("name", "Attributed person, community, institution, or framework", "text", true),
      field("description", "Perspective description and scope", "textarea", true),
      field("sourceIds", "Attribution source IDs (one per line)", "array")
    ],
    causal_link: [
      field("label", "Causal relationship label", "text", true),
      field("causeId", "Cause or condition stable ID", "text", true),
      field("effectId", "Effect stable ID", "text", true),
      field("causalKind", "Direction", "select", true, ["cause", "consequence"]),
      field("metadata.qualification", "Causal qualification", "select", true, [
        "structural cause", "contributing cause", "immediate cause", "trigger",
        "enabling condition", "short-term consequence",
        "long-term consequence", "disputed relationship"
      ]),
      field("explanation", "Qualified causal explanation", "textarea", true),
      field("confidence", "Confidence or dispute status", "text"),
      field("uncertainty", "Uncertainty", "textarea"),
      field("sourceIds", "Evidence source IDs (one per line)", "array")
    ],
    cultural_memory: [
      field("label", "Memory record label", "text", true),
      field("subjectId", "Underlying historical record stable ID", "text", true),
      field("perspectiveId", "Documenting perspective or institution ID", "text"),
      field("sourceId", "Source stable ID", "text"),
      field("memoryType", "Memory classification", "text", true),
      field("narrative", "Remembered narrative or tradition", "textarea", true),
      field("periodLabel", "Memory tradition period", "text"),
      field("metadata.memoryStatus", "Relationship to event fact", "select", true, [
        "supported", "disputed", "symbolic", "separate-from-event-fact"
      ]),
      field("sourceIds", "Supporting source IDs (one per line)", "array")
    ]
  };

  const FIELD_LABELS = Object.fromEntries(
    Object.values(TYPE_FIELDS)
      .flat()
      .map((item) => [item.key, item.label])
  );

  const HIGH_RISK_FIELDS = new Set([
    "alternateNames", "temporalKind", "exactDate", "datePrecision",
    "uncertainty", "startUncertainty", "endUncertainty", "sourceIds",
    "limitations", "sourceClass", "confidence", "perspectiveLinks",
    "perspectiveId", "causalKind", "metadata.qualification", "memoryType",
    "metadata.memoryStatus", "relationshipType"
  ]);

  let manifest;
  let proposalDetail = null;

  function field(key, label, type, required, options) {
    return { key, label, type, required: Boolean(required), options: options || [] };
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function node(tag, className, text) {
    return ui.element(tag, {
      className: className || "",
      text: text === undefined ? undefined : text
    });
  }

  function append(parent) {
    return ui.append.apply(null, arguments);
  }

  function clear(parent) {
    return ui.clear(parent);
  }

  function human(value) {
    return ui.humanize(value || "");
  }

  function getPath(object, path) {
    return path.split(".").reduce((value, key) => {
      return value && typeof value === "object" ? value[key] : undefined;
    }, object);
  }

  function setPath(object, path, value) {
    const parts = path.split(".");
    let cursor = object;
    parts.forEach((key, index) => {
      if (index === parts.length - 1) {
        cursor[key] = value;
      } else {
        if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
        cursor = cursor[key];
      }
    });
  }

  function equal(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function displayValue(value) {
    if (value === undefined || value === null || value === "") return "Not stated";
    if (Array.isArray(value)) {
      if (!value.length) return "None";
      return value.map((item) => {
        return typeof item === "object" ? JSON.stringify(item) : String(item);
      }).join("\n");
    }
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  }

  function state(title, message, action) {
    const container = byId("historyGovernanceState");
    if (!container) return;
    clear(container);
    append(container, node("h2", "", title), node("p", "", message));
    if (action) append(container, action);
    container.hidden = false;
    const content = byId("historyGovernanceContent");
    if (content) content.hidden = true;
  }

  function showContent() {
    const stateNode = byId("historyGovernanceState");
    const content = byId("historyGovernanceContent");
    if (stateNode) stateNode.hidden = true;
    if (content) content.hidden = false;
  }

  function retryButton(callback) {
    const button = node("button", "hrg-button", "Retry");
    button.type = "button";
    button.addEventListener("click", callback);
    return button;
  }

  function signInLink() {
    const link = node("a", "hrg-button", "Sign in to SourceRoot");
    const returnTo = `${global.location.pathname}${global.location.search}`;
    link.href = `account-v1.html?returnTo=${encodeURIComponent(returnTo)}`;
    return link;
  }

  function renderSession() {
    const session = auth.session;
    const account = byId("historyGovernanceAccount");
    const title = byId("historyGovernanceSessionTitle");
    const copy = byId("historyGovernanceSessionCopy");
    document.querySelectorAll("[data-governance-permissions]").forEach((control) => {
      const permissions = control.dataset.governancePermissions
        .split(/\s+/)
        .filter(Boolean);
      control.hidden = !session?.authenticated
        || !permissions.some((permission) => auth.hasPermission(permission));
    });
    if (!session || !session.authenticated) {
      if (account) account.textContent = "Not signed in";
      if (title) title.textContent = "Sign in required";
      if (copy) copy.textContent = "Public HistoryRoot remains available; private proposal data does not.";
      return;
    }
    if (account) account.textContent = session.user.displayName || "Signed in";
    if (title) title.textContent = session.user.displayName || "Authenticated user";
    const organizations = Array.isArray(session.organizations)
      ? session.organizations.filter((item) => item.membershipStatus === "active")
      : [];
    if (copy) {
      copy.textContent = organizations.length
        ? `${organizations.length} active organization scope${organizations.length === 1 ? "" : "s"} · ${session.permissions.length} effective permissions`
        : "Signed in without an active editorial organization.";
    }
  }

  function requireSession() {
    if (auth.session && auth.session.authenticated) return true;
    state(
      "Sign in to use governance",
      "HistoryRoot is public, but drafts, review notes, and workflow actions require an authenticated SourceRoot account.",
      signInLink()
    );
    return false;
  }

  function hasOrgPermission(organizationId, permission) {
    return auth.hasOrganizationPermission(organizationId, permission);
  }

  function hasGovernancePermission() {
    return ["revision.create", "revision.review", "revision.publish"]
      .some((permission) => auth.hasPermission(permission));
  }

  function targetOption(type) {
    const option = node("option", "", ui.typeLabel(type));
    option.value = type;
    return option;
  }

  function fillTypeSelect(select) {
    TARGET_TYPES.forEach((type) => append(select, targetOption(type)));
  }

  function chip(text, tone) {
    const item = node("span", "hrg-chip", text);
    if (tone) item.dataset.tone = tone;
    return item;
  }

  function statusTone(status) {
    if (["published", "approved"].includes(status)) return "success";
    if (["rejected", "withdrawn", "superseded"].includes(status)) return "danger";
    if (["changes_requested", "under_review"].includes(status)) return "warning";
    return "";
  }

  function publicRecordHref(targetType, targetId) {
    if (targetType === "source") {
      return `history-sources-v1.html?source=${encodeURIComponent(targetId)}`;
    }
    return `history-record-v1.html?id=${encodeURIComponent(targetId)}`;
  }

  function proposalCard(proposal, reviewMode) {
    const card = node("article", "hrg-card");
    const head = node("div", "hrg-card-head");
    const heading = node("h3");
    const link = node("a", "", proposal.title || "Untitled proposal");
    const destination = reviewMode
      ? "history-review-v1.html"
      : "history-proposal-v1.html";
    link.href = `${destination}?proposalId=${encodeURIComponent(proposal.proposalId)}`;
    append(heading, link);
    append(head, heading, chip(human(proposal.status), statusTone(proposal.status)));
    const meta = node("div", "hrg-meta-row");
    append(
      meta,
      chip(ui.typeLabel(proposal.targetType)),
      node("span", "", human(proposal.changeType)),
      node("span", "", proposal.creatorName || "Unknown contributor"),
      node("span", "", proposal.updatedAt ? `Updated ${new Date(proposal.updatedAt).toLocaleDateString()}` : "")
    );
    const validation = proposal.validation || {};
    const warnings = Array.isArray(validation.warnings) ? validation.warnings.length : 0;
    const errors = Array.isArray(validation.errors) ? validation.errors.length : 0;
    if (errors) append(meta, chip(`${errors} validation error${errors === 1 ? "" : "s"}`, "danger"));
    if (warnings) append(meta, chip(`${warnings} warning${warnings === 1 ? "" : "s"}`, "warning"));
    if (proposal.staleBase) append(meta, chip("Stale base", "danger"));
    const summary = node("p", "", proposal.summary || `Target ${proposal.targetId}`);
    const actions = node("div", "hrg-actions");
    const open = node("a", "hrg-button", reviewMode ? "Review proposal" : "Open proposal");
    open.href = link.href;
    const publicLink = node("a", "hrg-button", "View public record");
    publicLink.dataset.variant = "secondary";
    publicLink.href = publicRecordHref(proposal.targetType, proposal.targetId);
    append(actions, open, publicLink);
    append(card, head, meta, summary, actions);
    return card;
  }

  function applyFilterState(defaultStatus) {
    const params = new URLSearchParams(global.location.search);
    const controls = {
      status: byId("historyGovernanceStatus"),
      targetType: byId("historyGovernanceType"),
      warningStatus: byId("historyGovernanceWarnings"),
      q: byId("historyGovernanceQuery"),
      sort: byId("historyGovernanceSort")
    };
    Object.entries(controls).forEach(([key, control]) => {
      if (!control) return;
      control.value = params.get(key) || (key === "status" ? defaultStatus : "");
    });
    return params;
  }

  async function loadDashboard(reviewMode) {
    if (!requireSession()) return;
    if (!hasGovernancePermission()) {
      state(
        "Governance permission required",
        "Your current SourceRoot roles do not include access to HistoryRoot proposal, review, or publication tools."
      );
      return;
    }
    const canReview = auth.hasPermission("revision.review");
    if (reviewMode && !canReview) {
      state(
        "Review permission required",
        "Your current SourceRoot roles do not include revision.review in an active organization."
      );
      return;
    }
    const newLink = byId("historyGovernanceNewLink");
    const reviewLink = byId("historyGovernanceReviewLink");
    if (newLink) newLink.hidden = !auth.hasPermission("revision.create");
    if (reviewLink) reviewLink.hidden = !canReview;
    const typeSelect = byId("historyGovernanceType");
    fillTypeSelect(typeSelect);
    const defaultStatus = reviewMode ? "submitted" : "all";
    const params = applyFilterState(defaultStatus);
    const filters = byId("historyGovernanceFilters");
    filters.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = new URLSearchParams();
      new FormData(filters).forEach((value, key) => {
        const text = String(value).trim();
        if (text && text !== "all") next.set(key, text);
      });
      global.location.assign(`${global.location.pathname}?${next.toString()}`);
    });

    try {
      const query = new URLSearchParams({
        rootKey: "historyroot",
        bundleId: manifest.bundleId,
        page: "1",
        limit: "100"
      });
      ["status", "targetType", "warningStatus", "q", "sort"].forEach((key) => {
        const value = params.get(key);
        if (value && value !== "all") query.set(key, value);
      });
      const [summary, proposals] = await Promise.all([
        auth.request("/governance/summary"),
        auth.request(`/governance/proposals?${query.toString()}`)
      ]);
      if (!proposals || !Array.isArray(proposals.items)) {
        throw new Error("The proposal API returned an unexpected response.");
      }
      const summaryGrid = byId("historyGovernanceSummary");
      if (summaryGrid && summary) {
        clear(summaryGrid);
        [
          ["draft", "Drafts"],
          ["submitted", "Submitted"],
          ["under_review", "Under review"],
          ["changes_requested", "Changes requested"],
          ["approved", "Approved"],
          ["published", "Published"]
        ].forEach(([key, label]) => {
          const item = node("div", "hrg-summary-card");
          append(item, node("strong", "", String(summary[key] || 0)), node("span", "", label));
          append(summaryGrid, item);
        });
      }
      const list = byId("historyGovernanceList");
      clear(list);
      if (!proposals.items.length) {
        append(
          list,
          node("p", "hrg-help", reviewMode
            ? "No proposals match this authorized review queue."
            : "No proposals match these filters.")
        );
      } else {
        proposals.items.forEach((proposal) => {
          append(list, proposalCard(proposal, reviewMode));
        });
      }
      showContent();
    } catch (error) {
      if (error.status === 401) {
        await auth.refreshSession();
        renderSession();
        state("Session expired", "Sign in again to continue.", signInLink());
        return;
      }
      state(
        "Governance API unavailable",
        error.message || "The private workflow could not be loaded.",
        retryButton(() => loadDashboard(reviewMode))
      );
    }
  }

  function inputForField(definition, value, readOnly) {
    const wrapper = node("div", "hrg-field");
    const id = `historyProposalField-${definition.key.replaceAll(".", "-")}`;
    const label = node("label", "", definition.label);
    label.htmlFor = id;
    let control;
    if (definition.type === "textarea" || definition.type === "array" || definition.type === "perspectives") {
      control = node("textarea");
      if (definition.type === "array") {
        control.value = Array.isArray(value) ? value.join("\n") : "";
      } else if (definition.type === "perspectives") {
        control.value = Array.isArray(value)
          ? value.map((item) => item && item.perspectiveId).filter(Boolean).join("\n")
          : "";
      } else {
        control.value = value == null ? "" : String(value);
      }
    } else if (definition.type === "select") {
      control = node("select");
      append(control, node("option", "", "Select…"));
      definition.options.forEach((optionValue) => {
        const option = node("option", "", human(optionValue));
        option.value = optionValue;
        append(control, option);
      });
      control.value = value == null ? "" : String(value);
    } else {
      control = node("input");
      control.type = definition.type === "checkbox" ? "checkbox" : definition.type;
      if (definition.type === "checkbox") control.checked = Boolean(value);
      else control.value = value == null ? "" : String(value);
    }
    control.id = id;
    control.dataset.fieldKey = definition.key;
    control.dataset.fieldType = definition.type;
    control.required = definition.required;
    control.disabled = readOnly;
    append(wrapper, label, control);
    return wrapper;
  }

  function identityField(labelText, control) {
    const wrapper = node("div", "hrg-field");
    const label = node("label", "", labelText);
    label.htmlFor = control.id;
    append(wrapper, label, control);
    return wrapper;
  }

  function renderEditorIdentity(settings) {
    const container = byId("historyProposalIdentityFields");
    clear(container);
    const title = node("input");
    title.id = "historyProposalTitleInput";
    title.required = true;
    title.value = settings.title || "";
    title.disabled = settings.readOnly;

    const type = node("select");
    type.id = "historyProposalTypeInput";
    TARGET_TYPES.forEach((item) => append(type, targetOption(item)));
    type.value = settings.targetType || "entity";
    type.disabled = settings.readOnly || Boolean(settings.lockType);

    const target = node("input");
    target.id = "historyProposalTargetInput";
    target.required = true;
    target.value = settings.targetId || "";
    target.disabled = settings.readOnly || Boolean(settings.lockTarget);

    const change = node("input");
    change.id = "historyProposalChangeInput";
    change.required = true;
    change.value = settings.changeType || "structured_update";
    change.disabled = settings.readOnly;

    const organization = node("select");
    organization.id = "historyProposalOrganizationInput";
    const allowed = auth.authorizedOrganizations("revision.create");
    if (auth.hasSystemPermission("revision.create")) {
      const option = node("option", "", "System scope");
      option.value = "";
      append(organization, option);
    }
    allowed.forEach((item) => {
      const option = node("option", "", item.organizationName);
      option.value = item.organizationId;
      append(organization, option);
    });
    organization.value = settings.organizationId || allowed[0]?.organizationId || "";
    organization.disabled = settings.readOnly;

    append(
      container,
      identityField("Proposal title", title),
      identityField("Record type", type),
      identityField("Stable target ID", target),
      identityField("Change type", change),
      identityField("Editorial organization", organization)
    );
    type.addEventListener("change", () => {
      renderStructuredFields(type.value, {}, false);
    });
  }

  function renderStructuredFields(targetType, record, readOnly) {
    const container = byId("historyProposalStructuredFields");
    clear(container);
    (TYPE_FIELDS[targetType] || []).forEach((definition) => {
      append(container, inputForField(definition, getPath(record, definition.key), readOnly));
    });
  }

  function readStructuredFields() {
    const patch = {};
    document.querySelectorAll("[data-field-key]").forEach((control) => {
      const key = control.dataset.fieldKey;
      const type = control.dataset.fieldType;
      let value;
      if (type === "checkbox") {
        value = control.checked;
      } else if (type === "array") {
        value = control.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      } else if (type === "perspectives") {
        value = control.value.split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map((perspectiveId) => ({ perspectiveId }));
      } else {
        value = control.value.trim();
        if (!value && !control.required) value = null;
      }
      setPath(patch, key, value);
    });
    return patch;
  }

  function evidencePayload() {
    const input = byId("historyProposalEvidence");
    return input.value.split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((sourceId) => ({
        sourceId,
        role: "supporting",
        note: "Attached through the structured HistoryRoot proposal editor."
      }));
  }

  function renderValidation(validation) {
    const container = byId("historyProposalValidation");
    if (!container) return;
    clear(container);
    const errors = validation && Array.isArray(validation.errors) ? validation.errors : [];
    const warnings = validation && Array.isArray(validation.warnings) ? validation.warnings : [];
    if (!errors.length && !warnings.length) {
      const item = node("div", "hrg-validation-item");
      item.dataset.severity = "clear";
      append(
        item,
        node("strong", "", "No automated errors or warnings"),
        node("span", "", "Human review is still required; this result does not certify historical truth.")
      );
      append(container, item);
      return;
    }
    errors.concat(warnings).forEach((issue) => {
      const item = node("div", "hrg-validation-item");
      item.dataset.severity = issue.severity || (errors.includes(issue) ? "error" : "warning");
      append(
        item,
        node("strong", "", `${issue.code}${issue.field ? ` · ${issue.field}` : ""}`),
        node("span", "", issue.message)
      );
      append(container, item);
    });
  }

  function diffFields(base, proposed) {
    const keys = new Set();
    function visit(left, right, prefix) {
      const values = [left, right].filter((value) => value && typeof value === "object" && !Array.isArray(value));
      if (!values.length) {
        keys.add(prefix);
        return;
      }
      const childKeys = new Set(values.flatMap((value) => Object.keys(value)));
      childKeys.forEach((key) => visit(
        left && typeof left === "object" ? left[key] : undefined,
        right && typeof right === "object" ? right[key] : undefined,
        prefix ? `${prefix}.${key}` : key
      ));
    }
    visit(base || {}, proposed || {}, "");
    return [...keys].filter((key) => key && !equal(getPath(base, key), getPath(proposed, key)));
  }

  function renderDiff(base, proposed) {
    const container = byId("historyProposalDiff");
    if (!container) return;
    clear(container);
    const fields = diffFields(base || {}, proposed || {});
    if (!fields.length) {
      append(container, node("p", "hrg-help", "No changed fields are currently proposed."));
      return;
    }
    fields.forEach((key) => {
      const current = getPath(base, key);
      const next = getPath(proposed, key);
      const row = node("div", "hrg-diff");
      if (HIGH_RISK_FIELDS.has(key)) row.dataset.risk = "high";
      const label = node("div", "hrg-diff-label", FIELD_LABELS[key] || human(key));
      const currentNode = node("div", "hrg-diff-value", displayValue(current));
      currentNode.dataset.side = "current";
      if (current !== undefined && next === undefined) currentNode.dataset.change = "removed";
      const proposedNode = node("div", "hrg-diff-value", displayValue(next));
      proposedNode.dataset.side = "proposed";
      if (current === undefined && next !== undefined) proposedNode.dataset.change = "added";
      if (current !== undefined && (next === null || next === "")) proposedNode.dataset.change = "removed";
      append(row, label, currentNode, proposedNode);
      append(container, row);
    });
  }

  function renderComments(comments) {
    const container = byId("historyProposalComments");
    if (!container) return;
    clear(container);
    if (!comments.length) {
      append(container, node("p", "hrg-help", "No private review notes yet."));
      return;
    }
    comments.forEach((comment) => {
      const card = node("article", "hrg-card");
      append(
        card,
        node("strong", "", `${human(comment.commentType)} · ${comment.authorName}`),
        node("p", "", comment.body),
        node("span", "hrg-help", new Date(comment.createdAt).toLocaleString())
      );
      append(container, card);
    });
  }

  function renderEvents(events) {
    const container = byId("historyProposalEvents");
    if (!container) return;
    clear(container);
    events.slice().reverse().forEach((event) => {
      const item = node("li");
      append(
        item,
        node("strong", "", human(event.eventType)),
        node("span", "", event.actorName || "System"),
        node("time", "", new Date(event.createdAt).toLocaleString())
      );
      if (event.note) append(item, node("span", "", event.note));
      append(container, item);
    });
  }

  function workflowButton(label, action, options) {
    const button = node("button", "hrg-button", label);
    button.type = "button";
    if (options && options.variant) button.dataset.variant = options.variant;
    button.addEventListener("click", () => performWorkflowAction(action, options || {}));
    return button;
  }

  function workflowDecision(action, options, proposalNumber) {
    if (!options.confirm && !options.note) return Promise.resolve({ note: "" });
    const dialog = node("dialog", "hrg-dialog");
    const form = node("form", "hrg-dialog-form");
    form.method = "dialog";
    const title = node("h2", "", `Confirm ${human(action)}`);
    title.id = "historyWorkflowDialogTitle";
    dialog.setAttribute("aria-labelledby", title.id);
    const description = node(
      "p",
      "hrg-help",
      options.note
        ? `Review proposal #${proposalNumber}, add the requested decision context, and confirm the action.`
        : `Review proposal #${proposalNumber} before confirming this action.`
    );
    append(form, title, description);

    let noteInput;
    if (options.note) {
      noteInput = node("textarea");
      noteInput.id = "historyWorkflowDecisionNote";
      noteInput.rows = 5;
      noteInput.required = action === "rollback";
      const label = node(
        "label",
        "",
        action === "rollback" ? "Rollback reason (required)" : "Decision note"
      );
      label.htmlFor = noteInput.id;
      const field = node("div", "hrg-field");
      append(field, label, noteInput);
      append(form, field);
    }

    const actions = node("div", "hrg-actions");
    const cancel = node("button", "hrg-button", "Cancel");
    cancel.type = "submit";
    cancel.value = "cancel";
    cancel.formNoValidate = true;
    cancel.dataset.variant = "secondary";
    const confirm = node("button", "hrg-button", `Confirm ${human(action)}`);
    confirm.type = "submit";
    confirm.value = "confirm";
    if (options.variant) confirm.dataset.variant = options.variant;
    append(actions, cancel, confirm);
    append(form, actions);
    append(dialog, form);
    document.body.append(dialog);

    return new Promise((resolve) => {
      dialog.addEventListener("close", () => {
        const accepted = dialog.returnValue === "confirm";
        const note = noteInput ? noteInput.value.trim() : "";
        dialog.remove();
        resolve(accepted ? { note } : null);
      }, { once: true });
      dialog.showModal();
      if (noteInput) noteInput.focus();
      else confirm.focus();
    });
  }

  function renderWorkflow(detail) {
    const proposal = detail.proposal;
    const container = byId("historyProposalStatus");
    clear(container);
    append(
      container,
      chip(human(proposal.status), statusTone(proposal.status)),
      node("p", "hrg-help", `Proposal #${proposal.proposalNumber} · ${ui.typeLabel(proposal.targetType)} · ${human(proposal.changeType)}`)
    );
    if (proposal.staleBase && proposal.status !== "published") {
      append(container, chip("Stale published base · refresh required", "danger"));
    }
    const links = node("div", "hrg-actions");
    const publicLink = node("a", "hrg-button", "Public record");
    publicLink.dataset.variant = "secondary";
    publicLink.href = publicRecordHref(proposal.targetType, proposal.targetId);
    const revisions = node("a", "hrg-button", "Revision history");
    revisions.dataset.variant = "secondary";
    revisions.href = `history-revisions-v1.html?recordId=${encodeURIComponent(proposal.targetId)}&recordType=${encodeURIComponent(proposal.targetType)}`;
    append(links, publicLink, revisions);
    append(container, links);

    const actions = byId("historyProposalActions");
    clear(actions);
    const sessionUser = auth.session.user && auth.session.user.userId;
    const owner = sessionUser === proposal.createdByUserId;
    const canSubmit = hasOrgPermission(proposal.organizationId, "revision.submit");
    const canReview = hasOrgPermission(proposal.organizationId, "revision.review");
    const canPublish = hasOrgPermission(proposal.organizationId, "revision.publish");
    if (owner && canSubmit && ["draft", "changes_requested"].includes(proposal.status)) {
      append(actions, workflowButton("Submit for review", "submit", { confirm: true }));
    }
    if (owner && canSubmit && ["draft", "submitted", "changes_requested"].includes(proposal.status)) {
      append(actions, workflowButton("Withdraw proposal", "withdraw", { confirm: true, variant: "danger" }));
    }
    if (canReview && proposal.status === "submitted") {
      append(actions, workflowButton("Start review", "start-review"));
    }
    if (canReview && ["submitted", "under_review"].includes(proposal.status)) {
      append(
        actions,
        workflowButton("Request changes", "request-changes", { note: true }),
        workflowButton("Approve", "approve", { confirm: true }),
        workflowButton("Reject", "reject", { note: true, confirm: true, variant: "danger" })
      );
    }
    if (canPublish && proposal.status === "approved") {
      append(actions, workflowButton("Publish approved revision", "publish", { note: true, confirm: true }));
    }
    const activePublication = (detail.publications || []).find((item) => !item.rolledBackAt);
    if (canPublish && proposal.status === "published" && activePublication) {
      append(actions, workflowButton("Roll back publication", "rollback", {
        note: true,
        confirm: true,
        variant: "danger",
        publicationId: activePublication.publicationId
      }));
    }
  }

  async function performWorkflowAction(action, options) {
    const proposal = proposalDetail.proposal;
    const decision = await workflowDecision(action, options, proposal.proposalNumber);
    if (!decision) return;
    const note = decision.note;
    const status = byId("historyProposalFormStatus");
    if (status) status.textContent = "Applying authorized workflow action…";
    try {
      const path = action === "rollback"
        ? `/governance/publications/${encodeURIComponent(options.publicationId)}/rollback`
        : `/governance/proposals/${encodeURIComponent(proposal.proposalId)}/${action}`;
      const body = action === "rollback" ? { reason: note } : { note };
      await auth.request(path, { method: "POST", body });
      await loadProposal(proposal.proposalId);
    } catch (error) {
      if (status) status.textContent = error.message || "The workflow action failed.";
    }
  }

  function setEditorValues(detail, readOnly) {
    const proposal = detail.proposal;
    renderEditorIdentity({
      title: proposal.title,
      targetType: proposal.targetType,
      targetId: proposal.targetId,
      changeType: proposal.changeType,
      organizationId: proposal.organizationId,
      readOnly,
      lockType: true,
      lockTarget: true
    });
    renderStructuredFields(proposal.targetType, detail.proposedRecord || {}, readOnly);
    byId("historyProposalSummary").value = proposal.summary || "";
    byId("historyProposalRationale").value = proposal.editorialRationale || "";
    byId("historyProposalDisclosure").value = proposal.interpretationDisclosure || "";
    byId("historyProposalEvidence").value = (detail.evidence || []).map((item) => item.sourceId).join("\n");
    [
      "historyProposalSummary", "historyProposalRationale",
      "historyProposalDisclosure", "historyProposalEvidence"
    ].forEach((id) => {
      byId(id).disabled = readOnly;
    });
    byId("historyProposalSave").hidden = readOnly;
    byId("historyProposalDiscard").hidden = readOnly;
  }

  async function loadProposal(proposalId) {
    try {
      const detail = await auth.request(`/governance/proposals/${encodeURIComponent(proposalId)}`);
      if (!detail || !detail.proposal || !Array.isArray(detail.events)) {
        throw new Error("The proposal API returned an unexpected response.");
      }
      proposalDetail = detail;
      document.title = `${detail.proposal.title} | HistoryRoot governance`;
      byId("history-proposal-title").textContent = detail.proposal.title;
      byId("historyProposalKicker").textContent = `Proposal #${detail.proposal.proposalNumber} · ${human(detail.proposal.status)}`;
      const readOnly =
        page === "review"
        || auth.session.user.userId !== detail.proposal.createdByUserId
        || !["draft", "changes_requested"].includes(detail.proposal.status);
      if (page !== "review") setEditorValues(detail, readOnly);
      renderWorkflow(detail);
      renderDiff(detail.baseSnapshot || detail.proposal.baseSnapshot, detail.proposedRecord);
      renderValidation(detail.proposal.validation);
      renderComments(detail.comments || []);
      renderEvents(detail.events || []);
      const raw = byId("historyProposalRaw");
      raw.textContent = JSON.stringify({
        baseVersionToken: detail.proposal.baseVersionToken,
        currentVersionToken: detail.currentVersionToken,
        proposedPatch: detail.proposal.proposedPatch,
        validation: detail.proposal.validation
      }, null, 2);
      showContent();
    } catch (error) {
      if (error.status === 401) {
        state("Session expired", "Sign in again to view this proposal.", signInLink());
      } else if (error.status === 404) {
        state("Proposal not found or inaccessible", "The identifier is invalid, the proposal is outside your organization scope, or it no longer exists.");
      } else {
        state("Proposal unavailable", error.message || "The proposal could not be loaded.", retryButton(() => loadProposal(proposalId)));
      }
    }
  }

  async function loadCurrentTarget(targetType, targetId) {
    if (!targetId) return {};
    try {
      return await auth.request(
        targetType === "source"
          ? `/sources/${encodeURIComponent(targetId)}`
          : `/context/records/${encodeURIComponent(targetId)}`
      );
    } catch (error) {
      if (error.status === 404) return {};
      throw error;
    }
  }

  async function prepareNewProposal(params) {
    if (!auth.hasPermission("revision.create")) {
      state("Contributor permission required", "Your current roles do not include revision.create.");
      return;
    }
    const targetType = params.get("recordType") || "entity";
    const targetId = params.get("recordId") || "";
    const record = await loadCurrentTarget(targetType, targetId);
    renderEditorIdentity({
      title: targetId ? `Propose a change to ${record.label || record.name || targetId}` : "",
      targetType,
      targetId,
      changeType: params.get("changeType") || (targetId ? "structured_update" : `new_${targetType}`),
      organizationId: params.get("organizationId") || "",
      readOnly: false,
      lockType: false,
      lockTarget: false
    });
    renderStructuredFields(targetType, record, false);
    byId("historyProposalSummary").value = "";
    byId("historyProposalRationale").value = "";
    byId("historyProposalDisclosure").value = "";
    byId("historyProposalEvidence").value = "";
    renderDiff(record, record);
    renderValidation({ errors: [], warnings: [] });
    clear(byId("historyProposalStatus"));
    append(byId("historyProposalStatus"), chip("Unsaved draft"));
    clear(byId("historyProposalActions"));
    clear(byId("historyProposalComments"));
    append(byId("historyProposalComments"), node("p", "hrg-help", "Save the draft before adding review notes."));
    clear(byId("historyProposalEvents"));
    byId("historyProposalCommentForm").hidden = true;
    byId("historyProposalRaw").textContent = "The server will capture the canonical base snapshot when this draft is saved.";
    showContent();
  }

  async function saveProposal(event) {
    event.preventDefault();
    const status = byId("historyProposalFormStatus");
    status.textContent = "Validating and saving draft…";
    const targetType = byId("historyProposalTypeInput").value;
    const targetId = byId("historyProposalTargetInput").value.trim();
    const body = {
      title: byId("historyProposalTitleInput").value.trim(),
      summary: byId("historyProposalSummary").value.trim(),
      proposedPatch: readStructuredFields(),
      editorialRationale: byId("historyProposalRationale").value.trim(),
      interpretationDisclosure: byId("historyProposalDisclosure").value.trim(),
      evidence: evidencePayload()
    };
    try {
      let detail;
      if (proposalDetail) {
        detail = await auth.request(
          `/governance/proposals/${encodeURIComponent(proposalDetail.proposal.proposalId)}`,
          { method: "PATCH", body }
        );
      } else {
        detail = await auth.request("/governance/proposals", {
          method: "POST",
          body: Object.assign(body, {
            organizationId: byId("historyProposalOrganizationInput").value || null,
            targetType,
            targetId,
            rootKey: "historyroot",
            bundleId: manifest.bundleId,
            changeType: byId("historyProposalChangeInput").value.trim()
          })
        });
      }
      status.textContent = detail.proposal.validation.valid
        ? "Draft saved. Automated validation is clear."
        : "Draft saved with validation errors that must be resolved before submission.";
      global.location.assign(`history-proposal-v1.html?proposalId=${encodeURIComponent(detail.proposal.proposalId)}`);
    } catch (error) {
      status.textContent = error.message || "The proposal could not be saved.";
    }
  }

  async function addComment(event) {
    event.preventDefault();
    if (!proposalDetail) return;
    const body = byId("historyProposalComment").value.trim();
    if (!body) return;
    try {
      await auth.request(
        `/governance/proposals/${encodeURIComponent(proposalDetail.proposal.proposalId)}/comments`,
        {
          method: "POST",
          body: {
            body,
            type: byId("historyProposalCommentType").value
          }
        }
      );
      byId("historyProposalComment").value = "";
      await loadProposal(proposalDetail.proposal.proposalId);
    } catch (error) {
      byId("historyProposalFormStatus").textContent = error.message || "The note could not be added.";
    }
  }

  async function loadProposalPage() {
    if (!requireSession()) return;
    const params = new URLSearchParams(global.location.search);
    const proposalId = params.get("proposalId");
    if (!proposalId && page === "proposal" && !auth.hasPermission("revision.create")) {
      state(
        "Contributor permission required",
        "Your current SourceRoot roles do not include revision.create in an active organization."
      );
      return;
    }
    const form = byId("historyProposalForm");
    if (form) form.addEventListener("submit", saveProposal);
    const commentForm = byId("historyProposalCommentForm");
    if (commentForm) commentForm.addEventListener("submit", addComment);
    const discard = byId("historyProposalDiscard");
    if (discard) {
      discard.addEventListener("click", () => {
        if (proposalDetail) performWorkflowAction("withdraw", { confirm: true });
      });
    }
    if (proposalId) {
      await loadProposal(proposalId);
    } else if (page === "review") {
      state("Proposal ID required", "Open a proposal from the authorized review queue.");
    } else {
      try {
        await prepareNewProposal(params);
      } catch (error) {
        state("Record unavailable", error.message || "The selected public target could not be loaded.");
      }
    }
  }

  function revisionCard(revision) {
    const card = node("article", "hrg-card");
    const head = node("div", "hrg-card-head");
    append(
      head,
      node("h3", "", revision.summary || human(revision.revisionType)),
      chip(human(revision.revisionType), revision.revisionType === "governed-rollback" ? "warning" : "success")
    );
    const meta = node("div", "hrg-meta-row");
    append(
      meta,
      node("span", "", revision.revisionId),
      node("span", "", new Date(revision.createdAt).toLocaleString())
    );
    const raw = revision.rawData || {};
    const changed = diffFields(raw.before || {}, raw.after || {});
    append(
      card,
      head,
      meta,
      node("p", "", changed.length
        ? `${changed.length} published field change${changed.length === 1 ? "" : "s"}: ${changed.map((key) => FIELD_LABELS[key] || human(key)).join(", ")}.`
        : "Published revision metadata is available.")
    );
    return card;
  }

  async function loadRevisions() {
    const params = new URLSearchParams(global.location.search);
    const recordId = params.get("recordId");
    const recordType = params.get("recordType");
    if (!recordId || !recordType || !TARGET_TYPES.includes(recordType)) {
      state("Record and type required", "Open revision history from a HistoryRoot record or proposal.");
      return;
    }
    byId("historyRevisionTarget").textContent = `${ui.typeLabel(recordType)} · ${recordId}`;
    byId("historyRevisionRecordLink").href = publicRecordHref(recordType, recordId);
    const governanceLink = byId("historyRevisionGovernanceLink");
    if (auth.session && auth.session.authenticated && hasGovernancePermission()) {
      governanceLink.hidden = false;
    }
    try {
      const query = new URLSearchParams({
        bundleId: manifest.bundleId,
        objectType: recordType,
        objectId: recordId,
        status: "published",
        page: "1",
        limit: "100"
      });
      const result = await auth.request(`/revisions?${query.toString()}`);
      if (!result || !Array.isArray(result.items)) throw new Error("The revision API returned an unexpected response.");
      const list = byId("historyRevisionList");
      clear(list);
      if (!result.items.length) {
        append(list, node("p", "hrg-help", "No governed published revisions exist for this record yet."));
      } else {
        result.items.forEach((revision) => append(list, revisionCard(revision)));
      }
      showContent();
    } catch (error) {
      state("Revision history unavailable", error.message || "Published revisions could not be loaded.", retryButton(loadRevisions));
    }
  }

  async function start() {
    try {
      const initialized = await ui.initialize();
      manifest = initialized.manifest;
      await auth.initialize();
      renderSession();
      if (page === "dashboard") await loadDashboard(false);
      else if (page === "queue") await loadDashboard(true);
      else if (page === "proposal" || page === "review") await loadProposalPage();
      else if (page === "revisions") await loadRevisions();
    } catch (error) {
      state(
        "HistoryRoot governance could not start",
        error.message || "The application returned an unexpected response.",
        retryButton(() => global.location.reload())
      );
    }
  }

  start();
})(window);
