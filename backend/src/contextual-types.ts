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

export const temporalRoles = [
  "event_time",
  "validity_time",
  "publication_time",
  "observation_time",
  "recording_time",
  "relationship_validity",
  "identity_name_validity",
  "source_creation_time",
  "unspecified",
] as const;

export type TemporalRole =
  (typeof temporalRoles)[number];

export const historicalDatePrecisions = [
  "day",
  "month",
  "year",
  "decade",
  "century",
  "named_period",
  "unknown",
] as const;

export type HistoricalDatePrecision =
  (typeof historicalDatePrecisions)[number];

export const historicalDateEras = ["BCE", "CE"] as const;

export type HistoricalDateEra =
  (typeof historicalDateEras)[number];

export interface StructuredHistoricalDate {
  originalLabel: string;
  precision: HistoricalDatePrecision;
  era?: HistoricalDateEra;
  year?: number;
  month?: number;
  day?: number;
  namedPeriod?: string;
  calendarSystem?: string;
  conversionStatus?: "not_required" | "unconverted";
  approximate?: boolean;
  uncertainty?: string;
}

export const contextAliasTypes = [
  "alternate",
  "historical",
  "abbreviation",
  "acronym",
  "title",
  "transliteration",
  "translation",
  "endonym",
  "exonym",
  "former_name",
  "disputed",
] as const;

export type ContextAliasType =
  | (typeof contextAliasTypes)[number]
  | `custom:${string}`;

export interface ContextEntityAlias {
  id: string;
  entityId: string;
  text: string;
  aliasType: ContextAliasType;
  languageTag?: string;
  scriptIdentifier?: string;
  notes?: string;
  uncertainty?: string;
  status?: string;
  temporalAssertionId?: string;
  sourceIds?: string[];
}

export interface ContextExternalIdentifier {
  id: string;
  entityId: string;
  scheme: string;
  value: string;
  normalizedValue?: string;
  uri?: string;
  label?: string;
  status?: string;
  notes?: string;
  uncertainty?: string;
  sourceIds?: string[];
}

export interface ContextFieldProvenance {
  id: string;
  targetId: string;
  fieldPath: string;
  subrecordType?: "alias" | "external_identifier" | "proposed_date" | "relationship_validity" | "identity_link";
  subrecordId?: string;
  sourceId: string;
  supportType?: string;
  note?: string;
  confidence?: string;
  uncertainty?: string;
}

export const identityRelationTypes = [
  "possible_same_as",
  "asserted_same_as",
  "distinct_from",
  "derived_from",
  "successor_of",
  "predecessor_of",
] as const;

export type IdentityRelationType =
  (typeof identityRelationTypes)[number];

export const relationshipTemporalLinkTypes = [
  "valid_from",
  "valid_until",
  "valid_during",
  "proposed_period",
] as const;

export type RelationshipTemporalLinkType =
  (typeof relationshipTemporalLinkTypes)[number];

export interface ContextRelationshipTemporalLink {
  temporalAssertionId: string;
  linkType: RelationshipTemporalLinkType;
  sourceIds?: string[];
  note?: string;
}

export interface ContextRelationshipValidity {
  status?: string;
  temporalLinks?: ContextRelationshipTemporalLink[];
  sourceIds?: string[];
  note?: string;
}

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
  id?: string;
  date?: string;
  label?: string;
  structuredDate?: StructuredHistoricalDate;
  precision?: string;
  uncertainty?: string;
  sourceIds?: string[];
  note?: string;
}

export interface TemporalAssertion
  extends ContextRecordBase {
  subjectId: string;
  temporalKind: TemporalKind;
  timeRole?: TemporalRole;
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
  structuredDate?: StructuredHistoricalDate;
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
  reviewStatus?: string;
  validity?: ContextRelationshipValidity;
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
  aliases?: ContextEntityAlias[];
  externalIdentifiers?: ContextExternalIdentifier[];
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
  fieldProvenance?: ContextFieldProvenance[];
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
