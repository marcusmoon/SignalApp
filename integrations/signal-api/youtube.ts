import { signalApi } from '@/integrations/signal-api/httpClient';
import type {
  SignalApiYoutubeChannel,
  SignalApiYoutubeVideo,
  SignalNewsListMeta,
  SignalYoutubeListMeta,
  SignalYoutubePage,
} from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { messages } from '@/locales/messages';
import type { YoutubeItem } from '@/types/signal';
import { formatRelativeFromIso } from '@/utils/date';
import { formatIso8601Duration, formatViewCount } from '@/utils/format';
import {
  buildSignalYoutubeCacheKey,
  peekSignalYoutubeCache,
  peekSignalYoutubeChannelsCache,
  storeSignalYoutubeCache,
  storeSignalYoutubeChannelsCache,
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

function formatCompactCount(value: number | null | undefined, locale: AppLocale): string | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const languageTag = locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return new Intl.NumberFormat(languageTag, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

export async function fetchSignalYoutube(
  params?: {
    q?: string;
    channel?: string;
    channelHandles?: string[];
    sort?: 'latest' | 'popular';
    limit?: number;
    offset?: number;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalYoutubePage> {
  const cacheMode = options?.cacheMode || 'use';
  const limit = params?.limit ?? 30;
  const offset = params?.offset ?? 0;
  const cacheKey = buildSignalYoutubeCacheKey({ ...params, limit, offset });
  if (cacheMode !== 'bypass') {
    const hit = peekSignalYoutubeCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{
    data: SignalApiYoutubeVideo[];
    meta?: Partial<SignalNewsListMeta>;
  }>(
    '/v1/youtube',
    {
      q: params?.q,
      channel: params?.channel,
      channelHandles:
        params?.channelHandles && params.channelHandles.length > 0
          ? params.channelHandles.join(',')
          : undefined,
      sort: params?.sort,
      limit,
      offset,
    },
    { timeoutMs: 6000, attempts: 1 },
  );
  const rows = Array.isArray(json.data) ? json.data : [];
  const meta = normalizeYoutubeMeta({ ...json, data: rows }, { limit, offset });
  const value: SignalYoutubePage = { items: rows, meta };
  if (cacheMode !== 'bypass') storeSignalYoutubeCache(cacheKey, value);
  return value;
}

export async function fetchSignalYoutubeChannels(
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiYoutubeChannel[]> {
  if (options?.cacheMode !== 'bypass') {
    const hit = peekSignalYoutubeChannelsCache();
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiYoutubeChannel[] }>('/v1/youtube-channels', undefined, {
    timeoutMs: 5000,
    attempts: 1,
  });
  const rows = Array.isArray(json.data) ? json.data : [];
  if (options?.cacheMode !== 'bypass') storeSignalYoutubeChannelsCache(rows);
  return rows;
}

export function signalYoutubeToYoutubeItem(item: SignalApiYoutubeVideo, locale: AppLocale): YoutubeItem {
  return {
    id: item.id,
    topic: messages[locale].youtubeTopicEconomy,
    title: item.title,
    channel: item.channel,
    viewLabel: formatViewCount(item.viewCount || 0),
    likeLabel: formatCompactCount(item.likeCount, locale),
    commentLabel: formatCompactCount(item.commentCount, locale),
    publishedLabel: item.publishedAt ? formatRelativeFromIso(item.publishedAt, locale) : '—',
    durationLabel: item.duration ? formatIso8601Duration(item.duration) : '—',
    description: item.description || '',
    thumbnailUrl: item.thumbnailUrl,
    captionAvailable: item.captionAvailable === true,
    definition: item.definition || '',
    categoryId: item.categoryId || null,
    topicCategories: Array.isArray(item.topicCategories) ? item.topicCategories : [],
    channelThumbnailUrl: item.channelThumbnailUrl || null,
    channelDescription: item.channelDescription || '',
    channelSubscriberLabel: formatCompactCount(item.channelSubscriberCount, locale),
    channelVideoCountLabel: formatCompactCount(item.channelVideoCount, locale),
    channelViewLabel: formatCompactCount(item.channelViewCount, locale),
    channelCustomUrl: item.channelCustomUrl || null,
    channelCountry: item.channelCountry || null,
    videoId: item.videoId,
    url: item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : undefined,
  };
}
