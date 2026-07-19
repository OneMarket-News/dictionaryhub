import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

async function fixture(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

test("GET /health returns service status without requiring PostgreSQL", async () => {
  delete process.env.DATABASE_URL;
  const response = await request(app).get("/health").expect(200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.service, "sourceroot-backend");
  assert.equal(response.body.database.configured, false);
  assert.ok(response.headers["x-request-id"]);
});

test("POST /api/v1/validate validates HistoryRoot", async () => {
  const response = await request(app)
    .post("/api/v1/validate")
    .send(await fixture("historyroot-valid.json"))
    .expect(200);

  assert.equal(response.body.bundleId, "historyroot-fire-events-v2");
  assert.equal(response.body.status, "ready");
  assert.equal(response.body.summary.errors, 0);
  assert.equal(response.body.summary.warnings, 0);
});

test("POST /api/v1/validate returns blocked result rather than HTTP failure", async () => {
  const response = await request(app)
    .post("/api/v1/validate")
    .send(await fixture("broken-bundle.json"))
    .expect(200);

  assert.equal(response.body.status, "blocked");
  assert.equal(response.body.canImport, false);
  assert.ok(response.body.summary.errors > 0);
});

test("malformed JSON returns HTTP 400", async () => {
  const response = await request(app)
    .post("/api/v1/validate")
    .set("content-type", "application/json")
    .send('{"bundleId":')
    .expect(400);

  assert.equal(response.body.error, "INVALID_JSON");
});

test("oversized JSON returns HTTP 413 with a clear SourceRoot error", async () => {
  const limitedApp = createApp({ jsonLimit: "1kb" });
  const response = await request(limitedApp)
    .post("/api/v1/validate")
    .send({ payload: "x".repeat(2048) })
    .expect(413);

  assert.equal(response.body.error, "PAYLOAD_TOO_LARGE");
  assert.match(response.body.message, /1kb/);
  assert.ok(response.body.requestId);
});
