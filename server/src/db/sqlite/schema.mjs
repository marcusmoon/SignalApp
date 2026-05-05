export const collectionTables = [
  'provider_settings',
  'translation_settings',
  'news_sources',
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
  'insight_items',
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

    CREATE TABLE IF NOT EXISTS insight_items (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      kind TEXT,
      level TEXT,
      score INTEGER,
      generated_at TEXT,
      expires_at TEXT,
      push_candidate INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_polling_job_runs_job ON polling_job_runs(job_key, started_at);
    CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items(category, published_at);
    CREATE INDEX IF NOT EXISTS idx_news_translations_item ON news_translations(news_item_id, locale);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date, event_type);
    CREATE INDEX IF NOT EXISTS idx_concall_transcripts_symbol ON concall_transcripts(symbol, earnings_date);
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON youtube_videos(channel, published_at);
    CREATE INDEX IF NOT EXISTS idx_market_quotes_symbol ON market_quotes(symbol, segment);
    CREATE INDEX IF NOT EXISTS idx_coin_markets_symbol ON coin_markets(symbol);
    CREATE INDEX IF NOT EXISTS idx_insight_items_generated ON insight_items(generated_at, score);
  `);
}
