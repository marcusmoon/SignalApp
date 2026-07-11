-- Insights pipeline removed (see chore: remove legacy insights pipeline).
-- Ingest uses request-level notifyInbox / sendPush instead of push_candidate columns.

DROP TABLE IF EXISTS insight_items;

ALTER TABLE market_briefings
  DROP COLUMN IF EXISTS push_candidate;

ALTER TABLE today_briefings
  DROP COLUMN IF EXISTS push_candidate;
