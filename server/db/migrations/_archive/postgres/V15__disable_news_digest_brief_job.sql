-- Disable the news_digest_brief polling job so the legacy worker
-- does not overwrite AI-generated digest items ingested via the API.
UPDATE polling_jobs
SET enabled = false, updated_at = NOW()
WHERE job_key = 'news_digest_brief';
