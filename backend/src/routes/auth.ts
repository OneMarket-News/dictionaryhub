import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { getRouteParam } from "../lib/query-params.js";
import {
  authProviderConfig,
  backendPublicUrl,
  buildAppleAuthorizationUrl,
  buildGoogleAuthorizationUrl,
  createProviderRequestMaterial,
  deliverMagicLink,
  exchangeAppleCode,
  exchangeGoogleCode,
  frontendPublicUrl,
  sanitizeReturnTo,
} from "../services/auth-providers.js";
import {
  AuthStoreError,
  consumeEmailChallenge,
  consumeOauthState,
  createAuthSession,
  createEmailChallenge,
  createOauthState,
  revokeSessionByToken,
  unlinkIdentity,
  upsertProviderIdentity,
} from "../services/auth-store.js";
import {
  clearSessionCookie,
  getAuth,
  getSessionToken,
  requireAuthentication,
  requireCsrf,
  setSessionCookie,
} from "../middleware/auth.js";
import { writeAuditEvent } from "../services/audit-store.js";

export const authRouter = Router();

const emailStartSchema = z.object({
  email: z.string().trim().email().max(320),
  intent: z.enum(["signin", "link"]).default("signin"),
  returnTo: z.string().trim().max(1000).optional(),
});
const developmentSchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().max(120).default("DictionaryRoot Developer"),
  returnTo: z.string().trim().max(1000).optional(),
});

function sendAuthError(response: Response, error: unknown): Response {
  if (error instanceof AuthStoreError) {
    return response.status(error.statusCode).json({ error: error.code, message: error.message, requestId: response.locals.requestId });
  }
  return response.status(500).json({ error: "AUTHENTICATION_FAILED", message: error instanceof Error ? error.message : "Authentication failed.", requestId: response.locals.requestId });
}

function redirectResult(response: Response, returnTo: string, params: Record<string, string>): void {
  const target = new URL(sanitizeReturnTo(returnTo), frontendPublicUrl());
  Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, value));
  response.redirect(303, target.toString());
}

async function completeSignIn(
  request: Request,
  response: Response,
  profile: Parameters<typeof upsertProviderIdentity>[0],
  state: { intent: "signin" | "link"; userId: string | null; returnTo: string },
): Promise<void> {
  const result = await upsertProviderIdentity(profile, { linkToUserId: state.intent === "link" ? state.userId : null });
  const session = await createAuthSession({
    userId: result.userId,
    identityId: result.identityId,
    userAgent: request.get("user-agent") || "",
    ...(request.ip ? { ipAddress: request.ip } : {}),
  });
  setSessionCookie(response, session.token);
  await writeAuditEvent({
    actorUserId: result.userId,
    actorIdentityId: result.identityId,
    action: state.intent === "link" ? "identity.linked" : "session.created",
    targetType: state.intent === "link" ? "identity" : "session",
    targetId: state.intent === "link" ? result.identityId : session.sessionId,
    request,
    response,
    metadata: { provider: profile.provider, accountCreated: result.created },
  });
  redirectResult(response, state.returnTo, { auth: state.intent === "link" ? "linked" : "success" });
}

authRouter.get("/config", (_request, response) => {
  response.status(200).json({
    providers: authProviderConfig(),
    frontendPublicUrl: frontendPublicUrl(),
    backendPublicUrl: backendPublicUrl(),
    accountLinking: true,
    passwordStorage: false,
  });
});

authRouter.get("/session", (_request, response) => {
  response.status(200).json(getAuth(response));
});

authRouter.post("/email/start", async (request, response) => {
  try {
    const parsed = emailStartSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_EMAIL_REQUEST", message: "Enter a valid email address.", details: parsed.error.issues });
    const auth = getAuth(response);
    if (parsed.data.intent === "link" && !auth.authenticated) return response.status(401).json({ error: "AUTHENTICATION_REQUIRED", message: "Sign in before linking another email address." });
    if (parsed.data.intent === "link" && request.get("x-csrf-token") !== auth.csrfToken) return response.status(403).json({ error: "CSRF_TOKEN_REQUIRED", message: "Refresh your account session and retry." });
    const returnTo = sanitizeReturnTo(parsed.data.returnTo);
    const token = await createEmailChallenge({
      email: parsed.data.email,
      intent: parsed.data.intent,
      userId: parsed.data.intent === "link" ? (auth.user?.userId ?? null) : null,
      returnTo,
      requestedIp: request.ip || "",
    });
    const link = `${backendPublicUrl()}/api/v1/auth/email/verify?token=${encodeURIComponent(token)}`;
    const delivery = await deliverMagicLink(parsed.data.email, link);
    await writeAuditEvent({
      actorUserId: auth.user?.userId ?? null,
      actorIdentityId: auth.activeIdentityId,
      action: "email_challenge.created",
      targetType: "email",
      targetId: parsed.data.email.toLowerCase(),
      request,
      response,
      metadata: { intent: parsed.data.intent, deliveryMode: delivery.mode },
    });
    return response.status(202).json({
      accepted: true,
      message: "If the address can receive DictionaryRoot email, a one-time sign-in link has been sent.",
      expiresInMinutes: Number.parseInt(process.env.EMAIL_LINK_TTL_MINUTES || "15", 10) || 15,
      ...(delivery.exposedLink ? { developmentLink: delivery.exposedLink } : {}),
    });
  } catch (error) {
    return sendAuthError(response, error);
  }
});

authRouter.get("/email/verify", async (request, response) => {
  try {
    const token = typeof request.query.token === "string" ? request.query.token : "";
    if (!token) throw new AuthStoreError(400, "INVALID_EMAIL_LINK", "The email sign-in link is incomplete.");
    const challenge = await consumeEmailChallenge(token);
    await completeSignIn(request, response, {
      provider: "email",
      subject: challenge.email,
      email: challenge.email,
      emailVerified: true,
      displayName: challenge.email.split("@")[0] || "",
      avatarUrl: "",
      profile: { verification: "magic_link" },
    }, { intent: challenge.intent, userId: challenge.userId, returnTo: challenge.returnTo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email sign-in failed.";
    redirectResult(response, "/account-v1.html", { authError: message });
  }
});

async function prepareOauth(request: Request, response: Response, provider: "google" | "apple", intent: "signin" | "link"): Promise<string> {
  const config = authProviderConfig()[provider];
  if (!config.configured) throw new AuthStoreError(503, "PROVIDER_NOT_CONFIGURED", `${provider === "google" ? "Google" : "Apple"} sign-in is not configured yet.`);
  const auth = getAuth(response);
  if (intent === "link" && !auth.authenticated) throw new AuthStoreError(401, "AUTHENTICATION_REQUIRED", "Sign in before linking another provider.");
  const material = createProviderRequestMaterial();
  const suppliedReturnTo = intent === "link"
    ? (typeof request.body?.returnTo === "string" ? request.body.returnTo : undefined)
    : (typeof request.query.returnTo === "string" ? request.query.returnTo : undefined);
  const returnTo = sanitizeReturnTo(suppliedReturnTo);
  const state = await createOauthState({
    provider,
    intent,
    userId: intent === "link" ? (auth.user?.userId ?? null) : null,
    codeVerifier: material.codeVerifier,
    nonce: material.nonce,
    returnTo,
  });
  return provider === "google"
    ? buildGoogleAuthorizationUrl({ state, codeVerifier: material.codeVerifier, nonce: material.nonce })
    : buildAppleAuthorizationUrl({ state, nonce: material.nonce });
}

authRouter.get("/google/start", async (request, response) => {
  try {
    if (request.query.intent === "link") throw new AuthStoreError(405, "POST_REQUIRED", "Provider linking must be initiated from the protected account action.");
    response.redirect(302, await prepareOauth(request, response, "google", "signin"));
  } catch (error) { sendAuthError(response, error); }
});

authRouter.post("/google/start", requireAuthentication, requireCsrf, async (request, response) => {
  try {
    response.status(200).json({ authorizationUrl: await prepareOauth(request, response, "google", "link") });
  } catch (error) { sendAuthError(response, error); }
});

authRouter.get("/google/callback", async (request, response) => {
  try {
    const stateValue = typeof request.query.state === "string" ? request.query.state : "";
    const code = typeof request.query.code === "string" ? request.query.code : "";
    if (!stateValue || !code) throw new AuthStoreError(400, "INVALID_OAUTH_CALLBACK", "Google did not return a complete authorization response.");
    const state = await consumeOauthState(stateValue, "google");
    const profile = await exchangeGoogleCode({ code, codeVerifier: state.codeVerifier, nonce: state.nonce });
    await completeSignIn(request, response, profile, state);
  } catch (error) {
    redirectResult(response, "/account-v1.html", { authError: error instanceof Error ? error.message : "Google sign-in failed." });
  }
});

authRouter.post("/apple/callback", async (request, response) => {
  try {
    const stateValue = typeof request.body?.state === "string" ? request.body.state : "";
    const code = typeof request.body?.code === "string" ? request.body.code : "";
    if (!stateValue || !code) throw new AuthStoreError(400, "INVALID_OAUTH_CALLBACK", "Apple did not return a complete authorization response.");
    const state = await consumeOauthState(stateValue, "apple");
    const userJson = typeof request.body?.user === "string" ? request.body.user : undefined;
    const profile = await exchangeAppleCode({ code, nonce: state.nonce, ...(userJson ? { userJson } : {}) });
    await completeSignIn(request, response, profile, state);
  } catch (error) {
    redirectResult(response, "/account-v1.html", { authError: error instanceof Error ? error.message : "Apple sign-in failed." });
  }
});

authRouter.get("/apple/start", async (request, response) => {
  try {
    if (request.query.intent === "link") throw new AuthStoreError(405, "POST_REQUIRED", "Provider linking must be initiated from the protected account action.");
    response.redirect(302, await prepareOauth(request, response, "apple", "signin"));
  } catch (error) { sendAuthError(response, error); }
});

authRouter.post("/apple/start", requireAuthentication, requireCsrf, async (request, response) => {
  try {
    response.status(200).json({ authorizationUrl: await prepareOauth(request, response, "apple", "link") });
  } catch (error) { sendAuthError(response, error); }
});

authRouter.post("/development/sign-in", async (request, response) => {
  try {
    if (!authProviderConfig().development.configured) throw new AuthStoreError(404, "NOT_FOUND", "Development sign-in is disabled.");
    const parsed = developmentSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_DEVELOPMENT_ACCOUNT", message: "Enter a valid development email.", details: parsed.error.issues });
    const profile = {
      provider: "development" as const,
      subject: parsed.data.email.toLowerCase(),
      email: parsed.data.email.toLowerCase(),
      emailVerified: true,
      displayName: parsed.data.displayName,
      avatarUrl: "",
      profile: { localDevelopmentOnly: true },
    };
    const result = await upsertProviderIdentity(profile);
    const session = await createAuthSession({
      userId: result.userId,
      identityId: result.identityId,
      userAgent: request.get("user-agent") || "",
      ...(request.ip ? { ipAddress: request.ip } : {}),
    });
    setSessionCookie(response, session.token);
    return response.status(200).json({ signedIn: true, returnTo: sanitizeReturnTo(parsed.data.returnTo), sessionExpiresAt: session.expiresAt });
  } catch (error) {
    return sendAuthError(response, error);
  }
});

authRouter.post("/sign-out", requireAuthentication, requireCsrf, async (request, response) => {
  const auth = getAuth(response);
  const token = getSessionToken(request);
  if (token) await revokeSessionByToken(token);
  clearSessionCookie(response);
  await writeAuditEvent({ actorUserId: auth.user?.userId ?? null, actorIdentityId: auth.activeIdentityId, action: "session.revoked", targetType: "session", targetId: auth.sessionId || "", request, response });
  response.status(200).json({ signedOut: true });
});

authRouter.delete("/identities/:identityId", requireAuthentication, requireCsrf, async (request, response) => {
  try {
    const auth = getAuth(response);
    const identityId = getRouteParam(request.params.identityId);
    if (identityId === auth.activeIdentityId) {
      throw new AuthStoreError(409, "ACTIVE_IDENTITY", "Sign in with another linked method before removing the identity that created this session.");
    }
    await unlinkIdentity(auth.user!.userId, identityId);
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "identity.unlinked", targetType: "identity", targetId: identityId, request, response });
    response.status(204).end();
  } catch (error) {
    sendAuthError(response, error);
  }
});
