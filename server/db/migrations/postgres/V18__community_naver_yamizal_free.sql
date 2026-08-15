-- Board: Naver Cafe yamizal (미국주식에 미치다) free board ingest job.

WITH job_rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "community_naver_yamizal_free",
    "displayName": "미치다 자유게시판",
    "description": "네이버 카페 미국주식에 미치다(yamizal) 자유게시판 글을 수집합니다.",
    "area": "community",
    "stage": "ingest",
    "domain": "community",
    "operation": "sync",
    "provider": "naver_cafe",
    "handler": "yamizal_free",
    "enabled": true,
    "intervalSeconds": 1800,
    "params": {
      "pageSize": 30
    },
    "updatedAt": "2026-08-15T00:00:00.000Z"
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
  940 + position - 1,
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
