import { Router } from "express";

import { getAssertionsByNodeId } from "../services/assertion-store.js";
import { getEdgesByNodeId } from "../services/edge-store.js";
import {
  getNodeById,
  listNodes,
  type ListNodesOptions,
} from "../services/node-store.js";

export const nodesRouter = Router();

function getQueryString(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0
    ? trimmedValue
    : undefined;
}

function parsePositiveInteger(
  value: unknown,
  defaultValue: number,
): number | undefined {
  if (value === undefined) {
    return defaultValue;
  }

  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value)
  ) {
    return undefined;
  }

  const parsedValue = Number(value);

  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue < 1
  ) {
    return undefined;
  }

  return parsedValue;
}

nodesRouter.get("/", async (request, response, next) => {
  try {
    const page = parsePositiveInteger(
      request.query.page,
      1,
    );

    if (page === undefined) {
      return response.status(400).json({
        error: "INVALID_PAGE",
        message: "page must be a positive integer.",
      });
    }

    const limit = parsePositiveInteger(
      request.query.limit,
      25,
    );

    if (
      limit === undefined ||
      limit > 100
    ) {
      return response.status(400).json({
        error: "INVALID_LIMIT",
        message:
          "limit must be an integer between 1 and 100.",
      });
    }

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

    return response.status(200).json(result);
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
        return response.status(404).json({
          error: "NODE_NOT_FOUND",
          message: `No node found with ID ${nodeId}.`,
        });
      }

      const assertions =
        await getAssertionsByNodeId(nodeId);

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
        return response.status(404).json({
          error: "NODE_NOT_FOUND",
          message: `No node found with ID ${nodeId}.`,
        });
      }

      const edges = await getEdgesByNodeId(nodeId);

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
        return response.status(404).json({
          error: "NODE_NOT_FOUND",
          message: `No node found with ID ${request.params.nodeId}.`,
        });
      }

      return response.status(200).json(node);
    } catch (error) {
      return next(error);
    }
  },
);