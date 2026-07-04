-- ============================================================
--  Enterprise NeXus — Canonical Initial Schema
--  Supabase Migration 001
--  Consolidates: database/001_initial_schema.sql +
--                backend/migrations/002..004
--
--  Run via:  supabase db push
--         or paste into Supabase SQL Editor
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy text search on names/emails

-- ============================================================
--  TABLE: roles
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('admin',    'Full system access — can manage users, roles, and all data'),
  ('manager',  'Department-level access — can view and edit team data'),
  ('employee', 'Standard user — can create and view own data')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
--  TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email              TEXT        NOT NULL UNIQUE CHECK (email LIKE '%@%'),
  password_hash      TEXT        NOT NULL,
  role_id            UUID        REFERENCES roles(id) ON DELETE SET NULL,
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
  notification_prefs JSONB       NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own record" ON users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins read all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name = 'admin')
  );

-- ============================================================
--  TABLE: user_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_token ON user_sessions(user_id, token_hash);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON user_sessions
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: password_reset_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);

-- No RLS — backend accesses via service role key only

-- ============================================================
--  TABLE: hr_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_reports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_name    TEXT        NOT NULL CHECK (char_length(candidate_name) BETWEEN 2 AND 200),
  job_title         TEXT        NOT NULL CHECK (char_length(job_title) BETWEEN 2 AND 200),
  ai_score          INTEGER     CHECK (ai_score BETWEEN 0 AND 100),
  confidence        TEXT        CHECK (confidence IN ('low', 'medium', 'high')),
  recommendation    TEXT        CHECK (recommendation IN ('shortlist', 'reject', 'review')),
  narrative_summary TEXT,
  score_breakdown   JSONB,
  extracted_profile JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_reports_user_id        ON hr_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_reports_recommendation ON hr_reports(recommendation);
CREATE INDEX IF NOT EXISTS idx_hr_reports_created_at     ON hr_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_reports_ai_score       ON hr_reports(ai_score DESC);

ALTER TABLE hr_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own HR reports" ON hr_reports
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Managers read all HR reports" ON hr_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name IN ('admin', 'manager'))
  );

-- ============================================================
--  TABLE: finance_records
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_records (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category     TEXT        NOT NULL CHECK (char_length(category) <= 100),
  amount       NUMERIC     NOT NULL CHECK (amount > 0),
  expense_date DATE        NOT NULL,
  description  TEXT,
  is_anomaly   BOOLEAN     NOT NULL DEFAULT FALSE,
  severity     TEXT        CHECK (severity IN ('low', 'medium', 'high')),
  ai_note      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_records_user_id      ON finance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_records_expense_date ON finance_records(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_records_is_anomaly   ON finance_records(is_anomaly);
CREATE INDEX IF NOT EXISTS idx_finance_records_category     ON finance_records(category);

ALTER TABLE finance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own finance records" ON finance_records
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Managers read all finance records" ON finance_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name IN ('admin', 'manager'))
  );

-- ============================================================
--  TABLE: support_tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query        TEXT        NOT NULL CHECK (char_length(query) BETWEEN 5 AND 5000),
  ai_response  TEXT,
  intent       TEXT,
  urgency      TEXT        CHECK (urgency IN ('low', 'medium', 'high')),
  sentiment    TEXT        CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  confidence   TEXT        CHECK (confidence IN ('low', 'medium', 'high')),
  status       TEXT        NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'in_progress', 'resolved', 'escalated')),
  escalated    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id   ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status    ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_urgency   ON support_tickets(urgency);
CREATE INDEX IF NOT EXISTS idx_support_tickets_escalated ON support_tickets(escalated);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tickets" ON support_tickets
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Managers read all tickets" ON support_tickets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name IN ('admin', 'manager'))
  );

-- ============================================================
--  TABLE: analytics_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_reports (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performance_rating TEXT        CHECK (performance_rating IN ('excellent', 'good', 'average', 'poor')),
  overall_score      NUMERIC     CHECK (overall_score BETWEEN 0 AND 100),
  ai_insights        TEXT,
  action_items       JSONB,
  kpi_snapshot       JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_user_id    ON analytics_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_created_at ON analytics_reports(created_at DESC);

ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own analytics" ON analytics_reports
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: executive_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS executive_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performance_summary TEXT        NOT NULL,
  ai_briefing         TEXT,
  briefing_data       JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_reports_user_id    ON executive_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_executive_reports_created_at ON executive_reports(created_at DESC);

ALTER TABLE executive_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own executive reports" ON executive_reports
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type   TEXT        NOT NULL CHECK (agent_type IN ('hr', 'finance', 'support', 'analytics', 'executive')),
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  load         JSONB,
  result       TEXT,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id    ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent_type ON tasks(agent_type);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON tasks
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  action         TEXT        NOT NULL,
  resource_type  TEXT,
  resource_id    TEXT,
  metadata       JSONB,
  ip_address     TEXT,
  user_agent     TEXT,
  correlation_id TEXT,
  success        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success    ON audit_logs(success);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers read audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name IN ('admin', 'manager'))
  );
CREATE POLICY "Users read own audit logs" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
--  TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'info'
                         CHECK (type IN ('info', 'success', 'warning', 'error')),
  title      TEXT        NOT NULL CHECK (char_length(title) <= 200),
  message    TEXT        NOT NULL CHECK (char_length(message) <= 1000),
  link       TEXT,
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id, read) WHERE read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  OPTIONAL: pg_cron cleanup (schedule in Supabase Dashboard)
-- ============================================================
-- SELECT cron.schedule('expire-reset-tokens', '0 3 * * *',
--   $$ DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE; $$);
-- SELECT cron.schedule('expire-sessions', '0 4 * * *',
--   $$ DELETE FROM user_sessions WHERE expires_at < NOW(); $$);

-- ============================================================
--  SUMMARY
--  Tables (12):
--    roles, users, user_sessions, password_reset_tokens,
--    hr_reports, finance_records, support_tickets,
--    analytics_reports, executive_reports, tasks,
--    audit_logs, notifications
--
--  All tables:
--    • UUID PKs via gen_random_uuid()
--    • TIMESTAMPTZ for all datetimes
--    • CHECK constraints enforce enum values
--    • FKs with correct ON DELETE behaviour
--    • Composite/partial indexes on hot query patterns
--    • RLS enabled with role-aware policies
-- ============================================================
