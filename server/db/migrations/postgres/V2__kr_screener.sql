-- Korea stock screener: Job snapshots + Fujimoto-style curation runs (external ingest).

CREATE TABLE kr_screener_snapshots (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  generated_date date,
  as_of timestamptz,
  published_at timestamptz,
  updated_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX kr_screener_snapshots_date_idx
  ON kr_screener_snapshots (generated_date DESC, as_of DESC);

CREATE TABLE kr_screener_runs (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  preset text NOT NULL DEFAULT 'fujimoto',
  generated_date date,
  published_at timestamptz,
  updated_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX kr_screener_runs_preset_date_idx
  ON kr_screener_runs (preset, generated_date DESC, published_at DESC);

-- Snapshot Job: build universe/metrics from korea quotes + price_series RSI.
WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "kr_screener_snapshot",
    "displayName": "한국주 스크리너 스냅샷",
    "description": "코스피/코스닥 유니버스·시세·RSI 스냅샷을 적재합니다. PER/PBR·실적은 quote payload에 있을 때만 채웁니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "signal",
    "handler": "kr_screener_snapshot",
    "enabled": true,
    "intervalSeconds": 3600,
    "params": {},
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
