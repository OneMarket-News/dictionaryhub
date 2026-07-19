import { Router } from "express";

import {
  getEdgeById,
  listEdges,
  type ListEdgesOptions,
} from "../services/edge-store.js";

export const edgesRouter = Router();

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

edgesRouter.get(
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