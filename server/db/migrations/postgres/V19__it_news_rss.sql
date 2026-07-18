-- IT/tech news: seed a small RSS set (3 global + 2 KR) + dedicated ingest job (category = it).

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "id": "the_verge",
    "name": "The Verge",
    "providerId": "the_verge",
    "sourceName": "The Verge",
    "feedUrl": "https://www.theverge.com/rss/index.xml",
    "category": "it",
    "enabled": true,
    "hidden": false,
    "order": 1,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-07-17T00:00:00.000Z"
  },
  {
    "id": "techcrunch",
    "name": "TechCrunch",
    "providerId": "techcrunch",
    "sourceName": "TechCrunch",
    "feedUrl": "https://techcrunch.com/feed/",
    "category": "it",
    "enabled": true,
    "hidden": false,
    "order": 2,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-07-17T00:00:00.000Z"
  },
  {
    "id": "ars_technica",
    "name": "Ars Technica",
    "providerId": "ars_technica",
    "sourceName": "Ars Technica",
    "feedUrl": "https://feeds.arstechnica.com/arstechnica/index",
    "category": "it",
    "enabled": true,
    "hidden": false,
    "order": 3,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-07-17T00:00:00.000Z"
  },
  {
    "id": "digital_today",
    "name": "디지털투데이",
    "providerId": "digital_today",
    "sourceName": "디지털투데이",
    "feedUrl": "https://www.digitaltoday.co.kr/rss/allArticle.xml",
    "category": "it",
    "enabled": true,
    "hidden": false,
    "order": 4,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-07-17T00:00:00.000Z"
  },
  {
    "id": "byline_network",
    "name": "바이라인네트워크",
    "providerId": "byline_network",
    "sourceName": "바이라인네트워크",
    "feedUrl": "https://www.byline.network/feed/",
    "category": "it",
    "enabled": true,
    "hidden": false,
    "order": 5,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-07-17T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO rss_sources (source_id, position, provider_id, source_name, category, enabled, hidden, payload, updated_at)
SELECT
  payload->>'id',
  1900 + position - 1,
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

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "market_news_it_rss",
    "displayName": "IT 뉴스 RSS 수집·보정",
    "description": "The Verge·TechCrunch·Ars Technica·디지털투데이·바이라인네트워크 RSS를 수집한 뒤 같은 실행에서 항목을 다시 읽어 보정합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "sync",
    "provider": "rss",
    "handler": "newswire_rss",
    "enabled": true,
    "intervalSeconds": 900,
    "params": {
      "rssSourceIds": [
        "the_verge",
        "techcrunch",
        "ars_technica",
        "digital_today",
        "byline_network"
      ],
      "limit": 40,
      "daysBack": 3,
      "reconcile": {
        "limit": 60
      }
    },
    "updatedAt": "2026-07-17T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO polling_jobs (
  job_key, position, enabled, area, stage, domain, operation, provider, handler, next_run_at, last_run_at, payload, updated_at
)
SELECT
  payload->>'jobKey',
  1900 + position - 1,
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
  enabled = excluded.enabled,
  area = excluded.area,
  stage = excluded.stage,
  domain = excluded.domain,
  operation = excluded.operation,
  provider = excluded.provider,
  handler = excluded.handler,
  payload = excluded.payload,
  updated_at = excluded.updated_at;
