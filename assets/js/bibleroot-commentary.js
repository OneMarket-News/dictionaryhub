(function bibleRootCommentaryPage(global) {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const clear = (element) => { while (element.firstChild) element.removeChild(element.firstChild); };
  const state = { metadata: null, request: 0 };
  function text(tag, value, className) { const element = document.createElement(tag); element.textContent = value; if (className) element.className = className; return element; }
  function setStatus(kind, title, detail, retry) {
    const panel = byId("bibleRootCommentaryStatus"); clear(panel); panel.dataset.state = kind; panel.hidden = false;
    const body = document.createElement("div"); body.append(text("strong", title), text("p", detail)); panel.append(body);
    if (retry) { const button = text("button", "Retry"); button.type = "button"; button.addEventListener("click", retry); panel.append(button); }
  }
  function selectedWorks() { return [...byId("bibleRootCommentaryWorks").querySelectorAll("input:checked")].map((input) => input.value); }
  function renderWorkOptions(payload) {
    const container = byId("bibleRootCommentaryWorks"); clear(container);
    payload.items.forEach((work, index) => {
      const label = document.createElement("label"); const input = document.createElement("input");
      input.type = "checkbox"; input.name = "work"; input.value = work.workId; input.checked = index < 2;
      input.addEventListener("change", () => { if (selectedWorks().length > 3) input.checked = false; if (selectedWorks().length === 0) input.checked = true; });
      const copy = document.createElement("span"); copy.append(text("strong", work.title), document.createTextNode(` - ${work.attribution}`));
      label.append(input, copy); container.append(label);
    });
  }
  function externalLink(label, href) { const link = text("a", label); link.href = href; link.target = "_blank"; link.rel = "external noopener noreferrer"; return link; }
  function provenance(work, section) {
    const dialog = byId("bibleRootCommentaryProvenance"); const body = byId("bibleRootCommentaryProvenanceBody"); clear(body);
    const title = text("h2", `${work.title} source trail`); title.id = "bibleRootCommentaryProvenanceTitle";
    const status = text("p", "Source identity recorded - checksum matched - rights metadata recorded - canonical anchor validated - statement offsets validated");
    const dl = document.createElement("dl");
    const entries = [
      ["Named work", `${work.title} (${work.workId})`], ["Author / editors", work.attribution], ["Historical date identity", work.workDateIdentity],
      ["Exact edition", work.editionIdentity], ["Publication", `${work.publication.title} (${work.publication.publicationId})`], ["Provider", work.publication.provider],
      ["Upstream raw artifact", work.artifact.filename], ["Retrieval timestamp", work.artifact.retrievedAt], ["Byte length", String(work.artifact.byteLength)],
      ["Artifact SHA-256", work.artifact.sha256], ["Dataset", `${work.datasetId} v${work.datasetVersion}`], ["Rights status", work.rights.status],
      ["Rights statement", work.rights.statement], ["Territorial limitation", work.rights.territorialLimitation]
    ];
    if (section) entries.push(
      ["Database section", section.sectionId], ["Canonical anchor", `${section.anchor.anchorType}: ${section.anchor.normalizedStartReference} through ${section.anchor.normalizedEndReference}`],
      ["Mapping status", section.anchor.mappingStatus], ["Mapping note", section.anchor.mappingNote], ["Source locator", section.sourceLocator],
      ["Normalized section SHA-256", section.sourceTextHash], ["Source markup SHA-256", section.sourceMarkupHash], ["Segmented source statements", String(section.statements.length)]
    );
    entries.forEach(([label, value]) => dl.append(text("dt", label), text("dd", value || "Not recorded")));
    const links = document.createElement("p"); links.append(externalLink("Open source provider record", work.source.detailsUrl), document.createTextNode(" - "), externalLink("Open upstream artifact", work.artifact.sourceUrl));
    body.append(title, status, links, dl); if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  }
  function statementIndex(section) {
    const details = document.createElement("details"); details.className = "br-statement-index";
    details.append(text("summary", `${section.statements.length} exact source statements - offsets and hashes`));
    details.addEventListener("toggle", () => {
      if (!details.open || details.dataset.rendered === "true") return; details.dataset.rendered = "true";
      const list = document.createElement("ol"); list.className = "br-statement-list";
      section.statements.forEach((statement) => {
        const item = document.createElement("li"); item.id = statement.statementId;
        item.append(text("p", statement.exactText), text("span", `${statement.statementId} - offsets ${statement.startOffset}-${statement.endOffset} - SHA-256 ${statement.contentHash}`, "br-statement-meta")); list.append(item);
      }); details.append(list);
    }); return details;
  }
  function renderWork(work) {
    const article = document.createElement("article"); article.className = "br-commentary-work"; article.dataset.workId = work.workId;
    const header = document.createElement("header"); header.append(text("p", "Attributed historical source", "br-kicker"), text("h3", work.title), text("p", work.attribution, "br-commentary-attribution"));
    const actions = document.createElement("div"); actions.className = "br-commentary-source-actions"; const sourceButton = text("button", "Work source & rights"); sourceButton.type = "button"; sourceButton.addEventListener("click", () => provenance(work));
    actions.append(sourceButton, text("span", `${work.editionIdentity} - ${work.rights.status}`)); header.append(actions); article.append(header);
    if (work.coverageGaps.length) {
      const gaps = document.createElement("section"); gaps.className = "br-coverage-gaps"; gaps.append(text("h4", "Recorded coverage gaps")); const list = document.createElement("ul");
      work.coverageGaps.forEach((gap) => list.append(text("li", `${gap.normalizedStartReference}${gap.normalizedEndReference === gap.normalizedStartReference ? "" : ` through ${gap.normalizedEndReference}`} - ${gap.note}`))); gaps.append(list); article.append(gaps);
    }
    work.sections.forEach((section) => {
      const item = document.createElement("section"); item.className = "br-commentary-section"; item.id = section.sectionId;
      item.append(text("h4", section.heading || `${section.anchor.normalizedStartReference} commentary`), text("p", `${section.anchor.anchorType} - ${section.anchor.normalizedStartReference}${section.anchor.normalizedEndReference === section.anchor.normalizedStartReference ? "" : ` through ${section.anchor.normalizedEndReference}`}`, "br-commentary-anchor"));
      const button = text("button", "Section provenance & rights"); button.type = "button"; button.className = "br-source-button"; button.addEventListener("click", () => provenance(work, section));
      item.append(button, text("p", section.exactText, "br-commentary-text"), statementIndex(section)); article.append(item);
    }); return article;
  }
  function render(payload) {
    byId("bibleRootCommentaryResultsTitle").textContent = payload.normalizedReference; byId("bibleRootCommentaryDataset").textContent = `${payload.datasetId} - v${payload.datasetVersion}`;
    byId("bibleRootCommentaryDisclaimer").textContent = payload.disclaimer; byId("bibleRootCommentaryPlacement").textContent = payload.sharedPlacementNotice;
    byId("bibleRootCommentaryPassageLink").href = payload.links.passage; byId("bibleRootCommentaryComparisonLink").href = payload.links.translationComparison; byId("bibleRootCommentaryOriginalLink").href = payload.links.originalLanguage;
    const results = byId("bibleRootCommentaryResults"); clear(results); const columns = document.createElement("div"); columns.className = "br-commentary-columns"; columns.style.setProperty("--work-count", String(payload.works.length));
    payload.works.forEach((work) => columns.append(renderWork(work))); results.append(columns); results.setAttribute("aria-busy", "false"); byId("bibleRootCommentaryStatus").hidden = true;
  }
  function errorState(error) {
    if (error && error.status === 503) return ["awaiting-data", "Commentary data is awaiting provisioning", "Prior BibleRoot text layers may remain ready. Run the governed local provisioner, then retry."];
    if (error && error.status >= 400 && error.status < 500) return ["invalid", "This commentary request is unsupported", error.message || "Choose one of the four accepted passages and available works."];
    return ["unavailable", "BibleRoot API unavailable", "No sample or fallback commentary is shown. Start the SourceRoot API and retry."];
  }
  async function load() {
    const request = ++state.request; const reference = byId("bibleRootCommentaryReference").value; const works = selectedWorks();
    setStatus("loading", "Loading attributed commentary", "Contacting the SourceRoot BibleRoot API.", null); byId("bibleRootCommentaryResults").setAttribute("aria-busy", "true");
    try {
      const payload = await global.BibleRootApi.commentary(reference, works); if (request !== state.request) return;
      const url = new URL(global.location.href); url.searchParams.set("reference", reference); url.searchParams.set("works", payload.selectedWorkIds.join(",")); global.history.replaceState({ reference, works: payload.selectedWorkIds }, "", url); render(payload);
    } catch (error) { if (request !== state.request) return; clear(byId("bibleRootCommentaryResults")); const failure = errorState(error); setStatus(failure[0], failure[1], failure[2], load); }
  }
  async function initialize() {
    setStatus("loading", "Loading commentary sources", "Requesting the accepted work records and readiness state.", null);
    try {
      state.metadata = await global.BibleRootApi.commentaries();
      if (!state.metadata.ready) { clear(byId("bibleRootCommentaryWorks")); setStatus("awaiting-data", "Commentary data is awaiting provisioning", "No source text is embedded in this page. Provision the commentary dataset, then retry.", initialize); return; }
      renderWorkOptions(state.metadata); const url = new URL(global.location.href); const reference = url.searchParams.get("reference");
      if (["Genesis 1", "Psalm 23", "Ecclesiastes 3", "John 1"].includes(reference)) byId("bibleRootCommentaryReference").value = reference;
      const requested = (url.searchParams.get("works") || "").split(",").filter(Boolean); if (requested.length) byId("bibleRootCommentaryWorks").querySelectorAll("input").forEach((input) => { input.checked = requested.includes(input.value); });
      if (selectedWorks().length === 0) byId("bibleRootCommentaryWorks").querySelectorAll("input").forEach((input, index) => { input.checked = index < 2; }); load();
    } catch (error) { const failure = errorState(error); setStatus(failure[0], failure[1], failure[2], initialize); }
  }
  document.addEventListener("DOMContentLoaded", () => { byId("bibleRootCommentaryForm").addEventListener("submit", (event) => { event.preventDefault(); load(); }); initialize(); }, { once: true });
})(window);
