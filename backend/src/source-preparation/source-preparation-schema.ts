import { z } from "zod";

import {
  PREPARATION_SCHEMA_VERSION,
  contentUseModes,
  preparationStatuses,
  rightsClassifications,
  type SourcePreparationWorkspace,
} from "./source-preparation-types.js";

const nonEmpty = z.string().trim().min(1);
const approvalRecord = z.object({
  approvedBy: nonEmpty,
  approvedAt: z.iso.datetime({ offset: true }),
  note: nonEmpty.optional(),
}).strict();
const acceptedObject = z.record(z.string(), z.unknown()).refine(
  (value) => typeof value.id === "string" && value.id.trim().length > 0,
  "Accepted objects require a nonempty id.",
);
const preparedItem = z.object({
  preparationStatus: z.enum(preparationStatuses),
  reviewerNotes: nonEmpty.optional(),
  unresolvedQuestions: z.array(nonEmpty).optional(),
  omissionReason: nonEmpty.optional(),
  approvalRecord: approvalRecord.optional(),
  object: acceptedObject,
}).strict().superRefine((value, context) => {
  if (value.preparationStatus === "omitted" && !value.omissionReason) {
    context.addIssue({
      code: "custom",
      path: ["omissionReason"],
      message: "Omitted objects require a nonempty omission reason.",
    });
  }
  if (value.preparationStatus === "approved" && !value.approvalRecord) {
    context.addIssue({
      code: "custom",
      path: ["approvalRecord"],
      message: "Approved objects require an approval record.",
    });
  }
});
const preparedSource = preparedItem.extend({
  rightsReview: z.object({
    classification: z.enum(rightsClassifications),
    basis: nonEmpty.optional(),
    licenseIdentifier: nonEmpty.optional(),
    permissionBasis: nonEmpty.optional(),
    attributionRequirements: nonEmpty.optional(),
  }).strict(),
  contentUse: z.object({
    mode: z.enum(contentUseModes),
    containsCopiedExcerpt: z.boolean(),
  }).strict(),
  sourceIdentityReview: z.object({
    identityKind: z.enum([
      "original_work",
      "archival_object",
      "later_transcription",
      "modernized_edition",
      "scholarly_edition",
      "compilation",
      "catalog_record",
      "digital_surrogate",
      "museum_interpretation",
      "tribal_institutional_account",
      "government_institutional_account",
      "scholarly_analysis",
    ]),
    originalWorkId: nonEmpty.optional(),
    editionId: nonEmpty.optional(),
    transcriptionId: nonEmpty.optional(),
    compilationId: nonEmpty.optional(),
    catalogRecordId: nonEmpty.optional(),
    digitalObjectId: nonEmpty.optional(),
    limitations: nonEmpty.optional(),
  }).strict(),
});

export const sourcePreparationWorkspaceSchema = z.object({
  schemaVersion: z.literal(PREPARATION_SCHEMA_VERSION),
  workspaceId: nonEmpty,
  title: nonEmpty,
  description: nonEmpty,
  domain: nonEmpty,
  preparationStatus: z.enum(preparationStatuses),
  sourceSet: z.array(preparedSource),
  accounts: z.array(preparedItem),
  records: z.array(preparedItem),
  claims: z.array(preparedItem),
  historicalNames: z.array(preparedItem),
  dateExpressions: z.array(preparedItem),
  relationships: z.array(preparedItem),
  sourceLocators: z.array(preparedItem),
  evidence: z.array(preparedItem),
  evidenceLinks: z.array(preparedItem),
  claimRelations: z.array(preparedItem),
  fieldProvenance: z.array(preparedItem),
  reviewMetadata: z.object({
    bundleId: nonEmpty,
    version: nonEmpty,
    createdAt: z.iso.datetime({ offset: true }),
    createdBy: nonEmpty,
    description: nonEmpty,
  }).strict(),
  approvals: z.object({
    approved: z.boolean(),
    approvedBy: nonEmpty.optional(),
    approvedAt: z.iso.datetime({ offset: true }).optional(),
    note: nonEmpty.optional(),
  }).strict(),
}).strict();

export function parseSourcePreparationWorkspace(
  input: unknown,
): SourcePreparationWorkspace {
  return sourcePreparationWorkspaceSchema.parse(
    input,
  ) as SourcePreparationWorkspace;
}

export function findForbiddenPreparationFields(
  value: unknown,
  path = "$",
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findForbiddenPreparationFields(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const forbidden = new Set([
    "truthScore",
    "truth_score",
    "reliabilityPercentage",
    "reliability_percentage",
    "combinedConfidence",
    "combined_confidence",
    "automaticConflictResolution",
    "machineAuthoredInterpretation",
    "aiConclusion",
  ]);
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nested]) => [
      ...(forbidden.has(key) ? [`${path}.${key}`] : []),
      ...findForbiddenPreparationFields(nested, `${path}.${key}`),
    ],
  );
}
