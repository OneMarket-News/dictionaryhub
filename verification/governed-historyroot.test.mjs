import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const pages = [
  "history-governance-v1.html",
  "history-review-queue-v1.html",
  "history-proposal-v1.html",
  "history-review-v1.html",
  "history-revisions-v1.html",
];

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("all governance pages have responsive metadata and one H1", async () => {
  for (const page of pages) {
    const html = await text(page);
    assert.match(html, /name="viewport"/);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, page);
    assert.match(html, /historyroot-governance\.css/);
    assert.match(html, /historyroot-governance\.js/);
  }
});

test("governance pages use unique HTML identifiers", async () => {
  for (const page of pages) {
    const html = await text(page);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, page);
  }
});

test("forms retain explicit accessible labels", async () => {
  for (const page of [
    "history-governance-v1.html",
    "history-review-queue-v1.html",
    "history-proposal-v1.html",
    "history-review-v1.html",
  ]) {
    const html = await text(page);
    for (const match of html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
      const id = match[1];
      if (match[0].includes("hidden")) continue;
      assert.match(html, new RegExp(`<label[^>]+for="${id}"`), `${page}: ${id}`);
    }
  }
});

test("dynamic governance rendering does not use unsafe HTML insertion", async () => {
  const javascript = await text("assets/js/historyroot-governance.js");
  assert.doesNotMatch(javascript, /\.innerHTML\s*=/);
  assert.doesNotMatch(javascript, /insertAdjacentHTML/);
  assert.match(javascript, /textContent/);
  assert.match(javascript, /createTextNode|HistoryRootShared/);
});

test("public governance entry is permission-aware", async () => {
  const javascript = await text("assets/js/historyroot-governance-entry.js");
  assert.match(javascript, /auth\.hasPermission\("revision\.create"\)/);
  assert.match(javascript, /proposal\.hidden = false/);
  assert.match(javascript, /Public record reading remains independent/);
});

test("queue URL state covers workflow filters and natural form navigation", async () => {
  const javascript = await text("assets/js/historyroot-governance.js");
  assert.match(javascript, /new URLSearchParams\(global\.location\.search\)/);
  assert.match(javascript, /warningStatus/);
  assert.match(javascript, /targetType/);
  assert.match(javascript, /global\.location\.assign/);
});

test("structured field definitions cover every governed historical type", async () => {
  const javascript = await text("assets/js/historyroot-governance.js");
  for (const type of [
    "entity", "temporal_assertion", "account", "claim", "evidence",
    "source", "relationship", "interpretation", "perspective",
    "causal_link", "cultural_memory",
  ]) {
    assert.match(javascript, new RegExp(`${type}:\\s*\\[`), type);
  }
});

test("diffs identify sides, removals, additions, and high-risk fields without color alone", async () => {
  const javascript = await text("assets/js/historyroot-governance.js");
  assert.match(javascript, /dataset\.side = "current"/);
  assert.match(javascript, /dataset\.side = "proposed"/);
  assert.match(javascript, /dataset\.change = "removed"/);
  assert.match(javascript, /dataset\.change = "added"/);
  assert.match(javascript, /HIGH_RISK_FIELDS/);
  const css = await text("assets/css/historyroot-governance.css");
  assert.match(css, /content: "Current"/);
  assert.match(css, /content: "Proposed"/);
});

test("workflow controls follow actual states and permissions", async () => {
  const javascript = await text("assets/js/historyroot-governance.js");
  assert.match(javascript, /revision\.submit/);
  assert.match(javascript, /revision\.review/);
  assert.match(javascript, /revision\.publish/);
  assert.match(javascript, /"changes_requested"/);
  assert.match(javascript, /node\("dialog", "hrg-dialog"\)/);
  assert.match(javascript, /dialog\.showModal\(\)/);
  assert.doesNotMatch(javascript, /global\.(?:confirm|prompt)/);
  assert.match(javascript, /Rollback reason/);
});

test("mobile governance layouts stack complex diffs and actions", async () => {
  const css = await text("assets/css/historyroot-governance.css");
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /\.hrg-diff\s*\{\s*grid-template-columns: 1fr;/s);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /\.hrg-button\s*\{\s*flex: 1 1 100%;/s);
});

test("keyboard focus and reduced motion receive explicit treatment", async () => {
  const css = await text("assets/css/historyroot-governance.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("revision history queries only published generic revisions", async () => {
  const javascript = await text("assets/js/historyroot-governance.js");
  assert.match(javascript, /status: "published"/);
  assert.match(javascript, /\/revisions\?/);
  assert.doesNotMatch(javascript, /\/audit/);
});

test("public record retains revision history and gates correction entry", async () => {
  const html = await text("history-record-v1.html");
  assert.match(html, /historyrootRecordRevisionLink/);
  assert.match(html, /historyrootRecordProposalLink[^>]+hidden/);
  assert.match(html, /historyroot-governance-entry\.js/);
});
