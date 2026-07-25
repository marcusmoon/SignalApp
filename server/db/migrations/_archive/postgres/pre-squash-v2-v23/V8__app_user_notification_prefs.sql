ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{"pushEnabled":true,"briefingPushEnabled":true}'::jsonb;
