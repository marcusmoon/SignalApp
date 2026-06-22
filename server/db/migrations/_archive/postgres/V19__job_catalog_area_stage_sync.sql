-- Job catalog: area/stage columns, merge latest+reconcile pairs into sync jobs, restore news digest.

ALTER TABLE polling_jobs
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS stage text;

CREATE INDEX IF NOT EXISTS idx_polling_jobs_area_stage ON polling_jobs(area, stage, position);

-- Remove merged reconcile-only rows (runs history kept).
DELETE FROM polling_job_locks
WHERE job_key IN (
  'market_news_global_reconcile',
  'market_news_crypto_reconcile',
  'market_news_financial_juice_reconcile',
  'calendar_economic_reconcile',
  'calendar_earnings_reconcile',
  'youtube_economy_reconcile'
);

DELETE FROM polling_jobs
WHERE job_key IN (
  'market_news_global_reconcile',
  'market_news_crypto_reconcile',
  'market_news_financial_juice_reconcile',
  'calendar_economic_reconcile',
  'calendar_earnings_reconcile',
  'youtube_economy_reconcile'
);

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "market_news_global",
    "displayName": "글로벌 뉴스 수집·보정",
    "description": "Finnhub 글로벌 시장 뉴스를 수집한 뒤 같은 실행에서 보정 구간을 다시 조회합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "sync",
    "provider": "finnhub",
    "handler": "market_news",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "category": "general",
      "reconcile": {}
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_news_crypto",
    "displayName": "크립토 뉴스 수집·보정",
    "description": "Finnhub 크립토 뉴스를 수집한 뒤 같은 실행에서 보정 구간을 다시 조회합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "sync",
    "provider": "finnhub",
    "handler": "market_news",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "category": "crypto",
      "reconcile": {}
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_news_financial_juice",
    "displayName": "Financial Juice (RSS) 수집·보정",
    "description": "Financial Juice RSS를 수집한 뒤 같은 실행에서 항목을 다시 읽어 보정합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "sync",
    "provider": "rss",
    "handler": "financial_juice",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "rssSourceId": "financial_juice",
      "limit": 40,
      "reconcile": {
        "limit": 60
      }
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_news_sec_edgar_filings",
    "displayName": "SEC EDGAR 공시 수집",
    "description": "관심종목의 SEC 주요 공시(8-K, 10-Q, 10-K 등)를 뉴스 촉매로 저장합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "latest",
    "provider": "sec",
    "handler": "company_filings",
    "enabled": false,
    "intervalSeconds": 3600,
    "params": {
      "listKey": "default_watchlist",
      "forms": ["8-K", "10-Q", "10-K", "S-1", "6-K", "20-F"],
      "daysBack": 14,
      "limitPerSymbol": 5,
      "requestDelayMs": 150
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_news_globenewswire_earnings",
    "displayName": "뉴스와이어 실적 RSS",
    "description": "등록된 실적/운영결과 RSS를 수집해 공식 보도자료 기반 뉴스로 저장합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "latest",
    "provider": "rss",
    "handler": "newswire_rss",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "rssSourceId": "globenewswire_earnings",
      "rssSourceIds": ["globenewswire_earnings", "prnewswire_earnings"],
      "limit": 40,
      "daysBack": 7,
      "includeKeywords": ["earnings", "results", "revenue", "guidance", "quarter"]
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "news_digest_brief",
    "displayName": "뉴스 주요 이슈 생성",
    "description": "최근 뉴스 흐름을 묶어 앱 뉴스 상단 주요 이슈로 저장합니다.",
    "area": "news",
    "stage": "enrich",
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
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "calendar_economic",
    "displayName": "경제지표 수집·보정",
    "description": "경제지표 일정을 수집한 뒤 넓은 구간으로 다시 조회해 actual/estimate 변경을 반영합니다.",
    "area": "calendar",
    "stage": "ingest",
    "domain": "calendar",
    "operation": "sync",
    "provider": "finnhub",
    "handler": "economic_calendar",
    "enabled": true,
    "intervalSeconds": 1800,
    "params": {
      "daysBack": 1,
      "daysAhead": 14,
      "reconcile": {
        "daysBack": 7,
        "daysAhead": 30
      }
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "calendar_earnings",
    "displayName": "실적 캘린더 수집·보정",
    "description": "실적 발표 일정을 수집한 뒤 넓은 구간으로 다시 조회해 EPS 변경을 반영합니다.",
    "area": "calendar",
    "stage": "ingest",
    "domain": "calendar",
    "operation": "sync",
    "provider": "finnhub",
    "handler": "earnings_calendar",
    "enabled": false,
    "intervalSeconds": 21600,
    "lockTtlSeconds": 600,
    "staleLockSeconds": 600,
    "params": {
      "daysBack": 3,
      "daysAhead": 30,
      "reconcile": {
        "daysBack": 14,
        "daysAhead": 45
      }
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "youtube_economy_latest",
    "displayName": "경제 유튜브 수집·보정",
    "description": "경제/시장 채널 최신 영상을 수집한 뒤 저장된 영상 메타를 다시 조회해 보정합니다.",
    "area": "youtube",
    "stage": "ingest",
    "domain": "youtube",
    "operation": "sync",
    "provider": "youtube",
    "handler": "youtube_economy",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "order": "date",
      "reconcile": {
        "limit": 80
      }
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "youtube_economy_popular",
    "displayName": "경제 유튜브 인기 수집",
    "description": "설정된 경제/시장 채널의 인기 영상을 조회수 기준으로 가져옵니다.",
    "area": "youtube",
    "stage": "ingest",
    "domain": "youtube",
    "operation": "popular",
    "provider": "youtube",
    "handler": "youtube_economy",
    "enabled": false,
    "intervalSeconds": 21600,
    "params": {
      "order": "viewCount"
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_popular",
    "displayName": "인기 종목 시세",
    "description": "인기 종목 리스트의 실시간 시세를 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_quotes",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "segment": "popular",
      "listKey": "popular_symbols"
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_watchlist",
    "displayName": "관심종목 시세",
    "description": "기본 관심종목 리스트의 실시간 시세를 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_quotes",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "segment": "watchlist",
      "listKey": "default_watchlist"
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_mcap_universe",
    "displayName": "시총 유니버스 갱신",
    "description": "시총 상위 종목 유니버스를 갱신해 시총 시세 Job의 기준 리스트로 사용합니다.",
    "area": "market",
    "stage": "maintain",
    "domain": "market",
    "operation": "reconcile",
    "provider": "finnhub",
    "handler": "market_quotes_mcap_universe",
    "enabled": false,
    "intervalSeconds": 86400,
    "params": {
      "sourceListKey": "mcap_universe",
      "targetListKey": "mcap_top_symbols"
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_mcap",
    "displayName": "시총 상위 시세",
    "description": "시총 상위 종목의 실시간 시세를 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_quotes_mcap",
    "enabled": false,
    "intervalSeconds": 900,
    "params": {
      "segment": "mcap",
      "listKey": "mcap_top_symbols"
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_coins_top",
    "displayName": "코인 시세 Top",
    "description": "CoinGecko 상위 코인 시세를 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "coingecko",
    "handler": "coin_markets",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "vsCurrency": "usd",
      "perPage": 50,
      "page": 1
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_price_series_daily",
    "displayName": "주식 일봉 추세 저장",
    "description": "인기·시총·기본 관심종목의 Yahoo 일봉 OHLCV를 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "yahoo",
    "handler": "daily_bars",
    "enabled": true,
    "intervalSeconds": 21600,
    "lockTtlSeconds": 900,
    "staleLockSeconds": 900,
    "params": {
      "range": "1y",
      "requestDelayMs": 120,
      "listKeys": ["popular_symbols", "mcap_top_symbols", "default_watchlist"]
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "insights_market_brief",
    "displayName": "시장 인사이트 생성",
    "description": "수집된 뉴스·유튜브·시세·캘린더를 묶어 앱 시그널과 푸시 후보를 생성합니다.",
    "area": "signal",
    "stage": "enrich",
    "domain": "insights",
    "operation": "digest",
    "provider": "signal",
    "handler": "market_insights",
    "enabled": true,
    "intervalSeconds": 1800,
    "lockTtlSeconds": 600,
    "staleLockSeconds": 600,
    "params": {
      "windowHours": 24,
      "dateMode": "today",
      "timeZone": "Asia/Seoul",
      "maxItems": 8,
      "minScore": 20,
      "llmProvider": "auto",
      "pushMinScore": 55
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO polling_jobs (
  job_key, position, enabled, domain, operation, provider, handler, area, stage, next_run_at, last_run_at, payload, updated_at
)
SELECT
  payload->>'jobKey',
  position - 1,
  COALESCE((payload->>'enabled')::boolean, false),
  payload->>'domain',
  payload->>'operation',
  payload->>'provider',
  payload->>'handler',
  payload->>'area',
  payload->>'stage',
  NULLIF(payload->>'nextRunAt', '')::timestamptz,
  NULLIF(payload->>'lastRunAt', '')::timestamptz,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM rows
ON CONFLICT (job_key) DO UPDATE SET
  enabled = polling_jobs.enabled,
  domain = excluded.domain,
  operation = excluded.operation,
  provider = excluded.provider,
  handler = excluded.handler,
  area = excluded.area,
  stage = excluded.stage,
  payload = polling_jobs.payload || excluded.payload,
  updated_at = excluded.updated_at;

-- Preserve operator-enabled flags for calendar economic (V18) over catalog default merge.
UPDATE polling_jobs
SET enabled = true, updated_at = now()
WHERE job_key = 'calendar_economic';
