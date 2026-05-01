import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiYoutubeVideo } from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { messages } from '@/locales/messages';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import type { YoutubeItem } from '@/types/signal';
import { formatRelativeFromIso } from '@/utils/date';
import { formatIso8601Duration, formatViewCount } from '@/utils/format';
import { buildSignalYoutubeCacheKey, peekSignalYoutubeCache, storeSignalYoutubeCache } from '@/integrations/signal-api/cache/youtubeCache';

export async function fetchSignalYoutube(
  params?: {
  q?: string;
  channel?: string;
  page?: number;
  pageSize?: number;
},
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiYoutubeVideo[]> {
  const cacheMode = options?.cacheMode || 'use';
  const { youtubeEnabled } = await loadCacheFeaturePrefs();
  const cacheKey = buildSignalYoutubeCacheKey(params);
  if (cacheMode !== 'bypass' && youtubeEnabled) {
    const hit = peekSignalYoutubeCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiYoutubeVideo[] }>('/v1/youtube', params);
  const rows = Array.isArray(json.data) ? json.data : [];
  if (cacheMode !== 'bypass' && youtubeEnabled) storeSignalYoutubeCache(cacheKey, rows);
  return rows;
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
