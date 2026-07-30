const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("1. changed customer scripts retain valid JavaScript syntax", () => {
  for (const file of [
    "assets/js/dictionaryroot-api.js",
    "assets/js/dictionaryroot-home.js",
    "assets/js/dictionaryroot-concept.js",
    "assets/js/dictionaryroot-graph.js",
    "assets/js/dictionaryroot-sources.js",
    "assets/js/dictionaryroot-coverage.js",
    "assets/js/dictionaryroot-history.js",
  ]) {
    execFileSync(process.execPath, ["--check", path.join(root, file)],
      { stdio: "pipe" });
  }
});

test("2. API client exposes production coverage and source accounting", () => {
  const api = read("assets/js/dictionaryroot-api.js");
  assert.match(api, /lexicalEvidenceCoverage\(\)/u);
  assert.match(api, /lexicalEvidenceSources\(\)/u);
  assert.match(api, /dictionaryroot\/lexicon\/evidence\/coverage/u);
  assert.match(api, /dictionaryroot\/lexicon\/evidence\/sources/u);
});

test("3. Coverage distinguishes backend, endpoint, awaiting, and metrics states", () => {
  const coverage = read("assets/js/dictionaryroot-coverage.js");
  for (const marker of [
    "SourceRoot offline",
    "Coverage endpoint unavailable.",
    "Awaiting production lexical corpus.",
    "productionDatasetAvailable",
    "production lexical coverage",
    "No fallback or substituted metrics",
  ]) assert.match(coverage, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
});

test("4. Home summary cards consume real production metrics", () => {
  const home = read("assets/js/dictionaryroot-home.js");
  const html = read("index.html");
  for (const marker of [
    "status.senseCount", "status.lemmaCount",
    "status.lexicalRelationshipCount", "status.definitionClaimCount",
    "status.sourceCount", "status.sourceComparisonCount",
  ]) assert.match(home, new RegExp(marker.replace(".", "\\."), "u"));
  assert.match(html, /definition claims/u);
  assert.match(html, /accepted sources/u);
});

test("5. Sources defaults to canonical lexical-evidence accounting", () => {
  const sources = read("assets/js/dictionaryroot-sources.js");
  assert.match(sources, /lexicalEvidenceSources\(\)/u);
  assert.match(sources, /supportedClaimCount/u);
  assert.match(sources, /supportedRelationshipCount/u);
  assert.match(sources, /datasetVersion/u);
  assert.match(sources, /assertionScan:\s*\{/u);
  assert.match(sources, /edgeScan:\s*\{/u);
  assert.match(sources, /strategy:\s*"single-source-bundle"/u);
  assert.match(
    read("sources-v2.html"),
    /dictionaryroot-sources\.js\?v=core-lexical-corpus-v1/u,
  );
});

test("6. History resolves production lexical senses and dataset version", () => {
  const history = read("assets/js/dictionaryroot-history.js");
  const api = read("assets/js/dictionaryroot-api.js");
  assert.match(history, /lexicalEvidenceSearchAll/u);
  assert.match(history, /lexicalEvidenceConcept/u);
  assert.match(history, /datasetVersion/u);
  assert.match(history, /Sense record v/u);
  assert.match(api, /recordVersion/u);
});

test("7. Concept and Knowledge Sphere retain canonical evidence adapters", () => {
  const concept = read("assets/js/dictionaryroot-concept.js");
  const graph = read("assets/js/dictionaryroot-graph.js");
  assert.match(concept, /Source-specific definition claims/u);
  assert.match(concept, /Reviewed source comparisons/u);
  assert.match(concept, /locator\.entryHeadword/u);
  assert.match(concept, /locator\.section/u);
  assert.match(
    read("concept-v2.html"),
    /dictionaryroot-concept\.js\?v=core-lexical-corpus-v1/u,
  );
  assert.match(graph, /lexicalEvidenceGraphSeeds/u);
  assert.match(graph, /lexicalEvidenceRelationshipEvidence/u);
  assert.match(graph, /relationship-evidence/u);
});

test("8. production customer paths contain no static lexical fallback records", () => {
  const combined = [
    "assets/js/dictionaryroot-home.js",
    "assets/js/dictionaryroot-concept.js",
    "assets/js/dictionaryroot-graph.js",
    "assets/js/dictionaryroot-sources.js",
    "assets/js/dictionaryroot-coverage.js",
    "assets/js/dictionaryroot-history.js",
  ].map(read).join("\n");
  assert.doesNotMatch(combined, /STATIC_(?:LEXICON|CORPUS|GRAPH)_FALLBACK/u);
  assert.doesNotMatch(combined, /generic duplicate lexical node/iu);
});
