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