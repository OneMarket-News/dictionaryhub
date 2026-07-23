ALTER TABLE dr_auth_sessions
  ADD COLUMN IF NOT EXISTS identity_id UUID REFERENCES dr_auth_identities(identity_id) ON DELETE SET NULL;

UPDATE dr_auth_sessions AS session
SET identity_id = (
  SELECT candidate.identity_id
  FROM dr_auth_identities AS candidate
  WHERE candidate.user_id = session.user_id
  ORDER BY candidate.last_signed_in_at DESC NULLS LAST, candidate.created_at DESC
  LIMIT 1
)
WHERE session.identity_id IS NULL;

CREATE INDEX IF NOT EXISTS dr_auth_sessions_identity_idx
  ON dr_auth_sessions(identity_id)
  WHERE identity_id IS NOT NULL;
