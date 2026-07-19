import { Router } from "express";

import {
  getQueryString,
  isQueryParameterError,
  parsePagination,
} from "../lib/query-params.js";

import {
  getRevisionById,
  listRevisions,
  type ListRevisionsOptions,
} from "../services/revision-store.js";

export const revisionsRouter = Router();


revisionsRouter.get(
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