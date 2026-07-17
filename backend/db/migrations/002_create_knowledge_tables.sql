CREATE TABLE IF NOT EXISTS sources (
  source_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT,
  domain TEXT,
  publisher TEXT,
  quality_tier TEXT,
  credibility_tier TEXT,
  verification_status TEXT,
  source_class TEXT,
  license TEXT,
  license_status TEXT,
  review_status TEXT,
  last_reviewed DATE,
  url TEXT,
  notes TEXT,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nodes (
  node_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  title TEXT NOT NULL,
  node_type TEXT,
  domain TEXT,
  summary TEXT,
  status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_nodes_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assertions (
  assertion_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  assertion_type TEXT,
  label TEXT,
  summary TEXT,
  body TEXT,
  domain TEXT,
  credibility_tier TEXT,
  confidence TEXT,
  verification_status TEXT,
  review_status TEXT,
  support_level TEXT,
  interpretation_level TEXT,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_assertions_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_assertions_node
    FOREIGN KEY (node_id)
    REFERENCES nodes(node_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS edges (
  edge_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  relationship_type TEXT,
  label TEXT,
  summary TEXT,
  domain TEXT,
  credibility_tier TEXT,
  confidence TEXT,
  verification_status TEXT,
  review_status TEXT,
  support_level TEXT,
  relationship_strength TEXT,
  interpretation_level TEXT,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_edges_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_edges_from_node
    FOREIGN KEY (from_node_id)
    REFERENCES nodes(node_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_edges_to_node
    FOREIGN KEY (to_node_id)
    REFERENCES nodes(node_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS revisions (
  revision_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  revision_type TEXT,
  summary TEXT,
  status TEXT,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_revisions_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS node_sources (
  node_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (node_id, source_id),

  CONSTRAINT fk_node_sources_node
    FOREIGN KEY (node_id)
    REFERENCES nodes(node_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_node_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_node_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assertion_sources (
  assertion_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (assertion_id, source_id),

  CONSTRAINT fk_assertion_sources_assertion
    FOREIGN KEY (assertion_id)
    REFERENCES assertions(assertion_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_assertion_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_assertion_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS edge_sources (
  edge_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (edge_id, source_id),

  CONSTRAINT fk_edge_sources_edge
    FOREIGN KEY (edge_id)
    REFERENCES edges(edge_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_edge_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_edge_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sources_bundle_id
  ON sources(bundle_id);

CREATE INDEX IF NOT EXISTS idx_sources_domain
  ON sources(domain);

CREATE INDEX IF NOT EXISTS idx_nodes_bundle_id
  ON nodes(bundle_id);

CREATE INDEX IF NOT EXISTS idx_nodes_domain
  ON nodes(domain);

CREATE INDEX IF NOT EXISTS idx_nodes_type
  ON nodes(node_type);

CREATE INDEX IF NOT EXISTS idx_assertions_bundle_id
  ON assertions(bundle_id);

CREATE INDEX IF NOT EXISTS idx_assertions_node_id
  ON assertions(node_id);

CREATE INDEX IF NOT EXISTS idx_assertions_type
  ON assertions(assertion_type);

CREATE INDEX IF NOT EXISTS idx_edges_bundle_id
  ON edges(bundle_id);

CREATE INDEX IF NOT EXISTS idx_edges_from_node_id
  ON edges(from_node_id);

CREATE INDEX IF NOT EXISTS idx_edges_to_node_id
  ON edges(to_node_id);

CREATE INDEX IF NOT EXISTS idx_edges_relationship_type
  ON edges(relationship_type);

CREATE INDEX IF NOT EXISTS idx_revisions_bundle_id
  ON revisions(bundle_id);

CREATE INDEX IF NOT EXISTS idx_revisions_object
  ON revisions(object_type, object_id);

CREATE INDEX IF NOT EXISTS idx_node_sources_source_id
  ON node_sources(source_id);

CREATE INDEX IF NOT EXISTS idx_assertion_sources_source_id
  ON assertion_sources(source_id);

CREATE INDEX IF NOT EXISTS idx_edge_sources_source_id
  ON edge_sources(source_id);