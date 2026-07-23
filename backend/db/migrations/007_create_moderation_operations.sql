CREATE TABLE IF NOT EXISTS dr_moderation_reports (
  report_id UUID PRIMARY KEY,
  reported_by_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  report_category TEXT NOT NULL CHECK (report_category IN ('spam', 'misleading', 'copyright', 'abuse', 'conflict_of_interest', 'other')),
  report_details TEXT NOT NULL DEFAULT '',
  report_status TEXT NOT NULL DEFAULT 'open' CHECK (report_status IN ('open', 'triaged', 'resolved', 'dismissed')),
  assigned_to_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  resolution_note TEXT NOT NULL DEFAULT '',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_moderation_reports_queue_idx
  ON dr_moderation_reports(report_status, created_at DESC);

CREATE TABLE IF NOT EXISTS dr_account_actions (
  account_action_id UUID PRIMARY KEY,
  target_user_id UUID NOT NULL REFERENCES dr_users(user_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('suspend', 'restore', 'delete_requested', 'delete_completed', 'role_changed', 'session_revoked')),
  actor_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dr_account_actions_user_idx
  ON dr_account_actions(target_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dr_record_locks (
  record_lock_id UUID PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  lock_reason TEXT NOT NULL DEFAULT '',
  locked_by_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  released_by_user_id UUID REFERENCES dr_users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS dr_record_locks_active_unique
  ON dr_record_locks(target_type, target_id)
  WHERE released_at IS NULL;
