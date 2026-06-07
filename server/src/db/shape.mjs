import { normalizeMarketListsShape } from '../marketLists.mjs';
import { normalizeYoutubeCurationHandles } from '../youtubeCuration.mjs';
import { ensureYoutubeChannelsCatalog } from './youtubeChannels.mjs';
import { ensureRssSourcesCatalog } from './rssSources.mjs';
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
    db.appSettings = {};
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

  if (!Array.isArray(db.providerSettings)) db.providerSettings = [];
  db.providerSettings = db.providerSettings.filter((setting) => setting && typeof setting === 'object');
  if (!Array.isArray(db.pollingJobs)) db.pollingJobs = [];
  // Retired jobs: drop the Hyperliquid-based KR after-hours quote job from
  // existing deployments now that the night-quote feature is removed.
  db.pollingJobs = db.pollingJobs.filter((j) => j && j.jobKey !== 'market_quotes_kr_after_hours');
  ensureRssSourcesCatalog(db);
  for (const existing of db.pollingJobs) {
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
  db.marketLists = normalizeMarketListsShape(db.marketLists, nowIso);
  if (!Array.isArray(db.translationSettings)) db.translationSettings = [];
  if (!db.uiModelPresets || typeof db.uiModelPresets !== 'object') db.uiModelPresets = {};
  if (!Array.isArray(db.uiModelPresets.openai)) db.uiModelPresets.openai = [];
  if (!Array.isArray(db.uiModelPresets.claude)) db.uiModelPresets.claude = [];
  if (!Array.isArray(db.uiModelPresets.mock)) db.uiModelPresets.mock = [];
  if (!db.uiModelPresets.updatedAt) db.uiModelPresets.updatedAt = nowIso();
  if (!Array.isArray(db.newsSources)) db.newsSources = [];
  if (!db.newsSourceSettings || typeof db.newsSourceSettings !== 'object') {
    db.newsSourceSettings = {};
  }
  if (!db.newsSourceSettings.autoEnableNewSources || typeof db.newsSourceSettings.autoEnableNewSources !== 'object') {
    db.newsSourceSettings.autoEnableNewSources = {};
  }
  if (typeof db.newsSourceSettings.autoEnableNewSources.global !== 'boolean') db.newsSourceSettings.autoEnableNewSources.global = true;
  if (typeof db.newsSourceSettings.autoEnableNewSources.crypto !== 'boolean') db.newsSourceSettings.autoEnableNewSources.crypto = true;
  if (!db.newsSourceSettings.aliases || typeof db.newsSourceSettings.aliases !== 'object') {
    db.newsSourceSettings.aliases = {};
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
