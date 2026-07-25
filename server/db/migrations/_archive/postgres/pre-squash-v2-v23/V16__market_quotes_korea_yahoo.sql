-- Domestic KRX quotes via Yahoo Finance (.KS then .KQ resolve).
-- App watchlist reads DB only; this Job fills market_quotes for korea_watchlist.

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "market_quotes_korea",
    "displayName": "국내 종목 시세",
    "description": "korea_watchlist의 KRX 6자리 종목을 Yahoo(.KS→.KQ)로 조회해 market_quotes에 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "yahoo",
    "handler": "market_quotes_kr",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "segment": "korea",
      "listKey": "korea_watchlist"
    },
    "updatedAt": "2026-07-16T00:00:00.000Z"
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
  900 + position - 1,
  COALESCE((payload->>'enabled')::boolean, false),
  payload->>'area',
  payload->>'stage',
  payload->>'domain',
  payload->>'operation',
  payload->>'provider',
  payload->>'handler',
  NULL,
  NULL,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM rows
ON CONFLICT (job_key) DO NOTHING;

UPDATE market_lists
SET
  payload = jsonb_set(
    COALESCE(payload, '{}'::jsonb),
    '{description}',
    to_jsonb('DART 공시·국내 시세(Yahoo) Job에서 쓰는 KRX 6자리 종목 목록입니다.'::text),
    true
  ),
  updated_at = NOW()
WHERE list_key = 'korea_watchlist';
