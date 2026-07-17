import { Router } from "express";

import {
  getImportedBundle,
  getImportedBundleCount,
  listImportedBundles,
  saveImportedBundle,
} from "../services/import-store.js";
import { validateBundle } from "../services/validator.js";
import type { SourceRootBundle } from "../types.js";

export const importRouter = Router();

importRouter.post("/", async (request, response, next) => {
  try {
    const bundle = request.body as SourceRootBundle;
    const validation = validateBundle(bundle);

    if (!validation.canImport) {
      return response.status(422).json({
        imported: false,
        validation,
      });
    }

    await saveImportedBundle(bundle);

    const storedBundles = await getImportedBundleCount();

    return response.status(201).json({
      imported: true,
      bundleId: bundle.bundleId,
      storedBundles,
      validation,
    });
  } catch (error) {
    return next(error);
  }
});

importRouter.get("/", async (request, response, next) => {
  try {
    const page = Number.parseInt(String(request.query.page ?? "1"), 10);
    const limit = Number.parseInt(String(request.query.limit ?? "25"), 10);

    if (!Number.isInteger(page) || page < 1) {
      return response.status(400).json({
        error: "INVALID_PAGE",
        message: "page must be a positive integer.",
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return response.status(400).json({
        error: "INVALID_LIMIT",
        message: "limit must be an integer between 1 and 100.",
      });
    }

    const result = await listImportedBundles({
      page,
      limit,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

importRouter.get("/:bundleId", async (request, response, next) => {
  try {
    const bundle = await getImportedBundle(request.params.bundleId);

    if (!bundle) {
      return response.status(404).json({
        error: "BUNDLE_NOT_FOUND",
        message: `No imported bundle found with ID ${request.params.bundleId}.`,
      });
    }

    return response.status(200).json(bundle);
  } catch (error) {
    return next(error);
  }
});