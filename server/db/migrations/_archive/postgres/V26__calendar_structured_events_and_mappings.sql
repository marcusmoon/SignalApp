-- Calendar events are reloaded after this migration. Store operational fields as columns.
DELETE FROM calendar_events;

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS event_key text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_item_id text,
  ADD COLUMN IF NOT EXISTS time_label text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_event_id text,
  ADD COLUMN IF NOT EXISTS importance text,
  ADD COLUMN IF NOT EXISTS impact text,
  ADD COLUMN IF NOT EXISTS actual numeric,
  ADD COLUMN IF NOT EXISTS estimate numeric,
  ADD COLUMN IF NOT EXISTS previous numeric,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS fiscal_year integer,
  ADD COLUMN IF NOT EXISTS fiscal_quarter integer,
  ADD COLUMN IF NOT EXISTS earnings_hour text,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE calendar_events
  ALTER COLUMN country SET DEFAULT 'GLOBAL',
  ALTER COLUMN event_key SET DEFAULT '',
  ALTER COLUMN title SET DEFAULT '',
  ALTER COLUMN provider SET DEFAULT 'manual',
  ALTER COLUMN source SET DEFAULT 'manual';

ALTER TABLE calendar_events
  DROP COLUMN IF EXISTS payload;

DROP INDEX IF EXISTS idx_calendar_events_date;
DROP INDEX IF EXISTS idx_calendar_events_type_date;
DROP INDEX IF EXISTS idx_calendar_events_symbol_date;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_calendar_events_identity
  ON calendar_events(country, event_type, event_key);
CREATE INDEX IF NOT EXISTS idx_calendar_events_country_type_date
  ON calendar_events(country, event_type, event_date, event_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_type_country
  ON calendar_events(event_date, event_type, country);
CREATE INDEX IF NOT EXISTS idx_calendar_events_symbol_date
  ON calendar_events(symbol, event_date);

CREATE TABLE IF NOT EXISTS calendar_event_code_mappings (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  code text NOT NULL,
  label text,
  locale text,
  match_type text NOT NULL DEFAULT 'contains',
  pattern text NOT NULL,
  priority integer NOT NULL DEFAULT 1000,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_code_mappings_lookup
  ON calendar_event_code_mappings(event_type, enabled, priority, code);

INSERT INTO calendar_event_code_mappings
  (id, event_type, code, label, match_type, pattern, priority, enabled, created_at, updated_at)
VALUES
  ('macro-core-cpi-yoy-regex', 'macro', 'core-cpi-yoy', 'Core CPI YoY', 'regex', 'core.*\bcpi\b.*\b(yoy|year)', 90, true, now(), now()),
  ('macro-core-cpi-mom-regex', 'macro', 'core-cpi-mom', 'Core CPI MoM', 'regex', 'core.*\bcpi\b.*\b(mom|month)', 95, true, now(), now()),
  ('macro-cpi-yoy-regex', 'macro', 'cpi-yoy', 'CPI YoY', 'regex', '\bcpi\b.*\b(yoy|year)', 100, true, now(), now()),
  ('macro-cpi-mom-regex', 'macro', 'cpi-mom', 'CPI MoM', 'regex', '\bcpi\b.*\b(mom|month)', 110, true, now(), now()),
  ('macro-core-ppi-yoy-regex', 'macro', 'core-ppi-yoy', 'Core PPI YoY', 'regex', 'core.*\bppi\b.*\b(yoy|year)', 115, true, now(), now()),
  ('macro-core-ppi-mom-regex', 'macro', 'core-ppi-mom', 'Core PPI MoM', 'regex', 'core.*\bppi\b.*\b(mom|month)', 116, true, now(), now()),
  ('macro-ppi-yoy-regex', 'macro', 'ppi-yoy', 'PPI YoY', 'regex', '\bppi\b.*\b(yoy|year)', 120, true, now(), now()),
  ('macro-ppi-mom-regex', 'macro', 'ppi-mom', 'PPI MoM', 'regex', '\bppi\b.*\b(mom|month)', 130, true, now(), now()),
  ('macro-gdp-qoq-final-regex', 'macro', 'gdp-qoq-final', 'GDP QoQ Final', 'regex', '(gdp|gross domestic product).*(qoq|quarter).*final', 100, true, now(), now()),
  ('macro-gdp-qoq-regex', 'macro', 'gdp-qoq', 'GDP QoQ', 'regex', '(gdp|gross domestic product).*(qoq|quarter)', 140, true, now(), now()),
  ('macro-gdp-yoy-regex', 'macro', 'gdp-yoy', 'GDP YoY', 'regex', '(gdp|gross domestic product).*(yoy|year)', 145, true, now(), now()),
  ('macro-current-account-contains', 'macro', 'current-account', 'Current Account', 'contains', 'current account', 150, true, now(), now()),
  ('macro-initial-jobless-claims-contains', 'macro', 'initial-jobless-claims', 'Initial Jobless Claims', 'contains', 'initial jobless claims', 150, true, now(), now()),
  ('macro-nonfarm-payrolls-regex', 'macro', 'nonfarm-payrolls', 'Nonfarm Payrolls', 'regex', '(nonfarm|non-farm).*payroll', 150, true, now(), now()),
  ('macro-unemployment-rate-contains', 'macro', 'unemployment-rate', 'Unemployment Rate', 'contains', 'unemployment rate', 150, true, now(), now()),
  ('macro-retail-sales-contains', 'macro', 'retail-sales', 'Retail Sales', 'contains', 'retail sales', 150, true, now(), now()),
  ('macro-consumer-confidence-contains', 'macro', 'consumer-confidence', 'Consumer Confidence', 'contains', 'consumer confidence', 150, true, now(), now()),
  ('macro-ism-manufacturing-pmi-regex', 'macro', 'ism-manufacturing-pmi', 'ISM Manufacturing PMI', 'regex', 'ism.*manufacturing.*pmi', 150, true, now(), now()),
  ('macro-ism-services-pmi-regex', 'macro', 'ism-services-pmi', 'ISM Services PMI', 'regex', 'ism.*(services|non-manufacturing).*pmi', 150, true, now(), now()),
  ('fomc-rate-decision-regex', 'fomc', 'fomc-rate-decision', 'FOMC Rate Decision', 'regex', '(fomc|fed).*(rate|interest).*decision', 100, true, now(), now()),
  ('fomc-minutes-contains', 'fomc', 'fomc-minutes', 'FOMC Minutes', 'contains', 'fomc minutes', 110, true, now(), now()),
  ('fed-chair-speech-regex', 'fed', 'fed-chair-speech', 'Fed Chair Speech', 'regex', '(powell|fed chair).*speech', 100, true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  event_type = excluded.event_type,
  code = excluded.code,
  label = excluded.label,
  match_type = excluded.match_type,
  pattern = excluded.pattern,
  priority = excluded.priority,
  enabled = excluded.enabled,
  updated_at = now();
