-- Today briefing: UTC-date home summary generated from SIGNAL sources.

CREATE TABLE today_briefings (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  locale text NOT NULL DEFAULT 'ko',
  briefing_date date NOT NULL,
  published_at timestamptz NOT NULL,
  generated_at timestamptz,
  status text NOT NULL DEFAULT 'published',
  push_candidate boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX idx_today_briefings_locale_date_published
  ON today_briefings(locale, briefing_date DESC, published_at DESC);

CREATE INDEX idx_today_briefings_status_published
  ON today_briefings(status, published_at DESC);
