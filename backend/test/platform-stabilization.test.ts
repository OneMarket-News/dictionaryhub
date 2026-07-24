import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { getDeploymentReadiness, startupFailureKeys } from "../src/lib/runtime-config.js";

const trackedVariables = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "FRONTEND_PUBLIC_URL",
  "BACKEND_PUBLIC_URL",
  "SESSION_COOKIE_SECURE",
  "SESSION_COOKIE_SAME_SITE",
  "ALLOW_DEVELOPMENT_AUTH",
  "EXPOSE_DEVELOPMENT_AUTH_LINK",
  "ALLOW_LOCAL_DEVELOPMENT_ORIGINS",
  "EMAIL_DELIVERY_MODE",
  "EMAIL_FROM",
  "RESEND_API_KEY",
  "BOOTSTRAP_ADMIN_EMAILS",
  "CORS_ORIGIN",
  "ALLOW_UNAUTHENTICATED_IMPORT",
  "IMPORT_SERVICE_TOKEN",
  "ALLOW_SELF_APPROVAL",
  "REQUEST_LOGGING",
] as const;

function preserveEnvironment(): () => void {
  const original = Object.fromEntries(
    trackedVariables.map((key) => [key, process.env[key]]),
  ) as Record<(typeof trackedVariables)[number], string | undefined>;
  return () => {
    for (const key of trackedVariables) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function configureProductionReadiness(): void {
  Object.assign(process.env, {
    NODE_ENV: "production",
    PORT: "3000",
    DATABASE_URL: "postgresql://platform.invalid/sourceroot",
    FRONTEND_PUBLIC_URL: "https://platform.example",
    BACKEND_PUBLIC_URL: "https://api.platform.example",
    SESSION_COOKIE_SECURE: "true",
    SESSION_COOKIE_SAME_SITE: "lax",
    ALLOW_DEVELOPMENT_AUTH: "false",
    EXPOSE_DEVELOPMENT_AUTH_LINK: "false",
    ALLOW_LOCAL_DEVELOPMENT_ORIGINS: "false",
    EMAIL_DELIVERY_MODE: "resend",
    EMAIL_FROM: "SourceRoot <accounts@platform.example>",
    RESEND_API_KEY: "test-placeholder",
    BOOTSTRAP_ADMIN_EMAILS: "owner@platform.example",
    CORS_ORIGIN: "https://platform.example",
    ALLOW_UNAUTHENTICATED_IMPORT: "false",
    IMPORT_SERVICE_TOKEN: "test-placeholder",
    ALLOW_SELF_APPROVAL: "false",
    REQUEST_LOGGING: "true",
  });
}

test("production readiness fails closed for unsafe or missing configuration", () => {
  const restore = preserveEnvironment();
  try {
    configureProductionReadiness();
    delete process.env.DATABASE_URL;
    process.env.SESSION_COOKIE_SECURE = "false";
    process.env.ALLOW_DEVELOPMENT_AUTH = "true";
    process.env.CORS_ORIGIN = "*";
    process.env.REQUEST_LOGGING = "false";

    const failures = startupFailureKeys();
    assert.ok(failures.includes("database"));
    assert.ok(failures.includes("secure_cookie"));
    assert.ok(failures.includes("development_auth_disabled"));
    assert.ok(failures.includes("cors_origin"));
    assert.ok(failures.includes("request_logging"));
  } finally {
    restore();
  }
});

test("complete production configuration passes static startup validation", () => {
  const restore = preserveEnvironment();
  try {
    configureProductionReadiness();
    const readiness = getDeploymentReadiness();
    assert.equal(readiness.readyForPublicTraffic, true);
    assert.equal(readiness.checks.some((check) => check.status === "fail"), false);
  } finally {
    restore();
  }
});

test("request IDs are bounded and production responses include HSTS", async () => {
  const restore = preserveEnvironment();
  try {
    configureProductionReadiness();
    const app = createApp();
    const response = await request(app)
      .get("/api/v1/route-that-does-not-exist")
      .set("x-request-id", "x".repeat(300))
      .expect(404);

    assert.match(response.headers["x-request-id"] || "", /^[0-9a-f-]{36}$/);
    assert.equal(
      response.headers["strict-transport-security"],
      "max-age=31536000; includeSubDomains",
    );
    assert.equal(response.body.requestId, response.headers["x-request-id"]);
  } finally {
    restore();
  }
});

test("disallowed CORS origins return a stable 403 response", async () => {
  const restore = preserveEnvironment();
  try {
    configureProductionReadiness();
    const app = createApp();
    const response = await request(app)
      .options("/api/v1/sources")
      .set("Origin", "https://untrusted.example")
      .set("Access-Control-Request-Method", "GET")
      .expect(403);

    assert.equal(response.body.error, "CORS_ORIGIN_DENIED");
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  } finally {
    restore();
  }
});
