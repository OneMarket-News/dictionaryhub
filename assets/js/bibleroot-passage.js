(function bibleRootPassage(global) {
  "use strict";

  let requestSequence = 0;

  function byId(id) {
    return document.getElementById(id);
  }

  function clear(node) {
    node.replaceChildren();
  }

  function append(parent, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function referenceFromUrl() {
    return new URL(global.location.href).searchParams.get("reference")
      || "Genesis 1";
  }

  function editionFromUrl() {
    return new URL(global.location.href).searchParams.get("edition")
      || global.BibleRootApi.defaultEdition;
  }

  function setStatus(state, title, message, retry) {
    const panel = byId("bibleRootPassageStatus");
    clear(panel);
    panel.dataset.state = state;
    panel.hidden = false;
    const icon = append(panel, "span", "br-state-icon", state === "loading" ? "···" : "!");
    icon.setAttribute("aria-hidden", "true");
    const copy = append(panel, "div", "", undefined);
    append(copy, "strong", "", title);
    append(copy, "p", "", message);
    if (retry) {
      const button = append(copy, "button", "br-retry-button", "Retry");
      button.type = "button";
      button.addEventListener("click", () => load(referenceFromUrl(), false));
    }
  }

  function selectedOccurrences(occurrences) {
    const candidates = (occurrences || []).slice().sort((left, right) =>
      left.startOffset - right.startOffset
      || (right.endOffset - right.startOffset) - (left.endOffset - left.startOffset)
      || left.phraseId.localeCompare(right.phraseId)
    );
    const selected = [];
    let cursor = -1;
    candidates.forEach((candidate) => {
      if (candidate.startOffset >= cursor) {
        selected.push(candidate);
        cursor = candidate.endOffset;
      }
    });
    return selected;
  }

  function renderVerseText(parent, verse) {
    const occurrences = selectedOccurrences(verse.phraseOccurrences);
    let cursor = 0;
    occurrences.forEach((occurrence) => {
      if (occurrence.startOffset > cursor) {
        parent.appendChild(document.createTextNode(
          verse.exactText.slice(cursor, occurrence.startOffset)
        ));
      }
      const mark = append(
        parent,
        "mark",
        "br-phrase-anchor",
        verse.exactText.slice(occurrence.startOffset, occurrence.endOffset)
      );
      mark.dataset.phraseId = occurrence.phraseId;
      mark.title = "Verified textual phrase anchor; no interpretation asserted.";
      cursor = occurrence.endOffset;
    });
    if (cursor < verse.exactText.length) {
      parent.appendChild(document.createTextNode(verse.exactText.slice(cursor)));
    }
  }

  function renderVerses(payload) {
    const container = byId("bibleRootPassageVerses");
    clear(container);
    payload.verses.forEach((verse) => {
      const article = append(container, "article", "br-verse", undefined);
      article.id = verse.canonicalReferenceId;
      article.dataset.canonicalReferenceId = verse.canonicalReferenceId;
      article.dataset.editionTextId = verse.editionTextId;
      const number = append(article, "a", "br-verse-number", String(verse.verseNumber));
      number.href = `#${encodeURIComponent(verse.canonicalReferenceId)}`;
      number.setAttribute("aria-label", verse.citation);
      const text = append(article, "p", "br-verse-text", undefined);
      renderVerseText(text, verse);
      const details = append(article, "details", "br-verse-citation", undefined);
      append(details, "summary", "", "Citation & identity");
      append(details, "p", "", verse.citation);
      const canonical = append(details, "code", "", verse.canonicalReferenceId);
      canonical.setAttribute("aria-label", "Canonical reference ID");
      append(details, "code", "", verse.editionTextId)
        .setAttribute("aria-label", "Edition text ID");
      const stable = append(details, "a", "", "Open stable verse link");
      stable.href = verse.deepLink;
    });
    container.setAttribute("aria-busy", "false");
  }

  function renderProvenance(payload) {
    const provenance = byId("passage-provenance");
    const edition = payload.edition;
    provenance.hidden = false;
    byId("bibleRootFutureLayers").hidden = false;
    byId("bibleRootProvenanceEdition").textContent =
      `${edition.displayTitle} (${edition.editionId})`;
    byId("bibleRootProvenancePublication").textContent =
      `${edition.publication.title} · ${edition.publication.stableIdentifier}`;
    byId("bibleRootProvenanceArtifact").textContent =
      `${edition.artifact.filename} · ${edition.artifact.byteLength.toLocaleString()} bytes`;
    byId("bibleRootProvenanceHash").textContent = edition.artifact.sha256;
    byId("bibleRootProvenanceRights").textContent =
      `${edition.rightsStatus} · ${edition.artifact.rightsStatement}`;
    byId("bibleRootProvenanceNormalizedHash").textContent =
      edition.normalizedTextSha256;
    byId("bibleRootProvenanceTerritory").textContent =
      edition.territorialLimitation;
    const stable = byId("bibleRootStableLink");
    stable.href = payload.stableDeepLink;
  }

  function errorState(error) {
    const code = String(error && error.code || "");
    if (code === "PASSAGE_UNAVAILABLE") {
      return ["unavailable", "Passage not in this alpha", error.message, false];
    }
    if (
      code === "MALFORMED_REFERENCE"
      || code === "UNKNOWN_BOOK"
      || code === "INVALID_CHAPTER"
      || code === "INVALID_VERSE"
      || code === "REVERSED_RANGE"
    ) {
      return ["malformed", "Reference could not be opened", error.message, false];
    }
    return [
      "offline",
      "BibleRoot API unavailable",
      "The live SourceRoot service could not return this passage. No fallback text was substituted.",
      true
    ];
  }

  async function load(reference, pushHistory) {
    const sequence = ++requestSequence;
    const cleanReference = String(reference || "").trim();
    if (pushHistory) {
      const url = new URL(global.location.href);
      url.searchParams.set("reference", cleanReference);
      url.searchParams.set("edition", editionFromUrl());
      url.hash = "";
      global.history.pushState({ reference: cleanReference }, "", url);
    }
    byId("bibleRootPassageReference").value = cleanReference;
    byId("bibleRootPassageVerses").setAttribute("aria-busy", "true");
    clear(byId("bibleRootPassageVerses"));
    byId("passage-provenance").hidden = true;
    byId("bibleRootFutureLayers").hidden = true;
    setStatus("loading", "Loading exact text", "Contacting the SourceRoot BibleRoot API.", false);
    try {
      const payload = await global.BibleRootApi.passage(
        cleanReference,
        editionFromUrl()
      );
      if (sequence !== requestSequence) return;
      document.title = `${payload.normalizedReference} | BibleRoot`;
      byId("bibleRootPassageTitle").textContent = payload.normalizedReference;
      byId("bibleRootPassageCitation").textContent = payload.humanCitation;
      byId("bibleRootPassageEdition").textContent =
        payload.edition.abbreviation;
      byId("bibleRootPassageBreadcrumb").textContent =
        payload.normalizedReference;
      byId("bibleRootPassageStatus").hidden = true;
      renderVerses(payload);
      renderProvenance(payload);
    } catch (error) {
      if (sequence !== requestSequence) return;
      const state = errorState(error);
      byId("bibleRootPassageTitle").textContent = state[1];
      byId("bibleRootPassageCitation").textContent = cleanReference;
      byId("bibleRootPassageBreadcrumb").textContent = "Unavailable passage";
      byId("bibleRootPassageVerses").setAttribute("aria-busy", "false");
      setStatus(state[0], state[1], state[2], state[3]);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("bibleRootPassageForm").addEventListener("submit", (event) => {
      event.preventDefault();
      load(byId("bibleRootPassageReference").value, true);
    });
    global.addEventListener("popstate", () => load(referenceFromUrl(), false));
    load(referenceFromUrl(), false);
  }, { once: true });
})(window);
