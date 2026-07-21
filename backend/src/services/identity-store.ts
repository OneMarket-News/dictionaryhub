import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { Request } from "express";

import { getPool } from "../lib/database.js";

export type DictionaryRootActorType = "human" | "organization" | "service" | "autonomous_agent";
export type DictionaryRootVerificationLevel =
  | "unverified"
  | "email_verified"
  | "organization_verified"
  | "verified_human"
  | "registered_service";
export type DictionaryRootAccountStatus = "active" | "suspended" | "disabled";

export interface DictionaryRootActor {
  actorId: string;
  actorType: DictionaryRootActorType;
  displayName: string;
  handle: string;
  email: string;
  accountStatus: DictionaryRootAccountStatus;
  providerId: string;
  providerSubject: string;
  verificationLevel: DictionaryRootVerificationLevel;
  verificationClaims: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DictionaryRootDelegation {
  delegationId: string;
  principalActorId: string;
  principalDisplayName: string;
  delegateActorId: string;
  delegateDisplayName: string;
  status: string;
  permissionScope: string[];
  humanApprovalRequired: boolean;
  startsAt: string;
  expiresAt: string | null;
  note: string;
}

export interface DictionaryRootAuthContext {
  authenticated: true;
  sessionId: string;
  actor: DictionaryRootActor;
  roles: string[];
  permissions: string[];
  delegation: DictionaryRootDelegation | null;
  issuedBy: string;
  expiresAt: string;
}

export interface DictionaryRootRole {
  roleKey: string;
  displayName: string;
  description: string;
  roleRank: number;
  permissions: Array<{
    permissionKey: string;
    displayName: string;
    description: string;
    sensitive: boolean;
  }>;
}

interface ActorRow {
  actor_id: string;
  actor_type: DictionaryRootActorType;
  display_name: string;
  handle: string | null;
  email: string | null;
  account_status: DictionaryRootAccountStatus;
  provider_id: string;
  provider_subject: string;
  verification_level: DictionaryRootVerificationLevel;
  verification_claims: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface SessionRow extends ActorRow {
  session_id: string;
  session_provider_id: string;
  expires_at: Date;
  roles: string[] | null;
  permissions: string[] | null;
}

interface DelegationRow {
  delegation_id: string;
  principal_actor_id: string;
  principal_display_name: string;
  delegate_actor_id: string;
  delegate_display_name: string;
  delegation_status: string;
  permission_scope: string[] | null;
  human_approval_required: boolean;
  starts_at: Date;
  expires_at: Date | null;
  note: string | null;
}

function requireDatabase() {
  const database = getPool();
  if (!database) throw new Error("DATABASE_URL is not configured.");
  return database;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mapActor(row: ActorRow): DictionaryRootActor {
  return {
    actorId: row.actor_id,
    actorType: row.actor_type,
    displayName: row.display_name,
    handle: row.handle || "",
    email: row.email || "",
    accountStatus: row.account_status,
    providerId: row.provider_id,
    providerSubject: row.provider_subject,
    verificationLevel: row.verification_level,
    verificationClaims: row.verification_claims || {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapDelegation(row: DelegationRow): DictionaryRootDelegation {
  return {
    delegationId: row.delegation_id,
    principalActorId: row.principal_actor_id,
    principalDisplayName: row.principal_display_name,
    delegateActorId: row.delegate_actor_id,
    delegateDisplayName: row.delegate_display_name,
    status: row.delegation_status,
    permissionScope: row.permission_scope || [],
    humanApprovalRequired: Boolean(row.human_approval_required),
    startsAt: row.starts_at.toISOString(),
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    note: row.note || "",
  };
}

function developmentModeEnabled(): boolean {
  const mode = String(process.env.SOURCEROOT_AUTH_MODE || "development").toLowerCase();
  return mode === "development" && process.env.NODE_ENV !== "production";
}

export function extractBearerToken(request: Request): string {
  const authorization = String(request.headers.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export function actorSnapshot(context: DictionaryRootAuthContext): Record<string, unknown> {
  return {
    actorId: context.actor.actorId,
    displayName: context.actor.displayName,
    actorType: context.actor.actorType,
    verificationLevel: context.actor.verificationLevel,
    roles: context.roles,
    permissions: context.permissions,
    delegation: context.delegation
      ? {
          delegationId: context.delegation.delegationId,
          principalActorId: context.delegation.principalActorId,
          principalDisplayName: context.delegation.principalDisplayName,
          humanApprovalRequired: context.delegation.humanApprovalRequired,
        }
      : null,
  };
}

export function hasPermission(context: DictionaryRootAuthContext, permission: string): boolean {
  return context.permissions.includes(permission);
}

export function isVerifiedHuman(context: DictionaryRootAuthContext): boolean {
  return context.actor.actorType === "human" && context.actor.verificationLevel === "verified_human";
}

export async function getDictionaryRootIdentityProviders() {
  const database = requireDatabase();
  const result = await database.query<{
    provider_id: string;
    provider_type: string;
    display_name: string;
    interface_version: string;
    enabled: boolean;
    configuration: Record<string, unknown> | null;
  }>(`
    SELECT provider_id, provider_type, display_name, interface_version, enabled, configuration
    FROM dictionaryroot_identity_providers
    ORDER BY enabled DESC, display_name ASC;
  `);
  return {
    authMode: developmentModeEnabled() ? "development" : "external-provider-required",
    providerInterfaceVersion: "1.0",
    providers: result.rows.map((row) => ({
      providerId: row.provider_id,
      providerType: row.provider_type,
      displayName: row.display_name,
      interfaceVersion: row.interface_version,
      enabled: Boolean(row.enabled),
      configuration: row.configuration || {},
    })),
    sensitivePolicies: {
      verifiedHumanRequiredFor: ["editorial.approve", "graph.promote"],
      autonomousAgentsMayNotFinalize: true,
      delegationIsAlwaysRecorded: true,
    },
  };
}

export async function listDictionaryRootDevelopmentActors(): Promise<DictionaryRootActor[]> {
  if (!developmentModeEnabled()) return [];
  const database = requireDatabase();
  const result = await database.query<ActorRow>(`
    SELECT actor_id, actor_type, display_name, handle, email, account_status,
      provider_id, provider_subject, verification_level, verification_claims,
      created_at, updated_at
    FROM dictionaryroot_actors
    WHERE provider_id = 'dictionaryroot-local-development'
    ORDER BY CASE actor_type WHEN 'human' THEN 0 ELSE 1 END, display_name ASC;
  `);
  return result.rows.map(mapActor);
}

async function activeDelegationForActor(actorId: string): Promise<DictionaryRootDelegation | null> {
  const database = requireDatabase();
  const result = await database.query<DelegationRow>(`
    SELECT d.delegation_id, d.principal_actor_id, principal.display_name AS principal_display_name,
      d.delegate_actor_id, delegate.display_name AS delegate_display_name,
      d.delegation_status, d.permission_scope, d.human_approval_required,
      d.starts_at, d.expires_at, d.note
    FROM dictionaryroot_delegations d
    JOIN dictionaryroot_actors principal ON principal.actor_id = d.principal_actor_id
    JOIN dictionaryroot_actors delegate ON delegate.actor_id = d.delegate_actor_id
    WHERE d.delegate_actor_id = $1
      AND d.delegation_status = 'active'
      AND d.starts_at <= CURRENT_TIMESTAMP
      AND (d.expires_at IS NULL OR d.expires_at > CURRENT_TIMESTAMP)
    ORDER BY d.created_at DESC
    LIMIT 1;
  `, [actorId]);
  return result.rows[0] ? mapDelegation(result.rows[0]) : null;
}

export async function createDictionaryRootDevelopmentSession(actorId: string) {
  if (!developmentModeEnabled()) {
    throw Object.assign(new Error("Local development sign-in is disabled outside development mode."), { statusCode: 403 });
  }
  const database = requireDatabase();
  const actorResult = await database.query<ActorRow>(`
    SELECT actor_id, actor_type, display_name, handle, email, account_status,
      provider_id, provider_subject, verification_level, verification_claims,
      created_at, updated_at
    FROM dictionaryroot_actors
    WHERE actor_id = $1 AND provider_id = 'dictionaryroot-local-development'
    LIMIT 1;
  `, [actorId]);
  const actorRow = actorResult.rows[0];
  if (!actorRow) throw Object.assign(new Error("The requested development identity does not exist."), { statusCode: 404 });
  if (actorRow.account_status !== "active") {
    throw Object.assign(new Error("This identity is not active."), { statusCode: 403 });
  }

  const token = randomBytes(32).toString("base64url");
  const sessionId = `dictionaryroot-session-${randomUUID()}`;
  const sessionHours = Math.max(1, Math.min(168, Number(process.env.SOURCEROOT_AUTH_SESSION_HOURS || 12)));
  const expiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000);
  await database.query(`
    INSERT INTO dictionaryroot_sessions (
      session_id, actor_id, provider_id, token_hash, expires_at, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6::JSONB);
  `, [
    sessionId,
    actorRow.actor_id,
    actorRow.provider_id,
    hashToken(token),
    expiresAt,
    JSON.stringify({ developmentSession: true, publicAuthentication: false }),
  ]);

  const context = await resolveDictionaryRootSessionToken(token);
  if (!context) throw new Error("The development session could not be resolved after creation.");
  return { token, context };
}

export async function resolveDictionaryRootSessionToken(token: string): Promise<DictionaryRootAuthContext | null> {
  const normalized = String(token || "").trim();
  if (!normalized) return null;
  const database = requireDatabase();
  const result = await database.query<SessionRow>(`
    SELECT
      s.session_id,
      s.provider_id AS session_provider_id,
      s.expires_at,
      a.actor_id, a.actor_type, a.display_name, a.handle, a.email,
      a.account_status, a.provider_id, a.provider_subject,
      a.verification_level, a.verification_claims, a.created_at, a.updated_at,
      COALESCE(ARRAY_AGG(DISTINCT ar.role_key) FILTER (WHERE ar.role_key IS NOT NULL), ARRAY[]::TEXT[]) AS roles,
      COALESCE(ARRAY_AGG(DISTINCT rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL), ARRAY[]::TEXT[]) AS permissions
    FROM dictionaryroot_sessions s
    JOIN dictionaryroot_actors a ON a.actor_id = s.actor_id
    LEFT JOIN dictionaryroot_actor_roles ar ON ar.actor_id = a.actor_id
    LEFT JOIN dictionaryroot_role_permissions rp ON rp.role_key = ar.role_key
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > CURRENT_TIMESTAMP
      AND a.account_status = 'active'
    GROUP BY s.session_id, s.provider_id, s.expires_at,
      a.actor_id, a.actor_type, a.display_name, a.handle, a.email,
      a.account_status, a.provider_id, a.provider_subject,
      a.verification_level, a.verification_claims, a.created_at, a.updated_at
    LIMIT 1;
  `, [hashToken(normalized)]);
  const row = result.rows[0];
  if (!row) return null;
  await database.query(`UPDATE dictionaryroot_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE session_id = $1;`, [row.session_id]);
  return {
    authenticated: true,
    sessionId: row.session_id,
    actor: mapActor(row),
    roles: row.roles || [],
    permissions: row.permissions || [],
    delegation: await activeDelegationForActor(row.actor_id),
    issuedBy: row.session_provider_id,
    expiresAt: row.expires_at.toISOString(),
  };
}

export async function revokeDictionaryRootSession(token: string): Promise<boolean> {
  const normalized = String(token || "").trim();
  if (!normalized) return false;
  const database = requireDatabase();
  const result = await database.query(`
    UPDATE dictionaryroot_sessions
    SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
    WHERE token_hash = $1 AND revoked_at IS NULL;
  `, [hashToken(normalized)]);
  return (result.rowCount ?? 0) > 0;
}

export async function listDictionaryRootActors(): Promise<Array<DictionaryRootActor & { roles: string[] }>> {
  const database = requireDatabase();
  const result = await database.query<ActorRow & { roles: string[] | null }>(`
    SELECT a.actor_id, a.actor_type, a.display_name, a.handle, a.email,
      a.account_status, a.provider_id, a.provider_subject, a.verification_level,
      a.verification_claims, a.created_at, a.updated_at,
      COALESCE(ARRAY_AGG(ar.role_key ORDER BY ar.role_key) FILTER (WHERE ar.role_key IS NOT NULL), ARRAY[]::TEXT[]) AS roles
    FROM dictionaryroot_actors a
    LEFT JOIN dictionaryroot_actor_roles ar ON ar.actor_id = a.actor_id
    GROUP BY a.actor_id
    ORDER BY a.actor_type, a.display_name;
  `);
  return result.rows.map((row) => ({ ...mapActor(row), roles: row.roles || [] }));
}

export async function listDictionaryRootRoles(): Promise<DictionaryRootRole[]> {
  const database = requireDatabase();
  const result = await database.query<{
    role_key: string;
    role_display_name: string;
    role_description: string;
    role_rank: number;
    permission_key: string | null;
    permission_display_name: string | null;
    permission_description: string | null;
    sensitive: boolean | null;
  }>(`
    SELECT r.role_key, r.display_name AS role_display_name,
      r.description AS role_description, r.role_rank,
      p.permission_key, p.display_name AS permission_display_name,
      p.description AS permission_description, p.sensitive
    FROM dictionaryroot_roles r
    LEFT JOIN dictionaryroot_role_permissions rp ON rp.role_key = r.role_key
    LEFT JOIN dictionaryroot_permissions p ON p.permission_key = rp.permission_key
    ORDER BY r.role_rank, p.permission_key;
  `);
  const roles = new Map<string, DictionaryRootRole>();
  for (const row of result.rows) {
    let role = roles.get(row.role_key);
    if (!role) {
      role = {
        roleKey: row.role_key,
        displayName: row.role_display_name,
        description: row.role_description,
        roleRank: row.role_rank,
        permissions: [],
      };
      roles.set(row.role_key, role);
    }
    if (row.permission_key && row.permission_display_name && row.permission_description) {
      role.permissions.push({
        permissionKey: row.permission_key,
        displayName: row.permission_display_name,
        description: row.permission_description,
        sensitive: Boolean(row.sensitive),
      });
    }
  }
  return Array.from(roles.values());
}

export async function listDictionaryRootDelegations(): Promise<DictionaryRootDelegation[]> {
  const database = requireDatabase();
  const result = await database.query<DelegationRow>(`
    SELECT d.delegation_id, d.principal_actor_id, principal.display_name AS principal_display_name,
      d.delegate_actor_id, delegate.display_name AS delegate_display_name,
      d.delegation_status, d.permission_scope, d.human_approval_required,
      d.starts_at, d.expires_at, d.note
    FROM dictionaryroot_delegations d
    JOIN dictionaryroot_actors principal ON principal.actor_id = d.principal_actor_id
    JOIN dictionaryroot_actors delegate ON delegate.actor_id = d.delegate_actor_id
    ORDER BY d.created_at DESC;
  `);
  return result.rows.map(mapDelegation);
}
