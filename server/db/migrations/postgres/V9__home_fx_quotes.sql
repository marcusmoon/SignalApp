-- Home 환율 (Yahoo FX pairs) + polling Job.

WITH list_rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "key": "home_fx",
    "displayName": "홈 환율",
    "description": "홈 시세 다음 환율 스트립. Yahoo FX 심볼(USDKRW=X, JPYKRW=X).",
    "symbols": ["USDKRW=X", "JPYKRW=X"],
    "updatedAt": "2026-08-01T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO market_lists (list_key, position, payload, updated_at)
SELECT
  payload->>'key',
  810 + position - 1,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM list_rows
ON CONFLICT (list_key) DO NOTHING;

WITH job_rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "market_quotes_fx",
    "displayName": "홈 환율 시세",
    "description": "home_fx Yahoo 환율을 조회해 market_quotes에 저장합니다(홈 환율 섹션).",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "yahoo",
    "handler": "market_quotes_fx",
    "enabled": true,
    "intervalSeconds": 300,
    "params": {
      "segment": "fx",
      "listKey": "home_fx"
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
  912 + position - 1,
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
