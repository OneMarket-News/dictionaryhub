(function bibleRootApiFactory(global) {
  "use strict";

  const DEFAULT_API_BASE = "http://localhost:3000/api/v1/bibleroot";
  const DEFAULT_EDITION = "br-edition-kjv-pg10-2024";

  function resolveApiBase() {
    try {
      const parsed = new URL(DEFAULT_API_BASE);
      const local = new Set(["localhost", "127.0.0.1", "[::1]"]);
      if (global.location && local.has(global.location.hostname)) {
        parsed.hostname = global.location.hostname;
      }
      return parsed.toString().replace(/\/$/, "");
    } catch (_) {
      return DEFAULT_API_BASE;
    }
  }

  async function get(path, query) {
    if (!global.SourceRootApiLayer) {
      throw new Error("The shared SourceRoot API layer is unavailable.");
    }
    const result = await global.SourceRootApiLayer.request(
      `${resolveApiBase()}${path}`,
      { query: query || {}, cache: "no-store" }
    );
    return result.data;
  }

  global.BibleRootApi = Object.freeze({
    defaultEdition: DEFAULT_EDITION,
    editions: () => get("/editions"),
    translations: () => get("/translations"),
    comparison: (reference, editions) => get("/comparison", {
      reference,
      editions: Array.isArray(editions) ? editions.join(",") : undefined
    }),
    commentaries: () => get("/commentaries"),
    commentary: (reference, works) => get("/commentary", {
      reference,
      works: Array.isArray(works) ? works.join(",") : undefined
    }),
    books: () => get("/books"),
    passage: (reference, edition) => get("/passages", {
      reference,
      edition: edition || DEFAULT_EDITION
    }),
    verse: (verseId, edition) => get(
      `/verses/${encodeURIComponent(verseId)}`,
      { edition: edition || DEFAULT_EDITION }
    ),
    phrase: (phraseId) => get(`/phrases/${encodeURIComponent(phraseId)}`),
    originalLanguageEditions: () => get("/original-language/editions"),
    originalLanguagePassage: (reference, edition) => get(
      "/original-language/passages",
      { reference, edition: edition || undefined }
    )
  });
})(window);
