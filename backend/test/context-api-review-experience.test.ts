import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import type { ContextualBundle } from "../src/contextual-types.js";
import { getPool } from "../src/lib/database.js";
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
      "Context review tests require IMPORT_SERVICE_TOKEN in .env.test.",
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

async function reviewBundle(): Promise<Record<string, unknown>> {
  const bundle = await baseBundle();
  for (const source of (
    Array.isArray(bundle.sources) ? bundle.sources : []
  ) as Array<Record<string, unknown>>) {
    source.accessStatus = "accessed-and-inspected";
    source.locatorsInspected = ["context review fixture locator"];
  }
  const context = contextOf(bundle);
  context.claimAttributions = [
    {
      id: "ctx-attribution-high-water-asserted",
      claimId: "ctx-claim-high-water",
      actorEntityId: "ctx-person-mara-quill",
      temporalAssertionId: "ctx-time-field-log-exact",
      attributionRole: "asserted_by",
      sourceIds: ["ctx-source-field-log"],
      note: "The field log records this attribution.",
      confidence: "documented",
    },
    {
      id: "ctx-attribution-high-water-recorded",
      claimId: "ctx-claim-high-water",
      accountId: "ctx-account-field-log-entry",
      attributionRole: "recorded_by",
      sourceIds: ["ctx-source-later-summary"],
      note:
        "The later summary reports the account without becoming claim evidence.",
      confidence: "reported",
    },
  ];
  context.claimRelations = [
    {
      id: "ctx-relation-contradicts",
      fromClaimId: "ctx-claim-high-water",
      toClaimId: "ctx-claim-three-participants",
      relationType: "contradicts",
      explanation: "The review fixture preserves a contradiction.",
      sourceIds: ["ctx-source-later-summary"],
    },
    {
      id: "ctx-relation-corrects",
      fromClaimId: "ctx-claim-high-water",
      toClaimId: "ctx-claim-three-participants",
      relationType: "corrects",
      explanation: "A correction relation does not delete either claim.",
      sourceIds: ["ctx-source-field-log"],
    },
    {
      id: "ctx-relation-supersedes",
      fromClaimId: "ctx-claim-high-water",
      toClaimId: "ctx-claim-three-participants",
      relationType: "supersedes",
      explanation: "The superseded claim remains reviewable.",
      sourceIds: ["ctx-source-field-log"],
    },
    {
      id: "ctx-relation-retracts",
      fromClaimId: "ctx-claim-three-participants",
      toClaimId: "ctx-claim-high-water",
      relationType: "retracts",
      explanation: "Retraction is represented as lineage, not deletion.",
      sourceIds: ["ctx-source-later-summary"],
    },
  ];
  context.claimVersions = [
    {
      id: "ctx-claim-high-water-v1",
      claimId: "ctx-claim-high-water",
      ordinal: 1,
      statement: "Water was recorded above the marker.",
      claimType: "condition",
      subjectId: "ctx-event-morning-observation",
      confidence: "moderate",
      uncertainty: "The marker height was not measured.",
      status: "corrected",
      changeType: "initial_import",
      attributionIds: ["ctx-attribution-high-water-asserted"],
      sourceIds: ["ctx-source-field-log"],
      origin: "import",
      current: false,
    },
    {
      id: "ctx-claim-high-water-v2",
      claimId: "ctx-claim-high-water",
      ordinal: 2,
      priorVersionId: "ctx-claim-high-water-v1",
      statement: "Corrected statement: the water was unusually high.",
      claimType: "condition",
      subjectId: "ctx-event-morning-observation",
      confidence: "moderate",
      uncertainty: "The account supplies no measurement.",
      status: "accepted",
      changeType: "correction",
      changeReason: "The wording now follows the supplied account.",
      attributionIds: [
        "ctx-attribution-high-water-asserted",
        "ctx-attribution-high-water-recorded",
      ],
      sourceIds: ["ctx-source-field-log"],
      origin: "correction",
      current: false,
    },
    {
      id: "ctx-claim-high-water-v3",
      claimId: "ctx-claim-high-water",
      ordinal: 3,
      priorVersionId: "ctx-claim-high-water-v2",
      statement: "The high-water wording was retracted after review.",
      claimType: "condition",
      subjectId: "ctx-event-morning-observation",
      confidence: "withdrawn",
      uncertainty: "The earlier recorded wording remains historical.",
      status: "retracted",
      changeType: "retraction",
      changeReason: "Retained to prove non-destructive retraction history.",
      sourceIds: ["ctx-source-later-summary"],
      origin: "retraction",
      current: true,
    },
    {
      id: "ctx-claim-high-water-v4-draft",
      claimId: "ctx-claim-high-water",
      ordinal: 4,
      priorVersionId: "ctx-claim-high-water-v3",
      statement: "Unpublished moderation proposal wording.",
      claimType: "condition",
      subjectId: "ctx-event-morning-observation",
      status: "draft",
      changeType: "proposal",
      sourceIds: ["ctx-source-later-summary"],
      origin: "custom:moderation",
      current: false,
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
      status: "superseded",
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
      explanation: "The link targets the corrected historical wording.",
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
      explanation: "The same log supplies background only.",
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

async function seedReview() {
  await importBundle(await reviewBundle()).expect(201);
}

async function claimReview(
  claimId = "ctx-claim-high-water",
  query = "",
) {
  return request(app)
    .get(`/api/v1/context/review/claims/${claimId}${query}`)
    .expect(200);
}

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("1. record review returns visible contextual claims", async () => {
  await seedReview();
  const response = await request(app)
    .get(
      "/api/v1/context/review/records/ctx-event-morning-observation",
    )
    .expect(200);
  assert.equal(response.body.total, 2);
  assert.deepEqual(
    response.body.claims.map(
      (item: { id: string }) => item.id,
    ),
    ["ctx-claim-three-participants", "ctx-claim-high-water"],
  );
});

test("2. claim review returns current claim and current-version identity", async () => {
  await seedReview();
  const response = await claimReview();
  assert.equal(response.body.claim.id, "ctx-claim-high-water");
  assert.equal(
    response.body.currentVersionId,
    "ctx-claim-high-water-v3",
  );
  assert.equal(response.body.currentVersion.current, true);
  assert.equal(response.body.displayState, "current");
});

test("3. historical review is visibly distinct from current review", async () => {
  await seedReview();
  const response = await claimReview(
    "ctx-claim-high-water",
    "?version=ctx-claim-high-water-v1",
  );
  assert.equal(response.body.displayState, "historical");
  assert.equal(
    response.body.selectedVersion.id,
    "ctx-claim-high-water-v1",
  );
  assert.equal(
    response.body.currentVersion.id,
    "ctx-claim-high-water-v3",
  );
  assert.notEqual(
    response.body.selectedStatement,
    response.body.currentVersion.statement,
  );
});

test("4. legacy claim receives no fabricated immutable history", async () => {
  await importBundle(await baseBundle()).expect(201);
  const response = await claimReview();
  assert.equal(response.body.displayState, "legacy-current");
  assert.equal(response.body.hasVersionHistory, false);
  assert.equal(response.body.currentVersion, null);
  assert.deepEqual(response.body.versions.items, []);
});

test("5. attribution roles remain distinct", async () => {
  await seedReview();
  const response = await claimReview();
  assert.deepEqual(
    Object.keys(response.body.attributions.groups ?? {}).sort(),
    ["asserted_by", "recorded_by"],
  );
  assert.deepEqual(
    response.body.attributions.items.map(
      (item: { attributionRole: string }) =>
        item.attributionRole,
    ),
    ["asserted_by", "recorded_by"],
  );
});

test("6. a reporting source is not classified as supporting evidence", async () => {
  await seedReview();
  const response = await claimReview();
  assert.ok(response.body.sources.items.some(
    (source: { sourceId: string }) =>
      source.sourceId === "ctx-source-later-summary",
  ));
  assert.equal(
    response.body.evidence.items.some(
      (item: {
        supportRole: string;
        linkSourceIds: string[];
      }) =>
        item.supportRole === "supports"
        && item.linkSourceIds.includes("ctx-source-later-summary"),
    ),
    false,
  );
});

test("7. evidence roles remain explicit and grouped correctly", async () => {
  await seedReview();
  const response = await claimReview("ctx-claim-three-participants");
  assert.equal(response.body.evidence.groups.disputes.length, 1);
  assert.equal(
    response.body.evidence.groups.contextualizes.length,
    1,
  );
  assert.equal(response.body.evidence.groups.supports, undefined);
});

test("8. evidence can target a specific historical claim version", async () => {
  await seedReview();
  const response = await claimReview();
  assert.equal(
    response.body.evidence.items[0].claimVersionId,
    "ctx-claim-high-water-v2",
  );
  assert.equal(response.body.evidence.items[0].supportRole, "supports");
  assert.equal(response.body.evidence.items[0].normalizedLinkSupplied, true);
});

test("9. source locator fields survive the review projection", async () => {
  await seedReview();
  const response = await claimReview();
  const locator = response.body.evidence.items[0].sourceLocators[0];
  assert.equal(locator.locatorLabel, "p. 14, water-level entry");
  assert.equal(locator.locator.page, 14);
  assert.equal(locator.excerpt, "Water above the marker.");
});

test("10. related claim relationship types remain distinct", async () => {
  await seedReview();
  const response = await claimReview();
  assert.deepEqual(
    Object.keys(response.body.relatedClaims.groups).sort(),
    ["contradicts", "corrects", "retracts", "supersedes"],
  );
});

test("11. correction lineage preserves both corrected versions", async () => {
  await seedReview();
  const response = await claimReview();
  const first = response.body.versions.items.find(
    (item: { id: string }) => item.id === "ctx-claim-high-water-v1",
  );
  const second = response.body.versions.items.find(
    (item: { id: string }) => item.id === "ctx-claim-high-water-v2",
  );
  assert.equal(first.status, "corrected");
  assert.deepEqual(first.successorVersionIds, ["ctx-claim-high-water-v2"]);
  assert.equal(second.priorVersionId, "ctx-claim-high-water-v1");
  assert.equal(second.changeType, "correction");
});

test("12. retraction remains visible and does not delete history", async () => {
  await seedReview();
  const response = await claimReview();
  assert.equal(response.body.versions.pagination.total, 3);
  const retraction = response.body.versions.items.find(
    (item: { status: string }) => item.status === "retracted",
  );
  assert.equal(retraction.id, "ctx-claim-high-water-v3");
  assert.equal(retraction.origin, "retraction");
});

test("13. supersession preserves the superseded claim", async () => {
  await seedReview();
  const response = await claimReview();
  const relation = response.body.relatedClaims.groups.supersedes[0];
  assert.equal(
    relation.relatedClaim.id,
    "ctx-claim-three-participants",
  );
  assert.equal(
    relation.relatedClaim.currentVersion.status,
    "superseded",
  );
});

test("14. field provenance remains attached to the correct field", async () => {
  await seedReview();
  const response = await claimReview();
  const provenance = response.body.provenance.groups.changeReason[0];
  assert.equal(
    provenance.subrecordId,
    "ctx-claim-high-water-v2",
  );
  assert.equal(provenance.supportType, "records-wording");
  assert.equal(
    response.body.evidence.items[0].fieldProvenance[0].fieldPath,
    "sourceLocators",
  );
});

test("15. historical search identifies stable claim and matched version", async () => {
  await seedReview();
  const response = await request(app)
    .get(
      "/api/v1/search?q=above%20the%20marker&type=context-claim-version",
    )
    .expect(200);
  assert.equal(response.body.total, 1);
  assert.equal(
    response.body.results[0].metadata.claimId,
    "ctx-claim-high-water",
  );
  assert.equal(
    response.body.results[0].metadata.matchedVersionId,
    "ctx-claim-high-water-v1",
  );
  assert.equal(response.body.results[0].metadata.isHistorical, true);
  assert.match(
    response.body.results[0].metadata.reviewUrl,
    /version=ctx-claim-high-water-v1/,
  );
});

test("16. pagination is deterministic and bounded", async () => {
  await seedReview();
  const path =
    "/api/v1/context/review/claims/ctx-claim-high-water?versionsLimit=1";
  const first = await request(app).get(path).expect(200);
  const second = await request(app).get(path).expect(200);
  assert.deepEqual(first.body.versions, second.body.versions);
  assert.equal(first.body.versions.items.length, 1);
  assert.equal(first.body.versions.pagination.total, 3);
  assert.equal(first.body.versions.pagination.hasMore, true);
  const invalid = await request(app)
    .get(
      "/api/v1/context/review/claims/ctx-claim-high-water?versionsLimit=51",
    )
    .expect(400);
  assert.equal(invalid.body.field, "versionsLimit");
});

test("17. malformed IDs return the accepted validation envelope", async () => {
  const response = await request(app)
    .get("/api/v1/context/review/claims/%20bad")
    .set("x-request-id", "context-review-invalid-id")
    .expect("x-request-id", "context-review-invalid-id")
    .expect(400);
  assert.equal(response.body.code, "INVALID_CONTEXT_REVIEW_ID");
  assert.equal(response.body.status, 400);
  assert.equal(response.body.category, "invalid-query");
  assert.equal(response.body.field, "claimId");
  assert.equal(response.body.requestId, "context-review-invalid-id");
});

test("18. missing IDs return the accepted not-found envelope", async () => {
  const response = await request(app)
    .get("/api/v1/context/review/claims/ctx-claim-missing")
    .expect(404);
  assert.equal(response.body.code, "CONTEXT_REVIEW_CLAIM_NOT_FOUND");
  assert.equal(response.body.status, 404);
  assert.equal(response.body.category, "not-found");
  assert.equal(response.body.field, "claimId");
});

test("19. request IDs propagate through successful review responses", async () => {
  await seedReview();
  const response = await request(app)
    .get("/api/v1/context/review/claims/ctx-claim-high-water")
    .set("x-request-id", "context-review-request-id")
    .expect("x-request-id", "context-review-request-id")
    .expect(200);
  assert.equal(response.body.requestId, "context-review-request-id");
  assert.equal(response.body.contractVersion, "1.0");
});

test("20. GET review routes perform no writes", async () => {
  await seedReview();
  const pool = getPool();
  assert.ok(pool);
  const countSql = `
    SELECT JSONB_BUILD_OBJECT(
      'records', (SELECT COUNT(*) FROM context_records),
      'claims', (SELECT COUNT(*) FROM context_claims),
      'claimVersions', (SELECT COUNT(*) FROM context_claim_versions),
      'evidenceLinks', (SELECT COUNT(*) FROM context_evidence_claim_links),
      'provenance', (SELECT COUNT(*) FROM context_field_provenance)
    ) AS counts
  `;
  const before = await pool.query<{ counts: Record<string, number> }>(
    countSql,
  );
  await request(app)
    .get(
      "/api/v1/context/review/records/ctx-event-morning-observation",
    )
    .expect(200);
  await claimReview();
  const afterRead = await pool.query<{
    counts: Record<string, number>;
  }>(countSql);
  assert.deepEqual(afterRead.rows[0]?.counts, before.rows[0]?.counts);
});

test("21. hidden governance content is not leaked", async () => {
  await seedReview();
  const review = await claimReview();
  assert.equal(
    review.body.versions.items.some(
      (item: { id: string }) =>
        item.id === "ctx-claim-high-water-v4-draft",
    ),
    false,
  );
  assert.equal(review.body.versions.pagination.total, 3);
  await request(app)
    .get(
      "/api/v1/context/review/claims/ctx-claim-high-water?version=ctx-claim-high-water-v4-draft",
    )
    .expect(404);
  const search = await request(app)
    .get(
      "/api/v1/search?q=unpublished%20moderation&type=context-claim-version",
    )
    .expect(200);
  assert.equal(search.body.total, 0);
});

test("22. partial missing child records fail safely", async () => {
  await seedReview();
  const pool = getPool();
  assert.ok(pool);
  await pool.query(
    `
      UPDATE context_records
      SET status = 'governance-withdrawn'
      WHERE context_id = 'ctx-account-field-log-entry'
    `,
  );
  const response = await claimReview();
  assert.equal(response.body.claim.id, "ctx-claim-high-water");
  assert.equal(response.body.reportingAccount, null);
  assert.equal(response.body.diagnostics.reportingAccountUnavailable, true);
  assert.equal(response.body.diagnostics.partial, true);
});

test("23. existing context endpoints remain compatible", async () => {
  await seedReview();
  const response = await request(app)
    .get("/api/v1/context/claims/ctx-claim-high-water")
    .expect(200);
  assert.equal(response.body.id, "ctx-claim-high-water");
  assert.equal(response.body.attributions.length, 2);
  assert.equal(response.body.versions.length, 4);
  assert.equal(
    response.body.currentVersion.id,
    "ctx-claim-high-water-v3",
  );
});

test("24. existing search consumers remain compatible", async () => {
  await seedReview();
  const response = await request(app)
    .get("/api/v1/search?q=unusually%20high&type=context-claim")
    .expect(200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.results[0].id, "ctx-claim-high-water");
  assert.equal(
    response.body.results[0].resultType,
    "context-claim",
  );
  assert.deepEqual(response.body.items, response.body.results);
  assert.equal(response.body.contractVersion, "1.0");
  assert.equal(
    response.body.results[0].metadata.parentRecordId,
    "ctx-event-morning-observation",
  );
  assert.match(
    response.body.results[0].metadata.reviewUrl,
    /claim=ctx-claim-high-water/,
  );
});
