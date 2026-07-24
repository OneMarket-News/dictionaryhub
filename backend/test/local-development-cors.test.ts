import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";

const trackedVariables = [
  "NODE_ENV",
  "CORS_ORIGIN",
  "ALLOW_LOCAL_DEVELOPMENT_ORIGINS",
] as const;

test("local development CORS permits loopback frontends without weakening production", async () => {
  const original = Object.fromEntries(
    trackedVariables.map((key) => [key, process.env[key]]),
  ) as Record<(typeof trackedVariables)[number], string | undefined>;

  try {
    process.env.NODE_ENV = "development";
    process.env.CORS_ORIGIN = "http://localhost:8080,http://127.0.0.1:8080";
    process.env.ALLOW_LOCAL_DEVELOPMENT_ORIGINS = "true";

    const developmentApp = createApp();
    for (const origin of ["http://localhost:5500", "http://127.0.0.1:5500"]) {
      const response = await request(developmentApp)
        .options("/api/v1/sources")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "GET");

      assert.equal(response.status, 204);
      assert.equal(response.headers["access-control-allow-origin"], origin);
      assert.equal(response.headers["access-control-allow-credentials"], "true");
    }

    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "https://dictionaryroot.example";
    process.env.ALLOW_LOCAL_DEVELOPMENT_ORIGINS = "true";

    const productionApp = createApp();
    const rejected = await request(productionApp)
      .options("/api/v1/sources")
      .set("Origin", "http://localhost:5500")
      .set("Access-Control-Request-Method", "GET");

    assert.notEqual(rejected.headers["access-control-allow-origin"], "http://localhost:5500");
  } finally {
    for (const key of trackedVariables) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
