-- Screener: shared per-market pool (snapshot) + multi-method curation runs.
-- Markets: kr | global. Methods: e.g. fujimoto (more later). All methods read the same pool.

CREATE TABLE screener_snapshots (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  market text NOT NULL DEFAULT 'kr',
  generated_date date,
  as_of timestamptz,
  published_at timestamptz,
  updated_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX screener_snapshots_market_as_of_idx
  ON screener_snapshots (market, as_of DESC NULLS LAST, published_at DESC NULLS LAST);

CREATE TABLE screener_runs (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  market text NOT NULL DEFAULT 'kr',
  method text NOT NULL DEFAULT 'fujimoto',
  status text NOT NULL DEFAULT 'published',
  pool_snapshot_id text,
  generated_date date,
  published_at timestamptz,
  updated_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX screener_runs_market_method_date_idx
  ON screener_runs (market, method, generated_date DESC NULLS LAST, published_at DESC NULLS LAST);

CREATE INDEX screener_runs_status_idx
  ON screener_runs (status, market, method);

-- Idempotency: one curation row per (market, method, pool snapshot).
CREATE UNIQUE INDEX screener_runs_market_method_pool_uidx
  ON screener_runs (market, method, pool_snapshot_id)
  WHERE pool_snapshot_id IS NOT NULL AND pool_snapshot_id <> '';

-- KR pool snapshot Job.
-- Skill screens weekdays ~08:00 KST — keep this job fresh beforehand (hourly; ops may force 07:xx KST).
WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "screener_pool_kr",
    "displayName": "스크리너 풀 · 한국",
    "description": "한국 스크리너 공용 종목풀(시세·RSI·turnover). 스킬 08:00 KST 이전 갱신 권장. asOf는 job 시각(UTC).",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "signal",
    "handler": "screener_pool_snapshot",
    "enabled": true,
    "intervalSeconds": 3600,
    "params": {
      "market": "kr",
      "preferredBeforeKst": "08:00",
      "staleAfterHours": 24
    },
    "updatedAt": "2026-07-26T00:00:00.000Z"
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
  2100 + position - 1,
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
