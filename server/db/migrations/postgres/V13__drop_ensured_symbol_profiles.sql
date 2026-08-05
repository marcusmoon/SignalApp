-- Remove auto-registered symbol_profiles rows created by on-read ensure.
-- Missing profiles should stay missing so Admin/ingest can fill them later.
DELETE FROM symbol_profiles
WHERE COALESCE(payload->>'source', '') ILIKE '%ensure%';
