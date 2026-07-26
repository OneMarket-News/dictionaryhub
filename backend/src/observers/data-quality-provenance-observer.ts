import type { SourceRootBundle } from "../types.js";
import type {
  ContextClaimVersion,
  ContextEvidenceVersion,
} from "../contextual-types.js";
import {
  claimVersionContentHash,
  evidenceVersionContentHash,
} from "../services/context-version-store.js";

type RegistryRecord = Record<string, unknown>;

export type DataQualityFindingCategory =
  | "missing_attribution"
  | "missing_publisher"
  | "missing_external_identifier"
  | "malformed_external_identifier"
  | "missing_timestamp"
  | "broken_source_relationship"
  | "missing_source_url"
  | "duplicate_external_identifier"
  | "incomplete_bundle_metadata"
  | "invalid_status"
  | "malformed_source_reference"
  | "alias_without_source"
  | "identifier_without_source"
  | "identifier_reuse_across_entities"
  | "duplicate_alias"
  | "incomplete_temporal_precision"
  | "invalid_relationship_validity"
  | "missing_field_provenance_target"
  | "identity_evidence_missing"
  | "contradictory_identity_relationship"
  | "unsupported_calendar_conversion"
  | "claim_without_provenance"
  | "claim_attribution_without_source"
  | "broken_claim_attribution_reference"
  | "evidence_basis_missing"
  | "broken_evidence_link"
  | "evidence_locator_missing"
  | "contradictory_evidence_roles"
  | "claim_relation_without_source"
  | "status_without_lineage"
  | "duplicate_version_identifier"
  | "version_predecessor_cycle"
  | "multiple_current_versions"
  | "content_hash_mismatch"
  | "broken_version_provenance"
  | "missing_current_version"
  | "contradiction_without_provenance";

export interface DataQualityFinding {
  category: DataQualityFindingCategory;
  severity: "low" | "moderate" | "high";
  recordType: string;
  recordId: string;
  field: string;
  evidence: Record<string, string | number | boolean | string[]>;
  suggestedHumanReviewAction: string;
  diagnosticEventType:
    | "missing_attribution_detected"
    | "malformed_registry_record_detected"
    | "broken_source_reference_detected";
}

export interface DataQualityProvenanceReport {
  schemaVersion: "1.0";
  observer: "data-quality-provenance";
  authorityLevel: 1;
  readOnly: true;
  inspectedRecordCount: number;
  findingCount: number;
  findings: DataQualityFinding[];
  humanSummary: string;
  diagnosticEvent: {
    eventType: "observer_report_created";
    observer: "data-quality-provenance";
    findingCount: number;
  };
}

const safeExternalId = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const sourcePublicationTypes = /book|article|journal|publication|website|web|archive|dataset/i;
const allowedStatuses = new Set([
  "active",
  "inactive",
  "draft",
  "pending",
  "in-review",
  "reviewed",
  "approved",
  "rejected",
  "published",
  "archived",
  "deprecated",
  "superseded",
  "verified",
  "unverified",
  "disputed",
  "needs-review",
  "not-applicable",
  "public-domain",
  "licensed",
  "review-required",
  "internal-use-only",
  "unknown",
]);

function asRecord(value: unknown): RegistryRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RegistryRecord
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordId(record: RegistryRecord, fallback: string): string {
  return stringValue(record.id) ||
    stringValue(record.revisionId) ||
    stringValue(record.bundleId) ||
    fallback;
}

function externalIds(record: RegistryRecord): string[] {
  const values: unknown[] = [];
  if (record.externalId !== undefined) values.push(record.externalId);
  if (Array.isArray(record.externalIds)) values.push(...record.externalIds);
  else if (record.externalIds && typeof record.externalIds === "object") {
    values.push(...Object.values(record.externalIds as Record<string, unknown>));
  }
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function sourceReferences(record: RegistryRecord): unknown[] {
  if (Array.isArray(record.sourceIds)) return record.sourceIds;
  if (record.sourceId !== undefined) return [record.sourceId];
  return [];
}

function addFinding(
  findings: DataQualityFinding[],
  finding: DataQualityFinding,
): void {
  findings.push(finding);
}

function missingBundleMetadata(
  bundle: SourceRootBundle,
  findings: DataQualityFinding[],
): void {
  const requiredScalars = ["bundleId", "bundleType", "version", "domain", "createdAt"] as const;
  for (const field of requiredScalars) {
    if (!stringValue(bundle[field])) {
      addFinding(findings, {
        category: field === "createdAt" ? "missing_timestamp" : "incomplete_bundle_metadata",
        severity: "high",
        recordType: "bundle",
        recordId: stringValue(bundle.bundleId) || "unknown-bundle",
        field,
        evidence: { missingField: field },
        suggestedHumanReviewAction: `Review and supply the required bundle ${field} metadata.`,
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
  }
  for (const field of ["nodes", "assertions", "edges", "sources", "revisions"] as const) {
    if (!Array.isArray(bundle[field])) {
      addFinding(findings, {
        category: "incomplete_bundle_metadata",
        severity: "high",
        recordType: "bundle",
        recordId: stringValue(bundle.bundleId) || "unknown-bundle",
        field,
        evidence: { missingCollection: field },
        suggestedHumanReviewAction: `Review the bundle and add the required ${field} collection.`,
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
  }
}

function inspectStatuses(
  record: RegistryRecord,
  type: string,
  id: string,
  findings: DataQualityFinding[],
): void {
  for (const field of ["status", "verificationStatus", "reviewStatus", "licenseStatus"]) {
    if (record[field] === undefined) continue;
    const value = stringValue(record[field]).toLowerCase();
    if (!value || !allowedStatuses.has(value)) {
      addFinding(findings, {
        category: "invalid_status",
        severity: "moderate",
        recordType: type,
        recordId: id,
        field,
        evidence: { suppliedStatus: value || "non-string" },
        suggestedHumanReviewAction: `Review ${field} against the governed registry status vocabulary.`,
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
  }
}

function inspectSources(
  sources: RegistryRecord[],
  findings: DataQualityFinding[],
): void {
  const externalIdOwners = new Map<string, string[]>();
  sources.forEach((source, index) => {
    const id = recordId(source, `source-${index}`);
    const type = stringValue(source.type);
    const ids = externalIds(source);
    const requiresPublicationMetadata =
      source.publisherRequired === true || sourcePublicationTypes.test(type);

    if (requiresPublicationMetadata && !stringValue(source.publisher)) {
      addFinding(findings, {
        category: "missing_publisher",
        severity: "moderate",
        recordType: "source",
        recordId: id,
        field: "publisher",
        evidence: { sourceType: type || "unspecified" },
        suggestedHumanReviewAction: "Review the source and supply verified publisher information.",
        diagnosticEventType: "missing_attribution_detected",
      });
    }
    if ((source.externalIdRequired === true || stringValue(source.externalSystem)) && ids.length === 0) {
      addFinding(findings, {
        category: "missing_external_identifier",
        severity: "moderate",
        recordType: "source",
        recordId: id,
        field: "externalId",
        evidence: { externalSystem: stringValue(source.externalSystem) || "expected" },
        suggestedHumanReviewAction: "Review the source and supply the expected external identifier.",
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
    for (const externalId of ids) {
      if (!safeExternalId.test(externalId)) {
        addFinding(findings, {
          category: "malformed_external_identifier",
          severity: "high",
          recordType: "source",
          recordId: id,
          field: "externalId",
          evidence: { suppliedIdentifier: externalId.slice(0, 256) },
          suggestedHumanReviewAction: "Review the external identifier format against its source registry.",
          diagnosticEventType: "malformed_registry_record_detected",
        });
      }
      const normalized = externalId.toLocaleLowerCase();
      const owners = externalIdOwners.get(normalized);
      if (owners) owners.push(id);
      else externalIdOwners.set(normalized, [id]);
    }
    if ((source.urlRequired === true || requiresPublicationMetadata) && !stringValue(source.url)) {
      addFinding(findings, {
        category: "missing_source_url",
        severity: "moderate",
        recordType: "source",
        recordId: id,
        field: "url",
        evidence: { sourceType: type || "unspecified" },
        suggestedHumanReviewAction: "Review the source and supply a verified canonical URL.",
        diagnosticEventType: "missing_attribution_detected",
      });
    }
    if (source.timestampRequired === true && !stringValue(source.createdAt)) {
      addFinding(findings, {
        category: "missing_timestamp",
        severity: "moderate",
        recordType: "source",
        recordId: id,
        field: "createdAt",
        evidence: { timestampRequired: true },
        suggestedHumanReviewAction: "Review the source and supply its required timestamp.",
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
    inspectStatuses(source, "source", id, findings);
  });

  for (const [externalId, owners] of externalIdOwners) {
    if (owners.length < 2) continue;
    for (const owner of owners.slice().sort()) {
      addFinding(findings, {
        category: "duplicate_external_identifier",
        severity: "high",
        recordType: "source",
        recordId: owner,
        field: "externalId",
        evidence: { externalId, recordIds: owners.slice().sort() },
        suggestedHumanReviewAction: "Review duplicate external identifiers without merging or rewriting source records automatically.",
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
  }
}

function inspectProvenanceRecord(
  record: RegistryRecord,
  type: string,
  index: number,
  knownSourceIds: ReadonlySet<string>,
  findings: DataQualityFinding[],
): void {
  const id = recordId(record, `${type}-${index}`);
  const references = sourceReferences(record);
  if (references.length === 0) {
    addFinding(findings, {
      category: "missing_attribution",
      severity: "high",
      recordType: type,
      recordId: id,
      field: "sourceIds",
      evidence: { referenceCount: 0 },
      suggestedHumanReviewAction: "Review the record and connect it to an approved provenance source.",
      diagnosticEventType: "missing_attribution_detected",
    });
  }

  for (const reference of references) {
    const sourceId = stringValue(reference);
    if (!sourceId || !safeExternalId.test(sourceId)) {
      addFinding(findings, {
        category: "malformed_source_reference",
        severity: "high",
        recordType: type,
        recordId: id,
        field: "sourceIds",
        evidence: { suppliedReference: sourceId || "non-string" },
        suggestedHumanReviewAction: "Review and correct the malformed source reference through the governed workflow.",
        diagnosticEventType: "broken_source_reference_detected",
      });
    } else if (!knownSourceIds.has(sourceId)) {
      addFinding(findings, {
        category: "broken_source_relationship",
        severity: "high",
        recordType: type,
        recordId: id,
        field: "sourceIds",
        evidence: { missingSourceId: sourceId },
        suggestedHumanReviewAction: "Review the missing source association and restore it through human-governed correction.",
        diagnosticEventType: "broken_source_reference_detected",
      });
    }
  }
  if (record.timestampRequired === true && !stringValue(record.createdAt)) {
    addFinding(findings, {
      category: "missing_timestamp",
      severity: "moderate",
      recordType: type,
      recordId: id,
      field: "createdAt",
      evidence: { timestampRequired: true },
      suggestedHumanReviewAction: "Review the record and supply its required timestamp.",
      diagnosticEventType: "malformed_registry_record_detected",
    });
  }
  inspectStatuses(record, type, id, findings);
}

function contextualCollections(bundle: SourceRootBundle) {
  const context = asRecord(bundle.context);
  return {
    context,
    entities: Array.isArray(context.entities)
      ? context.entities.map(asRecord)
      : [],
    aliases: Array.isArray(context.aliases)
      ? context.aliases.map(asRecord)
      : [],
    identifiers: Array.isArray(context.externalIdentifiers)
      ? context.externalIdentifiers.map(asRecord)
      : [],
    temporal: Array.isArray(context.temporalAssertions)
      ? context.temporalAssertions.map(asRecord)
      : [],
    relationships: Array.isArray(context.relationships)
      ? context.relationships.map(asRecord)
      : [],
    provenance: Array.isArray(context.fieldProvenance)
      ? context.fieldProvenance.map(asRecord)
      : [],
    claims: Array.isArray(context.claims)
      ? context.claims.map(asRecord)
      : [],
    evidence: Array.isArray(context.evidence)
      ? context.evidence.map(asRecord)
      : [],
    attributions: Array.isArray(context.claimAttributions)
      ? context.claimAttributions.map(asRecord)
      : [],
    claimRelations: Array.isArray(context.claimRelations)
      ? context.claimRelations.map(asRecord)
      : [],
    evidenceLinks: Array.isArray(context.evidenceClaimLinks)
      ? context.evidenceClaimLinks.map(asRecord)
      : [],
    sourceLocators: Array.isArray(context.sourceLocators)
      ? context.sourceLocators.map(asRecord)
      : [],
    claimVersions: Array.isArray(context.claimVersions)
      ? context.claimVersions.map(asRecord)
      : [],
    evidenceVersions: Array.isArray(context.evidenceVersions)
      ? context.evidenceVersions.map(asRecord)
      : [],
  };
}

function inspectContextualRefinements(
  bundle: SourceRootBundle,
  knownSourceIds: ReadonlySet<string>,
  findings: DataQualityFinding[],
): number {
  const {
    entities,
    aliases,
    identifiers,
    temporal,
    relationships,
    provenance,
    claims,
    evidence,
    attributions,
    claimRelations,
    evidenceLinks,
    sourceLocators,
    claimVersions,
    evidenceVersions,
  } = contextualCollections(bundle);
  const allRecords = [
    ...entities,
    ...temporal,
    ...relationships,
    ...(
      Array.isArray(asRecord(bundle.context).accounts)
        ? (asRecord(bundle.context).accounts as unknown[]).map(asRecord)
        : []
    ),
    ...(
      claims
    ),
  ];
  const recordsById = new Map(
    allRecords
      .map((record) => [stringValue(record.id), record] as const)
      .filter(([id]) => Boolean(id)),
  );
  const temporalIds = new Set(
    temporal.map((record) => stringValue(record.id)).filter(Boolean),
  );
  const entityIds = new Set(
    entities.map((record) => stringValue(record.id)).filter(Boolean),
  );
  const accountRecords = Array.isArray(
    asRecord(bundle.context).accounts,
  )
    ? (asRecord(bundle.context).accounts as unknown[]).map(asRecord)
    : [];
  const accountIds = new Set(
    accountRecords
      .map((record) => stringValue(record.id))
      .filter(Boolean),
  );
  const claimIds = new Set(
    claims.map((record) => stringValue(record.id)).filter(Boolean),
  );
  const evidenceIds = new Set(
    evidence.map((record) => stringValue(record.id)).filter(Boolean),
  );

  const aliasKeys = new Map<string, string[]>();
  aliases.forEach((alias, index) => {
    const id = recordId(alias, `alias-${index}`);
    const sourceIds = sourceReferences(alias)
      .map(stringValue)
      .filter(Boolean);
    if (sourceIds.length === 0) {
      addFinding(findings, {
        category: "alias_without_source",
        severity: "moderate",
        recordType: "context-alias",
        recordId: id,
        field: "sourceIds",
        evidence: {
          entityId: stringValue(alias.entityId) || "unknown",
          aliasText: stringValue(alias.text) || "unknown",
        },
        suggestedHumanReviewAction:
          "Review the alias and add source support only when evidence exists.",
        diagnosticEventType: "missing_attribution_detected",
      });
    }
    for (const sourceId of sourceIds) {
      if (!knownSourceIds.has(sourceId)) {
        addFinding(findings, {
          category: "broken_source_relationship",
          severity: "high",
          recordType: "context-alias",
          recordId: id,
          field: "sourceIds",
          evidence: { missingSourceId: sourceId },
          suggestedHumanReviewAction:
            "Review the missing alias source without fabricating attribution.",
          diagnosticEventType: "broken_source_reference_detected",
        });
      }
    }
    const key = [
      stringValue(alias.entityId),
      stringValue(alias.text),
      stringValue(alias.aliasType),
      stringValue(alias.languageTag),
      stringValue(alias.scriptIdentifier),
    ].join("\u0000");
    const owners = aliasKeys.get(key) ?? [];
    owners.push(id);
    aliasKeys.set(key, owners);
  });
  for (const [key, ids] of aliasKeys) {
    if (ids.length < 2) continue;
    for (const id of ids.slice().sort()) {
      addFinding(findings, {
        category: "duplicate_alias",
        severity: "moderate",
        recordType: "context-alias",
        recordId: id,
        field: "text",
        evidence: {
          duplicateKey: key.replaceAll("\u0000", "|"),
          recordIds: ids.slice().sort(),
        },
        suggestedHumanReviewAction:
          "Review the exact duplicate aliases without deleting evidence automatically.",
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
  }

  const identifierOwners = new Map<string, Array<{
    id: string;
    entityId: string;
  }>>();
  identifiers.forEach((identifier, index) => {
    const id = recordId(identifier, `identifier-${index}`);
    const entityId = stringValue(identifier.entityId);
    const sourceIds = sourceReferences(identifier)
      .map(stringValue)
      .filter(Boolean);
    if (sourceIds.length === 0) {
      addFinding(findings, {
        category: "identifier_without_source",
        severity: "moderate",
        recordType: "context-external-identifier",
        recordId: id,
        field: "sourceIds",
        evidence: {
          entityId: entityId || "unknown",
          scheme: stringValue(identifier.scheme) || "unknown",
        },
        suggestedHumanReviewAction:
          "Review the identifier and add source support only when evidence exists.",
        diagnosticEventType: "missing_attribution_detected",
      });
    }
    const key = [
      stringValue(identifier.scheme).toLocaleLowerCase(),
      stringValue(identifier.value),
    ].join("\u0000");
    const owners = identifierOwners.get(key) ?? [];
    owners.push({ id, entityId });
    identifierOwners.set(key, owners);
  });
  for (const [key, owners] of identifierOwners) {
    const entityIds = new Set(owners.map((owner) => owner.entityId));
    if (entityIds.size < 2) continue;
    for (const owner of owners.slice().sort((left, right) =>
      left.id.localeCompare(right.id)
    )) {
      addFinding(findings, {
        category: "identifier_reuse_across_entities",
        severity: "high",
        recordType: "context-external-identifier",
        recordId: owner.id,
        field: "value",
        evidence: {
          schemeAndValue: key.replace("\u0000", ":"),
          entityIds: [...entityIds].sort(),
        },
        suggestedHumanReviewAction:
          "Review the identifier collision as a possible identity conflict; do not merge entities automatically.",
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
  }

  temporal.forEach((record, index) => {
    const id = recordId(record, `temporal-${index}`);
    const structured = asRecord(record.structuredDate);
    const precision = stringValue(structured.precision);
    if (
      structured.originalLabel !== undefined
      && (
        !precision
        || (
          ["day", "month", "year", "decade", "century"].includes(precision)
          && (
            !Number.isInteger(structured.year)
            || !["BCE", "CE"].includes(stringValue(structured.era))
          )
        )
      )
    ) {
      addFinding(findings, {
        category: "incomplete_temporal_precision",
        severity: "high",
        recordType: "context-temporal-assertion",
        recordId: id,
        field: "structuredDate",
        evidence: { precision: precision || "missing" },
        suggestedHumanReviewAction:
          "Review the stated precision, era, and year without inventing a chronology.",
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
    const calendar =
      stringValue(structured.calendarSystem).toLocaleLowerCase();
    if (
      calendar
      && !["gregorian", "proleptic_gregorian", "iso-8601", "unspecified"].includes(calendar)
      && stringValue(structured.conversionStatus) !== "unconverted"
    ) {
      addFinding(findings, {
        category: "unsupported_calendar_conversion",
        severity: "high",
        recordType: "context-temporal-assertion",
        recordId: id,
        field: "structuredDate.conversionStatus",
        evidence: { calendarSystem: calendar },
        suggestedHumanReviewAction:
          "Review the calendar claim and mark it unconverted unless an evidenced conversion exists.",
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
  });

  const identityByPair = new Map<string, Set<string>>();
  relationships.forEach((relationship, index) => {
    const id = recordId(relationship, `relationship-${index}`);
    const type = stringValue(relationship.relationshipType);
    const fromId = stringValue(relationship.fromId);
    const toId = stringValue(relationship.toId);
    const validity = asRecord(relationship.validity);
    for (const link of (
      Array.isArray(validity.temporalLinks)
        ? validity.temporalLinks.map(asRecord)
        : []
    )) {
      const temporalId = stringValue(link.temporalAssertionId);
      if (!temporalId || !temporalIds.has(temporalId)) {
        addFinding(findings, {
          category: "invalid_relationship_validity",
          severity: "high",
          recordType: "context-relationship",
          recordId: id,
          field: "validity.temporalLinks",
          evidence: {
            missingTemporalAssertionId: temporalId || "missing",
          },
          suggestedHumanReviewAction:
            "Review the relationship validity link without rewriting its dates.",
          diagnosticEventType: "broken_source_reference_detected",
        });
      }
    }

    if (
      type === "possible_same_as"
      && sourceReferences(relationship).length === 0
    ) {
      addFinding(findings, {
        category: "identity_evidence_missing",
        severity: "high",
        recordType: "context-relationship",
        recordId: id,
        field: "sourceIds",
        evidence: { relationshipType: type },
        suggestedHumanReviewAction:
          "Review the possible identity match and add evidence only through human-governed work.",
        diagnosticEventType: "missing_attribution_detected",
      });
    }
    if (
      ["possible_same_as", "asserted_same_as", "distinct_from"].includes(type)
    ) {
      const pair = [fromId, toId].sort().join("\u0000");
      const types = identityByPair.get(pair) ?? new Set<string>();
      types.add(type);
      identityByPair.set(pair, types);
    }
  });
  for (const [pair, types] of identityByPair) {
    if (
      !types.has("distinct_from")
      || (
        !types.has("possible_same_as")
        && !types.has("asserted_same_as")
      )
    ) {
      continue;
    }
    const entityIds = pair.split("\u0000");
    for (const relationship of relationships) {
      const endpoints = [
        stringValue(relationship.fromId),
        stringValue(relationship.toId),
      ].sort();
      if (endpoints.join("\u0000") !== pair) continue;
      addFinding(findings, {
        category: "contradictory_identity_relationship",
        severity: "high",
        recordType: "context-relationship",
        recordId: stringValue(relationship.id) || "unknown",
        field: "relationshipType",
        evidence: {
          entityIds,
          relationshipTypes: [...types].sort(),
        },
        suggestedHumanReviewAction:
          "Review the conflicting identity assertions without merging, redirecting, or deleting either entity.",
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
  }

  const attributionByClaim = new Map<string, RegistryRecord[]>();
  attributions.forEach((attribution, index) => {
    const id = recordId(attribution, `claim-attribution-${index}`);
    const claimId = stringValue(attribution.claimId);
    const items = attributionByClaim.get(claimId) ?? [];
    items.push(attribution);
    attributionByClaim.set(claimId, items);
    if (sourceReferences(attribution).length === 0) {
      addFinding(findings, {
        category: "claim_attribution_without_source",
        severity: "moderate",
        recordType: "context-claim-attribution",
        recordId: id,
        field: "sourceIds",
        evidence: { claimId: claimId || "missing" },
        suggestedHumanReviewAction:
          "Review the attribution and add source support only when an explicit source establishes that attribution.",
        diagnosticEventType: "missing_attribution_detected",
      });
    }
    const brokenReferences = [
      ["actorEntityId", stringValue(attribution.actorEntityId), entityIds],
      ["accountId", stringValue(attribution.accountId), accountIds],
      [
        "temporalAssertionId",
        stringValue(attribution.temporalAssertionId),
        temporalIds,
      ],
    ] as const;
    for (const [field, value, ids] of brokenReferences) {
      if (value && !ids.has(value)) {
        addFinding(findings, {
          category: "broken_claim_attribution_reference",
          severity: "high",
          recordType: "context-claim-attribution",
          recordId: id,
          field,
          evidence: { missingReferenceId: value },
          suggestedHumanReviewAction:
            "Review the broken attribution reference without inferring an actor, account, or time.",
          diagnosticEventType: "broken_source_reference_detected",
        });
      }
    }
  });

  claims.forEach((claim, index) => {
    const id = recordId(claim, `claim-${index}`);
    const claimAttributions = attributionByClaim.get(id) ?? [];
    const hasAttributionSource = claimAttributions.some(
      (attribution) => sourceReferences(attribution).length > 0,
    );
    if (
      sourceReferences(claim).length === 0
      && !hasAttributionSource
    ) {
      addFinding(findings, {
        category: "claim_without_provenance",
        severity: "high",
        recordType: "context-claim",
        recordId: id,
        field: "sourceIds",
        evidence: {
          recordSourceCount: 0,
          sourcedAttributionCount: 0,
        },
        suggestedHumanReviewAction:
          "Review the claim and identify a source proving the claim was made; do not treat that source as evidentiary proof.",
        diagnosticEventType: "missing_attribution_detected",
      });
    }
  });

  const relationsByClaim = new Map<string, RegistryRecord[]>();
  claimRelations.forEach((relation, index) => {
    const id = recordId(relation, `claim-relation-${index}`);
    for (const claimId of [
      stringValue(relation.fromClaimId),
      stringValue(relation.toClaimId),
    ]) {
      const items = relationsByClaim.get(claimId) ?? [];
      items.push(relation);
      relationsByClaim.set(claimId, items);
    }
    if (sourceReferences(relation).length === 0) {
      addFinding(findings, {
        category:
          stringValue(relation.relationType) === "contradicts"
            ? "contradiction_without_provenance"
            : "claim_relation_without_source",
        severity: "high",
        recordType: "context-claim-relation",
        recordId: id,
        field: "sourceIds",
        evidence: {
          relationType:
            stringValue(relation.relationType) || "missing",
        },
        suggestedHumanReviewAction:
          "Review the explicit claim relationship and add provenance without inferring a relationship from text.",
        diagnosticEventType: "missing_attribution_detected",
      });
    }
  });

  const claimVersionIds = new Set(
    claimVersions
      .map((version) => stringValue(version.id))
      .filter(Boolean),
  );
  evidence.forEach((record, index) => {
    const id = recordId(record, `evidence-${index}`);
    if (
      !stringValue(record.sourceId)
      && !stringValue(record.accountId)
      && !stringValue(record.evidenceRecordId)
    ) {
      addFinding(findings, {
        category: "evidence_basis_missing",
        severity: "high",
        recordType: "context-evidence",
        recordId: id,
        field: "sourceId",
        evidence: { basisReferenceCount: 0 },
        suggestedHumanReviewAction:
          "Review the evidence record and supply an explicit source, account, or evidence-record basis.",
        diagnosticEventType: "broken_source_reference_detected",
      });
    }
    const metadata = asRecord(record.metadata);
    if (
      metadata.locatorRequired === true
      && !sourceLocators.some(
        (locator) => stringValue(locator.evidenceId) === id,
      )
    ) {
      addFinding(findings, {
        category: "evidence_locator_missing",
        severity: "moderate",
        recordType: "context-evidence",
        recordId: id,
        field: "sourceLocators",
        evidence: { locatorRequired: true },
        suggestedHumanReviewAction:
          "Review the explicitly locator-required evidence and supply the exact user-verified locator.",
        diagnosticEventType: "missing_attribution_detected",
      });
    }
  });

  const rolesByPair = new Map<string, Set<string>>();
  evidenceLinks.forEach((link, index) => {
    const id = recordId(link, `evidence-link-${index}`);
    const evidenceId = stringValue(link.evidenceId);
    const claimId = stringValue(link.claimId);
    const versionId = stringValue(link.claimVersionId);
    if (
      !evidenceIds.has(evidenceId)
      || !claimIds.has(claimId)
      || (versionId && !claimVersionIds.has(versionId))
    ) {
      addFinding(findings, {
        category: "broken_evidence_link",
        severity: "high",
        recordType: "context-evidence-claim-link",
        recordId: id,
        field: versionId ? "claimVersionId" : "claimId",
        evidence: {
          evidenceId: evidenceId || "missing",
          claimId: claimId || "missing",
          claimVersionId: versionId || "not-targeted",
        },
        suggestedHumanReviewAction:
          "Review the broken evidence link without changing its support meaning automatically.",
        diagnosticEventType: "broken_source_reference_detected",
      });
    }
    const pair = `${evidenceId}\u0000${claimId}`;
    const roles = rolesByPair.get(pair) ?? new Set<string>();
    roles.add(stringValue(link.supportRole));
    rolesByPair.set(pair, roles);
  });
  for (const [pair, roles] of rolesByPair) {
    const hasPositive = [...roles].some((role) =>
      ["supports", "corroborates"].includes(role)
    );
    const hasNegative = [...roles].some((role) =>
      ["disputes", "contradicts"].includes(role)
    );
    if (!hasPositive || !hasNegative) {
      continue;
    }
    const [evidenceId = "", claimId = ""] = pair.split("\u0000");
    addFinding(findings, {
      category: "contradictory_evidence_roles",
      severity: "high",
      recordType: "context-evidence-claim-link",
      recordId: `${evidenceId}:${claimId}`,
      field: "supportRole",
      evidence: {
        evidenceId,
        claimId,
        supportRoles: [...roles].sort(),
      },
      suggestedHumanReviewAction:
        "Review the explicitly conflicting support roles; do not calculate a winner or truth score.",
      diagnosticEventType: "malformed_registry_record_detected",
    });
  }

  const inspectVersions = (
    kind: "claim" | "evidence",
    versions: RegistryRecord[],
  ) => {
    const versionsById = new Map<string, RegistryRecord>();
    const duplicates = new Set<string>();
    const currents = new Map<string, number>();
    const parentField = kind === "claim" ? "claimId" : "evidenceId";
    for (const version of versions) {
      const id = stringValue(version.id);
      const parentId = stringValue(version[parentField]);
      if (versionsById.has(id)) {
        duplicates.add(id);
      }
      versionsById.set(id, version);
      if (version.current === true) {
        currents.set(parentId, (currents.get(parentId) ?? 0) + 1);
      }
      const suppliedHash = stringValue(version.contentHash);
      if (suppliedHash) {
        const actualHash = kind === "claim"
          ? claimVersionContentHash(
              version as unknown as ContextClaimVersion,
            )
          : evidenceVersionContentHash(
              version as unknown as ContextEvidenceVersion,
            );
        if (suppliedHash !== actualHash) {
          addFinding(findings, {
            category: "content_hash_mismatch",
            severity: "high",
            recordType: `context-${kind}-version`,
            recordId: id || "unknown",
            field: "contentHash",
            evidence: {
              suppliedHash,
              normalizedHash: actualHash,
            },
            suggestedHumanReviewAction:
              "Review the immutable version bytes and reject the mismatched content.",
            diagnosticEventType: "malformed_registry_record_detected",
          });
        }
      }
      for (const sourceId of sourceReferences(version)
        .map(stringValue)
        .filter(Boolean)) {
        if (!knownSourceIds.has(sourceId)) {
          addFinding(findings, {
            category: "broken_version_provenance",
            severity: "high",
            recordType: `context-${kind}-version`,
            recordId: id || "unknown",
            field: "sourceIds",
            evidence: { missingSourceId: sourceId },
            suggestedHumanReviewAction:
              "Review the immutable version provenance and restore only a verified source reference.",
            diagnosticEventType: "broken_source_reference_detected",
          });
        }
      }
    }
    for (const id of [...duplicates].sort()) {
      addFinding(findings, {
        category: "duplicate_version_identifier",
        severity: "high",
        recordType: `context-${kind}-version`,
        recordId: id,
        field: "id",
        evidence: { duplicateVersionId: id },
        suggestedHumanReviewAction:
          "Review the conflicting version identifiers and preserve both histories under stable unique IDs.",
        diagnosticEventType: "malformed_registry_record_detected",
      });
    }
    for (const version of versions) {
      const id = stringValue(version.id);
      const seen = new Set<string>([id]);
      let prior = stringValue(version.priorVersionId);
      while (prior) {
        if (seen.has(prior)) {
          addFinding(findings, {
            category: "version_predecessor_cycle",
            severity: "high",
            recordType: `context-${kind}-version`,
            recordId: id || "unknown",
            field: "priorVersionId",
            evidence: { repeatedVersionId: prior },
            suggestedHumanReviewAction:
              "Review and repair the predecessor chain without deleting historical versions.",
            diagnosticEventType: "malformed_registry_record_detected",
          });
          break;
        }
        seen.add(prior);
        prior = stringValue(
          versionsById.get(prior)?.priorVersionId,
        );
      }
    }
    for (
      const parentId
      of new Set(
        versions.map((version) => stringValue(version[parentField])),
      )
    ) {
      const count = currents.get(parentId) ?? 0;
      if (count !== 1) {
        addFinding(findings, {
          category:
            count === 0
              ? "missing_current_version"
              : "multiple_current_versions",
          severity: "high",
          recordType: `context-${kind}-version`,
          recordId: parentId || "unknown",
          field: "current",
          evidence: { currentVersionCount: count },
          suggestedHumanReviewAction:
            "Review the explicit current-version pointer without overwriting or deleting history.",
          diagnosticEventType: "malformed_registry_record_detected",
        });
      }
    }
  };
  inspectVersions("claim", claimVersions);
  inspectVersions("evidence", evidenceVersions);

  for (const record of [...claims, ...claimVersions]) {
    const status = stringValue(record.status);
    if (!["superseded", "retracted", "corrected"].includes(status)) {
      continue;
    }
    const claimId =
      stringValue(record.claimId) || stringValue(record.id);
    const relations = relationsByClaim.get(claimId) ?? [];
    if (
      !relations.some((relation) =>
        ["supersedes", "retracts", "corrects"].includes(
          stringValue(relation.relationType),
        )
      )
    ) {
      addFinding(findings, {
        category: "status_without_lineage",
        severity: "high",
        recordType: "context-claim",
        recordId: claimId || "unknown",
        field: "status",
        evidence: { status },
        suggestedHumanReviewAction:
          "Review the lifecycle status and add an explicit lineage relation without deleting earlier wording.",
        diagnosticEventType: "missing_attribution_detected",
      });
    }
  }

  provenance.forEach((link, index) => {
    const id = recordId(link, `field-provenance-${index}`);
    const targetId = stringValue(link.targetId);
    const target = recordsById.get(targetId);
    const root = stringValue(link.fieldPath).split(".")[0] ?? "";
    const derivedRootExists =
      (
        root === "aliases"
        && aliases.some(
          (alias) => stringValue(alias.entityId) === targetId,
        )
      )
      || (
        root === "externalIdentifiers"
        && identifiers.some(
          (identifier) =>
            stringValue(identifier.entityId) === targetId,
        )
      )
      || (
        root === "identityLinks"
        && relationships.some(
          (relationship) =>
            stringValue(relationship.fromId) === targetId
            || stringValue(relationship.toId) === targetId,
        )
      );
    if (
      !target
      || (
        !Object.prototype.hasOwnProperty.call(target, root)
        && !derivedRootExists
      )
    ) {
      addFinding(findings, {
        category: "missing_field_provenance_target",
        severity: "high",
        recordType: "context-field-provenance",
        recordId: id,
        field: "fieldPath",
        evidence: {
          targetId: targetId || "missing",
          fieldPath: stringValue(link.fieldPath) || "missing",
        },
        suggestedHumanReviewAction:
          "Review the field-level source link and repair it through the governed workflow.",
        diagnosticEventType: "broken_source_reference_detected",
      });
    }
  });

  return aliases.length
    + identifiers.length
    + temporal.length
    + relationships.length
    + provenance.length
    + claims.length
    + evidence.length
    + attributions.length
    + claimRelations.length
    + evidenceLinks.length
    + sourceLocators.length
    + claimVersions.length
    + evidenceVersions.length;
}

export function observeDataQualityAndProvenance(
  bundle: Readonly<SourceRootBundle>,
): DataQualityProvenanceReport {
  const findings: DataQualityFinding[] = [];
  missingBundleMetadata(bundle, findings);
  const sources = (Array.isArray(bundle.sources) ? bundle.sources : []).map(asRecord);
  inspectSources(sources, findings);
  const knownSourceIds = new Set(
    sources.map((source) => stringValue(source.id)).filter(Boolean)
  );
  const contextualRecordCount = inspectContextualRefinements(
    bundle,
    knownSourceIds,
    findings,
  );
  const collections = [
    ["node", bundle.nodes],
    ["assertion", bundle.assertions],
    ["edge", bundle.edges],
    ["revision", bundle.revisions],
  ] as const;

  let inspectedRecordCount =
    sources.length + 1 + contextualRecordCount;
  for (const [type, values] of collections) {
    const records = Array.isArray(values) ? values.map(asRecord) : [];
    inspectedRecordCount += records.length;
    records.forEach((record, index) => {
      inspectProvenanceRecord(record, type, index, knownSourceIds, findings);
    });
  }

  findings.sort((left, right) =>
    left.category.localeCompare(right.category) ||
    left.recordType.localeCompare(right.recordType) ||
    left.recordId.localeCompare(right.recordId) ||
    left.field.localeCompare(right.field)
  );
  const humanSummary = findings.length === 0
    ? `No data-quality or provenance findings were detected across ${inspectedRecordCount} inspected record(s).`
    : `${findings.length} data-quality or provenance finding(s) require human review across ${inspectedRecordCount} inspected record(s). No records were modified.`;

  return {
    schemaVersion: "1.0",
    observer: "data-quality-provenance",
    authorityLevel: 1,
    readOnly: true,
    inspectedRecordCount,
    findingCount: findings.length,
    findings,
    humanSummary,
    diagnosticEvent: {
      eventType: "observer_report_created",
      observer: "data-quality-provenance",
      findingCount: findings.length,
    },
  };
}

export function serializeDataQualityProvenanceReport(
  report: DataQualityProvenanceReport,
): string {
  return JSON.stringify(report, null, 2);
}
