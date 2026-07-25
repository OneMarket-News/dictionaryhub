import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  createApiError,
  REGISTRY_API_CONTRACT_VERSION,
} from "../src/lib/api-contract.js";
import {
  clampLimit,
  isQueryParameterError,
  parsePagination,
} from "../src/lib/query-params.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

const app = createApp();
const bundleId = "historyroot-fire-events-v2";

function requireImportServiceToken(): string {
  const token = process.env.IMPORT_SERVICE_TOKEN;
  if (!token) {
    throw new Error(
      "Registry contract tests require IMPORT_SERVICE_TOKEN in .env.test.",
    );
  }
  return token;
}

before(async () => {
  await resetTestDatabase();
  const fixture = JSON.parse(
    await readFile(
      new URL("./fixtures/historyroot-valid.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;

  await request(app)
    .post("/api/v1/import")
    .set("x-sourceroot-import-token", requireImportServiceToken())
    .send(fixture)
    .expect(201);
});

after(async () => {
  await closeTestDatabase();
});

test("pagination helpers define defaults, bounds, offsets, and clamping", () => {
  assert.deepEqual(parsePagination(undefined, undefined), {
    page: 1,
    limit: 25,
    offset: 0,
  });
  assert.deepEqual(parsePagination(undefined, "100"), {
    page: 1,
    limit: 100,
    offset: 0,
  });
  assert.deepEqual(
    parsePagination(undefined, "5", { offsetValue: "7" }),
    { page: 2, limit: 5, offset: 7 },
  );
  assert.equal(clampLimit(0), 1);
  assert.equal(clampLimit(500), 100);

  for (const value of ["101", "0", "-1", "many"]) {
    const parsed = parsePagination(undefined, value);
    assert.equal(isQueryParameterError(parsed), true);
    assert.equal("error" in parsed && parsed.error, "INVALID_LIMIT");
  }

  for (const value of ["-1", "many"]) {
    const parsed = parsePagination(
      undefined,
      undefined,
      { offsetValue: value },
    );
    assert.equal(isQueryParameterError(parsed), true);
    assert.equal("error" in parsed && parsed.error, "INVALID_OFFSET");
  }
});

test("default collection response preserves legacy keys and adds exact metadata", async () => {
  const response = await request(app)
    .get(`/api/v1/nodes?bundleId=${bundleId}`)
    .expect(200);

  assert.equal(response.body.contractVersion, REGISTRY_API_CONTRACT_VERSION);
  assert.equal(response.body.limit, 25);
  assert.equal(response.body.offset, 0);
  assert.equal(response.body.pagination.offset, 0);
  assert.equal(response.body.returned, response.body.items.length);
  assert.equal(response.body.pagination.returned, response.body.items.length);
  assert.equal(response.body.totalSemantics, "exact");
  assert.equal(response.body.pagination.totalSemantics, "exact");
  assert.equal(
    response.body.hasMore,
    response.body.returned < response.body.total,
  );
  assert.deepEqual(response.body.nodes, response.body.items);
  assert.equal(response.body.appliedFilters.bundleId, bundleId);
  assert.deepEqual(response.body.appliedSort, {
    field: "title",
    direction: "asc",
    tieBreaker: "nodeId:asc",
  });
});

test("explicit limits, maximum limit, offsets, and empty pages are consistent", async () => {
  const limited = await request(app)
    .get(`/api/v1/nodes?bundleId=${bundleId}&limit=3`)
    .expect(200);
  assert.equal(limited.body.items.length, 3);
  assert.equal(limited.body.pagination.limit, 3);
  assert.equal(limited.body.hasMore, true);

  const maximum = await request(app)
    .get(`/api/v1/nodes?bundleId=${bundleId}&limit=100`)
    .expect(200);
  assert.equal(maximum.body.pagination.limit, 100);
  assert.equal(maximum.body.hasMore, false);

  const offset = await request(app)
    .get(`/api/v1/nodes?bundleId=${bundleId}&limit=3&offset=3`)
    .expect(200);
  assert.equal(offset.body.offset, 3);
  assert.equal(offset.body.page, 2);
  assert.equal(offset.body.items.length, 3);

  const empty = await request(app)
    .get(`/api/v1/nodes?bundleId=${bundleId}&offset=999`)
    .expect(200);
  assert.deepEqual(empty.body.items, []);
  assert.deepEqual(empty.body.nodes, []);
  assert.equal(empty.body.returned, 0);
  assert.equal(empty.body.hasMore, false);
  assert.equal(empty.body.total, 11);
});

test("invalid pagination produces the standard safe error contract", async () => {
  for (const path of [
    `/api/v1/nodes?bundleId=${bundleId}&limit=101`,
    `/api/v1/nodes?bundleId=${bundleId}&limit=0`,
    `/api/v1/nodes?bundleId=${bundleId}&limit=-1`,
    `/api/v1/nodes?bundleId=${bundleId}&limit=many`,
    `/api/v1/nodes?bundleId=${bundleId}&offset=-1`,
    `/api/v1/nodes?bundleId=${bundleId}&offset=many`,
  ]) {
    const response = await request(app).get(path).expect(400);
    assert.equal(response.body.error, response.body.code);
    assert.equal(response.body.status, 400);
    assert.equal(response.body.category, "invalid-pagination");
    assert.equal(typeof response.body.field, "string");
    assert.equal(typeof response.body.requestId, "string");
    assert.equal("stack" in response.body, false);
  }
});

test("filters are trimmed, case-sensitive, composable, and reported", async () => {
  const matching = await request(app)
    .get(
      `/api/v1/nodes?bundleId=${bundleId}&domain=HistoryRoot&nodeType=event&status=historical`,
    )
    .expect(200);
  assert.ok(matching.body.total > 0);
  assert.deepEqual(matching.body.appliedFilters, {
    bundleId,
    domain: "HistoryRoot",
    nodeType: "event",
    status: "historical",
  });

  const empty = await request(app)
    .get(`/api/v1/nodes?bundleId=${bundleId}&domain=%20%20`)
    .expect(200);
  assert.equal("domain" in empty.body.appliedFilters, false);
  assert.equal(empty.body.total, 11);

  const wrongCase = await request(app)
    .get(`/api/v1/nodes?bundleId=${bundleId}&domain=historyroot`)
    .expect(200);
  assert.equal(wrongCase.body.total, 0);
});

test("unknown filters remain backward-compatible and are explicitly reported", async () => {
  const response = await request(app)
    .get(`/api/v1/nodes?bundleId=${bundleId}&unsupportedFilter=value`)
    .expect(200);

  assert.equal(response.body.total, 11);
  assert.deepEqual(
    response.body.registry.ignoredQueryParameters,
    ["unsupportedFilter"],
  );
});

test("sorting supports route fields, both directions, validation, and stable ties", async () => {
  const ascending = await request(app)
    .get(`/api/v1/nodes?bundleId=${bundleId}&sort=title&direction=asc`)
    .expect(200);
  const descending = await request(app)
    .get(`/api/v1/nodes?bundleId=${bundleId}&sort=title&direction=desc`)
    .expect(200);
  assert.deepEqual(
    descending.body.items.map((item: { title: string }) => item.title),
    ascending.body.items
      .map((item: { title: string }) => item.title)
      .reverse(),
  );

  const tied = await request(app)
    .get(`/api/v1/edges?bundleId=${bundleId}&sort=label&direction=asc&limit=100`)
    .expect(200);
  const associated = tied.body.items
    .filter((item: { label: string }) => item.label === "associated with")
    .map((item: { edgeId: string }) => item.edgeId);
  assert.deepEqual(
    associated,
    [...associated].sort((left, right) => left.localeCompare(right)),
  );

  const invalidDirection = await request(app)
    .get(`/api/v1/nodes?direction=sideways`)
    .expect(400);
  assert.equal(invalidDirection.body.error, "INVALID_DIRECTION");
  assert.equal(invalidDirection.body.category, "invalid-sort");
  assert.equal(invalidDirection.body.field, "direction");

  const invalidSort = await request(app)
    .get(`/api/v1/nodes?sort=secretColumn`)
    .expect(400);
  assert.equal(invalidSort.body.error, "INVALID_SORT");
  assert.equal(invalidSort.body.category, "invalid-sort");
  assert.equal(invalidSort.body.field, "sort");
  assert.equal("stack" in invalidSort.body, false);
});

test("source-linked assertion and edge filters use exact registry associations", async () => {
  const sourceId = "source-chm-oleary";
  for (const resource of ["assertions", "edges"]) {
    const response = await request(app)
      .get(`/api/v1/${resource}?bundleId=${bundleId}&sourceId=${sourceId}`)
      .expect(200);
    assert.ok(response.body.items.length > 0);
    assert.ok(
      response.body.items.every(
        (item: { sourceIds: string[] }) =>
          item.sourceIds.includes(sourceId),
      ),
    );
    assert.equal(response.body.appliedFilters.sourceId, sourceId);
  }
});

test("bundle aliases, imported bundles, revisions, context, and search share the envelope", async () => {
  const paths = [
    `/api/v1/bundles/${bundleId}/nodes?limit=2`,
    `/api/v1/import?bundleId=${bundleId}`,
    `/api/v1/revisions?bundleId=${bundleId}`,
    `/api/v1/context/entities?bundleId=${bundleId}`,
    `/api/v1/search?q=fire&bundleId=${bundleId}&domain=HistoryRoot`,
  ];

  for (const path of paths) {
    const response = await request(app).get(path).expect(200);
    assert.equal(response.body.contractVersion, "1.0");
    assert.ok(Array.isArray(response.body.items));
    assert.equal(response.body.returned, response.body.items.length);
    assert.equal(response.body.pagination.total, response.body.total);
    assert.equal(response.body.totalSemantics, "exact");
  }

  const search = await request(app)
    .get(`/api/v1/search?q=fire&bundleId=${bundleId}&domain=HistoryRoot`)
    .expect(200);
  assert.deepEqual(search.body.items, search.body.results);
});

test("legacy not-found fields remain while standard error metadata is additive", async () => {
  const response = await request(app)
    .get("/api/v1/nodes/not-a-node")
    .expect(404);

  assert.equal(response.body.error, "NODE_NOT_FOUND");
  assert.equal(response.body.code, "NODE_NOT_FOUND");
  assert.equal(response.body.message, "No node found with ID not-a-node.");
  assert.equal(response.body.status, 404);
  assert.equal(response.body.category, "not-found");
  assert.equal(response.body.field, "nodeId");
  assert.equal(typeof response.body.requestId, "string");
});

test("invalid filters and internal errors expose only allowlisted safe detail", async () => {
  const invalidFilter = await request(app)
    .get("/api/v1/search?q=fire&type=private-table")
    .expect(400);
  assert.equal(invalidFilter.body.error, "INVALID_SEARCH_TYPE");
  assert.equal(invalidFilter.body.category, "invalid-filter");
  assert.equal(invalidFilter.body.field, "type");
  assert.equal("stack" in invalidFilter.body, false);

  const secret = "database-password-that-must-not-leak";
  const internal = createApiError(
    "INTERNAL_SERVER_ERROR",
    "The SourceRoot backend encountered an unexpected error.",
    500,
    {
      category: "internal-error",
      details: { operation: "registry-read" },
    },
  );
  const serialized = JSON.stringify(internal);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("stack"), false);
  assert.equal(serialized.includes("DATABASE_URL"), false);
  assert.equal(internal.status, 500);
});
