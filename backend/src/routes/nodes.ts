import { Router } from "express";

import { getAssertionsByNodeId } from "../services/assertion-store.js";
import { getEdgesByNodeId } from "../services/edge-store.js";
import { getNodeById } from "../services/node-store.js";

export const nodesRouter = Router();

nodesRouter.get("/:nodeId/assertions", async (request, response, next) => {
  try {
    const { nodeId } = request.params;

    const node = await getNodeById(nodeId);

    if (!node) {
      return response.status(404).json({
        error: "NODE_NOT_FOUND",
        message: `No node found with ID ${nodeId}.`,
      });
    }

    const assertions = await getAssertionsByNodeId(nodeId);

    return response.status(200).json({
      nodeId,
      total: assertions.length,
      assertions,
    });
  } catch (error) {
    return next(error);
  }
});

nodesRouter.get("/:nodeId/edges", async (request, response, next) => {
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
      total: edges.incoming.length + edges.outgoing.length,
      incomingTotal: edges.incoming.length,
      outgoingTotal: edges.outgoing.length,
      incoming: edges.incoming,
      outgoing: edges.outgoing,
    });
  } catch (error) {
    return next(error);
  }
});

nodesRouter.get("/:nodeId", async (request, response, next) => {
  try {
    const node = await getNodeById(request.params.nodeId);

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
});