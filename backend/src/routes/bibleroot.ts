import { Router } from "express";

import { BibleRootReferenceError } from "../bibleroot/foundation.js";
import { createApiError } from "../lib/api-contract.js";
import {
  BibleRootOriginalLanguageUnavailableError,
  BibleRootResourceNotFoundError,
  getBibleRootPassage,
  getBibleRootOriginalLanguagePassage,
  getBibleRootPhrase,
  getBibleRootVerse,
  listBibleRootBooks,
  listBibleRootEditions,
  listBibleRootOriginalLanguageEditions,
} from "../services/bibleroot-store.js";

export const bibleRootRouter = Router();

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function handleBibleRootError(
  error: unknown,
  response: Parameters<Parameters<typeof bibleRootRouter.get>[1]>[1],
  next: Parameters<Parameters<typeof bibleRootRouter.get>[1]>[2],
) {
  if (error instanceof BibleRootReferenceError) {
    const status = error.code === "passage-unavailable" ? 404 : 400;
    return response.status(status).json(
      createApiError(
        error.code.toUpperCase().replaceAll("-", "_"),
        error.message,
        status,
        {
          category:
            error.code === "passage-unavailable"
              ? "not-found"
              : "validation-failure",
          requestId: response.locals.requestId,
        },
      ),
    );
  }
  if (error instanceof BibleRootResourceNotFoundError) {
    return response.status(404).json(
      createApiError(
        error.code.toUpperCase().replaceAll("-", "_"),
        error.message,
        404,
        {
          category: "not-found",
          requestId: response.locals.requestId,
        },
      ),
    );
  }
  if (error instanceof BibleRootOriginalLanguageUnavailableError) {
    return response.status(404).json(
      createApiError(
        "ORIGINAL_LANGUAGE_UNAVAILABLE",
        error.message,
        404,
        {
          category: "not-found",
          requestId: response.locals.requestId,
        },
      ),
    );
  }
  return next(error);
}

bibleRootRouter.get("/editions", async (_request, response, next) => {
  try {
    return response.status(200).json(await listBibleRootEditions());
  } catch (error) {
    return handleBibleRootError(error, response, next);
  }
});

bibleRootRouter.get("/books", async (_request, response, next) => {
  try {
    return response.status(200).json(await listBibleRootBooks());
  } catch (error) {
    return handleBibleRootError(error, response, next);
  }
});

bibleRootRouter.get("/passages", async (request, response, next) => {
  const reference = queryString(request.query.reference);
  if (!reference) {
    return response.status(400).json(
      createApiError(
        "REFERENCE_REQUIRED",
        "The reference query parameter is required.",
        400,
        {
          category: "validation-failure",
          field: "reference",
          requestId: response.locals.requestId,
        },
      ),
    );
  }
  try {
    return response.status(200).json(
      await getBibleRootPassage(
        reference,
        queryString(request.query.edition),
      ),
    );
  } catch (error) {
    return handleBibleRootError(error, response, next);
  }
});

bibleRootRouter.get("/verses/:verseId", async (request, response, next) => {
  try {
    return response.status(200).json(
      await getBibleRootVerse(
        request.params.verseId,
        queryString(request.query.edition),
      ),
    );
  } catch (error) {
    return handleBibleRootError(error, response, next);
  }
});

bibleRootRouter.get("/phrases/:phraseId", async (request, response, next) => {
  try {
    return response.status(200).json(
      await getBibleRootPhrase(request.params.phraseId),
    );
  } catch (error) {
    return handleBibleRootError(error, response, next);
  }
});

bibleRootRouter.get("/original-language/editions", async (_request, response, next) => {
  try {
    return response.status(200).json(
      await listBibleRootOriginalLanguageEditions(),
    );
  } catch (error) {
    return handleBibleRootError(error, response, next);
  }
});

bibleRootRouter.get("/original-language/passages", async (request, response, next) => {
  const reference = queryString(request.query.reference);
  if (!reference) {
    return response.status(400).json(
      createApiError(
        "REFERENCE_REQUIRED",
        "The reference query parameter is required.",
        400,
        {
          category: "validation-failure",
          field: "reference",
          requestId: response.locals.requestId,
        },
      ),
    );
  }
  try {
    return response.status(200).json(
      await getBibleRootOriginalLanguagePassage(
        reference,
        queryString(request.query.edition),
      ),
    );
  } catch (error) {
    return handleBibleRootError(error, response, next);
  }
});
