-- Additional indexes for admin lists and feed sorting after Postgres migration.

CREATE INDEX IF NOT EXISTS idx_news_items_published_position
  ON news_items (published_at DESC, position ASC);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_view_count_num
  ON youtube_videos ((
    CASE
      WHEN NULLIF(payload->>'viewCount', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (payload->>'viewCount')::numeric
      ELSE 0
    END
  ) DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_coin_markets_market_cap_num
  ON coin_markets ((
    CASE
      WHEN NULLIF(payload->>'marketCap', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (payload->>'marketCap')::numeric
      ELSE 0
    END
  ) DESC, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_users_created
  ON app_users (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_user_devices_updated
  ON app_user_devices (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_items_user_schedule
  ON notification_items (app_user_id, status, scheduled_at DESC);
