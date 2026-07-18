import { Router } from "express";

import { getRevisionById } from "../services/revision-store.js";

export const revisionsRouter = Router();

revisionsRouter.get(
  "/:revisionId",
  async (request, response, next) => {
    try {
      const revision = await getRevisionById(
        request.params.revisionId,
      );

      if (!revision) {
        return response.status(404).json({
          error: "REVISION_NOT_FOUND",
          message: `No revision found with ID ${request.params.revisionId}.`,
        });
      }

      return response.status(200).json(revision);
    } catch (error) {
      return next(error);
    }
  },
);