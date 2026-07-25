import { Router } from "express";

import { getPool } from "../lib/database.js";
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
  listAssertions,
  type ListAssertionsOptions,
} from "../services/assertion-store.js";
import {
  listEdges,
  type ListEdgesOptions,
} from "../services/edge-store.js";
import {
  listNodes,
  type ListNodesOptions,
} from "../services/node-store.js";
import {
  listRevisions,
  type ListRevisionsOptions,
} from "../services/revision-store.js";
import {
  listSources,
  type ListSourcesOptions,
} from "../services/source-store.js";

export const bundlesRouter = Router();

const nodeSorts = new Set(["title", "createdAt", "updatedAt", "nodeId"] as const);
const assertionSorts = new Set(["label", "createdAt", "updatedAt", "assertionId"] as const);
const edgeSorts = new Set(["label", "createdAt", "updatedAt", "edgeId"] as const);
const sourceSorts = new Set(["name", "createdAt", "updatedAt", "sourceId"] as const);
const revisionSorts = new Set(["createdAt", "updatedAt", "revisionId"] as const);
const sharedQueryParameters = ["page", "limit", "offset", "sort", "direction"];

function supportedQueryParameters(filters: string[]) {
  return new Set([...sharedQueryParameters, ...filters]);
}

function bundleNotFound(
  response: Parameters<typeof withRequestId>[1],
  bundleId: string,
) {
  return createApiError(
    "BUNDLE_NOT_FOUND",
    `No imported bundle found with ID ${bundleId}.`,
    404,
    {
      category: "not-found",
      field: "bundleId",
      requestId: response.locals.requestId,
    },
  );
}

function requireDatabase() {
  const database = getPool();

  if (!database) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return database;
}

async function bundleExists(
  bundleId: string,
): Promise<boolean> {
  const database = requireDatabase();

  const result = await database.query<{
    exists: boolean;
  }>(
    `
      SELECT EXISTS(
        SELECT 1
        FROM imported_bundles
        WHERE bundle_id = $1
      ) AS exists;
    `,
    [bundleId],
  );

  return result.rows[0]?.exists ?? false;
}


async function confirmBundle(
  bundleId: string,
): Promise<
  | {
      exists: true;
    }
  | {
      exists: false;
      error: {
        error: "BUNDLE_NOT_FOUND";
        message: string;
      };
    }
> {
  const exists = await bundleExists(bundleId);

  if (!exists) {
    return {
      exists: false,
      error: {
        error: "BUNDLE_NOT_FOUND",
        message: `No imported bundle found with ID ${bundleId}.`,
      },
    };
  }

  return {
    exists: true,
  };
}

bundlesRouter.get(
  "/:bundleId/nodes",
  async (request, response, next) => {
    try {
      const bundleId = request.params.bundleId;
      const bundle = await confirmBundle(bundleId);

      if (!bundle.exists) {
        return response
          .status(404)
          .json(bundleNotFound(response, bundleId));
      }

      const pagination = parsePagination(
        request.query.page,
        request.query.limit,
        { offsetValue: request.query.offset },
      );

      if (isQueryParameterError(pagination)) {
        return response
          .status(400)
          .json(withRequestId(pagination, response));
      }

      const sort = parseSort(
        request.query.sort,
        request.query.direction,
        { allowedSorts: nodeSorts, defaultSort: "title" },
      );

      if (isQueryParameterError(sort)) {
        return response.status(400).json(withRequestId(sort, response));
      }

      const domain = getQueryString(
        request.query.domain,
      );

      const nodeType = getQueryString(
        request.query.nodeType,
      );

      const status = getQueryString(
        request.query.status,
      );

      const options: ListNodesOptions = {
        page: pagination.page,
        limit: pagination.limit,
        offset: pagination.offset,
        sort: sort.sort,
        direction: sort.direction,
        bundleId,
        ...(domain !== undefined
          ? { domain }
          : {}),
        ...(nodeType !== undefined
          ? { nodeType }
          : {}),
        ...(status !== undefined
          ? { status }
          : {}),
      };

      const result = await listNodes(options);

      return response.status(200).json(
        withCollectionContract(
          { bundleId, ...result },
          {
            resource: "bundle-nodes",
            pagination,
            filters: normalizeFilters({ bundleId, domain, nodeType, status }),
            sort,
            tieBreaker: "nodeId:asc",
            legacyKeys: ["nodes"],
            ignoredQueryParameters: getUnsupportedQueryParameters(
              request.query,
              supportedQueryParameters(["domain", "nodeType", "status"]),
            ),
            metadata: { bundleId },
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

bundlesRouter.get(
  "/:bundleId/assertions",
  async (request, response, next) => {
    try {
      const bundleId = request.params.bundleId;
      const bundle = await confirmBundle(bundleId);

      if (!bundle.exists) {
        return response
          .status(404)
          .json(bundleNotFound(response, bundleId));
      }

      const pagination = parsePagination(
        request.query.page,
        request.query.limit,
        { offsetValue: request.query.offset },
      );

      if (isQueryParameterError(pagination)) {
        return response
          .status(400)
          .json(withRequestId(pagination, response));
      }

      const sort = parseSort(
        request.query.sort,
        request.query.direction,
        { allowedSorts: assertionSorts, defaultSort: "label" },
      );

      if (isQueryParameterError(sort)) {
        return response.status(400).json(withRequestId(sort, response));
      }

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
        page: pagination.page,
        limit: pagination.limit,
        offset: pagination.offset,
        sort: sort.sort,
        direction: sort.direction,
        bundleId,
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

      const result =
        await listAssertions(options);

      return response.status(200).json(
        withCollectionContract(
          { bundleId, ...result },
          {
            resource: "bundle-assertions",
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
            ignoredQueryParameters: getUnsupportedQueryParameters(
              request.query,
              supportedQueryParameters([
                "nodeId",
                "sourceId",
                "domain",
                "assertionType",
                "reviewStatus",
                "verificationStatus",
                "supportLevel",
                "interpretationLevel",
              ]),
            ),
            metadata: { bundleId },
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

bundlesRouter.get(
  "/:bundleId/edges",
  async (request, response, next) => {
    try {
      const bundleId = request.params.bundleId;
      const bundle = await confirmBundle(bundleId);

      if (!bundle.exists) {
        return response
          .status(404)
          .json(bundleNotFound(response, bundleId));
      }

      const pagination = parsePagination(
        request.query.page,
        request.query.limit,
        { offsetValue: request.query.offset },
      );

      if (isQueryParameterError(pagination)) {
        return response
          .status(400)
          .json(withRequestId(pagination, response));
      }

      const sort = parseSort(
        request.query.sort,
        request.query.direction,
        { allowedSorts: edgeSorts, defaultSort: "label" },
      );

      if (isQueryParameterError(sort)) {
        return response.status(400).json(withRequestId(sort, response));
      }

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

      const relationshipType =
        getQueryString(
          request.query.relationshipType,
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

      const relationshipStrength =
        getQueryString(
          request.query.relationshipStrength,
        );

      const interpretationLevel =
        getQueryString(
          request.query.interpretationLevel,
        );

      const options: ListEdgesOptions = {
        page: pagination.page,
        limit: pagination.limit,
        offset: pagination.offset,
        sort: sort.sort,
        direction: sort.direction,
        bundleId,
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
        withCollectionContract(
          { bundleId, ...result },
          {
            resource: "bundle-edges",
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
            ignoredQueryParameters: getUnsupportedQueryParameters(
              request.query,
              supportedQueryParameters([
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
              ]),
            ),
            metadata: { bundleId },
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

bundlesRouter.get(
  "/:bundleId/sources",
  async (request, response, next) => {
    try {
      const bundleId = request.params.bundleId;
      const bundle = await confirmBundle(bundleId);

      if (!bundle.exists) {
        return response
          .status(404)
          .json(bundleNotFound(response, bundleId));
      }

      const pagination = parsePagination(
        request.query.page,
        request.query.limit,
        { offsetValue: request.query.offset },
      );

      if (isQueryParameterError(pagination)) {
        return response
          .status(400)
          .json(withRequestId(pagination, response));
      }

      const sort = parseSort(
        request.query.sort,
        request.query.direction,
        { allowedSorts: sourceSorts, defaultSort: "name" },
      );

      if (isQueryParameterError(sort)) {
        return response.status(400).json(withRequestId(sort, response));
      }

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

      const verificationStatus =
        getQueryString(
          request.query.verificationStatus,
        );

      const options: ListSourcesOptions = {
        page: pagination.page,
        limit: pagination.limit,
        offset: pagination.offset,
        sort: sort.sort,
        direction: sort.direction,
        bundleId,
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

      const result =
        await listSources(options);

      return response.status(200).json(
        withCollectionContract(
          { bundleId, ...result },
          {
            resource: "bundle-sources",
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
            ignoredQueryParameters: getUnsupportedQueryParameters(
              request.query,
              supportedQueryParameters([
                "domain",
                "sourceType",
                "publisher",
                "reviewStatus",
                "verificationStatus",
              ]),
            ),
            metadata: { bundleId },
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

bundlesRouter.get(
  "/:bundleId/revisions",
  async (request, response, next) => {
    try {
      const bundleId = request.params.bundleId;
      const bundle = await confirmBundle(bundleId);

      if (!bundle.exists) {
        return response
          .status(404)
          .json(bundleNotFound(response, bundleId));
      }

      const pagination = parsePagination(
        request.query.page,
        request.query.limit,
        { offsetValue: request.query.offset },
      );

      if (isQueryParameterError(pagination)) {
        return response
          .status(400)
          .json(withRequestId(pagination, response));
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
        return response.status(400).json(withRequestId(sort, response));
      }

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
        page: pagination.page,
        limit: pagination.limit,
        offset: pagination.offset,
        sort: sort.sort,
        direction: sort.direction,
        bundleId,
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

      const result =
        await listRevisions(options);

      return response.status(200).json(
        withCollectionContract(
          { bundleId, ...result },
          {
            resource: "bundle-revisions",
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
            ignoredQueryParameters: getUnsupportedQueryParameters(
              request.query,
              supportedQueryParameters([
                "objectType",
                "objectId",
                "revisionType",
                "status",
              ]),
            ),
            metadata: { bundleId },
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);
