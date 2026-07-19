import { Router } from "express";

import {
  getQueryString,
  isQueryParameterError,
  parsePagination,
} from "../lib/query-params.js";

import {
  getEdgeById,
  listEdges,
  type ListEdgesOptions,
} from "../services/edge-store.js";

export const edgesRouter = Router();


edgesRouter.get(
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

      const fromNodeId = getQueryString(
        request.query.fromNodeId,
      );

      const toNodeId = getQueryString(
        request.query.toNodeId,
      );

      const domain = getQueryString(
        request.query.domain,
      );

      const relationshipType = getQueryString(
        request.query.relationshipType,
      );

      const reviewStatus = getQueryString(
        request.query.reviewStatus,
      );

      const verificationStatus = getQueryString(
        request.query.verificationStatus,
      );

      const supportLevel = getQueryString(
        request.query.supportLevel,
      );

      const relationshipStrength = getQueryString(
        request.query.relationshipStrength,
      );

      const interpretationLevel = getQueryString(
        request.query.interpretationLevel,
      );

      const options: ListEdgesOptions = {
        page,
        limit,
        ...(bundleId !== undefined
          ? { bundleId }
          : {}),
        ...(fromNodeId !== undefined
          ? { fromNodeId }
          : {}),
        ...(toNodeId !== undefined
          ? { toNodeId }
          : {}),
        ...(domain !== undefined
          ? { domain }
          : {}),
        ...(relationshipType !== undefined
          ? { relationshipType }
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
        ...(relationshipStrength !== undefined
          ? { relationshipStrength }
          : {}),
        ...(interpretationLevel !== undefined
          ? { interpretationLevel }
          : {}),
      };

      const result = await listEdges(options);

      return response
        .status(200)
        .json(result);
    } catch (error) {
      return next(error);
    }
  },
);

edgesRouter.get(
  "/:edgeId",
  async (request, response, next) => {
    try {
      const edge = await getEdgeById(
        request.params.edgeId,
      );

      if (!edge) {
        return response.status(404).json({
          error: "EDGE_NOT_FOUND",
          message: `No edge found with ID ${request.params.edgeId}.`,
        });
      }

      return response
        .status(200)
        .json(edge);
    } catch (error) {
      return next(error);
    }
  },
);