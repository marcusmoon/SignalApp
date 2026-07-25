-- Enable Korea Yahoo quotes job and ensure it can load korea_watchlist.
-- (Runner fix loads marketLists for yahoo/market_quotes_kr; enable so worker picks it up.)

UPDATE polling_jobs
SET
  enabled = true,
  next_run_at = NULL,
  payload = jsonb_set(
    COALESCE(payload, '{}'::jsonb),
    '{enabled}',
    'true'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE job_key = 'market_quotes_korea';
