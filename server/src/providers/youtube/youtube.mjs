import { getProviderSetting } from '../../providerSettings.mjs';

const DEFAULT_HANDLES = ['futuresnow', 'LikeUSStock', 't3chfeed', 'unrealtech', 'lucky_tv'];
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

async function collectVideoIds(order, handles) {
  const ids = new Set();
  for (const handle of handles) {
    const channelId = await fetchChannelIdByHandle(handle).catch(() => null);
    if (!channelId) continue;
    const channelIds = await searchVideoIdsOnChannel(channelId, order);
    for (const id of channelIds) ids.add(id);
  }
  if (ids.size === 0) {
    const fallback = await searchVideoIdsByKeyword(order);
    for (const id of fallback) ids.add(id);
  }
  return [...ids];
}

function normalizeYoutubeVideo(raw, order) {
  const viewCount = Number.parseInt(raw.statistics?.viewCount || '0', 10) || 0;
  return {
    id: `youtube-${raw.id}`,
    provider: 'youtube',
    providerItemId: raw.id,
    videoId: raw.id,
    topic: 'Economy',
    title: raw.snippet?.title || '',
    channel: raw.snippet?.channelTitle || '',
    channelId: raw.snippet?.channelId || '',
    description: raw.snippet?.description || '',
    publishedAt: raw.snippet?.publishedAt || null,
    duration: raw.contentDetails?.duration || '',
    viewCount,
    thumbnailUrl: `https://i.ytimg.com/vi/${raw.id}/mqdefault.jpg`,
    fetchedAt: new Date().toISOString(),
    sortBucket: order === 'viewCount' ? 'popular' : 'latest',
    rawPayload: raw,
  };
}

export async function fetchYoutubeEconomy({ order = 'date', handles } = {}) {
  const normalizedOrder = order === 'viewCount' || order === 'popular' ? 'viewCount' : 'date';
  const channelHandles = Array.isArray(handles) && handles.length > 0 ? handles : DEFAULT_HANDLES;
  const ids = await collectVideoIds(normalizedOrder, channelHandles);
  if (ids.length === 0) return [];
  const raw = await youtubeFetch('videos', {
    part: 'snippet,contentDetails,statistics',
    id: ids.slice(0, 50).join(','),
  });
  const rows = raw.items || [];
  rows.sort((a, b) => {
    if (normalizedOrder === 'viewCount') {
      return (Number.parseInt(b.statistics?.viewCount || '0', 10) || 0) - (Number.parseInt(a.statistics?.viewCount || '0', 10) || 0);
    }
    return new Date(b.snippet?.publishedAt || 0).getTime() - new Date(a.snippet?.publishedAt || 0).getTime();
  });
  return rows.map((row) => normalizeYoutubeVideo(row, normalizedOrder));
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
    for (const row of raw.items || []) out.push(normalizeYoutubeVideo(row, order));
  }
  return out;
}
