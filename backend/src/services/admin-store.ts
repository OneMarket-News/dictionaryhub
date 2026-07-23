import { randomUUID } from "node:crypto";
import { getPool } from "../lib/database.js";
import { randomToken, sha256 } from "../lib/security.js";

export class AdminStoreError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function requireDatabase() {
  const database = getPool();
  if (!database) throw new AdminStoreError(503, "DATABASE_REQUIRED", "Administration requires DATABASE_URL.");
  return database;
}

export async function getAdminOverview(input: { globalAccess: boolean; organizationIds: string[] }) {
  const database = requireDatabase();
  const scope = [input.globalAccess, input.organizationIds];
  const [users, proposals, reports, sessions, organizations, audits] = await Promise.all([
    database.query<{ total: string; active: string; suspended: string }>(
      `SELECT COUNT(DISTINCT u.user_id)::text AS total,
              COUNT(DISTINCT u.user_id) FILTER (WHERE u.account_status='active')::text AS active,
              COUNT(DISTINCT u.user_id) FILTER (WHERE u.account_status='suspended')::text AS suspended
       FROM dr_users u
       LEFT JOIN dr_organization_memberships m ON m.user_id = u.user_id AND m.membership_status='active'
       WHERE ($1::boolean OR m.organization_id = ANY($2::uuid[]))`,
      scope,
    ),
    database.query<{ total: string; waiting: string; approved: string; published: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status IN ('submitted','under_review','changes_requested'))::text AS waiting,
              COUNT(*) FILTER (WHERE status='approved')::text AS approved,
              COUNT(*) FILTER (WHERE status='published')::text AS published
       FROM dr_change_proposals
       WHERE ($1::boolean OR organization_id = ANY($2::uuid[]))`,
      scope,
    ),
    input.globalAccess
      ? database.query<{ open: string }>(`SELECT COUNT(*) FILTER (WHERE report_status IN ('open','triaged'))::text AS open FROM dr_moderation_reports`)
      : Promise.resolve({ rows: [{ open: "0" }] }),
    database.query<{ active: string }>(
      `SELECT COUNT(DISTINCT s.session_id) FILTER (WHERE s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP)::text AS active
       FROM dr_auth_sessions s
       LEFT JOIN dr_organization_memberships m ON m.user_id = s.user_id AND m.membership_status='active'
       WHERE ($1::boolean OR m.organization_id = ANY($2::uuid[]))`,
      scope,
    ),
    database.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM dr_organizations
       WHERE organization_status='active' AND ($1::boolean OR organization_id = ANY($2::uuid[]))`,
      scope,
    ),
    database.query<{ today: string }>(
      `SELECT COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours')::text AS today
       FROM dr_audit_events
       WHERE ($1::boolean OR organization_id = ANY($2::uuid[]))`,
      scope,
    ),
  ]);
  return {
    scope: input.globalAccess ? "system" : "organization",
    users: Object.fromEntries(Object.entries(users.rows[0] || {}).map(([key, value]) => [key, Number(value)])),
    proposals: Object.fromEntries(Object.entries(proposals.rows[0] || {}).map(([key, value]) => [key, Number(value)])),
    openReports: Number(reports.rows[0]?.open || 0),
    activeSessions: Number(sessions.rows[0]?.active || 0),
    organizations: Number(organizations.rows[0]?.total || 0),
    auditEventsLast24Hours: Number(audits.rows[0]?.today || 0),
  };
}

export async function listAdminUsers(page: number, limit: number, query = "") {
  const database = requireDatabase();
  const search = query ? `%${query}%` : null;
  const result = await database.query<{
    user_id: string; primary_email: string | null; display_name: string; public_handle: string | null;
    account_status: string; last_signed_in_at: Date | null; created_at: Date; roles: string[]; total_count: string;
  }>(
    `SELECT u.user_id, u.primary_email, u.display_name, u.public_handle, u.account_status,
            u.last_signed_in_at, u.created_at,
            COALESCE(array_agg(DISTINCT ra.role_key) FILTER (WHERE ra.role_key IS NOT NULL), '{}') AS roles,
            COUNT(*) OVER()::text AS total_count
     FROM dr_users u
     LEFT JOIN dr_role_assignments ra ON ra.user_id=u.user_id
     WHERE ($1::text IS NULL OR u.display_name ILIKE $1 OR u.primary_email ILIKE $1 OR u.public_handle ILIKE $1)
     GROUP BY u.user_id
     ORDER BY u.created_at DESC
     LIMIT $2 OFFSET $3`,
    [search, limit, (page - 1) * limit],
  );
  const total = Number(result.rows[0]?.total_count || 0);
  return {
    page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0,
    items: result.rows.map((row) => ({
      userId: row.user_id, primaryEmail: row.primary_email, displayName: row.display_name,
      publicHandle: row.public_handle, accountStatus: row.account_status, roles: row.roles || [],
      lastSignedInAt: row.last_signed_in_at?.toISOString() || null, createdAt: row.created_at.toISOString(),
    })),
  };
}

export async function listAuditEvents(input: {
  page: number;
  limit: number;
  action?: string;
  globalAccess: boolean;
  organizationIds: string[];
}) {
  const database = requireDatabase();
  const result = await database.query<{
    audit_event_id: string; actor_user_id: string | null; actor_name: string | null;
    organization_id: string | null; action: string; target_type: string; target_id: string; outcome: string; request_id: string;
    metadata: Record<string, unknown>; created_at: Date; total_count: string;
  }>(
    `SELECT a.audit_event_id, a.actor_user_id, u.display_name AS actor_name, a.organization_id, a.action,
            a.target_type, a.target_id, a.outcome, a.request_id, a.metadata, a.created_at,
            COUNT(*) OVER()::text AS total_count
     FROM dr_audit_events a LEFT JOIN dr_users u ON u.user_id=a.actor_user_id
     WHERE ($1='' OR a.action=$1)
       AND ($2::boolean OR a.organization_id = ANY($3::uuid[]))
     ORDER BY a.created_at DESC LIMIT $4 OFFSET $5`,
    [input.action || "", input.globalAccess, input.organizationIds, input.limit, (input.page - 1) * input.limit],
  );
  const total = Number(result.rows[0]?.total_count || 0);
  return {
    page: input.page,
    limit: input.limit,
    total,
    totalPages: total ? Math.ceil(total / input.limit) : 0,
    items: result.rows.map((row) => ({
      auditEventId: row.audit_event_id,
      actorUserId: row.actor_user_id,
      actorName: row.actor_name,
      organizationId: row.organization_id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      outcome: row.outcome,
      requestId: row.request_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
    })),
  };
}

export async function listRoles() {
  const database = requireDatabase();
  const result = await database.query<{
    role_key: string; role_name: string; role_description: string; role_scope: string; permissions: string[];
  }>(`SELECT r.role_key, r.role_name, r.role_description, r.role_scope,
            COALESCE(array_agg(rp.permission_key ORDER BY rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL), '{}') AS permissions
     FROM dr_roles r LEFT JOIN dr_role_permissions rp ON rp.role_key=r.role_key
     GROUP BY r.role_key ORDER BY r.role_scope, r.role_name`);
  return result.rows.map((row) => ({ roleKey: row.role_key, roleName: row.role_name, description: row.role_description, scope: row.role_scope, permissions: row.permissions || [] }));
}

export async function assignRole(input: {
  targetUserId: string; roleKey: string; scopeType: "system" | "organization"; scopeId: string; actorUserId: string;
}) {
  const database = requireDatabase();
  const role = await database.query<{ role_scope: string }>(`SELECT role_scope FROM dr_roles WHERE role_key=$1`, [input.roleKey]);
  if (!role.rowCount) throw new AdminStoreError(404, "ROLE_NOT_FOUND", "The requested role does not exist.");
  if (role.rows[0]!.role_scope !== input.scopeType) throw new AdminStoreError(400, "ROLE_SCOPE_MISMATCH", "The role cannot be assigned in that scope.");
  await database.query(
    `INSERT INTO dr_role_assignments (assignment_id, user_id, role_key, scope_type, scope_id, assigned_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, role_key, scope_type, scope_id) DO NOTHING`,
    [randomUUID(), input.targetUserId, input.roleKey, input.scopeType, input.scopeId, input.actorUserId],
  );
}

export async function removeRole(input: { targetUserId: string; roleKey: string; scopeType: string; scopeId: string }) {
  const database = requireDatabase();
  await database.query(`DELETE FROM dr_role_assignments WHERE user_id=$1 AND role_key=$2 AND scope_type=$3 AND scope_id=$4`, [input.targetUserId, input.roleKey, input.scopeType, input.scopeId]);
}

export async function setAccountStatus(input: {
  targetUserId: string; status: "active" | "suspended"; actorUserId: string; reason: string;
}) {
  const database = requireDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`UPDATE dr_users SET account_status=$1, updated_at=CURRENT_TIMESTAMP WHERE user_id=$2`, [input.status, input.targetUserId]);
    if (!result.rowCount) throw new AdminStoreError(404, "USER_NOT_FOUND", "The account was not found.");
    if (input.status === "suspended") await client.query(`UPDATE dr_auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND revoked_at IS NULL`, [input.targetUserId]);
    await client.query(
      `INSERT INTO dr_account_actions (account_action_id, target_user_id, action_type, actor_user_id, reason)
       VALUES ($1,$2,$3,$4,$5)`,
      [randomUUID(), input.targetUserId, input.status === "suspended" ? "suspend" : "restore", input.actorUserId, input.reason],
    );
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function createOrganization(input: { name: string; slug: string; actorUserId: string }) {
  const database = requireDatabase();
  const client = await database.connect();
  const organizationId = randomUUID();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO dr_organizations (organization_id, organization_name, organization_slug, created_by_user_id) VALUES ($1,$2,$3,$4)`, [organizationId, input.name, input.slug, input.actorUserId]);
    await client.query(`INSERT INTO dr_organization_memberships (membership_id, organization_id, user_id, membership_status, joined_at) VALUES ($1,$2,$3,'active',CURRENT_TIMESTAMP)`, [randomUUID(), organizationId, input.actorUserId]);
    await client.query(`INSERT INTO dr_role_assignments (assignment_id,user_id,role_key,scope_type,scope_id,assigned_by_user_id) VALUES ($1,$2,'organization_admin','organization',$3,$2)`, [randomUUID(), input.actorUserId, organizationId]);
    await client.query("COMMIT");
    return { organizationId, name: input.name, slug: input.slug };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function listOrganizations(input: { globalAccess: boolean; organizationIds: string[] }) {
  const database = requireDatabase();
  const result = await database.query<{
    organization_id: string; organization_name: string; organization_slug: string; organization_status: string; members: string; created_at: Date;
  }>(`SELECT o.organization_id, o.organization_name, o.organization_slug, o.organization_status,
            COUNT(m.membership_id)::text AS members, o.created_at
     FROM dr_organizations o LEFT JOIN dr_organization_memberships m ON m.organization_id=o.organization_id AND m.membership_status='active'
     WHERE ($1::boolean OR o.organization_id = ANY($2::uuid[]))
     GROUP BY o.organization_id ORDER BY o.organization_name`, [input.globalAccess, input.organizationIds]);
  return result.rows.map((row) => ({ organizationId: row.organization_id, name: row.organization_name, slug: row.organization_slug, status: row.organization_status, members: Number(row.members), createdAt: row.created_at.toISOString() }));
}

export async function listOrganizationMembers(organizationId: string) {
  const database = requireDatabase();
  const organization = await database.query<{ organization_name: string }>(
    `SELECT organization_name FROM dr_organizations WHERE organization_id=$1 AND organization_status='active'`,
    [organizationId],
  );
  if (!organization.rowCount) throw new AdminStoreError(404, "ORGANIZATION_NOT_FOUND", "The organization was not found.");
  const result = await database.query<{
    user_id: string; primary_email: string | null; display_name: string; account_status: string;
    membership_status: string; joined_at: Date | null; roles: string[];
  }>(
    `SELECT u.user_id, u.primary_email, u.display_name, u.account_status,
            m.membership_status, m.joined_at,
            COALESCE(array_agg(DISTINCT ra.role_key) FILTER (WHERE ra.role_key IS NOT NULL), '{}') AS roles
     FROM dr_organization_memberships m
     JOIN dr_users u ON u.user_id=m.user_id
     LEFT JOIN dr_role_assignments ra
       ON ra.user_id=u.user_id AND ra.scope_type='organization' AND ra.scope_id=$1::text
     WHERE m.organization_id=$1
     GROUP BY u.user_id, m.membership_status, m.joined_at
     ORDER BY u.display_name, u.primary_email`,
    [organizationId],
  );
  return {
    organizationId,
    organizationName: organization.rows[0]!.organization_name,
    members: result.rows.map((row) => ({
      userId: row.user_id,
      primaryEmail: row.primary_email,
      displayName: row.display_name,
      accountStatus: row.account_status,
      membershipStatus: row.membership_status,
      joinedAt: row.joined_at?.toISOString() || null,
      roles: row.roles || [],
    })),
  };
}

export async function assignOrganizationRole(input: {
  organizationId: string; targetUserId: string; roleKey: string; actorUserId: string;
}) {
  const database = requireDatabase();
  const scope = await database.query<{ role_scope: string; membership_status: string }>(
    `SELECT r.role_scope, m.membership_status
     FROM dr_roles r
     JOIN dr_organization_memberships m ON m.organization_id=$1 AND m.user_id=$2
     WHERE r.role_key=$3`,
    [input.organizationId, input.targetUserId, input.roleKey],
  );
  const detail = scope.rows[0];
  if (!detail) throw new AdminStoreError(404, "MEMBER_OR_ROLE_NOT_FOUND", "The organization member or role was not found.");
  if (detail.role_scope !== "organization") throw new AdminStoreError(400, "ROLE_SCOPE_MISMATCH", "Only organization-scoped roles can be assigned here.");
  if (detail.membership_status !== "active") throw new AdminStoreError(409, "MEMBERSHIP_NOT_ACTIVE", "Activate the organization membership before assigning roles.");
  await database.query(
    `INSERT INTO dr_role_assignments (assignment_id,user_id,role_key,scope_type,scope_id,assigned_by_user_id)
     VALUES ($1,$2,$3,'organization',$4,$5)
     ON CONFLICT (user_id, role_key, scope_type, scope_id) DO NOTHING`,
    [randomUUID(), input.targetUserId, input.roleKey, input.organizationId, input.actorUserId],
  );
}

export async function removeOrganizationRole(input: {
  organizationId: string; targetUserId: string; roleKey: string;
}) {
  const database = requireDatabase();
  const role = await database.query<{ role_scope: string }>(`SELECT role_scope FROM dr_roles WHERE role_key=$1`, [input.roleKey]);
  if (!role.rowCount) throw new AdminStoreError(404, "ROLE_NOT_FOUND", "The requested role does not exist.");
  if (role.rows[0]!.role_scope !== "organization") throw new AdminStoreError(400, "ROLE_SCOPE_MISMATCH", "Only organization-scoped roles can be removed here.");
  if (input.roleKey === "organization_admin") {
    const adminCount = await database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dr_role_assignments
       WHERE role_key='organization_admin' AND scope_type='organization' AND scope_id=$1`,
      [input.organizationId],
    );
    if (Number(adminCount.rows[0]?.count || 0) <= 1) {
      throw new AdminStoreError(409, "LAST_ORGANIZATION_ADMIN", "Assign another organization administrator before removing the final one.");
    }
  }
  const removed = await database.query(
    `DELETE FROM dr_role_assignments
     WHERE user_id=$1 AND role_key=$2 AND scope_type='organization' AND scope_id=$3`,
    [input.targetUserId, input.roleKey, input.organizationId],
  );
  if (!removed.rowCount) throw new AdminStoreError(404, "ROLE_ASSIGNMENT_NOT_FOUND", "That organization role assignment was not found.");
}

export async function createInvitation(input: {
  organizationId: string; email: string; roleKey: string; actorUserId: string;
}) {
  const database = requireDatabase();
  const organization = await database.query<{ organization_name: string; role_name: string }>(
    `SELECT o.organization_name, r.role_name
     FROM dr_organizations o
     JOIN dr_roles r ON r.role_key = $2 AND r.role_scope = 'organization'
     WHERE o.organization_id = $1 AND o.organization_status = 'active'`,
    [input.organizationId, input.roleKey],
  );
  const detail = organization.rows[0];
  if (!detail) throw new AdminStoreError(400, "INVALID_INVITATION_SCOPE", "The organization or organization-scoped role is invalid.");
  const token = randomToken(32);
  const invitationId = randomUUID();
  await database.query(
    `INSERT INTO dr_invitations (invitation_id, organization_id, email, role_key, token_hash, invited_by_user_id, expires_at)
     VALUES ($1,$2,LOWER($3),$4,$5,$6,CURRENT_TIMESTAMP + INTERVAL '7 days')`,
    [invitationId, input.organizationId, input.email, input.roleKey, sha256(token), input.actorUserId],
  );
  return { invitationId, token, organizationName: detail.organization_name, roleName: detail.role_name };
}

export async function listModerationReports(page: number, limit: number, status = "open") {
  const database = requireDatabase();
  const result = await database.query<{
    report_id: string; reported_by_user_id: string | null; reporter_name: string | null; target_type: string; target_id: string;
    report_category: string; report_details: string; report_status: string; resolution_note: string; created_at: Date; total_count: string;
  }>(`SELECT r.*, u.display_name AS reporter_name, COUNT(*) OVER()::text AS total_count
     FROM dr_moderation_reports r LEFT JOIN dr_users u ON u.user_id=r.reported_by_user_id
     WHERE ($1='all' OR r.report_status=$1) ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`, [status, limit, (page - 1) * limit]);
  const total = Number(result.rows[0]?.total_count || 0);
  return { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0, items: result.rows.map((row) => ({ reportId: row.report_id, reportedByUserId: row.reported_by_user_id, reporterName: row.reporter_name, targetType: row.target_type, targetId: row.target_id, category: row.report_category, details: row.report_details, status: row.report_status, resolutionNote: row.resolution_note, createdAt: row.created_at.toISOString() })) };
}

export async function createModerationReport(input: {
  userId: string; targetType: string; targetId: string; category: string; details: string;
}) {
  const database = requireDatabase();
  const reportId = randomUUID();
  await database.query(`INSERT INTO dr_moderation_reports (report_id,reported_by_user_id,target_type,target_id,report_category,report_details) VALUES ($1,$2,$3,$4,$5,$6)`, [reportId, input.userId, input.targetType, input.targetId, input.category, input.details]);
  return { reportId };
}

export async function resolveModerationReport(input: {
  reportId: string; userId: string; status: "triaged" | "resolved" | "dismissed"; note: string;
}) {
  const database = requireDatabase();
  const result = await database.query(`UPDATE dr_moderation_reports SET report_status=$1, assigned_to_user_id=$2, resolution_note=$3, resolved_at=CASE WHEN $1 IN ('resolved','dismissed') THEN CURRENT_TIMESTAMP ELSE resolved_at END, updated_at=CURRENT_TIMESTAMP WHERE report_id=$4`, [input.status, input.userId, input.note, input.reportId]);
  if (!result.rowCount) throw new AdminStoreError(404, "REPORT_NOT_FOUND", "The report was not found.");
}

export async function listRecordLocks() {
  const database = requireDatabase();
  const result = await database.query<{
    record_lock_id: string;
    target_type: string;
    target_id: string;
    lock_reason: string;
    locked_by_user_id: string | null;
    locked_by_name: string | null;
    expires_at: Date | null;
    created_at: Date;
  }>(
    `SELECT l.record_lock_id, l.target_type, l.target_id, l.lock_reason,
            l.locked_by_user_id, u.display_name AS locked_by_name,
            l.expires_at, l.created_at
     FROM dr_record_locks l
     LEFT JOIN dr_users u ON u.user_id = l.locked_by_user_id
     WHERE l.released_at IS NULL
       AND (l.expires_at IS NULL OR l.expires_at > CURRENT_TIMESTAMP)
     ORDER BY l.created_at DESC`,
  );
  return result.rows.map((row) => ({
    recordLockId: row.record_lock_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.lock_reason,
    lockedByUserId: row.locked_by_user_id,
    lockedByName: row.locked_by_name,
    expiresAt: row.expires_at?.toISOString() || null,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createRecordLock(input: {
  targetType: string;
  targetId: string;
  reason: string;
  actorUserId: string;
  expiresAt?: string | null | undefined;
}) {
  const database = requireDatabase();
  const lockId = randomUUID();
  try {
    await database.query(
      `INSERT INTO dr_record_locks (
         record_lock_id, target_type, target_id, lock_reason,
         locked_by_user_id, expires_at
       ) VALUES ($1,$2,$3,$4,$5,$6::timestamptz)`,
      [lockId, input.targetType, input.targetId, input.reason, input.actorUserId, input.expiresAt || null],
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
      throw new AdminStoreError(409, "RECORD_ALREADY_LOCKED", "That record already has an active moderation lock.");
    }
    throw error;
  }
  return { recordLockId: lockId };
}

export async function releaseRecordLock(input: {
  recordLockId: string;
  actorUserId: string;
}): Promise<void> {
  const database = requireDatabase();
  const result = await database.query(
    `UPDATE dr_record_locks SET released_at = CURRENT_TIMESTAMP, released_by_user_id = $1
     WHERE record_lock_id = $2 AND released_at IS NULL`,
    [input.actorUserId, input.recordLockId],
  );
  if (!result.rowCount) throw new AdminStoreError(404, "RECORD_LOCK_NOT_FOUND", "The active record lock was not found.");
}
