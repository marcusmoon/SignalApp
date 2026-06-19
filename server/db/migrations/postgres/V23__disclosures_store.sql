-- Corporate disclosures are first-party source documents, not news.
CREATE TABLE IF NOT EXISTS disclosures (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  market text,
  provider text,
  symbol text,
  company_name text,
  form_type text,
  filed_at timestamptz,
  period_end_date date,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disclosures_filed
  ON disclosures (filed_at DESC, position ASC);
CREATE INDEX IF NOT EXISTS idx_disclosures_market_filed
  ON disclosures (market, filed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosures_symbol_filed
  ON disclosures (symbol, filed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosures_provider_filed
  ON disclosures (provider, filed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosures_form_filed
  ON disclosures (form_type, filed_at DESC);

INSERT INTO disclosures (
  id,
  position,
  market,
  provider,
  symbol,
  company_name,
  form_type,
  filed_at,
  period_end_date,
  payload,
  updated_at
)
SELECT
  n.id,
  n.position,
  CASE
    WHEN n.provider = 'dart' OR n.category = 'korea' THEN 'kr'
    ELSE 'us'
  END AS market,
  CASE
    WHEN n.provider = 'sec_edgar' THEN 'sec'
    ELSE n.provider
  END AS provider,
  COALESCE(n.payload->>'symbol', n.payload->'symbols'->>0) AS symbol,
  COALESCE(
    n.payload->>'companyName',
    n.payload->'rawPayload'->>'companyName',
    n.payload->'rawPayload'->>'corpName'
  ) AS company_name,
  COALESCE(
    n.payload->>'formType',
    n.payload->'rawPayload'->>'form',
    n.payload->'rawPayload'->>'report_nm'
  ) AS form_type,
  n.published_at AS filed_at,
  NULLIF(n.payload->'rawPayload'->>'reportDate', '')::date AS period_end_date,
  jsonb_strip_nulls(
    n.payload ||
    jsonb_build_object(
      'market', CASE WHEN n.provider = 'dart' OR n.category = 'korea' THEN 'kr' ELSE 'us' END,
      'provider', CASE WHEN n.provider = 'sec_edgar' THEN 'sec' ELSE n.provider END,
      'symbol', COALESCE(n.payload->>'symbol', n.payload->'symbols'->>0),
      'companyName', COALESCE(
        n.payload->>'companyName',
        n.payload->'rawPayload'->>'companyName',
        n.payload->'rawPayload'->>'corpName'
      ),
      'formType', COALESCE(
        n.payload->>'formType',
        n.payload->'rawPayload'->>'form',
        n.payload->'rawPayload'->>'report_nm'
      ),
      'title', COALESCE(n.payload->>'titleOriginal', n.payload->>'title'),
      'summary', COALESCE(n.payload->>'summaryOriginal', n.payload->>'summary'),
      'url', COALESCE(n.payload->>'sourceUrl', n.payload->>'url'),
      'filedAt', n.published_at
    )
  ) AS payload,
  n.updated_at
FROM news_items n
WHERE n.provider IN ('sec_edgar', 'dart')
ON CONFLICT (id) DO UPDATE SET
  position = EXCLUDED.position,
  market = EXCLUDED.market,
  provider = EXCLUDED.provider,
  symbol = EXCLUDED.symbol,
  company_name = EXCLUDED.company_name,
  form_type = EXCLUDED.form_type,
  filed_at = EXCLUDED.filed_at,
  period_end_date = EXCLUDED.period_end_date,
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at;

DELETE FROM news_translations
WHERE news_item_id IN (
  SELECT id FROM news_items WHERE provider IN ('sec_edgar', 'dart')
);

DELETE FROM news_items
WHERE provider IN ('sec_edgar', 'dart');

UPDATE polling_jobs
SET
  area = 'disclosures',
  stage = 'ingest',
  domain = 'disclosures',
  operation = 'latest',
  payload = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          payload,
          '{domain}',
          '"disclosures"'::jsonb,
          true
        ),
        '{area}',
        '"disclosures"'::jsonb,
        true
      ),
      '{description}',
      to_jsonb(replace(COALESCE(payload->>'description', ''), '뉴스 촉매로 저장', '공시 자료로 저장')),
      true
    ),
    '{updatedAt}',
    to_jsonb('2026-06-20T00:00:00.000Z'::text),
    true
  ),
  updated_at = '2026-06-20T00:00:00.000Z'::timestamptz
WHERE job_key IN ('market_news_sec_edgar_filings', 'market_news_dart_filings');

UPDATE news_sources
SET hidden = true,
    enabled = false,
    payload = jsonb_set(
      jsonb_set(payload, '{hidden}', 'true'::jsonb, true),
      '{enabled}', 'false'::jsonb,
      true
    ),
    updated_at = '2026-06-20T00:00:00.000Z'::timestamptz
WHERE source_id IN ('SEC EDGAR', 'DART')
   OR name IN ('SEC EDGAR', 'DART')
   OR source_key ILIKE 'sec edgar|%'
   OR source_key ILIKE 'dart|%';
