-- Public API read path indexes for the Postgres runtime.
-- These support list endpoints that filter inside JSONB payload fields.

CREATE INDEX IF NOT EXISTS idx_news_items_symbols_gin
  ON news_items USING GIN ((payload->'symbols'));

CREATE INDEX IF NOT EXISTS idx_news_items_hashtags_gin
  ON news_items USING GIN ((payload->'hashtags'));

CREATE INDEX IF NOT EXISTS idx_youtube_videos_sort_buckets_gin
  ON youtube_videos USING GIN ((payload->'sortBuckets'));

CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_handle_lower
  ON youtube_videos (lower(COALESCE(payload->>'channelHandle', '')));

CREATE INDEX IF NOT EXISTS idx_market_quotes_krx_symbol_upper
  ON market_quotes (upper(COALESCE(payload->>'krxSymbol', '')));

CREATE INDEX IF NOT EXISTS idx_market_quotes_display_symbol_upper
  ON market_quotes (upper(COALESCE(payload->>'displaySymbol', '')));

CREATE INDEX IF NOT EXISTS idx_market_quotes_regular_yahoo_upper
  ON market_quotes (upper(COALESCE(payload->'regularSession'->>'yahooSymbol', '')));

CREATE INDEX IF NOT EXISTS idx_price_series_symbol_upper
  ON price_series (upper(symbol));
