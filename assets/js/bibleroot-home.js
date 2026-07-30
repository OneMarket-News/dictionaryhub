(function bibleRootHome(global) {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function shortHash(value) {
    const text = String(value || "");
    return text.length > 20 ? `${text.slice(0, 16)}…${text.slice(-8)}` : text;
  }

  function openReference(reference) {
    const value = String(reference || "").trim();
    if (!value) return;
    global.location.assign(
      `bibleroot-passage.html?reference=${encodeURIComponent(value)}`
    );
  }

  async function loadEdition() {
    const state = byId("bibleRootHomeServiceState");
    try {
      const payload = await global.BibleRootApi.editions();
      const edition = payload.items && payload.items[0];
      if (!edition) throw new Error("No BibleRoot edition is available.");
      state.textContent = "Live SourceRoot record";
      state.closest(".br-live-line").dataset.state = "connected";
      byId("bibleRootHomeEditionDescription").textContent =
        edition.editionDescription;
      byId("bibleRootHomeEditionId").textContent = edition.editionId;
      byId("bibleRootHomeDatasetVersion").textContent = edition.datasetVersion;
      byId("bibleRootHomeRights").textContent = edition.rightsStatus;
      byId("bibleRootHomeArtifactHash").textContent =
        shortHash(edition.artifact.sha256);
      byId("bibleRootHomeArtifactHash").title = edition.artifact.sha256;
      byId("bibleRootHomeNormalizedHash").textContent =
        shortHash(edition.normalizedTextSha256);
      byId("bibleRootHomeNormalizedHash").title =
        edition.normalizedTextSha256;
    } catch (_) {
      state.textContent = "SourceRoot API unavailable";
      state.closest(".br-live-line").dataset.state = "offline";
      byId("bibleRootHomeEditionDescription").textContent =
        "The edition record could not be loaded. Start or retry the backend; BibleRoot does not substitute static passage data.";
      byId("bibleRootHomeEditionId").textContent = "Unavailable";
      byId("bibleRootHomeDatasetVersion").textContent = "Unavailable";
      byId("bibleRootHomeRights").textContent = "See source documentation";
      byId("bibleRootHomeArtifactHash").textContent = "API unavailable";
      byId("bibleRootHomeNormalizedHash").textContent = "API unavailable";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("bibleRootHomeReferenceForm").addEventListener("submit", (event) => {
      event.preventDefault();
      openReference(byId("bibleRootHomeReference").value);
    });
    loadEdition();
  }, { once: true });
})(window);
