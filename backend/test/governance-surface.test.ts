import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

test("authentication discovery remains honest without a configured database", async () => {
  const prior = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const app = createApp();
    const config = await request(app).get("/api/v1/auth/config").expect(200);
    assert.equal(config.body.passwordStorage, false);
    assert.equal(config.body.accountLinking, true);

    const session = await request(app).get("/api/v1/auth/session").expect(200);
    assert.equal(session.body.authenticated, false);
    assert.equal(session.body.user, null);

    const protectedResponse = await request(app)
      .get("/api/v1/dictionaryroot/workflow/summary")
      .expect(401);
    assert.equal(protectedResponse.body.error, "AUTHENTICATION_REQUIRED");
    assert.equal(protectedResponse.headers["cache-control"], "no-store");
    assert.equal(protectedResponse.headers["x-content-type-options"], "nosniff");
  } finally {
    if (prior === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prior;
  }
});

test("deployment readiness does not expose provider secrets", async () => {
  const app = createApp();
  const response = await request(app).get("/api/v1/deployment-readiness");
  assert.ok([200, 503].includes(response.status));
  const serialized = JSON.stringify(response.body);
  assert.doesNotMatch(serialized, /CLIENT_SECRET|PRIVATE_KEY|RESEND_API_KEY/);
  assert.ok(Array.isArray(response.body.checks));
});
