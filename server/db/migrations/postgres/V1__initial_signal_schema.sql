-- SIGNAL PostgreSQL baseline schema.
-- Runtime code is still SQLite-backed until a PostgreSQL store adapter is added.
-- Keep payload columns as jsonb so existing collection payloads can move without losing fields,
-- while frequently queried attributes stay as typed columns for indexes.

CREATE TABLE IF NOT EXISTS signal_meta (
  name text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id text PRIMARY KEY,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_settings (
  provider text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS translation_settings (
  locale text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  provider text,
  enabled boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS ui_model_presets (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  nickname text NOT NULL,
  profile_image_url text,
  password_hash text,
  password_salt text,
  auth_provider text NOT NULL DEFAULT 'password',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app_user_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS app_user_refresh_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  refresh_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS app_user_identities (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  email text,
  display_name text,
  profile_image_url text,
  linked_at timestamptz,
  disconnected_at timestamptz,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS app_user_account_events (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'user',
  actor_id text,
  identity_id text,
  provider text,
  provider_user_id_hash text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS app_user_devices (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  platform text,
  push_token text,
  device_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(user_id, push_token)
);

CREATE TABLE IF NOT EXISTS app_user_email_change_requests (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  code_salt text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE IF NOT EXISTS legal_terms (
  id text PRIMARY KEY,
  type text NOT NULL,
  locale text NOT NULL,
  version text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(type, locale, version)
);

CREATE TABLE IF NOT EXISTS app_user_terms_acceptances (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  term_type text NOT NULL,
  locale text NOT NULL,
  version text NOT NULL,
  accepted_at timestamptz NOT NULL,
  UNIQUE(user_id, term_type, locale, version)
);

CREATE TABLE IF NOT EXISTS news_source_settings (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS news_sources (
  source_key text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  source_id text,
  category text,
  name text,
  enabled boolean NOT NULL DEFAULT true,
  hidden boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS rss_sources (
  source_id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  provider_id text,
  source_name text,
  category text,
  enabled boolean NOT NULL DEFAULT true,
  hidden boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS polling_jobs (
  job_key text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT false,
  domain text,
  operation text,
  provider text,
  handler text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS polling_job_locks (
  job_key text PRIMARY KEY REFERENCES polling_jobs(job_key) ON DELETE CASCADE,
  lock_token text NOT NULL,
  locked_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS polling_job_runs (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  job_key text REFERENCES polling_jobs(job_key) ON DELETE SET NULL,
  status text,
  trigger_type text,
  started_at timestamptz,
  finished_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS news_items (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  category text,
  provider text,
  source_name text,
  published_at timestamptz,
  fetched_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS news_translations (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  news_item_id text REFERENCES news_items(id) ON DELETE CASCADE,
  locale text,
  status text,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  event_date date,
  event_at timestamptz,
  event_type text,
  symbol text,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS concall_transcripts (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  symbol text,
  earnings_date date,
  fiscal_year integer,
  fiscal_quarter integer,
  fetched_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS youtube_videos (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  channel text,
  published_at timestamptz,
  fetched_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS market_quotes (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  symbol text,
  segment text,
  quote_time timestamptz,
  fetched_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS coin_markets (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  symbol text,
  fetched_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS market_lists (
  list_key text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS price_series (
  symbol text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  display_symbol text,
  yahoo_symbol text,
  last_bar_date date,
  fetched_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS quant_signal_items (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  symbol text,
  action text,
  level text,
  score integer,
  generated_date date,
  generated_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS insight_items (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  kind text,
  display_key text,
  level text,
  score integer,
  generated_date date,
  generated_at timestamptz,
  expires_at timestamptz,
  push_candidate boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_items (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  type text,
  channel text,
  status text,
  priority text,
  title text,
  app_user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  target_type text,
  target_key text,
  scheduled_at timestamptz,
  expires_at timestamptz,
  sent_at timestamptz,
  source_type text,
  source_id text,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(active, id);
CREATE INDEX IF NOT EXISTS idx_polling_jobs_due ON polling_jobs(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_polling_jobs_domain ON polling_jobs(domain, provider, handler);
CREATE INDEX IF NOT EXISTS idx_polling_job_runs_job ON polling_job_runs(job_key, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_polling_job_runs_status ON polling_job_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_polling_job_locks_expires ON polling_job_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_app_user_sessions_user ON app_user_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_app_user_refresh_user ON app_user_refresh_sessions(user_id, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_refresh_device_active
  ON app_user_refresh_sessions(user_id, device_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_app_user_devices_user ON app_user_devices(user_id, active);
CREATE INDEX IF NOT EXISTS idx_legal_terms_locale ON legal_terms(locale, active);
CREATE INDEX IF NOT EXISTS idx_legal_terms_type_locale ON legal_terms(type, locale, active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_user_identities_user ON app_user_identities(user_id, disconnected_at);
CREATE INDEX IF NOT EXISTS idx_app_user_account_events_user ON app_user_account_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_user_account_events_type ON app_user_account_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_user_account_events_identity ON app_user_account_events(identity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_user_email_change_user ON app_user_email_change_requests(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_app_user_email_change_email ON app_user_email_change_requests(email, expires_at);
CREATE INDEX IF NOT EXISTS idx_app_user_terms_user ON app_user_terms_acceptances(user_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items(category, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_source_published ON news_items(category, source_name, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_provider_published ON news_items(provider, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_fetched ON news_items(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_translations_item ON news_translations(news_item_id, locale);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date, event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type_date ON calendar_events(event_type, event_date, event_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_symbol_date ON calendar_events(symbol, event_date);
CREATE INDEX IF NOT EXISTS idx_concall_transcripts_symbol ON concall_transcripts(symbol, earnings_date);
CREATE INDEX IF NOT EXISTS idx_concall_transcripts_date ON concall_transcripts(earnings_date);
CREATE INDEX IF NOT EXISTS idx_concall_transcripts_period ON concall_transcripts(fiscal_year, fiscal_quarter, earnings_date);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON youtube_videos(channel, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_published_only ON youtube_videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_fetched ON youtube_videos(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_quotes_symbol ON market_quotes(symbol, segment);
CREATE INDEX IF NOT EXISTS idx_market_quotes_segment_symbol_fetch ON market_quotes(segment, symbol, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_quotes_segment_fetch ON market_quotes(segment, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_markets_symbol ON coin_markets(symbol);
CREATE INDEX IF NOT EXISTS idx_coin_markets_fetched ON coin_markets(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_series_symbol ON price_series(symbol, last_bar_date DESC);
CREATE INDEX IF NOT EXISTS idx_price_series_fetched ON price_series(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_quant_signal_items_symbol ON quant_signal_items(symbol, generated_date DESC);
CREATE INDEX IF NOT EXISTS idx_quant_signal_items_generated ON quant_signal_items(generated_date DESC, score DESC);
CREATE INDEX IF NOT EXISTS idx_insight_items_generated ON insight_items(generated_at DESC, score DESC);
CREATE INDEX IF NOT EXISTS idx_insight_items_lookup ON insight_items(kind, level, push_candidate, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_insight_items_display ON insight_items(generated_date DESC, display_key, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_items_status ON notification_items(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_items_type ON notification_items(type, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_items_user ON notification_items(app_user_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_items_target ON notification_items(target_type, target_key, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_items_source ON notification_items(source_type, source_id);
