-- ============================================================
-- Hotfix: ensure the deployed Supabase project has in-app notifications.
-- Safe to run after the original schema: all DDL is idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'info'
                         CHECK (type IN ('info', 'success', 'warning', 'error')),
  title      TEXT        NOT NULL CHECK (char_length(title) <= 200),
  message    TEXT        NOT NULL CHECK (char_length(message) <= 1000),
  link       TEXT,
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id, read) WHERE read = FALSE;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users manage own notifications'
  ) THEN
    CREATE POLICY "Users manage own notifications"
      ON public.notifications
      FOR ALL
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Ask PostgREST to reload its schema cache immediately.
NOTIFY pgrst, 'reload schema';
