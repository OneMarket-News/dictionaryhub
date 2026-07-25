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
  getEdgeById,
  listEdges,
  type ListEdgesOptions,
} from "../services/edge-store.js";

export const edgesRouter = Router();

const edgeSorts = new Set([
  "label",
  "createdAt",
  "updatedAt",
  "edgeId",
] as const);
const edgeQueryParameters = new Set([
  "page",
  "limit",
  "offset",
  "sort",
  "direction",
  "bundleId",
  "fromNodeId",
  "toNodeId",
  "sourceId",
  "domain",
  "relationshipType",
  "reviewStatus",
  "verificationStatus",
  "supportLevel",
  "relationshipStrength",
  "interpretationLevel",
]);

edgesRouter.get(
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
          allowedSorts: edgeSorts,
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

      const fromNodeId = getQueryString(
        request.query.fromNodeId,
      );

      const toNodeId = getQueryString(
        request.query.toNodeId,
      );

      const sourceId = getQueryString(
        request.query.sourceId,
      );

      const domain = getQueryString(
        request.query.domain,
      );

      const relationshipType = getQueryString(
        request.query.relationshipType,
      );

      const reviewStatus = getQueryString(
        request.query.reviewStatus,
      );

      const verificationStatus = getQueryString(
        request.query.verificationStatus,
      );

      const supportLevel = getQueryString(
        request.query.supportLevel,
      );

      const relationshipStrength = getQueryString(
        request.query.relationshipStrength,
      );

      const interpretationLevel = getQueryString(
        request.query.interpretationLevel,
      );

      const options: ListEdgesOptions = {
        page,
        limit,
        offset,
        sort: sort.sort,
        direction: sort.direction,
        ...(bundleId !== undefined
          ? { bundleId }
          : {}),
        ...(fromNodeId !== undefined
          ? { fromNodeId }
          : {}),
        ...(toNodeId !== undefined
          ? { toNodeId }
          : {}),
        ...(sourceId !== undefined
          ? { sourceId }
          : {}),
        ...(domain !== undefined
          ? { domain }
          : {}),
        ...(relationshipType !== undefined
          ? { relationshipType }
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
        ...(relationshipStrength !== undefined
          ? { relationshipStrength }
          : {}),
        ...(interpretationLevel !== undefined
          ? { interpretationLevel }
          : {}),
      };

      const result = await listEdges(options);

      return response.status(200).json(
        withCollectionContract(result, {
          resource: "edges",
          pagination,
          filters: normalizeFilters({
            bundleId,
            fromNodeId,
            toNodeId,
            sourceId,
            domain,
            relationshipType,
            reviewStatus,
            verificationStatus,
            supportLevel,
            relationshipStrength,
            interpretationLevel,
          }),
          sort,
          tieBreaker: "edgeId:asc",
          legacyKeys: ["edges"],
          ignoredQueryParameters:
            getUnsupportedQueryParameters(
              request.query,
              edgeQueryParameters,
            ),
        }),
      );
    } catch (error) {
      return next(error);
    }
  },
);

edgesRouter.get(
  "/:edgeId",
  async (request, response, next) => {
    try {
      const edge = await getEdgeById(
        request.params.edgeId,
      );

      if (!edge) {
        return response.status(404).json(
          createApiError(
            "EDGE_NOT_FOUND",
            `No edge found with ID ${request.params.edgeId}.`,
            404,
            {
              category: "not-found",
              field: "edgeId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      return response
        .status(200)
        .json(edge);
    } catch (error) {
      return next(error);
    }
  },
);
