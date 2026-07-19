import { Router } from "express";

import {
  getQueryString,
  isQueryParameterError,
  parsePagination,
} from "../lib/query-params.js";

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

      const pagination = parsePagination(
        request.query.page,
        request.query.limit,
      );

      if (isQueryParameterError(pagination)) {
        return response.status(400).json(pagination);
      }

      const { page, limit } = pagination;

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