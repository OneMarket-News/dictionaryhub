import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { requestIdMiddleware } from "./lib/request-id.js";
import { authContextMiddleware } from "./middleware/auth.js";
import { accountRouter } from "./routes/account.js";
import { adminRouter } from "./routes/admin.js";
import { assertionsRouter } from "./routes/assertions.js";
import { authRouter } from "./routes/auth.js";
import { bundlesRouter } from "./routes/bundles.js";
import { edgesRouter } from "./routes/edges.js";
import { editorialRouter } from "./routes/editorial.js";
import { healthRouter } from "./routes/health.js";
import { importRouter } from "./routes/import.js";
import { lexiconRouter } from "./routes/lexicon.js";
import { moderationRouter } from "./routes/moderation.js";
import { nodesRouter } from "./routes/nodes.js";
import { revisionsRouter } from "./routes/revisions.js";
import { searchRouter } from "./routes/search.js";
import { sourcesRouter } from "./routes/sources.js";
import { validateRouter } from "./routes/validate.js";
import { workflowRouter } from "./routes/workflow.js";

export interface CreateAppOptions {
  jsonLimit?: string;
}

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  body?: unknown;
  code?: string;
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

  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "DENY");
    response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader("cross-origin-opener-policy", "same-origin-allow-popups");
    next();
  });

  app.use(requestIdMiddleware);

  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:8080,http://127.0.0.1:8080")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if ((process.env.TRUST_PROXY || "false").toLowerCase() === "true") {
    app.set("trust proxy", 1);
  }

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin is not permitted by DictionaryRoot CORS policy."));
      },
      credentials: true,
      allowedHeaders: ["content-type", "x-csrf-token", "x-request-id", "x-sourceroot-import-token"],
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(express.json({ limit: jsonLimit }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (/^\/api\/v1\/(auth|account|admin|dictionaryroot\/workflow)/.test(request.path)) {
      response.setHeader("cache-control", "no-store");
    }
    next();
  });
  app.use(authContextMiddleware);

  app.use(healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/account", accountRouter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/dictionaryroot/workflow", workflowRouter);
  app.use("/api/v1/moderation", moderationRouter);
  app.use("/api/v1", validateRouter);
  app.use("/api/v1/import", importRouter);
  app.use("/api/v1/dictionaryroot/lexicon", lexiconRouter);
  app.use("/api/v1/dictionaryroot/editorial", editorialRouter);
  app.use("/api/v1/search", searchRouter);
  app.use("/api/v1/bundles", bundlesRouter);
  app.use("/api/v1/nodes", nodesRouter);
  app.use("/api/v1/assertions", assertionsRouter);
  app.use("/api/v1/edges", edgesRouter);
  app.use("/api/v1/sources", sourcesRouter);
  app.use("/api/v1/revisions", revisionsRouter);

  app.use((_request: Request, response: Response) => {
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

      const explicitStatus = error.statusCode || error.status;
      if (explicitStatus && explicitStatus >= 400 && explicitStatus < 600 && error.code) {
        response.status(explicitStatus).json({
          error: error.code,
          message: error.message || "The requested governed-platform action could not be completed.",
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
