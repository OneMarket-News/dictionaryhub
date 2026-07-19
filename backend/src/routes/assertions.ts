import { Router } from "express";

import {
  getQueryString,
  isQueryParameterError,
  parsePagination,
} from "../lib/query-params.js";

import {
  getAssertionById,
  listAssertions,
  type ListAssertionsOptions,
} from "../services/assertion-store.js";

export const assertionsRouter = Router();


assertionsRouter.get(
  "/",
  async (request, response, next) => {
    try {
      const pagination = parsePagination(
        request.query.page,
        request.query.limit,
      );

      if (isQueryParameterError(pagination)) {
        return response.status(400).json(pagination);
      }

      const { page, limit } = pagination;

      const bundleId = getQueryString(
        request.query.bundleId,
      );

      const nodeId = getQueryString(
        request.query.nodeId,
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
        page,
        limit,
        ...(bundleId !== undefined
          ? { bundleId }
          : {}),
        ...(nodeId !== undefined
          ? { nodeId }
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

      const result = await listAssertions(
        options,
      );

      return response
        .status(200)
        .json(result);
    } catch (error) {
      return next(error);
    }
  },
);

assertionsRouter.get(
  "/:assertionId",
  async (request, response, next) => {
    try {
      const assertion =
        await getAssertionById(
          request.params.assertionId,
        );

      if (!assertion) {
        return response.status(404).json({
          error: "ASSERTION_NOT_FOUND",
          message: `No assertion found with ID ${request.params.assertionId}.`,
        });
      }

      return response
        .status(200)
        .json(assertion);
    } catch (error) {
      return next(error);
    }
  },
);