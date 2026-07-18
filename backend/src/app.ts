import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { requestIdMiddleware } from "./lib/request-id.js";
import { assertionsRouter } from "./routes/assertions.js";
import { edgesRouter } from "./routes/edges.js";
import { healthRouter } from "./routes/health.js";
import { importRouter } from "./routes/import.js";
import { nodesRouter } from "./routes/nodes.js";
import { revisionsRouter } from "./routes/revisions.js";
import { sourcesRouter } from "./routes/sources.js";
import { validateRouter } from "./routes/validate.js";

export function createApp() {
  const app = express();

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

  app.use(express.json({ limit: "5mb" }));

  app.use(healthRouter);
  app.use("/api/v1", validateRouter);
  app.use("/api/v1/import", importRouter);
  app.use("/api/v1/nodes", nodesRouter);
  app.use("/api/v1/assertions", assertionsRouter);
  app.use("/api/v1/edges", edgesRouter);
  app.use("/api/v1/sources", sourcesRouter);
  app.use("/api/v1/revisions", revisionsRouter);

  app.use((_request, response) => {
    response.status(404).json({
      error: "NOT_FOUND",
      message: "The requested SourceRoot API route does not exist.",
      requestId: response.locals.requestId,
    });
  });

  app.use(
    (
      error: Error,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      const isJsonSyntaxError =
        error instanceof SyntaxError && "body" in error;

      response.status(isJsonSyntaxError ? 400 : 500).json({
        error: isJsonSyntaxError
          ? "INVALID_JSON"
          : "INTERNAL_SERVER_ERROR",
        message: isJsonSyntaxError
          ? "Request body must contain valid JSON."
          : "The SourceRoot backend encountered an unexpected error.",
        requestId: response.locals.requestId,
      });
    },
  );

  return app;
}