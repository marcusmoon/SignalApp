CREATE TABLE IF NOT EXISTS news_digest_items (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  category text,
  digest_date date,
  generated_at timestamptz,
  score numeric,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_digest_items_category_date_score
  ON news_digest_items(category, digest_date DESC, score DESC, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_digest_items_generated_score
  ON news_digest_items(generated_at DESC, score DESC);

WITH row AS (
  SELECT $json$
  {
    "jobKey": "news_digest_brief",
    "displayName": "뉴스 주요 이슈 생성",
    "description": "최근 뉴스 흐름을 묶어 앱 뉴스 상단 주요 이슈로 저장합니다.",
    "domain": "news",
    "operation": "digest",
    "provider": "signal",
    "handler": "news_digest",
    "enabled": true,
    "intervalSeconds": 900,
    "lockTtlSeconds": 300,
    "staleLockSeconds": 300,
    "params": {
      "hoursBack": 24,
      "sourceLimit": 180,
      "maxItemsPerCategory": 6,
      "categories": ["global", "crypto"]
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-14T00:00:00.000Z"
  }
  $json$::jsonb AS payload
)
INSERT INTO polling_jobs (job_key, position, enabled, domain, operation, provider, handler, next_run_at, last_run_at, payload, updated_at)
SELECT
  payload->>'jobKey',
  860,
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
