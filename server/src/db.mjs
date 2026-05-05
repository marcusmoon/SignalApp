import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.mjs';
import { ensureMarketListsShape } from './marketLists.mjs';

function nowIso() {
  return new Date().toISOString();
}

const STORE_KEYS = ['settings', 'jobs', 'news', 'calendar', 'concalls', 'youtube', 'market'];

/**
 * Single-process: concurrent HTTP + scheduler + jobs can otherwise interleave read/modify/write
 * and lose updates. SQLite protects the file; this queue protects object-level read/modify/write.
 */
let dbExclusiveChain = Promise.resolve();
let sqliteDb = null;
let adminUsersSeedChecked = false;

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withDbExclusive(fn) {
  const prev = dbExclusiveChain;
  let release;
  dbExclusiveChain = new Promise((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function getSqliteDb() {
  if (sqliteDb) return sqliteDb;
  sqliteDb = new DatabaseSync(config.sqlitePath);
  sqliteDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS signal_stores (
      name TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return sqliteDb;
}

function hashAdminPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyAdminPassword(password, row) {
  if (!row?.password_hash || !row?.password_salt) return false;
  const { hash } = hashAdminPassword(password, row.password_salt);
  const saved = Buffer.from(String(row.password_hash), 'hex');
  const candidate = Buffer.from(hash, 'hex');
  return saved.length === candidate.length && crypto.timingSafeEqual(saved, candidate);
}

function defaultDb() {
  return {
    meta: { createdAt: nowIso(), updatedAt: nowIso(), schemaVersion: 1 },
    appSettings: {
      marketQuotesMaxAgeSec: 10,
      updatedAt: nowIso(),
    },
    pollingJobs: defaultPollingJobs(),
    pollingJobRuns: [],
    newsItems: [],
    newsTranslations: [],
    calendarEvents: [],
    concallTranscripts: [],
    youtubeVideos: [],
    marketQuotes: [],
    coinMarkets: [],
    marketLists: ensureMarketListsShape([], nowIso),
    providerSettings: defaultProviderSettings(),
    translationSettings: defaultTranslationSettings(),
    uiModelPresets: defaultUiModelPresets(),
    /**
     * News source catalog used by the app filter & admin ordering.
     * Each item: { id, name, enabled, order, createdAt, updatedAt }
     */
    newsSources: [],
    /**
     * News source settings:
     * - autoEnableNewSources: per-category default for newly discovered sources
     * - aliases: per-category mapping { "Bloomberg News": "Bloomberg" }
     */
    newsSourceSettings: {
      autoEnableNewSources: { global: true, crypto: true },
      aliases: { global: {}, crypto: {} },
    },
  };
}

function defaultUiModelPresets() {
  return {
    openai: ['gpt-4o-mini'],
    claude: ['claude-3-5-haiku-latest'],
    mock: ['mock-news-v1'],
    updatedAt: nowIso(),
  };
}

function defaultPollingJobs() {
  return [
      {
        jobKey: 'market_news_global',
        displayName: '글로벌 뉴스 최신 수집',
        description: 'Finnhub 글로벌 시장 뉴스 최신 목록을 가져옵니다.',
        domain: 'news',
        operation: 'latest',
        provider: 'finnhub',
        handler: 'market_news',
        enabled: false,
        intervalSeconds: 1800,
        params: { category: 'general' },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'market_news_crypto',
        displayName: '크립토 뉴스 최신 수집',
        description: 'Finnhub 크립토 뉴스 최신 목록을 가져옵니다.',
        domain: 'news',
        operation: 'latest',
        provider: 'finnhub',
        handler: 'market_news',
        enabled: false,
        intervalSeconds: 1800,
        params: { category: 'crypto' },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'market_news_global_reconcile',
        displayName: '글로벌 뉴스 보정 수집',
        description: 'Finnhub 글로벌 시장 뉴스를 다시 조회해 수정된 제목/요약/소스 정보를 반영합니다.',
        domain: 'news',
        operation: 'reconcile',
        provider: 'finnhub',
        handler: 'market_news',
        enabled: false,
        intervalSeconds: 3600,
        params: { category: 'general' },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'market_news_crypto_reconcile',
        displayName: '크립토 뉴스 보정 수집',
        description: 'Finnhub 크립토 뉴스를 다시 조회해 수정된 제목/요약/소스 정보를 반영합니다.',
        domain: 'news',
        operation: 'reconcile',
        provider: 'finnhub',
        handler: 'market_news',
        enabled: false,
        intervalSeconds: 3600,
        params: { category: 'crypto' },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'market_news_financial_juice',
        displayName: 'Financial Juice (RSS)',
        description: 'Financial Juice 공개 RSS(지연 헤드라인)를 수집해 뉴스 DB에 저장합니다.',
        domain: 'news',
        operation: 'latest',
        provider: 'rss',
        handler: 'financial_juice',
        enabled: false,
        intervalSeconds: 300,
        params: { feedUrl: 'https://www.financialjuice.com/feed.ashx?xy=rss', limit: 40 },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'market_news_financial_juice_reconcile',
        displayName: 'Financial Juice (RSS) 보정',
        description: 'RSS 항목을 다시 읽어 제목·요약·링크 변경을 반영합니다.',
        domain: 'news',
        operation: 'reconcile',
        provider: 'rss',
        handler: 'financial_juice',
        enabled: false,
        intervalSeconds: 3600,
        params: { feedUrl: 'https://www.financialjuice.com/feed.ashx?xy=rss', limit: 60 },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'calendar_economic',
        displayName: '경제지표 최신 수집',
        description: '오늘 이후 경제지표 일정을 가져옵니다.',
        domain: 'calendar',
        operation: 'latest',
        provider: 'finnhub',
        handler: 'economic_calendar',
        enabled: false,
        intervalSeconds: 1800,
        params: { daysAhead: 14 },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'calendar_earnings',
        displayName: '실적 캘린더 최신 수집',
        description: '오늘 이후 실적 발표 일정을 가져옵니다.',
        domain: 'calendar',
        operation: 'latest',
        provider: 'finnhub',
        handler: 'earnings_calendar',
        enabled: false,
        intervalSeconds: 21600,
        params: { daysAhead: 30 },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'concall_transcripts_recent',
        displayName: '컨콜 트랜스크립트 최신 수집',
        description: '최근 실적 캘린더의 컨콜 트랜스크립트를 API Ninjas에서 가져옵니다.',
        domain: 'concalls',
        operation: 'latest',
        provider: 'ninjas',
        handler: 'earning_transcripts',
        enabled: false,
        intervalSeconds: 21600,
        params: { daysBack: 45, daysAhead: 2, limit: 25, listKey: 'mcap_universe', fallbackLatest: true },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'youtube_economy_latest',
        displayName: '경제 유튜브 최신 수집',
        description: '설정된 경제/시장 채널의 최신 영상을 가져옵니다.',
        domain: 'youtube',
        operation: 'latest',
        provider: 'youtube',
        handler: 'youtube_economy',
        enabled: false,
        intervalSeconds: 1800,
        params: { order: 'date', handles: ['futuresnow', 'LikeUSStock', 't3chfeed', 'unrealtech', 'lucky_tv'] },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'calendar_economic_reconcile',
        displayName: '경제지표 보정 수집',
        description: '최근 과거와 미래 구간을 다시 조회해 actual/estimate/previous 변경을 반영합니다.',
        domain: 'calendar',
        operation: 'reconcile',
        provider: 'finnhub',
        handler: 'economic_calendar',
        enabled: false,
        intervalSeconds: 21600,
        params: { daysBack: 7, daysAhead: 30 },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'calendar_earnings_reconcile',
        displayName: '실적 캘린더 보정 수집',
        description: '실적 발표 전후 구간을 다시 조회해 일정과 실제 EPS 변경을 반영합니다.',
        domain: 'calendar',
        operation: 'reconcile',
        provider: 'finnhub',
        handler: 'earnings_calendar',
        enabled: false,
        intervalSeconds: 43200,
        params: { daysBack: 14, daysAhead: 45 },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'youtube_economy_reconcile',
        displayName: '경제 유튜브 보정 수집',
        description: '이미 저장된 최근 영상의 제목/설명/조회수/썸네일을 다시 가져옵니다.',
        domain: 'youtube',
        operation: 'reconcile',
        provider: 'youtube',
        handler: 'youtube_economy_reconcile',
        enabled: false,
        intervalSeconds: 43200,
        params: { limit: 80 },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'market_quotes_popular',
        displayName: '인기 시세 최신 수집',
        description: '인기 종목의 최신 시세를 Finnhub에서 가져옵니다.',
        domain: 'market',
        operation: 'latest',
        provider: 'finnhub',
        handler: 'market_quotes',
        enabled: false,
        intervalSeconds: 1800,
        params: { segment: 'popular', listKey: 'popular_symbols' },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'market_quotes_watchlist',
        displayName: '관심종목 시세 최신 수집',
        description: '기본 관심종목의 최신 시세를 Finnhub에서 가져옵니다.',
        domain: 'market',
        operation: 'latest',
        provider: 'finnhub',
        handler: 'market_quotes',
        enabled: false,
        intervalSeconds: 1800,
        params: { listKey: 'default_watchlist' },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'market_quotes_mcap',
        displayName: '시총 상위 시세 수집',
        description: '시총 상위 후보 종목의 최신 시세를 Finnhub에서 가져옵니다.',
        domain: 'market',
        operation: 'latest',
        provider: 'finnhub',
        handler: 'market_quotes_mcap',
        enabled: false,
        intervalSeconds: 1800,
        params: { topN: 20, listKey: 'mcap_universe' },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
      {
        jobKey: 'market_coins_top',
        displayName: '코인 시총 상위 수집',
        description: 'CoinGecko에서 시총 상위 코인 가격을 가져옵니다.',
        domain: 'market',
        operation: 'latest',
        provider: 'coingecko',
        handler: 'coin_markets',
        enabled: false,
        intervalSeconds: 1800,
        params: { limit: 30 },
        lastRunAt: null,
        nextRunAt: null,
        updatedAt: nowIso(),
      },
    ];
}

function defaultProviderSettings() {
  return [
      {
        provider: 'finnhub',
        enabled: true,
        apiKey: config.finnhubToken,
        updatedAt: nowIso(),
      },
      {
        provider: 'openai',
        enabled: true,
        apiKey: config.openaiApiKey,
        defaultModel: 'gpt-4o-mini',
        updatedAt: nowIso(),
      },
      {
        provider: 'claude',
        enabled: true,
        apiKey: config.anthropicApiKey,
        defaultModel: 'claude-3-5-haiku-latest',
        updatedAt: nowIso(),
      },
      {
        provider: 'youtube',
        enabled: true,
        apiKey: config.youtubeApiKey,
        updatedAt: nowIso(),
      },
      {
        provider: 'ninjas',
        enabled: true,
        apiKey: config.ninjasKey,
        updatedAt: nowIso(),
      },
      {
        provider: 'coingecko',
        enabled: true,
        apiKey: '',
        updatedAt: nowIso(),
      },
    ];
}

function defaultTranslationSettings() {
  return [
      {
        locale: 'ko',
        provider: config.translationProvider,
        enabled: true,
        autoTranslateNews: true,
        updatedAt: nowIso(),
      },
      {
        locale: 'ja',
        provider: config.translationProvider,
        enabled: false,
        autoTranslateNews: false,
        updatedAt: nowIso(),
      },
    ];
}

function ensureDbShape(db) {
  if (!db.appSettings || typeof db.appSettings !== 'object') {
    db.appSettings = defaultDb().appSettings;
  }
  if (!Number.isFinite(Number(db.appSettings.marketQuotesMaxAgeSec))) db.appSettings.marketQuotesMaxAgeSec = 10;
  db.appSettings.marketQuotesMaxAgeSec = Math.max(0, Math.min(300, Number(db.appSettings.marketQuotesMaxAgeSec) || 10));
  if (!db.appSettings.updatedAt) db.appSettings.updatedAt = nowIso();

  if (!Array.isArray(db.providerSettings)) {
    db.providerSettings = defaultProviderSettings();
  }
  db.providerSettings = db.providerSettings.filter((setting) => setting && typeof setting === 'object');
  if (!db.providerSettings.some((s) => s.provider === 'youtube')) {
    db.providerSettings.push(defaultProviderSettings().find((s) => s.provider === 'youtube'));
  }
  if (!db.providerSettings.some((s) => s.provider === 'ninjas')) {
    db.providerSettings.push(defaultProviderSettings().find((s) => s.provider === 'ninjas'));
  }
  if (!db.providerSettings.some((s) => s.provider === 'coingecko')) {
    db.providerSettings.push(defaultProviderSettings().find((s) => s.provider === 'coingecko'));
  }
  if (!Array.isArray(db.pollingJobs)) db.pollingJobs = defaultPollingJobs();
  const defaults = defaultPollingJobs();
  for (const defaultJob of defaults) {
    const existing = db.pollingJobs.find((j) => j.jobKey === defaultJob.jobKey);
    if (!existing) {
      db.pollingJobs.push(defaultJob);
      continue;
    }
    for (const key of ['displayName', 'description', 'domain', 'operation', 'provider', 'handler']) {
      if (existing[key] == null || existing[key] === '') existing[key] = defaultJob[key];
    }
    if (existing.params == null) existing.params = defaultJob.params;
    if (existing.jobKey === 'market_quotes_popular' && !existing.params.listKey) {
      existing.params = { ...existing.params, listKey: 'popular_symbols' };
    }
    if (existing.jobKey === 'market_quotes_watchlist' && !existing.params.listKey) {
      existing.params = { ...existing.params, listKey: 'default_watchlist' };
    }
    if (existing.jobKey === 'market_quotes_mcap' && !existing.params.listKey) {
      existing.params = { ...existing.params, listKey: 'mcap_universe' };
    }
    if (existing.jobKey === 'concall_transcripts_recent' && existing.params.fallbackLatest == null) {
      existing.params = { ...existing.params, fallbackLatest: true };
    }
  }
  if (!Array.isArray(db.pollingJobRuns)) db.pollingJobRuns = [];
  if (!Array.isArray(db.newsItems)) db.newsItems = [];
  for (const item of db.newsItems) {
    if (!item || typeof item !== 'object') continue;
    if (!Array.isArray(item.hashtags)) item.hashtags = [];
    else {
      item.hashtags = item.hashtags
        .filter((t) => t && typeof t === 'object' && String(t.label || '').trim())
        .map((t, idx) => ({
          label: String(t.label).trim(),
          order: Number.isFinite(Number(t.order)) ? Number(t.order) : idx,
          source: t.source === 'manual' ? 'manual' : 'auto',
        }));
    }
    if (item.hashtagSource !== 'manual') item.hashtagSource = 'auto';
  }
  if (!Array.isArray(db.newsTranslations)) db.newsTranslations = [];
  if (!Array.isArray(db.calendarEvents)) db.calendarEvents = [];
  if (!Array.isArray(db.concallTranscripts)) db.concallTranscripts = [];
  if (!Array.isArray(db.youtubeVideos)) db.youtubeVideos = [];
  if (!Array.isArray(db.marketQuotes)) db.marketQuotes = [];
  if (!Array.isArray(db.coinMarkets)) db.coinMarkets = [];
  db.marketLists = ensureMarketListsShape(db.marketLists, nowIso);
  if (!Array.isArray(db.translationSettings)) db.translationSettings = defaultTranslationSettings();
  if (!db.uiModelPresets || typeof db.uiModelPresets !== 'object') db.uiModelPresets = defaultUiModelPresets();
  if (!Array.isArray(db.uiModelPresets.openai)) db.uiModelPresets.openai = defaultUiModelPresets().openai;
  if (!Array.isArray(db.uiModelPresets.claude)) db.uiModelPresets.claude = defaultUiModelPresets().claude;
  if (!Array.isArray(db.uiModelPresets.mock)) db.uiModelPresets.mock = defaultUiModelPresets().mock;
  if (!db.uiModelPresets.updatedAt) db.uiModelPresets.updatedAt = nowIso();
  if (!Array.isArray(db.newsSources)) db.newsSources = [];
  if (!db.newsSourceSettings || typeof db.newsSourceSettings !== 'object') {
    db.newsSourceSettings = defaultDb().newsSourceSettings;
  }
  if (!db.newsSourceSettings.autoEnableNewSources || typeof db.newsSourceSettings.autoEnableNewSources !== 'object') {
    db.newsSourceSettings.autoEnableNewSources = defaultDb().newsSourceSettings.autoEnableNewSources;
  }
  if (typeof db.newsSourceSettings.autoEnableNewSources.global !== 'boolean') db.newsSourceSettings.autoEnableNewSources.global = true;
  if (typeof db.newsSourceSettings.autoEnableNewSources.crypto !== 'boolean') db.newsSourceSettings.autoEnableNewSources.crypto = true;
  if (!db.newsSourceSettings.aliases || typeof db.newsSourceSettings.aliases !== 'object') {
    db.newsSourceSettings.aliases = defaultDb().newsSourceSettings.aliases;
  }
  if (!db.newsSourceSettings.aliases.global || typeof db.newsSourceSettings.aliases.global !== 'object') db.newsSourceSettings.aliases.global = {};
  if (!db.newsSourceSettings.aliases.crypto || typeof db.newsSourceSettings.aliases.crypto !== 'object') db.newsSourceSettings.aliases.crypto = {};
  return db;
}

function stableSourceId(name) {
  const s = String(name || '').trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `src-${h.toString(16)}`;
}

export function normalizeNewsSourceName(raw) {
  const s = String(raw || '').trim();
  return s.length > 0 ? s : 'Unknown';
}

function aliasKey(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function normalizeNewsSourceNameWithAliases(raw, category, settings) {
  const name = normalizeNewsSourceName(raw);
  const cat = normalizeNewsCategory(category);
  const aliases = settings?.aliases && typeof settings.aliases === 'object' ? settings.aliases : null;
  const table = aliases && typeof aliases[cat] === 'object' ? aliases[cat] : null;
  const mapped = table ? table[aliasKey(name)] : null;
  return mapped ? normalizeNewsSourceName(mapped) : name;
}

function normalizeNewsCategory(raw) {
  const c = String(raw || '').trim().toLowerCase();
  if (c === 'crypto') return 'crypto';
  // Treat unknown/legacy as global for app UX.
  return 'global';
}

export function ensureNewsSourcesFromItems(db) {
  if (!Array.isArray(db.newsSources)) db.newsSources = [];
  const list = db.newsSources;
  // Normalize legacy entries without category.
  for (const s of list) {
    if (!s) continue;
    if (!s.category) s.category = 'global';
    if (s.enabled == null) s.enabled = true;
    if (s.hidden == null) s.hidden = false;
  }

  const byKey = new Map(list.map((x) => [`${x.id}|${x.category || 'global'}`, x]));
  const maxOrderByCat = new Map();
  for (const s of list) {
    const cat = normalizeNewsCategory(s?.category);
    maxOrderByCat.set(cat, Math.max(maxOrderByCat.get(cat) || 0, Number(s?.order) || 0));
  }
  let changed = false;
  for (const item of db.newsItems || []) {
    const category = normalizeNewsCategory(item?.category);
    const name = normalizeNewsSourceNameWithAliases(item?.sourceName, category, db.newsSourceSettings);
    const id = stableSourceId(name);
    const key = `${id}|${category}`;
    if (byKey.has(key)) continue;
    const nextOrder = (maxOrderByCat.get(category) || 0) + 1;
    maxOrderByCat.set(category, nextOrder);
    const autoEnable =
      category === 'crypto'
        ? db.newsSourceSettings?.autoEnableNewSources?.crypto !== false
        : db.newsSourceSettings?.autoEnableNewSources?.global !== false;
    const row = {
      id,
      name,
      category,
      enabled: !!autoEnable,
      hidden: false,
      order: nextOrder,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    list.push(row);
    byKey.set(key, row);
    changed = true;
  }
  if (changed) {
    // keep deterministic order
    list.sort(
      (a, b) =>
        String(a.category || 'global').localeCompare(String(b.category || 'global')) ||
        (Number(a.order) || 0) - (Number(b.order) || 0) ||
        String(a.name).localeCompare(String(b.name)),
    );
  }
  return changed;
}

/** Log parse context so corrupted store files can be diagnosed from server logs. */
function logJsonParseFailure(filePath, text, err) {
  const len = text.length;
  const msg = err instanceof Error ? err.message : String(err);
  let pos = null;
  const m = msg.match(/position\s+(\d+)/i);
  if (m) pos = Number(m[1]);
  console.error(`[db] JSON.parse failed: ${filePath}`);
  console.error(`[db] length=${len} message=${msg}`);
  if (pos != null && Number.isFinite(pos) && pos >= 0 && pos <= len) {
    const a = Math.max(0, pos - 120);
    const b = Math.min(len, pos + 120);
    console.error(`[db] context around position ${pos} (chars ${a}–${b}):`);
    console.error(text.slice(a, b));
  } else {
    const head = text.slice(0, 160).replace(/\r?\n/g, '↵');
    const tail = text.slice(Math.max(0, len - 240)).replace(/\r?\n/g, '↵');
    console.error(`[db] head (first 160): ${head}`);
    console.error(`[db] tail (last 240): ${tail}`);
  }
}

function throwJsonParseError(file, err) {
  const wrapped = err instanceof Error ? err : new Error(String(err));
  if (!wrapped.message.includes(file)) {
    wrapped.message = `${wrapped.message} (${file})`;
  }
  throw wrapped;
}

function splitStoresFromDb(db) {
  const shaped = ensureDbShape(db);
  shaped.meta = { ...(shaped.meta || {}), updatedAt: nowIso(), schemaVersion: 1 };
  return {
    settings: {
      meta: shaped.meta,
      appSettings: shaped.appSettings,
      providerSettings: shaped.providerSettings,
      translationSettings: shaped.translationSettings,
      uiModelPresets: shaped.uiModelPresets,
      newsSources: shaped.newsSources,
      newsSourceSettings: shaped.newsSourceSettings,
    },
    jobs: {
      pollingJobs: shaped.pollingJobs,
      pollingJobRuns: shaped.pollingJobRuns,
    },
    news: {
      newsItems: shaped.newsItems,
      newsTranslations: shaped.newsTranslations,
    },
    calendar: {
      calendarEvents: shaped.calendarEvents,
    },
    concalls: {
      concallTranscripts: shaped.concallTranscripts,
    },
    youtube: {
      youtubeVideos: shaped.youtubeVideos,
    },
    market: {
      marketQuotes: shaped.marketQuotes,
      coinMarkets: shaped.coinMarkets,
      marketLists: shaped.marketLists,
    },
  };
}

function shapeDbFromStores(stores) {
  const shaped = ensureDbShape({
    meta: stores.settings?.meta ?? { createdAt: nowIso(), updatedAt: nowIso(), schemaVersion: 1 },
    appSettings: stores.settings?.appSettings ?? null,
    providerSettings: stores.settings?.providerSettings ?? [],
    translationSettings: stores.settings?.translationSettings ?? [],
    uiModelPresets: stores.settings?.uiModelPresets ?? null,
    newsSources: stores.settings?.newsSources ?? [],
    newsSourceSettings: stores.settings?.newsSourceSettings ?? null,
    pollingJobs: stores.jobs?.pollingJobs ?? [],
    pollingJobRuns: stores.jobs?.pollingJobRuns ?? [],
    newsItems: stores.news?.newsItems ?? [],
    newsTranslations: stores.news?.newsTranslations ?? [],
    calendarEvents: stores.calendar?.calendarEvents ?? [],
    concallTranscripts: stores.concalls?.concallTranscripts ?? [],
    youtubeVideos: stores.youtube?.youtubeVideos ?? [],
    marketQuotes: stores.market?.marketQuotes ?? [],
    coinMarkets: stores.market?.coinMarkets ?? [],
    marketLists: stores.market?.marketLists ?? [],
  });
  ensureNewsSourcesFromItems(shaped);
  return shaped;
}

function parseStorePayload(store, payload) {
  try {
    return JSON.parse(payload);
  } catch (err) {
    logJsonParseFailure(`${config.sqlitePath}#${store}`, payload, err);
    // Avoid partial "repairs"; trimming trailing garbage can silently discard store data.
    throwJsonParseError(`${config.sqlitePath}#${store}`, err);
  }
}

async function ensureSqliteStore() {
  await fs.mkdir(path.dirname(config.sqlitePath), { recursive: true });
  const db = getSqliteDb();
  seedAdminUsersFromEnvIfEmpty(db);
  return db;
}

function seedAdminUsersFromEnvIfEmpty(db) {
  if (adminUsersSeedChecked) return;
  adminUsersSeedChecked = true;
  const count = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get()?.count || 0;
  if (count > 0) return;
  const users = Array.isArray(config.adminUsers) ? config.adminUsers : [];
  if (users.length === 0) return;

  const now = nowIso();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO admin_users (id, password_hash, password_salt, active, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
  `);
  let inserted = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const user of users) {
      const id = String(user?.id || '').trim();
      const password = String(user?.password || '');
      if (!id || !password) continue;
      const { hash, salt } = hashAdminPassword(password);
      const result = stmt.run(id, hash, salt, now, now);
      inserted += Number(result.changes) || 0;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  if (inserted > 0) console.log(`[db] seeded ${inserted} admin user(s) into SQLite`);
}

async function readSqliteDbBody() {
  const db = await ensureSqliteStore();
  const rows = db.prepare('SELECT name, payload FROM signal_stores').all();
  if (rows.length === 0) return null;

  const stores = {};
  for (const row of rows) {
    if (!STORE_KEYS.includes(row.name)) continue;
    stores[row.name] = parseStorePayload(row.name, row.payload);
  }
  if (Object.keys(stores).length === 0) return null;
  return shapeDbFromStores(stores);
}

async function writeSqliteDbBody(dbObject) {
  const db = await ensureSqliteStore();
  const stores = splitStoresFromDb(dbObject);
  const updatedAt = nowIso();
  const stmt = db.prepare(`
    INSERT INTO signal_stores (name, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `);

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const key of STORE_KEYS) {
      stmt.run(key, JSON.stringify(stores[key]), updatedAt);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function readDbBody() {
  const sqliteDbObject = await readSqliteDbBody();
  if (sqliteDbObject) return sqliteDbObject;

  const dbObject = defaultDb();
  await writeSqliteDbBody(dbObject);
  return dbObject;
}

async function writeDbBody(db) {
  await writeSqliteDbBody(db);
}

export async function readDb() {
  return withDbExclusive(() => readDbBody());
}

export async function writeDb(db) {
  return withDbExclusive(() => writeDbBody(db));
}

export async function updateDb(mutator) {
  return withDbExclusive(async () => {
    const db = await readDbBody();
    const result = await mutator(db);
    await writeDbBody(db);
    return result;
  });
}

export async function verifyAdminLogin(loginId, password) {
  const db = await ensureSqliteStore();
  const id = String(loginId || '').trim();
  if (!id || !password) return null;
  const row = db
    .prepare('SELECT id, password_hash, password_salt, active FROM admin_users WHERE id = ?')
    .get(id);
  if (!row || Number(row.active) !== 1) return null;
  return verifyAdminPassword(password, row) ? { id: row.id } : null;
}

export async function hasAdminUsers() {
  const db = await ensureSqliteStore();
  const count = db.prepare('SELECT COUNT(*) AS count FROM admin_users WHERE active = 1').get()?.count || 0;
  return count > 0;
}

export async function listAdminUsers() {
  const db = await ensureSqliteStore();
  return db
    .prepare(
      `
        SELECT id, active, created_at AS createdAt, updated_at AS updatedAt
        FROM admin_users
        ORDER BY id COLLATE NOCASE
      `,
    )
    .all()
    .map((row) => ({
      id: row.id,
      active: Number(row.active) === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
}

function activeAdminCount(db) {
  return Number(db.prepare('SELECT COUNT(*) AS count FROM admin_users WHERE active = 1').get()?.count) || 0;
}

export async function createAdminUser({ id, password, active = true }) {
  const db = await ensureSqliteStore();
  const userId = String(id || '').trim();
  const userPassword = String(password || '');
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  if (!userPassword) throw new Error('ADMIN_USER_PASSWORD_REQUIRED');
  const exists = db.prepare('SELECT id FROM admin_users WHERE id = ?').get(userId);
  if (exists) throw new Error('ADMIN_USER_EXISTS');
  const { hash, salt } = hashAdminPassword(userPassword);
  const now = nowIso();
  db.prepare(
    `
      INSERT INTO admin_users (id, password_hash, password_salt, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(userId, hash, salt, active === false ? 0 : 1, now, now);
  return { id: userId, active: active !== false, createdAt: now, updatedAt: now };
}

export async function updateAdminUser(id, patch = {}) {
  const db = await ensureSqliteStore();
  const userId = String(id || '').trim();
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  const existing = db.prepare('SELECT id, active FROM admin_users WHERE id = ?').get(userId);
  if (!existing) throw new Error('ADMIN_USER_NOT_FOUND');
  const updates = [];
  const params = [];
  if (typeof patch.active === 'boolean') {
    if (Number(existing.active) === 1 && patch.active === false && activeAdminCount(db) <= 1) {
      throw new Error('ADMIN_USER_LAST_ACTIVE');
    }
    updates.push('active = ?');
    params.push(patch.active ? 1 : 0);
  }
  if (typeof patch.password === 'string' && patch.password.length > 0) {
    const { hash, salt } = hashAdminPassword(patch.password);
    updates.push('password_hash = ?', 'password_salt = ?');
    params.push(hash, salt);
  }
  if (updates.length === 0) return (await listAdminUsers()).find((user) => user.id === userId) || null;
  const now = nowIso();
  updates.push('updated_at = ?');
  params.push(now, userId);
  db.prepare(`UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return (await listAdminUsers()).find((user) => user.id === userId) || null;
}

export async function deleteAdminUser(id) {
  const db = await ensureSqliteStore();
  const userId = String(id || '').trim();
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  const existing = db.prepare('SELECT id, active FROM admin_users WHERE id = ?').get(userId);
  if (!existing) throw new Error('ADMIN_USER_NOT_FOUND');
  if (Number(existing.active) === 1 && activeAdminCount(db) <= 1) throw new Error('ADMIN_USER_LAST_ACTIVE');
  db.prepare('DELETE FROM admin_users WHERE id = ?').run(userId);
  return { id: userId };
}

export function upsertById(list, item) {
  const index = list.findIndex((x) => x.id === item.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...item, updatedAt: nowIso() };
    return list[index];
  }
  const next = { ...item, createdAt: nowIso(), updatedAt: nowIso() };
  list.push(next);
  return next;
}

export { nowIso };
