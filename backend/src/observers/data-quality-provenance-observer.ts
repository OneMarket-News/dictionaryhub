import type { SourceRootBundle } from "../types.js";

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
  | "malformed_source_reference";

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
  const collections = [
    ["node", bundle.nodes],
    ["assertion", bundle.assertions],
    ["edge", bundle.edges],
    ["revision", bundle.revisions],
  ] as const;

  let inspectedRecordCount = sources.length + 1;
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

