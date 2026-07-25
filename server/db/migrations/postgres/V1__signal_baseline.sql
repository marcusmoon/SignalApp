-- SIGNAL PostgreSQL baseline (schema + runtime seed).
-- Squashed end-state through former V23 (prior baseline was historical V1–V29).
-- Fresh DBs: flyway migrate from this file only.
-- Existing DBs: flyway clean + migrate, or drop/recreate — do not apply over an old V23 history.
-- Prior incrementals: server/db/migrations/_archive/postgres/

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
  updated_at timestamptz NOT NULL,
  notification_prefs jsonb NOT NULL DEFAULT '{"pushEnabled":true,"briefingPushEnabled":true}'::jsonb
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
,
  type_category text
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
-- Notifications
-- ---------------------------------------------------------------------------

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
-- Today briefings, community, notification inbox/state, ETF insights
-- ---------------------------------------------------------------------------

CREATE TABLE today_briefings (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  locale text NOT NULL DEFAULT 'ko',
  briefing_date date NOT NULL,
  published_at timestamptz NOT NULL,
  generated_at timestamptz,
  status text NOT NULL DEFAULT 'published',
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX idx_today_briefings_locale_date_published
  ON today_briefings(locale, briefing_date DESC, published_at DESC);

CREATE INDEX idx_today_briefings_status_published
  ON today_briefings(status, published_at DESC);

CREATE TABLE community_posts (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  source text NOT NULL,
  provider text NOT NULL,
  provider_item_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  source_url text,
  published_at timestamptz,
  fetched_at timestamptz,
  updated_at timestamptz NOT NULL,
  UNIQUE (source, provider_item_id)
);

CREATE INDEX idx_community_posts_source_published
  ON community_posts (source, published_at DESC);

CREATE INDEX idx_community_posts_published
  ON community_posts (published_at DESC);

CREATE TABLE user_notification_inbox (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  notification_id text NOT NULL REFERENCES notification_items(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uq_user_notification_inbox_user_notification UNIQUE (user_id, notification_id)
);

CREATE INDEX idx_user_notification_inbox_user_list
  ON user_notification_inbox (user_id, deleted_at, delivered_at DESC);

CREATE INDEX idx_user_notification_inbox_user_unread
  ON user_notification_inbox (user_id, read_at)
  WHERE deleted_at IS NULL;

CREATE TABLE user_notification_state (
  user_id text PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  last_notification_id text REFERENCES notification_items(id) ON DELETE SET NULL,
  last_delivered_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

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
CREATE INDEX idx_disclosures_type_category_filed
  ON disclosures (type_category, filed_at DESC);
CREATE INDEX idx_disclosure_digest_market_date_score
  ON disclosure_digest_items(market, digest_date DESC, generated_at DESC, score DESC);
CREATE INDEX idx_disclosure_digest_generated
  ON disclosure_digest_items(generated_at DESC, score DESC);

-- Notifications
CREATE INDEX idx_notification_items_status ON notification_items(status, scheduled_at);
CREATE INDEX idx_notification_items_type ON notification_items(type, status, scheduled_at);
CREATE INDEX idx_notification_items_user ON notification_items(app_user_id, status, scheduled_at);
CREATE INDEX idx_notification_items_user_schedule
  ON notification_items(app_user_id, status, scheduled_at DESC);
CREATE INDEX idx_notification_items_target ON notification_items(target_type, target_key, scheduled_at);
CREATE INDEX idx_notification_items_source ON notification_items(source_type, source_id);

-- =============================================================================
-- RUNTIME SEED (provider keys blank; configure in Admin)
-- =============================================================================

INSERT INTO signal_meta (name, payload, updated_at) VALUES ('db', $json$
{
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-07T00:00:00.000Z",
  "schemaVersion": 1,
  "migrationBaseline": "V1-squash-v23",
  "rssSourcesCatalogVersion": 1
}$json$::jsonb, '2026-06-07T00:00:00.000Z');
INSERT INTO app_settings (id, payload, updated_at) VALUES ('app', $json$
{
  "marketQuotesMaxAgeSec": 10,
  "youtubeCurationHandles": [
    "futuresnow",
    "LikeUSStock",
    "t3chfeed",
    "unrealtech",
    "lucky_tv"
  ],
  "ads": {
    "enabled": true,
    "scope": "global"
  },
  "updatedAt": "2026-06-07T00:00:00.000Z"
}$json$::jsonb, '2026-06-07T00:00:00.000Z');
INSERT INTO ui_model_presets (id, payload, updated_at) VALUES ('default', $json$
{
  "openai": [
    "gpt-4o-mini"
  ],
  "claude": [
    "claude-3-5-haiku-latest"
  ],
  "mock": [
    "mock-news-v1"
  ],
  "updatedAt": "2026-06-07T00:00:00.000Z"
}$json$::jsonb, '2026-06-07T00:00:00.000Z');
INSERT INTO news_source_settings (id, payload, updated_at) VALUES ('default', $json$
{
  "autoEnableNewSources": {
    "global": true,
    "crypto": true
  },
  "aliases": {
    "global": {},
    "crypto": {}
  },
  "updatedAt": "2026-06-07T00:00:00.000Z"
}$json$::jsonb, '2026-06-07T00:00:00.000Z');

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  { "provider": "finnhub", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "openai", "enabled": true, "apiKey": "", "defaultModel": "gpt-4o-mini", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "claude", "enabled": true, "apiKey": "", "defaultModel": "claude-3-5-haiku-latest", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "youtube", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "ninjas", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "coingecko", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "sec", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "rss", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "dart", "enabled": true, "apiKey": "", "updatedAt": "2026-06-19T00:00:00.000Z" }
]$json$::jsonb) WITH ORDINALITY
)
INSERT INTO provider_settings (provider, position, enabled, payload, updated_at)
SELECT payload->>'provider', position - 1,
  COALESCE((payload->>'enabled')::boolean, true), payload,
  COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz)
FROM rows;

WITH rows AS (SELECT value AS payload, ordinality::int AS position FROM jsonb_array_elements($json$
[
  {
    "locale": "ko",
    "provider": "openai",
    "enabled": true,
    "autoTranslateNews": false,
    "updatedAt": "2026-07-01T00:00:00.000Z"
  },
  {
    "locale": "ja",
    "provider": "mock",
    "enabled": false,
    "autoTranslateNews": false,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY)
INSERT INTO translation_settings (locale, position, provider, enabled, payload, updated_at)
SELECT payload->>'locale', position - 1, payload->>'provider', COALESCE((payload->>'enabled')::boolean, true), payload, COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz) FROM rows
ON CONFLICT (locale) DO NOTHING;

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "id": "financial_juice",
    "name": "Financial Juice",
    "providerId": "financial_juice",
    "sourceName": "Financial Juice",
    "feedUrl": "https://www.financialjuice.com/feed.ashx?xy=rss",
    "category": "global",
    "enabled": true,
    "hidden": false,
    "order": 1,
    "defaultLimit": 40,
    "daysBack": 0,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "id": "globenewswire_earnings",
    "name": "GlobeNewswire 실적",
    "providerId": "globenewswire",
    "sourceName": "GlobeNewswire",
    "feedUrl": "https://www.globenewswire.com/RssFeed/subjectcode/13-Earnings%20Releases%20and%20Operating%20Results/feedTitle/GlobeNewswire%20-%20Earnings%20Releases%20and%20Operating%20Results",
    "category": "earnings",
    "enabled": false,
    "hidden": true,
    "order": 2,
    "defaultLimit": 40,
    "daysBack": 7,
    "includeKeywords": [
      "earnings",
      "results",
      "revenue",
      "guidance",
      "quarter"
    ],
    "excludeKeywords": [],
    "updatedAt": "2026-07-23T00:00:00.000Z"
  },
  {
    "id": "prnewswire_earnings",
    "name": "PR Newswire 실적",
    "providerId": "prnewswire",
    "sourceName": "PR Newswire",
    "feedUrl": "https://www.prnewswire.com/rss/news-releases-list.rss",
    "category": "earnings",
    "enabled": false,
    "hidden": true,
    "order": 3,
    "defaultLimit": 40,
    "daysBack": 7,
    "includeKeywords": [
      "earnings",
      "results",
      "revenue",
      "guidance",
      "quarter"
    ],
    "excludeKeywords": [],
    "updatedAt": "2026-07-23T00:00:00.000Z"
  },
  {
    "id": "mk_economy",
    "name": "매일경제 경제",
    "providerId": "mk",
    "sourceName": "매일경제",
    "feedUrl": "https://www.mk.co.kr/rss/30100041/",
    "category": "korea",
    "enabled": true,
    "hidden": false,
    "order": 4,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-06-19T00:00:00.000Z"
  },
  {
    "id": "mk_securities",
    "name": "매일경제 증권",
    "providerId": "mk",
    "sourceName": "매일경제",
    "feedUrl": "https://www.mk.co.kr/rss/50200011/",
    "category": "korea",
    "enabled": true,
    "hidden": false,
    "order": 5,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-06-19T00:00:00.000Z"
  },
  {
    "id": "hankyung_economy",
    "name": "한국경제 경제",
    "providerId": "hankyung",
    "sourceName": "한국경제",
    "feedUrl": "https://www.hankyung.com/feed/economy",
    "category": "korea",
    "enabled": true,
    "hidden": false,
    "order": 6,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-07-11T00:00:00.000Z"
  },
  {
    "id": "hankyung_finance",
    "name": "한국경제 증권",
    "providerId": "hankyung",
    "sourceName": "한국경제",
    "feedUrl": "https://www.hankyung.com/feed/finance",
    "category": "korea",
    "enabled": true,
    "hidden": false,
    "order": 7,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-07-11T00:00:00.000Z"
  },
  {
    "id": "geeknews",
    "name": "GeekNews",
    "providerId": "geeknews",
    "sourceName": "GeekNews",
    "feedUrl": "https://news.hada.io/rss/news",
    "category": "it",
    "enabled": true,
    "hidden": false,
    "order": 1,
    "defaultLimit": 40,
    "daysBack": 3,
    "includeKeywords": [],
    "excludeKeywords": [],
    "updatedAt": "2026-07-18T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO rss_sources (source_id, position, provider_id, source_name, category, enabled, hidden, payload, updated_at)
SELECT payload->>'id', position - 1, payload->>'providerId', payload->>'sourceName', payload->>'category',
  COALESCE((payload->>'enabled')::boolean, true), COALESCE((payload->>'hidden')::boolean, false),
  payload, COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz)
FROM rows;

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "jobKey": "market_news_global",
    "displayName": "글로벌 뉴스 · Finnhub",
    "description": "글로벌 뉴스(Finnhub general). Financial Juice와 함께 수집. 매체·티커 보강용. 실적 PR RSS는 쓰지 않는다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "sync",
    "provider": "finnhub",
    "handler": "market_news",
    "enabled": true,
    "intervalSeconds": 1800,
    "params": {
      "category": "general",
      "reconcile": {}
    },
    "updatedAt": "2026-07-23T00:00:00.000Z",
    "lockTtlSeconds": 900,
    "staleLockSeconds": 1800
  },
  {
    "jobKey": "market_news_crypto",
    "displayName": "크립토 뉴스 수집·보정",
    "description": "Finnhub 크립토 뉴스를 수집한 뒤 같은 실행에서 보정 구간을 다시 조회합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "sync",
    "provider": "finnhub",
    "handler": "market_news",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "category": "crypto",
      "reconcile": {}
    },
    "updatedAt": "2026-06-17T12:00:00.000Z",
    "lockTtlSeconds": 900,
    "staleLockSeconds": 1800
  },
  {
    "jobKey": "market_news_financial_juice",
    "displayName": "글로벌 뉴스 · Financial Juice",
    "description": "글로벌 뉴스 실시간 와이어(Financial Juice RSS). Finnhub general과 함께 수집. 실적 PR RSS는 쓰지 않는다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "sync",
    "provider": "rss",
    "handler": "financial_juice",
    "enabled": true,
    "intervalSeconds": 300,
    "params": {
      "rssSourceId": "financial_juice",
      "limit": 40,
      "reconcile": {
        "limit": 60
      }
    },
    "updatedAt": "2026-07-23T00:00:00.000Z",
    "lockTtlSeconds": 900,
    "staleLockSeconds": 1800
  },
  {
    "jobKey": "market_news_sec_edgar_filings",
    "displayName": "SEC EDGAR 공시 수집",
    "description": "관심종목의 SEC 주요 공시(8-K, 10-Q, 10-K 등)를 공시 자료로 저장합니다.",
    "area": "disclosures",
    "stage": "ingest",
    "domain": "disclosures",
    "operation": "latest",
    "provider": "sec",
    "handler": "company_filings",
    "enabled": false,
    "intervalSeconds": 3600,
    "params": {
      "listKey": "default_watchlist",
      "forms": [
        "8-K",
        "10-Q",
        "10-K",
        "S-1",
        "6-K",
        "20-F"
      ],
      "daysBack": 14,
      "limitPerSymbol": 5,
      "requestDelayMs": 150
    },
    "updatedAt": "2026-06-20T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_globenewswire_earnings",
    "displayName": "뉴스와이어 실적 RSS (비활성)",
    "description": "비활성. 실적 일정은 calendar_earnings(Finnhub). Globe/PR 실적 보도자료는 뉴스 피드에 넣지 않는다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "latest",
    "provider": "rss",
    "handler": "newswire_rss",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "rssSourceId": "globenewswire_earnings",
      "rssSourceIds": [
        "globenewswire_earnings",
        "prnewswire_earnings"
      ],
      "limit": 40,
      "daysBack": 7,
      "includeKeywords": [
        "earnings",
        "results",
        "revenue",
        "guidance",
        "quarter"
      ]
    },
    "updatedAt": "2026-07-23T00:00:00.000Z"
  },
  {
    "jobKey": "calendar_economic",
    "displayName": "경제지표 수집·보정",
    "description": "경제지표 일정을 수집한 뒤 넓은 구간으로 다시 조회해 actual/estimate 변경을 반영합니다.",
    "area": "calendar",
    "stage": "ingest",
    "domain": "calendar",
    "operation": "sync",
    "provider": "finnhub",
    "handler": "economic_calendar",
    "enabled": true,
    "intervalSeconds": 1800,
    "params": {
      "daysBack": 1,
      "daysAhead": 14,
      "reconcile": {
        "daysBack": 7,
        "daysAhead": 30
      }
    },
    "updatedAt": "2026-06-17T12:00:00.000Z",
    "lockTtlSeconds": 600,
    "staleLockSeconds": 1200
  },
  {
    "jobKey": "calendar_earnings",
    "displayName": "실적 캘린더 수집·보정",
    "description": "실적 발표 일정을 수집·보정한다(EPS/시각). 앱 투자 캘린더 earnings. 뉴스와이어 실적 PR는 수집하지 않는다.",
    "area": "calendar",
    "stage": "ingest",
    "domain": "calendar",
    "operation": "sync",
    "provider": "finnhub",
    "handler": "earnings_calendar",
    "enabled": false,
    "intervalSeconds": 21600,
    "lockTtlSeconds": 600,
    "staleLockSeconds": 600,
    "params": {
      "daysBack": 3,
      "daysAhead": 30,
      "reconcile": {
        "daysBack": 14,
        "daysAhead": 45
      }
    },
    "updatedAt": "2026-07-23T00:00:00.000Z"
  },
  {
    "jobKey": "youtube_economy_latest",
    "displayName": "경제 유튜브 수집·보정",
    "description": "경제/시장 채널 최신 영상을 수집한 뒤 저장된 영상 메타를 다시 조회해 보정합니다.",
    "area": "youtube",
    "stage": "ingest",
    "domain": "youtube",
    "operation": "sync",
    "provider": "youtube",
    "handler": "youtube_economy",
    "enabled": false,
    "intervalSeconds": 1800,
    "params": {
      "order": "date",
      "reconcile": {
        "limit": 80
      }
    },
    "updatedAt": "2026-06-17T12:00:00.000Z",
    "lockTtlSeconds": 900,
    "staleLockSeconds": 1800
  },
  {
    "jobKey": "youtube_economy_popular",
    "displayName": "경제 유튜브 인기 수집",
    "description": "설정된 경제/시장 채널의 인기 영상을 조회수 기준으로 가져옵니다.",
    "area": "youtube",
    "stage": "ingest",
    "domain": "youtube",
    "operation": "popular",
    "provider": "youtube",
    "handler": "youtube_economy",
    "enabled": false,
    "intervalSeconds": 21600,
    "params": {
      "order": "viewCount"
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_popular",
    "displayName": "인기 종목 시세",
    "description": "인기 종목 리스트의 실시간 시세를 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_quotes",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "segment": "popular",
      "listKey": "popular_symbols"
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_watchlist",
    "displayName": "관심종목 시세",
    "description": "기본 관심종목 리스트의 실시간 시세를 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_quotes",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "segment": "watchlist",
      "listKey": "default_watchlist"
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_mcap_universe",
    "displayName": "시총 유니버스 갱신",
    "description": "시총 상위 종목 유니버스를 갱신해 시총 시세 Job의 기준 리스트로 사용합니다.",
    "area": "market",
    "stage": "maintain",
    "domain": "market",
    "operation": "reconcile",
    "provider": "finnhub",
    "handler": "market_quotes_mcap_universe",
    "enabled": false,
    "intervalSeconds": 86400,
    "params": {
      "sourceListKey": "mcap_universe",
      "targetListKey": "mcap_top_symbols"
    },
    "updatedAt": "2026-06-17T12:00:00.000Z",
    "lockTtlSeconds": 1200,
    "staleLockSeconds": 2400
  },
  {
    "jobKey": "market_quotes_mcap",
    "displayName": "시총 상위 시세",
    "description": "시총 상위 종목의 실시간 시세를 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_quotes_mcap",
    "enabled": false,
    "intervalSeconds": 900,
    "params": {
      "segment": "mcap",
      "listKey": "mcap_top_symbols"
    },
    "updatedAt": "2026-06-17T12:00:00.000Z",
    "lockTtlSeconds": 1200,
    "staleLockSeconds": 2400
  },
  {
    "jobKey": "market_coins_top",
    "displayName": "코인 시세 Top",
    "description": "CoinGecko 상위 코인 시세를 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "coingecko",
    "handler": "coin_markets",
    "enabled": false,
    "intervalSeconds": 300,
    "params": {
      "vsCurrency": "usd",
      "perPage": 50,
      "page": 1
    },
    "updatedAt": "2026-06-17T12:00:00.000Z"
  },
  {
    "jobKey": "market_price_series_daily",
    "displayName": "주식 일봉 추세 저장",
    "description": "인기·시총·기본·국내 관심종목의 Yahoo 일봉 OHLCV를 저장해 종목 상세 차트에 사용합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "yahoo",
    "handler": "daily_bars",
    "enabled": true,
    "intervalSeconds": 21600,
    "lockTtlSeconds": 900,
    "staleLockSeconds": 900,
    "params": {
      "range": "1y",
      "requestDelayMs": 120,
      "listKeys": [
        "popular_symbols",
        "mcap_top_symbols",
        "default_watchlist",
        "korea_watchlist"
      ]
    },
    "updatedAt": "2026-07-16T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_mk_rss",
    "displayName": "국내 경제지 RSS 수집·보정",
    "description": "매일경제·한국경제 경제·증권 RSS를 수집한 뒤 같은 실행에서 항목을 다시 읽어 보정합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "sync",
    "provider": "rss",
    "handler": "newswire_rss",
    "enabled": true,
    "intervalSeconds": 900,
    "params": {
      "rssSourceIds": [
        "mk_economy",
        "mk_securities",
        "hankyung_economy",
        "hankyung_finance"
      ],
      "limit": 40,
      "daysBack": 3,
      "reconcile": {
        "limit": 60
      }
    },
    "updatedAt": "2026-07-11T00:00:00.000Z",
    "lockTtlSeconds": 900,
    "staleLockSeconds": 1800
  },
  {
    "jobKey": "market_news_dart_filings",
    "displayName": "DART 공시 수집",
    "description": "국내 관심종목의 DART 주요 공시를 공시 자료로 저장합니다.",
    "area": "disclosures",
    "stage": "ingest",
    "domain": "disclosures",
    "operation": "latest",
    "provider": "dart",
    "handler": "company_filings",
    "enabled": true,
    "intervalSeconds": 3600,
    "params": {
      "listKey": "korea_watchlist",
      "pblntfTy": [
        "B",
        "C",
        "D",
        "I"
      ],
      "daysBack": 14,
      "limitPerSymbol": 8,
      "requestDelayMs": 200
    },
    "updatedAt": "2026-06-20T00:00:00.000Z"
  },
  {
    "jobKey": "calendar_holidays",
    "displayName": "거래소 휴장일 수집",
    "description": "Finnhub에서 미국(US) 거래소 휴장일을 조회해 투자 캘린더에 저장합니다.",
    "area": "calendar",
    "stage": "ingest",
    "domain": "calendar",
    "operation": "latest",
    "provider": "finnhub",
    "handler": "market_holidays",
    "enabled": true,
    "intervalSeconds": 86400,
    "lockTtlSeconds": 600,
    "staleLockSeconds": 600,
    "params": {
      "daysBack": 1,
      "daysAhead": 365,
      "exchanges": [
        {
          "exchange": "US",
          "country": "US"
        }
      ]
    },
    "lastRunAt": null,
    "nextRunAt": null,
    "updatedAt": "2026-06-17T00:00:00.000Z"
  },
  {
    "jobKey": "community_naver_likeusstock_free",
    "displayName": "미주미 자유게시판",
    "description": "네이버 카페 미주미(likeusstock) 자유게시판 글을 수집합니다.",
    "area": "community",
    "stage": "ingest",
    "domain": "community",
    "operation": "sync",
    "provider": "naver_cafe",
    "handler": "likeusstock_free",
    "enabled": true,
    "intervalSeconds": 1800,
    "params": {
      "pageSize": 30
    },
    "updatedAt": "2026-07-04T00:00:00.000Z"
  },
  {
    "jobKey": "community_save_user_news",
    "displayName": "세이브 유저뉴스",
    "description": "세이브(SAVE) 커뮤니티 유저뉴스 글을 수집합니다.",
    "area": "community",
    "stage": "ingest",
    "domain": "community",
    "operation": "sync",
    "provider": "save",
    "handler": "user_news",
    "enabled": true,
    "intervalSeconds": 1800,
    "params": {
      "pageSize": 30
    },
    "updatedAt": "2026-07-04T00:00:00.000Z"
  },
  {
    "jobKey": "market_quotes_korea",
    "displayName": "국내 종목 시세",
    "description": "korea_watchlist의 KRX 6자리 종목을 Yahoo(.KS→.KQ)로 조회해 market_quotes에 저장합니다.",
    "area": "market",
    "stage": "ingest",
    "domain": "market",
    "operation": "latest",
    "provider": "yahoo",
    "handler": "market_quotes_kr",
    "enabled": true,
    "intervalSeconds": 300,
    "params": {
      "segment": "korea",
      "listKey": "korea_watchlist"
    },
    "updatedAt": "2026-07-16T00:00:00.000Z"
  },
  {
    "jobKey": "market_news_it_rss",
    "displayName": "IT 뉴스 RSS 수집·보정",
    "description": "GeekNews(news.hada.io) Atom 피드를 수집한 뒤 같은 실행에서 항목을 다시 읽어 보정합니다.",
    "area": "news",
    "stage": "ingest",
    "domain": "news",
    "operation": "sync",
    "provider": "rss",
    "handler": "newswire_rss",
    "enabled": true,
    "intervalSeconds": 900,
    "params": {
      "rssSourceIds": [
        "geeknews"
      ],
      "limit": 40,
      "daysBack": 3,
      "reconcile": {
        "limit": 60
      }
    },
    "updatedAt": "2026-07-18T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO polling_jobs (
  job_key, position, enabled, area, stage, domain, operation, provider, handler,
  next_run_at, last_run_at, payload, updated_at
)
SELECT
  payload->>'jobKey', position - 1,
  COALESCE((payload->>'enabled')::boolean, false),
  payload->>'area', payload->>'stage',
  payload->>'domain', payload->>'operation', payload->>'provider', payload->>'handler',
  NULL, NULL, payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM rows;

WITH rows AS (SELECT value AS payload, ordinality::int AS position FROM jsonb_array_elements($json$
[
  {
    "key": "mega_cap",
    "displayName": "메가캡 리스트",
    "description": "캘린더·컨콜에서 메가캡 필터 기준으로 쓰는 미국 대형주 리스트입니다.",
    "symbols": [
      "AAPL",
      "MSFT",
      "GOOGL",
      "GOOG",
      "AMZN",
      "NVDA",
      "META",
      "TSLA",
      "BRK.B",
      "AVGO",
      "UNH",
      "XOM",
      "JNJ",
      "JPM",
      "V",
      "PG",
      "MA",
      "HD",
      "CVX",
      "MRK",
      "ABBV",
      "PEP",
      "COST",
      "ADBE",
      "TMO",
      "CSCO",
      "ACN",
      "NFLX",
      "DHR",
      "LIN",
      "AMD",
      "MCD",
      "WMT",
      "DIS",
      "ORCL",
      "BAC",
      "CRM",
      "PM",
      "INTU",
      "TXN",
      "QCOM",
      "IBM",
      "AMAT",
      "COP",
      "GE",
      "HON",
      "CAT",
      "AMGN",
      "SPGI",
      "BKNG",
      "BLK",
      "SBUX",
      "GILD",
      "ISRG",
      "MDT",
      "ADI",
      "VRTX",
      "PANW",
      "MU",
      "LRCX",
      "SYK",
      "DE",
      "REGN",
      "ZTS",
      "ETN",
      "KLAC",
      "SNPS",
      "CDNS",
      "MELI",
      "CMCSA"
    ],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "key": "mcap_universe",
    "displayName": "시총 산정 후보",
    "description": "시총 상위 시세 Job이 profile 조회 후 정렬할 후보 종목입니다.",
    "symbols": [
      "AAPL",
      "MSFT",
      "GOOGL",
      "AMZN",
      "NVDA",
      "META",
      "AVGO",
      "TSLA",
      "BRK-B",
      "JPM",
      "WMT",
      "UNH",
      "XOM",
      "JNJ",
      "V",
      "PG",
      "MA",
      "ORCL",
      "COST",
      "HD",
      "ABBV",
      "BAC",
      "KO",
      "NFLX",
      "AMD",
      "LLY",
      "MRK",
      "PEP",
      "TMO",
      "ABT",
      "DHR",
      "CSCO",
      "ACN",
      "DIS",
      "CMCSA",
      "NKE",
      "PM",
      "TXN",
      "LIN",
      "QCOM",
      "AMGN",
      "HON",
      "UPS",
      "LOW",
      "SBUX",
      "AMAT",
      "INTU",
      "ISRG",
      "BKNG",
      "ADBE",
      "GE",
      "CAT",
      "DE",
      "GS",
      "MS",
      "BLK",
      "SCHW",
      "SPGI",
      "MDT",
      "ZTS",
      "CI",
      "SYK",
      "MO",
      "PFE",
      "T",
      "CME",
      "EQIX",
      "ICE",
      "AXP",
      "TJX",
      "REGN",
      "CL",
      "EL",
      "NEE",
      "DUK",
      "SO",
      "PLD",
      "MMC",
      "CB",
      "AON",
      "ECL",
      "SHW",
      "ITW",
      "EMR",
      "FCX",
      "OXY",
      "MET",
      "PYPL",
      "CRWD",
      "NOW",
      "UBER",
      "ABNB",
      "LRCX",
      "MU",
      "ADI",
      "SNPS",
      "CDNS",
      "PANW",
      "FTNT",
      "MMM",
      "RTX",
      "BA",
      "LMT"
    ],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "key": "mcap_top_symbols",
    "displayName": "시총 상위 확정 종목",
    "description": "시총 산정 후보를 profile로 정렬한 뒤 quote 수집에 사용하는 확정 종목입니다.",
    "symbols": [
      "AAPL",
      "MSFT",
      "GOOGL",
      "AMZN",
      "NVDA",
      "META",
      "AVGO",
      "TSLA",
      "BRK-B",
      "JPM",
      "WMT",
      "UNH",
      "XOM",
      "JNJ",
      "V",
      "PG",
      "MA",
      "ORCL",
      "COST",
      "HD"
    ],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "key": "popular_symbols",
    "displayName": "인기 시세 종목",
    "description": "인기 시세 최신 수집 Job과 앱 인기 탭에서 공유할 종목 순서입니다.",
    "symbols": [
      "NVDA",
      "TSLA",
      "AAPL",
      "AMD",
      "META",
      "AMZN",
      "GOOGL",
      "MSFT",
      "MSTR",
      "COIN",
      "PLTR",
      "SPY",
      "QQQ",
      "IWM",
      "BRK-B",
      "JPM",
      "NFLX",
      "UNH",
      "AVGO",
      "XOM"
    ],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "key": "default_watchlist",
    "displayName": "기본 관심종목",
    "description": "신규 사용자 또는 관심종목 초기화 시 사용할 기본 종목입니다.",
    "symbols": [
      "NVDA",
      "GOOGL",
      "AAPL",
      "TSLA",
      "BMNR",
      "MU",
      "PLTR",
      "CRCL",
      "SPY",
      "QQQ"
    ],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "key": "korea_watchlist",
    "displayName": "국내 관심종목",
    "description": "DART 공시·국내 시세(Yahoo) Job에서 쓰는 KRX 6자리 종목 목록입니다.",
    "symbols": [
      "005930",
      "000660",
      "402340",
      "005380",
      "009150",
      "373220",
      "032830",
      "028260",
      "329180",
      "105560",
      "012330",
      "000270",
      "207940",
      "034020",
      "012450",
      "055550",
      "066570",
      "006400",
      "034730",
      "035420"
    ],
    "updatedAt": "2026-07-16T00:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY)
INSERT INTO market_lists (list_key, position, payload, updated_at)
SELECT payload->>'key', position - 1, payload, COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz) FROM rows
ON CONFLICT (list_key) DO NOTHING;

WITH rows AS (SELECT value AS payload FROM jsonb_array_elements($json$
[
  {
    "type": "service",
    "locale": "ko",
    "version": "2026.05.07",
    "title": "서비스 이용약관",
    "body": "SIGNAL은 뉴스, 시세, 캘린더, 영상, 시그널 등 투자 참고 정보를 제공하는 서비스입니다. 제공 정보는 투자 권유가 아니며 최종 판단과 책임은 사용자에게 있습니다. 사용자는 관계 법령과 약관을 준수해야 하며, 서비스 운영을 방해하는 행위를 해서는 안 됩니다. 중요한 투자 결정 전에는 원문, 공시, 거래 플랫폼의 최신 정보를 함께 확인해야 합니다.",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "type": "privacy",
    "locale": "ko",
    "version": "2026.05.07",
    "title": "개인정보처리방침",
    "body": "SIGNAL은 계정 생성과 서비스 제공을 위해 이메일, 비밀번호 해시, 닉네임, 프로필 이미지, 세션, 기기/푸시 토큰, 관심종목, 알림 이력 등 필요한 정보를 처리할 수 있습니다. 비밀번호는 원문으로 저장하지 않습니다. 사용자는 내정보 화면에서 로그아웃하거나 계정 탈퇴를 요청할 수 있으며, 법령 준수와 보안을 위해 필요한 최소 기록은 일정 기간 보관될 수 있습니다.",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "type": "service",
    "locale": "en",
    "version": "2026.05.07",
    "title": "Terms of Service",
    "body": "SIGNAL provides market reference information such as news, quotes, calendars, videos, and signals. The information is not investment advice or solicitation. Users remain responsible for final investment decisions and outcomes. Users must comply with applicable laws and should verify original sources, filings, and trading platforms before making important decisions.",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "type": "privacy",
    "locale": "en",
    "version": "2026.05.07",
    "title": "Privacy Policy",
    "body": "SIGNAL may process email, password hashes, nickname, profile image URL, sessions, device and push tokens, watchlists, notification settings, and notification history to provide the service. Passwords are not stored in plain text. Users may log out or request account deletion, while minimal records may be retained for legal, dispute, and security needs.",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "type": "service",
    "locale": "ja",
    "version": "2026.05.07",
    "title": "サービス利用規約",
    "body": "SIGNAL はニュース、相場、カレンダー、動画、シグナルなど投資判断の参考情報を提供します。提供情報は投資助言や勧誘ではなく、最終判断と結果はユーザーの責任です。重要な判断の前には原文、公式開示、取引プラットフォームの最新情報を確認してください。",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "type": "privacy",
    "locale": "ja",
    "version": "2026.05.07",
    "title": "プライバシーポリシー",
    "body": "SIGNAL はサービス提供のため、メールアドレス、パスワードハッシュ、ニックネーム、プロフィール画像 URL、セッション、端末・プッシュトークン、ウォッチリスト、通知履歴などを処理する場合があります。パスワードは平文で保存しません。退会時も法令・紛争・セキュリティ上必要な最小記録は一定期間保持される場合があります。",
    "required": true,
    "active": true,
    "updatedAt": "2026-06-07T00:00:00.000Z"
  }
]$json$::jsonb))
INSERT INTO legal_terms (id, type, locale, version, title, body, required, active, created_at, updated_at)
SELECT concat(payload->>'type', ':', payload->>'locale', ':', payload->>'version'), payload->>'type', payload->>'locale', payload->>'version', payload->>'title', payload->>'body', COALESCE((payload->>'required')::boolean, true), COALESCE((payload->>'active')::boolean, true), COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz), COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz) FROM rows
ON CONFLICT (type, locale, version) DO NOTHING;

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
  ('fed-chair-speech-regex', 'fed', 'fed-chair-speech', 'Fed Chair Speech', 'regex', '(powell|fed chair).*speech', 100, true, now(), now());
