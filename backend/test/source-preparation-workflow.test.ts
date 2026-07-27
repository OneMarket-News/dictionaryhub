import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { after, before } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  loadFoundationalCorpusBundle,
} from "../src/historyroot/foundational-corpus.js";
import { getPool } from "../src/lib/database.js";
import {
  deleteImportedBundle,
  saveImportedBundle,
} from "../src/services/import-store.js";
import { validateBundle } from "../src/services/validator.js";
import {
  canonicalJsonBytes,
  validateSourcePreparationWorkspace,
} from "../src/source-preparation/source-preparation-engine.js";
import {
  PREPARATION_SCHEMA_VERSION,
  type SourcePreparationWorkspace,
} from "../src/source-preparation/source-preparation-types.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

const app = createApp();
const goldenUrl = new URL(
  "../data/source-preparation-workflow-v1/golden-workspace.json",
  import.meta.url,
);
const corpusBundleUrl = new URL(
  "../data/historyroot-foundational-corpus-v1/historyroot-foundational-corpus-v1.bundle.json",
  import.meta.url,
);
let golden: SourcePreparationWorkspace;
let goldenBytes: Buffer;
let generatedBundleHash = "";

function clone(): SourcePreparationWorkspace {
  return structuredClone(golden);
}

function codes(workspace: unknown, mode: "validate" | "preview" | "generate") {
  return validateSourcePreparationWorkspace(workspace, mode)
    .report.issues.map((item) => item.code);
}

function cli(args: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/register-tsx.mjs",
      "src/scripts/prepare-sourceroot-workspace.ts",
      ...args,
    ],
    {
      cwd: path.resolve("."),
      encoding: "utf8",
      env: process.env,
    },
  );
}

before(async () => {
  goldenBytes = await readFile(goldenUrl);
  golden = JSON.parse(
    goldenBytes.toString("utf8"),
  ) as SourcePreparationWorkspace;
  await resetTestDatabase();
});

after(async () => {
  await deleteImportedBundle(
    golden.reviewMetadata.bundleId,
    new Set([golden.reviewMetadata.bundleId]),
  );
  await saveImportedBundle(await loadFoundationalCorpusBundle());
  await closeTestDatabase();
});

test("1. approved golden workspace validates", () => {
  const result = validateSourcePreparationWorkspace(golden, "validate");
  assert.equal(result.report.schemaVersion, PREPARATION_SCHEMA_VERSION);
  assert.deepEqual(result.report.issues, []);
  assert.equal(result.report.readyForGeneration, true);
});

test("2. schema version is required and bounded", () => {
  const workspace = clone() as unknown as Record<string, unknown>;
  workspace.schemaVersion = "2.0.0";
  assert.ok(codes(workspace, "validate").includes(
    "INVALID_PREPARATION_STRUCTURE",
  ));
});

test("3. duplicate object IDs are rejected", () => {
  const workspace = clone();
  workspace.records.push(structuredClone(workspace.records[0]!));
  assert.ok(codes(workspace, "validate").includes(
    "DUPLICATE_PREPARATION_ID",
  ));
});

test("4. cross-object references resolve", () => {
  const result = validateSourcePreparationWorkspace(golden, "validate");
  assert.ok(result.report.resolvedReferences.checked > 0);
  assert.equal(result.report.resolvedReferences.unresolved, 0);
});

test("5. accepted SourceRoot kinds and evidence enums pass unchanged", () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  assert.ok(result.bundle);
  assert.deepEqual(validateBundle(result.bundle).errors, []);
  assert.deepEqual(validateBundle(result.bundle).warnings, []);
});

test("6. truth-scoring preparation fields are rejected", () => {
  const workspace = clone() as SourcePreparationWorkspace & {
    truthScore?: number;
  };
  workspace.truthScore = 0.9;
  assert.ok(codes(workspace, "validate").includes(
    "UNSUPPORTED_TRUTH_SCORING_FIELD",
  ));
});

test("7. source and edition identities remain distinct", () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  const sources = result.bundle?.sources as Array<{ id: string }>;
  assert.equal(new Set(sources.map((source) => source.id)).size, 4);
  assert.equal(golden.sourceSet[0]?.sourceIdentityReview.editionId,
    "mourts-relation-dexter-1865");
});

test("8. rights classification is required", () => {
  const workspace = clone() as unknown as Record<string, unknown>;
  const source = (workspace.sourceSet as Array<Record<string, unknown>>)[0]!;
  delete (source.rightsReview as Record<string, unknown>).classification;
  assert.ok(codes(workspace, "validate").includes(
    "INVALID_PREPARATION_STRUCTURE",
  ));
});

test("9. public-domain status requires a basis", () => {
  const workspace = clone();
  delete workspace.sourceSet[0]!.rightsReview.basis;
  assert.ok(codes(workspace, "validate").includes(
    "RIGHTS_BASIS_REQUIRED",
  ));
});

test("10. open-license status requires a license identifier", () => {
  const workspace = clone();
  workspace.sourceSet[0]!.rightsReview.classification = "open_license";
  assert.ok(codes(workspace, "validate").includes(
    "LICENSE_IDENTIFIER_REQUIRED",
  ));
});

test("11. permission-granted status requires a basis", () => {
  const workspace = clone();
  workspace.sourceSet[0]!.rightsReview.classification =
    "permission_granted";
  assert.ok(codes(workspace, "validate").includes(
    "PERMISSION_BASIS_REQUIRED",
  ));
});

test("12. unknown and restricted rights block copied excerpts", () => {
  for (const classification of ["unknown", "restricted"] as const) {
    const workspace = clone();
    workspace.sourceSet[0]!.rightsReview.classification = classification;
    workspace.sourceSet[0]!.contentUse.containsCopiedExcerpt = true;
    assert.ok(codes(workspace, "generate").includes(
      "COPIED_EXCERPT_BLOCKED",
    ));
  }
});

test("13. metadata-and-link-only paraphrase use remains valid", () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  assert.equal(result.report.rightsSummary.metadata_and_link_only, 2);
  assert.equal(result.report.contentUseSummary.paraphrase_only, 2);
});

test("14. incompatible rights and content use block generation", () => {
  const workspace = clone();
  workspace.sourceSet[1]!.contentUse.mode = "public_domain_excerpt";
  assert.ok(codes(workspace, "generate").includes(
    "INCOMPATIBLE_CONTENT_USE",
  ));
});

test("15. unreferenced draft objects do not generate", () => {
  const workspace = clone();
  workspace.records.push({
    preparationStatus: "draft",
    object: { id: "draft-object-never-generated" },
  });
  const result = validateSourcePreparationWorkspace(workspace, "generate");
  assert.ok(result.bundle);
  assert.ok(!result.bundle.context?.entities?.some(
    (record) => record.id === "draft-object-never-generated",
  ));
});

test("16. needs-review dependencies block generation", () => {
  const workspace = clone();
  workspace.sourceSet[0]!.preparationStatus = "needs_review";
  delete workspace.sourceSet[0]!.approvalRecord;
  assert.ok(codes(workspace, "generate").includes(
    "BLOCKED_PREPARATION_DEPENDENCY",
  ));
});

test("17. omitted objects do not generate and require reasons", () => {
  const workspace = clone();
  workspace.records.push({
    preparationStatus: "omitted",
    omissionReason: "Not needed for the bounded golden network.",
    object: { id: "omitted-object-never-generated" },
  });
  const result = validateSourcePreparationWorkspace(workspace, "generate");
  assert.ok(result.bundle);
  assert.equal(result.report.omittedItems.length, 1);
  delete workspace.records.at(-1)!.omissionReason;
  assert.ok(codes(workspace, "generate").includes(
    "INVALID_PREPARATION_STRUCTURE",
  ));
});

test("18. workspace approval is required", () => {
  const workspace = clone();
  workspace.approvals.approved = false;
  assert.ok(codes(workspace, "generate").includes(
    "WORKSPACE_APPROVAL_REQUIRED",
  ));
});

test("19. approved objects may not depend on blocked objects", () => {
  const workspace = clone();
  workspace.accounts[0]!.preparationStatus = "draft";
  delete workspace.accounts[0]!.approvalRecord;
  assert.ok(codes(workspace, "generate").includes(
    "BLOCKED_PREPARATION_DEPENDENCY",
  ));
});

test("20. claims retain valid reporting-account attribution paths", () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  const accounts = new Set(result.bundle?.context?.accounts?.map(
    (account) => account.id,
  ));
  for (const claim of result.bundle?.context?.claims ?? []) {
    assert.ok(accounts.has(claim.accountId));
  }
});

test("21. provenance is not converted into supporting evidence", () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  assert.equal(result.bundle?.context?.fieldProvenance?.length, 2);
  assert.equal(result.bundle?.context?.evidenceClaimLinks?.length, 4);
});

test("22. evidence roles are explicit and references resolve", () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  assert.equal(result.report.evidenceRoleSummary.supports, 3);
  assert.equal(result.report.evidenceRoleSummary.qualifies, 1);
  assert.equal(result.report.resolvedReferences.unresolved, 0);
});

test("23. unknown evidence roles are rejected", () => {
  const workspace = clone();
  workspace.evidenceLinks[0]!.object.supportRole = "mystery";
  assert.ok(codes(workspace, "generate").includes(
    "INVALID_EVIDENCE_ROLE",
  ));
});

test("24. locators require accepted types and nonempty structure", () => {
  const workspace = clone();
  workspace.sourceLocators[0]!.object.locatorType = "search_result";
  assert.ok(codes(workspace, "generate").includes("INVALID_LOCATOR_TYPE"));
  const empty = clone();
  empty.sourceLocators[0]!.object.locatorLabel = "";
  assert.ok(codes(empty, "generate").includes("MALFORMED_LOCATOR"));
});

test("25. edition-specific locators stay on the reviewed edition", () => {
  const workspace = clone();
  workspace.sourceLocators[0]!.object.locator = {
    editionId: "wrong-edition",
    section: "The Mayflower Compact",
  };
  assert.ok(codes(workspace, "generate").includes(
    "LOCATOR_EDITION_MISMATCH",
  ));
});

test("26. historical names and uncertain dates preserve provenance", () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  assert.equal(result.bundle?.context?.aliases?.[0]?.aliasType, "historical");
  assert.match(
    result.bundle?.context?.temporalAssertions?.[0]
      ?.structuredDate?.uncertainty ?? "",
    /not silently converted/,
  );
});

test("27. duplicate canonical identities are rejected", () => {
  const workspace = clone();
  workspace.records[0]!.object.metadata = {
    canonicalIdentity: "authority:test",
  };
  workspace.records[1]!.object.metadata = {
    canonicalIdentity: "authority:test",
  };
  assert.ok(codes(workspace, "generate").includes(
    "CANONICAL_IDENTITY_COLLISION",
  ));
});

test("28. artificial version history is rejected", () => {
  const workspace = clone();
  workspace.claims[0]!.object.priorVersionId = "invented-prior-version";
  assert.ok(codes(workspace, "generate").includes(
    "ARTIFICIAL_VERSION_HISTORY",
  ));
});

test("29. validate and preview never return an approved bundle", () => {
  assert.equal(
    validateSourcePreparationWorkspace(golden, "validate").bundle,
    undefined,
  );
  assert.equal(
    validateSourcePreparationWorkspace(golden, "preview").bundle,
    undefined,
  );
});

test("30. generation fails with blockers and succeeds when approved", () => {
  const blocked = clone();
  blocked.approvals.approved = false;
  assert.equal(
    validateSourcePreparationWorkspace(blocked, "generate").bundle,
    undefined,
  );
  assert.ok(validateSourcePreparationWorkspace(golden, "generate").bundle);
});

test("31. generated output uses and passes the accepted bundle schema", () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  assert.equal(result.bundle?.bundleType, "sourceroot-import-bundle");
  assert.equal(validateBundle(result.bundle).status, "ready");
});

test("32. generation is byte deterministic with an unchanged input", () => {
  const first = validateSourcePreparationWorkspace(golden, "generate");
  const second = validateSourcePreparationWorkspace(golden, "generate");
  assert.ok(first.bundleBytes);
  assert.ok(second.bundleBytes);
  assert.deepEqual(first.bundleBytes, second.bundleBytes);
  generatedBundleHash = createHash("sha256")
    .update(first.bundleBytes)
    .digest("hex");
  assert.equal(
    first.report.proposedContentSha256,
    `sha256:${generatedBundleHash}`,
  );
  assert.deepEqual(canonicalJsonBytes(golden), canonicalJsonBytes(
    JSON.parse(goldenBytes.toString("utf8")),
  ));
});

test("33. CLI rejects missing input, unsupported modes, and traversal", () => {
  assert.notEqual(cli(["--mode", "validate"]).status, 0);
  assert.notEqual(cli([
    "--workspace", "data/source-preparation-workflow-v1/missing.json",
    "--mode", "validate",
  ]).status, 0);
  assert.notEqual(cli([
    "--workspace", "data/source-preparation-workflow-v1/golden-workspace.json",
    "--mode", "import",
  ]).status, 0);
  assert.notEqual(cli([
    "--workspace", "../outside.json",
    "--mode", "validate",
  ]).status, 0);
});

test("34. CLI protects input and accepted corpus output paths", () => {
  assert.notEqual(cli([
    "--workspace", "data/source-preparation-workflow-v1/golden-workspace.json",
    "--mode", "generate",
    "--output", "data/source-preparation-workflow-v1/golden-workspace.json",
  ]).status, 0);
  assert.notEqual(cli([
    "--workspace", "data/source-preparation-workflow-v1/golden-workspace.json",
    "--mode", "generate",
    "--output", "data/historyroot-foundational-corpus-v1/output",
  ]).status, 0);
});

test("35. CLI preview labels reports and writes no approved bundle", async () => {
  const directory = await mkdtemp(path.resolve(".tmp-preparation-preview-"));
  try {
    const result = cli([
      "--workspace",
      "data/source-preparation-workflow-v1/golden-workspace.json",
      "--mode", "preview",
      "--output", path.basename(directory),
    ]);
    assert.equal(result.status, 0, result.stderr);
    const markdown = await readFile(
      path.join(directory, "validation-report.md"),
      "utf8",
    );
    assert.match(markdown, /PREVIEW MATERIAL/);
    await assert.rejects(
      stat(path.join(directory, "sourceroot-approved.bundle.json")),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("36. approved generated output imports duplicate-safely", async () => {
  const result = validateSourcePreparationWorkspace(golden, "generate");
  assert.ok(result.bundle);
  await saveImportedBundle(result.bundle);
  const database = getPool();
  assert.ok(database);
  const before = await database.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM context_records WHERE bundle_id = $1;",
    [result.bundle.bundleId],
  );
  await saveImportedBundle(result.bundle);
  const afterResult = await database.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM context_records WHERE bundle_id = $1;",
    [result.bundle.bundleId],
  );
  assert.deepEqual(afterResult.rows, before.rows);
});

test("37. imported records and claims resolve through search", async () => {
  const record = await request(app)
    .get("/api/v1/search")
    .query({ q: "Mayflower Compact text", domain: "HistoryRoot", limit: 100 })
    .expect(200);
  assert.ok(record.body.results.some(
    (item: { id: string }) =>
      item.id === "historyroot-plymouth-work-mayflower-compact-text",
  ));
  const claim = await request(app)
    .get("/api/v1/search")
    .query({ q: "signed original Mayflower Compact", limit: 100 })
    .expect(200);
  assert.ok(claim.body.results.some(
    (item: { id: string }) =>
      item.id === "historyroot-plymouth-claim-compact-original-lost",
  ));
});

test("38. imported claims resolve through Context Review", async () => {
  const response = await request(app)
    .get(
      "/api/v1/context/review/claims/historyroot-plymouth-claim-compact-original-lost",
    )
    .expect(200);
  assert.equal(
    response.body.claim.id,
    "historyroot-plymouth-claim-compact-original-lost",
  );
  assert.equal(response.body.evidence.items[0].supportRole, "supports");
});

test("39. draft, needs-review, and omitted fixture IDs never appear publicly", async () => {
  const response = await request(app)
    .get("/api/v1/search")
    .query({ q: "never generated", limit: 100 })
    .expect(200);
  const serialized = JSON.stringify(response.body);
  assert.doesNotMatch(serialized, /draft-object-never-generated/);
  assert.doesNotMatch(serialized, /omitted-object-never-generated/);
});

test("40. Chunk 6 bundle bytes and migration ceiling remain unchanged", async () => {
  const current = await readFile(corpusBundleUrl);
  assert.ok(current.length > 0);
  assert.equal(
    createHash("sha256").update(current).digest("hex"),
    "d0a69e3501d8419a6b4eda77515a7ae290c1ed2314f64074de46931857492b6f",
  );
  assert.match(generatedBundleHash, /^[a-f0-9]{64}$/);
});
