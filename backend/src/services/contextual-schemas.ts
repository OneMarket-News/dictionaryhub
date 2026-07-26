import { z } from "zod";

import {
  claimAttributionRoles,
  claimRelationTypes,
  contextAliasTypes,
  contextEntityTypes,
  contextualVersionOrigins,
  contextualVersionStatuses,
  evidenceSupportRoles,
  historicalDateEras,
  historicalDatePrecisions,
  identityRelationTypes,
  relationshipTemporalLinkTypes,
  sourceLocatorTypes,
  temporalKinds,
  temporalRoles,
  type ContextClaimVersion,
  type ContextEvidenceVersion,
} from "../contextual-types.js";
import {
  chronologyBoundsForStructuredDate,
} from "./contextual-time.js";
import {
  claimVersionContentHash,
  evidenceVersionContentHash,
} from "./context-version-store.js";

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
const sourceIdsSchema = z.array(nonEmptyString);
const safeFieldPath = z
  .string()
  .min(1)
  .max(256)
  .regex(
    /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9][A-Za-z0-9_-]*){0,4}$/,
    "fieldPath must be a bounded dotted data path.",
  );
const aliasTypeSchema = z.union([
  z.enum(contextAliasTypes),
  z.string().regex(/^custom:[a-z0-9][a-z0-9_-]{0,63}$/),
]);
const controlledExtension = (
  values: readonly [string, ...string[]],
) => z.union([
  z.enum(values),
  z.string().regex(/^custom:[a-z0-9][a-z0-9_-]{0,63}$/),
]);
const claimAttributionRoleSchema = controlledExtension(
  claimAttributionRoles,
);
const claimRelationTypeSchema = controlledExtension(
  claimRelationTypes,
);
const evidenceSupportRoleSchema = controlledExtension(
  evidenceSupportRoles,
);
const locatorTypeSchema = controlledExtension(sourceLocatorTypes);
const versionOriginSchema = controlledExtension(
  contextualVersionOrigins,
);
const contentHashSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/);
const boundedLocatorDataSchema = z
  .record(
    z.string().min(1).max(64),
    z.union([
      z.string().max(1024),
      z.number().finite(),
      z.boolean(),
    ]),
  )
  .refine(
    (value) => Object.keys(value).length <= 24,
    "Locator data may contain at most 24 fields.",
  );
const boundedSnapshotSchema = z.record(
  z.string().min(1).max(64),
  z.union([
    z.string().max(2048),
    z.number().finite(),
    z.boolean(),
    z.null(),
  ]),
);

export const structuredHistoricalDateSchema = z
  .object({
    originalLabel: nonEmptyString,
    precision: z.enum(historicalDatePrecisions),
    era: z.enum(historicalDateEras).optional(),
    year: z.number().int().min(1).max(999999).optional(),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
    namedPeriod: nonEmptyString.optional(),
    calendarSystem: nonEmptyString.optional(),
    conversionStatus: z.enum(["not_required", "unconverted"]).optional(),
    approximate: z.boolean().optional(),
    uncertainty: nonEmptyString.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const numericPrecision = new Set([
      "day",
      "month",
      "year",
      "decade",
      "century",
    ]);

    if (numericPrecision.has(value.precision)) {
      if (value.year === undefined) {
        context.addIssue({
          code: "custom",
          path: ["year"],
          message: `${value.precision} precision requires a stated year.`,
        });
      }
      if (value.era === undefined) {
        context.addIssue({
          code: "custom",
          path: ["era"],
          message: `${value.precision} precision requires BCE or CE.`,
        });
      }
    }

    if (
      value.precision === "named_period"
      && value.namedPeriod === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["namedPeriod"],
        message: "named_period precision requires namedPeriod.",
      });
    }

    if (
      value.precision !== "named_period"
      && value.namedPeriod !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["namedPeriod"],
        message: "namedPeriod is only valid with named_period precision.",
      });
    }

    if (
      (value.era !== undefined && value.year === undefined)
      || (value.year !== undefined && value.era === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: [value.year === undefined ? "year" : "era"],
        message: "A structured year and era must be supplied together.",
      });
    }

    if (
      value.precision === "month"
      && value.month === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["month"],
        message: "month precision requires month.",
      });
    }

    if (
      value.precision === "day"
      && (value.month === undefined || value.day === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: [value.month === undefined ? "month" : "day"],
        message: "day precision requires month and day.",
      });
    }

    if (
      value.day !== undefined
      && value.month === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["month"],
        message: "A structured day requires a month.",
      });
    }

    if (
      value.precision !== "day"
      && value.day !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["day"],
        message: "day is only valid with day precision.",
      });
    }

    if (
      !["day", "month"].includes(value.precision)
      && value.month !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["month"],
        message: "month is only valid with day or month precision.",
      });
    }

    if (
      value.day !== undefined
      && value.month !== undefined
      && [4, 6, 9, 11].includes(value.month)
      && value.day > 30
    ) {
      context.addIssue({
        code: "custom",
        path: ["day"],
        message: "The supplied month cannot contain 31 days.",
      });
    }
  });

const contextRecordBaseShape = {
  id: nonEmptyString,
  label: nonEmptyString,
  summary: nonEmptyString.optional(),
  domain: nonEmptyString.optional(),
  status: nonEmptyString.optional(),
  sourceIds: sourceIdsSchema.optional(),
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

export const contextEntityAliasSchema = z
  .object({
    id: nonEmptyString,
    entityId: nonEmptyString,
    text: nonEmptyString,
    aliasType: aliasTypeSchema,
    languageTag: z.string().trim().min(1).max(64).optional(),
    scriptIdentifier: z.string().trim().min(1).max(64).optional(),
    notes: nonEmptyString.optional(),
    uncertainty: nonEmptyString.optional(),
    status: nonEmptyString.optional(),
    temporalAssertionId: nonEmptyString.optional(),
    sourceIds: sourceIdsSchema.optional(),
  })
  .strict();

export const contextExternalIdentifierSchema = z
  .object({
    id: nonEmptyString,
    entityId: nonEmptyString,
    scheme: z.string().trim().min(1).max(128),
    value: z.string().min(1).max(512),
    normalizedValue: z.string().min(1).max(512).optional(),
    uri: z.string().url().max(2048).optional(),
    label: nonEmptyString.optional(),
    status: nonEmptyString.optional(),
    notes: nonEmptyString.optional(),
    uncertainty: nonEmptyString.optional(),
    sourceIds: sourceIdsSchema.optional(),
  })
  .strict();

export const proposedContextDateSchema = z
  .object({
    id: nonEmptyString.optional(),
    date: isoDate.optional(),
    label: nonEmptyString.optional(),
    structuredDate: structuredHistoricalDateSchema.optional(),
    precision: nonEmptyString.optional(),
    uncertainty: nonEmptyString.optional(),
    sourceIds: sourceIdsSchema.optional(),
    note: nonEmptyString.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.date !== undefined
      || value.label !== undefined
      || value.structuredDate !== undefined,
    "A proposed date must include a date, human-readable label, or structured date.",
  )
  .refine(
    (value) =>
      (value.sourceIds?.length ?? 0) === 0
      || value.id !== undefined,
    {
      message:
        "A proposed date with source support requires a stable proposal ID.",
      path: ["id"],
    },
  );

export const temporalAssertionSchema = z
  .object({
    ...contextRecordBaseShape,
    subjectId: nonEmptyString,
    temporalKind: z.enum(temporalKinds),
    timeRole: z.enum(temporalRoles).optional(),
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
    structuredDate: structuredHistoricalDateSchema.optional(),
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
      && !value.structuredDate
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

export const contextClaimAttributionSchema = z
  .object({
    id: nonEmptyString,
    claimId: nonEmptyString,
    actorEntityId: nonEmptyString.optional(),
    accountId: nonEmptyString.optional(),
    temporalAssertionId: nonEmptyString.optional(),
    attributionRole: claimAttributionRoleSchema,
    sourceIds: z.array(nonEmptyString).max(100).optional(),
    note: z.string().trim().min(1).max(4000).optional(),
    confidence: z.string().trim().min(1).max(256).optional(),
    uncertainty: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.actorEntityId !== undefined
      || value.accountId !== undefined,
    {
      message:
        "A claim attribution requires actorEntityId or accountId.",
      path: ["actorEntityId"],
    },
  );

export const contextClaimRelationSchema = z
  .object({
    id: nonEmptyString,
    fromClaimId: nonEmptyString,
    toClaimId: nonEmptyString,
    relationType: claimRelationTypeSchema,
    explanation: z.string().trim().min(1).max(4000).optional(),
    sourceIds: z.array(nonEmptyString).max(100).optional(),
    confidence: z.string().trim().min(1).max(256).optional(),
    uncertainty: z.string().trim().min(1).max(2000).optional(),
    reviewStatus: z.string().trim().min(1).max(256).optional(),
    temporalAssertionId: nonEmptyString.optional(),
  })
  .strict()
  .refine((value) => value.fromClaimId !== value.toClaimId, {
    message: "A claim relationship must connect distinct claims.",
    path: ["toClaimId"],
  });

export const contextClaimVersionSchema = z
  .object({
    id: nonEmptyString,
    claimId: nonEmptyString,
    ordinal: z.number().int().positive().optional(),
    priorVersionId: nonEmptyString.optional(),
    statement: nonEmptyString,
    claimType: nonEmptyString,
    subjectId: nonEmptyString,
    objectId: nonEmptyString.optional(),
    confidence: z.string().trim().min(1).max(256).optional(),
    uncertainty: z.string().trim().min(1).max(2000).optional(),
    status: z.enum(contextualVersionStatuses).optional(),
    changeType: z.string().trim().min(1).max(256),
    changeReason: z.string().trim().min(1).max(4000).optional(),
    attributionSnapshot: z
      .array(boundedSnapshotSchema)
      .max(100)
      .optional(),
    attributionIds: z.array(nonEmptyString).max(100).optional(),
    sourceIds: z.array(nonEmptyString).max(100).optional(),
    assertedTemporalAssertionId: nonEmptyString.optional(),
    contentHash: contentHashSchema.optional(),
    origin: versionOriginSchema,
    createdAt: z.iso.datetime({ offset: true }).optional(),
    current: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.priorVersionId !== value.id, {
    message: "A claim version cannot be its own predecessor.",
    path: ["priorVersionId"],
  });

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
    uncertainty: nonEmptyString.optional(),
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
    reviewStatus: nonEmptyString.optional(),
    validity: z
      .object({
        status: nonEmptyString.optional(),
        temporalLinks: z
          .array(
            z
              .object({
                temporalAssertionId: nonEmptyString,
                linkType: z.enum(relationshipTemporalLinkTypes),
                sourceIds: sourceIdsSchema.optional(),
                note: nonEmptyString.optional(),
              })
              .strict(),
          )
          .optional(),
        sourceIds: sourceIdsSchema.optional(),
        note: nonEmptyString.optional(),
      })
      .strict()
      .optional(),
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

export const contextFieldProvenanceSchema = z
  .object({
    id: nonEmptyString,
    targetId: nonEmptyString,
    fieldPath: safeFieldPath,
    subrecordType: z
      .enum([
        "alias",
        "external_identifier",
        "proposed_date",
        "relationship_validity",
        "identity_link",
        "claim_attribution",
        "claim_relation",
        "claim_version",
        "evidence_claim_link",
        "source_locator",
        "evidence_version",
      ])
      .optional(),
    subrecordId: nonEmptyString.optional(),
    sourceId: nonEmptyString,
    supportType: nonEmptyString.optional(),
    note: nonEmptyString.optional(),
    confidence: nonEmptyString.optional(),
    uncertainty: nonEmptyString.optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.subrecordType === undefined)
      === (value.subrecordId === undefined),
    {
      message:
        "subrecordType and subrecordId must be supplied together.",
      path: ["subrecordId"],
    },
  );

export const contextSourceLocatorSchema = z
  .object({
    id: nonEmptyString,
    evidenceId: nonEmptyString,
    sourceId: nonEmptyString,
    locatorType: locatorTypeSchema,
    locatorLabel: z.string().min(1).max(1024),
    locator: boundedLocatorDataSchema.optional(),
    excerpt: z.string().min(1).max(4000).optional(),
    note: z.string().trim().min(1).max(4000).optional(),
  })
  .strict();

export const contextEvidenceClaimLinkSchema = z
  .object({
    id: nonEmptyString,
    evidenceId: nonEmptyString,
    claimId: nonEmptyString,
    claimVersionId: nonEmptyString.optional(),
    supportRole: evidenceSupportRoleSchema,
    scopePath: safeFieldPath.optional(),
    explanation: z.string().trim().min(1).max(4000).optional(),
    relevance: z.string().trim().min(1).max(256).optional(),
    confidence: z.string().trim().min(1).max(256).optional(),
    uncertainty: z.string().trim().min(1).max(2000).optional(),
    sourceIds: z.array(nonEmptyString).max(100).optional(),
  })
  .strict();

const evidenceVersionLocatorSchema = z
  .object({
    sourceId: nonEmptyString,
    locatorType: locatorTypeSchema,
    locatorLabel: z.string().min(1).max(1024),
    locator: boundedLocatorDataSchema.optional(),
    excerpt: z.string().min(1).max(4000).optional(),
    note: z.string().trim().min(1).max(4000).optional(),
  })
  .strict();

const evidentiaryBasisSchema = z
  .object({
    sourceId: nonEmptyString.optional(),
    accountId: nonEmptyString.optional(),
    evidenceRecordId: nonEmptyString.optional(),
    description: z.string().trim().min(1).max(4000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.sourceId !== undefined
      || value.accountId !== undefined
      || value.evidenceRecordId !== undefined
      || value.description !== undefined,
    "An evidentiary basis object cannot be empty.",
  );

export const contextEvidenceVersionSchema = z
  .object({
    id: nonEmptyString,
    evidenceId: nonEmptyString,
    ordinal: z.number().int().positive().optional(),
    priorVersionId: nonEmptyString.optional(),
    evidenceType: z.enum(["evidence", "counterevidence"]),
    explanation: nonEmptyString,
    strength: z.string().trim().min(1).max(256).optional(),
    confidence: z.string().trim().min(1).max(256).optional(),
    uncertainty: z.string().trim().min(1).max(2000).optional(),
    sourceId: nonEmptyString.optional(),
    accountId: nonEmptyString.optional(),
    evidenceRecordId: nonEmptyString.optional(),
    evidentiaryBasis: evidentiaryBasisSchema.optional(),
    sourceLocator: evidenceVersionLocatorSchema.optional(),
    sourceIds: z.array(nonEmptyString).max(100).optional(),
    supportRole: evidenceSupportRoleSchema.optional(),
    status: z.enum(contextualVersionStatuses).optional(),
    changeType: z.string().trim().min(1).max(256),
    changeReason: z.string().trim().min(1).max(4000).optional(),
    contentHash: contentHashSchema.optional(),
    origin: versionOriginSchema,
    createdAt: z.iso.datetime({ offset: true }).optional(),
    current: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.priorVersionId !== value.id, {
    message: "An evidence version cannot be its own predecessor.",
    path: ["priorVersionId"],
  });

export const contextualBundleSchema = z
  .object({
    entities: z.array(contextEntitySchema).optional(),
    aliases: z.array(contextEntityAliasSchema).optional(),
    externalIdentifiers: z
      .array(contextExternalIdentifierSchema)
      .optional(),
    temporalAssertions: z.array(temporalAssertionSchema).optional(),
    accounts: z.array(historicalAccountSchema).optional(),
    claims: z.array(contextClaimSchema).optional(),
    claimAttributions: z
      .array(contextClaimAttributionSchema)
      .optional(),
    claimRelations: z.array(contextClaimRelationSchema).optional(),
    claimVersions: z.array(contextClaimVersionSchema).optional(),
    evidence: z.array(contextEvidenceSchema).optional(),
    evidenceClaimLinks: z
      .array(contextEvidenceClaimLinkSchema)
      .optional(),
    evidenceVersions: z
      .array(contextEvidenceVersionSchema)
      .optional(),
    sourceLocators: z.array(contextSourceLocatorSchema).optional(),
    interpretations: z.array(contextInterpretationSchema).optional(),
    perspectives: z.array(contextPerspectiveSchema).optional(),
    recordPerspectives: z.array(contextRecordPerspectiveSchema).optional(),
    causalLinks: z.array(contextCausalLinkSchema).optional(),
    relationships: z.array(contextRelationshipSchema).optional(),
    culturalMemories: z.array(contextCulturalMemorySchema).optional(),
    fieldProvenance: z.array(contextFieldProvenanceSchema).optional(),
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
  const temporalIds = new Set(
    (context.temporalAssertions ?? []).map((record) => record.id),
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
  const evidenceIds = new Set(
    (context.evidence ?? []).map((record) => record.id),
  );
  const claimVersionIds = new Set(
    (context.claimVersions ?? []).map((version) => version.id),
  );
  const evidenceVersionIds = new Set(
    (context.evidenceVersions ?? []).map((version) => version.id),
  );
  const aliasIds = new Set<string>();
  const identifierIds = new Set<string>();
  const proposalIds = new Set<string>();
  const provenanceIds = new Set<string>();
  const attributionIds = new Set<string>();
  const claimRelationIds = new Set<string>();
  const evidenceLinkIds = new Set<string>();
  const sourceLocatorIds = new Set<string>();

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

  const duplicateAliasKeys = new Set<string>();
  for (const alias of context.aliases ?? []) {
    if (aliasIds.has(alias.id)) {
      issues.push({
        code: "DUPLICATE_CONTEXT_ALIAS_ID",
        objectType: "alias",
        objectId: alias.id,
        field: "id",
        message: `Context alias ID ${alias.id} is duplicated.`,
      });
    }
    aliasIds.add(alias.id);
    requireReference(
      "alias",
      alias.id,
      "entityId",
      alias.entityId,
      entityIds,
      "CONTEXT_ALIAS_ENTITY_NOT_FOUND",
    );
    requireReference(
      "alias",
      alias.id,
      "temporalAssertionId",
      alias.temporalAssertionId,
      temporalIds,
      "CONTEXT_ALIAS_TEMPORAL_NOT_FOUND",
    );
    for (const sourceId of alias.sourceIds ?? []) {
      requireSource("alias", alias.id, "sourceIds", sourceId);
    }

    const key = [
      alias.entityId,
      alias.text,
      alias.aliasType,
      alias.languageTag ?? "",
      alias.scriptIdentifier ?? "",
    ].join("\u0000");
    if (duplicateAliasKeys.has(key)) {
      issues.push({
        code: "DUPLICATE_CONTEXT_ALIAS",
        objectType: "alias",
        objectId: alias.id,
        field: "text",
        message:
          "An exact duplicate alias exists for this entity.",
      });
    }
    duplicateAliasKeys.add(key);
  }

  const duplicateIdentifierKeys = new Set<string>();
  for (const identifier of context.externalIdentifiers ?? []) {
    if (identifierIds.has(identifier.id)) {
      issues.push({
        code: "DUPLICATE_CONTEXT_IDENTIFIER_ID",
        objectType: "externalIdentifier",
        objectId: identifier.id,
        field: "id",
        message:
          `Context external identifier ID ${identifier.id} is duplicated.`,
      });
    }
    identifierIds.add(identifier.id);
    requireReference(
      "externalIdentifier",
      identifier.id,
      "entityId",
      identifier.entityId,
      entityIds,
      "CONTEXT_IDENTIFIER_ENTITY_NOT_FOUND",
    );
    for (const sourceId of identifier.sourceIds ?? []) {
      requireSource(
        "externalIdentifier",
        identifier.id,
        "sourceIds",
        sourceId,
      );
    }

    const key = [
      identifier.entityId,
      identifier.scheme.toLocaleLowerCase(),
      identifier.value,
    ].join("\u0000");
    if (duplicateIdentifierKeys.has(key)) {
      issues.push({
        code: "DUPLICATE_CONTEXT_IDENTIFIER",
        objectType: "externalIdentifier",
        objectId: identifier.id,
        field: "value",
        message:
          "An exact scheme and value duplicate exists for this entity.",
      });
    }
    duplicateIdentifierKeys.add(key);
  }

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

    const bounds = chronologyBoundsForStructuredDate(
      record.structuredDate,
    );
    if (
      bounds
      && bounds.startYear > bounds.endYear
    ) {
      issues.push({
        code: "INVALID_CONTEXT_CHRONOLOGY",
        objectType: "temporalAssertion",
        objectId: record.id,
        field: "structuredDate",
        message:
          "Structured date chronology bounds are reversed.",
      });
    }

    for (const proposal of record.proposedDates ?? []) {
      if (proposal.id) {
        if (proposalIds.has(proposal.id)) {
          issues.push({
            code: "DUPLICATE_CONTEXT_DATE_PROPOSAL_ID",
            objectType: "temporalAssertion",
            objectId: record.id,
            field: "proposedDates",
            message:
              `Proposed date ID ${proposal.id} is duplicated.`,
          });
        }
        proposalIds.add(proposal.id);
      }
      for (const sourceId of proposal.sourceIds ?? []) {
        requireSource(
          "temporalAssertion",
          record.id,
          "proposedDates.sourceIds",
          sourceId,
        );
      }
    }
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

  for (const attribution of context.claimAttributions ?? []) {
    if (attributionIds.has(attribution.id)) {
      issues.push({
        code: "DUPLICATE_CLAIM_ATTRIBUTION_ID",
        objectType: "claimAttribution",
        objectId: attribution.id,
        field: "id",
        message:
          `Claim attribution ID ${attribution.id} is duplicated.`,
      });
    }
    attributionIds.add(attribution.id);
    requireReference(
      "claimAttribution",
      attribution.id,
      "claimId",
      attribution.claimId,
      claimIds,
      "CONTEXT_CLAIM_NOT_FOUND",
    );
    requireReference(
      "claimAttribution",
      attribution.id,
      "actorEntityId",
      attribution.actorEntityId,
      entityIds,
      "CONTEXT_ATTRIBUTION_ACTOR_NOT_FOUND",
    );
    requireReference(
      "claimAttribution",
      attribution.id,
      "accountId",
      attribution.accountId,
      accountIds,
      "CONTEXT_ATTRIBUTION_ACCOUNT_NOT_FOUND",
    );
    requireReference(
      "claimAttribution",
      attribution.id,
      "temporalAssertionId",
      attribution.temporalAssertionId,
      temporalIds,
      "CONTEXT_ATTRIBUTION_TIME_NOT_FOUND",
    );
    for (const sourceId of attribution.sourceIds ?? []) {
      requireSource(
        "claimAttribution",
        attribution.id,
        "sourceIds",
        sourceId,
      );
    }
  }

  const contradictionPairs = new Set<string>();
  for (const relation of context.claimRelations ?? []) {
    if (claimRelationIds.has(relation.id)) {
      issues.push({
        code: "DUPLICATE_CLAIM_RELATION_ID",
        objectType: "claimRelation",
        objectId: relation.id,
        field: "id",
        message: `Claim relation ID ${relation.id} is duplicated.`,
      });
    }
    claimRelationIds.add(relation.id);
    requireReference(
      "claimRelation",
      relation.id,
      "fromClaimId",
      relation.fromClaimId,
      claimIds,
      "CONTEXT_CLAIM_NOT_FOUND",
    );
    requireReference(
      "claimRelation",
      relation.id,
      "toClaimId",
      relation.toClaimId,
      claimIds,
      "CONTEXT_CLAIM_NOT_FOUND",
    );
    requireReference(
      "claimRelation",
      relation.id,
      "temporalAssertionId",
      relation.temporalAssertionId,
      temporalIds,
      "CONTEXT_CLAIM_RELATION_TIME_NOT_FOUND",
    );
    for (const sourceId of relation.sourceIds ?? []) {
      requireSource(
        "claimRelation",
        relation.id,
        "sourceIds",
        sourceId,
      );
    }
    if (relation.relationType === "contradicts") {
      const pair = [
        relation.fromClaimId,
        relation.toClaimId,
      ].sort().join("\u0000");
      if (contradictionPairs.has(pair)) {
        issues.push({
          code: "DUPLICATE_SYMMETRIC_CLAIM_CONTRADICTION",
          objectType: "claimRelation",
          objectId: relation.id,
          field: "relationType",
          message:
            "A contradiction for this claim pair is duplicated in the same or reverse direction.",
        });
      }
      contradictionPairs.add(pair);
    }
  }

  const validateVersionCollection = (
    kind: "claimVersion" | "evidenceVersion",
    versions: Array<{
      id: string;
      priorVersionId?: string | undefined;
      ordinal?: number | undefined;
      current?: boolean | undefined;
      contentHash?: string | undefined;
      sourceIds?: string[] | undefined;
    }>,
    parentId: (version: typeof versions[number]) => string,
    expectedHash: (version: typeof versions[number]) => string,
  ) => {
    const versionIds = new Set<string>();
    const versionsById = new Map(
      versions.map((version) => [version.id, version]),
    );
    const ordinalKeys = new Set<string>();
    const currentCounts = new Map<string, number>();
    for (const version of versions) {
      const ownerId = parentId(version);
      if (versionIds.has(version.id)) {
        issues.push({
          code: "DUPLICATE_CONTEXT_VERSION_ID",
          objectType: kind,
          objectId: version.id,
          field: "id",
          message: `${kind} ID ${version.id} is duplicated.`,
        });
      }
      versionIds.add(version.id);
      if (version.ordinal !== undefined) {
        const ordinalKey = `${ownerId}\u0000${version.ordinal}`;
        if (ordinalKeys.has(ordinalKey)) {
          issues.push({
            code: "DUPLICATE_CONTEXT_VERSION_ORDINAL",
            objectType: kind,
            objectId: version.id,
            field: "ordinal",
            message:
              `Ordinal ${version.ordinal} is duplicated for ${ownerId}.`,
          });
        }
        ordinalKeys.add(ordinalKey);
      }
      if (version.current === true) {
        currentCounts.set(
          ownerId,
          (currentCounts.get(ownerId) ?? 0) + 1,
        );
      }
      if (
        version.contentHash
        && version.contentHash !== expectedHash(version)
      ) {
        issues.push({
          code: "CONTEXT_VERSION_HASH_MISMATCH",
          objectType: kind,
          objectId: version.id,
          field: "contentHash",
          message:
            `The supplied content hash does not match normalized ${kind} content.`,
        });
      }
      for (const sourceId of version.sourceIds ?? []) {
        requireSource(kind, version.id, "sourceIds", sourceId);
      }
    }

    for (const ownerId of new Set(versions.map(parentId))) {
      if ((currentCounts.get(ownerId) ?? 0) !== 1) {
        issues.push({
          code: "INVALID_CONTEXT_CURRENT_VERSION_COUNT",
          objectType: kind,
          objectId: ownerId,
          field: "current",
          message:
            `Exactly one current ${kind} is required for ${ownerId}.`,
        });
      }
    }

    for (const version of versions) {
      const seen = new Set<string>([version.id]);
      let predecessorId = version.priorVersionId;
      while (predecessorId) {
        if (seen.has(predecessorId)) {
          issues.push({
            code: "CONTEXT_VERSION_PREDECESSOR_CYCLE",
            objectType: kind,
            objectId: version.id,
            field: "priorVersionId",
            message:
              `Version predecessor chain for ${version.id} contains a cycle.`,
          });
          break;
        }
        seen.add(predecessorId);
        const predecessor = versionsById.get(predecessorId);
        if (!predecessor) {
          issues.push({
            code: "CONTEXT_VERSION_PREDECESSOR_NOT_FOUND",
            objectType: kind,
            objectId: version.id,
            field: "priorVersionId",
            message:
              `priorVersionId references missing version ${predecessorId}.`,
          });
          break;
        }
        if (parentId(predecessor) !== parentId(version)) {
          issues.push({
            code: "CONTEXT_VERSION_PARENT_MISMATCH",
            objectType: kind,
            objectId: version.id,
            field: "priorVersionId",
            message:
              "A version predecessor must belong to the same logical parent.",
          });
          break;
        }
        predecessorId = predecessor.priorVersionId;
      }
    }
  };

  for (const version of context.claimVersions ?? []) {
    requireReference(
      "claimVersion",
      version.id,
      "claimId",
      version.claimId,
      claimIds,
      "CONTEXT_CLAIM_NOT_FOUND",
    );
    requireReference(
      "claimVersion",
      version.id,
      "subjectId",
      version.subjectId,
      allIds,
      "CONTEXT_SUBJECT_NOT_FOUND",
    );
    requireReference(
      "claimVersion",
      version.id,
      "objectId",
      version.objectId,
      allIds,
      "CONTEXT_OBJECT_NOT_FOUND",
    );
    requireReference(
      "claimVersion",
      version.id,
      "assertedTemporalAssertionId",
      version.assertedTemporalAssertionId,
      temporalIds,
      "CONTEXT_VERSION_TIME_NOT_FOUND",
    );
    for (const attributionId of version.attributionIds ?? []) {
      requireReference(
        "claimVersion",
        version.id,
        "attributionIds",
        attributionId,
        attributionIds,
        "CONTEXT_ATTRIBUTION_NOT_FOUND",
      );
    }
  }
  validateVersionCollection(
    "claimVersion",
    context.claimVersions ?? [],
    (version) => (
      version as typeof version & { claimId: string }
    ).claimId,
    (version) => claimVersionContentHash(
      version as ContextClaimVersion,
    ),
  );

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

  for (const locator of context.sourceLocators ?? []) {
    if (sourceLocatorIds.has(locator.id)) {
      issues.push({
        code: "DUPLICATE_CONTEXT_SOURCE_LOCATOR_ID",
        objectType: "sourceLocator",
        objectId: locator.id,
        field: "id",
        message: `Source locator ID ${locator.id} is duplicated.`,
      });
    }
    sourceLocatorIds.add(locator.id);
    requireReference(
      "sourceLocator",
      locator.id,
      "evidenceId",
      locator.evidenceId,
      evidenceIds,
      "CONTEXT_EVIDENCE_NOT_FOUND",
    );
    requireSource(
      "sourceLocator",
      locator.id,
      "sourceId",
      locator.sourceId,
    );
  }

  for (const version of context.evidenceVersions ?? []) {
    requireReference(
      "evidenceVersion",
      version.id,
      "evidenceId",
      version.evidenceId,
      evidenceIds,
      "CONTEXT_EVIDENCE_NOT_FOUND",
    );
    requireReference(
      "evidenceVersion",
      version.id,
      "accountId",
      version.accountId,
      accountIds,
      "CONTEXT_ACCOUNT_NOT_FOUND",
    );
    requireReference(
      "evidenceVersion",
      version.id,
      "evidenceRecordId",
      version.evidenceRecordId,
      allIds,
      "CONTEXT_EVIDENCE_RECORD_NOT_FOUND",
    );
    requireSource(
      "evidenceVersion",
      version.id,
      "sourceId",
      version.sourceId,
    );
    const basis = version.evidentiaryBasis;
    requireSource(
      "evidenceVersion",
      version.id,
      "evidentiaryBasis.sourceId",
      basis?.sourceId,
    );
    requireReference(
      "evidenceVersion",
      version.id,
      "evidentiaryBasis.accountId",
      basis?.accountId,
      accountIds,
      "CONTEXT_ACCOUNT_NOT_FOUND",
    );
    requireReference(
      "evidenceVersion",
      version.id,
      "evidentiaryBasis.evidenceRecordId",
      basis?.evidenceRecordId,
      allIds,
      "CONTEXT_EVIDENCE_RECORD_NOT_FOUND",
    );
    requireSource(
      "evidenceVersion",
      version.id,
      "sourceLocator.sourceId",
      version.sourceLocator?.sourceId,
    );
  }
  validateVersionCollection(
    "evidenceVersion",
    context.evidenceVersions ?? [],
    (version) => (
      version as typeof version & { evidenceId: string }
    ).evidenceId,
    (version) => evidenceVersionContentHash(
      version as ContextEvidenceVersion,
    ),
  );

  for (const link of context.evidenceClaimLinks ?? []) {
    if (evidenceLinkIds.has(link.id)) {
      issues.push({
        code: "DUPLICATE_CONTEXT_EVIDENCE_LINK_ID",
        objectType: "evidenceClaimLink",
        objectId: link.id,
        field: "id",
        message: `Evidence link ID ${link.id} is duplicated.`,
      });
    }
    evidenceLinkIds.add(link.id);
    requireReference(
      "evidenceClaimLink",
      link.id,
      "evidenceId",
      link.evidenceId,
      evidenceIds,
      "CONTEXT_EVIDENCE_NOT_FOUND",
    );
    requireReference(
      "evidenceClaimLink",
      link.id,
      "claimId",
      link.claimId,
      claimIds,
      "CONTEXT_CLAIM_NOT_FOUND",
    );
    requireReference(
      "evidenceClaimLink",
      link.id,
      "claimVersionId",
      link.claimVersionId,
      claimVersionIds,
      "CONTEXT_CLAIM_VERSION_NOT_FOUND",
    );
    if (link.claimVersionId) {
      const targetVersion = (context.claimVersions ?? []).find(
        (version) => version.id === link.claimVersionId,
      );
      if (targetVersion && targetVersion.claimId !== link.claimId) {
        issues.push({
          code: "CONTEXT_EVIDENCE_LINK_VERSION_MISMATCH",
          objectType: "evidenceClaimLink",
          objectId: link.id,
          field: "claimVersionId",
          message:
            "The targeted claim version does not belong to the linked claim.",
        });
      }
    }
    for (const sourceId of link.sourceIds ?? []) {
      requireSource(
        "evidenceClaimLink",
        link.id,
        "sourceIds",
        sourceId,
      );
    }
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

    for (const link of record.validity?.temporalLinks ?? []) {
      requireReference(
        "relationship",
        record.id,
        "validity.temporalLinks",
        link.temporalAssertionId,
        temporalIds,
        "CONTEXT_RELATIONSHIP_VALIDITY_NOT_FOUND",
      );
      for (const sourceId of link.sourceIds ?? []) {
        requireSource(
          "relationship",
          record.id,
          "validity.temporalLinks.sourceIds",
          sourceId,
        );
      }
    }
    for (const sourceId of record.validity?.sourceIds ?? []) {
      requireSource(
        "relationship",
        record.id,
        "validity.sourceIds",
        sourceId,
      );
    }
  }

  const identityTypes = new Set<string>(identityRelationTypes);
  const symmetricIdentityTypes = new Set([
    "possible_same_as",
    "asserted_same_as",
    "distinct_from",
  ]);
  const identityPairs = new Set<string>();
  for (const record of context.relationships ?? []) {
    if (!identityTypes.has(record.relationshipType)) {
      continue;
    }
    requireReference(
      "relationship",
      record.id,
      "fromId",
      record.fromId,
      entityIds,
      "CONTEXT_IDENTITY_ENTITY_NOT_FOUND",
    );
    requireReference(
      "relationship",
      record.id,
      "toId",
      record.toId,
      entityIds,
      "CONTEXT_IDENTITY_ENTITY_NOT_FOUND",
    );
    if (symmetricIdentityTypes.has(record.relationshipType)) {
      const endpoints = [record.fromId, record.toId].sort();
      const key = [
        record.relationshipType,
        endpoints[0],
        endpoints[1],
      ].join("\u0000");
      if (identityPairs.has(key)) {
        issues.push({
          code: "DUPLICATE_SYMMETRIC_IDENTITY_LINK",
          objectType: "relationship",
          objectId: record.id,
          field: "relationshipType",
          message:
            "A symmetric identity relationship for this entity pair is duplicated.",
        });
      }
      identityPairs.add(key);
    }
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

  const provenanceRoots = new Set([
    "name",
    "canonicalName",
    "aliases",
    "externalIdentifiers",
    "timeRole",
    "structuredDate",
    "proposedDates",
    "validity",
    "identityLinks",
    "statement",
    "attributions",
    "claimRelations",
    "versions",
    "evidenceLinks",
    "explanation",
    "evidentiaryBasis",
    "supportRole",
    "sourceLocators",
    "changeReason",
    "versionStatus",
  ]);
  for (const link of context.fieldProvenance ?? []) {
    if (provenanceIds.has(link.id)) {
      issues.push({
        code: "DUPLICATE_CONTEXT_PROVENANCE_ID",
        objectType: "fieldProvenance",
        objectId: link.id,
        field: "id",
        message: `Field provenance ID ${link.id} is duplicated.`,
      });
    }
    provenanceIds.add(link.id);
    requireReference(
      "fieldProvenance",
      link.id,
      "targetId",
      link.targetId,
      allIds,
      "CONTEXT_PROVENANCE_TARGET_NOT_FOUND",
    );
    requireSource(
      "fieldProvenance",
      link.id,
      "sourceId",
      link.sourceId,
    );

    const root = link.fieldPath.split(".")[0] ?? "";
    if (!provenanceRoots.has(root)) {
      issues.push({
        code: "UNSAFE_CONTEXT_FIELD_PATH",
        objectType: "fieldProvenance",
        objectId: link.id,
        field: "fieldPath",
        message:
          `fieldPath root ${root || "(empty)"} is not supported.`,
      });
    }

    const subrecordExists =
      link.subrecordType === undefined
      || (
        link.subrecordType === "alias"
        && aliasIds.has(link.subrecordId ?? "")
      )
      || (
        link.subrecordType === "external_identifier"
        && identifierIds.has(link.subrecordId ?? "")
      )
      || (
        link.subrecordType === "proposed_date"
        && proposalIds.has(link.subrecordId ?? "")
      )
      || (
        link.subrecordType === "relationship_validity"
        && (context.relationships ?? []).some(
          (record) => record.id === link.subrecordId,
        )
      )
      || (
        link.subrecordType === "identity_link"
        && (context.relationships ?? []).some(
          (record) =>
            record.id === link.subrecordId
            && identityTypes.has(record.relationshipType),
        )
      )
      || (
        link.subrecordType === "claim_attribution"
        && attributionIds.has(link.subrecordId ?? "")
      )
      || (
        link.subrecordType === "claim_relation"
        && claimRelationIds.has(link.subrecordId ?? "")
      )
      || (
        link.subrecordType === "claim_version"
        && claimVersionIds.has(link.subrecordId ?? "")
      )
      || (
        link.subrecordType === "evidence_claim_link"
        && evidenceLinkIds.has(link.subrecordId ?? "")
      )
      || (
        link.subrecordType === "source_locator"
        && sourceLocatorIds.has(link.subrecordId ?? "")
      )
      || (
        link.subrecordType === "evidence_version"
        && evidenceVersionIds.has(link.subrecordId ?? "")
      );

    if (!subrecordExists) {
      issues.push({
        code: "CONTEXT_PROVENANCE_SUBRECORD_NOT_FOUND",
        objectType: "fieldProvenance",
        objectId: link.id,
        field: "subrecordId",
        message:
          `Field provenance subrecord ${link.subrecordId ?? ""} was not found.`,
      });
    }
  }

  return issues;
}
