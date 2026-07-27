import type { SourceRootBundle, ValidationIssue } from "../types.js";

export const PREPARATION_SCHEMA_VERSION = "1.0.0" as const;
export const preparationStatuses = [
  "draft",
  "needs_review",
  "approved",
  "omitted",
] as const;
export const rightsClassifications = [
  "public_domain",
  "open_license",
  "permission_granted",
  "metadata_and_link_only",
  "restricted",
  "unknown",
] as const;
export const contentUseModes = [
  "metadata_only",
  "paraphrase_only",
  "short_quote",
  "public_domain_excerpt",
] as const;

export type PreparationStatus = (typeof preparationStatuses)[number];
export type RightsClassification =
  (typeof rightsClassifications)[number];
export type ContentUseMode = (typeof contentUseModes)[number];

export interface ApprovalRecord {
  approvedBy: string;
  approvedAt: string;
  note?: string;
}

export interface PreparedItem {
  preparationStatus: PreparationStatus;
  reviewerNotes?: string;
  unresolvedQuestions?: string[];
  omissionReason?: string;
  approvalRecord?: ApprovalRecord;
  object: Record<string, unknown>;
}

export interface PreparedSource extends PreparedItem {
  rightsReview: {
    classification: RightsClassification;
    basis?: string;
    licenseIdentifier?: string;
    permissionBasis?: string;
    attributionRequirements?: string;
  };
  contentUse: {
    mode: ContentUseMode;
    containsCopiedExcerpt: boolean;
  };
  sourceIdentityReview: {
    identityKind:
      | "original_work"
      | "archival_object"
      | "later_transcription"
      | "modernized_edition"
      | "scholarly_edition"
      | "compilation"
      | "catalog_record"
      | "digital_surrogate"
      | "museum_interpretation"
      | "tribal_institutional_account"
      | "government_institutional_account"
      | "scholarly_analysis";
    originalWorkId?: string;
    editionId?: string;
    transcriptionId?: string;
    compilationId?: string;
    catalogRecordId?: string;
    digitalObjectId?: string;
    limitations?: string;
  };
}

export interface SourcePreparationWorkspace {
  schemaVersion: typeof PREPARATION_SCHEMA_VERSION;
  workspaceId: string;
  title: string;
  description: string;
  domain: string;
  preparationStatus: PreparationStatus;
  sourceSet: PreparedSource[];
  accounts: PreparedItem[];
  records: PreparedItem[];
  claims: PreparedItem[];
  historicalNames: PreparedItem[];
  dateExpressions: PreparedItem[];
  relationships: PreparedItem[];
  sourceLocators: PreparedItem[];
  evidence: PreparedItem[];
  evidenceLinks: PreparedItem[];
  claimRelations: PreparedItem[];
  fieldProvenance: PreparedItem[];
  reviewMetadata: {
    bundleId: string;
    version: string;
    createdAt: string;
    createdBy: string;
    description: string;
  };
  approvals: {
    approved: boolean;
    approvedBy?: string;
    approvedAt?: string;
    note?: string;
  };
}

export type PreparationMode = "validate" | "preview" | "generate";
export type PreparationIssueCategory =
  | "structure"
  | "reference"
  | "rights"
  | "status"
  | "locator"
  | "evidence"
  | "versioning"
  | "path";

export interface PreparationIssue {
  code: string;
  category: PreparationIssueCategory;
  path: string;
  message: string;
  blocking: true;
}

export interface SourcePreparationReport {
  schemaVersion: typeof PREPARATION_SCHEMA_VERSION;
  workspaceId: string;
  mode: PreparationMode;
  preview: boolean;
  readyForGeneration: boolean;
  proposedContentSha256?: string;
  issues: PreparationIssue[];
  acceptedBundleValidation?: {
    canImport: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  };
  counts: Record<string, number>;
  rightsSummary: Record<string, number>;
  contentUseSummary: Record<string, number>;
  statusSummary: Record<string, number>;
  locatorSummary: Record<string, number>;
  evidenceRoleSummary: Record<string, number>;
  omittedItems: Array<{ id: string; reason: string }>;
  resolvedReferences: {
    checked: number;
    unresolved: number;
  };
}

export interface PreparationResult {
  report: SourcePreparationReport;
  bundle?: SourceRootBundle;
  bundleBytes?: Buffer;
}
