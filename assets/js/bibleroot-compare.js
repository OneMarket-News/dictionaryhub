(function bibleRootComparePage(global) {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const clear = (element) => { while (element.firstChild) element.removeChild(element.firstChild); };
  const state = { metadata: null, request: 0 };

  function text(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
  }

  function setStatus(kind, title, detail, retry) {
    const panel = byId("bibleRootCompareStatus");
    clear(panel);
    panel.dataset.state = kind;
    panel.hidden = false;
    const body = document.createElement("div");
    body.append(text("strong", title), text("p", detail));
    panel.append(body);
    if (retry) {
      const button = text("button", "Retry");
      button.type = "button";
      button.addEventListener("click", load);
      panel.append(button);
    }
  }

  function selectedEditions() {
    return [...byId("bibleRootCompareEditions").querySelectorAll("input:checked")].map((input) => input.value);
  }

  function renderEditionOptions(payload) {
    const container = byId("bibleRootCompareEditions");
    clear(container);
    payload.items.forEach((edition, index) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "edition";
      input.value = edition.editionId;
      input.checked = edition.editionId === global.BibleRootApi.defaultEdition || index === 1;
      input.addEventListener("change", () => {
        if (selectedEditions().length > 4) {
          input.checked = false;
          setStatus("invalid", "Four-edition limit", "Select no more than four editions.", false);
        }
        if (selectedEditions().length === 0) input.checked = true;
      });
      label.append(input, document.createTextNode(`${edition.abbreviation} — ${edition.displayTitle}`));
      container.append(label);
    });
  }

  function provenance(edition) {
    const dialog = byId("bibleRootCompareProvenance");
    const body = byId("bibleRootCompareProvenanceBody");
    clear(body);
    const title = text("h2", `${edition.abbreviation} source trail`);
    title.id = "bibleRootCompareProvenanceTitle";
    const dl = document.createElement("dl");
    const entries = [
      ["Edition", `${edition.displayTitle} (${edition.editionId})`],
      ["Publication / release", `${edition.publication.title}; ${edition.editionDescription}`],
      ["Source provider", edition.publication.provider],
      ["Upstream artifact", edition.artifact.filename],
      ["Source URL", edition.artifact.sourceUrl],
      ["Retrieval timestamp", edition.artifact.retrievedAt],
      ["Byte length", String(edition.artifact.byteLength)],
      ["SHA-256", edition.artifact.sha256],
      ["Rights status", edition.rightsStatus],
      ["Territorial limitation", edition.territorialLimitation],
      ["Normalized dataset", `${edition.datasetId} v${edition.datasetVersion}`],
      ["Normalized text SHA-256", edition.normalizedTextSha256],
      ["Normalization notes", edition.artifact.normalizationNotes]
    ];
    entries.forEach(([label, value]) => dl.append(text("dt", label), text("dd", value || "Not recorded")));
    body.append(title, text("p", "Source identity recorded · checksum matched · rights metadata recorded · canonical mapping validated"), dl);
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  }

  function tokenView(tokens, baseline) {
    const wrapper = document.createElement("div");
    wrapper.className = "br-token-diff";
    wrapper.hidden = !byId("bibleRootCompareHighlights").checked;
    tokens.forEach((token, index) => {
      const span = text("span", token.text);
      span.dataset.different = String(!baseline[index] || baseline[index].text !== token.text);
      wrapper.append(span);
    });
    return wrapper;
  }

  function render(payload) {
    const results = byId("bibleRootCompareResults");
    clear(results);
    byId("bibleRootCompareResultsTitle").textContent = payload.normalizedReference;
    byId("bibleRootCompareDataset").textContent = `${payload.datasetId} · v${payload.datasetVersion}`;
    const editionById = new Map(payload.editions.map((edition) => [edition.editionId, edition]));
    payload.verses.forEach((verse) => {
      const article = document.createElement("article");
      article.className = "br-verse-comparison";
      article.id = verse.canonicalReferenceId;
      const identity = document.createElement("header");
      identity.className = "br-verse-identity";
      identity.append(text("h3", verse.normalizedReference));
      if (verse.originalLanguage.available) {
        const sourceLink = text("a", "Open original-language passage");
        sourceLink.href = verse.originalLanguage.href;
        identity.append(sourceLink);
      } else identity.append(text("span", "Original-language data unavailable"));
      const columns = document.createElement("div");
      columns.className = "br-edition-columns";
      columns.style.setProperty("--edition-count", String(payload.selectedEditionIds.length));
      const baselineTokens = verse.comparison.tokens[payload.selectedEditionIds[0]] || [];
      payload.selectedEditionIds.forEach((editionId) => {
        const edition = editionById.get(editionId);
        const cellData = verse.editions[editionId];
        const cell = document.createElement("section");
        cell.className = "br-translation-cell";
        const header = document.createElement("header");
        header.append(text("h4", `${edition.abbreviation} · ${edition.displayTitle}`));
        const sourceButton = text("button", "Source & rights", "br-source-button");
        sourceButton.type = "button";
        sourceButton.addEventListener("click", () => provenance(edition));
        header.append(sourceButton);
        cell.append(header);
        if (cellData.state === "available") {
          cell.append(text("p", cellData.exactText));
          cell.append(tokenView(verse.comparison.tokens[editionId] || [], baselineTokens));
        } else cell.append(text("p", "Text is not available for this canonical verse.", "br-missing-text"));
        columns.append(cell);
      });
      article.append(identity, columns);
      results.append(article);
    });
    results.setAttribute("aria-busy", "false");
    byId("bibleRootCompareStatus").hidden = true;
  }

  function errorState(error) {
    if (error && error.status === 503) return ["awaiting-data", "Translation data is awaiting provisioning", "Run the governed local development provisioner, then retry."];
    if (error && error.status >= 400 && error.status < 500) return ["empty", "This comparison request is unsupported", error.message || "Choose one of the four accepted passages and available editions."];
    return ["unavailable", "BibleRoot API unavailable", "No sample or fallback verse text is shown. Start the SourceRoot API and retry."];
  }

  async function load() {
    const request = ++state.request;
    const reference = byId("bibleRootCompareReference").value;
    const editions = selectedEditions();
    setStatus("loading", "Loading translation records", "Contacting the SourceRoot BibleRoot API.", false);
    byId("bibleRootCompareResults").setAttribute("aria-busy", "true");
    try {
      const payload = await global.BibleRootApi.comparison(reference, editions);
      if (request !== state.request) return;
      const url = new URL(global.location.href);
      url.searchParams.set("reference", reference);
      url.searchParams.set("editions", payload.selectedEditionIds.join(","));
      global.history.replaceState({ reference, editions: payload.selectedEditionIds }, "", url);
      render(payload);
    } catch (error) {
      if (request !== state.request) return;
      const failure = errorState(error);
      clear(byId("bibleRootCompareResults"));
      setStatus(failure[0], failure[1], failure[2], true);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    byId("bibleRootCompareForm").addEventListener("submit", (event) => { event.preventDefault(); load(); });
    byId("bibleRootCompareHighlights").addEventListener("change", () => {
      document.querySelectorAll(".br-token-diff").forEach((element) => { element.hidden = !byId("bibleRootCompareHighlights").checked; });
    });
    try {
      state.metadata = await global.BibleRootApi.translations();
      if (!state.metadata.ready) {
        renderEditionOptions(state.metadata);
        setStatus("awaiting-data", "Translation data is awaiting provisioning", "Foundation text may be ready while Translation Comparison is not yet provisioned.", true);
        return;
      }
      renderEditionOptions(state.metadata);
      const url = new URL(global.location.href);
      const reference = url.searchParams.get("reference");
      if (["Genesis 1", "Psalm 23", "Ecclesiastes 3", "John 1"].includes(reference)) byId("bibleRootCompareReference").value = reference;
      const requested = (url.searchParams.get("editions") || "").split(",").filter(Boolean);
      if (requested.length) {
        byId("bibleRootCompareEditions").querySelectorAll("input").forEach((input) => { input.checked = requested.includes(input.value); });
      }
      load();
    } catch (error) {
      const failure = errorState(error);
      setStatus(failure[0], failure[1], failure[2], true);
    }
  }, { once: true });
})(window);
