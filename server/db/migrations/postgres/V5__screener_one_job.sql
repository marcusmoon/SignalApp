-- Screener = one job (screener_pool_kr). Decouple app quote/daily-bar jobs.
-- App jobs keep korea_watchlist; screener fetches Yahoo itself into screener_snapshots.

-- 1) Restore KR quotes job to app watchlist (not screener universe).
UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      jsonb_set(
        payload,
        '{listKey}',
        '"korea_watchlist"'
      ),
      '{description}',
      '"korea_watchlist의 KRX 6자리 종목을 Yahoo(.KS→.KQ)로 조회해 market_quotes에 저장합니다(앱 시세용)."'
    ),
    '{displayName}',
    COALESCE(payload->'displayName', '"국내 시세"')
  ),
  updated_at = now()
WHERE job_key = 'market_quotes_korea';

-- 2) Drop screener universe from daily-bar listKeys (app charts only).
UPDATE polling_jobs
SET
  payload = jsonb_set(
    payload,
    '{listKeys}',
    COALESCE(
      (
        SELECT jsonb_agg(value)
        FROM jsonb_array_elements(COALESCE(payload->'listKeys', '[]'::jsonb)) AS t(value)
        WHERE value::text <> '"korea_screener_universe"'
      ),
      '[]'::jsonb
    )
  ),
  updated_at = now()
WHERE job_key = 'market_price_series_daily'
  AND COALESCE(payload->'listKeys', '[]'::jsonb) ? 'korea_screener_universe';

-- 3) Screener pool job: single owner of KR screener data path.
UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      jsonb_set(
        payload,
        '{displayName}',
        '"스크리너 풀 · 한국"'
      ),
      '{description}',
      '"스크리너 전용 Job(하나). korea_screener_universe를 읽어 Yahoo 시세·1y 일봉을 직접 조회하고 RSI·turnover·모멘텀을 계산해 screener_snapshots에 저장합니다. 앱 시세/일봉 Job과 스케줄 의존 없음."'
    ),
    '{params}',
    COALESCE(payload->'params', '{}'::jsonb) || $json${
      "market": "kr",
      "preferredBeforeKst": "08:00",
      "staleAfterHours": 24,
      "selfFetch": true
    }$json$::jsonb
  ),
  updated_at = now()
WHERE job_key = 'screener_pool_kr';
