-- SAVE no longer exposes a user board. Stop ingest and drop stored posts.

DELETE FROM community_posts
WHERE source = 'save_user_news';

DELETE FROM polling_jobs
WHERE job_key = 'community_save_user_news';
