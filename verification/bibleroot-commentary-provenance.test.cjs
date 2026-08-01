const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const html = read("bibleroot-commentary.html");
const script = read("assets/js/bibleroot-commentary.js");
const api = read("assets/js/bibleroot-api.js");
const css = read("assets/css/bibleroot-commentary.css");

test("1. dedicated commentary page has unique IDs and protected script order", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const order = ["sourceroot-api.js", "bibleroot-api.js", "bibleroot-commentary.js"].map((name) => html.indexOf(name));
  assert.ok(order.every((position) => position > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("2. four references and at least two default works are supported", () => {
  for (const reference of ["Genesis 1", "Psalm 23", "Ecclesiastes 3", "John 1"]) assert.match(html + script, new RegExp(reference));
  assert.match(script, /input\.checked = index < 2/);
  assert.match(html, /<fieldset>/);
  assert.match(html, /<legend>Historical commentary works<\/legend>/);
});

test("3. API client uses only live commentary endpoints and has no embedded source text", () => {
  assert.match(api, /commentaries:\s*\(\) => get\("\/commentaries"\)/);
  assert.match(api, /commentary:\s*\(reference, works\) => get\("\/commentary"/);
  assert.doesNotMatch(html + script, /Matthew Henry|Robert Jamieson|Fausset|David Brown|In the beginning was the Word/i);
  assert.doesNotMatch(script, /fallbackCommentary|sampleCommentary|embeddedCommentary/i);
});

test("4. exact section and statement records render without generated summaries", () => {
  assert.match(script, /section\.exactText/);
  assert.match(script, /statement\.exactText/);
  assert.match(script, /statement\.startOffset/);
  assert.match(script, /statement\.contentHash/);
  assert.doesNotMatch(script, /summarize|generatedSummary|agreementScore|doctrineClassification|wordAlignment/i);
});

test("5. provenance exposes every required source layer and precise verification states", () => {
  for (const marker of ["Named work", "Author / editors", "Exact edition", "Publication", "Provider", "Upstream raw artifact", "Retrieval timestamp", "Byte length", "Artifact SHA-256", "Dataset", "Rights status", "Territorial limitation", "Database section", "Canonical anchor", "Source locator", "Normalized section SHA-256"]) assert.match(script, new RegExp(marker));
  for (const state of ["Source identity recorded", "checksum matched", "rights metadata recorded", "canonical anchor validated", "statement offsets validated"]) assert.match(script, new RegExp(state, "i"));
  assert.match(script, /rel = "external noopener noreferrer"/);
});

test("6. non-endorsement and shared-placement boundaries are visible", () => {
  assert.match(html, /does not endorse, reconcile, rank, or determine their theological accuracy/);
  assert.match(html, /Shared passage placement does not mean the sources agree/);
  assert.match(html, /Absence is not evidence against a view/);
  assert.match(html, /corpus inclusion is not a quality ranking/);
});

test("7. loading, awaiting-data, invalid, API-unavailable, gap, and retry states are explicit", () => {
  for (const marker of ["loading", "awaiting-data", "invalid", "unavailable", "Retry", "coverageGaps"]) assert.match(script + html, new RegExp(marker, "i"));
  assert.match(script, /No sample or fallback commentary is shown/);
  assert.match(script, /No source text is embedded in this page/);
});

test("8. passage, Translation Comparison, and Original Language links retain canonical context", () => {
  assert.match(script, /payload\.links\.passage/);
  assert.match(script, /payload\.links\.translationComparison/);
  assert.match(script, /payload\.links\.originalLanguage/);
  assert.match(html, />Bible text<|>Translation Comparison<|>Original Language</);
});

test("9. desktop columns, mobile cards, no table, and reduced motion are present", () => {
  assert.match(css, /grid-template-columns:\s*repeat\(var\(--work-count/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.br-commentary-columns\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /min-width:\s*0/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(html, /<table/i);
});

test("10. dialog, live regions, keyboard-native controls, and focusable actions are semantic", () => {
  assert.match(html, /<dialog[^>]+aria-labelledby/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="status"/);
  assert.match(script, /button\.type = "button"/);
  assert.match(script, /document\.createElement\("details"\)/);
});

test("11. home, passage, comparison, and relevant navigation expose entry points", () => {
  for (const page of ["bibleroot.html", "bibleroot-passage.html", "bibleroot-compare.html"]) assert.match(read(page), /bibleroot-commentary\.html/);
  assert.match(html, /aria-current="page" href="bibleroot-commentary\.html"/);
});

test("12. URL state and request supersession are deterministic", () => {
  assert.match(script, /url\.searchParams\.set\("reference"/);
  assert.match(script, /url\.searchParams\.set\("works"/);
  assert.match(script, /global\.history\.replaceState/);
  assert.match(script, /request !== state\.request/);
});
