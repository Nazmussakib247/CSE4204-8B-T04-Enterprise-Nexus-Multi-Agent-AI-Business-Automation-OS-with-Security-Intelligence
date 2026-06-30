require('dotenv').config();
const { pool } = require('./db');

const SQL = `
-- ─────────────────────────────────────────────
--  ROLES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50)  NOT NULL UNIQUE,        -- e.g. 'admin', 'employee', 'guest'
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- seed default roles
INSERT INTO roles (name, description) VALUES
  ('admin',    'Full system access including user management and executive briefings'),
  ('employee', 'Authenticated user with access to HR, Finance, Support, Analytics modules'),
  ('guest',    'Unauthenticated — register / login only')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────
--  USERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID         NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
--  TASKS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type   VARCHAR(50)  NOT NULL,   -- hr | finance | support | analytics | executive | workflow
  status       VARCHAR(30)  NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
  payload      JSONB,                   -- input supplied to agent
  result       JSONB,                   -- output produced by agent
  text         TEXT,                    -- freeform text input (CV text, query, etc.)
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ─────────────────────────────────────────────
--  HR REPORTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id           UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  candidate_name    VARCHAR(150),
  job_title         VARCHAR(150),
  ai_score          NUMERIC(5,2),        -- 0 – 100
  confidence        NUMERIC(5,2),        -- 0 – 1
  recommendation    VARCHAR(50),         -- hire | reject | interview
  narrative_summary TEXT,
  score_breakdown   JSONB,               -- { technical: n, experience: n, … }
  extracted_profile JSONB,               -- raw parsed CV data
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
--  FINANCE RECORDS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    VARCHAR(100)  NOT NULL,
  amount      NUMERIC(15,2) NOT NULL,
  date        DATE          NOT NULL,
  description TEXT,
  severity    VARCHAR(20),              -- low | medium | high | critical
  ai_analysis TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
--  ANALYTICS REPORTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id            UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date_period_start  DATE        NOT NULL,
  date_period_end    DATE        NOT NULL,
  performance_rating VARCHAR(30),        -- excellent | good | average | poor
  overall_score      NUMERIC(5,2),
  ai_insights        TEXT,
  action_items       JSONB,              -- array of strings
  kpi_snapshot       JSONB,             -- { revenue: n, tickets: n, … }
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
--  SUPPORT TICKETS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id    UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text_query TEXT        NOT NULL,
  ai_response TEXT,
  intent     VARCHAR(100),
  urgency    VARCHAR(20),               -- low | medium | high | critical
  sentiment  VARCHAR(20),               -- positive | neutral | negative
  confidence NUMERIC(5,2),
  escalated  BOOLEAN     NOT NULL DEFAULT FALSE,
  status     VARCHAR(30) NOT NULL DEFAULT 'open',  -- open | resolved | escalated
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
--  EXECUTIVE REPORTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS executive_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id             UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date                DATE        NOT NULL DEFAULT CURRENT_DATE,
  briefing_text       TEXT,
  agent_outputs       JSONB,             -- raw outputs from each sub-agent
  performance_summary JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
--  AI CACHE  (shared response cache)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   VARCHAR(64) NOT NULL UNIQUE,   -- SHA-256 of prompt
  response    TEXT        NOT NULL,
  agent_type  VARCHAR(50),
  hit_count   INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- ─────────────────────────────────────────────
--  TOKEN / COST TRACKING
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_stats (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  agent_type     VARCHAR(50),
  task_id        UUID        REFERENCES tasks(id) ON DELETE SET NULL,
  input_tokens   INTEGER     NOT NULL DEFAULT 0,
  output_tokens  INTEGER     NOT NULL DEFAULT 0,
  cost_usd       NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
--  INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_user_id      ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent_type   ON tasks(agent_type);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_hr_reports_user    ON hr_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_user       ON finance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user     ON analytics_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_support_user       ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_status     ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_executive_user     ON executive_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires   ON ai_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_stats_user   ON token_stats(user_id);
`;

(async () => {
  const client = await require('./db').pool.connect();
  try {
    await client.query(SQL);
    console.log('✅  Migration complete — all tables created.');
  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
})();
