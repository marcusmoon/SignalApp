-- Community board posts aggregated from external sources (UTC timestamps).

CREATE TABLE community_posts (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  source text NOT NULL,
  provider text NOT NULL,
  provider_item_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  source_url text,
  published_at timestamptz,
  fetched_at timestamptz,
  updated_at timestamptz NOT NULL,
  UNIQUE (source, provider_item_id)
);

CREATE INDEX idx_community_posts_source_published
  ON community_posts (source, published_at DESC);

CREATE INDEX idx_community_posts_published
  ON community_posts (published_at DESC);

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "community_naver_likeusstock_free",
    "displayName": "미주미 자유게시판",
    "description": "네이버 카페 미주미(likeusstock) 자유게시판 글을 수집합니다.",
    "area": "community",
    "stage": "ingest",
    "domain": "community",
    "operation": "sync",
    "provider": "naver_cafe",
    "handler": "likeusstock_free",
    "enabled": true,
    "intervalSeconds": 1800,
    "params": {
      "pageSize": 30
    },
    "updatedAt": "2026-07-04T00:00:00.000Z"
  },
  {
    "jobKey": "community_save_user_news",
    "displayName": "세이브 유저뉴스",
    "description": "세이브(SAVE) 커뮤니티 유저뉴스 글을 수집합니다.",
    "area": "community",
    "stage": "ingest",
    "domain": "community",
    "operation": "sync",
    "provider": "save",
    "handler": "user_news",
    "enabled": true,
    "intervalSeconds": 1800,
    "params": {
      "pageSize": 30
    },
    "updatedAt": "2026-07-04T00:00:00.000Z"
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
  (SELECT COALESCE(MAX(position), -1) FROM polling_jobs) + position,
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
