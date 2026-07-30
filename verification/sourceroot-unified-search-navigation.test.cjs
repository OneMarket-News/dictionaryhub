const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = resolve(__dirname, "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const page = read("sourceroot-search.html");
const script = read("assets/js/sourceroot-unified-search.js");
const style = read("assets/css/sourceroot-unified-search.css");
const dictionaryNavigation = read("assets/js/dictionaryroot-navigation.js");
const dictionaryConcept = read("assets/js/dictionaryroot-concept.js");
const historyShared = read("assets/js/historyroot-shared.js");
const historyRecord = read("assets/js/historyroot-record.js");
const sourceRootHome = read("sourceroot.html");

test("1. unified page has unique IDs and resolvable local assets", () => {
  const ids = [...page.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const reference of [
    "assets/css/sourceroot-unified-search.css",
    "assets/js/sourceroot-api.js",
    "assets/js/sourceroot-unified-search.js",
    "assets/brand/dictionaryroot-mark.svg"
  ]) {
    assert.match(page, new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("2. unified search uses semantic navigation, search, filters, and live regions", () => {
  for (const marker of [
    'aria-label="SourceRoot products"',
    'aria-label="Breadcrumb"',
    'role="search"',
    "<fieldset>",
    "<legend>Roots</legend>",
    "<legend>Result types</legend>",
    'role="status"',
    'aria-live="polite"',
    'aria-busy="false"'
  ]) {
    assert.match(page, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("3. URL state preserves query, Roots, result types, and page", () => {
  for (const marker of [
    "new URLSearchParams(global.location.search)",
    'params.get("q")',
    'parseList(params, "roots"',
    'parseList(params, "resultTypes"',
    'params.get("page")',
    'url.searchParams.set("roots"',
    'url.searchParams.set("resultTypes"',
    'url.searchParams.set("page"',
    'global.addEventListener("popstate"',
    "pushState",
    "replaceState"
  ]) {
    assert.ok(script.includes(marker), marker);
  }
});

test("4. unified rendering preserves Root, version, match, evidence, and canonical links", () => {
  for (const marker of [
    "item.rootDisplayName",
    "item.datasetId",
    "item.datasetVersion",
    "item.matchClassification",
    "item.sourceEvidenceAvailable",
    'href: item.canonicalUrl',
    "item.connectionBasis",
    "not presented as a verified cross-Root relationship"
  ]) {
    assert.ok(script.includes(marker), marker);
  }
});

test("5. partial, empty, filter-excluded, and offline states are explicit", () => {
  for (const marker of [
    "partial-availability",
    "filters-exclude-all-result-types",
    "all-unavailable",
    "no fallback data",
    "No stale or fallback records"
  ]) {
    assert.match(script, new RegExp(marker, "i"));
  }
});

test("6. DictionaryRoot and HistoryRoot shared navigation expose all Roots", () => {
  for (const text of [dictionaryNavigation, historyShared]) {
    for (const marker of [
      "sourceroot.html",
      "sourceroot-search.html",
      "index.html",
      "historyroot.html",
      'aria-current="page"',
      "SourceRoot products"
    ]) {
      assert.ok(text.includes(marker), marker);
    }
  }
});

test("7. both shared navigation layers provide canonical breadcrumbs", () => {
  assert.ok(dictionaryNavigation.includes("sr-shared-breadcrumbs"));
  assert.ok(dictionaryNavigation.includes('aria-label", "Breadcrumb"')
    || dictionaryNavigation.includes('aria-label="Breadcrumb"'));
  assert.ok(historyShared.includes("sr-historyroot-breadcrumbs"));
  assert.ok(historyShared.includes('"aria-label": "Breadcrumb"'));
  for (const text of [dictionaryNavigation, historyShared]) {
    assert.ok(text.includes("SourceRoot"));
  }
});

test("8. two-way contextual discovery carries the required disclaimers", () => {
  for (const marker of [
    "Explore this term in HistoryRoot",
    "does not prove that this DictionaryRoot sense was intended",
    'roots: "HistoryRoot"'
  ]) {
    assert.ok(dictionaryConcept.includes(marker), marker);
  }
  for (const marker of [
    "Compare possible meanings in DictionaryRoot",
    "does not establish what a historical speaker or source intended",
    'value: "DictionaryRoot"',
    'value: "lexical-sense"',
    "required: \"required\""
  ]) {
    assert.ok(historyRecord.includes(marker), marker);
  }
});

test("9. SourceRoot home exposes a unified GET search entry point", () => {
  assert.match(sourceRootHome, /action="sourceroot-search\.html"/);
  assert.match(sourceRootHome, /name="q"/);
  assert.match(sourceRootHome, /Search all Roots/);
  assert.match(sourceRootHome, /aria-label="SourceRoot products"/);
});

test("10. keyboard focus, mobile layout, and reduced motion have explicit styles", () => {
  for (const marker of [
    ":focus-visible",
    "@media (max-width: 880px)",
    "@media (max-width: 560px)",
    "@media (prefers-reduced-motion: reduce)",
    "overflow-x: auto",
    "min-width: 0"
  ]) {
    assert.ok(style.includes(marker), marker);
  }
});

test("11. result rendering avoids HTML injection and static fallback records", () => {
  assert.ok(script.includes("textContent"));
  assert.ok(!script.includes("fallbackRecords"));
  assert.ok(!script.includes("staticResults"));
  assert.ok(!script.includes("innerHTML"));
});

test("12. changed customer scripts pass JavaScript syntax checks", () => {
  for (const relative of [
    "assets/js/sourceroot-unified-search.js",
    "assets/js/dictionaryroot-navigation.js",
    "assets/js/dictionaryroot-concept.js",
    "assets/js/historyroot-shared.js",
    "assets/js/historyroot-record.js"
  ]) {
    const result = spawnSync(process.execPath, ["--check", resolve(root, relative)], {
      encoding: "utf8"
    });
    assert.equal(result.status, 0, `${relative}: ${result.stderr}`);
  }
});
