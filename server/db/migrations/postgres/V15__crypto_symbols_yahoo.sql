-- Curated top crypto basket (Admin market list) + Yahoo-backed coin job.

WITH list_rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "key": "crypto_symbols",
    "displayName": "시세 코인",
    "description": "시세·홈 코인 세그먼트용 큐레이션(시총 상위권 메이저). Yahoo BASE-USD 페어. Admin에서 순서·구성 관리.",
    "symbols": [
      "BTC-USD",
      "ETH-USD",
      "BNB-USD",
      "XRP-USD",
      "SOL-USD",
      "DOGE-USD",
      "ADA-USD",
      "AVAX-USD",
      "TON-USD",
      "LINK-USD"
    ],
    "updatedAt": "2026-08-09T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO market_lists (list_key, position, payload, updated_at)
SELECT
  payload->>'key',
  830 + position - 1,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM list_rows
ON CONFLICT (list_key) DO UPDATE SET
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at;

-- Switch market_coins_top from CoinGecko markets API to Yahoo + crypto_symbols list.
UPDATE polling_jobs
SET
  provider = 'yahoo',
  handler = 'coin_markets',
  payload = payload
    || jsonb_build_object(
      'provider', 'yahoo',
      'handler', 'coin_markets',
      'displayName', '코인 시세(Yahoo)',
      'description', 'crypto_symbols 리스트의 Yahoo BASE-USD 시세를 coin_markets에 저장합니다.',
      'params', jsonb_build_object('listKey', 'crypto_symbols', 'limit', 10)
    ),
  updated_at = now()
WHERE job_key = 'market_coins_top';

-- Drop legacy CoinGecko rows (different ids like coin-market-bitcoin) so the
-- curated Yahoo basket is the only source until the next job run fills it.
DELETE FROM coin_markets
WHERE COALESCE(payload->>'provider', '') <> 'yahoo';
