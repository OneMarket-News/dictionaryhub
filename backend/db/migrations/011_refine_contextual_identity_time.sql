ALTER TABLE context_temporal_assertions
  ADD COLUMN IF NOT EXISTS time_role TEXT NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS structured_date JSONB,
  ADD COLUMN IF NOT EXISTS chronology_start_year INTEGER,
  ADD COLUMN IF NOT EXISTS chronology_end_year INTEGER;

ALTER TABLE context_temporal_assertions
  DROP CONSTRAINT IF EXISTS context_temporal_time_role_check;

ALTER TABLE context_temporal_assertions
  ADD CONSTRAINT context_temporal_time_role_check
  CHECK (
    time_role IN (
      'event_time',
      'validity_time',
      'publication_time',
      'observation_time',
      'recording_time',
      'relationship_validity',
      'identity_name_validity',
      'source_creation_time',
      'unspecified'
    )
  );

ALTER TABLE context_temporal_assertions
  DROP CONSTRAINT IF EXISTS context_temporal_structured_date_object;

ALTER TABLE context_temporal_assertions
  ADD CONSTRAINT context_temporal_structured_date_object
  CHECK (
    structured_date IS NULL
    OR JSONB_TYPEOF(structured_date) = 'object'
  );

ALTER TABLE context_temporal_assertions
  DROP CONSTRAINT IF EXISTS context_temporal_chronology_order;

ALTER TABLE context_temporal_assertions
  ADD CONSTRAINT context_temporal_chronology_order
  CHECK (
    chronology_start_year IS NULL
    OR chronology_end_year IS NULL
    OR chronology_start_year <= chronology_end_year
  );

ALTER TABLE context_relationships
  ADD COLUMN IF NOT EXISTS review_status TEXT;

CREATE TABLE IF NOT EXISTS context_entity_aliases (
  alias_id TEXT PRIMARY KEY,
  entity_context_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  alias_text TEXT NOT NULL,
  alias_type TEXT NOT NULL,
  language_tag TEXT,
  script_identifier TEXT,
  notes TEXT,
  uncertainty TEXT,
  status TEXT,
  temporal_context_id TEXT,
  legacy_derived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_entity_aliases_entity
    FOREIGN KEY (entity_context_id)
    REFERENCES context_entities(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_entity_aliases_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_entity_aliases_temporal
    FOREIGN KEY (temporal_context_id)
    REFERENCES context_temporal_assertions(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT context_entity_aliases_text_nonempty
    CHECK (BTRIM(alias_text) <> ''),

  CONSTRAINT context_entity_aliases_type_check
    CHECK (
      alias_type IN (
        'alternate',
        'historical',
        'abbreviation',
        'acronym',
        'title',
        'transliteration',
        'translation',
        'endonym',
        'exonym',
        'former_name',
        'disputed'
      )
      OR alias_type ~ '^custom:[a-z0-9][a-z0-9_-]{0,63}$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_context_entity_aliases_exact
  ON context_entity_aliases (
    entity_context_id,
    alias_text,
    alias_type,
    COALESCE(language_tag, ''),
    COALESCE(script_identifier, '')
  );

CREATE INDEX IF NOT EXISTS idx_context_entity_aliases_entity
  ON context_entity_aliases(entity_context_id, alias_text, alias_id);

CREATE INDEX IF NOT EXISTS idx_context_entity_aliases_search
  ON context_entity_aliases(LOWER(alias_text), entity_context_id);

CREATE INDEX IF NOT EXISTS idx_context_entity_aliases_temporal
  ON context_entity_aliases(temporal_context_id)
  WHERE temporal_context_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS context_entity_alias_sources (
  alias_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (alias_id, source_id),

  CONSTRAINT fk_context_entity_alias_sources_alias
    FOREIGN KEY (alias_id)
    REFERENCES context_entity_aliases(alias_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_entity_alias_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_entity_alias_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_entity_alias_sources_source
  ON context_entity_alias_sources(source_id, alias_id);

CREATE TABLE IF NOT EXISTS context_entity_identifiers (
  identifier_id TEXT PRIMARY KEY,
  entity_context_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  identifier_scheme TEXT NOT NULL,
  identifier_value TEXT NOT NULL,
  normalized_value TEXT,
  identifier_uri TEXT,
  label TEXT,
  status TEXT,
  notes TEXT,
  uncertainty TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_entity_identifiers_entity
    FOREIGN KEY (entity_context_id)
    REFERENCES context_entities(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_entity_identifiers_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT context_entity_identifiers_scheme_nonempty
    CHECK (BTRIM(identifier_scheme) <> ''),

  CONSTRAINT context_entity_identifiers_value_nonempty
    CHECK (BTRIM(identifier_value) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_context_entity_identifiers_exact
  ON context_entity_identifiers (
    entity_context_id,
    LOWER(identifier_scheme),
    identifier_value
  );

CREATE INDEX IF NOT EXISTS idx_context_entity_identifiers_entity
  ON context_entity_identifiers(
    entity_context_id,
    identifier_scheme,
    identifier_id
  );

CREATE INDEX IF NOT EXISTS idx_context_entity_identifiers_lookup
  ON context_entity_identifiers(
    LOWER(identifier_scheme),
    identifier_value,
    entity_context_id
  );

CREATE TABLE IF NOT EXISTS context_entity_identifier_sources (
  identifier_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (identifier_id, source_id),

  CONSTRAINT fk_context_entity_identifier_sources_identifier
    FOREIGN KEY (identifier_id)
    REFERENCES context_entity_identifiers(identifier_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_entity_identifier_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_entity_identifier_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_entity_identifier_sources_source
  ON context_entity_identifier_sources(source_id, identifier_id);

CREATE TABLE IF NOT EXISTS context_temporal_proposals (
  proposal_id TEXT PRIMARY KEY,
  temporal_context_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  proposed_date DATE,
  date_label TEXT,
  structured_date JSONB,
  precision TEXT,
  uncertainty TEXT,
  note TEXT,
  chronology_start_year INTEGER,
  chronology_end_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_temporal_proposals_temporal
    FOREIGN KEY (temporal_context_id)
    REFERENCES context_temporal_assertions(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_temporal_proposals_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT context_temporal_proposals_value
    CHECK (
      proposed_date IS NOT NULL
      OR NULLIF(BTRIM(date_label), '') IS NOT NULL
      OR structured_date IS NOT NULL
    ),

  CONSTRAINT context_temporal_proposals_structured_object
    CHECK (
      structured_date IS NULL
      OR JSONB_TYPEOF(structured_date) = 'object'
    ),

  CONSTRAINT context_temporal_proposals_chronology_order
    CHECK (
      chronology_start_year IS NULL
      OR chronology_end_year IS NULL
      OR chronology_start_year <= chronology_end_year
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_context_temporal_proposals_owner
  ON context_temporal_proposals(temporal_context_id, proposal_id);

CREATE INDEX IF NOT EXISTS idx_context_temporal_proposals_temporal
  ON context_temporal_proposals(temporal_context_id, proposal_id);

CREATE TABLE IF NOT EXISTS context_temporal_proposal_sources (
  proposal_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (proposal_id, source_id),

  CONSTRAINT fk_context_temporal_proposal_sources_proposal
    FOREIGN KEY (proposal_id)
    REFERENCES context_temporal_proposals(proposal_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_temporal_proposal_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_temporal_proposal_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_temporal_proposal_sources_source
  ON context_temporal_proposal_sources(source_id, proposal_id);

CREATE TABLE IF NOT EXISTS context_relationship_temporal_links (
  relationship_context_id TEXT NOT NULL,
  temporal_context_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (
    relationship_context_id,
    temporal_context_id,
    link_type
  ),

  CONSTRAINT fk_context_relationship_temporal_links_relationship
    FOREIGN KEY (relationship_context_id)
    REFERENCES context_relationships(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_relationship_temporal_links_temporal
    FOREIGN KEY (temporal_context_id)
    REFERENCES context_temporal_assertions(context_id)
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT context_relationship_temporal_links_type
    CHECK (
      link_type IN (
        'valid_from',
        'valid_until',
        'valid_during',
        'proposed_period'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_context_relationship_temporal_links_temporal
  ON context_relationship_temporal_links(
    temporal_context_id,
    relationship_context_id
  );

CREATE TABLE IF NOT EXISTS context_relationship_temporal_sources (
  relationship_context_id TEXT NOT NULL,
  temporal_context_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (
    relationship_context_id,
    temporal_context_id,
    link_type,
    source_id
  ),

  CONSTRAINT fk_context_relationship_temporal_sources_link
    FOREIGN KEY (
      relationship_context_id,
      temporal_context_id,
      link_type
    )
    REFERENCES context_relationship_temporal_links(
      relationship_context_id,
      temporal_context_id,
      link_type
    )
    ON DELETE CASCADE,

  CONSTRAINT fk_context_relationship_temporal_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_relationship_temporal_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_relationship_temporal_sources_source
  ON context_relationship_temporal_sources(
    source_id,
    relationship_context_id
  );

CREATE TABLE IF NOT EXISTS context_relationship_validity_sources (
  relationship_context_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (relationship_context_id, source_id),

  CONSTRAINT fk_context_relationship_validity_sources_relationship
    FOREIGN KEY (relationship_context_id)
    REFERENCES context_relationships(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_relationship_validity_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_relationship_validity_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_relationship_validity_sources_source
  ON context_relationship_validity_sources(
    source_id,
    relationship_context_id
  );

CREATE TABLE IF NOT EXISTS context_field_provenance (
  provenance_id TEXT PRIMARY KEY,
  context_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  field_path TEXT NOT NULL,
  subrecord_type TEXT,
  subrecord_id TEXT,
  source_id TEXT NOT NULL,
  support_type TEXT,
  note TEXT,
  confidence TEXT,
  uncertainty TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_field_provenance_record
    FOREIGN KEY (context_id)
    REFERENCES context_records(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_field_provenance_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_field_provenance_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT context_field_provenance_path
    CHECK (
      LENGTH(field_path) BETWEEN 1 AND 256
      AND field_path ~ '^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9][A-Za-z0-9_-]*){0,4}$'
    ),

  CONSTRAINT context_field_provenance_subrecord_pair
    CHECK (
      (subrecord_type IS NULL AND subrecord_id IS NULL)
      OR (subrecord_type IS NOT NULL AND subrecord_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_context_field_provenance_support
  ON context_field_provenance(
    context_id,
    field_path,
    COALESCE(subrecord_type, ''),
    COALESCE(subrecord_id, ''),
    source_id,
    COALESCE(support_type, '')
  );

CREATE INDEX IF NOT EXISTS idx_context_field_provenance_record
  ON context_field_provenance(context_id, field_path, provenance_id);

CREATE INDEX IF NOT EXISTS idx_context_field_provenance_source
  ON context_field_provenance(source_id, context_id);

CREATE INDEX IF NOT EXISTS idx_context_temporal_time_role
  ON context_temporal_assertions(time_role, context_id);

CREATE INDEX IF NOT EXISTS idx_context_temporal_chronology
  ON context_temporal_assertions(
    chronology_start_year,
    chronology_end_year,
    context_id
  );

CREATE INDEX IF NOT EXISTS idx_context_relationships_identity_review
  ON context_relationships(
    relationship_type,
    from_context_id,
    to_context_id,
    context_id
  )
  WHERE relationship_type IN (
    'possible_same_as',
    'asserted_same_as',
    'distinct_from',
    'derived_from',
    'successor_of',
    'predecessor_of'
  );
