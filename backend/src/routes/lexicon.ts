import { Router } from "express";

import {
  getQueryString,
  isQueryParameterError,
  parsePagination,
} from "../lib/query-params.js";
import {
  getDictionaryRootCoverageDashboard,
  getDictionaryRootLemmaCoverage,
  getDictionaryRootLexiconStatus,
  listDictionaryRootLemmaCoverage,
  type DictionaryRootHistoryCoverageFilter,
  type DictionaryRootLemmaCoverageFilter,
  type DictionaryRootLemmaCoverageSort,
  type DictionaryRootReviewCoverageFilter,
  type DictionaryRootSourceCoverageFilter,
} from "../services/lexical-store.js";

export const lexiconRouter = Router();

const coverageFilters = new Set<DictionaryRootLemmaCoverageFilter>([
  "all",
  "complete",
  "incomplete",
  "partial",
  "lexical-only",
]);
const sourceFilters = new Set<DictionaryRootSourceCoverageFilter>([
  "all",
  "source-backed",
  "unsupported",
]);
const historyFilters = new Set<DictionaryRootHistoryCoverageFilter>([
  "all",
  "with-history",
  "no-history",
]);
const reviewFilters = new Set<DictionaryRootReviewCoverageFilter>([
  "all",
  "reviewed",
  "needs-review",
]);
const coverageSorts = new Set<DictionaryRootLemmaCoverageSort>([
  "gaps",
  "coverage",
  "senses",
  "lemma",
]);

function validatedFilter<T extends string>(
  rawValue: unknown,
  fallback: T,
  allowed: Set<T>,
): T | undefined {
  const value = getQueryString(rawValue) || fallback;
  return allowed.has(value as T) ? (value as T) : undefined;
}

lexiconRouter.get("/status", async (request, response, next) => {
  try {
    const bundleId = getQueryString(request.query.bundleId);
    const status = await getDictionaryRootLexiconStatus(bundleId);
    return response.status(200).json(status);
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/coverage", async (request, response, next) => {
  try {
    const query = getQueryString(request.query.q);
    if (query === undefined) {
      return response.status(400).json({
        error: "INVALID_QUERY",
        message: "q must contain a lemma to inspect.",
      });
    }
    const bundleId = getQueryString(request.query.bundleId);
    const coverage = await getDictionaryRootLemmaCoverage(query, bundleId);
    return response.status(200).json(coverage);
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/dashboard", async (request, response, next) => {
  try {
    const bundleId = getQueryString(request.query.bundleId);
    const dashboard = await getDictionaryRootCoverageDashboard(bundleId);
    return response.status(200).json(dashboard);
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/lemmas", async (request, response, next) => {
  try {
    const pagination = parsePagination(request.query.page, request.query.limit, {
      limit: 25,
      maxLimit: 100,
    });
    if (isQueryParameterError(pagination)) {
      return response.status(400).json(pagination);
    }

    const coverage = validatedFilter(request.query.coverage, "all", coverageFilters);
    const source = validatedFilter(request.query.source, "all", sourceFilters);
    const history = validatedFilter(request.query.history, "all", historyFilters);
    const review = validatedFilter(request.query.review, "all", reviewFilters);
    const sort = validatedFilter(request.query.sort, "gaps", coverageSorts);

    if (!coverage || !source || !history || !review || !sort) {
      return response.status(400).json({
        error: "INVALID_FILTER",
        message: "Coverage dashboard filters contain an unsupported value.",
      });
    }

    const result = await listDictionaryRootLemmaCoverage({
      page: pagination.page,
      limit: pagination.limit,
      bundleId: getQueryString(request.query.bundleId),
      query: getQueryString(request.query.q),
      partOfSpeech: getQueryString(request.query.partOfSpeech),
      coverage,
      source,
      history,
      review,
      sort,
    });
    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});
