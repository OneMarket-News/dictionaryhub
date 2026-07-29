import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { getPool } from "../src/lib/database.js";
import { saveImportedBundle } from "../src/services/import-store.js";
import {
  validateSourcePreparationWorkspace,
} from "../src/source-preparation/source-preparation-engine.js";
import type {
  SourcePreparationWorkspaceV1_1,
} from "../src/source-preparation/source-preparation-types.js";
import { validateBundle } from "../src/services/validator.js";
import type { SourceRootBundle } from "../src/types.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

type JsonObject = Record<string, unknown>;

const app = createApp();
const dataRoot = new URL(
  "../data/historyroot-wampanoag-regional-corpus-v1/",
  import.meta.url,
);
let workspace: SourcePreparationWorkspaceV1_1;
let bundle: SourceRootBundle;
let inventory: JsonObject;
let quality: JsonObject;

function context(name: string): JsonObject[] {
  const value = (bundle.context as unknown as JsonObject)[name];
  return Array.isArray(value) ? value as JsonObject[] : [];
}

function changedFiles(): string[] {
  return execFileSync(
    "git",
    ["diff", "--name-only", "7890995eafdb031230439c6f97750274273711ab"],
    { cwd: new URL("../..", import.meta.url), encoding: "utf8" },
  ).split(/\r?\n/).filter(Boolean).map((value) => value.replaceAll("\\", "/"));
}

function database() {
  const pool = getPool();
  if (!pool) throw new Error("Chunk 9 tests require DATABASE_URL.");
  return pool;
}

before(async () => {
  const [workspaceText, bundleText, inventoryText, qualityText] =
    await Promise.all([
      readFile(new URL("expansion-workspace.json", dataRoot), "utf8"),
      readFile(new URL(
        "historyroot-wampanoag-regional-corpus-v1.bundle.json",
        dataRoot,
      ), "utf8"),
      readFile(new URL("corpus-inventory.json", dataRoot), "utf8"),
      readFile(new URL("quality-review.json", dataRoot), "utf8"),
    ]);
  workspace = JSON.parse(workspaceText);
  bundle = JSON.parse(bundleText);
  inventory = JSON.parse(inventoryText);
  quality = JSON.parse(qualityText);
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("1. canonical dataset identity is preserved at 1.3.0", () => {
  assert.equal(bundle.bundleId, "historyroot-plymouth-knowledge-dataset-v1");
  assert.equal(bundle.version, "1.3.0");
});
test("2. workspace schema is exactly 1.1.0", () =>
  assert.equal(workspace.schemaVersion, "1.1.0"));
test("3. workspace validates without issues", () =>
  assert.deepEqual(
    validateSourcePreparationWorkspace(workspace, "generate").report.issues,
    [],
  ));
test("4. bundle validates without warnings or errors", () => {
  const result = validateBundle(bundle);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
});
test("5. full Chunk 8 source count is preserved", () =>
  assert.equal((inventory.baselineCounts as JsonObject).sources, 20));
test("6. full Chunk 8 record count is preserved", () =>
  assert.equal((inventory.baselineCounts as JsonObject).records, 116));
test("7. full Chunk 8 claim count is preserved", () =>
  assert.equal((inventory.baselineCounts as JsonObject).claims, 49));
test("8. projected records are added", () =>
  assert.equal((inventory.additionCounts as JsonObject).records, 54));
test("9. projected claims are added", () =>
  assert.equal((inventory.additionCounts as JsonObject).claims, 28));
test("10. all accepted sources are registered", () =>
  assert.equal((inventory.additionCounts as JsonObject).sources, 20));
test("11. projected reporting accounts are added", () =>
  assert.equal((inventory.additionCounts as JsonObject).accounts, 14));
test("12. projected date expressions are added", () =>
  assert.equal((inventory.additionCounts as JsonObject).dateExpressions, 32));
test("13. projected relationships are added", () =>
  assert.equal((inventory.additionCounts as JsonObject).relationships, 48));
test("14. every new claim has a structured locator", () =>
  assert.equal((inventory.additionCounts as JsonObject).locators, 28));
test("15. claim and identity field provenance reaches projection", () =>
  assert.equal((inventory.additionCounts as JsonObject).fieldProvenance, 32));
test("16. explicit evidence links reach projection", () =>
  assert.equal((inventory.additionCounts as JsonObject).evidenceLinks, 18));
test("17. qualifying and conflicting structures reach projection", () =>
  assert.equal((inventory.additionCounts as JsonObject).claimRelations, 8));
test("18. all six contextual families expand", () => {
  const families = quality.contextualFamilyAdditions as JsonObject;
  for (const name of [
    "claimAttributions", "interpretations", "perspectives",
    "perspectiveLinks", "causalLinks", "culturalMemories",
  ]) assert.ok(Number(families[name]) > 0, name);
});
test("19. candidate category distribution is exact", () =>
  assert.deepEqual(quality.sourceCategoryDistribution, {
    accepted: 20,
    indigenousLed: 8,
    primaryOrArchival: 7,
    institutional: 14,
    archaeologicalOrScholarly: 12,
  }));
test("20. rights distribution is exact", () =>
  assert.deepEqual(quality.rightsClassifications, {
    metadata_and_link_only: 19,
    public_domain: 1,
  }));
test("21. rejected candidates are absent", () => {
  const text = JSON.stringify(workspace);
  assert.doesNotMatch(text,
    /hr9-reject-cipolla-authenticity|hr9-reject-loc-church-1860|hr9-reject-nps-wellfleet-tavern/);
});
test("22. every new claim has reporting provenance", () =>
  assert.equal((inventory.additionCounts as JsonObject).claimAttributions, 28));
test("23. every new claim has evidence", () =>
  assert.equal((inventory.additionCounts as JsonObject).evidence, 28));
test("24. evidence roles use the accepted vocabulary", () => {
  const allowed = new Set([
    "supports", "qualifies", "contextualizes", "neutral_or_background",
  ]);
  for (const entry of context("evidenceClaimLinks")
    .filter((value) => String(value.id).startsWith(
      "historyroot-wampanoag-evidence-link-"))) {
    assert.ok(allowed.has(String(entry.supportRole)));
  }
});
test("25. no duplicate contextual IDs exist", () => {
  const names = [
    "entities", "claims", "historicalAccounts", "aliases",
    "temporalAssertions", "relationships", "sourceLocators", "evidence",
    "evidenceClaimLinks", "claimRelations", "fieldProvenance",
  ];
  const values = names.flatMap((name) => context(name)
    .map((entry) => String(entry.id)));
  assert.equal(new Set(values).size, values.length);
});
test("26. no new record is orphaned", () =>
  assert.deepEqual(quality.newOrphanRecordIds, []));
test("27. no new account is orphaned", () =>
  assert.deepEqual(quality.newOrphanAccountIds, []));
test("28. eight existing record orphans gain context", () =>
  assert.equal((quality.existingOrphansConnected as unknown[]).length, 8));
test("29. one existing account orphan gains context", () =>
  assert.deepEqual(quality.existingOrphanAccountsConnected,
    ["historyroot-plymouth-account-mashpee"]));
test("30. quality review has zero blockers", () =>
  assert.equal((quality.findingCounts as JsonObject).blocker, 0));
test("31. no universal score is present", async () => {
  const text = await readFile(new URL("quality-review.json", dataRoot), "utf8");
  assert.doesNotMatch(text,
    /truthScore|reliabilityScore|credibilityPercentage|compositeQualityScore/i);
});
test("32. no unsupported territorial polygon is present", () => {
  const regionalPlaces = context("entities").filter((entry) =>
    String(entry.id).startsWith("historyroot-wampanoag-")
    && entry.entityType === "place");
  for (const place of regionalPlaces) {
    const metadata = place.metadata as JsonObject;
    assert.equal(metadata.noTerritorialPolygon, true);
    assert.equal(place.coordinates, undefined);
    assert.equal(place.geometry, undefined);
  }
});
test("33. regional bundle imports through the existing importer", async () =>
  saveImportedBundle(bundle));
test("34. duplicate reimport is safe", async () => {
  await saveImportedBundle(bundle);
  const result = await database().query(
    "SELECT COUNT(*)::int count FROM imported_bundles WHERE bundle_id=$1",
    [bundle.bundleId],
  );
  assert.equal(result.rows[0]?.count, 1);
});
test("35. search exposes Cape Cod regional records", async () => {
  const response = await request(app).get("/api/v1/search")
    .query({ q: "Mashpee Wampanoag community", domain: "HistoryRoot", limit: 50 })
    .expect(200);
  assert.ok(response.body.results.some((entry: { id: string }) =>
    entry.id === "historyroot-wampanoag-community-mashpee"));
});
test("36. search exposes Noepe regional records", async () => {
  const response = await request(app).get("/api/v1/search")
    .query({ q: "Chappaquiddick", domain: "HistoryRoot", limit: 50 })
    .expect(200);
  assert.ok(response.body.results.some((entry: { id: string }) =>
    entry.id === "historyroot-wampanoag-community-chappaquiddick"));
});
test("37. Context Review exposes a qualifying claim and locator", async () => {
  const response = await request(app).get(
    "/api/v1/context/review/claims/historyroot-wampanoag-claim-easton-differs-mather",
  ).expect(200);
  const text = JSON.stringify(response.body);
  assert.match(text, /Abstract/);
  assert.match(text, /qualif|contradict/i);
});
test("38. existing Plymouth claim remains available", async () => {
  await request(app).get(
    "/api/v1/context/review/claims/historyroot-plymouth-claim-agreement-terms",
  ).expect(200);
});
test("39. sourceroot_test ends at accepted version 1.3.0", async () => {
  const result = await database().query(
    "SELECT version FROM imported_bundles WHERE bundle_id=$1",
    [bundle.bundleId],
  );
  assert.equal(result.rows[0]?.version, "1.3.0");
});
test("40. implementation respects prohibited file boundaries", () => {
  const changed = changedFiles();
  assert.ok(!changed.some((name) => name.startsWith("assets/")
    || name.endsWith(".html")));
  assert.ok(!changed.some((name) => name.startsWith("backend/src/routes/")));
  assert.ok(!changed.some((name) =>
    name === "backend/src/services/import-store.ts"));
  assert.ok(!changed.some((name) =>
    /backend\/db\/migrations\/013/i.test(name)));
});
test("41. root stage scope is exact", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../../ROOT-MANIFEST.json", import.meta.url),
    "utf8",
  ));
  if (manifest.active_stage.status === "active") {
    assert.equal(
      manifest.active_stage.slug,
      "SOURCEROOT-HISTORYROOT-WAMPANOAG-REGIONAL-CORPUS-V1",
    );
    assert.ok(manifest.active_stage.allowed_files.includes(
      "backend/test/historyroot-wampanoag-regional-corpus.test.ts",
    ));
  } else {
    assert.equal(manifest.active_stage.status, "inactive");
  }
});
