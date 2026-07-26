import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { getPool } from "../src/lib/database.js";
import {
  observeDataQualityAndProvenance,
  serializeDataQualityProvenanceReport,
} from "../src/observers/data-quality-provenance-observer.js";
import {
  observePlatformOperations,
} from "../src/observers/platform-operations-observer.js";
import {
  loadGovernedTarget,
  materializeGovernedSnapshot,
  validateGovernedChange,
} from "../src/services/contextual-governance.js";
import { validateBundle } from "../src/services/validator.js";
import type { SourceRootBundle } from "../src/types.js";
import {
  closeTestDatabase,
  resetTestDatabase,
} from "./helpers/database.js";

const app = createApp();
const fixtureUrl = new URL(
  "./fixtures/contextual-historyroot-valid.json",
  import.meta.url,
);

function requireImportServiceToken(): string {
  const token = process.env.IMPORT_SERVICE_TOKEN;
  if (!token) {
    throw new Error(
      "Context refinement tests require IMPORT_SERVICE_TOKEN in .env.test.",
    );
  }
  return token;
}

function authorizedImport(bundle: Record<string, unknown>) {
  return request(app)
    .post("/api/v1/import")
    .set("x-sourceroot-import-token", requireImportServiceToken())
    .send(bundle);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object.");
  }
  return value as Record<string, unknown>;
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array.");
  }
  return value as Array<Record<string, unknown>>;
}

async function baseFixture(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  ) as Record<string, unknown>;
}

async function refinedFixture(): Promise<Record<string, unknown>> {
  const bundle = await baseFixture();
  const context = asRecord(bundle.context);
  const fieldLogSource = asRecords(bundle.sources).find(
    (record) => record.id === "ctx-source-field-log",
  );
  if (!fieldLogSource) {
    throw new Error("Expected field-log source was not found.");
  }
  fieldLogSource.accessStatus = "accessed-and-inspected";
  fieldLogSource.locatorsInspected = ["technical fixture record"];
  const entities = asRecords(context.entities);
  const temporalAssertions = asRecords(
    context.temporalAssertions,
  );
  const relationships = asRecords(context.relationships);
  const disputed = temporalAssertions.find(
    (record) => record.id === "ctx-time-survey-disputed",
  );
  const groupRange = temporalAssertions.find(
    (record) => record.id === "ctx-time-group-range",
  );
  const exact = temporalAssertions.find(
    (record) => record.id === "ctx-time-field-log-exact",
  );
  if (!disputed || !groupRange || !exact) {
    throw new Error("Expected temporal fixture records were not found.");
  }
  const mara = entities.find(
    (record) => record.id === "ctx-person-mara-quill",
  );
  if (!mara) {
    throw new Error("Expected Mara Quill entity was not found.");
  }
  mara.sourceIds = ["ctx-source-field-log"];

  exact.timeRole = "source_creation_time";
  exact.structuredDate = {
    originalLabel: "11 May 1894",
    precision: "day",
    era: "CE",
    year: 1894,
    month: 5,
    day: 11,
    calendarSystem: "gregorian",
    conversionStatus: "not_required",
  };
  groupRange.timeRole = "identity_name_validity";
  disputed.timeRole = "event_time";
  disputed.proposedDates = [
    {
      id: "ctx-date-proposal-field-log",
      date: "1894-05-10",
      label: "Date proposed by the field log",
      precision: "day",
      sourceIds: ["ctx-source-field-log"],
      note: "Supported only by the field log.",
    },
    {
      id: "ctx-date-proposal-summary",
      date: "1894-05-17",
      label: "Date proposed by the later summary",
      precision: "day",
      sourceIds: ["ctx-source-later-summary"],
      note: "Supported only by the later summary.",
    },
  ];

  entities.push({
    id: "ctx-person-mara-quill-candidate",
    label: "Mara Quill candidate identity",
    entityType: "person",
    name: "Mara Q. (candidate record)",
    alternateNames: ["Mara Q."],
    description:
      "A deliberately separate record retained for identity review.",
    sourceIds: ["ctx-source-later-summary"],
    status: "needs-review",
  });

  temporalAssertions.push(
    {
      id: "ctx-time-year-only-ce",
      label: "Year-only observation",
      subjectId: "ctx-person-mara-quill",
      temporalKind: "approximate",
      timeRole: "observation_time",
      dateLabel: "1894 CE",
      structuredDate: {
        originalLabel: "1894",
        precision: "year",
        era: "CE",
        year: 1894,
        calendarSystem: "gregorian",
        conversionStatus: "not_required",
      },
      sourceIds: ["ctx-source-field-log"],
    },
    {
      id: "ctx-time-bce-event",
      label: "BCE chronology example",
      subjectId: "ctx-event-annual-field-survey",
      temporalKind: "approximate",
      timeRole: "event_time",
      dateLabel: "44 BCE",
      structuredDate: {
        originalLabel: "44 BCE",
        precision: "year",
        era: "BCE",
        year: 44,
        approximate: true,
        uncertainty: "The example preserves stated-era chronology.",
      },
      sourceIds: ["ctx-source-later-summary"],
    },
    {
      id: "ctx-time-named-period",
      label: "Named period example",
      subjectId: "ctx-event-regional-rainfall",
      temporalKind: "unknown",
      timeRole: "event_time",
      dateLabel: "The Cedar Reach settlement period",
      structuredDate: {
        originalLabel: "The Cedar Reach settlement period",
        precision: "named_period",
        namedPeriod: "Cedar Reach settlement period",
        conversionStatus: "unconverted",
      },
      sourceIds: ["ctx-source-later-summary"],
    },
    {
      id: "ctx-time-calendar-unconverted",
      label: "Unconverted calendar example",
      subjectId: "ctx-document-later-summary",
      temporalKind: "approximate",
      timeRole: "recording_time",
      dateLabel: "1250 in the stated Julian calendar",
      structuredDate: {
        originalLabel: "1250 (Julian)",
        precision: "year",
        era: "CE",
        year: 1250,
        calendarSystem: "julian",
        conversionStatus: "unconverted",
      },
      sourceIds: ["ctx-source-later-summary"],
    },
    {
      id: "ctx-time-employment-validity",
      label: "Mara Quill survey employment validity",
      subjectId: "ctx-relationship-employment",
      temporalKind: "range",
      timeRole: "relationship_validity",
      startDate: "1890-01-01",
      endDate: "1895-12-31",
      dateLabel: "From 1890 through 1895",
      calendarSystem: "gregorian",
      datePrecision: "year-range",
      startUncertainty: "Approximate year boundary",
      endUncertainty: "Approximate year boundary",
      sourceIds: ["ctx-source-field-log"],
    },
  );

  relationships.push(
    {
      id: "ctx-relationship-employment",
      label: "Mara Quill employed by River Survey Circle",
      fromId: "ctx-person-mara-quill",
      toId: "ctx-group-river-survey-circle",
      relationshipType: "employed_by",
      explanation: "Employment is bounded by a sourced approximate range.",
      uncertainty: "The exact start and end days are unknown.",
      sourceIds: ["ctx-source-field-log"],
      validity: {
        status: "approximate",
        temporalLinks: [{
          temporalAssertionId: "ctx-time-employment-validity",
          linkType: "valid_during",
          sourceIds: ["ctx-source-field-log"],
          note: "The field log supports this period.",
        }],
        sourceIds: ["ctx-source-field-log"],
        note: "Only modern sortable bounds support active-at filtering.",
      },
    },
    {
      id: "ctx-identity-possible-mara",
      label: "Possible Mara Quill identity equivalence",
      fromId: "ctx-person-mara-quill",
      toId: "ctx-person-mara-quill-candidate",
      relationshipType: "possible_same_as",
      explanation: "A reviewable possibility, not a merge.",
      confidence: "low",
      uncertainty: "The records may describe different people.",
      reviewStatus: "needs-review",
      sourceIds: ["ctx-source-field-log"],
    },
    {
      id: "ctx-identity-distinct-mara",
      label: "Mara Quill records asserted distinct",
      fromId: "ctx-person-mara-quill",
      toId: "ctx-person-mara-quill-candidate",
      relationshipType: "distinct_from",
      explanation: "Conflicting evidence is preserved.",
      uncertainty: "The identity conflict is unresolved.",
      reviewStatus: "needs-review",
      sourceIds: ["ctx-source-later-summary"],
    },
    {
      id: "ctx-identity-successor-group",
      label: "Survey Circle successor relationship",
      fromId: "ctx-group-river-survey-circle",
      toId: "ctx-person-mara-quill-candidate",
      relationshipType: "successor_of",
      explanation: "Direction is intentionally preserved.",
      sourceIds: ["ctx-source-later-summary"],
    },
  );

  context.aliases = [
    {
      id: "ctx-alias-mara-abbreviation",
      entityId: "ctx-person-mara-quill",
      text: "M. Quill",
      aliasType: "abbreviation",
      languageTag: "en",
      sourceIds: ["ctx-source-field-log"],
      status: "active",
    },
    {
      id: "ctx-alias-survey-circle-historical",
      entityId: "ctx-group-river-survey-circle",
      text: "Cedar Reach Survey Circle",
      aliasType: "historical",
      languageTag: "en",
      notes: "Spelling and case are preserved exactly.",
      uncertainty: "The exact first-use day is unknown.",
      status: "active",
      temporalAssertionId: "ctx-time-group-range",
      sourceIds: ["ctx-source-field-log"],
    },
  ];
  context.externalIdentifiers = [
    {
      id: "ctx-identifier-mara-local",
      entityId: "ctx-person-mara-quill",
      scheme: "customer-authority",
      value: "Authority-0001",
      normalizedValue: "authority-0001",
      uri: "https://example.invalid/authority/Authority-0001",
      label: "Customer authority record",
      status: "active",
      sourceIds: ["ctx-source-field-log"],
    },
    {
      id: "ctx-identifier-mara-candidate-local",
      entityId: "ctx-person-mara-quill-candidate",
      scheme: "customer-authority",
      value: "Authority-0001",
      normalizedValue: "authority-0001",
      status: "disputed",
      uncertainty: "Reuse is retained for review.",
      sourceIds: ["ctx-source-later-summary"],
    },
  ];
  context.fieldProvenance = [
    {
      id: "ctx-provenance-mara-name",
      targetId: "ctx-person-mara-quill",
      fieldPath: "name",
      sourceId: "ctx-source-field-log",
      supportType: "supports",
      note: "Supports the canonical-name assertion.",
    },
    {
      id: "ctx-provenance-mara-alias",
      targetId: "ctx-person-mara-quill",
      fieldPath: "aliases.ctx-alias-mara-abbreviation.text",
      subrecordType: "alias",
      subrecordId: "ctx-alias-mara-abbreviation",
      sourceId: "ctx-source-field-log",
      supportType: "supports",
    },
    {
      id: "ctx-provenance-mara-identifier",
      targetId: "ctx-person-mara-quill",
      fieldPath:
        "externalIdentifiers.ctx-identifier-mara-local.value",
      subrecordType: "external_identifier",
      subrecordId: "ctx-identifier-mara-local",
      sourceId: "ctx-source-field-log",
      supportType: "reports",
    },
    {
      id: "ctx-provenance-disputed-date",
      targetId: "ctx-time-survey-disputed",
      fieldPath: "proposedDates.ctx-date-proposal-summary.date",
      subrecordType: "proposed_date",
      subrecordId: "ctx-date-proposal-summary",
      sourceId: "ctx-source-later-summary",
      supportType: "supports",
    },
    {
      id: "ctx-provenance-employment-validity",
      targetId: "ctx-relationship-employment",
      fieldPath: "validity.temporalLinks",
      subrecordType: "relationship_validity",
      subrecordId: "ctx-relationship-employment",
      sourceId: "ctx-source-field-log",
      supportType: "supports",
    },
  ];

  return bundle;
}

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("migration 011 records the additive schema, constraints, and indexes", async () => {
  const pool = getPool();
  assert.ok(pool);
  const migration = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM schema_migrations
     WHERE migration_name = '011_refine_contextual_identity_time.sql'`,
  );
  assert.equal(Number(migration.rows[0]?.count), 1);

  const tables = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::TEXT[])
     ORDER BY table_name`,
    [[
      "context_entity_aliases",
      "context_entity_identifiers",
      "context_field_provenance",
      "context_relationship_temporal_links",
      "context_temporal_proposals",
    ]],
  );
  assert.equal(tables.rows.length, 5);

  const columns = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'context_temporal_assertions'
       AND column_name = ANY($1::TEXT[])
     ORDER BY column_name`,
    [[
      "chronology_end_year",
      "chronology_start_year",
      "structured_date",
      "time_role",
    ]],
  );
  assert.equal(columns.rows.length, 4);

  const indexes = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname IN (
         'idx_context_entity_aliases_search',
         'idx_context_entity_identifiers_lookup',
         'idx_context_temporal_chronology'
       )`,
  );
  assert.equal(Number(indexes.rows[0]?.count), 3);
});

test("legacy contextual bundles and alternateNames remain unchanged", async () => {
  const bundle = await baseFixture();
  const validation = validateBundle(bundle);
  assert.equal(validation.canImport, true);
  await authorizedImport(bundle).expect(201);

  const entity = await request(app)
    .get("/api/v1/context/entities/ctx-place-cedar-reach")
    .expect(200);
  assert.deepEqual(entity.body.alternateNames, ["North Bend Reach"]);
  assert.deepEqual(entity.body.aliases, []);
  assert.deepEqual(entity.body.externalIdentifiers, []);
});

test("refined import persists aliases, identifiers, time links, and field provenance atomically", async () => {
  const bundle = await refinedFixture();
  const validation = validateBundle(bundle);
  assert.equal(validation.canImport, true);
  assert.equal(validation.errors.length, 0);
  await authorizedImport(bundle).expect(201);

  const pool = getPool();
  assert.ok(pool);
  const counts = await pool.query<Record<string, string>>(
    `SELECT
       (SELECT COUNT(*) FROM context_entity_aliases) AS aliases,
       (SELECT COUNT(*) FROM context_entity_alias_sources) AS alias_sources,
       (SELECT COUNT(*) FROM context_entity_identifiers) AS identifiers,
       (SELECT COUNT(*) FROM context_entity_identifier_sources) AS identifier_sources,
       (SELECT COUNT(*) FROM context_temporal_proposals) AS proposals,
       (SELECT COUNT(*) FROM context_temporal_proposal_sources) AS proposal_sources,
       (SELECT COUNT(*) FROM context_relationship_temporal_links) AS validity_links,
       (SELECT COUNT(*) FROM context_relationship_temporal_sources) AS validity_link_sources,
       (SELECT COUNT(*) FROM context_field_provenance) AS field_provenance`,
  );
  const row = counts.rows[0];
  assert.ok(row);
  assert.equal(Number(row.aliases), 2);
  assert.equal(Number(row.alias_sources), 2);
  assert.equal(Number(row.identifiers), 2);
  assert.equal(Number(row.identifier_sources), 2);
  assert.equal(Number(row.proposals), 2);
  assert.equal(Number(row.proposal_sources), 2);
  assert.equal(Number(row.validity_links), 1);
  assert.equal(Number(row.validity_link_sources), 1);
  assert.equal(Number(row.field_provenance), 5);
});

test("entity detail and child collections preserve exact values and Registry API Contract 1.0", async () => {
  await authorizedImport(await refinedFixture()).expect(201);

  const detail = await request(app)
    .get("/api/v1/context/entities/ctx-person-mara-quill")
    .expect(200);
  assert.deepEqual(detail.body.alternateNames ?? [], []);
  assert.equal(detail.body.aliases[0].text, "M. Quill");
  assert.equal(
    detail.body.externalIdentifiers[0].value,
    "Authority-0001",
  );
  assert.equal(detail.body.fieldProvenance.length, 3);
  assert.equal(detail.body.identityLinks.length, 2);

  const aliases = await request(app)
    .get(
      "/api/v1/context/entities/ctx-person-mara-quill/aliases?limit=1&sort=text&direction=asc",
    )
    .set("X-Request-ID", "chunk3-alias-request")
    .expect(200);
  assert.equal(aliases.headers["x-request-id"], "chunk3-alias-request");
  assert.equal(aliases.body.contractVersion, "1.0");
  assert.equal(aliases.body.total, 1);
  assert.equal(aliases.body.returned, 1);
  assert.equal(aliases.body.hasMore, false);
  assert.deepEqual(aliases.body.items, aliases.body.aliases);
  assert.equal(aliases.body.appliedSort.tieBreaker, "aliasId:asc");

  const identifiers = await request(app)
    .get(
      "/api/v1/context/entities/ctx-person-mara-quill/identifiers?scheme=customer-authority",
    )
    .expect(200);
  assert.equal(identifiers.body.total, 1);
  assert.deepEqual(
    identifiers.body.items,
    identifiers.body.externalIdentifiers,
  );

  const invalid = await request(app)
    .get(
      "/api/v1/context/entities/ctx-person-mara-quill/aliases?aliasType=not-valid",
    )
    .set("X-Request-ID", "chunk3-invalid-filter")
    .expect(400);
  assert.equal(invalid.body.error, "INVALID_CONTEXT_FILTER");
  assert.equal(invalid.body.requestId, "chunk3-invalid-filter");
});

test("temporal responses preserve modern, CE, BCE, named-period, calendar, and proposal semantics", async () => {
  await authorizedImport(await refinedFixture()).expect(201);

  const modern = await request(app)
    .get(
      "/api/v1/context/temporal-assertions/ctx-time-field-log-exact",
    )
    .expect(200);
  assert.equal(modern.body.exactDate, "1894-05-11");
  assert.equal(modern.body.timeRole, "source_creation_time");
  assert.equal(modern.body.chronology.sortable, true);

  const ce = await request(app)
    .get(
      "/api/v1/context/temporal-assertions/ctx-time-year-only-ce",
    )
    .expect(200);
  assert.equal(ce.body.structuredDate.precision, "year");
  assert.equal(ce.body.chronology.startYear, 1894);

  const bce = await request(app)
    .get(
      "/api/v1/context/temporal-assertions/ctx-time-bce-event",
    )
    .expect(200);
  assert.equal(bce.body.structuredDate.era, "BCE");
  assert.equal(bce.body.chronology.startYear, -43);
  assert.equal(bce.body.structuredDate.originalLabel, "44 BCE");

  const named = await request(app)
    .get(
      "/api/v1/context/temporal-assertions/ctx-time-named-period",
    )
    .expect(200);
  assert.equal(named.body.chronology.sortable, false);
  assert.equal(
    named.body.structuredDate.namedPeriod,
    "Cedar Reach settlement period",
  );

  const calendar = await request(app)
    .get(
      "/api/v1/context/temporal-assertions/ctx-time-calendar-unconverted",
    )
    .expect(200);
  assert.equal(calendar.body.structuredDate.calendarSystem, "julian");
  assert.equal(calendar.body.chronology.sortable, false);

  const disputed = await request(app)
    .get(
      "/api/v1/context/temporal-assertions/ctx-time-survey-disputed",
    )
    .expect(200);
  assert.equal(disputed.body.proposedDateDetails.length, 2);
  assert.deepEqual(
    disputed.body.proposedDateDetails.map(
      (proposal: Record<string, unknown>) => proposal.sourceIds,
    ),
    [
      ["ctx-source-field-log"],
      ["ctx-source-later-summary"],
    ],
  );
});

test("relationship validity supports deterministic modern-date filters and documents label-only exclusion in behavior", async () => {
  await authorizedImport(await refinedFixture()).expect(201);

  const detail = await request(app)
    .get(
      "/api/v1/context/relationships/ctx-relationship-employment",
    )
    .expect(200);
  assert.equal(detail.body.temporalLinks.length, 1);
  assert.equal(
    detail.body.temporalLinks[0].temporalAssertionId,
    "ctx-time-employment-validity",
  );
  assert.deepEqual(detail.body.validitySources, [
    "ctx-source-field-log",
  ]);

  const active = await request(app)
    .get("/api/v1/context/relationships?validAt=1892-06-01")
    .expect(200);
  assert.deepEqual(
    active.body.items.map((item: Record<string, unknown>) => item.id),
    ["ctx-relationship-employment"],
  );

  const inactive = await request(app)
    .get("/api/v1/context/relationships?validAt=1900-01-01")
    .expect(200);
  assert.equal(inactive.body.total, 0);

  const overlap = await request(app)
    .get(
      "/api/v1/context/relationships?validFrom=1893-01-01&validTo=1894-12-31",
    )
    .expect(200);
  assert.equal(overlap.body.total, 1);
});

test("field provenance complements record-level sources and rejects unsafe or broken targets", async () => {
  const bundle = await refinedFixture();
  await authorizedImport(bundle).expect(201);
  const entity = await request(app)
    .get("/api/v1/context/entities/ctx-person-mara-quill")
    .expect(200);
  assert.ok(entity.body.sourceIds.includes("ctx-source-field-log"));
  assert.equal(entity.body.fieldProvenance.length, 3);

  const unsafe = structuredClone(bundle);
  asRecords(asRecord(unsafe.context).fieldProvenance)[0]!.fieldPath =
    "name.constructor()";
  const unsafeResult = validateBundle(unsafe);
  assert.equal(unsafeResult.canImport, false);
  assert.ok(
    unsafeResult.errors.some(
      (issue) => issue.code === "INVALID_CONTEXTUAL_STRUCTURE",
    ),
  );

  const broken = structuredClone(bundle);
  asRecords(asRecord(broken.context).fieldProvenance)[0]!.targetId =
    "ctx-missing-target";
  const brokenResult = validateBundle(broken);
  assert.ok(
    brokenResult.errors.some(
      (issue) => issue.code === "CONTEXT_PROVENANCE_TARGET_NOT_FOUND",
    ),
  );
});

test("validation blocks broken children, exact duplicates, and reverse symmetric identity duplicates", async () => {
  const bundle = await refinedFixture();
  const context = asRecord(bundle.context);
  const aliases = asRecords(context.aliases);
  const identifiers = asRecords(context.externalIdentifiers);
  const relationships = asRecords(context.relationships);

  aliases.push({
    ...aliases[0],
    id: "ctx-alias-duplicate",
  });
  identifiers.push({
    ...identifiers[0],
    id: "ctx-identifier-duplicate",
  });
  relationships.push({
    id: "ctx-identity-possible-mara-reverse",
    label: "Reverse duplicate identity possibility",
    fromId: "ctx-person-mara-quill-candidate",
    toId: "ctx-person-mara-quill",
    relationshipType: "possible_same_as",
    sourceIds: ["ctx-source-field-log"],
  });
  const result = validateBundle(bundle);
  assert.equal(result.canImport, false);
  assert.ok(result.errors.some(
    (issue) => issue.code === "DUPLICATE_CONTEXT_ALIAS",
  ));
  assert.ok(result.errors.some(
    (issue) => issue.code === "DUPLICATE_CONTEXT_IDENTIFIER",
  ));
  assert.ok(result.errors.some(
    (issue) => issue.code === "DUPLICATE_SYMMETRIC_IDENTITY_LINK",
  ));

  const broken = await refinedFixture();
  asRecords(asRecord(broken.context).aliases)[0]!.entityId =
    "ctx-missing-entity";
  asRecords(asRecord(broken.context).externalIdentifiers)[0]!.sourceIds =
    ["ctx-missing-source"];
  const brokenResult = validateBundle(broken);
  assert.ok(brokenResult.errors.some(
    (issue) => issue.code === "CONTEXT_ALIAS_ENTITY_NOT_FOUND",
  ));
  assert.ok(brokenResult.errors.some(
    (issue) => issue.code === "CONTEXT_SOURCE_NOT_FOUND",
  ));
});

test("identifier search keeps candidate entities distinct and performs no merge", async () => {
  await authorizedImport(await refinedFixture()).expect(201);
  const result = await request(app)
    .get("/api/v1/search?q=Authority-0001&type=context-entity")
    .expect(200);
  const ids = result.body.results
    .map((item: Record<string, unknown>) => item.id)
    .sort();
  assert.deepEqual(ids, [
    "ctx-person-mara-quill",
    "ctx-person-mara-quill-candidate",
  ]);
  assert.equal(new Set(ids).size, 2);

  const pool = getPool();
  assert.ok(pool);
  const endpoints = await pool.query<{
    from_context_id: string;
    to_context_id: string;
  }>(
    `SELECT from_context_id, to_context_id
     FROM context_relationships
     WHERE context_id = 'ctx-identity-possible-mara'`,
  );
  assert.deepEqual(endpoints.rows[0], {
    from_context_id: "ctx-person-mara-quill",
    to_context_id: "ctx-person-mara-quill-candidate",
  });
});

test("a refined child persistence conflict rolls back the entire new bundle", async () => {
  const original = await refinedFixture();
  await authorizedImport(original).expect(201);

  const replacement = JSON.parse(
    JSON.stringify(original).replaceAll("ctx-", "ctx-rollback-"),
  ) as Record<string, unknown>;
  replacement.bundleId =
    "sourceroot-integration-test-contextual-refinement-rollback";
  const replacementContext = asRecord(replacement.context);
  asRecords(replacementContext.aliases)[0]!.id =
    "ctx-alias-mara-abbreviation";
  const aliasProvenance = asRecords(
    replacementContext.fieldProvenance,
  ).find(
    (record) => record.subrecordType === "alias",
  );
  assert.ok(aliasProvenance);
  aliasProvenance.subrecordId = "ctx-alias-mara-abbreviation";
  aliasProvenance.fieldPath =
    "aliases.ctx-alias-mara-abbreviation.text";
  assert.equal(validateBundle(replacement).canImport, true);
  await authorizedImport(replacement).expect(500);

  const pool = getPool();
  assert.ok(pool);
  const result = await pool.query<{
    bundles: string;
    rollback_records: string;
    aliases: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM imported_bundles) AS bundles,
       (SELECT COUNT(*) FROM context_records
        WHERE bundle_id = 'sourceroot-integration-test-contextual-refinement-rollback')
         AS rollback_records,
       (SELECT COUNT(*) FROM context_entity_aliases) AS aliases`,
  );
  assert.equal(Number(result.rows[0]?.bundles), 1);
  assert.equal(Number(result.rows[0]?.rollback_records), 0);
  assert.equal(Number(result.rows[0]?.aliases), 2);
});

test("governance snapshots validate, publish, and restore refined entity children", async () => {
  await authorizedImport(await refinedFixture()).expect(201);
  const pool = getPool();
  assert.ok(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await loadGovernedTarget(
      client,
      "entity",
      "ctx-person-mara-quill",
    );
    assert.equal(asRecords(current.snapshot.aliases).length, 1);
    assert.equal(
      asRecords(current.snapshot.externalIdentifiers).length,
      1,
    );
    assert.equal(
      asRecords(current.snapshot.fieldProvenance).length,
      3,
    );

    const changedAliases = [
      ...asRecords(current.snapshot.aliases),
      {
        id: "ctx-alias-mara-governed",
        entityId: "ctx-person-mara-quill",
        text: "Mara Quill (reviewed alias)",
        aliasType: "alternate",
        sourceIds: ["ctx-source-field-log"],
      },
    ];
    const validation = await validateGovernedChange(client, {
      targetType: "entity",
      targetId: "ctx-person-mara-quill",
      bundleId: current.bundleId!,
      baseSnapshot: current.snapshot,
      proposedPatch: { aliases: changedAliases },
      editorialRationale:
        "Preserve a sourced alias through the existing review workflow.",
      evidenceSourceIds: ["ctx-source-field-log"],
      changeType: "structured_update",
    });
    assert.equal(
      validation.valid,
      true,
      JSON.stringify(validation.errors),
    );

    const changed = {
      ...current.snapshot,
      aliases: changedAliases,
    };
    await materializeGovernedSnapshot(
      client,
      "entity",
      "ctx-person-mara-quill",
      current.bundleId!,
      changed,
    );
    const published = await loadGovernedTarget(
      client,
      "entity",
      "ctx-person-mara-quill",
    );
    assert.equal(asRecords(published.snapshot.aliases).length, 2);

    await materializeGovernedSnapshot(
      client,
      "entity",
      "ctx-person-mara-quill",
      current.bundleId!,
      current.snapshot,
    );
    const restored = await loadGovernedTarget(
      client,
      "entity",
      "ctx-person-mara-quill",
    );
    assert.equal(asRecords(restored.snapshot.aliases).length, 1);
    assert.equal(
      asRecords(restored.snapshot.externalIdentifiers).length,
      1,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

test("the contextual observer reports deterministic identity/time findings without mutation", async () => {
  const bundle = await refinedFixture() as SourceRootBundle;
  const context = asRecord(bundle.context);
  asRecords(context.aliases)[0]!.sourceIds = [];
  asRecords(context.relationships)
    .find((record) => record.id === "ctx-identity-possible-mara")!
    .sourceIds = [];
  const before = JSON.stringify(bundle);
  const first = observeDataQualityAndProvenance(bundle);
  const second = observeDataQualityAndProvenance(bundle);
  const categories = new Set(
    first.findings.map((finding) => finding.category),
  );

  assert.ok(categories.has("alias_without_source"));
  assert.ok(categories.has("identifier_reuse_across_entities"));
  assert.ok(categories.has("identity_evidence_missing"));
  assert.ok(categories.has("contradictory_identity_relationship"));
  assert.equal(first.authorityLevel, 1);
  assert.equal(first.readOnly, true);
  assert.equal(JSON.stringify(bundle), before);
  assert.equal(
    serializeDataQualityProvenanceReport(first),
    serializeDataQualityProvenanceReport(second),
  );
  assert.match(first.humanSummary, /No records were modified/);
});

test("the platform observer classifies contextual persistence failures without gaining authority", () => {
  const report = observePlatformOperations([{
    eventType: "import_failed",
    correlationId: "chunk3-observer-correlation",
    statusCode: 500,
    failureCategory: "context-alias-persistence",
    errorCode: "23505",
  }]);
  assert.equal(report.authorityLevel, 1);
  assert.equal(report.readOnly, true);
  assert.equal(report.failureCount, 1);
  assert.match(
    report.groups[0]!.suggestedInvestigationArea,
    /contextual identity, time, provenance/,
  );
});
