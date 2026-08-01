-- Home 시세 major indices (Yahoo caret tickers) + polling Job.

WITH list_rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "key": "home_indices",
    "displayName": "홈 지수",
    "description": "홈 시세 상단 지수 스트립. Yahoo caret 심볼(^GSPC 등).",
    "symbols": ["^GSPC", "^NDX", "^DJI", "^SOX", "^KS11", "^N225"],
    "updatedAt": "2026-08-01T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO market_lists (list_key, position, payload, updated_at)
SELECT
  payload->>'key',
  800 + position - 1,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM list_rows
ON CONFLICT (list_key) DO NOTHING;

WITH job_rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "market_quotes_indices",
    "displayName": "홈 지수 시세",
    "description": "home_indices Yahoo 지수를 조회해 market_quotes에 저장합니다(홈 시세 스트립).",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "yahoo",
    "handler": "market_quotes_indices",
    "enabled": true,
    "intervalSeconds": 300,
    "params": {
      "segment": "indices",
      "listKey": "home_indices"
    },
    "updatedAt": "2026-08-01T00:00:00.000Z"
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
  910 + position - 1,
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
FROM job_rows
ON CONFLICT (job_key) DO NOTHING;
