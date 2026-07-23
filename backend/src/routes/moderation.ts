import { Router } from "express";
import { z } from "zod";
import { getAuth, requireAuthentication, requireCsrf } from "../middleware/auth.js";
import { createModerationReport } from "../services/admin-store.js";
import { writeAuditEvent } from "../services/audit-store.js";

export const moderationRouter = Router();
moderationRouter.use(requireAuthentication);
moderationRouter.post("/reports", requireCsrf, async (request, response, next) => {
  try {
    const parsed = z.object({
      targetType: z.string().trim().min(1).max(80),
      targetId: z.string().trim().min(1).max(300),
      category: z.enum(["spam", "misleading", "copyright", "abuse", "conflict_of_interest", "other"]),
      details: z.string().trim().max(5000).default(""),
    }).safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "INVALID_REPORT", message: "The report fields are invalid." });
    const auth = getAuth(response);
    const result = await createModerationReport({ userId: auth.user!.userId, ...parsed.data });
    await writeAuditEvent({ actorUserId: auth.user!.userId, actorIdentityId: auth.activeIdentityId, action: "moderation.report_created", targetType: parsed.data.targetType, targetId: parsed.data.targetId, request, response, metadata: { reportId: result.reportId, category: parsed.data.category } });
    return response.status(201).json(result);
  } catch (error) { return next(error); }
});
