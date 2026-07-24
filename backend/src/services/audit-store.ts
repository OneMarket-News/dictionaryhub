import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { getPool } from "../lib/database.js";

export interface AuditInput {
  actorUserId?: string | null;
  actorIdentityId?: string | null;
  organizationId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  outcome?: "success" | "denied" | "failed";
  metadata?: Record<string, unknown>;
  request?: Request;
  response?: Response;
}

export async function writeAuditEvent(input: AuditInput): Promise<void> {
  const database = getPool();
  if (!database) return;
  try {
    await database.query(
      `INSERT INTO dr_audit_events (
         audit_event_id, actor_user_id, actor_identity_id, organization_id,
         action, target_type, target_id, outcome, request_id, ip_address,
         user_agent, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
        randomUUID(), input.actorUserId || null, input.actorIdentityId || null,
        input.organizationId || null, input.action, input.targetType, input.targetId,
        input.outcome || "success", input.response?.locals.requestId || "",
        input.request?.ip || "", input.request?.get("user-agent") || "",
        JSON.stringify(input.metadata || {}),
      ],
    );
  } catch (error) {
    console.error("SourceRoot audit event could not be persisted:", error);
  }
}
