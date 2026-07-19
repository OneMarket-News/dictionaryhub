import { Router } from "express";

import {
  getSourceById,
  listSources,
  type ListSourcesOptions,
} from "../services/source-store.js";

export const sourcesRouter = Router();

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

sourcesRouter.get("/", async (request, response, next) => {
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

    const sourceType = getQueryString(
      request.query.sourceType,
    );

    const publisher = getQueryString(
      request.query.publisher,
    );

    const reviewStatus = getQueryString(
      request.query.reviewStatus,
    );

    const verificationStatus = getQueryString(
      request.query.verificationStatus,
    );

    const options: ListSourcesOptions = {
      page,
      limit,
      ...(bundleId !== undefined
        ? { bundleId }
        : {}),
      ...(domain !== undefined
        ? { domain }
        : {}),
      ...(sourceType !== undefined
        ? { sourceType }
        : {}),
      ...(publisher !== undefined
        ? { publisher }
        : {}),
      ...(reviewStatus !== undefined
        ? { reviewStatus }
        : {}),
      ...(verificationStatus !== undefined
        ? { verificationStatus }
        : {}),
    };

    const result = await listSources(options);

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

sourcesRouter.get(
  "/:sourceId",
  async (request, response, next) => {
    try {
      const source = await getSourceById(
        request.params.sourceId,
      );

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
  },
);