-- Board: Motley Fool Discourse investing boards (Stocks A to Z + Analysis Clubs).

WITH job_rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "community_motley_fool_investing",
    "displayName": "모틀리 투자 보드",
    "description": "Motley Fool Community — Stocks A to Z · Investment Analysis Clubs 최신 토론을 수집합니다.",
    "area": "community",
    "stage": "ingest",
    "domain": "community",
    "operation": "sync",
    "provider": "motley_fool",
    "handler": "investing_boards",
    "enabled": true,
    "intervalSeconds": 1800,
    "params": {
      "pageSize": 30
    },
    "updatedAt": "2026-08-17T00:00:00.000Z"
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
  941 + position - 1,
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
