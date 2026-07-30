import { Router } from "express";

import {
  createApiError,
  withRequestId,
} from "../lib/api-contract.js";
import {
  getQueryString,
  isQueryParameterError,
  parsePagination,
} from "../lib/query-params.js";
import {
  searchUnified,
  UNIFIED_RESULT_TYPES,
  UNIFIED_ROOT_IDS,
  UNIFIED_SEARCH_DEFAULT_LIMIT,
  UNIFIED_SEARCH_MAX_LIMIT,
  UNIFIED_SEARCH_MAX_PAGE,
  UNIFIED_SEARCH_MAX_QUERY_LENGTH,
  type UnifiedResultType,
  type UnifiedRootId,
} from "../services/unified-search.js";

export const unifiedSearchRouter = Router();

const rootLookup = new Map(
  UNIFIED_ROOT_IDS.map((root) => [root.toLocaleLowerCase(), root]),
);
const resultTypeLookup = new Map(
  UNIFIED_RESULT_TYPES.map((type) => [type.toLocaleLowerCase(), type]),
);
const supportedParameters = new Set([
  "q",
  "roots",
  "resultTypes",
  "page",
  "limit",
]);

function listValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((entry): entry is string => typeof entry === "string")
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unique<T>(items: T[]): T[] {
  return items.filter((item, index) => items.indexOf(item) === index);
}

unifiedSearchRouter.get("/", async (request, response, next) => {
  try {
    const query = getQueryString(request.query.q);
    if (query === undefined) {
      return response.status(400).json(
        createApiError(
          "INVALID_QUERY",
          "q must contain a unified search term.",
          400,
          {
            category: "invalid-query",
            field: "q",
            requestId: response.locals.requestId,
          },
        ),
      );
    }
    if (query.length > UNIFIED_SEARCH_MAX_QUERY_LENGTH) {
      return response.status(400).json(
        createApiError(
          "INVALID_QUERY",
          `q must contain at most ${UNIFIED_SEARCH_MAX_QUERY_LENGTH} characters.`,
          400,
          {
            category: "invalid-query",
            field: "q",
            details: { maximumLength: UNIFIED_SEARCH_MAX_QUERY_LENGTH },
            requestId: response.locals.requestId,
          },
        ),
      );
    }

    const pagination = parsePagination(
      request.query.page,
      request.query.limit,
      {
        limit: UNIFIED_SEARCH_DEFAULT_LIMIT,
        maxLimit: UNIFIED_SEARCH_MAX_LIMIT,
      },
    );
    if (isQueryParameterError(pagination)) {
      return response.status(400).json(withRequestId(pagination, response));
    }
    if (pagination.page > UNIFIED_SEARCH_MAX_PAGE) {
      return response.status(400).json(
        createApiError(
          "INVALID_PAGE",
          `page must be an integer between 1 and ${UNIFIED_SEARCH_MAX_PAGE}.`,
          400,
          {
            category: "invalid-pagination",
            field: "page",
            details: { value: pagination.page },
            requestId: response.locals.requestId,
          },
        ),
      );
    }

    const requestedRoots = listValues(request.query.roots);
    const invalidRoots = requestedRoots.filter((value) =>
      !rootLookup.has(value.toLocaleLowerCase()));
    if (invalidRoots.length > 0) {
      return response.status(400).json(
        createApiError(
          "INVALID_ROOT_FILTER",
          "roots may contain only DictionaryRoot and HistoryRoot.",
          400,
          {
            category: "invalid-filter",
            field: "roots",
            details: { unsupported: unique(invalidRoots) },
            requestId: response.locals.requestId,
          },
        ),
      );
    }
    const roots = requestedRoots.length === 0
      ? [...UNIFIED_ROOT_IDS]
      : unique(requestedRoots.map((value) =>
          rootLookup.get(value.toLocaleLowerCase()) as UnifiedRootId));

    const requestedTypes = listValues(request.query.resultTypes);
    const invalidTypes = requestedTypes.filter((value) =>
      !resultTypeLookup.has(value.toLocaleLowerCase()));
    if (invalidTypes.length > 0) {
      return response.status(400).json(
        createApiError(
          "INVALID_RESULT_TYPE_FILTER",
          `resultTypes may contain only: ${UNIFIED_RESULT_TYPES.join(", ")}.`,
          400,
          {
            category: "invalid-filter",
            field: "resultTypes",
            details: { unsupported: unique(invalidTypes) },
            requestId: response.locals.requestId,
          },
        ),
      );
    }
    const resultTypes = unique(requestedTypes.map((value) =>
      resultTypeLookup.get(value.toLocaleLowerCase()) as UnifiedResultType));

    const result = await searchUnified({
      query,
      roots,
      resultTypes,
      page: pagination.page,
      limit: pagination.limit,
    });
    const ignoredQueryParameters = Object.keys(request.query)
      .filter((key) => !supportedParameters.has(key))
      .sort();
    const payload = {
      ...result,
      requestId: response.locals.requestId,
      ignoredQueryParameters,
    };
    return response
      .status(result.availability.status === "all-unavailable" ? 503 : 200)
      .json(payload);
  } catch (error) {
    return next(error);
  }
});
