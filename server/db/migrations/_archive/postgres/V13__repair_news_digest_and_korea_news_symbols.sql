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
  payload = polling_jobs.payload
    || jsonb_build_object(
      'domain', excluded.payload->>'domain',
      'operation', excluded.payload->>'operation',
      'provider', excluded.payload->>'provider',
      'handler', excluded.payload->>'handler'
    ),
  updated_at = now();

WITH aliases(symbol, terms) AS (
  VALUES
    ('005930', ARRAY['005930','삼성전자','samsung electronics','samsung elec']),
    ('000660', ARRAY['000660','sk하이닉스','sk hynix']),
    ('402340', ARRAY['402340','sk스퀘어','sk square']),
    ('005380', ARRAY['005380','현대차','현대자동차','hyundai motor']),
    ('009150', ARRAY['009150','삼성전기','samsung electro']),
    ('373220', ARRAY['373220','lg에너지솔루션','lg energy solution','lg energy']),
    ('032830', ARRAY['032830','삼성생명','samsung life']),
    ('028260', ARRAY['028260','삼성물산','samsung c&t']),
    ('329180', ARRAY['329180','hd현대중공업','hd hhi']),
    ('105560', ARRAY['105560','kb금융','kb financial']),
    ('012330', ARRAY['012330','현대모비스','hyundai mobis']),
    ('000270', ARRAY['000270','기아','kia']),
    ('207940', ARRAY['207940','삼성바이오로직스','samsung biologics']),
    ('034020', ARRAY['034020','두산에너빌리티','doosan enerbility']),
    ('012450', ARRAY['012450','한화에어로스페이스','hanwha aerospace']),
    ('055550', ARRAY['055550','신한지주','shinhan financial']),
    ('066570', ARRAY['066570','lg전자','lg electronics']),
    ('006400', ARRAY['006400','삼성sdi','samsung sdi']),
    ('034730', ARRAY['034730','sk inc']),
    ('035420', ARRAY['035420','네이버','naver'])
),
matches AS (
  SELECT
    n.id,
    array_agg(DISTINCT a.symbol) AS symbols
  FROM news_items n
  JOIN aliases a ON EXISTS (
    SELECT 1
    FROM unnest(a.terms) AS term
    WHERE lower(
      COALESCE(n.payload->>'titleOriginal', '') || ' ' ||
      COALESCE(n.payload->>'summaryOriginal', '') || ' ' ||
      COALESCE(n.payload->>'title', '') || ' ' ||
      COALESCE(n.payload->>'summary', '')
    ) LIKE '%' || lower(term) || '%'
  )
  GROUP BY n.id
),
merged AS (
  SELECT
    n.id,
    (
      SELECT jsonb_agg(DISTINCT value)
      FROM (
        SELECT jsonb_array_elements_text(COALESCE(n.payload->'symbols', '[]'::jsonb)) AS value
        UNION ALL
        SELECT unnest(m.symbols) AS value
      ) s
      WHERE value IS NOT NULL AND trim(value) <> ''
    ) AS symbols
  FROM news_items n
  JOIN matches m ON m.id = n.id
)
UPDATE news_items n
SET
  payload = jsonb_set(n.payload, '{symbols}', COALESCE(m.symbols, '[]'::jsonb), true),
  updated_at = now()
FROM merged m
WHERE n.id = m.id
  AND COALESCE(n.payload->'symbols', '[]'::jsonb) IS DISTINCT FROM COALESCE(m.symbols, '[]'::jsonb);
