import { Router } from "express";

import { createApiError } from "../lib/api-contract.js";
import { CrossRootQueryError, getCrossRootCoverage, getCrossRootLinks } from "../services/cross-root-store.js";
import {
  CrossRootRelationshipQueryError,
  getCrossRootRelationship,
  getCrossRootRelationshipCoverage,
  getCrossRootRelationships,
} from "../services/cross-root-relationship-store.js";

export const crossRootRouter = Router();

function value(input: unknown): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim() : undefined;
}

function booleanValue(input: unknown, name: string): boolean | undefined {
  const text = value(input);
  if (text === undefined) return undefined;
  if (text === "true") return true;
  if (text === "false") return false;
  throw new CrossRootRelationshipQueryError("relationship-filter-invalid", `${name} must be true or false.`);
}

function relationshipError(error: unknown, response: import("express").Response, next: import("express").NextFunction) {
  if (error instanceof CrossRootRelationshipQueryError) {
    return response.status(error.status).json(createApiError(
      error.code.toUpperCase().replaceAll("-", "_"), error.message, error.status,
      { category:error.status === 404 ? "not-found" : "validation-failure", requestId:response.locals.requestId },
    ));
  }
  return next(error);
}

crossRootRouter.get("/relationships/coverage", async (_request, response, next) => {
  try { response.status(200).json(await getCrossRootRelationshipCoverage()); } catch (error) { next(error); }
});

crossRootRouter.get("/relationships", async (request, response, next) => {
  try {
    const page=Number(value(request.query.page) ?? "1");
    const pageSize=Number(value(request.query.pageSize) ?? "25");
    if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100) {
      throw new CrossRootRelationshipQueryError("relationship-page-invalid","page must be positive and pageSize must be an integer from 1 through 100.");
    }
    const resourceId=value(request.query.resourceId);
    const subjectId=value(request.query.subjectId);
    const objectId=value(request.query.objectId);
    const relationshipFamily=value(request.query.relationshipFamily);
    const predicate=value(request.query.predicate);
    const reviewState=value(request.query.reviewState);
    const derivation=value(request.query.derivation);
    const disputed=booleanValue(request.query.disputed,"disputed");
    const causal=booleanValue(request.query.causal,"causal");
    const root=value(request.query.root);
    return response.status(200).json(await getCrossRootRelationships({
      ...(resourceId?{resourceId}:{}),...(subjectId?{subjectId}:{}),...(objectId?{objectId}:{}),
      ...(relationshipFamily?{relationshipFamily}:{}),...(predicate?{predicate}:{}),
      ...(reviewState?{reviewState}:{}),...(derivation?{derivation}:{}),
      ...(disputed!==undefined?{disputed}:{}),...(causal!==undefined?{causal}:{}),
      ...(root?{root}:{}),page,pageSize,
    }));
  } catch(error) { return relationshipError(error,response,next); }
});

crossRootRouter.get("/relationships/:assertionId", async (request, response, next) => {
  try { return response.status(200).json(await getCrossRootRelationship(request.params.assertionId)); }
  catch(error) { return relationshipError(error,response,next); }
});

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
