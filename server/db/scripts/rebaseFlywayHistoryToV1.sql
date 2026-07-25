-- Rebase Flyway history after squash to a single V1 baseline.
-- Use on an EXISTING database that already applied former V2–V23 (schema/data stay).
-- Do NOT run V1__signal_baseline.sql again — CREATE TABLE would fail and seeds would reset.
--
-- Prerequisites:
--   1. App server + job worker stopped
--   2. Deployed code already has only server/db/migrations/postgres/V1__signal_baseline.sql
--   3. This DB previously reached the pre-squash head (former V23) — or is otherwise
--      already at the same schema/seed end-state as the new V1
--
-- Steps:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/db/scripts/rebaseFlywayHistoryToV1.sql
--   flyway -configFiles=server/db/flyway.conf baseline -baselineVersion=1 -baselineDescription="signal_baseline"
--   flyway -configFiles=server/db/flyway.conf info
--   flyway -configFiles=server/db/flyway.conf validate
--
-- After this, later changes ship as V2__… / V3__… as usual.

BEGIN;

-- Keep the table; only clear recorded versions so Flyway no longer expects deleted V2–V23 files
-- or the old V1 checksum.
DELETE FROM flyway_schema_history;

COMMIT;
