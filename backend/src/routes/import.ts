import { Router, type NextFunction, type Request, type Response } from "express";

import {
  getQueryString,
  getRouteParam,
  isQueryParameterError,
  parsePagination,
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

export const importRouter = Router();

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
  try {
    const bundle = request.body as SourceRootBundle;
    const validation = validateBundle(bundle);

    if (!validation.canImport) {
      return response.status(422).json({
        imported: false,
        validation,
      });
    }

    await saveImportedBundle(bundle);

    const storedBundles = await getImportedBundleCount();

    return response.status(201).json({
      imported: true,
      bundleId: bundle.bundleId,
      storedBundles,
      validation,
    });
  } catch (error) {
    return next(error);
  }
});

importRouter.get("/", async (request, response, next) => {
  try {
    const pagination = parsePagination(
      request.query.page,
      request.query.limit,
    );

    if (isQueryParameterError(pagination)) {
      return response.status(400).json(pagination);
    }

    const createdFrom = getIsoDateQuery(request.query.createdFrom);
    const createdTo = getIsoDateQuery(request.query.createdTo);

    if (createdFrom === null || createdTo === null) {
      return response.status(400).json({
        error: "INVALID_DATE_FILTER",
        message:
          "createdFrom and createdTo must be valid ISO-8601 date or date-time values.",
      });
    }

    const bundleId = getQueryString(request.query.bundleId);
    const domain = getQueryString(request.query.domain);
    const bundleType = getQueryString(request.query.bundleType);
    const version = getQueryString(request.query.version);

    const options: ListImportedBundlesOptions = {
      page: pagination.page,
      limit: pagination.limit,
      ...(bundleId !== undefined ? { bundleId } : {}),
      ...(domain !== undefined ? { domain } : {}),
      ...(bundleType !== undefined ? { bundleType } : {}),
      ...(version !== undefined ? { version } : {}),
      ...(createdFrom !== undefined ? { createdFrom } : {}),
      ...(createdTo !== undefined ? { createdTo } : {}),
    };

    const result = await listImportedBundles(options);

    return response.status(200).json(result);
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
      return response.status(404).json({
        error: "BUNDLE_NOT_FOUND",
        message: `No imported bundle found with ID ${bundleId}.`,
      });
    }

    return response.status(200).json(bundle);
  } catch (error) {
    return next(error);
  }
});
