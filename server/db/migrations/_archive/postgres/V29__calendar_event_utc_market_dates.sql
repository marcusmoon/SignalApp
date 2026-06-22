-- Rebuild calendar data with explicit market-date + UTC-timestamp semantics.
-- Existing calendar rows can be reloaded by jobs after this migration.
TRUNCATE TABLE calendar_events;

ALTER TABLE calendar_events
  ALTER COLUMN country SET DEFAULT 'GLOBAL',
  ALTER COLUMN country SET NOT NULL,
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN event_date SET NOT NULL,
  ALTER COLUMN event_key SET DEFAULT '',
  ALTER COLUMN event_key SET NOT NULL,
  ALTER COLUMN title SET DEFAULT '',
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN provider SET DEFAULT 'manual',
  ALTER COLUMN provider SET NOT NULL,
  ALTER COLUMN source SET DEFAULT 'manual',
  ALTER COLUMN source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_calendar_events_type'
      AND conrelid = 'calendar_events'::regclass
  ) THEN
    ALTER TABLE calendar_events
      ADD CONSTRAINT chk_calendar_events_type
      CHECK (event_type IN ('macro', 'fed', 'fomc', 'earnings', 'holiday'));
  END IF;
END $$;

DROP INDEX IF EXISTS uniq_calendar_events_identity;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_calendar_events_identity
  ON calendar_events(country, event_type, event_key);

CREATE INDEX IF NOT EXISTS idx_calendar_events_country_type_date
  ON calendar_events(country, event_type, event_date, event_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date_type_country
  ON calendar_events(event_date, event_type, country);

CREATE INDEX IF NOT EXISTS idx_calendar_events_event_at
  ON calendar_events(event_at);
