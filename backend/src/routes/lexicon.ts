import { Router } from "express";

import { getQueryString } from "../lib/query-params.js";
import {
  getDictionaryRootLemmaCoverage,
  getDictionaryRootLexiconStatus,
} from "../services/lexical-store.js";

export const lexiconRouter = Router();

lexiconRouter.get("/status", async (request, response, next) => {
  try {
    const bundleId = getQueryString(request.query.bundleId);
    const status = await getDictionaryRootLexiconStatus(bundleId);
    return response.status(200).json(status);
  } catch (error) {
    return next(error);
  }
});

lexiconRouter.get("/coverage", async (request, response, next) => {
  try {
    const query = getQueryString(request.query.q);
    if (query === undefined) {
      return response.status(400).json({
        error: "INVALID_QUERY",
        message: "q must contain a lemma to inspect.",
      });
    }
    const bundleId = getQueryString(request.query.bundleId);
    const coverage = await getDictionaryRootLemmaCoverage(query, bundleId);
    return response.status(200).json(coverage);
  } catch (error) {
    return next(error);
  }
});
