-- Migration: 004_user_notification_prefs
-- Adds a JSONB column to users for storing per-user notification preferences

ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}';
