import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  buildExpansionInventory,
  buildQualityReview,
  renderQualityReviewMarkdown,
  type ExpansionInventory,
  type QualityReview,
} from "../src/historyroot/corpus-quality-review.js";
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

const app = createApp();
const dataRoot = new URL(
  "../data/historyroot-corpus-expansion-quality-v1/",
  import.meta.url,
);
const baselineRoot = new URL(
  "../data/historyroot-foundational-corpus-v1/",
  import.meta.url,
);
const acceptedWorkspaceUrl = new URL(
  "../data/source-preparation-workflow-v1/lossless-context-workspace.json",
  import.meta.url,
);
const goldenWorkspaceUrl = new URL(
  "../data/source-preparation-workflow-v1/golden-workspace.json",
  import.meta.url,
);

let workspaceBytes: Buffer;
let bundleBytes: Buffer;
let inventoryBytes: Buffer;
let qualityJsonBytes: Buffer;
let qualityMarkdownBytes: Buffer;
let workspace: SourcePreparationWorkspaceV1_1;
let bundle: SourceRootBundle;
let inventory: ExpansionInventory;
let quality: QualityReview;
let baselineInventory: Record<string, unknown>;

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function contextArray(name: string): Array<Record<string, unknown>> {
  const value = (bundle.context as unknown as Record<string, unknown>)[name];
  return Array.isArray(value) as boolean
    ? value as Array<Record<string, unknown>>
    : [];
}

function ids(name: string): Set<string> {
  return new Set(
    contextArray(name).map((item) => String(item.id ?? "")),
  );
}

function database() {
  const pool = getPool();
  if (!pool) throw new Error("Chunk 8 tests require DATABASE_URL.");
  return pool;
}

function changedFiles(): string[] {
  return execFileSync(
    "git",
    ["diff", "--name-only", "95b90865abf21cefefc5c608d778327737e997ac"],
    { cwd: new URL("../..", import.meta.url), encoding: "utf8" },
  ).split(/\r?\n/).filter(Boolean).map((item) => item.replaceAll("\\", "/"));
}

before(async () => {
  const [
    workspaceData,
    bundleData,
    inventoryData,
    qualityData,
    markdownData,
    baselineData,
  ] = await Promise.all([
    readFile(new URL("expansion-workspace.json", dataRoot)),
    readFile(new URL(
      "historyroot-corpus-expansion-quality-v1.bundle.json",
      dataRoot,
    )),
    readFile(new URL("corpus-inventory.json", dataRoot)),
    readFile(new URL("quality-review.json", dataRoot)),
    readFile(new URL("quality-review.md", dataRoot)),
    readFile(new URL("corpus-inventory.json", baselineRoot), "utf8"),
  ]);
  workspaceBytes = workspaceData;
  bundleBytes = bundleData;
  inventoryBytes = inventoryData;
  qualityJsonBytes = qualityData;
  qualityMarkdownBytes = markdownData;
  workspace = JSON.parse(workspaceBytes.toString("utf8"));
  bundle = JSON.parse(bundleBytes.toString("utf8"));
  inventory = JSON.parse(inventoryBytes.toString("utf8"));
  quality = JSON.parse(qualityJsonBytes.toString("utf8"));
  baselineInventory = JSON.parse(baselineData);
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("1. feasibility evidence exceeds every mandatory minimum", () => {
  assert.ok(Number(inventory.deltaFromSelectedChunk6.records) >= 5);
  assert.ok(Number(inventory.deltaFromSelectedChunk6.claims) >= 10);
  assert.ok(Number(inventory.deltaFromSelectedChunk6.sources) >= 3);
  assert.ok(Number(inventory.deltaFromSelectedChunk6.locators) >= 5);
  assert.ok(Number(inventory.deltaFromSelectedChunk6.fieldProvenance) >= 5);
});
test("2. workspace schema is exactly 1.1.0", () =>
  assert.equal(workspace.schemaVersion, "1.1.0"));
test("3. workspace validates through accepted v1.1", () =>
  assert.equal(
    validateSourcePreparationWorkspace(workspace, "validate").report.issues
      .length,
    0,
  ));
test("4. every non-omitted object is approved", () =>
  assert.equal(inventory.preparationStatusCounts.approved,
    Object.values(inventory.counts).reduce((a, b) => a + b, 0)));
test("5. no draft object leaks", () =>
  assert.equal(inventory.preparationStatusCounts.draft ?? 0, 0));
test("6. no needs-review object leaks", () =>
  assert.equal(inventory.preparationStatusCounts.needs_review ?? 0, 0));
test("7. every omitted candidate has a reason", () =>
  assert.ok(inventory.omittedCandidates.every((item) => item.reason)));
test("8. rights classifications are complete", () =>
  assert.equal(
    Object.values(inventory.rightsClassificationCounts)
      .reduce((a, b) => a + b, 0),
    inventory.counts.sources,
  ));
test("9. rights basis and content use validate", () =>
  assert.equal(
    validateSourcePreparationWorkspace(workspace, "generate").report.issues
      .filter((item) => item.category === "rights").length,
    0,
  ));
test("10. source and edition distinctions survive", () =>
  assert.ok(workspace.sourceSet.every((item) =>
    Boolean(item.sourceIdentityReview.identityKind))));
test("11. exact accepted locator strings are retained", () =>
  assert.equal(inventory.counts.locators, 49));
test("12. every reviewed claim has field provenance", () =>
  assert.equal(quality.provenanceCoverage.claimsWithFieldProvenance, 49));
test("13. historical names retain source provenance", () =>
  assert.equal(inventory.counts.historicalNames, 15));
test("14. date uncertainty remains structured", () =>
  assert.equal(inventory.counts.dateExpressions, 46));
test("15. evidence roles remain accepted and explicit", () =>
  assert.equal(Object.values(inventory.evidenceRoleCounts)
    .reduce((a, b) => a + b, 0), 25));
test("16. qualifying evidence remains distinct", () =>
  assert.ok((inventory.evidenceRoleCounts.qualifies ?? 0) > 0));
test("17. claim attribution dependencies resolve", () =>
  assert.equal(inventory.counts.claimAttributions, 49));
test("18. all six contextual collection families are preserved", () =>
  assert.deepEqual(quality.contextualCollectionCoverage, {
    claimAttributions: 49,
    interpretations: 12,
    perspectives: 10,
    perspectiveLinks: 18,
    causalLinks: 18,
    culturalMemories: 6,
  }));
test("19. preparation-only metadata does not leak", () =>
  assert.doesNotMatch(bundleBytes.toString("utf8"), /reviewerNotes|approvalRecord|preparationStatus/));
test("20. existing canonical IDs remain stable", () =>
  assert.ok(ids("entities").has("historyroot-plymouth-person-metacom")));
test("21. no artificial version is created", () => {
  assert.equal(contextArray("claimVersions").length, 0);
  assert.equal(contextArray("evidenceVersions").length, 0);
});
test("22. accepted Chunk 6 bundle bytes remain unchanged", async () =>
  assert.equal(
    sha256(await readFile(new URL(
      "historyroot-foundational-corpus-v1.bundle.json",
      baselineRoot,
    ))),
    "D0A69E3501D8419A6B4EDA77515A7AE290C1ED2314F64074DE46931857492B6F",
  ));
test("23. accepted golden workspace remains unchanged", async () =>
  assert.equal(
    sha256(await readFile(goldenWorkspaceUrl)),
    "116D4D490D86FDCDA352575ED3DDE439A052BF0EE566118343AF74DD9F5142BD",
  ));
test("24. accepted v1.1 lossless workspace remains unchanged", async () =>
  assert.equal(
    sha256(await readFile(acceptedWorkspaceUrl)),
    "806BFD14348D570FDF8B7EB84820D1E722155FDDD8A9B2913B808B6AD60B21E3",
  ));
test("25. inventory IDs match generated bundle IDs", () =>
  assert.equal((inventory.ids.claims ?? []).length,
    contextArray("claims").length));
test("26. inventory counts match generated bundle counts", () =>
  assert.equal(inventory.counts.records, contextArray("entities").length));
test("27. inventory deltas match selected Chunk 6 inventory", () =>
  assert.equal(
    Number(inventory.counts.claims)
      - Number((baselineInventory.counts as Record<string, number>).claims),
    inventory.deltaFromSelectedChunk6.claims,
  ));
test("28. inventory rights counts match workspace rights metadata", () =>
  assert.equal(Object.values(inventory.rightsClassificationCounts)
    .reduce((a, b) => a + b, 0), workspace.sourceSet.length));
test("29. inventory evidence-role counts match generated bundle", () =>
  assert.equal(Object.values(inventory.evidenceRoleCounts)
    .reduce((a, b) => a + b, 0), contextArray("evidenceClaimLinks").length));
test("30. newly promoted IDs are correct", () =>
  assert.equal((inventory.newlyPromotedObjectIds.claims ?? []).length, 24));
test("31. dependency-only IDs are correct", () =>
  assert.ok(inventory.dependencyOnlyObjectIds.length >= 49));
test("32. omitted candidate IDs and reasons are deterministic", () =>
  assert.deepEqual(inventory.omittedCandidates, []));
test("33. quality JSON is deterministic", () => {
  const regeneratedInventory = buildExpansionInventory({
    workspace,
    workspaceBytes,
    bundle,
    bundleBytes,
    baselineInventory,
  });
  const regenerated = buildQualityReview({
    workspace,
    bundle,
    inventory: regeneratedInventory,
  });
  assert.deepEqual(regenerated, quality);
});
test("34. quality Markdown is deterministic", () =>
  assert.equal(renderQualityReviewMarkdown(quality),
    qualityMarkdownBytes.toString("utf8")));
test("35. no composite score exists", () =>
  assert.doesNotMatch(qualityJsonBytes.toString("utf8"),
    /truthScore|reliabilityScore|credibilityPercentage|confidencePercentage|compositeQualityScore/i));
test("36. finding IDs are deterministic", () =>
  assert.equal(new Set(quality.findings.map((item) => item.findingId)).size,
    quality.findings.length));
test("37. structural blockers prevent release", () => {
  const badBundle = structuredClone(bundle);
  badBundle.context!.claims![0]!.subjectId = "missing-subject";
  const badInventory = { ...inventory };
  const badReview = buildQualityReview({
    workspace,
    bundle: badBundle,
    inventory: badInventory,
  });
  assert.ok(badReview.findingCounts.blocker > 0);
});
test("38. review findings do not mutate corpus content", () =>
  assert.equal(sha256(bundleBytes), inventory.bundle.sha256));
test("39. duplicate IDs are detected", () => {
  const bad = structuredClone(bundle);
  bad.context!.entities!.push(structuredClone(bad.context!.entities![0]!));
  assert.ok(buildQualityReview({ workspace, bundle: bad, inventory })
    .findings.some((item) => item.ruleId === "DUPLICATE-CANONICAL-ID"));
});
test("40. orphan records are detected", () =>
  assert.equal(typeof quality.orphanCounts.records, "number"));
test("41. orphan sources are detected", () =>
  assert.equal(typeof quality.orphanCounts.sources, "number"));
test("42. orphan accounts are detected", () =>
  assert.equal(typeof quality.orphanCounts.accounts, "number"));
test("43. missing locators are reported", () =>
  assert.deepEqual(quality.locatorCoverage.claimsMissingStructuredLocator, []));
test("44. missing provenance is reported", () =>
  assert.equal(quality.provenanceCoverage.claimsWithFieldProvenance,
    quality.provenanceCoverage.claims));
test("45. rights and use conflicts are blockers", () => {
  const bad = structuredClone(workspace);
  bad.sourceSet[0]!.rightsReview.classification = "restricted";
  bad.sourceSet[0]!.contentUse.containsCopiedExcerpt = true;
  assert.ok(buildQualityReview({ workspace: bad, bundle, inventory })
    .findings.some((item) => item.ruleId === "RIGHTS-USE-CONFLICT"
      && item.level === "blocker"));
});
test("46. unapproved object leakage is a blocker", () => {
  const bad = structuredClone(workspace);
  bad.claims[0]!.preparationStatus = "needs_review";
  assert.ok(buildQualityReview({ workspace: bad, bundle, inventory })
    .findings.some((item) => item.ruleId === "UNAPPROVED-OBJECT-LEAKAGE"));
});
test("47. artificial versions are blockers", () =>
  assert.equal(quality.versionHistoryReview.artificialVersions, 0));
test("48. source-lineage concentration is reported without scoring", () =>
  assert.ok(quality.findings.some((item) =>
    item.ruleId === "SOURCE-LINEAGE-CONCENTRATION")));
test("49. single reporting lineages are reported", () =>
  assert.ok(quality.findings.some((item) =>
    item.ruleId === "SINGLE-REPORTING-LINEAGE")));
test("50. qualifying and disputing evidence remain distinct", () =>
  assert.ok((quality.evidenceRoleDistribution.qualifies ?? 0) > 0));
test("51. claim-attribution dependency count is complete", () =>
  assert.equal(inventory.counts.claimAttributions, inventory.counts.claims));
test("52. interpretation dependencies remain complete", () =>
  assert.equal(inventory.counts.interpretations, 12));
test("53. perspective dependencies remain complete", () =>
  assert.equal(inventory.counts.perspectives, 10));
test("54. causal-link endpoints remain complete", () =>
  assert.equal(inventory.counts.causalLinks, 18));
test("55. cultural-memory dependencies remain complete", () =>
  assert.equal(inventory.counts.culturalMemories, 6));
test("56. expanded bundle imports through the existing importer", async () =>
  saveImportedBundle(bundle));
test("57. second import is duplicate-safe", async () => {
  await saveImportedBundle(bundle);
  const result = await database().query(
    "SELECT COUNT(*)::int AS count FROM imported_bundles WHERE bundle_id = $1",
    [bundle.bundleId],
  );
  assert.equal(result.rows[0]?.count, 1);
});
test("58. replacement-safe behavior remains intact", async () => {
  const result = await database().query(
    "SELECT COUNT(*)::int AS count FROM context_records WHERE bundle_id = $1",
    [bundle.bundleId],
  );
  assert.ok(result.rows[0]?.count > 0);
});
test("59. all six contextual families survive replacement import", async () => {
  const result = await database().query(
    `SELECT
      (SELECT COUNT(*)::int FROM context_claim_attributions WHERE bundle_id=$1) attributions,
      (SELECT COUNT(*)::int FROM context_interpretations) interpretations,
      (SELECT COUNT(*)::int FROM context_perspectives) perspectives,
      (SELECT COUNT(*)::int FROM context_record_perspectives) perspective_links,
      (SELECT COUNT(*)::int FROM context_causal_links) causal_links,
      (SELECT COUNT(*)::int FROM context_cultural_memories) cultural_memories`,
    [bundle.bundleId],
  );
  assert.deepEqual(result.rows[0], {
    attributions: 49,
    interpretations: 12,
    perspectives: 10,
    perspective_links: 18,
    causal_links: 18,
    cultural_memories: 6,
  });
});
test("60. newly promoted records resolve through search", async () => {
  const response = await request(app).get("/api/v1/search")
    .query({ q: "Metacom", domain: "HistoryRoot", limit: 100 }).expect(200);
  assert.ok(response.body.results.some((item: { id: string }) =>
    item.id === "historyroot-plymouth-person-metacom"));
});
test("61. newly promoted claims resolve through search", async () => {
  const response = await request(app).get("/api/v1/search")
    .query({ q: "colonial land expansion", type: "context-claim", limit: 100 })
    .expect(200);
  assert.ok(response.body.results.some((item: { id: string }) =>
    item.id === "historyroot-plymouth-claim-war-multiple-causes"));
});
test("62. three newly promoted claims resolve through Context Review", async () => {
  for (const claimId of [
    "historyroot-plymouth-claim-war-multiple-causes",
    "historyroot-plymouth-claim-rock-later-tradition",
    "historyroot-plymouth-claim-wampanoag-continuity",
  ]) {
    await request(app).get(`/api/v1/context/review/claims/${claimId}`)
      .expect(200);
  }
});
test("63. exact locators resolve correctly", async () => {
  const claimId = "historyroot-plymouth-claim-war-multiple-causes";
  const response = await request(app)
    .get(`/api/v1/context/review/claims/${claimId}`).expect(200);
  assert.ok(JSON.stringify(response.body).includes(
    "NPS King Philip's War paragraphs 50-54",
  ));
});
test("64. existing Chunk 6 foundational content remains available", async () => {
  await request(app)
    .get("/api/v1/context/review/claims/historyroot-plymouth-claim-agreement-terms")
    .expect(200);
});
test("65. DictionaryRoot remains unaffected", async () => {
  const response = await request(app).get("/api/v1/search")
    .query({ q: "record", domain: "DictionaryRoot", limit: 5 }).expect(200);
  assert.ok(Array.isArray(response.body.results));
});
test("66. sourceroot_test ends in the documented Chunk 8 state", async () => {
  const result = await database().query(
    "SELECT version FROM imported_bundles WHERE bundle_id=$1",
    [bundle.bundleId],
  );
  assert.equal(result.rows[0]?.version, "1.2.0");
});
test("67. migration 013 does not exist", () =>
  assert.ok(!changedFiles().some((item) =>
    /backend\/db\/migrations\/013/i.test(item))));
test("68. no API route changes occur", () =>
  assert.ok(!changedFiles().some((item) =>
    item.startsWith("backend/src/routes/"))));
test("69. no frontend source changes occur", () =>
  assert.ok(!changedFiles().some((item) =>
    /^(assets\/|.*\.html$)/.test(item))));
test("70. importer implementation does not change", () =>
  assert.ok(!changedFiles().some((item) =>
    item === "backend/src/services/import-store.ts")));
test("71. v1.1 workflow implementation does not change", () =>
  assert.ok(!changedFiles().some((item) =>
    item.startsWith("backend/src/source-preparation/"))));
test("72. no AI OCR scraper or network research code is added", () => {
  const text = [
    workspaceBytes,
    qualityJsonBytes,
    qualityMarkdownBytes,
  ].map((item) => item.toString("utf8")).join("\n");
  assert.doesNotMatch(text, /openai|scrap(e|er|ing)|\bocr\b|web research/i);
});
test("73. root-stage lifecycle scope remains enforced", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../../ROOT-MANIFEST.json", import.meta.url),
    "utf8",
  ));
  if (manifest.active_stage.status === "active") {
    assert.equal(
      manifest.active_stage.slug,
      "SOURCEROOT-HISTORYROOT-CORPUS-EXPANSION-QUALITY-V1",
    );
    assert.ok(manifest.active_stage.allowed_files.includes(
      "backend/test/historyroot-corpus-expansion-quality.test.ts",
    ));
  } else {
    assert.equal(manifest.active_stage.status, "inactive");
    assert.equal(manifest.active_stage.slug, "");
    assert.deepEqual(manifest.active_stage.allowed_files, []);
  }
});
