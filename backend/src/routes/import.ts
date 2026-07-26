import { Router, type NextFunction, type Request, type Response } from "express";

import {
  createApiError,
  withCollectionContract,
  withRequestId,
} from "../lib/api-contract.js";
import {
  getUnsupportedQueryParameters,
  getQueryString,
  getRouteParam,
  isQueryParameterError,
  normalizeFilters,
  parsePagination,
  parseSort,
} from "../lib/query-params.js";
import {
  deleteImportedTestBundle,
  getImportedBundle,
  getImportedBundleCount,
  listImportedBundles,
  saveImportedBundle,
  type ListImportedBundlesOptions,
} from "../services/import-store.js";
import { validateBundle } from "../services/validator.js";
import type { SourceRootBundle } from "../types.js";
import { getAuth, requireCsrf } from "../middleware/auth.js";
import { safeEqual } from "../lib/security.js";
import { emitDiagnosticEvent } from "../lib/diagnostics.js";

export const importRouter = Router();

function validationFailureCategory(
  result: ReturnType<typeof validateBundle>,
): string {
  return result.errors.some((issue) =>
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
    : "bundle-validation";
}

function persistenceFailureCategory(errorCode: string): string {
  if (/context_version|version.*conflict/i.test(errorCode)) {
    return "context-version-conflict";
  }
  if (/alias/i.test(errorCode)) {
    return "context-alias-persistence";
  }
  if (/identifier/i.test(errorCode)) {
    return "context-identifier-persistence";
  }
  if (/temporal|chronology|structured_date/i.test(errorCode)) {
    return "context-temporal-refinement";
  }
  if (/provenance/i.test(errorCode)) {
    return "context-provenance-link";
  }
  return /database|postgres|connection/i.test(errorCode)
    ? "database"
    : "import";
}

const importedBundleSorts = new Set([
  "createdAt",
  "updatedAt",
  "bundleId",
] as const);
const importCollectionQueryParameters = new Set([
  "page",
  "limit",
  "offset",
  "sort",
  "direction",
  "bundleId",
  "domain",
  "bundleType",
  "version",
  "createdFrom",
  "createdTo",
]);

function requireImportAuthorization(request: Request, response: Response, next: NextFunction): void {
  const auth = getAuth(response);
  if (auth.authenticated && (auth.permissions.includes("source.import") || auth.permissions.includes("system.admin"))) {
    requireCsrf(request, response, next);
    return;
  }
  const configuredToken = process.env.IMPORT_SERVICE_TOKEN || "";
  const suppliedToken = request.get("x-sourceroot-import-token") || "";
  if (configuredToken && suppliedToken && safeEqual(configuredToken, suppliedToken)) {
    next();
    return;
  }
  const allowDevelopment = (process.env.ALLOW_UNAUTHENTICATED_IMPORT || "false").toLowerCase() === "true"
    && (process.env.NODE_ENV || "development") !== "production";
  if (allowDevelopment) {
    response.setHeader("x-dictionaryroot-security-warning", "unauthenticated-development-import");
    next();
    return;
  }
  response.status(auth.authenticated ? 403 : 401).json({
    error: auth.authenticated ? "PERMISSION_REQUIRED" : "AUTHENTICATION_REQUIRED",
    message: auth.authenticated
      ? "Source import requires the source.import permission."
      : "Authenticate with source.import permission or provide the configured import service token.",
    requestId: response.locals.requestId,
  });
}

const INTEGRATION_TEST_PREFIX = "sourceroot-integration-test-";

function getIsoDateQuery(
  value: unknown,
): string | undefined | null {
  const text = getQueryString(value);

  if (text === undefined) {
    return undefined;
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

importRouter.post("/", requireImportAuthorization, async (request, response, next) => {
  const startedAt = performance.now();
  const bundle = (
    request.body && typeof request.body === "object" ? request.body : {}
  ) as SourceRootBundle;
  try {
    const validation = validateBundle(bundle);

    if (!validation.canImport) {
      emitDiagnosticEvent({
        eventType: "validation_failed",
        level: "warning",
        correlationId: response.locals.requestId,
        bundleId: validation.bundleId,
        recordCounts: {
          nodes: validation.summary.nodes,
          assertions: validation.summary.assertions,
          edges: validation.summary.edges,
          sources: validation.summary.sources,
          revisions: validation.summary.revisions,
          errors: validation.summary.errors,
          warnings: validation.summary.warnings,
          ...(validation.summary.contextualRecords !== undefined
            ? { contextualRecords: validation.summary.contextualRecords }
            : {}),
        },
        validationResult: validation.status,
        failureCategory: validationFailureCategory(validation),
        durationMs: performance.now() - startedAt,
        ...(typeof bundle.version === "string"
          ? { schemaVersion: bundle.version }
          : {}),
      });
      return response.status(422).json({
        imported: false,
        validation,
      });
    }

    await saveImportedBundle(bundle);

    const storedBundles = await getImportedBundleCount();

    emitDiagnosticEvent({
      eventType: "import_completed",
      level: "info",
      correlationId: response.locals.requestId,
      bundleId: validation.bundleId,
      recordCounts: {
        nodes: validation.summary.nodes,
        assertions: validation.summary.assertions,
        edges: validation.summary.edges,
        sources: validation.summary.sources,
        revisions: validation.summary.revisions,
        errors: validation.summary.errors,
        warnings: validation.summary.warnings,
        ...(validation.summary.contextualRecords !== undefined
          ? { contextualRecords: validation.summary.contextualRecords }
          : {}),
      },
      validationResult: validation.status,
      durationMs: performance.now() - startedAt,
      ...(typeof bundle.version === "string"
        ? { schemaVersion: bundle.version }
        : {}),
    });
    return response.status(201).json({
      imported: true,
      bundleId: bundle.bundleId,
      storedBundles,
      validation,
    });
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error &&
      typeof error.code === "string"
      ? error.code
      : "IMPORT_FAILED";
    const errorConstraint =
      error
      && typeof error === "object"
      && "constraint" in error
      && typeof error.constraint === "string"
        ? error.constraint
        : "";
    emitDiagnosticEvent({
      eventType: "import_failed",
      level: "error",
      correlationId: response.locals.requestId,
      bundleId: typeof bundle.bundleId === "string" ? bundle.bundleId : null,
      recordCounts: {
        nodes: Array.isArray(bundle.nodes) ? bundle.nodes.length : 0,
        assertions: Array.isArray(bundle.assertions) ? bundle.assertions.length : 0,
        edges: Array.isArray(bundle.edges) ? bundle.edges.length : 0,
        sources: Array.isArray(bundle.sources) ? bundle.sources.length : 0,
        revisions: Array.isArray(bundle.revisions) ? bundle.revisions.length : 0,
      },
      validationResult: "failed",
      failureCategory: persistenceFailureCategory(
        `${errorCode}:${errorConstraint}`,
      ),
      errorCode,
      durationMs: performance.now() - startedAt,
      ...(typeof bundle.version === "string"
        ? { schemaVersion: bundle.version }
        : {}),
    });
    return next(error);
  }
});

importRouter.get("/", async (request, response, next) => {
  try {
    const pagination = parsePagination(
      request.query.page,
      request.query.limit,
      { offsetValue: request.query.offset },
    );

    if (isQueryParameterError(pagination)) {
      return response.status(400).json(
        withRequestId(pagination, response),
      );
    }

    const sort = parseSort(
      request.query.sort,
      request.query.direction,
      {
        allowedSorts: importedBundleSorts,
        defaultSort: "createdAt",
        defaultDirection: "desc",
      },
    );

    if (isQueryParameterError(sort)) {
      return response.status(400).json(
        withRequestId(sort, response),
      );
    }

    const createdFrom = getIsoDateQuery(request.query.createdFrom);
    const createdTo = getIsoDateQuery(request.query.createdTo);

    if (createdFrom === null || createdTo === null) {
      return response.status(400).json(
        createApiError(
          "INVALID_DATE_FILTER",
          "createdFrom and createdTo must be valid ISO-8601 date or date-time values.",
          400,
          {
            category: "invalid-filter",
            field: createdFrom === null ? "createdFrom" : "createdTo",
            requestId: response.locals.requestId,
          },
        ),
      );
    }

    const bundleId = getQueryString(request.query.bundleId);
    const domain = getQueryString(request.query.domain);
    const bundleType = getQueryString(request.query.bundleType);
    const version = getQueryString(request.query.version);

    const options: ListImportedBundlesOptions = {
      page: pagination.page,
      limit: pagination.limit,
      offset: pagination.offset,
      sort: sort.sort,
      direction: sort.direction,
      ...(bundleId !== undefined ? { bundleId } : {}),
      ...(domain !== undefined ? { domain } : {}),
      ...(bundleType !== undefined ? { bundleType } : {}),
      ...(version !== undefined ? { version } : {}),
      ...(createdFrom !== undefined ? { createdFrom } : {}),
      ...(createdTo !== undefined ? { createdTo } : {}),
    };

    const result = await listImportedBundles(options);

    return response.status(200).json(
      withCollectionContract(result, {
        resource: "imported-bundles",
        pagination,
        filters: normalizeFilters({
          bundleId,
          domain,
          bundleType,
          version,
          createdFrom,
          createdTo,
        }),
        sort,
        tieBreaker: "bundleId:asc",
        legacyKeys: ["bundles"],
        ignoredQueryParameters:
          getUnsupportedQueryParameters(
            request.query,
            importCollectionQueryParameters,
          ),
      }),
    );
  } catch (error) {
    return next(error);
  }
});

importRouter.delete("/:bundleId", requireImportAuthorization, async (request, response, next) => {
  try {
    const bundleId = getRouteParam(request.params.bundleId);

    if (!bundleId.startsWith(INTEGRATION_TEST_PREFIX)) {
      return response.status(403).json({
        deleted: false,
        error: "BUNDLE_DELETE_FORBIDDEN",
        message:
          "Only SourceRoot integration-test bundles may be deleted through this endpoint.",
        requiredPrefix: INTEGRATION_TEST_PREFIX,
      });
    }

    const existingBundle = await getImportedBundle(bundleId);

    if (!existingBundle) {
      return response.status(404).json({
        deleted: false,
        error: "BUNDLE_NOT_FOUND",
        message: `No imported bundle found with ID ${bundleId}.`,
      });
    }

    const deletedCounts = await deleteImportedTestBundle(bundleId);
    const storedBundles = await getImportedBundleCount();

    return response.status(200).json({
      deleted: true,
      bundleId,
      deletedCounts,
      storedBundles,
    });
  } catch (error) {
    return next(error);
  }
});

importRouter.get("/:bundleId", async (request, response, next) => {
  try {
    const bundleId = getRouteParam(request.params.bundleId);
    const bundle = await getImportedBundle(bundleId);

    if (!bundle) {
      return response.status(404).json(
        createApiError(
          "BUNDLE_NOT_FOUND",
          `No imported bundle found with ID ${bundleId}.`,
          404,
          {
            category: "not-found",
            field: "bundleId",
            requestId: response.locals.requestId,
          },
        ),
      );
    }

    return response.status(200).json(bundle);
  } catch (error) {
    return next(error);
  }
});
