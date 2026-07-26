import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import type { ContextualBundle } from "../src/contextual-types.js";
import { getPool } from "../src/lib/database.js";
import {
  observeDataQualityAndProvenance,
  serializeDataQualityProvenanceReport,
} from "../src/observers/data-quality-provenance-observer.js";
import {
  loadGovernedTarget,
  materializeGovernedSnapshot,
  validateGovernedChange,
} from "../src/services/contextual-governance.js";
import {
  appendGovernedContextVersion,
} from "../src/services/context-version-store.js";
import { validateBundle } from "../src/services/validator.js";
import type { SourceRootBundle } from "../src/types.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

const app = createApp();
const fixtureUrl = new URL(
  "./fixtures/contextual-historyroot-valid.json",
  import.meta.url,
);

function importToken(): string {
  const token = process.env.IMPORT_SERVICE_TOKEN;
  if (!token) {
    throw new Error(
      "Chunk 4 tests require IMPORT_SERVICE_TOKEN in .env.test.",
    );
  }
  return token;
}

function importBundle(bundle: Record<string, unknown>) {
  return request(app)
    .post("/api/v1/import")
    .set("x-sourceroot-import-token", importToken())
    .send(bundle);
}

async function baseBundle(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  ) as Record<string, unknown>;
}

function contextOf(
  bundle: Record<string, unknown>,
): ContextualBundle {
  return bundle.context as ContextualBundle;
}

async function richBundle(): Promise<Record<string, unknown>> {
  const bundle = await baseBundle();
  for (const source of (
    Array.isArray(bundle.sources) ? bundle.sources : []
  ) as Array<Record<string, unknown>>) {
    source.accessStatus = "accessed-and-inspected";
    source.locatorsInspected = ["technical fixture locator"];
  }
  const context = contextOf(bundle);
  context.claimAttributions = [
    {
      id: "ctx-attribution-high-water",
      claimId: "ctx-claim-high-water",
      actorEntityId: "ctx-person-mara-quill",
      accountId: "ctx-account-field-log-entry",
      temporalAssertionId: "ctx-time-field-log-exact",
      attributionRole: "asserted_by",
      sourceIds: ["ctx-source-field-log"],
      note: "The field log records this attribution.",
      confidence: "documented",
      uncertainty: "The exact speaking time is not stated.",
    },
  ];
  context.claimRelations = [
    {
      id: "ctx-claim-relation-water-attendance",
      fromClaimId: "ctx-claim-high-water",
      toClaimId: "ctx-claim-three-participants",
      relationType: "contradicts",
      explanation:
        "The imported reviewer explicitly marked the accounts as competing.",
      sourceIds: ["ctx-source-later-summary"],
      reviewStatus: "needs-review",
      uncertainty: "No resolution is asserted.",
    },
  ];
  context.claimVersions = [
    {
      id: "ctx-claim-high-water-v1",
      claimId: "ctx-claim-high-water",
      ordinal: 1,
      statement:
        "Water was recorded above the marker in the first wording.",
      claimType: "condition",
      subjectId: "ctx-event-morning-observation",
      confidence: "moderate",
      uncertainty: "The marker height was not measured.",
      status: "corrected",
      changeType: "initial_import",
      attributionIds: ["ctx-attribution-high-water"],
      sourceIds: ["ctx-source-field-log"],
      assertedTemporalAssertionId: "ctx-time-field-log-exact",
      origin: "import",
      current: false,
    },
    {
      id: "ctx-claim-high-water-v2",
      claimId: "ctx-claim-high-water",
      ordinal: 2,
      priorVersionId: "ctx-claim-high-water-v1",
      statement:
        "Corrected statement: the water was unusually high.",
      claimType: "condition",
      subjectId: "ctx-event-morning-observation",
      confidence: "moderate",
      uncertainty: "The account supplies no measurement.",
      status: "accepted",
      changeType: "correction",
      changeReason: "The wording now follows the supplied account.",
      attributionSnapshot: [{
        id: "ctx-attribution-high-water",
        attributionRole: "asserted_by",
      }],
      attributionIds: ["ctx-attribution-high-water"],
      sourceIds: ["ctx-source-field-log"],
      assertedTemporalAssertionId: "ctx-time-field-log-exact",
      origin: "correction",
      current: true,
    },
    {
      id: "ctx-claim-three-participants-v1",
      claimId: "ctx-claim-three-participants",
      ordinal: 1,
      statement:
        "Three members of the River Survey Circle attended.",
      claimType: "participation-count",
      subjectId: "ctx-event-morning-observation",
      objectId: "ctx-group-river-survey-circle",
      confidence: "disputed",
      uncertainty: "A later account lists two.",
      status: "accepted",
      changeType: "initial_import",
      sourceIds: [
        "ctx-source-field-log",
        "ctx-source-later-summary",
      ],
      origin: "import",
      current: true,
    },
  ];
  context.evidenceClaimLinks = [
    {
      id: "ctx-evidence-link-water-v2",
      evidenceId: "ctx-evidence-field-log",
      claimId: "ctx-claim-high-water",
      claimVersionId: "ctx-claim-high-water-v2",
      supportRole: "supports",
      scopePath: "statement",
      explanation: "The link targets the corrected wording only.",
      relevance: "direct",
      confidence: "moderate",
      sourceIds: ["ctx-source-field-log"],
    },
    {
      id: "ctx-evidence-link-water-attendance",
      evidenceId: "ctx-evidence-field-log",
      claimId: "ctx-claim-three-participants",
      claimVersionId: "ctx-claim-three-participants-v1",
      supportRole: "contextualizes",
      explanation: "The same log provides explicit background.",
      relevance: "background",
      sourceIds: ["ctx-source-field-log"],
    },
    {
      id: "ctx-evidence-link-counter-attendance",
      evidenceId: "ctx-counterevidence-later-summary",
      claimId: "ctx-claim-three-participants",
      claimVersionId: "ctx-claim-three-participants-v1",
      supportRole: "disputes",
      explanation: "The later summary explicitly disputes the count.",
      relevance: "direct",
      sourceIds: ["ctx-source-later-summary"],
    },
  ];
  context.sourceLocators = [
    {
      id: "ctx-locator-field-log-page",
      evidenceId: "ctx-evidence-field-log",
      sourceId: "ctx-source-field-log",
      locatorType: "page",
      locatorLabel: "p. 14, water-level entry",
      locator: { page: 14, entry: "water-level" },
      excerpt: "Water above the marker.",
      note: "User-supplied test excerpt.",
    },
    {
      id: "ctx-locator-summary-section",
      evidenceId: "ctx-counterevidence-later-summary",
      sourceId: "ctx-source-later-summary",
      locatorType: "section",
      locatorLabel: "Attendance summary, section 2",
      locator: { section: 2 },
    },
  ];
  context.evidenceVersions = [
    {
      id: "ctx-evidence-field-log-v1",
      evidenceId: "ctx-evidence-field-log",
      ordinal: 1,
      evidenceType: "evidence",
      explanation: "Initial evidence explanation.",
      strength: "direct",
      confidence: "moderate",
      sourceId: "ctx-source-field-log",
      evidenceRecordId: "ctx-document-field-log",
      evidentiaryBasis: {
        sourceId: "ctx-source-field-log",
        evidenceRecordId: "ctx-document-field-log",
      },
      sourceLocator: {
        sourceId: "ctx-source-field-log",
        locatorType: "page",
        locatorLabel: "p. 14",
        locator: { page: 14 },
      },
      sourceIds: ["ctx-source-field-log"],
      supportRole: "supports",
      status: "corrected",
      changeType: "initial_import",
      origin: "import",
      current: false,
    },
    {
      id: "ctx-evidence-field-log-v2",
      evidenceId: "ctx-evidence-field-log",
      ordinal: 2,
      priorVersionId: "ctx-evidence-field-log-v1",
      evidenceType: "evidence",
      explanation:
        "Corrected evidence explanation with a precise locator.",
      strength: "direct",
      confidence: "moderate",
      uncertainty: "The excerpt is user supplied.",
      sourceId: "ctx-source-field-log",
      evidenceRecordId: "ctx-document-field-log",
      evidentiaryBasis: {
        sourceId: "ctx-source-field-log",
        evidenceRecordId: "ctx-document-field-log",
      },
      sourceLocator: {
        sourceId: "ctx-source-field-log",
        locatorType: "page",
        locatorLabel: "p. 14, water-level entry",
        locator: { page: 14, entry: "water-level" },
      },
      sourceIds: ["ctx-source-field-log"],
      supportRole: "supports",
      status: "accepted",
      changeType: "correction",
      changeReason: "A more precise supplied locator was recorded.",
      origin: "correction",
      current: true,
    },
    {
      id: "ctx-counterevidence-later-summary-v1",
      evidenceId: "ctx-counterevidence-later-summary",
      ordinal: 1,
      evidenceType: "counterevidence",
      explanation: "The later summary lists only two participants.",
      strength: "indirect",
      confidence: "weak",
      sourceId: "ctx-source-later-summary",
      evidenceRecordId: "ctx-document-later-summary",
      evidentiaryBasis: {
        sourceId: "ctx-source-later-summary",
        evidenceRecordId: "ctx-document-later-summary",
      },
      sourceIds: ["ctx-source-later-summary"],
      supportRole: "disputes",
      status: "accepted",
      changeType: "initial_import",
      origin: "import",
      current: true,
    },
  ];
  context.fieldProvenance = [
    ...(context.fieldProvenance ?? []),
    {
      id: "ctx-provenance-claim-version-reason",
      targetId: "ctx-claim-high-water",
      fieldPath: "changeReason",
      subrecordType: "claim_version",
      subrecordId: "ctx-claim-high-water-v2",
      sourceId: "ctx-source-field-log",
      supportType: "records-wording",
    },
    {
      id: "ctx-provenance-evidence-locator",
      targetId: "ctx-evidence-field-log",
      fieldPath: "sourceLocators",
      subrecordType: "source_locator",
      subrecordId: "ctx-locator-field-log-page",
      sourceId: "ctx-source-field-log",
      supportType: "records-location",
    },
  ];
  return bundle;
}

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("legacy claims and evidence validate without fabricated version history", async () => {
  const bundle = await baseBundle();
  assert.equal(validateBundle(bundle).canImport, true);
  await importBundle(bundle).expect(201);

  const claim = await request(app)
    .get("/api/v1/context/claims/ctx-claim-high-water")
    .expect(200);
  const evidence = await request(app)
    .get("/api/v1/context/evidence/ctx-evidence-field-log")
    .expect(200);
  assert.equal(claim.body.accountId, "ctx-account-field-log-entry");
  assert.deepEqual(claim.body.attributions, []);
  assert.deepEqual(claim.body.versions, []);
  assert.equal(claim.body.currentVersion, null);
  assert.equal(evidence.body.evidenceType, "evidence");
  assert.deepEqual(evidence.body.versions, []);
});

test("legacy counterevidence remains distinct and gains no support-role fact", async () => {
  await importBundle(await baseBundle()).expect(201);
  const response = await request(app)
    .get(
      "/api/v1/context/evidence/ctx-counterevidence-later-summary",
    )
    .expect(200);
  assert.equal(response.body.evidenceType, "counterevidence");
  assert.equal(response.body.supportRole, undefined);
  assert.deepEqual(response.body.claimLinks, []);
});

test("normalized attribution persists without inferred author or event time", async () => {
  await importBundle(await richBundle()).expect(201);
  const response = await request(app)
    .get("/api/v1/context/claims/ctx-claim-high-water")
    .expect(200);
  assert.equal(response.body.attributions.length, 1);
  assert.equal(
    response.body.attributions[0].actorEntityId,
    "ctx-person-mara-quill",
  );
  assert.equal(
    response.body.attributions[0].temporalAssertionId,
    "ctx-time-field-log-exact",
  );
  assert.equal(response.body.attributions[0].inferred, undefined);
});

test("claim relationships are explicit, directional, deterministic, and non-resolving", async () => {
  await importBundle(await richBundle()).expect(201);
  const first = await request(app)
    .get(
      "/api/v1/context/claim-relationships?claimId=ctx-claim-high-water",
    )
    .expect(200);
  const second = await request(app)
    .get(
      "/api/v1/context/claim-relationships?claimId=ctx-claim-high-water",
    )
    .expect(200);
  assert.deepEqual(first.body.items, second.body.items);
  assert.equal(first.body.items[0].relationType, "contradicts");

  const claims = await request(app)
    .get("/api/v1/context/claims?limit=100")
    .expect(200);
  assert.equal(claims.body.total, 2);
  assert.ok(claims.body.items.some(
    (item: { id: string }) =>
      item.id === "ctx-claim-three-participants",
  ));
});

test("self-relations and reverse duplicate contradictions are rejected", async () => {
  const bundle = await richBundle();
  const context = contextOf(bundle);
  context.claimRelations?.push({
    id: "ctx-reverse-contradiction",
    fromClaimId: "ctx-claim-three-participants",
    toClaimId: "ctx-claim-high-water",
    relationType: "contradicts",
    sourceIds: ["ctx-source-field-log"],
  });
  const result = validateBundle(bundle);
  assert.equal(result.canImport, false);
  assert.ok(result.errors.some(
    (error) =>
      error.code === "DUPLICATE_SYMMETRIC_CLAIM_CONTRADICTION",
  ));

  context.claimRelations = [{
    id: "ctx-self-relation",
    fromClaimId: "ctx-claim-high-water",
    toClaimId: "ctx-claim-high-water",
    relationType: "refines",
  }];
  const selfResult = validateBundle(bundle);
  assert.equal(selfResult.canImport, false);
});

test("evidence links target immutable versions and one evidence record may address multiple claims", async () => {
  await importBundle(await richBundle()).expect(201);
  const response = await request(app)
    .get(
      "/api/v1/context/claim-evidence-links?evidenceId=ctx-evidence-field-log",
    )
    .expect(200);
  assert.equal(response.body.total, 2);
  assert.deepEqual(
    response.body.items.map(
      (item: { claimVersionId: string }) => item.claimVersionId,
    ).sort(),
    [
      "ctx-claim-high-water-v2",
      "ctx-claim-three-participants-v1",
    ],
  );
});

test("evidence basis and exact user-supplied locators persist", async () => {
  await importBundle(await richBundle()).expect(201);
  const response = await request(app)
    .get("/api/v1/context/evidence/ctx-evidence-field-log")
    .expect(200);
  assert.equal(
    response.body.sourceLocators[0].locatorLabel,
    "p. 14, water-level entry",
  );
  assert.equal(
    response.body.currentVersion.evidentiaryBasis.sourceId,
    "ctx-source-field-log",
  );
  assert.equal(
    response.body.currentVersion.sourceLocator.locator.page,
    14,
  );
});

test("claim versions are immutable at the database boundary", async () => {
  await importBundle(await richBundle()).expect(201);
  const pool = getPool();
  assert.ok(pool);
  await assert.rejects(
    pool.query(
      `
        UPDATE context_claim_versions
        SET statement = 'forbidden overwrite'
        WHERE version_id = 'ctx-claim-high-water-v1'
      `,
    ),
    /immutable/i,
  );
});

test("evidence versions are immutable at the database boundary", async () => {
  await importBundle(await richBundle()).expect(201);
  const pool = getPool();
  assert.ok(pool);
  await assert.rejects(
    pool.query(
      `
        DELETE FROM context_evidence_versions
        WHERE version_id = 'ctx-evidence-field-log-v1'
      `,
    ),
    /immutable/i,
  );
});

test("identical reimport is idempotent while changed content under one version ID conflicts transactionally", async () => {
  const initial = await richBundle();
  await importBundle(initial).expect(201);
  await importBundle(await richBundle()).expect(201);
  const pool = getPool();
  assert.ok(pool);
  const before = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM context_claim_versions",
  );
  assert.equal(Number(before.rows[0]?.count), 3);

  const changed = await richBundle();
  const version = contextOf(changed).claimVersions?.[0];
  assert.ok(version);
  version.statement = "Conflicting bytes under a reused version ID.";
  const conflict = await importBundle(changed).expect(409);
  assert.equal(conflict.body.code, "CONTEXT_VERSION_ID_CONFLICT");
  const current = await pool.query<{ statement: string }>(
    `
      SELECT statement
      FROM context_claims
      WHERE context_id = 'ctx-claim-high-water'
    `,
  );
  assert.equal(
    current.rows[0]?.statement,
    "The water at Cedar Reach was unusually high.",
  );
});

test("version cycles and multiple-current pointers fail validation without inventing gaps", async () => {
  const cycle = await richBundle();
  const versions = contextOf(cycle).claimVersions ?? [];
  const first = versions.find(
    (version) => version.id === "ctx-claim-high-water-v1",
  );
  assert.ok(first);
  first.priorVersionId = "ctx-claim-high-water-v2";
  let result = validateBundle(cycle);
  assert.ok(result.errors.some(
    (error) => error.code === "CONTEXT_VERSION_PREDECESSOR_CYCLE",
  ));

  const multiple = await richBundle();
  const firstMultiple = contextOf(multiple).claimVersions?.[0];
  assert.ok(firstMultiple);
  firstMultiple.current = true;
  result = validateBundle(multiple);
  assert.ok(result.errors.some(
    (error) => error.code === "INVALID_CONTEXT_CURRENT_VERSION_COUNT",
  ));
});

test("correction history and current pointers survive replacement without deleting prior versions", async () => {
  await importBundle(await richBundle()).expect(201);
  await importBundle(await baseBundle()).expect(201);
  const response = await request(app)
    .get(
      "/api/v1/context/claim-versions?claimId=ctx-claim-high-water&sort=ordinal",
    )
    .expect(200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.items[0].status, "corrected");
  assert.equal(response.body.items[1].current, true);
});

test("new Registry API collections paginate, filter, sort stably, ignore unknown queries, and return request IDs", async () => {
  await importBundle(await richBundle()).expect(201);
  const response = await request(app)
    .get(
      "/api/v1/context/claim-versions?claimId=ctx-claim-high-water&current=false&limit=1&sort=ordinal&unknown=value",
    )
    .set("x-request-id", "chunk4-api-contract")
    .expect("x-request-id", "chunk4-api-contract")
    .expect(200);
  assert.equal(response.body.contractVersion, "1.0");
  assert.equal(response.body.total, 1);
  assert.equal(response.body.returned, 1);
  assert.equal(response.body.hasMore, false);
  assert.equal(response.body.items[0].id, "ctx-claim-high-water-v1");
  assert.deepEqual(
    response.body.registry.ignoredQueryParameters,
    ["unknown"],
  );
  assert.equal(response.body.appliedSort.tieBreaker, "id:asc");
});

test("historical version search remains distinct from the logical current claim", async () => {
  await importBundle(await richBundle()).expect(201);
  const response = await request(app)
    .get(
      "/api/v1/search?q=above%20the%20marker&type=context-claim-version",
    )
    .expect(200);
  assert.equal(response.body.total, 1);
  assert.equal(
    response.body.results[0].id,
    "ctx-claim-high-water-v1",
  );
  assert.equal(response.body.results[0].metadata.current, false);
  assert.equal(
    response.body.results[0].metadata.claimId,
    "ctx-claim-high-water",
  );
});

test("field-level provenance safely targets version and locator subrecords", async () => {
  const bundle = await richBundle();
  assert.equal(validateBundle(bundle).canImport, true);
  await importBundle(bundle).expect(201);
  const claim = await request(app)
    .get("/api/v1/context/claims/ctx-claim-high-water")
    .expect(200);
  const evidence = await request(app)
    .get("/api/v1/context/evidence/ctx-evidence-field-log")
    .expect(200);
  assert.ok(claim.body.fieldProvenance.some(
    (item: { subrecordType: string }) =>
      item.subrecordType === "claim_version",
  ));
  assert.ok(evidence.body.fieldProvenance.some(
    (item: { subrecordType: string }) =>
      item.subrecordType === "source_locator",
  ));
});

test("the Level 1 observer reports deterministic version findings without mutating input", async () => {
  const bundle = await richBundle() as unknown as SourceRootBundle;
  const context = bundle.context;
  assert.ok(context);
  const duplicate = {
    ...(context.claimVersions?.[0] ?? {}),
    statement: "Changed duplicate observer input.",
    current: true,
  };
  context.claimVersions?.push(duplicate as never);
  const before = JSON.stringify(bundle);
  const first = observeDataQualityAndProvenance(bundle);
  const second = observeDataQualityAndProvenance(bundle);
  assert.equal(JSON.stringify(bundle), before);
  assert.equal(first.authorityLevel, 1);
  assert.equal(first.readOnly, true);
  assert.ok(first.findings.some(
    (finding) =>
      finding.category === "duplicate_version_identifier",
  ));
  assert.ok(first.findings.some(
    (finding) =>
      finding.category === "multiple_current_versions",
  ));
  assert.equal(
    serializeDataQualityProvenanceReport(first),
    serializeDataQualityProvenanceReport(second),
  );
});

test("governed publication and rollback append versions while preserving later history", async () => {
  await importBundle(await richBundle()).expect(201);
  const pool = getPool();
  assert.ok(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const original = await loadGovernedTarget(
      client,
      "claim",
      "ctx-claim-high-water",
    );
    const published = {
      ...original.snapshot,
      statement: "Governed publication wording.",
    };
    const validation = await validateGovernedChange(client, {
      targetType: "claim",
      targetId: "ctx-claim-high-water",
      bundleId: String(original.bundleId),
      baseSnapshot: original.snapshot,
      proposedPatch: {
        statement: "Governed publication wording.",
      },
      editorialRationale: "Reviewed wording correction.",
      evidenceSourceIds: ["ctx-source-field-log"],
      changeType: "governed_correction",
    });
    assert.equal(
      validation.valid,
      true,
      JSON.stringify(validation.errors),
    );
    await materializeGovernedSnapshot(
      client,
      "claim",
      "ctx-claim-high-water",
      String(original.bundleId),
      published,
    );
    await appendGovernedContextVersion(client, {
      targetType: "claim",
      targetId: "ctx-claim-high-water",
      bundleId: String(original.bundleId),
      snapshot: published,
      origin: "governed_publication",
      changeType: "governed_correction",
      changeReason: "Reviewed publication.",
      proposalId: "11111111-1111-4111-8111-111111111111",
      publicationId: "22222222-2222-4222-8222-222222222222",
      revisionId: "sourceroot-governed-test-publication",
    });
    await materializeGovernedSnapshot(
      client,
      "claim",
      "ctx-claim-high-water",
      String(original.bundleId),
      original.snapshot,
    );
    await appendGovernedContextVersion(client, {
      targetType: "claim",
      targetId: "ctx-claim-high-water",
      bundleId: String(original.bundleId),
      snapshot: original.snapshot,
      origin: "rollback",
      changeType: "governed_rollback",
      changeReason: "Reviewed rollback.",
      proposalId: "11111111-1111-4111-8111-111111111111",
      publicationId: "22222222-2222-4222-8222-222222222222",
      revisionId: "sourceroot-governed-test-rollback",
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const response = await request(app)
    .get(
      "/api/v1/context/claim-versions?claimId=ctx-claim-high-water&sort=createdAt",
    )
    .expect(200);
  assert.equal(response.body.total, 4);
  assert.ok(response.body.items.some(
    (item: { origin: string }) =>
      item.origin === "governed_publication",
  ));
  const rollback = response.body.items.find(
    (item: { origin: string }) => item.origin === "rollback",
  );
  assert.equal(rollback.current, true);
  assert.ok(response.body.items.some(
    (item: { statement: string }) =>
      item.statement === "Governed publication wording.",
  ));
});

test("a late immutable-child conflict rolls back the entire replacement graph", async () => {
  await importBundle(await richBundle()).expect(201);
  const changed = await richBundle();
  const context = contextOf(changed);
  const claim = context.claims?.find(
    (item) => item.id === "ctx-claim-high-water",
  );
  const version = context.claimVersions?.[0];
  assert.ok(claim);
  assert.ok(version);
  claim.statement = "This replacement must roll back.";
  version.statement = "Conflicting immutable version bytes.";
  await importBundle(changed).expect(409);

  const response = await request(app)
    .get("/api/v1/context/claims/ctx-claim-high-water")
    .expect(200);
  assert.equal(
    response.body.statement,
    "The water at Cedar Reach was unusually high.",
  );
  assert.equal(response.body.attributions.length, 1);
});

test("narrow integration-test deletion explicitly cleans immutable history without broadening production deletion", async () => {
  const bundle = await richBundle();
  await importBundle(bundle).expect(201);
  await request(app)
    .delete(`/api/v1/import/${String(bundle.bundleId)}`)
    .set("x-sourceroot-import-token", importToken())
    .expect(200);
  const pool = getPool();
  assert.ok(pool);
  const remaining = await pool.query<{ count: string }>(
    `
      SELECT (
        (SELECT COUNT(*) FROM context_claim_versions)
        + (SELECT COUNT(*) FROM context_evidence_versions)
      ) AS count
    `,
  );
  assert.equal(Number(remaining.rows[0]?.count), 0);

  await request(app)
    .delete("/api/v1/import/not-an-integration-bundle")
    .set("x-sourceroot-import-token", importToken())
    .expect(403);
});
