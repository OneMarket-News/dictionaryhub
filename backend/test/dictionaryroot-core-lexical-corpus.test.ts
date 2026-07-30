import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  buildCoreLexicalCorpus,
  CORE_LEXICAL_CORPUS_ID,
} from "../src/dictionaryroot/core-lexical-corpus.js";
import type {
  DictionaryRootCoreLexicalCorpus,
} from "../src/dictionaryroot/lexical-evidence-types.js";
import { closeDatabase, getPool } from "../src/lib/database.js";
import {
  saveDictionaryRootCoreLexicalCorpus,
} from "../src/services/lexical-evidence-store.js";

const app = createApp();
const corpusUrl = new URL(
  "../data/dictionaryroot-core-lexical-corpus-v1/corpus.json",
  import.meta.url,
);
const inventoryUrl = new URL(
  "../data/dictionaryroot-core-lexical-corpus-v1/inventory.json",
  import.meta.url,
);
let corpus: DictionaryRootCoreLexicalCorpus;

function database() {
  const pool = getPool();
  if (!pool) throw new Error("Core lexical corpus tests require DATABASE_URL.");
  return pool;
}

before(async () => {
  corpus = JSON.parse(
    await readFile(corpusUrl, "utf8"),
  ) as DictionaryRootCoreLexicalCorpus;
  await saveDictionaryRootCoreLexicalCorpus(corpus);
});

after(async () => {
  await closeDatabase();
});

test("1. production identity and mandatory minimums are exact", async () => {
  const inventory = JSON.parse(await readFile(inventoryUrl, "utf8")) as {
    counts: Record<string, number>;
    requiredLemmaCoverage: Record<string, boolean>;
  };
  assert.equal(corpus.dataset.datasetId, CORE_LEXICAL_CORPUS_ID);
  assert.equal(corpus.dataset.version, "1.0.0");
  assert.equal(corpus.dataset.fixtureOnly, false);
  for (const [key, minimum] of Object.entries({
    sources: 12, lemmas: 300, senses: 600, definitionClaims: 600, forms: 150,
    etymologyProposals: 100, sourceComparisons: 100, locators: 600,
    fieldProvenance: 600, relationships: 400, relationshipEvidence: 400,
    historicalOrObsoleteSenses: 50, technicalOrSpecializedSenses: 50,
    uncertaintyBearingStructures: 50,
  })) {
    assert.ok((inventory.counts[key] ?? 0) >= minimum,
      `${key}: ${inventory.counts[key]} < ${minimum}`);
  }
  assert.ok(Object.values(inventory.requiredLemmaCoverage).every(Boolean));
});

test("2. accepted rights boundary excludes restricted source claims", () => {
  const claimSources = new Set(corpus.definitionClaims.map((claim) => claim.sourceId));
  const reusable = new Set(corpus.sources.filter((source) =>
    ["public_domain", "open_license"].includes(source.rightsClass))
    .map((source) => source.sourceId));
  for (const sourceId of claimSources) assert.ok(reusable.has(sourceId), sourceId);
  assert.doesNotMatch(JSON.stringify(corpus), /merriam-webster-online|oed-online|etymonline/u);
});

test("3. relationship evidence remains one independently inspectable row per relationship", () => {
  assert.ok(corpus.relationships.length >= 400);
  assert.ok(corpus.relationshipEvidence.length >= corpus.relationships.length);
  const relationshipIds = new Set(corpus.relationships.map((item) =>
    item.relationshipId));
  for (const evidence of corpus.relationshipEvidence) {
    assert.ok(relationshipIds.has(evidence.relationshipId));
  }
});

test("4. deterministic builder matches the committed canonical corpus", async () => {
  const built = await buildCoreLexicalCorpus({
    pilotPath: fileURLToPath(new URL(
      "../../data/dictionaryroot/dictionaryroot-oewn-2025-pilot-10000.json",
      import.meta.url,
    )),
    candidateSourcesPath: fileURLToPath(new URL(
      "../data/dictionaryroot-corpus-scaling-acquisition-v1/candidate-sources.json",
      import.meta.url,
    )),
    websterPath: fileURLToPath(new URL(
      "../data/dictionaryroot-core-lexical-corpus-v1/webster-1913.txt",
      import.meta.url,
    )),
  });
  assert.deepEqual(built.corpus, corpus);
  assert.equal((built.qualityReview as { blockerCount: number }).blockerCount, 0);
});

test("5. duplicate reimport is replacement-safe", async () => {
  await saveDictionaryRootCoreLexicalCorpus(corpus);
  const result = await database().query(
    `SELECT
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_lemmas
       WHERE dataset_id=$1) AS lemmas,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_relationships
       WHERE dataset_id=$1) AS relationships`,
    [CORE_LEXICAL_CORPUS_ID],
  );
  assert.deepEqual(result.rows[0], {
    lemmas: corpus.lemmas.length,
    relationships: corpus.relationships.length,
  });
});

test("6. controlled prior-version state is replaced by version 1.0.0", async () => {
  await database().query(
    `UPDATE dictionaryroot_lexical_evidence_datasets
     SET version='0.9.0' WHERE dataset_id=$1`,
    [CORE_LEXICAL_CORPUS_ID],
  );
  await saveDictionaryRootCoreLexicalCorpus(corpus);
  const result = await database().query(
    "SELECT version FROM dictionaryroot_lexical_evidence_datasets WHERE dataset_id=$1",
    [CORE_LEXICAL_CORPUS_ID],
  );
  assert.equal(result.rows[0]?.version, "1.0.0");
});

test("7. failed replacement rolls back the accepted production corpus", async () => {
  const broken = structuredClone(corpus);
  broken.sources.push(structuredClone(broken.sources[0]!));
  await assert.rejects(saveDictionaryRootCoreLexicalCorpus(broken));
  const result = await database().query(
    `SELECT version,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_lemmas
       WHERE dataset_id=$1) AS lemmas
     FROM dictionaryroot_lexical_evidence_datasets WHERE dataset_id=$1`,
    [CORE_LEXICAL_CORPUS_ID],
  );
  assert.deepEqual(result.rows[0], { version: "1.0.0", lemmas: 500 });
});

test("8. fixture is excluded and legacy lexicon tables remain empty", async () => {
  const result = await database().query(
    `SELECT
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexical_evidence_datasets
       WHERE fixture_only=TRUE) AS fixtures,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexicon_datasets) AS datasets,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexicon_synsets) AS synsets,
      (SELECT COUNT(*)::INTEGER FROM dictionaryroot_lexicon_relations) AS relations`,
  );
  assert.deepEqual(result.rows[0], {
    fixtures: 0, datasets: 0, synsets: 0, relations: 0,
  });
});

test("9. canonical coverage endpoint returns production metrics", async () => {
  const response = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/coverage").expect(200);
  assert.equal(response.body.productionDatasetAvailable, true);
  assert.equal(response.body.datasetId, CORE_LEXICAL_CORPUS_ID);
  assert.equal(response.body.datasetVersion, "1.0.0");
  assert.equal(response.body.lemmaCount, 500);
  assert.equal(response.body.orphanCounts.relationships, 0);
});

test("10. production source accounting is canonical and bounded", async () => {
  const response = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/sources").expect(200);
  assert.equal(response.body.datasetId, CORE_LEXICAL_CORPUS_ID);
  assert.equal(response.body.total, 17);
  assert.ok(response.body.items.some((item: { sourceId: string;
    supportedClaimCount: number }) =>
    item.sourceId === "oewn-2025" && item.supportedClaimCount >= 600));
});

test("11. bank, light, and run retain distinct production polysemy", async () => {
  for (const lemma of ["bank", "light", "run"]) {
    const response = await request(app)
      .get("/api/v1/dictionaryroot/lexicon/evidence/search")
      .query({ q: lemma, limit: 100 }).expect(200);
    assert.ok(response.body.total >= 2, `${lemma}: ${response.body.total}`);
    assert.ok(response.body.items.every((item: { senseId: string }) =>
      item.senseId.startsWith("lex-sense-core-")));
    if (lemma === "bank") {
      const partsOfSpeech = new Set(response.body.items.map(
        (item: { partOfSpeech: string }) => item.partOfSpeech,
      ));
      assert.ok(partsOfSpeech.has("noun"));
      assert.ok(partsOfSpeech.has("verb"));
    }
  }
});

test("12. required cross-Root terms are searchable without fallback records", async () => {
  for (const lemma of ["island", "logos", "homeland", "translation"]) {
    const response = await request(app)
      .get("/api/v1/dictionaryroot/lexicon/evidence/search")
      .query({ q: lemma, limit: 25 }).expect(200);
    assert.ok(response.body.total >= 1, lemma);
  }
});

test("13. island alternatives and logos uncertainty remain explicit", async () => {
  const islandSearch = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/search")
    .query({ q: "island", limit: 25 }).expect(200);
  const island = await request(app)
    .get(`/api/v1/dictionaryroot/lexicon/evidence/senses/${islandSearch.body.items[0].senseId}`)
    .expect(200);
  assert.equal(island.body.etymologyProposals.length, 2);
  assert.ok(island.body.etymologyProposals.every(
    (proposal: { competingProposalIds: string[] }) =>
      proposal.competingProposalIds.length === 1,
  ));
  assert.deepEqual(
    new Set(island.body.etymologyProposals.map(
      (proposal: { reviewStatus: string }) => proposal.reviewStatus,
    )),
    new Set(["reviewed_historical_source", "unresolved"]),
  );

  const logosSearch = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/search")
    .query({ q: "logos", limit: 25 }).expect(200);
  const logos = await request(app)
    .get(`/api/v1/dictionaryroot/lexicon/evidence/senses/${logosSearch.body.items[0].senseId}`)
    .expect(200);
  assert.ok(logos.body.claims.some(
    (claim: { uncertainty?: string; qualification?: string }) =>
      claim.uncertainty || claim.qualification,
  ));
});

test("14. graph adapter returns stable duplicate-free production objects", async () => {
  const seeds = await request(app)
    .get("/api/v1/dictionaryroot/lexicon/evidence/graph/seeds")
    .query({ q: "bank", limit: 10 }).expect(200);
  assert.ok(seeds.body.total >= 2);
  const seedId = seeds.body.items[0].id;
  const graph = await request(app)
    .get(`/api/v1/dictionaryroot/lexicon/evidence/graph/neighborhood/${encodeURIComponent(seedId)}`)
    .query({ depth: 2, limit: 100 }).expect(200);
  assert.ok(graph.body.items.some((item: { node: { nodeId: string } }) =>
    item.node.nodeId === seedId));
  assert.equal(new Set(graph.body.items.map((item: { node: { nodeId: string } }) =>
    item.node.nodeId)).size, graph.body.items.length);
  assert.equal(new Set(graph.body.edges.map((item: { edgeId: string }) =>
    item.edgeId)).size,
    graph.body.edges.length);
});

test("15. HistoryRoot remains at 1.3.0 and migration 015 is absent", async () => {
  const result = await database().query(
    `SELECT
      (SELECT version FROM imported_bundles
       WHERE bundle_id='historyroot-plymouth-knowledge-dataset-v1')
       AS history_version,
      (SELECT COUNT(*)::INTEGER FROM schema_migrations
       WHERE migration_name LIKE '015%') AS migration_015_count`,
  );
  assert.deepEqual(result.rows[0], {
    history_version: "1.3.0",
    migration_015_count: 0,
  });
});
