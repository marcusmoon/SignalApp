CREATE TABLE IF NOT EXISTS disclosure_digest_items (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  market text,
  digest_date date,
  generated_at timestamptz,
  score numeric,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disclosure_digest_market_date_score
  ON disclosure_digest_items(market, digest_date DESC, generated_at DESC, score DESC);

CREATE INDEX IF NOT EXISTS idx_disclosure_digest_generated
  ON disclosure_digest_items(generated_at DESC, score DESC);

-- 공시 다이제스트는 Cowork 스케줄이 AI로 생성해 /v1/disclosure-digests/ingest 로 POST함
-- 서버 polling_job 불필요
