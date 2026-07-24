CREATE TABLE IF NOT EXISTS context_records (
  context_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  record_kind TEXT NOT NULL CHECK (
    record_kind IN (
      'entity',
      'temporal_assertion',
      'account',
      'claim',
      'evidence',
      'interpretation',
      'perspective',
      'causal_link',
      'relationship',
      'cultural_memory'
    )
  ),
  domain TEXT NOT NULL,
  label TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_records_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT context_records_metadata_object
    CHECK (JSONB_TYPEOF(metadata) = 'object'),

  CONSTRAINT context_records_raw_data_object
    CHECK (JSONB_TYPEOF(raw_data) = 'object')
);

CREATE TABLE IF NOT EXISTS context_entities (
  context_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (
    entity_type IN (
      'person',
      'group',
      'organization',
      'cultural_community',
      'place',
      'event',
      'document',
      'work',
      'political_jurisdiction'
    )
  ),
  canonical_name TEXT NOT NULL,
  alternate_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  description TEXT,

  CONSTRAINT fk_context_entities_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS context_temporal_assertions (
  context_id TEXT PRIMARY KEY,
  subject_context_id TEXT NOT NULL,
  temporal_kind TEXT NOT NULL CHECK (
    temporal_kind IN (
      'exact',
      'approximate',
      'range',
      'before',
      'after',
      'disputed',
      'unknown',
      'multiple_proposed'
    )
  ),
  exact_date DATE,
  start_date DATE,
  end_date DATE,
  before_date DATE,
  after_date DATE,
  proposed_dates JSONB NOT NULL DEFAULT '[]'::JSONB,
  date_label TEXT NOT NULL,
  calendar_system TEXT NOT NULL DEFAULT 'unspecified',
  date_precision TEXT NOT NULL DEFAULT 'unknown',
  start_uncertainty TEXT,
  end_uncertainty TEXT,
  date_notes TEXT,

  CONSTRAINT fk_context_temporal_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_temporal_subject
    FOREIGN KEY (subject_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT context_temporal_proposed_dates_array
    CHECK (JSONB_TYPEOF(proposed_dates) = 'array'),

  CONSTRAINT context_temporal_range_order
    CHECK (
      start_date IS NULL
      OR end_date IS NULL
      OR start_date <= end_date
    ),

  CONSTRAINT context_temporal_shape
    CHECK (
      (temporal_kind = 'exact' AND exact_date IS NOT NULL)
      OR (
        temporal_kind = 'approximate'
        AND (
          exact_date IS NOT NULL
          OR start_date IS NOT NULL
          OR end_date IS NOT NULL
          OR date_label <> ''
        )
      )
      OR (
        temporal_kind = 'range'
        AND start_date IS NOT NULL
        AND end_date IS NOT NULL
      )
      OR (temporal_kind = 'before' AND before_date IS NOT NULL)
      OR (temporal_kind = 'after' AND after_date IS NOT NULL)
      OR (
        temporal_kind IN ('disputed', 'multiple_proposed')
        AND JSONB_ARRAY_LENGTH(proposed_dates) >= 2
      )
      OR temporal_kind = 'unknown'
    )
);

CREATE TABLE IF NOT EXISTS context_accounts (
  context_id TEXT PRIMARY KEY,
  subject_context_id TEXT NOT NULL,
  author_context_id TEXT,
  source_id TEXT,
  account_type TEXT NOT NULL,
  content TEXT NOT NULL,
  publication_label TEXT,

  CONSTRAINT fk_context_accounts_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_accounts_subject
    FOREIGN KEY (subject_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_accounts_author
    FOREIGN KEY (author_context_id)
    REFERENCES context_entities(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_accounts_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS context_claims (
  context_id TEXT PRIMARY KEY,
  account_context_id TEXT NOT NULL,
  subject_context_id TEXT NOT NULL,
  object_context_id TEXT,
  claim_type TEXT NOT NULL,
  statement TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'unknown',
  uncertainty TEXT,

  CONSTRAINT fk_context_claims_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_claims_account
    FOREIGN KEY (account_context_id)
    REFERENCES context_accounts(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_claims_subject
    FOREIGN KEY (subject_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_claims_object
    FOREIGN KEY (object_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS context_evidence (
  context_id TEXT PRIMARY KEY,
  claim_context_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (
    evidence_type IN ('evidence', 'counterevidence')
  ),
  source_id TEXT,
  account_context_id TEXT,
  evidence_context_id TEXT,
  explanation TEXT NOT NULL,
  strength TEXT NOT NULL DEFAULT 'unknown',
  confidence TEXT NOT NULL DEFAULT 'unknown',

  CONSTRAINT fk_context_evidence_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_evidence_claim
    FOREIGN KEY (claim_context_id)
    REFERENCES context_claims(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_evidence_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_evidence_account
    FOREIGN KEY (account_context_id)
    REFERENCES context_accounts(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_evidence_context
    FOREIGN KEY (evidence_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT context_evidence_basis
    CHECK (
      source_id IS NOT NULL
      OR account_context_id IS NOT NULL
      OR evidence_context_id IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS context_interpretations (
  context_id TEXT PRIMARY KEY,
  subject_context_id TEXT NOT NULL,
  account_context_id TEXT,
  source_id TEXT,
  interpretation_text TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'unknown',
  uncertainty TEXT,
  published_conclusion BOOLEAN NOT NULL DEFAULT FALSE,

  CONSTRAINT fk_context_interpretations_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_interpretations_subject
    FOREIGN KEY (subject_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_interpretations_account
    FOREIGN KEY (account_context_id)
    REFERENCES context_accounts(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_interpretations_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS context_perspectives (
  context_id TEXT PRIMARY KEY,
  perspective_name TEXT NOT NULL,
  description TEXT NOT NULL,

  CONSTRAINT fk_context_perspectives_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS context_record_perspectives (
  record_context_id TEXT NOT NULL,
  perspective_context_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  stance TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (record_context_id, perspective_context_id),

  CONSTRAINT fk_context_record_perspectives_record
    FOREIGN KEY (record_context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_record_perspectives_perspective
    FOREIGN KEY (perspective_context_id)
    REFERENCES context_perspectives(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_record_perspectives_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS context_causal_links (
  context_id TEXT PRIMARY KEY,
  cause_context_id TEXT NOT NULL,
  effect_context_id TEXT NOT NULL,
  causal_kind TEXT NOT NULL CHECK (
    causal_kind IN ('cause', 'consequence')
  ),
  explanation TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'unknown',
  uncertainty TEXT,

  CONSTRAINT fk_context_causal_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_causal_cause
    FOREIGN KEY (cause_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_causal_effect
    FOREIGN KEY (effect_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT context_causal_distinct_ends
    CHECK (cause_context_id <> effect_context_id)
);

CREATE TABLE IF NOT EXISTS context_relationships (
  context_id TEXT PRIMARY KEY,
  from_context_id TEXT NOT NULL,
  to_context_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  relationship_role TEXT,
  explanation TEXT,
  confidence TEXT NOT NULL DEFAULT 'unknown',
  uncertainty TEXT,

  CONSTRAINT fk_context_relationships_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_relationships_from
    FOREIGN KEY (from_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_relationships_to
    FOREIGN KEY (to_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT context_relationships_distinct_ends
    CHECK (from_context_id <> to_context_id)
);

CREATE TABLE IF NOT EXISTS context_cultural_memories (
  context_id TEXT PRIMARY KEY,
  subject_context_id TEXT NOT NULL,
  perspective_context_id TEXT,
  source_id TEXT,
  memory_type TEXT NOT NULL,
  narrative TEXT NOT NULL,
  period_label TEXT,

  CONSTRAINT fk_context_cultural_memories_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_cultural_memories_subject
    FOREIGN KEY (subject_context_id)
    REFERENCES context_records(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_cultural_memories_perspective
    FOREIGN KEY (perspective_context_id)
    REFERENCES context_perspectives(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_cultural_memories_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS context_record_sources (
  context_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (context_id, source_id),

  CONSTRAINT fk_context_record_sources_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_record_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_record_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_records_bundle
  ON context_records(bundle_id);

CREATE INDEX IF NOT EXISTS idx_context_records_kind
  ON context_records(record_kind);

CREATE INDEX IF NOT EXISTS idx_context_records_domain_status
  ON context_records(domain, status);

CREATE INDEX IF NOT EXISTS idx_context_records_label
  ON context_records(LOWER(label));

CREATE INDEX IF NOT EXISTS idx_context_entities_type
  ON context_entities(entity_type);

CREATE INDEX IF NOT EXISTS idx_context_temporal_subject
  ON context_temporal_assertions(subject_context_id);

CREATE INDEX IF NOT EXISTS idx_context_temporal_kind
  ON context_temporal_assertions(temporal_kind);

CREATE INDEX IF NOT EXISTS idx_context_temporal_exact
  ON context_temporal_assertions(exact_date);

CREATE INDEX IF NOT EXISTS idx_context_temporal_range
  ON context_temporal_assertions(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_context_accounts_subject
  ON context_accounts(subject_context_id);

CREATE INDEX IF NOT EXISTS idx_context_accounts_source
  ON context_accounts(source_id);

CREATE INDEX IF NOT EXISTS idx_context_claims_account
  ON context_claims(account_context_id);

CREATE INDEX IF NOT EXISTS idx_context_claims_subject
  ON context_claims(subject_context_id);

CREATE INDEX IF NOT EXISTS idx_context_evidence_claim_type
  ON context_evidence(claim_context_id, evidence_type);

CREATE INDEX IF NOT EXISTS idx_context_interpretations_subject
  ON context_interpretations(subject_context_id);

CREATE INDEX IF NOT EXISTS idx_context_perspective_links_perspective
  ON context_record_perspectives(perspective_context_id);

CREATE INDEX IF NOT EXISTS idx_context_causal_cause
  ON context_causal_links(cause_context_id);

CREATE INDEX IF NOT EXISTS idx_context_causal_effect
  ON context_causal_links(effect_context_id);

CREATE INDEX IF NOT EXISTS idx_context_relationships_type
  ON context_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS idx_context_relationships_from
  ON context_relationships(from_context_id);

CREATE INDEX IF NOT EXISTS idx_context_relationships_to
  ON context_relationships(to_context_id);

CREATE INDEX IF NOT EXISTS idx_context_cultural_memory_subject
  ON context_cultural_memories(subject_context_id);

CREATE INDEX IF NOT EXISTS idx_context_record_sources_source
  ON context_record_sources(source_id);
