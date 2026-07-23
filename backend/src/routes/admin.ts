import { Router, type NextFunction, type Response } from "express";
import { z } from "zod";
import {
  authorizedOrganizationIds, getAuth, hasOrganizationPermission, hasSystemPermission,
  requireAuthentication, requireCsrf, requirePermission,
} from "../middleware/auth.js";
import { getQueryString, getRouteParam, isQueryParameterError, parsePagination } from "../lib/query-params.js";
import {
  AdminStoreError, assignOrganizationRole, assignRole, createInvitation, createOrganization, createRecordLock, getAdminOverview,
  listAdminUsers, listAuditEvents, listModerationReports, listOrganizationMembers, listOrganizations, listRecordLocks, listRoles,
  releaseRecordLock, removeOrganizationRole, removeRole, resolveModerationReport, setAccountStatus,
} from "../services/admin-store.js";
import { writeAuditEvent } from "../services/audit-store.js";
import { deliverInvitationEmail, frontendPublicUrl } from "../services/auth-providers.js";

export const adminRouter = Router();
adminRouter.use(requireAuthentication);

function handle(error: unknown, response: Response, next: NextFunction): void {
  if (error instanceof AdminStoreError) {
    response.status(error.statusCode).json({ error: error.code, message: error.message, requestId: response.locals.requestId });
    return;
  }
  next(error);
}

adminRouter.get("/overview", requirePermission("audit.read"), async (_request, response, next) => {
  try {
    const auth = getAuth(response);
    response.status(200).json(await getAdminOverview({
      globalAccess: hasSystemPermission(auth, "audit.read"),
      organizationIds: authorizedOrganizationIds(auth, "audit.read"),
    }));
  } catch (error) { next(error); }
});

adminRouter.get("/users", requirePermission("user.manage"), async (request, response, next) => {
  try {
    const pagination = parsePagination(request.query.page, request.query.limit, { limit: 25, maxLimit: 100 });
    if (isQueryParameterError(pagination)) return response.status(400).json(pagination);
    return response.status(200).json(await listAdminUsers(pagination.page, pagination.limit, getQueryString(request.query.q) || ""));
  } catch (error) { next(error); }
});

adminRouter.get("/roles", requirePermission("organization.manage"), async (_request, response, next) => {
  try { response.status(200).json({ roles: await listRoles() }); } catch (error) { next(error); }
});

adminRouter.post("/users/:userId/roles", requireCsrf, requirePermission("user.manage"), async (request, response, next) => {
  try {
    const parsed = z.object({ roleKey: z.string().min(1), scopeType: z.enum(["system", "organization"]), scopeId: z.string().min(1).default("global") }).safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_ROLE_ASSIGNMENT", message: "Role assignment fields are invalid." });
    const auth = getAuth(response);
    const userId = getRouteParam(request.params.userId);
    await assignRole({ targetUserId: userId, actorUserId: auth.user!.userId, ...parsed.data });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "role.assigned", targetType: "user", targetId: userId, request, response, metadata: parsed.data });
    return response.status(204).end();
  } catch (error) { handle(error, response, next); }
});

adminRouter.delete("/users/:userId/roles/:roleKey", requireCsrf, requirePermission("user.manage"), async (request, response, next) => {
  try {
    const scopeType = getQueryString(request.query.scopeType) || "system";
    const scopeId = getQueryString(request.query.scopeId) || "global";
    const userId = getRouteParam(request.params.userId);
    const roleKey = getRouteParam(request.params.roleKey);
    await removeRole({ targetUserId: userId, roleKey, scopeType, scopeId });
    const auth = getAuth(response);
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "role.removed", targetType: "user", targetId: userId, request, response, metadata: { roleKey, scopeType, scopeId } });
    return response.status(204).end();
  } catch (error) { handle(error, response, next); }
});

adminRouter.post("/users/:userId/status", requireCsrf, requirePermission("moderation.manage"), async (request, response, next) => {
  try {
    const parsed = z.object({ status: z.enum(["active", "suspended"]), reason: z.string().trim().min(1).max(3000) }).safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_ACCOUNT_ACTION", message: "Account status and reason are required." });
    const auth = getAuth(response);
    const userId = getRouteParam(request.params.userId);
    if (auth.user!.userId === userId && parsed.data.status === "suspended") return response.status(409).json({ error: "SELF_SUSPENSION_BLOCKED", message: "Administrators cannot suspend their current account." });
    await setAccountStatus({ targetUserId: userId, actorUserId: auth.user!.userId, ...parsed.data });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: `account.${parsed.data.status}`, targetType: "user", targetId: userId, request, response, metadata: { reason: parsed.data.reason } });
    return response.status(204).end();
  } catch (error) { handle(error, response, next); }
});

adminRouter.get("/audit", requirePermission("audit.read"), async (request, response, next) => {
  try {
    const pagination = parsePagination(request.query.page, request.query.limit, { limit: 50, maxLimit: 200 });
    if (isQueryParameterError(pagination)) return response.status(400).json(pagination);
    const auth = getAuth(response);
    return response.status(200).json(await listAuditEvents({
      page: pagination.page,
      limit: pagination.limit,
      action: getQueryString(request.query.action) || "",
      globalAccess: hasSystemPermission(auth, "audit.read"),
      organizationIds: authorizedOrganizationIds(auth, "audit.read"),
    }));
  } catch (error) { next(error); }
});

adminRouter.get("/organizations", requirePermission("organization.manage"), async (_request, response, next) => {
  try {
    const auth = getAuth(response);
    response.status(200).json({ organizations: await listOrganizations({
      globalAccess: hasSystemPermission(auth, "organization.manage"),
      organizationIds: authorizedOrganizationIds(auth, "organization.manage"),
    }) });
  } catch (error) { next(error); }
});

adminRouter.post("/organizations", requireCsrf, requirePermission("organization.manage"), async (request, response, next) => {
  try {
    const parsed = z.object({ name: z.string().trim().min(2).max(150), slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/) }).safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_ORGANIZATION", message: "Organization name or slug is invalid." });
    const auth = getAuth(response);
    if (!hasSystemPermission(auth, "organization.manage")) {
      return response.status(403).json({ error: "SYSTEM_PERMISSION_REQUIRED", message: "Only a system administrator can create an organization.", requestId: response.locals.requestId });
    }
    const organization = await createOrganization({ actorUserId: auth.user!.userId, ...parsed.data });
    return response.status(201).json(organization);
  } catch (error) { handle(error, response, next); }
});

adminRouter.get("/organizations/:organizationId/members", requirePermission("organization.manage"), async (request, response, next) => {
  try {
    const auth = getAuth(response);
    const organizationId = getRouteParam(request.params.organizationId);
    if (!hasOrganizationPermission(auth, organizationId, "organization.manage")) {
      return response.status(403).json({ error: "ORGANIZATION_PERMISSION_REQUIRED", message: "You can only inspect members in an organization you administer.", requestId: response.locals.requestId });
    }
    return response.status(200).json(await listOrganizationMembers(organizationId));
  } catch (error) { handle(error, response, next); }
});

adminRouter.post("/organizations/:organizationId/members/:userId/roles", requireCsrf, requirePermission("organization.manage"), async (request, response, next) => {
  try {
    const parsed = z.object({ roleKey: z.string().trim().min(1).max(80) }).safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_ROLE_ASSIGNMENT", message: "An organization role is required." });
    const auth = getAuth(response);
    const organizationId = getRouteParam(request.params.organizationId);
    const userId = getRouteParam(request.params.userId);
    if (!hasOrganizationPermission(auth, organizationId, "organization.manage")) {
      return response.status(403).json({ error: "ORGANIZATION_PERMISSION_REQUIRED", message: "You can only assign roles inside an organization you administer.", requestId: response.locals.requestId });
    }
    await assignOrganizationRole({ organizationId, targetUserId: userId, roleKey: parsed.data.roleKey, actorUserId: auth.user!.userId });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, organizationId, action: "organization_role.assigned", targetType: "user", targetId: userId, request, response, metadata: { roleKey: parsed.data.roleKey } });
    return response.status(204).end();
  } catch (error) { handle(error, response, next); }
});

adminRouter.delete("/organizations/:organizationId/members/:userId/roles/:roleKey", requireCsrf, requirePermission("organization.manage"), async (request, response, next) => {
  try {
    const auth = getAuth(response);
    const organizationId = getRouteParam(request.params.organizationId);
    const userId = getRouteParam(request.params.userId);
    const roleKey = getRouteParam(request.params.roleKey);
    if (!hasOrganizationPermission(auth, organizationId, "organization.manage")) {
      return response.status(403).json({ error: "ORGANIZATION_PERMISSION_REQUIRED", message: "You can only remove roles inside an organization you administer.", requestId: response.locals.requestId });
    }
    await removeOrganizationRole({ organizationId, targetUserId: userId, roleKey });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, organizationId, action: "organization_role.removed", targetType: "user", targetId: userId, request, response, metadata: { roleKey } });
    return response.status(204).end();
  } catch (error) { handle(error, response, next); }
});

adminRouter.post("/organizations/:organizationId/invitations", requireCsrf, requirePermission("organization.manage"), async (request, response, next) => {
  try {
    const parsed = z.object({ email: z.string().email().max(320), roleKey: z.string().min(1).max(80) }).safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_INVITATION", message: "Invitation email or role is invalid." });
    const auth = getAuth(response);
    const organizationId = getRouteParam(request.params.organizationId);
    if (!hasOrganizationPermission(auth, organizationId, "organization.manage")) {
      return response.status(403).json({ error: "ORGANIZATION_PERMISSION_REQUIRED", message: "You can only invite members to an organization you administer.", requestId: response.locals.requestId });
    }
    const invitation = await createInvitation({ organizationId, actorUserId: auth.user!.userId, ...parsed.data });
    const invitationLink = new URL("/account-v1.html", frontendPublicUrl());
    invitationLink.searchParams.set("invitation", invitation.token);
    const delivery = await deliverInvitationEmail({
      email: parsed.data.email,
      link: invitationLink.toString(),
      organizationName: invitation.organizationName,
      roleName: invitation.roleName,
    });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, organizationId, action: "invitation.created", targetType: "invitation", targetId: invitation.invitationId, request, response, metadata: { roleKey: parsed.data.roleKey, deliveryMode: delivery.mode } });
    return response.status(201).json({
      invitationId: invitation.invitationId,
      delivered: true,
      deliveryMode: delivery.mode,
      developmentLink: delivery.exposedLink,
    });
  } catch (error) { handle(error, response, next); }
});

adminRouter.get("/moderation/reports", requirePermission("moderation.manage"), async (request, response, next) => {
  try {
    const pagination = parsePagination(request.query.page, request.query.limit, { limit: 25, maxLimit: 100 });
    if (isQueryParameterError(pagination)) return response.status(400).json(pagination);
    return response.status(200).json(await listModerationReports(pagination.page, pagination.limit, getQueryString(request.query.status) || "open"));
  } catch (error) { next(error); }
});

adminRouter.post("/moderation/reports/:reportId/resolve", requireCsrf, requirePermission("moderation.manage"), async (request, response, next) => {
  try {
    const parsed = z.object({ status: z.enum(["triaged", "resolved", "dismissed"]), note: z.string().trim().max(5000).default("") }).safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_REPORT_RESOLUTION", message: "Report resolution fields are invalid." });
    const auth = getAuth(response);
    const reportId = getRouteParam(request.params.reportId);
    await resolveModerationReport({ reportId, userId: auth.user!.userId, ...parsed.data });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: `moderation.report_${parsed.data.status}`, targetType: "moderation_report", targetId: reportId, request, response, metadata: { note: parsed.data.note } });
    return response.status(204).end();
  } catch (error) { handle(error, response, next); }
});

adminRouter.get("/moderation/locks", requirePermission("moderation.manage"), async (_request, response, next) => {
  try {
    return response.status(200).json({ locks: await listRecordLocks() });
  } catch (error) { return next(error); }
});

adminRouter.post("/moderation/locks", requireCsrf, requirePermission("moderation.manage"), async (request, response, next) => {
  try {
    const parsed = z.object({
      targetType: z.string().trim().min(1).max(80),
      targetId: z.string().trim().min(1).max(300),
      reason: z.string().trim().min(1).max(3000),
      expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    }).safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_RECORD_LOCK", message: "Target, reason, or expiration is invalid." });
    const auth = getAuth(response);
    const result = await createRecordLock({ actorUserId: auth.user!.userId, ...parsed.data });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "record.locked", targetType: parsed.data.targetType, targetId: parsed.data.targetId, request, response, metadata: { reason: parsed.data.reason, expiresAt: parsed.data.expiresAt || null } });
    return response.status(201).json(result);
  } catch (error) { handle(error, response, next); }
});

adminRouter.delete("/moderation/locks/:recordLockId", requireCsrf, requirePermission("moderation.manage"), async (request, response, next) => {
  try {
    const auth = getAuth(response);
    const recordLockId = getRouteParam(request.params.recordLockId);
    await releaseRecordLock({ recordLockId, actorUserId: auth.user!.userId });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "record.unlocked", targetType: "record_lock", targetId: recordLockId, request, response });
    return response.status(204).end();
  } catch (error) { handle(error, response, next); }
});
