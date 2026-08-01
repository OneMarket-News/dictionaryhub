import { Router } from "express";

import { createApiError } from "../lib/api-contract.js";
import { CrossRootQueryError, getCrossRootCoverage, getCrossRootLinks } from "../services/cross-root-store.js";

export const crossRootRouter = Router();

function value(input: unknown): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim() : undefined;
}

crossRootRouter.get("/coverage", async (_request, response, next) => {
  try {
    response.status(200).json(await getCrossRootCoverage());
  } catch (error) {
    next(error);
  }
});

crossRootRouter.get("/links", async (request, response, next) => {
  const root = value(request.query.root);
  const resourceType = value(request.query.resourceType);
  const resourceId = value(request.query.resourceId);
  if (!root || !resourceType || !resourceId) {
    return response.status(400).json(createApiError(
      "CROSS_ROOT_RESOURCE_REQUIRED",
      "root, resourceType, and resourceId query parameters are required.",
      400,
      { category: "validation-failure", requestId: response.locals.requestId },
    ));
  }
  const rawLimit = Number(value(request.query.limit) ?? "25");
  const rawCursor = Number(value(request.query.cursor) ?? "0");
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100 || !Number.isInteger(rawCursor) || rawCursor < 0) {
    return response.status(400).json(createApiError(
      "CROSS_ROOT_PAGE_INVALID",
      "limit must be an integer from 1 through 100 and cursor must be a nonnegative integer.",
      400,
      { category: "validation-failure", requestId: response.locals.requestId },
    ));
  }
  try {
    const targetRoot = value(request.query.targetRoot);
    return response.status(200).json(await getCrossRootLinks({
      root,
      resourceType,
      resourceId,
      ...(targetRoot ? { targetRoot } : {}),
      limit: rawLimit,
      cursor: rawCursor,
    }));
  } catch (error) {
    if (error instanceof CrossRootQueryError) {
      return response.status(error.status).json(createApiError(
        error.code.toUpperCase().replaceAll("-", "_"),
        error.message,
        error.status,
        { category: error.status === 404 ? "not-found" : "validation-failure", requestId: response.locals.requestId },
      ));
    }
    return next(error);
  }
});
