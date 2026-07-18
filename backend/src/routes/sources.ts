import { Router } from "express";

import { getSourceById } from "../services/source-store.js";

export const sourcesRouter = Router();

sourcesRouter.get("/:sourceId", async (request, response, next) => {
  try {
    const source = await getSourceById(request.params.sourceId);

    if (!source) {
      return response.status(404).json({
        error: "SOURCE_NOT_FOUND",
        message: `No source found with ID ${request.params.sourceId}.`,
      });
    }

    return response.status(200).json(source);
  } catch (error) {
    return next(error);
  }
});