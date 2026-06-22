-- Remove earnings calendar and concall transcript feature after app removal.

DELETE FROM polling_job_runs
WHERE job_key IN ('calendar_earnings', 'calendar_earnings_reconcile', 'concall_transcripts_recent');

DELETE FROM polling_jobs
WHERE job_key IN ('calendar_earnings', 'calendar_earnings_reconcile', 'concall_transcripts_recent');

DELETE FROM calendar_events
WHERE event_type = 'earnings' OR COALESCE(payload->>'type', '') = 'earnings';

DROP TABLE IF EXISTS concall_transcripts;
