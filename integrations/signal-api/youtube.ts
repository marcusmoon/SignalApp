import { signalApi } from '@/integrations/signal-api/httpClient';
import type {
  SignalApiYoutubeVideo,
  SignalNewsListMeta,
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
  json: { data?: SignalApiYoutubeVideo[]; meta?: Partial<SignalNewsListMeta> },
  params: { limit?: number; offset?: number },
): SignalYoutubeListMeta {
  const rows = Array.isArray(json.data) ? json.data : [];
  const m = json.meta;
  const limit = Number(m?.limit) || Number(params.limit) || rows.length || 30;
  const offset = Number(m?.offset) || Number(params.offset) || 0;
  const total = Number.isFinite(Number(m?.total)) ? Number(m?.total) : rows.length;
  const hasMore = typeof m?.hasMore === 'boolean' ? m.hasMore : offset + rows.length < total;
  const nextOffset = m?.nextOffset != null ? m.nextOffset : hasMore ? offset + rows.length : null;
  return { limit, offset, total, hasMore, nextOffset };
}

export async function fetchSignalYoutube(
  params?: {
    q?: string;
    channel?: string;
    sort?: 'latest' | 'popular';
    limit?: number;
    offset?: number;
    /** @deprecated 서버·캐시는 `offset`/`limit`만 쓰는 것을 권장 */
    page?: number;
    pageSize?: number;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalYoutubePage> {
  const cacheMode = options?.cacheMode || 'use';
  const { youtubeEnabled } = await loadCacheFeaturePrefs();
  const limit = params?.limit ?? params?.pageSize ?? 30;
  const offset =
    params?.offset ??
    (params?.page != null ? (Math.max(1, Number(params.page) || 1) - 1) * Number(limit) : 0);
  const cacheKey = buildSignalYoutubeCacheKey({ ...params, limit, offset });
  if (cacheMode !== 'bypass' && youtubeEnabled) {
    const hit = peekSignalYoutubeCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{
    data: SignalApiYoutubeVideo[];
    meta?: Partial<SignalNewsListMeta>;
  }>('/v1/youtube', {
    q: params?.q,
    channel: params?.channel,
    sort: params?.sort,
    limit,
    offset,
  });
  const rows = Array.isArray(json.data) ? json.data : [];
  const meta = normalizeYoutubeMeta({ ...json, data: rows }, { limit, offset });
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
    url: item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : undefined,
  };
}
