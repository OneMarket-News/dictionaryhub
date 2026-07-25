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

import { getAssertionsByNodeId } from "../services/assertion-store.js";
import { getEdgesByNodeId } from "../services/edge-store.js";
import {
  getDictionaryRootLexicalAssertionsByNodeId,
  getDictionaryRootLexicalEdgesByNodeId,
} from "../services/lexical-store.js";
import {
  getNodeById,
  listNodes,
  type ListNodesOptions,
} from "../services/node-store.js";

export const nodesRouter = Router();

const nodeSorts = new Set([
  "title",
  "createdAt",
  "updatedAt",
  "nodeId",
] as const);
const nodeQueryParameters = new Set([
  "page",
  "limit",
  "offset",
  "sort",
  "direction",
  "bundleId",
  "domain",
  "nodeType",
  "status",
]);

nodesRouter.get("/", async (request, response, next) => {
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
        allowedSorts: nodeSorts,
        defaultSort: "title",
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

    const nodeType = getQueryString(
      request.query.nodeType,
    );

    const status = getQueryString(
      request.query.status,
    );

    const options: ListNodesOptions = {
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
      ...(nodeType !== undefined
        ? { nodeType }
        : {}),
      ...(status !== undefined
        ? { status }
        : {}),
    };

    const result = await listNodes(options);

    return response.status(200).json(
      withCollectionContract(result, {
        resource: "nodes",
        pagination,
        filters: normalizeFilters({
          bundleId,
          domain,
          nodeType,
          status,
        }),
        sort,
        tieBreaker: "nodeId:asc",
        legacyKeys: ["nodes"],
        ignoredQueryParameters:
          getUnsupportedQueryParameters(
            request.query,
            nodeQueryParameters,
          ),
      }),
    );
  } catch (error) {
    return next(error);
  }
});

nodesRouter.get(
  "/:nodeId/assertions",
  async (request, response, next) => {
    try {
      const { nodeId } = request.params;

      const node = await getNodeById(nodeId);

      if (!node) {
        return response.status(404).json(
          createApiError(
            "NODE_NOT_FOUND",
            `No node found with ID ${nodeId}.`,
            404,
            {
              category: "not-found",
              field: "nodeId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      let assertions =
        await getAssertionsByNodeId(nodeId);

      if (assertions.length === 0) {
        assertions = await getDictionaryRootLexicalAssertionsByNodeId(nodeId);
      }

      return response.status(200).json({
        nodeId,
        total: assertions.length,
        assertions,
      });
    } catch (error) {
      return next(error);
    }
  },
);

nodesRouter.get(
  "/:nodeId/edges",
  async (request, response, next) => {
    try {
      const { nodeId } = request.params;

      const node = await getNodeById(nodeId);

      if (!node) {
        return response.status(404).json(
          createApiError(
            "NODE_NOT_FOUND",
            `No node found with ID ${nodeId}.`,
            404,
            {
              category: "not-found",
              field: "nodeId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      let edges = await getEdgesByNodeId(nodeId);

      if (edges.incoming.length === 0 && edges.outgoing.length === 0) {
        edges = await getDictionaryRootLexicalEdgesByNodeId(nodeId);
      }

      return response.status(200).json({
        nodeId,
        total:
          edges.incoming.length +
          edges.outgoing.length,
        incomingTotal: edges.incoming.length,
        outgoingTotal: edges.outgoing.length,
        incoming: edges.incoming,
        outgoing: edges.outgoing,
      });
    } catch (error) {
      return next(error);
    }
  },
);

nodesRouter.get(
  "/:nodeId",
  async (request, response, next) => {
    try {
      const node = await getNodeById(
        request.params.nodeId,
      );

      if (!node) {
        return response.status(404).json(
          createApiError(
            "NODE_NOT_FOUND",
            `No node found with ID ${request.params.nodeId}.`,
            404,
            {
              category: "not-found",
              field: "nodeId",
              requestId: response.locals.requestId,
            },
          ),
        );
      }

      return response.status(200).json(node);
    } catch (error) {
      return next(error);
    }
  },
);
