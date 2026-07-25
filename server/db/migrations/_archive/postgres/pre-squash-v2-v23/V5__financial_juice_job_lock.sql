-- Financial Juice sync job: explicit lock TTL for long ingest+translate runs.
UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      COALESCE(payload, '{}'::jsonb),
      '{lockTtlSeconds}',
      '900'::jsonb,
      true
    ),
    '{staleLockSeconds}',
    '1800'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE job_key = 'market_news_financial_juice';
