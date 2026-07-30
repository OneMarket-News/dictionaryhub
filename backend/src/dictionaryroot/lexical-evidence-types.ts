export const DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_ID =
  "dictionaryroot-lexical-evidence-architecture-fixture-v1";
export const DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_TITLE =
  "DictionaryRoot Lexical Evidence Architecture Fixture v1";
export const DICTIONARYROOT_LEXICAL_EVIDENCE_FIXTURE_VERSION = "1.0.0";

export type LexicalSubject =
  | { lemmaId: string }
  | { senseId: string }
  | { claimId: string }
  | { formId: string }
  | { proposalId: string }
  | { comparisonId: string };

export interface LexicalEvidenceSource {
  sourceId: string;
  accountId?: string;
  name: string;
  edition?: string;
  version?: string;
  rightsClass: string;
  license: string;
  canonicalUrl?: string;
  lineageId?: string;
}

export interface LexicalLemma {
  lemmaId: string;
  canonicalWrittenForm: string;
  normalizedForm: string;
  language: string;
  script?: string;
  status: string;
  recordVersion: number;
}

export interface LexicalSense {
  senseId: string;
  lemmaIds: string[];
  partOfSpeech: string;
  lexicalCategory: string;
  status: string;
  reviewStatus: string;
  recordVersion: number;
}

export interface LexicalDefinitionClaim {
  claimId: string;
  senseId: string;
  sourceId: string;
  sourceAccountId?: string;
  exactWording?: string;
  normalizedDefinition?: string;
  normalizationLabel?: string;
  language: string;
  claimStatus: string;
  editionContext?: string;
  usageLabel?: string;
  domainLabel?: string;
  registerLabel?: string;
  uncertainty?: string;
  qualification?: string;
  evidenceRelationship: string;
  recordVersion: number;
}

export interface LexicalForm {
  formId: string;
  lemmaId: string;
  senseId?: string;
  sourceId?: string;
  writtenForm: string;
  normalizedForm: string;
  formType: string;
  language: string;
  script?: string;
  grammaticalFeatures?: string;
  chronologyDisplay?: string;
  usageContext?: string;
  uncertainty?: string;
  recordVersion: number;
}

export interface LexicalEtymologyProposal {
  proposalId: string;
  subject: Extract<LexicalSubject, { lemmaId: string } | { formId: string } | { senseId: string }>;
  sourceId: string;
  sourceAccountId?: string;
  proposedSourceLanguage?: string;
  proposedEtymon?: string;
  relationshipType: string;
  chronologyDisplay?: string;
  confidence: string;
  qualification?: string;
  reviewStatus: string;
  competingProposalIds: string[];
  recordVersion: number;
}

export interface LexicalSourceComparison {
  comparisonId: string;
  senseId: string;
  leftClaimId: string;
  rightClaimId: string;
  comparisonType: string;
  reviewStatus: string;
  explanation: string;
  reviewerIdentity?: string;
  algorithmicSuggestion?: string;
  algorithmicRulesetVersion?: string;
  sourceLineageRelation?: string;
  recordVersion: number;
}

export interface LexicalSourceLocator {
  locatorId: string;
  subject: Extract<
    LexicalSubject,
    { claimId: string } | { formId: string } | { proposalId: string } | { comparisonId: string }
  >;
  sourceId: string;
  edition?: string;
  volume?: string;
  page?: string;
  column?: string;
  entryHeadword?: string;
  senseNumber?: string;
  section?: string;
  paragraph?: string;
  datasetRecordId?: string;
  synsetId?: string;
  apiObjectId?: string;
  stableFragment?: string;
  archiveIdentifier?: string;
  canonicalUrl?: string;
  accessDate?: string;
}

export interface LexicalFieldProvenance {
  provenanceId: string;
  subject: LexicalSubject;
  subjectField: string;
  sourceId: string;
  locatorId?: string;
  evidenceRole: string;
  transformationType: string;
  reviewerOrProcessIdentity?: string;
  versionContext?: string;
}

export type LexicalRelationshipDirectionality = "directional" | "symmetric";

export type LexicalRelationshipType =
  | "substantially_equivalent"
  | "antonym"
  | "broader"
  | "narrower"
  | "related"
  | "derivationally_related"
  | "historical_predecessor"
  | "historical_successor"
  | "technical_specialization"
  | "generalization"
  | "translation_related"
  | "disputed"
  | "unresolved";

export interface LexicalRelationship {
  relationshipId: string;
  sourceSenseId: string;
  targetSenseId: string;
  relationshipType: LexicalRelationshipType;
  directionality: LexicalRelationshipDirectionality;
  relationshipStatus: "asserted" | "qualified" | "disputed" | "unresolved";
  reviewStatus: "reviewed" | "needs_review" | "disputed" | "unresolved";
  qualification?: string;
  uncertainty?: string;
  chronologyContext?: string;
  domainContext?: string;
  recordVersion: number;
}

export interface LexicalRelationshipEvidence {
  evidenceId: string;
  relationshipId: string;
  sourceId: string;
  provenanceIdentity: string;
  evidenceRole: string;
  sourceWording?: string;
  normalizedSummary?: string;
  normalizationLabel?: string;
  reviewStatus: string;
  uncertainty?: string;
  qualification?: string;
  editionContext?: string;
  versionContext?: string;
  page?: string;
  entryHeadword?: string;
  senseNumber?: string;
  section?: string;
  paragraph?: string;
  datasetRecordId?: string;
  stableFragment?: string;
  canonicalUrl?: string;
  recordVersion: number;
}

export interface DictionaryRootLexicalEvidenceFixture {
  schemaVersion: "1.0.0";
  dataset: {
    datasetId: string;
    bundleId: string;
    title: string;
    version: string;
    status: "fixture";
    rightsSummary: string;
    fixtureOnly: true;
  };
  sources: LexicalEvidenceSource[];
  lemmas: LexicalLemma[];
  senses: LexicalSense[];
  definitionClaims: LexicalDefinitionClaim[];
  forms: LexicalForm[];
  etymologyProposals: LexicalEtymologyProposal[];
  sourceComparisons: LexicalSourceComparison[];
  locators: LexicalSourceLocator[];
  fieldProvenance: LexicalFieldProvenance[];
  relationships: LexicalRelationship[];
  relationshipEvidence: LexicalRelationshipEvidence[];
}

export interface DictionaryRootCoreLexicalCorpus {
  schemaVersion: "1.0.0";
  dataset: {
    datasetId: "dictionaryroot-core-lexical-corpus-v1";
    bundleId: "dictionaryroot-core-lexical-corpus-v1";
    title: "DictionaryRoot Core Lexical Corpus v1";
    version: "1.0.0";
    status: "accepted";
    rightsSummary: string;
    fixtureOnly: false;
  };
  sources: LexicalEvidenceSource[];
  lemmas: LexicalLemma[];
  senses: LexicalSense[];
  definitionClaims: LexicalDefinitionClaim[];
  forms: LexicalForm[];
  etymologyProposals: LexicalEtymologyProposal[];
  sourceComparisons: LexicalSourceComparison[];
  locators: LexicalSourceLocator[];
  fieldProvenance: LexicalFieldProvenance[];
  relationships: LexicalRelationship[];
  relationshipEvidence: LexicalRelationshipEvidence[];
}

export interface LexicalEvidenceInventory {
  datasetId: string;
  version: string;
  fixtureOnly: true;
  counts: {
    sources: number;
    lemmas: number;
    senses: number;
    definitionClaims: number;
    forms: number;
    etymologyProposals: number;
    sourceComparisons: number;
    unresolvedComparisons: number;
    locators: number;
    fieldProvenance: number;
    relationships: number;
    relationshipEvidence: number;
  };
  rightsDistribution: Record<string, number>;
  sourceDistribution: Record<string, number>;
}

export interface LexicalEvidenceQualityReview {
  datasetId: string;
  version: string;
  blockerCount: number;
  orphanCounts: Record<string, number>;
  duplicateIdentityCounts: Record<string, number>;
  unsupportedCounts: Record<string, number>;
  cases: Record<string, string[]>;
  productionCorpusGenerated: false;
}
