-- Remove investment-view (quant) jobs and storage after app feature removal.

DELETE FROM polling_job_runs
WHERE job_key IN ('quant_signals_kr', 'quant_price_series_kr');

DELETE FROM polling_jobs
WHERE job_key IN ('quant_signals_kr', 'quant_price_series_kr');

DROP TABLE IF EXISTS quant_signal_items;

UPDATE polling_jobs
SET
  payload = jsonb_set(
    payload,
    '{description}',
    to_jsonb('인기·시총·기본 관심종목의 Yahoo 일봉 OHLCV를 저장해 종목 상세 차트에 사용합니다.'::text),
    true
  ),
  updated_at = now()
WHERE job_key = 'market_price_series_daily';
