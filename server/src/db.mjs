import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.mjs';
import { ensureMarketListsShape } from './marketLists.mjs';

function nowIso() {
  return new Date().toISOString();
}

const STORE_FILES = {
  settings: 'settings.json',
  jobs: 'jobs.json',
  news: 'news.json',
  calendar: 'calendar.json',
  concalls: 'concalls.json',
  youtube: 'youtube.json',
  market: 'market.json',
};

function defaultDb() {
  return {
    meta: { createdAt: nowIso(), updatedAt: nowIso(), schemaVersion: 1 },
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
        intervalSeconds: 300,
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
        intervalSeconds: 300,
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
        intervalSeconds: 3600,
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
        intervalSeconds: 60,
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
        intervalSeconds: 120,
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
        intervalSeconds: 600,
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
        intervalSeconds: 300,
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
        apiKey: config.apiNinjasKey,
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
  if (!Array.isArray(db.providerSettings)) {
    db.providerSettings = defaultProviderSettings();
  }
  const providerById = new Map();
  db.providerSettings = db.providerSettings.filter((setting) => {
    if (!setting || typeof setting !== 'object') return false;
    if (setting.provider === 'api-ninjas') setting.provider = 'ninjas';
    const existing = providerById.get(setting.provider);
    if (!existing) {
      providerById.set(setting.provider, setting);
      return true;
    }
    if (!existing.apiKey && setting.apiKey) existing.apiKey = setting.apiKey;
    if (existing.enabled == null && setting.enabled != null) existing.enabled = setting.enabled;
    if (!existing.defaultModel && setting.defaultModel) existing.defaultModel = setting.defaultModel;
    if (!existing.updatedAt && setting.updatedAt) existing.updatedAt = setting.updatedAt;
    return false;
  });
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
    if (existing.provider === 'api-ninjas') existing.provider = 'ninjas';
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

async function readJsonFile(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

function storePath(store) {
  return path.join(config.dataDir, STORE_FILES[store]);
}

async function readSplitDb() {
  const [settings, jobs, news, calendar, concalls, youtube, market] = await Promise.all([
    readJsonFile(storePath('settings'), null),
    readJsonFile(storePath('jobs'), null),
    readJsonFile(storePath('news'), null),
    readJsonFile(storePath('calendar'), null),
    readJsonFile(storePath('concalls'), null),
    readJsonFile(storePath('youtube'), null),
    readJsonFile(storePath('market'), null),
  ]);
  if (!settings && !jobs && !news && !calendar && !concalls && !youtube && !market) return null;
  const shaped = ensureDbShape({
    meta: settings?.meta ?? { createdAt: nowIso(), updatedAt: nowIso(), schemaVersion: 1 },
    providerSettings: settings?.providerSettings ?? [],
    translationSettings: settings?.translationSettings ?? [],
    uiModelPresets: settings?.uiModelPresets ?? null,
    newsSources: settings?.newsSources ?? [],
    newsSourceSettings: settings?.newsSourceSettings ?? null,
    pollingJobs: jobs?.pollingJobs ?? [],
    pollingJobRuns: jobs?.pollingJobRuns ?? [],
    newsItems: news?.newsItems ?? [],
    newsTranslations: news?.newsTranslations ?? [],
    calendarEvents: calendar?.calendarEvents ?? [],
    concallTranscripts: concalls?.concallTranscripts ?? [],
    youtubeVideos: youtube?.youtubeVideos ?? [],
    marketQuotes: market?.marketQuotes ?? [],
    coinMarkets: market?.coinMarkets ?? [],
    marketLists: market?.marketLists ?? [],
  });
  ensureNewsSourcesFromItems(shaped);
  return shaped;
}

export async function readDb() {
  const split = await readSplitDb();
  if (split) return split;

  // Legacy fallback: older versions used a monolithic local-db.json.
  // If it exists, migrate once into split stores then keep only a backup.
  const legacyFile = path.join(config.dataDir, 'local-db.json');
  try {
    const body = await fs.readFile(legacyFile, 'utf8');
    const db = ensureDbShape(JSON.parse(body));
    await writeDb(db);
    const backup = path.join(config.dataDir, `local-db.legacy.${Date.now()}.json`);
    await fs.rename(legacyFile, backup).catch(() => {});
    return db;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const db = defaultDb();
  await writeDb(db);
  return db;
}

export async function writeDb(db) {
  const shaped = ensureDbShape(db);
  shaped.meta = { ...(shaped.meta || {}), updatedAt: nowIso(), schemaVersion: 1 };
  await fs.mkdir(config.dataDir, { recursive: true });
  await Promise.all([
    writeStore('settings', {
      meta: shaped.meta,
      providerSettings: shaped.providerSettings,
      translationSettings: shaped.translationSettings,
      uiModelPresets: shaped.uiModelPresets,
      newsSources: shaped.newsSources,
      newsSourceSettings: shaped.newsSourceSettings,
    }),
    writeStore('jobs', {
      pollingJobs: shaped.pollingJobs,
      pollingJobRuns: shaped.pollingJobRuns,
    }),
    writeStore('news', {
      newsItems: shaped.newsItems,
      newsTranslations: shaped.newsTranslations,
    }),
    writeStore('calendar', {
      calendarEvents: shaped.calendarEvents,
    }),
    writeStore('concalls', {
      concallTranscripts: shaped.concallTranscripts,
    }),
    writeStore('youtube', {
      youtubeVideos: shaped.youtubeVideos,
    }),
    writeStore('market', {
      marketQuotes: shaped.marketQuotes,
      coinMarkets: shaped.coinMarkets,
      marketLists: shaped.marketLists,
    }),
  ]);
}

async function writeStore(store, data) {
  const file = storePath(store);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tmp, file);
}

export async function updateDb(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
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
