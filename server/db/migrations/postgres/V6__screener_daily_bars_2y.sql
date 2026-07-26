-- Screener pool: fetch 2y daily bars so return12m / ma200 / alignedMa have headroom.
-- Yahoo `1y` is ~245–252 KR sessions; return12m needs 253 closes.

UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      payload,
      '{description}',
      '"스크리너 전용 Job(하나). korea_screener_universe를 읽어 Yahoo 시세·2y 일봉을 직접 조회하고 RSI·turnover·모멘텀을 계산해 screener_snapshots에 저장합니다. 앱 시세/일봉 Job과 스케줄 의존 없음. return12m/ma200은 250거래일+ 이력 필요."'
    ),
    '{params}',
    COALESCE(payload->'params', '{}'::jsonb) || $json${
      "market": "kr",
      "preferredBeforeKst": "08:00",
      "staleAfterHours": 24,
      "selfFetch": true,
      "dailyBarRange": "2y"
    }$json$::jsonb
  ),
  updated_at = now()
WHERE job_key = 'screener_pool_kr';
