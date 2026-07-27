import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  contextEntityTypes,
  evidenceSupportRoles,
} from "../src/contextual-types.js";
import {
  FOUNDATIONAL_CORPUS_BUNDLE_ID,
  FOUNDATIONAL_CORPUS_ID,
  loadFoundationalCorpusBundle,
  loadFoundationalCorpusInventory,
  loadFoundationalCorpusSourceRegister,
  validateFoundationalCorpus,
  type FoundationalCorpusInventory,
  type FoundationalCorpusSourceRegister,
} from "../src/historyroot/foundational-corpus.js";
import type {
  ContextRecordBase,
  ContextualBundle,
} from "../src/contextual-types.js";
import { getPool } from "../src/lib/database.js";
import { saveImportedBundle } from "../src/services/import-store.js";
import { validateBundle } from "../src/services/validator.js";
import type { SourceRootBundle } from "../src/types.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

const app = createApp();
const acceptedPlymouthBundleUrl = new URL(
  "../../data/historyroot/plymouth-v1/historyroot-plymouth-v1.bundle.json",
  import.meta.url,
);
const contextualFixtureUrl = new URL(
  "./fixtures/contextual-historyroot-valid.json",
  import.meta.url,
);

let bundle: SourceRootBundle;
let context: ContextualBundle;
let inventory: FoundationalCorpusInventory;
let sourceRegister: FoundationalCorpusSourceRegister;

function requireDatabase() {
  const database = getPool();
  if (!database) {
    throw new Error(
      "Foundational corpus tests require DATABASE_URL in .env.test.",
    );
  }
  return database;
}

function allContextRecords(value: ContextualBundle): ContextRecordBase[] {
  return [
    ...(value.entities ?? []),
    ...(value.temporalAssertions ?? []),
    ...(value.accounts ?? []),
    ...(value.claims ?? []),
    ...(value.evidence ?? []),
    ...(value.interpretations ?? []),
    ...(value.perspectives ?? []),
    ...(value.causalLinks ?? []),
    ...(value.relationships ?? []),
    ...(value.culturalMemories ?? []),
  ];
}

function allStableIds(value: SourceRootBundle): string[] {
  const sourceIds = (value.sources ?? []).flatMap((source) => {
    if (
      typeof source !== "object"
      || source === null
      || Array.isArray(source)
    ) {
      return [];
    }
    return [String((source as Record<string, unknown>).id ?? "")];
  });
  const subrecordIds = [
    ...(value.context?.aliases ?? []).map((record) => record.id),
    ...(value.context?.externalIdentifiers ?? []).map(
      (record) => record.id,
    ),
    ...(value.context?.claimAttributions ?? []).map(
      (record) => record.id,
    ),
    ...(value.context?.claimRelations ?? []).map(
      (record) => record.id,
    ),
    ...(value.context?.claimVersions ?? []).map(
      (record) => record.id,
    ),
    ...(value.context?.evidenceClaimLinks ?? []).map(
      (record) => record.id,
    ),
    ...(value.context?.evidenceVersions ?? []).map(
      (record) => record.id,
    ),
    ...(value.context?.sourceLocators ?? []).map(
      (record) => record.id,
    ),
    ...(value.context?.fieldProvenance ?? []).map(
      (record) => record.id,
    ),
  ];
  return [
    ...sourceIds,
    ...allContextRecords(value.context ?? {}).map((record) => record.id),
    ...subrecordIds,
  ];
}

function recursivelyFindForbiddenKeys(
  value: unknown,
  path = "$",
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      recursivelyFindForbiddenKeys(item, `${path}[${index}]`));
  }
  if (
    typeof value !== "object"
    || value === null
  ) {
    return [];
  }

  const forbidden = new Set([
    "truthScore",
    "truth_score",
    "reliabilityPercentage",
    "reliability_percentage",
    "combinedConfidence",
    "combined_confidence",
    "aiConclusion",
    "automaticConflictResolution",
  ]);
  return Object.entries(value).flatMap(([key, nested]) => [
    ...(forbidden.has(key) ? [`${path}.${key}`] : []),
    ...recursivelyFindForbiddenKeys(nested, `${path}.${key}`),
  ]);
}

before(async () => {
  [bundle, inventory, sourceRegister] = await Promise.all([
    loadFoundationalCorpusBundle(),
    loadFoundationalCorpusInventory(),
    loadFoundationalCorpusSourceRegister(),
  ]);
  if (!bundle.context) {
    throw new Error("Foundational corpus context is missing.");
  }
  context = bundle.context;
  await resetTestDatabase();
  await saveImportedBundle(bundle);
});

after(async () => {
  await closeTestDatabase();
});

test("1. every corpus bundle passes the accepted schema", async () => {
  const [validation, report] = await Promise.all([
    Promise.resolve(validateBundle(bundle)),
    validateFoundationalCorpus(),
  ]);
  assert.equal(validation.status, "ready");
  assert.equal(validation.canImport, true);
  assert.equal(validation.summary.errors, 0);
  assert.equal(validation.summary.warnings, 0);
  assert.equal(report.ready, true);
  assert.deepEqual(report.failures, []);
});

test("2. all stable IDs are non-empty and unique", () => {
  const stableIds = allStableIds(bundle);
  assert.ok(stableIds.every(Boolean));
  assert.equal(new Set(stableIds).size, stableIds.length);
});

test("3. required records preserve accepted canonical identities without duplication", async () => {
  const accepted = JSON.parse(
    await readFile(acceptedPlymouthBundleUrl, "utf8"),
  ) as SourceRootBundle;
  const acceptedIds = new Set(
    (accepted.context?.entities ?? []).map((entity) => entity.id),
  );
  const canonicalIds = inventory.requiredRecords.map(
    (record) => record.canonicalId,
  );

  assert.equal(new Set(canonicalIds).size, 8);
  assert.equal(
    inventory.requiredRecords.filter(
      (record) => acceptedIds.has(record.canonicalId),
    ).length,
    7,
  );
  assert.equal(
    inventory.requiredRecords.find(
      (record) =>
        record.requestedId === "ctx-place-plymouth-settlement",
    )?.canonicalId,
    "ctx-place-plymouth-settlement",
  );
});

test("4. every referenced source exists", () => {
  const sourceIds = new Set(
    sourceRegister.sources.map((source) => source.id),
  );
  for (const sourceId of inventory.sourceIds) {
    assert.ok(sourceIds.has(sourceId), sourceId);
  }
  for (const locator of context.sourceLocators ?? []) {
    assert.ok(sourceIds.has(locator.sourceId), locator.id);
  }
});

test("5. every referenced account exists", () => {
  const accountIds = new Set(
    (context.accounts ?? []).map((account) => account.id),
  );
  for (const claimId of inventory.claimIds) {
    const claim = (context.claims ?? []).find(
      (candidate) => candidate.id === claimId,
    );
    assert.ok(claim, claimId);
    assert.ok(accountIds.has(claim.accountId), claim.accountId);
  }
});

test("6. every referenced record exists", () => {
  const recordIds = new Set(
    allContextRecords(context).map((record) => record.id),
  );
  for (const relationshipId of inventory.relationshipIds) {
    const relationship = (context.relationships ?? []).find(
      (candidate) => candidate.id === relationshipId,
    );
    assert.ok(relationship, relationshipId);
    assert.ok(recordIds.has(relationship.fromId));
    assert.ok(recordIds.has(relationship.toId));
  }
});

test("7. every selected claim has a valid reporting or attribution path", () => {
  const accountIds = new Set(inventory.accountIds);
  const attributions = context.claimAttributions ?? [];
  for (const claimId of inventory.claimIds) {
    const claim = (context.claims ?? []).find(
      (candidate) => candidate.id === claimId,
    );
    const attribution = attributions.find(
      (candidate) => candidate.claimId === claimId,
    );
    assert.ok(claim, claimId);
    assert.ok(accountIds.has(claim.accountId), claim.accountId);
    assert.ok(attribution, claimId);
    assert.equal(attribution.accountId, claim.accountId);
  }
});

test("8. every exact locator belongs to the evidence source", () => {
  const evidenceById = new Map(
    (context.evidence ?? []).map((evidence) => [
      evidence.id,
      evidence,
    ]),
  );
  for (const locator of context.sourceLocators ?? []) {
    const evidence = evidenceById.get(locator.evidenceId);
    assert.ok(evidence, locator.evidenceId);
    assert.equal(locator.sourceId, evidence.sourceId);
    assert.ok(inventory.sourceIds.includes(locator.sourceId));
  }
});

test("9. no locator is empty, fabricated, or structurally invalid", () => {
  assert.equal(
    context.sourceLocators?.length,
    inventory.counts.locators,
  );
  for (const locator of context.sourceLocators ?? []) {
    assert.ok(locator.locatorLabel.trim().length > 0);
    assert.ok(Object.keys(locator.locator ?? {}).length > 0);
    assert.doesNotMatch(
      locator.locatorLabel,
      /\b(?:unknown|todo|tbd|search result)\b/i,
    );
    assert.ok(
      [
        "page",
        "section",
        "paragraph",
        "passage",
      ].includes(locator.locatorType),
    );
  }
});

test("10. historical names preserve source provenance", () => {
  const provenance = context.fieldProvenance ?? [];
  assert.equal(
    context.aliases?.length,
    inventory.counts.historicalNames,
  );
  for (const alias of context.aliases ?? []) {
    assert.ok((alias.sourceIds?.length ?? 0) > 0, alias.id);
    assert.ok(
      provenance.some(
        (item) =>
          item.subrecordType === "alias"
          && item.subrecordId === alias.id
          && item.fieldPath === "aliases.text"
          && alias.sourceIds?.includes(item.sourceId),
      ),
      alias.id,
    );
  }
});

test("11. date uncertainty and calendar conventions remain explicit", () => {
  const dates = new Map(
    (context.temporalAssertions ?? []).map((temporal) => [
      temporal.id,
      temporal,
    ]),
  );
  for (const temporalId of inventory.dateExpressionIds) {
    const temporal = dates.get(temporalId);
    assert.ok(temporal, temporalId);
    assert.ok(temporal.structuredDate, temporalId);
    assert.ok(
      temporal.structuredDate.uncertainty
      || temporal.startUncertainty
      || temporal.endUncertainty
      || temporal.dateNotes,
      temporalId,
    );
    if (
      temporal.structuredDate.calendarSystem
      === "English Old Style (Julian)"
    ) {
      assert.equal(
        temporal.structuredDate.conversionStatus,
        "unconverted",
      );
    }
  }
});

test("12. record kinds remain within the accepted contextual enum", () => {
  const accepted = new Set<string>(contextEntityTypes);
  for (const mapping of inventory.requiredRecords) {
    assert.ok(accepted.has(mapping.entityType));
    const entity = (context.entities ?? []).find(
      (candidate) => candidate.id === mapping.canonicalId,
    );
    assert.equal(entity?.entityType, mapping.entityType);
  }
});

test("13. evidence roles remain explicit and accepted", () => {
  const accepted = new Set<string>(evidenceSupportRoles);
  assert.equal(
    context.evidenceClaimLinks?.length,
    inventory.counts.evidenceLinks,
  );
  for (const link of context.evidenceClaimLinks ?? []) {
    assert.ok(accepted.has(link.supportRole), link.id);
  }
  assert.deepEqual(inventory.counts.evidenceLinksByRole, {
    neutral_or_background: 1,
    supports: 16,
    qualifies: 6,
    contextualizes: 2,
  });
});

test("14. provenance is not silently converted into supporting evidence", () => {
  const provenance = context.fieldProvenance ?? [];
  for (const claimId of inventory.claimIds) {
    const reportingPath = provenance.find(
      (item) =>
        item.targetId === claimId
        && item.fieldPath === "statement",
    );
    const evidenceLink = (context.evidenceClaimLinks ?? []).find(
      (item) => item.claimId === claimId,
    );
    assert.equal(
      reportingPath?.supportType,
      "reporting-provenance",
    );
    assert.ok(evidenceLink);
    assert.equal(
      Object.hasOwn(reportingPath ?? {}, "supportRole"),
      false,
    );
  }
  assert.ok(
    (context.evidenceClaimLinks ?? []).some(
      (link) => link.supportRole !== "supports",
    ),
  );
});

test("15. competing and qualifying claims remain separate", () => {
  const claimIds = new Set(
    (context.claims ?? []).map((claim) => claim.id),
  );
  assert.equal(
    context.claimRelations?.length,
    inventory.counts.claimRelations,
  );
  for (const relation of context.claimRelations ?? []) {
    assert.equal(relation.relationType, "qualifies");
    assert.notEqual(relation.fromClaimId, relation.toClaimId);
    assert.ok(claimIds.has(relation.fromClaimId));
    assert.ok(claimIds.has(relation.toClaimId));
  }
});

test("16. no truth-score or combined-confidence field is introduced", () => {
  assert.deepEqual(recursivelyFindForbiddenKeys(bundle), []);
});

test("17. no artificial version history is created", () => {
  assert.deepEqual(context.claimVersions, []);
  assert.deepEqual(context.evidenceVersions, []);
  assert.equal(inventory.counts.claimVersions, 0);
  assert.equal(inventory.counts.evidenceVersions, 0);
});

test("18. importing the corpus once succeeds", async () => {
  const result = await requireDatabase().query<{
    bundles: string;
    records: string;
  }>(
    `
      SELECT
        (
          SELECT COUNT(*) FROM imported_bundles
          WHERE bundle_id = $1
        ) AS bundles,
        (
          SELECT COUNT(*) FROM context_records
          WHERE bundle_id = $1
        ) AS records;
    `,
    [FOUNDATIONAL_CORPUS_BUNDLE_ID],
  );
  assert.equal(Number(result.rows[0]?.bundles), 1);
  assert.equal(Number(result.rows[0]?.records), 397);
});

test("19. importing the same corpus again is deterministic and duplicate-free", async () => {
  const database = requireDatabase();
  const beforeCounts = await database.query<{
    records: string;
    aliases: string;
    links: string;
  }>(
    `
      SELECT
        (SELECT COUNT(*) FROM context_records WHERE bundle_id = $1) AS records,
        (SELECT COUNT(*) FROM context_entity_aliases WHERE bundle_id = $1) AS aliases,
        (SELECT COUNT(*) FROM context_evidence_claim_links WHERE bundle_id = $1) AS links;
    `,
    [FOUNDATIONAL_CORPUS_BUNDLE_ID],
  );
  await saveImportedBundle(bundle);
  const afterCounts = await database.query<{
    records: string;
    aliases: string;
    links: string;
  }>(
    `
      SELECT
        (SELECT COUNT(*) FROM context_records WHERE bundle_id = $1) AS records,
        (SELECT COUNT(*) FROM context_entity_aliases WHERE bundle_id = $1) AS aliases,
        (SELECT COUNT(*) FROM context_evidence_claim_links WHERE bundle_id = $1) AS links;
    `,
    [FOUNDATIONAL_CORPUS_BUNDLE_ID],
  );
  assert.deepEqual(afterCounts.rows[0], beforeCounts.rows[0]);
});

test("20. replacement-safe reimport preserves accepted immutable history", async () => {
  const fixture = JSON.parse(
    await readFile(contextualFixtureUrl, "utf8"),
  ) as SourceRootBundle;
  fixture.bundleId =
    "sourceroot-integration-test-foundational-history";
  if (!fixture.context) {
    throw new Error("Contextual fixture has no context.");
  }
  fixture.context.claimVersions = [
    {
      id: "ctx-claim-high-water-foundational-control-v1",
      claimId: "ctx-claim-high-water",
      ordinal: 1,
      statement: "The water at Cedar Reach was unusually high.",
      claimType: "condition",
      subjectId: "ctx-event-morning-observation",
      confidence: "moderate",
      uncertainty: "The account supplies no measurement.",
      status: "accepted",
      changeType: "accepted-fixture-publication",
      changeReason:
        "Control history used to prove an unrelated bundle survives corpus replacement.",
      sourceIds: ["ctx-source-field-log"],
      origin: "import",
      createdAt: "2026-07-26T12:00:00.000Z",
      current: true,
    },
  ];
  assert.equal(validateBundle(fixture).canImport, true);
  await saveImportedBundle(fixture);

  const database = requireDatabase();
  const versionId =
    "ctx-claim-high-water-foundational-control-v1";
  const beforeVersion = await database.query<{
    content_hash: string;
    statement: string;
  }>(
    `
      SELECT content_hash, statement
      FROM context_claim_versions
      WHERE version_id = $1;
    `,
    [versionId],
  );
  assert.equal(beforeVersion.rowCount, 1);

  await saveImportedBundle(bundle);
  const afterVersion = await database.query<{
    content_hash: string;
    statement: string;
  }>(
    `
      SELECT content_hash, statement
      FROM context_claim_versions
      WHERE version_id = $1;
    `,
    [versionId],
  );
  assert.deepEqual(afterVersion.rows, beforeVersion.rows);
});

test("21. search returns the imported contextual records", async () => {
  const expected = new Map([
    ["Patuxet", "historyroot-plymouth-place-patuxet-plymouth"],
    ["Plymouth settlement", "ctx-place-plymouth-settlement"],
    ["Ousamequin", "historyroot-plymouth-person-ousamequin"],
    ["Tisquantum", "historyroot-plymouth-person-tisquantum"],
  ]);
  for (const [query, expectedId] of expected) {
    const response = await request(app)
      .get("/api/v1/search")
      .query({ q: query, domain: "HistoryRoot", limit: 100 })
      .expect(200);
    assert.ok(
      response.body.results.some(
        (result: { id: string }) => result.id === expectedId,
      ),
      `${query} did not return ${expectedId}`,
    );
  }
});

test("22. search returns imported claims with stable review identity", async () => {
  const claimId = "historyroot-plymouth-claim-agreement-terms";
  const response = await request(app)
    .get("/api/v1/search")
    .query({
      q: "recorded agreement addressed injury",
      type: "context-claim",
      limit: 100,
    })
    .expect(200);
  const result = response.body.results.find(
    (candidate: { id: string }) => candidate.id === claimId,
  );
  assert.ok(result);
  assert.equal(
    result.metadata.reviewUrl,
    `history-context-review-v1.html?record=historyroot-plymouth-event-peace-agreement&claim=${claimId}`,
  );
});

test("23. Context Review record projection returns imported claims", async () => {
  const response = await request(app)
    .get(
      "/api/v1/context/review/records/historyroot-plymouth-event-peace-agreement",
    )
    .expect(200);
  assert.ok(response.body.total >= 1);
  assert.ok(
    response.body.claims.some(
      (claim: { id: string }) =>
        claim.id === "historyroot-plymouth-claim-agreement-terms",
    ),
  );
});

test("24. Context Review claim projection preserves attribution, source, locator, evidence, relationships, and provenance", async () => {
  const claimId = "historyroot-plymouth-claim-harvest-three-days";
  const response = await request(app)
    .get(`/api/v1/context/review/claims/${claimId}`)
    .expect(200);

  assert.equal(response.body.claim.id, claimId);
  assert.ok(response.body.attributions.items.length >= 1);
  assert.ok(response.body.sources.items.length >= 1);
  assert.equal(
    response.body.evidence.items[0].sourceLocators[0].locatorLabel,
    "1621 harvest passage in the 1865 edition",
  );
  assert.equal(
    response.body.evidence.items[0].supportRole,
    "supports",
  );
  assert.ok(response.body.relatedClaims.groups.qualifies.length >= 2);
  assert.ok(
    response.body.provenance.items.some(
      (item: { fieldPath: string }) =>
        item.fieldPath === "statement",
    ),
  );
});

test("25. public reads do not expose hidden or draft-only governance data", async () => {
  const response = await request(app)
    .get(
      "/api/v1/context/review/claims/historyroot-plymouth-claim-agreement-terms",
    )
    .expect(200);
  const serialized = JSON.stringify(response.body);
  assert.doesNotMatch(serialized, /IMPORT_SERVICE_TOKEN/);
  assert.doesNotMatch(serialized, /governanceProposalId/);
  assert.doesNotMatch(serialized, /"status":"draft"/);
  assert.doesNotMatch(serialized, /password|secret/i);
});

test("26. existing Plymouth records remain compatible", async () => {
  const [ousamequin, patuxet, plymouth, claims] = await Promise.all([
    request(app)
      .get(
        "/api/v1/context/entities/historyroot-plymouth-person-ousamequin",
      )
      .expect(200),
    request(app)
      .get(
        "/api/v1/context/entities/historyroot-plymouth-place-patuxet-plymouth",
      )
      .expect(200),
    request(app)
      .get("/api/v1/context/entities/ctx-place-plymouth-settlement")
      .expect(200),
    request(app)
      .get(
        `/api/v1/context/claims?bundleId=${FOUNDATIONAL_CORPUS_BUNDLE_ID}&limit=100`,
      )
      .expect(200),
  ]);
  assert.equal(ousamequin.body.name, "Ousamequin");
  assert.ok(ousamequin.body.alternateNames.includes("Massasoit"));
  assert.equal(patuxet.body.name, "Patuxet");
  assert.equal(plymouth.body.name, "Plymouth settlement");
  assert.equal(claims.body.total, 49);
});

test("27. DictionaryRoot remains unaffected by corpus replacement", async () => {
  const database = requireDatabase();
  const beforeCount = await database.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM dictionaryroot_lexicon_datasets;",
  );
  await saveImportedBundle(bundle);
  const afterCount = await database.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM dictionaryroot_lexicon_datasets;",
  );
  assert.deepEqual(afterCount.rows, beforeCount.rows);
});

test("28. no customer-side fallback corpus data exists", async () => {
  const scripts = await Promise.all([
    readFile(
      new URL("../../assets/js/historyroot-api.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../assets/js/historyroot-record.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../assets/js/historyroot-context-review.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const combined = scripts.join("\n");
  assert.doesNotMatch(
    combined,
    /historyroot-plymouth-claim-agreement-terms/,
  );
  assert.doesNotMatch(combined, /ctx-place-plymouth-settlement/);
  assert.doesNotMatch(combined, /fallbackCorpus|fallbackHistory/i);
});

test("29. corpus counts and source-rights policy match the inventory", () => {
  assert.equal(inventory.corpusId, FOUNDATIONAL_CORPUS_ID);
  assert.equal(inventory.bundleId, FOUNDATIONAL_CORPUS_BUNDLE_ID);
  assert.equal(inventory.counts.requiredRecords, 8);
  assert.equal(inventory.counts.claims, 25);
  assert.equal(inventory.counts.sources, 10);
  assert.equal(inventory.counts.accounts, 8);
  assert.equal(inventory.counts.relationships, 25);
  assert.equal(inventory.counts.historicalNames, 15);
  assert.equal(inventory.counts.dateExpressions, 12);
  assert.equal(inventory.counts.locators, 25);
  assert.equal(inventory.counts.evidenceLinks, 25);
  assert.match(sourceRegister.rightsRule, /not treated as public domain/i);
  assert.ok(
    sourceRegister.sources.every(
      (source) => source.copiedModernProse === false,
    ),
  );
});

test("30. Patuxet, Plymouth settlement, and their communities remain semantically distinct", () => {
  const entityById = new Map(
    (context.entities ?? []).map((entity) => [entity.id, entity]),
  );
  const patuxetPlace = entityById.get(
    "historyroot-plymouth-place-patuxet-plymouth",
  );
  const plymouthPlace = entityById.get(
    "ctx-place-plymouth-settlement",
  );
  const patuxetCommunity = entityById.get(
    "historyroot-plymouth-group-patuxet",
  );
  const colonists = entityById.get(
    "historyroot-plymouth-group-plymouth-colonists",
  );

  assert.equal(patuxetPlace?.entityType, "place");
  assert.equal(patuxetPlace?.name, "Patuxet");
  assert.equal(plymouthPlace?.entityType, "place");
  assert.equal(plymouthPlace?.name, "Plymouth settlement");
  assert.equal(patuxetCommunity?.entityType, "group");
  assert.equal(colonists?.entityType, "group");
  assert.equal(
    new Set([
      patuxetPlace?.id,
      plymouthPlace?.id,
      patuxetCommunity?.id,
      colonists?.id,
    ]).size,
    4,
  );
});
