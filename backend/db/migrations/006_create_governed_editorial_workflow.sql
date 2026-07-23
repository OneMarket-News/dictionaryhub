CREATE TABLE IF NOT EXISTS dr_change_proposals (
  proposal_id UUID PRIMARY KEY,
  proposal_number BIGSERIAL UNIQUE,
  organization_id UUID REFERENCES dr_organizations(organization_id) ON DELETE SET NULL,
  created_by_user_id UUID NOT NULL REFERENCES dr_users(user_id) ON DELETE RESTRICT,
  assigned_reviewer_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('concept', 'meaning', 'relationship', 'source', 'assertion')),
  target_id TEXT NOT NULL,
  proposal_title TEXT NOT NULL,
  proposal_summary TEXT NOT NULL DEFAULT '',
  base_revision_id TEXT,
  base_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  editorial_rationale TEXT NOT NULL DEFAULT '',
  interpretation_disclosure TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'published', 'superseded', 'withdrawn')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  version_number INTEGER NOT NULL DEFAULT 1,
  locked_at TIMESTAMPTZ,
  locked_by_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_change_proposals_queue_idx
  ON dr_change_proposals(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS dr_change_proposals_target_idx
  ON dr_change_proposals(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dr_change_proposals_creator_idx
  ON dr_change_proposals(created_by_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS dr_proposal_evidence (
  evidence_id UUID PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES dr_change_proposals(proposal_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  assertion_id TEXT,
  evidence_note TEXT NOT NULL DEFAULT '',
  evidence_role TEXT NOT NULL DEFAULT 'supporting'
    CHECK (evidence_role IN ('supporting', 'contradicting', 'context', 'license')),
  created_by_user_id UUID NOT NULL REFERENCES dr_users(user_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_proposal_evidence_proposal_idx
  ON dr_proposal_evidence(proposal_id, created_at);

CREATE TABLE IF NOT EXISTS dr_proposal_comments (
  comment_id UUID PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES dr_change_proposals(proposal_id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES dr_users(user_id) ON DELETE RESTRICT,
  comment_type TEXT NOT NULL DEFAULT 'discussion'
    CHECK (comment_type IN ('discussion', 'review_note', 'change_request', 'publication_note', 'system')),
  comment_body TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_proposal_comments_proposal_idx
  ON dr_proposal_comments(proposal_id, created_at);

CREATE TABLE IF NOT EXISTS dr_proposal_events (
  proposal_event_id UUID PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES dr_change_proposals(proposal_id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  event_note TEXT NOT NULL DEFAULT '',
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_proposal_events_proposal_idx
  ON dr_proposal_events(proposal_id, created_at);

CREATE TABLE IF NOT EXISTS dr_publications (
  publication_id UUID PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES dr_change_proposals(proposal_id) ON DELETE RESTRICT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  published_revision_id TEXT NOT NULL,
  published_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_by_user_id UUID NOT NULL REFERENCES dr_users(user_id) ON DELETE RESTRICT,
  publication_note TEXT NOT NULL DEFAULT '',
  supersedes_publication_id UUID REFERENCES dr_publications(publication_id) ON DELETE SET NULL,
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  rollback_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_publications_target_idx
  ON dr_publications(target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dr_published_overlays (
  overlay_id UUID PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES dr_publications(publication_id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  overlay_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deactivated_at TIMESTAMPTZ,
  UNIQUE (publication_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS dr_published_overlays_active_target_unique
  ON dr_published_overlays(target_type, target_id)
  WHERE is_active = TRUE;
