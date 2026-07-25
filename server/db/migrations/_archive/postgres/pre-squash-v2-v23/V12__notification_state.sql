-- Per-user notification state: lazy link cursor for inbox sync.

CREATE TABLE user_notification_state (
  user_id text PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  last_notification_id text REFERENCES notification_items(id) ON DELETE SET NULL,
  last_delivered_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

DELETE FROM user_notification_inbox WHERE deleted_at IS NOT NULL;

-- Existing inbox users: resume from their newest linked notification.
INSERT INTO user_notification_state (user_id, last_notification_id, last_delivered_at, updated_at)
SELECT DISTINCT ON (i.user_id)
  i.user_id,
  i.notification_id,
  i.delivered_at,
  NOW()
FROM user_notification_inbox i
ORDER BY i.user_id, i.delivered_at DESC, i.notification_id DESC
ON CONFLICT (user_id) DO NOTHING;
