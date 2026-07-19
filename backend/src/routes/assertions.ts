import { Router } from "express";

import {
  getAssertionById,
  listAssertions,
  type ListAssertionsOptions,
} from "../services/assertion-store.js";

export const assertionsRouter = Router();

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

assertionsRouter.get(
  "/",
  async (request, response, next) => {
    try {
      const page = parsePositiveInteger(
        request.query.page,
        1,
      );

      if (page === undefined) {
        return response.status(400).json({
          error: "INVALID_PAGE",
          message:
            "page must be a positive integer.",
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