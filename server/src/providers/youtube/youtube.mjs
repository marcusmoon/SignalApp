import { getProviderSetting } from '../../providerSettings.mjs';
import { normalizeYoutubeCurationHandles } from '../../youtubeCuration.mjs';

const SEARCH_QUERY_FALLBACKS = [
  'US economy Federal Reserve inflation news',
  'economy news today',
  'stock market economy news today',
];

function youtubeUrl(path, params, key) {
  const q = new URLSearchParams({ ...params, key });
  return `https://www.googleapis.com/youtube/v3/${path}?${q.toString()}`;
}

async function youtubeFetch(path, params) {
  const setting = await getProviderSetting('youtube');
  if (!setting.enabled) throw new Error('YOUTUBE_PROVIDER_DISABLED');
  if (!setting.apiKey) throw new Error('YOUTUBE_API_KEY_MISSING');
  const res = await fetch(youtubeUrl(path, params, setting.apiKey));
  const raw = await res.json();
  if (!res.ok) {
    const msg = raw?.error?.message || JSON.stringify(raw).slice(0, 240);
    throw new Error(`YouTube ${res.status}: ${msg}`);
  }
  if (raw?.error?.message) throw new Error(`YouTube body: ${raw.error.message}`);
  return raw;
}

async function fetchChannelIdByHandle(handle) {
  const raw = await youtubeFetch('channels', { part: 'id', forHandle: handle });
  return raw.items?.[0]?.id || null;
}

async function searchVideoIdsOnChannel(channelId, order) {
  const raw = await youtubeFetch('search', {
    part: 'snippet',
    channelId,
    type: 'video',
    maxResults: '6',
    order,
  });
  return (raw.items || []).map((item) => item.id?.videoId).filter(Boolean);
}

async function searchVideoIdsByKeyword(order) {
  for (const q of SEARCH_QUERY_FALLBACKS) {
    const raw = await youtubeFetch('search', {
      part: 'snippet',
      type: 'video',
      maxResults: '10',
      order,
      q,
    });
    const ids = (raw.items || []).map((item) => item.id?.videoId).filter(Boolean);
    if (ids.length > 0) return ids;
  }
  return [];
}

function numberOrNull(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

function bestThumbnail(thumbnails) {
  return (
    thumbnails?.maxres?.url ||
    thumbnails?.standard?.url ||
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    thumbnails?.default?.url ||
    null
  );
}

function compactYoutubePayload(raw) {
  const snippet = raw.snippet || {};
  const contentDetails = raw.contentDetails || {};
  const statistics = raw.statistics || {};
  return {
    id: raw.id,
    snippet: {
      title: snippet.title || '',
      channelTitle: snippet.channelTitle || '',
      channelId: snippet.channelId || '',
      description: snippet.description || '',
      publishedAt: snippet.publishedAt || null,
      thumbnails: snippet.thumbnails || undefined,
    },
    contentDetails: {
      duration: contentDetails.duration || '',
    },
    statistics: {
      viewCount: statistics.viewCount || '0',
    },
  };
}

async function collectVideoIds(order, handles) {
  const idToHandle = new Map();
  for (const handle of handles) {
    const channelId = await fetchChannelIdByHandle(handle).catch(() => null);
    if (!channelId) continue;
    const channelIds = await searchVideoIdsOnChannel(channelId, order);
    for (const id of channelIds) {
      if (!idToHandle.has(id)) idToHandle.set(id, handle);
    }
  }
  if (idToHandle.size === 0) {
    const fallback = await searchVideoIdsByKeyword(order);
    for (const id of fallback) idToHandle.set(id, null);
  }
  return idToHandle;
}

function normalizeYoutubeVideo(raw, order, channelHandle = null) {
  const snippet = raw.snippet || {};
  const statistics = raw.statistics || {};
  const contentDetails = raw.contentDetails || {};
  const viewCount = numberOrNull(statistics.viewCount) || 0;
  const sortBucket = order === 'viewCount' ? 'popular' : 'latest';
  const item = {
    id: `youtube-${raw.id}`,
    provider: 'youtube',
    providerItemId: raw.id,
    videoId: raw.id,
    topic: 'Economy',
    title: snippet.title || '',
    channel: snippet.channelTitle || '',
    channelId: snippet.channelId || '',
    channelHandle,
    description: snippet.description || '',
    publishedAt: snippet.publishedAt || null,
    duration: contentDetails.duration || '',
    viewCount,
    thumbnailUrl: bestThumbnail(snippet.thumbnails) || `https://i.ytimg.com/vi/${raw.id}/mqdefault.jpg`,
    fetchedAt: new Date().toISOString(),
    rawPayload: compactYoutubePayload(raw),
  };
  if (order !== 'preserve') {
    item.sortBucket = sortBucket;
    item.sortBuckets = [sortBucket];
  }
  return item;
}

export async function fetchYoutubeEconomy({ order = 'date', handles } = {}) {
  const normalizedOrder = order === 'viewCount' || order === 'popular' ? 'viewCount' : 'date';
  const channelHandles = normalizeYoutubeCurationHandles(handles);
  const idToHandle = await collectVideoIds(normalizedOrder, channelHandles);
  const ids = [...idToHandle.keys()];
  if (ids.length === 0) return [];
  const raw = await youtubeFetch('videos', {
    part: 'snippet,contentDetails,statistics',
    id: ids.slice(0, 50).join(','),
  });
  const rows = raw.items || [];
  rows.sort((a, b) => {
    if (normalizedOrder === 'viewCount') {
      return (numberOrNull(b.statistics?.viewCount) || 0) - (numberOrNull(a.statistics?.viewCount) || 0);
    }
    return new Date(b.snippet?.publishedAt || 0).getTime() - new Date(a.snippet?.publishedAt || 0).getTime();
  });
  return rows.map((row) => normalizeYoutubeVideo(row, normalizedOrder, idToHandle.get(row.id) || null));
}

export async function fetchYoutubeVideosByIds(videoIds, { order = 'date' } = {}) {
  const ids = [...new Set((videoIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (ids.length === 0) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const raw = await youtubeFetch('videos', {
      part: 'snippet,contentDetails,statistics',
      id: ids.slice(i, i + 50).join(','),
    });
    out.push(...(raw.items || []).map((row) => normalizeYoutubeVideo(row, order)));
  }
  return out;
}
