CREATE TABLE IF NOT EXISTS symbol_profiles (
  symbol_key text PRIMARY KEY,
  market text NOT NULL,
  symbol text NOT NULL,
  display_symbol text NOT NULL,
  name text,
  exchange text,
  logo_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_symbol_profiles_market_symbol
  ON symbol_profiles (market, symbol);

CREATE INDEX IF NOT EXISTS idx_symbol_profiles_display_symbol
  ON symbol_profiles (display_symbol);

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
SELECT DISTINCT ON (symbol_key)
  symbol_key,
  market,
  symbol,
  display_symbol,
  name,
  exchange,
  logo_url,
  payload,
  updated_at
FROM (
  SELECT
    CASE
      WHEN COALESCE(mq.krx_symbol, '') <> '' THEN 'kr:' || regexp_replace(COALESCE(mq.krx_symbol, ''), '\.(KS|KQ)$', '', 'g')
      ELSE 'global:' || regexp_replace(COALESCE(mq.display_symbol, mq.symbol, ''), '\.(US|NYSE|NASDAQ|AMEX|NMS|NYQ)$', '', 'g')
    END AS symbol_key,
    CASE
      WHEN COALESCE(mq.krx_symbol, '') <> '' THEN 'kr'
      ELSE 'global'
    END AS market,
    regexp_replace(
      COALESCE(NULLIF(mq.krx_symbol, ''), NULLIF(mq.display_symbol, ''), NULLIF(mq.symbol, '')),
      '\.(KS|KQ|US|NYSE|NASDAQ|AMEX|NMS|NYQ)$',
      '',
      'g'
    ) AS symbol,
    regexp_replace(
      COALESCE(NULLIF(mq.display_symbol, ''), NULLIF(mq.krx_symbol, ''), NULLIF(mq.symbol, '')),
      '\.(KS|KQ|US|NYSE|NASDAQ|AMEX|NMS|NYQ)$',
      '',
      'g'
    ) AS display_symbol,
    NULLIF(COALESCE(mq.payload->>'name', ''), '') AS name,
    NULL::text AS exchange,
    NULLIF(COALESCE(mq.payload->>'imageUrl', mq.payload->>'logoUrl', ''), '') AS logo_url,
    jsonb_build_object('source', 'market_quotes') AS payload,
    COALESCE(mq.updated_at, mq.fetched_at, now()) AS updated_at
  FROM market_quotes mq
  WHERE COALESCE(mq.symbol, mq.display_symbol, mq.krx_symbol, '') <> ''

  UNION ALL

  SELECT
    CASE
      WHEN lower(COALESCE(d.market, '')) = 'kr' THEN 'kr:' || regexp_replace(COALESCE(d.symbol, ''), '\.(KS|KQ)$', '', 'g')
      ELSE 'global:' || regexp_replace(COALESCE(d.symbol, ''), '\.(US|NYSE|NASDAQ|AMEX|NMS|NYQ)$', '', 'g')
    END AS symbol_key,
    CASE
      WHEN lower(COALESCE(d.market, '')) = 'kr' THEN 'kr'
      ELSE 'global'
    END AS market,
    regexp_replace(COALESCE(d.symbol, ''), '\.(KS|KQ|US|NYSE|NASDAQ|AMEX|NMS|NYQ)$', '', 'g') AS symbol,
    regexp_replace(COALESCE(d.symbol, ''), '\.(KS|KQ|US|NYSE|NASDAQ|AMEX|NMS|NYQ)$', '', 'g') AS display_symbol,
    NULLIF(COALESCE(d.company_name, d.payload->>'companyName', ''), '') AS name,
    NULL::text AS exchange,
    NULL::text AS logo_url,
    jsonb_build_object('source', 'disclosures') AS payload,
    COALESCE(d.updated_at, d.filed_at, now()) AS updated_at
  FROM disclosures d
  WHERE COALESCE(d.symbol, '') <> ''
) seeded
WHERE COALESCE(symbol, '') <> ''
ORDER BY symbol_key, updated_at DESC;
