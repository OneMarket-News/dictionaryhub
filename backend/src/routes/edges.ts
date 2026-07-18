import { Router } from "express";

import { getEdgeById } from "../services/edge-store.js";

export const edgesRouter = Router();

edgesRouter.get("/:edgeId", async (request, response, next) => {
  try {
    const edge = await getEdgeById(request.params.edgeId);

    if (!edge) {
      return response.status(404).json({
        error: "EDGE_NOT_FOUND",
        message: `No edge found with ID ${request.params.edgeId}.`,
      });
    }

    return response.status(200).json(edge);
  } catch (error) {
    return next(error);
  }
});