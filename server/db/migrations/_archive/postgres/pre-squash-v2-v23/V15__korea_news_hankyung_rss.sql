-- Korea news: add Hankyung (한국경제) economy/finance RSS to the domestic wire ingest job.

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "id": "hankyung_economy",
    "name": "한국경제 경제",
    "providerId": "hankyung",
    "sourceName": "한국경제",
    "feedUrl": "https://www.hankyung.com/feed/economy",
    "category": "korea",
    "enabled": true,
    "hidden": false,
    "order": 6,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-07-11T00:00:00.000Z"
  },
  {
    "id": "hankyung_finance",
    "name": "한국경제 증권",
    "providerId": "hankyung",
    "sourceName": "한국경제",
    "feedUrl": "https://www.hankyung.com/feed/finance",
    "category": "korea",
    "enabled": true,
    "hidden": false,
    "order": 7,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-07-11T00:00:00.000Z"
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

UPDATE polling_jobs
SET payload = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(payload, '{}'::jsonb),
      '{params,rssSourceIds}',
      '["mk_economy","mk_securities","hankyung_economy","hankyung_finance"]'::jsonb,
      true
    ),
    '{displayName}',
    '"국내 경제지 RSS 수집·보정"'::jsonb,
    true
  ),
  '{description}',
  '"매일경제·한국경제 경제·증권 RSS를 수집한 뒤 같은 실행에서 항목을 다시 읽어 보정합니다."'::jsonb,
  true
) || jsonb_build_object('updatedAt', '2026-07-11T00:00:00.000Z'),
updated_at = now()
WHERE job_key = 'market_news_mk_rss';
