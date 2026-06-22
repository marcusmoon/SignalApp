CREATE TABLE IF NOT EXISTS market_briefings (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  market text NOT NULL,
  session text NOT NULL,
  briefing_date date NOT NULL,
  published_at timestamptz NOT NULL,
  push_candidate boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_briefings_market_date_published
  ON market_briefings(market, briefing_date DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_briefings_session_date_published
  ON market_briefings(session, briefing_date DESC, published_at DESC);
