-- Korea news: Maeil Business RSS + DART filings, app korea category feed.

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "id": "mk_economy",
    "name": "매일경제 경제",
    "providerId": "mk",
    "sourceName": "매일경제",
    "feedUrl": "https://www.mk.co.kr/rss/30100041/",
    "category": "korea",
    "enabled": true,
    "hidden": false,
    "order": 4,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-06-19T00:00:00.000Z"
  },
  {
    "id": "mk_securities",
    "name": "매일경제 증권",
    "providerId": "mk",
    "sourceName": "매일경제",
    "feedUrl": "https://www.mk.co.kr/rss/50200011/",
    "category": "korea",
    "enabled": true,
    "hidden": false,
    "order": 5,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-06-19T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO rss_sources (source_id, position, provider_id, source_name, category, enabled, hidden, payload, updated_at)
SELECT
  payload->>'id',
  900 + position - 1,
  payload->>'providerId',
  payload->>'sourceName',
  payload->>'category',
  COALESCE((payload->>'enabled')::boolean, true),
  COALESCE((payload->>'hidden')::boolean, false),
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM rows
ON CONFLICT (source_id) DO UPDATE SET
  provider_id = excluded.provider_id,
  source_name = excluded.source_name,
  category = excluded.category,
  enabled = excluded.enabled,
  hidden = excluded.hidden,
  payload = excluded.payload,
  updated_at = excluded.updated_at;

INSERT INTO provider_settings (provider, position, enabled, payload, updated_at)
VALUES (
  'dart',
  900,
  true,
  $json${"provider":"dart","enabled":true,"apiKey":"","updatedAt":"2026-06-19T00:00:00.000Z"}$json$::jsonb,
  '2026-06-19T00:00:00.000Z'::timestamptz
)
ON CONFLICT (provider) DO NOTHING;

WITH row AS (
  SELECT $json$
  {
    "key": "korea_watchlist",
    "displayName": "국내 관심종목",
    "description": "DART 공시 수집 Job에서 조회할 KRX 6자리 종목 목록입니다.",
    "symbols": [
      "005930",
      "000660",
      "402340",
      "005380",
      "009150",
      "373220",
      "032830",
      "028260",
      "329180",
      "105560",
      "012330",
      "000270",
      "207940",
      "034020",
      "012450",
      "055550",
      "066570",
      "006400",
      "034730",
      "035420"
    ],
    "updatedAt": "2026-06-19T00:00:00.000Z"
  }
  $json$::jsonb AS payload
)
INSERT INTO market_lists (list_key, position, payload, updated_at)
SELECT payload->>'key', 900, payload, COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM row
ON CONFLICT (list_key) DO UPDATE SET
  payload = excluded.payload,
  updated_at = excluded.updated_at;

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "market_news_mk_rss",
    "displayName": "매일경제 RSS 수집·보정",
    "description": "매일경제 경제·증권 RSS를 수집한 뒤 같은 실행에서 항목을 다시 읽어 보정합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "sync",
    "provider": "rss",
    "handler": "newswire_rss",
    "enabled": true,
    "intervalSeconds": 900,
    "params": {
      "rssSourceIds": ["mk_economy", "mk_securities"],
      "limit": 40,
      "daysBack": 3,
      "reconcile": {
        "limit": 60
      }
    },
    "updatedAt": "2026-06-19T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_dart_filings",
    "displayName": "DART 공시 수집",
    "description": "국내 관심종목의 DART 주요 공시를 뉴스 촉매로 저장합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "latest",
    "provider": "dart",
    "handler": "company_filings",
    "enabled": true,
    "intervalSeconds": 3600,
    "params": {
      "listKey": "korea_watchlist",
      "pblntfTy": ["B", "C", "D", "I"],
      "daysBack": 14,
      "limitPerSymbol": 8,
      "requestDelayMs": 200
    },
    "updatedAt": "2026-06-19T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO polling_jobs (job_key, position, enabled, area, stage, domain, operation, provider, handler, next_run_at, last_run_at, payload, updated_at)
SELECT
  payload->>'jobKey',
  900 + position - 1,
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
FROM rows
ON CONFLICT (job_key) DO UPDATE SET
  enabled = excluded.enabled,
  area = excluded.area,
  stage = excluded.stage,
  domain = excluded.domain,
  operation = excluded.operation,
  provider = excluded.provider,
  handler = excluded.handler,
  payload = polling_jobs.payload || excluded.payload,
  updated_at = excluded.updated_at;

UPDATE polling_jobs
SET payload = jsonb_set(
  COALESCE(payload, '{}'::jsonb),
  '{params,categories}',
  '["global", "crypto", "korea"]'::jsonb,
  true
),
updated_at = now()
WHERE job_key = 'news_digest_brief';
