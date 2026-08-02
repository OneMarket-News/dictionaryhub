CREATE TABLE cross_root_relationship_datasets (
  dataset_id TEXT PRIMARY KEY REFERENCES imported_bundles(bundle_id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  preparation_algorithm_version TEXT NOT NULL,
  source_dataset_id TEXT NOT NULL,
  source_dataset_version TEXT NOT NULL,
  input_fingerprints JSONB NOT NULL,
  expected_counts JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_cross_root_relationship_dataset_inputs
    CHECK (jsonb_typeof(input_fingerprints) = 'array'),
  CONSTRAINT ck_cross_root_relationship_dataset_counts
    CHECK (jsonb_typeof(expected_counts) = 'object')
);

CREATE TABLE cross_root_relationship_assertions (
  assertion_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES cross_root_relationship_datasets(dataset_id) ON DELETE CASCADE,
  subject_resource_id TEXT NOT NULL,
  subject_root_id TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object_resource_id TEXT NOT NULL,
  object_root_id TEXT NOT NULL,
  directionality TEXT NOT NULL CHECK (directionality IN ('directional', 'symmetric')),
  inverse_display_label TEXT,
  source_native_relationship_type TEXT NOT NULL,
  relationship_family TEXT NOT NULL CHECK (
    relationship_family IN (
      'association', 'authorship', 'causation', 'conflict', 'contribution',
      'governance', 'issuance', 'kinship', 'location', 'membership',
      'participation', 'source_reference', 'temporal_succession'
    )
  ),
  derivation_kind TEXT NOT NULL CHECK (
    derivation_kind IN ('directly_sourced', 'textually_observed', 'human_proposed', 'machine_proposed')
  ),
  review_state TEXT NOT NULL CHECK (
    review_state IN ('unreviewed', 'accepted_after_review', 'disputed', 'rejected')
  ),
  assertion_status TEXT NOT NULL CHECK (assertion_status IN ('active', 'withdrawn')),
  certainty TEXT NOT NULL,
  uncertainty_statement TEXT,
  dispute_state TEXT NOT NULL CHECK (dispute_state IN ('not_disputed', 'disputed')),
  temporal_scope JSONB NOT NULL DEFAULT '{"mode":"not_asserted"}'::JSONB,
  geographic_scope_description TEXT,
  is_causal BOOLEAN NOT NULL,
  causal_role TEXT CHECK (
    causal_role IS NULL OR causal_role IN (
      'direct_cause', 'contributing_factor', 'condition', 'response',
      'interpretation', 'consequence'
    )
  ),
  source_record_id TEXT NOT NULL,
  source_record_type TEXT NOT NULL CHECK (source_record_type IN ('relationship', 'causal_link')),
  source_dataset_id TEXT NOT NULL,
  source_dataset_version TEXT NOT NULL,
  deterministic_identity_hash TEXT NOT NULL CHECK (deterministic_identity_hash ~ '^[A-F0-9]{64}$'),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[A-F0-9]{64}$'),
  provenance_order INTEGER NOT NULL CHECK (provenance_order > 0),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT fk_cross_root_relationship_subject
    FOREIGN KEY (subject_resource_id, subject_root_id)
    REFERENCES cross_root_resources(resource_id, root_id) ON DELETE RESTRICT,
  CONSTRAINT fk_cross_root_relationship_object
    FOREIGN KEY (object_resource_id, object_root_id)
    REFERENCES cross_root_resources(resource_id, root_id) ON DELETE RESTRICT,
  CONSTRAINT ck_cross_root_relationship_distinct_resources
    CHECK (subject_resource_id <> object_resource_id),
  CONSTRAINT ck_cross_root_relationship_temporal_scope
    CHECK (jsonb_typeof(temporal_scope) = 'object'),
  CONSTRAINT ck_cross_root_relationship_metadata
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT ck_cross_root_relationship_causal_separation CHECK (
    (is_causal = TRUE AND relationship_family = 'causation' AND causal_role IS NOT NULL AND source_record_type = 'causal_link')
    OR
    (is_causal = FALSE AND relationship_family <> 'causation' AND causal_role IS NULL AND source_record_type = 'relationship')
  ),
  CONSTRAINT ck_cross_root_relationship_identity_self_guard CHECK (
    predicate NOT IN ('same_as', 'asserted_same_as', 'possible_same_as')
    OR subject_resource_id <> object_resource_id
  ),
  CONSTRAINT uq_cross_root_relationship_source_record UNIQUE (dataset_id, source_record_id),
  CONSTRAINT uq_cross_root_relationship_identity_hash UNIQUE (dataset_id, deterministic_identity_hash),
  CONSTRAINT uq_cross_root_relationship_assertion_dataset UNIQUE (assertion_id, dataset_id)
);

CREATE TABLE cross_root_relationship_evidence (
  evidence_id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  assertion_id TEXT NOT NULL,
  source_root_id TEXT NOT NULL,
  source_resource_id TEXT NOT NULL,
  source_record_type TEXT NOT NULL CHECK (source_record_type IN ('relationship', 'causal_link')),
  source_field TEXT NOT NULL,
  evidence_mode TEXT NOT NULL CHECK (evidence_mode IN ('utf16_offsets', 'field_excerpt_no_offsets')),
  observed_excerpt TEXT NOT NULL CHECK (length(observed_excerpt) > 0),
  start_offset INTEGER,
  end_offset INTEGER,
  source_claim_id TEXT,
  source_evidence_id TEXT,
  publication_id TEXT,
  artifact_id TEXT,
  source_id TEXT NOT NULL,
  citation TEXT,
  source_locator TEXT,
  source_url TEXT,
  source_record_hash TEXT NOT NULL CHECK (source_record_hash ~ '^[A-F0-9]{64}$'),
  source_field_hash TEXT NOT NULL CHECK (source_field_hash ~ '^[A-F0-9]{64}$'),
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[A-F0-9]{64}$'),
  source_dataset_id TEXT NOT NULL,
  source_dataset_version TEXT NOT NULL,
  evidence_order INTEGER NOT NULL CHECK (evidence_order > 0),
  uncertainty_note TEXT,
  dispute_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cross_root_relationship_evidence_assertion
    FOREIGN KEY (assertion_id, dataset_id)
    REFERENCES cross_root_relationship_assertions(assertion_id, dataset_id) ON DELETE CASCADE,
  CONSTRAINT fk_cross_root_relationship_evidence_resource
    FOREIGN KEY (source_resource_id, source_root_id)
    REFERENCES cross_root_resources(resource_id, root_id) ON DELETE RESTRICT,
  CONSTRAINT ck_cross_root_relationship_evidence_offsets CHECK (
    (evidence_mode = 'utf16_offsets' AND start_offset IS NOT NULL AND end_offset IS NOT NULL
      AND start_offset >= 0 AND end_offset > start_offset)
    OR
    (evidence_mode = 'field_excerpt_no_offsets' AND start_offset IS NULL AND end_offset IS NULL)
  ),
  CONSTRAINT uq_cross_root_relationship_evidence_identity UNIQUE (dataset_id, evidence_hash),
  CONSTRAINT uq_cross_root_relationship_evidence_order UNIQUE (assertion_id, evidence_order)
);

CREATE INDEX idx_cross_root_relationship_subject
  ON cross_root_relationship_assertions(subject_resource_id, provenance_order);
CREATE INDEX idx_cross_root_relationship_object
  ON cross_root_relationship_assertions(object_resource_id, provenance_order);
CREATE INDEX idx_cross_root_relationship_family
  ON cross_root_relationship_assertions(relationship_family, predicate, provenance_order);
CREATE INDEX idx_cross_root_relationship_review
  ON cross_root_relationship_assertions(review_state, derivation_kind, provenance_order);
CREATE INDEX idx_cross_root_relationship_evidence_assertion
  ON cross_root_relationship_evidence(assertion_id, evidence_order);

CREATE OR REPLACE FUNCTION require_cross_root_relationship_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cross_root_relationship_evidence evidence
    WHERE evidence.assertion_id = NEW.assertion_id
      AND evidence.dataset_id = NEW.dataset_id
  ) THEN
    RAISE EXCEPTION 'Source-backed relationship assertion requires evidence: %', NEW.assertion_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER cross_root_relationship_assertion_requires_evidence
AFTER INSERT OR UPDATE ON cross_root_relationship_assertions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION require_cross_root_relationship_evidence();
