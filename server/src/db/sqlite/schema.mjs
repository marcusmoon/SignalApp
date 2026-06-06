export const collectionTables = [
  'provider_settings',
  'translation_settings',
  'news_sources',
  'rss_sources',
  'polling_jobs',
  'polling_job_runs',
  'news_items',
  'news_translations',
  'calendar_events',
  'concall_transcripts',
  'youtube_videos',
  'market_quotes',
  'coin_markets',
  'market_lists',
  'price_series',
  'quant_signal_items',
  'insight_items',
  'notification_items',
];

export function tableExists(db, table) {
  return !!db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
}

export function tableCount(db, table) {
  if (!tableExists(db, table)) return 0;
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count) || 0;
}

function columnExists(db, table, column) {
  if (!tableExists(db, table)) return false;
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function ensureColumn(db, table, column, ddl) {
  if (columnExists(db, table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
}

function uniqueIndexHasColumns(db, table, columns) {
  if (!tableExists(db, table)) return false;
  const indexes = db.prepare(`PRAGMA index_list(${table})`).all();
  return indexes.some((index) => {
    if (Number(index.unique) !== 1) return false;
    const info = db.prepare(`PRAGMA index_info(${index.name})`).all();
    const names = info.map((row) => row.name);
    return names.length === columns.length && columns.every((column, indexInList) => names[indexInList] === column);
  });
}

function migrateLegalTermsVersionSchema(db) {
  if (!tableExists(db, 'legal_terms')) return;
  const needsRebuild =
    !columnExists(db, 'legal_terms', 'created_at') || uniqueIndexHasColumns(db, 'legal_terms', ['type', 'locale']);
  if (!needsRebuild) return;
  const now = new Date().toISOString();
  db.exec(`
    CREATE TABLE IF NOT EXISTS legal_terms_next (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      locale TEXT NOT NULL,
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(type, locale, version)
    );
  `);
  db.prepare(
    `
      INSERT OR IGNORE INTO legal_terms_next (
        id, type, locale, version, title, body, required, active, created_at, updated_at
      )
      SELECT
        COALESCE(NULLIF(id, ''), type || ':' || locale || ':' || version),
        type,
        locale,
        version,
        title,
        body,
        required,
        active,
        COALESCE(NULLIF(updated_at, ''), ?),
        COALESCE(NULLIF(updated_at, ''), ?)
      FROM legal_terms
    `,
  ).run(now, now);
  db.exec(`
    DROP TABLE legal_terms;
    ALTER TABLE legal_terms_next RENAME TO legal_terms;
  `);
}

export function ensureStructuredSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS signal_meta (
      name TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_settings (
      provider TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS translation_settings (
      locale TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      provider TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ui_model_presets (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      nickname TEXT NOT NULL,
      profile_image_url TEXT,
      password_hash TEXT,
      password_salt TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'password',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_user_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_user_refresh_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      refresh_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_user_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      profile_image_url TEXT,
      linked_at TEXT,
      disconnected_at TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, provider_user_id)
    );

    CREATE TABLE IF NOT EXISTS app_user_account_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_type TEXT NOT NULL DEFAULT 'user',
      actor_id TEXT,
      identity_id TEXT,
      provider TEXT,
      provider_user_id_hash TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_user_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT,
      push_token TEXT,
      device_name TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, push_token)
    );

    CREATE TABLE IF NOT EXISTS app_user_email_change_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      code_salt TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS legal_terms (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      locale TEXT NOT NULL,
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(type, locale, version)
    );

    CREATE TABLE IF NOT EXISTS app_user_terms_acceptances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      term_type TEXT NOT NULL,
      locale TEXT NOT NULL,
      version TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      UNIQUE(user_id, term_type, locale, version)
    );

    CREATE TABLE IF NOT EXISTS news_source_settings (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news_sources (
      source_key TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      source_id TEXT,
      category TEXT,
      name TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      hidden INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rss_sources (
      source_id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      provider_id TEXT,
      source_name TEXT,
      category TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      hidden INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS polling_jobs (
      job_key TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 0,
      domain TEXT,
      operation TEXT,
      provider TEXT,
      handler TEXT,
      next_run_at TEXT,
      last_run_at TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS polling_job_locks (
      job_key TEXT PRIMARY KEY,
      lock_token TEXT NOT NULL,
      locked_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS polling_job_runs (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      job_key TEXT,
      status TEXT,
      trigger_type TEXT,
      started_at TEXT,
      finished_at TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news_items (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      provider TEXT,
      source_name TEXT,
      published_at TEXT,
      fetched_at TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news_translations (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      news_item_id TEXT,
      locale TEXT,
      status TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      event_date TEXT,
      event_at TEXT,
      event_type TEXT,
      symbol TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concall_transcripts (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      symbol TEXT,
      earnings_date TEXT,
      fiscal_year INTEGER,
      fiscal_quarter INTEGER,
      fetched_at TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS youtube_videos (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      channel TEXT,
      published_at TEXT,
      fetched_at TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_quotes (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      symbol TEXT,
      segment TEXT,
      quote_time TEXT,
      fetched_at TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coin_markets (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      symbol TEXT,
      fetched_at TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_lists (
      list_key TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_series (
      symbol TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      display_symbol TEXT,
      yahoo_symbol TEXT,
      last_bar_date TEXT,
      fetched_at TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quant_signal_items (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      symbol TEXT,
      action TEXT,
      level TEXT,
      score INTEGER,
      generated_date TEXT,
      generated_at TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS insight_items (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      kind TEXT,
      display_key TEXT,
      level TEXT,
      score INTEGER,
      generated_date TEXT,
      generated_at TEXT,
      expires_at TEXT,
      push_candidate INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_items (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      type TEXT,
      channel TEXT,
      status TEXT,
      priority TEXT,
      title TEXT,
      app_user_id TEXT,
      target_type TEXT,
      target_key TEXT,
      scheduled_at TEXT,
      expires_at TEXT,
      sent_at TEXT,
      source_type TEXT,
      source_id TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  migrateLegalTermsVersionSchema(db);
  ensureColumn(db, 'app_user_identities', 'email', 'TEXT');
  ensureColumn(db, 'app_user_identities', 'display_name', 'TEXT');
  ensureColumn(db, 'app_user_identities', 'profile_image_url', 'TEXT');
  ensureColumn(db, 'app_user_identities', 'linked_at', 'TEXT');
  ensureColumn(db, 'app_user_identities', 'disconnected_at', 'TEXT');
  ensureColumn(db, 'insight_items', 'display_key', 'TEXT');
  ensureColumn(db, 'insight_items', 'generated_date', 'TEXT');
  ensureColumn(db, 'notification_items', 'title', 'TEXT');
  ensureColumn(db, 'notification_items', 'app_user_id', 'TEXT');
  ensureColumn(db, 'notification_items', 'target_type', 'TEXT');
  ensureColumn(db, 'notification_items', 'target_key', 'TEXT');
  ensureColumn(db, 'notification_items', 'expires_at', 'TEXT');
  ensureColumn(db, 'calendar_events', 'event_date', 'TEXT');
  ensureColumn(db, 'calendar_events', 'event_at', 'TEXT');
  ensureColumn(db, 'calendar_events', 'event_type', 'TEXT');
  ensureColumn(db, 'calendar_events', 'symbol', 'TEXT');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_polling_jobs_due ON polling_jobs(enabled, next_run_at);
    CREATE INDEX IF NOT EXISTS idx_polling_jobs_domain ON polling_jobs(domain, provider, handler);
    CREATE INDEX IF NOT EXISTS idx_polling_job_runs_job ON polling_job_runs(job_key, started_at);
    CREATE INDEX IF NOT EXISTS idx_polling_job_runs_status ON polling_job_runs(status, started_at);
    CREATE INDEX IF NOT EXISTS idx_polling_job_locks_expires ON polling_job_locks(expires_at);
    CREATE INDEX IF NOT EXISTS idx_app_user_sessions_user ON app_user_sessions(user_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_app_user_refresh_user ON app_user_refresh_sessions(user_id, expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_refresh_device_active
      ON app_user_refresh_sessions(user_id, device_id) WHERE revoked_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_app_user_devices_user ON app_user_devices(user_id, active);
    CREATE INDEX IF NOT EXISTS idx_legal_terms_locale ON legal_terms(locale, active);
    CREATE INDEX IF NOT EXISTS idx_legal_terms_type_locale ON legal_terms(type, locale, active, updated_at);
    CREATE INDEX IF NOT EXISTS idx_app_user_identities_user ON app_user_identities(user_id, disconnected_at);
    CREATE INDEX IF NOT EXISTS idx_app_user_account_events_user ON app_user_account_events(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_app_user_account_events_type ON app_user_account_events(event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_app_user_account_events_identity ON app_user_account_events(identity_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_app_user_email_change_user ON app_user_email_change_requests(user_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_app_user_email_change_email ON app_user_email_change_requests(email, expires_at);
    CREATE INDEX IF NOT EXISTS idx_app_user_terms_user ON app_user_terms_acceptances(user_id, accepted_at);
    CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items(category, published_at);
    CREATE INDEX IF NOT EXISTS idx_news_items_source_published ON news_items(category, source_name, published_at);
    CREATE INDEX IF NOT EXISTS idx_news_items_provider_published ON news_items(provider, published_at);
    CREATE INDEX IF NOT EXISTS idx_news_items_fetched ON news_items(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_news_translations_item ON news_translations(news_item_id, locale);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date, event_type);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_type_date ON calendar_events(event_type, event_date, event_at);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_symbol_date ON calendar_events(symbol, event_date);
    CREATE INDEX IF NOT EXISTS idx_concall_transcripts_symbol ON concall_transcripts(symbol, earnings_date);
    CREATE INDEX IF NOT EXISTS idx_concall_transcripts_date ON concall_transcripts(earnings_date);
    CREATE INDEX IF NOT EXISTS idx_concall_transcripts_period ON concall_transcripts(fiscal_year, fiscal_quarter, earnings_date);
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON youtube_videos(channel, published_at);
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_published_only ON youtube_videos(published_at);
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_fetched ON youtube_videos(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_market_quotes_symbol ON market_quotes(symbol, segment);
    CREATE INDEX IF NOT EXISTS idx_market_quotes_segment_symbol_fetch ON market_quotes(segment, symbol, fetched_at);
    CREATE INDEX IF NOT EXISTS idx_market_quotes_segment_fetch ON market_quotes(segment, fetched_at);
    CREATE INDEX IF NOT EXISTS idx_coin_markets_symbol ON coin_markets(symbol);
    CREATE INDEX IF NOT EXISTS idx_coin_markets_fetched ON coin_markets(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_price_series_symbol ON price_series(symbol, last_bar_date);
    CREATE INDEX IF NOT EXISTS idx_price_series_fetched ON price_series(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_quant_signal_items_symbol ON quant_signal_items(symbol, generated_date);
    CREATE INDEX IF NOT EXISTS idx_quant_signal_items_generated ON quant_signal_items(generated_date, score);
    CREATE INDEX IF NOT EXISTS idx_insight_items_generated ON insight_items(generated_at, score);
    CREATE INDEX IF NOT EXISTS idx_insight_items_lookup ON insight_items(kind, level, push_candidate, generated_at);
    CREATE INDEX IF NOT EXISTS idx_insight_items_display ON insight_items(generated_date, display_key, generated_at);
    CREATE INDEX IF NOT EXISTS idx_notification_items_status ON notification_items(status, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_notification_items_type ON notification_items(type, status, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_notification_items_user ON notification_items(app_user_id, status, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_notification_items_target ON notification_items(target_type, target_key, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_notification_items_source ON notification_items(source_type, source_id);
  `);
}
