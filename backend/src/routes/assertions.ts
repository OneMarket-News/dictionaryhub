import { Router } from "express";

import { getAssertionById } from "../services/assertion-store.js";

export const assertionsRouter = Router();

assertionsRouter.get(
  "/:assertionId",
  async (request, response, next) => {
    try {
      const assertion = await getAssertionById(
        request.params.assertionId,
      );

      if (!assertion) {
        return response.status(404).json({
          error: "ASSERTION_NOT_FOUND",
          message: `No assertion found with ID ${request.params.assertionId}.`,
        });
      }

      return response.status(200).json(assertion);
    } catch (error) {
      return next(error);
    }
  },
);