import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  redactSensitiveData,
  setDiagnosticSinkForTests,
  type StructuredDiagnosticEvent,
} from "../src/lib/diagnostics.js";

async function withCapturedDiagnostics(
  operation: (events: StructuredDiagnosticEvent[]) => Promise<void>,
): Promise<void> {
  const events: StructuredDiagnosticEvent[] = [];
  const restoreSink = setDiagnosticSinkForTests((event) => {
    events.push({ ...event });
  });
  const previousLogging = process.env.REQUEST_LOGGING;
  process.env.REQUEST_LOGGING = "false";
  try {
    await operation(events);
  } finally {
    restoreSink();
    if (previousLogging === undefined) delete process.env.REQUEST_LOGGING;
    else process.env.REQUEST_LOGGING = previousLogging;
  }
}

test("safe caller correlation ID is returned in headers, API errors, and logs", async () => {
  await withCapturedDiagnostics(async (events) => {
    const response = await request(createApp())
      .get("/api/v1/not-a-real-route")
      .set("x-request-id", "caller.safe-123")
      .expect(404);

    assert.equal(response.headers["x-request-id"], "caller.safe-123");
    assert.equal(response.body.requestId, "caller.safe-123");
    const log = events.find((event) => event.eventType === "request_failed");
    assert.ok(log);
    assert.equal(log.correlationId, "caller.safe-123");
    assert.equal(log.requestId, "caller.safe-123");
    assert.equal(log.errorCode, "NOT_FOUND");
  });
});

test("invalid and missing correlation IDs generate distinct bounded IDs", async () => {
  await withCapturedDiagnostics(async () => {
    const invalid = await request(createApp())
      .get("/api/v1/not-a-real-route")
      .set("x-request-id", `unsafe ${"x".repeat(300)}`)
      .expect(404);
    const missing = await request(createApp())
      .get("/api/v1/not-a-real-route")
      .expect(404);

    for (const value of [
      invalid.headers["x-request-id"],
      missing.headers["x-request-id"],
    ]) {
      assert.equal(typeof value, "string");
      if (!value) assert.fail("Expected a generated request ID.");
      assert.match(value, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
      assert.ok(value.length <= 128);
    }
    assert.notEqual(invalid.headers["x-request-id"], missing.headers["x-request-id"]);
    assert.notEqual(invalid.headers["x-request-id"], `unsafe ${"x".repeat(300)}`);
  });
});

test("a correlation ID never grants authentication", async () => {
  await withCapturedDiagnostics(async () => {
    const response = await request(createApp())
      .get("/api/v1/account")
      .set("x-request-id", "system.admin")
      .expect(401);

    assert.equal(response.body.error, "AUTHENTICATION_REQUIRED");
    assert.equal(response.body.requestId, "system.admin");
  });
});

test("structured logs cover successful and failed requests with safe fields", async () => {
  await withCapturedDiagnostics(async (events) => {
    await request(createApp())
      .get("/health")
      .set("x-request-id", "health-check-1")
      .expect(200);
    await request(createApp())
      .get("/api/v1/not-a-real-route")
      .set("x-request-id", "failed-check-1")
      .expect(404);

    const success = events.find((event) => event.correlationId === "health-check-1");
    const failure = events.find((event) => event.correlationId === "failed-check-1");
    assert.ok(success);
    assert.equal(success.eventType, "request_completed");
    assert.equal(success.method, "GET");
    assert.equal(success.path, "/health");
    assert.equal(success.statusCode, 200);
    assert.equal(success.responseCategory, "success");
    assert.equal(typeof success.durationMs, "number");
    assert.equal(success.environment, process.env.NODE_ENV || "development");

    assert.ok(failure);
    assert.equal(failure.eventType, "request_failed");
    assert.equal(failure.method, "GET");
    assert.equal(failure.path, "/api/v1/not-a-real-route");
    assert.equal(failure.statusCode, 404);
    assert.equal(failure.responseCategory, "not-found");
    assert.equal(failure.errorCode, "NOT_FOUND");
  });
});

test("logging redacts secrets and never records headers, cookies, or request bodies", async () => {
  const redacted = redactSensitiveData({
    authorization: "Bearer secret-auth",
    cookie: "dr_session=secret-cookie",
    password: "secret-password",
    nested: {
      serviceToken: "secret-token",
      safeCount: 3,
    },
  }) as Record<string, unknown>;
  assert.equal(redacted.authorization, "[REDACTED]");
  assert.equal(redacted.cookie, "[REDACTED]");
  assert.equal(redacted.password, "[REDACTED]");
  assert.deepEqual(redacted.nested, {
    serviceToken: "[REDACTED]",
    safeCount: 3,
  });

  await withCapturedDiagnostics(async (events) => {
    await request(createApp())
      .post("/api/v1/validate")
      .set("authorization", "Bearer request-secret")
      .set("cookie", "unrelated=request-cookie-secret")
      .set("x-sourceroot-import-token", "request-token-secret")
      .set("x-request-id", "redaction-check-1")
      .send({
        bundleId: "redaction-bundle",
        password: "request-body-secret",
      })
      .expect(200);

    const serialized = JSON.stringify(events);
    for (const secret of [
      "request-secret",
      "request-cookie-secret",
      "request-token-secret",
      "request-body-secret",
    ]) {
      assert.equal(serialized.includes(secret), false);
    }
    assert.equal(serialized.includes("authorization"), false);
    assert.equal(serialized.includes("cookie"), false);
    assert.equal(serialized.includes("password"), false);
  });
});

test("failed validation emits bounded import diagnostics with the same correlation ID", async () => {
  await withCapturedDiagnostics(async (events) => {
    await request(createApp())
      .post("/api/v1/validate")
      .set("x-request-id", "validation-run-1")
      .send({ bundleId: "bundle-invalid" })
      .expect(200);

    const validation = events.find((event) => event.eventType === "validation_failed");
    assert.ok(validation);
    assert.equal(validation.correlationId, "validation-run-1");
    assert.equal(validation.bundleId, "bundle-invalid");
    assert.equal(validation.validationResult, "blocked");
    assert.equal(typeof validation.recordCounts?.errors, "number");
    assert.equal(typeof validation.durationMs, "number");
  });
});
