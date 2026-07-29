const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const api = read("assets/js/dictionaryroot-api.js");
const home = read("assets/js/dictionaryroot-home.js");
const concept = read("assets/js/dictionaryroot-concept.js");
const css = read("assets/css/dictionaryroot-live.css");

test("frontend scripts retain valid JavaScript syntax", () => {
  for (const relative of [
    "assets/js/dictionaryroot-api.js",
    "assets/js/dictionaryroot-home.js",
    "assets/js/dictionaryroot-concept.js",
  ]) {
    execFileSync(process.execPath, ["--check", path.join(root, relative)]);
  }
});

test("API client exposes bounded incremental lexical evidence search", () => {
  assert.match(api, /lexicalEvidenceSearchAll/);
  assert.match(api, /maxPages:\s*20/);
  assert.match(api, /loadedPages/);
  assert.match(api, /lexicalEvidenceSense/);
});

test("Home combines live baseline and evidence results without fallback data", () => {
  assert.match(home, /searchNodes/);
  assert.match(home, /lexicalEvidenceSearchAll/);
  assert.match(home, /data-dr-result-page/);
  assert.match(home, /Page \$\{page\} of \$\{totalPages\}/);
  assert.doesNotMatch(home, /fixture-source-general-a/);
});

test("Concept groups senses by part of speech", () => {
  assert.match(concept, /dr-concept-sense-group-heading/);
  assert.match(concept, /partOfSpeechFrom\(left\)/);
  assert.match(concept, /meaningMatchRank/);
});

test("Concept renders each evidence family and explicit empty states", () => {
  for (const marker of [
    "Source-specific definition claims",
    "Variant, historical, and family forms",
    "Etymology proposals",
    "Reviewed source comparisons",
    "Field-level provenance",
    "No definition claims are recorded",
    "No etymology proposal is recorded",
    "No source comparison is recorded",
  ]) assert.match(concept, new RegExp(marker));
});

test("uncertainty, qualifications, locators, and review status are visible", () => {
  for (const marker of [
    "Uncertainty:", "Qualification:", "Locator", "reviewStatus",
    "competingProposalIds", "subjectField",
  ]) assert.match(concept, new RegExp(marker));
});

test("responsive evidence styles avoid fixed-width overflow", () => {
  assert.match(css, /dr-lexical-evidence-grid/);
  assert.match(css, /minmax\(min\(100%, 17rem\), 1fr\)/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.doesNotMatch(css, /\.dr-lexical-evidence-card\s*\{[^}]*width:\s*\d+px/s);
});

test("protected API and navigation integrations remain present", () => {
  assert.match(api, /search\(query, params\)/);
  assert.match(api, /async concept\(nodeId\)/);
  assert.match(home, /DictionaryRootNavigation\.buildHref/);
  assert.match(concept, /updateHistory/);
  assert.match(concept, /popstate/);
});
