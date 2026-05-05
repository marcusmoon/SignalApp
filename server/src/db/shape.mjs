import { ensureMarketListsShape } from '../marketLists.mjs';
import {
  defaultDb,
  defaultPollingJobs,
  defaultProviderSettings,
  defaultTranslationSettings,
  defaultUiModelPresets,
} from './defaults.mjs';
import { ensureNewsSourcesFromItems } from './newsSources.mjs';
import { nowIso } from './time.mjs';

export function ensureDbShape(db) {
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
  if (!Array.isArray(db.insightItems)) db.insightItems = [];
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

export function splitStoresFromDb(db) {
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
    insights: {
      insightItems: shaped.insightItems,
    },
  };
}

export function shapeDbFromStores(stores) {
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
    insightItems: stores.insights?.insightItems ?? [],
  });
  ensureNewsSourcesFromItems(shaped);
  return shaped;
}
