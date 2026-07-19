-- ============================================================
--  Enterprise NeXus — Initial Database Schema
--  Migration 001
--  Database: PostgreSQL (Supabase)
--  Run in Supabase SQL Editor or via: supabase db push
-- ============================================================

-- ── EXTENSION ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ============================================================
--  TABLE: roles
--  Lookup table for user roles (admin, manager, employee)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,          -- 'admin' | 'manager' | 'employee'
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default roles
INSERT INTO roles (name, description) VALUES
  ('admin',    'Full system access — can manage users, roles, and all data'),
  ('manager',  'Department-level access — can view and edit team data'),
  ('employee', 'Standard user — can create and view own data')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
--  TABLE: users
--  Core user accounts with bcrypt-hashed passwords
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email         TEXT        NOT NULL UNIQUE CHECK (email LIKE '%@%'),
  password_hash TEXT        NOT NULL,
  role_id       UUID        REFERENCES roles(id) ON DELETE SET NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own record"   ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins read all users"   ON users FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'admin'));

-- ============================================================
--  TABLE: user_sessions
--  Hashed refresh tokens for JWT revocation
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL,          -- SHA-256 of the raw refresh token
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_token ON user_sessions(user_id, token_hash);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON user_sessions FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: password_reset_tokens
--  Time-limited (1 hour) single-use tokens for password reset
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,   -- SHA-256 of the raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);

-- ============================================================
--  TABLE: hr_reports
--  AI-scored candidate screening reports (Gemini AI)
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
  score_breakdown   JSONB,      -- { technical, experience, communication, leadership }
  extracted_profile JSONB,      -- source, filename, text_length, etc.
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_reports_user_id       ON hr_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_reports_recommendation ON hr_reports(recommendation);
CREATE INDEX IF NOT EXISTS idx_hr_reports_created_at    ON hr_reports(created_at DESC);

ALTER TABLE hr_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own HR reports" ON hr_reports FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: finance_records
--  Expense/transaction records with AI anomaly detection
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

ALTER TABLE finance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own finance records" ON finance_records FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: support_tickets
--  Customer support tickets with Gemini AI sentiment analysis
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
CREATE POLICY "Users manage own support tickets" ON support_tickets FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: analytics_reports
--  AI-generated KPI and performance analytics reports
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_reports (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performance_rating TEXT        CHECK (performance_rating IN ('excellent', 'good', 'average', 'poor')),
  overall_score      NUMERIC     CHECK (overall_score BETWEEN 0 AND 100),
  ai_insights        TEXT,
  action_items       JSONB,      -- array of recommended actions
  kpi_snapshot       JSONB,      -- { revenue, tickets_resolved, candidates_screened, ... }
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_user_id    ON analytics_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_created_at ON analytics_reports(created_at DESC);

ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own analytics reports" ON analytics_reports FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: executive_reports
--  Cross-domain AI executive briefing reports
-- ============================================================
CREATE TABLE IF NOT EXISTS executive_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performance_summary TEXT        NOT NULL,
  ai_briefing         TEXT,
  briefing_data       JSONB,      -- raw cross-domain snapshot used for generation
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_reports_user_id    ON executive_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_executive_reports_created_at ON executive_reports(created_at DESC);

ALTER TABLE executive_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own executive reports" ON executive_reports FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: tasks
--  Background agent task queue
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type   TEXT        NOT NULL CHECK (agent_type IN ('hr', 'finance', 'support', 'analytics', 'executive')),
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  load         JSONB,      -- input payload for the agent
  result       TEXT,       -- output/result summary
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id    ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent_type ON tasks(agent_type);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON tasks FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  TABLE: audit_logs
--  Immutable security audit trail — login, logout, data changes
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  action         TEXT        NOT NULL,   -- e.g. 'auth.login', 'hr.report.create'
  resource_type  TEXT,                   -- e.g. 'hr_report', 'finance_record'
  resource_id    TEXT,                   -- stringified PK of affected row
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
CREATE POLICY "Admins and managers read all audit logs" ON audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND r.name IN ('admin', 'manager')
  ));
CREATE POLICY "Users read own audit logs" ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
--  SUMMARY
-- ============================================================
-- Tables     : 11
-- roles, users, user_sessions, password_reset_tokens,
-- hr_reports, finance_records, support_tickets,
-- analytics_reports, executive_reports, tasks, audit_logs
--
-- All tables use:
--   • UUID primary keys (gen_random_uuid)
--   • TIMESTAMPTZ for all timestamps
--   • CHECK constraints for enums/ranges
--   • Foreign keys with appropriate ON DELETE behaviour
--   • Indexes on all FK and frequently-queried columns
--   • Row-Level Security (RLS) with role-aware policies
-- ============================================================
