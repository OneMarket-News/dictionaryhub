export const contextEntityTypes = [
  "person",
  "group",
  "organization",
  "cultural_community",
  "place",
  "event",
  "document",
  "work",
  "political_jurisdiction",
] as const;

export type ContextEntityType =
  (typeof contextEntityTypes)[number];

export const temporalKinds = [
  "exact",
  "approximate",
  "range",
  "before",
  "after",
  "disputed",
  "unknown",
  "multiple_proposed",
] as const;

export type TemporalKind =
  (typeof temporalKinds)[number];

export const contextRecordKinds = [
  "entity",
  "temporal_assertion",
  "account",
  "claim",
  "evidence",
  "interpretation",
  "perspective",
  "causal_link",
  "relationship",
  "cultural_memory",
] as const;

export type ContextRecordKind =
  (typeof contextRecordKinds)[number];

export interface ContextRecordBase {
  id: string;
  label: string;
  summary?: string;
  domain?: string;
  status?: string;
  sourceIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface ContextEntity
  extends ContextRecordBase {
  entityType: ContextEntityType;
  name: string;
  alternateNames?: string[];
  description?: string;
}

export interface ProposedContextDate {
  date?: string;
  label?: string;
  precision?: string;
  uncertainty?: string;
}

export interface TemporalAssertion
  extends ContextRecordBase {
  subjectId: string;
  temporalKind: TemporalKind;
  exactDate?: string;
  startDate?: string;
  endDate?: string;
  beforeDate?: string;
  afterDate?: string;
  proposedDates?: ProposedContextDate[];
  dateLabel: string;
  calendarSystem?: string;
  datePrecision?: string;
  startUncertainty?: string;
  endUncertainty?: string;
  dateNotes?: string;
}

export interface HistoricalAccount
  extends ContextRecordBase {
  subjectId: string;
  authorEntityId?: string;
  sourceId?: string;
  accountType: string;
  content: string;
  publicationLabel?: string;
}

export interface ContextClaim
  extends ContextRecordBase {
  accountId: string;
  subjectId: string;
  objectId?: string;
  claimType: string;
  statement: string;
  confidence?: string;
  uncertainty?: string;
}

export type ContextEvidenceType =
  | "evidence"
  | "counterevidence";

export interface ContextEvidence
  extends ContextRecordBase {
  claimId: string;
  evidenceType: ContextEvidenceType;
  sourceId?: string;
  accountId?: string;
  evidenceRecordId?: string;
  explanation: string;
  strength?: string;
  confidence?: string;
}

export interface ContextInterpretation
  extends ContextRecordBase {
  subjectId: string;
  accountId?: string;
  sourceId?: string;
  interpretation: string;
  confidence?: string;
  uncertainty?: string;
  publishedConclusion?: boolean;
}

export interface ContextPerspective
  extends ContextRecordBase {
  name: string;
  description: string;
}

export interface ContextRecordPerspective {
  recordId: string;
  perspectiveId: string;
  stance?: string;
  notes?: string;
}

export type ContextCausalKind =
  | "cause"
  | "consequence";

export interface ContextCausalLink
  extends ContextRecordBase {
  causeId: string;
  effectId: string;
  causalKind: ContextCausalKind;
  explanation: string;
  confidence?: string;
  uncertainty?: string;
}

export interface ContextRelationship
  extends ContextRecordBase {
  fromId: string;
  toId: string;
  relationshipType: string;
  relationshipRole?: string;
  explanation?: string;
  confidence?: string;
  uncertainty?: string;
}

export interface ContextCulturalMemory
  extends ContextRecordBase {
  subjectId: string;
  perspectiveId?: string;
  sourceId?: string;
  memoryType: string;
  narrative: string;
  periodLabel?: string;
}

export interface ContextualBundle {
  entities?: ContextEntity[];
  temporalAssertions?: TemporalAssertion[];
  accounts?: HistoricalAccount[];
  claims?: ContextClaim[];
  evidence?: ContextEvidence[];
  interpretations?: ContextInterpretation[];
  perspectives?: ContextPerspective[];
  recordPerspectives?: ContextRecordPerspective[];
  causalLinks?: ContextCausalLink[];
  relationships?: ContextRelationship[];
  culturalMemories?: ContextCulturalMemory[];
}

export interface NormalizedContextRecord {
  id: string;
  recordKind: ContextRecordKind;
  bundleId: string;
  domain: string;
  label: string;
  summary: string | null;
  status: string;
  sourceIds: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
