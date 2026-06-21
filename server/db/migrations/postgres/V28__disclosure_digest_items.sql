CREATE TABLE IF NOT EXISTS disclosure_digest_items (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  market text,
  digest_date date,
  generated_at timestamptz,
  score numeric,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disclosure_digest_market_date_score
  ON disclosure_digest_items(market, digest_date DESC, generated_at DESC, score DESC);

CREATE INDEX IF NOT EXISTS idx_disclosure_digest_generated
  ON disclosure_digest_items(generated_at DESC, score DESC);

WITH row AS (
  SELECT $json$
  {
    "jobKey": "disclosure_digest",
    "displayName": "공시 주요 이슈 생성",
    "description": "최근 공시 흐름을 묶어 앱 공시 상단 주요 이슈로 저장합니다.",
    "domain": "disclosures",
    "operation": "digest",
    "provider": "signal",
    "handler": "disclosure_digest",
    "enabled": true,
    "intervalSeconds": 3600,
    "lockTtlSeconds": 300,
    "staleLockSeconds": 300,
    "params": {
      "hoursBack": 24,
      "sourceLimit": 300,
      "maxItemsPerMarket": 8,
      "markets": ["us", "kr"]
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-21T00:00:00.000Z"
  }
  $json$::jsonb AS payload
)
INSERT INTO polling_jobs (job_key, position, enabled, domain, operation, provider, handler, next_run_at, last_run_at, payload, updated_at)
SELECT
  payload->>'jobKey',
  870,
  COALESCE((payload->>'enabled')::boolean, false),
  payload->>'domain',
  payload->>'operation',
  payload->>'provider',
  payload->>'handler',
  NULLIF(payload->>'nextRunAt', '')::timestamptz,
  NULLIF(payload->>'lastRunAt', '')::timestamptz,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM row
ON CONFLICT (job_key) DO UPDATE SET
  domain = excluded.domain,
  operation = excluded.operation,
  provider = excluded.provider,
  handler = excluded.handler,
  payload = polling_jobs.payload || excluded.payload,
  updated_at = excluded.updated_at;
