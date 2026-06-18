-- Enable Finnhub economic calendar jobs (macro/fomc/fed). Earnings jobs were restored in V17;
-- economic jobs were never removed but default to disabled in V2 seed.

UPDATE polling_jobs
SET
  enabled = true,
  payload = COALESCE(payload, '{}'::jsonb) || '{"enabled": true}'::jsonb,
  updated_at = now()
WHERE job_key IN ('calendar_economic', 'calendar_economic_reconcile');
