(function crossRootLinksPage(global) {
  "use strict";

  const form = document.querySelector("#crossRootLookupForm");
  const root = document.querySelector("#crossRootRoot");
  const type = document.querySelector("#crossRootResourceType");
  const resourceId = document.querySelector("#crossRootResourceId");
  const status = document.querySelector("#crossRootStatus");
  const results = document.querySelector("#crossRootResults");
  const selected = document.querySelector("#crossRootSelected");
  const groups = document.querySelector("#crossRootGroups");

  const types = { DictionaryRoot:"lemma", HistoryRoot:"accepted-contextual-record", BibleRoot:"edition-verse-text" };
  const escape = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const label = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  function showState(kind, title, message, retry) {
    status.dataset.state = kind;
    status.innerHTML = `<strong>${escape(title)}</strong><p>${escape(message)}</p>${retry ? '<button id="crossRootRetry" type="button">Retry</button>' : ""}`;
    const button = document.querySelector("#crossRootRetry");
    if (button) button.addEventListener("click", load);
  }

  function evidence(item) {
    return `<details class="cr-evidence">
      <summary>Evidence ${escape(item.evidenceOrder)} · <span class="cr-surface">${escape(item.surfaceText)}</span></summary>
      <p class="cr-excerpt">${escape(item.contextExcerpt)}</p>
      <dl class="cr-evidence-grid">
        <div><dt>Evidence ID</dt><dd><code>${escape(item.evidenceId)}</code></dd></div>
        <div><dt>Target field</dt><dd>${escape(item.targetField)}</dd></div>
        <div><dt>UTF-16 offsets</dt><dd>${escape(item.startOffset)}–${escape(item.endOffset)}</dd></div>
        <div><dt>Normalized match</dt><dd>${escape(item.normalizedMatchText)}</dd></div>
        <div><dt>Target content SHA-256</dt><dd><code>${escape(item.targetContentHash)}</code></dd></div>
        <div><dt>Target field SHA-256</dt><dd><code>${escape(item.targetFieldContentHash)}</code></dd></div>
        <div><dt>Evidence dataset</dt><dd>${escape(item.sourceDatasetId)} · ${escape(item.sourceDatasetVersion)}</dd></div>
      </dl>
    </details>`;
  }

  function linkCard(item, selectedId) {
    const other = item.sourceResource.canonicalPublicId === selectedId ? item.targetResource : item.sourceResource;
    return `<article class="cr-link">
      <header class="cr-link-header"><div><h4>${escape(other.displayLabel)}</h4><p>${escape(other.rootId)} · ${escape(other.resourceType)}</p></div><a href="${escape(other.canonicalLocalUrl)}">Open canonical record</a></header>
      <div class="cr-chip-row"><span class="cr-chip">Textually observed</span><span class="cr-chip">Unreviewed</span><span class="cr-chip">Directional</span></div>
      <p><strong>Link ID:</strong> <code>${escape(item.linkId)}</code></p>
      <p><strong>Algorithm:</strong> <code>${escape(item.algorithmVersion)}</code></p>
      <p><strong>Source dataset:</strong> ${escape(item.sourceResource.sourceDatasetId)} · ${escape(item.sourceResource.sourceDatasetVersion)}</p>
      <p><strong>Target dataset:</strong> ${escape(item.targetResource.sourceDatasetId)} · ${escape(item.targetResource.sourceDatasetVersion)}</p>
      ${(item.evidence || []).map(evidence).join("")}
    </article>`;
  }

  function render(payload) {
    const item = payload.selectedResource;
    selected.innerHTML = `<article class="cr-selected"><div><p class="cr-kicker">Selected resource</p><h3>${escape(item.displayLabel)}</h3><p>${escape(item.rootId)} · ${escape(item.resourceType)} · <code>${escape(item.canonicalPublicId)}</code></p></div><a href="${escape(item.canonicalLocalUrl)}">Open canonical record</a></article>`;
    if (!payload.links.length) {
      groups.innerHTML = '<section class="cr-group"><h3>No observed links</h3><p>This registered resource has no exact lexical links in the bounded 14A corpus. No fallback links were substituted.</p></section>';
      showState("empty", "No links", "The resource is registered, but no exact occurrences were observed.", false);
    } else {
      const byRoot = new Map();
      payload.links.forEach((link) => {
        const other = link.sourceResource.canonicalPublicId === item.canonicalPublicId ? link.targetResource : link.sourceResource;
        byRoot.set(other.rootId, [...(byRoot.get(other.rootId) || []), link]);
      });
      groups.innerHTML = [...byRoot.entries()].map(([rootName, links]) => `<section class="cr-group"><h3>${escape(rootName)}</h3><p>${links.length} exact lexical link${links.length === 1 ? "" : "s"} on this page.</p>${links.map((link) => linkCard(link, item.canonicalPublicId)).join("")}</section>`).join("");
      showState("ready", "Evidence ready", `${payload.links.length} deterministic link${payload.links.length === 1 ? "" : "s"} loaded.`, false);
    }
    results.hidden = false;
  }

  async function load() {
    if (!resourceId.value.trim()) return;
    results.hidden = true;
    showState("loading", "Loading exact evidence", "Contacting the live SourceRoot Cross-Root API.", false);
    try {
      const coverage = await global.CrossRootApi.coverage();
      if (!coverage.ready) {
        showState("awaiting", "Awaiting governed data", coverage.message || "Cross-Root evidence has not been provisioned.", false);
        return;
      }
      const payload = await global.CrossRootApi.links({ root:root.value, resourceType:type.value, resourceId:resourceId.value.trim(), limit:100 });
      render(payload);
    } catch (error) {
      const message = error && error.message ? error.message : "The Cross-Root API could not be reached.";
      const invalid = /not found|RESOURCE_NOT_FOUND|unsupported/i.test(message);
      showState(invalid ? "invalid" : "error", invalid ? "Invalid or unregistered resource" : "Cross-Root API unavailable", invalid ? "No registered 14A resource matches this identity. No fallback links were shown." : "Live evidence is unavailable. No fallback links were shown.", !invalid);
    }
  }

  root.addEventListener("change", () => { type.value = types[root.value]; });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = new URLSearchParams({ root:root.value, resourceType:type.value, resourceId:resourceId.value.trim() });
    global.history.pushState(null, "", `?${query}`);
    load();
  });
  global.addEventListener("popstate", () => { hydrate(); load(); });
  function hydrate() {
    const query = new URLSearchParams(global.location.search);
    const queryRoot = query.get("root");
    if (queryRoot && types[queryRoot]) root.value = queryRoot;
    type.value = query.get("resourceType") || types[root.value];
    resourceId.value = query.get("resourceId") || "";
  }
  hydrate();
  if (resourceId.value) load(); else showState("idle", "Choose a resource", "Use a canonical experience link or enter a stable registered public ID.", false);
})(window);
