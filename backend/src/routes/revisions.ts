import { Router } from "express";

import {
  getRevisionById,
  listRevisions,
  type ListRevisionsOptions,
} from "../services/revision-store.js";

export const revisionsRouter = Router();

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

revisionsRouter.get(
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

      const objectType = getQueryString(
        request.query.objectType,
      );

      const objectId = getQueryString(
        request.query.objectId,
      );

      const revisionType = getQueryString(
        request.query.revisionType,
      );

      const status = getQueryString(
        request.query.status,
      );

      const options: ListRevisionsOptions = {
        page,
        limit,
        ...(bundleId !== undefined
          ? { bundleId }
          : {}),
        ...(objectType !== undefined
          ? { objectType }
          : {}),
        ...(objectId !== undefined
          ? { objectId }
          : {}),
        ...(revisionType !== undefined
          ? { revisionType }
          : {}),
        ...(status !== undefined
          ? { status }
          : {}),
      };

      const result = await listRevisions(
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

      return response
        .status(200)
        .json(revision);
    } catch (error) {
      return next(error);
    }
  },
);