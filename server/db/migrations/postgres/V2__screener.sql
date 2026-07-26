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
  generated_date date,
  published_at timestamptz,
  updated_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX screener_runs_market_method_date_idx
  ON screener_runs (market, method, generated_date DESC NULLS LAST, published_at DESC NULLS LAST);

-- KR pool snapshot Job (global Job can be added later with market=global).
WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "screener_pool_kr",
    "displayName": "스크리너 풀 · 한국",
    "description": "한국 스크리너 공용 종목풀 스냅샷(시세·RSI 등). 여러 method가 동일 풀을 읽습니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "signal",
    "handler": "screener_pool_snapshot",
    "enabled": true,
    "intervalSeconds": 3600,
    "params": {
      "market": "kr"
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
