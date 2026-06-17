-- Restore Finnhub earnings calendar polling jobs removed in V12.

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "calendar_earnings",
    "displayName": "실적 캘린더 최신 수집",
    "description": "오늘 이후 실적 발표 일정을 가져옵니다.",
    "domain": "calendar",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "earnings_calendar",
    "enabled": false,
    "intervalSeconds": 21600,
    "lockTtlSeconds": 600,
    "staleLockSeconds": 600,
    "params": {
      "daysBack": 3,
      "daysAhead": 30
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-17T00:00:00.000Z"
  },
  {
    "jobKey": "calendar_earnings_reconcile",
    "displayName": "실적 캘린더 보정 수집",
    "description": "실적 발표 전후 구간을 다시 조회해 일정과 실제 EPS 변경을 반영합니다.",
    "domain": "calendar",
    "operation": "reconcile",
    "provider": "finnhub",
    "handler": "earnings_calendar",
    "enabled": false,
    "intervalSeconds": 43200,
    "lockTtlSeconds": 900,
    "staleLockSeconds": 900,
    "params": {
      "daysBack": 14,
      "daysAhead": 45
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
  370 + position,
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
  domain = excluded.domain,
  operation = excluded.operation,
  provider = excluded.provider,
  handler = excluded.handler,
  payload = polling_jobs.payload || excluded.payload,
  updated_at = excluded.updated_at;
