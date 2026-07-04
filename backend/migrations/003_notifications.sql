-- Migration: 003_notifications
-- Creates the notifications table for in-app alerts

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL DEFAULT 'info',  -- 'info' | 'success' | 'warning' | 'error'
  title        TEXT        NOT NULL CHECK (char_length(title) <= 200),
  message      TEXT        NOT NULL CHECK (char_length(message) <= 1000),
  link         TEXT,                                  -- optional deep-link e.g. '/hr/uuid'
  read         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_unread_idx   ON notifications(user_id, read) WHERE read = FALSE;
