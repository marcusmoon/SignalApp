-- YouTube videos are reloaded after this migration. Store operational fields as columns.
DELETE FROM youtube_videos;

DROP INDEX IF EXISTS idx_youtube_videos_sort_buckets_gin;
DROP INDEX IF EXISTS idx_youtube_videos_channel_handle_lower;
DROP INDEX IF EXISTS idx_youtube_videos_view_count_num;

ALTER TABLE youtube_videos
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'youtube',
  ADD COLUMN IF NOT EXISTS provider_item_id text,
  ADD COLUMN IF NOT EXISTS video_id text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS channel_id text,
  ADD COLUMN IF NOT EXISTS channel_handle text,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS sort_bucket text,
  ADD COLUMN IF NOT EXISTS sort_buckets text[] NOT NULL DEFAULT '{}';

ALTER TABLE youtube_videos DROP COLUMN IF EXISTS payload;

CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_handle_lower
  ON youtube_videos (lower(COALESCE(channel_handle, '')));

CREATE INDEX IF NOT EXISTS idx_youtube_videos_sort_buckets_gin
  ON youtube_videos USING GIN (sort_buckets);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_view_count_num
  ON youtube_videos (view_count DESC, published_at DESC);
