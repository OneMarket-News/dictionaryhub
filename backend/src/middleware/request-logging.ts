import type { NextFunction, Request, Response } from "express";

function loggingEnabled(): boolean {
  const configured = process.env.REQUEST_LOGGING;
  if (configured != null) return configured.trim().toLowerCase() === "true";
  return (process.env.NODE_ENV || "development").trim().toLowerCase() === "production";
}

export function requestLoggingMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (!loggingEnabled()) {
    next();
    return;
  }

  const startedAt = performance.now();
  response.once("finish", () => {
    const statusCode = response.statusCode;
    const entry = {
      timestamp: new Date().toISOString(),
      level: statusCode >= 500 ? "error" : statusCode >= 400 ? "warning" : "info",
      event: "http_request",
      requestId: response.locals.requestId,
      method: request.method,
      path: request.path,
      statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    };
    console.log(JSON.stringify(entry));
  });

  next();
}
