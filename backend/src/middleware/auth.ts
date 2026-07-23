import type { NextFunction, Request, Response } from "express";
import type { AuthContext } from "../auth/types.js";
import { AuthStoreError, anonymousAuthContext, getAuthContextByToken } from "../services/auth-store.js";
import { writeAuditEvent } from "../services/audit-store.js";

export const SESSION_COOKIE_NAME = "dr_session";

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function getSessionToken(request: Request): string | null {
  return parseCookies(request.headers.cookie)[SESSION_COOKIE_NAME] || null;
}

export function sessionCookieOptions() {
  const secure = (process.env.SESSION_COOKIE_SECURE || "false").toLowerCase() === "true";
  const sameSiteValue = (process.env.SESSION_COOKIE_SAME_SITE || "lax").toLowerCase();
  const sameSite = sameSiteValue === "strict" || sameSiteValue === "none" ? sameSiteValue : "lax";
  return {
    httpOnly: true,
    secure,
    sameSite: sameSite as "lax" | "strict" | "none",
    path: "/",
    maxAge: Math.max(1, Math.min(90, Number.parseInt(process.env.SESSION_DURATION_DAYS || "30", 10) || 30)) * 86400000,
  };
}

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

export function clearSessionCookie(response: Response): void {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  response.clearCookie(SESSION_COOKIE_NAME, options);
}

export async function authContextMiddleware(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    response.locals.auth = await getAuthContextByToken(getSessionToken(request));
    next();
  } catch (error) {
    if (error instanceof AuthStoreError && error.code === "DATABASE_REQUIRED") {
      response.locals.auth = anonymousAuthContext();
      next();
      return;
    }
    next(error);
  }
}

export function getAuth(response: Response): AuthContext {
  return response.locals.auth as AuthContext;
}

export function requireAuthentication(request: Request, response: Response, next: NextFunction): void {
  const auth = getAuth(response);
  if (auth.authenticated && auth.user) {
    next();
    return;
  }
  void writeAuditEvent({
    action: "authorization.denied",
    targetType: "route",
    targetId: request.originalUrl,
    outcome: "denied",
    request,
    response,
    metadata: { reason: "authentication_required" },
  });
  response.status(401).json({
    error: "AUTHENTICATION_REQUIRED",
    message: "Sign in to continue.",
    requestId: response.locals.requestId,
  });
}


export function hasSystemPermission(auth: AuthContext, permission: string): boolean {
  return auth.systemPermissions.includes(permission) || auth.systemPermissions.includes("system.admin");
}

export function hasOrganizationPermission(auth: AuthContext, organizationId: string | null | undefined, permission: string): boolean {
  if (hasSystemPermission(auth, permission)) return true;
  if (!organizationId) return false;
  const organization = auth.organizations.find((item) => item.organizationId === organizationId && item.membershipStatus === "active");
  return Boolean(organization?.permissions.includes(permission));
}

export function authorizedOrganizationIds(auth: AuthContext, permission: string): string[] {
  if (hasSystemPermission(auth, permission)) return auth.organizations.filter((item) => item.membershipStatus === "active").map((item) => item.organizationId);
  return auth.organizations
    .filter((item) => item.membershipStatus === "active" && item.permissions.includes(permission))
    .map((item) => item.organizationId);
}

export function requirePermission(permission: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const auth = getAuth(response);
    if (!auth.authenticated || !auth.user) {
      requireAuthentication(request, response, next);
      return;
    }
    if (auth.permissions.includes(permission) || auth.permissions.includes("system.admin")) {
      next();
      return;
    }
    void writeAuditEvent({
      actorUserId: auth.user.userId,
      actorIdentityId: auth.activeIdentityId,
      action: "authorization.denied",
      targetType: "permission",
      targetId: permission,
      outcome: "denied",
      request,
      response,
    });
    response.status(403).json({
      error: "PERMISSION_REQUIRED",
      message: `This action requires the ${permission} permission.`,
      permission,
      requestId: response.locals.requestId,
    });
  };
}

export function requireCsrf(request: Request, response: Response, next: NextFunction): void {
  const auth = getAuth(response);
  if (!auth.authenticated || !auth.csrfToken) {
    requireAuthentication(request, response, next);
    return;
  }
  const supplied = request.get("x-csrf-token") || "";
  if (supplied && supplied === auth.csrfToken) {
    next();
    return;
  }
  response.status(403).json({
    error: "CSRF_TOKEN_REQUIRED",
    message: "Refresh your account session and retry this protected action.",
    requestId: response.locals.requestId,
  });
}
