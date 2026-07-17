import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, beforeEach } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
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