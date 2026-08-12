-- ============================================================
--  Migration 002: AI status tracking
--  Adds ai_status to every AI-enriched table so records saved
--  during an AI outage are queryable and retryable
--  ('failed' rows have NULL AI fields — never fake data).
-- ============================================================

ALTER TABLE hr_reports
  ADD COLUMN IF NOT EXISTS ai_status TEXT
    CHECK (ai_status IN ('pending', 'completed', 'failed'))
    DEFAULT 'completed';

ALTER TABLE finance_records
  ADD COLUMN IF NOT EXISTS ai_status TEXT
    CHECK (ai_status IN ('pending', 'completed', 'failed'))
    DEFAULT 'completed';

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS ai_status TEXT
    CHECK (ai_status IN ('pending', 'completed', 'failed'))
    DEFAULT 'completed';

-- Fast lookup of rows needing retry
CREATE INDEX IF NOT EXISTS idx_hr_reports_ai_status      ON hr_reports(ai_status)      WHERE ai_status <> 'completed';
CREATE INDEX IF NOT EXISTS idx_finance_records_ai_status ON finance_records(ai_status) WHERE ai_status <> 'completed';
CREATE INDEX IF NOT EXISTS idx_support_tickets_ai_status ON support_tickets(ai_status) WHERE ai_status <> 'completed';
