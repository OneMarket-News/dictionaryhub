ALTER TABLE dr_change_proposals
  DROP CONSTRAINT IF EXISTS dr_change_proposals_target_type_check;

ALTER TABLE dr_change_proposals
  ADD CONSTRAINT dr_change_proposals_target_type_check
  CHECK (
    target_type IN (
      'concept',
      'meaning',
      'relationship',
      'source',
      'assertion',
      'entity',
      'temporal_assertion',
      'account',
      'claim',
      'evidence',
      'interpretation',
      'perspective',
      'causal_link',
      'cultural_memory'
    )
  );

ALTER TABLE dr_change_proposals
  ADD COLUMN IF NOT EXISTS root_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bundle_id TEXT,
  ADD COLUMN IF NOT EXISTS change_type TEXT NOT NULL DEFAULT 'structured_update',
  ADD COLUMN IF NOT EXISTS base_version_token TEXT,
  ADD COLUMN IF NOT EXISTS validation_result JSONB NOT NULL DEFAULT
    '{"valid":true,"errors":[],"warnings":[]}'::JSONB,
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

ALTER TABLE dr_change_proposals
  DROP CONSTRAINT IF EXISTS dr_change_proposals_validation_result_object;

ALTER TABLE dr_change_proposals
  ADD CONSTRAINT dr_change_proposals_validation_result_object
  CHECK (JSONB_TYPEOF(validation_result) = 'object');

CREATE INDEX IF NOT EXISTS dr_change_proposals_context_queue_idx
  ON dr_change_proposals(
    root_key,
    bundle_id,
    status,
    updated_at DESC
  );

ALTER TABLE dr_publications
  ADD COLUMN IF NOT EXISTS root_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bundle_id TEXT,
  ADD COLUMN IF NOT EXISTS prior_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE dr_publications
  DROP CONSTRAINT IF EXISTS dr_publications_prior_snapshot_object;

ALTER TABLE dr_publications
  ADD CONSTRAINT dr_publications_prior_snapshot_object
  CHECK (JSONB_TYPEOF(prior_snapshot) = 'object');

CREATE INDEX IF NOT EXISTS dr_publications_context_target_idx
  ON dr_publications(
    root_key,
    bundle_id,
    target_type,
    target_id,
    created_at DESC
  );
