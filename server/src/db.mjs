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
    youtubeVideos: [],
    marketQuotes: [],
    coinMarkets: [],
    marketLists: ensureMarketListsShape([], nowIso),
    providerSettings: defaultProviderSettings(),
    translationSettings: defaultTranslationSettings(),
    uiModelPresets: defaultUiModelPresets(),
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
        defaultModel: '',
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
        defaultModel: '',
        updatedAt: nowIso(),
      },
      {
        provider: 'coingecko',
        enabled: true,
        apiKey: '',
        defaultModel: '',
        updatedAt: nowIso(),
      },
    ];
}

function defaultTranslationSettings() {
  return [
      {
        locale: 'ko',
        provider: config.translationProvider,
        model: config.translationModel,
        enabled: true,
        autoTranslateNews: true,
        updatedAt: nowIso(),
      },
      {
        locale: 'ja',
        provider: config.translationProvider,
        model: config.translationModel,
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
  if (!db.providerSettings.some((s) => s.provider === 'youtube')) {
    db.providerSettings.push(defaultProviderSettings().find((s) => s.provider === 'youtube'));
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
    if (existing.jobKey === 'market_quotes_mcap' && !existing.params.listKey) {
      existing.params = { ...existing.params, listKey: 'mcap_universe' };
    }
  }
  if (!Array.isArray(db.pollingJobRuns)) db.pollingJobRuns = [];
  if (!Array.isArray(db.newsItems)) db.newsItems = [];
  if (!Array.isArray(db.newsTranslations)) db.newsTranslations = [];
  if (!Array.isArray(db.calendarEvents)) db.calendarEvents = [];
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
  return db;
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
  const [settings, jobs, news, calendar, youtube, market] = await Promise.all([
    readJsonFile(storePath('settings'), null),
    readJsonFile(storePath('jobs'), null),
    readJsonFile(storePath('news'), null),
    readJsonFile(storePath('calendar'), null),
    readJsonFile(storePath('youtube'), null),
    readJsonFile(storePath('market'), null),
  ]);
  if (!settings && !jobs && !news && !calendar && !youtube && !market) return null;
  return ensureDbShape({
    meta: settings?.meta ?? { createdAt: nowIso(), updatedAt: nowIso(), schemaVersion: 1 },
    providerSettings: settings?.providerSettings ?? [],
    translationSettings: settings?.translationSettings ?? [],
    uiModelPresets: settings?.uiModelPresets ?? null,
    pollingJobs: jobs?.pollingJobs ?? [],
    pollingJobRuns: jobs?.pollingJobRuns ?? [],
    newsItems: news?.newsItems ?? [],
    newsTranslations: news?.newsTranslations ?? [],
    calendarEvents: calendar?.calendarEvents ?? [],
    youtubeVideos: youtube?.youtubeVideos ?? [],
    marketQuotes: market?.marketQuotes ?? [],
    coinMarkets: market?.coinMarkets ?? [],
    marketLists: market?.marketLists ?? [],
  });
}

export async function readDb() {
  const split = await readSplitDb();
  if (split) return split;
  try {
    const body = await fs.readFile(config.dataFile, 'utf8');
    const db = ensureDbShape(JSON.parse(body));
    await writeDb(db);
    return db;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const db = defaultDb();
    await writeDb(db);
    return db;
  }
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
