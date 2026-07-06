-- Per-user dismissals: block lazy link re-attach without keeping inbox rows forever.

CREATE TABLE user_notification_dismissals (
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  notification_id text NOT NULL REFERENCES notification_items(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, notification_id)
);

CREATE INDEX idx_user_notification_dismissals_user_dismissed
  ON user_notification_dismissals (user_id, dismissed_at DESC);

INSERT INTO user_notification_dismissals (user_id, notification_id, dismissed_at)
SELECT user_id, notification_id, COALESCE(deleted_at, updated_at, NOW())
FROM user_notification_inbox
WHERE deleted_at IS NOT NULL
ON CONFLICT (user_id, notification_id) DO NOTHING;

DELETE FROM user_notification_inbox WHERE deleted_at IS NOT NULL;
