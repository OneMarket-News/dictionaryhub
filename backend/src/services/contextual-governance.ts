import type { PoolClient } from "pg";
import { z } from "zod";

import {
  contextRecordKinds,
  type ContextRecordKind,
  type StructuredHistoricalDate,
} from "../contextual-types.js";
import { sha256 } from "../lib/security.js";
import {
  contextCausalLinkSchema,
  contextClaimSchema,
  contextCulturalMemorySchema,
  contextEntityAliasSchema,
  contextEntitySchema,
  contextExternalIdentifierSchema,
  contextEvidenceSchema,
  contextFieldProvenanceSchema,
  contextInterpretationSchema,
  contextPerspectiveSchema,
  contextRelationshipSchema,
  historicalAccountSchema,
  temporalAssertionSchema,
} from "./contextual-schemas.js";
import {
  chronologyBoundsForStructuredDate,
} from "./contextual-time.js";

export interface GovernanceValidationIssue {
  code: string;
  field?: string;
  message: string;
  severity: "error" | "warning";
  risk?: "high" | "medium";
}

export interface GovernanceValidationResult {
  valid: boolean;
  errors: GovernanceValidationIssue[];
  warnings: GovernanceValidationIssue[];
  checkedAt: string;
  disclaimer: string;
}

export interface GovernedTargetSnapshot {
  exists: boolean;
  targetType: string;
  targetId: string;
  bundleId: string | null;
  snapshot: Record<string, unknown>;
  versionToken: string;
}

export const contextualGovernanceTargetTypes = new Set<string>([
  ...contextRecordKinds,
  "source",
]);

const contextualSchemaByKind: Record<
  ContextRecordKind,
  z.ZodType<Record<string, unknown>>
> = {
  entity: contextEntitySchema,
  temporal_assertion: temporalAssertionSchema,
  account: historicalAccountSchema,
  claim: contextClaimSchema,
  evidence: contextEvidenceSchema,
  interpretation: contextInterpretationSchema,
  perspective: contextPerspectiveSchema,
  causal_link: contextCausalLinkSchema,
  relationship: contextRelationshipSchema,
  cultural_memory: contextCulturalMemorySchema,
};

const protectedPatchFields = new Set([
  "id",
  "recordKind",
  "bundleId",
  "createdAt",
  "updatedAt",
]);

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function governanceVersionToken(
  snapshot: Record<string, unknown>,
): string {
  return `sha256:${sha256(JSON.stringify(stableValue(snapshot)))}`;
}

function absentVersionToken(targetType: string, targetId: string): string {
  return `absent:${targetType}:${sha256(targetId)}`;
}

function cleanSnapshot(
  raw: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const snapshot = { ...raw };
  for (const [key, value] of Object.entries(extra)) {
    if (
      value !== null
      && value !== undefined
      || Object.prototype.hasOwnProperty.call(raw, key)
    ) {
      snapshot[key] = value;
    }
  }
  delete snapshot.createdAt;
  delete snapshot.updatedAt;
  delete snapshot.recordKind;
  delete snapshot.bundleId;
  delete snapshot.governanceVisibility;
  return snapshot;
}

export async function loadGovernedTarget(
  client: PoolClient,
  targetType: string,
  targetId: string,
): Promise<GovernedTargetSnapshot> {
  if (targetType === "source") {
    const result = await client.query<{
      source_id: string;
      bundle_id: string;
      raw_data: Record<string, unknown>;
      name: string;
      source_type: string | null;
      domain: string | null;
      publisher: string | null;
      quality_tier: string | null;
      credibility_tier: string | null;
      verification_status: string | null;
      source_class: string | null;
      license: string | null;
      license_status: string | null;
      review_status: string | null;
      last_reviewed: Date | string | null;
      url: string | null;
      notes: string | null;
    }>(
      `SELECT source_id, bundle_id, raw_data, name, source_type, domain,
              publisher, quality_tier, credibility_tier, verification_status,
              source_class, license, license_status, review_status,
              last_reviewed, url, notes
       FROM sources
       WHERE source_id = $1`,
      [targetId],
    );
    const row = result.rows[0];
    if (!row) {
      return {
        exists: false,
        targetType,
        targetId,
        bundleId: null,
        snapshot: {},
        versionToken: absentVersionToken(targetType, targetId),
      };
    }
    const snapshot = cleanSnapshot(row.raw_data || {}, {
      id: row.source_id,
      name: row.name,
      type: row.source_type,
      domain: row.domain,
      publisher: row.publisher,
      qualityTier: row.quality_tier,
      credibilityTier: row.credibility_tier,
      verificationStatus: row.verification_status,
      sourceClass: row.source_class,
      license: row.license,
      licenseStatus: row.license_status,
      reviewStatus: row.review_status,
      lastReviewed:
        row.last_reviewed instanceof Date
          ? row.last_reviewed.toISOString().slice(0, 10)
          : row.last_reviewed,
      url: row.url,
      notes: row.notes,
    });
    return {
      exists: true,
      targetType,
      targetId,
      bundleId: row.bundle_id,
      snapshot,
      versionToken: governanceVersionToken(snapshot),
    };
  }

  if (!contextualGovernanceTargetTypes.has(targetType)) {
    return {
      exists: false,
      targetType,
      targetId,
      bundleId: null,
      snapshot: {},
      versionToken: absentVersionToken(targetType, targetId),
    };
  }

  const result = await client.query<{
    context_id: string;
    bundle_id: string;
    record_kind: ContextRecordKind;
    raw_data: Record<string, unknown>;
    label: string;
    summary: string | null;
    domain: string;
    status: string;
    metadata: Record<string, unknown>;
    source_ids: string[];
    perspective_links: Array<{
      perspectiveId: string;
      stance: string | null;
      notes: string | null;
    }>;
    aliases: Array<Record<string, unknown>>;
    external_identifiers: Array<Record<string, unknown>>;
    field_provenance: Array<Record<string, unknown>>;
  }>(
    `SELECT cr.context_id, cr.bundle_id, cr.record_kind, cr.raw_data,
            cr.label, cr.summary, cr.domain, cr.status, cr.metadata,
            COALESCE(
              (SELECT ARRAY_AGG(link.source_id ORDER BY link.source_id)
               FROM context_record_sources link
               WHERE link.context_id = cr.context_id),
              ARRAY[]::TEXT[]
            ) AS source_ids,
            COALESCE(
              (SELECT JSONB_AGG(
                 JSONB_BUILD_OBJECT(
                   'perspectiveId', link.perspective_context_id,
                   'stance', link.stance,
                   'notes', link.notes
                 )
                 ORDER BY link.perspective_context_id
               )
               FROM context_record_perspectives link
               WHERE link.record_context_id = cr.context_id),
              '[]'::JSONB
            ) AS perspective_links,
            COALESCE(
              (SELECT JSONB_AGG(
                 JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
                   'id', alias.alias_id,
                   'entityId', alias.entity_context_id,
                   'text', alias.alias_text,
                   'aliasType', alias.alias_type,
                   'languageTag', alias.language_tag,
                   'scriptIdentifier', alias.script_identifier,
                   'notes', alias.notes,
                   'uncertainty', alias.uncertainty,
                   'status', alias.status,
                   'temporalAssertionId', alias.temporal_context_id,
                   'sourceIds',
                     COALESCE(
                       (SELECT JSONB_AGG(source.source_id ORDER BY source.source_id)
                        FROM context_entity_alias_sources source
                        WHERE source.alias_id = alias.alias_id),
                       '[]'::JSONB
                     )
                 ))
                 ORDER BY alias.alias_text, alias.alias_id
               )
               FROM context_entity_aliases alias
               WHERE alias.entity_context_id = cr.context_id),
              '[]'::JSONB
            ) AS aliases,
            COALESCE(
              (SELECT JSONB_AGG(
                 JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
                   'id', identifier.identifier_id,
                   'entityId', identifier.entity_context_id,
                   'scheme', identifier.identifier_scheme,
                   'value', identifier.identifier_value,
                   'normalizedValue', identifier.normalized_value,
                   'uri', identifier.identifier_uri,
                   'label', identifier.label,
                   'status', identifier.status,
                   'notes', identifier.notes,
                   'uncertainty', identifier.uncertainty,
                   'sourceIds',
                     COALESCE(
                       (SELECT JSONB_AGG(source.source_id ORDER BY source.source_id)
                        FROM context_entity_identifier_sources source
                        WHERE source.identifier_id = identifier.identifier_id),
                       '[]'::JSONB
                     )
                 ))
                 ORDER BY identifier.identifier_scheme, identifier.identifier_value, identifier.identifier_id
               )
               FROM context_entity_identifiers identifier
               WHERE identifier.entity_context_id = cr.context_id),
              '[]'::JSONB
            ) AS external_identifiers,
            COALESCE(
              (SELECT JSONB_AGG(
                 JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
                   'id', provenance.provenance_id,
                   'targetId', provenance.context_id,
                   'fieldPath', provenance.field_path,
                   'subrecordType', provenance.subrecord_type,
                   'subrecordId', provenance.subrecord_id,
                   'sourceId', provenance.source_id,
                   'supportType', provenance.support_type,
                   'note', provenance.note,
                   'confidence', provenance.confidence,
                   'uncertainty', provenance.uncertainty
                 ))
                 ORDER BY provenance.field_path, provenance.provenance_id
               )
               FROM context_field_provenance provenance
               WHERE provenance.context_id = cr.context_id),
              '[]'::JSONB
            ) AS field_provenance
     FROM context_records cr
     WHERE cr.context_id = $1 AND cr.record_kind = $2`,
    [targetId, targetType],
  );
  const row = result.rows[0];
  if (!row) {
    return {
      exists: false,
      targetType,
      targetId,
      bundleId: null,
      snapshot: {},
      versionToken: absentVersionToken(targetType, targetId),
    };
  }
  const snapshot = cleanSnapshot(row.raw_data || {}, {
    id: row.context_id,
    label: row.label,
    summary: row.summary,
    domain: row.domain,
    status: row.status,
    metadata: row.metadata || {},
    sourceIds: row.source_ids || [],
    perspectiveLinks: row.perspective_links || [],
    aliases: row.aliases || [],
    externalIdentifiers: row.external_identifiers || [],
    fieldProvenance: row.field_provenance || [],
  });
  return {
    exists: true,
    targetType,
    targetId,
    bundleId: row.bundle_id,
    snapshot,
    versionToken: governanceVersionToken(snapshot),
  };
}

export function mergeGovernedPatch(
  baseSnapshot: Record<string, unknown>,
  proposedPatch: Record<string, unknown>,
  targetId: string,
): Record<string, unknown> {
  const patch = Object.fromEntries(
    Object.entries(proposedPatch).filter(
      ([key]) => !protectedPatchFields.has(key),
    ),
  );
  const merge = (
    base: Record<string, unknown>,
    change: Record<string, unknown>,
  ): Record<string, unknown> => {
    const output = { ...base };
    for (const [key, value] of Object.entries(change)) {
      if (value === null) {
        delete output[key];
      } else if (
        value
        && typeof value === "object"
        && !Array.isArray(value)
        && output[key]
        && typeof output[key] === "object"
        && !Array.isArray(output[key])
      ) {
        output[key] = merge(
          output[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        output[key] = value;
      }
    }
    return output;
  };
  return {
    ...merge(baseSnapshot, patch),
    id: targetId,
  };
}

function addIssue(
  collection: GovernanceValidationIssue[],
  code: string,
  message: string,
  options: {
    field?: string;
    severity?: "error" | "warning";
    risk?: "high" | "medium";
  } = {},
): void {
  collection.push({
    code,
    message,
    severity: options.severity || "error",
    ...(options.field ? { field: options.field } : {}),
    ...(options.risk ? { risk: options.risk } : {}),
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function perspectiveLinks(value: unknown): Array<Record<string, unknown>> {
  return recordArray(value);
}

async function requireSameBundleReference(
  client: PoolClient,
  value: unknown,
  bundleId: string,
): Promise<boolean> {
  if (!text(value)) return true;
  const result = await client.query(
    `SELECT 1 FROM context_records
     WHERE context_id = $1 AND bundle_id = $2
     UNION ALL
     SELECT 1 FROM sources
     WHERE source_id = $1 AND bundle_id = $2
     LIMIT 1`,
    [value, bundleId],
  );
  return Boolean(result.rowCount);
}

async function validateReferences(
  client: PoolClient,
  record: Record<string, unknown>,
  bundleId: string,
  issues: GovernanceValidationIssue[],
): Promise<void> {
  const referenceFields = [
    "subjectId",
    "authorEntityId",
    "accountId",
    "objectId",
    "claimId",
    "evidenceRecordId",
    "causeId",
    "effectId",
    "fromId",
    "toId",
    "perspectiveId",
    "sourceId",
  ];
  for (const field of referenceFields) {
    if (
      record[field] !== undefined
      && !(await requireSameBundleReference(client, record[field], bundleId))
    ) {
      addIssue(
        issues,
        "GOVERNANCE_REFERENCE_NOT_FOUND",
        `${field} must reference an existing record in the proposal dataset.`,
        { field },
      );
    }
  }
  for (const sourceId of stringArray(record.sourceIds)) {
    if (!(await requireSameBundleReference(client, sourceId, bundleId))) {
      addIssue(
        issues,
        "GOVERNANCE_SOURCE_NOT_FOUND",
        `Source ${sourceId} is not available in the proposal dataset.`,
        { field: "sourceIds" },
      );
    }
  }
  for (const link of perspectiveLinks(record.perspectiveLinks)) {
    if (
      !(await requireSameBundleReference(
        client,
        link.perspectiveId,
        bundleId,
      ))
    ) {
      addIssue(
        issues,
        "GOVERNANCE_PERSPECTIVE_NOT_FOUND",
        "Perspective attribution must reference an existing perspective in the dataset.",
        { field: "perspectiveLinks" },
      );
    }
  }

  for (const alias of recordArray(record.aliases)) {
    if (
      alias.temporalAssertionId !== undefined
      && !(await requireSameBundleReference(
        client,
        alias.temporalAssertionId,
        bundleId,
      ))
    ) {
      addIssue(
        issues,
        "GOVERNANCE_ALIAS_TEMPORAL_NOT_FOUND",
        "Alias validity must reference a temporal assertion in the proposal dataset.",
        { field: "aliases.temporalAssertionId" },
      );
    }
  }

  const validity = recordValue(record.validity);
  for (const link of recordArray(validity.temporalLinks)) {
    if (
      !(await requireSameBundleReference(
        client,
        link.temporalAssertionId,
        bundleId,
      ))
    ) {
      addIssue(
        issues,
        "GOVERNANCE_VALIDITY_TEMPORAL_NOT_FOUND",
        "Relationship validity must reference a temporal assertion in the proposal dataset.",
        { field: "validity.temporalLinks" },
      );
    }
  }
}

async function validateEvidenceSources(
  client: PoolClient,
  sourceIds: string[],
  bundleId: string,
  errors: GovernanceValidationIssue[],
  warnings: GovernanceValidationIssue[],
): Promise<void> {
  for (const sourceId of sourceIds) {
    const result = await client.query<{
      raw_data: Record<string, unknown>;
      source_class: string | null;
    }>(
      `SELECT raw_data, source_class FROM sources
       WHERE source_id = $1 AND bundle_id = $2`,
      [sourceId, bundleId],
    );
    const source = result.rows[0];
    if (!source) {
      addIssue(
        errors,
        "GOVERNANCE_SOURCE_NOT_FOUND",
        `Evidence source ${sourceId} does not exist in the proposal dataset.`,
        { field: "evidence" },
      );
      continue;
    }
    const raw = source.raw_data || {};
    if (
      !stringArray(raw.locatorsInspected).length
      && !text(raw.locator)
    ) {
      addIssue(
        errors,
        "SOURCE_LOCATOR_REQUIRED",
        `Evidence source ${sourceId} needs an inspected locator.`,
        { field: "evidence" },
      );
    }
    if (!text(raw.limitations)) {
      addIssue(
        warnings,
        "SOURCE_LIMITATION_MISSING",
        `Evidence source ${sourceId} has no stated limitation.`,
        { field: "evidence", severity: "warning", risk: "high" },
      );
    }
    if (/colonial/i.test(source.source_class || "")) {
      addIssue(
        warnings,
        "COLONIAL_SOURCE_DEPENDENCY",
        `Evidence includes colonial source ${sourceId}; reviewers should inspect source diversity and attribution.`,
        { field: "evidence", severity: "warning", risk: "medium" },
      );
    }
  }
}

export async function validateGovernedChange(
  client: PoolClient,
  input: {
    targetType: string;
    targetId: string;
    bundleId: string;
    baseSnapshot: Record<string, unknown>;
    proposedPatch: Record<string, unknown>;
    editorialRationale: string;
    evidenceSourceIds: string[];
    changeType: string;
  },
): Promise<GovernanceValidationResult> {
  const errors: GovernanceValidationIssue[] = [];
  const warnings: GovernanceValidationIssue[] = [];
  const record = mergeGovernedPatch(
    input.baseSnapshot,
    input.proposedPatch,
    input.targetId,
  );

  if (text(record.id) !== input.targetId) {
    addIssue(
      errors,
      "STABLE_ID_CHANGED",
      "A governed change cannot replace the target stable ID.",
      { field: "id" },
    );
  }

  if (input.targetType === "source") {
    if (!text(record.name)) {
      addIssue(errors, "SOURCE_NAME_REQUIRED", "A source name is required.", {
        field: "name",
      });
    }
    if (!text(record.type) && !text(record.sourceType)) {
      addIssue(
        errors,
        "SOURCE_CLASSIFICATION_REQUIRED",
        "A source type is required.",
        { field: "type" },
      );
    }
    if (!text(record.sourceClass)) {
      addIssue(
        errors,
        "SOURCE_CLASSIFICATION_REQUIRED",
        "A governed source requires sourceClass.",
        { field: "sourceClass" },
      );
    }
    if (!text(record.limitations)) {
      addIssue(
        errors,
        "SOURCE_LIMITATION_REQUIRED",
        "A governed source requires an explicit limitation.",
        { field: "limitations" },
      );
    }
    if (
      text(input.baseSnapshot.limitations)
      && !text(record.limitations)
      && !text(input.editorialRationale)
    ) {
      addIssue(
        errors,
        "SOURCE_LIMITATION_REMOVAL_UNJUSTIFIED",
        "Removing a source limitation requires an editorial rationale.",
        { field: "limitations" },
      );
    }
    if (
      text(record.accessStatus) === "accessed-and-inspected"
      && stringArray(record.locatorsInspected).length === 0
    ) {
      addIssue(
        errors,
        "FALSE_SOURCE_INSPECTION",
        "A source marked inspected must include at least one inspected locator.",
        { field: "locatorsInspected" },
      );
    }
    const url = text(record.url);
    if (url) {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        addIssue(
          errors,
          "UNSAFE_SOURCE_URL",
          "Source URLs must use HTTP or HTTPS.",
          { field: "url" },
        );
      }
    }
  } else {
    const schema = contextualSchemaByKind[input.targetType as ContextRecordKind];
    if (!schema) {
      addIssue(
        errors,
        "UNSUPPORTED_CONTEXT_TARGET",
        `Target type ${input.targetType} is not a governed contextual type.`,
      );
    } else {
      const {
        perspectiveLinks: _links,
        aliases,
        externalIdentifiers,
        fieldProvenance,
        identityLinks: _identityLinks,
        temporalContext: _temporalContext,
        proposedDateDetails: _proposedDateDetails,
        temporalLinks: _temporalLinks,
        validitySources: _validitySources,
        chronology: _chronology,
        ...schemaRecord
      } = record;
      const parsed = schema.safeParse(schemaRecord);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          addIssue(
            errors,
            "INVALID_CONTEXTUAL_STRUCTURE",
            issue.message,
            { field: issue.path.join(".") },
          );
        }
      }

      if (input.targetType === "entity") {
        for (const [index, alias] of recordArray(aliases).entries()) {
          const parsedAlias = contextEntityAliasSchema.safeParse(alias);
          if (!parsedAlias.success) {
            for (const issue of parsedAlias.error.issues) {
              addIssue(
                errors,
                "INVALID_CONTEXT_ALIAS",
                issue.message,
                { field: `aliases.${index}.${issue.path.join(".")}` },
              );
            }
          } else if (parsedAlias.data.entityId !== input.targetId) {
            addIssue(
              errors,
              "CONTEXT_ALIAS_ENTITY_MISMATCH",
              "A governed alias must remain owned by the target entity.",
              { field: `aliases.${index}.entityId` },
            );
          }
        }

        for (
          const [index, identifier]
          of recordArray(externalIdentifiers).entries()
        ) {
          const parsedIdentifier =
            contextExternalIdentifierSchema.safeParse(identifier);
          if (!parsedIdentifier.success) {
            for (const issue of parsedIdentifier.error.issues) {
              addIssue(
                errors,
                "INVALID_CONTEXT_IDENTIFIER",
                issue.message,
                {
                  field:
                    `externalIdentifiers.${index}.${issue.path.join(".")}`,
                },
              );
            }
          } else if (
            parsedIdentifier.data.entityId !== input.targetId
          ) {
            addIssue(
              errors,
              "CONTEXT_IDENTIFIER_ENTITY_MISMATCH",
              "A governed identifier must remain owned by the target entity.",
              {
                field: `externalIdentifiers.${index}.entityId`,
              },
            );
          }
        }
      }

      for (
        const [index, provenance]
        of recordArray(fieldProvenance).entries()
      ) {
        const parsedProvenance =
          contextFieldProvenanceSchema.safeParse(provenance);
        if (!parsedProvenance.success) {
          for (const issue of parsedProvenance.error.issues) {
            addIssue(
              errors,
              "INVALID_CONTEXT_FIELD_PROVENANCE",
              issue.message,
              {
                field:
                  `fieldProvenance.${index}.${issue.path.join(".")}`,
              },
            );
          }
        } else if (
          parsedProvenance.data.targetId !== input.targetId
        ) {
          addIssue(
            errors,
            "CONTEXT_PROVENANCE_TARGET_MISMATCH",
            "Field provenance must remain owned by the governed target.",
            {
              field: `fieldProvenance.${index}.targetId`,
            },
          );
        }
      }
    }
    await validateReferences(client, record, input.bundleId, errors);
  }

  const evidenceSourceIds = [
    ...new Set([
      ...input.evidenceSourceIds,
      ...stringArray(record.sourceIds),
      ...(text(record.sourceId) ? [text(record.sourceId)] : []),
      ...recordArray(record.aliases).flatMap(
        (alias) => stringArray(alias.sourceIds),
      ),
      ...recordArray(record.externalIdentifiers).flatMap(
        (identifier) => stringArray(identifier.sourceIds),
      ),
      ...recordArray(record.fieldProvenance)
        .map((provenance) => text(provenance.sourceId))
        .filter(Boolean),
      ...recordArray(record.proposedDates).flatMap(
        (proposal) => stringArray(proposal.sourceIds),
      ),
      ...stringArray(recordValue(record.validity).sourceIds),
      ...recordArray(
        recordValue(record.validity).temporalLinks,
      ).flatMap((link) => stringArray(link.sourceIds)),
    ]),
  ];
  await validateEvidenceSources(
    client,
    evidenceSourceIds,
    input.bundleId,
    errors,
    warnings,
  );

  if (input.targetType === "claim") {
    const existingEvidence = await client.query(
      `SELECT 1 FROM context_evidence evidence
       JOIN context_records record ON record.context_id = evidence.context_id
       WHERE evidence.claim_context_id = $1 AND record.bundle_id = $2
       LIMIT 1`,
      [input.targetId, input.bundleId],
    );
    if (!existingEvidence.rowCount && evidenceSourceIds.length === 0) {
      addIssue(
        errors,
        "CLAIM_EVIDENCE_REQUIRED",
        "A substantive historical claim must include evidence.",
        { field: "evidence" },
      );
    }
  }

  if (
    input.targetType === "temporal_assertion"
    && text(input.baseSnapshot.temporalKind) !== "exact"
    && text(record.temporalKind) === "exact"
  ) {
    addIssue(
      warnings,
      "TEMPORAL_CERTAINTY_INCREASED",
      "This change replaces uncertain chronology with an exact date.",
      { field: "temporalKind", severity: "warning", risk: "high" },
    );
    if (!text(input.editorialRationale) || evidenceSourceIds.length === 0) {
      addIssue(
        errors,
        "TEMPORAL_CERTAINTY_SUPPORT_REQUIRED",
        "An exact date replacing uncertainty requires rationale and evidence.",
        { field: "temporalKind" },
      );
    }
  }

  const uncertaintyFields = [
    "uncertainty",
    "startUncertainty",
    "endUncertainty",
    "dateNotes",
  ];
  if (
    uncertaintyFields.some(
      (field) =>
        text(input.baseSnapshot[field]) && !text(record[field]),
    )
  ) {
    addIssue(
      warnings,
      "UNCERTAINTY_REMOVED",
      "The proposal removes published uncertainty and needs heightened review.",
      { field: "uncertainty", severity: "warning", risk: "high" },
    );
    if (!text(input.editorialRationale)) {
      addIssue(
        errors,
        "UNCERTAINTY_REMOVAL_UNJUSTIFIED",
        "Removing uncertainty requires an editorial rationale.",
        { field: "uncertainty" },
      );
    }
  }

  if (
    input.targetType === "interpretation"
    && !text(record.sourceId)
    && perspectiveLinks(record.perspectiveLinks).length === 0
  ) {
    addIssue(
      errors,
      "INTERPRETATION_ATTRIBUTION_REQUIRED",
      "An interpretation requires source or perspective attribution.",
      { field: "sourceId" },
    );
  }

  if (
    input.targetType === "perspective"
    && stringArray(record.sourceIds).length === 0
  ) {
    addIssue(
      errors,
      "PERSPECTIVE_ATTRIBUTION_REQUIRED",
      "A perspective requires attributable source support.",
      { field: "sourceIds" },
    );
  }

  if (
    input.targetType === "causal_link"
    && !text(record.uncertainty)
    && !text(
      record.metadata
      && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>).qualification
        : "",
    )
  ) {
    addIssue(
      errors,
      "CAUSAL_QUALIFICATION_REQUIRED",
      "A causal relationship requires an explicit qualification or uncertainty statement.",
      { field: "uncertainty" },
    );
  }

  if (
    input.targetType === "cultural_memory"
    && !text(record.perspectiveId)
    && !text(record.sourceId)
    && stringArray(record.sourceIds).length === 0
  ) {
    addIssue(
      errors,
      "CULTURAL_MEMORY_ATTRIBUTION_REQUIRED",
      "Cultural memory requires a documenting perspective, institution, or source.",
      { field: "perspectiveId" },
    );
  }
  if (
    input.targetType === "cultural_memory"
    && text(input.baseSnapshot.memoryType)
    && text(input.baseSnapshot.memoryType) !== text(record.memoryType)
  ) {
    addIssue(
      warnings,
      "CULTURAL_MEMORY_RECLASSIFIED",
      "The proposal changes cultural-memory classification.",
      { field: "memoryType", severity: "warning", risk: "high" },
    );
  }

  if (input.targetType === "entity") {
    const proposedNames = [
      text(record.name),
      ...stringArray(record.alternateNames),
    ].filter(Boolean);
    for (const proposedName of proposedNames) {
      const duplicate = await client.query<{ context_id: string }>(
        `SELECT entity.context_id
         FROM context_entities entity
         JOIN context_records record ON record.context_id = entity.context_id
         WHERE record.bundle_id = $1
           AND entity.context_id <> $2
           AND (
             LOWER(entity.canonical_name) = LOWER($3)
             OR EXISTS (
               SELECT 1
               FROM UNNEST(entity.alternate_names) alias
               WHERE LOWER(alias) = LOWER($3)
             )
           )
         LIMIT 1`,
        [input.bundleId, input.targetId, proposedName],
      );
      if (duplicate.rowCount) {
        addIssue(
          errors,
          "DUPLICATE_ENTITY_NAME",
          `Name or alias "${proposedName}" already identifies another entity in this dataset.`,
          { field: "alternateNames" },
        );
      }
    }
  }

  if (
    input.changeType.includes("remove")
    || Object.values(input.proposedPatch).some((value) => value === null)
  ) {
    addIssue(
      warnings,
      "REMOVAL_REQUIRES_REVIEW",
      "This proposal removes published context; reviewers should inspect evidence and attribution impact.",
      { severity: "warning", risk: "medium" },
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checkedAt: new Date().toISOString(),
    disclaimer:
      "Automated validation checks structure, provenance, attribution, and process; it does not prove historical truth.",
  };
}

async function replaceContextLinks(
  client: PoolClient,
  bundleId: string,
  targetId: string,
  record: Record<string, unknown>,
): Promise<void> {
  await client.query(
    "DELETE FROM context_record_sources WHERE context_id = $1",
    [targetId],
  );
  const sources = new Set(stringArray(record.sourceIds));
  if (text(record.sourceId)) sources.add(text(record.sourceId));
  for (const sourceId of sources) {
    await client.query(
      `INSERT INTO context_record_sources(context_id, source_id, bundle_id)
       VALUES ($1, $2, $3)`,
      [targetId, sourceId, bundleId],
    );
  }

  await client.query(
    "DELETE FROM context_record_perspectives WHERE record_context_id = $1",
    [targetId],
  );
  for (const link of perspectiveLinks(record.perspectiveLinks)) {
    await client.query(
      `INSERT INTO context_record_perspectives(
         record_context_id, perspective_context_id, bundle_id, stance, notes
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        targetId,
        text(link.perspectiveId),
        bundleId,
        text(link.stance) || null,
        text(link.notes) || null,
      ],
    );
  }
}

async function replaceEntityRefinements(
  client: PoolClient,
  bundleId: string,
  targetId: string,
  record: Record<string, unknown>,
): Promise<void> {
  await client.query(
    "DELETE FROM context_entity_aliases WHERE entity_context_id = $1",
    [targetId],
  );
  await client.query(
    "DELETE FROM context_entity_identifiers WHERE entity_context_id = $1",
    [targetId],
  );

  for (const alias of recordArray(record.aliases)) {
    await client.query(
      `INSERT INTO context_entity_aliases(
         alias_id, entity_context_id, bundle_id, alias_text, alias_type,
         language_tag, script_identifier, notes, uncertainty, status,
         temporal_context_id, legacy_derived
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,FALSE)`,
      [
        alias.id,
        targetId,
        bundleId,
        alias.text,
        alias.aliasType,
        text(alias.languageTag) || null,
        text(alias.scriptIdentifier) || null,
        text(alias.notes) || null,
        text(alias.uncertainty) || null,
        text(alias.status) || null,
        text(alias.temporalAssertionId) || null,
      ],
    );
    for (const sourceId of new Set(stringArray(alias.sourceIds))) {
      await client.query(
        `INSERT INTO context_entity_alias_sources(
           alias_id, source_id, bundle_id
         ) VALUES ($1,$2,$3)`,
        [alias.id, sourceId, bundleId],
      );
    }
  }

  for (
    const identifier
    of recordArray(record.externalIdentifiers)
  ) {
    await client.query(
      `INSERT INTO context_entity_identifiers(
         identifier_id, entity_context_id, bundle_id, identifier_scheme,
         identifier_value, normalized_value, identifier_uri, label,
         status, notes, uncertainty
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        identifier.id,
        targetId,
        bundleId,
        identifier.scheme,
        identifier.value,
        text(identifier.normalizedValue) || null,
        text(identifier.uri) || null,
        text(identifier.label) || null,
        text(identifier.status) || null,
        text(identifier.notes) || null,
        text(identifier.uncertainty) || null,
      ],
    );
    for (
      const sourceId
      of new Set(stringArray(identifier.sourceIds))
    ) {
      await client.query(
        `INSERT INTO context_entity_identifier_sources(
           identifier_id, source_id, bundle_id
         ) VALUES ($1,$2,$3)`,
        [identifier.id, sourceId, bundleId],
      );
    }
  }
}

async function replaceTemporalProposals(
  client: PoolClient,
  bundleId: string,
  targetId: string,
  record: Record<string, unknown>,
): Promise<void> {
  await client.query(
    "DELETE FROM context_temporal_proposals WHERE temporal_context_id = $1",
    [targetId],
  );
  for (const proposal of recordArray(record.proposedDates)) {
    if (!text(proposal.id)) continue;
    const structuredDate =
      recordValue(proposal.structuredDate);
    const chronology = chronologyBoundsForStructuredDate(
      Object.keys(structuredDate).length
        ? structuredDate as unknown as StructuredHistoricalDate
        : undefined,
    );
    await client.query(
      `INSERT INTO context_temporal_proposals(
         proposal_id, temporal_context_id, bundle_id, proposed_date,
         date_label, structured_date, precision, uncertainty, note,
         chronology_start_year, chronology_end_year
       ) VALUES ($1,$2,$3,$4,$5,$6::JSONB,$7,$8,$9,$10,$11)`,
      [
        proposal.id,
        targetId,
        bundleId,
        text(proposal.date) || null,
        text(proposal.label) || null,
        Object.keys(structuredDate).length
          ? JSON.stringify(structuredDate)
          : null,
        text(proposal.precision) || null,
        text(proposal.uncertainty) || null,
        text(proposal.note) || null,
        chronology?.startYear ?? null,
        chronology?.endYear ?? null,
      ],
    );
    for (
      const sourceId
      of new Set(stringArray(proposal.sourceIds))
    ) {
      await client.query(
        `INSERT INTO context_temporal_proposal_sources(
           proposal_id, source_id, bundle_id
         ) VALUES ($1,$2,$3)`,
        [proposal.id, sourceId, bundleId],
      );
    }
  }
}

async function replaceRelationshipValidity(
  client: PoolClient,
  bundleId: string,
  targetId: string,
  record: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `DELETE FROM context_relationship_temporal_links
     WHERE relationship_context_id = $1`,
    [targetId],
  );
  await client.query(
    `DELETE FROM context_relationship_validity_sources
     WHERE relationship_context_id = $1`,
    [targetId],
  );

  const validity = recordValue(record.validity);
  for (const link of recordArray(validity.temporalLinks)) {
    await client.query(
      `INSERT INTO context_relationship_temporal_links(
         relationship_context_id, temporal_context_id, link_type, note
       ) VALUES ($1,$2,$3,$4)`,
      [
        targetId,
        link.temporalAssertionId,
        link.linkType,
        text(link.note) || null,
      ],
    );
    for (const sourceId of new Set(stringArray(link.sourceIds))) {
      await client.query(
        `INSERT INTO context_relationship_temporal_sources(
           relationship_context_id, temporal_context_id, link_type,
           source_id, bundle_id
         ) VALUES ($1,$2,$3,$4,$5)`,
        [
          targetId,
          link.temporalAssertionId,
          link.linkType,
          sourceId,
          bundleId,
        ],
      );
    }
  }
  for (const sourceId of new Set(stringArray(validity.sourceIds))) {
    await client.query(
      `INSERT INTO context_relationship_validity_sources(
         relationship_context_id, source_id, bundle_id
       ) VALUES ($1,$2,$3)`,
      [targetId, sourceId, bundleId],
    );
  }
}

async function replaceFieldProvenance(
  client: PoolClient,
  bundleId: string,
  targetId: string,
  record: Record<string, unknown>,
): Promise<void> {
  await client.query(
    "DELETE FROM context_field_provenance WHERE context_id = $1",
    [targetId],
  );
  for (const provenance of recordArray(record.fieldProvenance)) {
    await client.query(
      `INSERT INTO context_field_provenance(
         provenance_id, context_id, bundle_id, field_path,
         subrecord_type, subrecord_id, source_id, support_type, note,
         confidence, uncertainty
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        provenance.id,
        targetId,
        bundleId,
        provenance.fieldPath,
        text(provenance.subrecordType) || null,
        text(provenance.subrecordId) || null,
        provenance.sourceId,
        text(provenance.supportType) || null,
        text(provenance.note) || null,
        text(provenance.confidence) || null,
        text(provenance.uncertainty) || null,
      ],
    );
  }
}

async function upsertSubtype(
  client: PoolClient,
  kind: ContextRecordKind,
  record: Record<string, unknown>,
): Promise<void> {
  const id = text(record.id);
  switch (kind) {
    case "entity":
      await client.query(
        `INSERT INTO context_entities(context_id, entity_type, canonical_name, alternate_names, description)
         VALUES ($1,$2,$3,$4::TEXT[],$5)
         ON CONFLICT (context_id) DO UPDATE SET
           entity_type=EXCLUDED.entity_type,
           canonical_name=EXCLUDED.canonical_name,
           alternate_names=EXCLUDED.alternate_names,
           description=EXCLUDED.description`,
        [
          id,
          record.entityType,
          record.name,
          stringArray(record.alternateNames),
          text(record.description) || null,
        ],
      );
      break;
    case "temporal_assertion":
      {
        const structuredDate = recordValue(record.structuredDate);
        const chronology = chronologyBoundsForStructuredDate(
          Object.keys(structuredDate).length
            ? structuredDate as unknown as StructuredHistoricalDate
            : undefined,
        );
      await client.query(
        `INSERT INTO context_temporal_assertions(
           context_id, subject_context_id, temporal_kind, exact_date,
           start_date, end_date, before_date, after_date, proposed_dates,
           date_label, calendar_system, date_precision, start_uncertainty,
           end_uncertainty, date_notes, time_role, structured_date,
           chronology_start_year, chronology_end_year
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::JSONB,$10,$11,$12,$13,$14,$15,$16,$17::JSONB,$18,$19)
         ON CONFLICT (context_id) DO UPDATE SET
           subject_context_id=EXCLUDED.subject_context_id,
           temporal_kind=EXCLUDED.temporal_kind,
           exact_date=EXCLUDED.exact_date,
           start_date=EXCLUDED.start_date,
           end_date=EXCLUDED.end_date,
           before_date=EXCLUDED.before_date,
           after_date=EXCLUDED.after_date,
           proposed_dates=EXCLUDED.proposed_dates,
           date_label=EXCLUDED.date_label,
           calendar_system=EXCLUDED.calendar_system,
           date_precision=EXCLUDED.date_precision,
           start_uncertainty=EXCLUDED.start_uncertainty,
           end_uncertainty=EXCLUDED.end_uncertainty,
           date_notes=EXCLUDED.date_notes,
           time_role=EXCLUDED.time_role,
           structured_date=EXCLUDED.structured_date,
           chronology_start_year=EXCLUDED.chronology_start_year,
           chronology_end_year=EXCLUDED.chronology_end_year`,
        [
          id, record.subjectId, record.temporalKind,
          text(record.exactDate) || null, text(record.startDate) || null,
          text(record.endDate) || null, text(record.beforeDate) || null,
          text(record.afterDate) || null,
          JSON.stringify(Array.isArray(record.proposedDates) ? record.proposedDates : []),
          record.dateLabel, text(record.calendarSystem) || "unspecified",
          text(record.datePrecision) || "unknown",
          text(record.startUncertainty) || null,
          text(record.endUncertainty) || null,
          text(record.dateNotes) || null,
          text(record.timeRole) || "unspecified",
          Object.keys(structuredDate).length
            ? JSON.stringify(structuredDate)
            : null,
          chronology?.startYear ?? null,
          chronology?.endYear ?? null,
        ],
      );
      break;
      }
    case "account":
      await client.query(
        `INSERT INTO context_accounts(context_id, subject_context_id, author_context_id, source_id, account_type, content, publication_label)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (context_id) DO UPDATE SET
           subject_context_id=EXCLUDED.subject_context_id,
           author_context_id=EXCLUDED.author_context_id,
           source_id=EXCLUDED.source_id,
           account_type=EXCLUDED.account_type,
           content=EXCLUDED.content,
           publication_label=EXCLUDED.publication_label`,
        [
          id, record.subjectId, text(record.authorEntityId) || null,
          text(record.sourceId) || null, record.accountType, record.content,
          text(record.publicationLabel) || null,
        ],
      );
      break;
    case "claim":
      await client.query(
        `INSERT INTO context_claims(context_id, account_context_id, subject_context_id, object_context_id, claim_type, statement, confidence, uncertainty)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (context_id) DO UPDATE SET
           account_context_id=EXCLUDED.account_context_id,
           subject_context_id=EXCLUDED.subject_context_id,
           object_context_id=EXCLUDED.object_context_id,
           claim_type=EXCLUDED.claim_type,
           statement=EXCLUDED.statement,
           confidence=EXCLUDED.confidence,
           uncertainty=EXCLUDED.uncertainty`,
        [
          id, record.accountId, record.subjectId, text(record.objectId) || null,
          record.claimType, record.statement, text(record.confidence) || "unknown",
          text(record.uncertainty) || null,
        ],
      );
      break;
    case "evidence":
      await client.query(
        `INSERT INTO context_evidence(context_id, claim_context_id, evidence_type, source_id, account_context_id, evidence_context_id, explanation, strength, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (context_id) DO UPDATE SET
           claim_context_id=EXCLUDED.claim_context_id,
           evidence_type=EXCLUDED.evidence_type,
           source_id=EXCLUDED.source_id,
           account_context_id=EXCLUDED.account_context_id,
           evidence_context_id=EXCLUDED.evidence_context_id,
           explanation=EXCLUDED.explanation,
           strength=EXCLUDED.strength,
           confidence=EXCLUDED.confidence`,
        [
          id, record.claimId, record.evidenceType, text(record.sourceId) || null,
          text(record.accountId) || null, text(record.evidenceRecordId) || null,
          record.explanation, text(record.strength) || "unknown",
          text(record.confidence) || "unknown",
        ],
      );
      break;
    case "interpretation":
      await client.query(
        `INSERT INTO context_interpretations(context_id, subject_context_id, account_context_id, source_id, interpretation_text, confidence, uncertainty, published_conclusion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (context_id) DO UPDATE SET
           subject_context_id=EXCLUDED.subject_context_id,
           account_context_id=EXCLUDED.account_context_id,
           source_id=EXCLUDED.source_id,
           interpretation_text=EXCLUDED.interpretation_text,
           confidence=EXCLUDED.confidence,
           uncertainty=EXCLUDED.uncertainty,
           published_conclusion=EXCLUDED.published_conclusion`,
        [
          id, record.subjectId, text(record.accountId) || null,
          text(record.sourceId) || null, record.interpretation,
          text(record.confidence) || "unknown", text(record.uncertainty) || null,
          Boolean(record.publishedConclusion),
        ],
      );
      break;
    case "perspective":
      await client.query(
        `INSERT INTO context_perspectives(context_id, perspective_name, description)
         VALUES ($1,$2,$3)
         ON CONFLICT (context_id) DO UPDATE SET
           perspective_name=EXCLUDED.perspective_name,
           description=EXCLUDED.description`,
        [id, record.name, record.description],
      );
      break;
    case "causal_link":
      await client.query(
        `INSERT INTO context_causal_links(context_id, cause_context_id, effect_context_id, causal_kind, explanation, confidence, uncertainty)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (context_id) DO UPDATE SET
           cause_context_id=EXCLUDED.cause_context_id,
           effect_context_id=EXCLUDED.effect_context_id,
           causal_kind=EXCLUDED.causal_kind,
           explanation=EXCLUDED.explanation,
           confidence=EXCLUDED.confidence,
           uncertainty=EXCLUDED.uncertainty`,
        [
          id, record.causeId, record.effectId, record.causalKind,
          record.explanation, text(record.confidence) || "unknown",
          text(record.uncertainty) || null,
        ],
      );
      break;
    case "relationship":
      await client.query(
        `INSERT INTO context_relationships(context_id, from_context_id, to_context_id, relationship_type, relationship_role, explanation, confidence, uncertainty, review_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (context_id) DO UPDATE SET
           from_context_id=EXCLUDED.from_context_id,
           to_context_id=EXCLUDED.to_context_id,
           relationship_type=EXCLUDED.relationship_type,
           relationship_role=EXCLUDED.relationship_role,
           explanation=EXCLUDED.explanation,
           confidence=EXCLUDED.confidence,
           uncertainty=EXCLUDED.uncertainty,
           review_status=EXCLUDED.review_status`,
        [
          id, record.fromId, record.toId, record.relationshipType,
          text(record.relationshipRole) || null, text(record.explanation) || null,
          text(record.confidence) || "unknown", text(record.uncertainty) || null,
          text(record.reviewStatus) || null,
        ],
      );
      break;
    case "cultural_memory":
      await client.query(
        `INSERT INTO context_cultural_memories(context_id, subject_context_id, perspective_context_id, source_id, memory_type, narrative, period_label)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (context_id) DO UPDATE SET
           subject_context_id=EXCLUDED.subject_context_id,
           perspective_context_id=EXCLUDED.perspective_context_id,
           source_id=EXCLUDED.source_id,
           memory_type=EXCLUDED.memory_type,
           narrative=EXCLUDED.narrative,
           period_label=EXCLUDED.period_label`,
        [
          id, record.subjectId, text(record.perspectiveId) || null,
          text(record.sourceId) || null, record.memoryType, record.narrative,
          text(record.periodLabel) || null,
        ],
      );
      break;
  }
}

export async function materializeGovernedSnapshot(
  client: PoolClient,
  targetType: string,
  targetId: string,
  bundleId: string,
  snapshot: Record<string, unknown>,
): Promise<void> {
  if (targetType === "source") {
    const sourceType = text(snapshot.type) || text(snapshot.sourceType);
    const raw = {
      ...snapshot,
      id: targetId,
      governanceVisibility: "public",
    };
    await client.query(
      `INSERT INTO sources(
         source_id, bundle_id, name, source_type, domain, publisher,
         quality_tier, credibility_tier, verification_status, source_class,
         license, license_status, review_status, last_reviewed, url, notes,
         raw_data
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::JSONB)
       ON CONFLICT (source_id) DO UPDATE SET
         name=EXCLUDED.name,
         source_type=EXCLUDED.source_type,
         domain=EXCLUDED.domain,
         publisher=EXCLUDED.publisher,
         quality_tier=EXCLUDED.quality_tier,
         credibility_tier=EXCLUDED.credibility_tier,
         verification_status=EXCLUDED.verification_status,
         source_class=EXCLUDED.source_class,
         license=EXCLUDED.license,
         license_status=EXCLUDED.license_status,
         review_status=EXCLUDED.review_status,
         last_reviewed=EXCLUDED.last_reviewed,
         url=EXCLUDED.url,
         notes=EXCLUDED.notes,
         raw_data=EXCLUDED.raw_data,
         updated_at=CURRENT_TIMESTAMP`,
      [
        targetId, bundleId, snapshot.name, sourceType || null,
        text(snapshot.domain) || null, text(snapshot.publisher) || null,
        text(snapshot.qualityTier) || null, text(snapshot.credibilityTier) || null,
        text(snapshot.verificationStatus) || null, text(snapshot.sourceClass) || null,
        text(snapshot.license) || null, text(snapshot.licenseStatus) || null,
        text(snapshot.reviewStatus) || null, text(snapshot.lastReviewed) || null,
        text(snapshot.url) || null, text(snapshot.notes) || null,
        JSON.stringify(raw),
      ],
    );
    return;
  }

  const kind = targetType as ContextRecordKind;
  const { perspectiveLinks: _links, ...rawRecord } = snapshot;
  await client.query(
    `INSERT INTO context_records(
       context_id, bundle_id, record_kind, domain, label, summary, status,
       metadata, raw_data
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::JSONB,$9::JSONB)
     ON CONFLICT (context_id) DO UPDATE SET
       domain=EXCLUDED.domain,
       label=EXCLUDED.label,
       summary=EXCLUDED.summary,
       status=EXCLUDED.status,
       metadata=EXCLUDED.metadata,
       raw_data=EXCLUDED.raw_data,
       updated_at=CURRENT_TIMESTAMP`,
    [
      targetId, bundleId, kind, snapshot.domain || "unknown", snapshot.label,
      text(snapshot.summary) || null, text(snapshot.status) || "active",
      JSON.stringify(
        snapshot.metadata && typeof snapshot.metadata === "object"
          ? snapshot.metadata
          : {},
      ),
      JSON.stringify(rawRecord),
    ],
  );
  await upsertSubtype(client, kind, snapshot);
  await replaceContextLinks(client, bundleId, targetId, snapshot);
  if (kind === "entity") {
    await replaceEntityRefinements(
      client,
      bundleId,
      targetId,
      snapshot,
    );
  }
  if (kind === "temporal_assertion") {
    await replaceTemporalProposals(
      client,
      bundleId,
      targetId,
      snapshot,
    );
  }
  if (kind === "relationship") {
    await replaceRelationshipValidity(
      client,
      bundleId,
      targetId,
      snapshot,
    );
  }
  await replaceFieldProvenance(
    client,
    bundleId,
    targetId,
    snapshot,
  );
}

export async function hideNewGovernedTarget(
  client: PoolClient,
  targetType: string,
  targetId: string,
): Promise<void> {
  if (targetType === "source") {
    await client.query(
      `UPDATE sources
       SET raw_data = raw_data || '{"governanceVisibility":"withdrawn"}'::JSONB,
           updated_at = CURRENT_TIMESTAMP
       WHERE source_id = $1`,
      [targetId],
    );
    return;
  }
  await client.query(
    `UPDATE context_records
     SET status = 'governance-withdrawn',
         raw_data = raw_data || '{"status":"governance-withdrawn"}'::JSONB,
         updated_at = CURRENT_TIMESTAMP
     WHERE context_id = $1`,
    [targetId],
  );
}
