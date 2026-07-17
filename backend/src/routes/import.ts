import { Router } from "express";
import type { SourceRootBundle } from "../types.js";
import { validateBundle } from "../services/validator.js";
import {
  getImportedBundle,
  getImportedBundleCount,
  saveImportedBundle,
} from "../services/import-store.js";

export const importRouter = Router();

importRouter.post("/", (request, response) => {
  const bundle = request.body as SourceRootBundle;
  const validation = validateBundle(bundle);

  if (!validation.canImport) {
    return response.status(422).json({
      imported: false,
      validation,
    });
  }

  saveImportedBundle(bundle);

  return response.status(201).json({
    imported: true,
    bundleId: bundle.bundleId,
    storedBundles: getImportedBundleCount(),
    validation,
  });
});

importRouter.get("/:bundleId", (request, response) => {
  const bundle = getImportedBundle(request.params.bundleId);

  if (!bundle) {
    return response.status(404).json({
      error: "BUNDLE_NOT_FOUND",
      message: `No imported bundle found with ID ${request.params.bundleId}.`,
    });
  }

  return response.status(200).json(bundle);
});