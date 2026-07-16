-- Include korea_watchlist in daily price-series ingest so KR symbol detail charts
-- can be served from price_series (Yahoo .KS/.KQ), not Finnhub.

UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      COALESCE(payload, '{}'::jsonb),
      '{description}',
      to_jsonb('인기·시총·기본·국내 관심종목의 Yahoo 일봉 OHLCV를 저장해 종목 상세 차트에 사용합니다.'::text),
      true
    ),
    '{params,listKeys}',
    $json$["popular_symbols","mcap_top_symbols","default_watchlist","korea_watchlist"]$json$::jsonb,
    true
  ),
  updated_at = NOW()
WHERE job_key = 'market_price_series_daily';
