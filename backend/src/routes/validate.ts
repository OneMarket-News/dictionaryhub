import { Router } from "express";
import { emitDiagnosticEvent } from "../lib/diagnostics.js";
import { validateBundle } from "../services/validator.js";
import type { SourceRootBundle } from "../types.js";

export const validateRouter = Router();

validateRouter.post("/validate", (request, response) => {
  const startedAt = performance.now();
  const result = validateBundle(request.body);
  if (!result.canImport) {
    const bundle = request.body as SourceRootBundle;
    emitDiagnosticEvent({
      eventType: "validation_failed",
      level: "warning",
      correlationId: response.locals.requestId,
      bundleId: result.bundleId,
      recordCounts: {
        nodes: result.summary.nodes,
        assertions: result.summary.assertions,
        edges: result.summary.edges,
        sources: result.summary.sources,
        revisions: result.summary.revisions,
        errors: result.summary.errors,
        warnings: result.summary.warnings,
        ...(result.summary.contextualRecords !== undefined
          ? { contextualRecords: result.summary.contextualRecords }
          : {}),
      },
      validationResult: result.status,
      failureCategory: result.errors.some((issue) =>
        [
          "context",
          "alias",
          "externalIdentifier",
          "fieldProvenance",
          "temporalAssertion",
          "relationship",
        ].includes(issue.objectType)
        || issue.code.startsWith("CONTEXT_")
      )
        ? "context-refinement-validation"
        : "bundle-validation",
      durationMs: performance.now() - startedAt,
      ...(typeof bundle?.version === "string"
        ? { schemaVersion: bundle.version }
        : {}),
    });
  }
  response.status(200).json(result);
});
