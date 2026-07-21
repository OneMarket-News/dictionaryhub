import { Router } from "express";
import { z } from "zod";

import {
  requireDictionaryRootAuth,
  requireDictionaryRootPermission,
} from "../middleware/auth-context.js";
import {
  createDictionaryRootDevelopmentSession,
  extractBearerToken,
  getDictionaryRootIdentityProviders,
  listDictionaryRootActors,
  listDictionaryRootDelegations,
  listDictionaryRootDevelopmentActors,
  listDictionaryRootRoles,
  revokeDictionaryRootSession,
} from "../services/identity-store.js";

export const authRouter = Router();

const devSessionSchema = z.object({
  actorId: z.string().trim().min(1).max(180),
});

authRouter.get("/providers", async (_request, response, next) => {
  try {
    return response.status(200).json(await getDictionaryRootIdentityProviders());
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/development-actors", async (_request, response, next) => {
  try {
    return response.status(200).json({
      developmentOnly: true,
      publicAuthentication: false,
      actors: await listDictionaryRootDevelopmentActors(),
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/development-session", async (request, response, next) => {
  try {
    const parsed = devSessionSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return response.status(400).json({
        error: "INVALID_DEVELOPMENT_IDENTITY",
        message: "A valid development actor ID is required.",
        details: parsed.error.issues,
      });
    }
    const result = await createDictionaryRootDevelopmentSession(parsed.data.actorId);
    return response.status(201).json({
      ...result,
      developmentOnly: true,
      publicAuthentication: false,
    });
  } catch (error) {
    const statusCode = error && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 0;
    if (statusCode === 403 || statusCode === 404) {
      return response.status(statusCode).json({
        error: statusCode === 403 ? "DEVELOPMENT_AUTH_DISABLED" : "ACTOR_NOT_FOUND",
        message: error instanceof Error ? error.message : "Development sign-in failed.",
      });
    }
    return next(error);
  }
});

authRouter.get("/me", requireDictionaryRootAuth, async (_request, response) => {
  return response.status(200).json(response.locals.dictionaryRootAuth);
});

authRouter.post("/logout", requireDictionaryRootAuth, async (request, response, next) => {
  try {
    const revoked = await revokeDictionaryRootSession(extractBearerToken(request));
    return response.status(200).json({ revoked });
  } catch (error) {
    return next(error);
  }
});

authRouter.get(
  "/actors",
  requireDictionaryRootAuth,
  requireDictionaryRootPermission("identity.read"),
  async (_request, response, next) => {
    try {
      return response.status(200).json({ actors: await listDictionaryRootActors() });
    } catch (error) {
      return next(error);
    }
  },
);

authRouter.get(
  "/roles",
  requireDictionaryRootAuth,
  requireDictionaryRootPermission("identity.read"),
  async (_request, response, next) => {
    try {
      return response.status(200).json({ roles: await listDictionaryRootRoles() });
    } catch (error) {
      return next(error);
    }
  },
);

authRouter.get(
  "/delegations",
  requireDictionaryRootAuth,
  requireDictionaryRootPermission("identity.read"),
  async (_request, response, next) => {
    try {
      return response.status(200).json({ delegations: await listDictionaryRootDelegations() });
    } catch (error) {
      return next(error);
    }
  },
);
