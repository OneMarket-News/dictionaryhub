const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));

const candidates = [
  "assets/brand/bibleroot-concepts/bibleroot-concept-a-rooted-manuscript.svg",
  "assets/brand/bibleroot-concepts/bibleroot-concept-b-verse-network.svg",
  "assets/brand/bibleroot-concepts/bibleroot-concept-c-source-seal.svg",
  "assets/brand/bibleroot-concepts/bibleroot-concept-d-citation-root.svg"
];

test("1. exactly four original standalone SVG candidates use the safe vector contract", () => {
  const directory = path.join(root, "assets/brand/bibleroot-concepts");
  const actual = fs.readdirSync(directory).filter((file) => file.endsWith(".svg")).sort();
  assert.deepEqual(actual, candidates.map((item) => path.basename(item)).sort());

  for (const candidate of candidates) {
    const svg = read(candidate);
    assert.match(svg, /<svg\b[^>]*viewBox="0 0 64 64"/);
    assert.match(svg, /currentColor/);
    assert.doesNotMatch(svg, /<(?:script|text|image|foreignObject|use|filter|linearGradient|radialGradient)\b/i);
    const references = svg.replace('xmlns="http://www.w3.org/2000/svg"', "");
    assert.doesNotMatch(references, /(?:https?:|data:|base64|@font-face|url\s*\()/i);
    assert.doesNotMatch(svg, /\bid="[^"]+"/i);
    assert.match(svg, /role="img"/);
    assert.match(svg, /aria-label="[^"]+"/);
  }
});

test("2. review page references every candidate and only local review assets", () => {
  const html = read("bibleroot-logo-review.html");
  for (const candidate of candidates) assert.match(html, new RegExp(candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /assets\/css\/bibleroot-logo-review\.css/);
  assert.match(html, /assets\/js\/bibleroot-logo-review\.js/);
  assert.match(html, /--concept-url:url\('\.\.\/brand\/bibleroot-concepts\/bibleroot-concept-b-verse-network\.svg'\)/);
  assert.doesNotMatch(html, /(?:src|href)="https?:/i);

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const reference of [...html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)].map((match) => match[1])) {
    if (reference.startsWith("#")) continue;
    assert.equal(exists(reference), true, `missing local reference ${reference}`);
  }
});

test("3. required size, mode, palette, wordmark, header, and family comparisons exist", () => {
  const html = read("bibleroot-logo-review.html");
  const css = read("assets/css/bibleroot-logo-review.css");
  const js = read("assets/js/bibleroot-logo-review.js");
  assert.match(js, /const sizes = \[16, 24, 32, 48, 64, 128\]/);
  assert.match(js, /path\.replace\(\/\^assets\\\/\/, "\.\.\/"\)/);
  for (const marker of ["One color", "Grayscale", "Light background", "Dark background"]) assert.match(js, new RegExp(marker));
  for (const marker of ["Deep indigo / parchment", "Midnight / warm gold", "Charcoal / burgundy", "Evergreen / aged ivory"]) assert.match(js, new RegExp(marker));
  for (const marker of ["Equal weight", "Reduced Root", "Accent Root", "Desktop header mockup", "Mobile header mockup"]) assert.match(js, new RegExp(marker));
  assert.match(html, /SourceRoot product family comparison/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-x:\s*hidden/);
});

test("4. rubric weights total 100 and documented initial totals are exact", () => {
  const js = read("assets/js/bibleroot-logo-review.js");
  const weights = [...js.matchAll(/weight:\s*(\d+)/g)].map((match) => Number(match[1]));
  assert.deepEqual(weights, [12, 10, 12, 11, 10, 9, 8, 9, 8, 7, 4]);
  assert.equal(weights.reduce((sum, value) => sum + value, 0), 100);

  const scoreSets = [...js.matchAll(/initial:\s*\[([^\]]+)\]/g)].map((match) => match[1].split(",").map((value) => Number(value.trim())));
  assert.equal(scoreSets.length, 4);
  const totals = scoreSets.map((scores) => Number(scores.reduce((sum, score, index) => sum + weights[index] * score / 5, 0).toFixed(1)));
  assert.deepEqual(totals, [78.4, 83.6, 84.8, 86.2]);
});

test("5. scoring and notes remain local, non-persistent, and unable to select a winner", () => {
  const html = read("bibleroot-logo-review.html");
  const js = read("assets/js/bibleroot-logo-review.js");
  assert.match(html, /data-review-status="research-complete-selection-deferred"/);
  assert.match(html, /No automated control on this page selects or installs a winner/);
  assert.match(html, /No winner is approved or installed/);
  assert.match(js, /type="number" min="0" max="5" step="1"/);
  assert.match(js, /discarded on reload/);
  assert.doesNotMatch(js, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|cookie|serviceWorker)\b/);
  assert.doesNotMatch(html, /type="radio"|name="winner"|name="selection"/i);
});

test("6. all four rationales, human evaluation, lead boundary, and deferral gate are documented", () => {
  const review = read("docs/brand/BIBLEROOT-LOGO-CONCEPT-REVIEW-V1.md");
  const normalizedReview = review.replace(/\s+/g, " ");
  for (const marker of ["A — Rooted Manuscript", "B — Verse Network", "C — Source Seal", "D — Citation Root"]) assert.match(review, new RegExp(marker));
  for (const marker of ["Originality and conflict review", "not trademark clearance", "current non-binding lead", "familiar control", "no concept is approved", "final selection and refinement are deferred"]) assert.match(normalizedReview, new RegExp(marker, "i"));
  for (const marker of ["SourceRoot Shared Grammar and Root Integration Contracts", "EarthRoot browser shell", "multi-Root navigation and search", "map, timeline, graph, entity, and source experiences", "SourceRoot family brand architecture"]) assert.match(normalizedReview, new RegExp(marker, "i"));
  assert.match(review, /\*\*Weighted total\*\*[\s\S]*\*\*78\.4\*\*[\s\S]*\*\*83\.6\*\*[\s\S]*\*\*84\.8\*\*[\s\S]*\*\*86\.2\*\*/);
});

test("7. current BibleRoot production pages do not reference review candidates or assets", () => {
  for (const page of ["bibleroot.html", "bibleroot-passage.html", "bibleroot-compare.html", "bibleroot-commentary.html"]) {
    const html = read(page);
    assert.doesNotMatch(html, /bibleroot-logo-review|bibleroot-concepts|visual-identity-logo/i);
  }
});
