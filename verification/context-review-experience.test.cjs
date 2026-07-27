"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repositoryRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

const controllerText = read(
  "assets/js/historyroot-context-review.js",
);
const apiText = read("assets/js/historyroot-api.js");
const sharedText = read("assets/js/historyroot-shared.js");
const recordText = read("assets/js/historyroot-record.js");
const recordPageText = read("history-record-v1.html");
const reviewPageText = read("history-context-review-v1.html");
const reviewCssText = read(
  "assets/css/historyroot-context-review.css",
);
const review = require(
  path.join(
    repositoryRoot,
    "assets/js/historyroot-context-review.js",
  ),
);

test("1. review page uses the shared API client", () => {
  assert.match(
    reviewPageText,
    /sourceroot-api\.js[\s\S]*historyroot-api\.js[\s\S]*historyroot-shared\.js[\s\S]*historyroot-context-review\.js/,
  );
  assert.match(controllerText, /ui\.initialize\(\)/);
  assert.match(controllerText, /client\.contextRecordReview\(/);
  assert.match(controllerText, /client\.contextClaimReview\(/);
  assert.match(apiText, /contextRecordReview\(recordId/);
  assert.match(apiText, /contextClaimReview\(claimId/);
  assert.doesNotMatch(controllerText, /\bfetch\s*\(/);
});

test("2. no hard-coded fallback review data is present", () => {
  assert.doesNotMatch(
    controllerText,
    /fallback(?:Claims|Records|Evidence|Data)\s*=/i,
  );
  assert.doesNotMatch(controllerText, /ctx-claim-high-water/);
  assert.match(
    controllerText,
    /No fallback claims are displayed\./,
  );
});

test("3. URL state supports record, claim, version, and context", () => {
  assert.deepEqual(
    review.parseUrlState(
      "?record=ctx-event&claim=ctx-claim&version=ctx-v1&from=record",
    ),
    {
      valid: true,
      record: "ctx-event",
      claim: "ctx-claim",
      version: "ctx-v1",
      from: "record",
    },
  );
  assert.equal(
    review.parseUrlState("?record=ctx-event").valid,
    true,
  );
  assert.equal(
    review.parseUrlState("?claim=ctx-claim").valid,
    true,
  );
  assert.equal(
    review.parseUrlState("?version=ctx-v1").code,
    "MISSING_REVIEW_TARGET",
  );
  assert.equal(
    review.parseUrlState("?record=ctx-event&version=ctx-v1").code,
    "VERSION_REQUIRES_CLAIM",
  );
  assert.equal(
    review.reviewHref(
      "ctx-event",
      "ctx-claim",
      "ctx-v1",
      "record",
    ),
    "history-context-review-v1.html?record=ctx-event&claim=ctx-claim&version=ctx-v1&from=record",
  );
});

test("4. current, historical, and uncertain current-pointer states are distinct", () => {
  assert.match(controllerText, /Historical version/);
  assert.match(controllerText, /Current wording/);
  assert.match(controllerText, /Current claim statement/);
  assert.match(controllerText, /current-pointer-missing/);
  assert.match(
    controllerText,
    /Return to current wording/,
  );
  assert.match(reviewCssText, /data-state="historical"/);
  assert.match(reviewCssText, /data-state="current"/);
});

test("5. provenance and supporting evidence use different labels", () => {
  assert.match(controllerText, /Claim provenance/);
  assert.match(controllerText, /Field provenance/);
  assert.match(controllerText, /Supporting/);
  assert.match(
    controllerText,
    /Evidence about the claim is reviewed separately below\./,
  );
  assert.match(
    controllerText,
    /It is not automatically evidence/,
  );
});

test("6. supporting and disputing evidence stay in separate groups", () => {
  const grouped = review.groupBy(
    [
      { id: "support-1", supportRole: "supports" },
      { id: "dispute-1", supportRole: "disputes" },
      { id: "legacy-1" },
    ],
    "supportRole",
    "legacy_unclassified",
  );
  assert.deepEqual(
    review.orderedKeys(grouped, review.EVIDENCE_ORDER),
    ["supports", "disputes", "legacy_unclassified"],
  );
  assert.equal(grouped.supports[0].id, "support-1");
  assert.equal(grouped.disputes[0].id, "dispute-1");
  assert.match(controllerText, /supports: "Supporting"/);
  assert.match(controllerText, /disputes: "Disputing"/);
});

test("7. retraction and supersession are presented as lineage, not deletion", () => {
  assert.ok(review.RELATION_ORDER.includes("retracts"));
  assert.ok(review.RELATION_ORDER.includes("supersedes"));
  assert.match(
    controllerText,
    /retraction, supersession, and restoration remain visible/,
  );
  assert.match(
    controllerText,
    /historical wording is never presented as current/,
  );
  assert.doesNotMatch(
    reviewPageText,
    />\s*(?:Delete|Retract|Supersede)\s*</i,
  );
});

test("8. missing version history has explicit honest empty states", () => {
  assert.match(controllerText, /Current legacy projection/);
  assert.match(
    controllerText,
    /No recorded immutable version history is available/,
  );
  assert.match(controllerText, /no version was fabricated/i);
  assert.match(
    controllerText,
    /no support or dispute role was inferred/i,
  );
});

test("9. loading, empty, offline, not-found, and malformed states are handled", () => {
  assert.match(controllerText, /"loading"/);
  assert.match(controllerText, /renderNoClaims/);
  assert.equal(
    review.errorDisplay({
      message: "missing",
      details: { code: "CONTEXT_REVIEW_CLAIM_NOT_FOUND" },
    }).kind,
    "not-found",
  );
  assert.equal(
    review.errorDisplay({
      details: { code: "MALFORMED_RESPONSE" },
    }).kind,
    "unexpected-response",
  );
  assert.equal(review.errorDisplay(new Error("offline")).kind, "offline");
  assert.equal(
    review.parseUrlState("?claim=bad%20id").code,
    "MALFORMED_REVIEW_TARGET",
  );
});

test("10. external URL protocol validation allows only HTTP and HTTPS", () => {
  const sandbox = {
    window: {},
    URL,
    URLSearchParams,
    Map,
    Set,
    Node: function Node() {},
    CustomEvent: function CustomEvent() {},
  };
  vm.runInNewContext(sharedText, sandbox);
  const safeExternalUrl =
    sandbox.window.HistoryRootShared.safeExternalUrl;
  assert.equal(
    safeExternalUrl("javascript:alert(1)"),
    "",
  );
  assert.equal(safeExternalUrl("file:///private.txt"), "");
  assert.equal(
    safeExternalUrl("https://example.test/source"),
    "https://example.test/source",
  );
  assert.equal(
    safeExternalUrl("http://example.test/source"),
    "http://example.test/source",
  );
  assert.match(controllerText, /ui\.externalLink\(/);
});

test("11. untrusted content is rendered through textContent helpers", () => {
  assert.match(sharedText, /node\.textContent = clean\(settings\.text\)/);
  assert.match(
    sharedText,
    /document\.createTextNode\(String\(child\)\)/,
  );
  assert.doesNotMatch(controllerText, /\.innerHTML\s*=/);
  assert.doesNotMatch(sharedText, /\.innerHTML\s*=/);
  assert.match(
    sharedText,
    /rel: "noopener noreferrer"/,
  );
});

test("12. stale requests cannot overwrite the current selection", () => {
  assert.match(controllerText, /new AbortController\(\)/);
  assert.match(controllerText, /activeRequest\.abort\(\)/);
  assert.ok(
    (controllerText.match(/run !== navigationRun/g) || []).length
      >= 4,
  );
  assert.match(controllerText, /global\.addEventListener\("popstate"/);
});

test("13. responsive and accessible landmarks and controls exist", () => {
  assert.match(reviewPageText, /<main\b[^>]*id="main-content"/);
  assert.match(reviewPageText, /<nav\b[^>]*aria-label=/);
  assert.match(reviewPageText, /<aside\b[^>]*aria-labelledby=/);
  assert.match(reviewPageText, /<label for="historyrootContextClaimFilter"/);
  assert.match(reviewPageText, /aria-live="polite"/);
  assert.match(reviewPageText, /tabindex="-1"/);
  assert.match(reviewPageText, /<button\b[^>]*type="button"/);
  assert.match(reviewCssText, /:focus-visible/);
  assert.match(reviewCssText, /@media \(max-width: 900px\)/);
  assert.match(reviewCssText, /@media \(max-width: 560px\)/);
});

test("14. HistoryRoot integration preserves record and origin context", () => {
  assert.match(
    recordPageText,
    /id="historyrootRecordContextReviewLink"[^>]*hidden/,
  );
  assert.match(
    recordText,
    /contextReviewLink\.hidden = claims\.length === 0/,
  );
  assert.match(
    recordText,
    /ui\.contextReviewHref\([\s\S]*subjectId,[\s\S]*claims\[0\]\.id,[\s\S]*"record"/,
  );
  assert.match(
    sharedText,
    /function contextReviewHref\(recordId, claimId, versionId, from\)/,
  );
});

test("15. existing HistoryRoot navigation and branding remain intact", () => {
  assert.match(
    reviewPageText,
    /dictionaryroot-brand\.css/,
  );
  assert.match(reviewPageText, /historyroot\.css/);
  assert.match(sharedText, /const NAV_ITEMS = \[/);
  assert.match(
    sharedText,
    /"history-context-review-v1\.html": "context-review"/,
  );
  assert.match(controllerText, /ui\.initialize\(\)/);
  assert.doesNotMatch(
    recordPageText,
    /id="historyrootRecordGraphLink"[^>]*hidden/,
  );
  assert.doesNotMatch(
    recordPageText,
    /id="historyrootRecordTimelineLink"[^>]*hidden/,
  );
});
