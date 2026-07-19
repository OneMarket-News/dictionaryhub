import { Router } from "express";

import {
  getQueryString,
  isQueryParameterError,
  parsePagination,
} from "../lib/query-params.js";

import {
  getSourceById,
  listSources,
  type ListSourcesOptions,
} from "../services/source-store.js";

export const sourcesRouter = Router();


sourcesRouter.get("/", async (request, response, next) => {
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