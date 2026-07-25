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
  getRevisionById,
  listRevisions,
  type ListRevisionsOptions,
} from "../services/revision-store.js";

export const revisionsRouter = Router();

const revisionSorts = new Set([
  "createdAt",
  "updatedAt",
  "revisionId",
] as const);
const revisionQueryParameters = new Set([
  "page",
  "limit",
  "offset",
  "sort",
  "direction",
  "bundleId",
  "objectType",
  "objectId",
  "revisionType",
  "status",
]);

revisionsRouter.get(
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
          allowedSorts: revisionSorts,
          defaultSort: "createdAt",
          defaultDirection: "desc",
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

      const objectType = getQueryString(
        request.query.objectType,
      );

      const objectId = getQueryString(
        request.query.objectId,
      );

      const revisionType = getQueryString(
        request.query.revisionType,
      );

      const status = getQueryString(
        request.query.status,
      );

      const options: ListRevisionsOptions = {
        page,
        limit,
        offset,
        sort: sort.sort,
        direction: sort.direction,
        ...(bundleId !== undefined
          ? { bundleId }
          : {}),
        ...(objectType !== undefined
          ? { objectType }
          : {}),
        ...(objectId !== undefined
          ? { objectId }
          : {}),
        ...(revisionType !== undefined
          ? { revisionType }
          : {}),
        ...(status !== undefined
          ? { status }
          : {}),
      };

      const result = await listRevisions(
        options,
      );

      return response.status(200).json(
        withCollectionContract(result, {
          resource: "revisions",
          pagination,
          filters: normalizeFilters({
            bundleId,
            objectType,
            objectId,
            revisionType,
            status,
          }),
          sort,
          tieBreaker: "revisionId:asc",
          legacyKeys: ["revisions"],
          ignoredQueryParameters:
            getUnsupportedQueryParameters(
              request.query,
              revisionQueryParameters,
            ),
        }),
      );
    } catch (error) {
      return next(error);
    }
  },
);

revisionsRouter.get(
  "/:revisionId",
  async (request, response, next) => {
    try {
      const revision = await getRevisionById(
        request.params.revisionId,
      );

      if (!revision) {
        return response.status(404).json(
          createApiError(
            "REVISION_NOT_FOUND",
            `No revision found with ID ${request.params.revisionId}.`,
            404,
            {
              category: "not-found",
              field: "revisionId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      return response
        .status(200)
        .json(revision);
    } catch (error) {
      return next(error);
    }
  },
);
