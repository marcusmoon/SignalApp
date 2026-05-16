import { signalApi } from '@/integrations/signal-api/httpClient';
import type {
  SignalApiYoutubeVideo,
  SignalYoutubeListMeta,
  SignalYoutubePage,
} from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { messages } from '@/locales/messages';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import type { YoutubeItem } from '@/types/signal';
import { formatRelativeFromIso } from '@/utils/date';
import { formatIso8601Duration, formatViewCount } from '@/utils/format';
import {
  buildSignalYoutubeCacheKey,
  peekSignalYoutubeCache,
  storeSignalYoutubeCache,
} from '@/integrations/signal-api/cache/youtubeCache';

function normalizeYoutubeMeta(
  json: {
    data?: SignalApiYoutubeVideo[];
    page?: unknown;
    pageSize?: unknown;
    total?: unknown;
    totalPages?: unknown;
  },
  params?: { page?: number; pageSize?: number },
): SignalYoutubeListMeta {
  const rows = Array.isArray(json.data) ? json.data : [];
  const page = Math.max(1, Number(json.page) || Number(params?.page) || 1);
  const pageSizeRaw = Number(json.pageSize) || Number(params?.pageSize);
  const pageSize = Math.max(1, Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : rows.length || 30);
  const total = Number.isFinite(Number(json.total)) ? Number(json.total) : rows.length;
  const totalPages = Math.max(
    1,
    Number.isFinite(Number(json.totalPages)) ? Number(json.totalPages) : Math.ceil(total / pageSize) || 1,
  );
  const hasMore = page < totalPages;
  const nextPage = hasMore ? page + 1 : null;
  return { page, pageSize, total, totalPages, hasMore, nextPage };
}

export async function fetchSignalYoutube(
  params?: {
    q?: string;
    channel?: string;
    sort?: 'latest' | 'popular';
    page?: number;
    pageSize?: number;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalYoutubePage> {
  const cacheMode = options?.cacheMode || 'use';
  const { youtubeEnabled } = await loadCacheFeaturePrefs();
  const cacheKey = buildSignalYoutubeCacheKey(params);
  if (cacheMode !== 'bypass' && youtubeEnabled) {
    const hit = peekSignalYoutubeCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{
    data: SignalApiYoutubeVideo[];
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  }>('/v1/youtube', {
    ...params,
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 30,
  });
  const rows = Array.isArray(json.data) ? json.data : [];
  const meta = normalizeYoutubeMeta({ ...json, data: rows }, params);
  const value: SignalYoutubePage = { items: rows, meta };
  if (youtubeEnabled) storeSignalYoutubeCache(cacheKey, value);
  return value;
}

export function signalYoutubeToYoutubeItem(item: SignalApiYoutubeVideo, locale: AppLocale): YoutubeItem {
  return {
    id: item.id,
    topic: messages[locale].youtubeTopicEconomy,
    title: item.title,
    channel: item.channel,
    viewLabel: formatViewCount(item.viewCount || 0),
    publishedLabel: item.publishedAt ? formatRelativeFromIso(item.publishedAt, locale) : '—',
    durationLabel: item.duration ? formatIso8601Duration(item.duration) : '—',
    thumbnailUrl: item.thumbnailUrl,
    videoId: item.videoId,
  };
}
