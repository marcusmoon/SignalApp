-- Default lock TTL for long-running sync / market jobs (JOB_WORKER_LOST prevention).
-- Skips jobs that already have lockTtlSeconds set in Admin or prior migrations.

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
WHERE job_key IN (
  'market_news_global',
  'market_news_crypto',
  'market_news_mk_rss',
  'youtube_economy_latest'
)
AND (payload->>'lockTtlSeconds') IS NULL;

UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      COALESCE(payload, '{}'::jsonb),
      '{lockTtlSeconds}',
      '600'::jsonb,
      true
    ),
    '{staleLockSeconds}',
    '1200'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE job_key = 'calendar_economic'
AND (payload->>'lockTtlSeconds') IS NULL;

UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      COALESCE(payload, '{}'::jsonb),
      '{lockTtlSeconds}',
      '1200'::jsonb,
      true
    ),
    '{staleLockSeconds}',
    '2400'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE job_key IN ('market_quotes_mcap', 'market_quotes_mcap_universe')
AND (payload->>'lockTtlSeconds') IS NULL;
