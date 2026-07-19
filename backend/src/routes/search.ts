import { Router } from "express";

import {
  searchKnowledge,
  type SearchOptions,
  type SearchResultType,
} from "../services/search-store.js";

export const searchRouter = Router();

const validSearchTypes =
  new Set<SearchResultType>([
    "node",
    "assertion",
    "edge",
    "source",
    "revision",
  ]);

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

searchRouter.get(
  "/",
  async (request, response, next) => {
    try {
      const query = getQueryString(
        request.query.q,
      );

      if (query === undefined) {
        return response.status(400).json({
          error: "INVALID_QUERY",
          message:
            "q must contain a search term.",
        });
      }

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

      const typeValue = getQueryString(
        request.query.type,
      );

      let type:
        | SearchResultType
        | undefined;

      if (typeValue !== undefined) {
        if (
          !validSearchTypes.has(
            typeValue as SearchResultType,
          )
        ) {
          return response.status(400).json({
            error: "INVALID_SEARCH_TYPE",
            message:
              "type must be node, assertion, edge, source, or revision.",
          });
        }

        type =
          typeValue as SearchResultType;
      }

      const bundleId = getQueryString(
        request.query.bundleId,
      );

      const domain = getQueryString(
        request.query.domain,
      );

      const options: SearchOptions = {
        query,
        page,
        limit,
        ...(type !== undefined
          ? { type }
          : {}),
        ...(bundleId !== undefined
          ? { bundleId }
          : {}),
        ...(domain !== undefined
          ? { domain }
          : {}),
      };

      const result =
        await searchKnowledge(options);

      return response
        .status(200)
        .json(result);
    } catch (error) {
      return next(error);
    }
  },
);