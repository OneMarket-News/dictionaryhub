const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const html = read("bibleroot-compare.html");
const script = read("assets/js/bibleroot-compare.js");
const api = read("assets/js/bibleroot-api.js");
const css = read("assets/css/bibleroot-compare.css");

test("1. dedicated page has unique IDs and protected script order", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const order = ["sourceroot-api.js", "bibleroot-api.js", "bibleroot-compare.js"].map((name) => html.indexOf(name));
  assert.ok(order.every((position) => position > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("2. controls expose four references, edition selection, and highlight toggle", () => {
  for (const reference of ["Genesis 1", "Psalm 23", "Ecclesiastes 3", "John 1"]) assert.match(html, new RegExp(reference));
  assert.match(html, /bibleRootCompareEditions/);
  assert.match(html, /bibleRootCompareHighlights/);
  assert.match(script, /length > 4/);
  assert.match(script, /defaultEdition/);
});

test("3. API client uses live translation and comparison endpoints", () => {
  assert.match(api, /translations:\s*\(\) => get\("\/translations"\)/);
  assert.match(api, /comparison:\s*\(reference, editions\) => get\("\/comparison"/);
  assert.doesNotMatch(api + script + html, /fallbackVerse|sampleVerse|staticVerse|embeddedVerse/i);
});

test("4. loading, awaiting-data, unsupported, and API-unavailable states are explicit", () => {
  for (const marker of ["loading", "awaiting-data", "empty", "unavailable", "Retry"]) assert.match(script + html, new RegExp(marker, "i"));
  assert.match(script, /No sample or fallback verse text is shown/);
});

test("5. exact text remains visible while token highlighting is separately toggled", () => {
  assert.match(script, /text\("p", cellData\.exactText\)/);
  assert.match(script, /br-token-diff/);
  assert.match(script, /baseline\[index\]\.text !== token\.text/);
  assert.match(html, /Highlights show textual differences only\. They do not determine meaning, accuracy, doctrine, or translation quality\./);
});

test("6. provenance distinguishes edition, publication, artifact, dataset, checksum, and rights", () => {
  for (const marker of ["Publication / release", "Source provider", "Upstream artifact", "Retrieval timestamp", "Byte length", "SHA-256", "Rights status", "Territorial limitation", "Normalized dataset", "Normalization notes"]) assert.match(script, new RegExp(marker));
  assert.match(script, /Source identity recorded · checksum matched · rights metadata recorded · canonical mapping validated/);
});

test("7. Original Language connection uses canonical availability without word alignment", () => {
  assert.match(script, /originalLanguage\.available/);
  assert.match(script, /Open original-language passage/);
  assert.doesNotMatch(script + html, /gloss generation|semantic equivalence|word-to-word|morphology-based translation/i);
});

test("8. desktop columns and mobile stacked cards prevent forced table overflow", () => {
  assert.match(css, /grid-template-columns:\s*repeat\(var\(--edition-count/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.br-edition-columns\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /min-width:\s*0/);
  assert.doesNotMatch(html, /<table/i);
});

test("9. focusable native controls, dialog semantics, live regions, and reduced motion are present", () => {
  assert.match(html, /<dialog[^>]+aria-labelledby/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<fieldset>/);
  assert.match(html, /<legend>/);
  assert.match(css, /prefers-reduced-motion/);
});

test("10. BibleRoot home and passage pages provide comparison entry points", () => {
  assert.match(read("bibleroot.html"), /bibleroot-compare\.html/);
  assert.match(read("bibleroot-passage.html"), /bibleroot-compare\.html/);
});
