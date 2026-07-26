-- Approximate KR screener universe (kospi~30 + kosdaq~50 ordinary shares).
-- Not a live KRX market-cap feed — Admin can edit; replace when official mcap feed exists.
-- Used by screener_pool_kr (and optional quote jobs). Separate from korea_watchlist (DART/UI).

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "key": "korea_screener_universe",
    "displayName": "국내 스크리너 유니버스",
    "description": "스크리너 공용 풀용 근사 유니버스(코스피·코스닥 대형 보통주). 정식 KRX 시총 피드 전 임시. 순서≈시총 가중.",
    "symbols": [
      "005930",
      "000660",
      "373220",
      "207940",
      "005380",
      "000270",
      "068270",
      "105560",
      "005490",
      "035420",
      "006400",
      "051910",
      "028260",
      "012330",
      "055550",
      "066570",
      "003670",
      "096770",
      "032830",
      "034730",
      "003550",
      "017670",
      "030200",
      "086790",
      "009150",
      "010130",
      "011200",
      "259960",
      "035720",
      "000810",
      "402340",
      "034020",
      "329180",
      "012450",
      "247540",
      "086520",
      "196170",
      "141080",
      "028300",
      "068760",
      "403870",
      "214150",
      "357780",
      "039030",
      "145020",
      "240810",
      "277810",
      "310210",
      "214370",
      "293490",
      "263750",
      "112040",
      "035900",
      "041510",
      "122870",
      "067160",
      "058470",
      "084370",
      "095340",
      "064760",
      "222080",
      "348370",
      "253450",
      "035760",
      "036570",
      "067310",
      "053800",
      "086900",
      "215000",
      "328130",
      "462870",
      "039490",
      "000100",
      "128940",
      "214320",
      "950130",
      "060250",
      "078340",
      "036930",
      "048410"
    ],
    "updatedAt": "2026-07-26T02:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO market_lists (list_key, position, payload, updated_at)
SELECT
  payload->>'key',
  100 + position - 1,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM rows
ON CONFLICT (list_key) DO UPDATE SET
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at;

-- Point KR quote job at screener universe so volume/price refresh covers the pool.
-- App UI watchlist remains korea_watchlist; quotes for screener symbols live in segment=korea too.
UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(payload, '{listKey}', '"korea_screener_universe"'),
    '{displayName}',
    COALESCE(payload->'displayName', '"국내 시세"')
  ),
  updated_at = now()
WHERE job_key = 'market_quotes_korea';

UPDATE polling_jobs
SET
  payload = jsonb_set(
    payload,
    '{description}',
    '"korea_screener_universe KRX 종목을 Yahoo(.KS→.KQ)로 조회해 market_quotes에 저장합니다(volume·turnoverKrw 포함)."'
  ),
  updated_at = now()
WHERE job_key = 'market_quotes_korea';

-- RSI/turnover fallback: daily bars for screener universe symbols.
UPDATE polling_jobs
SET
  payload = jsonb_set(
    payload,
    '{listKeys}',
    COALESCE(payload->'listKeys', '[]'::jsonb) || '["korea_screener_universe"]'::jsonb
  ),
  updated_at = now()
WHERE job_key = 'market_price_series_daily'
  AND NOT (COALESCE(payload->'listKeys', '[]'::jsonb) ? 'korea_screener_universe');
