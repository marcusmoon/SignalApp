-- Remove legacy news_digest_brief polling job; digests are ingested via API instead.

DELETE FROM polling_job_runs
WHERE job_key = 'news_digest_brief';

DELETE FROM polling_jobs
WHERE job_key = 'news_digest_brief';
