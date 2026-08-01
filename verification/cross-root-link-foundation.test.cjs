const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const html = read("cross-root-links.html");
const script = read("assets/js/cross-root-links.js");
const api = read("assets/js/cross-root-api.js");
const css = read("assets/css/cross-root-links.css");

test("1. dedicated page has unique IDs and protected API script order", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const order = ["sourceroot-api.js", "cross-root-api.js", "cross-root-links.js"].map((name) => html.indexOf(name));
  assert.ok(order.every((value) => value > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("2. visible boundaries reject semantic and review conclusions", () => {
  assert.match(html, /does not establish the same meaning, dictionary sense, identity, influence, causation, or significance/i);
  assert.match(html, /have not been accepted through human semantic review/i);
  assert.match(script, /Textually observed/);
  assert.match(script, /Unreviewed/);
});

test("3. live API supplies coverage and links with no embedded fallback", () => {
  assert.match(api, /coverage:\s*\(\) => get\("\/coverage"\)/);
  assert.match(api, /links:\s*\(query\) => get\("\/links"/);
  assert.doesNotMatch(script, /fallbackLinks|sampleLinks|staticLinks/);
  assert.match(script + html, /No fallback links/);
});

test("4. evidence UI exposes exact surface, field, offsets, excerpt, IDs, hashes, and versions", () => {
  for (const marker of ["surfaceText","targetField","startOffset","endOffset","contextExcerpt","evidenceId","linkId","algorithmVersion","targetContentHash","sourceDatasetVersion"]) assert.match(script, new RegExp(marker));
});

test("5. results are grouped by Root and retain canonical local navigation", () => {
  assert.match(script, /byRoot = new Map/);
  assert.match(script, /canonicalLocalUrl/);
  assert.match(html, /DictionaryRoot[\s\S]*HistoryRoot[\s\S]*BibleRoot/);
});

test("6. loading, awaiting, no-links, invalid, unavailable, and recovery states are honest", () => {
  for (const marker of ["loading","awaiting","No observed links","Invalid or unregistered resource","API unavailable","Retry"]) assert.match(script, new RegExp(marker, "i"));
  assert.match(script, /retry\)/i);
});

test("7. URL state supports deep links and browser history", () => {
  assert.match(script, /new URLSearchParams\(global\.location\.search\)/);
  assert.match(script, /history\.pushState/);
  assert.match(script, /popstate/);
});

test("8. canonical DictionaryRoot, HistoryRoot, and BibleRoot entry points are narrow", () => {
  assert.match(read("assets/js/dictionaryroot-concept.js"), /resourceType:\s*"lemma"/);
  assert.match(read("assets/js/historyroot-record.js"), /resourceType:\s*"accepted-contextual-record"/);
  assert.match(read("assets/js/bibleroot-passage.js"), /resourceType:\s*"edition-verse-text"/);
});

test("9. mobile cards avoid tables and retain overflow-safe evidence", () => {
  assert.match(css, /@media \(max-width:800px\)/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.doesNotMatch(html, /<table/i);
});

test("10. accessibility includes skip link, semantic headings, live status, focus, and reduced motion", () => {
  assert.match(html, /href="#main-content"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /<label>/);
});
