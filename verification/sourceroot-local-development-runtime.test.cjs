const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const component = read("assets/js/sourceroot-root-switcher.js");
const health = read("backend/src/routes/health.ts");
const runtime = read("backend/src/scripts/development-runtime.ts");
const packageJson = JSON.parse(read("backend/package.json"));

test("1. package scripts expose explicit provision and read-only status commands", () => {
  assert.equal(packageJson.scripts["dev:provision"], "node --env-file=.env --import ./scripts/register-tsx.mjs src/scripts/development-runtime.ts provision");
  assert.equal(packageJson.scripts["dev:status"], "node --env-file=.env --import ./scripts/register-tsx.mjs src/scripts/development-runtime.ts status");
  assert.notEqual(packageJson.scripts.dev, packageJson.scripts["dev:provision"]);
});

test("2. readiness API is narrow, read-only, and versioned", () => {
  assert.match(health, /get\("\/api\/v1\/runtime-readiness"/);
  assert.match(runtime, /command: "dev:status"/);
  assert.doesNotMatch(health, /post\("\/api\/v1\/runtime-readiness"/i);
});

test("3. Root switcher derives status from runtime readiness", () => {
  assert.match(component, /SourceRootApiLayer\.request\(runtimeReadinessUrl\(\)/);
  assert.match(component, /state === "ready"/);
  assert.match(component, /Awaiting provisioned data/);
  assert.match(component, /Readiness unavailable/);
  assert.doesNotMatch(component, /"Active"/);
});

test("4. readiness is accessible and does not hide Root destinations", () => {
  assert.match(component, /aria-live", "polite"/);
  assert.match(component, /filter\(\(destination\) => destination\.available\)/);
  assert.match(component, /destination\.destinationType === "root"/);
});

test("5. provisioning validates before importing and reports all outcomes", () => {
  assert.ok(runtime.indexOf("await validateDevelopmentDatasets()") < runtime.indexOf("await saveDictionaryRootCoreLexicalCorpus"));
  for (const marker of ["imported:", "updated:", "skipped:", "failed:"]) {
    assert.ok(runtime.includes(marker), marker);
  }
  assert.match(runtime, /HistoryRoot data changed during local development provisioning/);
});

test("6. no Translation Comparison or automatic startup hook is introduced", () => {
  assert.doesNotMatch(runtime, /translation.?comparison/i);
  assert.equal(packageJson.scripts.dev, "tsx watch src/server.ts");
});
