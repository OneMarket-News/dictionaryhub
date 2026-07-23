CREATE TABLE IF NOT EXISTS dr_users (
  user_id UUID PRIMARY KEY,
  primary_email TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  public_handle TEXT,
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'deleted')),
  email_verified_at TIMESTAMPTZ,
  last_signed_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS dr_users_primary_email_unique
  ON dr_users (LOWER(primary_email))
  WHERE primary_email IS NOT NULL AND account_status <> 'deleted';

CREATE UNIQUE INDEX IF NOT EXISTS dr_users_public_handle_unique
  ON dr_users (LOWER(public_handle))
  WHERE public_handle IS NOT NULL AND account_status <> 'deleted';

CREATE TABLE IF NOT EXISTS dr_auth_identities (
  identity_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES dr_users(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('email', 'google', 'apple', 'development')),
  provider_subject TEXT NOT NULL,
  provider_email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_signed_in_at TIMESTAMPTZ,
  UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS dr_auth_identities_user_idx
  ON dr_auth_identities(user_id);

CREATE TABLE IF NOT EXISTS dr_auth_sessions (
  session_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES dr_users(user_id) ON DELETE CASCADE,
  identity_id UUID REFERENCES dr_auth_identities(identity_id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_auth_sessions_user_idx
  ON dr_auth_sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS dr_auth_sessions_expiry_idx
  ON dr_auth_sessions(expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS dr_auth_oauth_states (
  state_id UUID PRIMARY KEY,
  state_hash TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  intent TEXT NOT NULL DEFAULT 'signin' CHECK (intent IN ('signin', 'link')),
  user_id UUID REFERENCES dr_users(user_id) ON DELETE CASCADE,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  return_to TEXT NOT NULL DEFAULT '/account-v1.html',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_auth_oauth_states_expiry_idx
  ON dr_auth_oauth_states(expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS dr_auth_email_challenges (
  challenge_id UUID PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'signin' CHECK (intent IN ('signin', 'link')),
  user_id UUID REFERENCES dr_users(user_id) ON DELETE CASCADE,
  return_to TEXT NOT NULL DEFAULT '/account-v1.html',
  requested_ip TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_auth_email_challenges_rate_idx
  ON dr_auth_email_challenges(LOWER(email), created_at DESC);

CREATE TABLE IF NOT EXISTS dr_organizations (
  organization_id UUID PRIMARY KEY,
  organization_name TEXT NOT NULL,
  organization_slug TEXT NOT NULL UNIQUE,
  organization_status TEXT NOT NULL DEFAULT 'active'
    CHECK (organization_status IN ('active', 'suspended', 'archived')),
  created_by_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dr_organization_memberships (
  membership_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES dr_organizations(organization_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dr_users(user_id) ON DELETE CASCADE,
  membership_status TEXT NOT NULL DEFAULT 'active'
    CHECK (membership_status IN ('invited', 'active', 'suspended', 'removed')),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS dr_permissions (
  permission_key TEXT PRIMARY KEY,
  permission_description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dr_roles (
  role_key TEXT PRIMARY KEY,
  role_name TEXT NOT NULL,
  role_description TEXT NOT NULL,
  role_scope TEXT NOT NULL CHECK (role_scope IN ('system', 'organization')),
  is_system_role BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS dr_role_permissions (
  role_key TEXT NOT NULL REFERENCES dr_roles(role_key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES dr_permissions(permission_key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS dr_role_assignments (
  assignment_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES dr_users(user_id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES dr_roles(role_key) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('system', 'organization')),
  scope_id TEXT NOT NULL DEFAULT 'global',
  assigned_by_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, role_key, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS dr_role_assignments_user_idx
  ON dr_role_assignments(user_id);

CREATE TABLE IF NOT EXISTS dr_invitations (
  invitation_id UUID PRIMARY KEY,
  organization_id UUID REFERENCES dr_organizations(organization_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_key TEXT NOT NULL REFERENCES dr_roles(role_key),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dr_audit_events (
  audit_event_id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  actor_identity_id UUID REFERENCES dr_auth_identities(identity_id) ON DELETE SET NULL,
  organization_id UUID REFERENCES dr_organizations(organization_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'denied', 'failed')),
  request_id TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_audit_events_actor_idx
  ON dr_audit_events(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dr_audit_events_target_idx
  ON dr_audit_events(target_type, target_id, created_at DESC);

INSERT INTO dr_permissions(permission_key, permission_description) VALUES
  ('account.read', 'Read the signed-in account and linked identities.'),
  ('account.update', 'Update the signed-in account profile.'),
  ('revision.create', 'Create and edit owned draft proposals.'),
  ('revision.submit', 'Submit an owned draft proposal for review.'),
  ('revision.comment', 'Comment on proposals visible to the user.'),
  ('revision.review', 'Request changes, approve, or reject proposals.'),
  ('revision.publish', 'Publish approved proposals and perform governed rollback.'),
  ('revision.edit_any', 'Edit any proposal within the authorized scope.'),
  ('source.import', 'Import SourceRoot bundles and dictionary datasets.'),
  ('organization.read', 'Read organization membership and role details.'),
  ('organization.manage', 'Manage organization settings, invitations, and roles.'),
  ('user.manage', 'Manage user access and account status.'),
  ('audit.read', 'Read governance audit events.'),
  ('moderation.manage', 'Resolve reports, suspend accounts, and lock records.'),
  ('system.admin', 'Perform system-wide administrative actions.')
ON CONFLICT (permission_key) DO UPDATE SET
  permission_description = EXCLUDED.permission_description;

INSERT INTO dr_roles(role_key, role_name, role_description, role_scope) VALUES
  ('registered', 'Registered user', 'Verified account with personal profile access.', 'system'),
  ('contributor', 'Contributor', 'May draft and submit sourced changes.', 'organization'),
  ('reviewer', 'Reviewer', 'May review proposals and request changes.', 'organization'),
  ('publisher', 'Publisher', 'May publish approved proposals and roll back publications.', 'organization'),
  ('organization_admin', 'Organization administrator', 'Manages members, invitations, and organization roles.', 'organization'),
  ('system_admin', 'System administrator', 'System-wide governance and administrative access.', 'system')
ON CONFLICT (role_key) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  role_description = EXCLUDED.role_description,
  role_scope = EXCLUDED.role_scope;

INSERT INTO dr_role_permissions(role_key, permission_key) VALUES
  ('registered', 'account.read'),
  ('registered', 'account.update'),
  ('registered', 'organization.read'),
  ('contributor', 'account.read'),
  ('contributor', 'organization.read'),
  ('contributor', 'revision.create'),
  ('contributor', 'revision.submit'),
  ('contributor', 'revision.comment'),
  ('reviewer', 'account.read'),
  ('reviewer', 'organization.read'),
  ('reviewer', 'revision.create'),
  ('reviewer', 'revision.submit'),
  ('reviewer', 'revision.comment'),
  ('reviewer', 'revision.review'),
  ('publisher', 'account.read'),
  ('publisher', 'organization.read'),
  ('publisher', 'revision.create'),
  ('publisher', 'revision.submit'),
  ('publisher', 'revision.comment'),
  ('publisher', 'revision.review'),
  ('publisher', 'revision.publish'),
  ('organization_admin', 'account.read'),
  ('organization_admin', 'organization.read'),
  ('organization_admin', 'organization.manage'),
  ('organization_admin', 'revision.create'),
  ('organization_admin', 'revision.submit'),
  ('organization_admin', 'revision.comment'),
  ('organization_admin', 'revision.review'),
  ('organization_admin', 'audit.read'),
  ('system_admin', 'account.read'),
  ('system_admin', 'account.update'),
  ('system_admin', 'revision.create'),
  ('system_admin', 'revision.submit'),
  ('system_admin', 'revision.comment'),
  ('system_admin', 'revision.review'),
  ('system_admin', 'revision.publish'),
  ('system_admin', 'revision.edit_any'),
  ('system_admin', 'source.import'),
  ('system_admin', 'organization.read'),
  ('system_admin', 'organization.manage'),
  ('system_admin', 'user.manage'),
  ('system_admin', 'audit.read'),
  ('system_admin', 'moderation.manage'),
  ('system_admin', 'system.admin')
ON CONFLICT DO NOTHING;
