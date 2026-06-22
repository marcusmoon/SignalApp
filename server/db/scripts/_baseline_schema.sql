-- =============================================================================
-- SCHEMA
-- =============================================================================

-- SIGNAL PostgreSQL consolidated schema (end state after V1–V29).
-- No data seeds. Tables concall_transcripts and quant_signal_items are omitted (dropped V11/V12).

-- ---------------------------------------------------------------------------
-- Core settings & admin
-- ---------------------------------------------------------------------------

CREATE TABLE signal_meta (
  name text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE app_settings (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE admin_users (
  id text PRIMARY KEY,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE provider_settings (
  provider text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE translation_settings (
  locale text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  provider text,
  enabled boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE ui_model_presets (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

-- ---------------------------------------------------------------------------
-- App users & auth
-- ---------------------------------------------------------------------------

CREATE TABLE app_users (
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

CREATE TABLE app_user_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE app_user_refresh_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  refresh_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE app_user_identities (
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

CREATE TABLE app_user_account_events (
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

CREATE TABLE app_user_devices (
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

CREATE TABLE app_user_email_change_requests (
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

-- ---------------------------------------------------------------------------
-- Legal
-- ---------------------------------------------------------------------------

CREATE TABLE legal_terms (
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

CREATE TABLE app_user_terms_acceptances (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  term_type text NOT NULL,
  locale text NOT NULL,
  version text NOT NULL,
  accepted_at timestamptz NOT NULL,
  UNIQUE(user_id, term_type, locale, version)
);

-- ---------------------------------------------------------------------------
-- News sources & jobs
-- ---------------------------------------------------------------------------

CREATE TABLE news_source_settings (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE news_sources (
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

CREATE TABLE rss_sources (
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

CREATE TABLE polling_jobs (
  job_key text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT false,
  area text,
  stage text,
  domain text,
  operation text,
  provider text,
  handler text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE polling_job_locks (
  job_key text PRIMARY KEY REFERENCES polling_jobs(job_key) ON DELETE CASCADE,
  lock_token text NOT NULL,
  locked_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE polling_job_runs (
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

-- ---------------------------------------------------------------------------
-- News content
-- ---------------------------------------------------------------------------

CREATE TABLE news_items (
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

CREATE TABLE news_translations (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  news_item_id text REFERENCES news_items(id) ON DELETE CASCADE,
  locale text,
  status text,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE news_digest_items (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  category text,
  digest_date date,
  generated_at timestamptz,
  score numeric,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

-- ---------------------------------------------------------------------------
-- Calendar (structured, no payload — V26/V29)
-- ---------------------------------------------------------------------------

CREATE TABLE calendar_events (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  country text NOT NULL DEFAULT 'GLOBAL',
  event_type text NOT NULL,
  event_date date NOT NULL,
  event_at timestamptz,
  event_key text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT 'manual',
  provider_item_id text,
  time_label text,
  timezone text,
  symbol text,
  company_name text,
  source text NOT NULL DEFAULT 'manual',
  source_event_id text,
  importance text,
  impact text,
  actual numeric,
  estimate numeric,
  previous numeric,
  unit text,
  fiscal_year integer,
  fiscal_quarter integer,
  earnings_hour text,
  url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz NOT NULL,
  CONSTRAINT chk_calendar_events_type
    CHECK (event_type IN ('macro', 'fed', 'fomc', 'earnings', 'holiday'))
);

CREATE TABLE calendar_event_code_mappings (
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

-- ---------------------------------------------------------------------------
-- YouTube (structured, no payload — V27)
-- ---------------------------------------------------------------------------

CREATE TABLE youtube_videos (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  provider text NOT NULL DEFAULT 'youtube',
  provider_item_id text,
  video_id text,
  topic text,
  title text NOT NULL DEFAULT '',
  channel text,
  channel_id text,
  channel_handle text,
  description text NOT NULL DEFAULT '',
  duration text,
  view_count bigint NOT NULL DEFAULT 0,
  thumbnail_url text,
  sort_bucket text,
  sort_buckets text[] NOT NULL DEFAULT '{}',
  published_at timestamptz,
  fetched_at timestamptz,
  updated_at timestamptz NOT NULL
);

-- ---------------------------------------------------------------------------
-- Market data
-- ---------------------------------------------------------------------------

CREATE TABLE market_quotes (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  symbol text,
  segment text,
  display_symbol text,
  krx_symbol text,
  provider_item_id text,
  regular_yahoo_symbol text,
  quote_time timestamptz,
  fetched_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE coin_markets (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  symbol text,
  fetched_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE market_lists (
  list_key text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE price_series (
  symbol text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  display_symbol text,
  yahoo_symbol text,
  last_bar_date date,
  fetched_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE market_briefings (
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

-- ---------------------------------------------------------------------------
-- Disclosures (V23/V28)
-- ---------------------------------------------------------------------------

CREATE TABLE disclosures (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  market text,
  provider text,
  symbol text,
  company_name text,
  form_type text,
  filed_at timestamptz,
  period_end_date date,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE disclosure_digest_items (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  market text,
  digest_date date,
  generated_at timestamptz,
  score numeric,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

-- ---------------------------------------------------------------------------
-- Insights & notifications
-- ---------------------------------------------------------------------------

CREATE TABLE insight_items (
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

CREATE TABLE notification_items (
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

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Admin & users
CREATE INDEX idx_admin_users_active ON admin_users(active, id);
CREATE INDEX idx_app_users_created ON app_users(created_at DESC);
CREATE INDEX idx_app_user_sessions_user ON app_user_sessions(user_id, expires_at);
CREATE INDEX idx_app_user_refresh_user ON app_user_refresh_sessions(user_id, expires_at);
CREATE UNIQUE INDEX idx_app_user_refresh_device_active
  ON app_user_refresh_sessions(user_id, device_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_app_user_devices_user ON app_user_devices(user_id, active);
CREATE INDEX idx_app_user_devices_updated ON app_user_devices(updated_at DESC);
CREATE INDEX idx_app_user_identities_user ON app_user_identities(user_id, disconnected_at);
CREATE INDEX idx_app_user_account_events_user ON app_user_account_events(user_id, created_at DESC);
CREATE INDEX idx_app_user_account_events_type ON app_user_account_events(event_type, created_at DESC);
CREATE INDEX idx_app_user_account_events_identity ON app_user_account_events(identity_id, created_at DESC);
CREATE INDEX idx_app_user_email_change_user ON app_user_email_change_requests(user_id, expires_at);
CREATE INDEX idx_app_user_email_change_email ON app_user_email_change_requests(email, expires_at);
CREATE INDEX idx_app_user_terms_user ON app_user_terms_acceptances(user_id, accepted_at DESC);
CREATE INDEX idx_legal_terms_locale ON legal_terms(locale, active);
CREATE INDEX idx_legal_terms_type_locale ON legal_terms(type, locale, active, updated_at DESC);

-- Polling jobs
CREATE INDEX idx_polling_jobs_due ON polling_jobs(enabled, next_run_at);
CREATE INDEX idx_polling_jobs_domain ON polling_jobs(domain, provider, handler);
CREATE INDEX idx_polling_jobs_area_stage ON polling_jobs(area, stage, position);
CREATE INDEX idx_polling_job_runs_job ON polling_job_runs(job_key, started_at DESC);
CREATE INDEX idx_polling_job_runs_status ON polling_job_runs(status, started_at DESC);
CREATE INDEX idx_polling_job_locks_expires ON polling_job_locks(expires_at);

-- News
CREATE INDEX idx_news_items_published ON news_items(category, published_at DESC);
CREATE INDEX idx_news_items_source_published ON news_items(category, source_name, published_at DESC);
CREATE INDEX idx_news_items_provider_published ON news_items(provider, published_at DESC);
CREATE INDEX idx_news_items_fetched ON news_items(fetched_at DESC);
CREATE INDEX idx_news_items_published_position ON news_items(published_at DESC, position ASC);
CREATE INDEX idx_news_items_symbols_gin ON news_items USING GIN ((payload->'symbols'));
CREATE INDEX idx_news_items_hashtags_gin ON news_items USING GIN ((payload->'hashtags'));
CREATE INDEX idx_news_translations_item ON news_translations(news_item_id, locale);
CREATE INDEX idx_news_digest_items_category_date_score
  ON news_digest_items(category, digest_date DESC, score DESC, generated_at DESC);
CREATE INDEX idx_news_digest_items_generated_score
  ON news_digest_items(generated_at DESC, score DESC);
CREATE INDEX idx_news_digest_items_category_date_generated
  ON news_digest_items(category, digest_date DESC, generated_at DESC);

-- Calendar
CREATE UNIQUE INDEX uniq_calendar_events_identity
  ON calendar_events(country, event_type, event_key);
CREATE INDEX idx_calendar_events_country_type_date
  ON calendar_events(country, event_type, event_date, event_at);
CREATE INDEX idx_calendar_events_date_type_country
  ON calendar_events(event_date, event_type, country);
CREATE INDEX idx_calendar_events_symbol_date ON calendar_events(symbol, event_date);
CREATE INDEX idx_calendar_events_event_at ON calendar_events(event_at);
CREATE INDEX idx_calendar_event_code_mappings_lookup
  ON calendar_event_code_mappings(event_type, enabled, priority, code);

-- YouTube
CREATE INDEX idx_youtube_videos_published ON youtube_videos(channel, published_at DESC);
CREATE INDEX idx_youtube_videos_published_only ON youtube_videos(published_at DESC);
CREATE INDEX idx_youtube_videos_fetched ON youtube_videos(fetched_at DESC);
CREATE INDEX idx_youtube_videos_channel_handle_lower
  ON youtube_videos(lower(COALESCE(channel_handle, '')));
CREATE INDEX idx_youtube_videos_sort_buckets_gin ON youtube_videos USING GIN (sort_buckets);
CREATE INDEX idx_youtube_videos_view_count_num
  ON youtube_videos(view_count DESC, published_at DESC);

-- Market quotes & price series
CREATE INDEX idx_market_quotes_symbol ON market_quotes(symbol, segment);
CREATE INDEX idx_market_quotes_segment_symbol_fetch ON market_quotes(segment, symbol, fetched_at DESC);
CREATE INDEX idx_market_quotes_segment_fetch ON market_quotes(segment, fetched_at DESC);
CREATE INDEX idx_market_quotes_krx_symbol_upper
  ON market_quotes(upper(COALESCE(payload->>'krxSymbol', '')));
CREATE INDEX idx_market_quotes_display_symbol_upper
  ON market_quotes(upper(COALESCE(payload->>'displaySymbol', '')));
CREATE INDEX idx_market_quotes_regular_yahoo_upper
  ON market_quotes(upper(COALESCE(payload->'regularSession'->>'yahooSymbol', '')));
CREATE INDEX idx_market_quotes_symbol_upper ON market_quotes(upper(COALESCE(symbol, '')));
CREATE INDEX idx_market_quotes_provider_item_upper
  ON market_quotes(upper(COALESCE(payload->>'providerItemId', '')));
CREATE INDEX idx_market_quotes_symbol_upper_segment_fetch
  ON market_quotes(upper(COALESCE(symbol, '')), segment, fetched_at DESC);
CREATE INDEX idx_market_quotes_display_upper_segment_fetch
  ON market_quotes(upper(COALESCE(display_symbol, '')), segment, fetched_at DESC);
CREATE INDEX idx_market_quotes_krx_upper_segment_fetch
  ON market_quotes(upper(COALESCE(krx_symbol, '')), segment, fetched_at DESC);
CREATE INDEX idx_market_quotes_provider_item_upper_segment_fetch
  ON market_quotes(upper(COALESCE(provider_item_id, '')), segment, fetched_at DESC);
CREATE INDEX idx_market_quotes_regular_yahoo_upper_segment_fetch
  ON market_quotes(upper(COALESCE(regular_yahoo_symbol, '')), segment, fetched_at DESC);
CREATE INDEX idx_coin_markets_symbol ON coin_markets(symbol);
CREATE INDEX idx_coin_markets_fetched ON coin_markets(fetched_at DESC);
CREATE INDEX idx_coin_markets_market_cap_num ON coin_markets((
  CASE WHEN NULLIF(payload->>'marketCap', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
       THEN (payload->>'marketCap')::numeric ELSE 0 END
) DESC, fetched_at DESC);
CREATE INDEX idx_price_series_symbol ON price_series(symbol, last_bar_date DESC);
CREATE INDEX idx_price_series_fetched ON price_series(fetched_at DESC);
CREATE INDEX idx_price_series_symbol_upper ON price_series(upper(symbol));
CREATE INDEX idx_price_series_display_symbol_upper ON price_series(upper(COALESCE(display_symbol, '')));
CREATE INDEX idx_price_series_yahoo_symbol_upper ON price_series(upper(COALESCE(yahoo_symbol, '')));
CREATE INDEX idx_price_series_payload_krx_upper ON price_series(upper(COALESCE(payload->>'krxSymbol', '')));
CREATE INDEX idx_price_series_payload_display_upper ON price_series(upper(COALESCE(payload->>'displaySymbol', '')));
CREATE INDEX idx_price_series_payload_yahoo_upper ON price_series(upper(COALESCE(payload->>'yahooSymbol', '')));
CREATE INDEX idx_market_briefings_market_date_published
  ON market_briefings(market, briefing_date DESC, published_at DESC);
CREATE INDEX idx_market_briefings_session_date_published
  ON market_briefings(session, briefing_date DESC, published_at DESC);

-- Disclosures
CREATE INDEX idx_disclosures_filed ON disclosures(filed_at DESC, position ASC);
CREATE INDEX idx_disclosures_market_filed ON disclosures(market, filed_at DESC);
CREATE INDEX idx_disclosures_symbol_filed ON disclosures(symbol, filed_at DESC);
CREATE INDEX idx_disclosures_provider_filed ON disclosures(provider, filed_at DESC);
CREATE INDEX idx_disclosures_form_filed ON disclosures(form_type, filed_at DESC);
CREATE INDEX idx_disclosure_digest_market_date_score
  ON disclosure_digest_items(market, digest_date DESC, generated_at DESC, score DESC);
CREATE INDEX idx_disclosure_digest_generated
  ON disclosure_digest_items(generated_at DESC, score DESC);

-- Insights & notifications
CREATE INDEX idx_insight_items_generated ON insight_items(generated_at DESC, score DESC);
CREATE INDEX idx_insight_items_lookup ON insight_items(kind, level, push_candidate, generated_at DESC);
CREATE INDEX idx_insight_items_display ON insight_items(generated_date DESC, display_key, generated_at DESC);
CREATE INDEX idx_notification_items_status ON notification_items(status, scheduled_at);
CREATE INDEX idx_notification_items_type ON notification_items(type, status, scheduled_at);
CREATE INDEX idx_notification_items_user ON notification_items(app_user_id, status, scheduled_at);
CREATE INDEX idx_notification_items_user_schedule
  ON notification_items(app_user_id, status, scheduled_at DESC);
CREATE INDEX idx_notification_items_target ON notification_items(target_type, target_key, scheduled_at);
CREATE INDEX idx_notification_items_source ON notification_items(source_type, source_id);
