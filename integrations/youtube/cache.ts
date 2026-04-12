import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from './constants';
import { fetchEconomyYoutube } from '@/integrations/youtube/economyFeed';
import type { AppLocale } from '@/locales/messages';
import type { YoutubeItem } from '@/types/signal';

/** YouTube API — memory cache TTL */
export const YOUTUBE_CACHE_TTL_MS = 10 * 60 * 1000;

export type YoutubeSortOrder = 'viewCount' | 'date';

type Entry = { items: YoutubeItem[]; expiresAt: number };

const cache = new Map<string, Entry>();

export function channelFilterKey(handles: string[]): string {
  return [...handles].sort().join('\0');
}

function cacheKey(order: YoutubeSortOrder, handles: string[], locale: AppLocale): string {
  return `${order}::${locale}::${channelFilterKey(handles)}`;
}

function resolvedHandles(handles?: string[]): string[] {
  if (handles && handles.length > 0) return [...handles];
  return [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
}

export function peekYoutubeCache(
  order: YoutubeSortOrder,
  handles: string[],
  cacheEnabled = true,
  locale: AppLocale = 'ko',
): YoutubeItem[] | null {
  if (!cacheEnabled) return null;
  const h = resolvedHandles(handles);
  const k = cacheKey(order, h, locale);
  const e = cache.get(k);
  if (e && Date.now() < e.expiresAt) {
    return e.items;
  }
  return null;
}

export async function fetchEconomyYoutubeCached(
  order: YoutubeSortOrder,
  options?: { forceRefresh?: boolean; channelHandles?: string[]; cacheEnabled?: boolean; locale?: AppLocale },
): Promise<YoutubeItem[]> {
  const handles = resolvedHandles(options?.channelHandles);
  const cacheEnabled = options?.cacheEnabled !== false;
  const locale = options?.locale ?? 'ko';

  if (!cacheEnabled) {
    return fetchEconomyYoutube(order, { channelHandles: handles, locale });
  }

  const k = cacheKey(order, handles, locale);

  if (!options?.forceRefresh) {
    const hit = cache.get(k);
    if (hit && Date.now() < hit.expiresAt) {
      return hit.items;
    }
  } else {
    cache.delete(k);
  }

  const items = await fetchEconomyYoutube(order, { channelHandles: handles, locale });
  cache.set(k, { items, expiresAt: Date.now() + YOUTUBE_CACHE_TTL_MS });
  return items;
}

export function clearYoutubeCache() {
  cache.clear();
}
