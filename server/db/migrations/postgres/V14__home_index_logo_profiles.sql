-- Home index tile logos: caret indices have no Parqet assets → tracking ETF proxies.
-- Keep symbols in sync with domain/home/homeIndices.ts · server/src/symbols/homeIndexLogos.mjs
INSERT INTO symbol_profiles (
  symbol_key,
  market,
  symbol,
  display_symbol,
  name,
  exchange,
  logo_url,
  payload,
  updated_at
)
VALUES
  (
    'global:SPY',
    'global',
    'SPY',
    'SPY',
    'SPDR S&P 500 ETF',
    NULL,
    'https://assets.parqet.com/logos/symbol/SPY',
    '{"source":"home_index_logo"}'::jsonb,
    now()
  ),
  (
    'global:QQQ',
    'global',
    'QQQ',
    'QQQ',
    'Invesco QQQ Trust',
    NULL,
    'https://assets.parqet.com/logos/symbol/QQQ',
    '{"source":"home_index_logo"}'::jsonb,
    now()
  ),
  (
    'global:DIA',
    'global',
    'DIA',
    'DIA',
    'SPDR Dow Jones Industrial Average ETF',
    NULL,
    'https://assets.parqet.com/logos/symbol/DIA',
    '{"source":"home_index_logo"}'::jsonb,
    now()
  ),
  (
    'global:SOXX',
    'global',
    'SOXX',
    'SOXX',
    'iShares Semiconductor ETF',
    NULL,
    'https://assets.parqet.com/logos/symbol/SOXX',
    '{"source":"home_index_logo"}'::jsonb,
    now()
  ),
  (
    'kr:069500',
    'kr',
    '069500',
    '069500',
    'KODEX 200',
    NULL,
    'https://assets.parqet.com/logos/symbol/069500.KS',
    '{"source":"home_index_logo"}'::jsonb,
    now()
  ),
  (
    'global:EWJ',
    'global',
    'EWJ',
    'EWJ',
    'iShares MSCI Japan ETF',
    NULL,
    'https://assets.parqet.com/logos/symbol/EWJ',
    '{"source":"home_index_logo"}'::jsonb,
    now()
  )
ON CONFLICT (symbol_key) DO UPDATE SET
  name = COALESCE(symbol_profiles.name, excluded.name),
  logo_url = COALESCE(symbol_profiles.logo_url, excluded.logo_url),
  payload = CASE
    WHEN symbol_profiles.payload IS NULL OR symbol_profiles.payload = '{}'::jsonb THEN excluded.payload
    ELSE symbol_profiles.payload || excluded.payload
  END,
  updated_at = now();
