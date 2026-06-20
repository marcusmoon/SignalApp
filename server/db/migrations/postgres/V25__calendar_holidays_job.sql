-- Finnhub market holiday ingest job for investment calendar.

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "calendar_holidays",
    "displayName": "거래소 휴장일 수집",
    "description": "Finnhub에서 미국(US) 거래소 휴장일을 조회해 투자 캘린더에 저장합니다.",
    "area": "calendar",
    "stage": "ingest",
    "domain": "calendar",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_holidays",
    "enabled": true,
    "intervalSeconds": 86400,
    "lockTtlSeconds": 600,
    "staleLockSeconds": 600,
    "params": {
      "daysBack": 1,
      "daysAhead": 365,
      "exchanges": [
        { "exchange": "US", "country": "US" }
      ]
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-17T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO polling_jobs (job_key, position, enabled, domain, operation, provider, handler, next_run_at, last_run_at, payload, updated_at)
SELECT
  payload->>'jobKey',
  380 + position,
  COALESCE((payload->>'enabled')::boolean, false),
  payload->>'domain',
  payload->>'operation',
  payload->>'provider',
  payload->>'handler',
  NULLIF(payload->>'nextRunAt', '')::timestamptz,
  NULLIF(payload->>'lastRunAt', '')::timestamptz,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM rows
ON CONFLICT (job_key) DO UPDATE SET
  enabled = excluded.enabled,
  domain = excluded.domain,
  operation = excluded.operation,
  provider = excluded.provider,
  handler = excluded.handler,
  payload = polling_jobs.payload || excluded.payload,
  updated_at = excluded.updated_at;
