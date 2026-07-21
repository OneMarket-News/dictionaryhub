import { Router, type Response } from "express";
import { z } from "zod";

import { getQueryString, isQueryParameterError, parsePagination } from "../lib/query-params.js";
import { requireDictionaryRootAuth } from "../middleware/auth-context.js";
import {
  getDictionaryRootEditorialDetail,
  getDictionaryRootEditorialSummary,
  listDictionaryRootEditorialQueue,
  promoteDictionaryRootEditorialMeaning,
  saveDictionaryRootEditorialReview,
  type DictionaryRootEditorialCategory,
  type DictionaryRootEditorialSort,
  type DictionaryRootEditorialStatus,
} from "../services/editorial-store.js";
import { hasPermission, isVerifiedHuman } from "../services/identity-store.js";

export const editorialRouter = Router();

const statuses = new Set<DictionaryRootEditorialStatus | "all">([
  "all", "unreviewed", "in_review", "approved", "flagged", "rejected",
]);
const categories = new Set<DictionaryRootEditorialCategory>([
  "all", "lexical-only", "missing-history", "needs-review", "promotion-candidates", "source-issues",
]);
const sorts = new Set<DictionaryRootEditorialSort>(["priority", "updated", "lemma"]);

const reviewSchema = z.object({
  status: z.enum(["unreviewed", "in_review", "approved", "flagged", "rejected"]),
  notes: z.string().trim().max(5000).default(""),
  annotation: z.string().trim().max(5000).default(""),
  promotionRecommendation: z.boolean().default(false),
});

const promotionSchema = z.object({
  note: z.string().trim().max(2000).default(""),
});

function permissionDenied(response: Response, permission: string) {
  const auth = response.locals.dictionaryRootAuth;
  return response.status(403).json({
    error: "PERMISSION_DENIED",
    message: `The active identity does not have the ${permission} permission.`,
    permission,
    actorId: auth?.actor.actorId,
    requestId: response.locals.requestId,
  });
}

function verifiedHumanDenied(response: Response, action: string) {
  const auth = response.locals.dictionaryRootAuth;
  return response.status(403).json({
    error: "VERIFIED_HUMAN_REQUIRED",
    message: `${action} requires a verified-human identity. Autonomous agents may submit recommendations but cannot finalize this action.`,
    actorType: auth?.actor.actorType,
    verificationLevel: auth?.actor.verificationLevel,
    requestId: response.locals.requestId,
  });
}

editorialRouter.get("/summary", async (request, response, next) => {
  try {
    const summary = await getDictionaryRootEditorialSummary(getQueryString(request.query.bundleId));
    return response.status(200).json(summary);
  } catch (error) {
    return next(error);
  }
});

editorialRouter.get("/queue", async (request, response, next) => {
  try {
    const pagination = parsePagination(request.query.page, request.query.limit, { limit: 20, maxLimit: 100 });
    if (isQueryParameterError(pagination)) return response.status(400).json(pagination);
    const status = (getQueryString(request.query.status) || "all") as DictionaryRootEditorialStatus | "all";
    const category = (getQueryString(request.query.category) || "needs-review") as DictionaryRootEditorialCategory;
    const sort = (getQueryString(request.query.sort) || "priority") as DictionaryRootEditorialSort;
    if (!statuses.has(status) || !categories.has(category) || !sorts.has(sort)) {
      return response.status(400).json({ error: "INVALID_FILTER", message: "Editorial queue filters contain an unsupported value." });
    }
    const bundleId = getQueryString(request.query.bundleId);
    const query = getQueryString(request.query.q);
    const partOfSpeech = getQueryString(request.query.partOfSpeech);
    const result = await listDictionaryRootEditorialQueue({
      page: pagination.page,
      limit: pagination.limit,
      status,
      category,
      sort,
      ...(bundleId !== undefined ? { bundleId } : {}),
      ...(query !== undefined ? { query } : {}),
      ...(partOfSpeech !== undefined ? { partOfSpeech } : {}),
    });
    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

editorialRouter.get("/reviews/:nodeId", async (request, response, next) => {
  try {
    const detail = await getDictionaryRootEditorialDetail(request.params.nodeId);
    if (!detail) return response.status(404).json({ error: "NODE_NOT_FOUND", message: `No DictionaryRoot meaning found with ID ${request.params.nodeId}.` });
    return response.status(200).json(detail);
  } catch (error) {
    return next(error);
  }
});

editorialRouter.put("/reviews/:nodeId", requireDictionaryRootAuth, async (request, response, next) => {
  try {
    const parsed = reviewSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_REVIEW", message: "Review status, notes, or annotations are invalid.", details: parsed.error.issues });
    const auth = response.locals.dictionaryRootAuth;
    if (!auth) return response.status(401).json({ error: "AUTHENTICATION_REQUIRED", message: "Sign in before saving a review." });

    const finalDecision = parsed.data.status === "approved" || parsed.data.status === "rejected";
    if (finalDecision) {
      if (!hasPermission(auth, "editorial.approve")) return permissionDenied(response, "editorial.approve");
      if (!isVerifiedHuman(auth)) return verifiedHumanDenied(response, "Final editorial approval or rejection");
    } else if (!hasPermission(auth, "editorial.review") && !hasPermission(auth, "agent.submit")) {
      return permissionDenied(response, "editorial.review");
    }

    if (getQueryString(request.query.dryRun) === "true") {
      return response.status(200).json({
        valid: true,
        nodeId: request.params.nodeId,
        review: parsed.data,
        actor: auth.actor,
        delegation: auth.delegation,
        dryRun: true,
      });
    }
    const nodeId = String(request.params.nodeId || "");
    const detail = await saveDictionaryRootEditorialReview(nodeId, parsed.data, auth);
    if (!detail) return response.status(404).json({ error: "NODE_NOT_FOUND", message: `No DictionaryRoot meaning found with ID ${request.params.nodeId}.` });
    return response.status(200).json(detail);
  } catch (error) {
    return next(error);
  }
});

editorialRouter.post("/reviews/:nodeId/promote", requireDictionaryRootAuth, async (request, response, next) => {
  try {
    const parsed = promotionSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_PROMOTION", message: "Promotion details are invalid.", details: parsed.error.issues });
    const auth = response.locals.dictionaryRootAuth;
    if (!auth) return response.status(401).json({ error: "AUTHENTICATION_REQUIRED", message: "Sign in before promoting a meaning." });
    if (!hasPermission(auth, "graph.promote")) return permissionDenied(response, "graph.promote");
    if (!isVerifiedHuman(auth)) return verifiedHumanDenied(response, "Curated graph promotion");

    if (getQueryString(request.query.dryRun) === "true") {
      return response.status(200).json({
        valid: true,
        nodeId: request.params.nodeId,
        promotion: parsed.data,
        actor: auth.actor,
        delegation: auth.delegation,
        dryRun: true,
      });
    }
    const nodeId = String(request.params.nodeId || "");
    const result = await promoteDictionaryRootEditorialMeaning(nodeId, auth, parsed.data.note);
    if (!result) return response.status(404).json({ error: "NODE_NOT_FOUND", message: `No DictionaryRoot meaning found with ID ${request.params.nodeId}.` });
    return response.status(result.alreadyPromoted ? 200 : 201).json(result);
  } catch (error) {
    const statusCode = error && typeof error === "object" && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
    if (statusCode === 409) return response.status(409).json({ error: "REVIEW_NOT_APPROVED", message: error instanceof Error ? error.message : "Only approved meanings can be promoted." });
    return next(error);
  }
});
