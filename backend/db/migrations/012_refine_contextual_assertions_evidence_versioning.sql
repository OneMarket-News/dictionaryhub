ALTER TABLE context_evidence
  ADD COLUMN IF NOT EXISTS uncertainty TEXT;

CREATE TABLE IF NOT EXISTS context_claim_attributions (
  attribution_id TEXT PRIMARY KEY,
  claim_context_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  actor_entity_context_id TEXT,
  account_context_id TEXT,
  temporal_context_id TEXT,
  attribution_role TEXT NOT NULL,
  note TEXT,
  confidence TEXT,
  uncertainty TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_claim_attributions_claim
    FOREIGN KEY (claim_context_id)
    REFERENCES context_claims(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_claim_attributions_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_claim_attributions_actor
    FOREIGN KEY (actor_entity_context_id)
    REFERENCES context_entities(context_id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_claim_attributions_account
    FOREIGN KEY (account_context_id)
    REFERENCES context_accounts(context_id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_context_claim_attributions_temporal
    FOREIGN KEY (temporal_context_id)
    REFERENCES context_temporal_assertions(context_id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT context_claim_attributions_role
    CHECK (
      attribution_role IN (
        'asserted_by',
        'attributed_to',
        'reported_by',
        'recorded_by',
        'issued_by'
      )
      OR attribution_role ~ '^custom:[a-z0-9][a-z0-9_-]{0,63}$'
    )
);

CREATE TABLE IF NOT EXISTS context_claim_attribution_sources (
  attribution_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (attribution_id, source_id),

  CONSTRAINT fk_context_claim_attribution_sources_attribution
    FOREIGN KEY (attribution_id)
    REFERENCES context_claim_attributions(attribution_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_claim_attribution_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_claim_attribution_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS context_claim_relations (
  relation_id TEXT PRIMARY KEY,
  from_claim_context_id TEXT NOT NULL,
  to_claim_context_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  explanation TEXT,
  confidence TEXT,
  uncertainty TEXT,
  review_status TEXT,
  temporal_context_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_claim_relations_from
    FOREIGN KEY (from_claim_context_id)
    REFERENCES context_claims(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_claim_relations_to
    FOREIGN KEY (to_claim_context_id)
    REFERENCES context_claims(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_claim_relations_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_claim_relations_temporal
    FOREIGN KEY (temporal_context_id)
    REFERENCES context_temporal_assertions(context_id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT context_claim_relations_distinct
    CHECK (from_claim_context_id <> to_claim_context_id),

  CONSTRAINT context_claim_relations_type
    CHECK (
      relation_type IN (
        'contradicts',
        'qualifies',
        'refines',
        'restates',
        'supersedes',
        'corrects',
        'retracts',
        'derived_from'
      )
      OR relation_type ~ '^custom:[a-z0-9][a-z0-9_-]{0,63}$'
    )
);

CREATE TABLE IF NOT EXISTS context_claim_relation_sources (
  relation_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (relation_id, source_id),

  CONSTRAINT fk_context_claim_relation_sources_relation
    FOREIGN KEY (relation_id)
    REFERENCES context_claim_relations(relation_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_claim_relation_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_claim_relation_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_context_claim_relations_symmetric
  ON context_claim_relations (
    LEAST(from_claim_context_id, to_claim_context_id),
    GREATEST(from_claim_context_id, to_claim_context_id),
    relation_type
  )
  WHERE relation_type = 'contradicts';

CREATE TABLE IF NOT EXISTS context_claim_versions (
  version_id TEXT PRIMARY KEY,
  claim_context_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  version_ordinal INTEGER,
  prior_version_id TEXT,
  statement TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  subject_context_id TEXT NOT NULL,
  object_context_id TEXT,
  confidence TEXT,
  uncertainty TEXT,
  version_status TEXT NOT NULL DEFAULT 'active',
  change_type TEXT NOT NULL,
  change_reason TEXT,
  attribution_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB,
  attribution_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  asserted_temporal_context_id TEXT,
  content_hash TEXT NOT NULL,
  origin TEXT NOT NULL,
  governance_proposal_id UUID,
  governance_publication_id UUID,
  governance_revision_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_context_claim_versions_owner
    UNIQUE (claim_context_id, version_id),

  CONSTRAINT fk_context_claim_versions_prior
    FOREIGN KEY (claim_context_id, prior_version_id)
    REFERENCES context_claim_versions(claim_context_id, version_id)
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT context_claim_versions_ordinal
    CHECK (version_ordinal IS NULL OR version_ordinal > 0),

  CONSTRAINT context_claim_versions_attribution_snapshot
    CHECK (JSONB_TYPEOF(attribution_snapshot) = 'array'),

  CONSTRAINT context_claim_versions_hash
    CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),

  CONSTRAINT context_claim_versions_status
    CHECK (
      version_status IN (
        'active',
        'accepted',
        'corrected',
        'retracted',
        'superseded',
        'archived',
        'draft',
        'unknown'
      )
    ),

  CONSTRAINT context_claim_versions_origin
    CHECK (
      origin IN (
        'import',
        'governed_publication',
        'correction',
        'retraction',
        'rollback',
        'migration'
      )
      OR origin ~ '^custom:[a-z0-9][a-z0-9_-]{0,63}$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_context_claim_versions_ordinal
  ON context_claim_versions(claim_context_id, version_ordinal)
  WHERE version_ordinal IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_context_claim_versions_claim
  ON context_claim_versions(claim_context_id, created_at, version_id);

CREATE INDEX IF NOT EXISTS idx_context_claim_versions_status
  ON context_claim_versions(version_status, claim_context_id, version_id);

CREATE INDEX IF NOT EXISTS idx_context_claim_versions_source_ids
  ON context_claim_versions USING GIN(source_ids);

CREATE TABLE IF NOT EXISTS context_claim_current_versions (
  claim_context_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_claim_current_versions_version
    FOREIGN KEY (claim_context_id, version_id)
    REFERENCES context_claim_versions(claim_context_id, version_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS context_source_locators (
  locator_id TEXT PRIMARY KEY,
  evidence_context_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  locator_type TEXT NOT NULL,
  locator_label TEXT NOT NULL,
  locator_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  excerpt TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_source_locators_evidence
    FOREIGN KEY (evidence_context_id)
    REFERENCES context_evidence(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_source_locators_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_source_locators_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT context_source_locators_type
    CHECK (
      locator_type IN (
        'page',
        'volume',
        'chapter',
        'section',
        'paragraph',
        'passage',
        'archive',
        'document_identifier',
        'url_fragment',
        'timestamp',
        'time_range',
        'database_record',
        'citation'
      )
      OR locator_type ~ '^custom:[a-z0-9][a-z0-9_-]{0,63}$'
    ),

  CONSTRAINT context_source_locators_data
    CHECK (JSONB_TYPEOF(locator_data) = 'object'),

  CONSTRAINT context_source_locators_label
    CHECK (
      BTRIM(locator_label) <> ''
      AND LENGTH(locator_label) <= 1024
    ),

  CONSTRAINT context_source_locators_excerpt
    CHECK (excerpt IS NULL OR LENGTH(excerpt) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_context_source_locators_evidence
  ON context_source_locators(evidence_context_id, locator_type, locator_id);

CREATE INDEX IF NOT EXISTS idx_context_source_locators_source
  ON context_source_locators(source_id, locator_id);

CREATE TABLE IF NOT EXISTS context_evidence_versions (
  version_id TEXT PRIMARY KEY,
  evidence_context_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  version_ordinal INTEGER,
  prior_version_id TEXT,
  evidence_type TEXT NOT NULL,
  explanation TEXT NOT NULL,
  strength TEXT,
  confidence TEXT,
  uncertainty TEXT,
  source_id TEXT,
  account_context_id TEXT,
  evidence_record_context_id TEXT,
  evidentiary_basis JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_locator JSONB,
  source_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  support_role TEXT,
  version_status TEXT NOT NULL DEFAULT 'active',
  change_type TEXT NOT NULL,
  change_reason TEXT,
  content_hash TEXT NOT NULL,
  origin TEXT NOT NULL,
  governance_proposal_id UUID,
  governance_publication_id UUID,
  governance_revision_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_context_evidence_versions_owner
    UNIQUE (evidence_context_id, version_id),

  CONSTRAINT fk_context_evidence_versions_prior
    FOREIGN KEY (evidence_context_id, prior_version_id)
    REFERENCES context_evidence_versions(evidence_context_id, version_id)
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT context_evidence_versions_ordinal
    CHECK (version_ordinal IS NULL OR version_ordinal > 0),

  CONSTRAINT context_evidence_versions_type
    CHECK (evidence_type IN ('evidence', 'counterevidence')),

  CONSTRAINT context_evidence_versions_basis
    CHECK (JSONB_TYPEOF(evidentiary_basis) = 'object'),

  CONSTRAINT context_evidence_versions_locator
    CHECK (
      source_locator IS NULL
      OR JSONB_TYPEOF(source_locator) = 'object'
    ),

  CONSTRAINT context_evidence_versions_hash
    CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),

  CONSTRAINT context_evidence_versions_status
    CHECK (
      version_status IN (
        'active',
        'accepted',
        'corrected',
        'retracted',
        'superseded',
        'archived',
        'draft',
        'unknown'
      )
    ),

  CONSTRAINT context_evidence_versions_support_role
    CHECK (
      support_role IS NULL
      OR support_role IN (
        'supports',
        'disputes',
        'qualifies',
        'contextualizes',
        'corroborates',
        'contradicts',
        'neutral_or_background'
      )
      OR support_role ~ '^custom:[a-z0-9][a-z0-9_-]{0,63}$'
    ),

  CONSTRAINT context_evidence_versions_origin
    CHECK (
      origin IN (
        'import',
        'governed_publication',
        'correction',
        'retraction',
        'rollback',
        'migration'
      )
      OR origin ~ '^custom:[a-z0-9][a-z0-9_-]{0,63}$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_context_evidence_versions_ordinal
  ON context_evidence_versions(evidence_context_id, version_ordinal)
  WHERE version_ordinal IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_context_evidence_versions_evidence
  ON context_evidence_versions(evidence_context_id, created_at, version_id);

CREATE INDEX IF NOT EXISTS idx_context_evidence_versions_status
  ON context_evidence_versions(version_status, evidence_context_id, version_id);

CREATE INDEX IF NOT EXISTS idx_context_evidence_versions_source_ids
  ON context_evidence_versions USING GIN(source_ids);

CREATE TABLE IF NOT EXISTS context_evidence_current_versions (
  evidence_context_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_evidence_current_versions_version
    FOREIGN KEY (evidence_context_id, version_id)
    REFERENCES context_evidence_versions(evidence_context_id, version_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS context_evidence_claim_links (
  link_id TEXT PRIMARY KEY,
  evidence_context_id TEXT NOT NULL,
  claim_context_id TEXT NOT NULL,
  claim_version_id TEXT,
  bundle_id TEXT NOT NULL,
  support_role TEXT NOT NULL,
  scope_path TEXT,
  explanation TEXT,
  relevance TEXT,
  confidence TEXT,
  uncertainty TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_context_evidence_claim_links_evidence
    FOREIGN KEY (evidence_context_id)
    REFERENCES context_evidence(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_evidence_claim_links_claim
    FOREIGN KEY (claim_context_id)
    REFERENCES context_claims(context_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_evidence_claim_links_version
    FOREIGN KEY (claim_context_id, claim_version_id)
    REFERENCES context_claim_versions(claim_context_id, version_id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_context_evidence_claim_links_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE,

  CONSTRAINT context_evidence_claim_links_role
    CHECK (
      support_role IN (
        'supports',
        'disputes',
        'qualifies',
        'contextualizes',
        'corroborates',
        'contradicts',
        'neutral_or_background'
      )
      OR support_role ~ '^custom:[a-z0-9][a-z0-9_-]{0,63}$'
    ),

  CONSTRAINT context_evidence_claim_links_scope
    CHECK (
      scope_path IS NULL
      OR (
        LENGTH(scope_path) BETWEEN 1 AND 256
        AND scope_path ~ '^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9][A-Za-z0-9_-]*){0,4}$'
      )
    )
);

CREATE TABLE IF NOT EXISTS context_evidence_claim_link_sources (
  link_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (link_id, source_id),

  CONSTRAINT fk_context_evidence_claim_link_sources_link
    FOREIGN KEY (link_id)
    REFERENCES context_evidence_claim_links(link_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_evidence_claim_link_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_context_evidence_claim_link_sources_bundle
    FOREIGN KEY (bundle_id)
    REFERENCES imported_bundles(bundle_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_evidence_claim_links_evidence
  ON context_evidence_claim_links(evidence_context_id, support_role, link_id);

CREATE INDEX IF NOT EXISTS idx_context_evidence_claim_links_claim
  ON context_evidence_claim_links(claim_context_id, support_role, link_id);

CREATE INDEX IF NOT EXISTS idx_context_evidence_claim_links_version
  ON context_evidence_claim_links(claim_version_id, link_id)
  WHERE claim_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_context_claim_attributions_claim
  ON context_claim_attributions(claim_context_id, attribution_role, attribution_id);

CREATE INDEX IF NOT EXISTS idx_context_claim_attributions_actor
  ON context_claim_attributions(actor_entity_context_id, attribution_id)
  WHERE actor_entity_context_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_context_claim_relations_from
  ON context_claim_relations(from_claim_context_id, relation_type, relation_id);

CREATE INDEX IF NOT EXISTS idx_context_claim_relations_to
  ON context_claim_relations(to_claim_context_id, relation_type, relation_id);

CREATE OR REPLACE FUNCTION prevent_context_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF CURRENT_SETTING(
    'sourceroot.allow_context_version_test_cleanup',
    TRUE
  ) = 'integration-test' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Contextual version rows are immutable'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS context_claim_versions_immutable
  ON context_claim_versions;

CREATE TRIGGER context_claim_versions_immutable
BEFORE UPDATE OR DELETE ON context_claim_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_context_version_mutation();

DROP TRIGGER IF EXISTS context_evidence_versions_immutable
  ON context_evidence_versions;

CREATE TRIGGER context_evidence_versions_immutable
BEFORE UPDATE OR DELETE ON context_evidence_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_context_version_mutation();
