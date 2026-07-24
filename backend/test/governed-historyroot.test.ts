import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { getPool } from "../src/lib/database.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

process.env.ALLOW_DEVELOPMENT_AUTH = "true";
process.env.ALLOW_SELF_APPROVAL = "false";

const app = createApp();
const bundleId = "sourceroot-integration-test-contextual-foundation";
const fixtureUrl = new URL(
  "./fixtures/contextual-historyroot-valid.json",
  import.meta.url,
);

type SessionActor = {
  agent: ReturnType<typeof request.agent>;
  userId: string;
  csrfToken: string;
};

type TestActors = {
  contributor: SessionActor;
  reviewer: SessionActor;
  publisher: SessionActor;
  outsider: SessionActor;
  organizationId: string;
  otherOrganizationId: string;
};

let actors: TestActors;

function pool() {
  const value = getPool();
  if (!value) throw new Error("Test database is not configured.");
  return value;
}

async function importContextFixture(): Promise<void> {
  const fixture = JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  ) as Record<string, unknown>;
  const sources = fixture.sources as Array<Record<string, unknown>>;
  for (const source of sources) {
    source.accessStatus = "accessed-and-inspected";
    source.locatorsInspected = [`Fixture locator for ${String(source.id)}`];
    source.limitations =
      "Invented technical fixture only; it does not support historical conclusions.";
    source.supportsDetailedClaims = true;
  }
  await request(app)
    .post("/api/v1/import")
    .set(
      "x-sourceroot-import-token",
      process.env.IMPORT_SERVICE_TOKEN || "",
    )
    .send(fixture)
    .expect(201);
}

async function signIn(
  email: string,
  displayName: string,
): Promise<SessionActor> {
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/development/sign-in")
    .send({ email, displayName, returnTo: "/history-governance-v1.html" })
    .expect(200);
  const session = await agent
    .get("/api/v1/auth/session")
    .expect(200);
  return {
    agent,
    userId: session.body.user.userId as string,
    csrfToken: session.body.csrfToken as string,
  };
}

async function addOrganizationRole(
  actor: SessionActor,
  organizationId: string,
  roleKey: "contributor" | "reviewer" | "publisher",
): Promise<void> {
  await pool().query(
    `INSERT INTO dr_organization_memberships(
       membership_id, organization_id, user_id, membership_status, joined_at
     ) VALUES ($1,$2,$3,'active',CURRENT_TIMESTAMP)`,
    [randomUUID(), organizationId, actor.userId],
  );
  await pool().query(
    `INSERT INTO dr_role_assignments(
       assignment_id, user_id, role_key, scope_type, scope_id
     ) VALUES ($1,$2,$3,'organization',$4)`,
    [randomUUID(), actor.userId, roleKey, organizationId],
  );
}

async function setupActors(): Promise<TestActors> {
  const contributor = await signIn(
    "history-contributor@example.test",
    "History Contributor",
  );
  const reviewer = await signIn(
    "history-reviewer@example.test",
    "History Reviewer",
  );
  const publisher = await signIn(
    "history-publisher@example.test",
    "History Publisher",
  );
  const outsider = await signIn(
    "history-outsider@example.test",
    "Other Organization Reviewer",
  );
  const organizationId = randomUUID();
  const otherOrganizationId = randomUUID();
  await pool().query(
    `INSERT INTO dr_organizations(
       organization_id, organization_name, organization_slug,
       created_by_user_id
     ) VALUES
       ($1,'History Editorial Test','history-editorial-test',$3),
       ($2,'Other Editorial Test','other-editorial-test',$4)`,
    [
      organizationId,
      otherOrganizationId,
      contributor.userId,
      outsider.userId,
    ],
  );
  await addOrganizationRole(contributor, organizationId, "contributor");
  await addOrganizationRole(reviewer, organizationId, "reviewer");
  await addOrganizationRole(publisher, organizationId, "publisher");
  await addOrganizationRole(outsider, otherOrganizationId, "reviewer");
  return {
    contributor,
    reviewer,
    publisher,
    outsider,
    organizationId,
    otherOrganizationId,
  };
}

function mutation(actor: SessionActor) {
  return {
    post(path: string) {
      return actor.agent.post(path).set("x-csrf-token", actor.csrfToken);
    },
    patch(path: string) {
      return actor.agent.patch(path).set("x-csrf-token", actor.csrfToken);
    },
  };
}

async function createEntityProposal(
  title = "Add a governed place alias",
  alias = "Cedar Bend",
) {
  const response = await mutation(actors.contributor)
    .post("/api/v1/governance/proposals")
    .send({
      organizationId: actors.organizationId,
      targetType: "entity",
      targetId: "ctx-place-cedar-reach",
      rootKey: "historyroot",
      bundleId,
      changeType: "alias_addition",
      title,
      summary: "Add a documented alternate place name.",
      proposedPatch: {
        alternateNames: ["North Bend Reach", alias],
      },
      editorialRationale:
        "The alias is represented as naming context, not a merged entity.",
      interpretationDisclosure: "",
      evidence: [],
    })
    .expect(201);
  return response.body;
}

function transition(
  actor: SessionActor,
  proposalId: string,
  action: string,
  note = "",
) {
  return mutation(actor)
    .post(`/api/v1/governance/proposals/${proposalId}/${action}`)
    .send({ note });
}

beforeEach(async () => {
  await resetTestDatabase();
  await importContextFixture();
  actors = await setupActors();
});

after(async () => {
  await closeTestDatabase();
});

test("public contextual reads remain unauthenticated while governance requires a session", async () => {
  await request(app)
    .get("/api/v1/context/records/ctx-place-cedar-reach")
    .expect(200);
  const protectedResponse = await request(app)
    .get("/api/v1/governance/summary")
    .expect(401);
  assert.equal(protectedResponse.body.error, "AUTHENTICATION_REQUIRED");
  assert.equal(protectedResponse.headers["cache-control"], "no-store");
});

test("contributors create canonical-base drafts and save structured changes", async () => {
  const created = await createEntityProposal();
  assert.equal(created.proposal.status, "draft");
  assert.equal(created.proposal.rootKey, "historyroot");
  assert.equal(created.proposal.bundleId, bundleId);
  assert.match(created.proposal.baseVersionToken, /^sha256:/);
  assert.equal(
    created.proposal.validation.valid,
    true,
    JSON.stringify(created.proposal.validation),
  );
  assert.equal(created.currentPublished.name, "Cedar Reach");
  assert.deepEqual(created.proposedRecord.alternateNames, [
    "North Bend Reach",
    "Cedar Bend",
  ]);

  const saved = await mutation(actors.contributor)
    .patch(
      `/api/v1/governance/proposals/${created.proposal.proposalId}`,
    )
    .send({
      title: "Add a revised governed place alias",
      summary: "Use the more precise alternate name.",
      proposedPatch: {
        alternateNames: ["North Bend Reach", "Cedar Reach Bend"],
      },
      editorialRationale: "Preserve the canonical entity and naming context.",
      interpretationDisclosure: "",
      evidence: [],
    })
    .expect(200);
  assert.equal(saved.body.proposal.versionNumber, 2);
  assert.deepEqual(saved.body.proposedRecord.alternateNames, [
    "North Bend Reach",
    "Cedar Reach Bend",
  ]);
});

test("contributors submit, reviewers request changes, and contributors resubmit", async () => {
  const created = await createEntityProposal();
  const proposalId = created.proposal.proposalId as string;
  await transition(actors.contributor, proposalId, "submit")
    .expect(200)
    .expect((response) => {
      assert.equal(response.body.proposal.status, "submitted");
    });
  await transition(actors.reviewer, proposalId, "start-review")
    .expect(200);
  await transition(
    actors.reviewer,
    proposalId,
    "request-changes",
    "Document the naming context.",
  )
    .expect(200)
    .expect((response) => {
      assert.equal(response.body.proposal.status, "changes_requested");
      assert.ok(
        response.body.comments.some(
          (item: { commentType: string }) =>
            item.commentType === "change_request",
        ),
      );
    });
  await mutation(actors.contributor)
    .patch(`/api/v1/governance/proposals/${proposalId}`)
    .send({
      title: "Add a governed place alias with naming context",
      summary: "Add a distinct alternate place name.",
      proposedPatch: {
        alternateNames: ["North Bend Reach", "Cedar Reach Bend"],
        metadata: { namingNote: "Invented technical fixture alias." },
      },
      editorialRationale: "Naming context is now explicit.",
      interpretationDisclosure: "",
      evidence: [],
    })
    .expect(200);
  await transition(actors.contributor, proposalId, "submit")
    .expect(200)
    .expect((response) => {
      assert.equal(response.body.proposal.status, "submitted");
    });
});

test("reviewers may reject or approve but cannot self-approve contributor work", async () => {
  const rejected = await createEntityProposal("Rejected alias", "Old Ford");
  const rejectedId = rejected.proposal.proposalId as string;
  await transition(actors.contributor, rejectedId, "submit").expect(200);
  await transition(actors.reviewer, rejectedId, "reject", "Insufficient context")
    .expect(200)
    .expect((response) => {
      assert.equal(response.body.proposal.status, "rejected");
    });

  const own = await mutation(actors.reviewer)
    .post("/api/v1/governance/proposals")
    .send({
      organizationId: actors.organizationId,
      targetType: "entity",
      targetId: "ctx-place-cedar-reach",
      rootKey: "historyroot",
      bundleId,
      changeType: "alias_addition",
      title: "Reviewer-owned proposal",
      summary: "",
      proposedPatch: {
        alternateNames: ["North Bend Reach", "Reviewer Alias"],
      },
      editorialRationale: "Technical test.",
      interpretationDisclosure: "",
      evidence: [],
    })
    .expect(201);
  const ownId = own.body.proposal.proposalId as string;
  await transition(actors.reviewer, ownId, "submit").expect(200);
  const blocked = await transition(actors.reviewer, ownId, "approve")
    .expect(409);
  assert.equal(blocked.body.error, "SELF_APPROVAL_BLOCKED");
});

test("organization scoping returns an indistinguishable not-found response", async () => {
  const created = await createEntityProposal();
  const proposalId = created.proposal.proposalId as string;
  const inaccessible = await actors.outsider.agent
    .get(`/api/v1/governance/proposals/${proposalId}`)
    .expect(404);
  const missing = await actors.outsider.agent
    .get(`/api/v1/governance/proposals/${randomUUID()}`)
    .expect(404);
  assert.equal(inaccessible.body.error, "PROPOSAL_NOT_FOUND");
  assert.equal(missing.body.error, "PROPOSAL_NOT_FOUND");
});

test("approved publication atomically updates public APIs and revision history", async () => {
  const created = await createEntityProposal();
  const proposalId = created.proposal.proposalId as string;
  await transition(actors.contributor, proposalId, "submit").expect(200);
  await transition(actors.reviewer, proposalId, "approve", "Reviewed")
    .expect(200);

  const contributorPublish = await transition(
    actors.contributor,
    proposalId,
    "publish",
  );
  assert.equal(contributorPublish.status, 403);

  const published = await mutation(actors.publisher)
    .post(`/api/v1/governance/proposals/${proposalId}/publish`)
    .send({ note: "Publish reviewed alias." })
    .expect(201);
  assert.equal(published.body.proposal.status, "published");
  assert.equal(published.body.publications.length, 1);

  const publicRecord = await request(app)
    .get("/api/v1/context/records/ctx-place-cedar-reach")
    .expect(200);
  assert.ok(publicRecord.body.alternateNames.includes("Cedar Bend"));

  const revisions = await request(app)
    .get(
      `/api/v1/revisions?bundleId=${bundleId}&objectType=entity&objectId=ctx-place-cedar-reach`,
    )
    .expect(200);
  assert.equal(revisions.body.total, 1);
  assert.equal(revisions.body.items[0].revisionType, "governed-publication");
  assert.equal(revisions.body.items[0].rawData.proposalId, proposalId);
});

test("drafts and rejected proposals never change public content", async () => {
  const draft = await createEntityProposal("Draft-only alias", "Draft Secret");
  let publicRecord = await request(app)
    .get("/api/v1/context/records/ctx-place-cedar-reach")
    .expect(200);
  assert.ok(!publicRecord.body.alternateNames.includes("Draft Secret"));

  await transition(
    actors.contributor,
    draft.proposal.proposalId,
    "submit",
  ).expect(200);
  await transition(
    actors.reviewer,
    draft.proposal.proposalId,
    "reject",
    "Do not publish.",
  ).expect(200);
  publicRecord = await request(app)
    .get("/api/v1/context/records/ctx-place-cedar-reach")
    .expect(200);
  assert.ok(!publicRecord.body.alternateNames.includes("Draft Secret"));
});

test("rollback restores the prior record and preserves revisions, audit, IDs, and unrelated data", async () => {
  const unrelatedBefore = await request(app)
    .get("/api/v1/context/records/ctx-person-mara-quill")
    .expect(200);
  const created = await createEntityProposal();
  const proposalId = created.proposal.proposalId as string;
  await transition(actors.contributor, proposalId, "submit").expect(200);
  await transition(actors.reviewer, proposalId, "approve").expect(200);
  const published = await mutation(actors.publisher)
    .post(`/api/v1/governance/proposals/${proposalId}/publish`)
    .send({ note: "Publish for rollback test." })
    .expect(201);
  const publicationId =
    published.body.publications[0].publicationId as string;

  await mutation(actors.publisher)
    .post(`/api/v1/governance/publications/${publicationId}/rollback`)
    .send({ reason: "Reversible integration test." })
    .expect(200);

  const restored = await request(app)
    .get("/api/v1/context/records/ctx-place-cedar-reach")
    .expect(200);
  assert.equal(restored.body.id, "ctx-place-cedar-reach");
  assert.deepEqual(restored.body.alternateNames, ["North Bend Reach"]);
  const unrelatedAfter = await request(app)
    .get("/api/v1/context/records/ctx-person-mara-quill")
    .expect(200);
  assert.equal(unrelatedAfter.body.name, unrelatedBefore.body.name);

  const counts = await pool().query<Record<string, string>>(
    `SELECT
       (SELECT COUNT(*) FROM imported_bundles) AS bundles,
       (SELECT COUNT(*) FROM revisions WHERE object_id='ctx-place-cedar-reach') AS revisions,
       (SELECT COUNT(*) FROM dr_audit_events WHERE target_id=$1) AS audits,
       (SELECT COUNT(*) FROM dr_proposal_events WHERE proposal_id=$1::UUID) AS events`,
    [proposalId],
  );
  assert.equal(Number(counts.rows[0]?.bundles), 1);
  assert.equal(Number(counts.rows[0]?.revisions), 2);
  assert.ok(Number(counts.rows[0]?.audits) >= 4);
  assert.ok(Number(counts.rows[0]?.events) >= 4);
});

test("new records publish only after approval and rollback becomes non-public without deletion", async () => {
  const targetId = "ctx-claim-governed-new";
  const created = await mutation(actors.contributor)
    .post("/api/v1/governance/proposals")
    .send({
      organizationId: actors.organizationId,
      targetType: "claim",
      targetId,
      rootKey: "historyroot",
      bundleId,
      changeType: "new_claim",
      title: "Add an evidence-backed fixture claim",
      summary: "A new technical claim.",
      proposedPatch: {
        label: "Governed fixture claim",
        accountId: "ctx-account-field-log-entry",
        subjectId: "ctx-place-cedar-reach",
        claimType: "technical-fixture",
        statement: "The invented field log names Cedar Reach.",
        confidence: "limited",
        uncertainty: "Invented fixture only.",
        status: "fixture",
      },
      editorialRationale: "Exercise governed new-record publication.",
      interpretationDisclosure: "",
      evidence: [
        {
          sourceId: "ctx-source-field-log",
          note: "Fixture locator was inspected.",
          role: "supporting",
        },
      ],
    })
    .expect(201);
  assert.equal(created.body.proposal.validation.valid, true);
  await request(app)
    .get(`/api/v1/context/records/${targetId}`)
    .expect(404);

  const proposalId = created.body.proposal.proposalId as string;
  await transition(actors.contributor, proposalId, "submit").expect(200);
  await transition(actors.reviewer, proposalId, "approve").expect(200);
  const published = await mutation(actors.publisher)
    .post(`/api/v1/governance/proposals/${proposalId}/publish`)
    .send({ note: "Publish new fixture claim." })
    .expect(201);
  await request(app)
    .get(`/api/v1/context/records/${targetId}`)
    .expect(200);

  const publicationId =
    published.body.publications[0].publicationId as string;
  await mutation(actors.publisher)
    .post(`/api/v1/governance/publications/${publicationId}/rollback`)
    .send({ reason: "Remove the reversible fixture from public reads." })
    .expect(200);
  await request(app)
    .get(`/api/v1/context/records/${targetId}`)
    .expect(404);
  const retained = await pool().query(
    "SELECT status FROM context_records WHERE context_id=$1",
    [targetId],
  );
  assert.equal(retained.rowCount, 1);
  assert.equal(retained.rows[0]?.status, "governance-withdrawn");
});

test("historical validation blocks unsupported claims and certainty escalation", async () => {
  const claim = await mutation(actors.contributor)
    .post("/api/v1/governance/proposals")
    .send({
      organizationId: actors.organizationId,
      targetType: "claim",
      targetId: "ctx-claim-no-evidence",
      rootKey: "historyroot",
      bundleId,
      changeType: "new_claim",
      title: "Unsupported fixture claim",
      summary: "",
      proposedPatch: {
        label: "Unsupported claim",
        accountId: "ctx-account-field-log-entry",
        subjectId: "ctx-place-cedar-reach",
        claimType: "technical-fixture",
        statement: "An unsupported substantive claim.",
      },
      editorialRationale: "",
      interpretationDisclosure: "",
      evidence: [],
    })
    .expect(201);
  assert.equal(claim.body.proposal.validation.valid, false);
  assert.ok(
    claim.body.proposal.validation.errors.some(
      (item: { code: string }) => item.code === "CLAIM_EVIDENCE_REQUIRED",
    ),
  );
  const blockedClaim = await transition(
    actors.contributor,
    claim.body.proposal.proposalId,
    "submit",
  ).expect(422);
  assert.equal(blockedClaim.body.error, "GOVERNANCE_VALIDATION_FAILED");

  const chronology = await mutation(actors.contributor)
    .post("/api/v1/governance/proposals")
    .send({
      organizationId: actors.organizationId,
      targetType: "temporal_assertion",
      targetId: "ctx-time-observation-approximate",
      rootKey: "historyroot",
      bundleId,
      changeType: "temporal_precision_change",
      title: "Make an approximate date exact",
      summary: "",
      proposedPatch: {
        temporalKind: "exact",
        exactDate: "1894-05-10",
        dateLabel: "10 May 1894",
        startUncertainty: null,
        endUncertainty: null,
        dateNotes: null,
      },
      editorialRationale: "",
      interpretationDisclosure: "",
      evidence: [],
    })
    .expect(201);
  assert.equal(chronology.body.proposal.validation.valid, false);
  const codes = chronology.body.proposal.validation.errors.map(
    (item: { code: string }) => item.code,
  );
  assert.ok(codes.includes("TEMPORAL_CERTAINTY_SUPPORT_REQUIRED"));
  assert.ok(codes.includes("UNCERTAINTY_REMOVAL_UNJUSTIFIED"));
});

test("historical validation protects attribution, causality, cultural memory, and aliases", async () => {
  const perspective = await mutation(actors.contributor)
    .post("/api/v1/governance/proposals")
    .send({
      organizationId: actors.organizationId,
      targetType: "perspective",
      targetId: "ctx-perspective-unattributed",
      rootKey: "historyroot",
      bundleId,
      changeType: "new_perspective",
      title: "Unattributed perspective",
      summary: "",
      proposedPatch: {
        label: "Unattributed perspective",
        name: "A generic perspective",
        description: "No attributable source support.",
      },
      editorialRationale: "",
      interpretationDisclosure: "",
      evidence: [],
    })
    .expect(201);
  assert.ok(
    perspective.body.proposal.validation.errors.some(
      (item: { code: string }) =>
        item.code === "PERSPECTIVE_ATTRIBUTION_REQUIRED",
    ),
  );

  const causal = await mutation(actors.contributor)
    .post("/api/v1/governance/proposals")
    .send({
      organizationId: actors.organizationId,
      targetType: "causal_link",
      targetId: "ctx-cause-unqualified",
      rootKey: "historyroot",
      bundleId,
      changeType: "new_causal_relationship",
      title: "Unqualified causality",
      summary: "",
      proposedPatch: {
        label: "Unqualified fixture cause",
        causeId: "ctx-event-regional-rainfall",
        effectId: "ctx-event-morning-observation",
        causalKind: "cause",
        explanation: "Claims deterministic causation.",
        sourceIds: ["ctx-source-field-log"],
      },
      editorialRationale: "",
      interpretationDisclosure: "",
      evidence: [{ sourceId: "ctx-source-field-log" }],
    })
    .expect(201);
  assert.ok(
    causal.body.proposal.validation.errors.some(
      (item: { code: string }) =>
        item.code === "CAUSAL_QUALIFICATION_REQUIRED",
    ),
  );

  const memory = await mutation(actors.contributor)
    .post("/api/v1/governance/proposals")
    .send({
      organizationId: actors.organizationId,
      targetType: "cultural_memory",
      targetId: "ctx-memory-crossing-story",
      rootKey: "historyroot",
      bundleId,
      changeType: "cultural_memory_classification_update",
      title: "Reclassify a memory record",
      summary: "",
      proposedPatch: { memoryType: "political-memory" },
      editorialRationale: "Test reviewer warning.",
      interpretationDisclosure: "",
      evidence: [],
    })
    .expect(201);
  assert.ok(
    memory.body.proposal.validation.warnings.some(
      (item: { code: string }) =>
        item.code === "CULTURAL_MEMORY_RECLASSIFIED",
    ),
  );

  const alias = await mutation(actors.contributor)
    .post("/api/v1/governance/proposals")
    .send({
      organizationId: actors.organizationId,
      targetType: "entity",
      targetId: "ctx-place-cedar-reach",
      rootKey: "historyroot",
      bundleId,
      changeType: "alias_addition",
      title: "Duplicate another entity",
      summary: "",
      proposedPatch: {
        alternateNames: ["Mara Quill"],
      },
      editorialRationale: "",
      interpretationDisclosure: "",
      evidence: [],
    })
    .expect(201);
  assert.ok(
    alias.body.proposal.validation.errors.some(
      (item: { code: string }) => item.code === "DUPLICATE_ENTITY_NAME",
    ),
  );
});

test("concurrent proposals detect stale bases before overwrite or partial publication", async () => {
  const first = await createEntityProposal("First proposal", "First Alias");
  const second = await createEntityProposal("Second proposal", "Second Alias");
  const firstId = first.proposal.proposalId as string;
  const secondId = second.proposal.proposalId as string;

  await transition(actors.contributor, firstId, "submit").expect(200);
  await transition(actors.reviewer, firstId, "approve").expect(200);
  await mutation(actors.publisher)
    .post(`/api/v1/governance/proposals/${firstId}/publish`)
    .send({ note: "Publish the first concurrent proposal." })
    .expect(201);

  const stale = await transition(
    actors.contributor,
    secondId,
    "submit",
  ).expect(409);
  assert.equal(stale.body.error, "STALE_PROPOSAL_BASE");
  const publicRecord = await request(app)
    .get("/api/v1/context/records/ctx-place-cedar-reach")
    .expect(200);
  assert.ok(publicRecord.body.alternateNames.includes("First Alias"));
  assert.ok(!publicRecord.body.alternateNames.includes("Second Alias"));
  const counts = await pool().query<Record<string, string>>(
    `SELECT
       (SELECT COUNT(*) FROM dr_publications) AS publications,
       (SELECT COUNT(*) FROM revisions WHERE revision_type='governed-publication') AS revisions`,
  );
  assert.equal(Number(counts.rows[0]?.publications), 1);
  assert.equal(Number(counts.rows[0]?.revisions), 1);
});
