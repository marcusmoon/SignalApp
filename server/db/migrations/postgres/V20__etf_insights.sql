-- ETF Insights collection
CREATE TABLE etf_insights (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT 'daily',
  insight_date date,
  published_at timestamptz,
  updated_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX etf_insights_date_idx ON etf_insights (insight_date DESC, published_at DESC);
