import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, "$1")),
  "..",
);

const pages = [
  "historyroot.html",
  "history-explore-v1.html",
  "history-timeline-v1.html",
  "history-record-v1.html",
  "history-sources-v1.html",
  "history-graph-v1.html",
];

const scripts = [
  "assets/js/historyroot-api.js",
  "assets/js/historyroot-shared.js",
  "assets/js/historyroot-home.js",
  "assets/js/historyroot-explore.js",
  "assets/js/historyroot-timeline.js",
  "assets/js/historyroot-record.js",
  "assets/js/historyroot-sources.js",
  "assets/js/historyroot-graph.js",
];

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("all six HistoryRoot customer pages exist", () => {
  pages.forEach((page) => assert.ok(fs.existsSync(path.join(root, page)), page));
});

test("each page has unique IDs, one h1, responsive metadata, shared styles, and safe script order", () => {
  pages.forEach((page) => {
    const html = read(page);
    const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${page} has duplicate IDs`);
    assert.equal((html.match(/<h1(?:\s|>)/gu) || []).length, 1, page);
    assert.match(html, /<meta name="viewport"/u, page);
    assert.match(html, /assets\/css\/dictionaryroot-brand\.css/u, page);
    assert.match(html, /assets\/css\/historyroot\.css/u, page);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/u, page);
    const api = html.indexOf("assets/js/historyroot-api.js");
    const shared = html.indexOf("assets/js/historyroot-shared.js");
    const pageScript = html.lastIndexOf("assets/js/historyroot-");
    assert.ok(api >= 0 && shared > api && pageScript > shared, page);
  });
});

test("the shared navigation exposes the five HistoryRoot areas and family link", () => {
  const source = read("assets/js/historyroot-shared.js");
  [
    "Home",
    "Explore",
    "Timeline",
    "Sources",
    "Knowledge Graph",
    "DictionaryRoot",
  ].forEach((label) => assert.match(source, new RegExp(`"${label}"`, "u")));
  assert.match(source, /aria-current/u);
  assert.match(source, /aria-expanded/u);
});

test("HistoryRoot renders API text through DOM text nodes and never unsafe HTML", () => {
  const source = scripts.map(read).join("\n");
  assert.doesNotMatch(source, /\.innerHTML\s*=/u);
  assert.doesNotMatch(source, /insertAdjacentHTML/u);
  assert.match(source, /textContent/u);
  assert.match(source, /createTextNode/u);
});

test("the API client provides live-only timeout, malformed, offline, and dataset checks", () => {
  const api = read("assets/js/historyroot-api.js");
  const shared = read("assets/js/historyroot-shared.js");
  assert.match(api, /AbortController/u);
  assert.match(api, /MALFORMED_RESPONSE/u);
  assert.match(api, /TIMEOUT/u);
  assert.match(api, /OFFLINE/u);
  assert.match(shared, /DATASET_NOT_IMPORTED/u);
  assert.match(shared, /No historical fallback data is shown/u);
  assert.deepEqual(
    JSON.parse(read("config/customers/historyroot.json")).dataset.id,
    "historyroot-plymouth-knowledge-dataset-v1",
  );
});

test("no page script embeds Plymouth historical records", () => {
  const pageSources = scripts
    .filter((file) => !file.endsWith("historyroot-api.js"))
    .map(read)
    .join("\n");
  assert.doesNotMatch(pageSources, /historyroot-plymouth-(?:person|group|place|event|document|work)-/u);
  assert.doesNotMatch(pageSources, /data\/historyroot/u);
  assert.doesNotMatch(pageSources, /great-chicago-fire/u);
});

test("search and explore preserve aliases, canonical IDs, deduplication, URL state, and history navigation", () => {
  const shared = read("assets/js/historyroot-shared.js");
  const explore = read("assets/js/historyroot-explore.js");
  assert.match(shared, /Matched alias:/u);
  assert.match(shared, /dedupeRecords/u);
  assert.match(shared, /URLSearchParams/u);
  assert.match(explore, /popstate/u);
  assert.match(explore, /updateUrl/u);
  assert.match(explore, /temporalBySubject/u);
});

test("timeline keeps precision, uncertainty, scopes, and progressive disclosure explicit", () => {
  const source = read("assets/js/historyroot-timeline.js");
  [
    "temporalPrecisionLabel",
    "temporalUncertainty",
    "background",
    "transition",
    "memory",
    "PAGE_SIZE",
    "popstate",
    "entry.memory",
  ].forEach((token) => assert.match(source, new RegExp(token, "u")));
  assert.doesNotMatch(source, /new Date\s*\(/u);
});

test("adaptive record details cover evidence, attribution, causality, memory, sources, and document witnesses", () => {
  const source = read("assets/js/historyroot-record.js");
  [
    "Claims and evidence",
    "Evidence limit:",
    "Attributed perspective:",
    "Causal qualification:",
    "Cultural memory and afterlife",
    "Document and textual transmission",
    "Original does not survive",
    "textual_witness_of",
    "sourceMiniCard",
  ].forEach((token) => assert.match(source, new RegExp(token, "u")));
});

test("source experience exposes classification, access, locators, limitations, rights, and safe external links", () => {
  const source = read("assets/js/historyroot-sources.js");
  [
    "sourceClassLabel",
    "Access status",
    "Locators inspected",
    "Limitations",
    "License or rights",
    "externalLink",
    "sourceLinkedRecords",
    "aria-current",
    "popstate",
  ].forEach((token) => assert.match(source, new RegExp(token, "u")));
});

test("knowledge graph is bounded, focused, URL-addressable, and keyboard operable", () => {
  const source = read("assets/js/historyroot-graph.js");
  assert.match(source, /maximumNodeLimit/u);
  assert.match(source, /buildNeighborhood/u);
  assert.match(source, /updateUrl\(\{ id: focusId \}\)/u);
  assert.match(source, /types:/u);
  assert.match(source, /applyKindsFromUrl/u);
  assert.match(source, /Also known as:/u);
  assert.match(source, /Qualification:/u);
  assert.match(source, /popstate/u);
  assert.match(source, /ui\.element\("button"/u);
  assert.match(source, /aria-pressed/u);
});

test("responsive styles cover desktop, tablet, mobile, and reduced motion", () => {
  const css = read("assets/css/historyroot.css");
  ["1320px", "900px", "680px", "420px", "prefers-reduced-motion"].forEach(
    (token) => assert.match(css, new RegExp(token, "u")),
  );
  assert.match(css, /\.historyroot-menu-button/u);
  assert.match(css, /\.hr-graph-stage/u);
});

test("shared helper behavior is deterministic and safely encodes links", () => {
  const windowObject = {
    location: {
      pathname: "/history-explore-v1.html",
      href: "http://localhost/history-explore-v1.html",
      protocol: "http:",
      hostname: "localhost",
    },
    history: { pushState() {}, replaceState() {} },
  };
  const context = {
    window: windowObject,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    AbortController,
    fetch: async () => {
      throw new Error("not used");
    },
    CustomEvent: class {},
  };
  vm.runInNewContext(read("assets/js/historyroot-api.js"), context);
  vm.runInNewContext(read("assets/js/historyroot-shared.js"), context);
  const helpers = windowObject.HistoryRootShared;
  assert.equal(
    helpers.safeExternalUrl("javascript:alert(1)"),
    "",
  );
  assert.equal(
    helpers.recordHref("id with spaces"),
    "history-record-v1.html?id=id+with+spaces",
  );
  assert.equal(
    helpers.matchedAlias(
      { name: "Tisquantum", alternateNames: ["Squanto"] },
      "squanto",
    ),
    "Squanto",
  );
  assert.deepEqual(
    Array.from(helpers.aliasesOf({
      alternateNames: ["Pahtuksut"],
      aliases: [{ text: "Pahtuksut" }, { text: "Patuxet" }],
    })),
    ["Pahtuksut", "Patuxet"],
  );
  assert.equal(
    helpers.dedupeRecords([{ id: "one" }, { id: "one" }, { id: "two" }]).length,
    2,
  );
  assert.equal(
    helpers.temporalYear({ temporalKind: "range", startDate: "1616-01-01" }),
    1616,
  );
  assert.equal(
    helpers.temporalUncertainty({ dateNotes: "Approximate source date." }),
    "Approximate source date.",
  );
  assert.equal(
    windowObject.HistoryRootApi.buildQuery({ q: "King Philip's War" }),
    "?q=King+Philip%27s+War",
  );
});
