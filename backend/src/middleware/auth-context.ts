import type { NextFunction, Request, Response } from "express";

import {
  extractBearerToken,
  hasPermission,
  isVerifiedHuman,
  resolveDictionaryRootSessionToken,
  type DictionaryRootAuthContext,
} from "../services/identity-store.js";

declare global {
  namespace Express {
    interface Locals {
      dictionaryRootAuth?: DictionaryRootAuthContext | null;
    }
  }
}

export async function optionalDictionaryRootAuth(request: Request, response: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(request);
    response.locals.dictionaryRootAuth = token ? await resolveDictionaryRootSessionToken(token) : null;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireDictionaryRootAuth(request: Request, response: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(request);
    const context = token ? await resolveDictionaryRootSessionToken(token) : null;
    if (!context) {
      return response.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Sign in with an active DictionaryRoot identity before performing this action.",
        requestId: response.locals.requestId,
      });
    }
    response.locals.dictionaryRootAuth = context;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireDictionaryRootPermission(permission: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const context = response.locals.dictionaryRootAuth;
    if (!context) {
      return response.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Sign in with an active DictionaryRoot identity before performing this action.",
        requestId: response.locals.requestId,
      });
    }
    if (!hasPermission(context, permission)) {
      return response.status(403).json({
        error: "PERMISSION_DENIED",
        message: `The active identity does not have the ${permission} permission.`,
        permission,
        actorId: context.actor.actorId,
        requestId: response.locals.requestId,
      });
    }
    return next();
  };
}

export function requireVerifiedHumanForSensitiveAction(action: string) {
  return (_request: Request, response: Response, next: NextFunction) => {
    const context = response.locals.dictionaryRootAuth;
    if (!context) {
      return response.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Sign in before performing this action.",
        requestId: response.locals.requestId,
      });
    }
    if (!isVerifiedHuman(context)) {
      return response.status(403).json({
        error: "VERIFIED_HUMAN_REQUIRED",
        message: `${action} requires an authenticated actor classified as a verified human. Autonomous agents may submit recommendations but cannot finalize this action.`,
        actorType: context.actor.actorType,
        verificationLevel: context.actor.verificationLevel,
        requestId: response.locals.requestId,
      });
    }
    return next();
  };
}
