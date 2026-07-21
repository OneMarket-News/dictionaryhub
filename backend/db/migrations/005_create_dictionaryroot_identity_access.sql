CREATE TABLE IF NOT EXISTS dictionaryroot_identity_providers (
  provider_id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  interface_version TEXT NOT NULL DEFAULT '1.0',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  configuration JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_dictionaryroot_identity_provider_type
    CHECK (provider_type IN ('development', 'oidc', 'passkey', 'wallet', 'proof_of_personhood', 'service'))
);

CREATE TABLE IF NOT EXISTS dictionaryroot_actors (
  actor_id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  handle TEXT,
  email TEXT,
  account_status TEXT NOT NULL DEFAULT 'active',
  provider_id TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  verification_level TEXT NOT NULL DEFAULT 'unverified',
  verification_claims JSONB NOT NULL DEFAULT '{}'::JSONB,
  raw_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dictionaryroot_actor_provider_subject UNIQUE (provider_id, provider_subject),
  CONSTRAINT fk_dictionaryroot_actor_provider FOREIGN KEY (provider_id)
    REFERENCES dictionaryroot_identity_providers(provider_id),
  CONSTRAINT ck_dictionaryroot_actor_type
    CHECK (actor_type IN ('human', 'organization', 'service', 'autonomous_agent')),
  CONSTRAINT ck_dictionaryroot_actor_status
    CHECK (account_status IN ('active', 'suspended', 'disabled')),
  CONSTRAINT ck_dictionaryroot_actor_verification
    CHECK (verification_level IN ('unverified', 'email_verified', 'organization_verified', 'verified_human', 'registered_service'))
);

CREATE TABLE IF NOT EXISTS dictionaryroot_permissions (
  permission_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  sensitive BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS dictionaryroot_roles (
  role_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  role_rank INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dictionaryroot_role_permissions (
  role_key TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  PRIMARY KEY (role_key, permission_key),
  CONSTRAINT fk_dictionaryroot_role_permission_role FOREIGN KEY (role_key)
    REFERENCES dictionaryroot_roles(role_key) ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_role_permission_permission FOREIGN KEY (permission_key)
    REFERENCES dictionaryroot_permissions(permission_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dictionaryroot_actor_roles (
  actor_id TEXT NOT NULL,
  role_key TEXT NOT NULL,
  granted_by_actor_id TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (actor_id, role_key),
  CONSTRAINT fk_dictionaryroot_actor_role_actor FOREIGN KEY (actor_id)
    REFERENCES dictionaryroot_actors(actor_id) ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_actor_role_role FOREIGN KEY (role_key)
    REFERENCES dictionaryroot_roles(role_key) ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_actor_role_grantor FOREIGN KEY (granted_by_actor_id)
    REFERENCES dictionaryroot_actors(actor_id)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_verification_claims (
  claim_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  claim_value TEXT,
  claim_status TEXT NOT NULL DEFAULT 'active',
  assurance_level INTEGER NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  raw_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT fk_dictionaryroot_verification_actor FOREIGN KEY (actor_id)
    REFERENCES dictionaryroot_actors(actor_id) ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_verification_provider FOREIGN KEY (provider_id)
    REFERENCES dictionaryroot_identity_providers(provider_id),
  CONSTRAINT ck_dictionaryroot_verification_status
    CHECK (claim_status IN ('active', 'expired', 'revoked', 'pending'))
);

CREATE TABLE IF NOT EXISTS dictionaryroot_delegations (
  delegation_id TEXT PRIMARY KEY,
  principal_actor_id TEXT NOT NULL,
  delegate_actor_id TEXT NOT NULL,
  delegation_status TEXT NOT NULL DEFAULT 'active',
  permission_scope TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  human_approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  note TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dictionaryroot_delegation_principal FOREIGN KEY (principal_actor_id)
    REFERENCES dictionaryroot_actors(actor_id),
  CONSTRAINT fk_dictionaryroot_delegation_delegate FOREIGN KEY (delegate_actor_id)
    REFERENCES dictionaryroot_actors(actor_id),
  CONSTRAINT ck_dictionaryroot_delegation_status
    CHECK (delegation_status IN ('active', 'revoked', 'expired')),
  CONSTRAINT ck_dictionaryroot_delegation_distinct
    CHECK (principal_actor_id <> delegate_actor_id)
);

CREATE TABLE IF NOT EXISTS dictionaryroot_sessions (
  session_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ,
  raw_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT fk_dictionaryroot_session_actor FOREIGN KEY (actor_id)
    REFERENCES dictionaryroot_actors(actor_id) ON DELETE CASCADE,
  CONSTRAINT fk_dictionaryroot_session_provider FOREIGN KEY (provider_id)
    REFERENCES dictionaryroot_identity_providers(provider_id)
);

ALTER TABLE dictionaryroot_editorial_reviews
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS delegated_by_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS actor_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE dictionaryroot_editorial_review_events
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS delegated_by_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS actor_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;

DO $$ BEGIN
  ALTER TABLE dictionaryroot_editorial_reviews
    ADD CONSTRAINT fk_dictionaryroot_editorial_review_actor FOREIGN KEY (actor_id)
      REFERENCES dictionaryroot_actors(actor_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE dictionaryroot_editorial_reviews
    ADD CONSTRAINT fk_dictionaryroot_editorial_review_delegator FOREIGN KEY (delegated_by_actor_id)
      REFERENCES dictionaryroot_actors(actor_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE dictionaryroot_editorial_review_events
    ADD CONSTRAINT fk_dictionaryroot_editorial_event_actor FOREIGN KEY (actor_id)
      REFERENCES dictionaryroot_actors(actor_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE dictionaryroot_editorial_review_events
    ADD CONSTRAINT fk_dictionaryroot_editorial_event_delegator FOREIGN KEY (delegated_by_actor_id)
      REFERENCES dictionaryroot_actors(actor_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO dictionaryroot_identity_providers (provider_id, provider_type, display_name, interface_version, enabled, configuration)
VALUES
  ('dictionaryroot-local-development', 'development', 'Local development identities', '1.0', TRUE, '{"publicAuthentication":false,"replaceable":true}'::JSONB),
  ('dictionaryroot-provider-oidc', 'oidc', 'Future OpenID Connect provider', '1.0', FALSE, '{"status":"adapter-ready"}'::JSONB),
  ('dictionaryroot-provider-passkey', 'passkey', 'Future passkey provider', '1.0', FALSE, '{"status":"adapter-ready"}'::JSONB),
  ('dictionaryroot-provider-personhood', 'proof_of_personhood', 'Future verified-human provider', '1.0', FALSE, '{"status":"adapter-ready"}'::JSONB),
  ('dictionaryroot-provider-service', 'service', 'Future service and agent credentials', '1.0', FALSE, '{"status":"adapter-ready"}'::JSONB)
ON CONFLICT (provider_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  interface_version = EXCLUDED.interface_version,
  configuration = EXCLUDED.configuration,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO dictionaryroot_permissions (permission_key, display_name, description, sensitive)
VALUES
  ('knowledge.read', 'Read knowledge', 'View DictionaryRoot knowledge experiences and public registries.', FALSE),
  ('editorial.read', 'Read editorial records', 'View review queues, decisions, and provenance.', FALSE),
  ('editorial.review', 'Record reviews', 'Save in-review and flagged editorial decisions.', TRUE),
  ('editorial.approve', 'Approve meanings', 'Approve or reject a meaning. Verified-human policy applies.', TRUE),
  ('graph.promote', 'Promote graph meanings', 'Promote approved meanings into the curated graph. Verified-human policy applies.', TRUE),
  ('identity.read', 'Read identity registry', 'View actors, roles, providers, claims, and delegations.', TRUE),
  ('identity.manage', 'Manage identity access', 'Manage roles, account status, and delegations.', TRUE),
  ('agent.submit', 'Submit agent recommendations', 'Allow a registered autonomous agent or service to submit non-final recommendations.', TRUE)
ON CONFLICT (permission_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  sensitive = EXCLUDED.sensitive;

INSERT INTO dictionaryroot_roles (role_key, display_name, description, role_rank)
VALUES
  ('viewer', 'Viewer', 'Read public knowledge and editorial provenance.', 10),
  ('contributor', 'Contributor', 'Submit annotations and agent recommendations without final approval.', 20),
  ('reviewer', 'Reviewer', 'Record review work and flag issues.', 30),
  ('editor', 'Editor', 'Approve meanings and promote verified work into the curated graph.', 40),
  ('administrator', 'Administrator', 'Manage identities, access, editorial decisions, and graph promotion.', 50)
ON CONFLICT (role_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  role_rank = EXCLUDED.role_rank;

INSERT INTO dictionaryroot_role_permissions (role_key, permission_key)
VALUES
  ('viewer', 'knowledge.read'), ('viewer', 'editorial.read'),
  ('contributor', 'knowledge.read'), ('contributor', 'editorial.read'), ('contributor', 'agent.submit'),
  ('reviewer', 'knowledge.read'), ('reviewer', 'editorial.read'), ('reviewer', 'editorial.review'),
  ('editor', 'knowledge.read'), ('editor', 'editorial.read'), ('editor', 'editorial.review'), ('editor', 'editorial.approve'), ('editor', 'graph.promote'),
  ('administrator', 'knowledge.read'), ('administrator', 'editorial.read'), ('administrator', 'editorial.review'), ('administrator', 'editorial.approve'), ('administrator', 'graph.promote'), ('administrator', 'identity.read'), ('administrator', 'identity.manage')
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO dictionaryroot_actors (
  actor_id, actor_type, display_name, handle, email, account_status,
  provider_id, provider_subject, verification_level, verification_claims, raw_data
)
VALUES
  ('dictionaryroot-local-human-admin', 'human', 'Local Human Administrator', 'local-admin', NULL, 'active',
   'dictionaryroot-local-development', 'local-human-admin', 'verified_human',
   '{"verifiedHuman":{"status":"development-fixture","productionEquivalent":false}}'::JSONB,
   '{"developmentFixture":true,"purpose":"Local role and provenance testing"}'::JSONB),
  ('dictionaryroot-local-human-reviewer', 'human', 'Local Human Reviewer', 'local-reviewer', NULL, 'active',
   'dictionaryroot-local-development', 'local-human-reviewer', 'verified_human',
   '{"verifiedHuman":{"status":"development-fixture","productionEquivalent":false}}'::JSONB,
   '{"developmentFixture":true,"purpose":"Local review testing"}'::JSONB),
  ('dictionaryroot-local-review-agent', 'autonomous_agent', 'DictionaryRoot Review Agent', 'local-review-agent', NULL, 'active',
   'dictionaryroot-local-development', 'local-review-agent', 'registered_service',
   '{"registeredService":{"status":"development-fixture"}}'::JSONB,
   '{"developmentFixture":true,"humanApprovalRequired":true,"purpose":"Agent provenance testing"}'::JSONB)
ON CONFLICT (actor_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  actor_type = EXCLUDED.actor_type,
  account_status = EXCLUDED.account_status,
  verification_level = EXCLUDED.verification_level,
  verification_claims = EXCLUDED.verification_claims,
  raw_data = EXCLUDED.raw_data,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO dictionaryroot_actor_roles (actor_id, role_key, granted_by_actor_id)
VALUES
  ('dictionaryroot-local-human-admin', 'administrator', 'dictionaryroot-local-human-admin'),
  ('dictionaryroot-local-human-reviewer', 'reviewer', 'dictionaryroot-local-human-admin'),
  ('dictionaryroot-local-review-agent', 'contributor', 'dictionaryroot-local-human-admin')
ON CONFLICT (actor_id, role_key) DO NOTHING;

INSERT INTO dictionaryroot_delegations (
  delegation_id, principal_actor_id, delegate_actor_id, delegation_status,
  permission_scope, human_approval_required, note, raw_data
)
VALUES (
  'dictionaryroot-local-agent-delegation',
  'dictionaryroot-local-human-admin',
  'dictionaryroot-local-review-agent',
  'active',
  ARRAY['agent.submit']::TEXT[],
  TRUE,
  'Development-only delegation proving that autonomous recommendations remain attributable to a human principal.',
  '{"developmentFixture":true,"productionEquivalent":false}'::JSONB
)
ON CONFLICT (delegation_id) DO UPDATE SET
  delegation_status = EXCLUDED.delegation_status,
  permission_scope = EXCLUDED.permission_scope,
  human_approval_required = EXCLUDED.human_approval_required,
  note = EXCLUDED.note,
  raw_data = EXCLUDED.raw_data,
  updated_at = CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_dictionaryroot_actor_provider ON dictionaryroot_actors(provider_id, provider_subject);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_actor_status ON dictionaryroot_actors(account_status, actor_type);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_sessions_actor ON dictionaryroot_sessions(actor_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_delegations_delegate ON dictionaryroot_delegations(delegate_actor_id, delegation_status);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_verification_actor ON dictionaryroot_verification_claims(actor_id, claim_status);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_editorial_review_actor ON dictionaryroot_editorial_reviews(actor_id);
CREATE INDEX IF NOT EXISTS idx_dictionaryroot_editorial_event_actor ON dictionaryroot_editorial_review_events(actor_id, created_at DESC);
