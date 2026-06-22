-- Remove insights_market_brief job and rows it generated in insight_items.
-- market_briefings (Codex ingest → Signal tab) is unchanged.

DELETE FROM polling_job_locks
WHERE job_key = 'insights_market_brief';

DELETE FROM polling_job_runs
WHERE job_key = 'insights_market_brief';

DELETE FROM polling_jobs
WHERE job_key = 'insights_market_brief';

DELETE FROM notification_items
WHERE source_type = 'insight'
   OR type = 'insight_signal';

DELETE FROM insight_items
WHERE kind IN ('market_brief', 'asset_signal');
