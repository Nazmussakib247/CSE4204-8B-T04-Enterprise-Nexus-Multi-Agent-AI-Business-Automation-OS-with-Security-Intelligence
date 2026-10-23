-- Older deployments created users from database/001_initial_schema.sql,
-- which predates notification_prefs. The profile endpoint expects this column.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
