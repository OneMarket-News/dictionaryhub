const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const html = read("cross-root-relationships.html");
const script = read("assets/js/cross-root-relationships.js");
const api = read("assets/js/cross-root-api.js");
const css = read("assets/css/cross-root-relationships.css");

test("1. dedicated relationship page has unique IDs and protected API script order", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const order = ["sourceroot-api.js", "cross-root-api.js", "cross-root-relationships.js"].map((name) => html.indexOf(name));
  assert.ok(order.every((position) => position > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("2. semantic, identity, causal, review, and lexical boundaries are visible", () => {
  assert.match(html + script, /does not create a universal entity identity or prove the relationship/i);
  assert.match(html + script, /Matching labels or aliases alone do not establish/i);
  assert.match(script, /does not strengthen association, contribution, sequence, or uncertainty into proven causation/i);
  assert.match(html, /Exact lexical overlap is discovery evidence only and is not used here/i);
});

test("3. live API supplies relationship coverage, list, and detail with no fallback", () => {
  assert.match(api, /relationshipCoverage:\s*\(\) => get\("\/relationships\/coverage"\)/);
  assert.match(api, /relationships:\s*\(query\) => get\("\/relationships"/);
  assert.match(api, /relationship:\s*\(assertionId\) => get\(`\/relationships\//);
  assert.doesNotMatch(script, /fallbackRelationships|sampleRelationships|staticRelationships/);
  assert.match(script + html, /No fallback/i);
});

test("4. cards expose typed endpoints, native predicates, state, uncertainty, scope, and hashes", () => {
  for (const marker of ["subject", "object", "predicate", "sourceNativeRelationshipType", "relationshipFamily", "derivation", "reviewState", "certainty", "uncertainty", "disputeState", "temporalScope", "geographicScopeDescription", "deterministicIdentityHash", "contentHash"]) {
    assert.match(script, new RegExp(marker));
  }
});

test("5. evidence exposes exact excerpt, offsets, source identifiers, citations, and hashes", () => {
  for (const marker of ["evidenceId", "sourceResourceId", "sourceRecordType", "sourceField", "evidenceMode", "observedExcerpt", "startOffset", "endOffset", "sourceClaimId", "sourceEvidenceId", "publicationId", "artifactId", "sourceId", "citation", "sourceLocator", "sourceUrl", "sourceRecordHash", "sourceFieldHash", "evidenceHash", "sourceDatasetVersion"]) {
    assert.match(script, new RegExp(marker));
  }
});

test("6. loading, awaiting, empty, invalid, unavailable, retry, and recovery states are honest", () => {
  for (const marker of ["loading", "awaiting", "No qualifying relationships", "Invalid resource, assertion, or filter", "API unavailable", "Retry"]) assert.match(script, new RegExp(marker, "i"));
  assert.match(script, /button\.addEventListener\("click",load\)/);
});

test("7. filters, deep-link assertion IDs, and browser history are deterministic", () => {
  for (const marker of ["resourceId", "relationshipFamily", "causal", "assertionId"]) assert.match(script, new RegExp(marker));
  assert.match(script, /new URLSearchParams\(global\.location\.search\)/);
  assert.match(script, /history\.pushState/);
  assert.match(script, /popstate/);
});

test("8. HistoryRoot entry point is API-gated and does not imply identity", () => {
  const historyHtml = read("history-record-v1.html");
  const historyScript = read("assets/js/historyroot-record.js");
  assert.ok(historyHtml.indexOf("cross-root-api.js") < historyHtml.indexOf("historyroot-record.js"));
  assert.match(historyScript, /CrossRootApi\.relationships/);
  assert.match(historyScript, /Inspect source-backed relationships/);
  assert.doesNotMatch(historyScript, /sameAs|identityMatch/);
});

test("9. responsive cards avoid tables and preserve long identifiers", () => {
  assert.match(css, /@media\(max-width:860px\)/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /min-width:0/);
  assert.doesNotMatch(html, /<table/i);
});

test("10. accessibility uses skip navigation, semantic controls, live status, focus, and reduced motion", () => {
  assert.match(html, /href="#main-content"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /<label>/);
  assert.match(script, /document\.createElement\("details"\)|element\("details"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
