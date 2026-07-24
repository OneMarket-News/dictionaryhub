import { z } from "zod";

import {
  contextEntityTypes,
  temporalKinds,
} from "../contextual-types.js";

const nonEmptyString = z.string().trim().min(1);
const isoDate = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must use YYYY-MM-DD when an ISO date is supplied.",
  )
  .refine((value) => {
    if (value.startsWith("0000-")) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime())
      && parsed.toISOString().slice(0, 10) === value;
  }, "Date must be a real proleptic-Gregorian calendar date.");
const metadataSchema = z.record(z.string(), z.unknown());

const contextRecordBaseShape = {
  id: nonEmptyString,
  label: nonEmptyString,
  summary: nonEmptyString.optional(),
  domain: nonEmptyString.optional(),
  status: nonEmptyString.optional(),
  sourceIds: z.array(nonEmptyString).optional(),
  metadata: metadataSchema.optional(),
};

export const contextEntitySchema = z
  .object({
    ...contextRecordBaseShape,
    entityType: z.enum(contextEntityTypes),
    name: nonEmptyString,
    alternateNames: z.array(nonEmptyString).optional(),
    description: nonEmptyString.optional(),
  })
  .strict();

export const proposedContextDateSchema = z
  .object({
    date: isoDate.optional(),
    label: nonEmptyString.optional(),
    precision: nonEmptyString.optional(),
    uncertainty: nonEmptyString.optional(),
  })
  .strict()
  .refine(
    (value) => value.date !== undefined || value.label !== undefined,
    "A proposed date must include a date or human-readable label.",
  );

export const temporalAssertionSchema = z
  .object({
    ...contextRecordBaseShape,
    subjectId: nonEmptyString,
    temporalKind: z.enum(temporalKinds),
    exactDate: isoDate.optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    beforeDate: isoDate.optional(),
    afterDate: isoDate.optional(),
    proposedDates: z.array(proposedContextDateSchema).optional(),
    dateLabel: nonEmptyString,
    calendarSystem: nonEmptyString.optional(),
    datePrecision: nonEmptyString.optional(),
    startUncertainty: nonEmptyString.optional(),
    endUncertainty: nonEmptyString.optional(),
    dateNotes: nonEmptyString.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const addRequired = (field: string, message: string) => {
      context.addIssue({
        code: "custom",
        path: [field],
        message,
      });
    };

    if (value.temporalKind === "exact" && !value.exactDate) {
      addRequired("exactDate", "Exact temporal assertions require exactDate.");
    }

    if (
      value.temporalKind === "approximate"
      && !value.exactDate
      && !value.startDate
      && !value.endDate
    ) {
      addRequired(
        "exactDate",
        "Approximate temporal assertions require a nominal date or uncertain range.",
      );
    }

    if (
      value.temporalKind === "range"
      && (!value.startDate || !value.endDate)
    ) {
      addRequired(
        "startDate",
        "Date ranges require both startDate and endDate.",
      );
    }

    if (
      value.startDate
      && value.endDate
      && value.startDate > value.endDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "endDate must not precede startDate.",
      });
    }

    if (value.temporalKind === "before" && !value.beforeDate) {
      addRequired("beforeDate", "Before-date assertions require beforeDate.");
    }

    if (value.temporalKind === "after" && !value.afterDate) {
      addRequired("afterDate", "After-date assertions require afterDate.");
    }

    if (
      (value.temporalKind === "disputed"
        || value.temporalKind === "multiple_proposed")
      && (value.proposedDates?.length ?? 0) < 2
    ) {
      addRequired(
        "proposedDates",
        "Disputed and multiple-proposed dates require at least two proposals.",
      );
    }
  });

export const historicalAccountSchema = z
  .object({
    ...contextRecordBaseShape,
    subjectId: nonEmptyString,
    authorEntityId: nonEmptyString.optional(),
    sourceId: nonEmptyString.optional(),
    accountType: nonEmptyString,
    content: nonEmptyString,
    publicationLabel: nonEmptyString.optional(),
  })
  .strict();

export const contextClaimSchema = z
  .object({
    ...contextRecordBaseShape,
    accountId: nonEmptyString,
    subjectId: nonEmptyString,
    objectId: nonEmptyString.optional(),
    claimType: nonEmptyString,
    statement: nonEmptyString,
    confidence: nonEmptyString.optional(),
    uncertainty: nonEmptyString.optional(),
  })
  .strict();

export const contextEvidenceSchema = z
  .object({
    ...contextRecordBaseShape,
    claimId: nonEmptyString,
    evidenceType: z.enum(["evidence", "counterevidence"]),
    sourceId: nonEmptyString.optional(),
    accountId: nonEmptyString.optional(),
    evidenceRecordId: nonEmptyString.optional(),
    explanation: nonEmptyString,
    strength: nonEmptyString.optional(),
    confidence: nonEmptyString.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.sourceId !== undefined
      || value.accountId !== undefined
      || value.evidenceRecordId !== undefined,
    {
      message:
        "Evidence requires sourceId, accountId, or evidenceRecordId.",
      path: ["sourceId"],
    },
  );

export const contextInterpretationSchema = z
  .object({
    ...contextRecordBaseShape,
    subjectId: nonEmptyString,
    accountId: nonEmptyString.optional(),
    sourceId: nonEmptyString.optional(),
    interpretation: nonEmptyString,
    confidence: nonEmptyString.optional(),
    uncertainty: nonEmptyString.optional(),
    publishedConclusion: z.boolean().optional(),
  })
  .strict();

export const contextPerspectiveSchema = z
  .object({
    ...contextRecordBaseShape,
    name: nonEmptyString,
    description: nonEmptyString,
  })
  .strict();

export const contextRecordPerspectiveSchema = z
  .object({
    recordId: nonEmptyString,
    perspectiveId: nonEmptyString,
    stance: nonEmptyString.optional(),
    notes: nonEmptyString.optional(),
  })
  .strict();

export const contextCausalLinkSchema = z
  .object({
    ...contextRecordBaseShape,
    causeId: nonEmptyString,
    effectId: nonEmptyString,
    causalKind: z.enum(["cause", "consequence"]),
    explanation: nonEmptyString,
    confidence: nonEmptyString.optional(),
    uncertainty: nonEmptyString.optional(),
  })
  .strict()
  .refine((value) => value.causeId !== value.effectId, {
    message: "A causal link must connect distinct records.",
    path: ["effectId"],
  });

export const contextRelationshipSchema = z
  .object({
    ...contextRecordBaseShape,
    fromId: nonEmptyString,
    toId: nonEmptyString,
    relationshipType: nonEmptyString,
    relationshipRole: nonEmptyString.optional(),
    explanation: nonEmptyString.optional(),
    confidence: nonEmptyString.optional(),
    uncertainty: nonEmptyString.optional(),
  })
  .strict()
  .refine((value) => value.fromId !== value.toId, {
    message: "A contextual relationship must connect distinct records.",
    path: ["toId"],
  });

export const contextCulturalMemorySchema = z
  .object({
    ...contextRecordBaseShape,
    subjectId: nonEmptyString,
    perspectiveId: nonEmptyString.optional(),
    sourceId: nonEmptyString.optional(),
    memoryType: nonEmptyString,
    narrative: nonEmptyString,
    periodLabel: nonEmptyString.optional(),
  })
  .strict();

export const contextualBundleSchema = z
  .object({
    entities: z.array(contextEntitySchema).optional(),
    temporalAssertions: z.array(temporalAssertionSchema).optional(),
    accounts: z.array(historicalAccountSchema).optional(),
    claims: z.array(contextClaimSchema).optional(),
    evidence: z.array(contextEvidenceSchema).optional(),
    interpretations: z.array(contextInterpretationSchema).optional(),
    perspectives: z.array(contextPerspectiveSchema).optional(),
    recordPerspectives: z.array(contextRecordPerspectiveSchema).optional(),
    causalLinks: z.array(contextCausalLinkSchema).optional(),
    relationships: z.array(contextRelationshipSchema).optional(),
    culturalMemories: z.array(contextCulturalMemorySchema).optional(),
  })
  .strict();

type ParsedContextualBundle =
  z.infer<typeof contextualBundleSchema>;

export interface ContextualValidationIssue {
  code: string;
  objectType: string;
  objectId: string;
  field?: string;
  message: string;
}

function contextualRecordCollections(context: ParsedContextualBundle) {
  return [
    ["entity", context.entities ?? []],
    ["temporalAssertion", context.temporalAssertions ?? []],
    ["account", context.accounts ?? []],
    ["claim", context.claims ?? []],
    ["evidence", context.evidence ?? []],
    ["interpretation", context.interpretations ?? []],
    ["perspective", context.perspectives ?? []],
    ["causalLink", context.causalLinks ?? []],
    ["relationship", context.relationships ?? []],
    ["culturalMemory", context.culturalMemories ?? []],
  ] as const;
}

export function countContextualRecords(
  input: unknown,
): number {
  const parsed = contextualBundleSchema.safeParse(input);

  if (!parsed.success) {
    return 0;
  }

  return contextualRecordCollections(parsed.data).reduce(
    (total, [, records]) => total + records.length,
    0,
  );
}

export function validateContextualBundle(
  input: unknown,
  sourceIds: Set<string>,
): ContextualValidationIssue[] {
  const parsed = contextualBundleSchema.safeParse(input);

  if (!parsed.success) {
    return parsed.error.issues.map((validationIssue) => ({
      code: "INVALID_CONTEXTUAL_STRUCTURE",
      objectType: "context",
      objectId:
        typeof validationIssue.path[1] === "number"
          ? String(validationIssue.path[1])
          : "unknown",
      ...(validationIssue.path.length > 0
        ? { field: validationIssue.path.join(".") }
        : {}),
      message: validationIssue.message,
    }));
  }

  const context = parsed.data;
  const issues: ContextualValidationIssue[] = [];
  const collections = contextualRecordCollections(context);
  const allIds = new Set<string>();
  const entityIds = new Set(
    (context.entities ?? []).map((record) => record.id),
  );
  const perspectiveIds = new Set(
    (context.perspectives ?? []).map((record) => record.id),
  );
  const accountIds = new Set(
    (context.accounts ?? []).map((record) => record.id),
  );
  const claimIds = new Set(
    (context.claims ?? []).map((record) => record.id),
  );

  for (const [objectType, records] of collections) {
    for (const record of records) {
      if (allIds.has(record.id)) {
        issues.push({
          code: "DUPLICATE_CONTEXT_ID",
          objectType,
          objectId: record.id,
          field: "id",
          message: `Contextual record ID ${record.id} is duplicated.`,
        });
      }
      allIds.add(record.id);
    }
  }

  const requireReference = (
    objectType: string,
    objectId: string,
    field: string,
    value: string | undefined,
    availableIds: Set<string>,
    code: string,
  ) => {
    if (value !== undefined && !availableIds.has(value)) {
      issues.push({
        code,
        objectType,
        objectId,
        field,
        message: `${field} references missing contextual record ${value}.`,
      });
    }
  };

  const requireSource = (
    objectType: string,
    objectId: string,
    field: string,
    sourceId: string | undefined,
  ) => {
    if (sourceId !== undefined && !sourceIds.has(sourceId)) {
      issues.push({
        code: "CONTEXT_SOURCE_NOT_FOUND",
        objectType,
        objectId,
        field,
        message: `${field} references missing bundle source ${sourceId}.`,
      });
    }
  };

  for (const [objectType, records] of collections) {
    for (const record of records) {
      for (const sourceId of record.sourceIds ?? []) {
        requireSource(objectType, record.id, "sourceIds", sourceId);
      }
    }
  }

  for (const record of context.temporalAssertions ?? []) {
    requireReference(
      "temporalAssertion",
      record.id,
      "subjectId",
      record.subjectId,
      allIds,
      "CONTEXT_SUBJECT_NOT_FOUND",
    );
  }

  for (const record of context.accounts ?? []) {
    requireReference(
      "account",
      record.id,
      "subjectId",
      record.subjectId,
      allIds,
      "CONTEXT_SUBJECT_NOT_FOUND",
    );
    requireReference(
      "account",
      record.id,
      "authorEntityId",
      record.authorEntityId,
      entityIds,
      "CONTEXT_ENTITY_NOT_FOUND",
    );
    requireSource("account", record.id, "sourceId", record.sourceId);
  }

  for (const record of context.claims ?? []) {
    requireReference(
      "claim",
      record.id,
      "accountId",
      record.accountId,
      accountIds,
      "CONTEXT_ACCOUNT_NOT_FOUND",
    );
    requireReference(
      "claim",
      record.id,
      "subjectId",
      record.subjectId,
      allIds,
      "CONTEXT_SUBJECT_NOT_FOUND",
    );
    requireReference(
      "claim",
      record.id,
      "objectId",
      record.objectId,
      allIds,
      "CONTEXT_OBJECT_NOT_FOUND",
    );
  }

  for (const record of context.evidence ?? []) {
    requireReference(
      "evidence",
      record.id,
      "claimId",
      record.claimId,
      claimIds,
      "CONTEXT_CLAIM_NOT_FOUND",
    );
    requireReference(
      "evidence",
      record.id,
      "accountId",
      record.accountId,
      accountIds,
      "CONTEXT_ACCOUNT_NOT_FOUND",
    );
    requireReference(
      "evidence",
      record.id,
      "evidenceRecordId",
      record.evidenceRecordId,
      allIds,
      "CONTEXT_EVIDENCE_RECORD_NOT_FOUND",
    );
    requireSource("evidence", record.id, "sourceId", record.sourceId);
  }

  for (const record of context.interpretations ?? []) {
    requireReference(
      "interpretation",
      record.id,
      "subjectId",
      record.subjectId,
      allIds,
      "CONTEXT_SUBJECT_NOT_FOUND",
    );
    requireReference(
      "interpretation",
      record.id,
      "accountId",
      record.accountId,
      accountIds,
      "CONTEXT_ACCOUNT_NOT_FOUND",
    );
    requireSource("interpretation", record.id, "sourceId", record.sourceId);
  }

  for (const record of context.causalLinks ?? []) {
    requireReference(
      "causalLink",
      record.id,
      "causeId",
      record.causeId,
      allIds,
      "CONTEXT_CAUSE_NOT_FOUND",
    );
    requireReference(
      "causalLink",
      record.id,
      "effectId",
      record.effectId,
      allIds,
      "CONTEXT_EFFECT_NOT_FOUND",
    );
  }

  for (const record of context.relationships ?? []) {
    requireReference(
      "relationship",
      record.id,
      "fromId",
      record.fromId,
      allIds,
      "CONTEXT_RELATIONSHIP_ENDPOINT_NOT_FOUND",
    );
    requireReference(
      "relationship",
      record.id,
      "toId",
      record.toId,
      allIds,
      "CONTEXT_RELATIONSHIP_ENDPOINT_NOT_FOUND",
    );
  }

  for (const record of context.culturalMemories ?? []) {
    requireReference(
      "culturalMemory",
      record.id,
      "subjectId",
      record.subjectId,
      allIds,
      "CONTEXT_SUBJECT_NOT_FOUND",
    );
    requireReference(
      "culturalMemory",
      record.id,
      "perspectiveId",
      record.perspectiveId,
      perspectiveIds,
      "CONTEXT_PERSPECTIVE_NOT_FOUND",
    );
    requireSource("culturalMemory", record.id, "sourceId", record.sourceId);
  }

  for (const link of context.recordPerspectives ?? []) {
    requireReference(
      "recordPerspective",
      `${link.recordId}:${link.perspectiveId}`,
      "recordId",
      link.recordId,
      allIds,
      "CONTEXT_RECORD_NOT_FOUND",
    );
    requireReference(
      "recordPerspective",
      `${link.recordId}:${link.perspectiveId}`,
      "perspectiveId",
      link.perspectiveId,
      perspectiveIds,
      "CONTEXT_PERSPECTIVE_NOT_FOUND",
    );
  }

  return issues;
}
