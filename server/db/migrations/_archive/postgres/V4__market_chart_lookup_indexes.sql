-- Extra lookup indexes for quote tabs, mini charts, and quant history.
-- V3 may already be applied in production, so new indexes must live in V4.

CREATE INDEX IF NOT EXISTS idx_market_quotes_symbol_upper
  ON market_quotes (upper(COALESCE(symbol, '')));

CREATE INDEX IF NOT EXISTS idx_market_quotes_provider_item_upper
  ON market_quotes (upper(COALESCE(payload->>'providerItemId', '')));

CREATE INDEX IF NOT EXISTS idx_price_series_display_symbol_upper
  ON price_series (upper(COALESCE(display_symbol, '')));

CREATE INDEX IF NOT EXISTS idx_price_series_yahoo_symbol_upper
  ON price_series (upper(COALESCE(yahoo_symbol, '')));

CREATE INDEX IF NOT EXISTS idx_price_series_payload_krx_upper
  ON price_series (upper(COALESCE(payload->>'krxSymbol', '')));

CREATE INDEX IF NOT EXISTS idx_price_series_payload_display_upper
  ON price_series (upper(COALESCE(payload->>'displaySymbol', '')));

CREATE INDEX IF NOT EXISTS idx_price_series_payload_yahoo_upper
  ON price_series (upper(COALESCE(payload->>'yahooSymbol', '')));

CREATE INDEX IF NOT EXISTS idx_quant_signal_items_symbol_upper
  ON quant_signal_items (upper(symbol), generated_date DESC);
