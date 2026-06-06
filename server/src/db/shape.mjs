import { ensureMarketListsShape } from '../marketLists.mjs';
import { normalizeYoutubeCurationHandles } from '../youtubeCuration.mjs';
import { ensureYoutubeChannelsCatalog } from './youtubeChannels.mjs';
import { ensureRssSourcesCatalog } from './rssSources.mjs';
import {
  defaultDb,
  defaultPollingJobs,
  defaultProviderSettings,
  defaultTranslationSettings,
  defaultUiModelPresets,
} from './defaults.mjs';
import { ensureNewsSourcesFromItems } from './newsSources.mjs';
import { nowIso } from './time.mjs';

function stableCalendarKey(item) {
  if (!item || typeof item !== 'object') return '';
  const provider = String(item.provider || '').trim().toLowerCase();
  const providerItemId = String(item.providerItemId || '').trim();
  if (provider && providerItemId) return `${provider}:${providerItemId}`;
  const type = String(item.type || '').trim().toLowerCase();
  const date = String(item.date || item.eventAt || '').slice(0, 10);
  const symbol = String(item.symbol || '').trim().toUpperCase();
  const title = String(item.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const country = String(item.country || '').trim().toLowerCase();
  return [provider, type, date, symbol, title, country].join('|');
}

function latestCalendarItem(a, b) {
  const aTime = Date.parse(a?.fetchedAt || a?.updatedAt || a?.createdAt || a?.eventAt || a?.date || 0);
  const bTime = Date.parse(b?.fetchedAt || b?.updatedAt || b?.createdAt || b?.eventAt || b?.date || 0);
  return (Number.isFinite(bTime) ? bTime : 0) >= (Number.isFinite(aTime) ? aTime : 0) ? b : a;
}

function dedupeCalendarEvents(rows) {
  const byKey = new Map();
  for (const row of rows || []) {
    if (!row || typeof row !== 'object') continue;
    const key = stableCalendarKey(row) || String(row.id || '');
    if (!key) continue;
    const prev = byKey.get(key);
    byKey.set(key, prev ? latestCalendarItem(prev, row) : row);
  }
  return [...byKey.values()];
}

export function ensureDbShape(db) {
  if (!db.appSettings || typeof db.appSettings !== 'object') {
    db.appSettings = defaultDb().appSettings;
  }
  const youtubeHandlesFromJobs = Array.isArray(db.pollingJobs)
    ? db.pollingJobs.find((j) => j?.handler === 'youtube_economy' && Array.isArray(j?.params?.handles))?.params?.handles
    : null;
  if (!Number.isFinite(Number(db.appSettings.marketQuotesMaxAgeSec))) db.appSettings.marketQuotesMaxAgeSec = 10;
  db.appSettings.marketQuotesMaxAgeSec = Math.max(0, Math.min(300, Number(db.appSettings.marketQuotesMaxAgeSec) || 10));
  db.appSettings.youtubeCurationHandles = normalizeYoutubeCurationHandles(
    Array.isArray(db.appSettings.youtubeCurationHandles) ? db.appSettings.youtubeCurationHandles : youtubeHandlesFromJobs,
  );
  ensureYoutubeChannelsCatalog(db.appSettings);
  if (!db.appSettings.updatedAt) db.appSettings.updatedAt = nowIso();

  if (!Array.isArray(db.providerSettings)) {
    db.providerSettings = defaultProviderSettings();
  }
  db.providerSettings = db.providerSettings.filter((setting) => setting && typeof setting === 'object');
  for (const defaultSetting of defaultProviderSettings()) {
    if (!db.providerSettings.some((s) => s.provider === defaultSetting.provider)) {
      db.providerSettings.push(defaultSetting);
    }
  }
  if (!Array.isArray(db.pollingJobs)) db.pollingJobs = defaultPollingJobs();
  // Retired jobs: drop the Hyperliquid-based KR after-hours quote job from
  // existing deployments now that the night-quote feature is removed.
  db.pollingJobs = db.pollingJobs.filter((j) => j && j.jobKey !== 'market_quotes_kr_after_hours');
  ensureRssSourcesCatalog(db);
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
    if (
      existing.jobKey === 'market_news_financial_juice' ||
      existing.jobKey === 'market_news_financial_juice_reconcile'
    ) {
      existing.params = { ...(defaultJob.params || {}), ...(existing.params || {}), rssSourceId: 'financial_juice' };
      delete existing.params.feedUrl;
      delete existing.params.providerId;
      delete existing.params.sourceName;
      delete existing.params.category;
    }
    if (existing.jobKey === 'market_news_globenewswire_earnings') {
      const existingIds = Array.isArray(existing.params?.rssSourceIds) ? existing.params.rssSourceIds : [];
      const defaultIds = Array.isArray(defaultJob.params?.rssSourceIds) ? defaultJob.params.rssSourceIds : [];
      existing.params = {
        ...(defaultJob.params || {}),
        ...(existing.params || {}),
        rssSourceId: existing.params?.rssSourceId || 'globenewswire_earnings',
        rssSourceIds: [...new Set([...existingIds, ...defaultIds])],
      };
      delete existing.params.feedUrl;
      delete existing.params.providerId;
      delete existing.params.sourceName;
      delete existing.params.category;
    }
    if (existing.jobKey === 'market_quotes_popular' && !existing.params.listKey) {
      existing.params = { ...existing.params, listKey: 'popular_symbols' };
    }
    if (existing.jobKey === 'market_quotes_watchlist' && !existing.params.listKey) {
      existing.params = { ...existing.params, listKey: 'default_watchlist' };
    }
    if (existing.jobKey === 'market_quotes_mcap' && !existing.params.listKey) {
      existing.params = { ...existing.params, listKey: 'mcap_universe' };
    }
    if (existing.jobKey === 'quant_price_series_kr') {
      // The KR universe is a managed market-cap list, so always realign the
      // instruments/labels with the current defaults while preserving the
      // operator's enabled/interval choices.
      existing.displayName = defaultJob.displayName;
      existing.description = defaultJob.description;
      existing.params = {
        ...(existing.params || {}),
        ...(defaultJob.params || {}),
      };
    }
    if (existing.jobKey === 'concall_transcripts_recent' && existing.params.fallbackLatest == null) {
      existing.params = { ...existing.params, fallbackLatest: true };
    }
    if (existing.jobKey === 'calendar_economic' && existing.params.daysBack == null) {
      existing.params = { ...existing.params, daysBack: defaultJob.params.daysBack };
    }
    if (existing.jobKey === 'calendar_earnings' && existing.params.daysBack == null) {
      existing.params = { ...existing.params, daysBack: defaultJob.params.daysBack };
    }
    if (existing.handler === 'youtube_economy' && existing.params && typeof existing.params === 'object' && Array.isArray(existing.params.handles)) {
      const { handles, ...rest } = existing.params;
      existing.params = rest;
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
  db.calendarEvents = dedupeCalendarEvents(db.calendarEvents);
  if (!Array.isArray(db.concallTranscripts)) db.concallTranscripts = [];
  if (!Array.isArray(db.youtubeVideos)) db.youtubeVideos = [];
  if (!Array.isArray(db.marketQuotes)) db.marketQuotes = [];
  if (!Array.isArray(db.coinMarkets)) db.coinMarkets = [];
  if (!Array.isArray(db.priceSeries)) db.priceSeries = [];
  if (!Array.isArray(db.quantSignalItems)) db.quantSignalItems = [];
  if (!Array.isArray(db.insightItems)) db.insightItems = [];
  if (!Array.isArray(db.notificationItems)) db.notificationItems = [];
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
      rssSources: shaped.rssSources,
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
      priceSeries: shaped.priceSeries,
    },
    insights: {
      insightItems: shaped.insightItems,
      notificationItems: shaped.notificationItems,
      quantSignalItems: shaped.quantSignalItems,
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
    rssSources: stores.settings?.rssSources ?? [],
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
    priceSeries: stores.market?.priceSeries ?? [],
    quantSignalItems: stores.insights?.quantSignalItems ?? [],
    insightItems: stores.insights?.insightItems ?? [],
    notificationItems: stores.insights?.notificationItems ?? [],
  });
  ensureNewsSourcesFromItems(shaped);
  return shaped;
}
