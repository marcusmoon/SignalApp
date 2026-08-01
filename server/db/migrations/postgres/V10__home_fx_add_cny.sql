-- Home FX: add CNY/KRW for wide/PC (app still shows USD+JPY only on compact).

WITH list_rows AS (
  SELECT value AS payload
  FROM jsonb_array_elements($json$
[
  {
    "key": "home_fx",
    "displayName": "홈 환율",
    "description": "홈 시세 환율 레이어. Yahoo FX (USDKRW=X, JPYKRW=X, CNYKRW=X).",
    "symbols": ["USDKRW=X", "JPYKRW=X", "CNYKRW=X"],
    "updatedAt": "2026-08-01T00:00:00.000Z"
  }
]
$json$::jsonb)
)
INSERT INTO market_lists (list_key, position, payload, updated_at)
SELECT
  payload->>'key',
  810,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM list_rows
ON CONFLICT (list_key) DO UPDATE SET
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at;
