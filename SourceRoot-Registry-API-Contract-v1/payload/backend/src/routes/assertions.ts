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
  getAssertionById,
  listAssertions,
  type ListAssertionsOptions,
} from "../services/assertion-store.js";

export const assertionsRouter = Router();

const assertionSorts = new Set([
  "label",
  "createdAt",
  "updatedAt",
  "assertionId",
] as const);
const assertionQueryParameters = new Set([
  "page",
  "limit",
  "offset",
  "sort",
  "direction",
  "bundleId",
  "nodeId",
  "sourceId",
  "domain",
  "assertionType",
  "reviewStatus",
  "verificationStatus",
  "supportLevel",
  "interpretationLevel",
]);

assertionsRouter.get(
  "/",
  async (request, response, next) => {
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
          allowedSorts: assertionSorts,
          defaultSort: "label",
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

      const nodeId = getQueryString(
        request.query.nodeId,
      );

      const sourceId = getQueryString(
        request.query.sourceId,
      );

      const domain = getQueryString(
        request.query.domain,
      );

      const assertionType = getQueryString(
        request.query.assertionType,
      );

      const reviewStatus = getQueryString(
        request.query.reviewStatus,
      );

      const verificationStatus =
        getQueryString(
          request.query.verificationStatus,
        );

      const supportLevel = getQueryString(
        request.query.supportLevel,
      );

      const interpretationLevel =
        getQueryString(
          request.query.interpretationLevel,
        );

      const options: ListAssertionsOptions = {
        page,
        limit,
        offset,
        sort: sort.sort,
        direction: sort.direction,
        ...(bundleId !== undefined
          ? { bundleId }
          : {}),
        ...(nodeId !== undefined
          ? { nodeId }
          : {}),
        ...(sourceId !== undefined
          ? { sourceId }
          : {}),
        ...(domain !== undefined
          ? { domain }
          : {}),
        ...(assertionType !== undefined
          ? { assertionType }
          : {}),
        ...(reviewStatus !== undefined
          ? { reviewStatus }
          : {}),
        ...(verificationStatus !== undefined
          ? { verificationStatus }
          : {}),
        ...(supportLevel !== undefined
          ? { supportLevel }
          : {}),
        ...(interpretationLevel !== undefined
          ? { interpretationLevel }
          : {}),
      };

      const result = await listAssertions(
        options,
      );

      return response.status(200).json(
        withCollectionContract(result, {
          resource: "assertions",
          pagination,
          filters: normalizeFilters({
            bundleId,
            nodeId,
            sourceId,
            domain,
            assertionType,
            reviewStatus,
            verificationStatus,
            supportLevel,
            interpretationLevel,
          }),
          sort,
          tieBreaker: "assertionId:asc",
          legacyKeys: ["assertions"],
          ignoredQueryParameters:
            getUnsupportedQueryParameters(
              request.query,
              assertionQueryParameters,
            ),
        }),
      );
    } catch (error) {
      return next(error);
    }
  },
);

assertionsRouter.get(
  "/:assertionId",
  async (request, response, next) => {
    try {
      const assertion =
        await getAssertionById(
          request.params.assertionId,
        );

      if (!assertion) {
        return response.status(404).json(
          createApiError(
            "ASSERTION_NOT_FOUND",
            `No assertion found with ID ${request.params.assertionId}.`,
            404,
            {
              category: "not-found",
              field: "assertionId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      return response
        .status(200)
        .json(assertion);
    } catch (error) {
      return next(error);
    }
  },
);
