-- Per-user notification inbox links (template = notification_items, user state here)

CREATE TABLE user_notification_inbox (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  notification_id text NOT NULL REFERENCES notification_items(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uq_user_notification_inbox_user_notification UNIQUE (user_id, notification_id)
);

CREATE INDEX idx_user_notification_inbox_user_list
  ON user_notification_inbox (user_id, deleted_at, delivered_at DESC);

CREATE INDEX idx_user_notification_inbox_user_unread
  ON user_notification_inbox (user_id, read_at)
  WHERE deleted_at IS NULL;
