-- Quotes tab ETF segment: curated etf_symbols list + Finnhub polling job.
-- App segments are watch | etf | coin (popular/mcap UI removed).

WITH list_rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "key": "etf_symbols",
    "displayName": "시세 ETF",
    "description": "시세 탭 ETF 세그먼트용 유동성 우선 큐레이션 목록. AUM 자동정렬이 아닙니다.",
    "symbols": [
      "SPY",
      "QQQ",
      "IWM",
      "DIA",
      "XLK",
      "XLF",
      "XLE",
      "XLV",
      "XLI",
      "XLY",
      "XLP",
      "XLU",
      "XLB",
      "XLRE",
      "SMH",
      "SOXX",
      "EEM",
      "EWJ",
      "GLD",
      "TLT"
    ],
    "updatedAt": "2026-08-02T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO market_lists (list_key, position, payload, updated_at)
SELECT
  payload->>'key',
  820 + position - 1,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM list_rows
ON CONFLICT (list_key) DO NOTHING;

WITH job_rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "market_quotes_etf",
    "displayName": "ETF 시세",
    "description": "etf_symbols 리스트의 실시간 시세를 저장합니다(시세 탭 ETF).",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_quotes",
    "enabled": true,
    "intervalSeconds": 300,
    "params": {
      "segment": "etf",
      "listKey": "etf_symbols"
    },
    "updatedAt": "2026-08-02T00:00:00.000Z"
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
  913 + position - 1,
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
FROM job_rows
ON CONFLICT (job_key) DO NOTHING;

-- Daily bars: include ETF basket for symbol charts.
UPDATE polling_jobs
SET
  payload = jsonb_set(
    payload,
    '{params,listKeys}',
    COALESCE(payload#>'{params,listKeys}', '[]'::jsonb) || '["etf_symbols"]'::jsonb
  ),
  updated_at = now()
WHERE job_key = 'market_price_series_daily'
  AND NOT (COALESCE(payload#>'{params,listKeys}', '[]'::jsonb) ? 'etf_symbols');
