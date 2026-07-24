import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  countPlymouthRecords,
  loadPlymouthBundle,
  loadPlymouthClaimEvidenceMatrix,
  loadPlymouthManifest,
  loadPlymouthSourceRegister,
  PLYMOUTH_BUNDLE_ID,
  PLYMOUTH_DATASET_DISCLAIMER,
  validatePlymouthDataset,
} from "../src/historyroot/plymouth-dataset.js";
import type { ContextEntity } from "../src/contextual-types.js";
import { getPool } from "../src/lib/database.js";
import {
  deleteImportedBundle,
  getImportedBundle,
  saveImportedBundle,
} from "../src/services/import-store.js";
import { validateBundle } from "../src/services/validator.js";
import type { SourceRootBundle } from "../src/types.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

const app = createApp();
const contextualFixtureUrl = new URL(
  "./fixtures/contextual-historyroot-valid.json",
  import.meta.url,
);

function requireImportServiceToken(): string {
  const token = process.env.IMPORT_SERVICE_TOKEN;

  if (!token) {
    throw new Error(
      "HistoryRoot Plymouth tests require IMPORT_SERVICE_TOKEN in .env.test.",
    );
  }

  return token;
}

function requireContext(bundle: SourceRootBundle) {
  if (!bundle.context) {
    throw new Error("Plymouth dataset context is missing.");
  }

  return bundle.context;
}

function findEntity(
  entities: ContextEntity[],
  nameOrAlias: string,
): ContextEntity | undefined {
  const normalized = nameOrAlias.toLocaleLowerCase();
  return entities.find((entity) =>
    [entity.name, ...(entity.alternateNames ?? [])].some(
      (name) => name.toLocaleLowerCase() === normalized,
    ));
}

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("dataset validation reports all quality gates passing", async () => {
  const report = await validatePlymouthDataset();

  assert.equal(report.ready, true);
  assert.equal(report.totals.pass, 45);
  assert.equal(report.totals.fail, 0);
  assert.equal(report.totals.warn, 0);
  assert.equal(report.totals.info, 2);
});

test("generic validation accepts the dataset without warnings", async () => {
  const result = validateBundle(await loadPlymouthBundle());

  assert.equal(result.status, "ready");
  assert.equal(result.canImport, true);
  assert.equal(result.summary.contextualRecords, 393);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
});

test("manifest preserves the exact pilot-review disclaimer and scope", async () => {
  const [bundle, manifest] = await Promise.all([
    loadPlymouthBundle(),
    loadPlymouthManifest(),
  ]);

  assert.equal(manifest.disclaimer, PLYMOUTH_DATASET_DISCLAIMER);
  assert.match(bundle.description ?? "", new RegExp(
    `^${PLYMOUTH_DATASET_DISCLAIMER.replaceAll(".", "\\.")}`,
  ));
  assert.equal(
    (bundle.extensions?.transitionBoundary as {
      charterSigned: string;
      provinceInaugurated: string;
    }).charterSigned,
    "1691-10-07",
  );
  assert.equal(
    (bundle.extensions?.transitionBoundary as {
      charterSigned: string;
      provinceInaugurated: string;
    }).provinceInaugurated,
    "1692-05-14",
  );
});

test("dataset counts meet every target range", async () => {
  const [bundle, manifest] = await Promise.all([
    loadPlymouthBundle(),
    loadPlymouthManifest(),
  ]);
  const counts = countPlymouthRecords(bundle);

  assert.deepEqual(counts, manifest.counts);
  for (const [name, [minimum, maximum]] of Object.entries(
    manifest.targets,
  )) {
    assert.ok(counts[name] !== undefined);
    assert.ok(counts[name] >= minimum, `${name} below target`);
    assert.ok(counts[name] <= maximum, `${name} above target`);
  }
});

test("required canonical names and aliases resolve to stable IDs", async () => {
  const entities = requireContext(await loadPlymouthBundle()).entities ?? [];
  const expected = new Map([
    ["Plymouth", "historyroot-plymouth-place-patuxet-plymouth"],
    ["Patuxet", "historyroot-plymouth-group-patuxet"],
    ["Wampanoag", "historyroot-plymouth-group-wampanoag"],
    ["Massasoit", "historyroot-plymouth-person-ousamequin"],
    ["Ousamequin", "historyroot-plymouth-person-ousamequin"],
    ["Squanto", "historyroot-plymouth-person-tisquantum"],
    ["Tisquantum", "historyroot-plymouth-person-tisquantum"],
    [
      "Mayflower Compact",
      "historyroot-plymouth-event-mayflower-compact",
    ],
    [
      "King Philip's War",
      "historyroot-plymouth-event-metacoms-war",
    ],
    ["Metacom", "historyroot-plymouth-person-metacom"],
  ]);

  for (const [name, id] of expected) {
    assert.equal(findEntity(entities, name)?.id, id);
  }
});

test("source register enforces the inspected-source claim gate", async () => {
  const [bundle, register] = await Promise.all([
    loadPlymouthBundle(),
    loadPlymouthSourceRegister(),
  ]);
  const sources = (bundle.sources ?? []) as Array<{
    id: string;
    accessStatus: string;
    supportsDetailedClaims: boolean;
    locatorsInspected: string[];
  }>;
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  assert.equal(register.sources.length, 20);
  assert.ok(register.consideredButNotUsed.length >= 3);
  assert.ok(
    sources.some(
      (source) =>
        source.accessStatus === "metadata-verified-not-inspected"
        && !source.supportsDetailedClaims,
    ),
  );
  assert.ok(
    sources
      .filter(
        (source) => source.accessStatus === "accessed-and-inspected",
      )
      .every(
        (source) =>
          source.supportsDetailedClaims
          && source.locatorsInspected.length > 0,
      ),
  );
  assert.ok(
    (requireContext(bundle).claims ?? []).every((claim) =>
      (claim.sourceIds ?? []).every(
        (sourceId) =>
          sourceById.get(sourceId)?.accessStatus
            === "accessed-and-inspected",
      )),
  );
});

test("every claim has evidence, a locator, a limitation, and a matrix row", async () => {
  const [bundle, matrix] = await Promise.all([
    loadPlymouthBundle(),
    loadPlymouthClaimEvidenceMatrix(),
  ]);
  const context = requireContext(bundle);
  const evidenceByClaim = new Map(
    (context.evidence ?? []).map((item) => [item.claimId, item]),
  );
  const matrixByClaim = new Map(
    matrix.claims.map((row) => [row.claimId, row]),
  );

  for (const claim of context.claims ?? []) {
    const evidence = evidenceByClaim.get(claim.id);
    const row = matrixByClaim.get(claim.id);
    assert.ok(evidence, `missing evidence for ${claim.id}`);
    assert.ok(evidence.metadata?.locator);
    assert.ok(evidence.metadata?.limitation);
    assert.ok(row, `missing matrix row for ${claim.id}`);
    assert.ok(row.locator);
    assert.ok(row.limitation);
    assert.equal(row.reviewRequired, true);
  }
});

test("Compact textual history models the lost original and three witnesses", async () => {
  const context = requireContext(await loadPlymouthBundle());
  const original = (context.entities ?? []).find(
    (entity) =>
      entity.id
        === "historyroot-plymouth-document-mayflower-compact-original",
  );
  const witnesses = (context.relationships ?? []).filter(
    (relationship) =>
      relationship.relationshipType === "textual_witness_of"
      && relationship.toId
        === "historyroot-plymouth-work-mayflower-compact-text",
  );

  assert.equal(original?.metadata?.originalLost, true);
  assert.deepEqual(
    new Set(witnesses.map((relationship) => relationship.fromId)),
    new Set([
      "historyroot-plymouth-document-mourts-1622",
      "historyroot-plymouth-document-purchas-1625",
      "historyroot-plymouth-document-bradford-manuscript",
    ]),
  );
});

test("event time, perspective, causal, and cultural-memory safeguards are complete", async () => {
  const context = requireContext(await loadPlymouthBundle());
  const eventIds = new Set(
    (context.entities ?? [])
      .filter((entity) => entity.entityType === "event")
      .map((entity) => entity.id),
  );
  const timedIds = new Set(
    (context.temporalAssertions ?? []).map((item) => item.subjectId),
  );

  assert.ok([...eventIds].every((id) => timedIds.has(id)));
  const entityById = new Map(
    (context.entities ?? []).map((entity) => [entity.id, entity]),
  );
  assert.equal(
    entityById.get(
      "historyroot-plymouth-event-epenow-capture-return",
    )?.metadata?.coveragePeriod,
    "background-1605-1615",
  );
  assert.equal(
    entityById.get(
      "historyroot-plymouth-event-tisquantum-atlantic-captivity",
    )?.metadata?.coveragePeriod,
    "background-to-core-bridge",
  );
  assert.ok(
    (context.recordPerspectives ?? []).every((link) => link.notes),
  );
  assert.ok(
    (context.causalLinks ?? []).every((link) =>
      link.sourceIds?.length
      && link.uncertainty
      && link.metadata?.notDeterministic === true),
  );
  assert.ok(
    (context.culturalMemories ?? []).every(
      (memory) => memory.sourceId && memory.perspectiveId,
    ),
  );
});

test("missing within-bundle source references are rejected before import", async () => {
  const bundle = structuredClone(await loadPlymouthBundle());
  const firstClaim = requireContext(bundle).claims?.[0];

  assert.ok(firstClaim);
  firstClaim.sourceIds = ["historyroot-external-source-not-in-bundle"];
  const result = validateBundle(bundle);

  assert.equal(result.canImport, false);
  assert.ok(
    result.errors.some(
      (issue) => issue.code === "CONTEXT_SOURCE_NOT_FOUND",
    ),
  );
});

test("import populates all Plymouth contextual tables", async () => {
  const bundle = await loadPlymouthBundle();
  await saveImportedBundle(bundle);
  const pool = getPool();

  assert.ok(pool);
  const result = await pool.query<Record<string, string>>(`
    SELECT
      (SELECT COUNT(*) FROM imported_bundles) AS bundles,
      (SELECT COUNT(*) FROM sources) AS sources,
      (SELECT COUNT(*) FROM context_records) AS records,
      (SELECT COUNT(*) FROM context_entities) AS entities,
      (SELECT COUNT(*) FROM context_temporal_assertions) AS temporal,
      (SELECT COUNT(*) FROM context_claims) AS claims,
      (SELECT COUNT(*) FROM context_evidence) AS evidence,
      (SELECT COUNT(*) FROM context_interpretations) AS interpretations,
      (SELECT COUNT(*) FROM context_perspectives) AS perspectives,
      (SELECT COUNT(*) FROM context_record_perspectives) AS perspective_links,
      (SELECT COUNT(*) FROM context_causal_links) AS causal_links,
      (SELECT COUNT(*) FROM context_relationships) AS relationships,
      (SELECT COUNT(*) FROM context_cultural_memories) AS memories;
  `);
  const row = result.rows[0];

  assert.ok(row);
  assert.equal(Number(row.bundles), 1);
  assert.equal(Number(row.sources), 20);
  assert.equal(Number(row.records), 393);
  assert.equal(Number(row.entities), 115);
  assert.equal(Number(row.temporal), 45);
  assert.equal(Number(row.claims), 49);
  assert.equal(Number(row.evidence), 49);
  assert.equal(Number(row.interpretations), 12);
  assert.equal(Number(row.perspectives), 10);
  assert.equal(Number(row.perspective_links), 18);
  assert.equal(Number(row.causal_links), 18);
  assert.equal(Number(row.relationships), 71);
  assert.equal(Number(row.memories), 6);
});

test("stable IDs resolve through contextual APIs", async () => {
  await saveImportedBundle(await loadPlymouthBundle());

  const person = await request(app)
    .get("/api/v1/context/entities/historyroot-plymouth-person-ousamequin")
    .expect(200);
  const event = await request(app)
    .get("/api/v1/context/entities/historyroot-plymouth-event-metacoms-war")
    .expect(200);
  const claims = await request(app)
    .get(`/api/v1/context/claims?bundleId=${PLYMOUTH_BUNDLE_ID}&limit=100`)
    .expect(200);

  assert.equal(person.body.name, "Ousamequin");
  assert.ok(person.body.alternateNames.includes("Massasoit"));
  assert.equal(event.body.name, "Metacom's War");
  assert.equal(claims.body.total, 49);
});

test("SourceRoot search resolves required Plymouth names and aliases", async () => {
  await saveImportedBundle(await loadPlymouthBundle());
  const expected = new Map([
    ["Plymouth", "historyroot-plymouth-place-patuxet-plymouth"],
    ["Patuxet", "historyroot-plymouth-place-patuxet-plymouth"],
    ["Wampanoag", "historyroot-plymouth-group-wampanoag"],
    ["Massasoit", "historyroot-plymouth-person-ousamequin"],
    ["Ousamequin", "historyroot-plymouth-person-ousamequin"],
    ["Squanto", "historyroot-plymouth-person-tisquantum"],
    ["Tisquantum", "historyroot-plymouth-person-tisquantum"],
    [
      "Mayflower Compact",
      "historyroot-plymouth-event-mayflower-compact",
    ],
    [
      "King Philip's War",
      "historyroot-plymouth-event-metacoms-war",
    ],
    ["Metacom", "historyroot-plymouth-person-metacom"],
  ]);

  for (const [query, id] of expected) {
    const response = await request(app)
      .get("/api/v1/search")
      .query({ q: query, domain: "HistoryRoot", limit: 100 })
      .expect(200);
    assert.ok(
      response.body.results.some(
        (result: { id: string }) => result.id === id,
      ),
      `${query} did not resolve ${id}`,
    );
  }
});

test("re-import replaces only records owned by the Plymouth bundle", async () => {
  const bundle = await loadPlymouthBundle();
  await saveImportedBundle(bundle);
  const replacement = structuredClone(bundle);
  const replacementContext = requireContext(replacement);
  replacementContext.culturalMemories = (
    replacementContext.culturalMemories ?? []
  ).slice(1);
  const ousamequin = (replacementContext.entities ?? []).find(
    (entity) =>
      entity.id === "historyroot-plymouth-person-ousamequin",
  );

  assert.ok(ousamequin);
  ousamequin.label = "Ousamequin (replacement test)";
  ousamequin.name = "Ousamequin (replacement test)";
  await saveImportedBundle(replacement);

  const pool = getPool();
  assert.ok(pool);
  const result = await pool.query<{
    records: string;
    memories: string;
    label: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM context_records) AS records,
      (SELECT COUNT(*) FROM context_cultural_memories) AS memories,
      (
        SELECT label
        FROM context_records
        WHERE context_id = 'historyroot-plymouth-person-ousamequin'
      ) AS label;
  `);
  const row = result.rows[0];

  assert.ok(row);
  assert.equal(Number(row.records), 392);
  assert.equal(Number(row.memories), 5);
  assert.equal(row.label, "Ousamequin (replacement test)");
});

test("a conflicting import rolls back its bundle and sources", async () => {
  const bundle = await loadPlymouthBundle();
  await saveImportedBundle(bundle);
  const conflicting = JSON.parse(
    JSON.stringify(bundle).replaceAll(
      "historyroot-plymouth-source-",
      "historyroot-plymouth-rollback-source-",
    ),
  ) as SourceRootBundle;
  conflicting.bundleId =
    "sourceroot-integration-test-historyroot-plymouth-rollback";

  assert.equal(validateBundle(conflicting).canImport, true);
  await assert.rejects(saveImportedBundle(conflicting), /duplicate key/i);

  const pool = getPool();
  assert.ok(pool);
  const result = await pool.query<{
    bundles: string;
    rollback_bundles: string;
    rollback_sources: string;
    records: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM imported_bundles) AS bundles,
      (
        SELECT COUNT(*) FROM imported_bundles
        WHERE bundle_id =
          'sourceroot-integration-test-historyroot-plymouth-rollback'
      ) AS rollback_bundles,
      (
        SELECT COUNT(*) FROM sources
        WHERE source_id LIKE 'historyroot-plymouth-rollback-source-%'
      ) AS rollback_sources,
      (SELECT COUNT(*) FROM context_records) AS records;
  `);
  const row = result.rows[0];

  assert.ok(row);
  assert.equal(Number(row.bundles), 1);
  assert.equal(Number(row.rollback_bundles), 0);
  assert.equal(Number(row.rollback_sources), 0);
  assert.equal(Number(row.records), 393);
});

test("allow-listed removal deletes Plymouth and preserves an unrelated bundle", async () => {
  const unrelated = JSON.parse(
    await readFile(contextualFixtureUrl, "utf8"),
  ) as SourceRootBundle;
  await saveImportedBundle(unrelated);
  await saveImportedBundle(await loadPlymouthBundle());

  const deleted = await deleteImportedBundle(
    PLYMOUTH_BUNDLE_ID,
    new Set([PLYMOUTH_BUNDLE_ID]),
  );

  assert.equal(deleted.importedBundles, 1);
  assert.equal(deleted.sources, 20);
  assert.equal(deleted.contextualRecords, 393);
  assert.equal(deleted.contextPerspectiveLinks, 18);
  assert.ok(deleted.contextSourceLinks > 0);
  assert.equal(await getImportedBundle(PLYMOUTH_BUNDLE_ID), undefined);
  assert.ok(await getImportedBundle(String(unrelated.bundleId)));

  const pool = getPool();
  assert.ok(pool);
  const result = await pool.query<{ records: string; sources: string }>(`
    SELECT
      (SELECT COUNT(*) FROM context_records) AS records,
      (SELECT COUNT(*) FROM sources) AS sources;
  `);

  assert.equal(Number(result.rows[0]?.records), 30);
  assert.equal(Number(result.rows[0]?.sources), 2);
});

test("removal requires an exact allow-list and the public route stays restricted", async () => {
  await assert.rejects(
    deleteImportedBundle(PLYMOUTH_BUNDLE_ID, new Set()),
    /explicit allow-list/,
  );
  await request(app)
    .delete(`/api/v1/import/${PLYMOUTH_BUNDLE_ID}`)
    .set("x-sourceroot-import-token", requireImportServiceToken())
    .expect(403);
});

test("DictionaryRoot exact-sense ranking remains complete", async () => {
  await saveImportedBundle(await loadPlymouthBundle());
  const pool = getPool();
  assert.ok(pool);
  await pool.query(`
    INSERT INTO dictionaryroot_lexicon_datasets (
      dataset_id, bundle_id, source_id, source_name, source_version,
      source_license, synset_count, lemma_count, relation_count,
      part_of_speech_counts
    )
    VALUES (
      'plymouth-exact-regression-dataset',
      'dictionaryroot-exact-regression',
      'plymouth-exact-regression-source',
      'Exact regression fixture',
      'test',
      'test fixture',
      2,
      1,
      0,
      '{"noun":2}'::JSONB
    );

    INSERT INTO dictionaryroot_lexicon_synsets (
      node_id, dataset_id, bundle_id, source_id, source_version,
      source_synset_key, source_offset, part_of_speech, title,
      definition, synset_type, lexicographer_file_number, lemmas,
      normalized_lemmas, examples, original_gloss
    )
    VALUES
      (
        'plymouth-exact-bank-1',
        'plymouth-exact-regression-dataset',
        'dictionaryroot-exact-regression',
        'plymouth-exact-regression-source',
        'test',
        'noun:plymouth-exact-bank-1',
        '00000001',
        'noun',
        'bank',
        'First exact test sense.',
        'noun',
        1,
        ARRAY['bank'],
        ARRAY['bank'],
        ARRAY[]::TEXT[],
        'First exact test sense.'
      ),
      (
        'plymouth-exact-bank-2',
        'plymouth-exact-regression-dataset',
        'dictionaryroot-exact-regression',
        'plymouth-exact-regression-source',
        'test',
        'noun:plymouth-exact-bank-2',
        '00000002',
        'noun',
        'bank',
        'Second exact test sense.',
        'noun',
        1,
        ARRAY['bank'],
        ARRAY['bank'],
        ARRAY[]::TEXT[],
        'Second exact test sense.'
      );
  `);

  const response = await request(app)
    .get("/api/v1/search?q=bank&limit=10")
    .expect(200);

  assert.equal(response.body.exactSensePolicy, "complete-lemma");
  assert.equal(response.body.coverage.exactSenseCount, 2);
  assert.deepEqual(
    response.body.results.slice(0, 2).map(
      (item: { id: string }) => item.id,
    ),
    ["plymouth-exact-bank-1", "plymouth-exact-bank-2"],
  );
});
