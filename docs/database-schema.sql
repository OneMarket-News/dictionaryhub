-- SourceRoot Backend Database Blueprint
-- Proposed database: PostgreSQL 16+
-- Status: planning contract, not yet applied

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE bundle_status AS ENUM (
  'draft',
  'validated',
  'ready',
  'ready-with-warnings',
  'blocked',
  'staged',
  'restored',
  'deprecated'
);

CREATE TYPE package_decision AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE integrity_status AS ENUM (
  'unknown',
  'current',
  'verified',
  'failed',
  'stale'
);

CREATE TYPE lifecycle_outcome AS ENUM (
  'recorded',
  'passed',
  'blocked',
  'saved',
  'removed',
  'exported',
  'approved',
  'rejected',
  'restored',
  'failed'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  auth_provider TEXT,
  auth_provider_subject TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id TEXT NOT NULL UNIQUE,
  bundle_type TEXT NOT NULL DEFAULT 'sourceroot-import-bundle',
  version TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT,
  description TEXT,
  status bundle_status NOT NULL DEFAULT 'draft',
  source_path TEXT,
  source_application TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_json JSONB NOT NULL,
  current_hash CHAR(64),
  warning_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX bundles_domain_idx ON bundles(domain);
CREATE INDEX bundles_status_idx ON bundles(status);
CREATE INDEX bundles_original_json_gin_idx ON bundles USING GIN(original_json);

CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  node_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  summary TEXT,
  status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX nodes_bundle_idx ON nodes(bundle_id);
CREATE INDEX nodes_domain_idx ON nodes(domain);
CREATE INDEX nodes_type_idx ON nodes(node_type);
CREATE INDEX nodes_metadata_gin_idx ON nodes USING GIN(metadata);

CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  publisher TEXT,
  url TEXT,
  source_class TEXT,
  quality_tier TEXT,
  credibility_tier TEXT,
  verification_status TEXT,
  review_status TEXT,
  license TEXT,
  license_status TEXT,
  last_reviewed DATE,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sources_bundle_idx ON sources(bundle_id);
CREATE INDEX sources_url_idx ON sources(url);
CREATE INDEX sources_publisher_idx ON sources(publisher);

CREATE TABLE assertions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  assertion_type TEXT NOT NULL,
  label TEXT,
  summary TEXT,
  body TEXT,
  domain TEXT NOT NULL,
  credibility_tier TEXT,
  confidence TEXT,
  verification_status TEXT,
  review_status TEXT,
  support_level TEXT,
  interpretation_level TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX assertions_bundle_idx ON assertions(bundle_id);
CREATE INDEX assertions_node_idx ON assertions(node_id);
CREATE INDEX assertions_type_idx ON assertions(assertion_type);

CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  label TEXT,
  summary TEXT,
  domain TEXT NOT NULL,
  credibility_tier TEXT,
  confidence TEXT,
  verification_status TEXT,
  review_status TEXT,
  support_level TEXT,
  relationship_strength TEXT,
  interpretation_level TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_node_id <> to_node_id OR relationship_type IS NOT NULL)
);

CREATE INDEX edges_bundle_idx ON edges(bundle_id);
CREATE INDEX edges_from_idx ON edges(from_node_id);
CREATE INDEX edges_to_idx ON edges(to_node_id);
CREATE INDEX edges_relationship_type_idx ON edges(relationship_type);

CREATE TABLE assertion_sources (
  assertion_id UUID NOT NULL REFERENCES assertions(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'supports',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (assertion_id, source_id, relationship)
);

CREATE TABLE edge_sources (
  edge_id UUID NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'supports',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (edge_id, source_id, relationship)
);

CREATE TABLE node_sources (
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'supports',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (node_id, source_id, relationship)
);

CREATE TABLE revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id TEXT NOT NULL UNIQUE,
  bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  object_public_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  revision_type TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL,
  revised_by UUID REFERENCES users(id),
  revised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX revisions_bundle_idx ON revisions(bundle_id);
CREATE INDEX revisions_object_idx ON revisions(object_public_id);

CREATE TABLE bundle_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  staged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  staged_by UUID REFERENCES users(id),
  source TEXT,
  status bundle_status NOT NULL,
  warning_count INTEGER NOT NULL DEFAULT 0,
  counts JSONB NOT NULL,
  bundle_hash CHAR(64) NOT NULL,
  snapshot_json JSONB NOT NULL,
  integrity_status integrity_status NOT NULL DEFAULT 'current',
  UNIQUE (bundle_id, bundle_hash)
);

CREATE INDEX bundle_snapshots_bundle_idx ON bundle_snapshots(bundle_id);
CREATE INDEX bundle_snapshots_hash_idx ON bundle_snapshots(bundle_hash);

CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id TEXT NOT NULL UNIQUE,
  bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES bundle_snapshots(id) ON DELETE RESTRICT,
  export_type TEXT NOT NULL,
  export_version TEXT NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL,
  exported_by UUID REFERENCES users(id),
  stored_hash CHAR(64) NOT NULL,
  artifact_json JSONB NOT NULL,
  integrity_status integrity_status NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX packages_bundle_idx ON packages(bundle_id);
CREATE INDEX packages_hash_idx ON packages(stored_hash);

CREATE TABLE package_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id TEXT NOT NULL UNIQUE,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  inspected_by UUID REFERENCES users(id),
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decision package_decision NOT NULL DEFAULT 'pending',
  integrity_status integrity_status NOT NULL DEFAULT 'unknown',
  can_restore BOOLEAN NOT NULL DEFAULT FALSE,
  issue_count INTEGER NOT NULL DEFAULT 0,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  stored_hash CHAR(64),
  calculated_hash CHAR(64),
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  package_snapshot JSONB NOT NULL
);

CREATE INDEX package_inspections_package_idx ON package_inspections(package_id);
CREATE INDEX package_inspections_decision_idx ON package_inspections(decision);

CREATE TABLE lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bundle_id UUID REFERENCES bundles(id) ON DELETE SET NULL,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  inspection_id UUID REFERENCES package_inspections(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  outcome lifecycle_outcome NOT NULL DEFAULT 'recorded',
  integrity_status integrity_status,
  counts JSONB,
  warning_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  stored_hash CHAR(64),
  calculated_hash CHAR(64),
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX lifecycle_events_occurred_at_idx ON lifecycle_events(occurred_at DESC);
CREATE INDEX lifecycle_events_bundle_idx ON lifecycle_events(bundle_id);
CREATE INDEX lifecycle_events_event_type_idx ON lifecycle_events(event_type);
CREATE INDEX lifecycle_events_outcome_idx ON lifecycle_events(outcome);

CREATE TABLE hub_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  extension_type TEXT NOT NULL,
  public_id TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX hub_extensions_bundle_idx ON hub_extensions(bundle_id);
CREATE INDEX hub_extensions_domain_idx ON hub_extensions(domain);
CREATE INDEX hub_extensions_type_idx ON hub_extensions(extension_type);
CREATE INDEX hub_extensions_payload_gin_idx ON hub_extensions USING GIN(payload);

INSERT INTO roles (name, description) VALUES
  ('admin', 'Full platform administration'),
  ('creator', 'Create and submit bundles'),
  ('reviewer', 'Inspect and approve packages'),
  ('reader', 'Read approved public knowledge')
ON CONFLICT (name) DO NOTHING;
