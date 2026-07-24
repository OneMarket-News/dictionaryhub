import type { ContextualBundle } from "./contextual-types.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  objectType: string;
  objectId: string;
  message: string;
  field?: string;
  severity?: ValidationSeverity;
}

export interface ValidationSummary {
  nodes: number;
  assertions: number;
  edges: number;
  sources: number;
  revisions: number;
  contextualRecords?: number;
  errors: number;
  warnings: number;
}

export interface ValidationResult {
  bundleId: string;
  status: "ready" | "ready-with-warnings" | "blocked" | "invalid-format";
  canImport: boolean;
  summary: ValidationSummary;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface SourceRootBundle {
  bundleId?: string;
  bundleType?: string;
  version?: string;
  domain?: string;
  createdAt?: string;
  createdBy?: string;
  description?: string;
  nodes?: unknown[];
  assertions?: unknown[];
  edges?: unknown[];
  sources?: unknown[];
  revisions?: unknown[];
  context?: ContextualBundle;
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}
