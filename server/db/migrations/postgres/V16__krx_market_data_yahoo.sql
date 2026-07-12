-- Korea (KRX) market data: Yahoo quote ingestion + daily bars for korea_watchlist.

UPDATE polling_jobs
SET payload = jsonb_set(
  COALESCE(payload, '{}'::jsonb),
  '{params,listKeys}',
  COALESCE(payload->'params'->'listKeys', '[]'::jsonb) || '"korea_watchlist"'::jsonb,
  true
) || jsonb_build_object('updatedAt', '2026-07-12T00:00:00.000Z'),
updated_at = now()
WHERE job_key = 'market_price_series_daily'
  AND NOT COALESCE(payload->'params'->'listKeys', '[]'::jsonb) ? 'korea_watchlist';

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "market_quotes_korea_watchlist",
    "displayName": "국내 관심종목 시세",
    "description": "korea_watchlist KRX 6자리 종목의 Yahoo Finance 시세를 저장합니다. Finnhub는 국장을 지원하지 않습니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "yahoo",
    "handler": "market_quotes",
    "enabled": true,
    "intervalSeconds": 300,
    "lockTtlSeconds": 300,
    "staleLockSeconds": 300,
    "params": {
      "segment": "watch",
      "listKey": "korea_watchlist"
    },
    "updatedAt": "2026-07-12T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO polling_jobs (
  job_key, position, enabled, area, stage, domain, operation, provider, handler,
  next_run_at, last_run_at, payload, updated_at
)
SELECT
  payload->>'jobKey',
  (SELECT COALESCE(MAX(position), -1) FROM polling_jobs) + position,
  COALESCE((payload->>'enabled')::boolean, false),
  payload->>'area',
  payload->>'stage',
  payload->>'domain',
  payload->>'operation',
  payload->>'provider',
  payload->>'handler',
  now(),
  NULL,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM rows
ON CONFLICT (job_key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  area = EXCLUDED.area,
  stage = EXCLUDED.stage,
  domain = EXCLUDED.domain,
  operation = EXCLUDED.operation,
  provider = EXCLUDED.provider,
  handler = EXCLUDED.handler,
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at;
