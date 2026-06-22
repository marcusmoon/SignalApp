-- Rename user-facing quant job labels to investment-view language.
-- The handler/table names stay as-is for compatibility with existing APIs.

UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      payload,
      '{displayName}',
      to_jsonb('국내주식 투자 관점 스냅샷'::text),
      true
    ),
    '{description}',
    to_jsonb('적재된 일봉 데이터로 가격 흐름·거래량·과열도·리스크 관점을 산출해 앱의 투자 관점 카드로 저장합니다.'::text),
    true
  ),
  updated_at = now()
WHERE job_key = 'quant_signals_kr';

UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      payload,
      '{displayName}',
      to_jsonb('코스피 주요종목 일봉 적재'::text),
      true
    ),
    '{description}',
    to_jsonb('KOSPI 주요 종목의 Yahoo 일봉 OHLCV를 적재해 투자 관점 산출의 기반 데이터로 저장합니다.'::text),
    true
  ),
  updated_at = now()
WHERE job_key = 'quant_price_series_kr';
