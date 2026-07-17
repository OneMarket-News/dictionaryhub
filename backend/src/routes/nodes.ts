import { Router } from "express";

import { getAssertionsByNodeId } from "../services/assertion-store.js";
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