import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../lib/database.js";
import { randomToken, sha256 } from "../lib/security.js";
import type {
  AuthContext,
  AuthIdentity,
  AuthOrganization,
  AuthUser,
  IdentityProvider,
  ProviderProfile,
} from "../auth/types.js";

export class AuthStoreError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface UserRow {
  user_id: string;
  primary_email: string | null;
  display_name: string;
  avatar_url: string;
  public_handle: string | null;
  account_status: AuthUser["accountStatus"];
  email_verified_at: Date | null;
  last_signed_in_at: Date | null;
  created_at: Date;
}

interface IdentityRow {
  identity_id: string;
  provider: IdentityProvider;
  provider_email: string | null;
  email_verified: boolean;
  profile: Record<string, unknown> | null;
  last_signed_in_at: Date | null;
  created_at: Date;
}

function requireDatabase() {
  const database = getPool();
  if (!database) throw new AuthStoreError(503, "DATABASE_REQUIRED", "Authentication requires DATABASE_URL and the governed-platform migrations.");
  return database;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function mapUser(row: UserRow): AuthUser {
  return {
    userId: row.user_id,
    primaryEmail: row.primary_email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    publicHandle: row.public_handle,
    accountStatus: row.account_status,
    emailVerifiedAt: row.email_verified_at?.toISOString() || null,
    lastSignedInAt: row.last_signed_in_at?.toISOString() || null,
    createdAt: row.created_at.toISOString(),
  };
}

function mapIdentity(row: IdentityRow): AuthIdentity {
  return {
    identityId: row.identity_id,
    provider: row.provider,
    providerEmail: row.provider_email,
    emailVerified: row.email_verified,
    profile: row.profile || {},
    lastSignedInAt: row.last_signed_in_at?.toISOString() || null,
    createdAt: row.created_at.toISOString(),
  };
}

async function ensureDefaultRoles(client: PoolClient, userId: string, email: string | null): Promise<void> {
  await client.query(
    `INSERT INTO dr_role_assignments (
       assignment_id, user_id, role_key, scope_type, scope_id
     ) VALUES ($1,$2,'registered','system','global')
     ON CONFLICT (user_id, role_key, scope_type, scope_id) DO NOTHING`,
    [randomUUID(), userId],
  );
  const adminEmails = (process.env.BOOTSTRAP_ADMIN_EMAILS || process.env.BOOTSTRAP_ADMIN_EMAIL || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  if (email && adminEmails.includes(normalizeEmail(email))) {
    await client.query(
      `INSERT INTO dr_role_assignments (
         assignment_id, user_id, role_key, scope_type, scope_id
       ) VALUES ($1,$2,'system_admin','system','global')
       ON CONFLICT (user_id, role_key, scope_type, scope_id) DO NOTHING`,
      [randomUUID(), userId],
    );
  }
}

export async function upsertProviderIdentity(
  profile: ProviderProfile,
  options: { linkToUserId?: string | null } = {},
): Promise<{ userId: string; identityId: string; created: boolean }> {
  const database = requireDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ identity_id: string; user_id: string }>(
      `SELECT identity_id, user_id FROM dr_auth_identities
       WHERE provider = $1 AND provider_subject = $2 FOR UPDATE`,
      [profile.provider, profile.subject],
    );
    let userId = options.linkToUserId || null;
    let identityId: string;
    let created = false;

    if (existing.rowCount) {
      const row = existing.rows[0]!;
      if (userId && row.user_id !== userId) {
        throw new AuthStoreError(409, "IDENTITY_ALREADY_LINKED", "That sign-in identity is already connected to another DictionaryRoot account.");
      }
      userId = row.user_id;
      identityId = row.identity_id;
      await client.query(
        `UPDATE dr_auth_identities
         SET provider_email = $1, email_verified = $2, profile = $3::jsonb,
             last_signed_in_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE identity_id = $4`,
        [profile.email, profile.emailVerified, JSON.stringify(profile.profile), identityId],
      );
    } else {
      if (!userId && profile.email && profile.emailVerified) {
        const byEmail = await client.query<{ user_id: string }>(
          `SELECT user_id FROM dr_users
           WHERE LOWER(primary_email) = LOWER($1) AND account_status <> 'deleted'
           LIMIT 1 FOR UPDATE`,
          [profile.email],
        );
        userId = byEmail.rows[0]?.user_id || null;
      }
      if (!userId) {
        userId = randomUUID();
        await client.query(
          `INSERT INTO dr_users (
             user_id, primary_email, display_name, avatar_url, email_verified_at,
             last_signed_in_at
           ) VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)`,
          [
            userId,
            profile.emailVerified ? profile.email : null,
            profile.displayName,
            profile.avatarUrl,
            profile.emailVerified ? new Date() : null,
          ],
        );
        created = true;
      }
      identityId = randomUUID();
      await client.query(
        `INSERT INTO dr_auth_identities (
           identity_id, user_id, provider, provider_subject, provider_email,
           email_verified, profile, last_signed_in_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,CURRENT_TIMESTAMP)`,
        [
          identityId, userId, profile.provider, profile.subject, profile.email,
          profile.emailVerified, JSON.stringify(profile.profile),
        ],
      );
    }

    const userResult = await client.query<UserRow>(
      `SELECT * FROM dr_users WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const user = userResult.rows[0];
    if (!user) throw new AuthStoreError(404, "USER_NOT_FOUND", "The linked DictionaryRoot account no longer exists.");
    if (user.account_status === "suspended") throw new AuthStoreError(403, "ACCOUNT_SUSPENDED", "This DictionaryRoot account is suspended.");
    if (user.account_status === "deleted") throw new AuthStoreError(403, "ACCOUNT_DELETED", "This DictionaryRoot account is no longer active.");

    await client.query(
      `UPDATE dr_users SET
         primary_email = COALESCE(primary_email, $1),
         display_name = CASE WHEN display_name = '' THEN $2 ELSE display_name END,
         avatar_url = CASE WHEN avatar_url = '' THEN $3 ELSE avatar_url END,
         email_verified_at = CASE WHEN $4::boolean THEN COALESCE(email_verified_at, CURRENT_TIMESTAMP) ELSE email_verified_at END,
         last_signed_in_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $5`,
      [profile.email, profile.displayName, profile.avatarUrl, profile.emailVerified, userId],
    );
    await ensureDefaultRoles(client, userId, profile.email);
    await client.query("COMMIT");
    return { userId, identityId, created };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createAuthSession(input: {
  userId: string;
  identityId: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<{ token: string; csrfToken: string; expiresAt: string; sessionId: string }> {
  const database = requireDatabase();
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const sessionId = randomUUID();
  const durationDays = Math.max(1, Math.min(90, Number.parseInt(process.env.SESSION_DURATION_DAYS || "30", 10) || 30));
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  await database.query(
    `INSERT INTO dr_auth_sessions (
       session_id, user_id, identity_id, token_hash, csrf_token, expires_at,
       user_agent, ip_address
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [sessionId, input.userId, input.identityId, sha256(token), csrfToken, expiresAt, input.userAgent || "", input.ipAddress || ""],
  );
  return { token, csrfToken, expiresAt: expiresAt.toISOString(), sessionId };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const database = requireDatabase();
  await database.query(
    `UPDATE dr_auth_sessions SET revoked_at = CURRENT_TIMESTAMP
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [sha256(token)],
  );
}

export async function revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
  const database = requireDatabase();
  const result = await database.query(
    `UPDATE dr_auth_sessions SET revoked_at = CURRENT_TIMESTAMP
     WHERE session_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [sessionId, userId],
  );
  return Boolean(result.rowCount);
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string | null): Promise<number> {
  const database = requireDatabase();
  const result = await database.query(
    `UPDATE dr_auth_sessions SET revoked_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND revoked_at IS NULL
       AND ($2::uuid IS NULL OR session_id <> $2::uuid)`,
    [userId, exceptSessionId || null],
  );
  return result.rowCount || 0;
}

export async function getAuthContextByToken(token: string | null): Promise<AuthContext> {
  if (!token) return anonymousAuthContext();
  const database = requireDatabase();
  const session = await database.query<{
    session_id: string;
    user_id: string;
    csrf_token: string;
    expires_at: Date;
    active_identity_id: string | null;
  }>(
    `SELECT s.session_id, s.user_id, s.csrf_token, s.expires_at,
            s.identity_id AS active_identity_id
     FROM dr_auth_sessions s
     JOIN dr_users u ON u.user_id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP
       AND u.account_status = 'active'
     LIMIT 1`,
    [sha256(token)],
  );
  if (!session.rowCount) return anonymousAuthContext();
  const sessionRow = session.rows[0]!;
  const [userResult, identityResult, roleResult, permissionResult, systemPermissionResult, organizationResult] = await Promise.all([
    database.query<UserRow>(`SELECT * FROM dr_users WHERE user_id = $1`, [sessionRow.user_id]),
    database.query<IdentityRow>(
      `SELECT identity_id, provider, provider_email, email_verified, profile, last_signed_in_at, created_at
       FROM dr_auth_identities WHERE user_id = $1 ORDER BY created_at`,
      [sessionRow.user_id],
    ),
    database.query<{ role_key: string }>(
      `SELECT DISTINCT role_key FROM dr_role_assignments WHERE user_id = $1 ORDER BY role_key`,
      [sessionRow.user_id],
    ),
    database.query<{ permission_key: string }>(
      `SELECT DISTINCT rp.permission_key
       FROM dr_role_assignments ra
       JOIN dr_role_permissions rp ON rp.role_key = ra.role_key
       WHERE ra.user_id = $1 ORDER BY rp.permission_key`,
      [sessionRow.user_id],
    ),
    database.query<{ permission_key: string }>(
      `SELECT DISTINCT rp.permission_key
       FROM dr_role_assignments ra
       JOIN dr_role_permissions rp ON rp.role_key = ra.role_key
       WHERE ra.user_id = $1 AND ra.scope_type = 'system'
       ORDER BY rp.permission_key`,
      [sessionRow.user_id],
    ),
    database.query<{
      organization_id: string;
      organization_name: string;
      organization_slug: string;
      membership_status: string;
      roles: string[];
      permissions: string[];
    }>(
      `SELECT o.organization_id, o.organization_name, o.organization_slug,
              m.membership_status,
              COALESCE(array_agg(DISTINCT ra.role_key) FILTER (WHERE ra.role_key IS NOT NULL), '{}') AS roles,
              COALESCE(array_agg(DISTINCT rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL), '{}') AS permissions
       FROM dr_organization_memberships m
       JOIN dr_organizations o ON o.organization_id = m.organization_id
       LEFT JOIN dr_role_assignments ra
         ON ra.user_id = m.user_id AND ra.scope_type = 'organization'
        AND ra.scope_id = o.organization_id::text
       LEFT JOIN dr_role_permissions rp ON rp.role_key = ra.role_key
       WHERE m.user_id = $1
       GROUP BY o.organization_id, o.organization_name, o.organization_slug, m.membership_status
       ORDER BY o.organization_name`,
      [sessionRow.user_id],
    ),
  ]);
  const user = userResult.rows[0];
  if (!user) return anonymousAuthContext();
  void database.query(`UPDATE dr_auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE session_id = $1`, [sessionRow.session_id]);
  return {
    authenticated: true,
    sessionId: sessionRow.session_id,
    csrfToken: sessionRow.csrf_token,
    user: mapUser(user),
    identities: identityResult.rows.map(mapIdentity),
    roles: roleResult.rows.map((row) => row.role_key),
    permissions: permissionResult.rows.map((row) => row.permission_key),
    systemPermissions: systemPermissionResult.rows.map((row) => row.permission_key),
    organizations: organizationResult.rows.map((row): AuthOrganization => ({
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      organizationSlug: row.organization_slug,
      membershipStatus: row.membership_status,
      roles: row.roles || [],
      permissions: row.permissions || [],
    })),
    activeIdentityId: sessionRow.active_identity_id,
  };
}

export function anonymousAuthContext(): AuthContext {
  return {
    authenticated: false,
    sessionId: null,
    csrfToken: null,
    user: null,
    identities: [],
    roles: [],
    permissions: [],
    systemPermissions: [],
    organizations: [],
    activeIdentityId: null,
  };
}

export async function createOauthState(input: {
  provider: "google" | "apple";
  intent: "signin" | "link";
  userId?: string | null;
  codeVerifier: string;
  nonce: string;
  returnTo: string;
}): Promise<string> {
  const database = requireDatabase();
  const state = randomToken(32);
  await database.query(
    `INSERT INTO dr_auth_oauth_states (
       state_id, state_hash, provider, intent, user_id, code_verifier,
       nonce, return_to, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP + INTERVAL '10 minutes')`,
    [randomUUID(), sha256(state), input.provider, input.intent, input.userId || null, input.codeVerifier, input.nonce, input.returnTo],
  );
  return state;
}

export async function consumeOauthState(state: string, provider: "google" | "apple"): Promise<{
  intent: "signin" | "link";
  userId: string | null;
  codeVerifier: string;
  nonce: string;
  returnTo: string;
}> {
  const database = requireDatabase();
  const result = await database.query<{
    state_id: string;
    intent: "signin" | "link";
    user_id: string | null;
    code_verifier: string;
    nonce: string;
    return_to: string;
  }>(
    `UPDATE dr_auth_oauth_states SET consumed_at = CURRENT_TIMESTAMP
     WHERE state_hash = $1 AND provider = $2 AND consumed_at IS NULL
       AND expires_at > CURRENT_TIMESTAMP
     RETURNING state_id, intent, user_id, code_verifier, nonce, return_to`,
    [sha256(state), provider],
  );
  const row = result.rows[0];
  if (!row) throw new AuthStoreError(400, "INVALID_OAUTH_STATE", "The sign-in request expired or was already used.");
  return {
    intent: row.intent,
    userId: row.user_id,
    codeVerifier: row.code_verifier,
    nonce: row.nonce,
    returnTo: row.return_to,
  };
}

export async function createEmailChallenge(input: {
  email: string;
  intent: "signin" | "link";
  userId?: string | null;
  returnTo: string;
  requestedIp: string;
}): Promise<string> {
  const database = requireDatabase();
  const email = normalizeEmail(input.email);
  const recent = await database.query<{ email_count: string; ip_count: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE LOWER(email) = LOWER($1))::text AS email_count,
       COUNT(*) FILTER (WHERE requested_ip = $2 AND $2 <> '')::text AS ip_count
     FROM dr_auth_email_challenges
     WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'`,
    [email, input.requestedIp],
  );
  if (Number(recent.rows[0]?.email_count || 0) >= 5 || Number(recent.rows[0]?.ip_count || 0) >= 20) {
    throw new AuthStoreError(429, "EMAIL_RATE_LIMITED", "Too many sign-in links were requested. Try again later.");
  }
  const token = randomToken(32);
  const ttlMinutes = Math.max(5, Math.min(60, Number.parseInt(process.env.EMAIL_LINK_TTL_MINUTES || "15", 10) || 15));
  await database.query(
    `INSERT INTO dr_auth_email_challenges (
       challenge_id, token_hash, email, intent, user_id, return_to,
       requested_ip, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP + ($8 || ' minutes')::interval)`,
    [randomUUID(), sha256(token), email, input.intent, input.userId || null, input.returnTo, input.requestedIp, String(ttlMinutes)],
  );
  return token;
}

export async function consumeEmailChallenge(token: string): Promise<{
  email: string;
  intent: "signin" | "link";
  userId: string | null;
  returnTo: string;
}> {
  const database = requireDatabase();
  const result = await database.query<{
    email: string;
    intent: "signin" | "link";
    user_id: string | null;
    return_to: string;
  }>(
    `UPDATE dr_auth_email_challenges SET consumed_at = CURRENT_TIMESTAMP
     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP
     RETURNING email, intent, user_id, return_to`,
    [sha256(token)],
  );
  const row = result.rows[0];
  if (!row) throw new AuthStoreError(400, "INVALID_EMAIL_LINK", "This email sign-in link expired or was already used.");
  return { email: row.email, intent: row.intent, userId: row.user_id, returnTo: row.return_to };
}

export async function updateAccountProfile(userId: string, input: {
  displayName: string;
  publicHandle: string | null;
}): Promise<void> {
  const database = requireDatabase();
  try {
    await database.query(
      `UPDATE dr_users SET display_name = $1, public_handle = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3 AND account_status = 'active'`,
      [input.displayName, input.publicHandle, userId],
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new AuthStoreError(409, "HANDLE_UNAVAILABLE", "That public handle is already in use.");
    }
    throw error;
  }
}

export async function listUserSessions(userId: string): Promise<Array<{
  sessionId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string;
  ipAddress: string;
}>> {
  const database = requireDatabase();
  const result = await database.query<{
    session_id: string;
    created_at: Date;
    last_seen_at: Date;
    expires_at: Date;
    user_agent: string;
    ip_address: string;
  }>(
    `SELECT session_id, created_at, last_seen_at, expires_at, user_agent, ip_address
     FROM dr_auth_sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
     ORDER BY last_seen_at DESC`,
    [userId],
  );
  return result.rows.map((row) => ({
    sessionId: row.session_id,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    userAgent: row.user_agent,
    ipAddress: row.ip_address,
  }));
}

export async function unlinkIdentity(userId: string, identityId: string): Promise<void> {
  const database = requireDatabase();
  const count = await database.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM dr_auth_identities WHERE user_id = $1`,
    [userId],
  );
  if (Number(count.rows[0]?.count || 0) <= 1) {
    throw new AuthStoreError(409, "LAST_IDENTITY", "Connect another sign-in method before removing this one.");
  }
  const result = await database.query(
    `DELETE FROM dr_auth_identities WHERE identity_id = $1 AND user_id = $2`,
    [identityId, userId],
  );
  if (!result.rowCount) throw new AuthStoreError(404, "IDENTITY_NOT_FOUND", "That sign-in method was not found on your account.");
}

export async function acceptInvitation(input: {
  userId: string;
  token: string;
}): Promise<{ invitationId: string; organizationId: string; roleKey: string }> {
  const database = requireDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const invitation = await client.query<{
      invitation_id: string;
      organization_id: string | null;
      email: string;
      role_key: string;
    }>(
      `SELECT invitation_id, organization_id, email, role_key
       FROM dr_invitations
       WHERE token_hash = $1 AND accepted_at IS NULL AND revoked_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       FOR UPDATE`,
      [sha256(input.token)],
    );
    const row = invitation.rows[0];
    if (!row || !row.organization_id) {
      throw new AuthStoreError(400, "INVALID_INVITATION", "The invitation is invalid, expired, or already used.");
    }
    const verifiedEmail = await client.query<{ matches: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM dr_users u
         WHERE u.user_id = $1 AND u.primary_email IS NOT NULL
           AND LOWER(u.primary_email) = LOWER($2)
         UNION ALL
         SELECT 1 FROM dr_auth_identities i
         WHERE i.user_id = $1 AND i.email_verified = TRUE
           AND i.provider_email IS NOT NULL AND LOWER(i.provider_email) = LOWER($2)
       ) AS matches`,
      [input.userId, row.email],
    );
    if (!verifiedEmail.rows[0]?.matches) {
      throw new AuthStoreError(403, "INVITATION_EMAIL_MISMATCH", "Sign in with the verified email address that received this invitation.");
    }
    await client.query(
      `INSERT INTO dr_organization_memberships (
         membership_id, organization_id, user_id, membership_status, joined_at
       ) VALUES ($1,$2,$3,'active',CURRENT_TIMESTAMP)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET
         membership_status = 'active', joined_at = COALESCE(dr_organization_memberships.joined_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP`,
      [randomUUID(), row.organization_id, input.userId],
    );
    await client.query(
      `INSERT INTO dr_role_assignments (
         assignment_id, user_id, role_key, scope_type, scope_id
       ) VALUES ($1,$2,$3,'organization',$4)
       ON CONFLICT (user_id, role_key, scope_type, scope_id) DO NOTHING`,
      [randomUUID(), input.userId, row.role_key, row.organization_id],
    );
    await client.query(
      `UPDATE dr_invitations SET accepted_at = CURRENT_TIMESTAMP WHERE invitation_id = $1`,
      [row.invitation_id],
    );
    await client.query("COMMIT");
    return { invitationId: row.invitation_id, organizationId: row.organization_id, roleKey: row.role_key };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function exportAccountData(userId: string): Promise<Record<string, unknown>> {
  const database = requireDatabase();
  const [user, identities, roles, organizations, proposals, comments, auditEvents, accountActions] = await Promise.all([
    database.query(
      `SELECT user_id, primary_email, display_name, avatar_url, public_handle,
              account_status, email_verified_at, last_signed_in_at, created_at, updated_at
       FROM dr_users WHERE user_id = $1`,
      [userId],
    ),
    database.query(
      `SELECT identity_id, provider, provider_email, email_verified, profile,
              last_signed_in_at, created_at, updated_at
       FROM dr_auth_identities WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    ),
    database.query(
      `SELECT role_key, scope_type, scope_id, assigned_at
       FROM dr_role_assignments WHERE user_id = $1 ORDER BY assigned_at`,
      [userId],
    ),
    database.query(
      `SELECT o.organization_id, o.organization_name, o.organization_slug,
              m.membership_status, m.joined_at, m.created_at
       FROM dr_organization_memberships m
       JOIN dr_organizations o ON o.organization_id = m.organization_id
       WHERE m.user_id = $1 ORDER BY o.organization_name`,
      [userId],
    ),
    database.query(
      `SELECT proposal_id, proposal_number, target_type, target_id, proposal_title,
              proposal_summary, status, version_number, created_at, updated_at
       FROM dr_change_proposals WHERE created_by_user_id = $1 ORDER BY created_at`,
      [userId],
    ),
    database.query(
      `SELECT comment_id, proposal_id, comment_type, comment_body, is_resolved,
              created_at, updated_at
       FROM dr_proposal_comments WHERE author_user_id = $1 ORDER BY created_at`,
      [userId],
    ),
    database.query(
      `SELECT audit_event_id, action, target_type, target_id, outcome, request_id,
              metadata, created_at
       FROM dr_audit_events WHERE actor_user_id = $1 ORDER BY created_at`,
      [userId],
    ),
    database.query(
      `SELECT account_action_id, action_type, reason, expires_at, created_at
       FROM dr_account_actions WHERE target_user_id = $1 ORDER BY created_at`,
      [userId],
    ),
  ]);
  return {
    schema: "dictionaryroot-account-export-v1",
    exportedAt: new Date().toISOString(),
    user: user.rows[0] || null,
    linkedIdentities: identities.rows,
    roles: roles.rows,
    organizations: organizations.rows,
    proposals: proposals.rows,
    comments: comments.rows,
    auditEvents: auditEvents.rows,
    accountActions: accountActions.rows,
  };
}

export async function requestAccountDeletion(userId: string, reason = "User requested account deletion."): Promise<void> {
  const database = requireDatabase();
  await database.query(
    `INSERT INTO dr_account_actions (
       account_action_id, target_user_id, action_type, actor_user_id, reason
     ) VALUES ($1,$2,'delete_requested',$2,$3)`,
    [randomUUID(), userId, reason],
  );
}

export async function completeAccountDeletion(userId: string): Promise<void> {
  const database = requireDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE dr_users SET
         primary_email = NULL,
         display_name = 'Deleted account',
         avatar_url = '',
         public_handle = NULL,
         account_status = 'deleted',
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND account_status <> 'deleted'`,
      [userId],
    );
    if (!updated.rowCount) throw new AuthStoreError(404, "ACCOUNT_NOT_FOUND", "The active account was not found.");
    await client.query(`DELETE FROM dr_auth_identities WHERE user_id = $1`, [userId]);
    await client.query(`UPDATE dr_auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    await client.query(
      `INSERT INTO dr_account_actions (
         account_action_id, target_user_id, action_type, actor_user_id, reason
       ) VALUES ($1,$2,'delete_completed',$2,'User confirmed account deletion.')`,
      [randomUUID(), userId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
