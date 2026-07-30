import assert from "node:assert/strict";
import test, { after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { closeDatabase } from "../src/lib/database.js";
import {
  compareUnifiedResults,
  searchUnified,
  type UnifiedSearchProviders,
  type UnifiedSearchResult,
} from "../src/services/unified-search.js";
import type { SearchResult } from "../src/services/search-store.js";

const app = createApp();

after(async () => {
  await closeDatabase();
});

function historySearchResult(
  values: Partial<SearchResult> = {},
): SearchResult {
  return {
    resultType: "context-entity",
    id: "ctx-place-plymouth-settlement",
    bundleId: "historyroot-plymouth-knowledge-dataset-v1",
    title: "Plymouth",
    summary: "A canonical HistoryRoot place record.",
    domain: "HistoryRoot",
    objectType: "place",
    metadata: {
      recordKind: "entity",
      entityType: "place",
      alternateNames: [],
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...values,
  };
}

function providers(
  overrides: Partial<UnifiedSearchProviders> = {},
): UnifiedSearchProviders {
  return {
    dictionaryRoot: async () => ({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      items: [{
        senseId: "lex-sense-community-group",
        lemmaId: "lex-lemma-community",
        canonicalWrittenForm: "community",
        partOfSpeech: "noun",
        lexicalCategory: "common",
        definition: "A group connected by place, identity, or shared life.",
      }],
    }),
    historyRoot: async () => ({
      total: 1,
      results: [historySearchResult({
        id: "ctx-community-patuxet",
        title: "Patuxet community",
      })],
    }),
    ...overrides,
  };
}

test("1. unified route validates required query and bounded pagination", async () => {
  const missing = await request(app)
    .get("/api/v1/search/unified")
    .expect(400);
  assert.equal(missing.body.code, "INVALID_QUERY");

  const limit = await request(app)
    .get("/api/v1/search/unified")
    .query({ q: "bank", limit: 21 })
    .expect(400);
  assert.equal(limit.body.code, "INVALID_LIMIT");

  const page = await request(app)
    .get("/api/v1/search/unified")
    .query({ q: "bank", page: 6 })
    .expect(400);
  assert.equal(page.body.code, "INVALID_PAGE");

  const query = await request(app)
    .get("/api/v1/search/unified")
    .query({ q: "x".repeat(201) })
    .expect(400);
  assert.equal(query.body.code, "INVALID_QUERY");
});

test("2. DictionaryRoot results preserve canonical identity and links", async () => {
  const response = await request(app)
    .get("/api/v1/search/unified")
    .query({ q: "bank", roots: "DictionaryRoot", limit: 10 })
    .expect(200);
  assert.equal(response.body.availability.status, "all-available");
  assert.equal(response.body.counts.HistoryRoot, 0);
  assert.ok(response.body.counts.DictionaryRoot >= 2);
  assert.ok(response.body.items.every((item: UnifiedSearchResult) =>
    item.rootId === "DictionaryRoot"
    && item.datasetId === "dictionaryroot-core-lexical-corpus-v1"
    && item.datasetVersion === "1.0.0"
    && item.canonicalResultType === "lexical-sense"
    && item.canonicalUrl.includes("concept-v2.html?")
    && item.canonicalUrl.includes("nodeId=")));
});

test("3. HistoryRoot results preserve result types, dataset, and detail links", async () => {
  const response = await request(app)
    .get("/api/v1/search/unified")
    .query({
      q: "Plymouth",
      roots: "HistoryRoot",
      resultTypes: "context-entity",
      limit: 10,
    })
    .expect(200);
  assert.ok(response.body.counts.HistoryRoot > 0);
  assert.ok(response.body.items.some((item: UnifiedSearchResult) =>
    item.title.toLocaleLowerCase().includes("plymouth")));
  assert.ok(response.body.items.every((item: UnifiedSearchResult) =>
    item.rootId === "HistoryRoot"
    && item.datasetId === "historyroot-plymouth-knowledge-dataset-v1"
    && item.datasetVersion === "1.3.0"
    && item.canonicalResultType === "context-entity"
    && item.canonicalUrl.startsWith("history-record-v1.html?id=")));
});

test("4. a live overlap term returns separately owned Root results", async () => {
  const response = await request(app)
    .get("/api/v1/search/unified")
    .query({ q: "community", limit: 20 })
    .expect(200);
  assert.ok(response.body.counts.DictionaryRoot > 0);
  assert.ok(response.body.counts.HistoryRoot > 0);
  assert.deepEqual(
    new Set(response.body.items.map((item: UnifiedSearchResult) => item.rootId)),
    new Set(["DictionaryRoot", "HistoryRoot"]),
  );
  assert.ok(response.body.items.every((item: UnifiedSearchResult) =>
    item.connectionBasis === "query-overlap-only"));
});

test("5. repeated requests have byte-stable result ordering", async () => {
  const url = "/api/v1/search/unified?q=community&limit=20";
  const [first, second] = await Promise.all([
    request(app).get(url).expect(200),
    request(app).get(url).expect(200),
  ]);
  assert.deepEqual(
    first.body.items.map((item: UnifiedSearchResult) => item.resultId),
    second.body.items.map((item: UnifiedSearchResult) => item.resultId),
  );
  assert.deepEqual(first.body.ordering, second.body.ordering);
});

test("6. stable pages contain no duplicate result IDs", async () => {
  const [first, second] = await Promise.all([
    request(app)
      .get("/api/v1/search/unified")
      .query({ q: "community", limit: 5, page: 1 })
      .expect(200),
    request(app)
      .get("/api/v1/search/unified")
      .query({ q: "community", limit: 5, page: 2 })
      .expect(200),
  ]);
  const ids = first.body.items.concat(second.body.items)
    .map((item: UnifiedSearchResult) => item.resultId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(first.body.counts.duplicateResultIds, 0);
  assert.equal(second.body.counts.duplicateResultIds, 0);
});

test("7. Root and result-type filters are explicit and exact", async () => {
  const root = await request(app)
    .get("/api/v1/search/unified")
    .query({ q: "community", roots: "DictionaryRoot" })
    .expect(200);
  assert.ok(root.body.items.every((item: UnifiedSearchResult) =>
    item.rootId === "DictionaryRoot"));
  assert.deepEqual(root.body.appliedFilters.roots, ["DictionaryRoot"]);

  const type = await request(app)
    .get("/api/v1/search/unified")
    .query({
      q: "Plymouth",
      roots: "HistoryRoot",
      resultTypes: "context-entity",
    })
    .expect(200);
  assert.ok(type.body.items.every((item: UnifiedSearchResult) =>
    item.canonicalResultType === "context-entity"));
  assert.deepEqual(type.body.appliedFilters.resultTypes, ["context-entity"]);
});

test("8. incompatible Root and result-type filters return an explicit state", async () => {
  const response = await request(app)
    .get("/api/v1/search/unified")
    .query({
      q: "bank",
      roots: "DictionaryRoot",
      resultTypes: "context-entity",
    })
    .expect(200);
  assert.equal(
    response.body.availability.status,
    "filters-exclude-all-result-types",
  );
  assert.equal(response.body.total, 0);
  assert.deepEqual(response.body.items, []);
});

test("9. one failed Root returns partial availability without fallback data", async () => {
  const result = await searchUnified({
    query: "community",
    roots: ["DictionaryRoot", "HistoryRoot"],
    resultTypes: [],
    page: 1,
    limit: 10,
  }, providers({
    dictionaryRoot: async () => {
      throw new Error("DictionaryRoot unavailable");
    },
  }));
  assert.equal(result.availability.status, "partial-availability");
  assert.deepEqual(result.availability.unavailableRoots, ["DictionaryRoot"]);
  assert.equal(result.counts.DictionaryRoot, 0);
  assert.equal(result.counts.HistoryRoot, 1);
  assert.ok(result.items.every((item) => item.rootId === "HistoryRoot"));
});

test("10. both failed Roots return the all-unavailable service state", async () => {
  const failed = async () => {
    throw new Error("unavailable");
  };
  const result = await searchUnified({
    query: "community",
    roots: ["DictionaryRoot", "HistoryRoot"],
    resultTypes: [],
    page: 1,
    limit: 10,
  }, providers({
    dictionaryRoot: failed,
    historyRoot: failed,
  }));
  assert.equal(result.availability.status, "all-unavailable");
  assert.deepEqual(
    result.availability.unavailableRoots,
    ["DictionaryRoot", "HistoryRoot"],
  );
  assert.equal(result.total, 0);
});

test("11. a timed-out Root degrades to explicit partial availability", async () => {
  const result = await searchUnified({
    query: "community",
    roots: ["DictionaryRoot", "HistoryRoot"],
    resultTypes: [],
    page: 1,
    limit: 10,
  }, providers({
    dictionaryRoot: () => new Promise(() => {}),
  }), 5);
  assert.equal(result.availability.status, "partial-availability");
  assert.deepEqual(result.availability.unavailableRoots, ["DictionaryRoot"]);
  assert.equal(result.bounds.perRootTimeoutMs, 5);
});

test("12. normalization bounds summaries and prevents opaque scoring", async () => {
  const result = await searchUnified({
    query: "community",
    roots: ["DictionaryRoot"],
    resultTypes: [],
    page: 1,
    limit: 10,
  }, providers({
    dictionaryRoot: async () => ({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      items: [{
        senseId: "sense-long",
        canonicalWrittenForm: "community",
        definition: "x".repeat(400),
      }],
    }),
  }));
  assert.equal(result.items[0]?.summary?.length, 280);
  assert.equal(result.items[0]?.matchClassification, "exact");
  assert.ok(!JSON.stringify(result).includes("relevanceScore"));
});

test("13. comparator uses documented stable tie-breakers", () => {
  const base: UnifiedSearchResult = {
    resultId: "HistoryRoot:context-entity:b",
    rootId: "HistoryRoot",
    rootDisplayName: "HistoryRoot",
    canonicalObjectId: "b",
    canonicalResultType: "context-entity",
    title: "Beta",
    summary: null,
    canonicalUrl: "history-record-v1.html?id=b",
    datasetId: "historyroot-plymouth-knowledge-dataset-v1",
    datasetVersion: "1.3.0",
    matchClassification: "contextual-occurrence",
    matchExplanation: "Contextual occurrence.",
    sourceEvidenceAvailable: false,
    connectionBasis: "query-overlap-only",
    rootSpecificMetadata: {},
  };
  const exact: UnifiedSearchResult = {
    ...base,
    resultId: "DictionaryRoot:lexical-sense:a",
    rootId: "DictionaryRoot",
    rootDisplayName: "DictionaryRoot",
    canonicalObjectId: "a",
    canonicalResultType: "lexical-sense",
    title: "Alpha",
    canonicalUrl: "concept-v2.html?nodeId=a",
    datasetId: "dictionaryroot-core-lexical-corpus-v1",
    datasetVersion: "1.0.0",
    matchClassification: "exact",
  };
  assert.ok(compareUnifiedResults(exact, base) < 0);
  assert.ok(compareUnifiedResults(
    { ...base, canonicalObjectId: "a", resultId: "HistoryRoot:context-entity:a" },
    base,
  ) < 0);
});
