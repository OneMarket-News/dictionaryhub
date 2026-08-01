CREATE TABLE cross_root_datasets (
  dataset_id TEXT PRIMARY KEY REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  derivation_boundary TEXT NOT NULL,
  review_boundary TEXT NOT NULL,
  input_fingerprints JSONB NOT NULL,
  expected_counts JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_cross_root_dataset_inputs CHECK (jsonb_typeof(input_fingerprints) = 'array'),
  CONSTRAINT ck_cross_root_dataset_counts CHECK (jsonb_typeof(expected_counts) = 'object')
);

CREATE TABLE cross_root_resources (
  resource_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES cross_root_datasets(dataset_id) ON DELETE CASCADE,
  root_id TEXT NOT NULL CHECK (root_id IN ('DictionaryRoot', 'HistoryRoot', 'BibleRoot')),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('lemma', 'accepted-contextual-record', 'edition-verse-text')),
  canonical_public_id TEXT NOT NULL,
  display_label TEXT NOT NULL,
  canonical_local_url TEXT NOT NULL,
  source_dataset_id TEXT NOT NULL,
  source_dataset_version TEXT NOT NULL,
  resource_content_hash TEXT NOT NULL CHECK (resource_content_hash ~ '^[A-F0-9]{64}$'),
  deterministic_identity_hash TEXT NOT NULL CHECK (deterministic_identity_hash ~ '^[A-F0-9]{64}$'),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_cross_root_resource_canonical UNIQUE (dataset_id, root_id, resource_type, canonical_public_id),
  CONSTRAINT uq_cross_root_resource_root UNIQUE (resource_id, root_id),
  CONSTRAINT ck_cross_root_resource_metadata CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT ck_cross_root_resource_type CHECK (
    (root_id = 'DictionaryRoot' AND resource_type = 'lemma') OR
    (root_id = 'HistoryRoot' AND resource_type = 'accepted-contextual-record') OR
    (root_id = 'BibleRoot' AND resource_type = 'edition-verse-text')
  )
);

CREATE TABLE cross_root_links (
  link_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES cross_root_datasets(dataset_id) ON DELETE CASCADE,
  source_resource_id TEXT NOT NULL,
  source_root_id TEXT NOT NULL,
  target_resource_id TEXT NOT NULL,
  target_root_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type = 'exact_lexical_occurrence'),
  directionality TEXT NOT NULL CHECK (directionality IN ('directional', 'symmetric')),
  derivation_kind TEXT NOT NULL CHECK (derivation_kind IN ('directly_sourced', 'textually_observed', 'human_proposed', 'machine_proposed')),
  review_status TEXT NOT NULL CHECK (review_status IN ('unreviewed', 'accepted_after_review', 'disputed', 'rejected')),
  algorithm_version TEXT NOT NULL,
  deterministic_content_hash TEXT NOT NULL CHECK (deterministic_content_hash ~ '^[A-F0-9]{64}$'),
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cross_root_link_source FOREIGN KEY (source_resource_id, source_root_id)
    REFERENCES cross_root_resources(resource_id, root_id) ON DELETE CASCADE,
  CONSTRAINT fk_cross_root_link_target FOREIGN KEY (target_resource_id, target_root_id)
    REFERENCES cross_root_resources(resource_id, root_id) ON DELETE CASCADE,
  CONSTRAINT ck_cross_root_link_different_roots CHECK (source_root_id <> target_root_id),
  CONSTRAINT ck_cross_root_link_no_self CHECK (source_resource_id <> target_resource_id),
  CONSTRAINT uq_cross_root_link_identity UNIQUE (dataset_id, source_resource_id, target_resource_id, relationship_type)
);

CREATE TABLE cross_root_link_evidence (
  evidence_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES cross_root_datasets(dataset_id) ON DELETE CASCADE,
  link_id TEXT NOT NULL REFERENCES cross_root_links(link_id) ON DELETE CASCADE,
  target_field TEXT NOT NULL,
  observed_surface_text TEXT NOT NULL CHECK (length(observed_surface_text) > 0),
  normalized_match_text TEXT NOT NULL CHECK (length(normalized_match_text) > 0),
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
  context_excerpt TEXT NOT NULL,
  target_content_hash TEXT NOT NULL CHECK (target_content_hash ~ '^[A-F0-9]{64}$'),
  target_field_content_hash TEXT NOT NULL CHECK (target_field_content_hash ~ '^[A-F0-9]{64}$'),
  source_dataset_id TEXT NOT NULL,
  source_dataset_version TEXT NOT NULL,
  evidence_order INTEGER NOT NULL CHECK (evidence_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_cross_root_evidence_offset UNIQUE (link_id, target_field, start_offset, end_offset)
);

CREATE INDEX idx_cross_root_resources_lookup
  ON cross_root_resources(root_id, resource_type, canonical_public_id);
CREATE INDEX idx_cross_root_links_source
  ON cross_root_links(source_resource_id, display_order);
CREATE INDEX idx_cross_root_links_target
  ON cross_root_links(target_resource_id, display_order);
CREATE INDEX idx_cross_root_evidence_link
  ON cross_root_link_evidence(link_id, evidence_order);
