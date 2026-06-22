-- SIGNAL default runtime data seed.
-- Apply with Flyway after V1 schema. Provider secrets are intentionally blank.

INSERT INTO signal_meta (name, payload, updated_at) VALUES ('db', $json$
{
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-07T00:00:00.000Z",
  "schemaVersion": 1,
  "rssSourcesCatalogVersion": 1
}$json$::jsonb, '2026-06-07T00:00:00.000Z') ON CONFLICT (name) DO NOTHING;
INSERT INTO app_settings (id, payload, updated_at) VALUES ('app', $json$
{
  "marketQuotesMaxAgeSec": 10,
  "youtubeCurationHandles": [
    "futuresnow",
    "LikeUSStock",
    "t3chfeed",
    "unrealtech",
    "lucky_tv"
  ],
  "updatedAt": "2026-06-07T00:00:00.000Z"
}$json$::jsonb, '2026-06-07T00:00:00.000Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO ui_model_presets (id, payload, updated_at) VALUES ('default', $json$
{
  "openai": [
    "gpt-4o-mini"
  ],
  "claude": [
    "claude-3-5-haiku-latest"
  ],
  "mock": [
    "mock-news-v1"
  ],
  "updatedAt": "2026-06-07T00:00:00.000Z"
}$json$::jsonb, '2026-06-07T00:00:00.000Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO news_source_settings (id, payload, updated_at) VALUES ('default', $json$
{
  "autoEnableNewSources": {
    "global": true,
    "crypto": true
  },
  "aliases": {
    "global": {},
    "crypto": {}
  },
  "updatedAt": "2026-06-07T00:00:00.000Z"
}$json$::jsonb, '2026-06-07T00:00:00.000Z') ON CONFLICT (id) DO NOTHING;

WITH rows AS (SELECT value AS payload, ordinality::int AS position FROM jsonb_array_elements($json$
[
  {
    "provider": "finnhub",
    "enabled": true,
    "apiKey": "",
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "provider": "openai",
    "enabled": true,
    "apiKey": "",
    "defaultModel": "gpt-4o-mini",
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "provider": "claude",
    "enabled": true,
    "apiKey": "",
    "defaultModel": "claude-3-5-haiku-latest",
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "provider": "youtube",
    "enabled": true,
    "apiKey": "",
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "provider": "ninjas",
    "enabled": true,
    "apiKey": "",
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "provider": "coingecko",
    "enabled": true,
    "apiKey": "",
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "provider": "sec",
    "enabled": true,
    "apiKey": "",
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "provider": "rss",
    "enabled": true,
    "apiKey": "",
    "updatedAt": "2026-06-07T00:00:00.000Z"
  }
]$json$::jsonb) WITH ORDINALITY)
INSERT INTO provider_settings (provider, position, enabled, payload, updated_at)
SELECT payload->>'provider', position - 1, COALESCE((payload->>'enabled')::boolean, true), payload, COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz) FROM rows
ON CONFLICT (provider) DO NOTHING;

WITH rows AS (SELECT value AS payload, ordinality::int AS position FROM jsonb_array_elements($json$
[
  {
    "locale": "ko",
    "provider": "mock",
    "enabled": true,
    "autoTranslateNews": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "locale": "ja",
    "provider": "mock",
    "enabled": false,
    "autoTranslateNews": false,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  }
]$json$::jsonb) WITH ORDINALITY)
INSERT INTO translation_settings (locale, position, provider, enabled, payload, updated_at)
SELECT payload->>'locale', position - 1, payload->>'provider', COALESCE((payload->>'enabled')::boolean, true), payload, COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz) FROM rows
ON CONFLICT (locale) DO NOTHING;

WITH rows AS (SELECT value AS payload, ordinality::int AS position FROM jsonb_array_elements($json$
[
  {
    "id": "financial_juice",
    "name": "Financial Juice",
    "providerId": "financial_juice",
    "sourceName": "Financial Juice",
    "feedUrl": "https://www.financialjuice.com/feed.ashx?xy=rss",
    "category": "global",
    "enabled": true,
    "hidden": false,
    "order": 1,
    "defaultLimit": 40,
    "daysBack": 0,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "id": "globenewswire_earnings",
    "name": "GlobeNewswire 실적",
    "providerId": "globenewswire",
    "sourceName": "GlobeNewswire",
    "feedUrl": "https://www.globenewswire.com/RssFeed/subjectcode/13-Earnings%20Releases%20and%20Operating%20Results/feedTitle/GlobeNewswire%20-%20Earnings%20Releases%20and%20Operating%20Results",
    "category": "earnings",
    "enabled": true,
    "hidden": false,
    "order": 2,
    "defaultLimit": 40,
    "daysBack": 7,
    "includeKeywords": [
      "earnings",
      "results",
      "revenue",
      "guidance",
      "quarter"
    ],
    "excludeKeywords": [],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "id": "prnewswire_earnings",
    "name": "PR Newswire 실적",
    "providerId": "prnewswire",
    "sourceName": "PR Newswire",
    "feedUrl": "https://www.prnewswire.com/rss/news-releases-list.rss",
    "category": "earnings",
    "enabled": true,
    "hidden": false,
    "order": 3,
    "defaultLimit": 40,
    "daysBack": 7,
    "includeKeywords": [
      "earnings",
      "results",
      "revenue",
      "guidance",
      "quarter"
    ],
    "excludeKeywords": [],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  }
]$json$::jsonb) WITH ORDINALITY)
INSERT INTO rss_sources (source_id, position, provider_id, source_name, category, enabled, hidden, payload, updated_at)
SELECT payload->>'id', position - 1, payload->>'providerId', payload->>'sourceName', payload->>'category', COALESCE((payload->>'enabled')::boolean, true), COALESCE((payload->>'hidden')::boolean, false), payload, COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz) FROM rows
ON CONFLICT (source_id) DO NOTHING;

WITH rows AS (SELECT value AS payload, ordinality::int AS position FROM jsonb_array_elements($json$
[
  {
    "jobKey": "market_news_global",
    "displayName": "글로벌 뉴스 최신 수집",
    "description": "Finnhub 글로벌 시장 뉴스 최신 목록을 가져옵니다.",
    "domain": "news",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_news",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "category": "general"
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_crypto",
    "displayName": "크립토 뉴스 최신 수집",
    "description": "Finnhub 크립토 뉴스 최신 목록을 가져옵니다.",
    "domain": "news",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_news",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "category": "crypto"
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_global_reconcile",
    "displayName": "글로벌 뉴스 보정 수집",
    "description": "Finnhub 글로벌 시장 뉴스를 다시 조회해 수정된 제목/요약/소스 정보를 반영합니다.",
    "domain": "news",
    "operation": "reconcile",
    "provider": "finnhub",
    "handler": "market_news",
    "enabled": false,
    "intervalSeconds": 3600,
    "params": {
      "category": "general"
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_crypto_reconcile",
    "displayName": "크립토 뉴스 보정 수집",
    "description": "Finnhub 크립토 뉴스를 다시 조회해 수정된 제목/요약/소스 정보를 반영합니다.",
    "domain": "news",
    "operation": "reconcile",
    "provider": "finnhub",
    "handler": "market_news",
    "enabled": false,
    "intervalSeconds": 3600,
    "params": {
      "category": "crypto"
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_financial_juice",
    "displayName": "Financial Juice (RSS)",
    "description": "Financial Juice 공개 RSS(지연 헤드라인)를 수집해 뉴스 DB에 저장합니다.",
    "domain": "news",
    "operation": "latest",
    "provider": "rss",
    "handler": "financial_juice",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "rssSourceId": "financial_juice",
      "limit": 40
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_financial_juice_reconcile",
    "displayName": "Financial Juice (RSS) 보정",
    "description": "RSS 항목을 다시 읽어 제목·요약·링크 변경을 반영합니다.",
    "domain": "news",
    "operation": "reconcile",
    "provider": "rss",
    "handler": "financial_juice",
    "enabled": false,
    "intervalSeconds": 3600,
    "params": {
      "rssSourceId": "financial_juice",
      "limit": 60
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_sec_edgar_filings",
    "displayName": "SEC EDGAR 공시 수집",
    "description": "관심종목의 SEC 주요 공시(8-K, 10-Q, 10-K 등)를 뉴스 촉매로 저장합니다.",
    "domain": "news",
    "operation": "latest",
    "provider": "sec",
    "handler": "company_filings",
    "enabled": false,
    "intervalSeconds": 3600,
    "params": {
      "listKey": "default_watchlist",
      "forms": [
        "8-K",
        "10-Q",
        "10-K",
        "S-1",
        "6-K",
        "20-F"
      ],
      "daysBack": 14,
      "limitPerSymbol": 5,
      "requestDelayMs": 150
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_globenewswire_earnings",
    "displayName": "뉴스와이어 실적 RSS",
    "description": "등록된 실적/운영결과 RSS를 수집해 공식 보도자료 기반 뉴스로 저장합니다.",
    "domain": "news",
    "operation": "latest",
    "provider": "rss",
    "handler": "newswire_rss",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "rssSourceId": "globenewswire_earnings",
      "rssSourceIds": [
        "globenewswire_earnings",
        "prnewswire_earnings"
      ],
      "limit": 40,
      "daysBack": 7,
      "includeKeywords": [
        "earnings",
        "results",
        "revenue",
        "guidance",
        "quarter"
      ]
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "calendar_economic",
    "displayName": "경제지표 최신 수집",
    "description": "오늘 이후 경제지표 일정을 가져옵니다.",
    "domain": "calendar",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "economic_calendar",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "daysBack": 1,
      "daysAhead": 14
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "calendar_earnings",
    "displayName": "실적 캘린더 최신 수집",
    "description": "오늘 이후 실적 발표 일정을 가져옵니다.",
    "domain": "calendar",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "earnings_calendar",
    "enabled": false,
    "intervalSeconds": 21600,
    "params": {
      "daysBack": 3,
      "daysAhead": 30
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "concall_transcripts_recent",
    "displayName": "컨콜 트랜스크립트 최신 수집",
    "description": "최근 실적 캘린더의 컨콜 트랜스크립트를 API Ninjas에서 가져옵니다.",
    "domain": "concalls",
    "operation": "latest",
    "provider": "ninjas",
    "handler": "earning_transcripts",
    "enabled": false,
    "intervalSeconds": 21600,
    "params": {
      "daysBack": 45,
      "daysAhead": 2,
      "limit": 25,
      "listKey": "mcap_universe",
      "fallbackLatest": true
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "youtube_economy_latest",
    "displayName": "경제 유튜브 최신 수집",
    "description": "설정된 경제/시장 채널의 최신 영상을 가져옵니다.",
    "domain": "youtube",
    "operation": "latest",
    "provider": "youtube",
    "handler": "youtube_economy",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "order": "date"
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "youtube_economy_popular",
    "displayName": "경제 유튜브 인기 수집",
    "description": "설정된 경제/시장 채널의 인기 영상을 조회수 기준으로 가져옵니다.",
    "domain": "youtube",
    "operation": "popular",
    "provider": "youtube",
    "handler": "youtube_economy",
    "enabled": false,
    "intervalSeconds": 21600,
    "params": {
      "order": "viewCount"
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "calendar_economic_reconcile",
    "displayName": "경제지표 보정 수집",
    "description": "최근 과거와 미래 구간을 다시 조회해 actual/estimate/previous 변경을 반영합니다.",
    "domain": "calendar",
    "operation": "reconcile",
    "provider": "finnhub",
    "handler": "economic_calendar",
    "enabled": false,
    "intervalSeconds": 21600,
    "params": {
      "daysBack": 7,
      "daysAhead": 30
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "calendar_earnings_reconcile",
    "displayName": "실적 캘린더 보정 수집",
    "description": "실적 발표 전후 구간을 다시 조회해 일정과 실제 EPS 변경을 반영합니다.",
    "domain": "calendar",
    "operation": "reconcile",
    "provider": "finnhub",
    "handler": "earnings_calendar",
    "enabled": false,
    "intervalSeconds": 43200,
    "params": {
      "daysBack": 14,
      "daysAhead": 45
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "youtube_economy_reconcile",
    "displayName": "경제 유튜브 보정 수집",
    "description": "이미 저장된 최근 영상의 제목/설명/조회수/썸네일을 다시 가져옵니다.",
    "domain": "youtube",
    "operation": "reconcile",
    "provider": "youtube",
    "handler": "youtube_economy_reconcile",
    "enabled": false,
    "intervalSeconds": 43200,
    "params": {
      "limit": 80
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_popular",
    "displayName": "인기 시세 최신 수집",
    "description": "인기 종목의 최신 시세를 Finnhub에서 가져옵니다.",
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
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_watchlist",
    "displayName": "관심종목 시세 최신 수집",
    "description": "기본 관심종목의 최신 시세를 Finnhub에서 가져옵니다.",
    "domain": "market",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_quotes",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "listKey": "default_watchlist"
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_mcap_universe",
    "displayName": "시총 상위 유니버스 갱신",
    "description": "시총 산정 후보를 profile 기준으로 정렬해 quote 수집 대상 리스트를 갱신합니다.",
    "domain": "market",
    "operation": "reconcile",
    "provider": "finnhub",
    "handler": "market_quotes_mcap_universe",
    "enabled": false,
    "intervalSeconds": 43200,
    "lockTtlSeconds": 1200,
    "staleLockSeconds": 1200,
    "params": {
      "topN": 20,
      "sourceListKey": "mcap_universe",
      "targetListKey": "mcap_top_symbols"
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_mcap",
    "displayName": "시총 상위 시세 최신 수집",
    "description": "시총 상위 확정 종목의 최신 시세를 Finnhub에서 가져옵니다.",
    "domain": "market",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_quotes_mcap",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "topN": 20,
      "listKey": "mcap_top_symbols"
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_coins_top",
    "displayName": "코인 시총 상위 수집",
    "description": "CoinGecko에서 시총 상위 코인 가격을 가져옵니다.",
    "domain": "market",
    "operation": "latest",
    "provider": "coingecko",
    "handler": "coin_markets",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "limit": 30
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "market_price_series_daily",
    "displayName": "주식 일봉 추세 저장",
    "description": "인기·시총·기본 관심종목의 Yahoo 일봉 OHLCV를 저장해 상세 차트와 시세 탭 추세선에 사용합니다.",
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
      "listKeys": [
        "popular_symbols",
        "mcap_top_symbols",
        "default_watchlist"
      ]
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "quant_price_series_kr",
    "displayName": "코스피 시총 20위 일봉 적재",
    "description": "KOSPI 시가총액 상위 20종목의 Yahoo 일봉 OHLCV를 적재해 퀀트 팩터 엔진의 기반 데이터로 저장합니다.",
    "domain": "market",
    "operation": "latest",
    "provider": "yahoo",
    "handler": "kr_daily_bars",
    "enabled": true,
    "intervalSeconds": 21600,
    "lockTtlSeconds": 600,
    "staleLockSeconds": 600,
    "params": {
      "range": "1y",
      "requestDelayMs": 150,
      "universeLabel": "KOSPI 시총 20위",
      "instruments": [
        {
          "symbol": "005930",
          "name": "삼성전자",
          "displaySymbol": "Samsung Elec",
          "yahooSymbol": "005930.KS",
          "rank": 1
        },
        {
          "symbol": "000660",
          "name": "SK하이닉스",
          "displaySymbol": "SK Hynix",
          "yahooSymbol": "000660.KS",
          "rank": 2
        },
        {
          "symbol": "402340",
          "name": "SK스퀘어",
          "displaySymbol": "SK Square",
          "yahooSymbol": "402340.KS",
          "rank": 3
        },
        {
          "symbol": "005380",
          "name": "현대차",
          "displaySymbol": "Hyundai Motor",
          "yahooSymbol": "005380.KS",
          "rank": 4
        },
        {
          "symbol": "009150",
          "name": "삼성전기",
          "displaySymbol": "Samsung Electro",
          "yahooSymbol": "009150.KS",
          "rank": 5
        },
        {
          "symbol": "373220",
          "name": "LG에너지솔루션",
          "displaySymbol": "LG Energy",
          "yahooSymbol": "373220.KS",
          "rank": 6
        },
        {
          "symbol": "032830",
          "name": "삼성생명",
          "displaySymbol": "Samsung Life",
          "yahooSymbol": "032830.KS",
          "rank": 7
        },
        {
          "symbol": "028260",
          "name": "삼성물산",
          "displaySymbol": "Samsung C&T",
          "yahooSymbol": "028260.KS",
          "rank": 8
        },
        {
          "symbol": "329180",
          "name": "HD현대중공업",
          "displaySymbol": "HD HHI",
          "yahooSymbol": "329180.KS",
          "rank": 9
        },
        {
          "symbol": "105560",
          "name": "KB금융",
          "displaySymbol": "KB Financial",
          "yahooSymbol": "105560.KS",
          "rank": 10
        },
        {
          "symbol": "012330",
          "name": "현대모비스",
          "displaySymbol": "Hyundai Mobis",
          "yahooSymbol": "012330.KS",
          "rank": 11
        },
        {
          "symbol": "000270",
          "name": "기아",
          "displaySymbol": "Kia",
          "yahooSymbol": "000270.KS",
          "rank": 12
        },
        {
          "symbol": "207940",
          "name": "삼성바이오로직스",
          "displaySymbol": "Samsung Biologics",
          "yahooSymbol": "207940.KS",
          "rank": 13
        },
        {
          "symbol": "034020",
          "name": "두산에너빌리티",
          "displaySymbol": "Doosan Enerbility",
          "yahooSymbol": "034020.KS",
          "rank": 14
        },
        {
          "symbol": "012450",
          "name": "한화에어로스페이스",
          "displaySymbol": "Hanwha Aerospace",
          "yahooSymbol": "012450.KS",
          "rank": 15
        },
        {
          "symbol": "055550",
          "name": "신한지주",
          "displaySymbol": "Shinhan Financial",
          "yahooSymbol": "055550.KS",
          "rank": 16
        },
        {
          "symbol": "066570",
          "name": "LG전자",
          "displaySymbol": "LG Electronics",
          "yahooSymbol": "066570.KS",
          "rank": 17
        },
        {
          "symbol": "006400",
          "name": "삼성SDI",
          "displaySymbol": "Samsung SDI",
          "yahooSymbol": "006400.KS",
          "rank": 18
        },
        {
          "symbol": "034730",
          "name": "SK",
          "displaySymbol": "SK Inc.",
          "yahooSymbol": "034730.KS",
          "rank": 19
        },
        {
          "symbol": "035420",
          "name": "NAVER",
          "displaySymbol": "Naver",
          "yahooSymbol": "035420.KS",
          "rank": 20
        }
      ]
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "quant_signals_kr",
    "displayName": "국내주식 퀀트 신호 스냅샷",
    "description": "적재된 일봉 데이터로 매매 신호를 산출해 일자별 스냅샷으로 저장하고 적중률 추적 기반을 만듭니다.",
    "domain": "quant",
    "operation": "latest",
    "provider": "signal",
    "handler": "quant_signals",
    "enabled": true,
    "intervalSeconds": 21600,
    "lockTtlSeconds": 600,
    "staleLockSeconds": 600,
    "params": {
      "timeZone": "Asia/Seoul",
      "minScore": 0
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "jobKey": "insights_market_brief",
    "displayName": "시장 인사이트 생성",
    "description": "수집된 뉴스·유튜브·시세·캘린더를 묶어 앱 첫 화면과 푸시 후보용 인사이트를 생성합니다.",
    "domain": "insights",
    "operation": "latest",
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
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  }
]$json$::jsonb) WITH ORDINALITY)
INSERT INTO polling_jobs (job_key, position, enabled, domain, operation, provider, handler, next_run_at, last_run_at, payload, updated_at)
SELECT payload->>'jobKey', position - 1, COALESCE((payload->>'enabled')::boolean, false), payload->>'domain', payload->>'operation', payload->>'provider', payload->>'handler', NULLIF(payload->>'nextRunAt', '')::timestamptz, NULLIF(payload->>'lastRunAt', '')::timestamptz, payload, COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz) FROM rows
ON CONFLICT (job_key) DO NOTHING;

WITH rows AS (SELECT value AS payload, ordinality::int AS position FROM jsonb_array_elements($json$
[
  {
    "key": "mega_cap",
    "displayName": "메가캡 리스트",
    "description": "캘린더·컨콜에서 메가캡 필터 기준으로 쓰는 미국 대형주 리스트입니다.",
    "symbols": [
      "AAPL",
      "MSFT",
      "GOOGL",
      "GOOG",
      "AMZN",
      "NVDA",
      "META",
      "TSLA",
      "BRK.B",
      "AVGO",
      "UNH",
      "XOM",
      "JNJ",
      "JPM",
      "V",
      "PG",
      "MA",
      "HD",
      "CVX",
      "MRK",
      "ABBV",
      "PEP",
      "COST",
      "ADBE",
      "TMO",
      "CSCO",
      "ACN",
      "NFLX",
      "DHR",
      "LIN",
      "AMD",
      "MCD",
      "WMT",
      "DIS",
      "ORCL",
      "BAC",
      "CRM",
      "PM",
      "INTU",
      "TXN",
      "QCOM",
      "IBM",
      "AMAT",
      "COP",
      "GE",
      "HON",
      "CAT",
      "AMGN",
      "SPGI",
      "BKNG",
      "BLK",
      "SBUX",
      "GILD",
      "ISRG",
      "MDT",
      "ADI",
      "VRTX",
      "PANW",
      "MU",
      "LRCX",
      "SYK",
      "DE",
      "REGN",
      "ZTS",
      "ETN",
      "KLAC",
      "SNPS",
      "CDNS",
      "MELI",
      "CMCSA"
    ],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "key": "mcap_universe",
    "displayName": "시총 산정 후보",
    "description": "시총 상위 시세 Job이 profile 조회 후 정렬할 후보 종목입니다.",
    "symbols": [
      "AAPL",
      "MSFT",
      "GOOGL",
      "AMZN",
      "NVDA",
      "META",
      "AVGO",
      "TSLA",
      "BRK-B",
      "JPM",
      "WMT",
      "UNH",
      "XOM",
      "JNJ",
      "V",
      "PG",
      "MA",
      "ORCL",
      "COST",
      "HD",
      "ABBV",
      "BAC",
      "KO",
      "NFLX",
      "AMD",
      "LLY",
      "MRK",
      "PEP",
      "TMO",
      "ABT",
      "DHR",
      "CSCO",
      "ACN",
      "DIS",
      "CMCSA",
      "NKE",
      "PM",
      "TXN",
      "LIN",
      "QCOM",
      "AMGN",
      "HON",
      "UPS",
      "LOW",
      "SBUX",
      "AMAT",
      "INTU",
      "ISRG",
      "BKNG",
      "ADBE",
      "GE",
      "CAT",
      "DE",
      "GS",
      "MS",
      "BLK",
      "SCHW",
      "SPGI",
      "MDT",
      "ZTS",
      "CI",
      "SYK",
      "MO",
      "PFE",
      "T",
      "CME",
      "EQIX",
      "ICE",
      "AXP",
      "TJX",
      "REGN",
      "CL",
      "EL",
      "NEE",
      "DUK",
      "SO",
      "PLD",
      "MMC",
      "CB",
      "AON",
      "ECL",
      "SHW",
      "ITW",
      "EMR",
      "FCX",
      "OXY",
      "MET",
      "PYPL",
      "CRWD",
      "NOW",
      "UBER",
      "ABNB",
      "LRCX",
      "MU",
      "ADI",
      "SNPS",
      "CDNS",
      "PANW",
      "FTNT",
      "MMM",
      "RTX",
      "BA",
      "LMT"
    ],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "key": "mcap_top_symbols",
    "displayName": "시총 상위 확정 종목",
    "description": "시총 산정 후보를 profile로 정렬한 뒤 quote 수집에 사용하는 확정 종목입니다.",
    "symbols": [
      "AAPL",
      "MSFT",
      "GOOGL",
      "AMZN",
      "NVDA",
      "META",
      "AVGO",
      "TSLA",
      "BRK-B",
      "JPM",
      "WMT",
      "UNH",
      "XOM",
      "JNJ",
      "V",
      "PG",
      "MA",
      "ORCL",
      "COST",
      "HD"
    ],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "key": "popular_symbols",
    "displayName": "인기 시세 종목",
    "description": "인기 시세 최신 수집 Job과 앱 인기 탭에서 공유할 종목 순서입니다.",
    "symbols": [
      "NVDA",
      "TSLA",
      "AAPL",
      "AMD",
      "META",
      "AMZN",
      "GOOGL",
      "MSFT",
      "MSTR",
      "COIN",
      "PLTR",
      "SPY",
      "QQQ",
      "IWM",
      "BRK-B",
      "JPM",
      "NFLX",
      "UNH",
      "AVGO",
      "XOM"
    ],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "key": "default_watchlist",
    "displayName": "기본 관심종목",
    "description": "신규 사용자 또는 관심종목 초기화 시 사용할 기본 종목입니다.",
    "symbols": [
      "NVDA",
      "GOOGL",
      "AAPL",
      "TSLA",
      "BMNR",
      "MU",
      "PLTR",
      "CRCL",
      "SPY",
      "QQQ"
    ],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  }
]$json$::jsonb) WITH ORDINALITY)
INSERT INTO market_lists (list_key, position, payload, updated_at)
SELECT payload->>'key', position - 1, payload, COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz) FROM rows
ON CONFLICT (list_key) DO NOTHING;

WITH rows AS (SELECT value AS payload FROM jsonb_array_elements($json$
[
  {
    "type": "service",
    "locale": "ko",
    "version": "2026.05.07",
    "title": "서비스 이용약관",
    "body": "SIGNAL은 뉴스, 시세, 캘린더, 영상, 시그널 등 투자 참고 정보를 제공하는 서비스입니다. 제공 정보는 투자 권유가 아니며 최종 판단과 책임은 사용자에게 있습니다. 사용자는 관계 법령과 약관을 준수해야 하며, 서비스 운영을 방해하는 행위를 해서는 안 됩니다. 중요한 투자 결정 전에는 원문, 공시, 거래 플랫폼의 최신 정보를 함께 확인해야 합니다.",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "type": "privacy",
    "locale": "ko",
    "version": "2026.05.07",
    "title": "개인정보처리방침",
    "body": "SIGNAL은 계정 생성과 서비스 제공을 위해 이메일, 비밀번호 해시, 닉네임, 프로필 이미지, 세션, 기기/푸시 토큰, 관심종목, 알림 이력 등 필요한 정보를 처리할 수 있습니다. 비밀번호는 원문으로 저장하지 않습니다. 사용자는 내정보 화면에서 로그아웃하거나 계정 탈퇴를 요청할 수 있으며, 법령 준수와 보안을 위해 필요한 최소 기록은 일정 기간 보관될 수 있습니다.",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "type": "service",
    "locale": "en",
    "version": "2026.05.07",
    "title": "Terms of Service",
    "body": "SIGNAL provides market reference information such as news, quotes, calendars, videos, and signals. The information is not investment advice or solicitation. Users remain responsible for final investment decisions and outcomes. Users must comply with applicable laws and should verify original sources, filings, and trading platforms before making important decisions.",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "type": "privacy",
    "locale": "en",
    "version": "2026.05.07",
    "title": "Privacy Policy",
    "body": "SIGNAL may process email, password hashes, nickname, profile image URL, sessions, device and push tokens, watchlists, notification settings, and notification history to provide the service. Passwords are not stored in plain text. Users may log out or request account deletion, while minimal records may be retained for legal, dispute, and security needs.",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "type": "service",
    "locale": "ja",
    "version": "2026.05.07",
    "title": "サービス利用規約",
    "body": "SIGNAL はニュース、相場、カレンダー、動画、シグナルなど投資判断の参考情報を提供します。提供情報は投資助言や勧誘ではなく、最終判断と結果はユーザーの責任です。重要な判断の前には原文、公式開示、取引プラットフォームの最新情報を確認してください。",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "type": "privacy",
    "locale": "ja",
    "version": "2026.05.07",
    "title": "プライバシーポリシー",
    "body": "SIGNAL はサービス提供のため、メールアドレス、パスワードハッシュ、ニックネーム、プロフィール画像 URL、セッション、端末・プッシュトークン、ウォッチリスト、通知履歴などを処理する場合があります。パスワードは平文で保存しません。退会時も法令・紛争・セキュリティ上必要な最小記録は一定期間保持される場合があります。",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  }
]$json$::jsonb))
INSERT INTO legal_terms (id, type, locale, version, title, body, required, active, created_at, updated_at)
SELECT concat(payload->>'type', ':', payload->>'locale', ':', payload->>'version'), payload->>'type', payload->>'locale', payload->>'version', payload->>'title', payload->>'body', COALESCE((payload->>'required')::boolean, true), COALESCE((payload->>'active')::boolean, true), COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz), COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz) FROM rows
ON CONFLICT (type, locale, version) DO NOTHING;
