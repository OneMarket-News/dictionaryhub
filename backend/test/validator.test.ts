import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateBundle } from "../src/services/validator.js";

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

test("HistoryRoot fixture returns zero errors and zero warnings", async () => {
  const result = validateBundle(await fixture("historyroot-valid.json"));
  assert.equal(result.status, "ready");
  assert.equal(result.canImport, true);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
  assert.deepEqual(result.summary, {
    nodes: 11,
    assertions: 13,
    edges: 11,
    sources: 11,
    revisions: 2,
    errors: 0,
    warnings: 0
  });
});

test("broken fixture is blocked and reports reference and duplicate errors", async () => {
  const result = validateBundle(await fixture("broken-bundle.json"));
  assert.equal(result.status, "blocked");
  assert.equal(result.canImport, false);
  assert.ok(result.errors.some(item => item.code === "DUPLICATE_NODE_ID"));
  assert.ok(result.errors.some(item => item.code === "ASSERTION_NODE_NOT_FOUND"));
  assert.ok(result.errors.some(item => item.code === "EDGE_NODE_NOT_FOUND"));
  assert.ok(result.warnings.some(item => item.code === "INVALID_CREDIBILITY_TIER"));
});

test("non-object input returns invalid-format", () => {
  const result = validateBundle(null);
  assert.equal(result.status, "invalid-format");
  assert.equal(result.canImport, false);
  assert.equal(result.errors[0]?.code, "INVALID_JSON");
});
