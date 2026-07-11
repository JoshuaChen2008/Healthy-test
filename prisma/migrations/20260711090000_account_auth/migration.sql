ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'abandoned';

-- Resolve pre-existing duplicate drafts before adding the one-active-draft invariant.
WITH ranked_drafts AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS draft_rank
  FROM assessments
  WHERE status = 'in_progress'
)
UPDATE assessments
SET status = 'abandoned'
WHERE id IN (
  SELECT id
  FROM ranked_drafts
  WHERE draft_rank > 1
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash CHAR(64) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMP(3) NOT NULL,
  blocked_until TIMESTAMP(3),
  expires_at TIMESTAMP(3) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_expires_at_idx
ON auth_rate_limits (expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS assessments_one_in_progress_per_user
ON assessments (user_id)
WHERE status = 'in_progress';
