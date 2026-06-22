-- Remove news_digest_brief polling job; digest table and /v1/news-digests API remain.

DELETE FROM polling_job_locks
WHERE job_key = 'news_digest_brief';

DELETE FROM polling_job_runs
WHERE job_key = 'news_digest_brief';

DELETE FROM polling_jobs
WHERE job_key = 'news_digest_brief';
