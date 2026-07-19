import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { getPool } from "../src/lib/database.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

const app = createApp();

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

const validFixtureUrl = new URL(
  "./fixtures/historyroot-valid.json",
  import.meta.url,
);

const brokenFixtureUrl = new URL(
  "./fixtures/broken-bundle.json",
  import.meta.url,
);

async function readJsonFixture(
  fileUrl: URL,
): Promise<Record<string, unknown>> {
  const contents = await readFile(fileUrl, "utf8");
  return JSON.parse(contents) as Record<string, unknown>;
}

test("POST /api/v1/import stores a valid bundle", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  const response = await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect("Content-Type", /json/)
    .expect(201);

  assert.equal(response.body.imported, true);
  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.validation.status, "ready");
  assert.equal(response.body.validation.canImport, true);
  assert.equal(response.body.validation.summary.errors, 0);
});

test("POST /api/v1/import populates normalized knowledge tables", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const pool = getPool();

  if (!pool) {
    throw new Error(
      "Test database is not configured. Confirm that .env.test contains DATABASE_URL.",
    );
  }

  const result = await pool.query<{
    sources: string;
    nodes: string;
    assertions: string;
    edges: string;
    revisions: string;
    node_sources: string;
    assertion_sources: string;
    edge_sources: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM sources) AS sources,
      (SELECT COUNT(*) FROM nodes) AS nodes,
      (SELECT COUNT(*) FROM assertions) AS assertions,
      (SELECT COUNT(*) FROM edges) AS edges,
      (SELECT COUNT(*) FROM revisions) AS revisions,
      (SELECT COUNT(*) FROM node_sources) AS node_sources,
      (SELECT COUNT(*) FROM assertion_sources) AS assertion_sources,
      (SELECT COUNT(*) FROM edge_sources) AS edge_sources;
  `);

  const counts = result.rows[0];

  if (!counts) {
    throw new Error("Normalized table count query returned no result.");
  }

  assert.equal(Number(counts.sources), 11);
  assert.equal(Number(counts.nodes), 11);
  assert.equal(Number(counts.assertions), 13);
  assert.equal(Number(counts.edges), 11);
  assert.equal(Number(counts.revisions), 2);
  assert.equal(Number(counts.node_sources), 26);
  assert.equal(Number(counts.assertion_sources), 22);
  assert.equal(Number(counts.edge_sources), 12);
});

test("POST /api/v1/import rolls back the entire import on database failure", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);
  const sources = bundle.sources;

  if (
    !Array.isArray(sources) ||
    typeof sources[0] !== "object" ||
    sources[0] === null
  ) {
    throw new Error("Expected the fixture to contain at least one source.");
  }

  (sources[0] as Record<string, unknown>).lastReviewed =
    "not-a-valid-date";

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(500);

  const pool = getPool();

  if (!pool) {
    throw new Error(
      "Test database is not configured. Confirm that .env.test contains DATABASE_URL.",
    );
  }

  const result = await pool.query<{
    imported_bundles: string;
    sources: string;
    nodes: string;
    assertions: string;
    edges: string;
    revisions: string;
    node_sources: string;
    assertion_sources: string;
    edge_sources: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM imported_bundles) AS imported_bundles,
      (SELECT COUNT(*) FROM sources) AS sources,
      (SELECT COUNT(*) FROM nodes) AS nodes,
      (SELECT COUNT(*) FROM assertions) AS assertions,
      (SELECT COUNT(*) FROM edges) AS edges,
      (SELECT COUNT(*) FROM revisions) AS revisions,
      (SELECT COUNT(*) FROM node_sources) AS node_sources,
      (SELECT COUNT(*) FROM assertion_sources) AS assertion_sources,
      (SELECT COUNT(*) FROM edge_sources) AS edge_sources;
  `);

  const counts = result.rows[0];

  if (!counts) {
    throw new Error("Rollback verification query returned no result.");
  }

  assert.equal(Number(counts.imported_bundles), 0);
  assert.equal(Number(counts.sources), 0);
  assert.equal(Number(counts.nodes), 0);
  assert.equal(Number(counts.assertions), 0);
  assert.equal(Number(counts.edges), 0);
  assert.equal(Number(counts.revisions), 0);
  assert.equal(Number(counts.node_sources), 0);
  assert.equal(Number(counts.assertion_sources), 0);
  assert.equal(Number(counts.edge_sources), 0);
});

test("POST /api/v1/import safely replaces normalized records on re-import", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const pool = getPool();

  if (!pool) {
    throw new Error(
      "Test database is not configured. Confirm that .env.test contains DATABASE_URL.",
    );
  }

  const result = await pool.query<{
    imported_bundles: string;
    sources: string;
    nodes: string;
    assertions: string;
    edges: string;
    revisions: string;
    node_sources: string;
    assertion_sources: string;
    edge_sources: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM imported_bundles) AS imported_bundles,
      (SELECT COUNT(*) FROM sources) AS sources,
      (SELECT COUNT(*) FROM nodes) AS nodes,
      (SELECT COUNT(*) FROM assertions) AS assertions,
      (SELECT COUNT(*) FROM edges) AS edges,
      (SELECT COUNT(*) FROM revisions) AS revisions,
      (SELECT COUNT(*) FROM node_sources) AS node_sources,
      (SELECT COUNT(*) FROM assertion_sources) AS assertion_sources,
      (SELECT COUNT(*) FROM edge_sources) AS edge_sources;
  `);

  const counts = result.rows[0];

  if (!counts) {
    throw new Error("Re-import verification query returned no result.");
  }

  assert.equal(Number(counts.imported_bundles), 1);
  assert.equal(Number(counts.sources), 11);
  assert.equal(Number(counts.nodes), 11);
  assert.equal(Number(counts.assertions), 13);
  assert.equal(Number(counts.edges), 11);
  assert.equal(Number(counts.revisions), 2);
  assert.equal(Number(counts.node_sources), 26);
  assert.equal(Number(counts.assertion_sources), 22);
  assert.equal(Number(counts.edge_sources), 12);
});

test("GET /api/v1/nodes lists normalized nodes with default pagination", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/nodes")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 11);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.nodes.length, 11);

  assert.equal(
    response.body.nodes[0].title,
    "Catherine O'Leary",
  );
  assert.equal(
    response.body.nodes[0].nodeId,
    "person-catherine-oleary",
  );
  assert.equal(
    response.body.nodes[0].bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(response.body.nodes[0].domain, "HistoryRoot");
  assert.ok(Array.isArray(response.body.nodes[0].sourceIds));
  assert.equal(typeof response.body.nodes[0].createdAt, "string");
  assert.equal(typeof response.body.nodes[0].updatedAt, "string");
});

test("GET /api/v1/nodes filters normalized nodes", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get(
      "/api/v1/nodes?bundleId=historyroot-fire-events-v2&domain=HistoryRoot&nodeType=event&status=historical",
    )
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.nodes.length, 2);

  assert.deepEqual(
    response.body.nodes.map(
      (node: { nodeId: string }) => node.nodeId,
    ),
    [
      "event-great-chicago-fire",
      "event-peshtigo-fire",
    ],
  );

  for (const node of response.body.nodes) {
    assert.equal(node.bundleId, "historyroot-fire-events-v2");
    assert.equal(node.domain, "HistoryRoot");
    assert.equal(node.nodeType, "event");
    assert.equal(node.status, "historical");
  }
});

test("GET /api/v1/nodes rejects an invalid page", async () => {
  const response = await request(app)
    .get("/api/v1/nodes?page=0")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_PAGE");
  assert.equal(
    response.body.message,
    "page must be a positive integer.",
  );
});

test("GET /api/v1/nodes rejects an invalid limit", async () => {
  const response = await request(app)
    .get("/api/v1/nodes?limit=101")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_LIMIT");
  assert.equal(
    response.body.message,
    "limit must be an integer between 1 and 100.",
  );
});

test("GET /api/v1/nodes/:nodeId retrieves a normalized node", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/nodes/event-great-chicago-fire")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.nodeId, "event-great-chicago-fire");
  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.title, "Great Chicago Fire");
  assert.equal(response.body.nodeType, "event");
  assert.equal(response.body.domain, "HistoryRoot");
  assert.equal(response.body.status, "historical");

  assert.deepEqual(response.body.metadata, {
    startDate: "1871-10-08",
    endDate: "1871-10-10",
  });

  assert.equal(response.body.sourceIds.length, 8);
  assert.ok(response.body.sourceIds.includes("source-loc-guide"));
  assert.equal(typeof response.body.createdAt, "string");
  assert.equal(typeof response.body.updatedAt, "string");
});

test("GET /api/v1/nodes/:nodeId returns 404 for an unknown node", async () => {
  const response = await request(app)
    .get("/api/v1/nodes/does-not-exist")
    .expect("Content-Type", /json/)
    .expect(404);

  assert.equal(response.body.error, "NODE_NOT_FOUND");
  assert.match(response.body.message, /does-not-exist/);
});

test("GET /api/v1/nodes/:nodeId/assertions retrieves normalized assertions", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/nodes/event-great-chicago-fire/assertions")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.nodeId, "event-great-chicago-fire");
  assert.equal(response.body.total, 5);
  assert.equal(response.body.assertions.length, 5);

  const fireDates = response.body.assertions.find(
    (assertion: { assertionId: string }) =>
      assertion.assertionId === "assertion-fire-dates",
  );

  assert.ok(fireDates);
  assert.equal(fireDates.bundleId, "historyroot-fire-events-v2");
  assert.equal(fireDates.nodeId, "event-great-chicago-fire");
  assert.equal(fireDates.assertionType, "date-range");
  assert.equal(fireDates.label, "Date Range");
  assert.equal(fireDates.domain, "HistoryRoot");
  assert.equal(fireDates.credibilityTier, "high");
  assert.equal(fireDates.confidence, "strong");
  assert.equal(fireDates.verificationStatus, "source-backed");
  assert.equal(fireDates.reviewStatus, "reviewed");
  assert.equal(fireDates.supportLevel, "direct");
  assert.equal(fireDates.interpretationLevel, "low");

  assert.deepEqual(fireDates.sourceIds, [
    "source-loc-guide",
    "source-loc-map-blog",
  ]);

  assert.equal(typeof fireDates.createdAt, "string");
  assert.equal(typeof fireDates.updatedAt, "string");
});

test("GET /api/v1/nodes/:nodeId/assertions returns an empty list for a node without assertions", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);
  const nodes = bundle.nodes;

  if (!Array.isArray(nodes)) {
    throw new Error("Expected the fixture to contain a nodes array.");
  }

  nodes.push({
    id: "concept-no-assertions",
    title: "Node Without Assertions",
    type: "concept",
    domain: "HistoryRoot",
    summary: "A test node intentionally created without assertions.",
    sourceIds: [],
    status: "test",
    metadata: {},
  });

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/nodes/concept-no-assertions/assertions")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.nodeId, "concept-no-assertions");
  assert.equal(response.body.total, 0);
  assert.deepEqual(response.body.assertions, []);
});

test("GET /api/v1/nodes/:nodeId/assertions returns 404 for an unknown node", async () => {
  const response = await request(app)
    .get("/api/v1/nodes/does-not-exist/assertions")
    .expect("Content-Type", /json/)
    .expect(404);

  assert.equal(response.body.error, "NODE_NOT_FOUND");
  assert.match(response.body.message, /does-not-exist/);
});

test("GET /api/v1/nodes/:nodeId/edges retrieves incoming and outgoing normalized edges", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/nodes/event-great-chicago-fire/edges")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.nodeId, "event-great-chicago-fire");
  assert.equal(response.body.total, 6);
  assert.equal(response.body.incomingTotal, 1);
  assert.equal(response.body.outgoingTotal, 5);
  assert.equal(response.body.incoming.length, 1);
  assert.equal(response.body.outgoing.length, 5);

  const occurredInChicago = response.body.outgoing.find(
    (edge: { edgeId: string }) =>
      edge.edgeId === "edge-fire-occurred-in-chicago",
  );

  assert.ok(occurredInChicago);
  assert.equal(
    occurredInChicago.bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(
    occurredInChicago.fromNodeId,
    "event-great-chicago-fire",
  );
  assert.equal(
    occurredInChicago.toNodeId,
    "place-chicago-1871",
  );
  assert.equal(
    occurredInChicago.relationshipType,
    "OCCURRED_IN",
  );
  assert.equal(occurredInChicago.label, "occurred in");
  assert.equal(occurredInChicago.domain, "HistoryRoot");
  assert.equal(occurredInChicago.credibilityTier, "high");
  assert.equal(occurredInChicago.confidence, "strong");
  assert.equal(
    occurredInChicago.verificationStatus,
    "source-backed",
  );
  assert.equal(occurredInChicago.reviewStatus, "reviewed");
  assert.equal(occurredInChicago.supportLevel, "direct");
  assert.equal(
    occurredInChicago.relationshipStrength,
    "strong",
  );
  assert.equal(occurredInChicago.interpretationLevel, "low");

  assert.deepEqual(occurredInChicago.sourceIds, [
    "source-loc-guide",
  ]);

  assert.equal(typeof occurredInChicago.createdAt, "string");
  assert.equal(typeof occurredInChicago.updatedAt, "string");

  const fireDepartmentResponse = response.body.incoming.find(
    (edge: { edgeId: string }) =>
      edge.edgeId === "edge-fire-department-responded",
  );

  assert.ok(fireDepartmentResponse);
  assert.equal(
    fireDepartmentResponse.fromNodeId,
    "institution-chicago-fire-department",
  );
  assert.equal(
    fireDepartmentResponse.toNodeId,
    "event-great-chicago-fire",
  );
  assert.equal(
    fireDepartmentResponse.relationshipType,
    "RESPONDED_TO",
  );
});

test("GET /api/v1/nodes/:nodeId/edges returns empty arrays for a node without edges", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);
  const nodes = bundle.nodes;

  if (!Array.isArray(nodes)) {
    throw new Error("Expected the fixture to contain a nodes array.");
  }

  nodes.push({
    id: "concept-no-edges",
    title: "Node Without Edges",
    type: "concept",
    domain: "HistoryRoot",
    summary: "A test node intentionally created without edges.",
    sourceIds: [],
    status: "test",
    metadata: {},
  });

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/nodes/concept-no-edges/edges")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.nodeId, "concept-no-edges");
  assert.equal(response.body.total, 0);
  assert.equal(response.body.incomingTotal, 0);
  assert.equal(response.body.outgoingTotal, 0);
  assert.deepEqual(response.body.incoming, []);
  assert.deepEqual(response.body.outgoing, []);
});

test("GET /api/v1/nodes/:nodeId/edges returns 404 for an unknown node", async () => {
  const response = await request(app)
    .get("/api/v1/nodes/does-not-exist/edges")
    .expect("Content-Type", /json/)
    .expect(404);

  assert.equal(response.body.error, "NODE_NOT_FOUND");
  assert.match(response.body.message, /does-not-exist/);
});

test("GET /api/v1/assertions lists normalized assertions with default pagination", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/assertions")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 13);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.assertions.length, 13);

  const fireDates = response.body.assertions.find(
    (assertion: { assertionId: string }) =>
      assertion.assertionId === "assertion-fire-dates",
  );

  assert.ok(fireDates);
  assert.equal(fireDates.bundleId, "historyroot-fire-events-v2");
  assert.equal(fireDates.nodeId, "event-great-chicago-fire");
  assert.equal(fireDates.assertionType, "date-range");
  assert.equal(fireDates.domain, "HistoryRoot");
  assert.equal(fireDates.reviewStatus, "reviewed");
  assert.equal(fireDates.verificationStatus, "source-backed");
  assert.ok(Array.isArray(fireDates.sourceIds));
  assert.equal(typeof fireDates.createdAt, "string");
  assert.equal(typeof fireDates.updatedAt, "string");
});

test("GET /api/v1/assertions filters normalized assertions", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get(
      "/api/v1/assertions?bundleId=historyroot-fire-events-v2&nodeId=event-great-chicago-fire&domain=HistoryRoot&assertionType=date-range&reviewStatus=reviewed&verificationStatus=source-backed&supportLevel=direct&interpretationLevel=low",
    )
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.assertions.length, 1);

  const assertion = response.body.assertions[0];

  assert.equal(assertion.assertionId, "assertion-fire-dates");
  assert.equal(assertion.bundleId, "historyroot-fire-events-v2");
  assert.equal(assertion.nodeId, "event-great-chicago-fire");
  assert.equal(assertion.domain, "HistoryRoot");
  assert.equal(assertion.assertionType, "date-range");
  assert.equal(assertion.reviewStatus, "reviewed");
  assert.equal(assertion.verificationStatus, "source-backed");
  assert.equal(assertion.supportLevel, "direct");
  assert.equal(assertion.interpretationLevel, "low");
});

test("GET /api/v1/assertions rejects an invalid page", async () => {
  const response = await request(app)
    .get("/api/v1/assertions?page=0")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_PAGE");
  assert.equal(
    response.body.message,
    "page must be a positive integer.",
  );
});

test("GET /api/v1/assertions rejects an invalid limit", async () => {
  const response = await request(app)
    .get("/api/v1/assertions?limit=101")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_LIMIT");
  assert.equal(
    response.body.message,
    "limit must be an integer between 1 and 100.",
  );
});

test("GET /api/v1/assertions/:assertionId retrieves a normalized assertion", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/assertions/assertion-fire-dates")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.assertionId, "assertion-fire-dates");
  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.nodeId, "event-great-chicago-fire");
  assert.equal(response.body.assertionType, "date-range");
  assert.equal(response.body.label, "Date Range");

  assert.equal(
    response.body.summary,
    "The Great Chicago Fire burned from the evening of October 8 through October 10, 1871.",
  );

  assert.equal(
    response.body.body,
    "The Great Chicago Fire burned from the evening of October 8 through October 10, 1871.",
  );

  assert.equal(response.body.domain, "HistoryRoot");
  assert.equal(response.body.credibilityTier, "high");
  assert.equal(response.body.confidence, "strong");
  assert.equal(response.body.verificationStatus, "source-backed");
  assert.equal(response.body.reviewStatus, "reviewed");
  assert.equal(response.body.supportLevel, "direct");
  assert.equal(response.body.interpretationLevel, "low");

  assert.deepEqual(response.body.sourceIds, [
    "source-loc-guide",
    "source-loc-map-blog",
  ]);

  assert.equal(typeof response.body.createdAt, "string");
  assert.equal(typeof response.body.updatedAt, "string");
});

test("GET /api/v1/assertions/:assertionId returns 404 for an unknown assertion", async () => {
  const response = await request(app)
    .get("/api/v1/assertions/does-not-exist")
    .expect("Content-Type", /json/)
    .expect(404);

  assert.equal(response.body.error, "ASSERTION_NOT_FOUND");
  assert.match(response.body.message, /does-not-exist/);
});



test("GET /api/v1/edges lists normalized edges with default pagination", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/edges")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 11);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.edges.length, 11);

  const occurredInChicago = response.body.edges.find(
    (edge: { edgeId: string }) =>
      edge.edgeId === "edge-fire-occurred-in-chicago",
  );

  assert.ok(occurredInChicago);
  assert.equal(
    occurredInChicago.bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(
    occurredInChicago.fromNodeId,
    "event-great-chicago-fire",
  );
  assert.equal(
    occurredInChicago.toNodeId,
    "place-chicago-1871",
  );
  assert.equal(
    occurredInChicago.relationshipType,
    "OCCURRED_IN",
  );
  assert.equal(occurredInChicago.domain, "HistoryRoot");
  assert.equal(occurredInChicago.reviewStatus, "reviewed");
  assert.equal(
    occurredInChicago.verificationStatus,
    "source-backed",
  );
  assert.ok(Array.isArray(occurredInChicago.sourceIds));
  assert.equal(typeof occurredInChicago.createdAt, "string");
  assert.equal(typeof occurredInChicago.updatedAt, "string");
});

test("GET /api/v1/edges filters normalized edges", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get(
      "/api/v1/edges?bundleId=historyroot-fire-events-v2&fromNodeId=event-great-chicago-fire&toNodeId=place-chicago-1871&domain=HistoryRoot&relationshipType=OCCURRED_IN&reviewStatus=reviewed&verificationStatus=source-backed&supportLevel=direct&relationshipStrength=strong&interpretationLevel=low",
    )
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.edges.length, 1);

  const edge = response.body.edges[0];

  assert.equal(edge.edgeId, "edge-fire-occurred-in-chicago");
  assert.equal(edge.bundleId, "historyroot-fire-events-v2");
  assert.equal(edge.fromNodeId, "event-great-chicago-fire");
  assert.equal(edge.toNodeId, "place-chicago-1871");
  assert.equal(edge.domain, "HistoryRoot");
  assert.equal(edge.relationshipType, "OCCURRED_IN");
  assert.equal(edge.reviewStatus, "reviewed");
  assert.equal(edge.verificationStatus, "source-backed");
  assert.equal(edge.supportLevel, "direct");
  assert.equal(edge.relationshipStrength, "strong");
  assert.equal(edge.interpretationLevel, "low");
});

test("GET /api/v1/edges rejects an invalid page", async () => {
  const response = await request(app)
    .get("/api/v1/edges?page=0")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_PAGE");
  assert.equal(
    response.body.message,
    "page must be a positive integer.",
  );
});

test("GET /api/v1/edges rejects an invalid limit", async () => {
  const response = await request(app)
    .get("/api/v1/edges?limit=101")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_LIMIT");
  assert.equal(
    response.body.message,
    "limit must be an integer between 1 and 100.",
  );
});

test("GET /api/v1/edges/:edgeId retrieves a normalized edge", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/edges/edge-fire-occurred-in-chicago")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(
    response.body.edgeId,
    "edge-fire-occurred-in-chicago",
  );
  assert.equal(
    response.body.bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(
    response.body.fromNodeId,
    "event-great-chicago-fire",
  );
  assert.equal(
    response.body.toNodeId,
    "place-chicago-1871",
  );
  assert.equal(
    response.body.relationshipType,
    "OCCURRED_IN",
  );
  assert.equal(response.body.label, "occurred in");
  assert.equal(
    response.body.summary,
    "Great Chicago Fire occurred in Chicago.",
  );
  assert.equal(response.body.domain, "HistoryRoot");
  assert.equal(response.body.credibilityTier, "high");
  assert.equal(response.body.confidence, "strong");
  assert.equal(
    response.body.verificationStatus,
    "source-backed",
  );
  assert.equal(response.body.reviewStatus, "reviewed");
  assert.equal(response.body.supportLevel, "direct");
  assert.equal(
    response.body.relationshipStrength,
    "strong",
  );
  assert.equal(response.body.interpretationLevel, "low");

  assert.deepEqual(response.body.sourceIds, [
    "source-loc-guide",
  ]);

  assert.equal(typeof response.body.createdAt, "string");
  assert.equal(typeof response.body.updatedAt, "string");
});

test("GET /api/v1/edges/:edgeId returns 404 for an unknown edge", async () => {
  const response = await request(app)
    .get("/api/v1/edges/does-not-exist")
    .expect("Content-Type", /json/)
    .expect(404);

  assert.equal(response.body.error, "EDGE_NOT_FOUND");
  assert.match(response.body.message, /does-not-exist/);
});

test("GET /api/v1/sources lists normalized sources with default pagination", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/sources")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 11);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.sources.length, 11);

  const libraryOfCongressSource = response.body.sources.find(
    (source: { sourceId: string }) =>
      source.sourceId === "source-loc-guide",
  );

  assert.ok(libraryOfCongressSource);
  assert.equal(
    libraryOfCongressSource.bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(
    libraryOfCongressSource.name,
    "Great Chicago Fire of 1871: Topics in Chronicling America",
  );
  assert.equal(
    libraryOfCongressSource.sourceType,
    "archive-guide",
  );
  assert.equal(
    libraryOfCongressSource.domain,
    "HistoryRoot",
  );
  assert.equal(
    libraryOfCongressSource.publisher,
    "Library of Congress",
  );
  assert.equal(
    libraryOfCongressSource.reviewStatus,
    "reviewed",
  );
  assert.equal(
    libraryOfCongressSource.verificationStatus,
    "reviewed",
  );
  assert.equal(
    typeof libraryOfCongressSource.createdAt,
    "string",
  );
  assert.equal(
    typeof libraryOfCongressSource.updatedAt,
    "string",
  );
});

test("GET /api/v1/sources filters normalized sources", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get(
      "/api/v1/sources?bundleId=historyroot-fire-events-v2&domain=HistoryRoot&sourceType=archive-guide&publisher=Library%20of%20Congress&reviewStatus=reviewed&verificationStatus=reviewed",
    )
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.sources.length, 1);

  const source = response.body.sources[0];

  assert.equal(source.sourceId, "source-loc-guide");
  assert.equal(
    source.bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(source.domain, "HistoryRoot");
  assert.equal(source.sourceType, "archive-guide");
  assert.equal(source.publisher, "Library of Congress");
  assert.equal(source.reviewStatus, "reviewed");
  assert.equal(source.verificationStatus, "reviewed");
});

test("GET /api/v1/sources rejects an invalid page", async () => {
  const response = await request(app)
    .get("/api/v1/sources?page=0")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_PAGE");
  assert.equal(
    response.body.message,
    "page must be a positive integer.",
  );
});

test("GET /api/v1/sources rejects an invalid limit", async () => {
  const response = await request(app)
    .get("/api/v1/sources?limit=101")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_LIMIT");
  assert.equal(
    response.body.message,
    "limit must be an integer between 1 and 100.",
  );
});

test("GET /api/v1/sources/:sourceId retrieves a normalized source", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/sources/source-loc-guide")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.sourceId, "source-loc-guide");
  assert.equal(
    response.body.bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(
    response.body.name,
    "Great Chicago Fire of 1871: Topics in Chronicling America",
  );
  assert.equal(response.body.sourceType, "archive-guide");
  assert.equal(response.body.domain, "HistoryRoot");
  assert.equal(response.body.publisher, "Library of Congress");
  assert.equal(response.body.qualityTier, "very-high");
  assert.equal(response.body.credibilityTier, "very-high");
  assert.equal(response.body.verificationStatus, "reviewed");
  assert.equal(response.body.sourceClass, "archive-guide");
  assert.equal(
    response.body.license,
    "External source; follow publisher terms",
  );
  assert.equal(
    response.body.licenseStatus,
    "linked-reference-only",
  );
  assert.equal(response.body.reviewStatus, "reviewed");
  assert.equal(response.body.lastReviewed, "2026-07-16");
  assert.equal(
    response.body.url,
    "https://guides.loc.gov/chronicling-america-great-chicago-fire",
  );
  assert.equal(
    response.body.notes,
    "Imported from the HistoryRoot V2 source registry.",
  );

  assert.equal(typeof response.body.createdAt, "string");
  assert.equal(typeof response.body.updatedAt, "string");
});

test("GET /api/v1/sources/:sourceId returns 404 for an unknown source", async () => {
  const response = await request(app)
    .get("/api/v1/sources/does-not-exist")
    .expect("Content-Type", /json/)
    .expect(404);

  assert.equal(response.body.error, "SOURCE_NOT_FOUND");
  assert.match(response.body.message, /does-not-exist/);
});

test("GET /api/v1/revisions lists normalized revisions with default pagination", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/revisions")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.revisions.length, 2);

  const olearyReview = response.body.revisions.find(
    (revision: { revisionId: string }) =>
      revision.revisionId === "revision-oleary-story-review",
  );

  assert.ok(olearyReview);
  assert.equal(
    olearyReview.bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(
    olearyReview.objectType,
    "historical-narrative",
  );
  assert.equal(
    olearyReview.objectId,
    "concept-oleary-cow-myth",
  );
  assert.equal(
    olearyReview.revisionType,
    "interpretation-update",
  );
  assert.equal(olearyReview.status, "current");
  assert.equal(typeof olearyReview.createdAt, "string");
  assert.equal(typeof olearyReview.updatedAt, "string");
});

test("GET /api/v1/revisions filters normalized revisions", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get(
      "/api/v1/revisions?bundleId=historyroot-fire-events-v2&objectType=historical-narrative&objectId=concept-oleary-cow-myth&revisionType=interpretation-update&status=current",
    )
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.revisions.length, 1);

  const revision = response.body.revisions[0];

  assert.equal(
    revision.revisionId,
    "revision-oleary-story-review",
  );
  assert.equal(
    revision.bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(
    revision.objectType,
    "historical-narrative",
  );
  assert.equal(
    revision.objectId,
    "concept-oleary-cow-myth",
  );
  assert.equal(
    revision.revisionType,
    "interpretation-update",
  );
  assert.equal(revision.status, "current");
});

test("GET /api/v1/revisions rejects an invalid page", async () => {
  const response = await request(app)
    .get("/api/v1/revisions?page=0")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_PAGE");
  assert.equal(
    response.body.message,
    "page must be a positive integer.",
  );
});

test("GET /api/v1/revisions rejects an invalid limit", async () => {
  const response = await request(app)
    .get("/api/v1/revisions?limit=101")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_LIMIT");
  assert.equal(
    response.body.message,
    "limit must be an integer between 1 and 100.",
  );
});

test("GET /api/v1/revisions/:revisionId retrieves a normalized revision", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/revisions/revision-oleary-story-review")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(
    response.body.revisionId,
    "revision-oleary-story-review",
  );
  assert.equal(
    response.body.bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(
    response.body.objectType,
    "historical-narrative",
  );
  assert.equal(
    response.body.objectId,
    "concept-oleary-cow-myth",
  );
  assert.equal(
    response.body.revisionType,
    "interpretation-update",
  );
  assert.equal(
    response.body.summary,
    "Marks the cow-and-lantern story as disputed rather than established fact.",
  );
  assert.equal(response.body.status, "current");
  assert.equal(typeof response.body.createdAt, "string");
  assert.equal(typeof response.body.updatedAt, "string");
});

test("GET /api/v1/revisions/:revisionId returns 404 for an unknown revision", async () => {
  const response = await request(app)
    .get("/api/v1/revisions/does-not-exist")
    .expect("Content-Type", /json/)
    .expect(404);

  assert.equal(response.body.error, "REVISION_NOT_FOUND");
  assert.match(response.body.message, /does-not-exist/);
});

test("GET /api/v1/search searches across normalized record types", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/search?q=fire")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.query, "fire");
  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.ok(response.body.total > 0);
  assert.ok(response.body.totalPages > 0);
  assert.ok(response.body.results.length > 0);

  const resultTypes = new Set(
    response.body.results.map(
      (result: { resultType: string }) => result.resultType,
    ),
  );

  assert.ok(resultTypes.has("node"));
  assert.ok(resultTypes.has("assertion"));
  assert.ok(resultTypes.has("edge"));
  assert.ok(resultTypes.has("source"));

  const greatChicagoFire = response.body.results.find(
    (result: { resultType: string; id: string }) =>
      result.resultType === "node" &&
      result.id === "event-great-chicago-fire",
  );

  assert.ok(greatChicagoFire);
  assert.equal(
    greatChicagoFire.bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(greatChicagoFire.title, "Great Chicago Fire");
  assert.equal(greatChicagoFire.domain, "HistoryRoot");
  assert.equal(greatChicagoFire.objectType, "event");
  assert.equal(typeof greatChicagoFire.metadata, "object");
  assert.equal(typeof greatChicagoFire.createdAt, "string");
  assert.equal(typeof greatChicagoFire.updatedAt, "string");
});

test("GET /api/v1/search filters results by type", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/search?q=fire&type=node")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.query, "fire");
  assert.ok(response.body.total > 0);
  assert.equal(response.body.results.length, response.body.total);

  for (const result of response.body.results) {
    assert.equal(result.resultType, "node");
  }

  assert.ok(
    response.body.results.some(
      (result: { id: string }) =>
        result.id === "event-great-chicago-fire",
    ),
  );
});

test("GET /api/v1/search filters results by bundle and domain", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get(
      "/api/v1/search?q=fire&bundleId=historyroot-fire-events-v2&domain=HistoryRoot",
    )
    .expect("Content-Type", /json/)
    .expect(200);

  assert.ok(response.body.total > 0);

  for (const result of response.body.results) {
    assert.equal(
      result.bundleId,
      "historyroot-fire-events-v2",
    );
    assert.equal(result.domain, "HistoryRoot");
  }
});

test("GET /api/v1/search paginates results", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const firstPage = await request(app)
    .get("/api/v1/search?q=fire&page=1&limit=2")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(firstPage.body.page, 1);
  assert.equal(firstPage.body.limit, 2);
  assert.ok(firstPage.body.total > 2);
  assert.equal(firstPage.body.results.length, 2);
  assert.equal(
    firstPage.body.totalPages,
    Math.ceil(firstPage.body.total / 2),
  );

  const secondPage = await request(app)
    .get("/api/v1/search?q=fire&page=2&limit=2")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(secondPage.body.page, 2);
  assert.equal(secondPage.body.limit, 2);
  assert.equal(secondPage.body.total, firstPage.body.total);
  assert.equal(
    secondPage.body.totalPages,
    firstPage.body.totalPages,
  );
  assert.equal(secondPage.body.results.length, 2);

  assert.notDeepEqual(
    secondPage.body.results.map(
      (result: { resultType: string; id: string }) =>
        `${result.resultType}:${result.id}`,
    ),
    firstPage.body.results.map(
      (result: { resultType: string; id: string }) =>
        `${result.resultType}:${result.id}`,
    ),
  );
});

test("GET /api/v1/search rejects a missing query", async () => {
  const response = await request(app)
    .get("/api/v1/search")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_QUERY");
  assert.equal(
    response.body.message,
    "q must contain a search term.",
  );
});

test("GET /api/v1/search rejects an invalid type", async () => {
  const response = await request(app)
    .get("/api/v1/search?q=fire&type=unknown")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(
    response.body.error,
    "INVALID_SEARCH_TYPE",
  );
  assert.equal(
    response.body.message,
    "type must be node, assertion, edge, source, or revision.",
  );
});

test("GET /api/v1/search rejects an invalid page", async () => {
  const response = await request(app)
    .get("/api/v1/search?q=fire&page=0")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_PAGE");
  assert.equal(
    response.body.message,
    "page must be a positive integer.",
  );
});

test("GET /api/v1/search rejects an invalid limit", async () => {
  const response = await request(app)
    .get("/api/v1/search?q=fire&limit=101")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_LIMIT");
  assert.equal(
    response.body.message,
    "limit must be an integer between 1 and 100.",
  );
});

test("GET /api/v1/bundles/:bundleId/nodes lists bundle-scoped nodes", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/bundles/historyroot-fire-events-v2/nodes")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 11);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.nodes.length, 11);

  for (const node of response.body.nodes) {
    assert.equal(node.bundleId, "historyroot-fire-events-v2");
  }
});

test("GET /api/v1/bundles/:bundleId/assertions lists bundle-scoped assertions", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/bundles/historyroot-fire-events-v2/assertions")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.total, 13);
  assert.equal(response.body.assertions.length, 13);

  for (const assertion of response.body.assertions) {
    assert.equal(
      assertion.bundleId,
      "historyroot-fire-events-v2",
    );
  }
});

test("GET /api/v1/bundles/:bundleId/edges lists bundle-scoped edges", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/bundles/historyroot-fire-events-v2/edges")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.total, 11);
  assert.equal(response.body.edges.length, 11);

  for (const edge of response.body.edges) {
    assert.equal(edge.bundleId, "historyroot-fire-events-v2");
  }
});

test("GET /api/v1/bundles/:bundleId/sources lists bundle-scoped sources", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/bundles/historyroot-fire-events-v2/sources")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.total, 11);
  assert.equal(response.body.sources.length, 11);

  for (const source of response.body.sources) {
    assert.equal(source.bundleId, "historyroot-fire-events-v2");
  }
});

test("GET /api/v1/bundles/:bundleId/revisions lists bundle-scoped revisions", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/bundles/historyroot-fire-events-v2/revisions")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.total, 2);
  assert.equal(response.body.revisions.length, 2);

  for (const revision of response.body.revisions) {
    assert.equal(
      revision.bundleId,
      "historyroot-fire-events-v2",
    );
  }
});

test("GET /api/v1/bundles/:bundleId/nodes supports filters", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get(
      "/api/v1/bundles/historyroot-fire-events-v2/nodes?domain=HistoryRoot&nodeType=event&status=historical",
    )
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.total, 2);
  assert.equal(response.body.nodes.length, 2);

  assert.deepEqual(
    response.body.nodes.map(
      (node: { nodeId: string }) => node.nodeId,
    ),
    [
      "event-great-chicago-fire",
      "event-peshtigo-fire",
    ],
  );
});

test("GET /api/v1/bundles/:bundleId/nodes paginates results", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get(
      "/api/v1/bundles/historyroot-fire-events-v2/nodes?page=2&limit=5",
    )
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.page, 2);
  assert.equal(response.body.limit, 5);
  assert.equal(response.body.total, 11);
  assert.equal(response.body.totalPages, 3);
  assert.equal(response.body.nodes.length, 5);
});

test("GET /api/v1/bundles/:bundleId/nodes rejects an invalid page", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get(
      "/api/v1/bundles/historyroot-fire-events-v2/nodes?page=0",
    )
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_PAGE");
  assert.equal(
    response.body.message,
    "page must be a positive integer.",
  );
});

test("GET /api/v1/bundles/:bundleId/nodes rejects an invalid limit", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get(
      "/api/v1/bundles/historyroot-fire-events-v2/nodes?limit=101",
    )
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_LIMIT");
  assert.equal(
    response.body.message,
    "limit must be an integer between 1 and 100.",
  );
});

test("GET /api/v1/bundles/:bundleId/nodes returns 404 for an unknown bundle", async () => {
  const response = await request(app)
    .get("/api/v1/bundles/does-not-exist/nodes")
    .expect("Content-Type", /json/)
    .expect(404);

  assert.equal(response.body.error, "BUNDLE_NOT_FOUND");
  assert.match(response.body.message, /does-not-exist/);
});

test("GET /api/v1/import/:bundleId retrieves an imported bundle", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/import/historyroot-fire-events-v2")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.bundleType, "sourceroot-import-bundle");
  assert.equal(response.body.domain, "HistoryRoot");
  assert.equal(response.body.nodes.length, 11);
  assert.equal(response.body.assertions.length, 13);
});

test("GET /api/v1/import lists imported bundle metadata", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .get("/api/v1/import")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.totalPages, 1);
  assert.equal(response.body.bundles.length, 1);

  assert.equal(
    response.body.bundles[0].bundleId,
    "historyroot-fire-events-v2",
  );
  assert.equal(
    response.body.bundles[0].bundleType,
    "sourceroot-import-bundle",
  );
  assert.equal(response.body.bundles[0].version, "0.2");
  assert.equal(response.body.bundles[0].domain, "HistoryRoot");
  assert.equal(typeof response.body.bundles[0].createdAt, "string");
  assert.equal(typeof response.body.bundles[0].updatedAt, "string");

  assert.equal("nodes" in response.body.bundles[0], false);
  assert.equal("assertions" in response.body.bundles[0], false);
});

test("GET /api/v1/import rejects an invalid page", async () => {
  const response = await request(app)
    .get("/api/v1/import?page=0")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_PAGE");
  assert.equal(
    response.body.message,
    "page must be a positive integer.",
  );
});

test("GET /api/v1/import rejects an invalid limit", async () => {
  const response = await request(app)
    .get("/api/v1/import?limit=101")
    .expect("Content-Type", /json/)
    .expect(400);

  assert.equal(response.body.error, "INVALID_LIMIT");
  assert.equal(
    response.body.message,
    "limit must be an integer between 1 and 100.",
  );
});

test("POST /api/v1/import blocks an invalid bundle", async () => {
  const bundle = await readJsonFixture(brokenFixtureUrl);

  const response = await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect("Content-Type", /json/)
    .expect(422);

  assert.equal(response.body.imported, false);
  assert.equal(response.body.validation.status, "blocked");
  assert.equal(response.body.validation.canImport, false);
  assert.equal(response.body.validation.summary.errors, 3);

  const errorCodes = response.body.validation.errors.map(
    (error: { code: string }) => error.code,
  );

  assert.ok(errorCodes.includes("DUPLICATE_NODE_ID"));
  assert.ok(errorCodes.includes("ASSERTION_NODE_NOT_FOUND"));
  assert.ok(errorCodes.includes("EDGE_NODE_NOT_FOUND"));
});

test("GET /api/v1/import/:bundleId returns 404 for an unknown bundle", async () => {
  const response = await request(app)
    .get("/api/v1/import/does-not-exist")
    .expect("Content-Type", /json/)
    .expect(404);

  assert.equal(response.body.error, "BUNDLE_NOT_FOUND");
  assert.match(response.body.message, /does-not-exist/);
});

test("DELETE /api/v1/import/:bundleId deletes an integration-test bundle and normalized records", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);
  const bundleId = "sourceroot-integration-test-delete-success";

  bundle.bundleId = bundleId;

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .delete(`/api/v1/import/${bundleId}`)
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(response.body.deleted, true);
  assert.equal(response.body.bundleId, bundleId);
  assert.equal(response.body.storedBundles, 0);

  assert.deepEqual(response.body.deletedCounts, {
    importedBundles: 1,
    nodes: 11,
    assertions: 13,
    edges: 11,
    sources: 11,
    revisions: 2,
    nodeSources: 26,
    assertionSources: 22,
    edgeSources: 12,
  });

  await request(app)
    .get(`/api/v1/import/${bundleId}`)
    .expect("Content-Type", /json/)
    .expect(404);

  const pool = getPool();

  if (!pool) {
    throw new Error(
      "Test database is not configured. Confirm that .env.test contains DATABASE_URL.",
    );
  }

  const result = await pool.query<{
    imported_bundles: string;
    sources: string;
    nodes: string;
    assertions: string;
    edges: string;
    revisions: string;
    node_sources: string;
    assertion_sources: string;
    edge_sources: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM imported_bundles) AS imported_bundles,
      (SELECT COUNT(*) FROM sources) AS sources,
      (SELECT COUNT(*) FROM nodes) AS nodes,
      (SELECT COUNT(*) FROM assertions) AS assertions,
      (SELECT COUNT(*) FROM edges) AS edges,
      (SELECT COUNT(*) FROM revisions) AS revisions,
      (SELECT COUNT(*) FROM node_sources) AS node_sources,
      (SELECT COUNT(*) FROM assertion_sources) AS assertion_sources,
      (SELECT COUNT(*) FROM edge_sources) AS edge_sources;
  `);

  const counts = result.rows[0];

  if (!counts) {
    throw new Error("Delete verification query returned no result.");
  }

  assert.equal(Number(counts.imported_bundles), 0);
  assert.equal(Number(counts.sources), 0);
  assert.equal(Number(counts.nodes), 0);
  assert.equal(Number(counts.assertions), 0);
  assert.equal(Number(counts.edges), 0);
  assert.equal(Number(counts.revisions), 0);
  assert.equal(Number(counts.node_sources), 0);
  assert.equal(Number(counts.assertion_sources), 0);
  assert.equal(Number(counts.edge_sources), 0);
});

test("DELETE /api/v1/import/:bundleId returns 404 for a missing integration-test bundle", async () => {
  const bundleId = "sourceroot-integration-test-does-not-exist";

  const response = await request(app)
    .delete(`/api/v1/import/${bundleId}`)
    .expect("Content-Type", /json/)
    .expect(404);

  assert.equal(response.body.deleted, false);
  assert.equal(response.body.error, "BUNDLE_NOT_FOUND");
  assert.match(response.body.message, new RegExp(bundleId));
});

test("DELETE /api/v1/import/:bundleId forbids deletion of a normal bundle", async () => {
  const bundle = await readJsonFixture(validFixtureUrl);

  await request(app)
    .post("/api/v1/import")
    .send(bundle)
    .expect(201);

  const response = await request(app)
    .delete("/api/v1/import/historyroot-fire-events-v2")
    .expect("Content-Type", /json/)
    .expect(403);

  assert.equal(response.body.deleted, false);
  assert.equal(response.body.error, "BUNDLE_DELETE_FORBIDDEN");
  assert.equal(
    response.body.requiredPrefix,
    "sourceroot-integration-test-",
  );

  const storedBundle = await request(app)
    .get("/api/v1/import/historyroot-fire-events-v2")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(storedBundle.body.bundleId, "historyroot-fire-events-v2");
});

test("DELETE /api/v1/import/:bundleId leaves unrelated bundles intact", async () => {
  const normalBundle = await readJsonFixture(validFixtureUrl);
  const testBundle = structuredClone(normalBundle);
  const testBundleId = "sourceroot-integration-test-isolated-delete";

  await request(app)
    .post("/api/v1/import")
    .send(normalBundle)
    .expect(201);

  /*
   * Normalized object IDs are globally unique. Build an exact ID map from
   * the fixture, then rewrite every matching ID and reference recursively.
   */
  const idMap = new Map<string, string>();

  for (const collectionName of [
    "sources",
    "nodes",
    "assertions",
    "edges",
    "revisions",
  ]) {
    const collection = testBundle[collectionName];

    if (!Array.isArray(collection)) {
      continue;
    }

    for (const item of collection) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const record = item as Record<string, unknown>;

      for (const idField of ["id", "revisionId"]) {
        const value = record[idField];

        if (typeof value === "string") {
          idMap.set(value, `${testBundleId}:${value}`);
        }
      }
    }
  }

  const rewriteIds = (value: unknown): unknown => {
    if (typeof value === "string") {
      return idMap.get(value) ?? value;
    }

    if (Array.isArray(value)) {
      return value.map(rewriteIds);
    }

    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          rewriteIds(nestedValue),
        ]),
      );
    }

    return value;
  };

  const isolatedTestBundle = rewriteIds(
    testBundle,
  ) as Record<string, unknown>;

  isolatedTestBundle.bundleId = testBundleId;

  await request(app)
    .post("/api/v1/import")
    .send(isolatedTestBundle)
    .expect(201);

  const deleteResponse = await request(app)
    .delete(`/api/v1/import/${testBundleId}`)
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(deleteResponse.body.deleted, true);
  assert.equal(deleteResponse.body.storedBundles, 1);

  await request(app)
    .get(`/api/v1/import/${testBundleId}`)
    .expect(404);

  const normalResponse = await request(app)
    .get("/api/v1/import/historyroot-fire-events-v2")
    .expect("Content-Type", /json/)
    .expect(200);

  assert.equal(
    normalResponse.body.bundleId,
    "historyroot-fire-events-v2",
  );
});