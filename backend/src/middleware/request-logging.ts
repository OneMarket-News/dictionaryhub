import type { NextFunction, Request, Response } from "express";
import type { AuthContext } from "../auth/types.js";
import { emitDiagnosticEvent } from "../lib/diagnostics.js";

function responseCategory(statusCode: number): string {
  if (statusCode < 400) return "success";
  if (statusCode === 400 || statusCode === 413 || statusCode === 422) return "validation-failure";
  if (statusCode === 401) return "unauthorized";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 404) return "not-found";
  if (statusCode === 409) return "conflict";
  if (statusCode === 429) return "rate-limited";
  if (statusCode >= 500) return "internal-error";
  return "api-error";
}

function normalizePath(path: string): string {
  return path
    .split("/")
    .map((segment) => (
      segment.length > 64 || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment)
        ? ":id"
        : segment
    ))
    .join("/");
}

function actorCategory(response: Response): string {
  const auth = response.locals.auth as AuthContext | undefined;
  if (!auth) return "unknown";
  return auth.authenticated ? "authenticated" : "anonymous";
}

function captureErrorCode(response: Response): void {
  const originalJson = response.json.bind(response);
  response.json = ((body: unknown) => {
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      const candidate = typeof record.error === "string"
        ? record.error
        : typeof record.code === "string"
          ? record.code
          : null;
      if (candidate && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(candidate)) {
        response.locals.errorCode = candidate;
      }
    }
    return originalJson(body);
  }) as Response["json"];
}

export function requestLoggingMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const startedAt = performance.now();
  captureErrorCode(response);
  response.once("finish", () => {
    const statusCode = response.statusCode;
    const failed = statusCode >= 400;
    emitDiagnosticEvent({
      eventType: failed ? "request_failed" : "request_completed",
      level: statusCode >= 500 ? "error" : statusCode >= 400 ? "warning" : "info",
      correlationId: response.locals.requestId,
      method: request.method,
      path: normalizePath(request.path),
      statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      responseCategory: responseCategory(statusCode),
      actorCategory: actorCategory(response),
      ...(typeof response.locals.errorCode === "string"
        ? { errorCode: response.locals.errorCode }
        : {}),
    });
  });

  next();
}
