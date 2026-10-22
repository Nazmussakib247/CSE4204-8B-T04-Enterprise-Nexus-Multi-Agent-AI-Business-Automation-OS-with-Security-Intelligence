-- Persistent period-based Executive Intelligence briefings.
ALTER TABLE executive_reports ADD COLUMN IF NOT EXISTS period_type TEXT;
ALTER TABLE executive_reports ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE executive_reports ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE executive_reports ADD COLUMN IF NOT EXISTS recommendations JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_executive_reports_period
  ON executive_reports (user_id, period_type, period_start DESC);
