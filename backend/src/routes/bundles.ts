import { Router } from "express";

import { getPool } from "../lib/database.js";
import {
  listAssertions,
  type ListAssertionsOptions,
} from "../services/assertion-store.js";
import {
  listEdges,
  type ListEdgesOptions,
} from "../services/edge-store.js";
import {
  listNodes,
  type ListNodesOptions,
} from "../services/node-store.js";
import {
  listRevisions,
  type ListRevisionsOptions,
} from "../services/revision-store.js";
import {
  listSources,
  type ListSourcesOptions,
} from "../services/source-store.js";

export const bundlesRouter = Router();

function requireDatabase() {
  const database = getPool();

  if (!database) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return database;
}

async function bundleExists(
  bundleId: string,
): Promise<boolean> {
  const database = requireDatabase();

  const result = await database.query<{
    exists: boolean;
  }>(
    `
      SELECT EXISTS(
        SELECT 1
        FROM imported_bundles
        WHERE bundle_id = $1
      ) AS exists;
    `,
    [bundleId],
  );

  return result.rows[0]?.exists ?? false;
}

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

function getPagination(
  pageValue: unknown,
  limitValue: unknown,
):
  | {
      page: number;
      limit: number;
    }
  | {
      error: "INVALID_PAGE" | "INVALID_LIMIT";
      message: string;
    } {
  const page = parsePositiveInteger(
    pageValue,
    1,
  );

  if (page === undefined) {
    return {
      error: "INVALID_PAGE",
      message:
        "page must be a positive integer.",
    };
  }

  const limit = parsePositiveInteger(
    limitValue,
    25,
  );

  if (
    limit === undefined ||
    limit > 100
  ) {
    return {
      error: "INVALID_LIMIT",
      message:
        "limit must be an integer between 1 and 100.",
    };
  }

  return {
    page,
    limit,
  };
}

async function confirmBundle(
  bundleId: string,
): Promise<
  | {
      exists: true;
    }
  | {
      exists: false;
      error: {
        error: "BUNDLE_NOT_FOUND";
        message: string;
      };
    }
> {
  const exists = await bundleExists(bundleId);

  if (!exists) {
    return {
      exists: false,
      error: {
        error: "BUNDLE_NOT_FOUND",
        message: `No imported bundle found with ID ${bundleId}.`,
      },
    };
  }

  return {
    exists: true,
  };
}

bundlesRouter.get(
  "/:bundleId/nodes",
  async (request, response, next) => {
    try {
      const bundleId = request.params.bundleId;
      const bundle = await confirmBundle(bundleId);

      if (!bundle.exists) {
        return response
          .status(404)
          .json(bundle.error);
      }

      const pagination = getPagination(
        request.query.page,
        request.query.limit,
      );

      if ("error" in pagination) {
        return response
          .status(400)
          .json(pagination);
      }

      const domain = getQueryString(
        request.query.domain,
      );

      const nodeType = getQueryString(
        request.query.nodeType,
      );

      const status = getQueryString(
        request.query.status,
      );

      const options: ListNodesOptions = {
        page: pagination.page,
        limit: pagination.limit,
        bundleId,
        ...(domain !== undefined
          ? { domain }
          : {}),
        ...(nodeType !== undefined
          ? { nodeType }
          : {}),
        ...(status !== undefined
          ? { status }
          : {}),
      };

      const result = await listNodes(options);

      return response.status(200).json({
        bundleId,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  },
);

bundlesRouter.get(
  "/:bundleId/assertions",
  async (request, response, next) => {
    try {
      const bundleId = request.params.bundleId;
      const bundle = await confirmBundle(bundleId);

      if (!bundle.exists) {
        return response
          .status(404)
          .json(bundle.error);
      }

      const pagination = getPagination(
        request.query.page,
        request.query.limit,
      );

      if ("error" in pagination) {
        return response
          .status(400)
          .json(pagination);
      }

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
        page: pagination.page,
        limit: pagination.limit,
        bundleId,
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

      const result =
        await listAssertions(options);

      return response.status(200).json({
        bundleId,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  },
);

bundlesRouter.get(
  "/:bundleId/edges",
  async (request, response, next) => {
    try {
      const bundleId = request.params.bundleId;
      const bundle = await confirmBundle(bundleId);

      if (!bundle.exists) {
        return response
          .status(404)
          .json(bundle.error);
      }

      const pagination = getPagination(
        request.query.page,
        request.query.limit,
      );

      if ("error" in pagination) {
        return response
          .status(400)
          .json(pagination);
      }

      const fromNodeId = getQueryString(
        request.query.fromNodeId,
      );

      const toNodeId = getQueryString(
        request.query.toNodeId,
      );

      const domain = getQueryString(
        request.query.domain,
      );

      const relationshipType =
        getQueryString(
          request.query.relationshipType,
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

      const relationshipStrength =
        getQueryString(
          request.query.relationshipStrength,
        );

      const interpretationLevel =
        getQueryString(
          request.query.interpretationLevel,
        );

      const options: ListEdgesOptions = {
        page: pagination.page,
        limit: pagination.limit,
        bundleId,
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

      return response.status(200).json({
        bundleId,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  },
);

bundlesRouter.get(
  "/:bundleId/sources",
  async (request, response, next) => {
    try {
      const bundleId = request.params.bundleId;
      const bundle = await confirmBundle(bundleId);

      if (!bundle.exists) {
        return response
          .status(404)
          .json(bundle.error);
      }

      const pagination = getPagination(
        request.query.page,
        request.query.limit,
      );

      if ("error" in pagination) {
        return response
          .status(400)
          .json(pagination);
      }

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

      const verificationStatus =
        getQueryString(
          request.query.verificationStatus,
        );

      const options: ListSourcesOptions = {
        page: pagination.page,
        limit: pagination.limit,
        bundleId,
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

      const result =
        await listSources(options);

      return response.status(200).json({
        bundleId,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  },
);

bundlesRouter.get(
  "/:bundleId/revisions",
  async (request, response, next) => {
    try {
      const bundleId = request.params.bundleId;
      const bundle = await confirmBundle(bundleId);

      if (!bundle.exists) {
        return response
          .status(404)
          .json(bundle.error);
      }

      const pagination = getPagination(
        request.query.page,
        request.query.limit,
      );

      if ("error" in pagination) {
        return response
          .status(400)
          .json(pagination);
      }

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
        page: pagination.page,
        limit: pagination.limit,
        bundleId,
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

      const result =
        await listRevisions(options);

      return response.status(200).json({
        bundleId,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  },
);