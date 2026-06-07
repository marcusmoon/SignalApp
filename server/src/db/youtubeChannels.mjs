import { normalizeYoutubeCurationHandles, normalizeYoutubeHandle } from '../youtubeCuration.mjs';

export function youtubeChannelIdFromHandle(handle) {
  const h = normalizeYoutubeHandle(handle);
  return h ? `yt-${h.toLowerCase()}` : '';
}

export function syncYoutubeCurationHandlesFromCatalog(appSettings) {
  const catalog = Array.isArray(appSettings?.youtubeChannels) ? appSettings.youtubeChannels : [];
  const handles = catalog
    .filter((c) => c && c.hidden !== true && c.enabled !== false)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((c) => normalizeYoutubeHandle(c.handle))
    .filter(Boolean);
  appSettings.youtubeCurationHandles = normalizeYoutubeCurationHandles(handles);
}

export function ensureYoutubeChannelsCatalog(appSettings) {
  if (!appSettings || typeof appSettings !== 'object') return [];
  const existing = Array.isArray(appSettings.youtubeChannels) ? appSettings.youtubeChannels : [];
  if (existing.length > 0) {
    syncYoutubeCurationHandlesFromCatalog(appSettings);
    return existing;
  }
  const handles = normalizeYoutubeCurationHandles(appSettings.youtubeCurationHandles);
  appSettings.youtubeChannels = handles.map((handle, idx) => ({
    id: youtubeChannelIdFromHandle(handle),
    handle,
    title: `@${handle}`,
    enabled: true,
    hidden: false,
    order: idx + 1,
  }));
  syncYoutubeCurationHandlesFromCatalog(appSettings);
  return appSettings.youtubeChannels;
}

export function listActiveYoutubeChannelHandles(appSettings) {
  const catalog = ensureYoutubeChannelsCatalog(appSettings);
  return catalog
    .filter((c) => c && c.hidden !== true && c.enabled !== false)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((c) => normalizeYoutubeHandle(c.handle))
    .filter(Boolean);
}
