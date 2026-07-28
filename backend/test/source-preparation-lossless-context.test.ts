import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test, { after, before } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import type { ContextualBundle } from "../src/contextual-types.js";
import { getPool } from "../src/lib/database.js";
import {
  getImportedBundle,
  saveImportedBundle,
} from "../src/services/import-store.js";
import { validateBundle } from "../src/services/validator.js";
import {
  validateSourcePreparationWorkspace,
} from "../src/source-preparation/source-preparation-engine.js";
import {
  LOSSLESS_PREPARATION_SCHEMA_VERSION,
  PREPARATION_SCHEMA_VERSION,
  type SourcePreparationWorkspace,
  type SourcePreparationWorkspaceV1_1,
} from "../src/source-preparation/source-preparation-types.js";
import type { SourceRootBundle } from "../src/types.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

const app = createApp();
const goldenUrl = new URL(
  "../data/source-preparation-workflow-v1/golden-workspace.json",
  import.meta.url,
);
const losslessUrl = new URL(
  "../data/source-preparation-workflow-v1/lossless-context-workspace.json",
  import.meta.url,
);
const acceptedUrl = new URL(
  "../data/historyroot-foundational-corpus-v1/historyroot-foundational-corpus-v1.bundle.json",
  import.meta.url,
);
const expectedGoldenWorkspaceHash =
  "116d4d490d86fdcda352575ed3dde439a052bf0ee566118343af74dd9f5142bd";
const expectedGoldenBundleHash =
  "f47d4f1f5cbc123dcaec1b07d5a6b051d3c306f488dfa81dcc353c5e7dcc8428";
const expectedLosslessWorkspaceHash =
  "806bfd14348d570fdf8b7eb84820d1e722155fddd8a9b2913b808b6ad60b21e3";
const expectedAcceptedHash =
  "d0a69e3501d8419a6b4eda77515a7ae290c1ed2314f64074de46931857492b6f";

let golden: SourcePreparationWorkspace;
let goldenBytes: Buffer;
let workspace: SourcePreparationWorkspaceV1_1;
let workspaceBytes: Buffer;
let accepted: SourceRootBundle;
let acceptedBytes: Buffer;
let generated: SourceRootBundle;
let generatedBytes: Buffer;

function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function clone(): SourcePreparationWorkspaceV1_1 {
  return structuredClone(workspace);
}

function generate(candidate: unknown = workspace) {
  return validateSourcePreparationWorkspace(candidate, "generate");
}

function codes(candidate: unknown) {
  return validateSourcePreparationWorkspace(candidate, "validate")
    .report.issues.map((item) => item.code);
}

function requireDatabase() {
  const database = getPool();
  if (!database) {
    throw new Error("Lossless-context tests require DATABASE_URL.");
  }
  return database;
}

function gitChangedPaths(): string[] {
  const result = spawnSync(
    "git",
    ["diff", "--name-only", "HEAD"],
    { cwd: new URL("../..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function context(value: SourceRootBundle): ContextualBundle {
  assert.ok(value.context);
  return value.context;
}

before(async () => {
  [goldenBytes, workspaceBytes, acceptedBytes] = await Promise.all([
    readFile(goldenUrl),
    readFile(losslessUrl),
    readFile(acceptedUrl),
  ]);
  golden = JSON.parse(
    goldenBytes.toString("utf8"),
  ) as SourcePreparationWorkspace;
  workspace = JSON.parse(
    workspaceBytes.toString("utf8"),
  ) as SourcePreparationWorkspaceV1_1;
  accepted = JSON.parse(
    acceptedBytes.toString("utf8"),
  ) as SourceRootBundle;
  const result = generate();
  assert.ok(result.bundle);
  assert.ok(result.bundleBytes);
  generated = result.bundle;
  generatedBytes = result.bundleBytes;
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL is required.");
  assert.equal(new URL(databaseUrl).pathname.replace(/^\//, ""),
    "sourceroot_test");
  await resetTestDatabase();
  await saveImportedBundle(accepted);
});

after(async () => {
  await saveImportedBundle(accepted);
  await closeTestDatabase();
});

test("1. schema 1.0.0 remains supported", () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  assert.equal(result.report.schemaVersion, PREPARATION_SCHEMA_VERSION);
  assert.ok(result.bundleBytes);
});

test("2. existing golden workspace remains unchanged", () => {
  assert.equal(hash(goldenBytes), expectedGoldenWorkspaceHash);
});

test("3. existing golden generation remains byte-identical", () => {
  const first = validateSourcePreparationWorkspace(golden, "generate");
  const second = validateSourcePreparationWorkspace(golden, "generate");
  assert.ok(first.bundleBytes?.equals(second.bundleBytes!));
});

test("4. existing golden SHA remains unchanged", () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  assert.equal(hash(result.bundleBytes!), expectedGoldenBundleHash);
});

test("5. schema 1.1.0 accepts the lossless fixture", () => {
  const result = generate();
  assert.equal(result.report.schemaVersion,
    LOSSLESS_PREPARATION_SCHEMA_VERSION);
  assert.deepEqual(result.report.issues, []);
});

test("6. all 25 claim attributions are represented", () => {
  assert.equal(workspace.claimAttributions.length, 25);
  assert.equal(context(generated).claimAttributions?.length, 25);
});

test("7. all 12 interpretations are represented", () => {
  assert.equal(workspace.interpretations.length, 12);
  assert.equal(context(generated).interpretations?.length, 12);
});

test("8. all 10 perspectives are represented", () => {
  assert.equal(workspace.perspectives.length, 10);
  assert.equal(context(generated).perspectives?.length, 10);
});

test("9. all 18 perspective links are represented", () => {
  assert.equal(workspace.perspectiveLinks.length, 18);
  assert.equal(context(generated).recordPerspectives?.length, 18);
});

test("10. all 18 causal links are represented", () => {
  assert.equal(workspace.causalLinks.length, 18);
  assert.equal(context(generated).causalLinks?.length, 18);
});

test("11. all 6 cultural memories are represented", () => {
  assert.equal(workspace.culturalMemories.length, 6);
  assert.equal(context(generated).culturalMemories?.length, 6);
});

test("12. every accepted field survives generation", () => {
  assert.deepEqual(generated, accepted);
});

test("13. canonical IDs remain unchanged", () => {
  const acceptedIds = JSON.stringify(accepted).match(
    /"(?:id|recordId|perspectiveId)":"[^"]+"/g,
  );
  const generatedIds = JSON.stringify(generated).match(
    /"(?:id|recordId|perspectiveId)":"[^"]+"/g,
  );
  assert.deepEqual(generatedIds, acceptedIds);
});

test("14. existing collection ordering remains deterministic", () => {
  assert.deepEqual(
    Object.keys(context(generated)),
    Object.keys(context(accepted)),
  );
});

test("15. preparation metadata does not leak", () => {
  const text = generatedBytes.toString("utf8");
  assert.doesNotMatch(text,
    /preparationStatus|approvalRecord|preparationId|rightsReview/);
});

test("16. duplicate claim-attribution IDs fail", () => {
  const candidate = clone();
  candidate.claimAttributions.push(
    structuredClone(candidate.claimAttributions[0]!),
  );
  assert.ok(codes(candidate).includes("DUPLICATE_PREPARATION_ID"));
});

test("17. missing claim-attribution targets fail", () => {
  const candidate = clone();
  candidate.claimAttributions[0]!.object.claimId = "missing-claim";
  assert.ok(codes(candidate).includes("UNRESOLVED_PREPARATION_REFERENCE"));
});

test("18. duplicate interpretation IDs fail", () => {
  const candidate = clone();
  candidate.interpretations.push(
    structuredClone(candidate.interpretations[0]!),
  );
  assert.ok(codes(candidate).includes("DUPLICATE_PREPARATION_ID"));
});

test("19. missing interpretation dependencies fail", () => {
  const candidate = clone();
  candidate.interpretations[0]!.object.subjectId = "missing-subject";
  assert.ok(codes(candidate).includes("UNRESOLVED_PREPARATION_REFERENCE"));
});

test("20. duplicate perspective IDs fail", () => {
  const candidate = clone();
  candidate.perspectives.push(structuredClone(candidate.perspectives[0]!));
  assert.ok(codes(candidate).includes("DUPLICATE_PREPARATION_ID"));
});

test("21. missing perspective dependencies fail", () => {
  const candidate = clone();
  candidate.perspectiveLinks[0]!.object.perspectiveId =
    "missing-perspective";
  assert.ok(codes(candidate).includes("UNRESOLVED_PREPARATION_REFERENCE"));
});

test("22. duplicate perspective-link IDs fail", () => {
  const candidate = clone();
  candidate.perspectiveLinks.push(
    structuredClone(candidate.perspectiveLinks[0]!),
  );
  const result = codes(candidate);
  assert.ok(result.includes("DUPLICATE_PREPARATION_ID"));
  assert.ok(result.includes("DUPLICATE_PERSPECTIVE_LINK"));
});

test("23. missing perspective-link endpoints fail", () => {
  const candidate = clone();
  candidate.perspectiveLinks[0]!.object.recordId = "missing-record";
  assert.ok(codes(candidate).includes("UNRESOLVED_PREPARATION_REFERENCE"));
});

test("24. duplicate causal-link IDs fail", () => {
  const candidate = clone();
  candidate.causalLinks.push(structuredClone(candidate.causalLinks[0]!));
  assert.ok(codes(candidate).includes("DUPLICATE_PREPARATION_ID"));
});

test("25. missing causal-link endpoints fail", () => {
  const candidate = clone();
  candidate.causalLinks[0]!.object.causeId = "missing-cause";
  assert.ok(codes(candidate).includes("UNRESOLVED_PREPARATION_REFERENCE"));
});

test("26. duplicate cultural-memory IDs fail", () => {
  const candidate = clone();
  candidate.culturalMemories.push(
    structuredClone(candidate.culturalMemories[0]!),
  );
  assert.ok(codes(candidate).includes("DUPLICATE_PREPARATION_ID"));
});

test("27. missing cultural-memory dependencies fail", () => {
  const candidate = clone();
  candidate.culturalMemories[0]!.object.subjectId = "missing-subject";
  assert.ok(codes(candidate).includes("UNRESOLVED_PREPARATION_REFERENCE"));
});

test("28. unapproved objects fail generation", () => {
  const candidate = clone();
  candidate.perspectives[0]!.preparationStatus = "needs_review";
  delete candidate.perspectives[0]!.approvalRecord;
  assert.ok(generate(candidate).report.issues.some((item) =>
    item.code === "UNAPPROVED_OBJECTS_BLOCK_GENERATION"));
});

test("29. unsupported enum values fail validation", () => {
  const candidate = clone();
  candidate.causalLinks[0]!.object.causalKind = "unsupported";
  assert.ok(generate(candidate).report.issues.some((item) =>
    item.code.startsWith("BUNDLE_")));
});

test("30. unresolved cross-collection dependencies fail", () => {
  const candidate = clone();
  candidate.claimAttributions[0]!.object.accountId = "missing-account";
  assert.ok(codes(candidate).includes("UNRESOLVED_PREPARATION_REFERENCE"));
});

test("31. first and second generations are byte-identical", () => {
  const second = generate().bundleBytes!;
  assert.ok(generatedBytes.equals(second));
});

test("32. first and second SHA-256 values match", () => {
  assert.equal(hash(generatedBytes), hash(generate().bundleBytes!));
});

test("33. generated length matches the accepted Chunk 6 bundle", () => {
  assert.equal(generatedBytes.length, acceptedBytes.length);
});

test("34. generated SHA matches the accepted Chunk 6 bundle", () => {
  assert.equal(hash(generatedBytes), expectedAcceptedHash);
  assert.equal(hash(generatedBytes), hash(acceptedBytes));
});

test("35. generated bytes equal the accepted Chunk 6 bundle", () => {
  assert.ok(generatedBytes.equals(acceptedBytes));
});

test("36. generated output passes the existing bundle schema", () => {
  const validation = validateBundle(generated);
  assert.equal(validation.canImport, true);
  assert.equal(validation.summary.errors, 0);
  assert.equal(validation.summary.warnings, 0);
});

test("37. generated output imports through the existing importer", async () => {
  await saveImportedBundle(generated);
  assert.deepEqual(await getImportedBundle(generated.bundleId!), generated);
});

test("38. replacement import preserves all six collection counts", async () => {
  await saveImportedBundle(generated);
  const database = requireDatabase();
  const tables = {
    context_claim_attributions: 25,
    context_interpretations: 12,
    context_perspectives: 10,
    context_record_perspectives: 18,
    context_causal_links: 18,
    context_cultural_memories: 6,
  };
  for (const [table, expected] of Object.entries(tables)) {
    const result = await database.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ${table} WHERE ${
        table === "context_record_perspectives"
        || table === "context_claim_attributions"
          ? "bundle_id = $1"
          : "context_id IN (SELECT context_id FROM context_records WHERE bundle_id = $1)"
      };`,
      [generated.bundleId],
    );
    assert.equal(Number(result.rows[0]?.count), expected, table);
  }
});

test("39. replacement import preserves all accepted attribution", async () => {
  const database = requireDatabase();
  const result = await database.query<{ attribution_id: string }>(
    `SELECT attribution_id FROM context_claim_attributions
     WHERE bundle_id = $1 ORDER BY attribution_id`,
    [generated.bundleId],
  );
  assert.deepEqual(
    result.rows.map((row) => row.attribution_id),
    [...(context(accepted).claimAttributions ?? [])]
      .map((item) => item.id).sort(),
  );
});

test("40. replacement import preserves all existing canonical IDs", async () => {
  assert.deepEqual(await getImportedBundle(generated.bundleId!), accepted);
});

test("41. duplicate-safe reimport succeeds", async () => {
  await saveImportedBundle(generated);
  await saveImportedBundle(generated);
  assert.deepEqual(await getImportedBundle(generated.bundleId!), generated);
});

test("42. reimport creates no duplicate contextual rows", async () => {
  const database = requireDatabase();
  const result = await database.query<{ duplicate_count: string }>(
    `SELECT COUNT(*) AS duplicate_count FROM (
       SELECT context_id FROM context_records
       WHERE bundle_id = $1 GROUP BY context_id HAVING COUNT(*) > 1
     ) duplicate_rows`,
    [generated.bundleId],
  );
  assert.equal(Number(result.rows[0]?.duplicate_count), 0);
});

test("43. existing search behavior remains intact", async () => {
  const response = await request(app)
    .get("/api/v1/search")
    .query({ q: "Patuxet", domain: "HistoryRoot", limit: 100 })
    .expect(200);
  assert.ok(response.body.results.some((item: { id: string }) =>
    item.id === "historyroot-plymouth-place-patuxet-plymouth"));
});

test("44. existing Context Review behavior remains intact", async () => {
  const claimId = "historyroot-plymouth-claim-harvest-three-days";
  const response = await request(app)
    .get(`/api/v1/context/review/claims/${claimId}`)
    .expect(200);
  assert.equal(response.body.claim.id, claimId);
  assert.equal(response.body.attributions.items.length, 1);
  assert.equal(response.body.evidence.items[0].supportRole, "supports");
});

test("45. existing foundational corpus identity remains exact", () => {
  assert.equal(hash(acceptedBytes), expectedAcceptedHash);
  assert.equal(hash(workspaceBytes), expectedLosslessWorkspaceHash);
});

test("46. no importer implementation changes occur", () => {
  assert.ok(!gitChangedPaths().some((path) =>
    path.includes("src/services/import-store")
    || path.includes("src/services/context-import-store")));
});

test("47. no database migration is added", async () => {
  const migrations = await readFile(
    new URL("../db/migrations/012_refine_contextual_assertions_evidence_versioning.sql",
      import.meta.url),
  );
  assert.ok(migrations.length > 0);
  assert.ok(!gitChangedPaths().some((path) =>
    path.startsWith("backend/db/migrations/")));
});

test("48. no API route changes occur", () => {
  assert.ok(!gitChangedPaths().some((path) =>
    path.startsWith("backend/src/routes/")));
});

test("49. no frontend file changes occur", () => {
  assert.ok(!gitChangedPaths().some((path) =>
    path.endsWith(".html")
    || path.startsWith("assets/")
    || path.startsWith("config/customers/")));
});

test("50. no external network, AI, OCR, or scraper code is added", async () => {
  const files = await Promise.all([
    readFile(new URL("../src/source-preparation/source-preparation-types.ts",
      import.meta.url), "utf8"),
    readFile(new URL("../src/source-preparation/source-preparation-schema.ts",
      import.meta.url), "utf8"),
    readFile(new URL("../src/source-preparation/source-preparation-engine.ts",
      import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(files.join("\n"),
    /from ["'](?:https?:|openai|playwright|puppeteer|tesseract)|\bfetch\s*\(/i);
});
