import { Router } from "express";

import {
  createApiError,
  withCollectionContract,
  withRequestId,
} from "../lib/api-contract.js";
import {
  getUnsupportedQueryParameters,
  getQueryString,
  isQueryParameterError,
  normalizeFilters,
  parsePagination,
  parseSort,
} from "../lib/query-params.js";

import {
  searchKnowledge,
  type SearchOptions,
  type SearchResultType,
} from "../services/search-store.js";

export const searchRouter = Router();

const validSearchTypes =
  new Set<SearchResultType>([
    "node",
    "assertion",
    "edge",
    "source",
    "revision",
    "context-entity",
    "context-account",
    "context-claim",
    "context-interpretation",
    "context-relationship",
  ]);
const searchSorts = new Set(["relevance"] as const);
const searchDirections = new Set(["asc"] as const);
const searchQueryParameters = new Set([
  "q",
  "page",
  "limit",
  "sort",
  "direction",
  "type",
  "bundleId",
  "domain",
]);


searchRouter.get(
  "/",
  async (request, response, next) => {
    try {
      const query = getQueryString(
        request.query.q,
      );

      if (query === undefined) {
        return response.status(400).json(
          createApiError(
            "INVALID_QUERY",
            "q must contain a search term.",
            400,
            {
              category: "invalid-query",
              field: "q",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      const pagination = parsePagination(
        request.query.page,
        request.query.limit,
      );

      if (isQueryParameterError(pagination)) {
        return response.status(400).json(
          withRequestId(pagination, response),
        );
      }

      const { page, limit } = pagination;
      const sort = parseSort(
        request.query.sort,
        request.query.direction,
        {
          allowedSorts: searchSorts,
          allowedDirections: searchDirections,
          defaultSort: "relevance",
        },
      );

      if (isQueryParameterError(sort)) {
        return response.status(400).json(
          withRequestId(sort, response),
        );
      }

      const typeValue = getQueryString(
        request.query.type,
      );

      let type:
        | SearchResultType
        | undefined;

      if (typeValue !== undefined) {
        if (
          !validSearchTypes.has(
            typeValue as SearchResultType,
          )
        ) {
          return response.status(400).json(
            createApiError(
              "INVALID_SEARCH_TYPE",
              "type must be node, assertion, edge, source, or revision.",
              400,
              {
                category: "invalid-filter",
                field: "type",
                requestId: response.locals.requestId,
              },
            ),
          );
        }

        type =
          typeValue as SearchResultType;
      }

      const bundleId = getQueryString(
        request.query.bundleId,
      );

      const domain = getQueryString(
        request.query.domain,
      );

      const options: SearchOptions = {
        query,
        page,
        limit,
        ...(type !== undefined
          ? { type }
          : {}),
        ...(bundleId !== undefined
          ? { bundleId }
          : {}),
        ...(domain !== undefined
          ? { domain }
          : {}),
      };

      const result =
        await searchKnowledge(options);

      return response.status(200).json(
        withCollectionContract(
          {
            ...result,
            items: result.results,
          },
          {
            resource: "search-results",
            pagination: {
              ...pagination,
              page: result.page,
              limit: result.limit,
            },
            filters: normalizeFilters({
              type,
              bundleId,
              domain,
            }),
            sort,
            tieBreaker: "title:asc,resultType:asc,id:asc",
            legacyKeys: ["results"],
            ignoredQueryParameters:
              getUnsupportedQueryParameters(
                request.query,
                searchQueryParameters,
              ),
            metadata: {
              query,
              exactSensePolicy:
                result.exactSensePolicy ?? "registry-only",
            },
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);
