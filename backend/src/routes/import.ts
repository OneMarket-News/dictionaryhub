import { Router } from "express";

import {
  getImportedBundle,
  getImportedBundleCount,
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