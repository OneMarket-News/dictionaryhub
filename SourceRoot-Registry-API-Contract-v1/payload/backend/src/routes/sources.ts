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
  getSourceById,
  listSources,
  type ListSourcesOptions,
} from "../services/source-store.js";

export const sourcesRouter = Router();

const sourceSorts = new Set([
  "name",
  "createdAt",
  "updatedAt",
  "sourceId",
] as const);
const sourceQueryParameters = new Set([
  "page",
  "limit",
  "offset",
  "sort",
  "direction",
  "bundleId",
  "domain",
  "sourceType",
  "publisher",
  "reviewStatus",
  "verificationStatus",
]);

sourcesRouter.get("/", async (request, response, next) => {
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
        allowedSorts: sourceSorts,
        defaultSort: "name",
      },
    );

    if (isQueryParameterError(sort)) {
      return response.status(400).json(
        withRequestId(sort, response),
      );
    }

    const { page, limit, offset } = pagination;

    const bundleId = getQueryString(
      request.query.bundleId,
    );

    const domain = getQueryString(
      request.query.domain,
    );

    const sourceType = getQueryString(
      request.query.sourceType,
    );

    const publisher = getQueryString(
      request.query.publisher,
    );

    const reviewStatus = getQueryString(
      request.query.reviewStatus,
    );

    const verificationStatus = getQueryString(
      request.query.verificationStatus,
    );

    const options: ListSourcesOptions = {
      page,
      limit,
      offset,
      sort: sort.sort,
      direction: sort.direction,
      ...(bundleId !== undefined
        ? { bundleId }
        : {}),
      ...(domain !== undefined
        ? { domain }
        : {}),
      ...(sourceType !== undefined
        ? { sourceType }
        : {}),
      ...(publisher !== undefined
        ? { publisher }
        : {}),
      ...(reviewStatus !== undefined
        ? { reviewStatus }
        : {}),
      ...(verificationStatus !== undefined
        ? { verificationStatus }
        : {}),
    };

    const result = await listSources(options);

    return response.status(200).json(
      withCollectionContract(result, {
        resource: "sources",
        pagination,
        filters: normalizeFilters({
          bundleId,
          domain,
          sourceType,
          publisher,
          reviewStatus,
          verificationStatus,
        }),
        sort,
        tieBreaker: "sourceId:asc",
        legacyKeys: ["sources"],
        ignoredQueryParameters:
          getUnsupportedQueryParameters(
            request.query,
            sourceQueryParameters,
          ),
      }),
    );
  } catch (error) {
    return next(error);
  }
});

sourcesRouter.get(
  "/:sourceId",
  async (request, response, next) => {
    try {
      const source = await getSourceById(
        request.params.sourceId,
      );

      if (!source) {
        return response.status(404).json(
          createApiError(
            "SOURCE_NOT_FOUND",
            `No source found with ID ${request.params.sourceId}.`,
            404,
            {
              category: "not-found",
              field: "sourceId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      return response.status(200).json(source);
    } catch (error) {
      return next(error);
    }
  },
);
