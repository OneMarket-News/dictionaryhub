import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  authorizedOrganizationIds,
  getAuth,
  hasOrganizationPermission,
  hasSystemPermission,
  requireAuthentication,
  requireCsrf,
  requirePermission,
} from "../middleware/auth.js";
import { getQueryString, getRouteParam, isQueryParameterError, parsePagination } from "../lib/query-params.js";
import {
  WorkflowError,
  addProposalComment,
  createProposal,
  getProposal,
  getPublicationProposal,
  listProposals,
  publishProposal,
  rollbackPublication,
  transitionProposal,
  updateProposal,
  workflowSummary,
} from "../services/workflow-store.js";
import { writeAuditEvent } from "../services/audit-store.js";

export const workflowRouter = Router();
workflowRouter.use(requireAuthentication);

const targetTypes = [
  "concept",
  "meaning",
  "relationship",
  "source",
  "assertion",
  "entity",
  "temporal_assertion",
  "account",
  "claim",
  "evidence",
  "interpretation",
  "perspective",
  "causal_link",
  "cultural_memory",
] as const;
const proposalSchema = z.object({
  organizationId: z.string().uuid().nullable().optional(),
  targetType: z.enum(targetTypes),
  targetId: z.string().trim().min(1).max(300),
  rootKey: z.string().trim().max(100).optional(),
  bundleId: z.string().trim().max(300).nullable().optional(),
  changeType: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().max(3000).default(""),
  baseRevisionId: z.string().trim().max(300).nullable().optional(),
  baseSnapshot: z.record(z.string(), z.unknown()).default({}),
  proposedPatch: z.record(z.string(), z.unknown()).default({}),
  editorialRationale: z.string().trim().max(5000).default(""),
  interpretationDisclosure: z.string().trim().max(5000).default(""),
  evidence: z.array(z.object({
    sourceId: z.string().trim().min(1).max(300),
    assertionId: z.string().trim().max(300).nullable().optional(),
    note: z.string().trim().max(2000).optional(),
    role: z.enum(["supporting", "contradicting", "context", "license"]).optional(),
  })).max(100).default([]),
});
const updateSchema = proposalSchema.pick({
  title: true,
  summary: true,
  proposedPatch: true,
  editorialRationale: true,
  interpretationDisclosure: true,
  evidence: true,
});
const noteSchema = z.object({ note: z.string().trim().max(5000).default("") });
const commentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  type: z.enum(["discussion", "review_note", "change_request", "publication_note"]).default("discussion"),
});

type ProposalAccessShape = {
  proposalId: string;
  organizationId: string | null;
  createdByUserId: string;
};

function handleWorkflowError(error: unknown, response: Response, next: NextFunction): void {
  if (error instanceof WorkflowError) {
    response.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      requestId: response.locals.requestId,
    });
    return;
  }
  next(error);
}

function scopedPermission(response: Response, organizationId: string | null | undefined, permission: string): boolean {
  return hasOrganizationPermission(getAuth(response), organizationId, permission);
}

function canReadProposal(response: Response, proposal: ProposalAccessShape): boolean {
  const auth = getAuth(response);
  return proposal.createdByUserId === auth.user?.userId || scopedPermission(response, proposal.organizationId, "revision.review");
}

function denyScope(request: Request, response: Response, permission: string, organizationId: string | null | undefined): Response {
  const auth = getAuth(response);
  void writeAuditEvent({
    actorUserId: auth.user?.userId || null,
    actorIdentityId: auth.activeIdentityId,
    organizationId: organizationId || null,
    action: "authorization.denied",
    targetType: "permission_scope",
    targetId: permission,
    outcome: "denied",
    request,
    response,
    metadata: { organizationId: organizationId || null },
  });
  return response.status(403).json({
    error: "ORGANIZATION_PERMISSION_REQUIRED",
    message: organizationId
      ? `This action requires ${permission} within the proposal organization.`
      : `This action requires a system-scoped ${permission} permission.`,
    permission,
    organizationId: organizationId || null,
    requestId: response.locals.requestId,
  });
}

workflowRouter.get("/summary", async (_request, response, next) => {
  try {
    const auth = getAuth(response);
    response.status(200).json(await workflowSummary({
      userId: auth.user!.userId,
      globalReview: hasSystemPermission(auth, "revision.review"),
      reviewOrganizationIds: authorizedOrganizationIds(auth, "revision.review"),
    }));
  } catch (error) {
    next(error);
  }
});

workflowRouter.get("/proposals", async (request, response, next) => {
  try {
    const pagination = parsePagination(request.query.page, request.query.limit, { limit: 20, maxLimit: 100 });
    if (isQueryParameterError(pagination)) return response.status(400).json(pagination);
    const auth = getAuth(response);
    const status = getQueryString(request.query.status);
    const query = getQueryString(request.query.q);
    const targetType = getQueryString(request.query.targetType);
    const rootKey = getQueryString(request.query.rootKey);
    const bundleId = getQueryString(request.query.bundleId);
    const organizationId = getQueryString(request.query.organizationId);
    const submitterId = getQueryString(request.query.submitterId);
    const reviewerId = getQueryString(request.query.reviewerId);
    const warningStatus = getQueryString(request.query.warningStatus);
    const sortValue = getQueryString(request.query.sort);
    const sort = sortValue === "submitted" ? "submitted" : "activity";
    return response.status(200).json(await listProposals({
      userId: auth.user!.userId,
      globalReview: hasSystemPermission(auth, "revision.review"),
      reviewOrganizationIds: authorizedOrganizationIds(auth, "revision.review"),
      page: pagination.page,
      limit: pagination.limit,
      ...(status ? { status } : {}),
      ...(query ? { query } : {}),
      ...(targetType ? { targetType } : {}),
      ...(rootKey ? { rootKey } : {}),
      ...(bundleId ? { bundleId } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(submitterId ? { submitterId } : {}),
      ...(reviewerId ? { reviewerId } : {}),
      ...(warningStatus ? { warningStatus } : {}),
      sort,
    }));
  } catch (error) {
    next(error);
  }
});

workflowRouter.get("/proposals/:proposalId", async (request, response, next) => {
  try {
    const proposalId = getRouteParam(request.params.proposalId);
    const detail = await getProposal(proposalId);
    if (!detail) return response.status(404).json({ error: "PROPOSAL_NOT_FOUND", message: "The proposal was not found." });
    if (!canReadProposal(response, detail.proposal)) {
      return response.status(404).json({
        error: "PROPOSAL_NOT_FOUND",
        message: "The proposal was not found or is not accessible.",
      });
    }
    return response.status(200).json(detail);
  } catch (error) {
    next(error);
  }
});

workflowRouter.post("/proposals", requireCsrf, requirePermission("revision.create"), async (request, response, next) => {
  try {
    const parsed = proposalSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_PROPOSAL", message: "The proposal fields are invalid.", details: parsed.error.issues });
    if (!scopedPermission(response, parsed.data.organizationId, "revision.create")) {
      return denyScope(request, response, "revision.create", parsed.data.organizationId);
    }
    const auth = getAuth(response);
    const detail = await createProposal({ userId: auth.user!.userId, ...parsed.data });
    await writeAuditEvent({
      actorUserId: auth.user!.userId,
      actorIdentityId: auth.activeIdentityId,
      organizationId: parsed.data.organizationId || null,
      action: "proposal.created",
      targetType: "proposal",
      targetId: detail!.proposal.proposalId,
      request,
      response,
    });
    return response.status(201).json(detail);
  } catch (error) {
    handleWorkflowError(error, response, next);
  }
});

workflowRouter.patch("/proposals/:proposalId", requireCsrf, requirePermission("revision.create"), async (request, response, next) => {
  try {
    const parsed = updateSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_PROPOSAL", message: "The proposal fields are invalid.", details: parsed.error.issues });
    const proposalId = getRouteParam(request.params.proposalId);
    const current = await getProposal(proposalId);
    if (!current) return response.status(404).json({ error: "PROPOSAL_NOT_FOUND", message: "The proposal was not found." });
    if (!canReadProposal(response, current.proposal)) {
      return response.status(404).json({
        error: "PROPOSAL_NOT_FOUND",
        message: "The proposal was not found or is not accessible.",
      });
    }
    if (!scopedPermission(response, current.proposal.organizationId, "revision.create")) {
      return denyScope(request, response, "revision.create", current.proposal.organizationId);
    }
    const auth = getAuth(response);
    const detail = await updateProposal({
      proposalId,
      userId: auth.user!.userId,
      canEditAny: hasOrganizationPermission(auth, current.proposal.organizationId, "revision.edit_any"),
      ...parsed.data,
    });
    await writeAuditEvent({
      actorUserId: auth.user!.userId,
      actorIdentityId: auth.activeIdentityId,
      organizationId: current.proposal.organizationId,
      action: "proposal.updated",
      targetType: "proposal",
      targetId: proposalId,
      request,
      response,
    });
    return response.status(200).json(detail);
  } catch (error) {
    handleWorkflowError(error, response, next);
  }
});

workflowRouter.post("/proposals/:proposalId/comments", requireCsrf, requirePermission("revision.comment"), async (request, response, next) => {
  try {
    const parsed = commentSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_COMMENT", message: "The comment is invalid.", details: parsed.error.issues });
    const proposalId = getRouteParam(request.params.proposalId);
    const current = await getProposal(proposalId);
    if (!current) return response.status(404).json({ error: "PROPOSAL_NOT_FOUND", message: "The proposal was not found." });
    if (!canReadProposal(response, current.proposal)) {
      return response.status(404).json({
        error: "PROPOSAL_NOT_FOUND",
        message: "The proposal was not found or is not accessible.",
      });
    }
    if (!scopedPermission(response, current.proposal.organizationId, "revision.comment")) {
      return denyScope(request, response, "revision.comment", current.proposal.organizationId);
    }
    const auth = getAuth(response);
    const detail = await addProposalComment({
      proposalId,
      userId: auth.user!.userId,
      body: parsed.data.body,
      type: parsed.data.type,
    });
    await writeAuditEvent({
      actorUserId: auth.user!.userId,
      actorIdentityId: auth.activeIdentityId,
      organizationId: current.proposal.organizationId,
      action: "proposal.comment_added",
      targetType: "proposal",
      targetId: proposalId,
      request,
      response,
      metadata: { commentType: parsed.data.type },
    });
    return response.status(201).json(detail);
  } catch (error) {
    handleWorkflowError(error, response, next);
  }
});

for (const action of ["submit", "start_review", "request_changes", "approve", "reject", "withdraw"] as const) {
  const permission = action === "submit" || action === "withdraw" ? "revision.submit" : "revision.review";
  workflowRouter.post(
    `/proposals/:proposalId/${action.replace("_", "-")}`,
    requireCsrf,
    requirePermission(permission),
    async (request, response, next) => {
      try {
        const parsed = noteSchema.safeParse(request.body || {});
        if (!parsed.success) return response.status(400).json({ error: "INVALID_DECISION", message: "The decision note is invalid." });
        const proposalId = getRouteParam(request.params.proposalId);
        const current = await getProposal(proposalId);
        if (!current) return response.status(404).json({ error: "PROPOSAL_NOT_FOUND", message: "The proposal was not found." });
        if (!canReadProposal(response, current.proposal)) {
          return response.status(404).json({
            error: "PROPOSAL_NOT_FOUND",
            message: "The proposal was not found or is not accessible.",
          });
        }
        if (!scopedPermission(response, current.proposal.organizationId, permission)) {
          return denyScope(request, response, permission, current.proposal.organizationId);
        }
        const auth = getAuth(response);
        const reviewAction = permission === "revision.review";
        const detail = await transitionProposal({
          proposalId,
          userId: auth.user!.userId,
          action,
          note: parsed.data.note,
          canReview: reviewAction && hasOrganizationPermission(auth, current.proposal.organizationId, "revision.review"),
        });
        await writeAuditEvent({
          actorUserId: auth.user!.userId,
          actorIdentityId: auth.activeIdentityId,
          organizationId: current.proposal.organizationId,
          action: `proposal.${action}`,
          targetType: "proposal",
          targetId: proposalId,
          request,
          response,
        });
        return response.status(200).json(detail);
      } catch (error) {
        handleWorkflowError(error, response, next);
      }
    },
  );
}

workflowRouter.post("/proposals/:proposalId/publish", requireCsrf, requirePermission("revision.publish"), async (request, response, next) => {
  try {
    const parsed = noteSchema.safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_PUBLICATION", message: "The publication note is invalid." });
    const proposalId = getRouteParam(request.params.proposalId);
    const current = await getProposal(proposalId);
    if (!current) return response.status(404).json({ error: "PROPOSAL_NOT_FOUND", message: "The proposal was not found." });
    if (!canReadProposal(response, current.proposal)) {
      return response.status(404).json({
        error: "PROPOSAL_NOT_FOUND",
        message: "The proposal was not found or is not accessible.",
      });
    }
    if (!scopedPermission(response, current.proposal.organizationId, "revision.publish")) {
      return denyScope(request, response, "revision.publish", current.proposal.organizationId);
    }
    const auth = getAuth(response);
    const detail = await publishProposal({ proposalId, userId: auth.user!.userId, note: parsed.data.note });
    await writeAuditEvent({
      actorUserId: auth.user!.userId,
      actorIdentityId: auth.activeIdentityId,
      organizationId: current.proposal.organizationId,
      action: "proposal.published",
      targetType: "proposal",
      targetId: proposalId,
      request,
      response,
    });
    return response.status(201).json(detail);
  } catch (error) {
    handleWorkflowError(error, response, next);
  }
});

workflowRouter.post("/publications/:publicationId/rollback", requireCsrf, requirePermission("revision.publish"), async (request, response, next) => {
  try {
    const parsed = z.object({ reason: z.string().trim().min(1).max(5000) }).safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "ROLLBACK_REASON_REQUIRED", message: "A rollback reason is required." });
    const publicationId = getRouteParam(request.params.publicationId);
    const publication = await getPublicationProposal(publicationId);
    if (!publication) return response.status(404).json({ error: "PUBLICATION_NOT_FOUND", message: "The publication was not found." });
    if (!scopedPermission(response, publication.organizationId, "revision.publish")) {
      return response.status(404).json({
        error: "PUBLICATION_NOT_FOUND",
        message: "The publication was not found or is not accessible.",
      });
    }
    const auth = getAuth(response);
    const detail = await rollbackPublication({ publicationId, userId: auth.user!.userId, reason: parsed.data.reason });
    await writeAuditEvent({
      actorUserId: auth.user!.userId,
      actorIdentityId: auth.activeIdentityId,
      organizationId: publication.organizationId,
      action: "publication.rolled_back",
      targetType: "publication",
      targetId: publicationId,
      request,
      response,
    });
    return response.status(200).json(detail);
  } catch (error) {
    handleWorkflowError(error, response, next);
  }
});
