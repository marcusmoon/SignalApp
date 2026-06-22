ALTER TABLE market_quotes
  ADD COLUMN IF NOT EXISTS display_symbol text,
  ADD COLUMN IF NOT EXISTS krx_symbol text,
  ADD COLUMN IF NOT EXISTS provider_item_id text,
  ADD COLUMN IF NOT EXISTS regular_yahoo_symbol text;

UPDATE market_quotes
SET
  display_symbol = NULLIF(COALESCE(display_symbol, payload->>'displaySymbol'), ''),
  krx_symbol = NULLIF(COALESCE(krx_symbol, payload->>'krxSymbol'), ''),
  provider_item_id = NULLIF(COALESCE(provider_item_id, payload->>'providerItemId'), ''),
  regular_yahoo_symbol = NULLIF(COALESCE(regular_yahoo_symbol, payload->'regularSession'->>'yahooSymbol'), '')
WHERE
  display_symbol IS NULL
  OR krx_symbol IS NULL
  OR provider_item_id IS NULL
  OR regular_yahoo_symbol IS NULL;

CREATE INDEX IF NOT EXISTS idx_market_quotes_symbol_upper_segment_fetch
  ON market_quotes (upper(COALESCE(symbol, '')), segment, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_quotes_display_upper_segment_fetch
  ON market_quotes (upper(COALESCE(display_symbol, '')), segment, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_quotes_krx_upper_segment_fetch
  ON market_quotes (upper(COALESCE(krx_symbol, '')), segment, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_quotes_provider_item_upper_segment_fetch
  ON market_quotes (upper(COALESCE(provider_item_id, '')), segment, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_quotes_regular_yahoo_upper_segment_fetch
  ON market_quotes (upper(COALESCE(regular_yahoo_symbol, '')), segment, fetched_at DESC);
