-- Migration: create user_sessions table for refresh token revocation
-- Run this once in Supabase SQL Editor (or via supabase db push)

CREATE TABLE IF NOT EXISTS user_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,          -- SHA-256 hash of the refresh token
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Index for fast lookup during refresh / logout
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_token
  ON user_sessions (user_id, token_hash);

-- Auto-clean expired sessions (optional, run periodically or via pg_cron)
-- DELETE FROM user_sessions WHERE expires_at < NOW();

-- Row-level security: users can only see their own sessions (optional hardening)
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON user_sessions
  FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE user_sessions IS
  'Stores hashed refresh tokens for revocation. Backend uses service role key so RLS is bypassed for server operations.';
