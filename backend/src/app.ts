import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { requestIdMiddleware } from "./lib/request-id.js";
import { assertionsRouter } from "./routes/assertions.js";
import { bundlesRouter } from "./routes/bundles.js";
import { edgesRouter } from "./routes/edges.js";
import { healthRouter } from "./routes/health.js";
import { importRouter } from "./routes/import.js";
import { lexiconRouter } from "./routes/lexicon.js";
import { nodesRouter } from "./routes/nodes.js";
import { revisionsRouter } from "./routes/revisions.js";
import { searchRouter } from "./routes/search.js";
import { sourcesRouter } from "./routes/sources.js";
import { validateRouter } from "./routes/validate.js";

export interface CreateAppOptions {
  jsonLimit?: string;
}

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  body?: unknown;
}

function isPayloadTooLargeError(error: HttpError): boolean {
  return (
    error.status === 413 ||
    error.statusCode === 413 ||
    error.type === "entity.too.large"
  );
}

function isJsonSyntaxError(error: HttpError): boolean {
  return (
    error instanceof SyntaxError &&
    ("body" in error || error.type === "entity.parse.failed")
  );
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const jsonLimit =
    options.jsonLimit ||
    process.env.SOURCEROOT_JSON_LIMIT ||
    "100mb";

  app.disable("x-powered-by");

  app.use(requestIdMiddleware);

  app.use(
    cors({
      origin:
        process.env.CORS_ORIGIN
          ?.split(",")
          .map((value) => value.trim()) || true,
      credentials: false,
    }),
  );

  app.use(express.json({ limit: jsonLimit }));

  app.use(healthRouter);
  app.use("/api/v1", validateRouter);
  app.use("/api/v1/import", importRouter);
  app.use("/api/v1/dictionaryroot/lexicon", lexiconRouter);
  app.use("/api/v1/search", searchRouter);
  app.use("/api/v1/bundles", bundlesRouter);
  app.use("/api/v1/nodes", nodesRouter);
  app.use("/api/v1/assertions", assertionsRouter);
  app.use("/api/v1/edges", edgesRouter);
  app.use("/api/v1/sources", sourcesRouter);
  app.use("/api/v1/revisions", revisionsRouter);

  app.use((_request, response) => {
    response.status(404).json({
      error: "NOT_FOUND",
      message:
        "The requested SourceRoot API route does not exist.",
      requestId:
        response.locals.requestId,
    });
  });

  app.use(
    (
      error: HttpError,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      if (isPayloadTooLargeError(error)) {
        response.status(413).json({
          error: "PAYLOAD_TOO_LARGE",
          message: `Request body exceeds the configured SourceRoot JSON limit (${jsonLimit}).`,
          requestId: response.locals.requestId,
        });
        return;
      }

      if (isJsonSyntaxError(error)) {
        response.status(400).json({
          error: "INVALID_JSON",
          message: "Request body must contain valid JSON.",
          requestId: response.locals.requestId,
        });
        return;
      }

      response.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message:
          "The SourceRoot backend encountered an unexpected error.",
        requestId:
          response.locals.requestId,
      });
    },
  );

  return app;
}
