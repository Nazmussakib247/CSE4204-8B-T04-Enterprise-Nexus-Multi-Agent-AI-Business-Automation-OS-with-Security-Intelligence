-- ============================================================
-- Migration 002: audit_logs + password_reset_tokens
-- Run in Supabase SQL editor or via CLI
-- ============================================================

-- ── audit_logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES users(id) ON DELETE SET NULL,
  action           TEXT        NOT NULL,                    -- e.g. 'auth.login', 'hr.report.create'
  resource_type    TEXT,                                    -- e.g. 'hr_report', 'finance_record'
  resource_id      TEXT,                                    -- stringified PK of the affected row
  metadata         JSONB,                                   -- arbitrary extra payload
  ip_address       TEXT,
  user_agent       TEXT,
  correlation_id   TEXT,
  success          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the most common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success    ON audit_logs(success);

-- RLS: admins/managers see all; regular users see only their own rows
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users read own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Service role bypasses RLS for inserts (backend uses service role key)

-- ── password_reset_tokens ────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,   -- SHA-256 of the raw token
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);

-- No RLS needed — backend accesses via service role key only

-- ── Cleanup job (optional): expire old tokens daily ──────────
-- You can schedule this in Supabase via pg_cron:
-- SELECT cron.schedule('expire-reset-tokens', '0 3 * * *',
--   $$ DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE $$);
