import { Router } from "express";
import { z } from "zod";
import { getRouteParam } from "../lib/query-params.js";
import {
  clearSessionCookie,
  getAuth,
  requireAuthentication,
  requireCsrf,
} from "../middleware/auth.js";
import {
  acceptInvitation,
  completeAccountDeletion,
  exportAccountData,
  listUserSessions,
  requestAccountDeletion,
  revokeAllSessions,
  revokeSessionById,
  updateAccountProfile,
} from "../services/auth-store.js";
import { writeAuditEvent } from "../services/audit-store.js";

export const accountRouter = Router();

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  publicHandle: z.string().trim().regex(/^[a-zA-Z0-9_-]{3,40}$/).nullable().optional(),
});
const invitationSchema = z.object({ token: z.string().trim().min(20).max(500) });
const deletionRequestSchema = z.object({ reason: z.string().trim().max(1000).optional() });
const deletionConfirmSchema = z.object({ confirmation: z.literal("DELETE") });

accountRouter.use(requireAuthentication);

accountRouter.get("/", (_request, response) => {
  response.status(200).json(getAuth(response));
});

accountRouter.patch("/profile", requireCsrf, async (request, response, next) => {
  try {
    const parsed = profileSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_PROFILE", message: "Display name or public handle is invalid.", details: parsed.error.issues });
    const auth = getAuth(response);
    await updateAccountProfile(auth.user!.userId, { displayName: parsed.data.displayName, publicHandle: parsed.data.publicHandle || null });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "account.profile_updated", targetType: "user", targetId: auth.user!.userId, request, response });
    return response.status(200).json({ updated: true });
  } catch (error) { return next(error); }
});

accountRouter.get("/sessions", async (_request, response, next) => {
  try {
    const auth = getAuth(response);
    return response.status(200).json({ currentSessionId: auth.sessionId, sessions: await listUserSessions(auth.user!.userId) });
  } catch (error) { return next(error); }
});

accountRouter.delete("/sessions/:sessionId", requireCsrf, async (request, response, next) => {
  try {
    const auth = getAuth(response);
    const sessionId = getRouteParam(request.params.sessionId);
    const revoked = await revokeSessionById(auth.user!.userId, sessionId);
    if (!revoked) return response.status(404).json({ error: "SESSION_NOT_FOUND", message: "That active session was not found." });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "session.revoked", targetType: "session", targetId: sessionId, request, response });
    return response.status(204).end();
  } catch (error) { return next(error); }
});

accountRouter.post("/sessions/revoke-others", requireCsrf, async (request, response, next) => {
  try {
    const auth = getAuth(response);
    const revoked = await revokeAllSessions(auth.user!.userId, auth.sessionId);
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "sessions.revoked_others", targetType: "user", targetId: auth.user!.userId, request, response, metadata: { revoked } });
    return response.status(200).json({ revoked });
  } catch (error) { return next(error); }
});

accountRouter.post("/invitations/accept", requireCsrf, async (request, response, next) => {
  try {
    const parsed = invitationSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_INVITATION", message: "Enter the complete invitation token." });
    const auth = getAuth(response);
    const accepted = await acceptInvitation({ userId: auth.user!.userId, token: parsed.data.token });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, organizationId: accepted.organizationId, action: "invitation.accepted", targetType: "invitation", targetId: accepted.invitationId, request, response, metadata: { roleKey: accepted.roleKey } });
    return response.status(200).json({ accepted: true, ...accepted });
  } catch (error) { return next(error); }
});

accountRouter.get("/export", async (request, response, next) => {
  try {
    const auth = getAuth(response);
    const exported = await exportAccountData(auth.user!.userId);
    response.setHeader("content-disposition", `attachment; filename=\"dictionaryroot-account-export-${auth.user!.userId}.json\"`);
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "account.exported", targetType: "user", targetId: auth.user!.userId, request, response });
    return response.status(200).json(exported);
  } catch (error) { return next(error); }
});

accountRouter.post("/delete-request", requireCsrf, async (request, response, next) => {
  try {
    const parsed = deletionRequestSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_DELETION_REQUEST", message: "The deletion reason is too long." });
    const auth = getAuth(response);
    await requestAccountDeletion(auth.user!.userId, parsed.data.reason || undefined);
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "account.deletion_requested", targetType: "user", targetId: auth.user!.userId, request, response });
    return response.status(202).json({ requested: true, message: "The deletion request was recorded. Export your data before confirming deletion." });
  } catch (error) { return next(error); }
});

accountRouter.post("/delete-confirm", requireCsrf, async (request, response, next) => {
  try {
    const parsed = deletionConfirmSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "DELETION_CONFIRMATION_REQUIRED", message: "Type DELETE to confirm account deletion." });
    const auth = getAuth(response);
    await completeAccountDeletion(auth.user!.userId);
    clearSessionCookie(response);
    return response.status(200).json({ deleted: true });
  } catch (error) { return next(error); }
});
